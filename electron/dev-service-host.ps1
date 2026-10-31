$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$scodexOwner = [System.Diagnostics.Process]::GetProcessById($scodexOwnerPid)
$null = $scodexOwner.Handle
$scodexEncoding = New-Object System.Text.UTF8Encoding($false)
$OutputEncoding = $scodexEncoding
[Console]::OutputEncoding = $scodexEncoding
[Console]::InputEncoding = $scodexEncoding
# The non-inheritable job handle stays in this wrapper. Closing the wrapper
# closes the handle and terminates descendants, including detached grandchildren.
Add-Type -TypeDefinition @'
using System;
using System.ComponentModel;
using System.Runtime.InteropServices;
public static class ScodexServiceJob {
    [StructLayout(LayoutKind.Sequential)] struct BasicLimits {
        public long PerProcessUserTimeLimit, PerJobUserTimeLimit;
        public uint LimitFlags;
        public UIntPtr MinimumWorkingSetSize, MaximumWorkingSetSize;
        public uint ActiveProcessLimit;
        public UIntPtr Affinity;
        public uint PriorityClass, SchedulingClass;
    }
    [StructLayout(LayoutKind.Sequential)] struct IoCounters {
        public ulong ReadOperationCount, WriteOperationCount, OtherOperationCount;
        public ulong ReadTransferCount, WriteTransferCount, OtherTransferCount;
    }
    [StructLayout(LayoutKind.Sequential)] struct ExtendedLimits {
        public BasicLimits BasicLimitInformation;
        public IoCounters IoInfo;
        public UIntPtr ProcessMemoryLimit, JobMemoryLimit, PeakProcessMemoryUsed, PeakJobMemoryUsed;
    }
    [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)] static extern IntPtr CreateJobObject(IntPtr attributes, string name);
    [DllImport("kernel32.dll", SetLastError=true)] static extern bool SetInformationJobObject(IntPtr job, int kind, ref ExtendedLimits data, uint length);
    [DllImport("kernel32.dll", SetLastError=true)] static extern bool AssignProcessToJobObject(IntPtr job, IntPtr process);
    [DllImport("kernel32.dll")] static extern IntPtr GetCurrentProcess();
    [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr handle);
    static IntPtr job;
    public static void Attach(System.Diagnostics.Process owner) {
        job = CreateJobObject(IntPtr.Zero, null);
        if (job == IntPtr.Zero) throw new Win32Exception(Marshal.GetLastWin32Error());
        var limits = new ExtendedLimits();
        limits.BasicLimitInformation.LimitFlags = 0x2000;
        if (!SetInformationJobObject(job, 9, ref limits, (uint)Marshal.SizeOf(typeof(ExtendedLimits))) || !AssignProcessToJobObject(job, GetCurrentProcess())) {
            int code = Marshal.GetLastWin32Error(); CloseHandle(job); job = IntPtr.Zero;
            throw new Win32Exception(code);
        }
        var watcher = new System.Threading.Thread(delegate() {
            try { owner.WaitForExit(); } catch { }
            Environment.Exit(1);
        });
        watcher.IsBackground = true; watcher.Start();
    }
}
'@
[ScodexServiceJob]::Attach($scodexOwner)
