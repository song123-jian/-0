const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { createSessionBackground } = require('./session-background.cjs');

const execFileAsync = promisify(execFile);
const BACKGROUND_SWITCH = '--scodex-background';

function createInProcessBackground({ now = () => new Date(), pid = process.pid } = {}) {
  let current = null;
  const snapshot = () => current ? { ...current } : {
    registered: false,
    enabled: false,
    backend: 'process',
    sessionOnly: true,
    inProcess: true,
    helperPid: null,
    nextRunAt: null,
  };
  return async function processOperation(request) {
    if (request.mode === 'read') return snapshot();
    if (request.mode === 'remove') {
      current = null;
      return snapshot();
    }
    if (request.mode !== 'register' || !Number.isFinite(Date.parse(request.nextRunAt))) {
      throw new Error('应用内后台调度参数无效。');
    }
    current = {
      registered: true,
      enabled: true,
      backend: 'process',
      sessionOnly: true,
      inProcess: true,
      helperPid: pid,
      nextRunAt: request.nextRunAt,
      ...request.action,
      checkedAt: now().toISOString(),
    };
    return snapshot();
  };
}

function readLaunchOptions(argv) {
  const argument = (name) => {
    const index = argv.findIndex(value => value === name || value.startsWith(name + '='));
    if (index < 0) return '';
    const value = argv[index] === name ? argv[index + 1] : argv[index].slice(name.length + 1);
    if (!value || !path.isAbsolute(value) || /[\x00-\x1f]/.test(value)) throw new Error('启动参数需要有效的绝对路径：' + name);
    return path.resolve(value);
  };
  return { background: argv.includes(BACKGROUND_SWITCH), profile: argument('--user-data-dir'), codexHome: argument('--scodex-home') };
}

function taskNameForProfile(profile) {
  const key = path.resolve(profile).replaceAll('\\', '/').toLowerCase();
  return 'Scodex-Workbench-' + crypto.createHash('sha256').update(key).digest('hex').slice(0, 24);
}

