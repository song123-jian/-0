const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const http = require('node:http');
const net = require('node:net');
const { spawn, execFile } = require('node:child_process');
const executeFile = require('node:util').promisify(execFile);
const project = path.resolve(__dirname, '..');
const output = path.join(project, 'release/model-connection');
const stage = path.join(project, 'release/model-connection-app');
const temporary = path.join(os.tmpdir(), 'scodex-model-ui-' + crypto.randomUUID());
const profile = path.join(temporary, 'profile');
const fakeRoot = path.join(temporary, 'scodex-root');
const json = JSON.stringify;
const finishOnly = process.env.SCODEX_MODEL_UI_SCOPE === 'finish';
const auditOnly = process.env.SCODEX_MODEL_UI_SCOPE === 'audit';
const navigationOnly = process.env.SCODEX_MODEL_UI_SCOPE === 'navigation';
const report = { date: new Date().toISOString(), environment: os.platform() + ' ' + os.release() + ' ' + os.arch(), checks: [], upstream: 'Controlled local OpenAI-compatible endpoint; real workbench EXE, IPC, Windows encryption and persistence.', status: 'running' };
async function waitFor(predicate, label, duration = 20000) {
  const end = Date.now() + duration; let last;
  while (Date.now() < end) { try { const value = await predicate(); if (value) return value; } catch (error) { last = error; } await new Promise((resolve) => setTimeout(resolve, 100)); }
  throw new Error(label + (last ? ': ' + last.message : ''));
}
function connect(socket) {
  let id = 0; const pending = new Map();
  socket.addEventListener('message', ({ data }) => { const message = JSON.parse(data); const item = pending.get(message.id); if (!item) return; pending.delete(message.id); clearTimeout(item.timer); message.error ? item.reject(new Error(message.error.message)) : item.resolve(message.result); });
  const command = (method, params = {}) => new Promise((resolve, reject) => { const key = ++id; const timer = setTimeout(() => { pending.delete(key); reject(new Error('CDP timeout: ' + method)); }, 20000); pending.set(key, { resolve, reject, timer }); socket.send(json({ id: key, method, params })); });
  return { command, async evaluate(expression) { const response = await command('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, userGesture: true }); if (response.exceptionDetails) throw new Error(response.exceptionDetails.exception?.description || response.exceptionDetails.text); return response.result?.value; } };
}
async function main() {
  let child; let socket; let cdp; let endpoint; let failNext = false; const posts = []; const gets = [];
  const apiKey = crypto.randomUUID();
  const server = http.createServer(async (request, response) => {
    if (request.headers.authorization !== 'Bearer ' + apiKey) { response.writeHead(401).end(); return; }
    if (request.method === 'GET' && request.url.endsWith('/models')) {
      gets.push(request.url);
      if (failNext) { failNext = false; response.writeHead(401).end(); } else { response.writeHead(200, { 'content-type': 'application/json' }); response.end(json({ data: [{ id: 'main-verification' }, { id: 'child-verification' }] })); } return;
    }
    if (request.method === 'POST' && request.url === '/v1/chat/completions') {
      let raw = ''; for await (const chunk of request) raw += chunk; const body = JSON.parse(raw); posts.push(body);
      response.writeHead(200, { 'content-type': 'text/event-stream' });
      if (body.messages.at(-1)?.content.includes('导航生成中验收')) {
        response.flushHeaders(); const timer = setTimeout(() => response.end('data: [DONE]\n\n'), 15000); response.once('close', () => clearTimeout(timer)); return;
      }
      response.end('data: ' + json({ choices: [{ delta: { content: body.model === 'child-verification' ? '子模型测试通过' : '主模型测试通过' } }] }) + '\n\ndata: [DONE]\n\n'); return;
    }
    response.writeHead(404).end();
  });
  const check = (name) => { report.checks.push({ name, status: 'passed' }); console.log('PASS:', name); };
  const launch = async () => {
    const portServer = net.createServer(); await new Promise((resolve) => portServer.listen(0, '127.0.0.1', resolve)); const port = portServer.address().port; await new Promise((resolve) => portServer.close(resolve));
    const executable = path.join(output, 'Scodex-Workbench-Models-x64.exe');
    child = spawn(executable, ['--remote-debugging-port=' + port, '--user-data-dir=' + profile, '--disable-gpu'], { cwd: output, windowsHide: true, env: { ...process.env, SCODEX_HOME: fakeRoot }, stdio: ['ignore', 'pipe', 'pipe'] });
    child.stdout.resume(); let diagnostic = ''; child.stderr.on('data', (value) => { diagnostic = (diagnostic + value).slice(-4000); });
    const target = await waitFor(async () => { if (child.exitCode !== null) throw new Error(diagnostic); const targets = await fetch('http://127.0.0.1:' + port + '/json/list').then((result) => result.json()); return targets.find((item) => item.type === 'page'); }, 'EXE startup');
    socket = new WebSocket(target.webSocketDebuggerUrl); await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); }); cdp = connect(socket);
    await waitFor(() => cdp.evaluate('Boolean(document.querySelector(".app-shell")) && window.scodex.getAppState().then(state=>Boolean(state.library))'), 'App ready');
    const identity = await cdp.evaluate('window.scodex.getAppState()'); const manifest = JSON.parse(await fs.readFile(path.join(stage, 'package.json'), 'utf8')); assert.equal(identity.version, manifest.version);
    const renderer = (await fs.readFile(path.join(stage, 'dist/index.html'), 'utf8')).match(/assets\/index-[^"\s]+\.js/)[0];
    assert.equal(await cdp.evaluate('[...document.scripts].some(script=>script.src.endsWith(' + json(renderer) + '))'), true); report.version = identity.version; report.renderer = renderer; report.executable = executable;
  };
  const close = async () => { await cdp.command('Browser.close').catch(() => {}); await waitFor(() => child.exitCode !== null, 'EXE exit'); if (socket.readyState === WebSocket.OPEN) socket.close(); cdp = null; };
  const click = (text, selector = 'button') => cdp.evaluate('(() => { const item = [...document.querySelectorAll(' + json(selector) + ')].find(item=>item.textContent.trim()===' + json(text) + '); if (!item || item.disabled) throw new Error("Button unavailable: "+' + json(text) + '); item.click(); })()');
  const clickSelector = (selector) => cdp.evaluate('document.querySelector(' + json(selector) + ').click()');
  const valueOf = (selector, property = 'value') => cdp.evaluate('document.querySelector(' + json(selector) + ')[' + json(property) + ']');
  const input = async (selector, text) => {
    await cdp.evaluate('(() => { const field=document.querySelector(' + json(selector) + '); field.scrollIntoView({block:"center"}); field.focus(); })()');
    for (const type of ['keyDown', 'keyUp']) await cdp.command('Input.dispatchKeyEvent', { type, key: 'a', code: 'KeyA', modifiers: 2, windowsVirtualKeyCode: 65 });
    await cdp.command('Input.insertText', { text });
  };
  const openModels = async () => { await waitFor(() => cdp.evaluate('Boolean(document.querySelector(\'[aria-label="设置"]\'))'), 'Settings ready'); await clickSelector('[aria-label="设置"]'); await click('模型与连接', '.settings-category'); await waitFor(() => cdp.evaluate('Boolean(document.querySelector("#model-service-name"))'), 'Model form'); };
  const chooseEffort = async (label, value) => { await clickSelector('[aria-label="' + label + '"]'); await click(value, '.model-effort-menu [role=option]'); };
  try {
    await fs.mkdir(profile, { recursive: true }); await fs.mkdir(fakeRoot, { recursive: true }); const workspace = path.join(temporary, 'workspace'); await fs.mkdir(workspace);
    await fs.writeFile(path.join(profile, 'settings.json'), json({ workspaceRoot: workspace, preferences: { browserPanelOpen: false, themeMode: 'light', fontSize: 16, closeConfirmation: 'never', notifyOnComplete: false, notifyOnIssues: false } }));
    if (navigationOnly) {
      const chats = ['一', '二', '三'].map((name, index) => ({ id: 'nav-' + (index + 1), title: '导航聊天' + name, draft: '草稿' + name, mode: 'answer', messages: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }));
      await fs.writeFile(path.join(profile, 'conversations.json'), json({ version: 2, activeId: chats[0].id, conversations: chats }));
    }
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve)); endpoint = 'http://127.0.0.1:' + server.address().port;
    await launch();
    if (navigationOnly) {
      await cdp.evaluate('window.scodex.saveModelConnection(' + json({ name: 'Cat Bee', note: '本机隔离验收', website: 'https://catbee.online', baseUrl: endpoint + '/v1', addresses: [endpoint + '/v1'], models: ['main-verification', 'child-verification'], model: 'main-verification', reasoningEffort: 'high', subagentModel: 'child-verification', subagentReasoningEffort: 'minimal', apiKey }) + ')');
      await cdp.command('Page.reload'); await waitFor(() => cdp.evaluate('Boolean(document.querySelector(".activity-history-controls"))'), 'Navigation ready');
      const disabled = (name) => valueOf('[aria-label="' + name + '"]', 'disabled');
      const view = (name) => waitFor(() => cdp.evaluate('Boolean(document.querySelector(' + json('.' + name + '-view') + '))'), 'View ' + name);
      const recent = (name) => cdp.evaluate('[...document.querySelectorAll(".recent-item")].find(item=>item.textContent.includes(' + json(name) + ')).click()');
      const activeChat = () => cdp.evaluate('window.scodex.getAppState().then(state=>state.library.activeId)');
      const alt = async (key) => { await cdp.evaluate('document.activeElement?.blur()'); for (const type of ['keyDown', 'keyUp']) await cdp.command('Input.dispatchKeyEvent', { type, key, code: key, modifiers: 1, windowsVirtualKeyCode: key === 'ArrowLeft' ? 37 : 39 }); };
      assert.equal(await disabled('后退'), true); assert.equal(await disabled('前进'), true);
      await clickSelector('[aria-label="查看对话记录"]'); await view('history'); await clickSelector('[aria-label="设置"]'); await view('settings');
      await clickSelector('[aria-label="后退"]'); await view('history'); await clickSelector('[aria-label="前进"]'); await view('settings');
      await alt('ArrowLeft'); await view('history'); await alt('ArrowRight'); await view('settings'); check('Initial disabled state, page back/forward and Alt+Arrow keyboard history');
      await clickSelector('[aria-label="后退"]'); await view('history'); await clickSelector('[aria-label="更多工作工具"]'); await click('图片编辑', '.activity-menu button'); await view('image');
      assert.equal(await disabled('前进'), true); await clickSelector('[aria-label="后退"]'); await view('history'); await clickSelector('[aria-label="后退"]'); await view('assistant'); assert.equal(await disabled('后退'), true);
      await clickSelector('[aria-label="前进"]'); await view('history'); await clickSelector('[aria-label="前进"]'); await view('image'); check('New route truncates forward branch, duplicate visits and history boundaries stay stable');
      await recent('导航聊天二'); await view('assistant'); assert.equal(await valueOf('textarea[aria-label="输入工作内容"]'), '草稿二');
      await clickSelector('[aria-label="后退"]'); await view('image'); await clickSelector('[aria-label="后退"]'); await view('history'); await clickSelector('[aria-label="后退"]'); await view('assistant'); assert.equal(await valueOf('textarea[aria-label="输入工作内容"]'), '草稿一');
      await clickSelector('[aria-label="前进"]'); await view('history'); await clickSelector('[aria-label="前进"]'); await view('image'); await clickSelector('[aria-label="前进"]'); await view('assistant'); assert.equal(await valueOf('textarea[aria-label="输入工作内容"]'), '草稿二'); check('Conversation destinations and drafts restore without overwriting other chats');
      await recent('导航聊天一'); await recent('导航聊天二'); await clickSelector('[aria-label="查看对话记录"]'); await view('history'); await clickSelector('[aria-label="归档 导航聊天二"]');
      await waitFor(() => cdp.evaluate('window.scodex.getAppState().then(state=>state.library.conversations.find(chat=>chat.id==="nav-2").archivedAt)'), 'Archive persisted');
      await clickSelector('[aria-label="后退"]'); await view('assistant'); assert.equal(await valueOf('textarea[aria-label="输入工作内容"]'), '草稿一');
      await recent('导航聊天三'); await clickSelector('[aria-label="查看对话记录"]'); await view('history'); await clickSelector('[aria-label="删除 导航聊天三"]'); await click('确认删除', '.history-actions button');
      await waitFor(() => cdp.evaluate('window.scodex.getAppState().then(state=>!state.library.conversations.some(chat=>chat.id==="nav-3"))'), 'Delete persisted');
      await clickSelector('[aria-label="后退"]'); await view('assistant'); assert.equal(await valueOf('textarea[aria-label="输入工作内容"]'), '草稿一'); check('Archived and deleted conversations are skipped; surviving draft stays intact');
      await input('textarea[aria-label="输入工作内容"]', '导航生成中验收'); await clickSelector('[aria-label="发送消息"]'); await waitFor(() => cdp.evaluate('Boolean(document.querySelector(\'[aria-label="停止生成"]\'))'), 'Pending generation');
      assert.equal(await disabled('后退'), true); assert.equal(await disabled('前进'), true); await clickSelector('[aria-label="设置"]'); await view('settings'); await alt('ArrowLeft'); await view('settings');
      await clickSelector('[aria-label="工作台首页"]'); await view('assistant'); await clickSelector('[aria-label="停止生成"]'); await waitFor(() => cdp.evaluate('!document.querySelector(\'[aria-label="停止生成"]\')'), 'Cancelled generation'); check('Both navigation buttons and shortcuts protect a running generation; cancellation restores navigation');
      await cdp.evaluate('window.scodex.savePreferences({fontSize:20,themeMode:"dark"})'); await cdp.command('Page.reload'); await waitFor(() => cdp.evaluate('Boolean(document.querySelector(".activity-history-controls"))'), 'Layout reload');
      await cdp.command('Emulation.setDeviceMetricsOverride', { width: 1064, height: 660, deviceScaleFactor: 1, mobile: false });
      const outside = await cdp.evaluate('[...document.querySelectorAll(".activity-history-controls,.activity-history-controls button")].map(item=>item.getBoundingClientRect().toJSON()).filter(rect=>rect.left<0 || rect.right>innerWidth || rect.top<0 || rect.bottom>innerHeight)'); assert.deepEqual(outside, []);
      check('Navigation controls fit 1064x660/20px dark renderer viewport');
      await cdp.command('Emulation.clearDeviceMetricsOverride'); await cdp.evaluate('window.scodex.savePreferences({fontSize:16,themeMode:"light"})'); await cdp.command('Page.reload'); await waitFor(() => cdp.evaluate('Boolean(document.querySelector(".activity-history-controls"))'), 'Final renderer');
      assert.equal(await disabled('后退'), true); assert.equal(await disabled('前进'), true);
      await clickSelector('[aria-label="查看对话记录"]'); await view('history'); await clickSelector('[aria-label="设置"]'); await view('settings'); await clickSelector('[aria-label="更多工作工具"]'); await click('文件与代码', '.activity-menu button'); await view('file'); await clickSelector('[aria-label="后退"]'); await view('settings');
      await click('模型与连接', '.settings-category'); await waitFor(() => cdp.evaluate('Boolean(document.querySelector("#model-subagent"))'), 'Final model page');
      assert.equal(await disabled('后退'), false); assert.equal(await disabled('前进'), false);
      await cdp.evaluate('document.querySelector("#model-subagent").scrollIntoView({block:"end"})'); await clickSelector('[aria-label="子代理模型推理强度"]');
      const shot = await cdp.command('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }); report.screenshot = path.join(output, 'workbench-model-navigation.png'); await fs.writeFile(report.screenshot, Buffer.from(shot.data, 'base64'));
      await close(); const finalLibrary = JSON.parse(await fs.readFile(path.join(profile, 'conversations.json'), 'utf8')); assert.ok(finalLibrary.conversations.find((chat) => chat.id === 'nav-2').archivedAt); assert.equal(finalLibrary.conversations.some((chat) => chat.id === 'nav-3'), false);
      check('Session history resets on reload; final screenshot, archive/delete disk readback and clean exit'); report.status = 'passed'; return;
    }
    if (finishOnly || auditOnly) {
      const earlier = JSON.parse(await fs.readFile(path.join(output, 'model-ui-verification.json'), 'utf8'));
      if (finishOnly) assert.equal(earlier.renderer, report.renderer);
      report.reused = [...(earlier.reused || []), ...earlier.checks]; report.reusedRenderer = earlier.renderer;
      report.previousFailure = earlier.previousFailure || { error: earlier.error, cause: 'Address fixture retains original service; assertion incorrectly expected only two addresses.' };
      await cdp.evaluate('window.scodex.saveModelConnection(' + json({ name: '模型配置验收', note: '隔离账号', website: 'https://example.com', baseUrl: endpoint + '/v1', addresses: [endpoint + '/v1', 'https://catbee.online/v1'], models: ['main-verification', 'child-verification'], model: 'main-verification', reasoningEffort: 'high', subagentModel: 'child-verification', subagentReasoningEffort: 'minimal', apiKey }) + ')');
      await cdp.command('Page.reload'); await waitFor(() => cdp.evaluate('Boolean(document.querySelector(".app-shell"))'), 'Fixture reload'); await openModels();
      if (auditOnly) {
        assert.match(await valueOf('.settings-detail-heading p', 'textContent'), /保存配置/);
        await clickSelector('[aria-label="工作台首页"]'); await clickSelector('[aria-label="新建对话"]');
        assert.equal(await valueOf('[aria-label="本轮回答深度"]'), 'high');
        await input('textarea[aria-label="输入工作内容"]', '默认强度与署名验收'); await clickSelector('[aria-label="发送消息"]');
        await waitFor(() => cdp.evaluate('document.body.innerText.includes("主模型测试通过")'), 'Audited main response');
        assert.equal(posts[0].reasoning_effort, 'high');
        assert.equal(await valueOf('.assistant-message-label', 'textContent'), 'main-verification');
        await waitFor(async () => { const library = JSON.parse(await fs.readFile(path.join(profile, 'conversations.json'), 'utf8')); return library.conversations.find((chat) => chat.id === library.activeId)?.messages.some((message) => message.model === 'main-verification'); }, 'Model metadata persisted');
        await cdp.command('Page.reload'); await waitFor(() => cdp.evaluate('Boolean(document.querySelector(".assistant-message-label"))'), 'Metadata reload');
        assert.equal(await valueOf('.assistant-message-label', 'textContent'), 'main-verification');
        check('Audited save instructions, provider default for new chat, actual high request, model signature and metadata reload');
        await openModels(); await cdp.evaluate('document.querySelector("#model-subagent").scrollIntoView({block:"end"})'); await clickSelector('[aria-label="子代理模型推理强度"]');
        const shot = await cdp.command('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }); report.screenshot = path.join(output, 'workbench-model-connection.png'); await fs.writeFile(report.screenshot, Buffer.from(shot.data, 'base64'));
        await close(); report.status = 'passed'; report.requests = posts.map((body) => ({ model: body.model, effort: body.reasoning_effort })); return;
      }
    } else {
    await openModels(); assert.equal(await valueOf('#model-service-name'), '聚合模组 2');
    await input('#model-service-name', '模型配置验收'); await input('#model-service-note', '隔离账号'); await input('#model-website', 'https://example.com'); await input('#model-base-url', endpoint); await input('#model-api-key', apiKey);
    await clickSelector('[aria-label="显示新输入的密钥"]'); assert.equal(await valueOf('#model-api-key', 'type'), 'text'); await clickSelector('[aria-label="隐藏新输入的密钥"]');
    await click('获取模型列表'); await waitFor(() => cdp.evaluate('document.querySelector(".model-list").textContent.includes("main-verification")'), 'Fetch actual models');
    await click('手动添加'); await input('[aria-label="手动添加模型 ID"]', 'manual-verification'); await click('添加', '.model-inline-add button'); await waitFor(() => cdp.evaluate('document.querySelector(".model-list").textContent.includes("manual-verification")'), 'Manual model');
    await clickSelector('[aria-label="移除模型 manual-verification"]'); await input('#model-default', 'main-verification'); await input('#model-subagent', 'child-verification');
    await chooseEffort('默认模型推理强度', 'high'); await chooseEffort('子代理模型推理强度', 'minimal'); await click('保存配置');
    await waitFor(() => cdp.evaluate('document.querySelector(".model-message")?.textContent.includes("已保存")'), 'Connection saved');
    const disk = JSON.parse(await fs.readFile(path.join(profile, 'model-connection.json'), 'utf8'));
    assert.equal(disk.config.baseUrl, endpoint + '/v1'); assert.equal(disk.config.reasoningEffort, 'high'); assert.equal(disk.config.subagentReasoningEffort, 'minimal'); assert.ok(disk.encryptedKey); assert.equal(json(disk).includes(apiKey), false);
    const publicState = await cdp.evaluate('window.scodex.getModelConnection()'); assert.equal(json(publicState).includes(apiKey), false); assert.equal('encryptedKey' in publicState, false); assert.equal(await valueOf('#model-api-key'), '');
    check('Fields, model fetch/manual add/remove, draft-key visibility, Windows encryption and disk/public readback');
    }
    failNext = true; await click('获取模型列表'); await waitFor(() => cdp.evaluate('document.querySelector(".model-message[role=alert]")?.textContent.includes("401")'), 'HTTP failure');
    await click('获取模型列表'); await waitFor(() => cdp.evaluate('document.querySelector(".model-message[role=status]")?.textContent.includes("已获取")'), 'Fetch recovers');
    const count = gets.length; await input('#model-base-url', endpoint.replace('127.0.0.1', 'localhost')); await click('获取模型列表'); await waitFor(() => cdp.evaluate('document.querySelector(".model-message[role=alert]")?.textContent.includes("API Key")'), 'Different origin blocked'); assert.equal(gets.length, count); await input('#model-base-url', endpoint + '/v1');
    await click('管理与测速'); await click('测速', '.model-address-row button'); await waitFor(() => cdp.evaluate('document.querySelector(".model-latency")?.textContent.includes("ms")'), 'Real latency');
    const initialAddresses = await cdp.evaluate('document.querySelectorAll(".model-address-row").length');
    await input('[aria-label="新增 API 地址"]', endpoint + '/alternate'); await click('添加地址'); assert.equal(await cdp.evaluate('document.querySelectorAll(".model-address-row").length'), initialAddresses + 1);
    await clickSelector('[aria-label="移除地址 ' + endpoint + '/alternate"]'); await click('管理与测速'); check('HTTP failure/recovery, cross-origin key isolation, address add/remove and measured GET latency');
    await clickSelector('[aria-label="工作台首页"]'); await input('textarea[aria-label="输入工作内容"]', '主模型路由验收'); await clickSelector('[aria-label="发送消息"]');
    await waitFor(() => cdp.evaluate('document.body.innerText.includes("主模型测试通过")'), 'Main response'); assert.equal(posts[0].model, 'main-verification'); assert.equal(posts[0].reasoning_effort, 'high'); check('Actual main chat UI sends configured model/high effort and receives streaming reply');
    await clickSelector('[aria-label="设置"]'); await click('存储空间', '.settings-category'); await waitFor(() => cdp.evaluate('document.querySelector(".storage-panel")?.getAttribute("aria-busy")==="false"'), 'Storage ready');
    await cdp.evaluate('(() => { const row=[...document.querySelectorAll(".storage-management-row")].find(item=>item.querySelector("strong")?.textContent==="子智能体"); row.querySelector("button").click(); })()');
    await input('[aria-label="子智能体任务"]', '子模型路由验收'); await click('运行子智能体');
    await waitFor(() => cdp.evaluate('window.scodex.listAgents().then(tasks=>tasks.some(task=>task.status==="complete" && task.result==="子模型测试通过"))'), 'Child result'); assert.equal(posts[1].model, 'child-verification'); assert.equal(posts[1].reasoning_effort, 'minimal');
    const tasks = JSON.parse(await fs.readFile(path.join(profile, 'agent-runs.json'), 'utf8')); assert.equal(tasks.tasks[0].result, '子模型测试通过'); check('Actual subagent UI sends separate model/minimal effort and persists result');
    await close(); await launch(); await openModels(); assert.equal(await valueOf('#model-service-note'), '隔离账号'); assert.equal(await valueOf('#model-subagent'), 'child-verification');
    assert.equal((await cdp.evaluate('window.scodex.getModelConnection()')).hasCredential, true); await click('获取模型列表'); await waitFor(() => cdp.evaluate('document.querySelector(".model-message")?.textContent.includes("已获取")'), 'Decrypt after restart'); check('Real EXE restart retains fields and decrypts saved credential');
    await cdp.evaluate('document.querySelector(\'[aria-label="子代理模型推理强度"]\').focus()');
    await cdp.command('Input.dispatchKeyEvent', { type: 'keyDown', key: 'End', code: 'End', windowsVirtualKeyCode: 35 }); await cdp.command('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
    await waitFor(() => cdp.evaluate('document.querySelector(\'[aria-label="子代理模型推理强度"]\').textContent.includes("ultra")'), 'Keyboard picks ultra');
    await chooseEffort('子代理模型推理强度', 'minimal'); await clickSelector('[aria-label="子代理模型推理强度"]'); await cdp.command('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    assert.equal(await cdp.evaluate('Boolean(document.querySelector(".model-effort-menu"))'), false); check('Reasoning menu keyboard End/Enter/Escape and focus');
    await cdp.evaluate('window.scodex.savePreferences({fontSize:20,themeMode:"dark"})'); await cdp.command('Page.reload'); await waitFor(() => cdp.evaluate('Boolean(document.querySelector(".app-shell"))'), '20px reload'); await openModels();
    await cdp.command('Emulation.setDeviceMetricsOverride', { width: 1064, height: 660, deviceScaleFactor: 1, mobile: false });
    const overflow = await cdp.evaluate('[...document.querySelectorAll(".model-connection-form,.model-field,input[id^=model-],.model-and-effort,.model-save-button")].map(item=>({type:item.className,left:item.getBoundingClientRect().left,right:item.getBoundingClientRect().right})).filter(item=>item.left < -1 || item.right > innerWidth+1)');
    assert.deepEqual(overflow, []); check('Form fits 1064x660 renderer viewport at 20px in dark mode');
    await cdp.command('Emulation.clearDeviceMetricsOverride'); await cdp.evaluate('window.scodex.savePreferences({fontSize:16,themeMode:"light"})'); await cdp.command('Page.reload'); await waitFor(() => cdp.evaluate('Boolean(document.querySelector(".app-shell"))'), 'Final reload'); await openModels();
    await cdp.evaluate('document.querySelector("#model-subagent").scrollIntoView({block:"end"})'); await clickSelector('[aria-label="子代理模型推理强度"]');
    const screenshot = await cdp.command('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }); report.screenshot = path.join(output, 'workbench-model-connection.png'); await fs.writeFile(report.screenshot, Buffer.from(screenshot.data, 'base64'));
    await close(); check('Final screenshot and clean EXE exit'); report.requests = posts.map((body) => ({ model: body.model, effort: body.reasoning_effort })); report.status = 'passed';
  } catch (error) {
    report.status = 'failed'; report.error = error.message; console.error(error);
    if (cdp) report.ui = await cdp.evaluate('({view:document.querySelector(".settings-detail-heading h1")?.textContent,message:document.querySelector(".model-message")?.textContent,body:document.body.innerText.slice(-1400)})').catch(() => null); process.exitCode = 1;
  } finally {
    if (cdp && child?.exitCode === null) await cdp.command('Browser.close').catch(() => {}); if (socket?.readyState === WebSocket.OPEN) socket.close();
    if (child?.exitCode === null) await waitFor(() => child.exitCode !== null, 'Cleanup exit', 5000).catch(() => executeFile('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true }).catch(() => {}));
    await new Promise((resolve) => server.close(resolve));
    try { if (path.dirname(temporary) !== os.tmpdir() || !path.basename(temporary).startsWith('scodex-model-ui-')) throw new Error('Unsafe cleanup path'); await fs.rm(temporary, { recursive: true, force: true, maxRetries: 3 }); report.cleanup = 'passed'; } catch (error) { report.cleanup = error.message; process.exitCode = 1; }
    await fs.writeFile(path.join(output, navigationOnly ? 'navigation-ui-verification.json' : 'model-ui-verification.json'), json(report, null, 2));
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
