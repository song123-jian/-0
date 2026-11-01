// Real portable/React/IPC/files/commands; only the model is a loopback fixture.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const { connect, wait, freePort } = require('./agent-workflow-ui.cjs');
const { png, decodePng } = require('./image-fixtures.cjs');
const ExcelJS = require('exceljs');
const root = path.resolve(__dirname, '..');
const output = path.resolve(process.env.SCODEX_AUTO_OUTPUT || path.join(root, 'release/auto-interaction-20261031/red'));
const executable = path.resolve(process.env.SCODEX_AUTO_EXE || path.join(root, 'release/git-discard-reset-20261030/final/Scodex-Workbench-1.3.20-x64.exe'));
const version = process.env.SCODEX_AUTO_VERSION || '1.3.21';
const phase = process.env.SCODEX_AUTO_PHASE || 'red';
const scope = process.env.SCODEX_AUTO_SCOPE || 'full';
const temporary = path.join(process.env.SystemRoot || 'C:\\Windows', 'Temp', 'scodex-auto-' + crypto.randomUUID());
const workspace = path.join(temporary, 'project'), profile = path.join(temporary, 'profile'), fakeRoot = path.join(temporary, 'scodex');
const report = { status: 'running', phase, scope, executable, version, temporary, environment: { platform: process.platform, node: process.version }, checks: [], requests: [], approvals: [], limitations: ['Only the model is substituted by deterministic loopback responses. No public-model intent recognition is claimed.'] };
const json = JSON.stringify;
let child, socket, cdp, modelServer, endpoint, activeId, currentPrompt, debugPort;
async function insert(selector, value, client = cdp) {
  await client.evaluate(`(()=>{const e=document.querySelector(${json(selector)});if(!e)throw Error('Missing input');e.focus();const p=e instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(p,'value').set.call(e,${json(value)});e.dispatchEvent(new Event('input',{bubbles:true}));return true})()`);
}
async function click(selector, text, client = cdp) {
  await wait(() => client.evaluate(`(()=>{const e=[...document.querySelectorAll(${json(selector)})].find(e=>${text ? `e.textContent.trim()===${json(text)}` : 'true'});if(!e||e.disabled)return false;e.click();return true})()`), 'Missing button ' + selector + (text || ''), 15000);
}
async function chatRecord(id = activeId) { return cdp.evaluate(`window.scodex.getAppState().then(s=>s.library.conversations.find(c=>c.id===${json(id)}))`); }
async function submit(prompt, client = cdp, detached = false) {
  currentPrompt = prompt;
  await insert(detached ? '[aria-label="独立窗口输入工作内容"]' : '[aria-label="输入工作内容"]', prompt, client);
  await click(detached ? '[aria-label="独立窗口发送消息"]' : '[aria-label="发送消息"]', null, client);
  const chat = await wait(() => cdp.evaluate(`window.scodex.getAppState().then(s=>s.library.conversations.find(c=>c.messages.some(m=>m.role==='user'&&m.content===${json(prompt)})))`), 'Request not started', 15000);
  if (activeId) assert.equal(chat.id, activeId, 'Sequential requests must stay in the same conversation');
  activeId = chat.id;
}
async function finish(prompt = currentPrompt, approve = true, client = cdp) {
  const result = await wait(async () => {
    const state = await client.evaluate(`(()=>{const a=document.querySelector('.agent-approval');return {busy:Boolean(document.querySelector('[aria-label=停止生成],[aria-label=独立窗口停止生成]')),approval:a?{text:a.innerText,status:document.querySelector('.interaction-status')?.textContent}:null}})()`);
    if (state.approval) {
      report.approvals.push(state.approval);
      await click(approve ? '.agent-approval-actions button.primary-button' : '.agent-approval-actions button.secondary-button', undefined, client);
    }
    if (state.busy) return false;
    const chat = await chatRecord();
    const index = chat?.messages?.findLastIndex(m => m.role === 'user' && m.content === prompt);
    const response = index >= 0 ? chat.messages[index + 1] : null;
    return response && !response.pending ? { chat, response } : false;
  }, 'Request/persistence did not settle: ' + prompt, 60000);
  return result;
}
async function check(name, fn) { const evidence = await fn(); report.checks.push({ name, status: 'passed', evidence }); console.log('PASS ' + name); }
function call(name, args) { return { tool_calls: [{ id: 'call_' + crypto.randomBytes(6).toString('hex'), type: 'function', function: { name, arguments: json(args) } }] }; }
function sendModel(res, message) {
  res.writeHead(200, { 'content-type': 'text/event-stream; charset=utf-8' });
  const delta = { ...(message.content ? { content: message.content } : {}), ...(message.tool_calls ? { tool_calls: message.tool_calls.map((item, index) => ({ index, ...item })) } : {}) };
  res.write('data: ' + json({ choices: [{ delta }] }) + '\n\n');
  res.end('data: ' + json({ choices: [{ delta: {}, finish_reason: message.tool_calls ? 'tool_calls' : 'stop' }] }) + '\n\ndata: [DONE]\n\n');
}
async function modelResponse(body, res) {
  const textOf = m => typeof m?.content === 'string' ? m.content : (m?.content || []).filter(p => p.type === 'text').map(p => p.text).join('\n');
  const latest = body.messages.findLastIndex(m => m.role === 'user' && textOf(m).includes('自动衔接验收：'));
  const raw = body.messages[latest]?.content;
  const prompt = typeof raw === 'string' ? raw : (raw || []).filter(p => p.type === 'text').map(p => p.text).join('\n');
  const completed = body.messages.slice(latest + 1).filter(m => m.role === 'tool').map(m => JSON.parse(m.content));
  const tools = (body.tools || []).map(t => t.function.name), step = completed.length;
  report.requests.push({ prompt, step, tools, system: body.messages[0]?.content, results: completed.map(({ ok, error, hash, exitCode, width, height }) => ({ ok, error, hash, exitCode, width, height })) });
  if (prompt.includes('创建计算程序')) {
    if (!tools.includes('write_file')) return sendModel(res, { content: '当前没有文件工具，无法创建程序。' });
    const actions = [
      () => call('write_file', { path: 'calculator.cjs', expected_hash: 'new', content: "const sum = (a, b) => a + b;\nif (require.main === module) console.log(sum(2, 3));\nmodule.exports = sum;\n" }),
      () => call('read_file', { path: 'calculator.cjs' }),
      () => call('run_command', { command: 'node calculator.cjs', timeout_ms: 15000 }),
      () => ({ content: '已创建计算程序并运行，实际输出为5。' }),
    ];
    return sendModel(res, actions[Math.min(step, actions.length - 1)]());
  }
  if (prompt.includes('修改项目外文件')) {
    const target = path.join(temporary, 'outside', 'note.txt');
    const actions = [() => call('read_file', { path: target }), () => call('edit_file', { path: target, expected_hash: completed[0].hash, old_text: '原始内容', new_text: '已真实修改' }), () => call('read_file', { path: target }), () => ({ content: '项目外文件已修改并回读。' })];
    return sendModel(res, actions[Math.min(step, actions.length - 1)]());
  }
  if (prompt.includes('修改图片')) {
    const actions = [() => call('image_read', { path: 'source.png' }), () => call('image_edit', { path: 'source.png', expected_hash: completed[0].hash, output_path: 'edited.png', output_expected_hash: 'new', operations: [{ type: 'resize', width: 12, height: 8 }, { type: 'brightness', percent: 50 }] }), () => call('image_read', { path: 'edited.png' }), () => ({ content: '图片已真实缩放、调整亮度并回读。' })];
    return sendModel(res, actions[Math.min(step, actions.length - 1)]());
  }
  if (prompt.includes('修改表格')) {
    const actions = [() => call('spreadsheet_read', { path: 'data.xlsx', range: 'A1:B2' }), () => call('spreadsheet_edit', { path: 'data.xlsx', expected_hash: completed[0].hash, operations: [{ type: 'set_cells', sheet: 'Sheet1', cells: [{ address: 'A1', value: '已真实保存' }, { address: 'B2', value: 42 }] }] }), () => call('spreadsheet_read', { path: 'data.xlsx', range: 'A1:B2' }), () => ({ content: 'XLSX已修改保存并回读。' })];
    return sendModel(res, actions[Math.min(step, actions.length - 1)]());
  }
  if (prompt.includes('边界读取') && tools.includes('read_file') && !step) return sendModel(res, call('read_file', { path: 'calculator.cjs' }));
  return sendModel(res, { content: '解释：程序可以读取输入并计算结果；本轮只回答问题。' });
}
async function launch() {
  const port = await freePort();
  debugPort = port;
  child = spawn(executable, ['--remote-debugging-port=' + port, '--user-data-dir=' + profile, '--disable-gpu'], { cwd: path.dirname(executable), windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'], env: { ...process.env, SCODEX_HOME: fakeRoot, SCODEX_REFERENCE_HOME: path.join(temporary, 'reference'), SCODEX_REFERENCE_AGENTS_HOME: path.join(temporary, 'agents') } });
  let stderr = ''; child.stderr.on('data', d => { stderr = (stderr + d).slice(-3000); });
  const target = await wait(async () => {
    if (child.exitCode !== null) throw Error('EXE exited: ' + stderr);
    return (await fetch(`http://127.0.0.1:${port}/json/list`).then(r => r.json())).find(t => t.type === 'page' && t.url.startsWith('file:'));
  }, 'Actual EXE startup', 60000);
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
  cdp = connect(socket);
  await wait(() => cdp.evaluate('Boolean(window.scodex&&document.querySelector("[aria-label=输入工作内容]"))'), 'Renderer ready', 30000);
  await cdp.evaluate(`window.scodex.saveModelConnection({name:'自动衔接隔离验收',baseUrl:${json(endpoint)},model:'fixture-auto',toolProtocol:'native',models:['fixture-auto'],apiKey:'isolated-test-credential'})`);
  const origin = await cdp.evaluate('performance.timeOrigin');
  await cdp.command('Page.reload');
  await wait(() => cdp.evaluate(`performance.timeOrigin!==${origin}&&Boolean(document.querySelector("[aria-label=输入工作内容]"))`), 'Connection reload', 30000);
  const state = await cdp.evaluate('window.scodex.getAppState().then(s=>({version:s.version,workspaceRoot:s.workspaceRoot,id:s.library.activeId}))');
  return state;
}
async function quit() {
  if (cdp) await cdp.evaluate('window.scodex.quitApp()').catch(() => {});
  await wait(() => Promise.resolve(!child || child.exitCode !== null), 'EXE exit', 20000);
  socket?.close(); cdp = null; socket = null;
}
async function setGoal(value) {
  await click('[aria-label="添加工具和上下文"]');
  await click('.composer-goal-entry');
  await insert('#composer-goal', value);
  await click('.composer-goal-form button.primary-button');
  await wait(async () => (await chatRecord())?.goal === value, 'Goal save');
}
async function setContext(value) {
  await click('[aria-label="更改权限"]');
  await cdp.evaluate(`document.querySelectorAll('.permission-option')[${value === 'chat-only' ? 1 : 0}].click()`);
  await wait(() => cdp.evaluate(`window.scodex.getAppState().then(s=>s.preferences.contextAccess===${json(value)})`), 'Context setting');
}
async function greenChecks() {
  await check('no manual execution control and readable Microsoft YaHei', async () => {
    const result = await cdp.evaluate(`({toggles:document.querySelectorAll('.agent-execution-toggle').length,font:getComputedStyle(document.querySelector('[aria-label=输入工作内容]')).fontFamily,size:parseFloat(getComputedStyle(document.querySelector('[aria-label=输入工作内容]')).fontSize)})`);
    assert.equal(result.toggles, 0); assert.match(result.font, /YaHei|微软雅黑/); assert.ok(result.size >= 16); return result;
  });
  await submit('自动衔接验收：现在只解释刚才的计算程序'); const answer = await finish();
  await check('programming back to answer keeps one conversation and does not modify files', async () => {
    assert.equal(answer.response.operations?.length || 0, 0); assert.match(answer.response.content, /解释/); return { conversationId: activeId, operations: 0 };
  });
  await submit('自动衔接验收：修改项目外文件'); const outside = await finish();
  await check('real outside-project edit and ancestor instructions', async () => {
    const content = await fs.readFile(path.join(temporary, 'outside/note.txt'), 'utf8'); assert.equal(content, '已真实修改');
    assert.ok(outside.response.operations.some(o => o.name === 'edit_file' && o.status === 'succeeded'));
    return { content, operations: outside.response.operations };
  });
  await submit('自动衔接验收：修改图片，缩放到12乘8并降低亮度'); const picture = await finish();
  await check('actual Chromium image processing saves new pixels and dimensions', async () => {
    const decoded = decodePng(await fs.readFile(path.join(workspace, 'edited.png')));
    assert.equal(decoded.width, 12); assert.equal(decoded.height, 8); assert.ok(decoded.pixel(0, 0)[0] < 200);
    assert.ok(picture.response.operations.some(o => o.name === 'image_edit' && o.status === 'succeeded'));
    return { width: decoded.width, height: decoded.height, pixel: decoded.pixel(0, 0), operations: picture.response.operations };
  });
  await submit('自动衔接验收：修改表格，把A1和B2保存到真实XLSX'); const spreadsheet = await finish();
  await check('actual XLSX save and independent workbook reread', async () => {
    const workbook = new ExcelJS.Workbook(); await workbook.xlsx.readFile(path.join(workspace, 'data.xlsx'));
    assert.equal(workbook.worksheets[0].getCell('A1').value, '已真实保存'); assert.equal(workbook.worksheets[0].getCell('B2').value, 42);
    assert.ok(spreadsheet.response.operations.some(o => o.name === 'spreadsheet_edit' && o.status === 'succeeded'));
    return { A1: workbook.worksheets[0].getCell('A1').value, B2: workbook.worksheets[0].getCell('B2').value };
  });
  await click('[aria-label="添加工具和上下文"]'); await click('[title^="计划模式"]');
  const planPrompt = '自动衔接验收：边界读取，制定规划'; await submit(planPrompt); await finish();
  await check('planning catalog is read only in the real request', async () => {
    const request = report.requests.find(r => r.prompt === planPrompt); assert.ok(request.tools.includes('read_file'));
    for (const tool of ['write_file', 'edit_file', 'run_command', 'image_edit', 'spreadsheet_edit', 'service_start', 'task_send']) assert.equal(request.tools.includes(tool), false, tool);
    return { tools: request.tools };
  });
  await setContext('chat-only'); const chatOnly = '自动衔接验收：边界读取，仅对话'; await submit(chatOnly); await finish();
  await check('chat-only sends no local tools', async () => { const request = report.requests.find(r => r.prompt === chatOnly); assert.deepEqual(request.tools, []); return { tools: request.tools }; });
  await setContext('manual');
  const boundaryPrompt = '自动衔接验收：边界读取，测试本次授权'; await submit(boundaryPrompt); await finish();
  for (const allow of [false, true]) {
    await cdp.evaluate(`document.querySelectorAll('[aria-label="重新生成此回答"]')[document.querySelectorAll('[aria-label="重新生成此回答"]').length-1].click()`);
    await wait(() => cdp.evaluate(`Boolean(document.querySelector('.message-revision-dialog[open]'))`), 'Revision dialog');
    if (allow) await click('.message-revision-dialog input[type=checkbox]');
    const start = report.requests.length;
    await click('.message-revision-dialog button.primary-button'); await finish(boundaryPrompt);
    await check('revision local tools require current opt-in=' + allow, async () => {
      const request = report.requests.slice(start).find(r => r.prompt === boundaryPrompt); assert.ok(request); assert.equal(request.tools.includes('read_file'), allow);
      return { tools: request.tools, explicitAuthorization: allow };
    });
  }
  await setGoal('完成一个经过验证的本地工作台');
  const firstGoal = '自动衔接验收：解释第一轮目标'; await submit(firstGoal); await finish();
  const secondGoal = '自动衔接验收：解释第二轮目标'; await submit(secondGoal); await finish();
  await check('saved goal is included in consecutive real requests', async () => {
    for (const prompt of [firstGoal, secondGoal]) assert.match(report.requests.find(r => r.prompt === prompt).system, /完成一个经过验证的本地工作台/);
    return { goal: (await chatRecord()).goal };
  });
  await setGoal('检查目标编辑与重启恢复');
  await quit(); const restarted = await launch();
  await check('edited goal and same conversation survive a real EXE restart', async () => {
    assert.equal(restarted.id, activeId); assert.equal((await chatRecord()).goal, '检查目标编辑与重启恢复'); return { conversationId: activeId, goal: (await chatRecord()).goal };
  });
  await click('[aria-label="添加工具和上下文"]'); await click('.composer-goal-entry'); await click('.composer-goal-form button.secondary-button');
  await wait(async () => !(await chatRecord()).goal, 'Clear goal');
  const clearPrompt = '自动衔接验收：解释清除后的目标'; await submit(clearPrompt); await finish();
  await check('cleared goal is removed from subsequent requests', async () => { assert.equal(report.requests.find(r => r.prompt === clearPrompt).system.includes('检查目标编辑与重启恢复'), false); return { goal: (await chatRecord()).goal || '' }; });
  await cdp.evaluate(`window.scodex.openWorkspaceWindow('chat',${json(activeId)})`);
  const target = await wait(async () => (await fetch(`http://127.0.0.1:${debugPort}/json/list`).then(r => r.json())).find(t => t.type === 'page' && t.url.includes('workspaceWindow=chat')), 'Detached window');
  const detachedSocket = new WebSocket(target.webSocketDebuggerUrl); await new Promise(resolve => detachedSocket.addEventListener('open', resolve, { once: true }));
  const detached = connect(detachedSocket);
  try {
    await wait(() => detached.evaluate('Boolean(document.querySelector("[aria-label=独立窗口输入工作内容]"))'), 'Detached ready');
    await submit('自动衔接验收：边界读取，独立窗口直接调用', detached, true); const result = await finish(currentPrompt, true, detached);
    await check('detached window automatically calls tools and syncs results', async () => {
      assert.ok(result.response.operations.some(o => o.name === 'read_file' && o.status === 'succeeded')); assert.equal(await detached.evaluate('document.querySelectorAll(".agent-execution-toggle").length'), 0); return { conversationId: activeId, operations: result.response.operations };
    });
  } finally { detachedSocket.close(); }
  await collaborationChecks();
}
async function collaborationChecks() {
  // Initial/legacy chats may be ungrouped. Create the target through the normal
  // UI so it is explicitly bound to the active project before collaboration.
  await click('[aria-label="新聊天"]');
  activeId = null;
  await submit('自动衔接验收：边界读取，协作目标准备');
  const targetResult = await finish();
  const targetId = activeId;
  await check('collaboration target is explicitly project-bound through the UI', async () => {
    const chat = await chatRecord(targetId);
    assert.ok(chat.projectId);
    assert.ok(targetResult.response.operations.some(o => o.name === 'read_file' && o.status === 'succeeded'));
    return { targetId, projectId: chat.projectId };
  });
  await click('[aria-label="新聊天"]');
  const sourceId = await wait(() => cdp.evaluate(`window.scodex.getAppState().then(s=>s.library.activeId!==${json(targetId)}&&s.library.activeId)`), 'Collaboration source chat');
  for (const allow of [false, true]) {
    await click('[aria-label="聊天选项"]'); await click('.task-more-menu button', '任务协作');
    await wait(() => cdp.evaluate('Boolean(document.querySelector(".task-collaboration-dialog[open]"))'), 'Collaboration dialog');
    await cdp.evaluate(`(()=>{const e=document.querySelector('[aria-label="协作目标任务"]');e.value=${json(targetId)};e.dispatchEvent(new Event('change',{bubbles:true}));})()`);
    const prompt = '自动衔接验收：边界读取，协作授权=' + allow;
    await insert('[aria-label="任务交接内容"]', prompt);
    if (allow) await click('.task-collaboration-dialog input[type=checkbox]');
    const before = report.requests.length;
    await click('.task-collaboration-dialog button.primary-button');
    const targetCompletion = await wait(async () => {
      const chat = await chatRecord(targetId), index = chat.messages.findLastIndex(m => m.role === 'user' && m.content.includes(prompt));
      const response = index >= 0 ? chat.messages[index + 1] : null;
      // The persisted library normalizes an in-flight pending entry as cancelled.
      // Wait for the final reply to be saved, rather than treating !pending as done.
      return response && !response.pending && !response.cancelled && !response.error && response.content.trim() ? { chat, response } : false;
    }, 'Target collaboration did not settle', 30000);
    await check('collaboration uses only current authorization=' + allow, async () => {
      const request = report.requests.slice(before).find(r => r.prompt.includes(prompt)); assert.ok(request); assert.equal(request.tools.includes('read_file'), allow);
      assert.equal((await cdp.evaluate('window.scodex.getAppState().then(s=>s.library.activeId)')), sourceId);
      const operations = targetCompletion.response.operations || [];
      if (allow) assert.ok(operations.some(o => o.name === 'read_file' && o.status === 'succeeded'));
      else assert.equal(operations.length, 0);
      return { targetId, sourceId, explicitAuthorization: allow, tools: request.tools, operations };
    });
    await click('.task-collaboration-dialog .message-revision-buttons button.secondary-button');
  }
  await click(`[data-chat-id="${targetId}"]`);
  await check('full access never has zero approval prompts', async () => { assert.equal(report.approvals.length, 0); return { approvals: report.approvals.length }; });
  const screenshot = await cdp.command('Page.captureScreenshot', { format: 'png' });
  await fs.writeFile(path.join(output, 'actual-workbench.png'), Buffer.from(screenshot.data, 'base64'));
}
async function main() {
  await fs.mkdir(output, { recursive: true });
  try {
    for (const dir of [workspace, profile, fakeRoot, path.join(temporary, 'reference'), path.join(temporary, 'agents')]) await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(profile, 'settings.json'), json({ workspaceRoot: workspace, preferences: { browserPanelOpen: false, trayEnabled: false, contextAccess: 'manual' } }));
    await fs.writeFile(path.join(fakeRoot, 'codex-settings.json'), json({ sandboxMode: 'danger-full-access', approvalPolicy: phase === 'green' ? 'never' : 'on-request', availableReasoningEfforts: ['low'], defaultReasoningEffort: 'low', workspaceDependencies: false, networkAccess: true, networkDomains: ['*'], allowLocalBinding: true }));
    await fs.mkdir(path.join(temporary, 'outside')); await fs.writeFile(path.join(temporary, 'outside/note.txt'), '原始内容');
    await fs.writeFile(path.join(temporary, 'outside/AGENTS.md'), '项目外验收规则：只修改用户指定文件。');
    await fs.writeFile(path.join(workspace, 'source.png'), png(24, 16));
    const workbook = new ExcelJS.Workbook(); workbook.addWorksheet('Sheet1').getCell('A1').value = '原始内容'; await workbook.xlsx.writeFile(path.join(workspace, 'data.xlsx'));
    modelServer = http.createServer(async (req, res) => { try { let data = ''; for await (const d of req) data += d; await modelResponse(JSON.parse(data), res); } catch (e) { report.fixtureError = e.stack; if (!res.headersSent) res.writeHead(500); res.end(); } });
    await new Promise(resolve => modelServer.listen(0, '127.0.0.1', resolve));
    endpoint = `http://127.0.0.1:${modelServer.address().port}/v1`;
    const state = await launch();
    report.sha256 = crypto.createHash('sha256').update(await fs.readFile(executable)).digest('hex');
    await check('actual executable version and isolated project', async () => { assert.equal(state.version, version); assert.equal(path.resolve(state.workspaceRoot), workspace); return state; });
    await submit('自动衔接验收：先解释什么是程序'); await finish();
    await submit('自动衔接验收：创建计算程序 calculator.cjs 并运行验证');
    const result = await finish();
    await check('same-chat answer to real programming without an execution toggle', async () => {
      assert.equal(await fs.access(path.join(workspace, 'calculator.cjs')).then(() => true, () => false), true, 'Normal send must create the requested file without toggling execution');
      assert.match(await fs.readFile(path.join(workspace, 'calculator.cjs'), 'utf8'), /a \+ b/);
      assert.equal(result.response.operations?.find(o => o.name === 'run_command')?.exitCode, 0);
      assert.ok(report.requests.some(r => r.prompt.includes('创建计算程序') && r.tools.includes('write_file')));
      return { conversationId: activeId, operations: result.response.operations, text: result.response.content };
    });
    if (phase === 'green') {
      if (scope === 'collaboration') await collaborationChecks();
      else await greenChecks();
    }
    report.status = 'passed';
  } catch (error) {
    report.status = 'failed'; report.error = error.stack;
    report.ui = await cdp?.evaluate('window.scodex.getAppState().then(s=>({text:document.body.innerText.slice(-7000),status:document.querySelector(".interaction-status")?.textContent,library:s.library}))').catch(() => null);
    process.exitCode = 1;
  } finally {
    try { await quit(); report.processExited = true; } catch (e) { report.cleanupError = e.message; report.status = 'failed'; process.exitCode = 1; }
    if (modelServer) await new Promise(resolve => modelServer.close(resolve));
    if (report.processExited) {
      const resolved = path.resolve(temporary);
      assert.equal(path.dirname(resolved).toLowerCase(), path.resolve(process.env.SystemRoot || 'C:\\Windows', 'Temp').toLowerCase());
      try { await fs.rm(resolved, { recursive: true }); report.fixtureRemoved = true; }
      catch (e) { report.fixtureRemoved = false; report.fixtureCleanupError = e.message; }
    }
    await fs.writeFile(path.join(output, 'auto-interaction-ui-verification.json'), json(report, null, 2) + '\n');
    console.log(json({ status: report.status, checks: report.checks.length, error: report.error, report: path.join(output, 'auto-interaction-ui-verification.json') }));
  }
}
main();
