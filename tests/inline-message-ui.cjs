// Actual packaged Electron and detached-window UI; only model text is loopback.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const { connect, wait, freePort } = require('./agent-workflow-ui.cjs');

const root = path.resolve(__dirname, '..');
const version = require('../package.json').version;
const output = path.resolve(process.env.SCODEX_INLINE_OUTPUT || path.join(root, 'release/delivery-' + version + '/inline-ui'));
const executable = process.env.SCODEX_INLINE_EXE || path.join(root, 'release/win-unpacked/Scodex工作台.exe');
const fixture = path.join(output, 'fixture-' + crypto.randomUUID());
const profile = path.join(fixture, 'profile');
const home = path.join(fixture, 'home');
const workspace = path.join(fixture, 'workspace');
const report = { status: 'running', version, executable, fixture, checks: [], requests: [], limitation: '真实 Electron 界面、IPC、历史存储；只有模型回答使用本机回环服务。' };
const json = JSON.stringify;
let child, mainPage, childPage, server, port;
const sockets = new Set();

async function targets() { return fetch('http://127.0.0.1:' + port + '/json/list').then(response => response.json()); }
async function attach(target) {
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
  sockets.add(socket);
  return connect(socket);
}
async function launch() {
  port = await freePort();
  child = spawn(executable, ['--remote-debugging-port=' + port, '--user-data-dir=' + profile, '--disable-gpu'], {
    cwd: output, windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'],
    env: { ...process.env, SCODEX_HOME: home, SCODEX_REFERENCE_HOME: path.join(fixture, 'reference'), SCODEX_REFERENCE_AGENTS_HOME: path.join(fixture, 'agents') },
  });
  let stderr = '';
  child.stderr.on('data', part => { stderr = (stderr + part).slice(-2000); });
  const target = await wait(async () => {
    if (child.exitCode !== null) throw Error('EXE 退出：' + child.exitCode + ' ' + stderr);
    return (await targets()).find(item => item.type === 'page' && item.url.startsWith('file:') && !item.url.includes('workspaceWindow='));
  }, '程序启动', 45000);
  mainPage = await attach(target);
  await wait(() => mainPage.evaluate('Boolean(window.scodex && document.querySelector("[aria-label=输入工作内容]"))'), '主界面就绪');
  const state = await mainPage.evaluate('window.scodex.getAppState()');
  assert.equal(state.version, version);
  return state;
}
async function quit() {
  if (child?.exitCode === null && mainPage) {
    await mainPage.evaluate('window.scodex.quitApp()');
    await wait(() => child.exitCode !== null, '程序正常退出', 30000);
    assert.equal(child.exitCode, 0);
  }
  for (const socket of sockets) socket.close();
  sockets.clear();
  childPage = null;
}
const state = () => mainPage.evaluate('window.scodex.getAppState()');
async function chat() { return (await state()).library.conversations.find(item => item.id === 'inline-chat'); }
async function click(selector, page = mainPage) {
  await wait(() => page.evaluate('(()=>{const e=document.querySelector(' + json(selector) + ');if(!e||e.disabled)return false;e.click();return true})()'), '点击 ' + selector);
}
async function type(selector, value, page = mainPage) {
  await page.evaluate('(()=>{const e=document.querySelector(' + json(selector) + ');if(!e)throw Error("输入框不存在");e.focus();Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,"value").set.call(e,' + json(value) + ');e.dispatchEvent(new Event("input",{bubbles:true}));})()');
}
async function finished(previousId) {
  return wait(async () => { const c = await chat(), answer = c?.messages.at(-1); return answer?.role === 'assistant' && answer.id !== previousId && !answer.pending && answer.content.startsWith('回答') ? c : false; }, '新回答完成', 45000);
}
async function saved(expected) {
  await wait(async () => { try { const value = JSON.parse(await fs.readFile(path.join(profile, 'conversations.json'), 'utf8')); return value.conversations.find(item => item.id === 'inline-chat')?.messages.at(-1)?.content === expected; } catch { return false; } }, '聊天已落盘');
}
async function check(name, run) { const evidence = await run(); report.checks.push({ name, status: 'passed', evidence }); process.stdout.write('PASS ' + name + '\n'); }

