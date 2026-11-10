@echo off
chcp 65001 >nul
title EsnafRadar Baslatiliyor...
cd /d "%~dp0"

REM 1. Eski acik kalan sunucu portlarini (8000 ve 5173) ve pencerelerini temizle
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8000 " ^| findstr "LISTENING"') do (
    taskkill /F /T /PID %%a >nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5173 " ^| findstr "LISTENING"') do (
    taskkill /F /T /PID %%a >nul 2>&1
)
taskkill /F /FI "WINDOWTITLE eq EsnafRadar*" >nul 2>&1

REM 2. Eksik kurulum varsa tamamla
if not exist "backend\venv\Scripts\python.exe" (
    python -m venv backend\venv
    call backend\venv\Scripts\pip.exe install -r backend\requirements.txt
)
if not exist "frontend\node_modules" (
    pushd frontend
    call npm install
    popd
)

REM 3. Arka uc (Port 8000) ve Arayuz (Port 5173) sunucularini tamamen GIZLI (penceresiz) baslat
powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath '%~dp0backend\venv\Scripts\uvicorn.exe' -ArgumentList 'main:app --host 127.0.0.1 --port 8000' -WorkingDirectory '%~dp0backend' -WindowStyle Hidden"
powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath 'cmd.exe' -ArgumentList '/c npm run dev -- --host 127.0.0.1 --port 5173' -WorkingDirectory '%~dp0frontend' -WindowStyle Hidden"

REM 4. Sunucularin hazir olmasini bekle, tarayiciyi ac ve bu CMD penceresini otomatik kapat
timeout /t 2 /nobreak >nul
start "" "http://localhost:5173"
exit
