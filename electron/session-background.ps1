$ErrorActionPreference = 'Stop'
$utf8 = New-Object System.Text.UTF8Encoding($false)
$mutex = New-Object System.Threading.Mutex($false, $settings.mutexName)
$owned = $false
$pending = $null
$lastAttempt = [DateTimeOffset]::MinValue
$lastDue = ''
$state = @{ token = ''; pid = $PID; stopped = $false; launchCount = 0; lastResult = $null; lastError = ''; lastLaunchAt = $null }

function Write-Status {
    $state.heartbeatAt = [DateTimeOffset]::UtcNow.ToString('o')
    $temporary = $settings.statusFile + '.' + $PID + '.tmp'
    [IO.File]::WriteAllText($temporary, ($state | ConvertTo-Json -Compress), $utf8)
    if ([IO.File]::Exists($settings.statusFile)) { [IO.File]::Replace($temporary, $settings.statusFile, [System.Management.Automation.Language.NullString]::Value) }
    else { [IO.File]::Move($temporary, $settings.statusFile) }
}

try {
    try { $owned = $mutex.WaitOne(0) }
    catch [System.Threading.AbandonedMutexException] { $owned = $true }
    if (!$owned) { return }
    while ([IO.File]::Exists($settings.planFile)) {
        $plan = [IO.File]::ReadAllText($settings.planFile, $utf8) | ConvertFrom-Json
        $state.token = $plan.token
        if ($plan.version -ne 1 -or $plan.enabled -ne $true) { break }
        if ($null -ne $pending -and $pending.HasExited) {
            $state.lastResult = $pending.ExitCode
            if ($pending.ExitCode -ne 0) { $state.lastError = 'Background program exited with code ' + $pending.ExitCode }
            else { $state.lastError = '' }
            $pending.Dispose()
            $pending = $null
        }
        $due = [DateTimeOffset]::Parse($plan.nextRunAt)
        $now = [DateTimeOffset]::UtcNow
        if ($due -le $now -and $null -eq $pending -and ($lastDue -ne $plan.nextRunAt -or ($now - $lastAttempt).TotalSeconds -ge 60)) {
            $lastDue = $plan.nextRunAt
            $lastAttempt = $now
            try {
                if (![IO.Path]::IsPathRooted($plan.action.executable) -or ![IO.File]::Exists($plan.action.executable) -or
                    ![IO.Path]::IsPathRooted($plan.action.workingDirectory) -or $plan.action.arguments -match '[\x00-\x1f]') {
                    throw 'Invalid background program path or arguments.'
                }
                $start = New-Object System.Diagnostics.ProcessStartInfo
                $start.FileName = $plan.action.executable
                $start.Arguments = $plan.action.arguments
                $start.WorkingDirectory = $plan.action.workingDirectory
                $start.UseShellExecute = $false
                $start.CreateNoWindow = $true
                $start.WindowStyle = [System.Diagnostics.ProcessWindowStyle]::Hidden
                $pending = New-Object System.Diagnostics.Process
                $pending.StartInfo = $start
                if (!$pending.Start()) { throw 'Background program did not start.' }
                $state.launchCount = $state.launchCount + 1
                $state.lastLaunchAt = $now.ToString('o')
                $state.lastError = ''
            } catch {
                if ($null -ne $pending) { $pending.Dispose(); $pending = $null }
                $state.lastError = $_.Exception.Message
                $state.lastResult = -1
            }
        }
        Write-Status
        Start-Sleep -Milliseconds 500
    }
} catch {
    $state.lastError = $_.Exception.Message
} finally {
    if ($owned) {
        $state.stopped = $true
        try { Write-Status } catch { }
        $mutex.ReleaseMutex()
    }
    if ($null -ne $pending) { $pending.Dispose() }
    $mutex.Dispose()
}
