const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const net = require('node:net');
const { spawn, execFile } = require('node:child_process');
const { promisify } = require('node:util');

const root = path.resolve(__dirname, '..');
const version = '1.3.34';
const output = path.resolve(process.env.SCODEX_LEARNING_MEMORY_OUTPUT || path.join(root, 'release', 'delivery-1.3.34-learning-memory'));
const executable = process.env.SCODEX_LEARNING_MEMORY_EXE || path.join(root, 'release', 'win-unpacked', 'Scodex工作台.exe');
const fixture = path.join(output, 'fixture-' + crypto.randomUUID());
const profile = path.join(fixture, 'profile');
const isolatedHome = path.join(fixture, 'codex');
const workspace = path.join(fixture, 'workspace');
const referenceHome = path.join(fixture, 'reference');
const agentsHome = path.join(fixture, 'agents');
const text = '测试偏好：用简洁中文回答，并遵循项目 AGENTS.md。';
const reportPath = path.join(output, 'learning-memory-ui.json');
const electronLogPath = path.join(output, 'electron-startup.log');
const sockets = new Set();
const execFileAsync = promisify(execFile);
let child;
let cdp;
let debugPort;
const report = { status: 'running', version, executable, checks: [], launchDiagnostics: [], limitations: ['真实 GitHub 网络同步由回环 API fixture 覆盖；本验收使用隔离 profile 且不写入用户真实记忆或仓库。'] };

