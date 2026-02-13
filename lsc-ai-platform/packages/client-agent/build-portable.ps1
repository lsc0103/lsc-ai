# LSC-AI Client Agent - Windows 便携版打包脚本
# 打包为独立目录，包含所有依赖，可直接复制到任何 Windows 机器运行

param(
    [string]$OutputDir = "portable-win"
)

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  LSC-AI Client Agent 便携版打包" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent (Split-Path -Parent $ScriptDir)
$OutputPath = Join-Path $ScriptDir $OutputDir

Write-Host "[1/5] 清理旧文件..." -ForegroundColor Green
if (Test-Path $OutputPath) {
    Remove-Item -Recurse -Force $OutputPath
}
New-Item -ItemType Directory -Force -Path $OutputPath | Out-Null
Write-Host "  完成" -ForegroundColor Gray
Write-Host ""

Write-Host "[2/5] 构建 TypeScript..." -ForegroundColor Green
& pnpm build
Write-Host "  完成" -ForegroundColor Gray
Write-Host ""

Write-Host "[3/5] 复制文件..." -ForegroundColor Green
# 复制构建产物
Copy-Item -Path "dist" -Destination $OutputPath -Recurse -Force
# 复制 node_modules
Copy-Item -Path "node_modules" -Destination $OutputPath -Recurse -Force
# 复制 package.json
Copy-Item -Path "package.json" -Destination $OutputPath -Force
Write-Host "  完成" -ForegroundColor Gray
Write-Host ""

Write-Host "[4/5] 创建启动脚本..." -ForegroundColor Green

# 创建启动批处理文件
$LauncherBat = @"
@echo off
setlocal

:: LSC-AI Client Agent 启动器
title LSC-AI Client Agent

:: 检查 Node.js
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [错误] 未找到 Node.js，请先安装 Node.js 20.x 或更高版本
    echo.
    echo 下载地址: https://nodejs.org/
    pause
    exit /b 1
)

:: 检查 Node.js 版本
for /f "tokens=1 delims=." %%a in ('node -v') do set NODE_MAJOR=%%a
set NODE_MAJOR=%NODE_MAJOR:v=%

if %NODE_MAJOR% LSS 20 (
    echo [警告] Node.js 版本过低 (需要 20.x 或更高)
    echo 当前版本:
    node -v
    echo.
    pause
)

:: 启动 Agent
echo.
echo ========================================
echo   LSC-AI Client Agent
echo ========================================
echo.

node dist\index.js %*

endlocal
"@

$LauncherBat | Out-File -FilePath (Join-Path $OutputPath "lsc-agent.bat") -Encoding ASCII

# 创建配置向导批处理文件
$ConfigBat = @"
@echo off
node dist\index.js pair -u http://10.18.55.233
pause
"@

$ConfigBat | Out-File -FilePath (Join-Path $OutputPath "配置服务器地址.bat") -Encoding ASCII

# 创建 README
$ReadmeContent = @"
# LSC-AI Client Agent - Windows 便携版

## 系统要求

- Windows 10/11 64位
- Node.js 20.x 或更高版本

## 首次使用

### 1. 安装 Node.js（如果尚未安装）

下载并安装 Node.js：https://nodejs.org/

推荐版本：Node.js 20.x LTS

### 2. 配置服务器地址

双击运行：`配置服务器地址.bat`

按提示输入配对码完成配对。

### 3. 启动 Agent

双击运行：`lsc-agent.bat`

或在命令行中：
```cmd
lsc-agent.bat start
```

## 命令行使用

```cmd
:: 启动 Agent（前台运行）
lsc-agent.bat start

:: 配对到服务器
lsc-agent.bat pair -u http://10.18.55.233

:: 查看状态
lsc-agent.bat status

:: 查看配置
lsc-agent.bat config

:: 取消配对
lsc-agent.bat unpair

:: 守护进程模式（后台运行）
lsc-agent.bat daemon

:: 设置开机自启
lsc-agent.bat autostart enable
```

## 文件说明

- `lsc-agent.bat` - 主启动器
- `配置服务器地址.bat` - 配对向导
- `dist/` - 编译后的程序
- `node_modules/` - 依赖库
- `package.json` - 项目配置

## 配置文件位置

配置文件保存在：`%USERPROFILE%\.lsc-ai\`

- `config.json` - 主配置文件
- `client-agent.db` - 本地数据库

## 常见问题

### Q: 提示"未找到 Node.js"

A: 请先安装 Node.js 20.x 或更高版本，下载地址：https://nodejs.org/

### Q: 无法连接到服务器

A: 请检查：
1. 服务器地址是否正确（默认：http://10.18.55.233）
2. 网络连接是否正常
3. 防火墙是否阻止了连接

### Q: 如何更新 Agent

A: 下载新版本，解压后替换旧文件即可。配置文件会自动保留。

## 技术支持

如遇问题，请联系系统管理员。
"@

$ReadmeContent | Out-File -FilePath (Join-Path $OutputPath "README.md") -Encoding UTF8

Write-Host "  完成" -ForegroundColor Gray
Write-Host ""

Write-Host "[5/5] 计算大小..." -ForegroundColor Green
$TotalSize = (Get-ChildItem -Path $OutputPath -Recurse | Measure-Object -Property Length -Sum).Sum / 1MB
Write-Host "  总大小: $([math]::Round($TotalSize, 2)) MB" -ForegroundColor Gray
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  打包完成！" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "输出目录: $OutputPath" -ForegroundColor Gray
Write-Host ""
Write-Host "下一步:" -ForegroundColor Green
Write-Host "  1. 将 '$OutputDir' 目录复制到部署包" -ForegroundColor Gray
Write-Host "     cp -r $OutputDir ../../offline-deploy-openEuler/downloads/client-agent/windows/" -ForegroundColor Gray
Write-Host ""
Write-Host "  2. 在 Windows 员工电脑上：" -ForegroundColor Gray
Write-Host "     - 解压 client-agent 目录" -ForegroundColor Gray
Write-Host "     - 双击 '配置服务器地址.bat' 完成配对" -ForegroundColor Gray
Write-Host "     - 双击 'lsc-agent.bat' 启动 Agent" -ForegroundColor Gray
Write-Host ""
