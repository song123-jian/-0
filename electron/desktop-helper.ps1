$ErrorActionPreference = 'Stop'
[Console]::InputEncoding = New-Object System.Text.UTF8Encoding($false)
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
try {
  $data = [Console]::In.ReadToEnd() | ConvertFrom-Json
  Add-Type -AssemblyName System.Drawing
  Add-Type -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
public static class ScodexDesktop {
  [StructLayout(LayoutKind.Sequential)] public struct MOUSEINPUT { public int dx,dy; public uint mouseData,dwFlags,time; public UIntPtr dwExtraInfo; }
  [StructLayout(LayoutKind.Sequential)] public struct KEYBDINPUT { public ushort wVk,wScan; public uint dwFlags,time; public UIntPtr dwExtraInfo; }
  [StructLayout(LayoutKind.Explicit)] public struct INPUTUNION { [FieldOffset(0)] public MOUSEINPUT mi; [FieldOffset(0)] public KEYBDINPUT ki; }
  [StructLayout(LayoutKind.Sequential)] public struct INPUT { public uint type; public INPUTUNION u; }
  [DllImport("user32.dll", SetLastError=true)] static extern uint SendInput(uint n, INPUT[] input, int size);
  [DllImport("user32.dll", SetLastError=true)] static extern bool SetCursorPos(int x,int y);
  [DllImport("user32.dll")] public static extern int GetSystemMetrics(int n);
  [DllImport("user32.dll")] static extern bool SetProcessDpiAwarenessContext(IntPtr value);
  public static void Init() { try { SetProcessDpiAwarenessContext(new IntPtr(-4)); } catch (EntryPointNotFoundException) {} }
  static void Send(List<INPUT> input) { var a=input.ToArray(); if (SendInput((uint)a.Length,a,Marshal.SizeOf(typeof(INPUT)))!=(uint)a.Length) throw new Exception("Windows input rejected (UIPI or desktop unavailable)."); }
  static INPUT Key(ushort key,ushort scan,uint flags) { return new INPUT { type=1, u=new INPUTUNION { ki=new KEYBDINPUT { wVk=key,wScan=scan,dwFlags=flags,dwExtraInfo=new UIntPtr(0x53434458u) } } }; }
  static INPUT Mouse(uint flags,uint data=0) { return new INPUT { type=0,u=new INPUTUNION { mi=new MOUSEINPUT { dwFlags=flags,mouseData=data } } }; }
  public static void Click(int x,int y,string button,int count) {
    if (!SetCursorPos(x,y)) throw new Exception("Cannot move cursor.");
    uint down=button=="right" ? 8u : button=="middle" ? 32u : 2u; var a=new List<INPUT>();
    for(int i=0;i<count;i++) { a.Add(Mouse(down)); a.Add(Mouse(down*2)); } Send(a);
  }
  public static void Scroll(int x,int y,int ticks) { if(!SetCursorPos(x,y)) throw new Exception("Cannot move cursor."); Send(new List<INPUT> { Mouse(0x0800,unchecked((uint)(ticks*120))) }); }
  public static void Text(string text) { var a=new List<INPUT>(); foreach(char c in text) { a.Add(Key(0,c,4)); a.Add(Key(0,c,6)); } Send(a); }
  static ushort Vk(string k) {
    if(k.Length==1) return (ushort)k[0];
    if(k.StartsWith("F") && k.Length<=3) return (ushort)(111+int.Parse(k.Substring(1)));
    switch(k) {
      case "CTRL": return 17; case "ALT": return 18; case "SHIFT": return 16; case "WIN": return 91;
      case "ENTER": return 13; case "TAB": return 9; case "ESC": case "ESCAPE": return 27; case "SPACE": return 32;
      case "BACKSPACE": return 8; case "DELETE": return 46; case "INSERT": return 45; case "HOME": return 36; case "END": return 35;
      case "PAGEUP": return 33; case "PAGEDOWN": return 34; case "UP": return 38; case "DOWN": return 40; case "LEFT": return 37; case "RIGHT": return 39;
      default: throw new Exception("Unknown key.");
    }
  }
  public static void Press(string[] keys) { var a=new List<INPUT>(); foreach(string k in keys) a.Add(Key(Vk(k),0,0)); for(int i=keys.Length-1;i>=0;i--) a.Add(Key(Vk(keys[i]),0,2)); Send(a); }
}
'@
  [ScodexDesktop]::Init()
  $x = [ScodexDesktop]::GetSystemMetrics(76); $y = [ScodexDesktop]::GetSystemMetrics(77)
  $width = [ScodexDesktop]::GetSystemMetrics(78); $height = [ScodexDesktop]::GetSystemMetrics(79)
  if ($width -le 0 -or $height -le 0) { throw 'Interactive desktop is unavailable.' }
  if ($data.action -ne 'screenshot') {
    if ($null -eq $data.expected -or $data.expected.x -ne $x -or $data.expected.y -ne $y -or $data.expected.width -ne $width -or $data.expected.height -ne $height) { throw 'Display geometry changed; take a new screenshot.' }
    switch ($data.action) {
      'click' { [ScodexDesktop]::Click([int]$data.x,[int]$data.y,[string]$data.button,[int]$data.clicks) }
      'scroll' { [ScodexDesktop]::Scroll([int]$data.x,[int]$data.y,[int]$data.ticks) }
      'type' { [ScodexDesktop]::Text([string]$data.text) }
      'key' { [ScodexDesktop]::Press([string[]]$data.keys) }
      default { throw 'Unknown desktop action.' }
    }
    Start-Sleep -Milliseconds 120
  }
  $bitmap = New-Object System.Drawing.Bitmap($width,$height)
  try {
    $g = [System.Drawing.Graphics]::FromImage($bitmap)
    try { $g.CopyFromScreen($x,$y,0,0,$bitmap.Size) } finally { $g.Dispose() }
    $scale = [Math]::Min(1,[Math]::Min(1600/$width,1000/$height))
    $sw = [Math]::Max(1,[int][Math]::Floor($width*$scale)); $sh = [Math]::Max(1,[int][Math]::Floor($height*$scale))
    $small = New-Object System.Drawing.Bitmap($sw,$sh)
    $stream = New-Object System.IO.MemoryStream
    try {
      $sg = [System.Drawing.Graphics]::FromImage($small)
      try { $sg.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic; $sg.DrawImage($bitmap,0,0,$sw,$sh) } finally { $sg.Dispose() }
      $small.Save($stream,[System.Drawing.Imaging.ImageFormat]::Jpeg)
      $result = @{ desktop=@{x=$x;y=$y;width=$width;height=$height}; image=@{width=$sw;height=$sh;dataUrl=('data:image/jpeg;base64,'+[Convert]::ToBase64String($stream.ToArray()))} }
      [Console]::Write(($result | ConvertTo-Json -Depth 4 -Compress))
    } finally { $stream.Dispose(); $small.Dispose() }
  } finally { $bitmap.Dispose() }
} catch { [Console]::Write((@{ error=$_.Exception.Message } | ConvertTo-Json -Compress)) }
