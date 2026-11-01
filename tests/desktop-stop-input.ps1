param([ValidateSet('Escape','Click')][string]$Action='Escape', [int]$X=0, [int]$Y=0)
$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
using System.Threading;
public static class ScodexUserInput {
  [DllImport("user32.dll")] static extern void keybd_event(byte key, byte scan, uint flags, UIntPtr extra);
  [DllImport("user32.dll")] static extern bool SetCursorPos(int x, int y);
  [DllImport("user32.dll")] static extern void mouse_event(uint flags, uint x, uint y, uint data, UIntPtr extra);
  public static void Escape() {
    keybd_event(27, 0, 0, UIntPtr.Zero);
    Thread.Sleep(40);
    keybd_event(27, 0, 2, UIntPtr.Zero);
  }
  public static void Click(int x, int y) {
    if (!SetCursorPos(x,y)) throw new Exception("Cannot place test cursor.");
    mouse_event(2, 0, 0, 0, UIntPtr.Zero);
    mouse_event(4, 0, 0, 0, UIntPtr.Zero);
  }
}
'@
if ($Action -eq 'Escape') { [ScodexUserInput]::Escape() } else { [ScodexUserInput]::Click($X,$Y) }
