// Actual 1.3.21 portable EXE and real project files. The model is replaced
// only by a deterministic loopback OpenAI-compatible endpoint.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const net = require('node:net');
const crypto = require('node:crypto');
const { spawn, execFile } = require('node:child_process');
const { promisify } = require('node:util');
const execFileAsync = promisify(execFile);

const root = path.resolve(__dirname, '..');
const output = process.env.SCODEX_SKILL_CONTEXT_OUTPUT
  ? path.resolve(process.env.SCODEX_SKILL_CONTEXT_OUTPUT)
  : path.join(root, 'release', 'workflow-completion-20261031', 'candidate-final');
const executable = path.join(output, 'Scodex-Workbench-1.3.21-x64.exe');
const temporary = path.join(os.tmpdir(), 'scodex-skill-context-ui-' + crypto.randomUUID());
const profile = path.join(temporary, 'profile');
const workspace = path.join(temporary, 'project');
const fakeRoot = path.join(temporary, 'scodex');
const report = {
  status: 'running', version: '1.3.21', executable,
  environment: { platform: os.platform(), release: os.release(), node: process.version },
  checks: [], requests: [],
  limitations: ['The external model is replaced by a deterministic loopback endpoint; the candidate EXE, renderer, IPC, files and PowerShell are real.'],
};
let child, socket, cdp, modelServer;
const children = new Set();
const json = JSON.stringify;