function quoteWindowsArgument(value) {
  const text = String(value);
  if (/[\x00-\x1f]/.test(text)) throw new Error('后台启动路径包含无效字符。');
  return '"' + text.replace(/(\\*)"/g, '$1$1\\"').replace(/(\\+)$/, '$1$1') + '"';
}

function backgroundAction(executable, profile, codexHome) {
  if (!path.isAbsolute(executable) || !path.isAbsolute(profile)) throw new Error('后台执行需要绝对程序路径和数据目录。');
  const args = [BACKGROUND_SWITCH, '--user-data-dir=' + path.resolve(profile)];
  if (codexHome) args.push('--scodex-home=' + path.resolve(codexHome));
  return { executable: path.resolve(executable), arguments: args.map(quoteWindowsArgument).join(' '), workingDirectory: path.dirname(executable) };
}

// COM receives structured data; task actions invoke the EXE directly, without a shell.
async function windowsTaskOperation(request, execute = execFileAsync) {
  const data = Buffer.from(JSON.stringify(request), 'utf8').toString('base64');
  const script = `
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
try {
$request = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${data}')) | ConvertFrom-Json
$service = New-Object -ComObject Schedule.Service
$service.Connect()
$folder = $service.GetFolder('\\')
$task = $null
try { $task = $folder.GetTask($request.name) } catch {
  $cause = $_.Exception
  while ($null -ne $cause.InnerException) { $cause = $cause.InnerException }
  if ($cause.HResult -ne -2147024894) { throw }
}
if ($request.mode -eq 'remove') {
  if ($null -ne $task) { $folder.DeleteTask($request.name, 0); $task = $null }
} elseif ($request.mode -eq 'register') {
  $definition = $service.NewTask(0)
  $definition.RegistrationInfo.Description = 'Scodex background scheduled tasks: ' + $request.name
  $definition.Principal.UserId = [Security.Principal.WindowsIdentity]::GetCurrent().Name
  $definition.Principal.LogonType = 3
  $definition.Principal.RunLevel = 0
  $definition.Settings.Enabled = $true
  $definition.Settings.StartWhenAvailable = $true
  $definition.Settings.DisallowStartIfOnBatteries = $false
  $definition.Settings.StopIfGoingOnBatteries = $false
  $definition.Settings.MultipleInstances = 2
  $definition.Settings.ExecutionTimeLimit = 'PT0S'
  $trigger = $definition.Triggers.Create(1)
  $trigger.StartBoundary = $request.nextRunAt
  $trigger.Enabled = $true
  $action = $definition.Actions.Create(0)
  $action.Path = $request.action.executable
  $action.Arguments = $request.action.arguments
  $action.WorkingDirectory = $request.action.workingDirectory
  $task = $folder.RegisterTaskDefinition($request.name, $definition, 6, $null, $null, 3, $null)
}
if ($null -eq $task) { $result = @{ registered = $false } }
else {
  $definition = $task.Definition
  $result = @{ registered = $true; enabled = [bool]$task.Enabled; state = [int]$task.State;
     executable = $definition.Actions.Item(1).Path; arguments = $definition.Actions.Item(1).Arguments;
     nextRunAt = $definition.Triggers.Item(1).StartBoundary; lastResult = [int]$task.LastTaskResult }
}
@{ ok = $true; result = $result } | ConvertTo-Json -Depth 5 -Compress
} catch {
  $cause = $_.Exception
  while ($null -ne $cause.InnerException) { $cause = $cause.InnerException }
  @{ ok = $false; error = @{ message = $cause.Message; hresult = $cause.HResult } } | ConvertTo-Json -Depth 5 -Compress
}
`;
  const powershell = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
  let stdout;
  try {
    ({ stdout } = await execute(powershell, ['-NoLogo', '-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')], {
      windowsHide: true, encoding: 'utf8', timeout: 20000, maxBuffer: 128 * 1024,
    }));
  } catch (error) {
    if (error.killed || error.code === 'ETIMEDOUT') throw new Error('Windows 计划任务响应超时。');
    if (error.code === 'ENOENT') throw new Error('找不到 Windows 计划任务所需的 PowerShell。');
    throw new Error('无法调用 Windows 计划任务接口。');
  }
  let response;
  try { response = JSON.parse(stdout.trim()); }
  catch { throw new Error('Windows 计划任务返回了无效响应。'); }
  if (response?.ok === true && typeof response.result?.registered === 'boolean') return response.result;
  if (response?.ok !== false || !response.error) throw new Error('Windows 计划任务返回了无效响应。');
  const code = Number.isInteger(response.error.hresult) ? '0x' + (response.error.hresult >>> 0).toString(16).padStart(8, '0').toUpperCase() : '';
  const operation = { read: '读取', register: '登记', remove: '移除' }[request.mode] || '管理';
  const detail = typeof response.error.message === 'string' ? response.error.message.replace(/[\x00-\x1f\x7f]/g, ' ').trim().slice(0, 800) : '';
  const error = new Error(code === '0x80070005'
    ? `Windows 拒绝${operation}计划任务：当前用户权限不足（${code}）。`
    : `Windows 计划任务${code ? '（' + code + '）' : ''}：${detail || '操作失败。'}`);
  error.code = code || 'SCHEDULER_OPERATION_FAILED';
  throw error;
}

