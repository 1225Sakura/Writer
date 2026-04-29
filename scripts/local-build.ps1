# local-build.ps1 - 本地 CI/CD 构建脚本
# 用法: .\scripts\local-build.ps1 [-Platform win|mac|linux] [-SkipFrontend] [-BuildUnpacked]

param(
    [ValidateSet("win", "mac", "linux")]
    [string]$Platform = "win",

    [switch]$SkipFrontend,

    [switch]$SkipElectron,

    [switch]$BuildUnpacked
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  本地 CI/CD 构建脚本" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Platform mapping
$platformMap = @{
    "win"   = "win"
    "mac"   = "mac"
    "linux" = "linux"
}

# ============================================
# Step 1: Build Frontend
# ============================================
if (-not $SkipFrontend) {
    Write-Host "[1/3] 构建前端..." -ForegroundColor Yellow

    $frontendDir = Join-Path $ProjectRoot "src\frontend"
    Push-Location $frontendDir

    try {
        # Install dependencies (use npm install for faster, use npm ci for reproducible)
        Write-Host "  - 安装依赖..." -ForegroundColor Gray
        npm install

        # Build
        Write-Host "  - 运行构建..." -ForegroundColor Gray
        npm run build

        Write-Host "  [OK] 前端构建完成" -ForegroundColor Green
    }
    finally {
        Pop-Location
    }
}
else {
    Write-Host "[1/3] 跳过前端构建" -ForegroundColor Gray
}

# ============================================
# Step 2: Verify Frontend Build Output
# ============================================
Write-Host ""
Write-Host "[2/3] 验证前端构建产物..." -ForegroundColor Yellow

$frontendBuildDir = Join-Path $ProjectRoot "electron\frontend-build"
if (Test-Path $frontendBuildDir) {
    $files = Get-ChildItem $frontendBuildDir -File
    $totalSize = ($files | Measure-Object -Property Length -Sum).Sum / 1MB

    # Check vendor-react chunk
    $vendorReact = Get-ChildItem $frontendBuildDir -Filter "vendor-react*.js" -ErrorAction SilentlyContinue
    if ($vendorReact) {
        $size = [math]::Round($vendorReact[0].Length / 1MB, 2)
        Write-Host "  - vendor-react chunk: $($vendorReact[0].Name) ($size MB)" -ForegroundColor Cyan
        if ($size -lt 0.01) {
            Write-Host "  [WARNING] vendor-react chunk 异常小!" -ForegroundColor Red
        }
    }

    Write-Host "  - 文件数: $($files.Count), 总大小: $([math]::Round($totalSize, 2)) MB" -ForegroundColor Gray
    Write-Host "  [OK] 前端构建产物验证完成" -ForegroundColor Green
}
else {
    Write-Host "  [ERROR] 前端构建目录不存在: $frontendBuildDir" -ForegroundColor Red
    exit 1
}

# ============================================
# Step 3: Build Electron App
# ============================================
if (-not $SkipElectron) {
    Write-Host ""
    Write-Host "[3/3] 构建 Electron 应用 ($Platform)..." -ForegroundColor Yellow

    $electronDir = Join-Path $ProjectRoot "electron"
    Push-Location $electronDir

    try {
        # Install dependencies
        Write-Host "  - 安装依赖..." -ForegroundColor Gray
        npm ci

        # Build Electron
        Write-Host "  - 构建 Electron..." -ForegroundColor Gray
        npm run build:electron

        # Package for platform
        Write-Host "  - 打包应用 ($Platform)..." -ForegroundColor Gray
        if ($BuildUnpacked) {
            Write-Host "  - 构建 unpacked 便携版..." -ForegroundColor Gray
            if ($Platform -eq "win") {
                npm run dist:win_dir
            } else {
                npm run dist:$Platform -- --dir
            }
        } else {
            npm run dist:$Platform
        }

        Write-Host "  [OK] Electron 应用构建完成" -ForegroundColor Green
    }
    finally {
        Pop-Location
    }
}
else {
    Write-Host "[3/3] 跳过 Electron 构建" -ForegroundColor Gray
}

# ============================================
# Summary
# ============================================
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  构建完成!" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$releaseDir = Join-Path $ProjectRoot "electron\release\$Platform"
if (Test-Path $releaseDir) {
    $artifacts = Get-ChildItem $releaseDir -File | Where-Object { $_.Extension -in ".exe", ".zip", ".dmg", ".AppImage" }
    Write-Host "构建产物:" -ForegroundColor White
    foreach ($artifact in $artifacts) {
        $size = [math]::Round($artifact.Length / 1MB, 2)
        Write-Host "  - $($artifact.Name) ($size MB)" -ForegroundColor Gray
    }
}

Write-Host ""
Write-Host "提示: 运行应用" -ForegroundColor White
Write-Host "  cd electron; npm run dev" -ForegroundColor Gray
Write-Host "  或直接运行打包后的 exe" -ForegroundColor Gray
Write-Host ""
