// Actual portable EXE + real files/processes. Only the external model is replaced
// by a deterministic, loopback OpenAI-compatible endpoint.
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
const output = path.join(root, 'release', 'agent-workflow-20261024');
const executable = path.join(output, 'Scodex-Workbench-1.1.0-x64.exe');
const resume = process.env.SCODEX_AGENT_RESUME;
const temporary = resume || path.join(os.tmpdir(), 'scodex-agent-ui-' + crypto.randomUUID());
const profile = path.join(temporary, 'profile'); const workspace = path.join(temporary, 'project'); const fakeRoot = path.join(temporary, 'scodex');
const report = { status: 'running', executable, version: '1.1.0', checks: [], environment: { platform: os.platform(), release: os.release(), node: process.version },
  limitations: ['External Grok is replaced by a deterministic loopback endpoint; actual EXE, renderer, IPC, files and PowerShell are used.'] };
let child, socket, cdp, modelServer, workflowChatId; const requests = []; const children = new Set();
const json = JSON.stringify;
const wait = async (fn, label, timeout = 25000) => { const end = Date.now() + timeout; let last; while (Date.now() < end) { try { const value = await fn(); if (value) return value; } catch (e) { last = e; } await new Promise((resolve) => setTimeout(resolve, 100)); } throw Error(label + (last ? ': ' + last.message : '')); };
function connect(ws) { let id = 0; const pending = new Map(); ws.addEventListener('message', ({ data }) => { const item = JSON.parse(data); const entry = pending.get(item.id); if (!entry) return; pending.delete(item.id); clearTimeout(entry.timer); item.error ? entry.reject(Error(item.error.message)) : entry.resolve(item.result); }); return {
  command(method, params = {}) { return new Promise((resolve, reject) => { const current = ++id; const timer = setTimeout(() => { pending.delete(current); reject(Error('CDP timeout ' + method)); }, 25000); pending.set(current, { resolve, reject, timer }); ws.send(json({ id: current, method, params })); }); },
  async evaluate(expression) { const result = await this.command('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, userGesture: true }); if (result.exceptionDetails) throw Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text); return result.result?.value; },
}; }
async function check(name, fn) { const evidence = await fn(); report.checks.push({ name, status: 'passed', evidence }); console.log('PASS ' + name); }
async function click(label) { await wait(() => cdp.evaluate(`(()=>{const e=document.querySelector('[aria-label=${json(label)}]');if(!e||e.disabled)return false;e.click();return true})()`), 'Missing button ' + label); }
async function textClick(selector, text) { await wait(() => cdp.evaluate(`(()=>{const e=[...document.querySelectorAll(${json(selector)})].find(e=>e.textContent.trim()===${json(text)});if(!e||e.disabled)return false;e.click();return true})()`), 'Missing ' + text); }
async function insert(selector, value) { await cdp.evaluate(`(()=>{const e=document.querySelector(${json(selector)});if(!e)throw Error('Input missing');e.focus();if(e instanceof HTMLTextAreaElement||e instanceof HTMLInputElement){const setter=Object.getOwnPropertyDescriptor(e instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,'value').set;setter.call(e,${json(value)});e.dispatchEvent(new Event('input',{bubbles:true}));}return true})()`); }
async function key(key, modifiers = 0, code = key) { const virtual = { Enter: 13, Escape: 27, s: 83, p: 80 }; const event = { key, code, modifiers, windowsVirtualKeyCode: virtual[key] || 0, nativeVirtualKeyCode: virtual[key] || 0 }; await cdp.command('Input.dispatchKeyEvent', { ...event, type: 'keyDown' }); await cdp.command('Input.dispatchKeyEvent', { ...event, type: 'keyUp' }); }
async function newChat() { await click('新聊天'); await wait(() => cdp.evaluate('!document.querySelector(".message-list")'), 'New conversation'); }
async function enableExecution() { if (await cdp.evaluate('document.querySelector("[aria-label=执行任务]").getAttribute("aria-pressed")') !== 'true') await click('执行任务'); await wait(() => cdp.evaluate('document.querySelector("[aria-label=执行任务]").getAttribute("aria-pressed")==="true"'), 'Execution enabled'); }
async function submit(prompt) { await insert('[aria-label="输入工作内容"]', prompt); await click('发送消息'); }
async function finish() { await wait(() => cdp.evaluate('!document.querySelector("[aria-label=停止生成]")'), 'Task did not finish', 45000); await cdp.evaluate('document.querySelectorAll(".agent-operation.failed:not([open]) > summary").forEach(e=>e.click())'); return cdp.evaluate('document.querySelector(".message-list")?.innerText||""'); }
async function approveAllUntilDone() { for (let i = 0; i < 30; i++) { const state = await wait(() => cdp.evaluate('document.querySelector(".agent-approval")?"approval":!document.querySelector("[aria-label=停止生成]")?"done":false'), 'Task/approval stalled', 45000); if (state === 'done') return; await textClick('.agent-approval-actions button', '允许本次命令'); } throw Error('Too many approvals'); }
function call(name, args, text = '') { return { content: text || null, tool_calls: [{ id: 'call_' + crypto.randomBytes(6).toString('hex'), type: 'function', function: { name, arguments: json(args) } }] }; }
function sendModel(res, message, broken = false) {
  res.writeHead(200, { 'content-type': 'text/event-stream; charset=utf-8' });
  const delta = { ...(message.content ? { content: message.content } : {}), ...(message.tool_calls ? { tool_calls: message.tool_calls.map((item, index) => ({ index, ...item })) } : {}) };
  res.write('data: ' + json({ choices: [{ delta }] }) + '\n\n');
  if (!broken) res.write('data: ' + json({ choices: [{ delta: {}, finish_reason: message.tool_calls ? 'tool_calls' : 'stop' }] }) + '\n\ndata: [DONE]\n\n');
  res.end();
}
async function modelResponse(body, res) {
  if (body.messages[0]?.content.includes('中转兼容执行通道') && body.messages.some(m=>m.role==='user'&&String(m.content).includes('兼容通道验收'))) {
    const results=body.messages.filter(m=>m.role==='user'&&String(m.content).startsWith('本机工具实际结果')).map(m=>JSON.parse(m.content.slice(m.content.indexOf('\n')+1)));
    const step=results.length;
    const value=step===0?{type:'tool',name:'read_file',arguments:{path:'compatible.txt'}}:step===1?{type:'tool',name:'edit_file',arguments:{path:'compatible.txt',old_text:'待验证',new_text:'兼容通道已执行',expected_hash:results[0].hash}}:step===2?{type:'tool',name:'read_file',arguments:{path:'compatible.txt'}}:{type:'final',content:'兼容通道已完成真实文件修改并回读。'};
    sendModel(res,{content:JSON.stringify(value)});return;
  }
  const latestUser = body.messages.findLastIndex((m) => m.role === 'user'); const prompt = body.messages[latestUser].content;
  const completed = body.messages.slice(latestUser + 1).filter((m) => m.role === 'tool').map((m) => JSON.parse(m.content));
  const step = completed.length; const names = (body.tools || []).map((t) => t.function.name);
  requests.push({ prompt: String(prompt).split('\n')[0], step, tools: names, systemContainsProjectRules: body.messages[0].content.includes('项目验收规则'), systemContainsSkill: body.messages[0].content.includes('技能验收正文') });
  if (String(prompt).includes('协议拒绝验收')) { res.writeHead(400, { 'content-type': 'application/json' }); res.end('{"error":{"message":"unsupported tools"}}'); return; }
  if (String(prompt).includes('中断协议验收')) { sendModel(res, call('write_file', { path: 'incomplete.txt', expected_hash: 'new', content: '不得写入' }), true); return; }
  if (String(prompt).includes('修复计算函数')) {
    const plan = (status) => [{ text: '检查项目和复现失败', status: status === 'begin' ? 'in_progress' : 'completed' }, { text: '精确修改计算函数', status: status === 'end' ? 'completed' : 'pending' }, { text: '运行验证并记录结果', status: status === 'end' ? 'completed' : 'pending' }];
    const actions = [
      () => call('update_plan', { steps: plan('begin') }, '先检查文件和现有测试。'),
      () => call('list_directory', {}),
      () => call('read_file', { path: 'src/calculator.cjs' }),
      () => call('run_command', { command: 'node tests/check.cjs', timeout_ms: 15000 }),
      () => { assert.equal(completed[3].exitCode, 1); return call('edit_file', { path: 'src/calculator.cjs', expected_hash: completed[2].hash, old_text: 'a - b', new_text: 'a + b' }, '测试返回非零退出码，修正计算函数。'); },
      () => call('search_text', { path: 'src', query: 'a + b' }),
      () => call('run_command', { command: 'node tests/check.cjs', timeout_ms: 15000 }),
      () => { assert.equal(completed[6].exitCode, 0); return call('write_file', { path: 'docs/验收结果.txt', expected_hash: 'new', content: '计算函数已修复，实际测试通过。\n' }); },
      () => call('update_plan', { steps: plan('end') }),
      () => ({ content: '已修复计算函数并写入验收结果。首次测试失败，精确修改后测试退出码为 0。' }),
    ]; sendModel(res, actions[step]()); return;
  }
  if (String(prompt).includes('取消命令验收')) {
    if (!step) sendModel(res, call('run_command', { command: "$p=Start-Process powershell.exe -ArgumentList '-NoProfile -Command Start-Sleep 30' -PassThru -WindowStyle Hidden; [Console]::Out.WriteLine('PROCESS:'+$p.Id); Start-Sleep 30", timeout_ms: 60000 }));
    else sendModel(res, call('write_file', { path: 'after-cancel.txt', content: '不得写入', expected_hash: 'new' })); return;
  }
  if (String(prompt).includes('拒绝命令验收')) { sendModel(res, step ? { content: '用户已拒绝命令，本次未执行。' } : call('run_command', { command: "[IO.File]::WriteAllText('denied.txt','no')" })); return; }
  if (String(prompt).includes('未保存保护验收') || String(prompt).includes('并发保护验收')) {
    if (!step) sendModel(res, call('read_file', { path: 'protected.txt' }));
    else if (step === 1) {
      if (String(prompt).includes('并发保护验收')) await fs.writeFile(path.join(workspace, 'protected.txt'), '外部程序新内容\n');
      sendModel(res, call('write_file', { path: 'protected.txt', content: '不应覆盖\n', expected_hash: completed[0].hash }));
    } else sendModel(res, { content: '文件保护已拒绝覆盖。' }); return;
  }
  if (String(prompt).includes('规划只读验收')) { assert.equal(names.includes('write_file'), false); assert.equal(names.includes('run_command'), false); sendModel(res, step ? { content: '已只读检查，未修改文件。' } : call('write_file', { path: 'plan-write.txt', content: 'no', expected_hash: 'new' })); return; }
  if (String(prompt).includes('受限命令验收')) { sendModel(res, step ? { content: '受限策略拒绝了任意 Shell。' } : call('run_command', { command: "[IO.File]::WriteAllText('restricted.txt','no')" })); return; }
  assert.equal(names.length, 0); sendModel(res, { content: '普通对话没有执行本机工具。' });
}
async function freePort() { const server = net.createServer(); await new Promise((r) => server.listen(0, '127.0.0.1', r)); const port = server.address().port; await new Promise((r) => server.close(r)); return port; }
async function launch(port) {
  child = spawn(executable, ['--remote-debugging-port=' + port, '--user-data-dir=' + profile, '--disable-gpu'], { cwd: output, windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'],
    env: { ...process.env, SCODEX_HOME: fakeRoot, SCODEX_REFERENCE_HOME: path.join(temporary, 'reference'), SCODEX_REFERENCE_AGENTS_HOME: path.join(temporary, 'agents') } });
  children.add(child); let errors = ''; child.stderr.on('data', (value) => { errors = (errors + value).slice(-4000); });
  const target = await wait(async () => { if (child.exitCode !== null) throw Error('EXE exited: ' + errors); return (await fetch(`http://127.0.0.1:${port}/json/list`).then((r) => r.json())).find((item) => item.type === 'page' && item.url.startsWith('file:')); }, 'Application startup', 40000);
  socket = new WebSocket(target.webSocketDebuggerUrl); await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); }); cdp = connect(socket);
  await wait(() => cdp.evaluate('Boolean(window.scodex&&document.querySelector(".task-chat-view textarea"))'), 'Renderer ready');
  await cdp.evaluate('document.title="Scodex 1.1.0 执行验收（隔离配置）"');
  return cdp.evaluate('window.scodex.getAppState().then(s=>({version:s.version,workspaceRoot:s.workspaceRoot,hasCredential:s.hasCredential}))');
}
async function quit() { await cdp.evaluate('window.scodex.quitApp()'); await wait(() => Promise.resolve(child.exitCode !== null), 'Application quit'); socket.close(); }
async function main() {
  try {
    if (!resume) {
    await fs.mkdir(path.join(workspace, 'src'), { recursive: true }); await fs.mkdir(path.join(workspace, 'tests')); await fs.mkdir(profile); await fs.mkdir(fakeRoot);
    await fs.writeFile(path.join(workspace, 'src', 'calculator.cjs'), 'module.exports = (a, b) => a - b;\r\n');
    await fs.writeFile(path.join(workspace, 'tests', 'check.cjs'), "const assert=require('node:assert/strict'); const calculate=require('../src/calculator.cjs'); assert.equal(calculate(2,3),5); console.log('实际中文验证通过');\n");
    await fs.writeFile(path.join(workspace, 'protected.txt'), '原内容\n'); await fs.writeFile(path.join(workspace, 'AGENTS.md'), '项目验收规则：保留中文内容。\n');
    await fs.mkdir(path.join(workspace, '.codex', 'skills', 'workflow'), { recursive: true });
    await fs.writeFile(path.join(workspace, '.codex', 'skills', 'workflow', 'SKILL.md'), '---\nname: 执行验收技能\ndescription: 技能验收正文\n---\n技能验收正文：使用项目测试验证修改。\n');
    await fs.writeFile(path.join(fakeRoot, 'codex-settings.json'), json({ sandboxMode: 'danger-full-access', approvalPolicy: 'on-request', availableReasoningEfforts: ['low'], defaultReasoningEffort: 'low', workspaceDependencies: false }));
    await fs.writeFile(path.join(profile, 'settings.json'), json({ workspaceRoot: workspace, preferences: { browserPanelOpen: false, trayEnabled: false } }));
    }
    modelServer = http.createServer(async (req, res) => { try { let text = ''; for await (const chunk of req) { text += chunk; if (text.length > 2000000) throw Error('Too large'); } await modelResponse(JSON.parse(text), res); } catch (error) { report.modelFixtureError = error.stack; if (!res.headersSent) res.writeHead(500); res.end(); } });
    await new Promise((resolve) => modelServer.listen(0, '127.0.0.1', resolve)); const endpoint = `http://127.0.0.1:${modelServer.address().port}/v1`;
    const debugPort = await freePort();
    if (resume) {
      const previous=JSON.parse(await fs.readFile(path.join(output,'agent-workflow-ui-verification.json'),'utf8'));
      assert.equal(previous.fixtureDirectory,temporary);
      const currentHash=crypto.createHash('sha256').update(await fs.readFile(executable)).digest('hex');
      if(previous.executableSha256!==currentHash) { assert.equal(previous.executableSha256,process.env.SCODEX_AGENT_ACCEPT_PREVIOUS_SHA);report.reuseReason='Native tool path preserved by guarded compatible-protocol extension; unchanged tools/command/editor behavior retains earlier actual evidence. New/affected paths are verified in this run and separate compatible/relay checks.'; }
      for(const item of previous.checks) item.validatedExecutableSha256 ||= previous.executableSha256;
      report.checks=previous.checks.filter(item=>item.status==='passed').map(item=>({...item,reused:true}));
      report.priorFailures=[...(previous.priorFailures||[]),{error:previous.error,at:previous.finishedAt}];
      await launch(debugPort);
      const saved=JSON.parse(await fs.readFile(path.join(profile,'conversations.json'),'utf8'));workflowChatId=saved.conversations.find(c=>c.title.includes('修复计算函数')).id;
    } else await check('actual portable identity and isolated project', async () => { const state = await launch(debugPort); assert.equal(state.version, '1.1.0'); assert.equal(path.resolve(state.workspaceRoot), workspace); return state; });
    await cdp.evaluate(`window.scodex.saveModelConnection({name:'本机工具协议验收',baseUrl:${json(endpoint)},model:'fixture-grok-tools',toolProtocol:'native',models:['fixture-grok-tools'],apiKey:'isolated-test-credential'}).then(()=>location.reload())`);
    await wait(() => cdp.evaluate('Boolean(document.querySelector("[aria-label=输入工作内容]"))'), 'Connection reload');
    if (!resume) {
    await enableExecution();
    // Choose the actual installed fixture Skill using the UI.
    await click('添加工具和上下文'); await wait(() => cdp.evaluate('Boolean(document.querySelector(".composer-popover"))'), 'Tools popover');
    await textClick('.composer-menu-item', '执行验收技能技能验收正文');
    await submit('修复计算函数程序并运行项目测试');
    await approveAllUntilDone();
    await check('model checks, reproduces failure, edits, runs and verifies in actual EXE', async () => {
      const text = await finish(); assert.match(text, /首次测试失败/);
      const source = await fs.readFile(path.join(workspace, 'src', 'calculator.cjs'), 'utf8'); assert.equal(source, 'module.exports = (a, b) => a + b;\r\n');
      assert.match(await fs.readFile(path.join(workspace, 'docs', '验收结果.txt'), 'utf8'), /实际测试通过/);
      const state = await wait(async()=>{const value=await cdp.evaluate('window.scodex.getAppState()');const chat=value.library.conversations.find(c=>c.id===value.library.activeId);return chat?.messages.at(-1)?.operations?.length===9&&chat.messages.at(-1).content.includes('首次测试失败')&&value;},'Workflow history persistence'); workflowChatId = state.library.activeId;
      const conversation = state.library.conversations.find((item) => item.id === workflowChatId); const operations = conversation.messages.at(-1).operations;
      assert.equal(operations.length, 9); assert.equal(operations.filter((item) => item.name === 'run_command' && item.status === 'failed')[0].exitCode, 1);
      assert.equal(operations.filter((item) => item.name === 'run_command' && item.status === 'succeeded')[0].exitCode, 0);
      assert.match(operations.find((item) => item.name === 'edit_file').diff, /a \+ b/);
      assert.equal(requests.filter((item) => item.prompt.includes('修复计算函数')).every((item) => item.systemContainsProjectRules && item.systemContainsSkill), true);
      return { operations: operations.length, exitCodes: [1, 0], source, skillApplied: true };
    });
    }
    if (!report.checks.some(c=>c.name==='exact command and directory are reviewable; refusal prevents execution')) {
    await newChat(); await enableExecution(); await submit('拒绝命令验收');
    await wait(() => cdp.evaluate('Boolean(document.querySelector(".agent-approval"))'), 'Command approval visible');
    await check('exact command and directory are reviewable; refusal prevents execution', async () => {
      const detail = await cdp.evaluate('document.querySelector(".agent-approval").innerText'); assert.match(detail, /denied.txt/); assert.ok(detail.includes(workspace));
      await textClick('.agent-approval-actions button', '拒绝'); const text = await finish(); assert.match(text, /用户拒绝/); await assert.rejects(fs.access(path.join(workspace, 'denied.txt'))); return { refused: true };
    });
    }
    if (!report.checks.some(c=>c.name==='stop terminates the real descendant and prevents subsequent file writes')) {
    await newChat(); await enableExecution(); await submit('取消命令验收'); await wait(() => cdp.evaluate('Boolean(document.querySelector(".agent-approval"))'), 'Cancel approval');
    await textClick('.agent-approval-actions button', '允许本次命令');
    const commandOutput = await wait(() => cdp.evaluate('(()=>{const e=[...document.querySelectorAll(".agent-operation")].find(e=>e.textContent.includes("PROCESS:"));return e?.textContent.match(/PROCESS:(\\d+)/)?.[1]})()'), 'Running descendant PID');
    await check('stop terminates the real descendant and prevents subsequent file writes', async () => {
      await click('停止生成'); const text = await finish(); assert.match(text, /已停止/); assert.throws(() => process.kill(Number(commandOutput), 0)); await assert.rejects(fs.access(path.join(workspace, 'after-cancel.txt'))); return { descendant: Number(commandOutput), terminated: true };
    });
    }
    if (!report.checks.some(c=>c.name==='external file update survives a stale model write')) {
    await newChat(); await enableExecution(); await submit('并发保护验收');
    await check('external file update survives a stale model write', async () => { const text = await finish(); assert.match(text, /基线已变化/); assert.equal(await fs.readFile(path.join(workspace, 'protected.txt'), 'utf8'), '外部程序新内容\n'); return true; });
    }
    if (process.env.SCODEX_AGENT_FINALIZE !== '1') {
    if (!report.checks.some(c=>c.name==='unsaved editor contents block model overwrite')) {
    await click('工具命令搜索'); await insert('[aria-label="搜索工作台操作"]', '文件与代码'); await key('Enter');
    await wait(() => cdp.evaluate('Boolean(document.querySelector(".file-view"))'), 'Files view');
    await wait(()=>cdp.evaluate(`(()=>{const e=document.querySelector('.file-tree-item[title="protected.txt"]');if(!e)return false;e.click();return true})()`),'Protected file visible');
    await wait(() => cdp.evaluate('document.querySelector(".cm-content")?.textContent.includes("外部程序")'), 'Editor ready');
    await cdp.evaluate('document.querySelector(".cm-content").focus()'); await cdp.command('Input.insertText', { text: '未保存的用户编辑' });
    await wait(() => cdp.evaluate('Boolean(document.querySelector(".file-view .dirty-dot"))'), 'Dirty state');
    await cdp.evaluate('document.querySelector(".activity-rail [aria-label=项目]").click()'); await newChat(); await enableExecution(); await submit('未保存保护验收');
    await check('unsaved editor contents block model overwrite', async () => { assert.match(await finish(), /未保存修改/); assert.equal(await fs.readFile(path.join(workspace, 'protected.txt'), 'utf8'), '外部程序新内容\n'); return true; });
    await key('p', 2, 'KeyP'); await wait(() => cdp.evaluate('Boolean(document.querySelector(".file-view"))'), 'Return editor'); await key('s', 2, 'KeyS');
    await wait(() => cdp.evaluate('!document.querySelector(".file-view .dirty-dot")'), 'Save user changes');
    }
    await cdp.evaluate('document.querySelector(".activity-rail [aria-label=项目]").click()'); await newChat(); await enableExecution(); await click('添加工具和上下文');
    await textClick('.composer-menu-item', '计划模式开启计划模式');
    await submit('规划只读验收');
    await check('planning hides mutation tools and rejects forged write calls', async () => { assert.match(await finish(), /没有开放此工具/); await assert.rejects(fs.access(path.join(workspace, 'plan-write.txt'))); return true; });
    await cdp.evaluate("window.scodex.saveAgentSettings({sandboxMode:'workspace-write',approvalPolicy:'never',networkAccess:true,networkDomains:[],allowLocalBinding:true},'shared')");
    await newChat(); await enableExecution(); await submit('受限命令验收');
    await check('restricted automatic shell is denied instead of pretending to provide a sandbox', async () => { assert.match(await finish(), /没有系统级沙箱/); await assert.rejects(fs.access(path.join(workspace, 'restricted.txt'))); return true; });
    await cdp.evaluate("window.scodex.saveAgentSettings({sandboxMode:'danger-full-access',approvalPolicy:'on-request'},'shared')");
    await newChat(); await enableExecution(); await submit('协议拒绝验收');
    await check('provider rejects tool protocol without automatic fallback or side effects', async () => { assert.match(await finish(), /HTTP 400/); return true; });
    await newChat(); await enableExecution(); await submit('中断协议验收');
    await check('incomplete stream never executes its write', async () => { assert.match(await finish(), /响应流提前中断/); await assert.rejects(fs.access(path.join(workspace, 'incomplete.txt'))); return true; });
    await newChat(); await submit('普通对话验收');
    await check('dialogue mode keeps tools disabled', async () => { assert.match(await finish(), /普通对话没有执行/); return true; });
    await cdp.evaluate("window.scodex.savePreferences({contextAccess:'chat-only'}).then(()=>location.reload())"); await wait(() => cdp.evaluate('Boolean(document.querySelector("[aria-label=执行任务]"))'), 'Restricted reload');
    await check('chat-only UI disables execution and backend ignores a forged execution flag', async () => {
      assert.equal(await cdp.evaluate('document.querySelector("[aria-label=执行任务]").disabled'), true);
      const events = await cdp.evaluate(`(async()=>{const events=[];const id=crypto.randomUUID();const off=window.scodex.onChatEvent(e=>{if(e.requestId===id)events.push(e)});try{await window.scodex.sendMessage({requestId:id,executionEnabled:true,prompt:'仅对话伪造请求'});return events}finally{off()}})()`);
      assert.equal(events.some((e) => e.type === 'operation'), false); assert.equal(events.at(-1).type, 'complete'); return true;
    });
    await cdp.evaluate("window.scodex.savePreferences({contextAccess:'manual'}).then(()=>location.reload())"); await wait(() => cdp.evaluate('Boolean(document.querySelector("[aria-label=执行任务]"))'), 'Manual reload');
    await fs.writeFile(path.join(workspace,'compatible.txt'),'状态：待验证\n');
    await click('工具命令搜索');await insert('[aria-label="搜索工作台操作"]','模型与连接');await key('Enter');
    await wait(()=>cdp.evaluate('Boolean(document.querySelector("[aria-label=任务执行通道]"))'),'Protocol setting visible');
    await cdp.evaluate('(()=>{const e=document.querySelector("[aria-label=任务执行通道]");e.value="json";e.dispatchEvent(new Event("change",{bubbles:true}))})()');
    await textClick('.model-save-button','保存配置');
    await wait(()=>cdp.evaluate('window.scodex.getModelConnection().then(s=>s.toolProtocol==="json")'),'Compatible protocol persisted');
    await cdp.evaluate('document.querySelector(".activity-rail [aria-label=项目]").click()');await newChat();await enableExecution();await submit('兼容通道验收');
    await check('compatible protocol and visible model-channel selection',async()=>{assert.match(await finish(),/兼容通道已完成/);assert.equal(await fs.readFile(path.join(workspace,'compatible.txt'),'utf8'),'状态：兼容通道已执行\n');return{protocol:'json',actions:['read_file','edit_file','read_file']};});
    }
    if (!report.checks.some(c=>c.name==='restart retains execution preference, trace, differences and test results')) {
    await quit(); await launch(debugPort);
    await check('restart retains execution preference, trace, differences and test results', async () => {
      const state = await cdp.evaluate('window.scodex.getAppState()'); const conversation = state.library.conversations.find((item) => item.id === workflowChatId);
      assert.equal(conversation.executionEnabled, true); const operations = conversation.messages.at(-1).operations; assert.equal(operations.length, 9); assert.match(operations.find((item) => item.name === 'edit_file').diff, /a \+ b/); assert.equal(operations.filter((item) => item.name === 'run_command').at(-1).exitCode, 0); return { operations: operations.length };
    });
    }
    if (!report.checks.some(c=>c.name==='command search opens execution on a new conversation')) {
      await newChat();assert.equal(await cdp.evaluate('document.querySelector("[aria-label=执行任务]").getAttribute("aria-pressed")'),'false');
      await click('工具命令搜索');await insert('[aria-label="搜索工作台操作"]','执行项目任务');await key('Enter');
      await check('command search opens execution on a new conversation',async()=>{await wait(()=>cdp.evaluate('document.querySelector("[aria-label=执行任务]").getAttribute("aria-pressed")=="true"'),'Execution command result');return {entry:'执行项目任务',executionEnabled:true}});
    }
    const workflowTitle = await cdp.evaluate(`window.scodex.getAppState().then(s=>s.library.conversations.find(c=>c.id===${json(workflowChatId)}).title)`);
    await cdp.evaluate(`(async()=>{const state=await window.scodex.getAppState();await window.scodex.saveHistory({...state.library,activeId:${json(workflowChatId)}});location.reload()})()`);
    await wait(()=>cdp.evaluate('Boolean(document.querySelector(".task-chat-view"))'),'Restored project page');
    await wait(() => cdp.evaluate('Boolean(document.querySelector(".agent-activity"))'), 'Workflow trace restored');
    await cdp.evaluate('(()=>{const operations=[...document.querySelectorAll(".agent-operation")];operations.find(e=>e.textContent.includes("精确修改")).open=true;const scroller=document.querySelector(".conversation-scroll");scroller.scrollTop=0})()');
    if (!report.checks.some(c=>c.name==='activity layout and readable font at desktop sizes')) {
    await check('activity layout and readable font at desktop sizes', async () => {
      const evidence = [];
      for (const [width, height] of [[1440, 900], [1064, 660]]) {
        await cdp.command('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
        const layout = await cdp.evaluate('(()=>{const e=document.querySelector(".agent-activity");const b=document.querySelector(".composer-box");return{bodyOverflow:document.documentElement.scrollWidth>innerWidth+1,activityOverflow:e.scrollWidth>e.clientWidth+1,font:getComputedStyle(e).fontFamily,fontSize:getComputedStyle(e).fontSize,composerBottom:b.getBoundingClientRect().bottom,viewport:innerHeight}})()');
        assert.equal(layout.bodyOverflow, false); assert.equal(layout.activityOverflow, false); assert.match(layout.font, /Microsoft YaHei/); assert.equal(layout.fontSize, '16px'); assert.ok(layout.composerBottom <= layout.viewport + 1); evidence.push({ width, height, ...layout });
      }
      await cdp.command('Emulation.clearDeviceMetricsOverride'); return evidence;
    });
    }
    if (process.env.SCODEX_AGENT_FINALIZE === '1') report.limitations.push('Native input remained unverified: text-only observation had no coordinate geometry; captured-geometry input was blocked because foreground window did not report a process id. Actual renderer/CDP functionality and native screenshot are recorded separately.');
    if (process.env.SCODEX_AGENT_NATIVE === '1') {
      await cdp.evaluate('document.title="Scodex 1.1.0 执行验收（隔离配置）"');
      await fs.writeFile(path.join(output, 'native-ready.json'), json({ status: 'ready', title: 'Scodex 1.1.0 执行验收（隔离配置）', profile, temporary, executable }));
      console.log('NATIVE_READY activity');
      await wait(async () => { try { const signal = JSON.parse(await fs.readFile(path.join(output, 'native-complete.json'), 'utf8')); return signal.profile === profile && signal.status === 'passed'; } catch { return false; } }, 'Native activity evidence', 180000);
    }
    const commandDetail = await cdp.evaluate("(()=>{const e=[...document.querySelectorAll(\".agent-operation.succeeded\")].find(e=>e.querySelector(\".agent-operation-title\")?.textContent.startsWith(\"运行命令\"));if(!e)throw Error(\"Successful command record missing\");if(!e.open)e.querySelector(\"summary\").click();const edit=[...document.querySelectorAll(\".agent-operation\")].find(e=>e.querySelector(\".agent-operation-title\")?.textContent.startsWith(\"精确修改\"));const scroller=document.querySelector(\".conversation-scroll\");scroller.scrollTop+=edit.getBoundingClientRect().top-scroller.getBoundingClientRect().top-50;return {exit:e.querySelector(\".agent-exit-code\")?.innerText,output:e.querySelector(\".agent-operation-output\")?.innerText}})()");
    assert.match(commandDetail.exit,/退出码：0/);assert.match(commandDetail.output,/实际中文验证通过/);report.finalVisibleCommand=commandDetail;
    const screenshot = await cdp.command('Page.captureScreenshot', { format: 'png' }); await fs.writeFile(path.join(output, 'agent-workflow.png'), Buffer.from(screenshot.data, 'base64')); report.screenshot = path.join(output, 'agent-workflow.png');
    await quit(); report.status = 'passed';
  } catch (error) { report.status = 'failed'; report.error = error.stack; console.error(error); process.exitCode = 1; }
  finally {
    try { report.finalUiState = socket?.readyState === 1 ? await cdp.evaluate('({text:document.querySelector(".message-list")?.innerText,pending:Boolean(document.querySelector("[aria-label=停止生成]"))})') : null; } catch {}
    try { if (socket?.readyState === 1) { await cdp.evaluate('window.scodex.cancelMessage(document.querySelector(".assistant-message")?.id)').catch(() => {}); await cdp.evaluate('window.scodex.quitApp()').catch(() => {}); } } catch {}
    for (const processHandle of children) if (processHandle.exitCode === null) { processHandle.kill(); await wait(() => Promise.resolve(processHandle.exitCode !== null), 'Cleanup child', 8000).catch(() => {}); }
    // Verify and terminate only the main process belonging to this exact
    // generated profile; killing a portable launcher alone leaves Electron alive.
    try {
      const script = "$needle='" + profile.replaceAll("'", "''") + "';Get-CimInstance Win32_Process -Filter \"Name='Scodex工作台.exe'\" | Where-Object {$_.CommandLine -and $_.CommandLine.Contains($needle) -and $_.CommandLine -notmatch '--type='} | Select-Object -ExpandProperty ProcessId";
      const result = await execFileAsync('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', script], { windowsHide: true, timeout: 5000 });
      const pids = result.stdout.trim().split(/\s+/).filter((p) => /^\d+$/.test(p));
      for (const pid of pids) await execFileAsync('taskkill.exe', ['/pid', pid, '/T', '/F'], { windowsHide: true, timeout: 8000 });
      report.cleanedIsolatedMainProcesses = pids.map(Number);
    } catch (error) { report.cleanupError = error.message; }
    socket?.close(); modelServer?.closeAllConnections(); await new Promise((resolve) => modelServer?.close(resolve) || resolve());
    report.finishedAt = new Date().toISOString(); report.fixtureDirectory = temporary; report.requests = requests; report.executableSha256 = crypto.createHash('sha256').update(await fs.readFile(executable)).digest('hex');
    await fs.writeFile(path.join(output, 'agent-workflow-ui-verification.json'), json(report)); console.log('RESULT ' + report.status);
  }
}
module.exports = { connect, wait, freePort };
if (require.main === module) main();
