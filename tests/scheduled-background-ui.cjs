const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const net = require('node:net');
const http = require('node:http');
const crypto = require('node:crypto');
const { spawn, execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { taskNameForProfile, backgroundAction, windowsTaskOperation } = require('../electron/scheduled-background.cjs');
const { createSessionBackground } = require('../electron/session-background.cjs');

const execFileAsync = promisify(execFile);
const root = path.resolve(__dirname, '..');
const version = '1.3.21';
const scope = process.env.SCODEX_BACKGROUND_SCOPE || 'full';
assert.ok(['full', 'registration-denied', 'session'].includes(scope), 'Unknown scheduled background verification scope');
const output = path.resolve(process.env.SCODEX_BACKGROUND_OUTPUT || path.join(root, 'release/background-scheduler-20261031/candidate-ui'));
const executable = path.resolve(process.env.SCODEX_BACKGROUND_EXE || path.join(root, 'release/background-scheduler-20261031/candidate', `Scodex-Workbench-${version}-x64.exe`));
const fixture = path.join(os.tmpdir(), 'scodex-background-ui-' + crypto.randomUUID());
const profile = path.join(fixture, 'profile');
const workspace = path.join(fixture, 'project');
const fakeHome = path.join(fixture, 'scodex');
const taskName = taskNameForProfile(profile);
const sessionOperation = createSessionBackground({ profile });
const reportPath = path.join(output, 'scheduled-background-ui-verification.json');
const json = JSON.stringify;
const sockets = new Set();
const requests = [];
const held = new Map();
const launches = [];
const report = {
  status: 'running', scope, version, executable, fixtureDirectory: fixture, taskName, checks: [], requests,
  environment: { platform: os.platform(), release: os.release(), node: process.version },
  limitations: ['Actual portable EXE, React, IPC, Windows Task Scheduler and persisted files. Model replies use a loopback HTTP fixture. CDP drives the renderer; screenshots exclude native Windows layers. Windows tasks run only for the logged-in current user.'],
};
let child;
let cdp;
let server;
let port;

async function wait(fn, label, timeout = 30000) {
  const end = Date.now() + timeout;
  let last;
  while (Date.now() < end) {
    try { const value = await fn(); if (value) return value; }
    catch (error) { last = error; }
    await new Promise(resolve => setTimeout(resolve, 150));
  }
  throw Error(label + (last ? ': ' + last.message : ''));
}

function connect(ws) {
  let id = 0;
  const pending = new Map();
  ws.addEventListener('message', ({ data }) => {
    const message = JSON.parse(data), entry = pending.get(message.id);
    if (!entry) return;
    pending.delete(message.id); clearTimeout(entry.timer);
    message.error ? entry.reject(Error(message.error.message)) : entry.resolve(message.result);
  });
  ws.addEventListener('close', () => {
    for (const entry of pending.values()) { clearTimeout(entry.timer); entry.reject(Error('CDP disconnected')); }
    pending.clear();
  });
  return {
    command(method, params = {}) {
      return new Promise((resolve, reject) => {
        const current = ++id;
        const timer = setTimeout(() => { pending.delete(current); reject(Error('CDP timeout ' + method)); }, 20000);
        pending.set(current, { resolve, reject, timer });
        ws.send(json({ id: current, method, params }));
      });
    },
    async evaluate(expression) {
      const result = await this.command('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, userGesture: true });
      if (result.exceptionDetails) throw Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
      return result.result?.value;
    },
  };
}

async function attach(url) {
  const socket = new WebSocket(url);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
  sockets.add(socket);
  return connect(socket);
}

async function freePort() {
  const socket = net.createServer();
  await new Promise(resolve => socket.listen(0, '127.0.0.1', resolve));
  const number = socket.address().port;
  await new Promise(resolve => socket.close(resolve));
  return number;
}

async function powershell(script) {
  const { stdout } = await execFileAsync('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')], {
    windowsHide: true, timeout: 20000, encoding: 'utf8', maxBuffer: 1024 * 1024,
  });
  return JSON.parse(stdout.trim());
}

