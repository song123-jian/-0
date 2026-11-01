param([Parameter(Mandatory=$true)][string]$StateFile, [Parameter(Mandatory=$true)][string]$StopFile, [Parameter(Mandatory=$true)][string]$ActivateFile)
$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class ScodexFixtureWindow {
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int command);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr h, IntPtr after, int x, int y, int w, int hgt, uint flags);
}
'@
[void][ScodexFixtureWindow]::SetProcessDPIAware()
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$form = New-Object System.Windows.Forms.Form
$form.Text = 'Scodex desktop acceptance fixture'
$form.StartPosition = 'Manual'
$form.Location = New-Object System.Drawing.Point(40,40)
$form.ClientSize = New-Object System.Drawing.Size(640,570)
$form.TopMost = $true
$form.Font = New-Object System.Drawing.Font('Microsoft YaHei UI',12)
$label = New-Object System.Windows.Forms.Label
$label.Text = 'Isolated input, click and scroll verification'
$label.Location = New-Object System.Drawing.Point(20,15)
$label.Size = New-Object System.Drawing.Size(600,30)
$form.Controls.Add($label)
$inputBox = New-Object System.Windows.Forms.RichTextBox
$inputBox.DetectUrls = $false
$inputBox.Location = New-Object System.Drawing.Point(20,60)
$inputBox.Size = New-Object System.Drawing.Size(590,36)
$form.Controls.Add($inputBox)
$button = New-Object System.Windows.Forms.Button
$button.Text = 'Record input'
$button.Location = New-Object System.Drawing.Point(20,110)
$button.Size = New-Object System.Drawing.Size(220,42)
$form.Controls.Add($button)
$list = New-Object System.Windows.Forms.ListBox
$list.Location = New-Object System.Drawing.Point(20,170)
$list.Size = New-Object System.Drawing.Size(590,370)
1..120 | ForEach-Object { [void]$list.Items.Add(('Scroll row ' + $_)) }
$form.Controls.Add($list)
$script:clicks = 0
$script:recorded = ''
$script:previous = ''
$script:activated = ''
$script:keys = @()
function Rectangle($control) {
  $point = $control.PointToScreen((New-Object System.Drawing.Point(0,0)))
  return @{x=$point.X;y=$point.Y;width=$control.Width;height=$control.Height}
}
function Save-State {
  $state = @{visible=[ScodexFixtureWindow]::IsWindowVisible($form.Handle);foreground=([ScodexFixtureWindow]::GetForegroundWindow() -eq $form.Handle);text=$inputBox.Text;selectionStart=$inputBox.SelectionStart;selectionLength=$inputBox.SelectionLength;keys=$script:keys;recorded=$script:recorded;clicks=$script:clicks;topIndex=$list.TopIndex;input=(Rectangle $inputBox);button=(Rectangle $button);list=(Rectangle $list)} | ConvertTo-Json -Depth 4 -Compress
  if ($state -ne $script:previous) {
    [IO.File]::WriteAllText($StateFile,$state,(New-Object Text.UTF8Encoding($false)))
    $script:previous = $state
  }
}
$button.Add_Click({$script:clicks++;$script:recorded=$inputBox.Text;Save-State})
$inputBox.Add_TextChanged({Save-State})
$inputBox.Add_KeyDown({param($sender,$event);$script:keys += $event.KeyData.ToString();Save-State})
$inputBox.Add_KeyUp({Save-State})
$timer = New-Object System.Windows.Forms.Timer
$timer.Interval = 150
function Activate-Fixture {
  [void][ScodexFixtureWindow]::ShowWindow($form.Handle,9)
  [void][ScodexFixtureWindow]::SetWindowPos($form.Handle,[IntPtr](-1),0,0,0,0,0x43)
  $form.BringToFront()
  $form.Activate()
  [void][ScodexFixtureWindow]::SetForegroundWindow($form.Handle)
}
$timer.Add_Tick({if (Test-Path -LiteralPath $StopFile) {$form.Close()} else {if (Test-Path -LiteralPath $ActivateFile) {$token=[IO.File]::ReadAllText($ActivateFile);if ($token -ne $script:activated) {$script:activated=$token;Activate-Fixture}};Save-State}})
$form.Add_Shown({Activate-Fixture;$timer.Start();Save-State})
try { [Windows.Forms.Application]::Run($form) } finally {$timer.Dispose();$form.Dispose()}
