$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$repoRoot = Split-Path -Parent $PSScriptRoot
$runtimeDir = Join-Path $repoRoot '.runtime'
$statePath = Join-Path $runtimeDir 'startup-state.json'
$startupDoc = Join-Path $repoRoot 'STARTUP.md'

New-Item -ItemType Directory -Force -Path $runtimeDir | Out-Null

function Write-StartupLog {
  param(
    [string]$Issue,
    [string]$Fix
  )

  if (-not (Test-Path $startupDoc)) {
    return
  }

  $timestamp = (Get-Date).ToString('yyyy-MM-dd HH:mm:ss')
  $safeIssue = $Issue.Replace('|', '/').Trim()
  $safeFix = $Fix.Replace('|', '/').Trim()
  Add-Content -Path $startupDoc -Value "| $timestamp | $safeIssue | $safeFix |"
}

function Test-HttpEndpoint {
  param(
    [string]$Url,
    [int]$TimeoutSec = 5
  )

  try {
    $response = Invoke-WebRequest -Uri $Url -TimeoutSec $TimeoutSec -UseBasicParsing
    return $response.StatusCode -ge 200 -and $response.StatusCode -lt 500
  } catch {
    return $false
  }
}

function Wait-ForCondition {
  param(
    [scriptblock]$Condition,
    [int]$TimeoutSec,
    [int]$IntervalSec = 3
  )

  $deadline = (Get-Date).AddSeconds($TimeoutSec)
  while ((Get-Date) -lt $deadline) {
    if (& $Condition) {
      return $true
    }

    Start-Sleep -Seconds $IntervalSec
  }

  return $false
}

function Get-DockerDesktopPath {
  $candidates = @(
    (Join-Path $env:ProgramFiles 'Docker\Docker\Docker Desktop.exe'),
    (Join-Path $env:LocalAppData 'Programs\Docker\Docker\Docker Desktop.exe')
  )

  foreach ($candidate in $candidates) {
    if (Test-Path $candidate) {
      return $candidate
    }
  }

  return $null
}

function Test-DockerReady {
  cmd /c "docker info >nul 2>nul"
  return $LASTEXITCODE -eq 0
}

function Ensure-DockerRunning {
  $dockerCli = Get-Command docker -ErrorAction SilentlyContinue
  if (-not $dockerCli) {
    Write-StartupLog 'Docker CLI not found during startup.' 'Skipped Docker bootstrap because this workspace can run without containers.'
    return $false
  }

  if (Test-DockerReady) {
    return $true
  }

  $dockerDesktop = Get-DockerDesktopPath
  if (-not $dockerDesktop) {
    Write-StartupLog 'Docker was not running and Docker Desktop was not found.' 'Skipped container startup. Install Docker Desktop or provide a compose environment later.'
    return $false
  }

  Start-Process -FilePath $dockerDesktop | Out-Null
  $ready = Wait-ForCondition -Condition {
    return Test-DockerReady
  } -TimeoutSec 180 -IntervalSec 5

  if (-not $ready) {
    Write-StartupLog 'Docker Desktop did not become ready within 180 seconds.' 'Startup continued without container orchestration.'
    return $false
  }

  Write-StartupLog 'Docker was not running at startup.' 'Started Docker Desktop and waited for docker info to succeed.'
  return $true
}

function Get-ComposeFile {
  $composeNames = @('docker-compose.yml', 'docker-compose.yaml', 'compose.yml', 'compose.yaml')
  foreach ($name in $composeNames) {
    $candidate = Join-Path $repoRoot $name
    if (Test-Path $candidate) {
      return $candidate
    }
  }

  return $null
}

function Ensure-Dependencies {
  $nodeModules = Join-Path $repoRoot 'node_modules'
  if (-not (Test-Path $nodeModules)) {
    Write-StartupLog 'node_modules was missing at startup.' 'Ran npm install before launching the app.'
    Push-Location $repoRoot
    try {
      npm install
      if ($LASTEXITCODE -ne 0) {
        throw 'npm install failed.'
      }
    } finally {
      Pop-Location
    }
  }
}

if ((Test-HttpEndpoint 'http://localhost:5173/') -and (Test-HttpEndpoint 'http://localhost:3001/api/health')) {
  Write-Host 'App is already running at http://localhost:5173 and http://localhost:3001.'
  Write-StartupLog 'Startup requested while the app was already running.' 'Reused the existing frontend and backend processes.'
  exit 0
}

$dockerReady = Ensure-DockerRunning
$composeFile = Get-ComposeFile

if ($dockerReady -and $composeFile) {
  Push-Location $repoRoot
  try {
    docker compose -f $composeFile up -d
    if ($LASTEXITCODE -ne 0) {
      Write-StartupLog 'docker compose up failed during startup.' 'App startup continued without local containers.'
    }
  } finally {
    Pop-Location
  }
}

Ensure-Dependencies

$process = Start-Process -FilePath 'powershell' -ArgumentList @(
  '-NoExit',
  '-ExecutionPolicy',
  'Bypass',
  '-Command',
  "Set-Location '$repoRoot'; npm run dev"
) -PassThru

$frontendReady = Wait-ForCondition -Condition { Test-HttpEndpoint 'http://localhost:5173/' } -TimeoutSec 90 -IntervalSec 2
$backendReady = Wait-ForCondition -Condition { Test-HttpEndpoint 'http://localhost:3001/api/health' } -TimeoutSec 90 -IntervalSec 2

$state = [ordered]@{
  appProcessId = $process.Id
  composeFile = $composeFile
  dockerWasReady = $dockerReady
  startedAt = (Get-Date).ToString('o')
}
$state | ConvertTo-Json | Set-Content -Path $statePath

if (-not $frontendReady) {
  Write-StartupLog 'Frontend did not become ready on http://localhost:5173 within 90 seconds.' 'Inspect the npm run dev terminal output before retrying startup.'
  throw 'Frontend startup timed out.'
}

if (-not $backendReady) {
  Write-StartupLog 'Backend did not become ready on http://localhost:3001/api/health within 90 seconds.' 'Inspect the npm run dev terminal output before retrying startup.'
  throw 'Backend startup timed out.'
}

Write-Host 'Frontend ready at http://localhost:5173/'
Write-Host 'Backend ready at http://localhost:3001/'