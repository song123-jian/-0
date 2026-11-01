// Runs the actual portable EXE and React/IPC/native tools. Only the model is local.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const http = require('node:http');
const { spawn } = require('node:child_process');
const { connect, wait, freePort } = require('./agent-workflow-ui.cjs');
const root = path.resolve(__dirname, '..');
const evidence = path.join(root, 'release/permission-models-20261031');
const executable = path.resolve(process.env.SCODEX_PM_EXE || path.join(evidence, 'candidate-rebuilt/Scodex-Workbench-1.3.22-x64.exe'));
const scope = process.env.SCODEX_PM_SCOPE || 'all';
const output = path.resolve(process.env.SCODEX_PM_OUTPUT || evidence);
const temporary = path.join(process.env.SystemRoot || 'C:\\Windows', 'Temp', 'scodex-permission-models-' + crypto.randomUUID());
const workspace = path.join(temporary, 'project'), profile = path.join(temporary, 'profile'), home = path.join(temporary, 'scodex');
const external = path.join(temporary, 'outside', 'full-access.txt');
const stateFile = path.join(temporary, 'desktop-state.json'), stopFile = path.join(temporary, 'desktop-stop');
const activateFile = path.join(temporary, 'desktop-activate');
const models = Array.from({ length: 137 }, (_, i) => 'fixture-model-' + String(i).padStart(3, '0'));
const json = JSON.stringify, hash = b => crypto.createHash('sha256').update(b).digest('hex');
const report = { status: 'running', scope, executable, version: '1.3.22', temporary, environment: { platform: process.platform, node: process.version }, checks: [], requests: [], limitations: ['Only the external model is substituted with a deterministic loopback server. Actual portable EXE, React, IPC, files, commands and Windows desktop are used. Public model integration is not claimed.'] };
let child, socket, cdp, server, endpoint, fixture, fixtureError = '', listMode = 'success', currentPrompt, activeId;
let stage = 'setup', cancelGate, releaseCancel;
const enabled = part => scope === 'all' || scope === part;
async function persist() { await fs.writeFile(path.join(output, 'ui-verification-' + scope + '.json'), json(report, null, 2) + '\n'); }
async function check(name, action) { stage = name; const result = await action(); report.checks.push({ name, status: 'passed', evidence: result }); await persist(); console.log('PASS ' + name); }
async function click(selector, text) {
  await wait(() => cdp.evaluate(`(()=>{const e=[...document.querySelectorAll(${json(selector)})].find(e=>${text ? `e.textContent.trim()===${json(text)}` : 'true'});if(!e||e.disabled)return false;e.click();return true})()`), 'Missing button ' + selector + (text || ''), 15000);
}
async function insert(selector, value) {
  await cdp.evaluate(`(()=>{const e=document.querySelector(${json(selector)});if(!e)throw Error('Missing input '+${json(selector)});e.focus();const p=e instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(p,'value').set.call(e,${json(value)});e.dispatchEvent(new Event('input',{bubbles:true}));return true})()`);
}
async function reload() {
  const origin = await cdp.evaluate('performance.timeOrigin');
  await cdp.command('Page.reload');
  await wait(() => cdp.evaluate(`performance.timeOrigin!==${origin}&&Boolean(document.querySelector('[aria-label="输入工作内容"]'))`), 'Reloaded renderer', 30000);
}
async function settings(category) {
  if (!await cdp.evaluate('Boolean(document.querySelector(".settings-category"))')) await click('[aria-label="设置"]');
  await click('.settings-category', category);
}
async function project() { await click('.activity-rail [aria-label="项目"]'); await wait(() => cdp.evaluate('Boolean(document.querySelector("[aria-label=输入工作内容]"))'), 'Project chat'); }
async function planMode(enabled) {
  await click('[aria-label="添加工具和上下文"]');
  const changed = await cdp.evaluate(`(()=>{const button=[...document.querySelectorAll('.composer-menu-item')].find(e=>e.querySelector('.composer-item-copy>span')?.textContent==='计划模式');if(!button)throw Error('Plan menu missing');const current=button.title.includes('已开启');if(current!==${enabled}){button.click();return true}return false})()`);
  if (!changed) await click('[aria-label="添加工具和上下文"]');
}
async function submit(prompt, mode = 'normal') {
  currentPrompt = prompt;
  const toggle = await cdp.evaluate('document.querySelector("[aria-label=执行任务]")?.getAttribute("aria-pressed")');
  if (toggle === 'false') await click('[aria-label="执行任务"]');
  if (mode === 'plan') await planMode(true);
  await insert('[aria-label="输入工作内容"]', prompt);
  await click('[aria-label="发送消息"]');
  const record = await wait(() => cdp.evaluate(`window.scodex.getAppState().then(s=>s.library.conversations.find(c=>c.messages.some(m=>m.role==='user'&&m.content===${json(prompt)})))`), 'Request started');
  activeId = record.id;
}
async function finish(prompt = currentPrompt) {
  return wait(async () => {
    assert.equal(await cdp.evaluate('Boolean(document.querySelector(".agent-approval"))'), false, 'Full access + never must not request approval');
    if (!await cdp.evaluate('!document.querySelector("[aria-label=停止生成]")&&document.querySelector(".history-save-state")?.textContent==="已保存到本机"')) return false;
    return cdp.evaluate(`window.scodex.getAppState().then(s=>{const c=s.library.conversations.find(c=>c.id===${json(activeId)});if(!c)return false;const i=c.messages.findLastIndex(m=>m.role==='user'&&m.content===${json(prompt)});const a=c.messages.slice(i+1).find(m=>m.role==='assistant');return a&&!a.pending&&!document.querySelector('[aria-label="停止生成"]')&&a})`);
  }, 'Request completed ' + prompt, 60000);
}
function call(name, args) { return { tool_calls: [{ id: 'call_' + crypto.randomUUID(), type: 'function', function: { name, arguments: json(args) } }] }; }
function send(res, message) {
  res.writeHead(200, { 'content-type': 'text/event-stream; charset=utf-8' });
  const delta = { ...(message.content ? { content: message.content } : {}), ...(message.tool_calls ? { tool_calls: message.tool_calls.map((t, index) => ({ index, ...t })) } : {}) };
  res.end('data: ' + json({ choices: [{ delta }] }) + '\n\ndata: ' + json({ choices: [{ delta: {}, finish_reason: message.tool_calls ? 'tool_calls' : 'stop' }] }) + '\n\ndata: [DONE]\n\n');
}
async function desktopState() { return JSON.parse(await fs.readFile(stateFile, 'utf8')); }
function point(rect, result) {
  const desk = result.screenshot.desktop;
  return { x: Math.floor((rect.x + rect.width / 2 - desk.x) * result.screenshot.width / desk.width), y: Math.floor((rect.y + rect.height / 2 - desk.y) * result.screenshot.height / desk.height) };
}
async function respond(body, res) {
  const original = body.messages.findLastIndex(m => m.role === 'user' && typeof m.content === 'string' && m.content.startsWith('PM-验收:'));
  assert.ok(original >= 0, 'Unique original prompt must be present');
  const prompt = body.messages[original].content;
  const results = body.messages.slice(original + 1).filter(m => m.role === 'tool').map(m => JSON.parse(m.content));
  const images = body.messages.slice(original + 1).flatMap(m => Array.isArray(m.content) ? m.content.filter(p => p.type === 'image_url') : []);
  for (const image of images) { assert.match(image.image_url.url, /^data:image\/jpeg;base64,\/9j\//); assert.ok(image.image_url.url.length > 1000); }
  const step = results.length, names = (body.tools || []).map(t => t.function.name);
  if (prompt.includes('真实桌面') && images.length) await fs.writeFile(path.join(output, 'desktop-step-' + step + '.jpg'), Buffer.from(images.at(-1).image_url.url.split(',')[1], 'base64'));
  report.requests.push({ prompt, step, tools: names, imageCount: images.length, results: results.map(r => { const { screenshot, ...other } = r; return { ...other, ...(screenshot ? { screenshot } : {}) }; }) });
  if (prompt.includes('项目外写读')) {
    if (step === 0) return send(res, call('write_file', { path: external, expected_hash: 'new', content: '完整访问真实写入\n' }));
    if (step === 1) { assert.equal(results[0].ok, true); return send(res, call('read_file', { path: external })); }
    if (step === 2) { assert.equal(results[1].content, '1: 完整访问真实写入\n2: '); assert.equal(results[1].hash, results[0].hash); return send(res, call('run_command', { command: "[IO.File]::WriteAllText('command-proof.txt','actual-command-ok'); [Console]::Write('actual-command-ok')", timeout_ms: 15000 })); }
    assert.equal(results[2].exitCode, 0); return send(res, { content: '项目外写读与命令完成。' });
  }
  if (prompt.includes('受限越界')) return send(res, step ? { content: '受限越界已拒绝。' } : call('write_file', { path: path.join(temporary, 'outside/denied.txt'), expected_hash: 'new', content: 'must not exist' }));
  if (prompt.includes('桌面禁用')) return send(res, step ? { content: '桌面禁用已拒绝。' } : call('desktop_screenshot', {}));
  if (prompt.includes('桌面只读')) { assert.equal(names.includes('desktop_click'), false); return send(res, step ? { content: '只读操作已拒绝。' } : call('desktop_click', { screenshot_id: 'forged', x: 1, y: 1 })); }
  if (prompt.includes('取消桌面')) {
    if (step === 0) return send(res, call('desktop_screenshot', {}));
    await cancelGate;
    if (!res.destroyed) send(res, call('desktop_type', { screenshot_id: results[0].screenshot_id, text: 'must-not-type-after-cancel' }));
    return;
  }
  if (prompt.includes('真实桌面')) {
    if (step === 0) {
      await fs.writeFile(activateFile, crypto.randomUUID());
      await wait(async () => { const state = await desktopState(); return state.visible && state.foreground; }, 'Actual fixture visible and foreground');
      return send(res, call('desktop_screenshot', {}));
    }
    const last = results.at(-1); assert.equal(last.ok, true, 'Native desktop result ' + step + ': ' + last.error);
    assert.ok(images.length > 0, 'Actual screenshot must reach the model');
    const state = await desktopState();
    assert.equal(state.visible, true, 'Do not send input to a hidden fixture');
    assert.equal(state.foreground, true, 'Do not send input outside the fixture');
    const args = { screenshot_id: last.screenshot_id };
    if (step === 1) return send(res, call('desktop_click', { ...args, ...point(state.input, last) }));
    if (step === 2) return send(res, call('desktop_type', { ...args, text: '初次中文输入' }));
    if (step === 3) { assert.equal(state.text, '初次中文输入'); return send(res, call('desktop_key', { ...args, key: 'CTRL+A' })); }
    if (step === 4) return send(res, call('desktop_type', { ...args, text: '桌面中文替换验证✓' }));
    if (step === 5) { assert.equal(state.text, '桌面中文替换验证✓'); return send(res, call('desktop_click', { ...args, ...point(state.button, last) })); }
    if (step === 6) { assert.equal(state.clicks, 1); assert.equal(state.recorded, '桌面中文替换验证✓'); return send(res, call('desktop_click', { ...args, ...point(state.list, last) })); }
    if (step === 7) return send(res, call('desktop_scroll', { ...args, ...point(state.list, last), ticks: -5 }));
    assert.ok(state.topIndex > 0, 'Real list must scroll');
    report.desktopFinalState = state;
    return send(res, { content: '真实桌面截图、点击、中文输入、组合键与滚动完成。' });
  }
  throw Error('Unexpected prompt ' + prompt);
}
async function launch() {
  const port = await freePort();
  child = spawn(executable, ['--remote-debugging-port=' + port, '--user-data-dir=' + profile, '--disable-gpu'], { cwd: path.dirname(executable), windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'], env: { ...process.env, SCODEX_HOME: home, SCODEX_REFERENCE_HOME: path.join(temporary, 'reference'), SCODEX_REFERENCE_AGENTS_HOME: path.join(temporary, 'agents') } });
  let stderr = ''; child.stderr.on('data', d => { stderr = (stderr + d).slice(-2500); });
  const target = await wait(async () => { if (child.exitCode !== null) throw Error('EXE exited: ' + stderr); return (await fetch(`http://127.0.0.1:${port}/json/list`).then(r => r.json())).find(t => t.type === 'page' && t.url.startsWith('file:')); }, 'Actual portable EXE startup', 60000);
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
  cdp = connect(socket);
  await wait(() => cdp.evaluate('Boolean(window.scodex&&document.querySelector("[aria-label=输入工作内容]"))'), 'Actual React ready', 30000);
  return cdp.evaluate('window.scodex.getAppState().then(s=>({version:s.version,workspaceRoot:s.workspaceRoot,userDataPath:s.userDataPath}))');
}
async function quit() {
  if (cdp) await cdp.evaluate('window.scodex.quitApp()').catch(() => {});
  await wait(() => Promise.resolve(!child || child.exitCode !== null), 'EXE exited', 20000);
  socket?.close(); socket = cdp = null;
}
async function fullAccess() {
  await settings('配置'); await click('button', '启用完整访问');
  return wait(() => cdp.evaluate('window.scodex.getAppState().then(s=>s.agentSettings.sandboxMode==="danger-full-access"&&s.agentSettings.approvalPolicy==="never"&&s.preferences.computerControlEnabled&&s)'), 'Full-access preset saved');
}
async function main() {
  await fs.mkdir(output, { recursive: true });
  try {
    for (const dir of [workspace, profile, home, path.dirname(external), path.join(temporary, 'reference'), path.join(temporary, 'agents')]) await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(profile, 'settings.json'), json({ workspaceRoot: workspace, preferences: { browserPanelOpen: false, trayEnabled: false, contextAccess: 'manual' } }));
    await fs.writeFile(path.join(home, 'codex-settings.json'), json({ sandboxMode: 'workspace-write', approvalPolicy: 'never', availableReasoningEfforts: ['low'], defaultReasoningEffort: 'low', workspaceDependencies: false, networkAccess: true, networkDomains: ['*'], allowLocalBinding: true }));
    server = http.createServer(async (req, res) => {
      try {
        if (req.url === '/v1/models') { res.writeHead(listMode === 'failure' ? 503 : 200, { 'content-type': 'application/json' }); res.end(json(listMode === 'failure' ? { error: 'controlled-list-failure' } : { data: [...models, models[0]].map(id => ({ id })) })); return; }
        assert.equal(req.url, '/v1/chat/completions'); let raw = ''; for await (const d of req) raw += d; await respond(JSON.parse(raw), res);
      } catch (error) { report.fixtureError = error.stack; if (!res.headersSent) res.writeHead(500); res.end(); }
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); endpoint = `http://127.0.0.1:${server.address().port}/v1`;
    report.sha256 = hash(await fs.readFile(executable));
    await check('actual executable identity and isolated profile', async () => { const state = await launch(); assert.equal(state.version, '1.3.22'); assert.equal(path.resolve(state.workspaceRoot), workspace); assert.equal(path.resolve(state.userDataPath), profile); return state; });
    await cdp.evaluate(`window.scodex.saveModelConnection({name:'模型与权限隔离验收',baseUrl:${json(endpoint)},models:['obsolete-main','obsolete-subagent','obsolete-other'],model:'obsolete-main',subagentModel:'obsolete-subagent',toolProtocol:'native',apiKey:'isolated-fixture-credential'})`);
    await reload();
    if (enabled('models')) {
      await check('137 fetched model chips replace old models and repair stale selections', async () => {
        await settings('模型与连接'); await click('button', '获取模型列表');
        await wait(() => cdp.evaluate('document.querySelector(".model-message")?.textContent.includes("已获取 137")'), 'Model request completed');
        const value = await cdp.evaluate('({chips:[...document.querySelectorAll(".model-list .model-chip")].map(e=>e.firstChild.textContent),model:document.querySelector("#model-default").value,subagent:document.querySelector("#model-subagent").value})');
        assert.deepEqual(value.chips, models); assert.equal(value.model, models[0]); assert.equal(value.subagent, models[0]);
        await click('.model-save-button');
        const saved = await wait(() => cdp.evaluate('window.scodex.getModelConnection().then(s=>s.models.length===137&&s)'), 'Saved replacement');
        assert.deepEqual(saved.models, models); assert.equal(saved.model, models[0]); assert.equal(saved.subagentModel, models[0]);
        await wait(() => cdp.evaluate('document.querySelector(".model-message")?.textContent.includes("已保存")&&document.querySelector(".model-connection-form")?.getAttribute("aria-busy")==="false"'), 'Save callback applied to the visible form');
        return { count: value.chips.length, staleRemoved: true, model: saved.model, subagentModel: saved.subagentModel };
      });
      await check('valid selections survive refresh and failed fetch leaves list intact', async () => {
        await insert('#model-default', models[42]); await insert('#model-subagent', models[93]); await click('button', '获取模型列表');
        await wait(() => cdp.evaluate('document.querySelector(".model-message")?.textContent.includes("已获取 137")'), 'Refresh completed');
        assert.equal(await cdp.evaluate('document.querySelector("#model-default").value'), models[42]); assert.equal(await cdp.evaluate('document.querySelector("#model-subagent").value'), models[93]);
        listMode = 'failure'; await click('button', '获取模型列表');
        await wait(() => cdp.evaluate('document.querySelector(".model-message.error")?.textContent.includes("HTTP 503")'), 'Controlled fetch failure visible');
        assert.deepEqual(await cdp.evaluate('[...document.querySelectorAll(".model-list .model-chip")].map(e=>e.firstChild.textContent)'), models);
        listMode = 'success'; await click('.model-save-button');
        await wait(() => cdp.evaluate(`window.scodex.getModelConnection().then(s=>s.model===${json(models[42])}&&s.subagentModel===${json(models[93])})`), 'Valid selections saved');
        await wait(() => cdp.evaluate('document.querySelector(".model-message")?.textContent.includes("已保存")&&document.querySelector(".model-connection-form")?.getAttribute("aria-busy")==="false"'), 'Valid-selection save callback completed');
        return { model: models[42], subagent: models[93], failedFetch: 503, listPreserved: true };
      });
      await check('main chat selector and restart use the complete saved model list', async () => {
        await project(); assert.deepEqual(await cdp.evaluate('[...document.querySelectorAll("[aria-label=选择模型] option")].map(e=>e.value)'), models);
        await quit(); await launch(); await settings('模型与连接');
        assert.deepEqual(await cdp.evaluate('[...document.querySelectorAll(".model-list .model-chip")].map(e=>e.firstChild.textContent)'), models);
        assert.equal(await cdp.evaluate('document.querySelector("#model-default").value'), models[42]); assert.equal(await cdp.evaluate('document.querySelector("#model-subagent").value'), models[93]);
        await cdp.command('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
        await cdp.evaluate('document.querySelector(".model-list").scrollIntoView({block:"center"})');
        const layout = await cdp.evaluate('({pageOverflow:document.documentElement.scrollWidth>innerWidth+1,chipOverflow:[...document.querySelectorAll(".model-chip")].some(e=>e.scrollWidth>e.clientWidth+1),scrollable:document.querySelector(".model-list").scrollHeight>document.querySelector(".model-list").clientHeight})');
        assert.equal(layout.pageOverflow, false); assert.equal(layout.chipOverflow, false); assert.equal(layout.scrollable, true);
        const shot = await cdp.command('Page.captureScreenshot', { format: 'png' }); await fs.writeFile(path.join(output, 'model-list-final.png'), Buffer.from(shot.data, 'base64'));
        await cdp.command('Emulation.clearDeviceMetricsOverride'); return { count: 137, restart: true, layout, screenshot: 'model-list-final.png' };
      });
    }
    if (enabled('permissions') || enabled('desktop') || enabled('formal') || scope === 'desktop-stop') {
      await check('full-access preset persists actual workspace policy and desktop preference', async () => {
        const state = await fullAccess(); assert.deepEqual(state.agentSettings.networkDomains, ['*']); assert.equal(state.agentSettings.networkAccess, true); assert.equal(state.agentSettings.allowLocalBinding, true);
        await reload(); const restored = await cdp.evaluate('window.scodex.getAppState()'); assert.equal(restored.agentSettings.sandboxMode, 'danger-full-access'); assert.equal(restored.agentSettings.approvalPolicy, 'never'); assert.equal(restored.preferences.computerControlEnabled, true);
        const settingsFile = JSON.parse(await fs.readFile(path.join(profile, 'settings.json'), 'utf8')); assert.equal(settingsFile.preferences.computerControlEnabled, true);
        return { sandboxMode: restored.agentSettings.sandboxMode, approvalPolicy: restored.agentSettings.approvalPolicy, computerControlEnabled: true, reload: true, settingsReadback: true };
      });
    }
    if (enabled('permissions') || enabled('formal')) {
      await project(); await submit('PM-验收:项目外写读与本机命令');
      await check('full access writes and reads outside project and runs a real command without approval', async () => {
        const result = await finish(); assert.equal(await fs.readFile(external, 'utf8'), '完整访问真实写入\n'); assert.equal(await fs.readFile(path.join(workspace, 'command-proof.txt'), 'utf8'), 'actual-command-ok');
        assert.equal(result.operations.filter(o => o.status === 'succeeded').length, 3); return { operations: result.operations.map(o => ({ name: o.name, status: o.status, exitCode: o.exitCode })), externalHash: hash(await fs.readFile(external)), approvals: 0 };
      });
      await cdp.evaluate("window.scodex.saveAgentSettings({sandboxMode:'workspace-write',approvalPolicy:'never'},'workspace')");
      await submit('PM-验收:受限越界');
      await check('workspace policy still refuses an outside write', async () => { const result = await finish(); assert.equal(result.operations[0].status, 'failed'); assert.match(result.operations[0].output, /当前项目内|工作区外/); await assert.rejects(fs.access(path.join(temporary, 'outside/denied.txt'))); return { rejected: true, message: result.operations[0].output }; });
    }
    if (enabled('desktop') || scope === 'desktop-stop') {
      await fullAccess(); await project();
      fixture = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(__dirname, 'permission-desktop-fixture.ps1'), '-StateFile', stateFile, '-StopFile', stopFile, '-ActivateFile', activateFile], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
      fixture.stderr.on('data', b => { fixtureError = (fixtureError + b).slice(-2000); });
      await wait(async () => { if (fixture.exitCode !== null) throw Error(fixtureError); return desktopState(); }, 'Native fixture ready');
      if (scope !== 'desktop-stop') {
      await submit('PM-验收:真实桌面');
      await check('actual desktop image reaches model and native click Unicode key and scroll work', async () => {
        const result = await finish(); assert.equal(result.operations.length, 8); assert.equal(result.operations.every(o => o.status === 'succeeded'), true); assert.equal(report.desktopFinalState.recorded, '桌面中文替换验证✓'); assert.ok(report.desktopFinalState.topIndex > 0);
        return { tools: result.operations.map(o => o.name), recorded: report.desktopFinalState.recorded, scrollTopIndex: report.desktopFinalState.topIndex, modelReceivedRealImages: true };
      });
      await cdp.evaluate('window.scodex.savePreferences({computerControlEnabled:false})'); await reload(); await submit('PM-验收:桌面禁用');
      await check('disabled desktop tools reject native capture', async () => { const result = await finish(); assert.equal(result.operations[0].status, 'failed'); assert.match(result.operations[0].output, /启用电脑操控/); return { rejected: true }; });
      await cdp.evaluate('window.scodex.savePreferences({computerControlEnabled:true})'); await reload(); await submit('PM-验收:桌面只读', 'plan');
      await check('plan mode excludes and rejects forged desktop mutation', async () => { const result = await finish(); assert.equal(result.operations[0].status, 'failed'); assert.match(result.operations[0].output, /没有开放此工具/); return { rejected: true }; });
      }
      await planMode(false);
      cancelGate = new Promise(resolve => { releaseCancel = resolve; }); await submit('PM-验收:取消桌面');
      await wait(() => Promise.resolve(report.requests.some(r => r.prompt === currentPrompt && r.step === 1)), 'Screenshot returned before cancellation');
      const before = await desktopState(); await click('[aria-label="停止生成"]'); releaseCancel();
      await check('cancel stops task before subsequent native input', async () => { const result = await finish(); assert.equal((await desktopState()).text, before.text); assert.equal(result.operations.some(o => o.name === 'desktop_type'), false); return { cancelled: true, noLaterInput: true }; });
    }
    report.status = 'passed';
  } catch (error) {
    report.status = 'failed'; report.error = error.stack; report.failedStage = stage; process.exitCode = 1;
    report.ui = await cdp?.evaluate('window.scodex.getAppState().then(s=>({text:document.body.innerText.slice(-7000),agentSettings:s.agentSettings,preferences:{computerControlEnabled:s.preferences.computerControlEnabled},conversations:s.library.conversations}))').catch(() => null);
    report.desktopStateAtFailure = await desktopState().catch(() => null);
  } finally {
    releaseCancel?.();
    if (fixture) { await fs.writeFile(stopFile, 'stop').catch(() => {}); await wait(() => Promise.resolve(fixture.exitCode !== null), 'Native fixture exited', 10000).catch(e => { report.fixtureExitError = e.message; }); }
    try { await quit(); report.processExited = true; } catch (error) { report.cleanupError = error.message; report.status = 'failed'; process.exitCode = 1; }
    if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
    if (report.processExited && (!fixture || fixture.exitCode !== null)) {
      assert.equal(path.dirname(path.resolve(temporary)).toLowerCase(), path.resolve(process.env.SystemRoot || 'C:\\Windows', 'Temp').toLowerCase());
      try { await fs.rm(temporary, { recursive: true }); report.fixtureRemoved = true; } catch (error) { report.fixtureRemoved = false; report.fixtureCleanupError = error.message; }
    }
    report.completedAt = new Date().toISOString(); await persist(); console.log(json({ status: report.status, checks: report.checks.length, failedStage: report.failedStage, error: report.error, report: path.join(output, 'ui-verification-' + scope + '.json') }));
  }
}
main();
