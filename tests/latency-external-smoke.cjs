// Explicit opt-in only. One short generation against the user's configured
// endpoint; no history, workspace files or copied plaintext credentials.
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { connect, wait, freePort } = require('./agent-workflow-ui.cjs');
if (process.env.SCODEX_EXTERNAL_LATENCY !== '1') { console.log('Skipped: SCODEX_EXTERNAL_LATENCY=1 is required.'); process.exit(0); }
const root = path.resolve(__dirname, '..'), output = path.join(root, 'release/delivery-1.3.36/external');
const fixture = path.join(output, 'fixture-' + crypto.randomUUID()), profile = path.join(fixture, 'profile'), home = path.join(fixture, 'home');
const source = path.join(process.env.APPDATA, 'scodex-workbench/model-connection.json');
const copied = path.join(profile, 'model-connection.json');
const executable = process.env.SCODEX_PERF_EXE || path.join(root, 'release/win-unpacked/Scodex工作台.exe');
const report = { status: 'running', executable, fixture, scope: 'One fixed public prompt, configured service/model/default reasoning; isolated chat-only profile; no previous chats or workspace content sent.' };
let child, socket, cdp, sourceHash; const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
async function main() {
  await fs.mkdir(profile, { recursive: true }); await fs.mkdir(home, { recursive: true });
  const config = await fs.readFile(source); sourceHash = digest(config); await fs.writeFile(copied, config, { flag: 'wx' });
  // Windows safeStorage's encrypted key context belongs to the Chromium
  // profile. Copy that encrypted context without decrypting or logging it.
  await fs.copyFile(path.join(path.dirname(source), 'Local State'), path.join(profile, 'Local State'));
  const publicConfig = JSON.parse(config).config; report.model = publicConfig.model; report.reasoningEffort = publicConfig.reasoningEffort;
  await fs.writeFile(path.join(home, 'codex-settings.json'), JSON.stringify({ sandboxMode: 'danger-full-access', approvalPolicy: 'never', networkAccess: true, networkDomains: ['*'], allowLocalBinding: true }));
  await fs.writeFile(path.join(profile, 'settings.json'), JSON.stringify({ projects: [], activeProjectId: '', preferences: { contextAccess: 'chat-only', closeConfirmation: 'never', closeToTray: false } }));
  const port = await freePort();
  child = spawn(executable, ['--remote-debugging-port=' + port, '--user-data-dir=' + profile, '--disable-gpu'], { cwd: output, windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'], env: { ...process.env, SCODEX_HOME: home, SCODEX_REFERENCE_HOME: path.join(fixture, 'reference'), SCODEX_REFERENCE_AGENTS_HOME: path.join(fixture, 'agents') } });
  child.stderr.resume();
  const target = await wait(async () => (await fetch('http://127.0.0.1:' + port + '/json/list').then(response => response.json())).find(page => page.type === 'page' && page.url.startsWith('file:')), 'Actual EXE startup', 45000);
  socket = new WebSocket(target.webSocketDebuggerUrl); await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); }); cdp = connect(socket);
  await wait(() => cdp.evaluate('Boolean(document.querySelector("[aria-label=输入工作内容]"))'), 'Renderer ready');
  const s = await cdp.evaluate('window.scodex.getAppState()'); report.version = s.version; assert.equal(s.version, require('../package.json').version);
  await cdp.evaluate('window.__externalEvents=[];window.__externalEnd=null;window.scodex.onChatEvent(e=>{if(e.type==="request-metrics")window.__externalEvents.push(e);if(["complete","error","cancelled"].includes(e.type))window.__externalEnd={type:e.type,message:e.message};});true');
  const requestId = crypto.randomUUID();
  await cdp.evaluate('window.scodex.sendMessage(' + JSON.stringify({ requestId, conversationId: s.library.activeId, prompt: '这是连接速度检查。请仅回复“连接正常”，不要解释，不调用任何工具。', mode: 'answer', messages: [] }) + ').catch(e=>window.__externalEnd={type:"invoke-error",message:e.message});true');
  await wait(() => cdp.evaluate('window.__externalEnd'), 'Configured service generation terminal event', 135000);
  report.terminal = await cdp.evaluate('window.__externalEnd'); report.requests = await cdp.evaluate('window.__externalEvents');
  report.status = report.terminal.type === 'complete' ? 'passed' : 'failed';
}
main().catch(error => { report.status = 'failed'; report.error = error.stack; process.exitCode = 1; }).finally(async () => {
  try { if (child?.exitCode === null && cdp) { await cdp.evaluate('window.scodex.quitApp()'); await wait(() => child.exitCode !== null, 'Normal application exit', 30000); } } catch (error) { report.shutdownError = error.stack; process.exitCode = 1; }
  socket?.close(); report.applicationExitCode = child?.exitCode;
  if (sourceHash) report.originalConnectionUnchanged = digest(await fs.readFile(source)) === sourceHash;
  if (child?.exitCode !== null && path.dirname(copied) === profile && profile.startsWith(output + path.sep)) { await fs.rm(copied, { force: true }); await fs.rm(path.join(profile, 'Local State'), { force: true }); report.copiedEncryptedCredentialRemoved = true; }
  await fs.mkdir(output, { recursive: true }); await fs.writeFile(path.join(output, 'external-latency.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ status: report.status, terminal: report.terminal, requests: report.requests, output }));
});
