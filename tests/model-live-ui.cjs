// Authorized public generation tests in the actual packaged application.
// Credentials arrive through the process environment and never enter reports.
const fs = require('node:fs/promises'), path = require('node:path'), crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const http = require('node:http');
const { Readable } = require('node:stream');
const { connect, wait, freePort } = require('./agent-workflow-ui.cjs');
const root = path.resolve(__dirname, '..'), json = JSON.stringify;
const entries = JSON.parse(process.env.SCODEX_LIVE_KEYS || '[]'); delete process.env.SCODEX_LIVE_KEYS;
if (!entries.length) throw Error('No authorized test credentials provided');
const output = path.resolve(process.env.SCODEX_LIVE_OUTPUT || path.join(root, 'release/advisor-repair-20261107/live-models'));
const executable = process.env.SCODEX_LIVE_EXE || path.join(root, 'release/advisor-repair-20261107/candidate/win-unpacked/Scodex工作台.exe');
const fixture = path.join(output, 'fixture-' + crypto.randomUUID()), profile = path.join(fixture, 'profile'), home = path.join(fixture, 'home');
const report = { status: 'running', version: require('../package.json').version, executable, fixture, endpoint: 'https://catbee.online/v1', results: [], limitations: ['Single observed public generation per category, using a harmless update_plan request in an isolated workspace. Provider failures remain failures; list access alone is not a generation pass.'] };
let app, page, socket, proxy, diagnosticBase;
const clean = value => String(value || '').replace(/sk-[A-Za-z0-9_-]{20,}/g, '[REDACTED]');
const persist = () => fs.writeFile(path.join(output, 'live-models.json'), json(report, null, 2));
async function click(css) { await wait(() => page.evaluate('(()=>{const e=document.querySelector(' + json(css) + ');if(!e||e.disabled)return false;e.click();return true})()'), 'Click ' + css); }
async function insert(text) { await page.evaluate('(()=>{const e=document.querySelector("[aria-label=输入工作内容]");Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,"value").set.call(e,' + json(text) + ');e.dispatchEvent(new Event("input",{bubbles:true}));})()'); }
async function reload() { const origin = await page.evaluate('performance.timeOrigin'); await page.command('Page.reload'); await wait(() => page.evaluate('performance.timeOrigin!==' + origin + '&&Boolean(window.scodex&&document.querySelector("[aria-label=输入工作内容]"))'), 'Reload'); }
async function main() {
  if (process.env.SCODEX_LIVE_DIAGNOSTIC === '1') {
    report.diagnosticRequests = [];
    proxy = http.createServer(async (req, res) => {
      try {
        let raw = ''; for await (const part of req) raw += part;
        const body = JSON.parse(raw);
        const record = { model: body.model, effort: body.reasoning_effort, tools: body.tools?.map(t => t.function.name) }; report.diagnosticRequests.push(record);
        const upstream = await fetch(report.endpoint + '/chat/completions', { method: 'POST', headers: { authorization: req.headers.authorization, 'content-type': 'application/json' }, body: raw, redirect: 'error', signal: AbortSignal.timeout(120000) });
        record.status = upstream.status; res.writeHead(upstream.status, { 'content-type': upstream.headers.get('content-type') || 'application/json' });
        if (!upstream.ok) { const detail = await upstream.text(); record.detail = clean(detail); res.end(detail); }
        else Readable.fromWeb(upstream.body).pipe(res);
      } catch (error) { res.writeHead(502); res.end(json({ error: { message: clean(error.message) } })); }
    });
    await new Promise(resolve => proxy.listen(0, '127.0.0.1', resolve)); diagnosticBase = 'http://127.0.0.1:' + proxy.address().port + '/v1';
    report.limitations.push('Diagnostic HTTP forwarding preserves the actual app request body and records only model, effort, tool names, status and redacted provider errors.');
  }
  await fs.mkdir(profile, { recursive: true }); await fs.mkdir(home, { recursive: true }); const now = new Date().toISOString();
  await fs.writeFile(path.join(profile, 'conversations.json'), json({ version: 2, activeId: 'live-0', conversations: entries.map((entry, index) => ({ id: 'live-' + index, title: entry.label + ' 真实连通性', mode: 'answer', executionEnabled: true, createdAt: now, updatedAt: now, messages: [] })) }));
  await fs.writeFile(path.join(profile, 'settings.json'), json({ projects: [], activeProjectId: '', preferences: { contextAccess: 'full', trayEnabled: false, browserPanelOpen: false, closeConfirmation: 'never' } }));
  await fs.writeFile(path.join(home, 'codex-settings.json'), json({ sandboxMode: 'read-only', approvalPolicy: 'never', networkAccess: true, networkDomains: ['catbee.online', '127.0.0.1'], allowLocalBinding: false, workspaceDependencies: false, availableReasoningEfforts: ['ultra'], defaultReasoningEffort: 'ultra' }));
  const port = await freePort(); app = spawn(executable, ['--remote-debugging-port=' + port, '--user-data-dir=' + profile, '--disable-gpu'], { cwd: output, windowsHide: true, stdio: 'ignore', env: { ...process.env, SCODEX_HOME: home, SCODEX_REFERENCE_HOME: path.join(fixture, 'reference'), SCODEX_REFERENCE_AGENTS_HOME: path.join(fixture, 'agents') } });
  const target = await wait(async () => { if (app.exitCode !== null) throw Error('Program exited ' + app.exitCode); return (await fetch('http://127.0.0.1:' + port + '/json/list').then(r => r.json())).find(item => item.type === 'page' && item.url.startsWith('file:')); }, 'Startup', 45000);
  socket = new WebSocket(target.webSocketDebuggerUrl); await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); }); page = connect(socket);
  await wait(() => page.evaluate('Boolean(window.scodex&&document.querySelector("[aria-label=输入工作内容]"))'), 'Renderer'); assert.equal((await page.evaluate('window.scodex.getAppState()')).version, report.version);
  for (const [index, entry] of entries.entries()) {
    const result = { category: entry.label, status: 'running', requestedEffort: 'ultra' }; report.results.push(result); await persist();
    try {
      const list = await fetch(report.endpoint + '/models', { headers: { authorization: 'Bearer ' + entry.key }, signal: AbortSignal.timeout(20000), redirect: 'error' }); result.modelListStatus = list.status;
      if (!list.ok) throw Error('Model list HTTP ' + list.status);
      const body = await list.json(), ids = (body.data || []).map(item => item.id); result.modelCount = ids.length;
      const model = entry.preferred.find(id => ids.includes(id)) || ids.find(id => new RegExp(entry.pattern, 'i').test(id)); if (!model) throw Error('No matching model in supplied credential group'); result.model = model;
      const config = { name: entry.label, baseUrl: diagnosticBase || report.endpoint, apiKey: entry.key, model, models: [model], toolProtocol: 'auto', reasoningEffort: 'ultra', subagentBaseUrl: diagnosticBase || report.endpoint, subagentModel: model, subagentModels: [model], subagentReasoningEffort: '', subagentToolProtocol: 'auto', advisorEnabled: false, retryLimit: 0 };
      await page.evaluate('window.scodex.saveModelConnection(' + json(config) + ')');
      await page.evaluate('window.scodex.getAppState().then(s=>window.scodex.saveHistory({...s.library,activeId:' + json('live-' + index) + '}))'); await reload();
      await page.evaluate('window.__liveMetrics=[];window.__liveTerminal=null;window.scodex.onChatEvent(e=>{if(e.type==="request-metrics")window.__liveMetrics.push(e);if(["complete","error","cancelled"].includes(e.type))window.__liveTerminal=e})');
      await insert('进行一个无文件副作用的连通性测试：仅调用一次 update_plan 工具，创建一个 text 为“在线模型连通性测试”、status 为“completed”的步骤，然后仅回复 SCODEX_LIVE_OK。不要调用文件、命令、浏览器或子任务工具。'); await click('[aria-label="发送消息"]');
      let answer;
      try { answer = await wait(async () => { const terminal = await page.evaluate('window.__liveTerminal'); if (!terminal) return false; const s = await page.evaluate('window.scodex.getAppState()'), chat = s.library.conversations.find(item => item.id === 'live-' + index), message = chat.messages.at(-1); if (message?.id !== terminal.requestId || message.pending || message.operations?.some(item => item.status === 'running')) return false; if (terminal.type === 'complete' && message.content !== terminal.text || terminal.type === 'error' && !message.error) return false; result.terminal = { type: terminal.type, message: clean(terminal.message) }; return message; }, 'Public model terminal response', 120000); }
      catch (error) { if (await page.evaluate('Boolean(document.querySelector("[aria-label=停止生成]"))')) { await click('[aria-label="停止生成"]'); await wait(() => page.evaluate('!document.querySelector("[aria-label=停止生成]")'), 'Cancel timed out request'); } throw error; }
      result.metrics = await page.evaluate('window.__liveMetrics'); result.operations = (answer.operations || []).map(({ name, status, detail }) => ({ name, status, detail })); result.reply = clean(answer.content).slice(-1200);
      if (answer.error) throw Error(answer.error);
      assert.match(answer.content, /SCODEX_LIVE_OK/); assert.equal((answer.operations || []).filter(item => item.name === 'update_plan' && item.status === 'succeeded').length, 1);
      const saved = await page.evaluate('window.scodex.getModelConnection()'); assert.equal(saved.reasoningEffort, 'ultra'); assert.equal(saved.toolProtocol, 'auto'); result.status = 'passed';
    } catch (error) { result.status = 'failed'; result.error = clean(error.message); result.metrics ||= await page.evaluate('window.__liveMetrics||[]').catch(() => []); }
    await persist(); console.log(json({ category: result.category, model: result.model, status: result.status, error: result.error }));
  }
  report.status = report.results.every(item => item.status === 'passed') ? 'passed' : 'completed-with-failures';
}
main().catch(error => { report.status = 'failed'; report.error = clean(error.stack); process.exitCode = 1; }).finally(async () => {
  try { if (app?.exitCode === null && page) { await page.evaluate('window.scodex.quitApp()'); await wait(() => app.exitCode !== null, 'Normal exit', 30000); assert.equal(app.exitCode, 0); } } catch (error) { report.shutdownError = clean(error.message); report.status = 'failed'; process.exitCode = 1; }
  socket?.close(); if (proxy) { proxy.closeAllConnections(); await new Promise(resolve => proxy.close(resolve)); } report.exitCode = app?.exitCode; report.finishedAt = new Date().toISOString(); report.exeSha256 = crypto.createHash('sha256').update(await fs.readFile(executable)).digest('hex'); await persist(); console.log(json({ status: report.status, results: report.results.length }));
});
