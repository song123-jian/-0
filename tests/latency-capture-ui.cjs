const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const http = require('node:http');
const { spawn } = require('node:child_process');
const { connect, wait, freePort } = require('./agent-workflow-ui.cjs');
const root = path.resolve(__dirname, '..'), version = require('../package.json').version;
const output = path.resolve(process.env.SCODEX_PERF_OUTPUT || path.join(root, 'release/delivery-1.3.36/ui'));
const executable = process.env.SCODEX_PERF_EXE || path.join(root, 'release/win-unpacked/Scodex工作台.exe');
const fixture = path.join(output, 'fixture-' + crypto.randomUUID()), profile = path.join(fixture, 'profile'), home = path.join(fixture, 'home');
const report = { status: 'running', version, executable, fixture, checks: [], limitations: ['Loopback model response; actual packaged Electron, renderer, IPC, PowerShell, disk files and Windows encrypted snapshots. Public-service latency is separate.'] };
const json = JSON.stringify; let child, socket, cdp, server, workspace; const scheduled = new Set();
const state = () => cdp.evaluate('window.scodex.getAppState()');
async function click(selector) { await wait(() => cdp.evaluate('(()=>{const e=document.querySelector(' + json(selector) + ');if(!e||e.disabled)return false;e.click();return true})()'), selector); }
async function submit(text) {
  const s = await state(), count = s.library.conversations.find(c => c.id === s.library.activeId).messages.length;
  await cdp.evaluate('(()=>{const e=document.querySelector("[aria-label=输入工作内容]");Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,"value").set.call(e,' + json(text) + ');e.dispatchEvent(new Event("input",{bubbles:true}));})()');
  await click('[aria-label=发送消息]');
  return wait(async () => { const s = await state(), chat = s.library.conversations.find(c => c.id === s.library.activeId), message = chat.messages.at(-1); if (message?.error) throw Error(message.error); return chat.messages.length > count && message?.role === 'assistant' && !message.pending && message.content.includes('完成') ? { chat, message } : false; }, text + ' completion', 60000);
}
const frame = data => 'data: ' + json(data) + '\n\n';
function reply(response, content) { response.writeHead(200, { 'content-type': 'text/event-stream' }); response.end(frame({ choices: [{ delta: { content }, finish_reason: 'stop' }] }) + 'data: [DONE]\n\n'); }
function later(response, ms, action) { const timer = setTimeout(() => { scheduled.delete(timer); if (!response.destroyed) action(); }, ms); scheduled.add(timer); response.once('close', () => { clearTimeout(timer); scheduled.delete(timer); }); }
async function main() {
  await fs.mkdir(profile, { recursive: true }); await fs.mkdir(home, { recursive: true });
  await fs.writeFile(path.join(home, 'codex-settings.json'), json({ sandboxMode: 'danger-full-access', approvalPolicy: 'never', networkAccess: true, networkDomains: ['*'], allowLocalBinding: true, workspaceDependencies: false, availableReasoningEfforts: ['low'], defaultReasoningEffort: 'low' }));
  await fs.writeFile(path.join(profile, 'settings.json'), json({ projects: [], activeProjectId: '', preferences: { contextAccess: 'full', closeConfirmation: 'never', closeToTray: false } }));
  const calls = [];
  server = http.createServer(async (request, response) => { try {
    let body = ''; for await (const part of request) body += part; const input = JSON.parse(body);
    const userIndex = input.messages.findLastIndex(message => message.role === 'user'), prompt = input.messages[userIndex]?.content;
    const results = input.messages.slice(userIndex + 1).filter(message => message.role === 'tool');
    if (prompt === 'PERF-CAPTURE' && !results.length) {
      const start = performance.now(); report.requestStarted = start; response.writeHead(200, { 'content-type': 'text/event-stream' }); response.flushHeaders();
      later(response, 50, () => response.write(frame({ choices: [{ delta: { reasoning_content: 'PRIVATE-FIXTURE-REASONING' } }] })));
      later(response, 130, () => response.write(frame({ choices: [{ delta: { tool_calls: [{ index: 0, id: 'capture', function: { name: 'run_command', arguments: json({ command: "[System.IO.File]::WriteAllText('z-edited.txt', 'changed' + [Environment]::NewLine, (New-Object System.Text.UTF8Encoding($false)))", timeout_ms: 10000 }) } }] } }] })));
      later(response, 600, () => { report.toolArgumentsComplete = performance.now(); response.write(frame({ choices: [{ delta: {}, finish_reason: 'tool_calls' }] })); });
      later(response, 5600, () => response.end('data: [DONE]\n\n')); return;
    }
    if (prompt === 'PERF-CAPTURE') { report.nextRequestAt = performance.now(); calls.push(...results.map(message => JSON.parse(message.content))); return reply(response, '文件修改完成，实际工具结果已核对。'); }
    if (prompt === 'INCOMPLETE-CAPTURE' && !results.length) {
      response.writeHead(200, { 'content-type': 'text/event-stream' }); response.end(frame({ choices: [{ delta: { tool_calls: [{ index: 0, id: 'partial', function: { name: 'run_command', arguments: json({ command: "Write-Output 'no change'", timeout_ms: 10000 }) } }] }, finish_reason: 'tool_calls' }] }) + 'data: [DONE]\n\n'); return;
    }
    return reply(response, '文件检查完成。');
  } catch (error) { report.serverError = error.stack; if (!response.headersSent) response.writeHead(500); response.end(); } });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = await freePort();
  child = spawn(executable, ['--remote-debugging-port=' + port, '--user-data-dir=' + profile, '--disable-gpu'], { cwd: output, windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'], env: { ...process.env, SCODEX_HOME: home, SCODEX_REFERENCE_HOME: path.join(fixture, 'reference'), SCODEX_REFERENCE_AGENTS_HOME: path.join(fixture, 'agents') } });
  let errors = ''; child.stderr.on('data', value => { errors = (errors + value).slice(-2000); });
  const target = await wait(async () => { if (child.exitCode !== null) throw Error('EXE exited ' + child.exitCode + errors); return (await fetch('http://127.0.0.1:' + port + '/json/list').then(response => response.json())).find(page => page.type === 'page' && page.url.startsWith('file:')); }, 'Packaged EXE start', 45000);
  socket = new WebSocket(target.webSocketDebuggerUrl); await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); }); cdp = connect(socket);
  socket.addEventListener('message', ({ data }) => { if (JSON.parse(data).method === 'Page.javascriptDialogOpening') cdp.command('Page.handleJavaScriptDialog', { accept: true }).catch(() => {}); }); await cdp.command('Page.enable');
  await wait(() => cdp.evaluate('Boolean(document.querySelector("[aria-label=输入工作内容]"))'), 'Actual renderer ready');
  let s = await state(); assert.equal(s.version, version); workspace = s.workspaceRoot; report.workspace = workspace;
  await cdp.evaluate('window.scodex.saveModelConnection(' + json({ name: '通道与扫描验收', baseUrl: 'http://127.0.0.1:' + server.address().port + '/v1', model: 'fixture', models: ['fixture'], apiKey: 'local-fixture', retryLimit: 0, toolProtocol: 'native' }) + ').then(()=>location.reload())');
  await wait(() => cdp.evaluate('Boolean(document.querySelector("[aria-label=输入工作内容]"))'), 'Connection ready');
  await cdp.evaluate('window.__perfEvents=[];window.scodex.onChatEvent(e=>{if(e.type==="phase"||e.type==="request-metrics")window.__perfEvents.push(e);})');
  for (let i = 0; i < 36; i++) await fs.writeFile(path.join(workspace, String(i).padStart(2, '0') + '.txt'), Buffer.alloc(512 * 1024, 97));
  const edited = path.join(workspace, 'z-edited.txt'); await fs.writeFile(edited, 'original\n');
  const completed = submit('PERF-CAPTURE');
  completed.catch(() => {});
  await wait(() => cdp.evaluate('document.querySelector(".message-progress[data-state=running] .message-progress-label")?.textContent.includes("接收工具参数")'), 'Real streaming tool-input phase');
  const result = await completed; assert.ok(report.nextRequestAt - report.toolArgumentsComplete < 4000, 'Tool result must reach the next request before the 5-second gateway tail');
  assert.equal(calls[0].ok, true); assert.equal(await fs.readFile(edited, 'utf8'), 'changed\r\n');
  const details = await cdp.evaluate('window.scodex.taskChangeDetails(' + json(result.message.fileChanges.id) + ',' + json(result.chat.id) + ')');
  assert.equal(details.warning, ''); assert.equal(details.files.length, 1); assert.equal(details.files[0].path, 'z-edited.txt'); assert.ok(details.coverage.reusedFiles >= 36);
  report.checks.push({ name: 'actual-command-captures-edit-after-18MiB-with-real-encrypted-spill', status: 'passed', coverage: details.coverage, afterArgumentsToNextRequestMs: Math.round(report.nextRequestAt - report.toolArgumentsComplete) });
  const selector = '[data-message-id=' + json(result.message.id) + ']';
  await click(selector + ' .task-changes-actions button:first-child');
  await wait(() => cdp.evaluate('document.querySelector(' + json(selector + ' .task-change-diff') + ')?.textContent.includes("-original")'), 'Lazily expanded real diff');
  await click(selector + ' .task-changes-actions button:last-child');
  await wait(() => cdp.evaluate('document.querySelector(' + json(selector + ' .task-changes-heading') + ')?.textContent.includes("已撤销")'), 'Actual undo');
  assert.equal(await fs.readFile(edited, 'utf8'), 'original\n'); report.checks.push({ name: 'lazy-diff-and-exact-real-undo', status: 'passed' });
  const events = await cdp.evaluate('window.__perfEvents'); assert.ok(events.some(event => event.phase === 'reasoning')); assert.ok(!json(events).includes('PRIVATE-FIXTURE-REASONING'));
  const metrics = events.filter(event => event.type === 'request-metrics'); assert.ok(metrics[0].firstTokenMs >= 0); assert.ok(metrics[0].firstToolCallMs >= 0); assert.ok(metrics[0].preparationMs >= 0);
  const usage = await cdp.evaluate('window.scodex.getModelUsage()'); assert.ok(usage.records.some(record => record.firstToolCallMs !== null)); report.checks.push({ name: 'real-phases-and-persisted-nonsecret-latency-metrics', status: 'passed', metrics });
  await fs.writeFile(path.join(workspace, 'oversized.bin'), Buffer.alloc(3 * 1024 * 1024, 0));
  const partial = await submit('INCOMPLETE-CAPTURE'), partialSelector = '[data-message-id=' + json(partial.message.id) + ']';
  await wait(() => cdp.evaluate('document.querySelector(' + json(partialSelector + ' .task-changes-heading') + ')?.textContent.includes("修改情况未完整确认")'), 'Honest partial empty state');
  assert.equal(await cdp.evaluate('document.querySelectorAll(' + json(partialSelector + ' .task-lines-added') + ').length'), 0);
  assert.equal(await cdp.evaluate('document.querySelector(' + json(partialSelector + ' .task-changes-actions button:last-child') + ').disabled'), true);
  report.checks.push({ name: 'incomplete-empty-capture-does-not-claim-zero-changes-and-disables-undo', status: 'passed' });
  await cdp.command('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  if (await cdp.evaluate('Boolean(document.querySelector(".app-shell.has-browser"))')) await click('[aria-label=收起标签工作台]');
  await wait(() => cdp.evaluate('!document.querySelector(".app-shell.has-browser")'), 'Narrow view settled');
  const layout = await cdp.evaluate('({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,cards:[...document.querySelectorAll(".task-file-changes")].map(e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right,width:r.width}})})');
  assert.ok(layout.scrollWidth <= layout.width); assert.ok(layout.cards.every(card => card.width > 0 && card.left >= 0 && card.right <= 390)); report.checks.push({ name: 'narrow-view-incomplete-and-full-cards-fit', status: 'passed', layout });
  await cdp.command('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  await cdp.evaluate('document.querySelector(' + json(partialSelector) + ').scrollIntoView({block:"center"})');
  const shot = await cdp.command('Page.captureScreenshot', { format: 'png' }); await fs.writeFile(path.join(output, 'latency-capture.png'), Buffer.from(shot.data, 'base64'));
  report.status = 'passed';
}
main().catch(error => { report.status = 'failed'; report.error = error.stack; console.error(error.stack); process.exitCode = 1; }).finally(async () => {
  try { if (child?.exitCode === null && cdp) { await cdp.evaluate('window.scodex.quitApp()'); await wait(() => child.exitCode !== null, 'Normal application exit', 30000); } } catch (error) { report.shutdownError = error.stack; process.exitCode = 1; }
  socket?.close(); for (const timer of scheduled) clearTimeout(timer);
  if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
  report.applicationExitCode = child?.exitCode; await fs.mkdir(output, { recursive: true }); await fs.writeFile(path.join(output, 'latency-capture-ui.json'), json(report, null, 2)); console.log(json({ status: report.status, checks: report.checks.length, output }));
});
