@echo off
title Backup Database GHIFARI CBT - SMK AL-GHIFARI
setlocal enabledelayedexpansion

set DB_FILE=backend\storage\ghifari_cbt.db
set BACKUP_DIR=backend\storage\backups

if not exist "%DB_FILE%" (
    echo [ERROR] Database %DB_FILE% belum ditemukan. Jalankan server minimal satu kali.
    pause
    exit /b 1
)

if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"

for /f "tokens=2 delims==" %%I in ('wmic os get localdatetime /value') do set datetime=%%I
set STAMP=%datetime:~0,4%-%datetime:~4,2%-%datetime:~6,2%_%datetime:~8,2%-%datetime:~10,2%-%datetime:~12,2%
set TARGET=%BACKUP_DIR%\ghifari-cbt-manual-%STAMP%.db

copy /Y "%DB_FILE%" "%TARGET%" >nul
if %errorlevel% equ 0 (
    echo [BERHASIL] Cadangan database disimpan ke:
    echo   %TARGET%
) else (
    echo [ERROR] Gagal menyalin database.
)
pause
