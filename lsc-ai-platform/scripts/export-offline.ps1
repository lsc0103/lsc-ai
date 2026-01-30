# LSC-AI Platform - Offline Package Export Script
# Run this on a machine with network access to prepare offline deployment package

param(
    [string]$OutputDir = "offline-deploy"
)

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  LSC-AI Offline Package Export" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectDir = Split-Path -Parent $ScriptDir
$OutputPath = Join-Path $ProjectDir $OutputDir

Write-Host "Output directory: $OutputPath" -ForegroundColor Gray
Write-Host ""

# Create output directories
Write-Host "[1/5] Creating directory structure..." -ForegroundColor Green
New-Item -ItemType Directory -Force -Path "$OutputPath\installers" | Out-Null
New-Item -ItemType Directory -Force -Path "$OutputPath\project" | Out-Null
Write-Host "  Done" -ForegroundColor Gray
Write-Host ""

# Check Docker
Write-Host "[2/5] Checking Docker..." -ForegroundColor Green
try {
    docker info | Out-Null
} catch {
    Write-Host "  [ERROR] Docker is not running. Please start Docker Desktop" -ForegroundColor Red
    exit 1
}
Write-Host "  Docker is running" -ForegroundColor Gray
Write-Host ""

# Pull Docker images
Write-Host "[3/5] Pulling Docker images..." -ForegroundColor Green
$images = @(
    "postgres:15-alpine",
    "redis:7-alpine",
    "minio/minio:latest",
    "rediscommander/redis-commander:latest"
)

foreach ($image in $images) {
    Write-Host "  Pulling $image..." -ForegroundColor Gray
    docker pull $image
}
Write-Host "  All images pulled" -ForegroundColor Gray
Write-Host ""

# Export Docker images
Write-Host "[4/5] Exporting Docker images (this may take a while)..." -ForegroundColor Green
$imagesStr = $images -join " "
$tarPath = Join-Path $OutputPath "docker-images.tar"
Invoke-Expression "docker save -o `"$tarPath`" $imagesStr"
$tarSize = (Get-Item $tarPath).Length / 1MB
Write-Host "  Exported to docker-images.tar ($([math]::Round($tarSize, 2)) MB)" -ForegroundColor Gray
Write-Host ""

# Copy project files
Write-Host "[5/5] Copying project files..." -ForegroundColor Green
$ProjectOutputPath = Join-Path $OutputPath "project"

# Copy lsc-ai-platform (excluding node_modules and other large directories)
Write-Host "  Copying lsc-ai-platform..." -ForegroundColor Gray
$excludeDirs = @("node_modules", ".git", "dist", "offline-deploy")
$platformSource = $ProjectDir
$platformDest = Join-Path $ProjectOutputPath "lsc-ai-platform"

# Use robocopy for efficient copying with exclusions
$excludeArgs = ($excludeDirs | ForEach-Object { "/XD `"$_`"" }) -join " "
Invoke-Expression "robocopy `"$platformSource`" `"$platformDest`" /E /NFL /NDL /NJH /NJS /NC /NS $excludeArgs" | Out-Null

# Copy localAI/packages/core
Write-Host "  Copying localAI/packages/core..." -ForegroundColor Gray
$localAISource = Join-Path (Split-Path -Parent $ProjectDir) "localAI\packages\core"
$localAIDest = Join-Path $ProjectOutputPath "localAI\packages\core"
if (Test-Path $localAISource) {
    Invoke-Expression "robocopy `"$localAISource`" `"$localAIDest`" /E /NFL /NDL /NJH /NJS /NC /NS /XD node_modules .git dist" | Out-Null
} else {
    Write-Host "  [WARNING] localAI/packages/core not found at $localAISource" -ForegroundColor Yellow
}

Write-Host "  Project files copied" -ForegroundColor Gray
Write-Host ""

# Calculate total size
$totalSize = (Get-ChildItem -Path $OutputPath -Recurse | Measure-Object -Property Length -Sum).Sum / 1MB

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Export Complete!" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Total package size: $([math]::Round($totalSize, 2)) MB" -ForegroundColor Gray
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Green
Write-Host "1. Download Node.js installer and place in: $OutputPath\installers\" -ForegroundColor Gray
Write-Host "   https://nodejs.org/dist/v20.18.0/node-v20.18.0-x64.msi" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Download Docker Desktop installer and place in: $OutputPath\installers\" -ForegroundColor Gray
Write-Host "   https://desktop.docker.com/win/main/amd64/Docker%20Desktop%20Installer.exe" -ForegroundColor Gray
Write-Host ""
Write-Host "3. Copy the entire '$OutputDir' folder to the target machine" -ForegroundColor Gray
Write-Host ""
Write-Host "4. On target machine, run deploy.bat or deploy.ps1" -ForegroundColor Gray
Write-Host ""
