$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$repoRoot = Split-Path -Parent $PSScriptRoot
$runtimeDir = Join-Path $repoRoot '.runtime'
$statePath = Join-Path $runtimeDir 'startup-state.json'

function Stop-ProcessTree {
  param([int]$ProcessId)

  $process = Get-Process -Id $ProcessId -ErrorAction SilentlyContinue
  if ($null -eq $process) {
    return
  }

  cmd /c "taskkill /PID $ProcessId /T /F" | Out-Null
}

if (-not (Test-Path $statePath)) {
  Write-Host 'No startup state file was found. Nothing to stop.'
  exit 0
}

$state = Get-Content -Path $statePath -Raw | ConvertFrom-Json

if ($state.appProcessId) {
  Stop-ProcessTree -ProcessId ([int]$state.appProcessId)
}

if ($state.composeFile) {
  $dockerCli = Get-Command docker -ErrorAction SilentlyContinue
  if ($dockerCli) {
    Push-Location $repoRoot
    try {
      docker compose -f $state.composeFile down | Out-Null
    } finally {
      Pop-Location
    }
  }
}

Remove-Item -Path $statePath -Force -ErrorAction SilentlyContinue
Write-Host 'Startup-managed processes have been stopped.'