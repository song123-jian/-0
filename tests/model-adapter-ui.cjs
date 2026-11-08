// The packaged Electron/React/IPC, encrypted settings, child runtime and file tools are real.
// Only model endpoints use loopback fixtures, except the optional authorized public advisor.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const http = require('node:http');
const { spawn } = require('node:child_process');
const { connect, wait, freePort } = require('./agent-workflow-ui.cjs');
const root = path.resolve(__dirname, '..'), json = JSON.stringify, version = require('../package.json').version;
const output = path.resolve(process.env.SCODEX_ADAPTER_OUTPUT || path.join(root, 'release/advisor-repair-20261107/candidate-ui'));
const executable = process.env.SCODEX_ADAPTER_EXE || path.join(root, 'release/advisor-repair-20261107/candidate/win-unpacked/Scodex工作台.exe');
const fixture = path.join(output, 'fixture-' + crypto.randomUUID()), profile = path.join(fixture, 'profile'), home = path.join(fixture, 'home');
const publicAdvisor = process.env.SCODEX_ADAPTER_ADVISOR_KEY || ''; delete process.env.SCODEX_ADAPTER_ADVISOR_KEY;
const keys = { main: crypto.randomUUID(), child: crypto.randomUUID(), advisor: crypto.randomUUID() };
const report = { status: 'running', version, executable, fixture, checks: [], requests: [], publicAdvisor: Boolean(publicAdvisor), limitations: ['Main and child model responses are deterministic loopback fixtures. Real packaged application, UI, IPC, encrypted settings, permission checks and workspace files are exercised.'] };
const reportPath = path.join(output, 'model-adapter-ui.json');
let app, page, socket, server, workspace, base, held, heldClosed = false;
const persist = () => fs.writeFile(reportPath, json(report, null, 2));
const check = async (name, run) => { const evidence = await run(); report.checks.push({ name, status: 'passed', evidence }); await persist(); console.log('PASS ' + name); };
async function click(css, text) { await wait(() => page.evaluate('(()=>{const e=[...document.querySelectorAll(' + json(css) + ')].find(e=>' + (text ? 'e.textContent.trim()===' + json(text) : 'true') + ');if(!e||e.disabled)return false;e.click();return true})()'), 'Click ' + css); }
async function insert(css, value) { await page.evaluate('(()=>{const e=document.querySelector(' + json(css) + ');if(!e)throw Error("Missing control");const p=e instanceof HTMLSelectElement?HTMLSelectElement.prototype:e instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(p,"value").set.call(e,' + json(value) + ');e.dispatchEvent(new Event(e instanceof HTMLSelectElement?"change":"input",{bubbles:true}));})()'); }
const state = () => page.evaluate('window.scodex.getAppState()');
const chat = async () => (await state()).library.conversations.find(item => item.id === 'adapter-chat');
async function reload() { const origin = await page.evaluate('performance.timeOrigin'); await page.command('Page.reload'); await wait(() => page.evaluate('performance.timeOrigin!==' + origin + '&&Boolean(window.scodex&&document.querySelector("[aria-label=设置]"))'), 'Reload'); }
async function settings() { await click('[aria-label="设置"]'); await click('.settings-category', '模型与连接'); await wait(() => page.evaluate('Boolean(document.querySelector("#model-tool-protocol"))'), 'Settings'); }
async function config(patch) { const saved = await page.evaluate('window.scodex.getModelConnection()'); await page.evaluate('window.scodex.saveModelConnection(' + json({ ...saved, ...patch }) + ')'); await reload(); }
async function send(text) { const count = (await chat()).messages.length; await page.evaluate('if(!window.__adapterTerminals){window.__adapterTerminals={};window.scodex.onChatEvent(e=>{if(["complete","error","cancelled"].includes(e.type))window.__adapterTerminals[e.requestId]=e})}'); await insert('[aria-label="输入工作内容"]', text); await click('[aria-label="发送消息"]'); return count; }
async function finished(count, terminal = 'complete') { return wait(async () => { const current = await chat(), message = current.messages.at(-1); if (current.messages.length <= count || message?.role !== 'assistant' || message.pending || message.operations?.some(item => item.status === 'running')) return false; const event = await page.evaluate('window.__adapterTerminals?.[' + json(message.id) + ']'); if (!event) return false; if (event.type === 'complete' && message.content !== event.text || event.type === 'error' && !message.error) return false; const actual = event.type === 'error' ? 'failed' : event.type; if (actual !== terminal) { if (actual === 'failed' && terminal !== 'failed') throw Error(message.error); return false; } return message; }, 'Terminal ' + terminal, publicAdvisor ? 180000 : 45000); }
function reply(res, message) { res.writeHead(200, { 'content-type': 'application/json' }); res.end(json({ choices: [{ message }], usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 } })); }
function bad(res, message, status = 400) { res.writeHead(status, { 'content-type': 'application/json' }); res.end(json({ error: { message } })); }
function results(body) { const names = new Map(body.messages.flatMap(item => (item.tool_calls || []).map(call => [call.id, call.function.name]))); return body.messages.flatMap(item => item.role === 'tool' ? [{ name: names.get(item.tool_call_id), ...JSON.parse(item.content) }] : item.role === 'user' && item.content?.startsWith('本机工具实际结果') ? [JSON.parse(item.content.slice(item.content.indexOf('\n') + 1))] : []); }
function tool(res, body, name, args) { if (!body.tools) return reply(res, { content: json({ type: 'tool', name, arguments: args }) }); reply(res, { tool_calls: [{ id: crypto.randomUUID(), type: 'function', function: { name, arguments: json(args) } }] }); }
function final(res, body, content) { reply(res, { content: body.tools ? content : json({ type: 'final', content }) }); }
async function model(req, res) {
  const role = req.url.startsWith('/child') ? 'child' : req.url.startsWith('/advisor') ? 'advisor' : 'main';
  assert.equal(req.headers.authorization, 'Bearer ' + keys[role]);
  let raw = ''; for await (const part of req) raw += part; const body = JSON.parse(raw);
  report.requests.push({ role, model: body.model, tools: Boolean(body.tools), effort: body.reasoning_effort || '' });
  if (role === 'advisor') {
    assert.equal(body.tools, undefined); const content = body.messages.at(-1).content;
    const input = JSON.parse(content.match(/<review-data>\n([\s\S]*)\n<\/review-data>$/)[1]); report.requests.at(-1).stage = input.stage;
    if (body.reasoning_effort === 'ultra') return bad(res, 'advisor does not support reasoning effort "ultra"; use high or max');
    return reply(res, { content: json({ verdict: 'ready', summary: '核对真实证据后继续', checks: ['保留实际回读与未验证边界'] }) });
  }
  if (body.model === 'main-error') return bad(res, 'Invalid tools schema');
  if (body.model === 'main-route') return bad(res, 'No account route for this model', 404);
  if ((role === 'child' || body.model === 'main-json' || body.model === 'main-cancel') && body.tools) return bad(res, "Unsupported parameter: 'tools'", 422);
  if (body.model === 'main-cancel') { held = res; res.on('close', () => { heldClosed = true; }); return; }
  if (body.reasoning_effort === 'ultra') return bad(res, body.model + ' does not support reasoning effort "ultra"; use high or max');
  const done = results(body);
  if (role === 'child') { assert.ok(!body.tools); if (!done.some(item => item.ok && item.hash)) return tool(res, body, 'read_file', { path: 'child-proof.txt' }); return final(res, body, '子模型已回读 child-proof.txt。'); }
  if (body.model === 'main-delegate') {
    const start = done.find(item => item.id && item.title === '适配子模型');
    if (!start) return tool(res, body, 'subagent_start', { title: '适配子模型', task: '读取 child-proof.txt 并报告', mode: 'analysis', paths: ['child-proof.txt'] });
    if (!done.some(item => item.id === start.id && item.status === 'complete')) return tool(res, body, 'subagent_wait', { task_id: start.id, wait_ms: 10000 });
    return final(res, body, '子模型适配完成，已由主模型取得结果。');
  }
  const file = body.model === 'main-native' ? 'native-proof.txt' : 'json-proof.txt';
  if (!done.some(item => item.ok && item.path === file)) return tool(res, body, 'write_file', { path: file, expected_hash: 'new', content: '已适配，实际写入一次。\n' });
  return final(res, body, '适配验收完成：' + file);
}
async function setup() {
  await fs.mkdir(profile, { recursive: true }); await fs.mkdir(home, { recursive: true }); const now = new Date().toISOString();
  await fs.writeFile(path.join(profile, 'conversations.json'), json({ version: 2, activeId: 'adapter-chat', conversations: [{ id: 'adapter-chat', title: '统一模型适配验收', mode: 'answer', executionEnabled: true, createdAt: now, updatedAt: now, messages: [] }] }));
  await fs.writeFile(path.join(profile, 'settings.json'), json({ projects: [], activeProjectId: '', preferences: { contextAccess: 'full', browserPanelOpen: false, trayEnabled: false, closeConfirmation: 'never' } }));
  await fs.writeFile(path.join(home, 'codex-settings.json'), json({ sandboxMode: 'danger-full-access', approvalPolicy: 'never', networkAccess: true, networkDomains: ['*'], allowLocalBinding: true, workspaceDependencies: false, availableReasoningEfforts: ['ultra'], defaultReasoningEffort: 'ultra' }));
  server = http.createServer((req, res) => model(req, res).catch(error => { report.serverError = error.stack; if (!res.headersSent) res.writeHead(500); res.end(); })); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); base = 'http://127.0.0.1:' + server.address().port;
  const port = await freePort(); app = spawn(executable, ['--remote-debugging-port=' + port, '--user-data-dir=' + profile, '--disable-gpu'], { cwd: output, windowsHide: true, stdio: 'ignore', env: { ...process.env, SCODEX_HOME: home, SCODEX_REFERENCE_HOME: path.join(fixture, 'reference'), SCODEX_REFERENCE_AGENTS_HOME: path.join(fixture, 'agents') } });
  const target = await wait(async () => { if (app.exitCode !== null) throw Error('App exited ' + app.exitCode); return (await fetch('http://127.0.0.1:' + port + '/json/list').then(r => r.json())).find(item => item.type === 'page' && item.url.startsWith('file:')); }, 'Startup', 45000);
  socket = new WebSocket(target.webSocketDebuggerUrl); await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); }); page = connect(socket);
  await wait(() => page.evaluate('Boolean(window.scodex&&document.querySelector("[aria-label=输入工作内容]"))'), 'Renderer'); const actual = await state(); assert.equal(actual.version, version); workspace = actual.workspaceRoot;
  assert.ok(path.resolve(workspace).startsWith(path.resolve(fixture) + path.sep)); await fs.writeFile(path.join(workspace, 'child-proof.txt'), '子模型真实只读证据\n');
  await page.evaluate('window.scodex.saveModelConnection(' + json({ name: '通用适配验收', baseUrl: base + '/main/v1', apiKey: keys.main, model: 'main-json', models: ['main-json', 'main-native', 'main-delegate', 'main-error', 'main-route', 'main-cancel'], toolProtocol: 'native', reasoningEffort: 'ultra', subagentBaseUrl: base + '/child/v1', subagentApiKey: keys.child, subagentModel: 'child-json', subagentModels: ['child-json'], subagentToolProtocol: 'native', subagentReasoningEffort: 'ultra', advisorEnabled: true, advisorBaseUrl: publicAdvisor ? 'https://catbee.online/v1' : base + '/advisor/v1', advisorApiKey: publicAdvisor || keys.advisor, advisorModel: publicAdvisor ? 'claude-sonnet-4-6' : 'advisor-fixture', advisorModels: [publicAdvisor ? 'claude-sonnet-4-6' : 'advisor-fixture'], advisorReasoningEffort: 'ultra', retryLimit: 0 }) + ')'); await reload();
}
async function main() {
  await setup();
  await check('settings-automatic-main-child-save-reload-encryption', async () => {
    await settings(); await insert('#model-tool-protocol', 'auto'); await insert('#model-subagent-tool-protocol', 'auto'); await click('.model-save-button'); await wait(() => page.evaluate('document.querySelector(".model-message")?.textContent.includes("已保存")'), 'Saved'); await reload();
    const saved = await page.evaluate('window.scodex.getModelConnection()'); assert.equal(saved.toolProtocol, 'auto'); assert.equal(saved.subagentToolProtocol, 'auto');
    const disk = await fs.readFile(path.join(profile, 'model-connection.json'), 'utf8'); for (const key of [...Object.values(keys), publicAdvisor].filter(Boolean)) assert.ok(!disk.includes(key));
    return { main: saved.toolProtocol, child: saved.subagentToolProtocol, credentialsEncrypted: true };
  });
  await check('json-fallback-reasoning-advisor-gates-and-once-only-real-write', async () => {
    const answer = await finished(await send('请执行一次受控写入并完成顾问核验。')); const ops = answer.operations || [];
    assert.equal(await fs.readFile(path.join(workspace, 'json-proof.txt'), 'utf8'), '已适配，实际写入一次。\n');
    assert.equal(ops.filter(item => item.name === 'write_file' && item.status === 'succeeded').length, 1); assert.equal(ops.filter(item => item.name === 'tool_compat').length, 1); assert.equal(ops.filter(item => item.name === 'reasoning_compat').length, 1);
    assert.equal(ops.filter(item => item.name === 'advisor_consult' && item.status === 'succeeded').length, 2); assert.ok(!ops.some(item => item.name === 'advisor_consult' && item.status === 'failed'));
    const saved = await page.evaluate('window.scodex.getModelConnection()'); assert.equal(saved.reasoningEffort, 'ultra'); assert.equal(saved.advisorReasoningEffort, 'ultra');
    return { writes: 1, protocol: 'native -> json', effort: 'ultra -> max', advisorGates: 2, publicAdvisor: Boolean(publicAdvisor), operations: ops.filter(item => /compat|advisor_consult/.test(item.name)).map(({ name, status, detail, output }) => ({ name, status, detail, output })) };
  });
  if (publicAdvisor) return;
  await config({ model: 'main-native', advisorEnabled: false });
  await check('native-capable-model-retains-native-and-executes-once', async () => { const answer = await finished(await send('原生模型执行一次写入。')); assert.equal(answer.operations.filter(item => item.name === 'write_file' && item.status === 'succeeded').length, 1); assert.ok(!answer.operations.some(item => item.name === 'tool_compat')); assert.equal(await fs.readFile(path.join(workspace, 'native-proof.txt'), 'utf8'), '已适配，实际写入一次。\n'); return { writes: 1, retainedNative: true }; });
  await config({ model: 'main-delegate' });
  await check('child-uses-automatic-protocol-and-reasoning-and-returns-real-read', async () => { const answer = await finished(await send('委派只读子任务并取得实际结果。')); assert.match(answer.content, /子模型适配完成/); const childRequests = report.requests.filter(item => item.role === 'child'); assert.ok(childRequests.some(item => item.tools)); assert.ok(childRequests.some(item => !item.tools && item.effort === 'max')); return { childRequests, completed: true }; });
  for (const [model, status] of [['main-error', 400], ['main-route', 404]]) {
    await config({ model }); await check('no-fallback-for-' + status, async () => { const before = report.requests.length; const answer = await finished(await send('验证明确错误。'), 'failed'); assert.ok(!answer.operations?.some(item => item.name === 'tool_compat')); assert.equal(report.requests.length - before, 1); return { status, requests: 1, error: answer.error }; });
  }
  await config({ model: 'main-cancel' });
  await check('cancel-after-channel-switch-aborts-pending-request-without-write', async () => { const count = await send('切换后取消受控请求。'); await wait(() => Boolean(held), 'Held compatible response'); await click('[aria-label="停止生成"]'); await finished(count, 'cancelled'); await wait(() => heldClosed, 'Request closed'); return { cancelled: true, requestClosed: true }; });
  await settings(); await page.command('Emulation.setDeviceMetricsOverride', { width: 1064, height: 660, deviceScaleFactor: 1, mobile: false });
  await check('settings-controls-visible-and-no-horizontal-overflow', async () => { await page.evaluate('document.querySelector("#model-tool-protocol").scrollIntoView({block:"center"})'); const layout = await page.evaluate('({width:innerWidth,scroll:document.documentElement.scrollWidth,options:[...document.querySelector("#model-tool-protocol").options].map(o=>({value:o.value,text:o.textContent})),bounds:document.querySelector("#model-tool-protocol").getBoundingClientRect().toJSON()})'); assert.ok(layout.scroll <= layout.width); assert.ok(layout.bounds.left >= 0 && layout.bounds.right <= layout.width); const shot = await page.command('Page.captureScreenshot', { format: 'png' }); await fs.writeFile(path.join(output, 'settings-final.png'), Buffer.from(shot.data, 'base64')); return layout; });
}
main().then(() => { assert.ok(!report.serverError, report.serverError); report.status = 'passed'; }).catch(error => { report.status = 'failed'; report.error = error.stack; process.exitCode = 1; console.error(error); }).finally(async () => {
  try { if (app?.exitCode === null && page) { if (await page.evaluate('Boolean(document.querySelector("[aria-label=停止生成]"))')) await click('[aria-label="停止生成"]'); await page.evaluate('window.scodex.quitApp()'); await wait(() => app.exitCode !== null, 'Normal exit', 30000); assert.equal(app.exitCode, 0); } } catch (error) { report.shutdownError = error.stack; report.status = 'failed'; process.exitCode = 1; }
  socket?.close(); if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); } report.exitCode = app?.exitCode; report.finishedAt = new Date().toISOString(); report.exeSha256 = crypto.createHash('sha256').update(await fs.readFile(executable)).digest('hex'); await persist(); console.log(json({ status: report.status, checks: report.checks.length, output }));
});
