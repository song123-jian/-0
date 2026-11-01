const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const http = require('node:http');
const { spawn } = require('node:child_process');
const { connect, wait, freePort } = require('./agent-workflow-ui.cjs');

const root = path.resolve(__dirname, '..');
const executable = path.resolve(process.env.SCODEX_SUBAGENT_EXE || path.join(root, 'release', 'Scodex-Workbench-1.3.28-x64.exe'));
const version = process.env.SCODEX_SUBAGENT_VERSION || '1.3.28';
const output = path.resolve(process.env.SCODEX_SUBAGENT_OUTPUT || path.join(root, 'release', 'subagent-release-20261101', 'candidate-ui'));
const temporary = path.join(os.tmpdir(), 'scodex-subagent-ui-' + crypto.randomUUID());
const profile = path.join(temporary, 'profile');
const workspace = path.join(temporary, 'project');
const home = path.join(temporary, 'home');
const json = JSON.stringify;
const mainKey = crypto.randomUUID();
const childKey = crypto.randomUUID();
const report = { status: 'running', version, executable, checks: [], environment: { platform: process.platform, node: process.version },
  limitations: ['Model HTTP is supplied by two loopback fixtures; EXE, React, IPC, permissions, encrypted storage and files are real.'] };
let app; let socket; let cdp; let mainServer; let childServer; let mainEndpoint; let childEndpoint;
let stage = 'setup'; let childEditRelease; let slowStarted = false; let slowClosed = false;
const seen = { main: [], child: [] };
const reportPath = path.join(output, 'subagent-ui-verification.json');

async function persist() { await fs.mkdir(output, { recursive: true }); await fs.writeFile(reportPath, json(report, null, 2) + '\n'); }
async function check(name, action) { stage = name; const evidence = await action(); report.checks.push({ name, status: 'passed', evidence }); await persist(); console.log('PASS ' + name); }
function reply(response, message) {
  const calls = message.tool_calls;
  const delta = { ...(message.content ? { content: message.content } : {}), ...(calls ? { tool_calls: calls.map((call, index) => ({ index, ...call })) } : {}) };
  response.writeHead(200, { 'content-type': 'text/event-stream; charset=utf-8' });
  response.end('data: ' + json({ choices: [{ delta }] }) + '\n\ndata: ' + json({ choices: [{ delta: {}, finish_reason: calls ? 'tool_calls' : 'stop' }] }) + '\n\ndata: [DONE]\n\n');
}
function tool(name, args) { return { tool_calls: [{ id: 'call_' + crypto.randomUUID(), type: 'function', function: { name, arguments: json(args) } }] }; }
function results(body) { return body.messages.filter((entry) => entry.role === 'tool').map((entry) => JSON.parse(entry.content)); }

async function mainModel(request, response) {
  assert.equal(request.headers.authorization, 'Bearer ' + mainKey);
  let raw = ''; for await (const chunk of request) raw += chunk;
  const body = JSON.parse(raw);
  assert.equal(body.model, 'main-fixture');
  assert.ok(body.tools.some((item) => item.function.name === 'subagent_start'));
  seen.main.push({ model: body.model, toolCount: body.tools.length });
  const prompt = body.messages.find((entry) => entry.role === 'user')?.content || '';
  const completed = results(body);
  if (prompt.includes('terminal cleanup')) {
    if (!completed.length) return reply(response, tool('subagent_start', { title: 'hold analysis', task: 'Hold analysis', mode: 'analysis', paths: ['src/a.txt'] }));
    await wait(() => slowStarted, 'Slow child started');
    return reply(response, { content: 'parent finished; child must stop first' });
  }
  const step = completed.length;
  if (step === 0) return reply(response, tool('read_file', { path: 'src/a.txt' }));
  if (step === 1) return reply(response, tool('subagent_start', { title: 'edit A', task: 'Edit A', mode: 'edit', paths: ['src/a.txt'] }));
  if (step === 2) return reply(response, tool('subagent_start', { title: 'edit B', task: 'Edit B', mode: 'edit', paths: ['src/b.txt'] }));
  if (step === 3) return reply(response, tool('edit_file', { path: 'src/a.txt', expected_hash: completed[0].hash, old_text: 'before A', new_text: 'parent overwrite' }));
  if (step === 4) {
    assert.equal(completed[3].ok, false);
    assert.match(completed[3].error, /子任务修改/);
    return reply(response, tool('subagent_start', { title: 'overlap A', task: 'Edit A again', mode: 'edit', paths: ['src/a.txt'] }));
  }
  if (step === 5) {
    assert.equal(completed[4].ok, false);
    assert.match(completed[4].error, /路径正在由另一个子任务处理/);
    await wait(() => childEditRelease?.callbacks.length === 2, 'Both child edits reached fixture');
    childEditRelease.callbacks.forEach((resolve) => resolve());
    return reply(response, tool('subagent_wait', { task_id: completed[1].id, wait_ms: 30000 }));
  }
  if (step === 6) { assert.equal(completed[5].status, 'complete'); return reply(response, tool('subagent_wait', { task_id: completed[2].id, wait_ms: 30000 })); }
  if (step === 7) { assert.equal(completed[6].status, 'complete'); return reply(response, tool('read_file', { path: 'src/a.txt' })); }
  if (step === 8) return reply(response, tool('read_file', { path: 'src/b.txt' }));
  assert.match(completed[7].content, /after A/);
  assert.match(completed[8].content, /after B/);
  return reply(response, { content: 'main integrated both verified child edits' });
}

