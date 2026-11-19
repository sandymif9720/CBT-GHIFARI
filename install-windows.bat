@echo off
title Instalasi GHIFARI CBT - SMK AL-GHIFARI
color 1F
echo ============================================================
echo   GHIFARI CBT - SMK AL-GHIFARI
echo   Smarter Examination. Better Education.
echo   Developed by MARGUMI STUDIO
echo ============================================================
echo.
echo [1/3] Memeriksa Node.js...
node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js belum terpasang! Silakan pasang Node.js v20/v22 LTS terlebih dahulu.
    pause
    exit /b 1
)
node -v

echo.
echo [2/3] Menginstal paket dependensi aplikasi...
call npm install
if %errorlevel% neq 0 (
    echo [ERROR] Gagal menginstal dependensi. Periksa koneksi atau cache npm.
    pause
    exit /b 1
)

echo.
echo [3/3] Membangun antarmuka produksi (Vite Build)...
call npm run build
if %errorlevel% neq 0 (
    echo [ERROR] Build produksi gagal.
    pause
    exit /b 1
)

echo.
echo ============================================================
echo   INSTALASI SELESAI!
echo   Jalankan start-windows.bat untuk memulai server LAN.
echo ============================================================
pause
