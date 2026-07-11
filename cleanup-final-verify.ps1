function Get-DirSizeGB {
    param($Path)
    if (Test-Path $Path) {
        $s = (Get-ChildItem $Path -Recurse -File -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum
        return [math]::Round($s/1GB, 3)
    }
    return 0
}

Write-Host "===== Disk Status =====" -ForegroundColor Cyan
Get-PSDrive C, D | Select-Object Name, @{N='UsedGB';E={[math]::Round($_.Used/1GB,2)}}, @{N='FreeGB';E={[math]::Round($_.Free/1GB,2)}}, @{N='TotalGB';E={[math]::Round(($_.Used+$_.Free)/1GB,2)}}, @{N='UsedPct';E={[math]::Round($_.Used/($_.Used+$_.Free)*100,1)}} | Format-Table -AutoSize

Write-Host ''
Write-Host "===== Cache Status After Cleanup =====" -ForegroundColor Cyan
$paths = @{
    'pip cache'        = 'C:\Users\36084\AppData\Local\pip\cache'
    'uv cache'         = 'C:\Users\36084\AppData\Local\uv\cache'
    'npm-cache'        = 'C:\Users\36084\AppData\Local\npm-cache'
    'pnpm-store'       = 'D:\.pnpm-store'
    'WindowsTemp'      = 'C:\Users\36084\AppData\Local\Temp'
    'SquirrelTemp'     = 'D:\SquirrelTemp'
    'Edge Cache'       = 'C:\Users\36084\AppData\Local\Microsoft\Edge\User Data\Default\Cache'
    'Chrome Cache'     = 'C:\Users\36084\AppData\Local\Google\Chrome\User Data\Default\Cache'
    'VSCode CachedData'= 'C:\Users\36084\AppData\Roaming\Code\CachedData'
    'VSCode Cache'     = 'C:\Users\36084\AppData\Roaming\Code\Cache'
    'CrashDumps'       = 'C:\Users\36084\AppData\Local\CrashDumps'
    'D3DSCache'        = 'C:\Users\36084\AppData\Local\D3DSCache'
}

$paths.GetEnumerator() | ForEach-Object {
    [PSCustomObject]@{
        Name = $_.Key
        SizeGB = Get-DirSizeGB $_.Value
    }
} | Sort-Object SizeGB -Descending | Format-Table -AutoSize