@echo off
title Yamogu - Live Agent Monitor
cd /d "%~dp0..\.."
echo Live center starting on http://127.0.0.1:8765
echo Close this window to stop the local monitor.
start "" /b powershell.exe -NoProfile -Command "Start-Sleep -Seconds 2; Start-Process 'http://127.0.0.1:8765/'"
node "scripts\agents\live-center.cjs"
echo Monitor stopped or failed. Check Node.js and port 8765.
pause