const wait = async (fn, label, timeout = 30000) => {
  const deadline = Date.now() + timeout;
  let last;
  while (Date.now() < deadline) {
    try { const value = await fn(); if (value) return value; } catch (error) { last = error; }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw Error(label + (last ? ': ' + last.message : ''));
};

async function processWindowMetadata(pid) {
  try {
    const script = `$ErrorActionPreference='Stop'; $p=Get-Process -Id ${Number(pid)} -ErrorAction Stop; [pscustomobject]@{Id=$p.Id;ProcessName=$p.ProcessName;MainWindowHandle=$p.MainWindowHandle.ToString();MainWindowTitle=$p.MainWindowTitle;Responding=$p.Responding;Path=$p.Path}|ConvertTo-Json -Compress`;
    const { stdout } = await execFileAsync('powershell.exe', ['-NoLogo', '-NoProfile', '-Command', script], { timeout: 5000 });
    return JSON.parse(stdout);
  } catch (error) { return { error: error.message, stdout: error.stdout || '' }; }
}

function connect(socket) {
  let id = 0;
  const pending = new Map();
  socket.addEventListener('message', ({ data }) => {
    const message = JSON.parse(data), item = pending.get(message.id);
    if (!item) return;
    pending.delete(message.id); clearTimeout(item.timer);
    message.error ? item.reject(Error(message.error.message)) : item.resolve(message.result);
  });
  return {
    command(method, params = {}) {
      return new Promise((resolve, reject) => {
        const current = ++id, timer = setTimeout(() => { pending.delete(current); reject(Error('CDP timeout ' + method)); }, 30000);
        pending.set(current, { resolve, reject, timer }); socket.send(JSON.stringify({ id: current, method, params }));
      });
    },
    async evaluate(expression) {
      const result = await this.command('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, userGesture: true });
      if (result.exceptionDetails) throw Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
      return result.result?.value;
    },
  };
}

async function port() {
  const server = net.createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const value = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return value;
}

async function launch() {
  debugPort = await port();
  child = spawn(executable, ['--remote-debugging-address=127.0.0.1', '--remote-debugging-port=' + debugPort, '--remote-allow-origins=*', '--enable-logging=stderr', '--log-file=' + electronLogPath, '--user-data-dir=' + profile, '--disable-gpu'], {
    cwd: output,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, SCODEX_HOME: isolatedHome, SCODEX_REFERENCE_HOME: referenceHome, SCODEX_REFERENCE_AGENTS_HOME: agentsHome },
  });
  let stdout = '', stderr = '', endpointError = '';
  child.stdout.on('data', chunk => { stdout = (stdout + chunk).slice(-4000); });
  child.stderr.on('data', chunk => { stderr = (stderr + chunk).slice(-4000); });
  let target;
  try {
    target = await wait(async () => {
      if (child.exitCode !== null || child.signalCode !== null) throw Error('EXE exit ' + child.exitCode + ' signal ' + child.signalCode + ' ' + stderr);
      try {
        const response = await fetch('http://127.0.0.1:' + debugPort + '/json/list');
        if (!response.ok) { endpointError = 'HTTP ' + response.status; return false; }
        const items = await response.json();
        return items.find(item => item.type === 'page' && item.url.startsWith('file:') && !item.url.includes('workspaceWindow='));
      } catch (error) { endpointError = error.message; return false; }
    }, 'Packaged app startup', 45000);
  } catch (error) {
    report.launchDiagnostics.push({ pid: child.pid, debugAddress: '127.0.0.1', debugPort, exitCode: child.exitCode, signalCode: child.signalCode, endpointError, stdout, stderr, process: await processWindowMetadata(child.pid), electronLog: await fs.readFile(electronLogPath, 'utf8').catch(() => '') });
    throw Error(error.message + '; pid=' + child.pid + '; stdout=' + stdout + '; stderr=' + stderr);
  }
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
  sockets.add(socket); cdp = connect(socket);
  await wait(() => cdp.evaluate('Boolean(window.scodex && document.querySelector("button[aria-label=设置]"))'), 'Packaged renderer ready');
  const state = await cdp.evaluate('window.scodex.getAppState()');
  assert.equal(state.version, version);
  assert.equal(path.resolve(state.userDataPath).toLowerCase(), path.resolve(profile).toLowerCase());
  return state;
}

async function click(selector) {
  await wait(() => cdp.evaluate('(()=>{const el=document.querySelector(' + JSON.stringify(selector) + ');if(!el||el.disabled)return false;el.scrollIntoView({block:"center"});el.click();return true})()'), 'Click ' + selector);
}

async function openLearningPanel() {
  await click('[aria-label="设置"]');
  await wait(() => cdp.evaluate('Boolean(document.querySelector(".settings-category"))'), 'Settings panel');
  await cdp.evaluate('(()=>{const el=[...document.querySelectorAll(".settings-category")].find(item=>item.textContent.trim()==="学习成长");if(!el)throw Error("Learning category missing");el.click()})()');
  await wait(() => cdp.evaluate('document.querySelector(".settings-detail-heading h1")?.textContent==="学习成长"'), 'Learning memory category');
}

async function closeApp() {
  await cdp.evaluate('window.scodex.quitApp()');
  await wait(() => child.exitCode !== null, 'App exit after learning-memory sync', 45000);
  assert.equal(child.exitCode, 0);
  for (const socket of sockets) socket.close();
  sockets.clear();
  cdp = null; child = null;
}

async function main() {
  await fs.mkdir(output, { recursive: true });
  for (const directory of [profile, isolatedHome, workspace, referenceHome, agentsHome]) await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(path.join(profile, 'settings.json'), JSON.stringify({ projects: [], activeProjectId: '', workspaceRoot: workspace, preferences: { fontFamily: 'Microsoft YaHei', fontSize: 16, closeConfirmation: 'never' } }));
  await fs.writeFile(path.join(isolatedHome, 'codex-settings.json'), JSON.stringify({ sandboxMode: 'danger-full-access', approvalPolicy: 'never', networkAccess: true, networkDomains: ['*'], allowLocalBinding: true, workspaceDependencies: false, availableReasoningEfforts: ['low'], defaultReasoningEffort: 'low' }));
  report.executableSha256 = crypto.createHash('sha256').update(await fs.readFile(executable)).digest('hex');
  const firstState = await launch();
  assert.equal(firstState.learningMemory.entries.length, 0);
  await openLearningPanel();
  const area = '[aria-label="学习记忆内容"]';
  await cdp.evaluate('(()=>{const el=document.querySelector(' + JSON.stringify(area) + ');el.focus();})()');
  await cdp.command('Input.insertText', { text });
  await wait(() => cdp.evaluate('document.querySelector(' + JSON.stringify(area) + ')?.value===' + JSON.stringify(text)), 'Memory text entry');
  await click('.learning-memory-actions .primary-button');
  const saved = await wait(async () => {
    const state = await cdp.evaluate('window.scodex.getAppState()');
    return state.learningMemory.entries.some(entry => entry.text === text) ? state.learningMemory : false;
  }, 'Memory saved through actual settings UI');
  assert.equal(await cdp.evaluate('document.querySelector(".learning-memory-item p")?.textContent'), text);
  const diskPath = path.join(profile, 'learning-memory.json');
  const encrypted = await fs.readFile(diskPath, 'utf8');
  const wrapper = JSON.parse(encrypted);
  assert.equal(wrapper.version, 1);
  assert.equal(typeof wrapper.encrypted, 'string');
  assert.ok(!encrypted.includes(text));
  report.checks.push({ name: 'actual-settings-add-and-encrypted-local-save', status: 'passed', evidence: { entries: saved.entries.length, syncStatusBeforeExit: saved.sync.status, plaintextOnDisk: false, encryptedBytes: Buffer.from(wrapper.encrypted, 'base64').length } });

  await closeApp();
  const afterClose = JSON.parse(await fs.readFile(diskPath, 'utf8'));
  assert.ok(!JSON.stringify(afterClose).includes(text));
  const secondState = await launch();
  assert.ok(secondState.learningMemory.entries.some(entry => entry.text === text));
  assert.equal(secondState.learningMemory.sync.status, 'failed', 'No credential in the isolated profile should fail sync without discarding local memory');
  await openLearningPanel();
  assert.equal(await cdp.evaluate('document.querySelector(".learning-memory-item p")?.textContent'), text);
  report.checks.push({ name: 'quit-sync-failure-retains-memory-across-restart', status: 'passed', evidence: { reopenedEntries: secondState.learningMemory.entries.length, syncStatus: secondState.learningMemory.sync.status, uiShowsSavedEntry: true, isolatedGitHubCredentialPresent: await fs.access(path.join(profile, 'github-connection.json')).then(() => true, () => false) } });
  await closeApp();
  report.status = 'passed';
}

main().catch(error => { report.status = 'failed'; report.error = error.stack; console.error(error.stack); process.exitCode = 1; }).finally(async () => {
  try {
    if (child?.exitCode === null && child?.signalCode === null && cdp) await cdp.evaluate('window.scodex.quitApp()').catch(() => {});
    if (child?.exitCode === null && child?.signalCode === null) {
      child.kill();
      await wait(() => child.exitCode !== null || child.signalCode !== null, 'App cleanup', 10000);
    }
  } catch (error) { report.cleanupError = error.message; process.exitCode = 1; }
  for (const socket of sockets) socket.close();
  await fs.mkdir(output, { recursive: true });
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2) + '\n');
  if (report.status === 'passed' && !report.cleanupError) await fs.rm(fixture, { recursive: true, force: true });
  report.exitCode = child?.exitCode;
  report.signalCode = child?.signalCode;
  console.log(JSON.stringify({ status: report.status, checks: report.checks.length, version, report: reportPath }));
});
