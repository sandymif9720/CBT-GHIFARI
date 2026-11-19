@echo off
title Hentikan Server GHIFARI CBT
echo Menghentikan proses Node.js / GHIFARI CBT yang berjalan di port 3000...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3000" ^| findstr "LISTENING"') do (
    echo Menghentikan PID %%a...
    taskkill /F /PID %%a >nul 2>&1
)
echo Server GHIFARI CBT telah dihentikan.
pause
