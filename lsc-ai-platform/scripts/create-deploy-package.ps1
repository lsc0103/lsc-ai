# LSC-AI Platform - Create Deployment Package
# Creates a complete offline deployment package

param(
    [string]$OutputDir = "lsc-ai-deploy",
    [switch]$IncludeInstallers
)

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  LSC-AI Platform - Create Deploy Package" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectDir = Split-Path -Parent $ScriptDir
$OutputPath = Join-Path (Split-Path -Parent $ProjectDir) $OutputDir

Write-Host "Output directory: $OutputPath" -ForegroundColor Gray
Write-Host ""

# Create output directory
Write-Host "[1/6] Creating directory structure..." -ForegroundColor Green
if (Test-Path $OutputPath) {
    Remove-Item -Recurse -Force $OutputPath
}
New-Item -ItemType Directory -Force -Path $OutputPath | Out-Null
New-Item -ItemType Directory -Force -Path "$OutputPath\data" | Out-Null
Write-Host "  Done" -ForegroundColor Gray

# Build images (from parent directory to include localAI)
Write-Host ""
Write-Host "[2/6] Building Docker images..." -ForegroundColor Green
$ParentDir = Split-Path -Parent $ProjectDir
Set-Location $ParentDir

Write-Host "  Building backend..." -ForegroundColor Gray
docker build -t lscai/server:latest -f lsc-ai-platform/Dockerfile.server .
if ($LASTEXITCODE -ne 0) {
    Write-Host "  [ERROR] Failed to build backend image" -ForegroundColor Red
    exit 1
}

Write-Host "  Building frontend..." -ForegroundColor Gray
docker build -t lscai/web:latest -f lsc-ai-platform/Dockerfile.web .
if ($LASTEXITCODE -ne 0) {
    Write-Host "  [ERROR] Failed to build frontend image" -ForegroundColor Red
    exit 1
}
Write-Host "  Images built successfully" -ForegroundColor Gray

