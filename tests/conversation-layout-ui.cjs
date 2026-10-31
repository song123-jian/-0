// Real portable EXE and renderer. Only model replies use a loopback fixture.
const assert = require('node:assert/strict'), fs = require('node:fs/promises'), path = require('node:path');
const os = require('node:os'), crypto = require('node:crypto'), http = require('node:http');
const { spawn } = require('node:child_process');
const { connect, wait, freePort } = require('./agent-workflow-ui.cjs');
const root = path.resolve(__dirname, '..'), output = path.join(root, 'release/conversation-layout-20261025');
const executable = path.join(output, 'Scodex-Workbench-1.3.1-x64.exe');
const temporary = process.env.SCODEX_LAYOUT_FIXTURE;
assert.ok(temporary && path.basename(temporary).startsWith('scodex-dev-services-ui-'), 'Reuse the authorized service fixture');
const profile = path.join(temporary, 'profile'), project = path.join(temporary, 'project'), fakeRoot = path.join(temporary, 'scodex');
const only = new Set((process.env.SCODEX_LAYOUT_ONLY || '').split(',').filter(Boolean));
const json = JSON.stringify, reportFile = path.join(output, 'conversation-ui-verification.json');
let report = { status: 'running', version: '1.3.1', executable, fixtureDirectory: temporary, checks: [], environment: { platform: os.platform(), release: os.release(), node: process.version }, limitations: ['CDP operates actual EXE renderer, IPC, history and PowerShell. Model replies alone are deterministic.', 'Renderer screenshot is not a Windows desktop screenshot. Unchanged service and real relay results are reused by their own build hashes.'] };
let appChild, cdp, socket, modelServer, modelBase, workflowId, debugPort, errorAttempts = 0;
const sockets = new Set(), requests = [], fixtureErrors = [], timers = new Set();
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const save = () => fs.writeFile(reportFile, json(report, null, 2));
async function check(id, fn) {
  if (only.size && !only.has(id)) return;
  const evidence = await fn();
  report.checks = report.checks.filter((item) => item.id !== id);
  report.checks.push({ id, status: 'passed', sha256: report.sha256, evidence });
  console.log('PASS ' + id); await save();
}
const evaluate = (code) => cdp.evaluate(code);
async function click(label) { return wait(() => evaluate('(()=>{const e=document.querySelector(' + json('[aria-label="' + label + '"]') + ');if(!e||e.disabled)return false;e.click();return true})()'), 'Button ' + label); }
async function textClick(selector, text) { return wait(() => evaluate('(()=>{const e=[...document.querySelectorAll(' + json(selector) + ')].find(e=>e.textContent.trim()===' + json(text) + ');if(!e||e.disabled)return false;e.click();return true})()'), 'Text ' + text); }
async function insert(label, value) {
  return evaluate('(()=>{const e=document.querySelector(' + json('[aria-label="' + label + '"]') + ');if(!e)throw Error("Input missing");const p=e instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(p,"value").set.call(e,' + json(value) + ');e.dispatchEvent(new Event("input",{bubbles:true}));return true})()');
}
async function key(key) {
  const virtual = { Enter: 13, Escape: 27 };
  for (const type of ['keyDown', 'keyUp']) await cdp.command('Input.dispatchKeyEvent', { type, key, code: key, text: type === 'keyDown' && key === 'Enter' ? '\r' : '', windowsVirtualKeyCode: virtual[key], nativeVirtualKeyCode: virtual[key] });
}
async function newChat(execution = false) {
  await evaluate('document.querySelector(".activity-rail [aria-label=项目]").click()'); await click('新聊天');
  await wait(() => evaluate('!document.querySelector(".message-list")'), 'New chat');
  if (execution) await click('执行任务');
}
async function submit(id) { await insert('输入工作内容', 'LAYOUT_CASE:' + id); await click('发送消息'); }
async function finish() {
  await wait(() => evaluate('!document.querySelector("[aria-label=停止生成]")'), 'Response finish', 45000);
  if (fixtureErrors.length) throw Error('Fixture: ' + fixtureErrors.join('; '));
  return evaluate('document.querySelector(".message-list")?.innerText||""');
}
async function approve() {
  await wait(() => evaluate('!!document.querySelector(".agent-approval")'), 'Approval');
  await textClick('.agent-approval-actions button', '允许本次命令');
}
async function storedAssistant(predicate = () => true) {
  return wait(async () => {
    const library = await evaluate('window.scodex.getAppState().then(s=>s.library)');
    const chat = library.conversations.find((item) => item.id === library.activeId);
    const message = chat?.messages.at(-1);
    return message?.role === 'assistant' && Number.isFinite(message.elapsedMs) && predicate(message) && message;
  }, 'Persisted assistant');
}
async function selectWorkflow() {
  await evaluate('document.querySelector(".activity-rail [aria-label=项目]").click()');
  const title = workflowId ? await evaluate('window.scodex.getAppState().then(s=>s.library.conversations.find(c=>c.id===' + json(workflowId) + ')?.title)') : 'LAYOUT_CASE:workflow';
  assert.ok(title, 'Known workflow identity');
  await textClick('[aria-label=最近对话] button', title);
  await wait(() => evaluate('document.querySelector(".assistant-message-content")?.innerText.includes("本轮改版")'), 'Workflow selected');
  if (workflowId) await wait(() => evaluate('window.scodex.getAppState().then(s=>s.library.activeId===' + json(workflowId) + ')'), 'Selected workflow persisted');
}
async function launch() {
  debugPort = await freePort();
  appChild = spawn(executable, ['--remote-debugging-port=' + debugPort, '--user-data-dir=' + profile, '--disable-gpu'], { windowsHide: true, cwd: output, stdio: 'ignore', env: { ...process.env, SCODEX_HOME: fakeRoot, SCODEX_REFERENCE_HOME: path.join(temporary, 'reference'), SCODEX_REFERENCE_AGENTS_HOME: path.join(temporary, 'agents') } });
  const target = await wait(async () => (await fetch('http://127.0.0.1:' + debugPort + '/json/list').then((r) => r.json())).find((t) => t.type === 'page' && t.url.startsWith('file:')), 'EXE startup', 45000);
  socket = new WebSocket(target.webSocketDebuggerUrl); sockets.add(socket);
  await new Promise((resolve) => socket.addEventListener('open', resolve, { once: true }));
  cdp = connect(socket); await cdp.command('Page.enable'); await cdp.command('Emulation.setFocusEmulationEnabled', { enabled: true });
  await wait(() => evaluate('Boolean(document.querySelector("[aria-label=输入工作内容]"))'), 'Renderer ready');
}
async function quit() {
  await evaluate('window.scodex.quitApp()');
  await wait(() => Promise.resolve(appChild.exitCode !== null), 'Actual EXE exit', 20000);
  assert.equal(appChild.exitCode, 0); socket.close();
  await wait(async () => { try { await fetch('http://127.0.0.1:' + debugPort + '/json/list'); return false; } catch { return true; } }, 'Actual main debug endpoint closed');
}
function send(res, message, hold = 0) {
  res.writeHead(200, { 'content-type': 'text/event-stream; charset=utf-8' });
  res.write('data: ' + json({ choices: [{ delta: message }] }) + '\n\n');
  const end = () => { if (!res.destroyed) res.end('data: ' + json({ choices: [{ delta: {}, finish_reason: message.tool_calls ? 'tool_calls' : 'stop' }] }) + '\n\ndata: [DONE]\n\n'); };
  if (!hold) end();
  else { const timer = setTimeout(() => { timers.delete(timer); end(); }, hold); timers.add(timer); res.once('close', () => { clearTimeout(timer); timers.delete(timer); }); }
}
function call(res, name, args) { send(res, { tool_calls: [{ index: 0, id: 'call_' + crypto.randomBytes(6).toString('hex'), type: 'function', function: { name, arguments: json(args) } }] }); }
const commandFor = (file) => "& '" + process.execPath.replaceAll("'", "''") + "' '" + path.join(project, file).replaceAll("'", "''") + "'";
const bt = String.fromCharCode(96), fence = bt.repeat(3);
const workflowReply = '本轮改版已完成，现有项目与执行记录均保留。\n\n我按以下步骤落实：\n\n1. **核对项目内容**，读取并更新 ' + bt + 'layout.txt' + bt + '。\n2. 调整回复排版与紧凑操作记录，补齐计划和文件修改摘要。\n3. 运行命令并核对中文输出，记录实际结果。\n\n验证输出为 **回复区中文验证通过 42**，文件内容已重新读取确认。';
const markdownReply = '# 清晰的回复\n\n保留 **粗体**、*强调* 和 ' + bt + '行内代码' + bt + '。\n\n> 引用内容\n\n| 项目 | 状态 |\n| --- | --- |\n| 中文 | 已完成 |\n\n' + fence + 'js\nconsole.log("中文代码");\n' + fence + '\n\n[安全链接](https://example.com/) [危险链接](javascript:evil)\n\n<img src=x onerror=alert(1)>';
async function model(body, res) {
  const latest = body.messages.findLastIndex((item) => item.role === 'user');
  const prompt = String(body.messages[latest]?.content || '');
  const id = prompt.split('LAYOUT_CASE:')[1]?.split('\n')[0] || 'unknown';
  const results = body.messages.slice(latest + 1).filter((item) => item.role === 'tool').map((item) => JSON.parse(item.content));
  const step = results.length; requests.push({ id, step, at: Date.now() });
  if (id === 'http-error') {
    if (++errorAttempts === 1) { res.writeHead(503, { 'content-type': 'application/json' }); return res.end(json({ error: { message: '受控回复错误，请重试' } })); }
    return send(res, { content: '重试已完成，处理时长重新记录。' }, 1200);
  }
  if (id === 'cancel') return send(res, { content: '正在准备这条回复，等待用户停止。' }, 30000);
  if (id === 'markdown') return send(res, { content: markdownReply });
  if (id === 'tool-failure') {
    if (!step) return call(res, 'run_command', { command: commandFor('layout-failure.cjs'), timeout_ms: 5000 });
    assert.equal(results[0].exitCode, 7); return send(res, { content: '命令返回非零退出码，任务尚未完成。' });
  }
  if (id === 'workflow') {
    const plan = (done) => [{ text: '核对并修改项目文件', status: done ? 'completed' : 'in_progress' }, { text: '运行验证并记录结果', status: done ? 'completed' : 'pending' }];
    if (step === 0) return call(res, 'update_plan', { steps: plan(false) });
    if (step === 1) return call(res, 'read_file', { path: 'layout.txt' });
    if (step === 2) return call(res, 'edit_file', { path: 'layout.txt', old_text: '待更新', new_text: '改版已落地', expected_hash: results[1].hash });
    if (step === 3) return call(res, 'search_text', { path: '.', query: '改版已落地' });
    if (step === 4) return call(res, 'service_list', {});
    if (step === 5) return call(res, 'list_directory', {});
    if (step === 6) return call(res, 'run_command', { command: commandFor('layout-command.cjs'), timeout_ms: 5000 });
    if (step === 7) { assert.equal(results[6].exitCode, 0); return call(res, 'update_plan', { steps: plan(true) }); }
    return send(res, { content: workflowReply });
  }
  return send(res, { content: '受控普通回复。' });
}
async function main() {
  try {
    if (only.size) {
      const previous = await fs.readFile(reportFile, 'utf8').then(JSON.parse);
      report.checks = previous.checks; report.workflowId = previous.workflowId; workflowId = previous.workflowId;
    }
    report.sha256 = crypto.createHash('sha256').update(await fs.readFile(executable)).digest('hex');
    await save(); modelServer = http.createServer(async (req, res) => {
      try { let raw = ''; for await (const chunk of req) raw += chunk; await model(JSON.parse(raw), res); }
      catch (error) { fixtureErrors.push(error.stack); if (!res.headersSent) res.writeHead(500); res.end('Controlled model failure'); }
    });
    const modelPort = await freePort(); await new Promise((resolve) => modelServer.listen(modelPort, '127.0.0.1', resolve)); modelBase = 'http://127.0.0.1:' + modelPort;
    await fs.writeFile(path.join(project, 'layout-command.cjs'), 'console.log("回复区中文验证通过 42");\n', 'utf8');
    await fs.writeFile(path.join(project, 'layout-failure.cjs'), 'console.error("受控命令退出 7");process.exit(7);\n', 'utf8');
    await launch();
    await evaluate('window.scodex.savePreferences(' + json({ browserPanelOpen: false, trayEnabled: false, closeConfirmation: 'busy', fontSize: 16, fontFamily: 'Microsoft YaHei', themeMode: 'light' }) + ')');
    await evaluate('window.scodex.saveAgentSettings(' + json({ sandboxMode: 'danger-full-access', approvalPolicy: 'on-request', workspaceDependencies: false }) + ',"shared")');
    await evaluate('window.scodex.saveModelConnection(' + json({ name: '回复区实际验收', baseUrl: modelBase + '/v1', model: 'controlled-layout-model', models: ['controlled-layout-model'], toolProtocol: 'native', apiKey: 'controlled-only' }) + ')');
    await evaluate('location.reload()'); await wait(() => evaluate('Boolean(document.querySelector("[aria-label=输入工作内容]"))'), 'Configured renderer');
    await check('version-and-layout-identity', async () => {
      const state = await evaluate('window.scodex.getAppState().then(s=>({version:s.version,workspaceRoot:s.workspaceRoot}))');
      assert.equal(state.version, '1.3.1'); assert.equal(state.workspaceRoot.toLowerCase(), project.toLowerCase()); return state;
    });
    await check('workflow-timing-markdown-and-compact-records', async () => {
      await fs.writeFile(path.join(project, 'layout.txt'), '待更新\n', 'utf8');
      await newChat(true); const started = Date.now(); await submit('workflow');
      await wait(() => evaluate('!!document.querySelector(".agent-approval")'), 'Workflow approval');
      assert.match(await evaluate('document.querySelector(".message-progress").innerText'), /等待审批/);
      await delay(1600); const pendingTime = await evaluate('document.querySelector(".message-progress time").innerText');
      await approve(); await finish();
      const message = await storedAssistant((m) => !m.cancelled && !m.error && m.operations?.length === 8 && m.operations.every((op) => op.status === 'succeeded'));
      assert.ok(message.elapsedMs >= 1600 && message.elapsedMs <= Date.now() - started + 2000);
      assert.equal(message.operations.length, 8); assert.ok(message.operations.every((op) => op.status === 'succeeded'));
      assert.equal(await fs.readFile(path.join(project, 'layout.txt'), 'utf8'), '改版已落地\n');
      const dom = await evaluate('(()=>{const m=document.querySelector(".assistant-message-main"),c=m.querySelector(".assistant-message-content"),a=m.querySelector(".agent-activity");return{order:[...m.children].map(e=>e.className),list:c.querySelectorAll("ol>li").length,strong:c.querySelector("strong")?.innerText,inline:c.querySelector("code")?.innerText,oldHeading:!!m.querySelector(".agent-activity-heading"),border:getComputedStyle(a).borderWidth,folded:m.querySelector(".agent-earlier-operations")?.open,plan:!!m.querySelector(".agent-plan-summary"),changes:m.querySelector(".agent-changes-summary>summary")?.innerText,time:m.querySelector(".message-progress time").innerText}})()');
      assert.ok(dom.order.indexOf('assistant-message-content') < dom.order.indexOf('agent-activity')); assert.equal(dom.list, 3); assert.equal(dom.inline, 'layout.txt'); assert.equal(dom.oldHeading, false); assert.equal(dom.border, '0px'); assert.equal(dom.folded, false); assert.match(dom.changes, /1 个文件/);
      const library = await evaluate('window.scodex.getAppState().then(s=>s.library)'); workflowId = library.activeId; report.workflowId = workflowId; report.workflowElapsed = message.elapsedMs;
      return { elapsedMs: message.elapsedMs, pendingTime, ...dom };
    });
    await check('keyboard-expand-output-plan-and-file-diff', async () => {
      await selectWorkflow();
      await evaluate('(()=>{window.__layoutKeyEvents=[];const e=document.querySelector(".agent-earlier-operations>summary");e.focus();for(const type of ["keydown","keypress","keyup"])e.addEventListener(type,event=>window.__layoutKeyEvents.push({type:event.type,key:event.key,trusted:event.isTrusted}),{once:true});return true})()'); await key('Enter');
      report.keyboardObservation=await evaluate('({focused:document.hasFocus(),active:document.activeElement.tagName,events:window.__layoutKeyEvents})'); await save();
      await wait(() => evaluate('document.querySelector(".agent-earlier-operations").open'), 'Keyboard expanded earlier records');
      await evaluate('[...document.querySelectorAll(".agent-operation")].find(e=>e.querySelector("summary").innerText.startsWith("已运行")).querySelector("summary").focus()'); await key('Enter');
      assert.match(await evaluate('[...document.querySelectorAll(".agent-operation[open]")].map(e=>e.innerText).join("\\n")'), /回复区中文验证通过 42[\s\S]*退出码：0/);
      await evaluate('[...document.querySelectorAll(".agent-operation")].find(e=>e.querySelector("summary").innerText.startsWith("已修改")).querySelector("summary").click()');
      assert.match(await evaluate('document.querySelector(".agent-diff").innerText'), /改版已落地/);
      await evaluate('document.querySelector(".agent-plan-summary>summary").click();document.querySelector(".agent-changes-summary>summary").click()');
      assert.equal(await evaluate('document.querySelectorAll(".agent-plan .completed").length'), 2);
      await textClick('.agent-operation[open] button', '在编辑器查看');
      await wait(() => evaluate('document.querySelector(".cm-content")?.innerText.includes("改版已落地")'), 'Editor shows changed file');
      await selectWorkflow(); return { enterToggled: true, outputChinese: true, exitCode: 0, diff: true, planCompleted: 2, fileOpened: true };
    });
    await check('safe-markdown-code-copy-and-editor', async () => {
      await newChat(); await submit('markdown'); await finish();
      const dom = await evaluate('(()=>{const c=document.querySelector(".assistant-message-content");return{heading:c.querySelector("h2")?.innerText,table:c.querySelectorAll("table tbody tr").length,quote:c.querySelector("blockquote")?.innerText,code:c.querySelector("pre code")?.innerText,unsafe:c.querySelectorAll("script,img,iframe").length,links:[...c.querySelectorAll("a")].map(e=>e.href),literal:c.innerText.includes("<img src=x")}})()');
      assert.equal(dom.heading, '清晰的回复'); assert.equal(dom.table, 1); assert.equal(dom.unsafe, 0); assert.deepEqual(dom.links, ['https://example.com/']); assert.equal(dom.literal, true);
      const clipboard = await evaluate('navigator.clipboard.readText().catch(()=>null)');
      try { await click('复制代码'); await wait(() => evaluate('document.querySelector("[aria-label=复制代码]").innerText.includes("已复制")'), 'Code copied'); assert.equal(await evaluate('navigator.clipboard.readText()'), dom.code); }
      finally { if (clipboard !== null) await evaluate('navigator.clipboard.writeText(' + json(clipboard) + ')'); }
      await selectWorkflow();
      await evaluate('(()=>{const d=document.querySelector(".agent-earlier-operations");if(d&&!d.open)d.querySelector("summary").click();const r=[...document.querySelectorAll(".agent-operation")].find(e=>e.querySelector("summary").innerText.startsWith("已读取"));if(!r.open)r.querySelector("summary").click();r.querySelector("button").click();return true})()');
      await wait(() => evaluate('document.querySelector(".editor-file-label")?.innerText.includes("layout.txt")'), 'Controlled file active');
      await evaluate('document.querySelector(".activity-rail [aria-label=项目]").click()');
      await textClick('[aria-label=最近对话] button', 'LAYOUT_CASE:markdown');
      await wait(() => evaluate('!!document.querySelector(".message-code-toolbar")'), 'Markdown selected');
      await textClick('.message-code-toolbar button', '放入编辑器');
      await wait(() => evaluate('document.querySelector(".cm-content")?.innerText.includes("中文代码")'), 'Code applied');
      await textClick('.editor-actions .save-button', '保存');
      await wait(async () => (await fs.readFile(path.join(project, 'layout.txt'), 'utf8')) === dom.code, 'Actual editor saved applied code');
      await fs.writeFile(path.join(project, 'layout.txt'), '改版已落地\n', 'utf8');
      await evaluate('document.querySelector(".file-tree-item[title=\\"layout.txt\\"]").click()');
      await wait(() => evaluate('document.querySelector(".cm-content")?.innerText.includes("改版已落地")'), 'Controlled file restored');
      return { ...dom, copiedExactCode: true, appliedToActualEditor: true, appliedCodeSaved: true, controlledFileRestored: true };
    });
    await check('model-error-and-actual-retry', async () => {
      await newChat(); await submit('http-error'); await finish();
      assert.match(await evaluate('document.querySelector(".message-error").innerText'), /503/);
      assert.equal(await evaluate('document.querySelector(".message-progress").dataset.state'), 'failed');
      const failed = await storedAssistant((m) => Boolean(m.error)); assert.ok(Number.isFinite(failed.elapsedMs));
      await textClick('.retry-message', '重试'); assert.match(await finish(), /重试已完成/);
      assert.equal(await evaluate('!!document.querySelector(".message-error")'), false);
      const retried = await storedAssistant((m) => !m.error && !m.cancelled); assert.ok(retried.elapsedMs >= 1000); return { actualHttp503: true, failureTimeSaved: true, retryCompleted: true, retryElapsedMs: retried.elapsedMs };
    });
    await check('nonzero-command-remains-failed', async () => {
      await newChat(true); await submit('tool-failure'); await approve(); await finish();
      assert.match(await evaluate('document.querySelector(".agent-operation.failed summary").innerText'), /失败/);
      await evaluate('document.querySelector(".agent-operation.failed summary").click()');
      assert.match(await evaluate('document.querySelector(".agent-operation.failed").innerText'), /受控命令退出 7[\s\S]*退出码：7/);
      return { realExitCode: 7, failedCaption: true, outputVisible: true };
    });
    await check('cancel-keeps-fixed-elapsed-and-retry-entry', async () => {
      await newChat(); await submit('cancel'); await wait(() => evaluate('document.querySelector(".assistant-message-content")?.innerText.includes("等待用户停止")'), 'Streaming reply');
      await delay(1400); await click('停止生成'); await finish();
      const message = await storedAssistant((m) => m.cancelled && Number.isFinite(m.stoppedAfter)); assert.equal(message.cancelled, true); assert.ok(message.elapsedMs >= 1000);
      const time = await evaluate('document.querySelector(".message-progress time").innerText'); await delay(1100);
      assert.equal(await evaluate('document.querySelector(".message-progress time").innerText'), time);
      assert.match(await evaluate('document.querySelector(".cancelled-label").innerText'), /已停止生成/); assert.equal(await evaluate('document.querySelector(".retry-message").disabled'), false);
      return { cancelled: true, elapsedMs: message.elapsedMs, fixedAfterStop: true, retryAvailable: true };
    });
    await check('restart-persists-timing-records-and-legacy-fallback', async () => {
      await selectWorkflow(); const before = await storedAssistant(); await quit(); await launch(); await selectWorkflow();
      const after = await storedAssistant(); assert.equal(after.elapsedMs, before.elapsedMs); assert.equal(after.operations.length, 8); assert.equal(await evaluate('!!document.querySelector(".agent-approval")'), false);
      const library = await evaluate('window.scodex.getAppState().then(s=>s.library)');
      const legacy = library.conversations.find((chat) => chat.messages.some((m) => m.role === 'assistant' && m.operations?.length >= 4 && m.elapsedMs === undefined && m.operations.some((op) => op.startedAt && op.endedAt)));
      assert.ok(legacy, 'Existing legacy history in reused profile');
      await evaluate('window.scodex.saveHistory(' + json({ ...library, activeId: legacy.id }) + ')'); await evaluate('location.reload()');
      await wait(() => evaluate('!!document.querySelector(".message-time-note")'), 'Legacy operation duration displayed');
      const inferred = await evaluate('document.querySelector(".message-time-note").innerText'); await selectWorkflow();
      return { persistedElapsedMs: after.elapsedMs, operationCount: 8, activeApprovalRestored: false, legacyDurationLabel: inferred };
    });
    await check('service-details-open-actual-workbench', async () => {
      await selectWorkflow();
      await evaluate('[...document.querySelectorAll(".agent-operation")].find(e=>e.querySelector("summary").innerText.startsWith("已查看开发服务")).querySelector("summary").click()');
      await textClick('.agent-operation[open] button', '查看运行与预览');
      await wait(() => evaluate('!!document.querySelector(".dev-services-panel")'), 'Actual service panel');
      const tabs = await evaluate('[...document.querySelectorAll(".browser-tabs [role=tab]")].map(e=>e.innerText)');
      assert.ok(tabs.some((t) => t.includes('运行与预览'))); await click('收起标签工作台');
      return { detailButtonOpenedPanel: true, tabs };
    });
    await check('two-viewports-theme-and-readable-fonts', async () => {
      await selectWorkflow(); const cases = [];
      for (const themeMode of ['light', 'dark']) {
        await evaluate('window.scodex.savePreferences(' + json({ themeMode, browserPanelOpen: false }) + ')'); await evaluate('location.reload()');
        await wait(() => evaluate('!!document.querySelector(".message-progress")'), 'Theme ready');
        for (const [width, height] of [[1440, 900], [1080, 700]]) {
          await cdp.command('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
          const dom = await evaluate('(()=>{const c=document.querySelector(".assistant-message-content"),a=document.querySelector(".agent-operation summary"),p=document.querySelector(".message-progress");return{theme:document.querySelector(".app-shell").dataset.theme,pageOverflow:document.documentElement.scrollWidth>innerWidth+1,font:getComputedStyle(c).fontFamily,bodySize:getComputedStyle(c).fontSize,auxSize:getComputedStyle(a).fontSize,progressSize:getComputedStyle(p).fontSize,rowHeight:a.getBoundingClientRect().height,bodyColor:getComputedStyle(c).color,recordColor:getComputedStyle(a).color,recordOverflow:a.scrollWidth>a.clientWidth+1}})()');
          assert.equal(dom.theme, themeMode); assert.equal(dom.pageOverflow, false); assert.equal(dom.recordOverflow, false); assert.match(dom.font, /Microsoft YaHei/); assert.ok(parseFloat(dom.bodySize) >= 16); assert.ok(parseFloat(dom.auxSize) >= 14); assert.ok(parseFloat(dom.progressSize) >= 14); assert.ok(dom.rowHeight <= 38); cases.push({ width, height, ...dom });
        }
      }
      await evaluate('window.scodex.savePreferences({themeMode:"light"})'); await evaluate('location.reload()'); await wait(() => evaluate('!!document.querySelector(".message-progress")'), 'Final light theme');
      await cdp.command('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
      await evaluate('document.querySelector(".chat-scroll").scrollTop=0').catch(() => {});
      await evaluate('document.querySelector(".user-message").scrollIntoView({block:"start"})');
      const screenshot = await cdp.command('Page.captureScreenshot', { format: 'png' }); await fs.writeFile(path.join(output, 'conversation-layout.png'), Buffer.from(screenshot.data, 'base64')); report.screenshot = 'conversation-layout.png';
      await cdp.command('Emulation.clearDeviceMetricsOverride'); return cases;
    });
    report.status = 'passed';
  } catch (error) {
    report.status = 'failed'; report.error = error.stack; console.error(error); process.exitCode = 1;
    try { report.visibleText = await evaluate('document.body.innerText'); } catch {}
  } finally {
    try { if (socket?.readyState === 1) { await quit(); report.finalAppExitCode = appChild.exitCode; } } catch (error) { report.quitError = error.message; }
    if (appChild?.exitCode === null) { appChild.kill(); report.launcherTerminated = true; }
    for (const ws of sockets) ws.close();
    for (const timer of timers) clearTimeout(timer);
    modelServer?.closeAllConnections(); if (modelServer) await new Promise((resolve) => modelServer.close(resolve));
    report.requests = requests; report.fixtureErrors = fixtureErrors; report.finishedAt = new Date().toISOString(); await save(); console.log('RESULT ' + report.status);
  }
}
if (require.main === module) main();
