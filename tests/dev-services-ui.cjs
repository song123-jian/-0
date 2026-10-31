// Real portable EXE, UI, IPC, Windows jobs, Node HTTP and Chromium preview.
// The model endpoint alone is a deterministic local fixture.
const assert = require('node:assert/strict'), fs = require('node:fs/promises'), path = require('node:path');
const os = require('node:os'), crypto = require('node:crypto'), http = require('node:http');
const { spawn, execFile } = require('node:child_process'), { promisify } = require('node:util');
const { connect, wait, freePort } = require('./agent-workflow-ui.cjs');
const runFile = promisify(execFile), json = JSON.stringify;
const root = path.resolve(__dirname, '..'), output = path.join(root, 'release/dev-services-20261025');
const executable = path.join(output, 'Scodex-Workbench-1.4.0-x64.exe');
const temporary = process.env.SCODEX_SERVICE_FIXTURE || path.join(os.tmpdir(), 'scodex-dev-services-ui-' + crypto.randomUUID());
const profile = path.join(temporary, 'profile'), project = path.join(temporary, 'project'), fakeRoot = path.join(temporary, 'scodex');
const only = new Set((process.env.SCODEX_SERVICE_ONLY || '').split(',').filter(Boolean));
const report = { status: 'running', version: '1.4.0', executable, fixtureDirectory: temporary, checks: [], environment: { platform: os.platform(), release: os.release(), node: process.version }, limitations: ['CDP drives actual EXE renderer. Deterministic replies replace external model only.', 'Native UI Automation only confirms actual quit dialog. Renderer screenshot covers service panel; separate web target verifies native preview content.'] };
let appChild, cdp, socket, debugPort, modelServer, modelBase, manualPort, modelPort, waitingPort, savedSettings;
const requests = [], sockets = new Set();
async function save() { await fs.writeFile(path.join(output, 'services-ui-verification.json'), json(report, null, 2)); }
async function check(id, fn) { if (only.size && !only.has(id)) return; const evidence = await fn(); report.checks.push({ id, status: 'passed', evidence, sha256: report.sha256 }); console.log('PASS ' + id); await save(); }
async function click(label) { return wait(() => cdp.evaluate('(()=>{const e=document.querySelector(' + json('[aria-label="' + label + '"]') + ');if(!e||e.disabled)return false;e.click();return true})()'), 'Button ' + label); }
async function textClick(selector, text) { return wait(() => cdp.evaluate('(()=>{const e=[...document.querySelectorAll(' + json(selector) + ')].find(e=>e.textContent.trim()===' + json(text) + ');if(!e||e.disabled)return false;e.click();return true})()'), 'Text ' + text); }
async function insert(label, value) { await wait(() => cdp.evaluate('Boolean(document.querySelector(' + json('[aria-label="' + label + '"]') + '))'), 'Input ' + label); return cdp.evaluate('(()=>{const e=document.querySelector(' + json('[aria-label="' + label + '"]') + ');if(!e)throw Error("Input missing");const p=e instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:e instanceof HTMLSelectElement?HTMLSelectElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(p,"value").set.call(e,' + json(value) + ');e.dispatchEvent(new Event(e instanceof HTMLSelectElement?"change":"input",{bubbles:true}));return true})()'); }
const state = () => cdp.evaluate('window.scodex.listDevServices()');
const live = (value) => value.services.filter((s) => ['starting', 'running', 'stopping'].includes(s.status));
async function panel() { await cdp.evaluate('window.scodex.browserAction({type:"new"})'); await textClick('.browser-tool-list button', '运行与预览'); }
async function ensureForm() { await cdp.evaluate('(()=>{const d=document.querySelector(".dev-service-launch");if(!d)throw Error("Panel missing");if(!d.open)d.querySelector("summary").click()})()'); }
async function fill(name, command, previewUrl = '') { await ensureForm(); await insert('服务名称', name); await insert('服务启动命令', command); await insert('服务工作目录', '.'); await insert('服务预览地址', previewUrl); }
async function startManual(name, command, previewUrl = '') { await fill(name, command, previewUrl); await textClick('.dev-service-launch button', '启动服务'); return wait(async () => (await state()).services.find((s) => s.name === name), 'Service appears'); }
const commandFor = (file) => "& '" + process.execPath.replaceAll("'", "''") + "' '" + file.replaceAll("'", "''") + "'";
async function newChat(execution = true) { await cdp.evaluate('document.querySelector(".activity-rail [aria-label=项目]").click()'); await click('新聊天'); await wait(() => cdp.evaluate('!document.querySelector(".message-list")'), 'New chat'); if (execution) await click('执行任务'); }
async function submit(id) { await insert('输入工作内容', 'SCODEX_SERVICE_CASE:' + id); await click('发送消息'); }
async function finish() { await wait(() => cdp.evaluate('!document.querySelector("[aria-label=停止生成]")'), 'Model finished', 45000); return cdp.evaluate('document.querySelector(".message-list")?.innerText||""'); }
async function approve(allowed = true) { const text = await wait(() => cdp.evaluate('document.querySelector(".agent-approval")?.innerText'), 'Service approval'); await textClick('.agent-approval-actions button', allowed ? '允许本次服务操作' : '拒绝'); return text; }
async function approveUntilDone() { for (let n = 0; n < 8; n++) { const phase = await wait(() => cdp.evaluate('document.querySelector(".agent-approval")?"approval":!document.querySelector("[aria-label=停止生成]")?"done":false'), 'Approval / complete', 45000); if (phase === 'done') return n; await approve(); } throw Error('Too many approvals'); }
function respond(res, content) { res.writeHead(200, { 'content-type': 'text/event-stream; charset=utf-8' }); res.end('data: ' + json({ choices: [{ delta: content }] }) + '\n\ndata: ' + json({ choices: [{ delta: {}, finish_reason: content.tool_calls ? 'tool_calls' : 'stop' }] }) + '\n\ndata: [DONE]\n\n'); }
const textOf = (value) => typeof value === 'string' ? value : Array.isArray(value) ? value.filter((p) => p.type === 'text').map((p) => p.text).join('\n') : '';
async function model(body, res) {
 const prompt = body.messages.find((m) => m.role === 'user' && textOf(m.content).includes('SCODEX_SERVICE_CASE:'));
 const id = textOf(prompt?.content).split('SCODEX_SERVICE_CASE:')[1]?.split('\n')[0] || 'unknown';
 const compatible = body.messages[0]?.content.includes('中转兼容执行通道');
 const results = body.messages.filter((m) => m.role === 'tool' || m.role === 'user' && textOf(m.content).startsWith('本机工具实际结果')).map((m) => JSON.parse(m.role === 'tool' ? m.content : textOf(m.content).slice(textOf(m.content).indexOf('\n') + 1)));
 const names = (body.tools || []).map((t) => t.function.name), step = results.length; requests.push({ id, step, names, compatible });
 const done = (text) => respond(res, { content: compatible ? json({ type: 'final', content: text }) : text });
 const call = (name, args) => respond(res, compatible ? { content: json({ type: 'tool', name, arguments: args }) } : { tool_calls: [{ index: 0, id: 'call_' + crypto.randomBytes(5).toString('hex'), type: 'function', function: { name, arguments: json(args) } }] });
 if (id === 'dialogue') { assert.equal(names.some((n) => n.startsWith('service_')), false); return done('对话没有服务工具'); }
 if (id === 'planning' || id === 'never') { assert.equal(names.includes('service_start'), false); assert.equal(names.includes('service_stop'), false); assert.ok(names.includes('service_list')); return step ? done('只查看服务，没有启动或停止') : call('service_list', {}); }
 if (['reject', 'policy-change', 'cancel'].includes(id)) {
   if (!step) return call('service_start', { name: id, command: commandFor(path.join(project, id === 'cancel' ? 'waiting.cjs' : 'model.cjs')), preview_url: 'http://127.0.0.1:' + (id === 'cancel' ? waitingPort : modelPort) });
   assert.equal(results[0].ok, false); return done('本次启动已拒绝或已停止');
 }
 if (id === 'native' || id === 'json') {
   if (step && !results.at(-1).ok) return done('工具失败：' + results.at(-1).error);
   if (!step) return call('service_start', { name: '模型服务 ' + id, command: commandFor(path.join(project, 'model.cjs')), preview_url: 'http://127.0.0.1:' + modelPort });
   const serviceId = results[0]?.service?.id;
   if (step === 1) { assert.equal(results[0].service.health, 'ready'); return call('service_logs', { service_id: serviceId }); }
   if (step === 2) { assert.match(results[1].output, /模型服务中文就绪/); return call('service_list', {}); }
   if (step === 3) { assert.ok(results[2].services.some((s) => s.id === serviceId && s.status === 'running')); return call('service_stop', { service_id: serviceId }); }
   assert.equal(results[3].service.status, 'stopped'); return done('模型已启动、读取日志、查看服务并停止');
 }
 return done('无匹配用例');
}
async function setModel(protocol = 'native') { await cdp.evaluate('window.scodex.saveModelConnection(' + json({ name: '开发服务实际验收', baseUrl: modelBase + '/v1', model: 'controlled-services-model', models: ['controlled-services-model'], toolProtocol: protocol, apiKey: 'controlled-only' }) + ')'); }
async function launch() {
 debugPort = await freePort(); appChild = spawn(executable, ['--remote-debugging-port=' + debugPort, '--user-data-dir=' + profile, '--disable-gpu'], { windowsHide: true, cwd: output, stdio: 'ignore', env: { ...process.env, SCODEX_HOME: fakeRoot, SCODEX_REFERENCE_HOME: path.join(temporary, 'reference'), SCODEX_REFERENCE_AGENTS_HOME: path.join(temporary, 'agents') } });
 const target = await wait(async () => (await fetch('http://127.0.0.1:' + debugPort + '/json/list').then((r) => r.json())).find((t) => t.type === 'page' && t.url.startsWith('file:')), 'EXE startup', 45000);
 socket = new WebSocket(target.webSocketDebuggerUrl); sockets.add(socket); await new Promise((r) => socket.addEventListener('open', r, { once: true })); cdp = connect(socket); await wait(() => cdp.evaluate('Boolean(document.querySelector("[aria-label=输入工作内容]"))'), 'Renderer');
}
async function mainPid() {
 const script = "$needle='" + profile.replaceAll("'", "''") + "';Get-CimInstance Win32_Process -Filter \"Name='Scodex工作台.exe'\" | Where-Object {$_.CommandLine -and $_.CommandLine.Contains($needle) -and $_.CommandLine -notmatch '--type='} | Select-Object -ExpandProperty ProcessId";
 const result = await runFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { windowsHide: true, timeout: 7000 }); const pid = Number(result.stdout.trim()); assert.ok(pid > 0); return pid;
}
async function quitWithServices() {
 const pid = await mainPid(); const source = '$TargetPid=' + pid + '\n' + await fs.readFile(path.join(__dirname, 'confirm-services-exit.ps1'), 'utf8');
 const approval = runFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(source, 'utf16le').toString('base64')], { windowsHide: true, timeout: 16000 });
 await cdp.evaluate('window.scodex.quitApp()'); const result = await approval; assert.equal(result.stdout, 'confirmed'); await wait(() => Promise.resolve(appChild.exitCode !== null), 'Actual quit with live service', 20000); socket.close(); return { nativeDialogConfirmed: true, mainPid: pid, exitCode: appChild.exitCode };
}
async function main() {
 try {
  await fs.mkdir(profile, { recursive: true }); await fs.mkdir(project, { recursive: true }); await fs.mkdir(fakeRoot, { recursive: true });
  if (!process.env.SCODEX_SERVICE_FIXTURE) { await fs.writeFile(path.join(profile, 'settings.json'), json({ workspaceRoot: project, preferences: { browserPanelOpen: true, trayEnabled: false } })); await fs.writeFile(path.join(fakeRoot, 'codex-settings.json'), json({ sandboxMode: 'danger-full-access', approvalPolicy: 'on-request', workspaceDependencies: false })); }
  manualPort = await freePort(); modelPort = await freePort(); waitingPort = await freePort();
  const serviceSource = (port, label) => "const http=require('node:http');console.log(" + json(label) + ");http.createServer((q,r)=>{r.setHeader('Content-Type','text/html; charset=utf-8');r.end('<!doctype html><html lang=zh-CN><meta charset=utf-8><title>Scodex 项目预览</title><body style=font-family:MicrosoftYaHei;font-size:20px><h1>真实开发服务页面</h1><p>运行与预览实际链路成功</p></body></html>')}).listen(" + port + ",'127.0.0.1');";
  await fs.writeFile(path.join(project, 'service.cjs'), serviceSource(manualPort, '开发服务中文就绪')); await fs.writeFile(path.join(project, 'model.cjs'), serviceSource(modelPort, '模型服务中文就绪')); await fs.writeFile(path.join(project, 'waiting.cjs'), 'setInterval(()=>{},1000)'); await fs.writeFile(path.join(project, 'failure.cjs'), "console.error('实际服务失败原因');process.exit(7)"); await fs.writeFile(path.join(project, 'package.json'), json({ name: 'controlled-service-project', scripts: { dev: 'node service.cjs' } }));
  report.sha256 = crypto.createHash('sha256').update(await fs.readFile(executable)).digest('hex');
  modelServer = http.createServer(async (req, res) => { try { let raw = ''; for await (const chunk of req) raw += chunk; if (req.url === '/v1/chat/completions') return await model(JSON.parse(raw), res); res.end('controlled endpoint'); } catch (e) { report.modelError = e.stack; res.writeHead(500); res.end('controlled assertion failed'); } });
  await new Promise((r) => modelServer.listen(0, '127.0.0.1', r)); modelBase = 'http://127.0.0.1:' + modelServer.address().port;
  await launch(); savedSettings = await cdp.evaluate('window.scodex.getAppState().then(s=>s.agentSettings)'); await setModel(); await panel();
  await check('identity-script-selection', async () => { const identity = await cdp.evaluate('window.scodex.getAppState().then(s=>({version:s.version,workspaceRoot:s.workspaceRoot}))'); assert.equal(identity.version, '1.4.0'); await insert('项目启动脚本', 'dev'); const command = await cdp.evaluate('document.querySelector("[aria-label=服务启动命令]").value'); assert.equal(command, "npm run 'dev'"); return { ...identity, command }; });
  await check('manual-start-logs-preview-stop', async () => {
   await insert('项目启动脚本', 'dev');
   await insert('服务名称', '手动开发预览'); await insert('服务预览地址', 'http://127.0.0.1:' + manualPort); await textClick('.dev-service-launch button', '启动服务');
   const service = await wait(async () => (await state()).services.find((s) => s.name === '手动开发预览' && s.health === 'ready'), 'Manual HTTP ready'); await wait(() => cdp.evaluate('document.querySelector(".dev-service-log")?.innerText.includes("开发服务中文就绪")'), 'Actual logs'); await textClick('.dev-service-actions button', '打开预览');
   const tab = await wait(() => cdp.evaluate('window.scodex.getBrowserState()').then((s) => s.tabs.find((t) => t.url === service.previewUrl && !t.loading && !t.error)), 'Native preview loaded'); const target = await wait(async () => (await fetch('http://127.0.0.1:' + debugPort + '/json/list').then((r) => r.json())).find((t) => t.type === 'page' && t.url === service.previewUrl), 'Preview target');
   const ws = new WebSocket(target.webSocketDebuggerUrl); sockets.add(ws); await new Promise((r) => ws.addEventListener('open', r, { once: true })); const text = await connect(ws).evaluate('document.body.innerText'); assert.match(text, /实际链路成功/); ws.close(); await textClick('.browser-tabs [role=tab]', '运行与预览'); await click('停止所选服务'); await wait(async () => !live(await state()).length, 'Manual stopped'); await assert.rejects(fetch(service.previewUrl)); return { service, tabId: tab.id, pageText: text, stopped: true };
  });
  await check('occupied-port-and-failed-exit', async () => {
   const before = (await state()).services.length; await fill('占用端口', commandFor(path.join(project, 'service.cjs')), modelBase); await textClick('.dev-service-launch button', '启动服务'); await wait(() => cdp.evaluate('document.querySelector(".dev-service-error")?.innerText.includes("端口已被占用")'), 'Port error'); assert.equal((await state()).services.length, before);
   const failed = await startManual('失败服务', commandFor(path.join(project, 'failure.cjs'))); await wait(async () => (await state()).services.find((s) => s.id === failed.id)?.status === 'failed', 'Failed exit'); const item = (await state()).services.find((s) => s.id === failed.id); assert.equal(item.exitCode, 7); await wait(() => cdp.evaluate('document.querySelector(".dev-service-log")?.innerText.includes("实际服务失败原因")'), 'Failure log'); return { occupiedPortRefused: true, exitCode: 7 };
  });
  await check('project-and-dialogue-guards', async () => { const before = (await state()).services.length; const error = await cdp.evaluate('window.scodex.startDevService({command:"echo should-not-run"},' + json(project + '-changed') + ').then(()=>"unexpected",e=>e.message)'); assert.match(error, /项目已经变化/); await newChat(false); await submit('dialogue'); assert.match(await finish(), /没有服务工具/); assert.equal((await state()).services.length, before); return { staleRootRefused: true, dialogueToolsAbsent: true }; });
  await check('model-native-service-roundtrip', async () => { await newChat(); await submit('native'); assert.equal(await approveUntilDone(), 2); assert.match(await finish(), /读取日志、查看服务并停止/); assert.equal(live(await state()).length, 0); return { approvals: 2, realPowerShellAndHttp: true }; });
  await check('reject-and-policy-change', async () => {
   const before = (await state()).services.length; await newChat(); await submit('reject'); await approve(false); await finish(); assert.equal((await state()).services.length, before);
   await newChat(); await submit('policy-change'); await wait(() => cdp.evaluate('!!document.querySelector(".agent-approval")'), 'Pending policy'); await cdp.evaluate('window.scodex.saveAgentSettings({approvalPolicy:"never"},"shared")'); await approve(); await finish(); assert.equal((await state()).services.length, before); await cdp.evaluate('window.scodex.saveAgentSettings(' + json(savedSettings) + ',"shared")'); return { rejectedNoProcess: true, changedPolicyNoProcess: true };
  });
  await check('planning-and-never', async () => { await newChat(); await click('添加工具和上下文'); await textClick('.composer-menu-item', '计划模式开启计划模式'); await submit('planning'); assert.match(await finish(), /只查看服务/); await cdp.evaluate('window.scodex.saveAgentSettings({approvalPolicy:"never"},"shared")'); await newChat(); await submit('never'); assert.match(await finish(), /只查看服务/); await cdp.evaluate('window.scodex.saveAgentSettings(' + json(savedSettings) + ',"shared")'); return { noMutationTools: true, listAvailable: true }; });
  await check('cancel-managed-start', async () => { await newChat(); await submit('cancel'); await approve(); await wait(async () => live(await state()).length > 0, 'Starting'); await click('停止生成'); await finish(); await wait(async () => !live(await state()).length, 'Cancelled cleanup'); return { cancelledStartStopped: true }; });
  await check('model-json-service-roundtrip', async () => { await setModel('json'); await newChat(); await submit('json'); assert.equal(await approveUntilDone(), 2); assert.match(await finish(), /读取日志、查看服务并停止/); await setModel(); return { compatible: true, realProcessAndLogs: true }; });
  await check('panel-font-layout', async () => {
   await textClick('.browser-tabs [role=tab]', '运行与预览'); await ensureForm(); const cases = [];
   for (const [width, height] of [[1440, 900], [1080, 700]]) { await cdp.command('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false }); const geometry = await cdp.evaluate('(()=>{const p=document.querySelector(".dev-services-panel"),i=document.querySelector("[aria-label=服务启动命令]");return{pageOverflow:document.documentElement.scrollWidth>innerWidth+1,panelOverflow:p.scrollWidth>p.clientWidth+1,font:getComputedStyle(p).fontFamily,inputSize:getComputedStyle(i).fontSize,panelWidth:p.getBoundingClientRect().width}})()'); assert.equal(geometry.pageOverflow, false); assert.equal(geometry.panelOverflow, false); assert.match(geometry.font, /Microsoft YaHei/); assert.equal(geometry.inputSize, '16px'); cases.push({ width, height, ...geometry }); } await cdp.command('Emulation.clearDeviceMetricsOverride'); return cases;
  });
  await check('switch-project-stops-service', async () => {
   const service = await startManual('切换项目前服务', commandFor(path.join(project, 'service.cjs')), 'http://127.0.0.1:' + manualPort); await wait(async () => (await state()).services.find((s) => s.id === service.id)?.health === 'ready', 'Ready before switch'); const other = path.join(temporary, 'project-two'); await fs.mkdir(other, { recursive: true }); await click('创建项目'); await insert('项目名称', '服务生命周期验收'); await insert('项目文件夹', other); await textClick('.project-editor-actions button', '创建项目'); await wait(() => cdp.evaluate('!document.querySelector(".project-editor")'), 'Project switched'); assert.equal(live(await state()).length, 0); await assert.rejects(fetch(service.previewUrl));
   const registry = await cdp.evaluate('window.scodex.listProjects()'); const original = registry.projects.find((p) => p.path === project); assert.ok(original); await cdp.evaluate('window.scodex.selectProject(' + json(original.id) + ')'); await cdp.evaluate('location.reload()'); await wait(() => cdp.evaluate('!!document.querySelector("[aria-label=输入工作内容]")'), 'Renderer reload'); await panel(); return { stopped: true, originalProjectRestored: true };
  });
  await check('tray-keeps-service-and-restore', async () => {
   const previous = await cdp.evaluate('window.scodex.getAppState().then(s=>s.preferences)');
   await cdp.evaluate('window.scodex.savePreferences({trayEnabled:true,closeToTray:true})');
   const service = await startManual('托盘运行服务', commandFor(path.join(project, 'service.cjs')), 'http://127.0.0.1:' + manualPort);
   await wait(async () => (await state()).services.find((s) => s.id === service.id)?.health === 'ready', 'Ready before tray');
   const desktop = await cdp.evaluate('window.scodex.getDesktopState()'); assert.equal(desktop.available, true);
   await cdp.evaluate('window.scodex.hideToTray()'); await wait(() => cdp.evaluate('window.scodex.getDesktopState().then(s=>!s.visible)'), 'Hidden with service');
   assert.match(await fetch(service.previewUrl).then(r=>r.text()), /真实开发服务页面/); assert.equal((await state()).services.find(s=>s.id===service.id).health, 'ready');
   const duplicate = spawn(executable, ['--user-data-dir=' + profile, '--disable-gpu'], {windowsHide:true,stdio:'ignore',env:{...process.env,SCODEX_HOME:fakeRoot}});
   await wait(() => Promise.resolve(duplicate.exitCode !== null), 'Duplicate launcher exited', 30000);
   await wait(() => cdp.evaluate('window.scodex.getDesktopState().then(s=>s.visible)'), 'Tray restored');
   assert.equal((await state()).services.find(s=>s.id===service.id).health, 'ready'); await click('停止所选服务'); await wait(async()=>!live(await state()).length, 'Tray service stopped');
   await cdp.evaluate('window.scodex.savePreferences(' + json({trayEnabled:previous.trayEnabled,closeToTray:previous.closeToTray}) + ')');
   return {hidden:true,httpAvailableWhileHidden:true,sameServiceAfterRestore:true,duplicateExitCode:duplicate.exitCode};
  });
  await check('full-quit-cleans-live-service-and-restart', async () => { const service = await startManual('退出前服务', commandFor(path.join(project, 'service.cjs')), 'http://127.0.0.1:' + manualPort); await wait(async () => (await state()).services.find((s) => s.id === service.id)?.health === 'ready', 'Ready before quit'); const result = await quitWithServices(); await assert.rejects(fetch(service.previewUrl)); await launch(); assert.equal((await state()).services.length, 0); await panel(); return { ...result, stoppedOnQuit: true, autoStartedOnRestart: false }; });
  await check('abnormal-main-exit-cleans-service', async () => {
   const service = await startManual('异常退出前服务', commandFor(path.join(project, 'service.cjs')), 'http://127.0.0.1:' + manualPort); await wait(async () => (await state()).services.find((s) => s.id === service.id)?.health === 'ready', 'Ready before abnormal exit'); const pid = await mainPid(); await runFile('taskkill.exe', ['/PID', String(pid), '/F'], { windowsHide: true, timeout: 7000 });
   await wait(async () => { try { await fetch(service.previewUrl); return false; } catch { return true; } }, 'Owner watchdog closed HTTP'); await wait(() => Promise.resolve(appChild.exitCode !== null), 'Portable exit after main termination'); socket.close(); await launch(); assert.equal((await state()).services.length, 0); await panel(); return { mainTerminatedWithoutTreeKill: true, serviceClosedByWatcher: true, autoRestart: false };
  });
  await startManual('项目预览', commandFor(path.join(project, 'service.cjs')), 'http://127.0.0.1:' + manualPort); await wait(async () => live(await state()).some((s) => s.health === 'ready'), 'Final ready'); await wait(() => cdp.evaluate('document.querySelector(".dev-service-log")?.innerText.includes("开发服务中文就绪")'), 'Final log'); await cdp.evaluate('(()=>{const form=document.querySelector(".dev-service-launch");if(form.open)form.querySelector("summary").click();document.querySelector(".dev-services-panel").scrollTop=0})()'); const screenshot = await cdp.command('Page.captureScreenshot', { format: 'png' }); await fs.writeFile(path.join(output, 'services-workbench.png'), Buffer.from(screenshot.data, 'base64')); report.screenshot = 'services-workbench.png'; await click('停止所选服务'); await wait(async () => !live(await state()).length, 'Final stop'); report.status = 'passed';
 } catch (error) { report.status = 'failed'; report.error = error.stack; console.error(error); process.exitCode = 1; try { report.visibleText = await cdp.evaluate('document.body.innerText'); report.services = await state(); } catch {} }
 finally {
  try { if (socket?.readyState === 1) { for (const service of live(await state())) await cdp.evaluate('window.scodex.stopDevService(' + json(service.id) + ')'); await cdp.evaluate('window.scodex.quitApp()'); await wait(() => Promise.resolve(appChild.exitCode !== null), 'Final actual quit', 20000); } } catch (error) { report.quitError = error.message; }
  for (const ws of sockets) ws.close(); try { const pid = await mainPid(); await runFile('taskkill.exe', ['/PID', String(pid), '/T', '/F'], { windowsHide: true, timeout: 8000 }); report.forcedCleanupPid = pid; } catch {}
  if (appChild?.exitCode === null) appChild.kill(); modelServer?.closeAllConnections(); if (modelServer) await new Promise((r) => modelServer.close(r)); report.requests = requests; report.finishedAt = new Date().toISOString(); await save(); console.log('RESULT ' + report.status + ' ' + temporary);
 }
}
if (require.main === module) main();