# Export all images
Write-Host ""
Write-Host "[3/6] Exporting Docker images (this may take a while)..." -ForegroundColor Green
$images = @(
    "lscai/server:latest",
    "lscai/web:latest",
    "postgres:15-alpine",
    "redis:7-alpine",
    "minio/minio:latest"
)
$imagesStr = $images -join " "
$tarPath = Join-Path $OutputPath "docker-images.tar"
Invoke-Expression "docker save -o `"$tarPath`" $imagesStr"
$tarSize = [math]::Round((Get-Item $tarPath).Length / 1MB, 2)
Write-Host "  Exported to docker-images.tar ($tarSize MB)" -ForegroundColor Gray

# Copy docker-compose
Write-Host ""
Write-Host "[4/6] Copying configuration files..." -ForegroundColor Green
Copy-Item "$ProjectDir\docker\docker-compose.prod.yml" "$OutputPath\docker-compose.yml"

# Create .env file
$envContent = @"
# LSC-AI Platform Environment Configuration
# Modify these values as needed

# Database
DB_USER=lscai
DB_PASSWORD=lscai123
DB_NAME=lscai

# Redis
REDIS_PASSWORD=redis123

# MinIO
MINIO_USER=minioadmin
MINIO_PASSWORD=minioadmin123
MINIO_BUCKET=lscai

# JWT (IMPORTANT: Change these in production!)
JWT_SECRET=your-super-secret-jwt-key-at-least-32-characters
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=your-refresh-token-secret-at-least-32-chars
JWT_REFRESH_EXPIRES_IN=7d

# Web port
WEB_PORT=80
"@
$envContent | Out-File -FilePath "$OutputPath\.env" -Encoding utf8
Write-Host "  Configuration files copied" -ForegroundColor Gray

# Create deployment scripts
Write-Host ""
Write-Host "[5/6] Creating deployment scripts..." -ForegroundColor Green

# Windows deploy script
$winScript = @'
@echo off
chcp 65001 >nul

echo.
echo ========================================
echo   LSC-AI Platform - One-Click Deploy
echo ========================================
echo.

:: Check Docker
docker --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Docker is not installed or not running
    echo Please install Docker Desktop first
    pause
    exit /b 1
)

echo [1/3] Loading Docker images...
docker load -i docker-images.tar
if errorlevel 1 (
    echo [ERROR] Failed to load images
    pause
    exit /b 1
)

echo.
echo [2/3] Starting services...
docker compose up -d
if errorlevel 1 (
    echo [ERROR] Failed to start services
    pause
    exit /b 1
)

echo.
echo [3/3] Waiting for services to be ready...
timeout /t 30 /nobreak >nul

echo.
echo ========================================
echo   Deployment Complete!
echo ========================================
echo.
echo Access the application at: http://localhost
echo.
echo Default admin account:
echo   Username: admin
echo   Password: Admin@123
echo.
echo Useful commands:
echo   View logs:    docker compose logs -f
echo   Stop:         docker compose down
echo   Restart:      docker compose restart
echo.
pause
'@
$winScript | Out-File -FilePath "$OutputPath\deploy.bat" -Encoding ascii

# Linux deploy script
$linuxScript = @'
#!/bin/bash

echo ""
echo "========================================"
echo "  LSC-AI Platform - One-Click Deploy"
echo "========================================"
echo ""

# Check Docker
if ! command -v docker &> /dev/null; then
    echo "[ERROR] Docker is not installed"
    echo "Install Docker first: https://docs.docker.com/engine/install/"
    exit 1
fi

# Check Docker Compose
if ! docker compose version &> /dev/null; then
    echo "[ERROR] Docker Compose is not available"
    exit 1
fi

echo "[1/3] Loading Docker images..."
docker load -i docker-images.tar
if [ $? -ne 0 ]; then
    echo "[ERROR] Failed to load images"
    exit 1
fi

echo ""
echo "[2/3] Starting services..."
docker compose up -d
if [ $? -ne 0 ]; then
    echo "[ERROR] Failed to start services"
    exit 1
fi

echo ""
echo "[3/3] Waiting for services to be ready..."
sleep 30

echo ""
echo "========================================"
echo "  Deployment Complete!"
echo "========================================"
echo ""
echo "Access the application at: http://localhost"
echo ""
echo "Default admin account:"
echo "  Username: admin"
echo "  Password: Admin@123"
echo ""
echo "Useful commands:"
echo "  View logs:    docker compose logs -f"
echo "  Stop:         docker compose down"
echo "  Restart:      docker compose restart"
echo ""
'@
$linuxScript | Out-File -FilePath "$OutputPath\deploy.sh" -Encoding utf8 -NoNewline

# Start/Stop scripts
$startScript = @'
@echo off
docker compose up -d
echo Services started. Access at http://localhost
pause
'@
$startScript | Out-File -FilePath "$OutputPath\start.bat" -Encoding ascii

$stopScript = @'
@echo off
docker compose down
echo Services stopped.
pause
'@
$stopScript | Out-File -FilePath "$OutputPath\stop.bat" -Encoding ascii

$startScriptLinux = @'
#!/bin/bash
docker compose up -d
echo "Services started. Access at http://localhost"
'@
$startScriptLinux | Out-File -FilePath "$OutputPath\start.sh" -Encoding utf8 -NoNewline

$stopScriptLinux = @'
#!/bin/bash
docker compose down
echo "Services stopped."
'@
$stopScriptLinux | Out-File -FilePath "$OutputPath\stop.sh" -Encoding utf8 -NoNewline

Write-Host "  Deployment scripts created" -ForegroundColor Gray

# Create README
Write-Host ""
Write-Host "[6/6] Creating documentation..." -ForegroundColor Green
$readme = @"
# LSC-AI Platform Deployment Package

## Quick Start

### Windows
1. Install Docker Desktop (if not installed)
2. Start Docker Desktop
3. Double-click ``deploy.bat``
4. Access http://localhost

### Linux
1. Install Docker and Docker Compose
2. Run: ``chmod +x deploy.sh && ./deploy.sh``
3. Access http://localhost

## Default Account
- Username: ``admin``
- Password: ``Admin@123``

## Commands

| Action | Windows | Linux |
|--------|---------|-------|
| Start | ``start.bat`` | ``./start.sh`` |
| Stop | ``stop.bat`` | ``./stop.sh`` |
| Logs | ``docker compose logs -f`` | ``docker compose logs -f`` |
| Restart | ``docker compose restart`` | ``docker compose restart`` |

## Configuration

Edit ``.env`` file to customize:
- Database credentials
- JWT secrets (IMPORTANT for production)
- Port settings

## Ports

| Service | Port |
|---------|------|
| Web UI | 80 |
| API | 3000 (internal) |
| PostgreSQL | 5432 (internal) |
| Redis | 6379 (internal) |
| MinIO | 9000/9001 (internal) |

## Data Persistence

Data is stored in Docker volumes:
- ``lscai-postgres-data`` - Database
- ``lscai-redis-data`` - Cache
- ``lscai-minio-data`` - File storage

To backup: ``docker run --rm -v lscai-postgres-data:/data -v \$(pwd):/backup alpine tar czf /backup/db-backup.tar.gz /data``
"@
$readme | Out-File -FilePath "$OutputPath\README.md" -Encoding utf8

Write-Host "  Documentation created" -ForegroundColor Gray

# Copy installers if requested
if ($IncludeInstallers) {
    Write-Host ""
    Write-Host "[Extra] Copying installers..." -ForegroundColor Green
    $installersSource = "$ProjectDir\offline-deploy\installers"
    if (Test-Path $installersSource) {
        New-Item -ItemType Directory -Force -Path "$OutputPath\installers" | Out-Null
        Copy-Item "$installersSource\*" "$OutputPath\installers\" -Recurse
        Write-Host "  Installers copied" -ForegroundColor Gray
    }
}

# Calculate total size
$totalSize = [math]::Round((Get-ChildItem -Path $OutputPath -Recurse | Measure-Object -Property Length -Sum).Sum / 1MB, 2)

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Package Created Successfully!" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Location: $OutputPath" -ForegroundColor Gray
Write-Host "Total size: $totalSize MB" -ForegroundColor Gray
Write-Host ""
Write-Host "Contents:" -ForegroundColor Green
Get-ChildItem $OutputPath | ForEach-Object {
    $size = if ($_.PSIsContainer) { "" } else { " ($([math]::Round($_.Length / 1MB, 2)) MB)" }
    Write-Host "  - $($_.Name)$size" -ForegroundColor Gray
}
Write-Host ""
Write-Host "To deploy:" -ForegroundColor Green
Write-Host "  1. Copy '$OutputDir' folder to target machine" -ForegroundColor Gray
Write-Host "  2. Install Docker (if not installed)" -ForegroundColor Gray
Write-Host "  3. Run deploy.bat (Windows) or ./deploy.sh (Linux)" -ForegroundColor Gray
Write-Host ""
