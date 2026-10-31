const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');

const encodePowerShell = script => Buffer.from(script, 'utf16le').toString('base64');
const encodeUtf8 = value => Buffer.from(value, 'utf8').toString('base64');
const quoteCommandPath = value => '"' + value.replaceAll('"', '\\"') + '"';

function createSessionBackground({ profile, spawnProcess = spawn, now = () => new Date(), processAlive = (pid) => {
  try { process.kill(pid, 0); return true; } catch { return false; }
} }) {
  const planFile = path.join(profile, 'scheduled-session.json');
  const statusFile = path.join(profile, 'scheduled-session-status.json');
  const brokerErrorFile = statusFile + '.broker-error';
  const helperFile = path.join(profile, 'scheduled-session-helper.ps1');
  const read = async (file) => {
    try { return JSON.parse(await fs.readFile(file, 'utf8')); }
    catch (error) {
      if (error.code === 'ENOENT') return null;
      throw new Error('无法读取后台助手状态，请重新打开程序。');
    }
  };
  const write = async (value) => {
    await fs.mkdir(profile, { recursive: true });
    const temporary = planFile + '.' + crypto.randomUUID() + '.tmp';
    try {
      await fs.writeFile(temporary, JSON.stringify(value, null, 2), { flag: 'wx' });
      await fs.rename(temporary, planFile);
    } finally { await fs.rm(temporary, { force: true }).catch(() => {}); }
  };
  const alive = (status) => Number.isInteger(status?.pid) && status.pid > 0 && processAlive(status.pid);
  const healthy = (plan, status) => plan?.token === status?.token && !status?.stopped && alive(status)
    && Number.isFinite(Date.parse(status.heartbeatAt)) && Math.abs(now().getTime() - Date.parse(status.heartbeatAt)) < 10000;
  const snapshot = async () => {
    const [plan, status] = await Promise.all([read(planFile), read(statusFile)]);
    const registered = plan?.enabled === true && healthy(plan, status);
    return {
      registered, enabled: registered, backend: 'session', sessionOnly: true,
      ...(plan?.action || {}), nextRunAt: plan?.nextRunAt || null,
      helperPid: alive(status) && !status.stopped ? status.pid : null,
      heartbeatAt: status?.heartbeatAt || null, stopped: status?.stopped === true,
      launchCount: status?.launchCount || 0, lastLaunchAt: status?.lastLaunchAt || null,
      lastResult: status?.lastResult ?? null, lastError: status?.lastError || '',
    };
  };
  const until = async (check, message) => {
    const deadline = Date.now() + 10000;
    do {
      const value = await check();
      if (value) return value;
      await new Promise(resolve => setTimeout(resolve, 75));
    } while (Date.now() < deadline);
    throw new Error(message);
  };
  return async function sessionOperation(request) {
    if (request.mode === 'read') return snapshot();
    const [previous, previousStatus] = await Promise.all([read(planFile), read(statusFile)]);
    if (request.mode === 'remove') {
      if (previous) await write({ ...previous, enabled: false, updatedAt: now().toISOString() });
      await until(async () => {
        const status = await read(statusFile);
        return !alive(status) || status.stopped;
      }, '后台助手尚未停止，请稍后刷新。');
      await fs.rm(helperFile, { force: true }).catch(() => {});
      return snapshot();
    }
    if (request.mode !== 'register') throw new Error('无效的后台助手操作。');
    if (!path.isAbsolute(request.action?.executable || '') || !path.isAbsolute(request.action?.workingDirectory || '')
      || typeof request.action?.arguments !== 'string' || /[\x00-\x1f]/.test(request.action.arguments)
      || !Number.isFinite(Date.parse(request.nextRunAt))) throw new Error('后台助手启动参数无效。');
    const plan = { version: 1, name: request.name, enabled: true, token: crypto.randomUUID(),
      nextRunAt: request.nextRunAt, action: request.action, updatedAt: now().toISOString() };
    await write(plan);
    let launchError;
    if (!healthy(previous, previousStatus)) {
      const template = await fs.readFile(path.join(__dirname, 'session-background.ps1'), 'utf8');
      const data = Buffer.from(JSON.stringify({ planFile, statusFile, mutexName: 'Local\\' + request.name + '-session' }), 'utf8').toString('base64');
      const powershell = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
      await fs.rm(brokerErrorFile, { force: true });
      try {
        const helperScript = "$settings = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('" + data + "')) | ConvertFrom-Json\n" + template;
        await fs.writeFile(helperFile, helperScript, 'utf8');
        const helperCommand = [quoteCommandPath(powershell), '-NoLogo', '-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden', '-ExecutionPolicy', 'Bypass', '-File', quoteCommandPath(helperFile)].join(' ');
        const brokerData = {
          commandLine: encodeUtf8(helperCommand),
          workingDirectory: encodeUtf8(profile),
          errorFile: encodeUtf8(brokerErrorFile),
        };
        const brokerScript = `$ErrorActionPreference = 'Stop'
function Decode-Utf8([string]$value) { [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($value)) }
try {
  $commandLine = Decode-Utf8 '${brokerData.commandLine}'
  $workingDirectory = Decode-Utf8 '${brokerData.workingDirectory}'
  $errorFile = Decode-Utf8 '${brokerData.errorFile}'
  $result = Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{ CommandLine = $commandLine; CurrentDirectory = $workingDirectory }
  if ($result.ReturnValue -ne 0) { throw ('Win32_Process.Create returned ' + $result.ReturnValue) }
} catch {
  $errorFile = Decode-Utf8 '${brokerData.errorFile}'
  [IO.File]::WriteAllText($errorFile, $_.Exception.ToString(), (New-Object System.Text.UTF8Encoding($false)))
  exit 1
}`;
        const child = spawnProcess(powershell, ['-NoLogo', '-NoProfile', '-NonInteractive', '-WindowStyle', 'Hidden',
          '-EncodedCommand', encodePowerShell(process.platform === 'win32' ? brokerScript : helperScript)], { windowsHide: true, stdio: 'ignore' });
        child.on('error', () => { launchError = new Error('无法启动后台助手，请检查 PowerShell 是否可用。'); });
        child.on('exit', code => { if (code !== 0 && !launchError) launchError = new Error('后台助手 broker 启动失败。'); });
        child.unref();
      } catch { launchError = new Error('无法启动后台助手，请检查 PowerShell 是否可用。'); }
    }
    return until(async () => {
      if (launchError) throw launchError;
      try {
        const brokerError = (await fs.readFile(brokerErrorFile, 'utf8')).trim();
        if (brokerError) throw new Error('后台助手 broker 启动失败：' + brokerError.slice(-1200));
      } catch (error) { if (error.code !== 'ENOENT') throw error; }
      const result = await snapshot();
      return result.registered && result;
    }, '后台助手启动超时，请重新打开程序。');
  };
}

module.exports = { createSessionBackground };
