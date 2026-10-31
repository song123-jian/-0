// Actual 1.2.0 portable EXE, renderer and MCP SDK servers. The model alone is controlled.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const http = require('node:http');
const { spawn, execFile } = require('node:child_process');
const { promisify } = require('node:util');
const execFileAsync = promisify(execFile);
const { connect, wait, freePort } = require('./agent-workflow-ui.cjs');
const { createHttpFixture } = require('./mcp-fixture.cjs');
const { toolAlias } = require('../electron/mcp-runtime.cjs');
const root = path.resolve(__dirname, '..'); const output = path.join(root, 'release/mcp-runtime-20261024');
const executable = path.join(output, 'Scodex-Workbench-1.2.0-x64.exe');
const temporary = path.join(os.tmpdir(), 'scodex-mcp-ui-' + crypto.randomUUID());
const profile = path.join(temporary, 'profile'); const workspace = path.join(temporary, 'project'); const fakeRoot = path.join(temporary, 'scodex');
const callLog = path.join(temporary, 'mcp-calls.jsonl'); const httpLog = path.join(temporary, 'http-calls.jsonl');
const secret = 'isolated-mcp-secret-' + crypto.randomUUID(); const httpSecret = 'isolated-http-secret-' + crypto.randomUUID();
const json = JSON.stringify; const requests = []; const processes = [];
const report = { status: 'running', version: '1.2.0', executable, checks: [], environment: { platform: os.platform(), release: os.release(), node: process.version }, limitations: ['Only the model is replaced with a controlled loopback endpoint. Real EXE, React UI, IPC, Windows encryption and stdio/HTTP MCP services are used.', 'CDP drives the real renderer; native mouse/keyboard input is not claimed.'] };
let child, socket, cdp, modelServer, httpFixture, localId, remoteId;
async function check(name, fn) { const evidence = await fn(); report.checks.push({ name, status: 'passed', evidence }); console.log('PASS ' + name); }
async function click(label) { await wait(() => cdp.evaluate('(()=>{const e=document.querySelector(' + json('[aria-label="' + label + '"]') + ');if(!e||e.disabled)return false;e.click();return true})()'), 'Button ' + label); }
async function textClick(selector, label) { await wait(() => cdp.evaluate('(()=>{const e=[...document.querySelectorAll(' + json(selector) + ')].find(e=>e.textContent.trim()===' + json(label) + ');if(!e||e.disabled)return false;e.click();return true})()'), 'Text button ' + label); }
async function insert(label, value) { await cdp.evaluate('(()=>{const e=document.querySelector(' + json('[aria-label="' + label + '"]') + ');if(!e)throw Error("Missing input");const p=e instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:e instanceof HTMLSelectElement?HTMLSelectElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(p,"value").set.call(e,' + json(value) + ');e.dispatchEvent(new Event(e instanceof HTMLSelectElement?"change":"input",{bubbles:true}));return true})()'); }
async function pluginPage() { await cdp.evaluate('document.querySelector(".workbench-primary-nav [aria-label=插件]").click()'); await textClick('.extension-segment button', 'MCP 连接'); await wait(() => cdp.evaluate('Boolean(document.querySelector(".mcp-connections"))'), 'MCP page'); }
async function chat() { await cdp.evaluate('document.querySelector(".activity-rail [aria-label=项目]").click()'); await click('新聊天'); await wait(() => cdp.evaluate('!document.querySelector(".message-list")'), 'New chat'); }
async function execute() { if (await cdp.evaluate('document.querySelector("[aria-label=执行任务]").getAttribute("aria-pressed")') !== 'true') await click('执行任务'); }
async function submit(prompt) { await insert('输入工作内容', prompt); await click('发送消息'); }
async function finish() { await wait(() => cdp.evaluate('!document.querySelector("[aria-label=停止生成]")'), 'Generation finished', 45000); return cdp.evaluate('document.querySelector(".message-list")?.innerText||""'); }
async function approval(allowed = true) { await wait(() => cdp.evaluate('Boolean(document.querySelector(".agent-approval"))'), 'MCP approval'); const value = await cdp.evaluate('document.querySelector(".agent-approval").innerText'); await textClick('.agent-approval-actions button', allowed ? '允许本次调用' : '拒绝'); return value; }
async function log(file = callLog) { return (await fs.readFile(file, 'utf8').catch(() => '')).trim().split('\n').filter(Boolean).map(JSON.parse); }
async function cardButton(id, text) { await textClick('[data-mcp-id="' + id + '"] button', text); }
async function state() { return cdp.evaluate('window.scodex.listMcpConnections()'); }
async function reload() { await cdp.evaluate('location.reload()'); await wait(() => cdp.evaluate('Boolean(document.querySelector("[aria-label=输入工作内容]"))'), 'Reload'); }
function reply(res, value) { res.writeHead(200, { 'content-type': 'text/event-stream' }); res.end('data: ' + json({ choices: [{ delta: value }] }) + '\n\ndata: ' + json({ choices: [{ delta: {}, finish_reason: value.tool_calls ? 'tool_calls' : 'stop' }] }) + '\n\ndata: [DONE]\n\n'); }
function call(name, args) { return { tool_calls: [{ index: 0, id: 'call_' + crypto.randomBytes(6).toString('hex'), type: 'function', function: { name, arguments: json(args) } }] }; }
async function modelResponse(body, res) {
  const last = body.messages.findLastIndex((v) => v.role === 'user'); const prompt = String(body.messages[last].content); const results = body.messages.slice(last + 1).filter((v) => v.role === 'tool').map((v) => JSON.parse(v.content));
  const names = (body.tools || []).map((v) => v.function.name); requests.push({ prompt: prompt.split('\n')[0], tools: names, completed: results.length });
  if (prompt.includes('MCP成功')) { if (results.length < 2) return reply(res, call(toolAlias(localId, results.length ? 'record' : 'echo'), { message: results.length ? '审批后实际记录' : '参数中文核对' })); assert.equal(results.every((v) => v.ok), true); assert.equal(json(results).includes(secret), false); return reply(res, { content: 'MCP已真实发现、调用并返回中文结果，记录完成。' }); }
  if (prompt.includes('MCP远程')) return reply(res, results.length ? { content: '远程HTTP工具已返回结果。' } : call(toolAlias(remoteId, 'echo'), { message: '远程中文核对' }));
  if (prompt.includes('MCP拒绝') || prompt.includes('MCP连接变化')) return reply(res, results.length ? { content: '调用未执行，已保留拒绝或连接变化原因。' } : call(toolAlias(localId, 'record'), { message: '不得记录' }));
  if (prompt.includes('MCP参数错误')) return reply(res, results.length ? { content: '参数错误被拒绝。' } : call(toolAlias(localId, 'record'), { message: 17 }));
  if (prompt.includes('MCP取消')) return reply(res, call(toolAlias(localId, results.length ? 'record' : 'slow'), results.length ? { message: '取消后不得执行' } : {}));
  if (prompt.includes('MCP规划')) { assert.equal(names.includes(toolAlias(localId, 'echo')), true); assert.equal(names.filter((v) => v.startsWith('mcp_')).length, 1); return reply(res, results.length ? { content: '只读白名单已生效。' } : call(toolAlias(localId, 'echo'), { message: '规划只读核对' })); }
  assert.equal(names.some((v) => v.startsWith('mcp_')), false); return reply(res, { content: '当前模式没有MCP工具。' });
}
async function launch(port) {
  child = spawn(executable, ['--remote-debugging-port=' + port, '--user-data-dir=' + profile, '--disable-gpu'], { windowsHide: true, cwd: output, stdio: ['ignore', 'ignore', 'pipe'], env: { ...process.env, SCODEX_HOME: fakeRoot, SCODEX_REFERENCE_HOME: path.join(temporary, 'reference'), SCODEX_REFERENCE_AGENTS_HOME: path.join(temporary, 'agents') } }); processes.push(child);
  let errors = ''; child.stderr.on('data', (v) => { errors = (errors + v).slice(-4000); });
  const target = await wait(async () => { if (child.exitCode !== null) throw Error('EXE exited: ' + errors); return (await fetch('http://127.0.0.1:' + port + '/json/list').then((v) => v.json())).find((v) => v.type === 'page' && v.url.startsWith('file:')); }, 'EXE startup', 40000);
  socket = new WebSocket(target.webSocketDebuggerUrl); await new Promise((r, j) => { socket.addEventListener('open', r, { once: true }); socket.addEventListener('error', j, { once: true }); }); cdp = connect(socket);
  await wait(() => cdp.evaluate('Boolean(window.scodex&&document.querySelector("[aria-label=输入工作内容]"))'), 'Renderer ready');
  return cdp.evaluate('window.scodex.getAppState().then(s=>({version:s.version,workspaceRoot:s.workspaceRoot}))');
}
async function quit() { await cdp.evaluate('window.scodex.quitApp()'); await wait(() => Promise.resolve(child.exitCode !== null), 'Quit with MCP shutdown', 20000); socket.close(); }
async function main() {
  try {
    await fs.mkdir(profile, { recursive: true }); await fs.mkdir(workspace); await fs.mkdir(fakeRoot);
    await fs.writeFile(path.join(profile, 'settings.json'), json({ workspaceRoot: workspace, preferences: { browserPanelOpen: false, trayEnabled: false } }));
    await fs.writeFile(path.join(fakeRoot, 'codex-settings.json'), json({ sandboxMode: 'danger-full-access', approvalPolicy: 'on-request', workspaceDependencies: false }));
    modelServer = http.createServer(async (req, res) => { try { let raw = ''; for await (const chunk of req) raw += chunk; await modelResponse(JSON.parse(raw), res); } catch (e) { report.modelFixtureError = e.stack; if (!res.headersSent) res.writeHead(500); res.end(); } });
    await new Promise((r) => modelServer.listen(0, '127.0.0.1', r));
    httpFixture = await createHttpFixture({ token: httpSecret, secret: httpSecret, logFile: httpLog });
    await check('actual EXE identity and initial disconnected state', async () => { const identity = await launch(await freePort()); assert.equal(identity.version, '1.2.0'); assert.equal(path.resolve(identity.workspaceRoot), workspace); assert.equal((await state()).servers.length, 0); return identity; });
    await cdp.evaluate('window.scodex.saveModelConnection(' + json({ name: 'MCP实际验收', baseUrl: 'http://127.0.0.1:' + modelServer.address().port + '/v1', model: 'controlled-mcp-model', models: ['controlled-mcp-model'], toolProtocol: 'native', apiKey: 'controlled-model-credential' }) + ')'); await reload();
    await pluginPage();
    await check('add stdio in actual UI without automatic start or secret exposure', async () => {
      await textClick('.mcp-section-heading button', '添加连接'); await insert('MCP 连接名称', '项目 MCP'); await insert('MCP 启动命令', process.execPath); await insert('MCP 启动参数', json([path.join(root, 'tests/mcp-fixture.cjs')])); await insert('MCP 环境变量', json({ MCP_FIXTURE_LOG: callLog, MCP_FIXTURE_SECRET: secret }));
      await cdp.evaluate('document.querySelector(".mcp-advanced").open=true'); await insert('MCP 规划只读工具', 'echo'); await textClick('.mcp-editor-actions button', '保存连接');
      const current = await wait(async () => { const s = await state(); return s.servers.length === 1 && s; }, 'Stdio saved'); localId = current.servers[0].id;
      assert.equal(current.servers[0].status, 'disconnected'); assert.equal(json(current).includes(secret), false); assert.equal((await log()).length, 0);
      const disk = await fs.readFile(path.join(profile, 'mcp-connections.json'), 'utf8'); assert.equal(disk.includes(secret), false); assert.ok(JSON.parse(disk).servers[0].encrypted); return { encrypted: true, automaticStart: false };
    });
    await check('real stdio connection discovers four tool schemas in UI', async () => { await cardButton(localId, '连接'); await wait(async () => (await state()).servers[0].status === 'connected', 'Stdio connected'); const s = (await state()).servers[0]; assert.equal(s.tools.length, 4); await cdp.evaluate('document.querySelector(".mcp-tools").open=true'); assert.match(await cdp.evaluate('document.querySelector(".mcp-server-card").innerText'), /echo/); return { tools: s.tools.map((v) => v.name), version: s.serverVersion }; });
    await check('actual HTTP UI connects with encrypted bearer and custom headers', async () => {
      await textClick('.mcp-section-heading button', '添加连接'); await insert('MCP 连接名称', '远程 MCP'); await insert('MCP 连接方式', 'http'); await insert('MCP 服务地址', httpFixture.url); await insert('MCP Bearer 认证', httpSecret); await insert('MCP 请求头', json({ 'X-Fixture-Key': 'controlled-custom-header' })); await textClick('.mcp-editor-actions button', '保存连接');
      remoteId = (await wait(async () => { const s = await state(); return s.servers.length === 2 && s; }, 'HTTP saved')).servers[1].id; await cardButton(remoteId, '连接'); await wait(async () => (await state()).servers[1].status === 'connected', 'HTTP connected');
      assert.ok(httpFixture.seen.some((v) => v.auth === 'Bearer ' + httpSecret && v.custom === 'controlled-custom-header')); const disk = await fs.readFile(path.join(profile, 'mcp-connections.json'), 'utf8'); assert.equal(disk.includes(httpSecret), false); return { authenticated: true, encrypted: true };
    });
    await check('model receives real MCP results after exact per-call UI approval', async () => {
      await chat(); await execute(); await submit('MCP成功'); const first = await approval(); assert.match(first, /项目 MCP/); assert.match(first, /echo/); assert.match(first, /参数中文核对/); await approval(); assert.match(await finish(), /记录完成/);
      assert.equal((await log()).filter((v) => v.name === 'record').length, 1); const text = await cdp.evaluate('document.querySelector(".message-list").innerText'); assert.equal(text.includes(secret), false); return { approvals: 2, recordCalls: 1 };
    });
    await check('refusal, invalid schema and stale connection prevent side effects', async () => {
      const before = (await log()).filter((v) => v.name === 'record').length;
      await chat(); await execute(); await submit('MCP拒绝'); await approval(false); await finish();
      await chat(); await execute(); await submit('MCP参数错误'); assert.match(await finish(), /参数错误/); assert.equal(await cdp.evaluate('Boolean(document.querySelector(".agent-approval"))'), false);
      await chat(); await execute(); await submit('MCP连接变化'); await wait(() => cdp.evaluate('Boolean(document.querySelector(".agent-approval"))'), 'Stale approval'); await cdp.evaluate('window.scodex.disconnectMcp(' + json(localId) + ').then(()=>window.scodex.connectMcp(' + json(localId) + '))'); await approval(); await finish();
      assert.equal((await log()).filter((v) => v.name === 'record').length, before); return { prevented: ['refusal', 'invalid-schema', 'stale-connection'] };
    });
    await check('stop cancels actual MCP request and prevents a later action', async () => {
      await chat(); await execute(); await submit('MCP取消'); await approval(); await wait(async () => (await log()).some((v) => v.name === 'slow'), 'Slow call started'); await click('停止生成'); await finish();
      await wait(async () => (await log()).some((v) => v.cancelled === 'slow'), 'Protocol cancellation delivered'); assert.equal((await log()).some((v) => v.args?.message === '取消后不得执行'), false); return { sdkCancellationDelivered: true };
    });
    await check('planning explicitly whitelists only declared read-only tool', async () => { await chat(); await execute(); await click('添加工具和上下文'); await textClick('.composer-menu-item', '计划模式开启计划模式'); await submit('MCP规划'); await approval(); assert.match(await finish(), /只读白名单/); return true; });
    await check('normal dialogue and never-approval policy omit MCP tools', async () => { await chat(); await submit('MCP普通对话'); assert.match(await finish(), /没有MCP/); await cdp.evaluate('window.scodex.saveAgentSettings({sandboxMode:"danger-full-access",approvalPolicy:"never"},"shared")'); await chat(); await execute(); await submit('MCP禁止审批'); assert.match(await finish(), /没有MCP/); await cdp.evaluate('window.scodex.saveAgentSettings({sandboxMode:"danger-full-access",approvalPolicy:"on-request"},"shared")'); return true; });
    await check('model really invokes authenticated Streamable HTTP tool', async () => { await chat(); await execute(); await submit('MCP远程'); assert.match(await approval(), /远程 MCP/); assert.match(await finish(), /远程HTTP/); assert.equal((await log(httpLog)).filter((v) => v.name === 'echo').length, 1); return true; });
    await check('restart preserves encrypted configs and history while not auto-starting services', async () => {
      const pids = [...new Set((await log()).filter((v) => v.pid).map((v) => v.pid))]; await quit(); for (const pid of pids) assert.throws(() => process.kill(pid, 0));
      await launch(await freePort()); const s = await state(); assert.equal(s.servers.length, 2); assert.equal(s.servers.every((v) => v.status === 'disconnected'), true); assert.equal(json(s).includes(secret), false);
      const appState = await cdp.evaluate('window.scodex.getAppState()'); assert.ok(appState.library.conversations.some((v) => v.messages.some((m) => m.operations?.some((o) => o.name?.startsWith('mcp_')))));
      await pluginPage(); await cardButton(localId, '连接'); await wait(async () => (await state()).servers[0].status === 'connected', 'Reopened encrypted stdio'); return { configs: 2, historyRestored: true, priorPidsStopped: pids };
    });
    await check('connection page and editor remain readable within desktop viewports', async () => {
      const evidence = [];
      for (const [width, height] of [[1440, 900], [1080, 700]]) {
        await cdp.command('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
        const layout = await cdp.evaluate('(()=>{const e=document.querySelector(".mcp-connections");return{pageOverflow:document.documentElement.scrollWidth>innerWidth+1,contentOverflow:e.scrollWidth>e.clientWidth+1,font:getComputedStyle(e).fontFamily,size:getComputedStyle(e).fontSize}})()'); assert.equal(layout.pageOverflow, false); assert.equal(layout.contentOverflow, false); assert.match(layout.font, /Microsoft YaHei/); assert.equal(layout.size, '16px'); evidence.push({ width, height, ...layout });
      }
      await textClick('.mcp-section-heading button', '添加连接'); const editor = await cdp.evaluate('(()=>{const e=document.querySelector(".mcp-editor");const a=e.getBoundingClientRect();return{top:a.top,bottom:a.bottom,viewport:innerHeight,inputSize:getComputedStyle(e.querySelector("input")).fontSize}})()'); assert.ok(editor.top >= 0 && editor.bottom <= editor.viewport); assert.equal(editor.inputSize, '16px');
      await click('关闭连接编辑'); await cdp.command('Emulation.clearDeviceMetricsOverride'); return { layouts: evidence, editor };
    });
    await cdp.evaluate('document.querySelector(".mcp-tools").open=true'); const capture = await cdp.command('Page.captureScreenshot', { format: 'png' }); await fs.writeFile(path.join(output, 'mcp-connections.png'), Buffer.from(capture.data, 'base64')); report.screenshot = path.join(output, 'mcp-connections.png');
    await quit(); report.status = 'passed';
  } catch (e) { report.status = 'failed'; report.error = e.stack; console.error(e); process.exitCode = 1; }
  finally {
    try { if (socket?.readyState === 1) { report.finalVisibleText = await cdp.evaluate('document.body.innerText'); await cdp.evaluate('window.scodex.quitApp()'); } } catch {}
    for (const p of processes) if (p.exitCode === null) p.kill();
    // Cleanup only the Electron process carrying this unique isolated profile.
    try { const script = "$needle='" + profile.replaceAll("'", "''") + "';Get-CimInstance Win32_Process -Filter \"Name='Scodex工作台.exe'\" | Where-Object {$_.CommandLine -and $_.CommandLine.Contains($needle) -and $_.CommandLine -notmatch '--type='} | Select-Object -ExpandProperty ProcessId"; const r = await execFileAsync('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', script], { windowsHide: true, timeout: 5000 }); const pids = r.stdout.trim().split(/\s+/).filter((v) => /^\d+$/.test(v)); for (const pid of pids) await execFileAsync('taskkill.exe', ['/pid', pid, '/T', '/F'], { windowsHide: true, timeout: 8000 }); report.cleanedIsolatedMainProcesses = pids.map(Number); } catch (e) { report.cleanupError = e.message; }
    for (const pid of new Set((await log()).filter((v) => v.pid).map((v) => v.pid))) { try { process.kill(pid, 0); await execFileAsync('taskkill.exe', ['/pid', String(pid), '/T', '/F'], { windowsHide: true, timeout: 8000 }); } catch {} }
    socket?.close(); modelServer?.closeAllConnections(); await new Promise((r) => modelServer?.close(r) || r()); await httpFixture?.close();
    report.finishedAt = new Date().toISOString(); report.fixtureDirectory = temporary; report.requests = requests; report.executableSha256 = crypto.createHash('sha256').update(await fs.readFile(executable)).digest('hex');
    // The fixture credentials never enter the persistent evidence.
    const safe = json(report).split(secret).join('[hidden]').split(httpSecret).join('[hidden]'); await fs.writeFile(path.join(output, 'mcp-ui-verification.json'), safe); console.log('RESULT ' + report.status);
  }
}
if (require.main === module) main();
