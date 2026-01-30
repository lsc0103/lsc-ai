@echo off
echo.
echo ========================================
echo   LSC-AI Platform Quick Start
echo ========================================
echo.

:: Check if Docker is running
docker info >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Docker is not running!
    echo Please start Docker Desktop first.
    pause
    exit /b 1
)

:: Start everything
echo Starting Docker containers...
call pnpm docker:dev

echo.
echo Waiting for database (20 seconds)...
timeout /t 20 /nobreak >nul

echo.
echo Starting development server...
call pnpm dev
