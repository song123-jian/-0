const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const net = require('node:net');
const { spawn, execFile } = require('node:child_process');
const { promisify } = require('node:util');

const execFileAsync = promisify(execFile);
const root = path.resolve(__dirname, '..');
const output = path.resolve(root, process.env.SCODEX_PERMISSION_POLICY_OUTPUT || 'release/permission-policy-final-20261024');
const executable = path.join(output, 'win-unpacked', 'Scodex工作台.exe');
const temporary = path.join(os.tmpdir(), `scodex-permission-policy-${crypto.randomUUID()}`);
const profile = path.join(temporary, 'profile');
const workspace = path.join(temporary, 'workspace');
const fakeRoot = path.join(temporary, 'scodex');
const report = { status: 'running', executable, checks: [], environment: { platform: os.platform(), release: os.release(), node: process.version } };
let child; let socket; let cdp;

const json = JSON.stringify;
const wait = async (fn, label, timeout = 30_000) => {
  const deadline = Date.now() + timeout; let last;
  while (Date.now() < deadline) { try { const value = await fn(); if (value) return value; } catch (error) { last = error; } await new Promise((resolve) => setTimeout(resolve, 100)); }
  throw new Error(`${label}${last ? `: ${last.message}` : ''}`);
};
function connect(ws) {
  let id = 0; const pending = new Map();
  ws.addEventListener('message', ({ data }) => { const message = JSON.parse(data); const item = pending.get(message.id); if (!item) return; pending.delete(message.id); clearTimeout(item.timer); message.error ? item.reject(new Error(message.error.message)) : item.resolve(message.result); });
  return { command(method, params = {}) { return new Promise((resolve, reject) => { const current = ++id; const timer = setTimeout(() => { pending.delete(current); reject(new Error(`CDP timeout ${method}`)); }, 20_000); pending.set(current, { resolve, reject, timer }); ws.send(json({ id: current, method, params })); }); }, async evaluate(expression) { const result = await this.command('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, userGesture: true }); if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text); return result.result?.value; } };
}
async function portNumber() { const server = net.createServer(); await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve)); const port = server.address().port; await new Promise((resolve) => server.close(resolve)); return port; }
async function check(name, fn) { const evidence = await fn(); report.checks.push({ name, status: 'passed', evidence }); console.log(`PASS ${name}`); }
async function click(label) { await wait(() => cdp.evaluate(`(()=>{const e=document.querySelector('[aria-label=${json(label)}]');if(!e||e.disabled)return false;e.click();return true})()`), `click ${label}`); }
async function clickText(selector, label) { await wait(() => cdp.evaluate(`(()=>{const e=[...document.querySelectorAll(${json(selector)})].find(item=>item.textContent.trim()===${json(label)});if(!e||e.disabled)return false;e.click();return true})()`), `click ${label}`); }
async function select(label, value) { await cdp.evaluate(`(()=>{const e=document.querySelector('[aria-label=${json(label)}]');if(!e)throw new Error('missing ${label}');e.value=${json(value)};e.dispatchEvent(new Event('change',{bubbles:true}));return true})()`); }

async function main() {
  try {
  await fs.mkdir(path.join(workspace, '.scodex'), { recursive: true }); await fs.mkdir(profile, { recursive: true }); await fs.mkdir(fakeRoot, { recursive: true });
  await fs.writeFile(path.join(workspace, '.scodex', 'codex-settings.json'), JSON.stringify({ sandboxMode: 'read-only', approvalPolicy: 'on-request', networkAccess: false, networkDomains: [], allowLocalBinding: false }, null, 2));
  await fs.writeFile(path.join(profile, 'settings.json'), JSON.stringify({ workspaceRoot: workspace, preferences: { browserPanelOpen: false } }));
  const port = await portNumber();
  child = spawn(executable, [`--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--disable-gpu'], { cwd: output, env: { ...process.env, SCODEX_HOME: fakeRoot }, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let diagnostics = ''; child.stderr.on('data', (chunk) => { diagnostics = (diagnostics + chunk).slice(-6000); });
  const target = await wait(async () => { if (child.exitCode !== null) throw new Error(`EXE exited ${child.exitCode}: ${diagnostics}`); return (await fetch(`http://127.0.0.1:${port}/json/list`).then((r) => r.json())).find((item) => item.type === 'page' && item.url.startsWith('file:')); }, '应用启动失败');
  socket = new WebSocket(target.webSocketDebuggerUrl); await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); }); cdp = connect(socket);
  await wait(() => cdp.evaluate('Boolean(window.scodex && document.querySelector(".task-chat-view .composer-box"))'), '工作台加载失败');
  await check('真实候选包身份、当前权限策略与 Windows 状态', async () => {
    const state = await cdp.evaluate('window.scodex.getAppState()');
    assert.equal(state.permissionPolicy.sandboxMode, 'read-only'); assert.equal(state.permissionPolicy.approvalPolicy, 'on-request');
    assert.equal(state.permissionPolicy.networkAccess, false); assert.ok(state.windowsSecurity && typeof state.windowsSecurity.isElevated === 'boolean');
    return { version: state.version, sandboxMode: state.permissionPolicy.sandboxMode, approvalPolicy: state.permissionPolicy.approvalPolicy, isElevated: state.windowsSecurity.isElevated };
  });
  await click('设置'); await wait(() => cdp.evaluate('document.querySelector(".settings-detail-heading h1")?.textContent==="常规"'), '设置打开失败'); await clickText('.settings-category', '配置');
  await wait(() => cdp.evaluate('document.querySelector(".settings-detail-heading h1")?.textContent==="配置"'), '配置页打开失败');
  await select('配置范围', 'workspace');
  await check('配置页显示沙箱、审批、网络和系统状态', async () => {
    const text = await cdp.evaluate('document.querySelector(".settings-detail").textContent');
    for (const value of ['批准策略', '沙盒设置', '工作台权限边界', '命令网络访问', '允许网络域名', 'Windows 管理员令牌', '权限审计']) assert.match(text, new RegExp(value));
    return { hasLabels: true };
  });
  await select('批准策略', 'on-request'); await select('沙盒设置', 'workspace-write');
  const networkSwitch = '[aria-label="命令网络访问"]';
  if (await cdp.evaluate(`document.querySelector(${json(networkSwitch)})?.getAttribute('aria-checked') !== 'true'`)) await click('命令网络访问');
  const domains = '[aria-label="允许网络域名"]';
  await cdp.evaluate(`(()=>{const e=document.querySelector(${json(domains)});e.focus();e.select();return true})()`); await cdp.command('Input.insertText', { text: 'api.example.com, *.trusted.test' });
  await cdp.evaluate(`document.querySelector(${json(domains)}).dispatchEvent(new Event('change',{bubbles:true}))`);
  await wait(async () => { const saved = JSON.parse(await fs.readFile(path.join(workspace, '.scodex', 'codex-settings.json'), 'utf8')); return saved.sandboxMode === 'workspace-write' && saved.networkAccess === true && saved.networkDomains.includes('api.example.com'); }, '策略保存失败');
  await check('策略编辑写入工作空间配置并保持域名白名单', async () => {
    const state = await cdp.evaluate('window.scodex.getAppState()'); const saved = JSON.parse(await fs.readFile(path.join(workspace, '.scodex', 'codex-settings.json'), 'utf8'));
    assert.equal(state.agentSettings.sandboxMode, 'workspace-write'); assert.equal(state.agentSettings.networkAccess, true); assert.deepEqual(saved.networkDomains, ['api.example.com', '*.trusted.test']);
    return { sandboxMode: saved.sandboxMode, approvalPolicy: saved.approvalPolicy, networkDomains: saved.networkDomains };
  });
  await check('刷新 Windows 权限状态接口可用', async () => { const security = await cdp.evaluate('window.scodex.refreshPermissionSecurity()'); assert.equal(typeof security.isElevated, 'boolean'); return security; });
  report.status = 'passed';
} catch (error) {
  report.status = 'failed'; report.error = error.stack; console.error(error); process.exitCode = 1;
} finally {
  if (cdp) await cdp.command('Browser.close').catch(() => {});
  if (socket) socket.close();
  if (child && child.exitCode === null) await new Promise((resolve) => { child.once('exit', resolve); setTimeout(() => { execFile('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true }, () => resolve()); }, 5000); });
  report.cleanup = child?.exitCode === null ? 'failed' : 'passed';
  await fs.mkdir(output, { recursive: true }); await fs.writeFile(path.join(output, 'permission-policy-ui-verification.json'), JSON.stringify(report, null, 2) + '\n');
  await fs.rm(temporary, { recursive: true, force: true }).catch(() => {});
  console.log(JSON.stringify(report, null, 2));
  }
}
main();
