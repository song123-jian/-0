// Actual Electron program, React form, IPC and disk persistence; only /models is local.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const http = require('node:http');
const { spawn } = require('node:child_process');
const { connect, wait, freePort } = require('./agent-workflow-ui.cjs');
const root = path.resolve(__dirname, '..');
const executable = path.resolve(process.env.SCODEX_MODEL_PICKER_EXE || path.join(root, 'release/git-discard-reset-20261030/final/Scodex-Workbench-1.3.20-x64.exe'));
const version = process.env.SCODEX_MODEL_PICKER_VERSION || '1.3.22';
const scope = process.env.SCODEX_MODEL_PICKER_SCOPE || 'full';
const output = path.resolve(process.env.SCODEX_MODEL_PICKER_OUTPUT || path.join(root, 'release/model-picker-20261101', scope));
const temporary = path.join(process.env.SystemRoot || 'C:\\Windows', 'Temp', 'scodex-model-picker-' + crypto.randomUUID());
const workspace = path.join(temporary, 'project'), profile = path.join(temporary, 'profile'), home = path.join(temporary, 'home');
const initial = ['deepseek-v4-pro', 'deepseek-v4.1-flash', 'glm-5.3-flash', 'kimi-k3.1-pro'];
const large = Array.from({ length: 137 }, (_, index) => 'picker-model-' + String(index).padStart(3, '0'));
const json = JSON.stringify;
const report = { status: 'running', version, scope, executable, temporary, checks: [], requests: 0, environment: { platform: process.platform, node: process.version }, limitations: ['The model-list HTTP endpoint is a loopback fixture. The actual program, React, IPC and persistence are exercised. Public services are outside scope.'] };
let child, socket, cdp, server, endpoint, list = initial, listFails = false, stage = 'setup';
const reportPath = path.join(output, 'model-picker-ui.json');
async function persist() { await fs.writeFile(reportPath, json(report, null, 2) + '\n'); }
async function check(name, action) { stage = name; const evidence = await action(); report.checks.push({ name, status: 'passed', evidence }); await persist(); console.log('PASS ' + name); }
async function click(selector, text) {
  await wait(() => cdp.evaluate(`(()=>{const e=[...document.querySelectorAll(${json(selector)})].find(e=>${text ? `e.textContent.trim()===${json(text)}` : 'true'});if(!e||e.disabled)return false;e.click();return true})()`), 'Available ' + (text || selector));
}
async function openModels() {
  if (!await cdp.evaluate('Boolean(document.querySelector(".settings-category"))')) await click('[aria-label="设置"]');
  await click('.settings-category', '模型与连接');
  await wait(() => cdp.evaluate('Boolean(document.querySelector("#model-default"))'), 'Model form');
}
async function reload() {
  const origin = await cdp.evaluate('performance.timeOrigin');
  await cdp.command('Page.reload');
  await wait(() => cdp.evaluate(`performance.timeOrigin!==${origin}&&Boolean(window.scodex&&document.querySelector('[aria-label="设置"]'))`), 'Reloaded program');
}
async function launch() {
  const port = await freePort();
  child = spawn(executable, ['--remote-debugging-port=' + port, '--user-data-dir=' + profile, '--disable-gpu'], { cwd: path.dirname(executable), windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'], env: { ...process.env, SCODEX_HOME: home, SCODEX_REFERENCE_HOME: path.join(temporary, 'reference'), SCODEX_REFERENCE_AGENTS_HOME: path.join(temporary, 'agents') } });
  let stderr = ''; child.stderr.on('data', bytes => { stderr = (stderr + bytes).slice(-2000); });
  const target = await wait(async () => { if (child.exitCode !== null) throw Error('Program exited: ' + stderr); return (await fetch(`http://127.0.0.1:${port}/json/list`).then(r => r.json())).find(t => t.type === 'page' && t.url.startsWith('file:')); }, 'Program startup', 60000);
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
  cdp = connect(socket);
  await wait(() => cdp.evaluate('Boolean(window.scodex&&document.querySelector("[aria-label=设置]"))'), 'React ready');
  const state = await cdp.evaluate('window.scodex.getAppState().then(s=>({version:s.version,workspaceRoot:s.workspaceRoot,userDataPath:s.userDataPath}))');
  assert.equal(state.version, version); assert.equal(path.resolve(state.workspaceRoot), workspace); assert.equal(path.resolve(state.userDataPath), profile);
  return { ...state, renderer: target.url };
}
async function quit() {
  if (cdp) await cdp.evaluate('window.scodex.quitApp()');
  if (child) await wait(() => Promise.resolve(child.exitCode !== null), 'Program exit', 20000);
  socket?.close(); socket = cdp = null;
}
async function options(id) { return cdp.evaluate(`(()=>{const e=document.getElementById(${json(id)});return {tag:e.tagName,value:e.value,options:[...e.querySelectorAll('option')].map(o=>o.value)}})()`); }
async function select(id, value) {
  await cdp.evaluate(`(()=>{const e=document.getElementById(${json(id)});if(!(e instanceof HTMLSelectElement))throw Error('Expected unfiltered model selector');Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(e,${json(value)});e.dispatchEvent(new Event('change',{bubbles:true}));return true})()`);
  assert.equal((await options(id)).value, value);
}
async function insert(selector, value) {
  await cdp.evaluate(`(()=>{const e=document.querySelector(${json(selector)});e.focus();Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,${json(value)});e.dispatchEvent(new Event('input',{bubbles:true}));return true})()`);
}
async function key(key, virtual) { for (const type of ['keyDown', 'keyUp']) await cdp.command('Input.dispatchKeyEvent', { type, key, code: key, windowsVirtualKeyCode: virtual, nativeVirtualKeyCode: virtual }); }
async function save() {
  await click('.model-save-button');
  await wait(() => cdp.evaluate('document.querySelector(".model-message")?.textContent.includes("已保存")&&document.querySelector(".model-connection-form")?.getAttribute("aria-busy")==="false"'), 'Save completed');
  return cdp.evaluate('window.scodex.getModelConnection()');
}
async function fetchList() {
  await click('button', '获取模型列表');
  await wait(() => cdp.evaluate('document.querySelector(".model-message")?.textContent.includes("已获取")'), 'Fetched model list');
}
async function main() {
  await fs.mkdir(output, { recursive: true });
  try {
    for (const dir of [workspace, profile, home, path.join(temporary, 'reference'), path.join(temporary, 'agents')]) await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(profile, 'settings.json'), json({ workspaceRoot: workspace, preferences: { browserPanelOpen: false, trayEnabled: false } }));
    await fs.writeFile(path.join(home, 'codex-settings.json'), json({ workspaceDependencies: false, sandboxMode: 'workspace-write', approvalPolicy: 'never', networkAccess: true, networkDomains: ['*'], allowLocalBinding: true }));
    server = http.createServer((req, res) => { report.requests++; if (req.url !== '/v1/models') { res.writeHead(404); res.end(); return; } res.writeHead(listFails ? 503 : 200, { 'content-type': 'application/json' }); res.end(json(listFails ? { error: { message: 'fixture unavailable' } } : { data: [...list, list[0]].map(id => ({ id })) })); });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); endpoint = `http://127.0.0.1:${server.address().port}/v1`;
    report.sha256 = crypto.createHash('sha256').update(await fs.readFile(executable)).digest('hex');
    await check('Actual executable identity and isolated data', launch);
    await cdp.evaluate(`window.scodex.saveModelConnection({name:'模型下拉隔离验收',baseUrl:${json(endpoint)},models:${json(initial)},model:${json(initial[0])},subagentModel:'',apiKey:'model-picker-fixture'})`);
    await reload(); await openModels(); await fetchList();
    await check('All four fetched models remain selectable with an existing default', async () => {
      const main = await options('model-default'), subagent = await options('model-subagent');
      assert.equal(main.tag, 'SELECT', 'Default model must expose the full list instead of a value-filtered datalist');
      assert.deepEqual(main.options, initial); assert.equal(main.value, initial[0]);
      assert.equal(subagent.tag, 'SELECT'); assert.deepEqual(subagent.options, ['', ...initial]); assert.equal(subagent.value, '');
      return { main, subagent };
    });
    if (scope === 'red') { report.status = 'passed'; return; }
    await check('Native keyboard selection, save and disk readback', async () => {
      await cdp.evaluate('document.querySelector("#model-default").focus()');
      await key('ArrowDown', 40);
      await wait(async () => (await options('model-default')).value === initial[1], 'Keyboard selected second model');
      await select('model-subagent', initial[3]);
      const saved = await save(); assert.equal(saved.model, initial[1]); assert.equal(saved.subagentModel, initial[3]);
      const disk = JSON.parse(await fs.readFile(path.join(profile, 'model-connection.json'), 'utf8'));
      assert.equal(disk.config.model, initial[1]); assert.equal(disk.config.subagentModel, initial[3]);
      return { model: saved.model, subagentModel: saved.subagentModel, diskConfirmed: true };
    });
    await check('Full restart preserves both selectors and the full option list', async () => {
      await quit(); await launch(); await openModels();
      const main = await options('model-default'), subagent = await options('model-subagent');
      assert.deepEqual(main.options, initial); assert.equal(main.value, initial[1]); assert.equal(subagent.value, initial[3]);
      return { main, subagent };
    });
    if (scope === 'formal') {
      await cdp.evaluate('document.querySelector("#model-default").scrollIntoView({block:"center"})');
      const screenshot = await cdp.command('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
      report.screenshot = path.join(output, 'model-picker.png'); await fs.writeFile(report.screenshot, Buffer.from(screenshot.data, 'base64'));
      report.status = 'passed'; return;
    }
    await check('Manual addition and removal update both selectors; follow main remains available', async () => {
      await click('button', '手动添加'); await insert('[aria-label="手动添加模型 ID"]', 'manual-model'); await click('.model-inline-add button', '添加');
      assert.deepEqual((await options('model-default')).options, [...initial, 'manual-model']);
      await select('model-default', 'manual-model'); await select('model-subagent', '');
      let saved = await save(); assert.equal(saved.model, 'manual-model'); assert.equal(saved.subagentModel, '');
      await select('model-default', initial[0]); await click('[aria-label="移除模型 manual-model"]');
      assert.deepEqual((await options('model-default')).options, initial); assert.deepEqual((await options('model-subagent')).options, ['', ...initial]);
      saved = await save(); return { model: saved.model, subagentModel: saved.subagentModel, manualRemoved: !saved.models.includes('manual-model') };
    });
    await check('137-model refresh, selection and failed fetch preserve the complete list', async () => {
      list = large; await fetchList(); assert.deepEqual((await options('model-default')).options, large);
      await select('model-default', large[136]); await select('model-subagent', large[68]); await save();
      listFails = true; await click('button', '获取模型列表');
      await wait(() => cdp.evaluate('Boolean(document.querySelector(".model-message.error"))'), 'Fetch error shown');
      assert.deepEqual((await options('model-default')).options, large); assert.equal((await options('model-default')).value, large[136]);
      return { count: large.length, model: large[136], subagentModel: (await options('model-subagent')).value, fetchFailurePreservesSelection: true };
    });
    await check('Narrow layout and visible model fields', async () => {
      await cdp.command('Emulation.setDeviceMetricsOverride', { width: 1064, height: 660, deviceScaleFactor: 1, mobile: false });
      await cdp.evaluate('document.querySelector("#model-subagent").scrollIntoView({block:"center"})');
      const layout = await cdp.evaluate('({width:innerWidth,documentWidth:document.documentElement.scrollWidth,fields:[...document.querySelectorAll(".model-and-effort select")].map(e=>{const r=e.getBoundingClientRect();const s=getComputedStyle(e);return {width:r.width,left:r.left,right:r.right,minHeight:s.minHeight,fontSize:s.fontSize}})})');
      assert.ok(layout.documentWidth <= layout.width); assert.equal(layout.fields.length, 2); for (const field of layout.fields) { assert.ok(field.width > 100); assert.ok(field.left >= 0 && field.right <= layout.width); assert.ok(parseFloat(field.minHeight) >= 38); }
      const screenshot = await cdp.command('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
      report.screenshot = path.join(output, 'model-picker.png'); await fs.writeFile(report.screenshot, Buffer.from(screenshot.data, 'base64'));
      return layout;
    });
    report.status = 'passed';
  } catch (error) { report.status = 'failed'; report.failedStage = stage; report.error = error.stack; console.error(error); process.exitCode = 1; }
  finally {
    try { await quit(); report.processExited = true; } catch (error) { report.exitError = error.message; report.status = 'failed'; process.exitCode = 1; }
    if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
    if (report.processExited) {
      assert.equal(path.dirname(path.resolve(temporary)).toLowerCase(), path.resolve(process.env.SystemRoot || 'C:\\Windows', 'Temp').toLowerCase());
      try { await fs.rm(temporary, { recursive: true }); report.cleanup = 'passed'; } catch (error) { report.cleanup = 'failed'; report.cleanupError = error.message; }
    }
    report.completedAt = new Date().toISOString(); await persist(); console.log(json({ status: report.status, checks: report.checks.length, failedStage: report.failedStage, report: reportPath, cleanup: report.cleanup }));
  }
}
main();