async function processes(includeHelper = false) {
  const encoded = Buffer.from(profile, 'utf8').toString('base64');
  const mainPid = Number.isInteger(child?.pid) ? child.pid : 0;
  return powershell(`
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
$profilePath = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${encoded}'))
$mainPid = ${mainPid}
$helperPid = 0
$helperState = $null
if (${includeHelper ? '$true' : '$false'} -and (Test-Path -LiteralPath (Join-Path $profilePath 'scheduled-session-status.json'))) {
  $helperState = Get-Content -LiteralPath (Join-Path $profilePath 'scheduled-session-status.json') -Raw | ConvertFrom-Json
  if (!$helperState.stopped) { $helperPid = $helperState.pid }
}
Add-Type -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
public static class ScodexBackgroundWindows {
  public delegate bool Callback(IntPtr h, IntPtr p);
  [DllImport("user32.dll")] static extern bool EnumWindows(Callback cb, IntPtr p);
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h, out uint p);
  [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr h);
  [DllImport("kernel32.dll", SetLastError = true)] static extern IntPtr OpenProcess(uint access, bool inherit, uint processId);
  [DllImport("kernel32.dll", SetLastError = true)] static extern bool IsProcessInJob(IntPtr process, IntPtr job, out bool result);
  [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr handle);
  public static long[] Visible() {
    var ids = new List<long>();
    EnumWindows((h, p) => { uint id; GetWindowThreadProcessId(h, out id); if (IsWindowVisible(h)) ids.Add(id); return true; }, IntPtr.Zero);
    return ids.ToArray();
  }
  public static bool? InAnyJob(int processId, out int error) {
    IntPtr process = OpenProcess(0x1000, false, (uint)processId);
    if (process == IntPtr.Zero) { error = Marshal.GetLastWin32Error(); return null; }
    bool result;
    if (!IsProcessInJob(process, IntPtr.Zero, out result)) { error = Marshal.GetLastWin32Error(); CloseHandle(process); return null; }
    error = 0;
    CloseHandle(process);
    return result;
  }
}
'@
$visibleIds = [ScodexBackgroundWindows]::Visible()
$items = @(Get-CimInstance Win32_Process | Where-Object {
  (($_.CommandLine -and $_.CommandLine.Contains($profilePath)) -and (${includeHelper ? '$true' : '$false'} -or !$_.CommandLine.Contains('scheduled-session-helper.ps1'))) -or
  ($mainPid -gt 0 -and $_.ProcessId -eq $mainPid) -or ($helperPid -gt 0 -and $_.ProcessId -eq $helperPid)
} | ForEach-Object {
  $jobError = 0
  $inAnyJob = [ScodexBackgroundWindows]::InAnyJob([int]$_.ProcessId, [ref]$jobError)
  @{ pid = [int]$_.ProcessId; parentPid = [int]$_.ParentProcessId; name = $_.Name; commandLine = $_.CommandLine; visible = $visibleIds -contains $_.ProcessId; inAnyJob = $inAnyJob; jobQueryError = $jobError }
})
$helperEvidence = $null
if ($null -ne $helperState) { $helperEvidence = @{ pid = [int]$helperState.pid; stopped = [bool]$helperState.stopped; launchCount = [int]$helperState.launchCount; heartbeatAt = [string]$helperState.heartbeatAt; lastError = [string]$helperState.lastError } }
@{ sampledAt = [DateTimeOffset]::UtcNow.ToString('o'); requestedHelperPid = $helperPid; helperState = $helperEvidence; items = $items } | ConvertTo-Json -Depth 5 -Compress
`);
}

async function readTask() { return scope === 'session' ? sessionOperation({ mode: 'read', name: taskName }) : windowsTaskOperation({ mode: 'read', name: taskName }); }
async function library() { return JSON.parse(await fs.readFile(path.join(profile, 'scheduled-tasks.json'), 'utf8')); }
async function state() { return cdp.evaluate('window.scodex.listScheduledTasks()'); }