function createScheduledBackground({ filePath, profile, executable, codexHome, platform = process.platform, packaged = true, operation = windowsTaskOperation, sessionOperation = createSessionBackground({ profile }), processOperation, now = () => new Date() }) {
  const available = platform === 'win32' && packaged;
  const name = taskNameForProfile(profile);
  let enabled = false;
  let loaded = false;
  let backend = 'windows';
  let tasks = [];
  let queue = Promise.resolve();
  let signature = '';
  let status = { available, enabled, registered: false, backend, sessionOnly: false, inProcess: false, taskName: name, nextRunAt: null, executable, error: '', checkedAt: null };
  const snapshot = () => structuredClone(status);
  const enqueue = (fn) => {
    const result = queue.then(fn);
    queue = result.catch(() => {});
    return result;
  };
  const persist = async () => {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    const temporary = filePath + '.' + crypto.randomUUID() + '.tmp';
    try {
      await fs.writeFile(temporary, JSON.stringify({ version: 2, enabled, backend }, null, 2), { flag: 'wx' });
      await fs.rename(temporary, filePath);
    } finally { await fs.rm(temporary, { force: true }).catch(() => {}); }
  };
  async function reconcile(force = false) {
    const earliest = tasks.filter(task => task.enabled && task.nextRunAt && Number.isFinite(Date.parse(task.nextRunAt)))
      .map(task => task.nextRunAt).sort((a, b) => Date.parse(a) - Date.parse(b))[0] || null;
    status = { ...status, enabled, nextRunAt: enabled ? earliest : null };
    if (!available) {
      status = { ...status, error: enabled ? '后台调度需要 Windows 正式程序。' : '' };
      return snapshot();
    }
    try {
      const action = backgroundAction(executable, profile, codexHome);
      // A past due trigger must be in the near future; the runner keeps the original due time.
      const currentTime = now().getTime();
      const dueTime = Date.parse(earliest);
      const nextRunAt = earliest && new Date(dueTime > currentTime ? dueTime : currentTime + 5000).toISOString();
      const desired = enabled && earliest ? JSON.stringify({ earliest, action }) : 'removed';
      if (!force && signature === desired && !status.error) return snapshot();
      const fallbackBackend = processOperation ? 'process' : 'session';
      const operationForBackend = () => backend === 'process' ? (processOperation || sessionOperation) : backend === 'session' ? sessionOperation : operation;
      let operate = operationForBackend();
      let result = await operate({ mode: 'read', name });
      const triggerTime = Date.parse(result.nextRunAt);
      const matches = result.registered && result.enabled && result.executable === action.executable && result.arguments === action.arguments
        && (triggerTime === dueTime || (dueTime <= currentTime && triggerTime > currentTime && triggerTime <= currentTime + 5000));
      if (enabled && earliest && !matches) {
        try { result = await operate({ mode: 'register', name, nextRunAt, action }); }
        catch (error) {
          if (backend !== 'windows' || result.registered || error.code !== '0x80070005') throw error;
          backend = fallbackBackend;
          try { await persist(); } catch (persistError) { backend = 'windows'; throw persistError; }
          operate = operationForBackend();
          result = await operate({ mode: 'register', name, nextRunAt, action });
        }
      } else if ((!enabled || !earliest) && (result.registered || result.helperPid)) result = await operate({ mode: 'remove', name });
      status = { ...status, backend, sessionOnly: backend !== 'windows', inProcess: backend === 'process', registered: Boolean(result.registered), error: '', checkedAt: now().toISOString(), os: result };
      if (Boolean(result.registered) !== Boolean(enabled && earliest)) throw new Error('Windows 任务登记状态与计划不一致。');
      signature = desired;
    } catch (error) {
      signature = '';
      status = { ...status, backend, sessionOnly: backend !== 'windows', inProcess: backend === 'process', error: String(error.message || error).slice(0, 2000), checkedAt: now().toISOString() };
    }
    return snapshot();
  }
  return {
    async load() {
      if (loaded) return snapshot();
      try {
        const stored = JSON.parse(await fs.readFile(filePath, 'utf8'));
        enabled = stored.enabled === true;
        backend = stored.backend === 'process' || stored.backend === 'session' ? stored.backend : 'windows';
      }
      catch (error) { if (error.code !== 'ENOENT') throw error; }
      loaded = true;
      status = { ...status, enabled, backend, sessionOnly: backend !== 'windows', inProcess: backend === 'process' };
      return snapshot();
    },
    snapshot,
    sync(state, force = false) {
      const nextTasks = structuredClone(state.tasks || []);
      return enqueue(() => { tasks = nextTasks; return reconcile(force); });
    },
    configure(value, state) {
      const nextTasks = structuredClone(state.tasks || []);
      return enqueue(async () => {
        tasks = nextTasks;
        if (value && !available) throw new Error('后台调度需要 Windows 正式程序。');
        const previous = enabled;
        enabled = value === true;
        try { await persist(); }
        catch (error) { enabled = previous; throw error; }
        return reconcile(true);
      });
    },
    flush: () => queue,
  };
}

module.exports = { BACKGROUND_SWITCH, readLaunchOptions, backgroundAction, taskNameForProfile, quoteWindowsArgument, windowsTaskOperation, createInProcessBackground, createScheduledBackground };
