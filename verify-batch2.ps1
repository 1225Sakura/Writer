function Get-DirSizeGB {
    param($Path)
    if (Test-Path $Path) {
        $s = (Get-ChildItem $Path -Recurse -File -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum
        return [math]::Round($s/1GB, 3)
    }
    return 0
}

$paths = @{
    'WindowsTemp' = 'C:\Users\36084\AppData\Local\Temp'
    'SquirrelTemp' = 'D:\SquirrelTemp'
    'LocalLow' = 'C:\Users\36084\AppData\LocalLow'
}

$paths.GetEnumerator() | ForEach-Object {
    [PSCustomObject]@{
        Name = $_.Key
        Path = $_.Value
        SizeGB = Get-DirSizeGB $_.Value
    }
} | Format-Table -AutoSize