async function launch() {
  port = await freePort();
  child = spawn(executable, ['--remote-debugging-port=' + port, '--user-data-dir=' + profile, '--scodex-home=' + fakeHome, '--disable-gpu'], {
    cwd: output, windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'],
    env: { ...process.env, SCODEX_HOME: fakeHome, SCODEX_REFERENCE_HOME: path.join(fixture, 'reference'), SCODEX_REFERENCE_AGENTS_HOME: path.join(fixture, 'agents') },
  });
  launches.push(child);
  let stderr = '';
  child.stderr.on('data', value => { stderr = (stderr + value).slice(-5000); });
  const target = await wait(async () => {
    if (child.exitCode !== null) throw Error('EXE exited ' + child.exitCode + ': ' + stderr);
    const targets = await fetch('http://127.0.0.1:' + port + '/json/list').then(response => response.json());
    return targets.find(item => item.type === 'page' && item.url.startsWith('file:') && !item.url.includes('workspaceWindow='));
  }, 'Actual EXE startup', 60000);
  cdp = await attach(target.webSocketDebuggerUrl);
  await wait(() => cdp.evaluate('Boolean(window.scodex && document.querySelector("button[aria-label=定时任务]"))'), 'Main renderer');
  const current = await cdp.evaluate('window.scodex.getAppState()');
  assert.equal(current.version, version);
  assert.equal(path.resolve(current.userDataPath), path.resolve(profile));
  report.runtime = { appVersion: current.version, userDataPath: current.userDataPath, workspaceRoot: current.workspaceRoot, pageUrl: target.url, spawnedPid: child.pid };
  return current;
}

async function click(selector) {
  await wait(() => cdp.evaluate(`(()=>{const e=document.querySelector(${json(selector)});if(!e||e.disabled)return false;e.click();return true})()`), 'Button ' + selector);
}

async function textClick(selector, text) {
  await wait(() => cdp.evaluate(`(()=>{const e=[...document.querySelectorAll(${json(selector)})].find(e=>e.textContent.trim()===${json(text)});if(!e||e.disabled)return false;e.click();return true})()`), 'Button ' + text);
}

async function tasksPage() {
  await click('button[aria-label="定时任务"]');
  await wait(() => cdp.evaluate('Boolean(document.querySelector(".scheduled-background-toggle"))'), 'Tasks page');
}

async function refresh() {
  await click('button[aria-label="刷新任务"]');
  await wait(() => cdp.evaluate('document.querySelector(".scheduled-runtime-note")?.getAttribute("aria-busy")==="false"'), 'Background refresh');
  return state();
}

async function setField(label, value) {
  await cdp.evaluate(`(()=>{const field=[...document.querySelectorAll('.task-editor label.task-field')].find(e=>e.querySelector('span')?.textContent===${json(label)});const e=field?.querySelector('input,textarea,select');if(!e)throw Error('Missing field '+${json(label)});const p=e.tagName==='SELECT'?HTMLSelectElement.prototype:e.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(p,'value').set.call(e,${json(value)});e.dispatchEvent(new Event(e.tagName==='SELECT'?'change':'input',{bubbles:true}));return true})()`);
}

async function createTask(name, marker, offsetMinutes = 0) {
  // Product UI exposes minute precision; keep sufficient time for registration and portable startup.
  const due = new Date(Math.ceil((Date.now() + (scope === 'session' ? 35000 : 70000)) / 60000) * 60000 + offsetMinutes * 60000);
  await click('.scheduled-new-button');
  await wait(() => cdp.evaluate('Boolean(document.querySelector(".task-editor"))'), 'Task editor');
  await setField('任务说明', marker + ' 整理隔离项目状态。');
  await setField('任务名称', name);
  await setField('所属项目', 'background-project');
  await setField('重复', 'once');
  await setField('日期', due.toISOString().slice(0, 10));
  await setField('时间', due.toISOString().slice(11, 16));
  await setField('时区', 'UTC');
  await click('.task-editor-actions .primary-button');
  await wait(() => cdp.evaluate('!document.querySelector(".task-editor")'), 'Task creation');
  const task = await wait(async () => (await state()).tasks.find(item => item.name === name), 'Created task');
  assert.equal(task.nextRunAt, due.toISOString());
  await wait(() => cdp.evaluate(`(()=>{const e=[...document.querySelectorAll('.scheduled-task-item')].find(item=>item.querySelector('strong')?.textContent===${json(name)});if(!e)return false;e.click();return true})()`), 'Select created task');
  await wait(() => cdp.evaluate(`document.querySelector('.scheduled-detail-heading h2')?.textContent===${json(name)}`), 'Selected created task');
  return task;
}

