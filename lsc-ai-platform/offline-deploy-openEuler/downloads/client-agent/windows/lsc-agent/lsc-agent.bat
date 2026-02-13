@echo off
setlocal

:: LSC-AI Client Agent
title LSC-AI Client Agent

:: Check Node.js
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js not found. Please install Node.js 20.x or higher
    echo Download: https://nodejs.org/
    pause
    exit /b 1
)

:: Start Agent
echo.
echo ========================================
echo   LSC-AI Client Agent
echo ========================================
echo.

node dist\index.js %*

endlocal