async function childModel(request, response) {
  assert.equal(request.headers.authorization, 'Bearer ' + childKey);
  let raw = ''; for await (const chunk of request) raw += chunk;
  const body = JSON.parse(raw);
  assert.equal(body.model, 'child-fixture');
  assert.equal(body.tools.some((item) => item.function.name === 'run_command' || item.function.name === 'subagent_start'), false);
  seen.child.push({ model: body.model, tools: body.tools.map((item) => item.function.name) });
  const task = body.messages.find((entry) => entry.role === 'user')?.content || '';
  if (task.includes('Hold analysis')) {
    slowStarted = true;
    response.writeHead(200, { 'content-type': 'text/event-stream' }); response.flushHeaders();
    response.once('close', () => { slowClosed = true; });
    return;
  }
  const file = task.includes('Edit A') ? 'src/a.txt' : 'src/b.txt';
  const suffix = task.includes('Edit A') ? 'A' : 'B';
  const completed = results(body);
  if (!completed.length) return reply(response, tool('read_file', { path: file }));
  if (completed.length === 1) {
    await new Promise((resolve) => childEditRelease.callbacks.push(resolve));
    return reply(response, tool('edit_file', { path: file, expected_hash: completed[0].hash, old_text: 'before ' + suffix, new_text: 'after ' + suffix }));
  }
  assert.equal(completed[1].ok, true);
  return reply(response, { content: 'child edit complete' });
}