async function quit({ onMainExit } = {}) {
  if (!child || child.exitCode !== null) return;
  await cdp.evaluate('window.scodex.quitApp()');
  await wait(() => child.exitCode !== null, 'EXE graceful exit', 20000);
  assert.equal(child.exitCode, 0);
  if (onMainExit) await onMainExit(await processes(true));
  for (const socket of sockets) socket.close();
  sockets.clear(); cdp = null;
  await wait(async () => !(await processes()).items.length, 'Isolated profile has fully exited', 15000);
}

async function check(name, fn) {
  const evidence = await fn();
  report.checks.push({ name, status: 'passed', sha256: report.executableSha256, evidence });
  await fs.writeFile(reportPath, json(report, null, 2));
  console.log('PASS ' + name);
}

function reply(response, marker) {
  if (response.destroyed) return;
  response.writeHead(200, { 'content-type': 'text/event-stream' });
  response.end('data: ' + json({ choices: [{ delta: { content: marker + '：隔离项目状态已整理。' } }] }) + '\n\ndata: [DONE]\n\n');
}

async function waitForRun(task, expected, timeout = 180000) {
  return wait(async () => {
    const current = await library(), entries = current.runs.filter(run => run.taskId === task.id);
    if (!entries.some(run => run.status === expected)) return false;
    assert.equal(entries.length, 1, 'One scheduled occurrence must persist exactly one run');
    return entries[0];
  }, task.name + ' persisted ' + expected, timeout);
}

async function backgroundRun(task, marker, expected = 'succeeded') {
  const initialSchedule = await readTask();
  if (scope === 'session') {
    const beforeMainExit = await processes(true);
    const helper = beforeMainExit.items.find(item => item.pid === initialSchedule.helperPid);
    assert.ok(helper, 'Session helper must be present immediately before main-process exit');
    report.lifecycleDiagnostic = {
      mainPid: report.runtime.spawnedPid,
      helperPid: initialSchedule.helperPid,
      helperParentPid: helper.parentPid,
      helperDirectChild: helper.parentPid === report.runtime.spawnedPid,
      helperInAnyJob: helper.inAnyJob,
      mainInAnyJob: beforeMainExit.items.find(item => item.pid === report.runtime.spawnedPid)?.inAnyJob ?? null,
      jobMembershipMeaning: 'IsProcessInJob reports membership in any Job Object; it does not identify a specific Job Object or its limit flags.',
      beforeMainExit,
    };
    await quit({ onMainExit: async afterMainExit => {
      report.lifecycleDiagnostic.mainExitCode = child.exitCode;
      report.lifecycleDiagnostic.mainExitedAt = new Date().toISOString();
      report.lifecycleDiagnostic.afterMainExit = afterMainExit;
    } });
  } else await quit();
  const atExit = new Date().toISOString();
  if (expected === 'succeeded') {
    await wait(() => held.get(marker), 'OS trigger reaches model ' + marker, 180000);
    const running = await processes(true);
    assert.ok(running.items.some(item => item.commandLine.includes('--scodex-background')), 'Windows must launch the background EXE');
    assert.ok(running.items.every(item => !item.visible), 'Background execution must have no visible window');
    report.lastBackgroundProcesses = running;
    reply(held.get(marker), marker); held.delete(marker);
  }
  const run = await waitForRun(task, expected);
  await wait(async () => !(await processes()).items.length, 'OS-launched background process exited', 30000);
  const osState = await readTask();
  assert.equal(osState.registered, false, 'Completed one-off task must unregister');
  return { atExit, nextRunAt: task.nextRunAt, run, initialSchedule, osState, fullyExited: true, ...(expected === 'succeeded' ? { visibleWindow: false } : {}) };
}

