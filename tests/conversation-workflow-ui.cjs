// Exercise the packaged Electron app. Only the model endpoint uses a loopback fixture.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const http = require('node:http');
const { spawn } = require('node:child_process');
const { connect, wait, freePort } = require('./agent-workflow-ui.cjs');
const root = path.resolve(__dirname, '..'), version = '1.3.63';
const scope = process.env.SCODEX_WORKFLOW_SCOPE || 'full';
if (!['full', 'remaining', 'final', 'layout', 'storage', 'recovery'].includes(scope)) throw Error('Unknown workflow verification scope');
const executable = path.resolve(process.env.SCODEX_WORKFLOW_EXE || path.join(root, `release/Scodex-Workbench-${version}/win-unpacked/Scodex工作台.exe`));
const output = path.resolve(process.env.SCODEX_WORKFLOW_OUTPUT || path.join(root, `release/workflow-session-${version}/candidate-ui`));
const tempRoot = path.resolve(process.env.SystemRoot || 'C:\\Windows', 'Temp');
const fixture = path.join(tempRoot, 'scodex-workflow-' + crypto.randomUUID());
const profile = path.join(fixture, 'profile'), home = path.join(fixture, 'home'), workspace = path.join(fixture, 'project');
const json = JSON.stringify, promptSelector = '[aria-label="输入工作内容"]';
const report = { status: 'running', version, scope, executable, fixture, checks: [], requests: [], limitations: ['Only the model service and credentials are substituted. Actual EXE, renderer, IPC, persistence and workspace file operations are used. Public services and native file dialogs are not covered. Restart deliberately terminates only the test-owned process after checking persisted state.'] };
const holds = new Map(), heldOnce = new Set(), queueRetryFailures = new Set(), queueCancellationHolds = new Set(); let app, socket, page, server, config, stage = 'setup';
const exited = () => Boolean(app && (app.exitCode !== null || app.signalCode !== null));
async function persist() { await fs.writeFile(path.join(output, 'conversation-workflow-ui.json'), json(report, null, 2) + '\n'); }
async function check(name, fn) { stage = name; const evidence = await fn(); report.checks.push({ name, status: 'passed', evidence }); await persist(); console.log('PASS ' + name); }
async function click(selector) { await wait(() => page.evaluate(`(()=>{const e=document.querySelector(${json(selector)});if(!e||e.disabled)return false;e.click();return true})()`), 'Clickable ' + selector); }
const button = label => click(`[aria-label="${label}"]`);
async function input(text, selector = promptSelector) { await page.evaluate(`(()=>{const e=document.querySelector(${json(selector)});if(!e)throw Error('Missing input');e.focus();Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(e,${json(text)});e.dispatchEvent(new Event('input',{bubbles:true}));})()`); }
async function textButton(selector, text) { await wait(() => page.evaluate(`(()=>{const e=[...document.querySelectorAll(${json(selector)})].find(e=>e.textContent.includes(${json(text)}));if(!e||e.disabled)return false;e.click();return true})()`), 'Text button ' + text); }
async function select(selector, value) { await page.evaluate(`(()=>{const e=document.querySelector(${json(selector)});if(!e||e.disabled)throw Error('Selection disabled');Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(e,${json(value)});e.dispatchEvent(new Event('change',{bubbles:true}));})()`); await wait(() => page.evaluate(`document.querySelector(${json(selector)})?.value===${json(value)}`), 'Selected ' + value); }
async function switchChat(id) { await click(`[data-chat-id="${id}"]`); await wait(() => page.evaluate(`document.querySelector('[data-chat-id="${id}"]')?.getAttribute('aria-current')==='true'`), 'Active chat ' + id); }
async function saved(id) { return JSON.parse(await fs.readFile(path.join(profile, 'conversations.json'), 'utf8')).conversations.find(chat => chat.id === id); }
async function settled() { await wait(() => page.evaluate('Boolean(document.querySelector("[aria-label=发送消息]"))'), 'Task completion', 45000); }
async function submit(text) { await input(text); await button('发送消息'); }
async function enqueue(text) { await input(text); await button('加入待发送队列'); await wait(() => page.evaluate(`document.querySelector(${json(promptSelector)})?.value===''`), 'Queue captures input'); }
async function waitHold(token) { await wait(() => Promise.resolve(holds.has(token)), 'Held request ' + token); }
function finishModel(res, message) {
  res.writeHead(200, { 'content-type': 'text/event-stream; charset=utf-8' });
  const delta = { ...(message.content ? { content: message.content } : {}), ...(message.tool_calls ? { tool_calls: message.tool_calls.map((item, index) => ({ index, ...item })) } : {}) };
  res.end('data: ' + json({ choices: [{ delta }] }) + '\n\ndata: ' + json({ choices: [{ delta: {}, finish_reason: message.tool_calls ? 'tool_calls' : 'stop' }] }) + '\n\ndata: [DONE]\n\n');
}
function tool(name, args) { return { tool_calls: [{ id: 'call_' + crypto.randomBytes(6).toString('hex'), type: 'function', function: { name, arguments: json(args) } }] }; }
function release(token, failure = false) { const res = holds.get(token); assert.ok(res, token); holds.delete(token); if (failure) { res.writeHead(503, { 'content-type': 'application/json' }); res.end(json({ error: { message: 'Controlled workflow failure' } })); } else finishModel(res, token === 'HOLD:STEER' ? tool('list_directory', {}) : { content: '已完成 ' + token }); }
async function launch() {
  const port = await freePort();
  app = spawn(executable, ['--remote-debugging-port=' + port, '--user-data-dir=' + profile, '--disable-gpu'], { cwd: path.dirname(executable), windowsHide: true, stdio: 'ignore', env: { ...process.env, SCODEX_HOME: home, SCODEX_REFERENCE_HOME: path.join(fixture, 'reference'), SCODEX_REFERENCE_AGENTS_HOME: path.join(fixture, 'agents') } });
  const target = await wait(async () => { if (exited()) throw Error('EXE exited'); return (await fetch(`http://127.0.0.1:${port}/json/list`).then(r => r.json())).find(item => item.type === 'page' && item.url.startsWith('file:')); }, 'Packaged program startup', 45000);
  socket = new WebSocket(target.webSocketDebuggerUrl); await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); }); page = connect(socket);
  await wait(() => page.evaluate(`Boolean(document.querySelector(${json(promptSelector)}))`), 'Renderer ready');
  const identity = await page.evaluate('window.scodex.getAppState().then(s=>({version:s.version,userDataPath:s.userDataPath,workspaceRoot:s.workspaceRoot}))');
  assert.equal(identity.version, version); assert.equal(path.resolve(identity.userDataPath), profile); assert.equal(path.resolve(identity.workspaceRoot), workspace);
  await page.evaluate('window.__workflowNotices=[];new MutationObserver(()=>{const t=document.querySelector(".toast")?.innerText;if(t&&window.__workflowNotices.at(-1)!==t)window.__workflowNotices.push(t)}).observe(document.body,{subtree:true,childList:true,characterData:true})');
  return identity;
}
async function quit() { if (page && app && !exited()) await page.evaluate('window.scodex.quitApp()'); if (app) await wait(() => Promise.resolve(exited()), 'Program exit', 20000); socket?.close(); page = socket = null; }
async function interruptTestProcess() {
  assert.ok(app?.pid && !exited());
  const pid = app.pid; app.kill(); await wait(() => Promise.resolve(exited()), 'Test process terminated', 15000);
  socket?.close(); page = socket = null; report.interruptedTestPid = pid;
}
async function setup() {
  await fs.mkdir(output, { recursive: true }); for (const dir of [profile, home, workspace]) await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(home, 'codex-settings.json'), json({ sandboxMode: 'danger-full-access', approvalPolicy: 'never', networkAccess: true, networkDomains: ['127.0.0.1'], workspaceDependencies: false, availableReasoningEfforts: ['low'], defaultReasoningEffort: 'low' }));
  await fs.writeFile(path.join(profile, 'settings.json'), json({ workspaceRoot: workspace, projects: [{ id: 'workflow-project', path: workspace, name: '工作流验收' }], activeProjectId: 'workflow-project', preferences: { contextAccess: 'manual', browserPanelOpen: false, trayEnabled: false, closeConfirmation: 'never', ...(scope === 'layout' ? { fontSize: 20 } : {}) } }));
  const now = new Date().toISOString();
  await fs.writeFile(path.join(profile, 'conversations.json'), json({ version: 2, activeId: 'queue-chat', conversations: ['queue-chat', 'other-chat', 'plan-chat', 'scope-chat'].map(id => ({ id, projectId: 'workflow-project', title: id, createdAt: now, updatedAt: now, mode: 'answer', draft: '', messages: [], ...(id === 'scope-chat' ? { queuedMessages: [{ id: 'scope-queue', text: '不应跨项目发送', model: 'workflow-main', modelMode: 'main', mode: 'answer', scopeProjectId: 'another-project', workspaceRoot: workspace, createdAt: now }] } : {}) })) }));
  server = http.createServer(async (req, res) => {
    try {
      let raw = ''; for await (const part of req) raw += part;
      const body = JSON.parse(raw), latest = body.messages.findLastIndex(item => item.role === 'user'), prompt = String(body.messages[latest]?.content || '');
      const results = body.messages.slice(latest + 1).filter(item => item.role === 'tool').map(item => JSON.parse(item.content));
      const names = (body.tools || []).map(item => item.function.name);
      report.requests.push({ prompt, model: body.model, tools: names, history: body.messages.slice(0, latest).filter(item => ['user', 'assistant'].includes(item.role)).map(item => ({ role: item.role, content: item.content })) });
      if (req.headers.authorization !== 'Bearer workflow-fixture') throw Error('Wrong fixture credential');
      if (prompt.includes('HOLD:')) { const token = prompt.match(/HOLD:[A-Z]+/)[0]; if (!heldOnce.has(token)) { heldOnce.add(token); holds.set(token, res); res.on('close', () => { if (holds.get(token) === res) holds.delete(token); }); return; } }
      if (prompt === '派发后错误恢复' && !queueRetryFailures.has(prompt)) { queueRetryFailures.add(prompt); res.writeHead(503, { 'content-type': 'application/json' }); res.end(json({ error: { message: 'Controlled queued dispatch failure' } })); return; }
      if (prompt === '派发后取消恢复' && !queueCancellationHolds.has(prompt)) { queueCancellationHolds.add(prompt); holds.set('QUEUE-CANCEL-ITEM', res); res.on('close', () => { if (holds.get('QUEUE-CANCEL-ITEM') === res) holds.delete('QUEUE-CANCEL-ITEM'); }); return; }
      if (prompt.includes('先规划写入验收文件')) { assert.equal(names.includes('write_file'), false); assert.equal(names.includes('run_command'), false); finishModel(res, { content: '计划：检查当前项目，然后写入 plan-result.txt，回读核对“计划执行成功”，最后交付。' }); return; }
      if (prompt.startsWith('按上面的计划执行')) {
        assert.ok(names.includes('write_file')); assert.equal(body.model, 'workflow-two');
        finishModel(res, results.length === 0 ? tool('write_file', { path: 'plan-result.txt', content: '计划执行成功\n', expected_hash: 'new' }) : results.length === 1 ? tool('read_file', { path: 'plan-result.txt' }) : { content: '已按计划写入并回读，计划执行成功。' }); return;
      }
      finishModel(res, { content: '已收到：' + prompt });
    } catch (error) { report.fixtureError = error.stack; if (!res.headersSent) res.writeHead(500); res.end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); const base = 'http://127.0.0.1:' + server.address().port + '/v1';
  config = { name: '工作流会话隔离验收', baseUrl: base, apiKey: 'workflow-fixture', model: 'workflow-main', models: ['workflow-main'], subagentBaseUrl: base, subagentApiKey: 'workflow-fixture', subagentModel: 'workflow-two', subagentModels: ['workflow-two'], advisorBaseUrl: base, advisorApiKey: 'workflow-fixture', advisorModel: 'workflow-three', advisorModels: ['workflow-three'], advisorEnabled: false, toolProtocol: 'native', retryLimit: 0 };
}
async function main() {
  try {
    await setup(); await check('packaged-exe-and-isolated-profile', launch);
    await page.evaluate('window.scodex.saveModelConnection(' + json(config) + ')'); await quit(); await launch();
    if (scope === 'full') {
    await check('queue-edit-sort-remove-fifo-background-and-draft', async () => {
      await submit('HOLD:FIFO'); await waitHold('HOLD:FIFO');
      await enqueue('队列第一条'); await enqueue('队列第二条'); await enqueue('待移除消息');
      await button('编辑待发送消息 1'); await input('队列第一条已修改', '[aria-label="编辑待发送消息"]');
      assert.equal(await page.evaluate('document.querySelector("[aria-label=继续发送队列]").disabled'), true);
      await button('保存待发送消息');
      await button('下移待发送消息 1'); await button('移除待发送消息 3');
      assert.deepEqual(await page.evaluate('[...document.querySelectorAll(".conversation-queue-text")].map(e=>e.textContent)'), ['队列第二条', '队列第一条已修改']);
      assert.ok(await page.evaluate('document.querySelector("[aria-label=继续发送队列]")!==null'));
      await button('继续发送队列'); await input('后续草稿必须保留');
      await switchChat('other-chat'); assert.equal(await page.evaluate('document.querySelector(".conversation-queue")'), null);
      await submit('独立聊天验收'); await settled(); release('HOLD:FIFO');
      await wait(async () => { const chat = await saved('queue-chat'); return chat?.messages.length === 6 && !chat.queuedMessages?.length && !chat.messages.at(-1).cancelled; }, 'Background queue finished');
      const chat = await saved('queue-chat'), other = await saved('other-chat');
      assert.deepEqual(chat.messages.filter(item => item.role === 'user').map(item => item.content), ['HOLD:FIFO', '队列第二条', '队列第一条已修改']);
      assert.equal(chat.draft, '后续草稿必须保留'); assert.equal(other.messages.length, 2);
      for (const request of report.requests.filter(item => item.prompt.startsWith('队列'))) assert.equal(json(request.history).includes('独立聊天验收'), false);
      assert.equal(json(report.requests.find(item => item.prompt === '独立聊天验收').history).includes('HOLD:FIFO'), false);
      await switchChat('queue-chat'); assert.equal(await page.evaluate(`document.querySelector(${json(promptSelector)}).value`), chat.draft); await input('');
      return { order: chat.messages.filter(item => item.role === 'user').map(item => item.content), draftRetained: true, backgroundCompleted: true, chatsIsolated: true };
    });
    await check('stop-pauses-pending-message-until-manual-resume', async () => {
      await submit('HOLD:STOP'); await waitHold('HOLD:STOP'); await enqueue('停止后待发送');
      await button('停止生成'); await settled(); const before = report.requests.length;
      await wait(async () => (await saved('queue-chat'))?.queuePaused === true, 'Stopped queue persisted');
      assert.equal(report.requests.length, before); assert.equal((await saved('queue-chat')).queuedMessages.length, 1);
      await button('继续发送队列'); await settled(); await wait(async () => !(await saved('queue-chat')).queuedMessages?.length, 'Manual queue consumed');
      assert.equal(report.requests.filter(item => item.prompt === '停止后待发送').length, 1);
      return { cancelled: true, pendingRetained: true, resumedOnce: true };
    });
    await check('model-failure-pauses-pending-message', async () => {
      await submit('HOLD:ERROR'); await waitHold('HOLD:ERROR'); await enqueue('错误后待发送'); release('HOLD:ERROR', true); await settled();
      await wait(async () => (await saved('queue-chat'))?.messages.at(-1).error, 'Failure persisted');
      assert.equal(report.requests.filter(item => item.prompt === '错误后待发送').length, 0);
      assert.equal((await saved('queue-chat')).queuedMessages.length, 1);
      await button('继续发送队列'); await settled(); await wait(async () => !(await saved('queue-chat')).queuedMessages?.length, 'Error queue resumed');
      return { errorVisible: true, pendingRetained: true, manualResume: true };
    });
    }
    if (scope === 'full' || scope === 'recovery') {
    await check('dispatched-queue-error-restores-item', async () => {
      await submit('HOLD:QUEUEERROR'); await waitHold('HOLD:QUEUEERROR'); await enqueue('派发后错误恢复'); release('HOLD:QUEUEERROR');
      await wait(() => report.requests.some(item => item.prompt === '派发后错误恢复'), 'Queued item dispatched after completion');
      await wait(async () => { const chat = await saved('queue-chat'); return chat?.queuedMessages?.[0]?.text === '派发后错误恢复' && chat.messages.at(-1)?.error; }, 'Failed dispatched item restored');
      assert.equal(report.requests.filter(item => item.prompt === '派发后错误恢复').length, 1);
      await button('继续发送队列'); await settled();
      await wait(async () => { const chat = await saved('queue-chat'); return !chat.queuedMessages?.length && chat.messages.at(-1)?.content?.includes('派发后错误恢复'); }, 'Restored error item resumed');
      assert.equal(report.requests.filter(item => item.prompt === '派发后错误恢复').length, 2);
      return { dispatched: true, errorRestoredToHead: true, manualResume: true, retriedOnce: true };
    });
    await check('dispatched-queue-cancel-restores-item', async () => {
      await submit('HOLD:QUEUECANCEL'); await waitHold('HOLD:QUEUECANCEL'); await enqueue('派发后取消恢复'); release('HOLD:QUEUECANCEL');
      await waitHold('QUEUE-CANCEL-ITEM'); await button('停止生成'); await settled();
      await wait(async () => { const chat = await saved('queue-chat'); return chat?.queuedMessages?.[0]?.text === '派发后取消恢复' && chat.messages.at(-1)?.cancelled; }, 'Cancelled dispatched item restored');
      await button('继续发送队列'); await settled();
      await wait(async () => { const chat = await saved('queue-chat'); return !chat.queuedMessages?.length && chat.messages.at(-1)?.content?.includes('派发后取消恢复'); }, 'Restored cancelled item resumed');
      assert.equal(report.requests.filter(item => item.prompt === '派发后取消恢复').length, 2);
      return { dispatched: true, cancelled: true, cancelRestoredToHead: true, manualResume: true };
    });
    }
    if (scope === 'full' || scope === 'remaining') {
    await check('restart-keeps-paused-queue-and-fork-excludes-it', async () => {
      if (scope === 'remaining') { await submit('重开前保留的已完成回答'); await settled(); }
      await submit('HOLD:RESTART'); await waitHold('HOLD:RESTART'); await enqueue('重开后待发送'); await input('重开保留草稿');
      await wait(async () => (await saved('queue-chat'))?.queuedMessages?.length === 1 && (await saved('queue-chat')).draft === '重开保留草稿', 'Queue durable before restart');
      await interruptTestProcess(); const before = report.requests.length; await launch();
      assert.equal(report.requests.length, before); await settled();
      assert.equal((await saved('queue-chat')).queuePaused, true); assert.ok(await page.evaluate('Boolean(document.querySelector("[aria-label=继续发送队列]"))'));
      await click('[aria-label="从此回答分支到新聊天"]');
      const forkId = await wait(() => page.evaluate('document.querySelector("[data-chat-id][aria-current=true]")?.dataset.chatId!=="queue-chat"&&document.querySelector("[data-chat-id][aria-current=true]")?.dataset.chatId'), 'Fork active');
      await wait(async () => Boolean(await saved(forkId)), 'Fork persisted');
      assert.equal((await saved(forkId)).queuedMessages, undefined); assert.equal((await saved('queue-chat')).queuedMessages.length, 1);
      await switchChat('queue-chat'); await button('继续发送队列'); await settled();
      await wait(async () => !(await saved('queue-chat')).queuedMessages?.length, 'Reopened queue resumed');
      assert.equal((await saved('queue-chat')).draft, '重开保留草稿'); await input('');
      return { processRestarted: true, noAutomaticRequest: true, forkId, sourcePendingRetained: true, manualResume: true, draftRetained: true };
    });
    await check('project-scope-change-refuses-queued-execution', async () => {
      await switchChat('scope-chat'); const before = report.requests.length; await button('继续发送队列');
      await wait(() => page.evaluate('document.body.innerText.includes("工作项目已变化")'), 'Project mismatch notice');
      assert.equal(report.requests.length, before); assert.equal((await saved('scope-chat')).queuedMessages.length, 1);
      return { wrongProjectRefused: true, messageRetained: true, requestsAdded: 0 };
    });
    }
    if (['full', 'remaining', 'final'].includes(scope)) {
    await check('existing-live-steering-and-new-queue-share-history', async () => {
      await switchChat('other-chat'); await submit('HOLD:STEER'); await waitHold('HOLD:STEER'); await enqueue('引导后排队消息');
      await input('运行中补充验收'); await button('提交引导但不中断模型运行');
      await wait(() => page.evaluate('Boolean(document.querySelector(".steering-message-status[data-state=queued]"))'), 'Steering queued');
      release('HOLD:STEER'); await wait(async () => (await saved('other-chat'))?.messages.at(-1)?.content.includes('引导后排队消息'), 'Queue after live steering');
      const request = report.requests.find(item => item.prompt === '引导后排队消息');
      assert.ok(json(request.history).includes('运行中补充验收'));
      assert.equal((await saved('other-chat')).messages.find(item => item.steering)?.steering.status, 'accepted'); await settled();
      return { steeringPreserved: true, queuedRoundUsesSteeredHistory: true };
    });
    await check('plan-read-only-draft-guard-and-current-model-execution', async () => {
      await switchChat('plan-chat'); await button('添加工具和上下文'); await textButton('.composer-menu-item', '计划模式');
      await submit('先规划写入验收文件'); await settled();
      await wait(async () => (await saved('plan-chat'))?.messages.length === 2, 'Plan saved');
      const originalPlan = (await saved('plan-chat')).messages[1].content;
      assert.equal(await fs.access(path.join(workspace, 'plan-result.txt')).then(() => true, () => false), false);
      const before = report.requests.length;
      await input('不应被覆盖的草稿'); await button('按此计划执行');
      await wait(() => page.evaluate('document.body.innerText.includes("请先处理当前草稿或附件")'), 'Draft guard');
      assert.equal(report.requests.length, before); assert.equal(await page.evaluate(`document.querySelector(${json(promptSelector)}).value`), '不应被覆盖的草稿');
      await input(''); await button('更改权限'); await textButton('.permission-option', '仅对话');
      await wait(() => page.evaluate('document.querySelector("[aria-label=按此计划执行]")?.disabled'), 'Plan execution permission guard');
      await button('更改权限'); await textButton('.permission-option', '完全访问');
      await select('[aria-label="选择模型模式"]', 'subagent'); await button('按此计划执行'); await settled();
      await wait(async () => (await saved('plan-chat'))?.messages.length === 4 && (await saved('plan-chat')).messages.at(-1).content.includes('已按计划'), 'Execution persisted');
      const chat = await saved('plan-chat');
      assert.equal(chat.messages[1].content, originalPlan); assert.equal(chat.messages[2].mode, 'code'); assert.equal(chat.messages[2].modelMode, 'subagent');
      assert.equal(await fs.readFile(path.join(workspace, 'plan-result.txt'), 'utf8'), '计划执行成功\n');
      assert.deepEqual(chat.messages[3].operations.filter(item => item.status === 'succeeded').map(item => item.name), ['write_file', 'read_file']);
      assert.equal(await page.evaluate('Boolean(document.querySelector("[aria-label=按此计划执行]"))'), false);
      report.planFileSha256 = crypto.createHash('sha256').update(await fs.readFile(path.join(workspace, 'plan-result.txt'))).digest('hex');
      return { planReadOnly: true, draftGuard: true, permissionGuard: true, sameChat: chat.id, selectedModel: chat.messages[2].model, planRetained: true, actualWriteAndRead: true };
    });
    }
    if (!['storage', 'recovery'].includes(scope)) {
    await check('queue-layout-narrow-desktop-large-font-and-keyboard', async () => {
      await switchChat('plan-chat');
      await submit('HOLD:LAYOUT'); await waitHold('HOLD:LAYOUT');
      await enqueue('需要保留的后续工作：' + '核对当前项目和已有结果'.repeat(16)); await enqueue('第二项工作等待手动继续。');
      await button('暂停发送队列'); release('HOLD:LAYOUT'); await settled();
      if (scope !== 'layout') await page.evaluate('window.scodex.savePreferences({fontSize:20})');
      await wait(async () => (await saved('plan-chat'))?.queuedMessages?.length === 2, 'Layout queue persisted');
      await quit(); await launch();
      const layouts = [];
      for (const [width, height] of [[600, 780], [1064, 660], [1280, 780]]) {
        await page.command('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
        const geometry = await page.evaluate(`(()=>{const box=document.querySelector('.composer-box'),q=document.querySelector('.conversation-queue');const r=q.getBoundingClientRect();const controls=[...box.querySelectorAll('.conversation-queue button,.composer-submit>select,.composer-submit>label,.composer-submit>button')].map(e=>{const b=e.getBoundingClientRect();return {name:e.getAttribute('aria-label')||e.textContent.trim(),x:b.x,y:b.y,width:b.width,height:b.height,right:b.right,bottom:b.bottom}});return {viewport:innerWidth,queue:{x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom},font:parseFloat(getComputedStyle(q).fontSize),overflow:document.documentElement.scrollWidth>innerWidth,controls}})()`);
        assert.ok(geometry.queue.width > 0 && geometry.queue.height > 0); assert.equal(geometry.overflow, false); assert.ok(geometry.font >= 17);
        assert.ok(geometry.queue.right <= width && geometry.queue.bottom <= height);
        for (const control of geometry.controls) assert.ok(control.width > 0 && control.height > 0 && control.x >= 0 && control.right <= width + 1 && control.bottom <= height, json(control));
        for (const [index, control] of geometry.controls.entries()) for (const other of geometry.controls.slice(index + 1)) assert.ok(Math.min(control.right, other.right) - Math.max(control.x, other.x) <= 1 || Math.min(control.bottom, other.bottom) - Math.max(control.y, other.y) <= 1, 'Controls overlap: ' + json([control, other]));
        layouts.push(geometry);
      }
      report.layoutMetrics = layouts; await persist();
      await button('编辑待发送消息 1'); await input('键盘保存后的消息', '[aria-label="编辑待发送消息"]');
      await page.evaluate('document.querySelector("[aria-label=保存待发送消息]").focus()');
      report.keyboardFocus = await page.evaluate('({label:document.activeElement?.getAttribute("aria-label"),disabled:document.activeElement?.disabled,value:document.querySelector("[aria-label=编辑待发送消息]")?.value})'); await persist();
      assert.equal(report.keyboardFocus.label, '保存待发送消息'); assert.equal(report.keyboardFocus.disabled, false);
      await page.command('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', text: '\r', unmodifiedText: '\r', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 });
      await page.command('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 });
      await wait(() => page.evaluate('document.querySelector(".conversation-queue-text")?.textContent==="键盘保存后的消息"'), 'Keyboard saves queue edit');
      const shot = await page.command('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }); report.screenshot = path.join(output, 'conversation-workflow-final.png'); await fs.writeFile(report.screenshot, Buffer.from(shot.data, 'base64'));
      return { layouts, keyboardSave: true, screenshot: report.screenshot };
    });
    }
    if (scope === 'storage') await check('queued-history-save-with-preference-update-and-reopen', async () => {
      await switchChat('plan-chat'); await submit('HOLD:STORAGE'); await waitHold('HOLD:STORAGE');
      const first = '需要保留的后续工作：' + '核对当前项目和已有结果'.repeat(16);
      await enqueue(first); await enqueue('第二项工作等待手动继续。');
      await button('暂停发送队列'); release('HOLD:STORAGE'); await settled();
      await page.evaluate('window.scodex.savePreferences({fontSize:20})');
      await wait(async () => (await saved('plan-chat'))?.queuedMessages?.length === 2, 'Queued messages saved with preference update');
      const notices = await page.evaluate('window.__workflowNotices'); assert.equal(notices.some(text => /保存.*失败|写入.*失败|EPERM|EBUSY|ENOENT/i.test(text)), false, json(notices));
      await quit(); const before = report.requests.length; await launch();
      assert.equal(report.requests.length, before); assert.equal((await saved('plan-chat')).queuePaused, true);
      await button('继续发送队列'); await settled();
      await wait(async () => { const chat = await saved('plan-chat'); return !chat.queuedMessages?.length && chat.messages.length === 6 && !chat.messages.at(-1).cancelled; }, 'Queue resumes after preference update');
      assert.deepEqual((await saved('plan-chat')).messages.filter(item => item.role === 'user').map(item => item.content), ['HOLD:STORAGE', first, '第二项工作等待手动继续。']);
      return { preferenceSaved: true, queuedMessagesPersisted: 2, processRestarted: true, noAutomaticRequest: true, resumedInOrder: true, notices };
    });
    if (scope === 'full' || scope === 'recovery') await check('queue-capacity-reserves-active-item-and-persists-recovery', async () => {
      await switchChat('other-chat'); await submit('HOLD:CAPSTART'); await waitHold('HOLD:CAPSTART');
      await enqueue('HOLD:CAPACTIVE'); release('HOLD:CAPSTART'); await waitHold('HOLD:CAPACTIVE');
      const pending = Array.from({ length: 19 }, (_, index) => '容量待发送-' + (index + 1));
      for (const text of pending) await enqueue(text);
      await input('满额时保留的草稿'); await button('加入待发送队列');
      await wait(() => page.evaluate('document.querySelector(".toast")?.innerText.includes("最多保留20条")'), 'Active queue item reserves recovery capacity');
      assert.equal(await page.evaluate(`document.querySelector(${json(promptSelector)}).value`), '满额时保留的草稿');
      assert.equal(await page.evaluate('document.querySelectorAll(".conversation-queue-text").length'), 19);
      release('HOLD:CAPACTIVE', true); await settled();
      const expected = ['HOLD:CAPACTIVE', ...pending];
      await wait(async () => { const chat = await saved('other-chat'); return chat.queuePaused && chat.queuedMessages?.length === 20 && Boolean(chat.messages.at(-1)?.error); }, 'All twenty queue items restored and saved');
      assert.deepEqual((await saved('other-chat')).queuedMessages.map(item => item.text), expected);
      const before = report.requests.length; await quit(); await launch(); await switchChat('other-chat');
      const reopened = await saved('other-chat');
      assert.equal(report.requests.length, before); assert.equal(reopened.queuePaused, true);
      assert.equal(reopened.draft, '满额时保留的草稿');
      assert.deepEqual(reopened.queuedMessages.map(item => item.text), expected);
      await page.command('Emulation.setDeviceMetricsOverride', { width: 1280, height: 780, deviceScaleFactor: 1, mobile: false });
      const shot = await page.command('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
      report.screenshot = path.join(output, 'queue-recovery-final.png'); await fs.writeFile(report.screenshot, Buffer.from(shot.data, 'base64'));
      return { overCapacityRefused: true, draftRetained: true, recovered: 20, tailRetained: true, restartedPaused: true, requestsAddedOnRestart: 0 };
    });
    if (report.fixtureError) throw Error(report.fixtureError);
    report.status = 'passed';
  } catch (error) {
    report.status = 'failed'; report.failedStage = stage; report.error = error.stack; process.exitCode = 1; console.error(error);
    if (page) report.failureState = await page.evaluate('({text:document.body.innerText.slice(-7000),active:document.querySelector("[data-chat-id][aria-current=true]")?.dataset.chatId,notices:window.__workflowNotices,focus:document.activeElement?.outerHTML})').catch(() => null);
    report.failureLibrary = await fs.readFile(path.join(profile, 'conversations.json'), 'utf8').then(JSON.parse).catch(() => null);
  } finally {
    try {
      if (page && app && !exited()) {
        await page.evaluate('window.scodex.onChatEvent(()=>{});document.querySelector("[aria-label=停止生成]")?.click()');
        for (const [token, res] of holds) { holds.delete(token); if (!res.destroyed) finishModel(res, { content: '测试结束 ' + token }); }
        await settled();
      }
      await quit(); report.processExited = true;
    } catch (error) { report.status = 'failed'; report.exitError = error.message; process.exitCode = 1; if (app && !exited()) { await interruptTestProcess(); report.processExited = true; report.cleanupForced = true; } else if (exited()) report.processExited = true; }
    server?.closeAllConnections(); if (server) await new Promise(resolve => server.close(resolve));
    if (report.processExited) {
      assert.equal(path.dirname(path.resolve(fixture)).toLowerCase(), tempRoot.toLowerCase());
      try { await fs.rm(fixture, { recursive: true }); report.cleanup = 'passed'; } catch (error) { report.cleanup = 'failed'; report.cleanupError = error.message; }
    }
    report.completedAt = new Date().toISOString(); await persist(); console.log(json({ status: report.status, checks: report.checks.length, failedStage: report.failedStage, cleanup: report.cleanup }));
  }
}
main();
