Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class WinAPI {
    [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
    [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int n);
    [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr h);
}
"@
$procs = [System.Diagnostics.Process]::GetProcessesByName("electron")
foreach ($p in $procs) {
    $h = $p.MainWindowHandle
    if ($h -ne [IntPtr]::Zero) {
        if ([WinAPI]::IsIconic($h)) { [WinAPI]::ShowWindow($h, 9) }
        [WinAPI]::SetForegroundWindow($h)
        Write-Host "Restored PID $($p.Id) Handle=$h"
    }
}