async function startServer(handler) {
  const server = http.createServer((request, response) => {
    Promise.resolve(handler(request, response)).catch((error) => {
      report.fixtureError = error.stack; if (!response.headersSent) response.writeHead(500); response.end();
    });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return server;
}
async function launch() {
  const port = await freePort();
  app = spawn(executable, ['--remote-debugging-port=' + port, '--user-data-dir=' + profile, '--disable-gpu'], {
    cwd: path.dirname(executable), windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'],
    env: { ...process.env, SCODEX_HOME: home, SCODEX_REFERENCE_HOME: path.join(temporary, 'reference'), SCODEX_REFERENCE_AGENTS_HOME: path.join(temporary, 'agents') },
  });
  let stderr = ''; app.stderr.on('data', (chunk) => { stderr = (stderr + chunk).slice(-2000); });
  const target = await wait(async () => {
    if (app.exitCode !== null) throw Error('Program exited: ' + stderr);
    return (await fetch('http://127.0.0.1:' + port + '/json/list').then((result) => result.json())).find((entry) => entry.type === 'page' && entry.url.startsWith('file:'));
  }, 'Program startup', 60000);
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
  cdp = connect(socket);
  await wait(() => cdp.evaluate('Boolean(window.scodex && document.querySelector("[aria-label=设置]"))'), 'React ready');
  const state = await cdp.evaluate('window.scodex.getAppState().then(s=>({version:s.version,workspaceRoot:s.workspaceRoot,userDataPath:s.userDataPath}))');
  assert.equal(state.version, version); assert.equal(path.resolve(state.workspaceRoot), workspace); assert.equal(path.resolve(state.userDataPath), profile);
  return state;
}
async function send(prompt) {
  const requestId = crypto.randomUUID();
  await cdp.evaluate('window.scodex.sendMessage(' + json({ requestId, mode: 'answer', prompt, messages: [] }) + ')');
  return cdp.evaluate('window.__subagentEvents.filter(e=>e.requestId===' + json(requestId) + ')');
}

async function main() {
  try {
    for (const directory of [profile, path.join(workspace, 'src'), home, path.join(temporary, 'reference'), path.join(temporary, 'agents')]) await fs.mkdir(directory, { recursive: true });
    await fs.writeFile(path.join(workspace, 'src', 'a.txt'), 'before A\n');
    await fs.writeFile(path.join(workspace, 'src', 'b.txt'), 'before B\n');
    await fs.writeFile(path.join(workspace, 'AGENTS.md'), '项目规则：仅修改分配的路径。\n');
    await fs.writeFile(path.join(profile, 'settings.json'), json({ workspaceRoot: workspace, preferences: { browserPanelOpen: false, trayEnabled: false } }));
    await fs.writeFile(path.join(home, 'codex-settings.json'), json({ workspaceDependencies: false, sandboxMode: 'workspace-write', approvalPolicy: 'never', networkAccess: true, networkDomains: ['*'], allowLocalBinding: true }));
    mainServer = await startServer(mainModel); childServer = await startServer(childModel);
    mainEndpoint = `http://127.0.0.1:${mainServer.address().port}/v1`;
    childEndpoint = `http://127.0.0.1:${childServer.address().port}/v1`;
    report.executableSha256 = crypto.createHash('sha256').update(await fs.readFile(executable)).digest('hex');
    await check('Actual executable and isolated profile', launch);
    await cdp.evaluate('window.scodex.saveModelConnection(' + json({ name: 'Subagent acceptance', baseUrl: mainEndpoint, models: ['main-fixture'], model: 'main-fixture', apiKey: mainKey, toolProtocol: 'native',
      subagentBaseUrl: childEndpoint, subagentModels: ['child-fixture'], subagentModel: 'child-fixture', subagentApiKey: childKey, subagentToolProtocol: 'native' }) + ')');
    await cdp.command('Page.reload');
    await wait(() => cdp.evaluate('Boolean(window.scodex && document.querySelector("[aria-label=设置]"))'), 'React reloaded with saved connection');
    await check('React settings show independent child connection and encrypted disk credentials', async () => {
      await cdp.evaluate('document.querySelector("[aria-label=设置]").click()');
      await cdp.evaluate('[...document.querySelectorAll(".settings-category")].find(e=>e.textContent.trim()==="模型与连接").click()');
      await wait(() => cdp.evaluate('Boolean(document.querySelector("#model-subagent-base-url"))'), 'Child settings');
      const fields = await cdp.evaluate('({url:document.querySelector("#model-subagent-base-url").value,model:document.querySelector("#model-subagent").value,protocol:document.querySelector("#model-subagent-tool-protocol").value,keyType:document.querySelector("#model-subagent-api-key").type})');
      assert.deepEqual(fields, { url: childEndpoint, model: 'child-fixture', protocol: 'native', keyType: 'password' });
      const disk = JSON.parse(await fs.readFile(path.join(profile, 'model-connection.json'), 'utf8'));
      assert.equal(disk.config.subagentBaseUrl, childEndpoint);
      assert.equal(disk.config.subagentModel, 'child-fixture');
      assert.equal(json(disk).includes(mainKey) || json(disk).includes(childKey), false);
      return fields;
    });
    await cdp.evaluate('window.__subagentEvents=[];window.__subagentOff=window.scodex.onChatEvent(e=>window.__subagentEvents.push(e))');
    childEditRelease = { callbacks: [] };
    await check('Two child edits, parent lock rejection, overlap rejection and parent readback', async () => {
      const events = await send('parallel verification');
      assert.equal(events.at(-1)?.type, 'complete');
      assert.match(events.at(-1).text, /main integrated both/);
      assert.equal(await fs.readFile(path.join(workspace, 'src', 'a.txt'), 'utf8'), 'after A\n');
      assert.equal(await fs.readFile(path.join(workspace, 'src', 'b.txt'), 'utf8'), 'after B\n');
      assert.ok(seen.child.length >= 6);
      return { mainRequests: seen.main.length, childRequests: seen.child.length, terminal: events.at(-1).type, paths: ['src/a.txt', 'src/b.txt'] };
    });
    await check('Parent completion waits for an unfinished child to stop', async () => {
      const events = await send('terminal cleanup');
      assert.equal(events.at(-1)?.type, 'complete');
      await wait(() => slowClosed, 'Slow child HTTP connection closed');
      assert.ok(events.some((event) => event.type === 'operation' && event.operation.name === 'subagent_start'));
      return { terminal: events.at(-1).type, slowStarted, slowClosed };
    });
    report.status = 'passed';
  } catch (error) { report.status = 'failed'; report.failedStage = stage; report.error = error.stack; console.error(error); process.exitCode = 1; }
  finally {
    try { if (cdp && app?.exitCode === null) { await cdp.evaluate('window.scodex.quitApp()'); await wait(() => app.exitCode !== null, 'Program exit', 20000); } } catch (error) { report.exitError = error.message; report.status = 'failed'; process.exitCode = 1; }
    socket?.close();
    for (const server of [mainServer, childServer]) if (server) { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); }
    if (app?.exitCode !== null && path.basename(temporary).startsWith('scodex-subagent-ui-') && path.dirname(temporary) === os.tmpdir()) {
      try { await fs.rm(temporary, { recursive: true }); report.cleanup = 'passed'; } catch (error) { report.cleanup = 'failed'; report.cleanupError = error.message; }
    }
    report.finishedAt = new Date().toISOString(); await persist(); console.log(json({ status: report.status, checks: report.checks.length, report: reportPath, cleanup: report.cleanup }));
  }
}
main();
