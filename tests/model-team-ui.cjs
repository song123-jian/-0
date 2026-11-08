// Actual packaged application/renderer/IPC/files; only model endpoints are loopback fixtures.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const http = require('node:http');
const { spawn } = require('node:child_process');
const { connect, wait, freePort } = require('./agent-workflow-ui.cjs');
const json = JSON.stringify, root = path.resolve(__dirname, '..'), version = require('../package.json').version;
const output = path.resolve(process.env.SCODEX_TEAM_OUTPUT || path.join(root, 'release/delivery-' + version, 'candidate-ui'));
const executable = process.env.SCODEX_TEAM_EXE || path.join(root, 'release/win-unpacked/Scodex工作台.exe');
const fixture = process.env.SCODEX_TEAM_FIXTURE || path.join(output, 'fixture-' + crypto.randomUUID()), profile = path.join(fixture, 'profile'), home = path.join(fixture, 'home');
const runId = crypto.randomUUID().slice(0, 8), proofFiles = { main: 'main-proof-' + runId + '.txt', fallback: 'fallback-proof-' + runId + '.txt', cancel: 'cancel-proof-' + runId + '.txt' };
const keys = { main: crypto.randomUUID(), child: crypto.randomUUID(), advisor: crypto.randomUUID() };
const report = { status: 'running', version, executable, fixture, checks: [], requests: [], limitations: ['Real packaged Electron/React/IPC/Windows encryption/workspace files. Three model roles use loopback fixtures; no public model quality, speed or monetary-saving claim.'] };
const reportPath = path.join(output, 'model-team-ui.json');
let app, page, socket, server, workspace, port, base;
const heldChildren = new Map(), taskState = new Map(); let cancelledAdvisor = false, cancelledClosed = false;
const heldSteering = new Map(); let detachedPage, detachedSocket;
const selector = id => '[data-message-id=' + json(id) + ']';
const state = () => page.evaluate('window.scodex.getAppState()');
const chat = async () => (await state()).library.conversations.find(item => item.id === 'team-chat');
async function persist() { await fs.writeFile(reportPath, json(report, null, 2)); }
async function check(name, fn) { const evidence = await fn(); report.checks.push({ name, status: 'passed', evidence }); await persist(); console.log('PASS ' + name); }
async function click(css, text, targetPage = page) {
  await wait(() => targetPage.evaluate('(()=>{const e=[...document.querySelectorAll(' + json(css) + ')].find(e=>' + (text ? 'e.textContent.trim()===' + json(text) : 'true') + ');if(!e||e.disabled)return false;e.click();return true})()'), 'Click ' + css);
}
async function insert(css, value, targetPage = page) {
  await targetPage.evaluate('(()=>{const e=document.querySelector(' + json(css) + ');if(!e)throw Error("Missing input");const p=e instanceof HTMLSelectElement?HTMLSelectElement.prototype:e instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(p,"value").set.call(e,' + json(value) + ');e.dispatchEvent(new Event(e instanceof HTMLSelectElement?"change":"input",{bubbles:true}));})()');
}
async function reload() {
  const origin = await page.evaluate('performance.timeOrigin'); await page.command('Page.reload');
  await wait(() => page.evaluate('performance.timeOrigin!==' + origin + '&&Boolean(window.scodex&&document.querySelector("[aria-label=设置]"))'), 'Reload');
}
async function settings() { await click('[aria-label="设置"]'); await click('.settings-category', '模型与连接'); await wait(() => page.evaluate('Boolean(document.querySelector("#model-advisor-enabled"))'), 'Model team settings'); }
async function send(prompt) { const count = (await chat()).messages.length; await insert('[aria-label="输入工作内容"]', prompt); await click('[aria-label="发送消息"]'); return count; }
async function finished(count, cancelled = false) {
  return wait(async () => {
    const current = await chat(), message = current.messages.at(-1);
    if (current.messages.length <= count || message?.role !== 'assistant') return false;
    const terminal = await page.evaluate('document.querySelector(' + json(selector(message.id) + ' .message-progress') + ')?.dataset.state');
    if (terminal !== (cancelled ? 'cancelled' : 'complete')) { if (terminal === 'failed') throw Error(message.error); return false; }
    return message;
  }, 'Terminal answer', 60000);
}
function reply(res, message) {
  const calls = message.tool_calls;
  const delta = { ...(message.content ? { content: message.content } : {}), ...(calls ? { tool_calls: calls.map((call, index) => ({ index, ...call })) } : {}) };
  res.writeHead(200, { 'content-type': 'text/event-stream' });
  res.end('data: ' + json({ choices: [{ delta, finish_reason: calls ? 'tool_calls' : 'stop' }], usage: { prompt_tokens: 11, completion_tokens: 5, total_tokens: 16 } }) + '\n\ndata: [DONE]\n\n');
}
function beginStream(res, text) {
  res.writeHead(200, { 'content-type': 'text/event-stream; charset=utf-8' });
  res.write('data: ' + json({ choices: [{ delta: { content: text } }] }) + '\n\n');
}
function tool(res, name, args) { reply(res, { tool_calls: [{ id: crypto.randomUUID(), type: 'function', function: { name, arguments: json(args) } }] }); }
function results(body) {
  const definitions = new Map(body.messages.flatMap(item => (item.tool_calls || []).map(call => [call.id, call.function.name])));
  return body.messages.filter(item => item.role === 'tool').map(item => ({ name: definitions.get(item.tool_call_id), ...JSON.parse(item.content) }));
}
async function model(req, res) {
  const role = req.url.startsWith('/advisor/') ? 'advisor' : req.url.startsWith('/child/') ? 'child' : 'main';
  assert.equal(req.headers.authorization, 'Bearer ' + keys[role]);
  if (req.url.endsWith('/models')) { assert.equal(role, 'advisor'); res.writeHead(200, { 'content-type': 'application/json' }); res.end(json({ data: [{ id: 'advisor-fixture' }] })); return; }
  let raw = ''; for await (const part of req) raw += part;
  const body = JSON.parse(raw); assert.equal(body.model, role + '-fixture');
  const prompt = body.messages.findLast(item => item.role === 'user' && typeof item.content === 'string' && /^(?:TEAM-|EXPLORE-|STEER-)/.test(item.content))?.content;
  const lastUser = body.messages.at(-1)?.content || '';
  const systemPrompt = body.messages.find(item => item.role === 'system')?.content || '';
  const debateStage = systemPrompt.includes('你是独立方案提出者') ? 'debate-proposal' : systemPrompt.includes('你是独立方案评审者') ? 'debate-review' : '';
  const supervisionStage = systemPrompt.includes('只读执行监督者') ? 'execution-supervision' : '';
  let taskData = lastUser.match(/<task-data>\n([\s\S]*?)\n<\/task-data>/)?.[1] || '';
  if (!taskData) {
    const supervisionData = lastUser.match(/<supervision-data>\n([\s\S]*?)\n<\/supervision-data>/)?.[1];
    if (supervisionData) {
      try { taskData = JSON.parse(supervisionData).task || ''; } catch { /* the product reports the request as failed below */ }
    }
  }
  report.requests.push({ role, task: taskData || prompt || '', tokens: body.max_tokens || null });
  if (debateStage) {
    report.requests.at(-1).stage = debateStage;
    report.requests.at(-1).reasoningEffort = body.reasoning_effort || '';
    assert.equal(body.tools, undefined); assert.equal(body.max_tokens, undefined);
    assert.ok(lastUser.length < 20000);
    for (const key of Object.values(keys)) assert.ok(!lastUser.includes(key));
    if (report.requests.at(-1).task === 'TEAM-CANCEL' && role === 'advisor') {
      cancelledAdvisor = true; res.on('close', () => { if (!res.writableEnded) cancelledClosed = true; }); return;
    }
    if (report.requests.at(-1).task === 'TEAM-FAIL' && role === 'advisor' && debateStage === 'debate-proposal') { res.writeHead(503); res.end('{}'); return; }
    if (role === 'advisor' && body.reasoning_effort === 'ultra') { res.writeHead(400, { 'content-type': 'application/json' }); res.end(json({ error: { message: 'advisor-fixture does not support reasoning effort "ultra"; use low, medium, high, xhigh or max' } })); return; }
    assert.ok(role !== 'advisor' || !body.reasoning_effort || body.reasoning_effort === 'max');
    if (debateStage === 'debate-proposal') return reply(res, { content: json({ title: role + ' independent plan', summary: '基于同一任务文本的独立方案', steps: ['核对目标', '实施并验证'], evidenceBasis: ['仅依据用户任务文本'], validation: ['检查实际结果'], risks: ['外部条件可能变化'] }) });
    const proposals = JSON.parse(lastUser.match(/<proposal-data>\n([\s\S]*)\n<\/proposal-data>/)?.[1] || '[]');
    assert.equal(proposals.length, 3);
    return reply(res, { content: json({ evaluations: proposals.map(item => ({ proposalId: item.id, scores: { correctness: 8, evidence: 8, taskFit: 8, constraints: 8, verifiability: 8, risk: 8 }, critique: role + ' 建议逐项复核实际证据和验收结果' })) }) });
  }
  if (supervisionStage) {
    report.requests.at(-1).stage = supervisionStage;
    report.requests.at(-1).reasoningEffort = body.reasoning_effort || '';
    assert.equal(body.tools, undefined); assert.equal(body.max_tokens, undefined);
    assert.ok(lastUser.includes('<supervision-data>'));
    for (const key of Object.values(keys)) assert.ok(!lastUser.includes(key));
    return reply(res, { content: json({ verdict: 'ready', summary: role + '监督证据一致', corrections: [], takeover: false }) });
  }
  if (role === 'advisor') {
    assert.equal(body.tools, undefined); assert.equal(body.max_tokens, undefined);
    const content = body.messages.at(-1).content;
    const input = JSON.parse(content.match(/<review-data>\n([\s\S]*)\n<\/review-data>$/)?.[1] || content); report.requests.at(-1).stage = input.stage; report.requests.at(-1).task = input.task;
    report.requests.at(-1).reasoningEffort = body.reasoning_effort || '';
    assert.ok(body.messages.at(-1).content.length < 12000);
    for (const key of Object.values(keys)) assert.ok(!body.messages.at(-1).content.includes(key));
    if (input.task === 'TEAM-CANCEL') { cancelledAdvisor = true; res.on('close', () => { if (!res.writableEnded) cancelledClosed = true; }); return; }
    if (body.reasoning_effort === 'ultra') { res.writeHead(400, { 'content-type': 'application/json' }); res.end(json({ error: { message: 'advisor-fixture does not support reasoning effort "ultra"; use low, medium, high, xhigh or max' } })); return; }
    assert.ok(!body.reasoning_effort || body.reasoning_effort === 'max');
     return reply(res, { content: json({ verdict: 'revise', summary: '顾问核对 ' + input.stage, checks: ['主模型核对实际文件和验证证据'] }) });
  }
  const steeringTask = /^STEER-/.test(prompt || '') ? prompt : '';
  if (steeringTask) {
    report.requests.at(-1).task = steeringTask;
    const taskIndex = body.messages.findLastIndex(item => item.role === 'user' && item.content === steeringTask);
    const injected = body.messages.slice(taskIndex + 1).filter(item => item.role === 'user' && item.content?.includes('用户在当前任务运行期间提交的引导'));
    if (!injected.length) { heldSteering.set(steeringTask, res); beginStream(res, steeringTask + '开始。'); return; }
    report.requests.at(-1).steering = injected.map(item => item.content);
    return reply(res, { content: '已采用运行中补充，继续完成。' });
  }
  const done = results(body);
  if (role === 'child') {
    if (body.max_tokens !== undefined) assert.ok(body.max_tokens <= 1600);
    assert.ok(!body.tools.some(item => ['write_file', 'edit_file', 'run_command', 'subagent_start'].includes(item.function.name)));
    const file = prompt === 'EXPLORE-A' ? 'docs/a.txt' : 'docs/b.txt';
    const read = done.find(item => item.name === 'read_file' && item.ok && item.hash);
    if (!read) return tool(res, 'read_file', { path: file });
    heldChildren.set(prompt, () => reply(res, { content: file + ' hash=' + read.hash + ' 已读取；由主模型重新核对并验证。' }));
    return;
  }
  const startDef = body.tools.find(item => item.function.name === 'subagent_start');
  assert.deepEqual(startDef.function.parameters.properties.mode.enum, ['analysis', 'edit']);
  if (prompt === 'TEAM-SIMPLE') return reply(res, { content: '普通问题直接答复。' });
  if (prompt === 'TEAM-FAIL' || prompt === 'TEAM-CANCEL') {
    const file = prompt === 'TEAM-FAIL' ? proofFiles.fallback : proofFiles.cancel;
    if (!done.some(item => item.name === 'write_file' && item.ok)) return tool(res, 'write_file', { path: file, expected_hash: 'new', content: 'main effect\n' });
    return reply(res, { content: '顾问未核验；主模型已回读实际写入结果，保留未验证项。' });
  }
  assert.equal(prompt, 'TEAM-WORK');
  if (!done.some(item => item.name === 'update_plan' && item.ok)) return tool(res, 'update_plan', { steps: [{ text: '并行探索、主模型修改并验证', status: 'in_progress' }] });
  if (done.filter(item => item.name === 'read_file' && item.error).length < 2) return tool(res, 'read_file', { path: 'missing-team.txt' });
  const a = done.find(item => item.name === 'subagent_start' && item.title === '探索 A'), b = done.find(item => item.name === 'subagent_start' && item.title === '探索 B');
  if (!a) return tool(res, 'subagent_start', { title: '探索 A', task: 'EXPLORE-A', mode: 'analysis', paths: ['docs/a.txt'] });
  if (!b) return tool(res, 'subagent_start', { title: '探索 B', task: 'EXPLORE-B', mode: 'analysis', paths: ['docs/b.txt'] });
  if (!taskState.get('early')) { taskState.set('early', true); return reply(res, { content: '子任务仍运行时的候选答复，不能作为完成。' }); }
  if (!done.some(item => item.name === 'write_file' && item.ok)) {
    const context = json(body.messages);
    for (const child of [a, b]) {
      assert.equal(child.status, 'running');
      assert.ok(context.includes(child.id), 'Live task state must be identified by task ID, not localized response text');
    }
    report.liveTaskIdsBlockedPrematureCompletion = [a.id, b.id];
    return tool(res, 'write_file', { path: proofFiles.main, expected_hash: 'new', content: 'main owns code\n' });
  }
  if (!taskState.get('released')) {
    await wait(() => heldChildren.size === 2, 'Two concurrent explorers', 15000);
    assert.equal(await fs.readFile(path.join(workspace, proofFiles.main), 'utf8'), 'main owns code\n');
    report.mainWroteWhileExplorersActive = true; taskState.set('released', true);
    for (const release of heldChildren.values()) release();
  }
  if (!done.some(item => item.name === 'subagent_wait' && item.id === a.id && item.status === 'complete')) return tool(res, 'subagent_wait', { task_id: a.id, wait_ms: 30000 });
  if (!done.some(item => item.name === 'subagent_wait' && item.id === b.id && item.status === 'complete')) return tool(res, 'subagent_wait', { task_id: b.id, wait_ms: 30000 });
  if (!done.some(item => item.name === 'read_file' && item.ok && item.path === proofFiles.main)) return tool(res, 'read_file', { path: proofFiles.main });
  const completion = body.messages.some(item => item.role === 'user' && item.content?.includes('顾问核对 completion'));
  return reply(res, { content: completion ? '主模型已整合两项探索，修改并回读 main-proof.txt；三个顾问关口已处理。' : '主模型完成候选答复，等待完成核验。' });
}
async function setup() {
  await fs.mkdir(output, { recursive: true }); await fs.mkdir(profile, { recursive: true }); await fs.mkdir(home, { recursive: true });
  const now = new Date().toISOString();
  await fs.writeFile(path.join(profile, 'conversations.json'), json({ version: 2, activeId: 'team-chat', conversations: [{ id: 'team-chat', title: '模型分工验收', mode: 'answer', executionEnabled: true, createdAt: now, updatedAt: now, messages: [] }] }));
  await fs.writeFile(path.join(profile, 'settings.json'), json({ projects: [], activeProjectId: '', preferences: { contextAccess: 'full', browserPanelOpen: false, trayEnabled: false, closeConfirmation: 'never' } }));
  await fs.writeFile(path.join(home, 'codex-settings.json'), json({ sandboxMode: 'danger-full-access', approvalPolicy: 'never', networkAccess: true, networkDomains: ['*'], allowLocalBinding: true, workspaceDependencies: false, availableReasoningEfforts: ['low'], defaultReasoningEffort: 'low' }));
  server = http.createServer((req, res) => model(req, res).catch(error => { report.serverError = error.stack; if (!res.headersSent) res.writeHead(500); res.end(); }));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); base = 'http://127.0.0.1:' + server.address().port;
  port = await freePort();
  app = spawn(executable, ['--remote-debugging-port=' + port, '--user-data-dir=' + profile, '--disable-gpu'], { cwd: output, windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'], env: { ...process.env, SCODEX_HOME: home, SCODEX_REFERENCE_HOME: path.join(fixture, 'reference'), SCODEX_REFERENCE_AGENTS_HOME: path.join(fixture, 'agents') } });
  let stderr = ''; app.stderr.on('data', part => { stderr = (stderr + part).slice(-1000); });
  const target = await wait(async () => { if (app.exitCode !== null) throw Error('EXE exited ' + app.exitCode + ' ' + stderr); return (await fetch('http://127.0.0.1:' + port + '/json/list').then(r => r.json())).find(t => t.type === 'page' && t.url.startsWith('file:')); }, 'Application startup', 45000);
  socket = new WebSocket(target.webSocketDebuggerUrl); await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); }); page = connect(socket);
  await wait(() => page.evaluate('Boolean(window.scodex&&document.querySelector("[aria-label=输入工作内容]"))'), 'Renderer ready');
  const actual = await state(); assert.equal(actual.version, version); workspace = actual.workspaceRoot;
  assert.ok(path.resolve(workspace).startsWith(path.resolve(fixture) + path.sep)); report.workspace = workspace;
  await fs.mkdir(path.join(workspace, 'docs'), { recursive: true }); await fs.writeFile(path.join(workspace, 'docs/a.txt'), 'document A\n'); await fs.writeFile(path.join(workspace, 'docs/b.txt'), 'document B\n');
  await page.evaluate('window.scodex.saveModelConnection(' + json({ name: '模型分工验收', baseUrl: base + '/main/v1', model: 'main-fixture', models: ['main-fixture'], apiKey: keys.main, subagentBaseUrl: base + '/child/v1', subagentModel: 'child-fixture', subagentModels: ['child-fixture'], subagentApiKey: keys.child, toolProtocol: 'native', subagentToolProtocol: 'native', reportUsage: true, retryLimit: 6 }) + ')');
  await reload();
}
async function main() {
  await setup();
  await check('settings-default-roles-independent-advisor-save-and-reload', async () => {
    const original = await page.evaluate('window.scodex.getModelConnection()'); assert.equal(original.advisorEnabled, false); assert.equal(original.subagentAllowEdits, true); assert.equal(original.subagentMaxConcurrent, 2);
    await settings();
    await insert('#model-advisor-base-url', base + '/advisor/v1'); await insert('#model-advisor-api-key', keys.advisor);
    await click('button', '获取模型三列表'); await wait(() => page.evaluate('[...document.querySelector("#model-advisor").options].some(o=>o.value==="advisor-fixture")'), 'Advisor list');
    await insert('#model-advisor', 'advisor-fixture');
    await click('[aria-label="模型三推理强度"]'); await click('[role="option"]', 'ultra');
    await click('#model-advisor-enabled'); await click('.model-save-button');
    await wait(() => page.evaluate('document.querySelector(".model-message")?.textContent.includes("已保存")'), 'Save roles');
    await reload(); const saved = await page.evaluate('window.scodex.getModelConnection()');
    assert.equal(saved.advisorEnabled, true); assert.equal(saved.advisorModel, 'advisor-fixture'); assert.equal(saved.advisorReasoningEffort, 'ultra'); assert.equal(saved.model, original.model); assert.equal(saved.subagentModel, original.subagentModel);
    const stored = await fs.readFile(path.join(profile, 'model-connection.json'), 'utf8'); for (const key of Object.values(keys)) assert.ok(!stored.includes(key));
    assert.ok(saved.hasAdvisorCredential && saved.hasCredential && saved.hasSubagentCredential);
    return { mainPreserved: true, explorerReadOnly: true, defaultConcurrency: 2, advisorEnabled: true, advisorEffort: saved.advisorReasoningEffort, threeCredentialsEncrypted: true };
  });
  let workAnswer;
  await check('three-advisor-gates-parallel-explorers-main-effects-and-final-ownership', async () => {
    const count = await send('TEAM-WORK'); workAnswer = await finished(count);
    assert.match(workAnswer.content.slice(workAnswer.finalContentOffset), /主模型已整合两项探索/);
    const advisorRequests = report.requests.filter(r => r.role === 'advisor' && r.task === 'TEAM-WORK');
    const stages = [...new Set(advisorRequests.map(r => r.stage))];
    assert.deepEqual(stages, ['debate-proposal', 'debate-review', 'execution-supervision', 'repeated-error', 'completion']);
    assert.ok(advisorRequests.filter(r => r.reasoningEffort === 'ultra').length >= 4);
    assert.equal(advisorRequests.filter(r => r.reasoningEffort === 'max').length, 4);
    assert.equal(report.mainWroteWhileExplorersActive, true);
    assert.equal(workAnswer.operations.filter(op => op.name === 'advisor_consult' && op.status === 'succeeded').length, 2);
    const debate = workAnswer.operations.find(op => op.name === 'model_debate_result' && op.status === 'succeeded');
    assert.ok(debate); const debateData = JSON.parse(debate.output);
    assert.equal(debateData.proposals.length, 3); assert.equal(debateData.reviews.length, 3);
    assert.deepEqual(debateData.allocation.plans.map(item => item.share), [34, 33, 33]);
    assert.equal(debateData.allocation.plans.reduce((sum, item) => sum + item.share, 0), 100);
    const adapters = workAnswer.operations.filter(op => op.name === 'advisor_reasoning_compat' && op.status === 'succeeded');
    assert.equal(adapters.length, 4);
    assert.ok(adapters.every(op => /ultra.*max.*设置未变/.test(op.detail)));
    assert.equal(workAnswer.operations.filter(op => op.name === 'write_file' && op.status === 'succeeded').length, 1);
    const css = selector(workAnswer.id);
    assert.equal(await page.evaluate('document.querySelector(' + json(css + ' .message-execution') + ')?.open'), false);
    assert.ok(await page.evaluate('Boolean(document.querySelector(' + json(css + ' .task-file-changes') + '))'));
    await click(css + ' .message-execution-summary');
    await click(css + ' .agent-operation-group > summary');
    assert.ok(await page.evaluate('document.querySelector(' + json(css) + ').innerText.includes("重复错误诊断")'));
    const modelThreeProposalCaption = await page.evaluate('(() => { const row = [...document.querySelectorAll(' + json(css + ' .agent-operation[data-operation-name="model_debate_proposal"]') + ')].find(item => item.textContent.includes("模型三 · 独立提案")); return row?.querySelector(".agent-operation-title")?.textContent.trim() || ""; })()');
    assert.equal(modelThreeProposalCaption, '模型三 · 独立提案已返回结构化结果');
    return { stages, advisorEffortAdaptation: 'ultra -> max', savedEffortUnchanged: (await page.evaluate('window.scodex.getModelConnection()')).advisorReasoningEffort, writes: 1, parallelExplorers: 2, prematureCompletionPrevented: true, answerAndRealFileCardVisible: true };
  });
  const sendSteering = async (tag, targetPage, sendSelector, text) => {
    const before = (await chat()).messages.length;
    await insert('textarea[aria-label="' + (targetPage === page ? '输入工作内容' : '独立窗口输入工作内容') + '"]', tag, targetPage);
    await click(sendSelector, undefined, targetPage);
    await wait(() => heldSteering.has(tag), 'Held ' + tag + ' model response');
    await insert('textarea[aria-label="' + (targetPage === page ? '输入工作内容' : '独立窗口输入工作内容') + '"]', text, targetPage);
    await click(targetPage === page ? '[aria-label="提交引导但不中断模型运行"]' : '[aria-label="独立窗口提交引导但不中断模型运行"]', undefined, targetPage);
    const user = await wait(async () => (await chat()).messages.find(message => message.steering?.requestId && message.content === text), tag + ' visible supplement');
    await wait(() => targetPage.evaluate('document.querySelector(' + json(selector(user.id) + ' .steering-message-status') + ')?.dataset.state==="queued"'), tag + ' queued UI status');
    assert.equal(await targetPage.evaluate('document.querySelector(' + json(selector(user.id) + ' .user-message-content') + ')?.textContent'), text);
    heldSteering.get(tag).end('data: ' + json({ choices: [{ delta: { tool_calls: [{ index: 0, id: 'call_steer_' + tag, type: 'function', function: { name: 'read_file', arguments: json({ path: 'docs/a.txt' }) } }] }, finish_reason: 'tool_calls' }] }) + '\n\ndata: [DONE]\n\n');
    const answer = await wait(async () => {
      const current = await chat(), final = current.messages.at(-1), item = current.messages.find(message => message.id === user.id);
      if (item?.steering?.status === 'accepted' && final?.content?.includes('已采用运行中补充') && !final.pending) return { final, item };
      if (final?.error) throw Error(final.error);
      return false;
    }, tag + ' accepted and answered', 60000);
    assert.ok(report.requests.some(request => request.task === tag && request.steering?.some(value => value.includes(text))));
    await wait(async () => (await fs.readFile(path.join(profile, 'conversations.json'), 'utf8')).includes(text), tag + ' persisted transcript');
    return { visibleOnce: (await chat()).messages.filter(message => message.steering?.id === user.steering.id).length === 1, status: answer.item.steering.status, injectedAtNextRequest: true, persisted: true, initialMessageCount: before };
  };
  await check('main-window-running-message-is-visible-persisted-and-accepted-once', async () => sendSteering('STEER-MAIN', page, '[aria-label="发送消息"]', '主窗口运行中补充正文'));
  await check('detached-window-running-message-syncs-to-main-and-is-accepted-once', async () => {
    await page.evaluate('window.scodex.openWorkspaceWindow("chat", "team-chat")');
    const target = await wait(async () => (await fetch('http://127.0.0.1:' + port + '/json/list').then(response => response.json())).find(item => item.url.includes('workspaceWindow=chat')), 'Detached chat window');
    detachedSocket = new WebSocket(target.webSocketDebuggerUrl); await new Promise((resolve, reject) => { detachedSocket.addEventListener('open', resolve, { once: true }); detachedSocket.addEventListener('error', reject, { once: true }); }); detachedPage = connect(detachedSocket);
    await wait(() => detachedPage.evaluate('Boolean(window.scodexWindow&&document.querySelector("[aria-label=独立窗口输入工作内容]"))'), 'Detached chat ready');
    const evidence = await sendSteering('STEER-DETACHED', detachedPage, '[aria-label="独立窗口发送消息"]', '独立窗口运行中补充正文');
    const saved = (await chat()).messages.find(message => message.content === '独立窗口运行中补充正文');
    assert.equal(saved?.steering?.status, 'accepted');
    await detachedPage.evaluate('window.close()').catch(() => {});
    return { ...evidence, synchronizedToMainWindow: true };
  });
  await check('ordinary-answer-does-not-consult-advisor', async () => {
    const count = await send('TEAM-SIMPLE'); const message = await finished(count); assert.match(message.content, /普通问题/);
    const discussion = message.operations.find(op => op.name === 'model_debate_result' && op.status === 'succeeded');
    assert.ok(discussion); assert.equal(message.operations.filter(op => op.name === 'write_file').length, 0);
    assert.ok(report.requests.filter(r => r.task === 'TEAM-SIMPLE').some(r => r.stage === 'debate-proposal'));
    return { discussionComplete: true, writes: 0 };
  });
  await check('debate-service-failure-leaves-shares-empty-and-main-continues', async () => {
    const count = await send('TEAM-FAIL'); let message = await finished(count);
    const failedTaskAdvisorRequests = report.requests.filter(r => r.role === 'advisor' && r.task === 'TEAM-FAIL');
    assert.ok(failedTaskAdvisorRequests.some(r => r.stage === 'debate-proposal'));
    const failedDiscussion = await wait(async () => (await chat()).messages.at(-1)?.operations?.find(op => op.name === 'model_debate_result' && op.status === 'failed') || false, 'Failed debate operation');
    message = (await chat()).messages.at(-1);
    assert.ok(failedDiscussion); assert.equal(JSON.parse(failedDiscussion.output).allocation, null);
    assert.ok(message.operations.filter(op => op.name === 'advisor_consult' && op.status === 'succeeded').length >= 1);
    assert.equal(await fs.readFile(path.join(workspace, proofFiles.fallback), 'utf8'), 'main effect\n');
    return { advisorRequests: failedTaskAdvisorRequests.length, noAutomaticShares: true, effectCount: message.operations.filter(op => op.name === 'write_file' && op.status === 'succeeded').length, downgraded: true };
  });
  await check('stop-during-advice-aborts-request-and-does-not-write', async () => {
    const count = await send('TEAM-CANCEL'); await wait(() => cancelledAdvisor, 'Advisor waiting'); await click('[aria-label="停止生成"]'); await finished(count, true);
    await wait(() => cancelledClosed, 'Advisor connection aborted'); await assert.rejects(fs.access(path.join(workspace, proofFiles.cancel)));
    return { advisorAborted: true, fileCreated: false };
  });
  await check('role-usage-history-narrow-layout-and-final-settings-visual', async () => {
    const usage = await page.evaluate('window.scodex.getModelUsage()');
    const roles = [...new Set(usage.records.map(r => r.role))]; for (const role of ['main', 'explorer', 'advisor']) assert.ok(roles.includes(role));
    await settings();
    assert.equal(await page.evaluate('document.querySelector(".model-team-roles input[type=checkbox]")?.disabled'), true);
    const roleLabels = await page.evaluate('[...document.querySelectorAll(".model-team-roles dt")].map(item => item.textContent.trim())');
    assert.deepEqual(roleLabels, ['模型一', '模型二', '模型三']);
    const serviceLabels = await page.evaluate('[...document.querySelectorAll(".model-subagent-heading h2")].map(item => item.textContent.trim())');
    assert.deepEqual(serviceLabels, ['模型二服务', '模型三服务']);
    assert.ok(usage.records.filter(r => r.role === 'advisor').every(r => ['debate-proposal', 'debate-review', 'execution-supervision', 'plan', 'repeated-error', 'completion'].includes(r.stage)));
    await reload(); const restored = (await chat()).messages.find(m => m.id === workAnswer.id); assert.equal(restored.operations.filter(op => op.name === 'advisor_consult').length, 2);
    assert.equal((await chat()).messages.filter(message => message.steering?.status === 'accepted').length, 2);
    assert.equal((await chat()).messages.filter(message => ['主窗口运行中补充正文', '独立窗口运行中补充正文'].includes(message.content)).length, 2);
    await settings();
    await page.command('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: false });
    await page.evaluate('document.querySelector(".model-team-roles").scrollIntoView({block:"start"})');
    const narrow = await page.evaluate('({width:innerWidth,scroll:document.documentElement.scrollWidth,controls:[...document.querySelectorAll(".model-team-roles input,.model-team-roles select,[aria-label=模型三服务配置] input,[aria-label=模型三服务配置] select")].map(e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right}})})');
    assert.ok(narrow.scroll <= narrow.width); assert.ok(narrow.controls.every(r => r.left >= 0 && r.right <= narrow.width));
    await page.command('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
    await page.evaluate('document.querySelector(".model-team-roles").scrollIntoView({block:"start"})');
    const shot = await page.command('Page.captureScreenshot', { format: 'png' }); await fs.writeFile(path.join(output, 'model-team-settings.png'), Buffer.from(shot.data, 'base64'));
    return { roles, persistedAdvisorOperations: 2, narrow, screenshot: 'model-team-settings.png' };
  });
  assert.ok(!report.serverError, report.serverError); report.status = 'passed';
}
main().catch(error => { report.status = 'failed'; report.error = error.stack; process.exitCode = 1; console.error(error); }).finally(async () => {
  try {
    if (app?.exitCode === null && page) {
      if (await page.evaluate('Boolean(document.querySelector("[aria-label=停止生成]"))')) await click('[aria-label="停止生成"]');
      await page.evaluate('window.scodex.quitApp()'); await wait(() => app.exitCode !== null, 'Normal program exit', 30000); assert.equal(app.exitCode, 0);
    }
  } catch (error) { report.shutdownError = error.stack; report.status = 'failed'; process.exitCode = 1; }
  detachedSocket?.close(); socket?.close(); if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
  report.exitCode = app?.exitCode; report.finishedAt = new Date().toISOString();
  if (app?.exitCode !== null) report.exeSha256 = crypto.createHash('sha256').update(await fs.readFile(executable)).digest('hex');
  await persist(); console.log(json({ status: report.status, checks: report.checks.length, output }));
});
