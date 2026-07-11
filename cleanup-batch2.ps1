# 批次 2：系统/更新器临时文件
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

function Clean-Dir {
    param($Name, $Path)
    Write-Host ''
    Write-Host "[$Name]" -ForegroundColor Cyan
    Write-Host "  Path: $Path"
    if (-not (Test-Path $Path)) {
        Write-Host "  Not found, skip" -ForegroundColor Yellow
        $script:results += [PSCustomObject]@{ Item=$Name; Before=0; After=0; Recovered=0; Status='skip' }
        return
    }
    $before = Get-DirSizeGB $Path
    Write-Host "  Before: $before GB"
    try {
        Get-ChildItem $Path -Force -ErrorAction SilentlyContinue | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
        Write-Host "  Removed" -ForegroundColor Green
    } catch {
        Write-Host "  Warn: $_" -ForegroundColor Yellow
    }
    $after = Get-DirSizeGB $Path
    $recovered = $before - $after
    Write-Host "  After:  $after GB"
    Write-Host "  Recovered: $recovered GB" -ForegroundColor Green
    $script:results += [PSCustomObject]@{ Item=$Name; Before=$before; After=$after; Recovered=$recovered; Status='done' }
}

Clean-Dir 'WindowsTemp' 'C:\Users\36084\AppData\Local\Temp'
Clean-Dir 'SquirrelTemp' 'D:\SquirrelTemp'

Write-Host ''
Write-Host '[LocalLow 子目录预览（不自动删除）]' -ForegroundColor Cyan
$lowPath = 'C:\Users\36084\AppData\LocalLow'
$before = Get-DirSizeGB $lowPath
Write-Host "  Total: $before GB"
$items = Get-ChildItem $lowPath -Force -ErrorAction SilentlyContinue | ForEach-Object {
    $s = (Get-ChildItem $_.FullName -Recurse -File -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum
    [PSCustomObject]@{ Name=$_.Name; SizeGB=[math]::Round($s/1GB,3) }
} | Sort-Object SizeGB -Descending
$items | Select-Object -First 15 | Format-Table -AutoSize
$script:results += [PSCustomObject]@{ Item='LocalLow'; Before=$before; After=$before; Recovered=0; Status='listed' }

Write-Host ''
Write-Host '[Batch 2 Summary]' -ForegroundColor Green
$total = ($script:results | Measure-Object -Property Recovered -Sum).Sum
$script:results | Format-Table -AutoSize
Write-Host "Total recovered: $total GB" -ForegroundColor Green