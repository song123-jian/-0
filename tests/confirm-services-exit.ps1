[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
$ProgressPreference = 'SilentlyContinue'
Add-Type @'
using System;
using System.Text;
using System.Runtime.InteropServices;
public static class ScodexQuitWindows {
  public delegate bool EnumProc(IntPtr handle, IntPtr state);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc callback, IntPtr state);
  [DllImport("user32.dll")] public static extern bool EnumChildWindows(IntPtr parent, EnumProc callback, IntPtr state);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr handle, out uint processId);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetWindowText(IntPtr handle, StringBuilder text, int capacity);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetClassName(IntPtr handle, StringBuilder text, int capacity);
  [DllImport("user32.dll")] public static extern IntPtr SendMessage(IntPtr handle, uint message, IntPtr wparam, IntPtr lparam);
  public static string Text(IntPtr handle) { var text = new StringBuilder(4096); GetWindowText(handle, text, text.Capacity); return text.ToString(); }
  public static string Class(IntPtr handle) { var text = new StringBuilder(256); GetClassName(handle, text, text.Capacity); return text.ToString(); }
}
'@
$until = [DateTime]::UtcNow.AddSeconds(12)
$observed = @()
while ([DateTime]::UtcNow -lt $until) {
  $windows = New-Object 'System.Collections.Generic.List[IntPtr]'
  [ScodexQuitWindows]::EnumWindows({ param($handle, $state) $owner = [uint32]0; [void][ScodexQuitWindows]::GetWindowThreadProcessId($handle, [ref]$owner); if ($owner -eq $TargetPid) { $windows.Add($handle) }; return $true }, [IntPtr]::Zero) | Out-Null
  $observed = @()
  foreach ($window in $windows) {
    $title = [ScodexQuitWindows]::Text($window)
    $class = [ScodexQuitWindows]::Class($window)
    if ($class -ne '#32770') { $observed += @{ title = $title; class = $class }; continue }
    $children = New-Object 'System.Collections.Generic.List[IntPtr]'
    [ScodexQuitWindows]::EnumChildWindows($window, { param($handle, $state) $children.Add($handle); return $true }, [IntPtr]::Zero) | Out-Null
    $controls = @($children | ForEach-Object { @{ title = [ScodexQuitWindows]::Text($_); class = [ScodexQuitWindows]::Class($_); handle = $_ } })
    $observed += @{ title = $title; class = $class; controls = @($controls | Select-Object title,class) }
    $isQuit = $title -eq '退出 Scodex 工作台' -or ($controls.title -contains '开发服务仍在运行，退出会停止服务及其子进程。')
    $button = $controls | Where-Object { $_.class -eq 'Button' -and $_.title -match '^&?退出(?:\(&.\))?$' } | Select-Object -First 1
    if ($isQuit -and $button) { [void][ScodexQuitWindows]::SendMessage($button.handle, 0x00F5, [IntPtr]::Zero, [IntPtr]::Zero); [Console]::Out.Write('confirmed'); exit 0 }
  }
  Start-Sleep -Milliseconds 200
}
throw ('Quit dialog was not confirmed; native windows: ' + (ConvertTo-Json -Depth 5 -Compress -InputObject $observed))
