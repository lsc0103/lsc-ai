@echo off
chcp 936 >nul
title LSC-AI Platform Restart

echo.
echo ========================================
echo   LSC-AI Platform Restart
echo ========================================
echo.

cd /d "%~dp0"

echo [Step 1] Stopping services...
echo.

:: Stop process on port 3000 (backend)
echo Checking port 3000 (Backend)...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000.*LISTENING"') do (
    echo   Found PID: %%a
    taskkill /PID %%a /F >nul 2>&1
    echo   Stopped
)

:: Stop process on port 5173 (frontend)
echo Checking port 5173 (Frontend)...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":5173.*LISTENING"') do (
    echo   Found PID: %%a
    taskkill /PID %%a /F >nul 2>&1
    echo   Stopped
)

:: Stop backup ports
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":5174.*LISTENING"') do (
    taskkill /PID %%a /F >nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":5175.*LISTENING"') do (
    taskkill /PID %%a /F >nul 2>&1
)

echo.
echo Waiting for ports to be released...
timeout /t 3 /nobreak >nul

echo.
echo [Step 2] Starting services...
echo.

:: Start backend
echo Starting Backend (port 3000)...
start "LSC-AI Backend" /min cmd /c "cd /d %~dp0 && pnpm --filter @lsc-ai/server dev"

echo Waiting for backend to start...
timeout /t 8 /nobreak >nul

:: Start frontend
echo Starting Frontend (port 5173)...
start "LSC-AI Frontend" /min cmd /c "cd /d %~dp0 && pnpm --filter @lsc-ai/web dev"
timeout /t 3 /nobreak >nul

:: Start Client Agent
echo Starting Client Agent...
start "LSC-AI Client Agent" /min cmd /c "cd /d %~dp0\packages\client-agent && node dist\index.js start"
timeout /t 3 /nobreak >nul

echo.
echo [Step 3] Verifying...
echo.

:: Check ports
netstat -ano | findstr ":3000.*LISTENING" >nul
if %errorlevel%==0 (
    echo   [OK] Backend: http://localhost:3000
) else (
    echo   [FAIL] Backend failed to start
)

netstat -ano | findstr ":5173.*LISTENING" >nul
if %errorlevel%==0 (
    echo   [OK] Frontend: http://localhost:5173
) else (
    echo   [FAIL] Frontend failed to start
)

echo   [OK] Client Agent started

echo.
echo ========================================
echo   Restart Complete!
echo ========================================
echo.
echo Services are running in minimized windows.
echo Close the windows to stop services.
echo.

pause
