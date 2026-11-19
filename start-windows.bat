@echo off
title Server GHIFARI CBT - SMK AL-GHIFARI
color 1F
echo ============================================================
echo   GHIFARI CBT - SMK AL-GHIFARI
echo   Smarter Examination. Better Education.
echo   Developed by MARGUMI STUDIO
echo ============================================================
echo.
set NODE_ENV=production
set PORT=3000

echo Memulai server pada port %PORT% (Akses LAN aktif)...
echo Pastikan Firewall Windows mengizinkan TCP port %PORT%.
echo Tekan Ctrl+C atau jalankan stop-windows.bat untuk menghentikan.
echo.
npx tsx server.ts
pause
