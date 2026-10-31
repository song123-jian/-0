// Packaged desktop EXE and real loopback SSE/OAuth services; only model replies are fixtures.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const http = require('node:http');
const { spawn } = require('node:child_process');
const { connect, wait, freePort } = require('./agent-workflow-ui.cjs');
const { createSseFixture } = require('./mcp-fixture.cjs');
const { createOAuthFixture } = require('./mcp-oauth-fixture.cjs');
const { toolAlias } = require('../electron/mcp-runtime.cjs');
const json = JSON.stringify, root = path.resolve(__dirname, '..'), version = '1.3.17';
const output = path.resolve(process.env.SCODEX_SSE_OUTPUT || path.join(root, 'release/mcp-sse-20261030/candidate-ui'));
const executable = path.resolve(process.env.SCODEX_SSE_EXE || path.join(root, 'release/mcp-sse-20261030/candidate/Scodex-Workbench-1.3.17-x64.exe'));
const fixture = path.join(os.tmpdir(), 'scodex-sse-ui-' + crypto.randomUUID());
const profile = path.join(fixture, 'profile'), project = path.join(fixture, 'project'), home = path.join(fixture, 'scodex'), logFile = path.join(fixture, 'calls.jsonl');
const privateToken = 'isolated-sse-' + crypto.randomUUID();
const entryOnly = process.env.SCODEX_SSE_SCOPE === 'entry';
const entryChecks = new Set(['packaged-exe-identity', 'sse-form-encrypted-save-and-connect', 'sse-layout-readability-and-final-screenshot']);
const report = { status: 'running', scope: entryOnly ? 'formal-entry' : 'full-candidate', version, executable, fixture, checks: [], requests: [], environment: { platform: os.platform(), release: os.release(), node: process.version }, limitations: ['Real packaged EXE, React UI, IPC, Windows encryption and SDK SSE/OAuth services. Only model responses use a controlled loopback endpoint.', 'CDP drives actual renderers; no public model/OAuth account, native Windows mouse or file-picker compatibility is claimed.'] };
let child, socket, cdp, port, sse, oauth, model, sseId, oauthId;
const authSockets = new Set();
const save = () => fs.writeFile(path.join(output, 'mcp-sse-ui-verification.json'), json(report, null, 2) + '\n');
const evaluate = value => cdp.evaluate(value);
const state = () => evaluate('window.scodex.listMcpConnections()');
const info = async id => (await state()).servers.find(server => server.id === id);
const card = id => '[data-mcp-id="' + id + '"]';
async function check(name, fn) { if (entryOnly && !entryChecks.has(name)) return; report.currentCheck = name; await save(); const evidence = await fn(); report.checks.push({ name, status: 'passed', evidence }); await save(); console.log('PASS ' + name); }
async function textClick(selector, text, client = cdp) {
  await wait(() => client.evaluate('(()=>{const e=[...document.querySelectorAll(' + json(selector) + ')].find(e=>e.textContent.trim()===' + json(text) + ');if(!e||e.disabled)return false;e.click();return true})()'), 'Button ' + text);
}
async function click(label) { await wait(() => evaluate('(()=>{const e=document.querySelector(' + json('[aria-label="' + label + '"]') + ');if(!e||e.disabled)return false;e.click();return true})()'), label); }
async function insert(label, value) {
  await evaluate('(()=>{const e=document.querySelector(' + json('[aria-label="' + label + '"]') + ');if(!e)throw Error("Missing input");const p=e instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:e instanceof HTMLSelectElement?HTMLSelectElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(p,"value").set.call(e,' + json(value) + ');e.dispatchEvent(new Event(e instanceof HTMLSelectElement?"change":"input",{bubbles:true}));return true})()');
}
async function plugins() { await evaluate('document.querySelector(".workbench-primary-nav [aria-label=插件]").click()'); await textClick('.extension-segment button', 'MCP 连接'); await wait(() => evaluate('!!document.querySelector(".mcp-connections")'), 'MCP page'); }
async function reload() { await cdp.command('Page.reload'); await wait(() => evaluate('!!document.querySelector("[aria-label=输入工作内容]")'), 'Renderer ready'); }
const targets = () => fetch('http://127.0.0.1:' + port + '/json/list').then(response => response.json());
async function attach(target) { const ws = new WebSocket(target.webSocketDebuggerUrl); await new Promise((resolve, reject) => { ws.addEventListener('open', resolve, { once: true }); ws.addEventListener('error', reject, { once: true }); }); return { socket: ws, cdp: connect(ws) }; }
async function launch() {
  port = await freePort(); child = spawn(executable, ['--remote-debugging-port=' + port, '--user-data-dir=' + profile, '--disable-gpu'], { cwd: path.dirname(executable), windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'], env: { ...process.env, SCODEX_HOME: home, SCODEX_REFERENCE_HOME: path.join(fixture, 'reference'), SCODEX_REFERENCE_AGENTS_HOME: path.join(fixture, 'agents') } });
  let stderr = ''; child.stderr.on('data', bytes => { stderr = (stderr + bytes.toString()).slice(-3000); });
  const target = await wait(async () => { if (child.exitCode !== null) throw Error('EXE exited: ' + stderr); return (await targets()).find(item => item.type === 'page' && item.url.startsWith('file:')); }, 'Packaged startup', 60000);
  const main = await attach(target); socket = main.socket; cdp = main.cdp;
  await wait(() => evaluate('!!document.querySelector("[aria-label=输入工作内容]")'), 'Actual renderer');
  const identity = await evaluate('window.scodex.getAppState().then(s=>({version:s.version,workspaceRoot:s.workspaceRoot,userDataPath:s.userDataPath}))');
  assert.equal(identity.version, version); assert.equal(path.resolve(identity.workspaceRoot), project); report.pid = child.pid;
  return { ...identity, pageUrl: target.url };
}
async function quit() {
  if (!child || child.exitCode !== null || !socket || socket.readyState !== 1) return;
  await evaluate('window.scodex.quitApp()');
  await wait(async () => { try { await targets(); return false; } catch { return true; } }, 'Desktop main exit', 20000);
  await wait(() => Promise.resolve(child.exitCode !== null), 'Portable exit', 15000);
  assert.equal(child.exitCode, 0); report.exitCode = child.exitCode; socket.close();
}
async function addConnection(name, url, authMode = 'bearer') {
  await plugins(); await textClick('.mcp-section-heading button', '添加连接');
  const options = await evaluate('[...document.querySelector(' + json('[aria-label="MCP 连接方式"]') + ').options].map(o=>o.value)');
  assert.deepEqual(options, ['stdio', 'http', 'sse']);
  await insert('MCP 连接名称', name); await insert('MCP 连接方式', 'sse'); await insert('MCP 服务地址', url);
  if (authMode === 'oauth') { await insert('MCP 认证方式', 'oauth'); await insert('MCP 请求头', json({ 'X-MCP-Private': 'controlled-header' })); }
  else { await insert('MCP Bearer 认证', privateToken); await insert('MCP 请求头', json({ 'X-Fixture-Key': 'ui-custom-header' })); }
  await textClick('.mcp-editor-actions button', '保存连接');
  await wait(() => evaluate('!document.querySelector(".mcp-editor")'), 'Editor closed');
  return (await state()).servers.find(server => server.name === name).id;
}
async function preview(id, name, expected) {
  await textClick(card(id) + ' button', '浏览资料目录');
  await wait(() => evaluate('!!document.querySelector(' + json(card(id) + ' select') + ')'), 'Actual resource catalog');
  const selected = await evaluate('[...document.querySelectorAll(' + json(card(id) + ' select option') + ')].find(o=>o.textContent.endsWith(' + json(' · ' + name) + '))?.value');
  assert.ok(selected); const server = await info(id); await insert('MCP资料选择 ' + server.name, selected);
  await textClick(card(id) + ' button', '读取预览');
  const content = await wait(() => evaluate('document.querySelector(' + json(card(id) + ' .mcp-context-preview pre') + ')?.textContent'), 'Resource preview');
  assert.match(content, expected); assert.equal(content.includes(privateToken), false); assert.doesNotMatch(content, /fixture-access-/);
  return content;
}
async function newChat() { await evaluate('document.querySelector(".activity-rail [aria-label=项目]").click()'); await click('新聊天'); await wait(() => evaluate('!document.querySelector(".message-list")'), 'New chat'); if (await evaluate('document.querySelector("[aria-label=执行任务]").getAttribute("aria-pressed")') !== 'true') await click('执行任务'); }
const submit = async prompt => { await insert('输入工作内容', prompt); await click('发送消息'); };
async function approve(allow = true) { await wait(() => evaluate('!!document.querySelector(".agent-approval")'), 'Exact MCP approval'); const content = await evaluate('document.querySelector(".agent-approval").innerText'); await textClick('.agent-approval-actions button', allow ? '允许本次调用' : '拒绝'); return content; }
async function finish() { await wait(() => evaluate('!document.querySelector("[aria-label=停止生成]")'), 'Model task completed', 45000); return evaluate('document.querySelector(".message-list")?.innerText || ""'); }
const logs = async () => (await fs.readFile(logFile, 'utf8').catch(() => '')).trim().split('\n').filter(Boolean).map(JSON.parse);
function reply(res, delta) { res.writeHead(200, { 'content-type': 'text/event-stream' }); res.end('data: ' + json({ choices: [{ delta }] }) + '\n\ndata: ' + json({ choices: [{ delta: {}, finish_reason: delta.tool_calls ? 'tool_calls' : 'stop' }] }) + '\n\ndata: [DONE]\n\n'); }
async function modelReply(body, res) {
  const last = body.messages.findLastIndex(value => value.role === 'user'), prompt = String(body.messages[last].content);
  const results = body.messages.slice(last + 1).filter(value => value.role === 'tool').map(value => JSON.parse(value.content));
  assert.equal(json(results).includes(privateToken), false);
  report.requests.push({ case: prompt.includes('拒绝') ? 'deny' : prompt.includes('取消') ? 'cancel' : 'success', completed: results.length });
  if (results.length) return reply(res, { content: results.every(result => result.ok) ? 'SSE 实际工具已完成。' : 'SSE 工具拒绝已保留。' });
  const tool = prompt.includes('取消') ? 'slow' : prompt.includes('拒绝') ? 'record' : 'echo';
  return reply(res, { tool_calls: [{ index: 0, id: 'call_' + crypto.randomBytes(5).toString('hex'), type: 'function', function: { name: toolAlias(sseId, tool), arguments: json(tool === 'slow' ? {} : { message: 'SSE 中文调用核对' }) } }] });
}
async function main() {
  try {
    await fs.mkdir(output, { recursive: true });
    for (const directory of [profile, project, home]) await fs.mkdir(directory, { recursive: true });
    await fs.writeFile(path.join(profile, 'settings.json'), json({ workspaceRoot: project, preferences: { contextAccess: 'manual', browserPanelOpen: false, trayEnabled: false, themeMode: 'light', fontFamily: 'Microsoft YaHei', fontSize: 16 } }));
    await fs.writeFile(path.join(home, 'codex-settings.json'), json({ sandboxMode: 'danger-full-access', approvalPolicy: 'on-request', workspaceDependencies: false }));
    sse = await createSseFixture({ token: privateToken, secret: privateToken, logFile }); oauth = await createOAuthFixture({ sse: true, expiresIn: 3600 });
    model = http.createServer(async (req, res) => { try { let body = ''; for await (const chunk of req) body += chunk; await modelReply(JSON.parse(body), res); } catch (error) { report.modelError = error.message; if (!res.headersSent) res.writeHead(500); res.end(); } });
    await new Promise(resolve => model.listen(0, '127.0.0.1', resolve));
    report.sha256 = crypto.createHash('sha256').update(await fs.readFile(executable)).digest('hex');
    await check('packaged-exe-identity', launch);
    await evaluate('window.scodex.saveModelConnection(' + json({ name: 'SSE 隔离验收', baseUrl: 'http://127.0.0.1:' + model.address().port + '/v1', model: 'fixture-sse', models: ['fixture-sse'], toolProtocol: 'native', apiKey: 'isolated-fixture-only' }) + ')'); await reload();
    await check('sse-form-encrypted-save-and-connect', async () => {
      sseId = await addConnection('SSE 项目服务', sse.url);
      assert.equal((await info(sseId)).status, 'disconnected'); assert.equal(sse.seen.length, 0);
      const disk = await fs.readFile(path.join(profile, 'mcp-connections.json'), 'utf8'); assert.equal(disk.includes(privateToken), false); assert.ok(JSON.parse(disk).servers[0].encrypted);
      await textClick(card(sseId) + ' button', '连接'); await wait(async () => (await info(sseId)).status === 'connected', 'Real SSE connection');
      const visible = await evaluate('document.querySelector(' + json(card(sseId)) + ').innerText'); assert.match(visible, /SSE（兼容旧服务）/);
      const text = await preview(sseId, 'SSE 项目资料', /S7419/);
      assert.ok(sse.seen.some(row => row.method === 'GET' && row.auth === 'Bearer ' + privateToken && row.custom === 'ui-custom-header'));
      assert.ok(sse.seen.some(row => row.method === 'POST' && row.auth === 'Bearer ' + privateToken && row.custom === 'ui-custom-header'));
      return { encrypted: true, noAutomaticStart: true, authenticatedGetAndPost: true, preview: text };
    });
    await check('sse-model-approval-denial-and-cancellation', async () => {
      await newChat(); await submit('SSE 成功'); assert.match(await approve(), /SSE 项目服务/); assert.match(await finish(), /实际工具已完成/);
      await newChat(); await submit('SSE 拒绝'); await approve(false); await finish(); assert.equal((await logs()).some(row => row.name === 'record'), false);
      await newChat(); await submit('SSE 取消'); await approve(); await wait(async () => (await logs()).some(row => row.name === 'slow'), 'Actual slow SSE tool reached service'); await click('停止生成'); await finish();
      assert.equal((await info(sseId)).status, 'connected'); return { approvedEcho: true, deniedRecordNeverReachedService: true, actualCallCancelled: true };
    });
    await check('sse-oauth-in-independent-window-and-real-resource', async () => {
      oauthId = await addConnection('SSE OAuth 资料', oauth.url, 'oauth'); await textClick(card(oauthId) + ' button', '授权并连接');
      const target = await wait(async () => (await targets()).find(item => item.url.startsWith(oauth.issuer + '/authorize')), 'Independent OAuth authorization page');
      const win = await attach(target); authSockets.add(win.socket); await textClick('button', '允许授权', win.cdp);
      await wait(async () => !(await targets()).some(item => item.url.startsWith(oauth.issuer + '/authorize')), 'Authorization window closed'); win.socket.close(); authSockets.delete(win.socket);
      await wait(async () => (await info(oauthId)).status === 'connected', 'SSE OAuth connected');
      const text = await preview(oauthId, '已授权的项目资料', /O8351/);
      assert.ok(oauth.events.some(event => event.server === 'mcp' && event.method === 'POST' && event.path === '/messages' && event.authenticated && event.hasMcpHeader));
      return { independentWindow: true, realSseOAuth: true, authenticatedPost: true, preview: text };
    });
    await check('sse-network-policy-denies-before-service-request', async () => {
      await evaluate('window.scodex.disconnectMcp(' + json(sseId) + ')');
      const before = sse.seen.length;
      await evaluate('window.scodex.saveAgentSettings({sandboxMode:"workspace-write",approvalPolicy:"never",networkAccess:false,allowLocalBinding:false},"shared")');
      const rejected = await evaluate('window.scodex.connectMcp(' + json(sseId) + ').then(()=>({rejected:false}),e=>({rejected:true,message:e.message}))');
      assert.equal(rejected.rejected, true); assert.equal(sse.seen.length, before);
      await evaluate('window.scodex.saveAgentSettings({sandboxMode:"danger-full-access",approvalPolicy:"on-request",networkAccess:true,allowLocalBinding:true},"shared")');
      return { rejected: true, serviceRequests: 0 };
    });
    await check('sse-restart-retains-encrypted-config-and-reconnects', async () => {
      await quit(); await launch(); const servers = (await state()).servers; assert.equal(servers.length, 2); assert.ok(servers.every(server => server.status === 'disconnected'));
      assert.ok(servers.every(server => server.transport === 'sse')); assert.ok(servers.find(server => server.id === oauthId).hasOAuthTokens);
      await plugins(); await textClick(card(sseId) + ' button', '连接'); await wait(async () => (await info(sseId)).status === 'connected', 'Bearer reconnection');
      await textClick(card(oauthId) + ' button', '连接'); await wait(async () => (await info(oauthId)).status === 'connected', 'Stored OAuth reconnection');
      await preview(sseId, 'SSE 项目资料', /S7419/); return { twoEncryptedSseConnections: true, noAutomaticConnection: true, bearerAndOAuthReconnected: true };
    });
    await check('sse-layout-readability-and-final-screenshot', async () => {
      const layouts = [];
      for (const [width, height] of [[1440, 900], [1064, 660]]) {
        await cdp.command('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
        const value = await evaluate('(()=>{const e=document.querySelector(".mcp-connections"),p=document.querySelector(".mcp-context-preview pre");return{overflow:document.documentElement.scrollWidth>innerWidth+1,contentOverflow:e.scrollWidth>e.clientWidth+1,font:getComputedStyle(e).fontFamily,previewSize:getComputedStyle(p).fontSize}})()');
        assert.equal(value.overflow, false); assert.equal(value.contentOverflow, false); assert.match(value.font, /Microsoft YaHei/); assert.ok(parseFloat(value.previewSize) >= 14); layouts.push({ width, height, ...value });
      }
      await cdp.command('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
      await evaluate('document.querySelector(".mcp-server-card").scrollIntoView({block:"start"})');
      const shot = await cdp.command('Page.captureScreenshot', { format: 'png' }); report.screenshot = path.join(output, 'mcp-sse-workbench.png'); await fs.writeFile(report.screenshot, Buffer.from(shot.data, 'base64')); return layouts;
    });
    await quit(); report.status = 'passed';
  } catch (error) { report.status = 'failed'; report.error = error.stack; process.exitCode = 1; console.error(error); try { report.visibleText = await evaluate('document.body.innerText'); } catch {} }
  finally {
    try { if (child?.exitCode === null && cdp) { await evaluate('window.scodex.cancelMessage("unused")').catch(() => {}); await quit(); } } catch (error) { report.quitError = error.message; }
    socket?.close(); for (const ws of authSockets) ws.close();
    await sse?.close(); await oauth?.close(); if (model) { model.closeAllConnections(); await new Promise(resolve => model.close(resolve)); }
    if (!child || child.exitCode !== null) { try { await fs.rm(fixture, { recursive: true, force: true }); report.cleanup = 'removed'; } catch (error) { report.cleanup = 'manual-required'; report.cleanupError = error.message; } } else report.cleanup = 'deferred-process-still-running';
    report.finishedAt = new Date().toISOString(); await save(); console.log('RESULT ' + report.status);
  }
}
if (require.main === module) main();