const wait = async (fn, label, timeout = 45000) => {
  const end = Date.now() + timeout; let last;
  while (Date.now() < end) {
    try { const value = await fn(); if (value) return value; } catch (error) { last = error; }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw Error(label + (last ? ': ' + last.message : ''));
};
function connect(ws) {
  let id = 0; const pending = new Map();
  ws.addEventListener('message', ({ data }) => {
    const item = JSON.parse(data), entry = pending.get(item.id); if (!entry) return;
    pending.delete(item.id); clearTimeout(entry.timer);
    item.error ? entry.reject(Error(item.error.message)) : entry.resolve(item.result);
  });
  return {
    command(method, params = {}) { return new Promise((resolve, reject) => {
      const current = ++id, timer = setTimeout(() => { pending.delete(current); reject(Error('CDP timeout ' + method)); }, 30000);
      pending.set(current, { resolve, reject, timer }); ws.send(json({ id: current, method, params }));
    }); },
    async evaluate(expression) {
      const result = await this.command('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, userGesture: true });
      if (result.exceptionDetails) throw Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
      return result.result?.value;
    },
  };
}
async function check(name, fn) { const evidence = await fn(); report.checks.push({ name, status: 'passed', evidence }); console.log('PASS ' + name); }
async function click(label) {
  await wait(() => cdp.evaluate(`(()=>{const e=document.querySelector('[aria-label=${json(label)}]');if(!e||e.disabled)return false;e.click();return true})()`), 'Missing button ' + label);
}
async function textClick(selector, text) {
  await wait(() => cdp.evaluate(`(()=>{const e=[...document.querySelectorAll(${json(selector)})].find(e=>e.textContent.trim()===${json(text)});if(!e||e.disabled)return false;e.click();return true})()`), 'Missing ' + text);
}
async function insert(selector, value) {
  await cdp.evaluate(`(()=>{const e=document.querySelector(${json(selector)});if(!e)throw Error('Input missing');e.focus();const p=e instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(p,'value').set.call(e,${json(value)});e.dispatchEvent(new Event('input',{bubbles:true}));return true})()`);
}
async function newChat() {
  const previous = await cdp.evaluate('window.scodex.getAppState().then(s=>s.library.activeId)');
  await click('新聊天');
  const activeId = await wait(async () => cdp.evaluate(`window.scodex.getAppState().then(s=>s.library.activeId!==${json(previous)}?s.library.activeId:false)`), 'New conversation');
  await wait(() => cdp.evaluate('!document.querySelector(".message-list")'), 'New conversation view');
  return activeId;
}
async function enableExecution() {
  if (await cdp.evaluate('document.querySelector("[aria-label=执行任务]").getAttribute("aria-pressed")') !== 'true') await click('执行任务');
  await wait(() => cdp.evaluate('document.querySelector("[aria-label=执行任务]").getAttribute("aria-pressed")==="true"'), 'Execution enabled');
}
async function submit(prompt) { await insert('[aria-label="输入工作内容"]', prompt); await click('发送消息'); }
async function finish() {
  await wait(() => cdp.evaluate('!document.querySelector("[aria-label=停止生成]")'), 'Task did not finish', 60000);
  return cdp.evaluate('document.querySelector(".message-list")?.innerText||""');
}
async function readPersistedOperations(conversationId = null, promptText = null) {
  return wait(async () => {
    const targetId = conversationId ? json(conversationId) : 'state?.library?.activeId';
    const promptMatch = promptText
      ? `item.messages?.some(message => typeof message.content === 'string' && message.content.includes(${json(promptText)}))`
      : 'true';
    const snapshot = await cdp.evaluate(`(async()=>{
      const state = await window.scodex.getAppState();
      const activeId = ${targetId};
      const chat = state?.library?.conversations?.find(item => item.id === activeId && (${promptMatch}));
      const messages = chat?.messages || [];
      const operations = messages.flatMap(item => Array.isArray(item.operations) ? item.operations : []);
      return { activeId, messageCount: messages.length, operations };
    })()`);
    return snapshot?.operations?.length ? snapshot : false;
  }, 'Persisted operation history did not settle', 30000);
}
async function approveAll() {
  for (let i = 0; i < 30; i++) {
    const state = await wait(() => cdp.evaluate('document.querySelector(".agent-approval")?"approval":!document.querySelector("[aria-label=停止生成]")?"done":false'), 'Task/approval stalled', 60000);
    if (state === 'done') return;
    await textClick('.agent-approval-actions button', '允许本次命令');
  }
  throw Error('Too many approvals');
}
function call(name, args, text = '') { return { content: text || null, tool_calls: [{ id: 'call_' + crypto.randomBytes(6).toString('hex'), type: 'function', function: { name, arguments: json(args) } }] }; }
function sendModel(res, message) {
  res.writeHead(200, { 'content-type': 'text/event-stream; charset=utf-8' });
  const delta = { ...(message.content ? { content: message.content } : {}), ...(message.tool_calls ? { tool_calls: message.tool_calls.map((item, index) => ({ index, ...item })) } : {}) };
  res.write('data: ' + json({ choices: [{ delta }] }) + '\n\n');
  res.write('data: ' + json({ choices: [{ delta: {}, finish_reason: message.tool_calls ? 'tool_calls' : 'stop' }] }) + '\n\ndata: [DONE]\n\n');
  res.end();
}
async function modelResponse(body, res) {
  const latestUser = body.messages.findLastIndex(m => m.role === 'user');
  const prompt = String(body.messages[latestUser]?.content || '');
  const completed = body.messages.slice(latestUser + 1).filter(m => m.role === 'tool').map(m => JSON.parse(m.content));
  const step = completed.length;
  const names = (body.tools || []).map(t => t.function.name);
  report.requests.push({ prompt: prompt.split('\n')[0], step, tools: names, ...(prompt.includes('普通文件工具边界实际验收') ? { fileBoundaryToolResults: completed.map(({ ok, error }) => ({ ok, error })) } : {}), systemContainsProjectRules: body.messages[0].content.includes('项目验收规则'), systemContainsSkill: body.messages[0].content.includes('技能验收正文') });
  if (prompt.includes('普通文件工具边界实际验收')) {
    const results = [
      () => call('read_file', { path: 'fixtures/binary.bin' }),
      () => call('read_file', { path: 'fixtures/oversized.txt' }),
      () => ({ content: '普通文件工具拒绝结果：' + JSON.stringify(completed.map(({ ok, error }) => ({ ok, error }))) }),
    ];
    if (step < results.length) return sendModel(res, results[step]());
  }
  if (!prompt.includes('技能上下文实际验收')) return sendModel(res, { content: '未请求技能上下文验收。' });
  const results = [
    () => call('update_plan', { steps: [{ text: '读取项目和技能资料', status: 'in_progress' }, { text: '复现并修复测试失败', status: 'pending' }, { text: '回读并运行验证', status: 'pending' }] }),
    () => call('list_directory', {}),
    () => call('read_file', { path: 'src/calculator.cjs' }),
    () => call('run_command', { command: 'node tests/check.cjs', timeout_ms: 15000 }),
    () => call('skill_read', { path: 'references/guide.md' }),
    () => call('edit_file', { path: 'src/calculator.cjs', old_text: 'a - b', new_text: 'a + b', expected_hash: completed[2].hash }),
    () => call('run_command', { command: 'node tests/check.cjs', timeout_ms: 15000 }),
    () => call('read_file', { path: 'src/calculator.cjs' }),
    () => ({ content: '技能资料已按包内相对路径读取；已复现失败、精确修改并回读，最终测试通过。' }),
  ];
  if (step < results.length) return sendModel(res, results[step]());
  return sendModel(res, { content: '技能上下文验收完成。' });
}
async function freePort() { const server = net.createServer(); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); const port = server.address().port; await new Promise(resolve => server.close(resolve)); return port; }
async function launch(port, endpoint) {
  child = spawn(executable, ['--remote-debugging-port=' + port, '--user-data-dir=' + profile, '--disable-gpu'], { cwd: output, windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'], env: { ...process.env, SCODEX_HOME: fakeRoot, SCODEX_REFERENCE_HOME: path.join(temporary, 'reference'), SCODEX_REFERENCE_AGENTS_HOME: path.join(temporary, 'agents') } });
  children.add(child); let errors = ''; child.stderr.on('data', value => { errors = (errors + value).slice(-4000); });
  const target = await wait(async () => { if (child.exitCode !== null) throw Error('EXE exited: ' + errors); const response = await fetch(`http://127.0.0.1:${port}/json/list`); const items = await response.json(); return items.find(item => item.type === 'page' && item.url.startsWith('file:')); }, 'Application startup', 50000);
  socket = new WebSocket(target.webSocketDebuggerUrl); await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); }); cdp = connect(socket);
  await wait(() => cdp.evaluate('Boolean(window.scodex&&document.querySelector(".task-chat-view textarea"))'), 'Renderer ready');
  await cdp.evaluate(`window.scodex.saveModelConnection({name:'技能上下文隔离验收',baseUrl:${json(endpoint)},model:'fixture-skill-context',toolProtocol:'native',models:['fixture-skill-context'],apiKey:'isolated-test-credential'}).then(()=>location.reload())`);
  await wait(() => cdp.evaluate('Boolean(document.querySelector("[aria-label=输入工作内容]"))'), 'Connection reload');
  return cdp.evaluate('window.scodex.getAppState().then(s=>({version:s.version,workspaceRoot:s.workspaceRoot}))');
}
async function quit() { if (cdp) await cdp.evaluate('window.scodex.quitApp()').catch(() => {}); await wait(() => Promise.resolve(!child || child.exitCode !== null), 'Application quit', 20000).catch(() => {}); socket?.close(); }
async function main() {
  try {
    await fs.mkdir(path.join(workspace, 'src'), { recursive: true }); await fs.mkdir(path.join(workspace, 'tests'), { recursive: true }); await fs.mkdir(path.join(workspace, '.codex', 'skills', 'workflow', 'references'), { recursive: true }); await fs.mkdir(profile, { recursive: true }); await fs.mkdir(fakeRoot, { recursive: true });
    await fs.writeFile(path.join(workspace, 'src', 'calculator.cjs'), 'module.exports = (a, b) => a - b;\r\n');
    await fs.writeFile(path.join(workspace, 'tests', 'check.cjs'), "const assert=require('node:assert/strict'); const calculate=require('../src/calculator.cjs'); assert.equal(calculate(2,3),5); console.log('实际中文验证通过');\n");
    await fs.writeFile(path.join(workspace, 'AGENTS.md'), '项目验收规则：保留中文内容。\r\n');
    await fs.writeFile(path.join(workspace, '.codex', 'skills', 'workflow', 'SKILL.md'), '---\r\nname: 执行验收技能\r\ndescription: 技能验收正文\r\n---\r\n技能验收正文：读取 references/guide.md 后使用项目测试验证修改。\r\n');
    await fs.writeFile(path.join(workspace, '.codex', 'skills', 'workflow', 'references', 'guide.md'), '真实资料：技能资料只能按包内相对路径读取。\r\n');
    await fs.writeFile(path.join(fakeRoot, 'codex-settings.json'), json({ sandboxMode: 'danger-full-access', approvalPolicy: 'on-request', availableReasoningEfforts: ['low'], defaultReasoningEffort: 'low', workspaceDependencies: false }));
    await fs.writeFile(path.join(profile, 'settings.json'), json({ workspaceRoot: workspace, preferences: { browserPanelOpen: false, trayEnabled: false, contextAccess: 'manual', skillsEnabled: true } }));
    modelServer = http.createServer(async (req, res) => { try { let text = ''; for await (const chunk of req) text += chunk; await modelResponse(JSON.parse(text), res); } catch (error) { if (!res.headersSent) res.writeHead(500); res.end(); report.modelFixtureError = error.stack; } });
    await new Promise(resolve => modelServer.listen(0, '127.0.0.1', resolve));
    const endpoint = `http://127.0.0.1:${modelServer.address().port}/v1`, port = await freePort();
    const state = await launch(port, endpoint);
    await check('actual portable identity and isolated project', async () => { assert.equal(state.version, '1.3.21'); assert.equal(path.resolve(state.workspaceRoot), workspace); return state; });
    await enableExecution(); await click('添加工具和上下文'); await wait(() => cdp.evaluate('Boolean(document.querySelector(".composer-popover"))'), 'Tools popover');
    await textClick('.composer-menu-item', '执行验收技能技能验收正文'); await submit('技能上下文实际验收：读取技能资料并修复计算函数'); await approveAll();
    await check('selected skill resource and project read-modify-read execute in the actual EXE', async () => {
      const text = await finish(); assert.match(text, /技能资料已按包内相对路径读取/);
      assert.equal(await fs.readFile(path.join(workspace, 'src', 'calculator.cjs'), 'utf8'), 'module.exports = (a, b) => a + b;\r\n');
      assert.equal(report.requests.some(item => item.systemContainsSkill && item.systemContainsProjectRules), true);
      const { operations } = await readPersistedOperations();
      assert.equal(operations.filter(item => item.name === 'skill_read' && item.status === 'succeeded').length, 1); assert.equal(operations.filter(item => item.name === 'run_command').map(item => item.exitCode).join(','), '1,0'); assert.equal(operations.filter(item => item.name === 'read_file').length, 2);
      return { operations: operations.length, skillRead: true, exitCodes: [1, 0], source: await fs.readFile(path.join(workspace, 'src', 'calculator.cjs'), 'utf8') };
    });
    await fs.mkdir(path.join(workspace, 'fixtures'), { recursive: true });
    await fs.writeFile(path.join(workspace, 'fixtures', 'binary.bin'), Buffer.from([0, 1, 2, 3]));
    await fs.writeFile(path.join(workspace, 'fixtures', 'oversized.txt'), Buffer.alloc(2 * 1024 * 1024 + 1, 65));
    const fixtureHashes = await Promise.all(['binary.bin', 'oversized.txt'].map(async name => crypto.createHash('sha256').update(await fs.readFile(path.join(workspace, 'fixtures', name))).digest('hex')));
    const boundaryChatId = await newChat(); await enableExecution(); await submit('普通文件工具边界实际验收：二进制和超大文件必须拒绝'); await approveAll();
    await check('ordinary file tools reject binary and oversized inputs in the actual EXE', async () => {
      const transcript = await finish();
      assert.match(transcript, /二进制文件不能通过文本工具读写/);
      assert.match(transcript, /2 MB 以内/);
      const boundaryRequests = report.requests.filter(item => item.prompt.includes('普通文件工具边界实际验收'));
      assert.equal(boundaryRequests.length, 3);
      assert.deepEqual(boundaryRequests[1].fileBoundaryToolResults, [{ ok: false, error: '二进制文件不能通过文本工具读写。' }]);
      assert.deepEqual(boundaryRequests[2].fileBoundaryToolResults, [
        { ok: false, error: '二进制文件不能通过文本工具读写。' },
        { ok: false, error: '文本工具只处理 2 MB 以内的普通文件。' },
      ]);
      const fileHashes = await Promise.all(['binary.bin', 'oversized.txt'].map(async name => crypto.createHash('sha256').update(await fs.readFile(path.join(workspace, 'fixtures', name))).digest('hex')));
      assert.deepEqual(fileHashes, fixtureHashes);
      const persisted = await readPersistedOperations(boundaryChatId, '普通文件工具边界实际验收');
      assert.equal(persisted.activeId, boundaryChatId);
      const { operations } = persisted;
      const fileReads = operations.filter(item => item.name === 'read_file');
      assert.equal(fileReads.length, 2);
      assert.deepEqual(fileReads.map(item => ({ status: item.status, output: item.output })), [
        { status: 'failed', output: '二进制文件不能通过文本工具读写。' },
        { status: 'failed', output: '文本工具只处理 2 MB 以内的普通文件。' },
      ]);
      return { reads: fileReads.map(item => ({ status: item.status, output: item.output })), fixtureBytes: [4, 2 * 1024 * 1024 + 1], fixtureHashes };
    });
    await check('disabled selected skill is rejected by the real main process', async () => {
      const skills = await cdp.evaluate('window.scodex.listSkills()'); const selected = skills.find(item => item.name === '执行验收技能') || skills.find(item => item.id.includes('workspace:')) || skills[0]; assert.ok(selected?.id);
      await cdp.evaluate(`window.scodex.savePreferences(${json({ disabledSkillIds: [selected.id] })})`);
      const requestCount = report.requests.length;
      const outcome = await cdp.evaluate(`(async()=>{const state=await window.scodex.getAppState();try{await window.scodex.sendMessage({requestId:crypto.randomUUID(),conversationId:state.library.activeId,projectId:state.activeProjectId,executionEnabled:true,skillId:${json(selected.id)},skill:${json(selected.content)},prompt:'技能停用边界验收',mode:'code',requestKind:'chat',reasoningEffort:'low',model:'fixture-skill-context',messages:[]});return {rejected:false,error:''}}catch(error){return {rejected:true,error:String(error?.message||error)}}})()`);
      await new Promise(resolve => setTimeout(resolve, 250));
      assert.equal(outcome.rejected, true); assert.match(outcome.error, /所选技能已在插件设置中停用/); assert.equal(report.requests.length, requestCount);
      return { disabledSkillId: selected.id, rejected: true, error: outcome.error, modelRequestsAdded: report.requests.length - requestCount };
    });
    await quit(); report.status = 'passed';
  } catch (error) { report.status = 'failed'; report.error = error.stack; console.error(error); process.exitCode = 1; }
  finally {
    try { if (socket?.readyState === 1) await cdp.evaluate('window.scodex.quitApp()').catch(() => {}); } catch {}
    for (const handle of children) if (handle.exitCode === null) { handle.kill(); await wait(() => Promise.resolve(handle.exitCode !== null), 'Cleanup child', 8000).catch(() => {}); }
    try { const script = "$needle='" + profile.replaceAll("'", "''") + "';Get-CimInstance Win32_Process -Filter \"Name='Scodex工作台.exe'\" | Where-Object {$_.CommandLine -and $_.CommandLine.Contains($needle) -and $_.CommandLine -notmatch '--type='} | Select-Object -ExpandProperty ProcessId"; const result = await execFileAsync('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', script], { windowsHide: true, timeout: 5000 }); for (const pid of result.stdout.trim().split(/\s+/).filter(p => /^\d+$/.test(p))) await execFileAsync('taskkill.exe', ['/pid', pid, '/T', '/F'], { windowsHide: true, timeout: 8000 }); } catch {}
    socket?.close(); modelServer?.closeAllConnections(); await new Promise(resolve => modelServer?.close(resolve) || resolve());
    report.finishedAt = new Date().toISOString(); report.fixtureDirectory = temporary; report.executableSha256 = crypto.createHash('sha256').update(await fs.readFile(executable)).digest('hex');
    await fs.writeFile(path.join(path.dirname(output), 'skill-context-ui-verification.json'), json(report, null, 2) + '\n'); console.log('RESULT ' + report.status);
  }
}
if (require.main === module) main();
