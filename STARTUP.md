# Startup Instructions

Use one script to bring the workspace up and one script to shut it down cleanly.

## Start

From the repository root, run:

```powershell
npm run startup
```

What the startup script does:

1. Checks whether the frontend and backend are already running and reuses them if they are healthy.
2. Tries to start Docker Desktop and waits for `docker info` to succeed before attempting container orchestration.
3. Starts `docker compose up -d` automatically if a compose file exists in the repository root.
4. Ensures dependencies are present.
5. Launches `npm run dev` in a separate PowerShell process.
6. Waits for `http://localhost:5173/` and `http://localhost:3001/api/health` to become healthy.

## Stop

From the repository root, run:

```powershell
npm run shutdown
```

What the shutdown script does:

1. Stops the PowerShell process tree created by the startup script.
2. Runs `docker compose down` if the startup script brought containers up.
3. Clears the local startup state file.

## Notes

- Runtime state is stored in `.runtime/startup-state.json` and is ignored by git.
- Persistent API cache files are stored in `.runtime/api-cache` and are ignored by git.
- Docker is treated as optional today because this repo does not yet include a compose file.
- The startup log below is append-only and is intended to be hardened over time with real-world failures and fixes.

## Startup Issue Log

| Timestamp | Issue | Fix |
| --- | --- | --- |
| 2026-04-02 07:00:00 | Overpass primary endpoint timed out while looking up POIs for a Yellowstone asset. | Added fallback Overpass mirrors and retained graceful UI degradation when all mirrors are unavailable. |
| 2026-04-02 08:25:00 | `docker info` wrote a non-fatal warning to stderr and PowerShell treated it as a terminating startup error. | Switched Docker readiness checks to a shell-level exit-code probe so warnings do not abort startup. |