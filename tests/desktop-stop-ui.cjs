// The model is a loopback fixture. The EXE, React, IPC, banner, global hook and Windows input are real.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const http = require('node:http');
const { spawn, execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { connect, wait, freePort } = require('./agent-workflow-ui.cjs');
const execute = promisify(execFile), json = JSON.stringify;
const root = path.resolve(__dirname, '..');
const executable = path.resolve(process.env.SCODEX_DESKTOP_STOP_EXE || path.join(root, 'release/desktop-stop-20261101/candidate/win-unpacked/Scodex工作台.exe'));
const output = path.resolve(process.env.SCODEX_DESKTOP_STOP_OUTPUT || path.join(root, 'release/desktop-stop-20261101/candidate-ui'));
const scope = process.env.SCODEX_DESKTOP_STOP_SCOPE || 'full';
const temporary = path.join(os.tmpdir(), 'scodex-desktop-stop-' + crypto.randomUUID());
const profile = path.join(temporary, 'profile'), workspace = path.join(temporary, 'project'), home = path.join(temporary, 'home');
const stateFile = path.join(temporary, 'desktop.json'), stopFile = path.join(temporary, 'stop'), activateFile = path.join(temporary, 'activate');
const report = { status: 'running', version: '1.3.29', executable, scope, temporary, checks: [], requests: [],
  environment: { platform: process.platform, release: os.release(), node: process.version },
  limitations: ['Only model HTTP is supplied by loopback. No public model or advanced browser delivery is claimed.'] };
const holds = new Map(), bars = new Set();
let app, cdp, socket, port, server, fixture, stage = 'setup', fixtureError = '';
const terminalTypes = ['complete', 'cancelled', 'error'];
async function persist() { await fs.mkdir(output, { recursive: true }); await fs.writeFile(path.join(output, 'desktop-stop-ui-verification.json'), json(report, null, 2) + '\n'); }
async function check(name, action) { stage = name; const evidence = await action(); report.checks.push({ name, status: 'passed', evidence }); await persist(); console.log('PASS ' + name); }
async function state() { return JSON.parse(await fs.readFile(stateFile, 'utf8')); }
function held(prompt) {
  const hold = { reached: false, closed: false, response: null };
  hold.promise = new Promise(resolve => { hold.release = resolve; }); holds.set(prompt, hold); return hold;
}
function reply(res, message) {
  const calls = message.tool_calls;
  const delta = { ...(message.content ? { content: message.content } : {}), ...(calls ? { tool_calls: calls.map((item, index) => ({ index, ...item })) } : {}) };
  res.writeHead(200, { 'content-type': 'text/event-stream; charset=utf-8' });
  res.end('data: ' + json({ choices: [{ delta }] }) + '\n\ndata: ' + json({ choices: [{ delta: {}, finish_reason: calls ? 'tool_calls' : 'stop' }] }) + '\n\ndata: [DONE]\n\n');
}
function tool(name, args) { return { tool_calls: [{ id: 'call_' + crypto.randomUUID(), type: 'function', function: { name, arguments: json(args) } }] }; }
function point(rect, shot) {
  const desktop = shot.screenshot.desktop;
  return { x: Math.floor((rect.x + rect.width / 2 - desktop.x) * shot.screenshot.width / desktop.width), y: Math.floor((rect.y + rect.height / 2 - desktop.y) * shot.screenshot.height / desktop.height) };
}
async function model(req, res) {
  let raw = ''; for await (const chunk of req) raw += chunk;
  const body = JSON.parse(raw);
  const original = body.messages.findLastIndex(item => item.role === 'user' && typeof item.content === 'string' && item.content.startsWith('DS-验收:'));
  assert.ok(original >= 0);
  const prompt = body.messages[original].content;
  const results = body.messages.slice(original + 1).filter(item => item.role === 'tool').map(item => JSON.parse(item.content));
  report.requests.push({ prompt, step: results.length, results: results.map(item => ({ ok: item.ok, error: item.error })) });
  const hold = holds.get(prompt);
  if (prompt.includes('无桌面')) {
    hold.reached = true; hold.response = res; res.on('close', () => { hold.closed = true; });
    await hold.promise; if (!res.destroyed) reply(res, { content: '无桌面聊天正常完成' }); return;
  }
  if (!results.length) return reply(res, tool('desktop_screenshot', {}));
  const last = results.at(-1); assert.equal(last.ok, true, json(last));
  if (prompt.includes('正常') && results.length === 1 || !prompt.includes('正常') && results.length === 3) {
    hold.reached = true; hold.response = res; res.on('close', () => { hold.closed = true; });
    await hold.promise;
    if (res.destroyed) return;
  }
  const desktop = await state();
  assert.equal(desktop.visible, true); assert.equal(desktop.foreground, true, 'Input may only target the foreground fixture');
  const args = { screenshot_id: last.screenshot_id };
  if (results.length === 1) return reply(res, tool('desktop_click', { ...args, ...point(desktop.input, last) }));
  if (results.length === 2) return reply(res, tool('desktop_type', { ...args, text: prompt.includes('正常') ? '模型按键测试' : '取消前' }));
  if (prompt.includes('错误')) { res.writeHead(418, { 'content-type': 'application/json' }); res.end(json({ error: { message: 'controlled model failure' } })); return; }
  if (!prompt.includes('正常')) return reply(res, tool('desktop_type', { ...args, text: '禁止取消后输入' }));
  if (results.length === 3) return reply(res, tool('desktop_key', { ...args, key: 'ESC' }));
  if (results.length === 4) return reply(res, tool('desktop_type', { ...args, text: '·继续' }));
  return reply(res, { content: '正常完成，模型 Esc 未取消自己' });
}
async function targets() { return fetch('http://127.0.0.1:' + port + '/json/list').then(res => res.json()); }
async function banner() {
  return wait(async () => {
    const target = (await targets()).find(item => item.url.endsWith('/desktop-control.html'));
    if (!target) return false;
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => { ws.addEventListener('open', resolve, { once: true }); ws.addEventListener('error', reject, { once: true }); });
    bars.add(ws); return { ws, cdp: connect(ws) };
  }, 'Desktop banner', 20000);
}
async function noBanner() { await wait(async () => !(await targets()).some(item => item.url.endsWith('/desktop-control.html')), 'Banner released'); }
async function nativeInput(action, x, y) {
  const args = ['-NoLogo', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(__dirname, 'desktop-stop-input.ps1'), '-Action', action];
  if (action === 'Click') args.push('-X', String(x), '-Y', String(y));
  await execute('powershell.exe', args, { windowsHide: true, timeout: 20000 });
}
async function activate() {
  await fs.writeFile(activateFile, crypto.randomUUID());
  const visible = await wait(async () => { const value = await state(); return value.visible && value.input.width > 0 && value; }, 'External fixture visible');
  await nativeInput('Click', Math.round(visible.input.x + visible.input.width / 2), Math.round(visible.input.y + visible.input.height / 2));
  await wait(async () => { const value = await state(); return value.visible && value.foreground; }, 'External fixture foreground after native click');
}
async function launch() {
  port = await freePort();
  app = spawn(executable, ['--remote-debugging-port=' + port, '--user-data-dir=' + profile, '--disable-gpu'], {
    cwd: path.dirname(executable), windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'],
    env: { ...process.env, SCODEX_HOME: home, SCODEX_REFERENCE_HOME: path.join(temporary, 'reference'), SCODEX_REFERENCE_AGENTS_HOME: path.join(temporary, 'agents') },
  });
  let stderr = ''; app.stderr.on('data', chunk => { stderr = (stderr + chunk).slice(-3000); });
  const target = await wait(async () => {
    if (app.exitCode !== null) throw Error('EXE exited: ' + stderr);
    return (await targets()).find(item => item.type === 'page' && item.url.startsWith('file:') && !item.url.endsWith('/desktop-control.html'));
  }, 'Actual EXE ready', 60000);
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
  cdp = connect(socket);
  await wait(() => cdp.evaluate('Boolean(window.scodex&&document.querySelector("[aria-label=输入工作内容]"))'), 'React ready');
  const actual = await cdp.evaluate('window.scodex.getAppState().then(s=>({version:s.version,userDataPath:s.userDataPath,workspaceRoot:s.workspaceRoot,desktop:s.preferences.computerControlEnabled,sandbox:s.agentSettings.sandboxMode}))');
  assert.equal(actual.version, report.version); assert.equal(path.resolve(actual.userDataPath), profile); assert.equal(path.resolve(actual.workspaceRoot), workspace);
  assert.equal(actual.desktop, true); assert.equal(actual.sandbox, 'danger-full-access');
  await cdp.evaluate('window.__desktopEvents=[];window.scodex.onChatEvent(e=>window.__desktopEvents.push(e))');
  return actual;
}
async function start(prompt) {
  await activate();
  await cdp.evaluate(`(()=>{const e=document.querySelector('[aria-label="输入工作内容"]');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(e,${json(prompt)});e.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  await wait(() => cdp.evaluate('(()=>{const e=document.querySelector("[aria-label=发送消息]");if(!e||e.disabled)return false;e.click();return true})()'), 'Send via React');
  await wait(() => holds.get(prompt)?.reached, 'Desktop model reached hold', 45000);
  const request = await cdp.evaluate('window.__desktopEvents.findLast(e=>e.requestId)?.requestId');
  assert.ok(request); return request;
}
async function terminal(id, type) {
  const event = await wait(() => cdp.evaluate(`window.__desktopEvents.find(e=>e.requestId===${json(id)}&&${json(terminalTypes)}.includes(e.type))`), 'Terminal event', 30000);
  assert.equal(event.type, type, json(event)); await noBanner();
  await wait(() => cdp.evaluate('!document.querySelector("[aria-label=停止生成]")'), 'React stopped');
  return event;
}
async function releasedEscape() {
  await activate();
  const before = (await state()).keys.filter(key => key === 'Escape').length;
  await nativeInput('Escape');
  await wait(async () => (await state()).keys.filter(key => key === 'Escape').length > before, 'Esc reaches external app after release');
}
async function quit() {
  if (!app || app.exitCode !== null) return;
  await cdp.evaluate('window.scodex.quitApp()').catch(() => {});
  await wait(() => app.exitCode !== null, 'Actual EXE exited', 20000);
  socket.close(); for (const ws of bars) ws.close(); bars.clear();
}
async function main() {
  try {
    for (const directory of [profile, workspace, home, path.join(temporary, 'reference'), path.join(temporary, 'agents')]) await fs.mkdir(directory, { recursive: true });
    await fs.writeFile(path.join(profile, 'settings.json'), json({ workspaceRoot: workspace, preferences: { computerControlEnabled: true, trayEnabled: false, closeConfirmation: 'never', browserPanelOpen: false } }));
    await fs.writeFile(path.join(home, 'codex-settings.json'), json({ workspaceDependencies: false, sandboxMode: 'danger-full-access', approvalPolicy: 'never', networkAccess: true, networkDomains: ['*'], allowLocalBinding: true }));
    server = http.createServer((req, res) => { model(req, res).catch(error => { report.fixtureError = error.stack; if (!res.headersSent) res.writeHead(500); res.end(); }); });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    fixture = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(__dirname, 'permission-desktop-fixture.ps1'), '-StateFile', stateFile, '-StopFile', stopFile, '-ActivateFile', activateFile], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
    fixture.stderr.on('data', chunk => { fixtureError = (fixtureError + chunk).slice(-3000); });
    await wait(async () => { if (fixture.exitCode !== null) throw Error(fixtureError); return state(); }, 'Native fixture ready');
    report.executableSha256 = crypto.createHash('sha256').update(await fs.readFile(executable)).digest('hex');
    await check('Actual EXE, isolated profile and desktop permissions', launch);
    await cdp.evaluate('window.scodex.saveModelConnection(' + json({ name: 'Desktop stop fixture', baseUrl: 'http://127.0.0.1:' + server.address().port + '/v1', models: ['desktop-fixture'], model: 'desktop-fixture', apiKey: 'local-fixture', toolProtocol: 'native' }) + ')');
    const previousDocument = await cdp.evaluate('performance.timeOrigin');
    await cdp.command('Page.reload');
    await wait(() => cdp.evaluate(`performance.timeOrigin!==${previousDocument}&&Boolean(window.scodex&&document.querySelector("[aria-label=输入工作内容]"))`), 'Reloaded model setting');
    await cdp.evaluate('window.__desktopEvents=[];window.scodex.onChatEvent(e=>window.__desktopEvents.push(e))');
    await check('Visible nonactivating banner, normal input and model Esc remain functional', async () => {
      const prompt = 'DS-验收:正常'; const hold = held(prompt); const id = await start(prompt); const bar = await banner();
      const text = await bar.cdp.evaluate('document.body.innerText'); assert.match(text, /Scodex 正在使用你的电脑/); assert.match(text, /按 Esc 可停止/);
      assert.equal((await state()).foreground, true, 'Banner must not steal external focus');
      const layout = await bar.cdp.evaluate('({width:innerWidth,height:innerHeight,overflow:document.documentElement.scrollWidth>innerWidth})');
      assert.equal(layout.overflow, false);
      hold.release(); const event = await terminal(id, 'complete');
      assert.match((await state()).text, /模型按键测试·继续/); await releasedEscape();
      return { text, layout, modelEscDidNotCancel: true, terminal: event.type, focusPreserved: true, hookReleased: true };
    });
    await check('Global Esc works with external focus and preserves an unrelated chat', async () => {
      const prompt = 'DS-验收:跨应用Esc'; const hold = held(prompt); const id = await start(prompt);
      const unrelated = 'DS-验收:无桌面'; const otherHold = held(unrelated); const otherId = crypto.randomUUID();
      await cdp.evaluate(`window.scodex.sendMessage(${json({ requestId: otherId, mode: 'answer', prompt: unrelated, messages: [] })}).catch(()=>{});true`);
      await wait(() => otherHold.reached, 'Unrelated chat pending');
      await banner(); assert.equal((await state()).foreground, true); const before = (await state()).text;
      await nativeInput('Escape'); await terminal(id, 'cancelled');
      assert.equal(otherHold.closed, false, 'Unrelated chat must continue');
      hold.release(); await wait(() => hold.closed, 'Cancelled model HTTP closed');
      assert.equal((await state()).text, before);
      otherHold.release(); await wait(() => cdp.evaluate(`window.__desktopEvents.some(e=>e.requestId===${json(otherId)}&&e.type==='complete')`), 'Unrelated chat completed');
      await releasedEscape(); return { cancelled: true, externalFocus: true, noLaterInput: true, unrelatedChatCompleted: true, hookReleased: true };
    });
    await check('Native click on banner Stop cancels and prevents subsequent input', async () => {
      const prompt = 'DS-验收:按钮停止'; const hold = held(prompt); const id = await start(prompt); const bar = await banner();
      const before = (await state()).text;
      const location = await bar.cdp.evaluate('(()=>{const r=document.querySelector("#stop").getBoundingClientRect();return {x:Math.round((screenX+r.x+r.width/2)*devicePixelRatio),y:Math.round((screenY+r.y+r.height/2)*devicePixelRatio)}})()');
      if (scope === 'formal') {
        const shot = await bar.cdp.command('Page.captureScreenshot', { format: 'png' }); await fs.writeFile(path.join(output, 'desktop-control.png'), Buffer.from(shot.data, 'base64'));
        report.finalScreenshot = 'desktop-control.png';
      }
      await nativeInput('Click', location.x, location.y); await terminal(id, 'cancelled');
      hold.release(); assert.equal((await state()).text, before); await releasedEscape();
      return { nativeClick: location, cancelled: true, noLaterInput: true, hookReleased: true };
    });
    if (scope !== 'formal') await check('Model error releases banner and global hook', async () => {
      const prompt = 'DS-验收:错误'; const hold = held(prompt); const id = await start(prompt); hold.release();
      const event = await terminal(id, 'error'); assert.match(event.message, /controlled model failure|418/); await releasedEscape();
      return { terminal: event.type, hookReleased: true };
    });
    await check('Program restart creates a new protected session and cleans it on completion', async () => {
      await quit(); await launch();
      const prompt = 'DS-验收:正常重启'; const hold = held(prompt); const id = await start(prompt); await banner(); hold.release();
      await terminal(id, 'complete'); await releasedEscape(); return { restarted: true, complete: true, hookReleased: true };
    });
    assert.equal(report.fixtureError, undefined); report.status = 'passed';
  } catch (error) {
    report.status = 'failed'; report.failedStage = stage; report.error = error.stack; process.exitCode = 1;
    report.desktopState = await state().catch(() => null);
    report.events = await cdp?.evaluate('window.__desktopEvents').catch(() => null);
    report.ui = await cdp?.evaluate('document.body.innerText.slice(-6000)').catch(() => null);
  } finally {
    for (const hold of holds.values()) hold.release();
    try { await quit(); report.appExited = true; } catch (error) { report.exitError = error.message; report.status = 'failed'; process.exitCode = 1; }
    if (fixture) {
      await fs.writeFile(stopFile, 'stop');
      await wait(() => fixture.exitCode !== null, 'Fixture exit', 10000).catch(error => { report.fixtureExitError = error.message; report.status = 'failed'; process.exitCode = 1; });
    }
    if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
    if (app?.exitCode !== null && fixture?.exitCode !== null) {
      await fs.rm(temporary, { recursive: true, force: true }); report.temporaryRemoved = true;
    }
    await persist();
  }
}
if (require.main === module) main();
