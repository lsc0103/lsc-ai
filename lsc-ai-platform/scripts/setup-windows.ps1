# LSC-AI Platform Windows Setup Script
# Run this script in PowerShell as Administrator

param(
    [switch]$SkipDocker,
    [switch]$SkipInstall,
    [switch]$Production
)

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  LSC-AI Platform Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if running as Administrator
$currentPrincipal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
$isAdmin = $currentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "[WARNING] Not running as Administrator. Some operations may fail." -ForegroundColor Yellow
    Write-Host ""
}

# Check prerequisites
Write-Host "[1/7] Checking prerequisites..." -ForegroundColor Green

# Check Node.js
try {
    $nodeVersion = node --version
    Write-Host "  Node.js: $nodeVersion" -ForegroundColor Gray
} catch {
    Write-Host "  [ERROR] Node.js not found. Please install Node.js 18+" -ForegroundColor Red
    exit 1
}

# Check pnpm
try {
    $pnpmVersion = pnpm --version
    Write-Host "  pnpm: $pnpmVersion" -ForegroundColor Gray
} catch {
    Write-Host "  pnpm not found. Installing..." -ForegroundColor Yellow
    npm install -g pnpm
    Write-Host "  pnpm installed successfully" -ForegroundColor Gray
}

# Check Docker (if not skipped)
if (-not $SkipDocker) {
    try {
        $dockerVersion = docker --version
        Write-Host "  Docker: $dockerVersion" -ForegroundColor Gray
    } catch {
        Write-Host "  [ERROR] Docker not found. Please install Docker Desktop or use -SkipDocker" -ForegroundColor Red
        exit 1
    }
}

# Check Git
try {
    $gitVersion = git --version
    Write-Host "  Git: $gitVersion" -ForegroundColor Gray
} catch {
    Write-Host "  [ERROR] Git not found. Please install Git" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Install dependencies
if (-not $SkipInstall) {
    Write-Host "[2/7] Installing dependencies..." -ForegroundColor Green
    pnpm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  [ERROR] Failed to install dependencies" -ForegroundColor Red
        exit 1
    }
    Write-Host "  Dependencies installed successfully" -ForegroundColor Gray
} else {
    Write-Host "[2/7] Skipping dependency installation" -ForegroundColor Yellow
}

Write-Host ""

# Setup environment file
Write-Host "[3/7] Setting up environment..." -ForegroundColor Green

if (-not (Test-Path ".env")) {
    Copy-Item ".env.example" ".env"
    Write-Host "  Created .env file from template" -ForegroundColor Gray
    Write-Host "  [NOTE] Please edit .env file with your configuration" -ForegroundColor Yellow
} else {
    Write-Host "  .env file already exists" -ForegroundColor Gray
}

Write-Host ""

# Start Docker containers
if (-not $SkipDocker) {
    Write-Host "[4/7] Starting Docker containers..." -ForegroundColor Green

    # Check if Docker is running
    try {
        docker info | Out-Null
    } catch {
        Write-Host "  [ERROR] Docker is not running. Please start Docker Desktop" -ForegroundColor Red
        exit 1
    }

    pnpm docker:dev
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  [ERROR] Failed to start Docker containers" -ForegroundColor Red
        exit 1
    }

    Write-Host "  Docker containers started" -ForegroundColor Gray
    Write-Host "  Waiting for database to be ready (30 seconds)..." -ForegroundColor Gray
    Start-Sleep -Seconds 30
} else {
    Write-Host "[4/7] Skipping Docker setup" -ForegroundColor Yellow
}

Write-Host ""

# Run database migrations
Write-Host "[5/7] Running database migrations..." -ForegroundColor Green
pnpm db:migrate
if ($LASTEXITCODE -ne 0) {
    Write-Host "  [ERROR] Failed to run migrations" -ForegroundColor Red
    Write-Host "  Make sure the database is running and .env is configured correctly" -ForegroundColor Yellow
    exit 1
}
Write-Host "  Migrations completed" -ForegroundColor Gray

Write-Host ""

# Seed database
Write-Host "[6/7] Seeding database..." -ForegroundColor Green
pnpm db:seed
if ($LASTEXITCODE -ne 0) {
    Write-Host "  [WARNING] Failed to seed database (may already be seeded)" -ForegroundColor Yellow
} else {
    Write-Host "  Database seeded successfully" -ForegroundColor Gray
}

Write-Host ""

# Build (for production)
if ($Production) {
    Write-Host "[7/7] Building for production..." -ForegroundColor Green
    pnpm build
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  [ERROR] Build failed" -ForegroundColor Red
        exit 1
    }
    Write-Host "  Build completed" -ForegroundColor Gray
} else {
    Write-Host "[7/7] Skipping production build (use -Production flag to build)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Setup Complete!" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Default admin account:" -ForegroundColor Green
Write-Host "  Username: admin" -ForegroundColor Gray
Write-Host "  Password: Admin@123" -ForegroundColor Gray
Write-Host ""
Write-Host "To start the development server:" -ForegroundColor Green
Write-Host "  pnpm dev" -ForegroundColor Gray
Write-Host ""
Write-Host "Access the application at:" -ForegroundColor Green
Write-Host "  Frontend: http://localhost:5173" -ForegroundColor Gray
Write-Host "  Backend:  http://localhost:3000" -ForegroundColor Gray
Write-Host "  API Docs: http://localhost:3000/api" -ForegroundColor Gray
Write-Host ""
