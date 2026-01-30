@echo off
setlocal enabledelayedexpansion

echo.
echo ========================================
echo   LSC-AI Platform Setup
echo ========================================
echo.

:: Check Node.js
echo [1/7] Checking prerequisites...
node --version >nul 2>&1
if errorlevel 1 (
    echo   [ERROR] Node.js not found. Please install Node.js 18+
    exit /b 1
)
for /f "tokens=*" %%i in ('node --version') do echo   Node.js: %%i

:: Check pnpm
pnpm --version >nul 2>&1
if errorlevel 1 (
    echo   pnpm not found. Installing...
    npm install -g pnpm
)
for /f "tokens=*" %%i in ('pnpm --version') do echo   pnpm: %%i

:: Check Docker
docker --version >nul 2>&1
if errorlevel 1 (
    echo   [WARNING] Docker not found. Database containers will not be started.
    set SKIP_DOCKER=1
) else (
    for /f "tokens=*" %%i in ('docker --version') do echo   Docker: %%i
)

:: Check Git
git --version >nul 2>&1
if errorlevel 1 (
    echo   [ERROR] Git not found. Please install Git
    exit /b 1
)
for /f "tokens=*" %%i in ('git --version') do echo   Git: %%i

echo.

:: Install dependencies
echo [2/7] Installing dependencies...
call pnpm install
if errorlevel 1 (
    echo   [ERROR] Failed to install dependencies
    exit /b 1
)
echo   Dependencies installed successfully
echo.

:: Setup environment file
echo [3/7] Setting up environment...
if not exist ".env" (
    copy ".env.example" ".env" >nul
    echo   Created .env file from template
    echo   [NOTE] Please edit .env file with your configuration
) else (
    echo   .env file already exists
)
echo.

:: Start Docker containers
if not defined SKIP_DOCKER (
    echo [4/7] Starting Docker containers...

    docker info >nul 2>&1
    if errorlevel 1 (
        echo   [ERROR] Docker is not running. Please start Docker Desktop
        exit /b 1
    )

    call pnpm docker:dev
    if errorlevel 1 (
        echo   [ERROR] Failed to start Docker containers
        exit /b 1
    )

    echo   Docker containers started
    echo   Waiting for database to be ready (30 seconds)...
    timeout /t 30 /nobreak >nul
) else (
    echo [4/7] Skipping Docker setup
)
echo.

:: Run database migrations
echo [5/7] Running database migrations...
call pnpm db:migrate
if errorlevel 1 (
    echo   [ERROR] Failed to run migrations
    echo   Make sure the database is running and .env is configured correctly
    exit /b 1
)
echo   Migrations completed
echo.

:: Seed database
echo [6/7] Seeding database...
call pnpm db:seed
if errorlevel 1 (
    echo   [WARNING] Failed to seed database (may already be seeded)
) else (
    echo   Database seeded successfully
)
echo.

echo [7/7] Setup complete!
echo.
echo ========================================
echo   Setup Complete!
echo ========================================
echo.
echo Default admin account:
echo   Username: admin
echo   Password: Admin@123
echo.
echo To start the development server:
echo   pnpm dev
echo.
echo Access the application at:
echo   Frontend: http://localhost:5173
echo   Backend:  http://localhost:3000
echo   API Docs: http://localhost:3000/api
echo.

pause
