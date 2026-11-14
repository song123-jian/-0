// Exercise the packaged app and its real UI/IPC/storage; only the model HTTP service is local.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const http = require('node:http');
const { spawn, execFile } = require('node:child_process');
const { promisify } = require('node:util');
const execFileAsync = promisify(execFile);
const { connect, wait, freePort } = require('./agent-workflow-ui.cjs');
const root = path.resolve(__dirname, '..');
const version = process.env.SCODEX_MODES_VERSION || '1.3.58';
const scope = process.env.SCODEX_MODES_SCOPE || 'full';
if (!['full', 'shared-history-layout', 'same-address-layout', 'shortcut-smoke'].includes(scope)) throw Error('Unknown mode UI scope');
const shortcut = process.env.SCODEX_MODES_SHORTCUT ? path.resolve(process.env.SCODEX_MODES_SHORTCUT) : '';
const executable = path.resolve(process.env.SCODEX_MODES_EXE || path.join(root, `release/Scodex-Workbench-${version}/win-unpacked/Scodex工作台.exe`));
const output = path.resolve(process.env.SCODEX_MODES_OUTPUT || path.join(root, `release/composer-controls-${version}/ui`));
const tempRoot = path.resolve(process.env.SystemRoot || 'C:\\Windows', 'Temp');
const fixture = path.join(tempRoot, 'scodex-chat-modes-' + crypto.randomUUID());
const profile = path.join(fixture, 'profile'), home = path.join(fixture, 'home'), workspace = path.join(fixture, 'project');
const json = JSON.stringify, roles = ['main', 'subagent', 'advisor'];
const models = { main: ['glm-5.3', 'glm-5.3-fast'], subagent: ['model-two-a', 'model-two-b'], advisor: ['model-three-a', 'model-three-b'] };
const configuredModels = { main: [...models.main], subagent: [...models.subagent], advisor: [...models.advisor] };
if (scope === 'same-address-layout') {
  models.subagent = ['grok-4.6', 'grok-4.7'];
  configuredModels.main = [...models.main, 'grok-4.7'];
  configuredModels.subagent = [...models.subagent];
}
const keys = { main: 'mode-main-fixture', subagent: 'mode-two-fixture', advisor: 'mode-three-fixture' };
const selectors = { mode: '[aria-label="选择模型模式"]', model: '[aria-label="选择模型"]', prompt: '[aria-label="输入工作内容"]' };
const report = { status: 'running', version, scope, executable, shortcut, fixture, checks: [], requests: [], limitations: ['Model HTTP responses and credentials are loopback fixtures. The packaged app, UI, IPC, credential encryption and storage are real. No public model requests or user credentials are used.'] };
let app, socket, page, server, base, config, stage = 'setup', failedOnce = false;
const reportFile = path.join(output, 'composer-model-modes-ui.json');
async function persist() { await fs.writeFile(reportFile, json(report, null, 2) + '\n'); }
async function check(name, action) { stage = name; const evidence = await action(); report.checks.push({ name, status: 'passed', evidence }); await persist(); console.log('PASS ' + name); }
async function click(selector) {
  await wait(() => page.evaluate(`(()=>{const e=document.querySelector(${json(selector)});if(!e||e.disabled)return false;e.click();return true})()`), 'Clickable ' + selector);
}
async function switchChat(id) {
  const selector = `[data-chat-id="${id}"]`;
  await click(selector);
  await wait(() => page.evaluate(`document.querySelector(${json(selector)})?.getAttribute('aria-current')==='true'`), 'Chat active ' + id);
}
async function select(selector, value) {
  await page.evaluate(`(()=>{const e=document.querySelector(${json(selector)});if(!e||e.disabled)throw Error('Select unavailable');Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(e,${json(value)});e.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  await wait(() => page.evaluate(`document.querySelector(${json(selector)})?.value===${json(value)}`), 'Selection ' + value);
}
async function input(value) {
  await page.evaluate(`(()=>{const e=document.querySelector(${json(selectors.prompt)});Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(e,${json(value)});e.dispatchEvent(new Event('input',{bubbles:true}));})()`);
}
async function choices() { return page.evaluate('({mode:document.querySelector(".composer-model-mode").value,model:document.querySelector(".composer-model-button").value,models:[...document.querySelector(".composer-model-button").options].map(o=>o.value)})'); }
async function savedChat(id = 'legacy-chat') { return JSON.parse(await fs.readFile(path.join(profile, 'conversations.json'), 'utf8')).conversations.find(chat => chat.id === id); }
async function reload() {
  const origin = await page.evaluate('performance.timeOrigin'); await page.command('Page.reload');
  await wait(() => page.evaluate(`performance.timeOrigin!==${origin}&&Boolean(document.querySelector('.composer-model-mode'))`), 'Reloaded app');
}
async function launch() {
  const port = await freePort();
  const args = ['--remote-debugging-port=' + port, '--user-data-dir=' + profile, '--disable-gpu'];
  const env = { ...process.env, SCODEX_HOME: home, SCODEX_REFERENCE_HOME: path.join(fixture, 'reference'), SCODEX_REFERENCE_AGENTS_HOME: path.join(fixture, 'agents') };
  if (shortcut) {
    const quote = value => "'" + value.replace(/'/g, "''") + "'";
    const command = '$ErrorActionPreference="Stop"; $taskProcess=Start-Process -FilePath ' + quote(shortcut) + ' -ArgumentList ' + quote(args.map(value => '"' + value + '"').join(' ')) + ' -WindowStyle Hidden -PassThru; $taskProcess.Id';
    const result = await execFileAsync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command], { windowsHide: true, env: { ...env, APPDATA: path.join(fixture, 'appdata'), LOCALAPPDATA: path.join(fixture, 'localappdata') } });
    const pid = Number(result.stdout.trim()); if (!Number.isSafeInteger(pid) || pid <= 0) throw Error('Shortcut did not return its launched process');
    app = { pid, get exitCode() { try { process.kill(pid, 0); return null; } catch { return 0; } } };
  } else app = spawn(executable, args, { cwd: path.dirname(executable), windowsHide: true, stdio: 'ignore', env });
  const target = await wait(async () => { if (app.exitCode !== null) throw Error('App exited: ' + app.exitCode); return (await fetch(`http://127.0.0.1:${port}/json/list`).then(r => r.json())).find(t => t.type === 'page' && t.url.startsWith('file:')); }, 'Packaged app startup', 45000);
  socket = new WebSocket(target.webSocketDebuggerUrl); await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); }); page = connect(socket);
  await wait(() => page.evaluate('Boolean(document.querySelector(".composer-model-mode"))'), 'Composer ready');
  const identity = await page.evaluate('window.scodex.getAppState().then(s=>({version:s.version,userDataPath:s.userDataPath,workspaceRoot:s.workspaceRoot}))');
  assert.equal(identity.version, version); assert.equal(path.resolve(identity.userDataPath), profile); assert.equal(path.resolve(identity.workspaceRoot), workspace);
  await page.evaluate('window.__modeEvents=[];window.scodex.onChatEvent(e=>{if(["complete","error","cancelled"].includes(e.type))window.__modeEvents.push({type:e.type,requestId:e.requestId,error:e.error})})');
  return identity;
}
async function quit() {
  if (page && app?.exitCode === null) await page.evaluate('window.scodex.quitApp()');
  if (app) await wait(() => Promise.resolve(app.exitCode !== null), 'App exit', 20000);
  socket?.close(); socket = page = null;
}
async function send(text, terminal = 'complete') {
  const count = await page.evaluate('window.__modeEvents.length');
  await input(text); await click('[aria-label="发送消息"]');
  await wait(() => page.evaluate(`window.__modeEvents.length>${count}`), 'Request terminal');
  const event = await page.evaluate('window.__modeEvents.at(-1)'); assert.equal(event.type, terminal, json(event));
  await wait(() => page.evaluate('Boolean(document.querySelector("[aria-label=发送消息]"))'), 'Composer settled');
  return event;
}
async function layout(width) {
  await page.command('Emulation.setDeviceMetricsOverride', { width, height: 780, deviceScaleFactor: 1, mobile: false });
  const geometry = await page.evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>{const box=document.querySelector(".composer-box").getBoundingClientRect();r({width:innerWidth,documentWidth:document.documentElement.scrollWidth,box:{left:box.left,right:box.right},controls:[...document.querySelectorAll(".composer-submit select,.composer-submit button")].map(e=>{const b=e.getBoundingClientRect();return {label:e.getAttribute("aria-label"),left:b.left,right:b.right,top:b.top,bottom:b.bottom,width:b.width,font:getComputedStyle(e).fontSize}})})})))');
  assert.ok(geometry.documentWidth <= width + 1, json(geometry));
  for (const control of geometry.controls) assert.ok(control.width > 0 && control.left >= geometry.box.left && control.right <= geometry.box.right + 1, json(geometry));
  for (let index = 1; index < geometry.controls.length; index++) assert.ok(geometry.controls[index].left >= geometry.controls[index - 1].right - 1, json(geometry));
  assert.deepEqual(geometry.controls.slice(0, 3).map(c => c.label), ['选择模型模式', '选择模型', '回答深度']);
  for (const control of geometry.controls.slice(0, 3)) {
    assert.equal(control.font, '13px');
    assert.ok(control.bottom - control.top >= 32, json(geometry));
  }
  assert.ok(geometry.controls[0].width > 74, json(geometry));
  assert.ok(geometry.controls[1].width > (width === 600 ? 95 : 110), json(geometry));
  assert.ok(geometry.controls[1].width <= 124, json(geometry));
  assert.ok(geometry.controls[2].width > 68, json(geometry));
  return geometry;
}
async function setup() {
  await fs.mkdir(output, { recursive: true });
  for (const dir of [profile, home, workspace, path.join(fixture, 'appdata'), path.join(fixture, 'localappdata')]) await fs.mkdir(dir, { recursive: true });
  const now = new Date().toISOString();
  await fs.writeFile(path.join(profile, 'settings.json'), json({ workspaceRoot: workspace, projects: [{ id: 'modes-project', name: '模式验收', path: workspace }], activeProjectId: 'modes-project', preferences: { contextAccess: 'chat-only', browserPanelOpen: false, trayEnabled: false, closeConfirmation: 'never' } }));
  await fs.writeFile(path.join(home, 'codex-settings.json'), json({ sandboxMode: 'read-only', approvalPolicy: 'never', networkAccess: true, networkDomains: ['127.0.0.1'], workspaceDependencies: false }));
  await fs.writeFile(path.join(profile, 'conversations.json'), json({ version: 2, activeId: 'legacy-chat', conversations: ['legacy-chat', 'other-chat'].map(id => ({ id, projectId: 'modes-project', title: id === 'legacy-chat' ? '模型模式验收' : '另一条聊天', createdAt: now, updatedAt: now, messages: scope === 'same-address-layout' && id === 'other-chat' ? [
    { id: 'legacy-grok-user', role: 'user', content: '旧消息重试验收', modelMode: 'main', model: 'grok-4.7', executionEnabled: false },
    { id: 'legacy-grok-assistant', role: 'assistant', content: '原回答失败', error: true, modelMode: 'main', model: 'grok-4.7', executionEnabled: false },
  ] : [], mode: 'answer' })) }));
  server = http.createServer(async (req, res) => {
    try {
      let raw = ''; for await (const part of req) raw += part;
      const body = JSON.parse(raw), role = scope === 'same-address-layout' && req.url === '/shared/v1/chat/completions' ? roles.find(item => (item === 'main' ? configuredModels.main : models[item]).includes(body.model)) : roles.find(item => req.url === `/${item}/v1/chat/completions`);
      const credentialMatched = Boolean(role && req.headers.authorization === 'Bearer ' + keys[scope === 'same-address-layout' ? 'main' : role]);
      const history = body.messages.filter(message => ['user', 'assistant'].includes(message.role)).slice(0, -1);
      const historyUserModes = roles.filter(mode => history.some(message => message.role === 'user' && String(message.content).includes('共享上下文验收 ' + mode)));
      const historyAssistantModes = roles.filter(mode => history.some(message => message.role === 'assistant' && String(message.content).includes('已收到 ' + mode + ' /')));
      report.requests.push({ role, path: req.url, model: body.model, effort: body.reasoning_effort, credentialMatched, historyUserModes, historyAssistantModes });
      if (!credentialMatched || !(role === 'main' ? configuredModels.main : models[role]).includes(body.model)) { res.writeHead(401); res.end(json({ error: { message: 'Fixture profile mismatch' } })); return; }
      const prompt = body.messages.filter(message => message.role === 'user').at(-1)?.content || '';
      if (String(prompt).includes('retry-mode-fixture') && !failedOnce) { failedOnce = true; res.writeHead(503, { 'content-type': 'application/json' }); res.end(json({ error: { message: 'Controlled one-time failure' } })); return; }
      res.writeHead(200, { 'content-type': 'text/event-stream' });
      res.write('data: ' + json({ choices: [{ delta: { content: `已收到 ${role} / ${body.model}。` } }] }) + '\n\n');
      const timer = setTimeout(() => res.end('data: [DONE]\n\n'), 300);
      res.on('close', () => clearTimeout(timer));
    } catch (error) { report.serverError = error.message; res.writeHead(500); res.end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); base = 'http://127.0.0.1:' + server.address().port;
  config = { name: '聊天模式隔离验收', baseUrl: base + '/main/v1', apiKey: keys.main, model: models.main[0], models: configuredModels.main,
    subagentBaseUrl: base + '/subagent/v1', subagentApiKey: keys.subagent, subagentModel: models.subagent[0], subagentModels: models.subagent,
    advisorBaseUrl: base + '/advisor/v1', advisorApiKey: keys.advisor, advisorModel: models.advisor[0], advisorModels: models.advisor, advisorEnabled: false, toolProtocol: 'native', retryLimit: 0 };
  if (scope === 'same-address-layout') Object.assign(config, { baseUrl: base + '/shared/v1', subagentBaseUrl: base + '/shared/v1', advisorBaseUrl: base + '/shared/v1', subagentApiKey: '', advisorApiKey: '', subagentModel: 'grok-4.7' });
}
async function compactLayout() {
  await select(selectors.mode, 'main'); await select(selectors.model, models.main[0]); await input('');
  await page.evaluate('document.querySelector(".composer-model-mode").focus()');
  for (const type of ['keyDown', 'keyUp']) await page.command('Input.dispatchKeyEvent', { type, key: 'ArrowDown', code: 'ArrowDown', windowsVirtualKeyCode: 40 });
  await wait(() => page.evaluate('document.querySelector(".composer-model-mode").value==="subagent"'), 'Keyboard mode selection');
  await select(selectors.mode, 'main');
  const narrow = await layout(600), desktop = await layout(1280);
  const screenshot = await page.command('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  report.screenshot = path.join(output, 'composer-model-modes-final.png'); await fs.writeFile(report.screenshot, Buffer.from(screenshot.data, 'base64'));
  return { narrow, desktop, keyboard: true };
}
async function main() {
  try {
    await setup(); await check('packaged-program-and-isolated-profile', launch);
    await page.evaluate('window.scodex.saveModelConnection(' + json(config) + ')'); await reload();
    await page.evaluate('window.__modeEvents=[];window.scodex.onChatEvent(e=>{if(["complete","error","cancelled"].includes(e.type))window.__modeEvents.push({type:e.type,requestId:e.requestId,error:e.error})})');
    if (scope === 'shortcut-smoke') {
      assert.ok(shortcut, 'A real shortcut is required for shortcut-smoke');
      await check('shortcut-starts-complete-runtime-and-sends-from-ui', async () => {
        await send('请简短回复：快捷入口验收');
        assert.equal(report.requests.at(-1).role, 'main'); assert.equal(report.requests.at(-1).credentialMatched, true);
        return { shortcut, launchedPid: app.pid, model: report.requests.at(-1).model, responseCompleted: true };
      });
      report.status = 'passed'; return;
    }
    if (scope === 'same-address-layout') {
      await check('same-address-mode-lists-stay-separate-after-save-and-restart', async () => {
        for (let round = 0; round < 2; round++) {
          const saved = await page.evaluate('window.scodex.getModelConnection()');
          assert.deepEqual(saved.models, configuredModels.main); assert.deepEqual(saved.subagentModels, configuredModels.subagent);
          for (const role of roles) { await select(selectors.mode, role); assert.deepEqual((await choices()).models, role === 'main' ? models.main : models[role]); }
          await wait(async () => (await savedChat()).modelMode === 'advisor', 'Saved selected mode before restart');
          if (round === 0) { await quit(); await launch(); }
        }
        return { sameAddress: true, grokRetainedInSavedMainConfig: true, grokHiddenFromModeOne: true, grokAvailableInModeTwo: true, processRestarted: true };
      });
      await check('hidden-model-remains-valid-for-original-main-message-retry', async () => {
        await switchChat('other-chat');
        assert.ok(!(await choices()).models.includes('grok-4.7'));
        const before = report.requests.length;
        await click('[data-message-id="legacy-grok-user"] [aria-label="重试此消息"]');
        await wait(() => report.requests.length === before + 1, 'Original Grok retry request');
        await wait(() => page.evaluate('window.__modeEvents.some(event=>event.type==="complete")'), 'Original Grok retry completed');
        assert.equal(report.requests.at(-1).role, 'main'); assert.equal(report.requests.at(-1).model, 'grok-4.7');
        assert.equal(report.requests.at(-1).credentialMatched, true);
        return { pickerHidesGrok: true, originalMode: 'main', originalModel: 'grok-4.7', retryCompleted: true };
      });
      await switchChat('legacy-chat');
      await check('same-address-modes-share-one-chat-and-context', async () => {
        for (const [index, role] of roles.entries()) {
          await select(selectors.mode, role); await select(selectors.model, models[role][0]);
          await send('请简短回复：共享上下文验收 ' + role);
          const request = report.requests.at(-1);
          assert.equal(request.role, role); assert.equal(request.credentialMatched, true);
          assert.deepEqual(request.historyUserModes, roles.slice(0, index)); assert.deepEqual(request.historyAssistantModes, roles.slice(0, index));
          await wait(async () => (await savedChat()).messages.length === (index + 1) * 2, 'Shared messages saved');
          assert.equal(await page.evaluate('document.querySelector("[data-chat-id][aria-current=true]").dataset.chatId'), 'legacy-chat');
        }
        return { chat: 'legacy-chat', sharedMessages: 6, roles, fullHistoryRetained: true };
      });
      await check('larger-reordered-controls-keyboard-and-narrow-window', compactLayout);
      report.status = 'passed'; return;
    }
    if (scope === 'shared-history-layout') {
      await check('three-modes-share-one-chat-and-all-previous-context', async () => {
        for (const [index, role] of roles.entries()) {
          const previousIds = (await savedChat()).messages.map(message => message.id);
          await select(selectors.mode, role);
          await wait(async () => (await savedChat()).modelMode === role, 'Mode saved before continuing');
          assert.deepEqual((await savedChat()).messages.map(message => message.id), previousIds);
          assert.equal(await page.evaluate('document.querySelector("[data-chat-id][aria-current=true]").dataset.chatId'), 'legacy-chat');
          await send('请简短回复：共享上下文验收 ' + role);
          const request = report.requests.at(-1);
          assert.equal(request.role, role); assert.equal(request.credentialMatched, true);
          assert.deepEqual(request.historyUserModes, roles.slice(0, index));
          assert.deepEqual(request.historyAssistantModes, roles.slice(0, index));
          await wait(async () => (await savedChat()).messages.length === (index + 1) * 2, 'Shared messages persisted');
        }
        return { conversationId: 'legacy-chat', sharedMessages: (await savedChat()).messages.length, routes: roles, previousUserAndAssistantContext: true, switchingPreservesMessages: true };
      });
      await check('mode-three-with-list-but-no-default-is-explicitly-unconfigured', async () => {
        await select(selectors.mode, 'main');
        await wait(async () => (await savedChat()).modelMode === 'main', 'Mode saved before boundary reload');
        await page.evaluate('window.scodex.saveModelConnection(' + json({ ...config, advisorBaseUrl: config.baseUrl, advisorApiKey: '', advisorModel: '', advisorModels: config.models }) + ')'); await reload();
        const settings = await page.evaluate('window.scodex.getModelConnection()'); assert.equal(settings.hasAdvisorCredential, true); assert.ok(settings.advisorModels.length);
        await select(selectors.mode, 'advisor');
        assert.match(await page.evaluate('document.querySelector(".composer-model-mode option:checked").textContent'), /未配置/);
        assert.match(await page.evaluate('document.querySelector(".toast")?.textContent||""'), /模式三尚未配置/);
        const before = report.requests.length; await input('请简短回复：没有默认模型'); await click('[aria-label="发送消息"]');
        assert.match(await page.evaluate('document.querySelector(".toast")?.textContent||""'), /模式三尚未配置/); assert.equal(report.requests.length, before);
        await select(selectors.mode, 'main'); await wait(async () => (await savedChat()).modelMode === 'main', 'Restore mode saved');
        await page.evaluate('window.scodex.saveModelConnection(' + json(config) + ')'); await reload();
        return { listAndCredentialPresent: true, missingDefaultShown: true, refusedWithoutRequest: true, restored: true };
      });
      await check('compact-layout-keyboard-and-narrow-window', compactLayout);
      report.status = 'passed'; return;
    }
    const connectionHash = crypto.createHash('sha256').update(await fs.readFile(path.join(profile, 'model-connection.json'))).digest('hex');
    await check('legacy-chat-default-and-three-service-routing', async () => {
      assert.equal((await choices()).mode, 'main');
      for (const role of roles) {
        await select(selectors.mode, role); assert.deepEqual((await choices()).models, models[role]);
        await select(selectors.model, models[role][1]);
        await send('请简短回复：模式路由验收 ' + role);
        assert.equal(report.requests.at(-1).role, role); assert.equal(report.requests.at(-1).model, models[role][1]); assert.equal(report.requests.at(-1).credentialMatched, true);
      }
      assert.equal((await page.evaluate('window.scodex.getModelConnection()')).advisorEnabled, false);
      assert.equal(crypto.createHash('sha256').update(await fs.readFile(path.join(profile, 'model-connection.json'))).digest('hex'), connectionHash);
      return { roles: 3, credentialsMatched: true, collaborationRemainsDisabled: true, connectionFileUnchanged: true };
    });
    await check('per-chat-selections-and-original-mode-retry', async () => {
      await select(selectors.mode, 'subagent'); assert.equal((await choices()).model, models.subagent[1]);
      await send('请简短回复：retry-mode-fixture', 'error');
      await select(selectors.mode, 'advisor');
      const count = await page.evaluate('window.__modeEvents.length'); await click('.retry-message');
      await wait(() => page.evaluate(`window.__modeEvents.length>${count}`), 'Retried request'); assert.equal(await page.evaluate('window.__modeEvents.at(-1).type'), 'complete');
      assert.equal(report.requests.at(-1).role, 'subagent'); assert.equal(report.requests.at(-1).model, models.subagent[1]);
      assert.equal((await choices()).mode, 'advisor');
      await switchChat('other-chat'); assert.equal((await choices()).mode, 'main');
      await switchChat('legacy-chat'); assert.equal((await choices()).mode, 'advisor');
      await wait(async () => (await savedChat()).modelMode === 'advisor', 'Mode persisted');
      const chat = await savedChat(); assert.equal(chat.messages.at(-2).modelMode, 'subagent'); assert.equal(chat.messages.at(-1).modelMode, 'subagent');
      return { retryRole: 'subagent', currentChatMode: 'advisor', originalModelRetained: true, independentChats: true };
    });
    await check('process-restart-keeps-mode-and-each-model-selection', async () => {
      await quit(); await launch(); assert.equal((await choices()).mode, 'advisor'); assert.equal((await choices()).model, models.advisor[1]);
      for (const role of roles) { await select(selectors.mode, role); assert.equal((await choices()).model, models[role][1]); }
      return { restarted: true, restoredModes: 3, restoredModels: 3 };
    });
    await check('unconfigured-mode-is-visible-and-cannot-send-to-another-service', async () => {
      await page.evaluate('window.scodex.saveModelConnection(' + json({ ...config, advisorModel: '', advisorModels: [] }) + ')'); await reload();
      await select(selectors.mode, 'main');
      await select(selectors.mode, 'advisor'); assert.equal((await choices()).model, '');
      assert.match(await page.evaluate('document.querySelector(".toast")?.textContent||""'), /模式三尚未配置/);
      const before = report.requests.length; await input('请简短回复：未配置模式'); await click('[aria-label="发送消息"]');
      assert.match(await page.evaluate('document.querySelector(".toast")?.textContent||""'), /模式三尚未配置/); assert.equal(report.requests.length, before);
      await select(selectors.mode, 'main');
      await wait(async () => (await savedChat()).modelMode === 'main', 'Mode saved before reload');
      await page.evaluate('window.scodex.saveModelConnection(' + json(config) + ')'); await reload();
      return { unconfiguredHint: true, requestsSent: report.requests.length - before };
    });
    await check('compact-layout-keyboard-and-narrow-window', compactLayout);
    report.status = 'passed';
  } catch (error) {
    report.status = 'failed'; report.failedStage = stage; report.error = error.stack; console.error(error); process.exitCode = 1;
    if (page) report.failureState = await page.evaluate('({mode:document.querySelector(".composer-model-mode")?.value,model:document.querySelector(".composer-model-button")?.value,options:[...document.querySelectorAll(".composer-model-button option")].map(o=>o.value),activeChat:document.querySelector("[data-chat-id][aria-current=true]")?.dataset.chatId})').catch(() => null);
  }
  finally {
    try { await quit(); report.processExited = true; } catch (error) { report.exitError = error.message; report.status = 'failed'; process.exitCode = 1; }
    if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
    if (report.processExited) {
      assert.equal(path.dirname(path.resolve(fixture)).toLowerCase(), tempRoot.toLowerCase());
      try { await fs.rm(fixture, { recursive: true }); report.cleanup = 'passed'; } catch (error) { report.cleanup = 'failed'; report.cleanupError = error.message; }
    }
    report.completedAt = new Date().toISOString(); await persist(); console.log(json({ status: report.status, checks: report.checks.length, failedStage: report.failedStage, cleanup: report.cleanup, report: reportFile }));
  }
}
main();