async function setup() {
  await Promise.all([fs.mkdir(profile, { recursive: true }), fs.mkdir(home, { recursive: true }), fs.mkdir(workspace, { recursive: true })]);
  const now = new Date().toISOString();
  const chat = { id: 'inline-chat', title: '消息编辑验收', createdAt: now, updatedAt: now, mode: 'answer', draft: '', messages: [
    { id: 'u1', role: 'user', content: '第一个问题', mode: 'answer' },
    { id: 'a1', role: 'assistant', content: '第一个旧回答' },
    { id: 'u2', role: 'user', content: '第二个问题', mode: 'answer' },
    { id: 'a2', role: 'assistant', content: '第二个旧回答' },
  ] };
  await fs.writeFile(path.join(profile, 'conversations.json'), json({ version: 2, activeId: chat.id, conversations: [chat] }));
  await fs.writeFile(path.join(profile, 'settings.json'), json({ projects: [], activeProjectId: '', workspaceRoot: workspace, preferences: { contextAccess: 'chat-only', fontFamily: 'Microsoft YaHei', fontSize: 16, closeConfirmation: 'never' } }));
  await fs.writeFile(path.join(home, 'codex-settings.json'), json({ sandboxMode: 'danger-full-access', approvalPolicy: 'never', networkAccess: true, networkDomains: ['*'], allowLocalBinding: true, workspaceDependencies: false, availableReasoningEfforts: ['low'], defaultReasoningEffort: 'low' }));
  server = http.createServer(async (request, response) => {
    if (request.url !== '/v1/chat/completions') { response.writeHead(404); response.end(); return; }
    let raw = ''; for await (const part of request) raw += part;
    const body = JSON.parse(raw), prompt = body.messages.filter(item => item.role === 'user').at(-1)?.content || '';
    report.requests.push({ prompt, tools: body.tools?.length || 0 });
    const answer = '回答' + report.requests.length + '：' + prompt;
    response.writeHead(200, { 'content-type': 'text/event-stream' });
    response.end('data: ' + json({ choices: [{ delta: { content: answer } }] }) + '\n\ndata: ' + json({ choices: [{ delta: {}, finish_reason: 'stop' }] }) + '\n\ndata: [DONE]\n\n');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
}

async function main() {
  await setup(); await launch();
  const connection = { name: '消息编辑隔离模型', baseUrl: 'http://127.0.0.1:' + server.address().port + '/v1', model: 'fixture-model', models: ['fixture-model'], apiKey: 'fixture-key', retryLimit: 0, toolProtocol: 'native' };
  await mainPage.evaluate('window.scodex.saveModelConnection(' + json(connection) + ').then(()=>location.reload())');
  await wait(() => mainPage.evaluate('Boolean(document.querySelector("[data-message-id=u2] [aria-label=编辑此消息]"))'), '旧消息呈现');
  await check('气泡内编辑并用 Escape 取消', async () => {
    const adjacent = await mainPage.evaluate('(()=>{const a=document.querySelector("[data-message-id=u2] .user-message-actions");return [...a.querySelectorAll("button")].map(b=>b.getAttribute("aria-label"))})()');
    assert.deepEqual(adjacent.slice(0, 2), ['编辑此消息', '重试此消息']);
    await click('[data-message-id=u2] [aria-label=编辑此消息]');
    assert.equal(await mainPage.evaluate('Boolean(document.querySelector(".message-revision-dialog[open]"))'), false);
    assert.equal(await mainPage.evaluate('Boolean(document.querySelector("[data-message-id=u2] textarea[aria-label=在原消息内编辑]"))'), true);
    await mainPage.command('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    await wait(() => mainPage.evaluate('!document.querySelector("[data-message-id=u2] textarea")'), 'Escape 取消');
    assert.equal(report.requests.length, 0);
    return { actions: adjacent, dialogOpened: false, cancelledWithoutRequest: true };
  });
  await check('编辑发送和相邻重试替换旧回答', async () => {
    await click('[data-message-id=u2] [aria-label=编辑此消息]');
    await type('[data-message-id=u2] textarea[aria-label=在原消息内编辑]', '第二个修订问题');
    await click('[data-message-id=u2] .user-message-inline-buttons button[type=submit]');
    const edited = await finished('a2');
    assert.equal(edited.messages[2].content, '第二个修订问题');
    assert.equal(edited.messages.some(item => item.id === 'a2'), false);
    assert.equal(edited.revisions[0].messages[3].content, '第二个旧回答');
    assert.equal(report.requests.at(-1).prompt, '第二个修订问题');
    const oldAnswer = edited.messages.at(-1).id, oldVersionCount = edited.revisions.length;
    await click('[data-message-id=' + json(edited.messages[2].id) + '] [aria-label=重试此消息]');
    const retried = await finished(oldAnswer);
    assert.equal(retried.messages.some(item => item.id === oldAnswer), false);
    assert.equal(retried.revisions.length, oldVersionCount);
    assert.equal(report.requests.at(-1).prompt, '第二个修订问题');
    assert.equal(report.requests.at(-1).tools, 0);
    assert.equal(await mainPage.evaluate('Boolean(document.querySelector(".message-revision-dialog[open]"))'), false);
    await saved(retried.messages.at(-1).content);
    return { edited: edited.messages[2].content, retryPrompt: report.requests.at(-1).prompt, removedAnswer: oldAnswer, noNewRetryVersion: true };
  });
  await check('较早消息重试先确认并移除后续对话', async () => {
    const before = await chat(), requestCount = report.requests.length;
    await mainPage.evaluate('window.confirm=()=>false');
    await click('[data-message-id=u1] [aria-label=重试此消息]');
    assert.equal(report.requests.length, requestCount);
    assert.deepEqual((await chat()).messages, before.messages);
    await mainPage.evaluate('window.confirm=()=>true');
    await click('[data-message-id=u1] [aria-label=重试此消息]');
    const after = await finished(before.messages.at(-1).id);
    assert.equal(after.messages.length, 2);
    assert.equal(after.messages[0].content, '第一个问题');
    assert.equal(report.requests.at(-1).prompt, '第一个问题');
    await saved(after.messages.at(-1).content);
    return { cancelledWithoutMutation: true, confirmedMessages: after.messages.length };
  });
  await check('独立窗口同步气泡编辑与重试', async () => {
    await mainPage.evaluate('window.scodex.openWorkspaceWindow("chat","inline-chat")');
    const target = await wait(async () => (await targets()).find(item => item.url.includes('workspaceWindow=chat')), '独立窗口已打开');
    childPage = await attach(target);
    await wait(() => childPage.evaluate('Boolean(document.querySelector("[aria-label=编辑此消息]"))'), '独立窗口消息呈现');
    const before = await chat(), userId = before.messages[0].id;
    await click('[data-message-id=' + json(userId) + '] [aria-label=编辑此消息]', childPage);
    assert.equal(await childPage.evaluate('Boolean(document.querySelector(".message-revision-dialog[open]"))'), false);
    await type('[data-message-id=' + json(userId) + '] textarea[aria-label=在原消息内编辑]', '独立窗口修订问题', childPage);
    await childPage.command('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', modifiers: 2, windowsVirtualKeyCode: 13 });
    await childPage.command('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', modifiers: 2, windowsVirtualKeyCode: 13 });
    const edited = await finished(before.messages.at(-1).id);
    assert.equal(edited.messages[0].content, '独立窗口修订问题');
    await wait(() => childPage.evaluate('Boolean(document.querySelector("[aria-label=重试此消息]"))'), '独立窗口更新');
    const oldAnswer = edited.messages.at(-1).id;
    await click('[aria-label=重试此消息]', childPage);
    const retried = await finished(oldAnswer);
    assert.equal(retried.messages.some(item => item.id === oldAnswer), false);
    assert.equal(report.requests.at(-1).prompt, '独立窗口修订问题');
    await saved(retried.messages.at(-1).content);
    return { syncedToMain: true, replacedAnswer: oldAnswer, noDialog: true };
  });
  const last = await chat();
  await quit(); await launch();
  await check('正常退出后历史仍保持新消息', async () => {
    const restored = await chat();
    assert.deepEqual(restored.messages, last.messages);
    assert.deepEqual(restored.revisions, last.revisions);
    await mainPage.command('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: false });
    await click('[aria-label=编辑此消息]');
    const bounds = await mainPage.evaluate('(()=>{const e=document.querySelector(".user-message-editing"),t=e.querySelector("textarea"),r=e.getBoundingClientRect(),q=t.getBoundingClientRect();return {scroll:document.documentElement.scrollWidth,width:innerWidth,left:r.left,right:r.right,textareaRight:q.right,dialog:Boolean(document.querySelector(".message-revision-dialog[open]"))}})()');
    assert.ok(bounds.scroll <= bounds.width && bounds.left >= 0 && bounds.right <= bounds.width && bounds.textareaRight <= bounds.width);
    assert.equal(bounds.dialog, false);
    await mainPage.command('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
    const shot = await mainPage.command('Page.captureScreenshot', { format: 'png' });
    await fs.writeFile(path.join(output, 'inline-message.png'), Buffer.from(shot.data, 'base64'));
    return { historyPersisted: true, compactViewport: bounds, screenshot: 'inline-message.png' };
  });
  report.status = 'passed';
}

main().catch(error => { report.status = 'failed'; report.error = error.stack; process.exitCode = 1; process.stderr.write(error.stack + '\n'); }).finally(async () => {
  try { await quit(); } catch (error) { report.shutdownError = error.stack; process.exitCode = 1; }
  server?.closeAllConnections();
  if (server) await new Promise(resolve => server.close(resolve));
  report.exitCode = child?.exitCode;
  report.exeSha256 = crypto.createHash('sha256').update(await fs.readFile(executable)).digest('hex');
  await fs.mkdir(output, { recursive: true });
  await fs.writeFile(path.join(output, 'inline-message-ui.json'), json(report, null, 2));
  process.stdout.write(json({ status: report.status, checks: report.checks.length, report: path.join(output, 'inline-message-ui.json') }) + '\n');
});
