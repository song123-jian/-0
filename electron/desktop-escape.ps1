$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
try {
  Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
using System.Threading;
public static class ScodexEscape {
  delegate IntPtr KeyboardProc(int code, IntPtr message, IntPtr data);
  [StructLayout(LayoutKind.Sequential)] struct KeyboardData { public uint key, scan, flags, time; public UIntPtr extra; }
  [StructLayout(LayoutKind.Sequential)] struct Message { public IntPtr window; public uint message; public UIntPtr wParam; public IntPtr lParam; public uint time; public int x, y; public uint privateData; }
  [DllImport("user32.dll", SetLastError=true)] static extern IntPtr SetWindowsHookEx(int id, KeyboardProc callback, IntPtr module, uint thread);
  [DllImport("user32.dll")] static extern bool UnhookWindowsHookEx(IntPtr hook);
  [DllImport("user32.dll")] static extern IntPtr CallNextHookEx(IntPtr hook, int code, IntPtr message, IntPtr data);
  [DllImport("user32.dll")] static extern int GetMessage(out Message message, IntPtr window, uint min, uint max);
  [DllImport("user32.dll")] static extern bool TranslateMessage(ref Message message);
  [DllImport("user32.dll")] static extern IntPtr DispatchMessage(ref Message message);
  [DllImport("user32.dll")] static extern bool PeekMessage(out Message message, IntPtr window, uint min, uint max, uint remove);
  [DllImport("user32.dll")] static extern bool PostThreadMessage(uint thread, uint message, UIntPtr wParam, IntPtr lParam);
  [DllImport("kernel32.dll")] static extern uint GetCurrentThreadId();
  [DllImport("kernel32.dll", CharSet=CharSet.Auto)] static extern IntPtr GetModuleHandle(string name);
  static KeyboardProc callback = Handle;
  static IntPtr hook;
  static bool down;
  static IntPtr Handle(int code, IntPtr message, IntPtr data) {
    if (code >= 0) {
      var key = (KeyboardData)Marshal.PtrToStructure(data, typeof(KeyboardData));
      // Only Scodex's own SendInput events carry this marker. User Esc remains active across apps.
      if (key.key == 27 && key.extra.ToUInt64() != 0x53434458) {
        long kind = message.ToInt64();
        if (kind == 0x100 || kind == 0x104) {
          if (!down) { down = true; Console.WriteLine("cancel"); Console.Out.Flush(); }
          return new IntPtr(1);
        }
        if (kind == 0x101 || kind == 0x105) { down = false; return new IntPtr(1); }
      }
    }
    return CallNextHookEx(hook, code, message, data);
  }
  public static void Run() {
    hook = SetWindowsHookEx(13, callback, GetModuleHandle(null), 0);
    if (hook == IntPtr.Zero) throw new Exception("Cannot register desktop Escape listener.");
    try {
      Message message;
      PeekMessage(out message, IntPtr.Zero, 0, 0, 0);
      uint owner = GetCurrentThreadId();
      // The pipe reaches EOF if the parent exits, including an unexpected termination.
      var parentMonitor = new Thread(() => { Console.In.ReadLine(); PostThreadMessage(owner, 0x12, UIntPtr.Zero, IntPtr.Zero); });
      parentMonitor.IsBackground = true;
      parentMonitor.Start();
      Console.WriteLine("ready"); Console.Out.Flush();
      int result;
      while ((result = GetMessage(out message, IntPtr.Zero, 0, 0)) > 0) { TranslateMessage(ref message); DispatchMessage(ref message); }
      if (result < 0) throw new Exception("Desktop Escape listener failed.");
    } finally { UnhookWindowsHookEx(hook); GC.KeepAlive(callback); }
  }
}
'@
  [ScodexEscape]::Run()
} catch { [Console]::Error.WriteLine($_.Exception.Message); exit 1 }
