@echo off
title LSC-AI Platform Stop

echo.
echo ========================================
echo   LSC-AI Platform Stop All Services
echo ========================================
echo.

:: Stop backend (port 3000)
echo Stopping Backend (port 3000)...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000.*LISTENING"') do (
    taskkill /PID %%a /F >nul 2>&1
    echo   Stopped PID: %%a
)

:: Stop frontend (port 5173-5175)
echo Stopping Frontend (port 5173-5175)...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":5173.*LISTENING"') do (
    taskkill /PID %%a /F >nul 2>&1
    echo   Stopped PID: %%a
)
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":5174.*LISTENING"') do (
    taskkill /PID %%a /F >nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":5175.*LISTENING"') do (
    taskkill /PID %%a /F >nul 2>&1
)

echo.
echo ========================================
echo   All Services Stopped
echo ========================================
echo.

pause
