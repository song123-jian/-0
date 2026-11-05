// Real packaged Electron/IPC/files; only the model service uses loopback fixtures.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const http = require('node:http');
const { spawn } = require('node:child_process');
const { connect, wait, freePort } = require('./agent-workflow-ui.cjs');

const root = path.resolve(__dirname, '..'), version = require('../package.json').version;
const output = path.resolve(process.env.SCODEX_RETRY_OUTPUT || path.join(root, 'release/delivery-' + version + '/candidate-ui'));
const executable = process.env.SCODEX_RETRY_EXE || path.join(root, 'release/win-unpacked/Scodex工作台.exe');
const fixture = process.env.SCODEX_RETRY_RESUME || path.join(output, 'fixture-' + crypto.randomUUID()), profile = path.join(fixture, 'profile');
const home = path.join(fixture, 'home');
let workspace = path.join(fixture, 'workspace');
const foldOnly = process.env.SCODEX_RETRY_SCOPE === 'fold';
const visualOnly = process.env.SCODEX_RETRY_SCOPE === 'visual';
const reuseFile = path.join(root, 'release/delivery-' + version + (visualOnly ? '/candidate-ui-r5/' : '/candidate-ui-r4/') + 'retry-completion-ui.json');
const reusedChecks = foldOnly || visualOnly ? require(reuseFile).checks : [];
const json = JSON.stringify, sockets = new Set(), timers = new Set();
const report = { status: 'running', version, executable, fixture, checks: [], requests: [], limitations: ['Actual packaged Electron, renderer, IPC, Windows encryption and workspace files. Model responses/failures are loopback fixtures; no public provider reliability claim.'] };
let child, page, server, port, foldedId;
const finalAnswer = '方案交付：已完成本次文件修改。\n\n验证结果：完成标记已保存。\n\n实施总结：处理过程已收起，文件更改保留在下方。';
const selector = id => '[data-message-id=' + json(id) + ']';
const state = () => page.evaluate('window.scodex.getAppState()');
async function chat() { return (await state()).library.conversations.find(item => item.id === 'retry-fold-chat'); }
async function click(css, target = page, text) {
  await wait(() => target.evaluate('(()=>{const e=[...document.querySelectorAll(' + json(css) + ')].find(e=>' + (text ? 'e.textContent.trim()===' + json(text) : 'true') + ');if(!e||e.disabled)return false;e.click();return true})()'), 'Click ' + css);
}
async function insert(css, value) {
  await page.evaluate('(()=>{const e=document.querySelector(' + json(css) + ');if(!e)throw Error("Missing input");const p=e instanceof HTMLSelectElement?HTMLSelectElement.prototype:HTMLTextAreaElement.prototype;Object.getOwnPropertyDescriptor(p,"value").set.call(e,' + json(value) + ');e.dispatchEvent(new Event(e instanceof HTMLSelectElement?"change":"input",{bubbles:true}));})()');
}
async function reload() {
  const origin = await page.evaluate('performance.timeOrigin');
  await page.command('Page.reload');
  await wait(() => page.evaluate('performance.timeOrigin!==' + origin + '&&Boolean(window.scodex&&document.querySelector("[aria-label=设置]"))'), 'Renderer reload');
}
async function begin(text) {
  const count = (await chat()).messages.length;
  await insert('[aria-label="输入工作内容"]', text); await click('[aria-label="发送消息"]');
  return count;
}
async function finished(count, expectError = false) {
  return wait(async () => {
    const current = await chat(), answer = current.messages.at(-1);
    if (current.messages.length <= count || answer?.role !== 'assistant') return false;
    const renderedState = await page.evaluate('document.querySelector(' + json(selector(answer.id) + ' .message-progress') + ')?.dataset.state');
    if (!['complete', 'failed', 'cancelled'].includes(renderedState)) return false;
    if (!expectError && !answer.content) return false;
    if (expectError && (renderedState === 'failed' ? !answer.error : renderedState === 'cancelled' ? !answer.cancelled : true)) return false;
    if (!expectError && answer.error) throw Error(answer.error);
    return answer;
  }, 'Terminal answer', 65000);
}
const countRequests = prompt => report.requests.filter(item => item.prompt === prompt).length;
async function check(name, fn) {
  const prior = reusedChecks.find(item => item.name === name && item.status === 'passed');
  if (prior) { report.checks.push({ ...prior, reusedFrom: reuseFile }); return; }
  const evidence = await fn(); report.checks.push({ name, status: 'passed', evidence });
  await fs.writeFile(path.join(output, 'retry-completion-ui.json'), json(report, null, 2));
  process.stdout.write('PASS ' + name + '\n');
}
async function attach(target) {
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
  sockets.add(socket); return connect(socket);
}
async function targets() { return fetch('http://127.0.0.1:' + port + '/json/list').then(response => response.json()); }
async function launch() {
  await fs.mkdir(output, { recursive: true });
  port = await freePort();
  child = spawn(executable, ['--remote-debugging-port=' + port, '--user-data-dir=' + profile, '--disable-gpu'], {
    cwd: output, windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'],
    env: { ...process.env, SCODEX_HOME: home, SCODEX_REFERENCE_HOME: path.join(fixture, 'reference'), SCODEX_REFERENCE_AGENTS_HOME: path.join(fixture, 'agents') },
  });
  let stderr = ''; child.stderr.on('data', part => { stderr = (stderr + part).slice(-2000); });
  const target = await wait(async () => {
    if (child.exitCode !== null) throw Error('EXE exited ' + child.exitCode + ' ' + stderr);
    return (await targets()).find(item => item.type === 'page' && item.url.startsWith('file:') && !item.url.includes('workspaceWindow='));
  }, 'Packaged EXE launch', 45000);
  page = await attach(target);
  await wait(() => page.evaluate('Boolean(window.scodex&&document.querySelector("[aria-label=输入工作内容]"))'), 'Renderer ready');
  const actual = await state();
  assert.equal(actual.version, version);
  assert.ok(path.resolve(actual.workspaceRoot).startsWith(path.resolve(fixture) + path.sep), 'Workspace must stay inside the task-owned fixture');
  workspace = actual.workspaceRoot;
  report.workspace = workspace;
}
async function quit() {
  if (child?.exitCode === null && page) {
    await page.evaluate('window.scodex.quitApp()'); await wait(() => child.exitCode !== null, 'Normal exit', 30000);
    assert.equal(child.exitCode, 0);
  }
  for (const socket of sockets) socket.close(); sockets.clear();
}
const frame = delta => 'data: ' + json({ choices: [delta] }) + '\n\n';
function reply(response, content) {
  response.writeHead(200, { 'content-type': 'text/event-stream' });
  response.end(frame({ delta: { content }, finish_reason: 'stop' }) + 'data: [DONE]\n\n');
}
function tool(response, name, args, content = '') {
  response.writeHead(200, { 'content-type': 'text/event-stream' });
  response.end(frame({ delta: { content, tool_calls: [{ index: 0, id: crypto.randomUUID(), type: 'function', function: { name, arguments: json(args) } }] }, finish_reason: 'tool_calls' }) + 'data: [DONE]\n\n');
}
async function setup() {
  await Promise.all([fs.mkdir(profile, { recursive: true }), fs.mkdir(home, { recursive: true }), fs.mkdir(workspace, { recursive: true })]);
  const now = new Date().toISOString(), oldOp = { id: 'old-failed-read', name: 'read_file', status: 'failed', output: 'Historical missing file' };
  const initial = { id: 'retry-fold-chat', title: '完成过程与重试验收', createdAt: now, updatedAt: now, mode: 'answer', executionEnabled: true, messages: [
    { id: 'old-user', role: 'user', content: '历史任务', mode: 'answer' },
    { id: 'old-answer', role: 'assistant', content: '历史完成答复', elapsedMs: 69000, operations: [oldOp] },
    { id: 'failed-user', role: 'user', content: '失败任务' },
    { id: 'failed-answer', role: 'assistant', content: '保留的部分答复', error: '历史错误', operations: [oldOp] },
    { id: 'cancel-user', role: 'user', content: '停止任务' },
    { id: 'cancel-answer', role: 'assistant', content: '保留的停止答复', cancelled: true, operations: [oldOp] },
  ] };
  await fs.writeFile(path.join(profile, 'conversations.json'), json({ version: 2, activeId: initial.id, conversations: [initial] }));
  await fs.writeFile(path.join(profile, 'settings.json'), json({ workspaceRoot: workspace, projects: [], activeProjectId: '', preferences: { contextAccess: 'full', browserPanelOpen: false, trayEnabled: false, closeConfirmation: 'never', fontFamily: 'Microsoft YaHei', fontSize: 16 } }));
  await fs.writeFile(path.join(home, 'codex-settings.json'), json({ sandboxMode: 'danger-full-access', approvalPolicy: 'never', networkAccess: true, networkDomains: ['*'], allowLocalBinding: true, workspaceDependencies: false, availableReasoningEfforts: ['low'], defaultReasoningEffort: 'low' }));
  server = http.createServer(async (request, response) => { try {
    let raw = ''; for await (const part of request) raw += part;
    const body = JSON.parse(raw), index = body.messages.findLastIndex(item => item.role === 'user');
    const prompt = body.messages[index]?.content, results = body.messages.slice(index + 1).filter(item => item.role === 'tool');
    report.requests.push({ prompt, step: results.length });
    const n = countRequests(prompt);
    if (prompt === 'SIX-SUCCESS' && n <= 6 || prompt === 'SIX-EXHAUST') {
      response.writeHead([429, 502, 503, 504][(n - 1) % 4]); response.end('{}'); return;
    }
    if (prompt === 'AUTH-NO-RETRY') { response.writeHead(502); response.end(json({ error: { message: 'Upstream authentication failed' } })); return; }
    if (prompt === 'PARTIAL-NO-RETRY') { response.writeHead(200, { 'content-type': 'text/event-stream' }); response.end(frame({ delta: { content: '部分答复' } })); return; }
    if (prompt === 'CANCEL-BACKOFF') { response.writeHead(503); response.end('{}'); return; }
    if (prompt === 'FOLD-WORK') {
      if (!results.length) return tool(response, 'read_file', { path: 'missing-fixture.txt' }, '先检查现有文件。');
      if (results.length === 1) return tool(response, 'write_file', { path: 'completed.txt', expected_hash: 'new', content: '完成\n' }, '已确认原文件不存在，开始创建完成标记。');
      return reply(response, finalAnswer);
    }
    if (prompt === 'TOOL-NO-REPLAY') {
      if (!results.length) return tool(response, 'write_file', { path: 'once.txt', expected_hash: 'new', content: 'once\n' });
      response.writeHead(503); response.end('{}'); return;
    }
    return reply(response, '直接答复完成。');
  } catch (error) { report.serverError = error.stack; if (!response.headersSent) response.writeHead(500); response.end(); } });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
}
async function main() {
  if (!visualOnly) await setup();
  await launch();
  if (!visualOnly) await page.evaluate('window.scodex.saveModelConnection(' + json({ name: '六次重试验收', baseUrl: 'http://127.0.0.1:' + server.address().port + '/v1', model: 'fixture', models: ['fixture'], apiKey: 'fixture-only', retryLimit: foldOnly ? 6 : 2, toolProtocol: 'native' }) + ')');
  else foldedId = (await chat()).messages.findLast(item => item.role === 'assistant' && item.finalContentOffset > 0).id;
  await reload();
  await check('settings-select-six-save-and-reload', async () => {
    assert.equal(await page.evaluate('window.scodex.getModelConnection().then(c=>c.retryLimit)'), 2);
    await click('[aria-label="设置"]'); await click('.settings-category', page, '模型与连接');
    await wait(() => page.evaluate('Boolean(document.querySelector("#model-retry"))'), 'Retry settings');
    const options = await page.evaluate('[...document.querySelector("#model-retry").options].map(o=>Number(o.value))');
    assert.deepEqual(options, [0, 1, 2, 3, 4, 5, 6]);
    await insert('#model-retry', '6'); await click('.model-save-button');
    await wait(() => page.evaluate('document.querySelector(".model-message")?.textContent.includes("已保存")'), 'Settings saved');
    await reload();
    assert.equal(await page.evaluate('window.scodex.getModelConnection().then(c=>c.retryLimit)'), 6);
    await click('[aria-label="项目"]');
    await wait(() => page.evaluate('Boolean(document.querySelector("[aria-label=输入工作内容]"))'), 'Return to chat');
    return { options, saved: 6 };
  });
  await check('old-history-folds-success-keeps-errors-and-cancellation-readable', async () => {
    const value = await page.evaluate('(()=>{const get=id=>document.querySelector("[data-message-id="+id+"] .message-execution");return {completedOpen:get("old-answer").open,failedOpen:get("failed-answer").open,cancelledOpen:get("cancel-answer").open,summary:get("old-answer").querySelector("summary").innerText}})()');
    assert.equal(value.completedOpen, false); assert.equal(value.failedOpen, true); assert.equal(value.cancelledOpen, true);
    assert.match(value.summary, /已处理\s+1分钟 9秒/); return value;
  });
  await check('sixth-retry-succeeds-and-direct-answer-has-toggle', async () => {
    const message = await finished(await begin('SIX-SUCCESS')); assert.equal(countRequests('SIX-SUCCESS'), 7);
    assert.equal(message.content, '直接答复完成。');
    const css = selector(message.id);
    await wait(() => page.evaluate('document.querySelector(' + json(css + ' .message-execution') + ').open===false'), 'Direct answer folded');
    await click(css + ' .message-execution-summary');
    assert.equal(await page.evaluate('document.querySelector(' + json(css + ' .message-execution-empty') + ').checkVisibility()'), true);
    await click(css + ' .message-execution-summary'); return { requests: 7, retries: 6, directAnswerVisible: true, toggle: true };
  });
  await check('seventh-failure-stops-without-request-eight', async () => {
    const message = await finished(await begin('SIX-EXHAUST'), true);
    assert.match(message.error, /HTTP 503/); assert.equal(countRequests('SIX-EXHAUST'), 7);
    assert.equal(await page.evaluate('document.querySelector(' + json(selector(message.id) + ' .message-error') + ').checkVisibility()'), true);
    return { requests: 7, error: message.error };
  });
  await check('authentication-and-broken-stream-are-not-retried', async () => {
    for (const prompt of ['AUTH-NO-RETRY', 'PARTIAL-NO-RETRY']) {
      const message = await finished(await begin(prompt), true); assert.ok(message.error); assert.equal(countRequests(prompt), 1);
    }
    return { authRequests: 1, partialStreamRequests: 1 };
  });
  await check('stop-during-backoff-prevents-next-request', async () => {
    const count = await begin('CANCEL-BACKOFF');
    await wait(() => page.evaluate('document.querySelector(".message-progress[data-state=running]")?.innerText.includes("重试等待")'), 'Retry backoff visible');
    await click('[aria-label="停止生成"]'); const message = await finished(count, true);
    assert.equal(message.cancelled, true); assert.equal(countRequests('CANCEL-BACKOFF'), 1); return { cancelled: true, requests: 1 };
  });
  await check('completed-tool-is-not-replayed-after-later-service-error', async () => {
    const message = await finished(await begin('TOOL-NO-REPLAY'), true);
    assert.match(message.error, /HTTP 503/); assert.equal(countRequests('TOOL-NO-REPLAY'), 2);
    assert.equal(message.operations.filter(item => item.name === 'write_file').length, 1);
    assert.equal(await fs.readFile(path.join(workspace, 'once.txt'), 'utf8'), 'once\n'); return { requests: 2, writes: 1 };
  });
  await check('completion-folds-commentary-and-failed-tool-final-answer-and-file-card-stay-visible', async () => {
    const count = await begin('FOLD-WORK');
    const message = await finished(count); foldedId = message.id;
    assert.ok(message.operations.some(item => item.status === 'failed'));
    assert.equal(await fs.readFile(path.join(workspace, 'completed.txt'), 'utf8'), '完成\n');
    const css = selector(foldedId);
    await wait(() => page.evaluate('document.querySelector(' + json(css + ' .message-execution') + ').open===false'), 'Auto collapse at completion');
    await wait(() => page.evaluate('document.querySelector(' + json(css + ' .task-file-changes') + ')?.innerText.includes("completed.txt")'), 'Actual file card visible');
    const visible = await page.evaluate('(()=>{const e=document.querySelector(' + json(css) + ');return {answer:e.querySelector(".assistant-message-main > .assistant-message-content").innerText,activityVisible:e.querySelector(".message-execution-body").checkVisibility(),cardVisible:e.querySelector(".task-file-changes").checkVisibility(),summary:e.querySelector(".message-execution-summary").innerText}})()');
    assert.equal(visible.answer, finalAnswer); assert.equal(visible.activityVisible, false); assert.equal(visible.cardVisible, true);
    await click(css + ' .message-execution-summary');
    assert.equal(await page.evaluate('document.querySelector(' + json(css + ' .message-execution-body') + ').innerText.includes("先检查现有文件")'), true);
    await click(css + ' .agent-operation.failed > summary');
    assert.equal(await page.evaluate('document.querySelector(' + json(css + ' .message-execution') + ').open'), true);
    await click(css + ' .message-execution-summary');
    return { ...visible, finalContentOffset: message.finalContentOffset, failedToolRetained: true, realFileCreated: true };
  });
  await check('detached-window-and-keyboard-use-same-disclosure', async () => {
    await page.evaluate('window.scodex.openWorkspaceWindow("chat","retry-fold-chat")');
    const target = await wait(async () => (await targets()).find(item => item.type === 'page' && item.url.includes('workspaceWindow=')), 'Detached chat');
    const detached = await attach(target), css = selector(foldedId);
    await wait(() => detached.evaluate('Boolean(document.querySelector(' + json(css + ' .message-execution') + '))'), 'Detached answer');
    assert.equal(await detached.evaluate('document.querySelector(' + json(css + ' .message-execution') + ').open'), false);
    await detached.command('Page.bringToFront');
    const focus = await detached.evaluate('(()=>{const e=document.querySelector(' + json(css + ' .message-execution-summary') + ');e.focus();return {focused:document.activeElement===e,hasFocus:document.hasFocus(),tabIndex:e.tabIndex,visible:e.checkVisibility()}})()');
    report.keyboardFocus = focus;
    assert.equal(focus.focused, true); assert.equal(focus.visible, true);
    await detached.command('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', text: '\r', unmodifiedText: '\r', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 });
    await detached.command('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 });
    await wait(() => detached.evaluate('document.querySelector(' + json(css + ' .message-execution') + ').open===true'), 'Enter expands native disclosure');
    assert.equal(await detached.evaluate('document.querySelector(' + json(css + ' .task-file-changes') + ').checkVisibility()'), true);
    return { initiallyCollapsed: true, keyboardExpanded: true, finalAnswerAndCardVisible: true };
  });
  await check('reload-preserves-boundary-and-narrow-layout-and-final-desktop-visual', async () => {
    await reload(); const message = (await chat()).messages.find(item => item.id === foldedId);
    assert.ok(message.finalContentOffset > 0);
    const css = selector(foldedId);
    await wait(() => page.evaluate('document.querySelector(' + json(css + ' .message-execution') + ')?.open===false'), 'Persisted completion collapsed');
    await page.command('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: false });
    if (await page.evaluate('Boolean(document.querySelector(".app-shell.has-browser"))')) await click('[aria-label="切换网页工作台"]');
    const narrow = await page.evaluate('(()=>{const e=document.querySelector(' + json(css + ' .message-execution-summary') + '),r=e.getBoundingClientRect();return {left:r.left,right:r.right,width:innerWidth,scroll:document.documentElement.scrollWidth,font:parseFloat(getComputedStyle(e.querySelector(".message-progress")).fontSize)}})()');
    assert.ok(narrow.left >= 0 && narrow.right <= narrow.width && narrow.scroll <= narrow.width);
    await page.command('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
    await page.evaluate('document.querySelector(' + json(css) + ').scrollIntoView({block:"center"})');
    const screenshot = await page.command('Page.captureScreenshot', { format: 'png' });
    await fs.writeFile(path.join(output, 'completed-fold.png'), Buffer.from(screenshot.data, 'base64'));
    return { historyBoundary: message.finalContentOffset, narrow, screenshot: 'completed-fold.png' };
  });
  assert.ok(!report.serverError, report.serverError); report.status = 'passed';
}
main().catch(error => { report.status = 'failed'; report.error = error.stack; process.exitCode = 1; process.stderr.write(error.stack + '\n'); }).finally(async () => {
  try { await quit(); } catch (error) { report.shutdownError = error.stack; process.exitCode = 1; }
  for (const timer of timers) clearTimeout(timer);
  server?.closeAllConnections(); if (server) await new Promise(resolve => server.close(resolve));
  report.exitCode = child?.exitCode;
  report.exeSha256 = crypto.createHash('sha256').update(await fs.readFile(executable)).digest('hex');
  await fs.mkdir(output, { recursive: true }); await fs.writeFile(path.join(output, 'retry-completion-ui.json'), json(report, null, 2));
  process.stdout.write(json({ status: report.status, checks: report.checks.length, report: path.join(output, 'retry-completion-ui.json') }) + '\n');
});
