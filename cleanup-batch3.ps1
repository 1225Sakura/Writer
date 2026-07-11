# 批次 3：浏览器/编辑器缓存清理
$ErrorActionPreference = 'Continue'
$results = @()

function Get-DirSizeGB {
    param($Path)
    if (Test-Path $Path) {
        $s = (Get-ChildItem $Path -Recurse -File -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum
        return [math]::Round($s/1GB, 3)
    }
    return 0
}

function Clean-Path {
    param($Name, $Path)
    Write-Host ''
    Write-Host "[$Name]" -ForegroundColor Cyan
    Write-Host "  $Path"
    if (-not (Test-Path $Path)) {
        Write-Host "  Not found, skip" -ForegroundColor Yellow
        $script:results += [PSCustomObject]@{ Item=$Name; Recovered=0; Status='skip' }
        return
    }
    $before = Get-DirSizeGB $Path
    Write-Host "  Before: $before GB"
    try {
        Get-ChildItem $Path -Force -ErrorAction SilentlyContinue | ForEach-Object {
            try { Remove-Item $_.FullName -Recurse -Force -ErrorAction Stop } catch {}
        }
    } catch {}
    $after = Get-DirSizeGB $Path
    $recovered = $before - $after
    Write-Host "  After:  $after GB"
    Write-Host "  Recovered: $recovered GB" -ForegroundColor Green
    $script:results += [PSCustomObject]@{ Item=$Name; Recovered=$recovered; Status='done' }
}

# Edge 缓存
Clean-Path 'Edge Cache' 'C:\Users\36084\AppData\Local\Microsoft\Edge\User Data\Default\Cache'
Clean-Path 'Edge Code Cache' 'C:\Users\36084\AppData\Local\Microsoft\Edge\User Data\Default\Code Cache'

# Chrome 缓存
Clean-Path 'Chrome Cache' 'C:\Users\36084\AppData\Local\Google\Chrome\User Data\Default\Cache'
Clean-Path 'Chrome Code Cache' 'C:\Users\36084\AppData\Local\Google\Chrome\User Data\Default\Code Cache'

# VS Code 缓存
Clean-Path 'VSCode Cache (Local)' 'C:\Users\36084\AppData\Local\Code\Cache'
Clean-Path 'VSCode Cache (Roaming)' 'C:\Users\36084\AppData\Roaming\Code\Cache'
Clean-Path 'VSCode CachedData' 'C:\Users\36084\AppData\Roaming\Code\CachedData'
Clean-Path 'VSCode CachedExtensions' 'C:\Users\36084\AppData\Local\Code\CachedExtensions'
Clean-Path 'VSCode CachedData (Local)' 'C:\Users\36084\AppData\Local\Code\CachedData'

# CrashDumps
Clean-Path 'CrashDumps' 'C:\Users\36084\AppData\Local\CrashDumps'

# D3DSCache (DirectX Shader Cache)
Clean-Path 'D3DSCache' 'C:\Users\36084\AppData\Local\D3DSCache'

# INetCache
Clean-Path 'INetCache' 'C:\Users\36084\AppData\Local\Microsoft\Windows\INetCache'

Write-Host ''
Write-Host '[Batch 3 Summary]' -ForegroundColor Green
$total = ($script:results | Measure-Object -Property Recovered -Sum).Sum
$script:results | Format-Table -AutoSize
Write-Host "Total recovered: $total GB" -ForegroundColor Green