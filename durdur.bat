@echo off
chcp 65001 >nul
title EsnafRadar Durduruluyor...

for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8000 " ^| findstr "LISTENING"') do (
    taskkill /F /T /PID %%a >nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5173 " ^| findstr "LISTENING"') do (
    taskkill /F /T /PID %%a >nul 2>&1
)
taskkill /F /FI "WINDOWTITLE eq EsnafRadar*" >nul 2>&1
exit
