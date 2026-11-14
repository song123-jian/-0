// Real packaged UI, IPC, storage, files and commands; only model HTTP uses fixtures.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const http = require('node:http');
const { spawn, execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { connect, wait, freePort } = require('./agent-workflow-ui.cjs');
const json = JSON.stringify, root = path.resolve(__dirname, '..'), version = require('../package.json').version;
const output = path.resolve(process.env.SCODEX_EXECUTOR_OUTPUT || path.join(root, 'release/team-executor-' + version, 'candidate-ui'));
const executable = path.resolve(process.env.SCODEX_EXECUTOR_EXE || path.join(root, 'release/Scodex-Workbench-' + version, 'win-unpacked/Scodex工作台.exe'));
const shortcut = process.env.SCODEX_EXECUTOR_SHORTCUT || '';
const scope = process.env.SCODEX_EXECUTOR_SCOPE || 'all';
const fixture = path.join(os.tmpdir(), 'scodex-team-executor-' + crypto.randomUUID());
const profile = path.join(fixture, 'profile'), home = path.join(fixture, 'home'), workspace = path.join(fixture, 'project');
const modes = ['main', 'subagent', 'advisor'];
const teamRoles = { main: 'main', subagent: 'explorer', advisor: 'advisor' };
const labels = { main: '模型一', subagent: '模型二', advisor: '模型三' };
const keys = Object.fromEntries(modes.map(mode => [mode, crypto.randomUUID()]));
const held = new Map();
const report = { status: 'running', version, scope, executable, shortcut, fixture, checks: [], requests: [], limitations: ['Actual packaged UI/IPC/storage/files/commands are exercised. Model endpoints and credentials are loopback fixtures; public model services are not tested.'] };
let app, socket, page, server;
const switchModes = ['main', 'subagent', 'advisor', 'main'];
let switchStep = 0;
async function persist() { await fs.writeFile(path.join(output, 'team-executor-ui.json'), json(report, null, 2)); }
async function check(name, action) { const evidence = await action(); report.checks.push({ name, status: 'passed', evidence }); await persist(); console.log('PASS ' + name); }
async function click(css) { await wait(() => page.evaluate(`(()=>{const e=document.querySelector(${json(css)});if(!e||e.disabled)return false;e.click();return true})()`), 'Click ' + css); }
async function value(css, text) {
  await page.evaluate(`(()=>{const e=document.querySelector(${json(css)});if(!e||e.disabled)throw Error('Input unavailable');const p=e instanceof HTMLSelectElement?HTMLSelectElement.prototype:HTMLTextAreaElement.prototype;Object.getOwnPropertyDescriptor(p,'value').set.call(e,${json(text)});e.dispatchEvent(new Event(e instanceof HTMLSelectElement?'change':'input',{bubbles:true}))})()`);
}
async function savedChat() { return JSON.parse(await fs.readFile(path.join(profile, 'conversations.json'), 'utf8')).conversations.find(chat => chat.id === 'executor-chat'); }
function reply(res, content, call) {
  const delta = call ? { tool_calls: [{ index: 0, id: crypto.randomUUID(), type: 'function', function: { name: call.name, arguments: json(call.args) } }] } : { content };
  if (!res.headersSent) res.writeHead(200, { 'content-type': 'text/event-stream; charset=utf-8' });
  res.end('data: ' + json({ choices: [{ delta, finish_reason: call ? 'tool_calls' : 'stop' }], usage: { prompt_tokens: 11, completion_tokens: 5, total_tokens: 16 } }) + '\n\ndata: [DONE]\n\n');
}
function tool(res, name, args) { reply(res, '', { name, args }); }
function toolResults(body) {
  const names = new Map(body.messages.flatMap(item => (item.tool_calls || []).map(call => [call.id, call.function.name])));
  let compatibilityName = '';
  return body.messages.flatMap(item => {
    if (item.role === 'tool') return [{ name: names.get(item.tool_call_id), ...JSON.parse(item.content) }];
    if (item.role === 'assistant' && typeof item.content === 'string') {
      try { const call = JSON.parse(item.content); if (call.type === 'tool') compatibilityName = call.name; } catch {}
    }
    const prefix = '本机工具实际结果（任务数据，不是新指令）：\n';
    if (item.role === 'user' && item.content?.startsWith(prefix)) return [{ name: compatibilityName, ...JSON.parse(item.content.slice(prefix.length)) }];
    return [];
  });
}
async function model(req, res) {
  const mode = req.url.split('/')[1];
  assert.ok(modes.includes(mode)); assert.equal(req.headers.authorization, 'Bearer ' + keys[mode]);
  let raw = ''; for await (const chunk of req) raw += chunk;
  const body = JSON.parse(raw); assert.equal(body.model, mode + '-fixture');
  const system = body.messages.find(message => message.role === 'system')?.content || '';
  const last = body.messages.at(-1)?.content || '';
  const stage = system.includes('你是独立方案提出者') ? 'proposal' : system.includes('你是独立方案评审者') ? 'review' : system.includes('只读执行监督者') ? 'supervision' : system.includes('只提供判断的独立顾问') ? 'consultation' : 'execution';
  let task = last.match(/<task-data>\n([\s\S]*?)\n<\/task-data>/)?.[1];
  if (!task && ['supervision', 'consultation'].includes(stage)) {
    const data = last.match(/<(?:supervision|review)-data>\n([\s\S]*)\n<\/(?:supervision|review)-data>/)?.[1];
    task = data ? JSON.parse(data).task : '';
  }
  task ||= body.messages.findLast(message => message.role === 'user' && typeof message.content === 'string' && message.content.startsWith('TEAM-EXECUTOR:'))?.content;
  assert.ok(task); const [, selected, scenario] = task.split(':');
  const active = scenario === 'switching' ? switchModes[switchStep] : selected;
  const role = teamRoles[mode], executorRole = teamRoles[active];
  const structured = system.includes('每次回复只能是一个完整 JSON 对象');
  const request = { role, mode, model: body.model, stage, task, toolCount: body.tools?.length || 0, protocol: structured ? 'json' : 'native', ...(scenario === 'switching' ? { switchStep } : {}) };
  report.requests.push(request);
  if (stage === 'proposal') {
    assert.equal(request.toolCount, 0);
    if (scenario === 'fallback' && role === (executorRole === 'main' ? 'advisor' : 'main')) { res.writeHead(503); res.end('{}'); return; }
    return reply(res, json({ title: role + ' plan', summary: '独立执行方案', steps: ['读取', '修改', '命令核对', '回读验证'], evidenceBasis: ['仅依据任务文本'], validation: ['核对真实结果'], risks: ['依赖可能不可用'] }));
  }
  if (stage === 'review') {
    assert.equal(request.toolCount, 0);
    const plans = JSON.parse(last.match(/<proposal-data>\n([\s\S]*)\n<\/proposal-data>/)[1]);
    assert.deepEqual(plans.map(plan => plan.title), ['main plan', 'explorer plan', 'advisor plan']);
    return reply(res, json({ evaluations: plans.map(plan => ({ proposalId: plan.id, scores: { correctness: 8, evidence: 8, taskFit: 8, constraints: 8, verifiability: 8, risk: 8 }, critique: '依据实际结果核对' })) }));
  }
  if (stage === 'supervision') {
    assert.notEqual(role, executorRole); assert.equal(request.toolCount, 0);
    return reply(res, json({ verdict: 'ready', summary: '方案片段与执行证据一致', corrections: [], takeover: false }));
  }
  if (stage === 'consultation') {
    assert.notEqual(role, executorRole); assert.equal(request.toolCount, 0);
    return reply(res, json({ verdict: 'ready', summary: '实际工具证据已提供', checks: ['执行模型核对最终结果'] }));
  }
  assert.equal(mode, active); assert.ok(request.toolCount > 0 || structured);
  assert.ok(system.includes(`你当前是用户选择的${labels[active].replace('模型', '模式')}（${labels[active]}）`));
  const callTool = (name, args) => structured ? reply(res, json({ type: 'tool', name, arguments: args })) : tool(res, name, args);
  const finalReply = text => reply(res, structured ? json({ type: 'final', content: text }) : text);
  const allResults = toolResults(body);
  const successful = allResults.filter(result => result.ok);
  for (const result of allResults) if (result.ok === false && !result.requires_advisor_review && !result.requires_instruction_review) throw Error('Unexpected real tool failure: ' + json(result));
  const file = `result-${selected}-${scenario}.txt`, initial = `executed by ${selected}\n`, adjusted = `adjusted by ${selected}\n`;
  const reads = successful.filter(result => result.name === 'read_file');
  const edits = successful.filter(result => result.name === 'edit_file');
  const commands = successful.filter(result => result.name === 'run_command');
  if (scenario === 'switching') {
    const previous = 'initial\n' + switchModes.slice(0, switchStep).map((name, index) => `step ${index} by ${name}\n`).join('');
    if (edits.length === switchStep && successful.at(-1)?.name !== 'read_file') return callTool('read_file', { path: file });
    if (edits.length === switchStep) return callTool('edit_file', { path: file, expected_hash: reads.at(-1).hash, old_text: previous, new_text: previous + `step ${switchStep} by ${active}\n` });
    assert.equal(edits.length, switchStep + 1);
    if (switchStep < 3) {
      res.writeHead(200, { 'content-type': 'text/event-stream; charset=utf-8' });
      res.write(': waiting for user-selected executor\n\n');
      const key = task + '#' + switchStep;
      held.set(key, res); res.on('close', () => held.delete(key)); return;
    }
    if (!commands.length) return callTool('run_command', { path: '.', command: `Get-Content -LiteralPath '${file}'; Write-Output 'switch-command-verified'` });
    assert.equal(commands.length, 1); assert.equal(commands[0].exitCode, 0);
    if (successful.at(-1).name !== 'read_file') return callTool('read_file', { path: file });
    return finalReply('模式一、二、三已在同一任务接续执行，最终回到模式一完成验证。');
  }
  if (!reads.length) return callTool('read_file', { path: file });
  if (!edits.length) return callTool('edit_file', { path: file, expected_hash: reads.at(-1).hash, old_text: 'initial\n', new_text: initial });
  if (scenario === 'steering' && edits.length === 1) {
    const steeringSeen = body.messages.some(message => message.role === 'user' && typeof message.content === 'string' && message.content.includes('运行中改成 adjusted by ' + selected));
    request.steeringSeen = steeringSeen;
    if (!steeringSeen) {
      res.writeHead(200, { 'content-type': 'text/event-stream; charset=utf-8' });
      res.write('data: ' + json({ choices: [{ delta: { content: '初次修改已完成，继续核对。' } }] }) + '\n\n');
      held.set(task, res); res.on('close', () => held.delete(task)); return;
    }
    if (reads.length < 2) return callTool('read_file', { path: file });
    return callTool('edit_file', { path: file, expected_hash: reads.at(-1).hash, old_text: initial, new_text: adjusted });
  }
  if (!commands.length) return callTool('run_command', { path: '.', command: `Get-Content -LiteralPath '${file}'; Write-Output 'command-verified'` });
  assert.equal(commands.at(-1).exitCode, 0); assert.match(commands.at(-1).output, /command-verified/);
  if (successful.at(-1).name !== 'read_file') return callTool('read_file', { path: file });
  return finalReply(`已由${labels[selected]}修改文件、执行命令并回读验证。${scenario === 'steering' ? '已按运行中补充完成修改。' : ''}`);
}
async function launch() {
  const port = await freePort(), args = ['--remote-debugging-port=' + port, '--user-data-dir=' + profile, '--disable-gpu'];
  const env = { ...process.env, SCODEX_HOME: home, SCODEX_REFERENCE_HOME: path.join(fixture, 'reference'), SCODEX_REFERENCE_AGENTS_HOME: path.join(fixture, 'agents') };
  if (shortcut) {
    const quote = text => "'" + text.replace(/'/g, "''") + "'";
    const command = '$ErrorActionPreference="Stop"; $taskProcess=Start-Process -FilePath ' + quote(shortcut) + ' -ArgumentList ' + quote(args.map(text => '"' + text + '"').join(' ')) + ' -WindowStyle Hidden -PassThru; $taskProcess.Id';
    const result = await promisify(execFile)('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command], { windowsHide: true, env: { ...env, APPDATA: path.join(fixture, 'appdata'), LOCALAPPDATA: path.join(fixture, 'localappdata') } });
    const pid = Number(result.stdout.trim()); assert.ok(Number.isSafeInteger(pid) && pid > 0);
    app = { pid, get exitCode() { try { process.kill(pid, 0); return null; } catch { return 0; } } };
  } else app = spawn(executable, args, { cwd: path.dirname(executable), windowsHide: true, stdio: 'ignore', env });
  const target = await wait(async () => { if (app.exitCode !== null) throw Error('App exited ' + app.exitCode); return (await fetch(`http://127.0.0.1:${port}/json/list`).then(response => response.json())).find(tab => tab.type === 'page' && tab.url.startsWith('file:')); }, 'Actual EXE startup', 45000);
  socket = new WebSocket(target.webSocketDebuggerUrl); await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); }); page = connect(socket);
  await wait(() => page.evaluate('Boolean(document.querySelector(".composer-model-mode"))'), 'Composer ready');
  const identity = await page.evaluate('window.scodex.getAppState().then(s=>({version:s.version,userDataPath:s.userDataPath,workspaceRoot:s.workspaceRoot}))');
  assert.equal(identity.version, version); assert.equal(path.resolve(identity.userDataPath), profile); assert.equal(path.resolve(identity.workspaceRoot), workspace);
  return identity;
}
async function setup() {
  for (const directory of [output, profile, home, workspace]) await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(path.join(profile, 'settings.json'), json({ workspaceRoot: workspace, projects: [{ id: 'executor-project', name: '执行模式验收', path: workspace }], activeProjectId: 'executor-project', preferences: { contextAccess: 'full', browserPanelOpen: false, trayEnabled: false, closeConfirmation: 'never' } }));
  await fs.writeFile(path.join(home, 'codex-settings.json'), json({ sandboxMode: 'danger-full-access', approvalPolicy: 'never', networkAccess: true, networkDomains: ['*'], workspaceDependencies: false }));
  const now = new Date().toISOString();
  await fs.writeFile(path.join(profile, 'conversations.json'), json({ version: 2, activeId: 'executor-chat', conversations: [{ id: 'executor-chat', projectId: 'executor-project', title: '所选模式负责执行', mode: 'answer', messages: [], createdAt: now, updatedAt: now }] }));
  server = http.createServer((req, res) => model(req, res).catch(error => { report.serverError = error.stack; if (!res.headersSent) res.writeHead(500); res.end(); }));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  await check('actual-exe-version-and-isolated-profile', launch);
  await page.evaluate('window.scodex.saveModelConnection(' + json({ baseUrl: base + '/main/v1', apiKey: keys.main, models: ['main-fixture'], model: 'main-fixture', subagentBaseUrl: base + '/subagent/v1', subagentApiKey: keys.subagent, subagentModels: ['subagent-fixture'], subagentModel: 'subagent-fixture', advisorBaseUrl: base + '/advisor/v1', advisorApiKey: keys.advisor, advisorModels: ['advisor-fixture'], advisorModel: 'advisor-fixture', advisorEnabled: true, toolProtocol: 'native', reportUsage: true, retryLimit: 0 }) + ')');
  const origin = await page.evaluate('performance.timeOrigin'); await page.command('Page.reload');
  await wait(() => page.evaluate(`performance.timeOrigin!==${origin}&&Boolean(document.querySelector('.composer-model-mode'))`), 'Reload config');
  await page.evaluate('window.__executorTerminals=[];window.__executorRunning=new Set();window.scodex.onChatEvent(e=>{if(!e.requestId)return;if(["complete","error","cancelled"].includes(e.type)){window.__executorRunning.delete(e.requestId);window.__executorTerminals.push(e)}else window.__executorRunning.add(e.requestId)})');
}
async function runCase(mode, scenario) {
  const task = `TEAM-EXECUTOR:${mode}:${scenario}`, file = path.join(workspace, `result-${mode}-${scenario}.txt`);
  await fs.writeFile(file, 'initial\n'); await value('.composer-model-mode', mode);
  await wait(() => page.evaluate(`document.querySelector('.composer-model-button').value===${json(mode + '-fixture')}`), 'Selected model ' + mode);
  const terminalCount = await page.evaluate('window.__executorTerminals.length');
  await value('[aria-label="输入工作内容"]', task); await click('[aria-label="发送消息"]');
  if (scenario === 'steering') {
    await wait(() => Promise.resolve(held.has(task)), 'Actual edit before steering');
    assert.equal(await fs.readFile(file, 'utf8'), `executed by ${mode}\n`);
    await value('[aria-label="输入工作内容"]', '运行中改成 adjusted by ' + mode);
    await click('[aria-label="提交引导但不中断模型运行"]');
    await wait(() => page.evaluate('Boolean(document.querySelector(".steering-message-status[data-state=queued]"))'), 'Steering queued in the live UI');
    tool(held.get(task), 'read_file', { path: path.basename(file) });
  }
  await wait(() => page.evaluate(`window.__executorTerminals.length>${terminalCount}`), 'Actual execution complete', 90000);
  const terminal = await page.evaluate('window.__executorTerminals.at(-1)'); assert.equal(terminal.type, 'complete', json(terminal));
  await wait(() => page.evaluate('Boolean(document.querySelector("[aria-label=发送消息]"))'), 'Settled composer');
  assert.equal(await fs.readFile(file, 'utf8'), `${scenario === 'steering' ? 'adjusted' : 'executed'} by ${mode}\n`);
  const message = await wait(async () => {
    const saved = (await savedChat()).messages.find(item => item.id === terminal.requestId);
    return saved?.content?.includes(`已由${labels[mode]}修改文件、执行命令并回读验证。`) ? saved : false;
  }, 'Final answer persisted before inspecting operation statuses', 15000);
  const chat = await savedChat();
  assert.ok(message); assert.equal(message.modelMode, mode);
  const debate = message.operations.find(operation => operation.name === 'model_debate_result');
  const data = JSON.parse(debate.output); assert.equal(data.executorRole, teamRoles[mode]);
  const requests = report.requests.filter(request => request.task === task);
  for (const role of Object.values(teamRoles)) assert.equal(requests.filter(request => request.stage === 'proposal' && request.role === role).length, 1);
  if (scenario !== 'fallback') {
    assert.equal(data.status, 'complete'); assert.equal(data.proposals.length, 3); assert.equal(data.reviews.length, 3);
    for (const role of Object.values(teamRoles)) assert.equal(requests.filter(request => request.stage === 'review' && request.role === role).length, 1);
    assert.deepEqual([...new Set(requests.filter(request => request.stage === 'supervision').map(request => request.role))].sort(), Object.values(teamRoles).filter(role => role !== teamRoles[mode]).sort());
  } else { assert.equal(data.status, 'incomplete'); assert.equal(data.allocation, null); assert.ok(debate.detail.includes(labels[mode])); }
  assert.ok(requests.filter(request => request.stage === 'execution').every(request => request.mode === mode));
  assert.ok(requests.filter(request => request.stage === 'consultation').every(request => request.mode !== mode));
  for (const name of ['read_file', 'edit_file', 'run_command']) assert.ok(message.operations.some(operation => operation.name === name && operation.status === 'succeeded'));
  if (scenario === 'steering') {
    assert.ok(requests.some(request => request.steeringSeen));
    assert.ok(chat.messages.some(item => item.steering?.status === 'accepted'));
  }
  return { selectedMode: mode, executorRole: data.executorRole, discussionStatus: data.status, realFileVerified: true, realCommandVerified: true, runningAmendment: scenario === 'steering' };
}
async function runSwitchCase() {
  const task = 'TEAM-EXECUTOR:main:switching', file = path.join(workspace, 'result-main-switching.txt');
  await page.evaluate('window.scodex.getModelConnection().then(config=>window.scodex.saveModelConnection({...config,subagentToolProtocol:"json"}))');
  await fs.writeFile(file, 'initial\n'); await value('.composer-model-mode', 'main');
  const terminalCount = await page.evaluate('window.__executorTerminals.length');
  await value('[aria-label="输入工作内容"]', task); await click('[aria-label="发送消息"]');
  await wait(() => Promise.resolve(held.has(task + '#0')), 'First actual edit before executor handoff');
  assert.ok(await page.evaluate('Boolean(document.querySelector("[aria-label=停止生成]"))'));
  assert.equal(await page.evaluate('window.__executorTerminals.length'), terminalCount);
  const requestId = await page.evaluate('[...document.querySelectorAll(".assistant-message")].at(-1)?.dataset.messageId');
  assert.ok(requestId);
  const chat = await wait(async () => {
    const current = await savedChat(), index = current.messages.findIndex(item => item.role === 'user' && item.content === task);
    return index >= 0 && current.messages.slice(index + 1).some(item => item.role === 'assistant' && item.id === requestId) ? current : false;
  }, 'Current user and assistant request IDs persisted');
  const rejection = await page.evaluate(`Promise.all([{modelMode:'invalid'},{modelMode:'advisor',model:'unconfigured-model'}].map(update=>window.scodex.switchExecutor({requestId:${json(requestId)},conversationId:${json(chat.id)},...update}).then(()=>false,()=>true)))`);
  assert.deepEqual(rejection, [true, true]);
  for (let step = 1; step < switchModes.length; step++) {
    const before = await fs.readFile(file, 'utf8'), previous = switchModes[step - 1], target = switchModes[step];
    await value('.composer-model-mode', target);
    await wait(() => page.evaluate(`document.querySelector('.composer-model-mode').dataset.pendingMode===${json(target)}`), 'Executor switch visibly queued');
    assert.equal(await fs.readFile(file, 'utf8'), before);
    assert.equal(await page.evaluate('window.__executorTerminals.length'), terminalCount);
    const response = held.get(task + '#' + (step - 1));
    assert.ok(response); switchStep = step;
    reply(response, previous === 'subagent' ? json({ type: 'final', content: '交接前的实际修改已完成。' }) : '交接前的实际修改已完成。');
    await wait(() => page.evaluate('!document.querySelector(".composer-model-mode").dataset.pendingMode'), 'Executor handoff applied');
    if (step < 3) await wait(() => Promise.resolve(held.has(task + '#' + step)), 'Next executor made its own actual edit');
  }
  await wait(() => page.evaluate(`window.__executorTerminals.length>${terminalCount}`), 'Switched task finished', 90000);
  const terminal = await page.evaluate('window.__executorTerminals.at(-1)'); assert.equal(terminal.type, 'complete', json(terminal));
  const message = await wait(async () => { const saved = (await savedChat()).messages.find(item => item.id === requestId); return saved?.content?.includes('最终回到模式一完成验证') ? saved : false; }, 'Final switched answer persisted');
  assert.equal(message.modelMode, 'main');
  assert.equal(message.operations.filter(item => item.name === 'executor_switch' && item.status === 'succeeded').length, 3);
  assert.equal(message.operations.filter(item => item.name === 'edit_file' && item.status === 'succeeded').length, 4);
  assert.equal(message.operations.filter(item => item.name === 'run_command' && item.status === 'succeeded').length, 1);
  const expected = 'initial\n' + switchModes.map((name, index) => `step ${index} by ${name}\n`).join('');
  assert.equal(await fs.readFile(file, 'utf8'), expected);
  for (let step = 0; step < 4; step++) {
    const requests = report.requests.filter(item => item.task === task && item.switchStep === step);
    assert.ok(requests.some(item => item.stage === 'execution' && item.mode === switchModes[step] && item.protocol === (switchModes[step] === 'subagent' ? 'json' : 'native')));
  }
  await page.evaluate('window.scodex.getModelConnection().then(config=>window.scodex.saveModelConnection({...config,subagentToolProtocol:"native"}))');
  return { sharedChat: chat.id, sharedRequestId: requestId, modes: switchModes, switches: 3, actualEdits: 4, commandCount: 1, protocols: ['native', 'json', 'native'], invalidSelectionsRejected: true, allFileContentVerified: true };
}
async function main() {
  try {
    await setup();
    for (const mode of shortcut ? ['subagent'] : scope === 'all' ? modes : []) await check('selected-' + mode + '-proposes-reviews-executes-and-verifies', () => runCase(mode, 'normal'));
    if (!shortcut) {
      if (scope === 'all') for (const mode of ['subagent', 'advisor']) await check('failed-discussion-keeps-' + mode + '-as-executor', () => runCase(mode, 'fallback'));
      if (scope === 'all' || scope === 'amendment-and-layout') await check('advisor-executor-applies-running-amendment-to-real-file', () => runCase('advisor', 'steering'));
      if (scope === 'all' || scope === 'switching-only') await check('running-mode-switch-preserves-real-files-tools-and-shared-task', runSwitchCase);
      await check(scope === 'settings-only' ? 'current-responsibilities-layout' : 'selected-role-usage-shared-chat-and-current-responsibilities', async () => {
        const usage = await page.evaluate('window.scodex.getModelUsage()');
        const executedModes = scope === 'settings-only' ? [] : scope === 'amendment-and-layout' ? ['advisor'] : scope === 'switching-only' ? ['main'] : modes;
        for (const mode of executedModes) assert.ok(usage.records.some(record => record.role === teamRoles[mode] && !record.stage));
        const chat = await savedChat(); assert.ok(executedModes.every(mode => chat.messages.some(message => message.role === 'assistant' && message.modelMode === mode)));
        await click('[aria-label="设置"]');
        await page.evaluate('(()=>{const button=[...document.querySelectorAll(".settings-category")].find(e=>e.textContent.includes("模型与连接"));if(!button)throw Error("Missing model settings");button.click()})()');
        await wait(() => page.evaluate('Boolean(document.querySelector(".model-team-roles"))'), 'Responsibilities ready');
        assert.deepEqual(await page.evaluate('[...document.querySelectorAll(".model-team-roles dt")].map(e=>e.textContent)'), ['所选模式', '三个模型', '其余两个模型']);
        for (const width of [600, 1280]) {
          await page.command('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: false });
          for (let index = 0; index < 3; index++) {
            await page.evaluate(`document.querySelectorAll('.model-team-roles dl > div')[${index}].scrollIntoView({block:'center'})`);
            const geometry = await page.evaluate(`new Promise(r=>requestAnimationFrame(()=>{const e=document.querySelectorAll('.model-team-roles dl > div')[${index}],b=e.getBoundingClientRect();r({viewport:innerWidth,document:document.documentElement.scrollWidth,right:b.right,top:b.top,bottom:b.bottom})}))`);
            assert.ok(geometry.document <= width + 1 && geometry.right <= width + 1 && geometry.top >= 0 && geometry.bottom <= 900, json(geometry));
          }
        }
        await page.evaluate('document.querySelector(".model-team-roles dl").scrollIntoView({block:"center"})');
        await page.evaluate('new Promise(r=>requestAnimationFrame(r))');
        const screenshot = await page.command('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
        report.screenshot = path.join(output, 'team-executor-final.png'); await fs.writeFile(report.screenshot, Buffer.from(screenshot.data, 'base64'));
        return { sharedChat: chat.id, executionUsageRoles: executedModes.map(mode => teamRoles[mode]), settingsLabelsVerified: true, layoutWidths: [600, 1280] };
      });
    }
    report.status = 'passed';
  } catch (error) { report.status = 'failed'; report.error = error.stack; process.exitCode = 1; }
  finally {
    if (page && app?.exitCode === null) {
      await page.evaluate('(async()=>{for(const id of window.__executorRunning||[])await window.scodex.cancelMessage(id)})()').catch(error => { report.cancelError = error.message; });
      await wait(() => page.evaluate('!window.__executorRunning?.size'), 'Known test requests settled before quit', 15000).catch(error => { report.cancelWaitError = error.message; });
    }
    for (const response of held.values()) response.destroy(); held.clear();
    if (page && app?.exitCode === null) await page.evaluate('window.scodex.quitApp()').catch(error => { report.quitError = error.message; });
    if (app) await wait(() => Promise.resolve(app.exitCode !== null), 'Test process exit', 20000).catch(error => { report.exitError = error.message; });
    report.processExited = Boolean(app && app.exitCode !== null); socket?.close();
    if (server) {
      const closed = new Promise(resolve => server.close(resolve));
      server.closeAllConnections();
      await closed;
    }
    if (report.processExited && path.dirname(fixture) === path.resolve(os.tmpdir()) && path.basename(fixture).startsWith('scodex-team-executor-')) {
      await fs.rm(fixture, { recursive: true, force: true }).then(() => { report.cleanup = 'passed'; }).catch(error => { report.cleanup = 'failed'; report.cleanupError = error.message; });
    } else report.cleanup = 'blocked';
    if (!report.processExited || report.cleanup !== 'passed') { report.status = 'failed'; process.exitCode = 1; }
    await persist(); console.log(json({ status: report.status, checks: report.checks.length, cleanup: report.cleanup, report: path.join(output, 'team-executor-ui.json') }));
    if (report.error) console.error(report.error);
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
