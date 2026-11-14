// Real packaged Electron UI/IPC/storage; only model HTTP responses use a loopback fixture.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const http = require('node:http');
const { spawn } = require('node:child_process');
const { connect, wait, freePort } = require('./agent-workflow-ui.cjs');
const root = path.resolve(__dirname, '..'), version = '1.3.64';
const scope = process.env.SCODEX_COMPACTION_SCOPE || 'all';
if (!['all', 'context', 'layout', 'remaining', 'failure-retry'].includes(scope)) throw Error('Unknown scope');
const executable = path.resolve(process.env.SCODEX_COMPACTION_EXE || path.join(root, `release/Scodex-Workbench-${version}/win-unpacked/Scodex工作台.exe`));
const output = path.resolve(process.env.SCODEX_COMPACTION_OUTPUT || path.join(root, `release/codex-alignment-${version}/candidate-ui`));
const tempRoot = path.resolve(process.env.SystemRoot || 'C:\\Windows', 'Temp');
const fixture = path.join(tempRoot, 'scodex-context-' + crypto.randomUUID());
const profile = path.join(fixture, 'profile'), home = path.join(fixture, 'home'), workspace = path.join(fixture, 'project');
const json = JSON.stringify, promptSelector = '[aria-label="输入工作内容"]';
const report = { status: 'running', version, executable, scope, fixture, checks: [], requests: [], limitations: ['Model HTTP responses/credentials are deterministic loopback fixtures. EXE, renderer, IPC, encrypted settings, history and restart are real. Public provider summary quality and Codex remote compaction are not tested.'] };
const bodies = [], holds = new Set(), keys = { main: 'context-main-fixture', subagent: 'context-two-fixture', advisor: 'context-three-fixture' };
const summary = '目标：完成工作流。路径 D:/project/core.js。已确认错误 E123；保留用户修改及队列20条上限。已有验证通过，公网尚未验证。下一步：核对最新文件后继续当前需求，不重复已成功命令。';
let app, page, socket, server, base, stage = 'setup', failSummary = true;
async function persist() { await fs.writeFile(path.join(output, 'context-compaction-ui.json'), json(report, null, 2) + '\n'); }
async function check(name, fn) { stage = name; const evidence = await fn(); report.checks.push({ name, status: 'passed', evidence }); await persist(); console.log('PASS ' + name); }
async function click(selector) { await wait(() => page.evaluate(`(()=>{const e=document.querySelector(${json(selector)});if(!e||e.disabled||!e.getBoundingClientRect().width)return false;e.scrollIntoView({block:'nearest'});e.click();return true})()`), 'Clickable ' + selector); }
async function textClick(selector, text) { await wait(() => page.evaluate(`(()=>{const e=[...document.querySelectorAll(${json(selector)})].find(e=>e.textContent.trim()===${json(text)}&&e.getBoundingClientRect().width);if(!e||e.disabled)return false;e.scrollIntoView({block:'nearest'});e.click();return true})()`), 'Button ' + text); }
async function input(selector, text) { await page.evaluate(`(()=>{const e=document.querySelector(${json(selector)});if(!e||e.disabled)throw Error('Input unavailable');e.focus();Object.getOwnPropertyDescriptor(e instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,'value').set.call(e,${json(text)});e.dispatchEvent(new Event('input',{bubbles:true}));})()`); }
async function saved(id) { return JSON.parse(await fs.readFile(path.join(profile, 'conversations.json'), 'utf8')).conversations.find(chat => chat.id === id); }
async function switchChat(id) { await click('[data-chat-id=' + json(id) + ']'); await wait(() => page.evaluate(`document.querySelector('[data-chat-id=${json(id)}][aria-current=true]')!==null`), 'Selected chat ' + id); }
async function events() { return page.evaluate('window.__contextEvents'); }
async function settled(count, expected = 'complete') {
  const event = await wait(async () => (await events()).slice(count).find(event => ['complete', 'error', 'cancelled'].includes(event.type)), 'Request terminal event', 45000);
  assert.equal(event.type, expected, json(event));
  await wait(() => page.evaluate('!document.querySelector("[aria-label=停止生成]")'), 'Request settled');
  return event;
}
async function send(text, expected = 'complete') { const count = (await events()).length; await input(promptSelector, text); await click('[aria-label="发送消息"]'); return settled(count, expected); }
async function launch() {
  const port = await freePort();
  app = spawn(executable, ['--remote-debugging-port=' + port, '--user-data-dir=' + profile, '--disable-gpu'], { cwd: path.dirname(executable), windowsHide: true, stdio: 'ignore',
    env: { ...process.env, SCODEX_HOME: home, SCODEX_REFERENCE_HOME: path.join(fixture, 'reference'), SCODEX_REFERENCE_AGENTS_HOME: path.join(fixture, 'agents'), APPDATA: path.join(fixture, 'appdata'), LOCALAPPDATA: path.join(fixture, 'localappdata') } });
  const target = await wait(async () => { if (app.exitCode !== null) throw Error('App exited: ' + app.exitCode); return (await fetch(`http://127.0.0.1:${port}/json/list`).then(r => r.json())).find(t => t.type === 'page' && t.url.startsWith('file:')); }, 'Packaged app startup', 45000);
  socket = new WebSocket(target.webSocketDebuggerUrl); await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); }); page = connect(socket);
  await wait(() => page.evaluate('Boolean(document.querySelector(".composer-model-mode"))'), 'Renderer ready');
  const identity = await page.evaluate('window.scodex.getAppState().then(s=>({version:s.version,userDataPath:s.userDataPath,workspaceRoot:s.workspaceRoot}))');
  assert.equal(identity.version, version); assert.equal(path.resolve(identity.userDataPath), profile); assert.equal(path.resolve(identity.workspaceRoot), workspace);
  await page.evaluate('window.__contextEvents=[];window.scodex.onChatEvent(e=>window.__contextEvents.push(e))');
  return identity;
}
async function quit() { if (page && app?.exitCode === null) await page.evaluate('window.scodex.quitApp()'); if (app) await wait(() => Promise.resolve(app.exitCode !== null), 'App exit', 20000); socket?.close(); page = socket = null; }
function respond(res, content) { res.writeHead(200, { 'content-type': 'text/event-stream' }); res.end('data: ' + json({ choices: [{ delta: { content }, finish_reason: 'stop' }] }) + '\n\ndata: [DONE]\n\n'); }
async function setup() {
  await fs.mkdir(output, { recursive: true });
  for (const dir of [profile, home, workspace, path.join(fixture, 'appdata'), path.join(fixture, 'localappdata')]) await fs.mkdir(dir, { recursive: true });
  const now = new Date().toISOString();
  const chats = ['auto', 'manual', 'fail', 'cancel'].map(kind => ({ id: kind + '-chat', title: kind + '上下文验收', projectId: 'context-project', createdAt: now, updatedAt: now, mode: 'answer', modelMode: 'main',
    messages: Array.from({ length: kind === 'auto' ? 16 : 8 }, (_, index) => ({ id: kind + '-' + index, role: index % 2 ? 'assistant' : 'user',
      content: `${kind}-${index}：路径 D:/project/core.js；错误 E123；${kind === 'fail' ? 'FAIL_SUMMARY' : kind === 'cancel' ? 'HOLD_SUMMARY' : '保留队列20条上限'}\n` + '历史资料需要继续核对。'.repeat(kind === 'auto' ? 110 : 40), model: 'context-main', modelMode: 'main', executionEnabled: false })) }));
  await fs.writeFile(path.join(profile, 'settings.json'), json({ workspaceRoot: workspace, projects: [{ id: 'context-project', name: '上下文隔离验收', path: workspace }], activeProjectId: 'context-project', preferences: { contextAccess: 'chat-only', trayEnabled: false, closeConfirmation: 'never', browserPanelOpen: false } }));
  await fs.writeFile(path.join(profile, 'conversations.json'), json({ version: 2, activeId: 'auto-chat', conversations: chats }));
  await fs.writeFile(path.join(home, 'codex-settings.json'), json({ sandboxMode: 'read-only', approvalPolicy: 'never', networkAccess: true, networkDomains: ['127.0.0.1'], workspaceDependencies: false }));
  server = http.createServer(async (req, res) => {
    try {
      const role = req.url.includes('/two/') ? 'subagent' : req.url.includes('/three/') ? 'advisor' : 'main';
      if (req.method === 'GET' && req.url.endsWith('/models')) { res.writeHead(200, { 'content-type': 'application/json' }); res.end(json({ data: [{ id: 'context-main' }, { id: 'context-fast' }] })); return; }
      let raw = ''; for await (const part of req) raw += part;
      const body = JSON.parse(raw), text = json(body.messages), isSummary = String(body.messages[0]?.content).includes('你负责为同一任务生成紧凑的交接摘要');
      const credentialMatched = req.headers.authorization === 'Bearer ' + keys[role];
      const request = { kind: isSummary ? 'summary' : 'task', model: body.model, role, credentialMatched, toolCount: body.tools?.length || 0, hasSummary: text.includes('此前对话的压缩摘要'), hasRawAutoStart: text.includes('auto-0：'), hasRawManualStart: text.includes('manual-0：'), prompt: String(body.messages.at(-1)?.content).slice(0, 180) };
      report.requests.push(request); bodies.push(body);
      assert.equal(credentialMatched, true); assert.equal(request.toolCount, 0);
      if (isSummary && failSummary && text.includes('FAIL_SUMMARY')) { res.writeHead(500, { 'content-type': 'application/json' }); res.end(json({ error: { message: 'Controlled summary failure' } })); return; }
      if (isSummary && text.includes('HOLD_SUMMARY')) { holds.add(res); res.on('close', () => holds.delete(res)); return; }
      respond(res, isSummary ? summary : '已接续当前需求，并保留已有工作。');
    } catch (error) { report.fixtureError = error.stack; if (!res.headersSent) res.writeHead(500); res.end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); base = 'http://127.0.0.1:' + server.address().port;
}
async function configure() {
  await page.evaluate('window.scodex.saveModelConnection(' + json({ name: '模型与上下文验收', note: '原备注', baseUrl: base + '/v1', apiKey: keys.main, models: ['context-main', 'context-fast'], model: 'context-main', contextWindowTokens: 12000,
    subagentBaseUrl: base + '/two/v1', subagentApiKey: keys.subagent, subagentModel: 'context-two', subagentModels: ['context-two'], subagentContextWindowTokens: 12000,
    advisorBaseUrl: base + '/three/v1', advisorApiKey: keys.advisor, advisorModel: 'context-three', advisorModels: ['context-three'], advisorContextWindowTokens: 12000, advisorEnabled: false, toolProtocol: 'native', retryLimit: 0 }) + ')');
  await quit(); await launch();
}
async function contextChecks() {
  if (!['remaining', 'failure-retry'].includes(scope)) {
  await check('automatic-summary-keeps-current-request-and-full-chat', async () => {
    const original = (await saved('auto-chat')).messages;
    await send('自动压缩后继续：保持当前需求原文。');
    await wait(async () => (await saved('auto-chat')).messages.at(-1)?.contextCheckpoint, 'Checkpoint saved');
    const chat = await saved('auto-chat'), checkpoint = chat.messages.at(-1).contextCheckpoint;
    assert.deepEqual(chat.messages.slice(0, 16), original); assert.equal(chat.messages.length, 18);
    assert.equal(checkpoint.throughId, 'auto-13'); assert.equal(checkpoint.summary, summary);
    assert.ok(report.requests.some(req => req.kind === 'summary'));
    const task = report.requests.at(-1); assert.equal(task.hasSummary, true); assert.equal(task.hasRawAutoStart, false); assert.equal(task.prompt, '自动压缩后继续：保持当前需求原文。');
    assert.ok((await events()).some(event => event.type === 'context-compacted' && event.mode === 'auto'));
    return { throughId: checkpoint.throughId, retainedMessages: 18, summaryRequests: report.requests.filter(req => req.kind === 'summary').length, currentInputIntact: true };
  });
  await check('restart-restores-summary-and-does-not-replay-covered-history', async () => {
    const before = (await saved('auto-chat')).messages.at(-1).contextCheckpoint, count = report.requests.length;
    await quit(); await launch(); await switchChat('auto-chat'); assert.equal(report.requests.length, count);
    assert.deepEqual((await saved('auto-chat')).messages.at(-1).contextCheckpoint, before);
    await send('重开后继续同一任务'); assert.equal(report.requests.length, count + 1); assert.equal(report.requests.at(-1).hasSummary, true); assert.equal(report.requests.at(-1).hasRawAutoStart, false);
    assert.match(await page.evaluate('document.querySelector(".conversation-context").innerText'), /上下文约.*tokens|上下文约.*%/);
    return { checkpointRestored: true, restartRequests: 0, followupRequests: 1, contextEstimateVisible: true };
  });
  }
  if (scope !== 'failure-retry') {
  await check('manual-compact-preserves-draft-and-reuses-summary', async () => {
    await switchChat('manual-chat'); const original = (await saved('manual-chat')).messages;
    await input(promptSelector, '尚未发送的用户草稿'); const count = (await events()).length;
    await textClick('.conversation-context button', '压缩上下文'); await settled(count);
    await wait(async () => (await saved('manual-chat')).messages.at(-1)?.contextCheckpoint, 'Manual checkpoint saved');
    assert.equal(await page.evaluate(`document.querySelector(${json(promptSelector)}).value`), '尚未发送的用户草稿');
    const chat = await saved('manual-chat'); assert.deepEqual(chat.messages.slice(0, 8), original); assert.equal(chat.messages.at(-1).contextCheckpoint.throughId, 'manual-7');
    const start = report.requests.length; await send('手动压缩后继续'); assert.equal(report.requests.length, start + 1); assert.equal(report.requests.at(-1).hasSummary, true); assert.equal(report.requests.at(-1).hasRawManualStart, false);
    return { manualButton: true, fullHistoryRetained: true, draftRetained: true, nextRequestUsesSummary: true };
  });
  await check('editing-covered-message-creates-version-without-stale-summary', async () => {
    const original = await saved('manual-chat');
    await click('[data-message-id="manual-6"] [aria-label="编辑此消息"]');
    await wait(() => page.evaluate('Boolean(document.querySelector(".user-message-inline-editor"))'), 'Inline revision editor');
    await input('[aria-label="在原消息内编辑"]', '用户已纠正目标：保持新的需求'); const count = (await events()).length;
    await textClick('.user-message-inline-buttons button', '保存为新版本并发送'); await settled(count);
    await wait(async () => (await saved('manual-chat')).messages.at(-2)?.content === '用户已纠正目标：保持新的需求', 'Edited version saved');
    const chat = await saved('manual-chat'); assert.notEqual(chat.revisionId, original.revisionId); assert.equal(report.requests.at(-1).hasSummary, false); assert.equal(report.requests.at(-1).hasRawManualStart, true);
    assert.ok(chat.revisions.some(revision => revision.messages.some(message => message.contextCheckpoint)));
    return { newVersion: chat.revisionId, staleSummaryNotSent: true, originalVersionAndSummaryRetained: true };
  });
  }
  await check('slash-compact-failure-and-cancellation-preserve-original-history', async () => {
    await switchChat('fail-chat'); const original = (await saved('fail-chat')).messages;
    await send('/compact', 'error'); await wait(async () => Boolean((await saved('fail-chat')).messages.at(-1)?.error), 'Failed summary saved');
    const failed = await saved('fail-chat'); assert.deepEqual(failed.messages.slice(0, 8), original); assert.ok(failed.messages.every(message => !message.contextCheckpoint));
    failSummary = false; const retryCount = (await events()).length;
    await click('.retry-message'); await settled(retryCount);
    await wait(async () => (await saved('fail-chat')).messages.at(-1)?.contextCheckpoint, 'Retried summary saved');
    const retried = await saved('fail-chat'); assert.deepEqual(retried.messages.slice(0, 8), original); assert.equal(retried.messages.at(-1).contextAction, true); assert.equal(retried.messages.at(-1).contextCheckpoint.throughId, 'fail-7');
    assert.equal(report.requests.at(-1).kind, 'summary');
    await send('摘要失败恢复后继续普通请求'); assert.equal(report.requests.at(-1).kind, 'task'); assert.equal(report.requests.at(-1).hasSummary, true);
    await switchChat('cancel-chat'); const before = (await saved('cancel-chat')).messages, count = (await events()).length;
    await input(promptSelector, '/compact'); await click('[aria-label="发送消息"]'); await wait(async () => holds.size > 0, 'Held summary request');
    await click('[aria-label="停止生成"]'); await settled(count, 'cancelled');
    await wait(async () => (await saved('cancel-chat')).messages.at(-1)?.cancelled, 'Cancelled summary saved');
    const cancelled = await saved('cancel-chat'); assert.deepEqual(cancelled.messages.slice(0, 8), before); assert.ok(cancelled.messages.every(message => !message.contextCheckpoint));
    return { slashCommand: true, failureOriginalKept: true, actualRetrySummarizedHistory: true, failureFollowupSucceeded: true, cancellationOriginalKept: true, noCheckpointWrittenOnFailureOrCancellation: true };
  });
}
async function layoutChecks() {
  await check('model-tabs-preserve-drafts-and-save-roles-independently', async () => {
    await click('[aria-label="模型与连接"]');
    await wait(() => page.evaluate('Boolean(document.querySelector(".model-config-tabs"))'), 'Model config ready');
    assert.deepEqual(await page.evaluate('[...document.querySelectorAll(".model-config-tabs [role=tab]")].map(e=>e.textContent)'), ['模型一', '模型二', '模型三', '通用设置', '用量与诊断']);
    await textClick('.model-config-details > summary', '服务信息'); await input('#model-service-note', '模型一尚未保存的备注');
    await textClick('.model-config-tabs button', '模型二'); await input('#model-subagent-api-key', 'new-two-fixture');
    await textClick('.model-key-input button', '保存模型二'); keys.subagent = 'new-two-fixture';
    await wait(() => page.evaluate('document.querySelector(".model-message")?.textContent.includes("模型二配置和密钥已单独保存")'), 'Model two saved');
    assert.equal(await page.evaluate('window.scodex.getModelConnection().then(c=>c.note)'), '原备注');
    await textClick('.model-config-tabs button', '模型三'); await input('#model-advisor-api-key', 'new-three-fixture');
    await textClick('.model-config-tabs button', '模型一'); assert.equal(await page.evaluate('document.querySelector("#model-service-note").value'), '模型一尚未保存的备注');
    await textClick('.model-key-input button', '保存模型一');
    await wait(() => page.evaluate('document.querySelector(".model-message")?.textContent.includes("模型一配置和密钥已单独保存")'), 'Model one saved');
    await textClick('.model-config-tabs button', '模型三'); assert.equal(await page.evaluate('document.querySelector("#model-advisor-api-key").value'), 'new-three-fixture');
    await textClick('.model-key-input button', '保存模型三'); keys.advisor = 'new-three-fixture';
    await wait(() => page.evaluate('document.querySelector(".model-message")?.textContent.includes("模型三配置和密钥已单独保存")'), 'Model three saved');
    await textClick('.model-config-tabs button', '通用设置'); await input('#model-image', 'optional-image-fixture');
    await textClick('.model-form-footer button', '保存配置');
    await wait(() => page.evaluate('window.scodex.getModelConnection().then(c=>c.imageModel==="optional-image-fixture")'), 'All config saved');
    await page.evaluate('document.querySelector(".model-config-tabs [aria-selected=true]").focus()');
    for (const type of ['keyDown', 'keyUp']) await page.command('Input.dispatchKeyEvent', { type, key: 'End', code: 'End', windowsVirtualKeyCode: 35 });
    assert.equal(await page.evaluate('document.querySelector(".model-config-tabs [aria-selected=true]").textContent'), '用量与诊断');
    assert.equal(await page.evaluate('[...document.querySelectorAll(".model-config-panel")].filter(e=>!e.hidden).length'), 1);
    await click('[aria-label="关闭模型与连接"]');
    for (const role of ['subagent', 'advisor']) {
      await page.evaluate(`(()=>{const e=document.querySelector('[aria-label="选择模型模式"]');Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(e,${json(role)});e.dispatchEvent(new Event('change',{bubbles:true}));})()`);
      await send('验证独立凭据 ' + role); assert.equal(report.requests.at(-1).role, role); assert.equal(report.requests.at(-1).credentialMatched, true);
    }
    return { categories: 5, draftRetainedAcrossTabs: true, independentSaves: 3, allConfigSaved: true, keyboardTabs: true, actualNewCredentialsUsed: ['subagent', 'advisor'] };
  });
  await check('model-layout-narrow-desktop-and-final-view', async () => {
    await click('[aria-label="模型与连接"]'); const geometry = [];
    for (const width of [600, 1280]) {
      await page.command('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: false });
      for (const label of ['模型一', '模型二', '模型三', '通用设置', '用量与诊断']) {
        await textClick('.model-config-tabs button', label); await page.evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
        const state = await page.evaluate('(()=>{const d=document.querySelector(".model-connection-dialog"),b=d.getBoundingClientRect();const controls=[...d.querySelectorAll("input,select,button")].filter(e=>e.getBoundingClientRect().width&&getComputedStyle(e).visibility!=="hidden").map(e=>{const r=e.getBoundingClientRect();return {label:e.getAttribute("aria-label")||e.id||e.textContent,left:r.left,right:r.right,top:r.top,bottom:r.bottom}});return {width:innerWidth,height:innerHeight,documentWidth:document.documentElement.scrollWidth,bodyWidth:d.querySelector(".model-dialog-body").clientWidth,bodyScroll:d.querySelector(".model-dialog-body").scrollWidth,left:b.left,right:b.right,controls}})()');
        assert.ok(state.documentWidth <= width + 1 && state.left >= 0 && state.right <= width + 1 && state.bodyScroll <= state.bodyWidth + 1, json(state));
        for (const control of state.controls) assert.ok(control.left >= state.left && control.right <= state.right, json(control));
        const saveAll = state.controls.find(control => control.label === '保存配置');
        assert.ok(saveAll && saveAll.top > 0 && saveAll.bottom < state.height, json(saveAll));
        for (const field of ['model-api-key', 'model-subagent-api-key', 'model-advisor-api-key']) {
          const input = state.controls.find(c => c.label === field), save = state.controls.find(c => /^保存模型/.test(c.label));
          if (input && save) assert.ok(save.top >= input.bottom - 1 || save.left >= input.right - 1, json({ input, save }));
        }
        geometry.push({ width, tab: label, noHorizontalOverflow: true });
      }
    }
    await textClick('.model-config-tabs button', '模型一');
    await page.evaluate('document.querySelector(".model-dialog-body").scrollTop=0');
    const screenshot = await page.command('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    report.screenshot = path.join(output, 'model-connection-final.png'); await fs.writeFile(report.screenshot, Buffer.from(screenshot.data, 'base64'));
    await click('[aria-label="关闭模型与连接"]');
    return { geometry, saveButtonDoesNotOverlapKey: true, screenshot: report.screenshot };
  });
}
async function main() {
  try {
    await setup(); await check('packaged-exe-and-isolated-profile', launch); await configure();
    if (scope !== 'layout') await contextChecks();
    if (!['context', 'failure-retry'].includes(scope)) await layoutChecks();
    if (report.fixtureError) throw Error(report.fixtureError);
    report.status = 'passed';
  } catch (error) {
    report.status = 'failed'; report.failedStage = stage; report.error = error.stack; process.exitCode = 1; console.error(error);
    if (page) report.failureUI = await page.evaluate('({text:document.body.innerText.slice(-5500),dialog:document.querySelector("dialog[open]")?.innerText,focus:document.activeElement?.outerHTML})').catch(() => null);
  } finally {
    try {
      if (page && app?.exitCode === null) {
        await page.evaluate('document.querySelector("[aria-label=停止生成]")?.click()');
        for (const res of holds) res.destroy(); holds.clear();
        await wait(() => page.evaluate('!document.querySelector("[aria-label=停止生成]")'), 'Final request settled', 10000);
      }
      await quit(); report.processExited = true;
    } catch (error) { report.exitError = error.message; report.status = 'failed'; process.exitCode = 1; }
    server?.closeAllConnections(); if (server) await new Promise(resolve => server.close(resolve));
    if (report.processExited) {
      assert.equal(path.dirname(path.resolve(fixture)).toLowerCase(), tempRoot.toLowerCase());
      try { await fs.rm(fixture, { recursive: true }); report.cleanup = 'passed'; }
      catch (error) { report.cleanup = 'retained'; report.cleanupError = error.message; }
    }
    report.completedAt = new Date().toISOString(); await persist(); console.log(json({ status: report.status, checks: report.checks.length, failedStage: report.failedStage, cleanup: report.cleanup }));
  }
}
main();
