// Real Electron UI, persistence and IPC. Only the public model HTTP service is
// replaced by a loopback server, including a real incremental streaming response.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises'), path = require('node:path'), crypto = require('node:crypto'), http = require('node:http');
const { spawn } = require('node:child_process');
const { connect, wait, freePort } = require('./agent-workflow-ui.cjs');
const root = path.resolve(__dirname, '..'), json = JSON.stringify;
const output = path.resolve(process.env.SCODEX_WORKSPACE_OUTPUT || path.join(root, 'release/advisor-repair-20261107/workspace-ui'));
const executable = process.env.SCODEX_WORKSPACE_EXE || path.join(root, 'release/advisor-repair-20261107/candidate/win-unpacked/Scodex工作台.exe');
const fixture = path.join(output, 'fixture-' + crypto.randomUUID()), profile = path.join(fixture, 'profile'), home = path.join(fixture, 'home');
const keys = { main: crypto.randomUUID(), subagent: crypto.randomUUID(), advisor: crypto.randomUUID() };
const nextKeys = { main: crypto.randomUUID(), subagent: crypto.randomUUID(), advisor: crypto.randomUUID() };
const report = { status: 'running', version: require('../package.json').version, executable, fixture, checks: [], limitations: ['Actual packaged app with isolated settings/history and loopback model service; no public-provider coverage is claimed by this test.'] };
const layoutOnly = process.env.SCODEX_WORKSPACE_LAYOUT_ONLY === '1';
let app, socket, page, server, base, chunks = 0;
const persist = () => fs.writeFile(path.join(output, 'workspace-model-ui.json'), json(report, null, 2));
async function check(name, fn) { report.checks.push({ name, status: 'passed', evidence: await fn() }); await persist(); console.log('PASS ' + name); }
async function click(css, text) { await wait(() => page.evaluate('(()=>{const e=[...document.querySelectorAll(' + json(css) + ')].find(e=>' + (text ? 'e.textContent.trim()===' + json(text) : 'true') + ');if(!e||e.disabled)return false;e.click();return true})()'), 'Click ' + (text || css)); }
async function input(css, value) { await page.evaluate('(()=>{const e=document.querySelector(' + json(css) + ');if(!e)throw Error("Missing input");e.focus();const p=e instanceof HTMLSelectElement?HTMLSelectElement.prototype:e instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(p,"value").set.call(e,' + json(value) + ');e.dispatchEvent(new Event(e instanceof HTMLSelectElement?"change":"input",{bubbles:true}));})()'); }
const getSaved = () => page.evaluate('window.scodex.getModelConnection()');
const values = () => page.evaluate('Object.fromEntries(["model-api-key","model-subagent-api-key","model-advisor-api-key","model-default","model-subagent","model-advisor"].map(id=>[id,document.getElementById(id).value]))');
const geometry = () => page.evaluate('(()=>{const e=document.querySelector(".conversation-scroll");return {top:e.scrollTop,height:e.scrollHeight,client:e.clientHeight,bottom:e.scrollHeight-e.scrollTop-e.clientHeight<48}})()');
async function reload() { const origin = await page.evaluate('performance.timeOrigin'); await page.command('Page.reload'); await wait(() => page.evaluate('performance.timeOrigin!==' + origin + '&&Boolean(document.querySelector("[aria-label=输入工作内容]"))'), 'Reload'); }
async function setup() {
  await fs.mkdir(profile, { recursive: true }); await fs.mkdir(home, { recursive: true }); const now = new Date().toISOString();
  const messages = Array.from({ length: 24 }, (_, i) => [{ id: 'user-' + i, role: 'user', content: '历史需求 ' + (i + 1) + '：编辑模型配置并保留其他输入。' }, { id: 'answer-' + i, role: 'assistant', content: ('第 ' + (i + 1) + ' 条回复，历史阅读与滚动验证。\n').repeat(10) }]).flat();
  await fs.writeFile(path.join(profile, 'conversations.json'), json({ version: 2, activeId: 'workspace-test', conversations: [{ id: 'workspace-test', title: '工作区模型与消息验收', mode: 'answer', executionEnabled: false, createdAt: now, updatedAt: now, messages }, { id: 'other-test', title: '另一条会话', mode: 'answer', createdAt: now, updatedAt: now, messages: [{ id: 'other-user', role: 'user', content: '另一会话的需求' }, { id: 'other-answer', role: 'assistant', content: '另一会话内容' }] }] }));
  await fs.writeFile(path.join(profile, 'settings.json'), json({ projects: [], activeProjectId: '', preferences: { contextAccess: 'full', browserPanelOpen: false, trayEnabled: false, closeConfirmation: 'never' } }));
  await fs.writeFile(path.join(home, 'codex-settings.json'), json({ sandboxMode: 'read-only', approvalPolicy: 'never', networkAccess: true, networkDomains: ['127.0.0.1'], workspaceDependencies: false }));
  server = http.createServer(async (req, res) => {
    if (req.url.endsWith('/models')) { const role = req.url.includes('/child') ? 'subagent' : req.url.includes('/advisor') ? 'advisor' : 'main'; const key = nextKeys[role]; if (req.headers.authorization !== 'Bearer ' + key) { res.writeHead(401); res.end(); return; } res.setHeader('content-type', 'application/json'); res.end(json({ data: [{ id: role + '-discovered' }] })); return; }
    let raw = ''; for await (const part of req) raw += part;
    if (req.headers.authorization !== 'Bearer ' + nextKeys.main) { res.writeHead(401); res.end(); return; }
    res.writeHead(200, { 'content-type': 'text/event-stream' });
    let count = 0; const timer = setInterval(() => { chunks++; res.write('data: ' + json({ choices: [{ delta: { content: '流式内容 ' + (++count) + '。\n' } }] }) + '\n\n'); if (count === 35) { clearInterval(timer); res.end('data: [DONE]\n\n'); } }, 70);
    res.on('close', () => clearInterval(timer));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); base = 'http://127.0.0.1:' + server.address().port;
  const port = await freePort(); app = spawn(executable, ['--remote-debugging-port=' + port, '--user-data-dir=' + profile, '--disable-gpu'], { cwd: output, windowsHide: true, stdio: 'ignore', env: { ...process.env, SCODEX_HOME: home, SCODEX_REFERENCE_HOME: path.join(fixture, 'reference'), SCODEX_REFERENCE_AGENTS_HOME: path.join(fixture, 'agents') } });
  const target = await wait(async () => { if (app.exitCode !== null) throw Error('App exited'); return (await fetch('http://127.0.0.1:' + port + '/json/list').then(r => r.json())).find(t => t.type === 'page' && t.url.startsWith('file:')); }, 'Startup', 45000);
  socket = new WebSocket(target.webSocketDebuggerUrl); await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); }); page = connect(socket);
  await wait(() => page.evaluate('Boolean(document.querySelector("[aria-label=输入工作内容]"))'), 'Renderer'); assert.equal((await page.evaluate('window.scodex.getAppState()')).version, report.version);
  await page.evaluate('window.scodex.saveModelConnection(' + json({ name: '独立保存验收', baseUrl: base + '/main/v1', apiKey: keys.main, model: 'm1', models: ['m1', 'm2'], subagentBaseUrl: base + '/child/v1', subagentApiKey: keys.subagent, subagentModels: ['c1', 'c2'], subagentModel: 'c1', advisorBaseUrl: base + '/advisor/v1', advisorApiKey: keys.advisor, advisorModels: ['a1', 'a2'], advisorModel: 'a1', advisorEnabled: false, retryLimit: 0 }) + ')'); await reload();
}
async function main() {
  await setup();
  if (!layoutOnly) {
  await check('workspace-opens-complete-model-dialog-and-focus', async () => {
    assert.equal((await geometry()).bottom, true);
    await click('[aria-label="模型与连接"]'); await wait(() => page.evaluate('Boolean(document.querySelector("dialog.model-connection-dialog[open]"))'), 'Dialog');
    assert.equal(await page.evaluate('document.activeElement.closest("dialog")!==null'), true);
    for (const id of ['model-base-url', 'model-api-key', 'model-default', 'model-subagent-base-url', 'model-subagent-api-key', 'model-subagent', 'model-advisor-base-url', 'model-advisor-api-key', 'model-advisor']) assert.equal(await page.evaluate('Boolean(document.getElementById(' + json(id) + '))'), true);
    return { controls: 9, chatRemainsOpen: await page.evaluate('Boolean(document.querySelector(".task-chat-view"))') };
  });
  await check('three-independent-saves-preserve-other-unsaved-inputs', async () => {
    await input('#model-api-key', nextKeys.main); await input('#model-subagent-api-key', nextKeys.subagent); await input('#model-advisor-api-key', nextKeys.advisor);
    await input('#model-default', 'm2'); await input('#model-subagent', 'c2'); await input('#model-advisor', 'a2'); await input('#model-service-note', '主模型备注已更改');
    await input('#model-base-url', base + '/main-edited/v1'); await input('#model-subagent-base-url', base + '/child-edited/v1'); await input('#model-advisor-base-url', base + '/advisor-edited/v1');
    await click('.model-role-save', '保存模型一'); await wait(async () => (await getSaved()).model === 'm2', 'Main persisted');
    let draft = await values(), saved = await getSaved(); assert.equal(draft['model-api-key'], ''); assert.equal(draft['model-subagent-api-key'], nextKeys.subagent); assert.equal(draft['model-advisor-api-key'], nextKeys.advisor); assert.equal(draft['model-subagent'], 'c2'); assert.equal(saved.subagentModel, 'c1'); assert.equal(saved.advisorModel, 'a1'); assert.equal(saved.note, '主模型备注已更改');
    await input('#model-subagent-base-url', 'invalid-address'); await click('.model-role-save', '保存模型二'); await wait(() => page.evaluate('Boolean(document.querySelector(".model-message.error"))'), 'Rejected invalid URL');
    draft = await values(); assert.equal(draft['model-subagent-api-key'], nextKeys.subagent); assert.equal(draft['model-advisor-api-key'], nextKeys.advisor); assert.equal((await getSaved()).subagentModel, 'c1');
    await input('#model-subagent-base-url', base + '/child-edited/v1'); await click('.model-role-save', '保存模型二'); await wait(async () => (await getSaved()).subagentModel === 'c2', 'Child persisted');
    draft = await values(); assert.equal(draft['model-subagent-api-key'], ''); assert.equal(draft['model-advisor-api-key'], nextKeys.advisor); assert.equal((await getSaved()).advisorModel, 'a1');
    await click('.model-role-save', '保存模型三'); await wait(async () => (await getSaved()).advisorModel === 'a2', 'Advisor persisted');
    const disk = await fs.readFile(path.join(profile, 'model-connection.json'), 'utf8'); for (const key of [...Object.values(keys), ...Object.values(nextKeys)]) assert.ok(!disk.includes(key));
    return { independentRoles: 3, errorRetainsInputs: true, encrypted: true };
  });
  await check('all-role-model-discovery-and-complete-config-persist', async () => {
    await click('.model-small-button', '获取模型列表'); await wait(() => page.evaluate('document.querySelector("#model-default option")?.value==="main-discovered"'), 'Main discovery');
    await click('.model-small-button', '获取模型二列表'); await wait(() => page.evaluate('Boolean(document.querySelector("#model-subagent option[value=subagent-discovered]"))'), 'Child discovery');
    await click('.model-small-button', '获取模型三列表'); await wait(() => page.evaluate('Boolean(document.querySelector("#model-advisor option[value=advisor-discovered]"))'), 'Advisor discovery');
    await input('#model-subagent', 'subagent-discovered'); await input('#model-advisor', 'advisor-discovered');
    await click('.model-save-button'); await wait(async () => (await getSaved()).advisorModel === 'advisor-discovered', 'All saved');
    await page.command('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 }); await page.command('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 }); await wait(() => page.evaluate('!document.querySelector("dialog.model-connection-dialog")'), 'Escape closes');
    await click('[aria-label="模型与连接"]'); const saved = await getSaved(); assert.equal(saved.model, 'main-discovered'); assert.equal(saved.subagentModel, 'subagent-discovered'); assert.equal(saved.advisorModel, 'advisor-discovered'); assert.equal((await values())['model-api-key'], '');
    await click('[aria-label="关闭模型与连接"]'); return { discoveryRoles: 3, reopensSaved: true, escape: true };
  });
  await check('request-navigation-latest-and-streaming-preserve-reading-position', async () => {
    assert.equal(await page.evaluate('document.querySelectorAll(".request-timeline button").length'), 24);
    await click('.request-timeline button'); const before = await geometry(); assert.ok(before.top < 100); assert.equal(before.bottom, false); assert.equal(await page.evaluate('Boolean(document.querySelector("[aria-label=回到最新消息]"))'), true);
    await click('[aria-label="回到最新消息"]'); assert.equal((await geometry()).bottom, true);
    await page.evaluate('window.__terminal=null;window.scodex.onChatEvent(e=>{if(["complete","error","cancelled"].includes(e.type))window.__terminal=e})');
    await input('[aria-label="输入工作内容"]', '滚动验收，请分段回复。'); await click('[aria-label="发送消息"]'); await wait(() => chunks > 3, 'Streaming');
    await click('.request-timeline button'); const reading = await geometry(), count = chunks; await wait(() => chunks > count + 6, 'More stream data'); const during = await geometry(); assert.ok(Math.abs(during.top - reading.top) < 3);
    await click('[aria-label="模型与连接"]'); assert.equal(await page.evaluate('document.querySelector("#model-base-url").disabled'), false); assert.equal(await page.evaluate('document.querySelector(".model-role-save").disabled'), true); await input('#model-service-note', '运行中可以编辑草稿'); await click('[aria-label="关闭模型与连接"]');
    await wait(() => page.evaluate('window.__terminal?.type==="complete"'), 'Completed streaming'); assert.ok((await geometry()).top < 100); await click('[aria-label="回到最新消息"]'); assert.equal((await geometry()).bottom, true);
    await page.evaluate('window.__terminal=null'); await input('[aria-label="输入工作内容"]', '继续滚动验收。'); await click('[aria-label="发送消息"]'); await wait(() => page.evaluate('window.__terminal?.type==="complete"'), 'Follow completion'); await wait(async () => (await geometry()).bottom, 'Follow newest');
    return { historicalRequests: 24, followsWhenAtBottom: true, preservesHistoricalPosition: true, busyDraftEditable: true, busySaveDisabled: true };
  });
  }
  await check('conversation-switch-keyboard-and-narrow-dialog-layout', async () => {
    const countBefore = await page.evaluate('document.querySelectorAll(".request-timeline button").length');
    await click('[data-chat-id="other-test"]'); await wait(() => page.evaluate('document.querySelectorAll(".request-timeline button").length===1'), 'Other conversation'); assert.equal((await geometry()).bottom, true);
    await click('[data-chat-id="workspace-test"]'); await wait(() => page.evaluate('document.querySelectorAll(".request-timeline button").length===' + countBefore), 'Original conversation'); assert.equal((await geometry()).bottom, true);
    await page.command('Page.bringToFront'); await page.evaluate('document.querySelector(".request-timeline button").focus({preventScroll:true})'); await page.command('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', text: '\r', windowsVirtualKeyCode: 13 }); await page.command('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 }); await wait(async () => !(await geometry()).bottom, 'Keyboard navigation');
    await page.command('Emulation.setDeviceMetricsOverride', { width: 600, height: 720, deviceScaleFactor: 1, mobile: false }); await click('[aria-label="模型与连接"]');
    const layout = await page.evaluate('(()=>{const d=document.querySelector("dialog"),b=document.querySelector(".model-dialog-body"),r=d.getBoundingClientRect();return {width:innerWidth,left:r.left,right:r.right,bodyScroll:b.scrollHeight>b.clientHeight,overflow:b.scrollWidth>b.clientWidth+1,focusInside:d.contains(document.activeElement)}})()'); assert.equal(layout.overflow, false); assert.ok(layout.left >= 0 && layout.right <= layout.width); assert.equal(layout.focusInside, true); assert.equal(layout.bodyScroll, true);
    await page.command('Emulation.setDeviceMetricsOverride', { width: 1064, height: 660, deviceScaleFactor: 1, mobile: false });
    await click('[aria-label="关闭模型与连接"]'); await page.evaluate('document.querySelector(".request-timeline button").focus({preventScroll:true})');
    const navigation = await page.evaluate('(()=>{const rail=document.querySelector(".request-timeline").getBoundingClientRect(),root=document.querySelector(".message-timeline").getBoundingClientRect(),popup=document.querySelector(".request-preview").getBoundingClientRect();return {railLeft:rail.left,rootLeft:root.left,railWidth:rail.width,popupLeft:popup.left,popupRight:popup.right,popupTop:popup.top,popupBottom:popup.bottom,rootTop:root.top,rootBottom:root.bottom,width:innerWidth,text:document.querySelector(".request-preview").innerText}})()');
    assert.ok(navigation.railLeft - navigation.rootLeft < 12); assert.ok(navigation.railWidth <= 32); assert.ok(navigation.popupLeft > navigation.railLeft); assert.ok(navigation.popupRight <= navigation.width); assert.ok(navigation.popupTop >= navigation.rootTop && navigation.popupBottom <= navigation.rootBottom); assert.match(navigation.text, /历史需求 1/);
    const shot = await page.command('Page.captureScreenshot', { format: 'png' }); await fs.writeFile(path.join(output, 'workspace-model-final.png'), Buffer.from(shot.data, 'base64'));
    return { layout, navigation };
  });
  report.status = 'passed';
}
main().catch(error => { report.status = 'failed'; report.error = error.stack; process.exitCode = 1; }).finally(async () => {
  try { if (page && app?.exitCode === null) { await page.evaluate('window.scodex.quitApp()'); await wait(() => app.exitCode !== null, 'Normal shutdown', 30000); assert.equal(app.exitCode, 0); } } catch (error) { report.shutdownError = error.stack; process.exitCode = 1; report.status = 'failed'; }
  socket?.close(); if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); } report.exitCode = app?.exitCode; report.finishedAt = new Date().toISOString(); report.exeSha256 = crypto.createHash('sha256').update(await fs.readFile(executable)).digest('hex'); await persist(); console.log(json({ status: report.status, checks: report.checks.length }));
});
