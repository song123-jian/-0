// Actual packaged Electron, UI, IPC, storage, files and PowerShell.
// Only model HTTP responses/credentials are loopback fixtures.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const http = require('node:http');
const { spawn, execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { connect, wait, freePort } = require('./agent-workflow-ui.cjs');
const root = path.resolve(__dirname, '..'), version = require('../package.json').version, json = JSON.stringify;
const output = path.resolve(process.env.SCODEX_HANDOFF_OUTPUT || path.join(root, 'release/auto-handoff-' + version, 'candidate-ui'));
const executable = path.resolve(process.env.SCODEX_HANDOFF_EXE || path.join(root, 'release/Scodex-Workbench-' + version + '-final3/win-unpacked/Scodex工作台.exe'));
const shortcut = process.env.SCODEX_HANDOFF_SHORTCUT || '';
const scope = process.env.SCODEX_HANDOFF_SCOPE || 'all';
const fixture = path.join(os.tmpdir(), 'scodex-auto-handoff-ui-' + crypto.randomUUID());
const profile = path.join(fixture, 'profile'), home = path.join(fixture, 'home'), workspace = path.join(fixture, 'project');
const reference = path.join(fixture, 'reference'), agents = path.join(fixture, 'agents');
const modes = ['main', 'subagent', 'advisor'], keys = Object.fromEntries(modes.map(mode => [mode, crypto.randomUUID()]));
const held = new Map(), cases = new Map();
const report = { status: 'running', version, executable, shortcut, fixture, checks: [], requests: [], limitations: ['Model HTTP and credentials are loopback fixtures; no public model quality or undocumented Codex equivalence claim.'] };
let app, socket, page, server, base, probeId;
const sha = data => crypto.createHash('sha256').update(data).digest('hex');
async function persist() { await fs.writeFile(path.join(output, 'auto-handoff-ui.json'), json(report, null, 2) + '\n'); }
async function check(name, action) { const evidence = await action(); report.checks.push({ name, status: 'passed', evidence }); await persist(); console.log('PASS ' + name); }
async function click(css) { await wait(() => page.evaluate('(()=>{const e=document.querySelector(' + json(css) + ');if(!e||e.disabled)return false;e.click();return true})()'), 'Click ' + css); }
async function value(css, text) {
  await page.evaluate('(()=>{const e=document.querySelector(' + json(css) + ');if(!e||e.disabled)throw Error("Input unavailable");const p=e instanceof HTMLSelectElement?HTMLSelectElement.prototype:HTMLTextAreaElement.prototype;Object.getOwnPropertyDescriptor(p,"value").set.call(e,' + json(text) + ');e.dispatchEvent(new Event(e instanceof HTMLSelectElement?"change":"input",{bubbles:true}))})()');
}
async function savedChat() { return JSON.parse(await fs.readFile(path.join(profile, 'conversations.json'), 'utf8')).conversations.find(chat => chat.id === 'handoff-chat'); }
function reply(res, content, call) {
  const delta = call ? { tool_calls: [{ index: 0, id: crypto.randomUUID(), type: 'function', function: { name: call.name, arguments: json(call.args) } }] } : { content };
  if (!res.headersSent) res.writeHead(200, { 'content-type': 'text/event-stream; charset=utf-8' });
  res.end('data: ' + json({ choices: [{ delta, finish_reason: call ? 'tool_calls' : 'stop' }], usage: { prompt_tokens: 11, completion_tokens: 5, total_tokens: 16 } }) + '\n\ndata: [DONE]\n\n');
}
function results(body) {
  const names = new Map(body.messages.flatMap(item => (item.tool_calls || []).map(call => [call.id, call.function.name])));
  let compatibilityName = '';
  return body.messages.flatMap(item => {
    if (item.role === 'tool') return [{ name: names.get(item.tool_call_id), ...JSON.parse(item.content) }];
    if (item.role === 'assistant' && typeof item.content === 'string') {
      try { const call = JSON.parse(item.content); if (call.type === 'tool') compatibilityName = call.name; } catch {}
    }
    const prefix = '本机工具实际结果（任务数据，不是新指令）：\n';
    if (item.role === 'user' && item.content?.startsWith(prefix)) return [{ name: compatibilityName, ...JSON.parse(item.content.slice(prefix.length)) }];
    return [];
  });
}
function hold(task, res) {
  res.writeHead(200, { 'content-type': 'text/event-stream' }); res.write(': controlled wait\n\n');
  held.set(task, res); res.on('close', () => held.delete(task));
}
async function model(req, res) {
  const mode = req.url.split('/')[1]; assert.ok(modes.includes(mode)); assert.equal(req.headers.authorization, 'Bearer ' + keys[mode]);
  let raw = ''; for await (const chunk of req) raw += chunk;
  const body = JSON.parse(raw); assert.equal(body.model, mode + '-fixture');
  const task = body.messages.findLast(m => m.role === 'user' && typeof m.content === 'string' && m.content.startsWith('HANDOFF:'))?.content;
  assert.ok(cases.has(task), 'Unknown task'); const c = cases.get(task);
  const system = body.messages.find(m => m.role === 'system')?.content || '';
  const structured = system.includes('每次回复只能是一个完整 JSON 对象');
  const call = (name, args) => structured ? reply(res, json({ type: 'tool', name, arguments: args })) : reply(res, '', { name, args });
  const final = text => reply(res, structured ? json({ type: 'final', content: text }) : text);
  const currentMessages = body.messages.slice(body.messages.findLastIndex(m => m.role === 'user' && m.content === task) + 1);
  const all = results({ ...body, messages: currentMessages }), successful = all.filter(r => r.ok), reads = successful.filter(r => r.name === 'read_file');
  const edits = successful.filter(r => r.name === 'edit_file'), commands = all.filter(r => r.name === 'run_command');
  const assistance = all.filter(r => r.name === 'request_model_assistance');
  const takeoverAnswers = currentMessages.filter(m => m.role === 'assistant' && typeof m.content === 'string' && m.content.includes('TAKEOVER:' + task)).length;
  report.requests.push({ task, mode, protocol: structured ? 'json' : 'native', results: all.map(r => ({ name: r.name, ok: r.ok, deferred: r.requires_instruction_review || false, error: r.error })), takeoverAnswers });
  assert.ok(system.includes('ROOT-OVERRIDE')); assert.ok(!system.includes('ROOT-SHADOWED'));
  assert.ok(system.includes('真实文件核验技能')); assert.ok(!system.includes('PROBE-BODY'));
  if (c.scenario === 'script') {
    if (!all.length) return call('skill_open', {skill_id:probeId});
    if (all.length === 1) return call('skill_read', {path:'scripts/probe.ps1'});
    if (all.length === 2) {
      assert.ok(all[1].content.includes('SKILL-SCRIPT-EXECUTED'));assert.equal(all[1].absolute_path,path.join(agents,'skills/probe/scripts/probe.ps1'));
      const quote = s => "'" + s.replace(/'/g,"''") + "'";
      return call('run_command',{command:'& '+quote(all[1].absolute_path)+' -Target '+quote(path.join(workspace,'skill-script-proof.txt'))});
    }
    if (all.length === 3) {assert.equal(all[2].ok,true);assert.equal(all[2].exitCode,0);assert.ok(all[2].output.includes('SKILL-SCRIPT-EXECUTED'));return call('read_file',{path:'skill-script-proof.txt'});}
    assert.ok(all[3].content.includes('script-proof'));return final('Skill脚本已实际执行并回读核验。');
  }
  if (c.scenario === 'instructions') {
    const step = all.length;
    if (step === 0) return call('skill_open', { skill_id: probeId });
    if (step === 1) { assert.ok(all[0].content.includes('PROBE-BODY')); return call('skill_read', { path: 'reference.md' }); }
    if (step === 2) { assert.ok(all[1].content.includes('PROBE-REFERENCE')); return call('write_file', { path: 'nested/proof.txt', content: 'scoped-proof\n', expected_hash: 'new' }); }
    if (step === 3) {
      assert.equal(all[2].requires_instruction_review, true); assert.equal(all[2].instructions[0].content, 'NESTED-OVERRIDE');
      assert.equal(await fs.stat(path.join(workspace, 'nested/proof.txt')).then(() => true, () => false), false);
      return call('write_file', { path: 'nested/proof.txt', content: 'scoped-proof\n', expected_hash: 'new' });
    }
    if (step === 4) return call('run_command', { cwd: 'nested', command: "Get-Content -LiteralPath 'proof.txt'" });
    assert.equal(commands[0].exitCode, 0); assert.ok(commands[0].output.includes('scoped-proof'));
    return final('规则和技能已实际执行。');
  }
  if (c.scenario === 'changed-rule') {
    if (!all.length) { await fs.writeFile(path.join(workspace, 'AGENTS.override.md'), 'ROOT-OVERRIDE\nCHANGED'); return call('write_file', { path: 'must-not-exist.txt', content: 'forbidden', expected_hash: 'new' }); }
    assert.equal(all[0].ok, false); assert.match(all[0].error, /AGENTS.md.*已变化/);
    return final('规则变化已阻止实际写入。');
  }
  if (c.scenario === 'memory') { assert.ok(body.messages.some(m => m.role === 'user' && typeof m.content === 'string' && m.content.startsWith('历史学习记忆') && m.content.includes('MEMORY-PROBE-1366')));assert.ok(!system.includes('MEMORY-PROBE-1366')); return final('已读取重启后保存的学习记忆。'); }
  if (c.manual && mode === c.manual) {
    if (edits.length < 2 && all.at(-1)?.name !== 'read_file') return call('read_file', { path: c.file });
    if (edits.length < 2) return call('edit_file', { path: c.file, expected_hash: reads.at(-1).hash, old_text: 'started\n', new_text: 'manual\n' });
    return final('MANUAL-DONE:' + task);
  }
  if (c.scenario === 'auth' && mode === c.target) { res.writeHead(401); res.end('{"error":{"message":"fixture authentication failed"}}'); return; }
  const failedCommands = commands.filter(r => !r.ok);
  const triggered = c.scenario === 'repeated' ? failedCommands.length >= 2 : assistance.some(r => r.ok);
  if (!triggered) {
    assert.equal(mode, c.start);
    if (!reads.length) return call('read_file', { path: c.file });
    if (!edits.length) return call('edit_file', { path: c.file, expected_hash: reads.at(-1).hash, old_text: 'initial\n', new_text: 'started\n' });
    if (c.scenario === 'external') {
      if (commands.length < 2) return call('run_command', { command: "Write-Output 'HTTP 401'; exit 7" });
      return final('EXTERNAL-DONE:' + task);
    }
    if (c.scenario === 'repeated') return call('run_command', { command: "Write-Output 'model-assertion'; exit 7" });
    if (!assistance.length) return call('request_model_assistance', { reason: '当前实现需要更高能力协助', evidence: '已执行一次真实修改，复杂片段需要接手，片段编号' + cases.size });
    assert.equal(assistance[0].ok, false); return final('UNAVAILABLE-DONE:' + task);
  }
  const expectedEpisodes = c.scenario === 'repeat' ? 2 : 1;
  const episode = Math.max(0, assistance.filter(r => r.ok).length - 1);
  const refining = takeoverAnswers > episode;
  if (!refining) {
    assert.equal(mode, c.target);
    await wait(() => page.evaluate('document.querySelector(".composer-handoff-status")?.dataset.state==="takeover"'), 'Visible takeover status');
    if (['cancel', 'manual'].includes(c.scenario)) return hold(task, res);
    const desiredEdits = 2 + episode * 2;
    if (edits.length < desiredEdits && all.at(-1)?.name !== 'read_file') return call('read_file', { path: c.file });
    if (edits.length < desiredEdits) return call('edit_file', { path: c.file, expected_hash: reads.at(-1).hash, old_text: episode ? 'refined\n' : 'started\n', new_text: 'taken-over\n' });
    return final('TAKEOVER:' + task + ':' + episode);
  }
  assert.equal(mode, 'main');
  await wait(() => page.evaluate('document.querySelector(".composer-handoff-status")?.dataset.state==="refining"'), 'Visible mode-one refinement');
  const desiredEdits = 3 + episode * 2;
  if (edits.length < desiredEdits && all.at(-1)?.name !== 'read_file') return call('read_file', { path: c.file });
  if (edits.length < desiredEdits) return call('edit_file', { path: c.file, expected_hash: reads.at(-1).hash, old_text: 'taken-over\n', new_text: 'refined\n' });
  if (episode + 1 < expectedEpisodes) return call('request_model_assistance', { reason: '另一个独立实现片段需要协助', evidence: '模式一已实际完善上一片段，新问题-' + task + '-' + (episode + 1) });
  if (!commands.some(r => r.ok)) return call('run_command', { command: "Get-Content -LiteralPath '" + c.file + "'; Write-Output 'verified-after-return'" });
  if (all.at(-1)?.name !== 'read_file') return call('read_file', { path: c.file });
  assert.ok(reads.at(-1).content.includes('refined')); return final('模式一已核验、完善并继续完成原任务。REFINED-DONE:' + task);
}
async function listen() {
  await page.evaluate('window.__handoffEvents=[];window.__handoffEnd=[];window.scodex.onChatEvent(e=>{window.__handoffEvents.push(e);if(["complete","error","cancelled"].includes(e.type))window.__handoffEnd.push(e)})');
}
async function launch() {
  const port = await freePort(), args = ['--remote-debugging-port=' + port, '--user-data-dir=' + profile, '--disable-gpu'];
  const env = { ...process.env, SCODEX_HOME: home, SCODEX_REFERENCE_HOME: reference, SCODEX_REFERENCE_AGENTS_HOME: agents };
  if (shortcut) {
    const quote = s => "'" + s.replace(/'/g, "''") + "'";
    const command = '$taskProcess=Start-Process -FilePath ' + quote(shortcut) + ' -ArgumentList ' + quote(args.map(s => '"' + s + '"').join(' ')) + ' -WindowStyle Hidden -PassThru; $taskProcess.Id';
    const result = await promisify(execFile)('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command], { windowsHide: true, env: { ...env, APPDATA: path.join(fixture, 'appdata'), LOCALAPPDATA: path.join(fixture, 'localappdata') } });
    const pid = Number(result.stdout.trim()); assert.ok(Number.isSafeInteger(pid) && pid > 0);
    app = { pid, get exitCode() { try { process.kill(pid, 0); return null; } catch { return 0; } } };
  } else app = spawn(executable, args, { cwd: path.dirname(executable), windowsHide: true, stdio: 'ignore', env });
  const target = await wait(async () => { if (app.exitCode !== null) throw Error('App exited ' + app.exitCode); return (await fetch('http://127.0.0.1:' + port + '/json/list').then(r => r.json())).find(t => t.type === 'page' && t.url.startsWith('file:')); }, 'Actual EXE startup', 45000);
  socket = new WebSocket(target.webSocketDebuggerUrl); await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); }); page = connect(socket);
  await wait(() => page.evaluate('Boolean(document.querySelector(".composer-model-mode"))'), 'Composer ready');
  const identity = await page.evaluate('window.scodex.getAppState().then(s=>({version:s.version,userDataPath:s.userDataPath,workspaceRoot:s.workspaceRoot}))');
  assert.equal(identity.version, version); assert.equal(path.resolve(identity.userDataPath), profile); assert.equal(path.resolve(identity.workspaceRoot), workspace);
  await listen(); return identity;
}
async function quit() {
  if (page && app?.exitCode === null) await page.evaluate('window.scodex.quitApp()');
  if (app) await wait(() => Promise.resolve(app.exitCode !== null), 'Test process exit', 25000);
  socket?.close();
}
async function configure(patch = {}) {
  await page.evaluate('window.scodex.getModelConnection().then(config=>window.scodex.saveModelConnection({...config,...' + json(patch) + '}))');
}
async function settings() {
  await click('[aria-label="模型与连接"]');
  await page.evaluate('(()=>{const e=[...document.querySelectorAll(".model-config-tabs [role=tab]")].find(e=>e.textContent.includes("通用设置"));if(!e)throw Error("General tab missing");e.click()})()');
  await wait(() => page.evaluate('Boolean(document.querySelector("#model-auto-handoff-enabled"))'), 'Handoff settings');
}
async function begin(start, scenario) {
  const task = 'HANDOFF:' + start + '-' + scenario + '-' + cases.size, c = { start, scenario, file: 'proof-' + cases.size + '.txt', target: start === 'advisor' ? 'main' : 'advisor' };
  cases.set(task, c); await fs.writeFile(path.join(workspace, c.file), 'initial\n');
  await configure({ autoHandoffEnabled: true, modelCapabilityLevels: scenario === 'unavailable' ? { main: 1, subagent: 1, advisor: 1 } : start === 'advisor' ? { main: 3, subagent: 2, advisor: 1 } : { main: 1, subagent: 2, advisor: 3 }, advisorToolProtocol: start === 'subagent' ? 'json' : 'native' });
  await value('.composer-model-mode', start); await wait(() => page.evaluate('document.querySelector(".composer-model-button").value===' + json(start + '-fixture')), 'Selected start mode');
  await page.evaluate('window.__handoffEvents=[];window.__handoffEnd=[]');
  await value('[aria-label="输入工作内容"]', task); await click('[aria-label="发送消息"]'); return { task, c };
}
async function finish(run, expected = 'complete') {
  const terminal = await wait(() => page.evaluate('window.__handoffEnd.at(-1)'), 'Task terminal ' + run.task, 90000);
  assert.equal(terminal.type, expected, json(terminal)); await wait(() => page.evaluate('!document.querySelector("[aria-label=停止生成]")'), 'Composer idle');
  const message = await wait(async () => { const m = (await savedChat()).messages.find(m => m.id === terminal.requestId); return m && (expected === 'complete' ? m.content === terminal.text : expected === 'cancelled' ? m.cancelled === true : m.error === terminal.message) ? m : false; }, 'Persisted task result');
  const events = await page.evaluate('window.__handoffEvents');
  assert.ok(events.filter(e => e.requestId).every(e => e.requestId === terminal.requestId));
  report.terminals ||= [];report.terminals.push({task:run.task,type:terminal.type,text:terminal.text,message:{id:message.id,content:message.content,modelMode:message.modelMode,error:message.error,cancelled:message.cancelled}});await persist();
  return { terminal, message, events, requests: report.requests.filter(r => r.task === run.task) };
}
async function normal(start, scenario = 'normal') {
  const run = await begin(start, scenario), r = await finish(run);
  assert.equal(await fs.readFile(path.join(workspace, run.c.file), 'utf8'), 'refined\n');
  const episodes = scenario === 'repeat' ? 2 : 1;
  assert.equal(r.message.operations.filter(o => o.name === 'edit_file' && o.status === 'succeeded').length, 1 + 2 * episodes);
  assert.equal(r.events.filter(e => e.type === 'auto-handoff-state' && e.phase === 'takeover').length, episodes);
  assert.equal(r.events.filter(e => e.type === 'auto-handoff-state' && e.phase === 'refining').length, episodes);
  assert.ok(r.message.content.includes('REFINED-DONE:' + run.task));
  assert.equal(r.message.modelMode, 'main');
  assert.equal(r.message.operations.filter(o => o.name === 'run_command' && o.status === 'succeeded').length, 1);
  return { requestId: r.terminal.requestId, sharedChat: 'handoff-chat', start, takeover: run.c.target, returnMode: 'main', episodes, edits: 1 + 2 * episodes, successfulCommandCount: 1, protocols: [...new Set(r.requests.map(r => r.protocol))], actualFinalFile: 'refined' };
}
async function setup() {
  for (const dir of [output, profile, home, workspace, reference, path.join(agents, 'skills/probe/scripts'), path.join(workspace, 'nested')]) await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(workspace, 'AGENTS.md'), 'ROOT-SHADOWED');
  await fs.writeFile(path.join(workspace, 'AGENTS.override.md'), 'ROOT-OVERRIDE');
  await fs.writeFile(path.join(workspace, 'nested/AGENTS.md'), 'NESTED-SHADOWED');
  await fs.writeFile(path.join(workspace, 'nested/AGENTS.override.md'), 'NESTED-OVERRIDE');
  await fs.writeFile(path.join(agents, 'skills/probe/SKILL.md'), '---\nname: real-file-probe\ndescription: 真实文件核验技能\n---\nPROBE-BODY：按需读取 reference.md，并执行真实写入与回读。\n');
  await fs.writeFile(path.join(agents, 'skills/probe/reference.md'), 'PROBE-REFERENCE');
  await fs.writeFile(path.join(agents, 'skills/probe/scripts/probe.ps1'), "param([string]$Target)\n[IO.File]::WriteAllText($Target, ('script-proof' + [char]10), (New-Object Text.UTF8Encoding($false)))\nWrite-Output 'SKILL-SCRIPT-EXECUTED'\n");
  await fs.writeFile(path.join(profile, 'settings.json'), json({ workspaceRoot: workspace, projects: [{ id: 'handoff-project', name: '自动接力验收', path: workspace }], activeProjectId: 'handoff-project', preferences: { contextAccess: 'full', skillsEnabled: true, browserPanelOpen: false, trayEnabled: false, closeConfirmation: 'never' } }));
  await fs.writeFile(path.join(home, 'codex-settings.json'), json({ sandboxMode: 'danger-full-access', approvalPolicy: 'never', networkAccess: true, networkDomains: ['*'], workspaceDependencies: false }));
  const now = new Date().toISOString(); await fs.writeFile(path.join(profile, 'conversations.json'), json({ version: 2, activeId: 'handoff-chat', conversations: [{ id: 'handoff-chat', projectId: 'handoff-project', title: '程序自动接力验收', mode: 'answer', messages: [], createdAt: now, updatedAt: now }] }));
  server = http.createServer((req, res) => model(req, res).catch(error => { report.serverError = error.stack; if (!res.headersSent) res.writeHead(500); res.end(); }));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); base = 'http://127.0.0.1:' + server.address().port;
  await check('actual-exe-identity-and-isolated-profile', launch);
  await page.evaluate('window.scodex.saveModelConnection(' + json({ baseUrl: base + '/main/v1', apiKey: keys.main, models: ['main-fixture'], model: 'main-fixture', subagentBaseUrl: base + '/subagent/v1', subagentApiKey: keys.subagent, subagentModels: ['subagent-fixture'], subagentModel: 'subagent-fixture', advisorBaseUrl: base + '/advisor/v1', advisorApiKey: keys.advisor, advisorModels: ['advisor-fixture'], advisorModel: 'advisor-fixture', advisorEnabled: false, toolProtocol: 'native', reportUsage: true, retryLimit: 0 }) + ')');
  const origin = await page.evaluate('performance.timeOrigin'); await page.command('Page.reload'); await wait(() => page.evaluate('performance.timeOrigin!==' + origin + '&&Boolean(document.querySelector(".composer-model-mode"))'), 'Config reload'); await listen();
  probeId = await page.evaluate('window.scodex.listSkills().then(s=>s.find(s=>s.name==="real-file-probe")?.id)'); assert.ok(probeId);
}
async function main() {
  try {
    await setup();
    if (scope === 'all') await check('settings-save-reopen-and-responsive-layout', async () => {
      await settings(); await click('#model-auto-handoff-enabled');
      for (const [mode, level] of [['main', '1'], ['subagent', '2'], ['advisor', '3']]) await value('#model-capability-' + mode, level);
      await click('.model-save-button'); await wait(() => page.evaluate('window.scodex.getModelConnection().then(c=>c.autoHandoffEnabled&&c.modelCapabilityLevels.advisor===3)'), 'Settings persisted');
      await click('[aria-label="关闭模型与连接"]'); await settings();
      assert.equal(await page.evaluate('document.querySelector("#model-auto-handoff-enabled").checked'), true);
      for (const width of [600, 1280]) {
        await page.command('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: false });
        for (const css of ['#model-auto-handoff-enabled', '#model-capability-main', '#model-capability-subagent', '#model-capability-advisor', '.model-save-button']) {
          const geometry = await page.evaluate('new Promise(r=>{const e=document.querySelector(' + json(css) + ');e.scrollIntoView({block:"center"});requestAnimationFrame(()=>{const b=e.getBoundingClientRect();r({x:b.x,right:b.right,top:b.top,bottom:b.bottom,width:b.width,height:b.height,scroll:document.documentElement.scrollWidth})})})');
          assert.ok(geometry.width > 0 && geometry.height > 0 && geometry.x >= 0 && geometry.right <= width + 1 && geometry.top >= 0 && geometry.bottom <= 901 && geometry.scroll <= width + 1, json(geometry));
        }
      }
      await click('[aria-label="关闭模型与连接"]'); return { persisted: true, widths: [600, 1280] };
    });
    for (const mode of shortcut ? ['subagent'] : ['boundaries', 'final', 'memory-only', 'script-only'].includes(scope) ? [] : modes) await check('real-handoff-' + mode + '-and-mode-one-refinement', () => normal(mode));
    if (!shortcut) {
      if (!['boundaries', 'memory-only', 'script-only'].includes(scope)) await check('two-real-command-failures-trigger-handoff', () => normal('main', 'repeated'));
      if (['all', 'remaining'].includes(scope)) await check('new-independent-issue-relays-again-in-same-request', () => normal('main', 'repeat'));
      if (!['final', 'memory-only', 'script-only'].includes(scope)) await check('cancel-stops-takeover-without-replaying-success', async () => {
        const run = await begin('main', 'cancel'); await wait(() => Promise.resolve(held.has(run.task)), 'Takeover request held');
        assert.equal(await fs.readFile(path.join(workspace, run.c.file), 'utf8'), 'started\n');
        assert.equal(await page.evaluate('document.querySelector(".composer-handoff-status")?.dataset.state'), 'takeover');
        const count = report.requests.length; await click('[aria-label="停止生成"]'); const r = await finish(run, 'cancelled');
        assert.equal(report.requests.length, count); assert.ok(r.events.some(e => e.type === 'auto-handoff-state' && e.phase === 'cancelled'));
        assert.equal(await page.evaluate('document.querySelector(".composer-model-mode").value'), 'main');
        return { extraRequests: 0, cancelled: true, preservedFile: 'started', requestId: r.terminal.requestId };
      });
      if (!['final', 'memory-only', 'script-only'].includes(scope)) await check('manual-selection-overrides-automatic-return', async () => {
        const run = await begin('main', 'manual'); await wait(() => Promise.resolve(held.has(run.task)), 'Takeover held for manual selection');
        run.c.manual = 'subagent'; await value('.composer-model-mode', 'subagent');
        await wait(() => page.evaluate('document.querySelector(".composer-model-mode").dataset.pendingMode==="subagent"'), 'Manual switch queued');
        reply(held.get(run.task), '手动切换前已完成的操作保留。');
        const r = await finish(run); assert.ok(r.message.content.includes('MANUAL-DONE:' + run.task)); assert.equal(r.message.modelMode, 'subagent');
        assert.equal(await fs.readFile(path.join(workspace, run.c.file), 'utf8'), 'manual\n');
        assert.ok(r.events.some(e => e.type === 'auto-handoff-state' && e.phase === 'manual'));
        assert.equal(r.events.filter(e => e.type === 'auto-handoff-state' && e.phase === 'refining').length, 0);
        return { finalMode: 'subagent', forcedReturns: 0, file: 'manual' };
      });
      for (const scenario of ['memory-only','script-only'].includes(scope) ? [] : scope === 'final' ? ['external', 'auth'] : ['unavailable', 'external', 'auth']) await check('boundary-' + scenario, async () => {
        const run = await begin('main', scenario), r = await finish(run, scenario === 'auth' ? 'error' : 'complete');
        assert.equal(await fs.readFile(path.join(workspace, run.c.file), 'utf8'), 'started\n');
        if (scenario !== 'auth') assert.ok(r.requests.every(r => r.mode === 'main'));
        else assert.equal(r.requests.filter(r => r.mode === 'advisor').length, 1);
        assert.equal(r.events.filter(e => e.type === 'auto-handoff-state' && e.phase === 'refining').length, 0);
        return { terminal: r.terminal.type, modes: [...new Set(r.requests.map(r => r.mode))], completedEffectsPreserved: true };
      });
      if (!['memory-only','script-only'].includes(scope)) await check('agents-overrides-and-skills-execute-through-real-tools', async () => {
        const run = await begin('main', 'instructions'), r = await finish(run);
        assert.equal(await fs.readFile(path.join(workspace, 'nested/proof.txt'), 'utf8'), 'scoped-proof\n');
        assert.ok(r.message.operations.some(o => o.name === 'write_file' && o.status === 'deferred'));
        for (const name of ['skill_open', 'skill_read', 'write_file', 'run_command']) assert.ok(r.message.operations.some(o => o.name === name && o.status === 'succeeded'));
        return { rootOverride: true, nestedOverride: true, unchosenBodyAbsent: true, scopeGateBeforeEffect: true, realFileAndCommand: true };
      });
      if (!['memory-only','script-only'].includes(scope)) await check('changed-effective-rule-blocks-real-write', async () => {
        const run = await begin('main', 'changed-rule'), r = await finish(run);
        assert.equal(await fs.stat(path.join(workspace, 'must-not-exist.txt')).then(() => true, () => false), false);
        await fs.writeFile(path.join(workspace, 'AGENTS.override.md'), 'ROOT-OVERRIDE');
        assert.ok(r.message.operations.some(o => o.name === 'write_file' && o.status === 'failed')); return { blocked: true, fileAbsent: true };
      });
      if (scope !== 'script-only') await check('learning-memory-ui-save-and-process-restart', async () => {
        const beforeConfig = await page.evaluate('window.scodex.getModelConnection()');
        await click('[aria-label="设置"]'); await page.evaluate('(()=>{const e=[...document.querySelectorAll(".settings-category")].find(e=>e.textContent.trim()==="学习成长");if(!e)throw Error("Memory settings missing");e.click()})()');
        await value('[aria-label="学习记忆内容"]', 'MEMORY-PROBE-1366：按真实文件结果核验。'); await click('.learning-memory-actions .primary-button');
        await wait(() => page.evaluate('window.scodex.getAppState().then(s=>s.learningMemory.entries.some(e=>e.text.includes("MEMORY-PROBE-1366")))'), 'Memory saved');
        assert.ok(!(await fs.readFile(path.join(profile, 'learning-memory.json'), 'utf8')).includes('MEMORY-PROBE-1366'));
        await quit(); const identity = await launch();
        const state = await page.evaluate('window.scodex.getAppState()'); assert.ok(state.learningMemory.entries.some(e => e.text.includes('MEMORY-PROBE-1366')));
        const config = await page.evaluate('window.scodex.getModelConnection()'); assert.equal(config.autoHandoffEnabled, beforeConfig.autoHandoffEnabled);assert.deepEqual(config.modelCapabilityLevels,beforeConfig.modelCapabilityLevels);
        const run = await begin('main', 'memory'); await finish(run); return { encryptedOnDisk: true, realRestart: true, injectedIntoNextTask: true, version: identity.version };
      });
    }
    if (scope === 'script-only') await check('skill-script-read-execute-and-real-file-readback', async()=>{const run=await begin('main','script');const r=await finish(run);assert.equal(await fs.readFile(path.join(workspace,'skill-script-proof.txt'),'utf8'),'script-proof\n');return {readScript:true,authorizedAbsolutePath:true,actualPowerShellExecution:true,fileReadback:true,operations:r.message.operations.map(o=>({name:o.name,status:o.status}))};});
    await check('final-visible-status-and-layout', async () => {
      await normal('main'); const geometry = await page.evaluate('(()=>{const e=document.querySelector(".composer-model-mode"),b=e?.getBoundingClientRect();return {text:[...document.querySelectorAll(".assistant-message")].at(-1)?.textContent,mode:e?.value,width:b?.width,height:b?.height,right:b?.right,viewport:innerWidth}})()');
      assert.equal(geometry.mode, 'main');assert.ok(geometry.text.includes('模式一已核验')); assert.ok(geometry.width > 0 && geometry.height > 0 && geometry.right <= geometry.viewport + 1);
      const screenshot = await page.command('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
      report.screenshot = path.join(output, 'auto-handoff-final.png'); await fs.writeFile(report.screenshot, Buffer.from(screenshot.data, 'base64')); return geometry;
    });
    report.status = 'passed';
  } catch (error) { report.status = 'failed'; report.error = error.stack; process.exitCode = 1; }
  finally {
    if (page && app?.exitCode === null) await page.evaluate('(async()=>{for(const e of window.__handoffEvents||[])if(e.requestId)await window.scodex.cancelMessage(e.requestId)})()').catch(() => {});
    for (const response of held.values()) response.destroy(); held.clear();
    await quit().catch(error => { report.quitError = error.message; });
    report.processExited = Boolean(app && app.exitCode !== null);
    if (server) { const done = new Promise(resolve => server.close(resolve)); server.closeAllConnections(); await done; }
    if (report.processExited && path.dirname(fixture) === path.resolve(os.tmpdir()) && path.basename(fixture).startsWith('scodex-auto-handoff-ui-')) {
      await fs.rm(fixture, { recursive: true, force: true }).then(() => { report.cleanup = 'passed'; }).catch(error => { report.cleanup = 'failed'; report.cleanupError = error.message; });
    } else report.cleanup = 'blocked';
    if (!report.processExited || report.cleanup !== 'passed') { report.status = 'failed'; process.exitCode = 1; }
    report.fixtureRemoved = await fs.stat(fixture).then(() => false, () => true);
    report.exeSha256 = sha(await fs.readFile(executable));
    await persist(); console.log(json({ status: report.status, checks: report.checks.length, cleanup: report.cleanup, report: path.join(output, 'auto-handoff-ui.json') }));
    if (report.error) console.error(report.error);
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
