@echo off
title Yamogu - Agent Command Center
cd /d "%~dp0..\.."
powershell.exe -NoProfile -Command "try { $null=Invoke-WebRequest -Uri 'http://127.0.0.1:18766/api/status' -TimeoutSec 2 -UseBasicParsing; exit 0 } catch { exit 1 }"
if not errorlevel 1 (
  start "" "http://127.0.0.1:18766/"
  exit /b 0
)
echo [Yamogu] Starting the supervisor on http://127.0.0.1:18766
start "" /b powershell.exe -NoProfile -Command "Start-Sleep -Seconds 2; Start-Process 'http://127.0.0.1:18766/'"
node "scripts\agents\agent-supervisor.cjs"
echo [Yamogu] Supervisor stopped or port busy.
pause
