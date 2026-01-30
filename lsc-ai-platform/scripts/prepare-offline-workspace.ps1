# This script adjusts the pnpm-workspace.yaml for offline deployment structure
# Run after export-offline.ps1 to fix workspace references

param(
    [string]$OfflineDir = "offline-deploy"
)

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectDir = Split-Path -Parent $ScriptDir
$OfflinePath = Join-Path $ProjectDir $OfflineDir
$WorkspacePath = Join-Path $OfflinePath "project\lsc-ai-platform\pnpm-workspace.yaml"

Write-Host "Updating workspace configuration for offline deployment..." -ForegroundColor Green

$content = @"
packages:
  - 'packages/*'
  - '../localAI/packages/core'
"@

$content | Out-File -FilePath $WorkspacePath -Encoding utf8

Write-Host "Updated: $WorkspacePath" -ForegroundColor Gray
Write-Host "Done!" -ForegroundColor Green