async function setup() {
  await fs.mkdir(output, { recursive: true });
  for (const directory of [profile, workspace, fakeHome]) await fs.mkdir(directory, { recursive: true });
  const now = new Date().toISOString();
  await fs.writeFile(path.join(profile, 'settings.json'), json({
    workspaceRoot: workspace, activeProjectId: 'background-project',
    projects: [{ id: 'background-project', name: '后台调度隔离项目', path: workspace, createdAt: now, updatedAt: now }],
    preferences: { trayEnabled: false, browserPanelOpen: false, closeConfirmation: 'never', fontFamily: 'Microsoft YaHei', fontSize: 16 },
  }));
  await fs.writeFile(path.join(fakeHome, 'codex-settings.json'), json({ sandboxMode: 'danger-full-access', approvalPolicy: 'on-request', workspaceDependencies: false, availableReasoningEfforts: ['low'], defaultReasoningEffort: 'low' }));
  server = http.createServer(async (request, response) => {
    try {
      let body = ''; for await (const chunk of request) body += chunk;
      const payload = JSON.parse(body), text = json(payload.messages), marker = ['OS-CLOSED', 'OS-EXISTING', 'OS-DENIED'].find(value => text.includes(value)) || 'UNKNOWN';
      requests.push({ marker, at: new Date().toISOString(), path: request.url });
      if (marker === 'OS-CLOSED') held.set(marker, response);
      else reply(response, marker);
    } catch (error) { response.writeHead(500); response.end(error.message); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  report.endpoint = 'http://127.0.0.1:' + server.address().port + '/v1';
  report.executableSha256 = crypto.createHash('sha256').update(await fs.readFile(executable)).digest('hex');
}

async function verifyRegistrationDenied() {
  report.uncovered = ['Successful Windows task registration', 'OS wake after the EXE fully exits', 'Windowless background execution', 'Existing instance handoff', 'Removal of a registered OS task'];
  let task;
  await check('real-registration-denied-is-readable-and-has-no-command', async () => {
    assert.equal((await state()).background.enabled, false);
    assert.equal((await readTask()).registered, false);
    task = await createTask('后台权限错误检查', 'DENIED-REGISTRATION', 10);
    await click('[aria-label="退出后继续执行"]');
    const current = await wait(async () => { const value = await state(); return value.background.enabled && value.background.error && value; }, 'Windows registration error');
    assert.equal(current.background.registered, false);
    assert.match(current.background.error, /Windows 拒绝登记计划任务.*权限不足.*0x80070005/);
    const alert = await wait(() => cdp.evaluate('document.querySelector(".scheduled-runtime-note [role=alert]")?.textContent'), 'Readable error in renderer');
    assert.equal(alert, current.background.error);
    assert.doesNotMatch(await cdp.evaluate('document.body.innerText'), /EncodedCommand|Command failed|#< CLIXML/);
    assert.equal((await readTask()).registered, false);
    return { error: current.background.error, registered: false, alert, modelRequests: requests.length };
  });
  await check('denied-preference-and-reason-survive-restart', async () => {
    await quit(); await launch(); await tasksPage();
    const current = await state();
    assert.equal(current.background.enabled, true);
    assert.equal(current.background.registered, false);
    assert.match(current.background.error, /0x80070005/);
    assert.ok(current.tasks.some(item => item.id === task.id), 'Task must survive restart');
    assert.equal(await cdp.evaluate('document.querySelector("[aria-label=退出后继续执行]").checked'), true);
    const saved = JSON.parse(await fs.readFile(path.join(profile, 'scheduled-background.json'), 'utf8'));
    assert.equal(saved.enabled, true);
    return { saved, error: current.background.error, tasksPersisted: current.tasks.some(item => item.id === task.id) };
  });
  await check('readable-error-layout-at-supported-viewports', async () => {
    const measurements = [];
    for (const size of [{ width: 1064, height: 660 }, { width: 1440, height: 900 }]) {
      await cdp.command('Emulation.setDeviceMetricsOverride', { ...size, deviceScaleFactor: 1, mobile: false });
      await cdp.evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
      await cdp.evaluate('document.querySelector(".scheduled-runtime-note").scrollIntoView({block:"nearest"})');
      const measured = await cdp.evaluate('(()=>{const e=document.querySelector(".scheduled-runtime-note"),r=e.getBoundingClientRect(),c=e.querySelector("input").getBoundingClientRect(),s=getComputedStyle(e),p=e.querySelector("[role=alert]");return{width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,left:r.left,right:r.right,control:[c.left,c.top,c.right,c.bottom],error:p.textContent,errorFits:p.scrollHeight<=p.clientHeight,font:s.fontFamily}})()');
      assert.ok(measured.scrollWidth <= size.width && measured.left >= 0 && measured.right <= size.width);
      assert.ok(measured.control[0] >= 0 && measured.control[2] <= size.width && measured.control[1] >= 0 && measured.control[3] <= size.height);
      assert.equal(measured.errorFits, true);
      assert.match(measured.font, /Microsoft YaHei/);
      measurements.push(measured);
    }
    const screenshot = path.join(output, 'scheduled-background-denied.png');
    const capture = await cdp.command('Page.captureScreenshot', { format: 'png' });
    await fs.writeFile(screenshot, Buffer.from(capture.data, 'base64'));
    return { measurements, screenshot };
  });
  await check('disable-clears-registration-failure-and-persists-without-os-task', async () => {
    await click('[aria-label="退出后继续执行"]');
    await wait(async () => { const value = await state(); return !value.background.enabled && !value.background.error; }, 'Registration disabled and error cleared');
    assert.equal((await readTask()).registered, false);
    await textClick('.scheduled-detail-actions button', '暂停');
    await wait(async () => (await state()).tasks.find(item => item.id === task.id)?.enabled === false, 'Paused task persisted');
    await cdp.command('Page.enable');
    const deletion = click('[aria-label="删除任务"]');
    await wait(async () => { try { await cdp.command('Page.handleJavaScriptDialog', { accept: true }); return true; } catch { return false; } }, 'Delete task confirmation');
    await deletion;
    await wait(async () => !(await state()).tasks.some(item => item.id === task.id), 'Task deleted');
    await quit(); await launch(); await tasksPage();
    const current = await state();
    assert.equal(current.background.enabled, false);
    assert.equal(current.background.error, '');
    assert.equal(current.tasks.length, 0);
    assert.equal((await readTask()).registered, false);
    assert.equal(requests.length, 0);
    return { disabled: true, errorCleared: true, pauseAndDeletePersisted: true, noModelRequests: true, registered: false };
  });
}

(async () => {
  try {
    await setup();
    await launch();
    await cdp.evaluate(`window.scodex.saveModelConnection(${json({ name: '后台调度隔离模型', baseUrl: report.endpoint, model: 'fixture-background', models: ['fixture-background'], apiKey: 'isolated-only' })})`);
    await tasksPage();
    if (scope === 'registration-denied') await verifyRegistrationDenied();
    else {
    if (scope === 'session') report.limitations.push('Session helper is a real hidden PowerShell process. It lasts only for the current logged-in session; reopening the app is required after reboot. Native Windows registration success remains uncovered.');
    let closedTask;
    await check('default-off-ui-create-enable-and-real-os-action', async () => {
      const initial = await state();
      assert.equal(initial.background.available, true); assert.equal(initial.background.enabled, false);
      assert.equal((await readTask()).registered, false);
      closedTask = await createTask('退出后真实执行', 'OS-CLOSED');
      assert.equal((await readTask()).registered, false);
      await click('[aria-label="退出后继续执行"]');
      const enabled = await wait(async () => { const value = await state(); return value.background.enabled && value.background.registered && value; }, 'Windows task registered');
      const action = backgroundAction(executable, profile, fakeHome), actual = await readTask();
      assert.equal(actual.executable, action.executable); assert.equal(actual.arguments, action.arguments);
      assert.equal(Date.parse(actual.nextRunAt), Date.parse(closedTask.nextRunAt));
      assert.equal(enabled.background.error, '');
      if (scope === 'session') {
        assert.equal(enabled.background.backend, 'session'); assert.equal(enabled.background.sessionOnly, true);
        assert.equal((await windowsTaskOperation({ mode: 'read', name: taskName })).registered, false);
        assert.match(await cdp.evaluate('document.querySelector(".scheduled-runtime-note").innerText'), /后台助手已启动.*当前登录期间有效[\s\S]*重启电脑后/s);
        const running = await processes(true);
        assert.ok(running.items.some(item => item.pid === actual.helperPid && !item.visible), 'Session helper must be hidden');
      }
      return { initialEnabled: false, task: closedTask, action: actual, enabledFromReact: true };
    });
    await check('windows-wakes-completely-closed-portable-without-window', async () => {
      const evidence = await backgroundRun(closedTask, 'OS-CLOSED');
      assert.match(evidence.run.output, /OS-CLOSED/);
      assert.equal(requests.filter(item => item.marker === 'OS-CLOSED').length, 1);
      return { ...evidence, processes: report.lastBackgroundProcesses, requests: 1 };
    });
    await launch(); await tasksPage();
    await check('restart-persistence-and-collapsed-run-result', async () => {
      const current = await refresh();
      assert.equal(current.background.enabled, true); assert.equal(current.background.registered, false);
      assert.equal(await cdp.evaluate('document.querySelector("[aria-label=退出后继续执行]").checked'), true);
      const row = await cdp.evaluate('(()=>{const e=document.querySelector(".task-run-row");return{open:e.open,status:e.className,text:e.innerText,output:e.querySelector(".task-run-output").textContent}})()');
      assert.equal(row.open, false); assert.match(row.status, /succeeded/); assert.match(row.output, /OS-CLOSED/);
      await click('.task-run-row summary');
      assert.equal(await cdp.evaluate('document.querySelector(".task-run-row").open'), true);
      await click('.task-run-row summary');
      return { preferencePersisted: true, runPersisted: true, collapsedByDefault: true, expansionWorks: true };
    });
    await check('existing-instance-os-transfer-no-duplicate', async () => {
      const task = await createTask('已运行实例转交', 'OS-EXISTING');
      const beforePid = child.pid;
      const browser = await attach((await fetch('http://127.0.0.1:' + port + '/json/version').then(response => response.json())).webSocketDebuggerUrl);
      const browserBefore = (await browser.command('SystemInfo.getProcessInfo')).processInfo.find(item => item.type === 'browser').id;
      const osBefore = await readTask(); assert.equal(osBefore.registered, true);
      const run = await waitForRun(task, 'succeeded');
      await wait(async () => !(await readTask()).registered, 'Consumed task removed');
      let helperEvidence;
      if (scope === 'session') {
        helperEvidence = await wait(async () => { const value = await readTask(); return value.launchCount >= 1 && value; }, 'Helper must actually wake existing instance');
        assert.equal(helperEvidence.launchCount, 1);
      }
      const browserAfter = (await browser.command('SystemInfo.getProcessInfo')).processInfo.find(item => item.type === 'browser').id;
      assert.equal(browserAfter, browserBefore); assert.equal(child.pid, beforePid); assert.equal(child.exitCode, null);
      assert.equal(requests.filter(item => item.marker === 'OS-EXISTING').length, 1);
      const pages = await fetch('http://127.0.0.1:' + port + '/json/list').then(response => response.json());
      assert.equal(pages.filter(item => item.type === 'page' && item.url.startsWith('file:')).length, 1);
      await refresh();
      return { task, run, browserBefore, browserAfter, primaryPortablePid: beforePid, requests: 1, windows: 1, osBefore, helperEvidence };
    });
    await check('background-approval-required-is-traceable-failure', async () => {
      await cdp.evaluate('window.scodex.saveAgentSettings({sandboxMode:"danger-full-access",approvalPolicy:"on-request",networkAccess:false,allowLocalBinding:false,workspaceDependencies:false})');
      const task = await createTask('后台权限拒绝', 'OS-DENIED');
      const evidence = await backgroundRun(task, 'OS-DENIED', 'failed');
      assert.match(evidence.run.output, /后台|审批|权限|网络/);
      assert.equal(requests.filter(item => item.marker === 'OS-DENIED').length, 0);
      await launch(); await tasksPage(); await refresh();
      await wait(() => cdp.evaluate('Boolean(document.querySelector(".task-run-row.failed"))'), 'Failure record rendered');
      assert.equal(await cdp.evaluate('document.querySelector(".task-run-row.failed").open'), false);
      await click('.task-run-row.failed summary');
      assert.match(await cdp.evaluate('document.querySelector(".task-run-row.failed .task-run-output").textContent'), /后台|审批|权限|网络/);
      return { ...evidence, modelRequests: 0, failureVisibleInUI: true };
    });
    await check('pause-disable-delete-remove-only-profile-os-task', async () => {
      const task = await createTask('停用清理检查', 'CLEANUP', 10);
      assert.equal((await readTask()).registered, true);
      await textClick('.scheduled-detail-actions button', '暂停');
      await wait(async () => !(await readTask()).registered, 'Pause removed OS task');
      assert.equal((await state()).tasks.find(item => item.id === task.id).enabled, false);
      await textClick('.scheduled-detail-actions button', '启用');
      await wait(async () => (await readTask()).registered, 'Re-enable registered OS task');
      await click('[aria-label="退出后继续执行"]');
      await wait(async () => !(await readTask()).registered, 'Background disabled removed OS task');
      assert.equal((await state()).background.enabled, false);
      await click('[aria-label="退出后继续执行"]');
      await wait(async () => (await readTask()).registered, 'Background enabled registered OS task');
      await cdp.command('Page.enable');
      const deletion = click('[aria-label="删除任务"]');
      await wait(async () => { try { await cdp.command('Page.handleJavaScriptDialog', { accept: true }); return true; } catch { return false; } }, 'Delete task confirmation');
      await deletion;
      await wait(async () => !(await state()).tasks.some(item => item.id === task.id), 'Task deleted');
      assert.equal((await readTask()).registered, false);
      return { taskId: task.id, pause: true, resume: true, backgroundDisable: true, backgroundEnable: true, delete: true, osTaskRemoved: true };
    });
    await check('supported-layouts-and-final-renderer', async () => {
      const measurements = [];
      for (const size of [{ width: 1064, height: 660 }, { width: 1440, height: 900 }]) {
        await cdp.command('Emulation.setDeviceMetricsOverride', { ...size, deviceScaleFactor: 1, mobile: false });
        await cdp.evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
        await cdp.evaluate('document.querySelector(".scheduled-runtime-note").scrollIntoView({block:"nearest"})');
        const result = await cdp.evaluate('(()=>{const e=document.querySelector(".scheduled-runtime-note"),r=e.getBoundingClientRect(),s=getComputedStyle(e);const c=document.querySelector("[aria-label=退出后继续执行]").getBoundingClientRect();return{width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,left:r.left,right:r.right,top:r.top,bottom:r.bottom,control:[c.left,c.top,c.right,c.bottom],font:s.fontFamily,size:s.fontSize}})()');
        assert.ok(result.scrollWidth <= size.width); assert.ok(result.left >= 0 && result.right <= size.width);
        assert.ok(result.control[0] >= 0 && result.control[2] <= size.width && result.control[1] >= 0 && result.control[3] <= size.height);
        assert.match(result.font, /Microsoft YaHei/); measurements.push(result);
      }
      const screenshot = path.join(output, 'scheduled-background.png');
      const capture = await cdp.command('Page.captureScreenshot', { format: 'png' });
      await fs.writeFile(screenshot, Buffer.from(capture.data, 'base64'));
      await click('[aria-label="退出后继续执行"]');
      await wait(async () => !(await state()).background.enabled, 'Final background disabled');
      await quit(); await launch(); await tasksPage();
      assert.equal((await state()).background.enabled, false); assert.equal((await readTask()).registered, false);
      return { measurements, screenshot, disabledPreferenceSurvivedRestart: true };
    });
    }
    report.status = 'passed';
  } catch (error) {
    report.status = 'failed'; report.error = error.stack; process.exitCode = 1;
    console.error(error.stack);
    if (cdp) try { report.failureUI = await cdp.evaluate('({body:document.body.innerText.slice(-6000),dialogs:document.querySelectorAll(".task-editor").length})'); } catch {}
  } finally {
    for (const [marker, response] of held) reply(response, marker);
    held.clear();
    try {
      if (cdp && child?.exitCode === null) {
        await cdp.evaluate('window.scodex.setScheduledBackground(false)');
        await quit();
      }
      const actual = await readTask();
      if (actual.registered || (scope === 'session' && actual.helperPid)) await (scope === 'session' ? sessionOperation({ mode: 'remove', name: taskName }) : windowsTaskOperation({ mode: 'remove', name: taskName }));
      assert.equal((await readTask()).registered, false);
      const remaining = await processes(true);
      assert.equal(remaining.items.length, 0, 'Owned profile process still running');
      report.cleanup = { taskRemoved: true, remainingProcesses: [], fixtureRetained: fixture };
    } catch (error) { report.cleanupError = error.stack; process.exitCode = 1; }
    for (const socket of sockets) socket.close();
    if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
    report.launches = launches.map(item => ({ pid: item.pid, exitCode: item.exitCode }));
    report.finishedAt = new Date().toISOString();
    await fs.writeFile(reportPath, json(report, null, 2));
    console.log(json({ status: report.status, checks: report.checks.length, fixtureDirectory: fixture, report: reportPath }));
  }
})();
