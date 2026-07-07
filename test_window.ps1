$proc = Start-Process -FilePath 'E:\codecast\AELA\release\win-unpacked\AELA.exe' -PassThru
Start-Sleep -Seconds 6
$title = $proc.MainWindowTitle
$handle = $proc.MainWindowHandle
$processes = Get-Process | Where-Object { $_.ProcessName -eq 'AELA' }
Write-Output "Main: PID=$($proc.Id) Title='$title' Handle=$handle"
foreach ($p in $processes) {
    Write-Output "  Process: PID=$($p.Id) Title='$($p.MainWindowTitle)' Handle=$($p.MainWindowHandle)"
}
