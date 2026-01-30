# LSC-AI Platform - Build Docker Images Script
# Run this to build all images locally

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  LSC-AI Platform - Build Images" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectDir = Split-Path -Parent $ScriptDir

Set-Location $ProjectDir

# Build backend image
Write-Host "[1/2] Building backend image..." -ForegroundColor Green
docker build -t lscai/server:latest -f packages/server/Dockerfile .
if ($LASTEXITCODE -ne 0) {
    Write-Host "  [ERROR] Failed to build backend image" -ForegroundColor Red
    exit 1
}
Write-Host "  Backend image built successfully" -ForegroundColor Gray

# Build frontend image
Write-Host ""
Write-Host "[2/2] Building frontend image..." -ForegroundColor Green
docker build -t lscai/web:latest -f packages/web/Dockerfile .
if ($LASTEXITCODE -ne 0) {
    Write-Host "  [ERROR] Failed to build frontend image" -ForegroundColor Red
    exit 1
}
Write-Host "  Frontend image built successfully" -ForegroundColor Gray

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Build Complete!" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Images created:" -ForegroundColor Green
docker images --filter "reference=lscai/*" --format "table {{.Repository}}:{{.Tag}}\t{{.Size}}"
Write-Host ""
