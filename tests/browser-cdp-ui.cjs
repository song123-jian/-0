const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const http = require('node:http');
const { spawn, execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { connect, wait, freePort } = require('./agent-workflow-ui.cjs');

const execFileAsync = promisify(execFile);
const root = path.resolve(__dirname, '..');
const scope = process.env.SCODEX_CDP_SCOPE || 'full';
const version = process.env.SCODEX_CDP_VERSION || '1.3.24';
if (!['full', 'recovery', 'recovery-ui', 'recovery-ui-final', 'boundary', 'boundary-final', 'boundary-network', 'delivery-final', 'delivery-utf8', 'restart-only', 'formal-boundary', 'formal-smoke', 'formal'].includes(scope)) throw Error('Unknown CDP acceptance scope');
const output = process.env.SCODEX_CDP_OUTPUT ? path.resolve(process.env.SCODEX_CDP_OUTPUT) : path.join(root, 'release', 'browser-cdp-20261101', scope);
const executable = process.env.SCODEX_CDP_EXE || path.join(root, 'release', 'browser-cdp-20261101', 'candidate', 'Scodex-Workbench-1.3.24-x64.exe');
const temporary = path.join(os.tmpdir(), `scodex-browser-cdp-${crypto.randomUUID()}`);
const profile = path.join(temporary, 'profile');
const workspace = path.join(temporary, 'project');
const fakeRoot = path.join(temporary, 'scodex');
const settingsPath = path.join(profile, 'settings.json');
const report = { status: 'running', version, executable, checks: [], environment: { platform: os.platform(), release: os.release(), node: process.version } };
const json = JSON.stringify;
const requests = [];
const sockets = new Set();
const flowPages = [];
let child;
let socket;
let cdp;
let server;
let webBase;
let debugPort;
let aiTabId;
let manualTabId;
let hadFailure = false;
let currentPrompt;
let currentChatId;
let foreignTarget;
let workerSession;

async function saveReport() {
  await fs.mkdir(output, { recursive: true });
  await fs.writeFile(path.join(output, 'cdp-ui-verification.json'), json(report, null, 2) + '\n');
}

async function check(name, action) {
  if (scope === 'restart-only' && !['settings-toggle-and-persistence', 'restart-keeps-cdp-settings'].includes(name)) return;
  if (scope.startsWith('delivery-') && !['settings-toggle-and-persistence', 'unicode-delivery', 'restart-keeps-cdp-settings'].includes(name)) return;
  if (!scope.startsWith('delivery-') && name === 'unicode-delivery') return;
  if (scope === 'formal-smoke' && !['settings-toggle-and-persistence', 'formal-cdp-smoke'].includes(name)) return;
  if (scope !== 'formal-smoke' && name === 'formal-cdp-smoke') return;
  const boundariesOnly = ['boundary', 'boundary-final', 'boundary-network', 'formal-boundary'].includes(scope);
  if (boundariesOnly && !['settings-toggle-and-persistence', 'cdp-target-and-unicode-boundaries', 'restart-keeps-cdp-settings'].includes(name)) return;
  if (!boundariesOnly && name === 'cdp-target-and-unicode-boundaries') return;
  if (scope.startsWith('recovery') && name === 'actual-cdp-command-and-event-pagination') return;
  if (scope.startsWith('recovery-ui') && name === 'manual-tab-isolation') return;
  if (scope === 'formal' && ['manual-tab-isolation', 'disable-during-approval-revokes-command', 'disabled-catalog-and-execution'].includes(name)) return;
  const evidence = await action();
  report.checks.push({ name, status: 'passed', evidence });
  await saveReport();
  console.log(`PASS ${name}`);
}

async function click(label) {
  const selector = `[aria-label=${json(label)}]`;
  await wait(() => cdp.evaluate(`(() => { const e=document.querySelector(${json(selector)}); if(!e||e.disabled)return false; e.scrollIntoView({block:'center'}); e.click(); return true; })()`), `Button ${label}`);
}

async function textClick(selector, label) {
  await wait(() => cdp.evaluate(`(() => { const e=[...document.querySelectorAll(${json(selector)})].find(v=>v.textContent.trim()===${json(label)}); if(!e||e.disabled)return false; e.scrollIntoView({block:'center'}); e.click(); return true; })()`), `Text ${label}`);
}

async function preferences() {
  return JSON.parse(await fs.readFile(settingsPath, 'utf8')).preferences;
}

async function toggle(name, key, value) {
  const selector = `[aria-label=${json(name)}]`;
  const current = await cdp.evaluate(`document.querySelector(${json(selector)})?.getAttribute('aria-checked')`);
  if (current !== String(value)) await click(name);
  await wait(async () => (await preferences())[key] === value, `${name} preference saved`);
  await wait(() => cdp.evaluate(`document.querySelector(${json(selector)})?.getAttribute('aria-checked')===${json(String(value))}`), `${name} rendered state`);
}

async function openBrowserSettings() {
  await click('设置');
  await textClick('.settings-category-list button', '浏览器');
  await wait(() => cdp.evaluate('document.querySelector(".settings-detail-heading h1")?.textContent==="浏览器"'), 'Browser settings');
}

async function startChat() {
  await click('新建对话');
  await wait(() => cdp.evaluate('!document.querySelector(".message-list")'), 'New chat');
}

async function submit(name) {
  const content = `SCODEX_CDP_CASE:${name}`;
  await cdp.evaluate(`(() => { const e=document.querySelector('[aria-label="输入工作内容"]'); if(!e)throw Error('Composer missing'); const p=HTMLTextAreaElement.prototype; Object.getOwnPropertyDescriptor(p,'value').set.call(e,${json(content)}); e.dispatchEvent(new Event('input',{bubbles:true})); })()`);
  await click('发送消息');
  currentPrompt = content;
  const chat = await wait(() => cdp.evaluate('window.scodex.getAppState().then(s=>s.library.conversations.find(c=>c.messages.some(m=>m.role==="user"&&m.content===' + json(content) + ')))'), 'Current request saved');
  currentChatId = chat.id;
}

async function finish() {
  const response = await wait(async () => {
    if (await cdp.evaluate('Boolean(document.querySelector("[aria-label=停止生成]"))')) return false;
    const chat = await cdp.evaluate('window.scodex.getAppState().then(s=>s.library.conversations.find(c=>c.id===' + json(currentChatId) + '))');
    const index = chat?.messages.findLastIndex(m => m.role === 'user' && m.content === currentPrompt);
    const last = index >= 0 ? chat.messages[index + 1] : null;
    return last && !last.pending && last.content ? last : false;
  }, 'Current response persisted', 60000);
  return response.content;
}

async function waitForApproval(expected) {
  return wait(async () => {
    const text = await cdp.evaluate('document.querySelector(".agent-approval")?.innerText');
    return text && (!expected || expected.test(text)) ? text : false;
  }, 'CDP approval', 40000);
}

async function approve(expected) {
  const text = await waitForApproval(expected);
  await textClick('.agent-approval-actions button', '允许本次网页操作');
  return text;
}

async function approveUntilDone() {
  let count = 0;
  while (count < 16) {
    const state = await wait(() => cdp.evaluate('document.querySelector(".agent-approval")?"approval":!document.querySelector("[aria-label=停止生成]")?"done":false'), 'Approval or completion', 45000);
    if (state === 'done') return count;
    await approve();
    count++;
  }
  throw new Error('Approval limit reached');
}

async function activeOperations() {
  return wait(async () => {
    const operations = await cdp.evaluate('window.scodex.getAppState().then(s=>{const c=s.library.conversations.find(v=>v.id===' + json(currentChatId) + ');return c?.messages.at(-1)?.operations||[]})');
    return operations.length && operations.every(operation => operation.status !== 'running') ? operations : false;
  }, 'Operation history saved');
}

function textOf(value) {
  return typeof value === 'string' ? value : Array.isArray(value) ? value.filter((part) => part.type === 'text').map((part) => part.text).join('\n') : '';
}

function streamReply(response, value) {
  const finishReason = value.tool_calls ? 'tool_calls' : 'stop';
  response.writeHead(200, { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-cache' });
  response.end(`data: ${json({ choices: [{ delta: value }] })}\n\n` +
    `data: ${json({ choices: [{ delta: {}, finish_reason: finishReason }] })}\n\n` +
    'data: [DONE]\n\n');
}

function toolCall(name, args) {
  return { tool_calls: [{ index: 0, id: `cdp_${crypto.randomBytes(8).toString('hex')}`, type: 'function', function: { name, arguments: json(args) } }] };
}

function toolResults(body) {
  return body.messages.filter((message) => message.role === 'tool').map((message) => JSON.parse(message.content));
}

function consoleValues(page) {
  return page.events.flatMap((event) => event.params?.args || []).map((argument) => argument.value).filter((value) => typeof value === 'string');
}

async function model(body, response) {
  const prompt = body.messages.findLast((message) => message.role === 'user' && textOf(message.content).includes('SCODEX_CDP_CASE:'));
  const testCase = textOf(prompt?.content).split('SCODEX_CDP_CASE:')[1]?.split('\n')[0] || 'unknown';
  const results = toolResults(body);
  const names = (body.tools || []).map((item) => item.function.name);
  const step = results.length;
  requests.push({ case: testCase, step, tools: names });
  const done = (content) => streamReply(response, { content });
  const emit = (name, args) => streamReply(response, toolCall(name, args));

  if (testCase === 'flow') {
    assert.ok(names.includes('browser_cdp') && names.includes('browser_cdp_events'), 'CDP tools missing while enabled');
    if (step === 0) return emit('browser_open', { url: `${webBase}/page` });
    if (step === 1) {
      assert.equal(results[0]?.ok, true, json(results[0]));
      aiTabId = results[0].tab.id;
      return emit('browser_cdp', { tab_id: aiTabId, method: 'Runtime.enable', params: {} });
    }
    if (step === 2) {
      assert.equal(results[1]?.ok, true, json(results[1]));
      return emit('browser_cdp', { tab_id: aiTabId, method: 'Runtime.evaluate', params: {
        expression: "for(let i=0;i<5;i++)console.log('scodex-cdp-event-'+i); 'done'",
        awaitPromise: true, returnByValue: true, userGesture: true,
      } });
    }
    if (step === 3) {
      assert.equal(results[2]?.cdp_result?.result?.value, 'done', json(results[2]));
      return emit('browser_cdp_events', { tab_id: aiTabId, after: 0, limit: 2, method: 'Runtime.consoleAPICalled' });
    }
    if (step >= 4 && step <= 6) {
      const page = results[step - 1]?.cdp_events;
      assert.ok(page?.events?.length, `Event page missing at step ${step}: ${json(results[step - 1])}`);
      assert.equal(page.events.length, step === 6 ? 1 : 2);
      const values = consoleValues(page);
      assert.ok(values.some((value) => value.startsWith('scodex-cdp-event-')), json(page));
      flowPages.push({ next_after: page.next_after, has_more: page.has_more, event_count: page.events.length, values });
      if (step < 6) {
        assert.equal(page.has_more, true, json(page));
        return emit('browser_cdp_events', { tab_id: aiTabId, after: page.next_after, limit: 2, method: 'Runtime.consoleAPICalled' });
      }
      assert.equal(page.has_more, false, json(page));
      assert.deepEqual(flowPages.flatMap((entry) => entry.values).filter((value) => value.startsWith('scodex-cdp-event-')).sort(),
        Array.from({ length: 5 }, (_, index) => `scodex-cdp-event-${index}`).sort());
      return emit('browser_cdp', { tab_id: aiTabId, method: 'Runtime.evaluate', params: { expression: "'x'.repeat(3*1024*1024)", returnByValue: true } });
    }
    if (step === 7) {
      assert.equal(results[6]?.cdp_result?.result?.value?.length, 3 * 1024 * 1024, 'Large result must reach the model unchanged');
      report.largeModelResultBytes = Buffer.byteLength(json(results[6]), 'utf8');
      return done('完整 CDP 命令与事件分页通过');
    }
    throw new Error(`Unexpected CDP flow step ${step}`);
  }

  if (testCase === 'manual-tab') {
    if (!step) return emit('browser_cdp', { tab_id: manualTabId, method: 'Runtime.evaluate', params: { expression: 'globalThis.__manualTabWasAccessed=true' } });
    assert.equal(results[0]?.ok, false, json(results[0]));
    assert.match(json(results[0]), /不属于当前对话|AI 标签页已关闭/);
    return done('手工标签拒绝通过');
  }

  if (testCase === 'smoke') {
    if (!step) return emit('browser_open', { url: webBase + '/page?formal=1' });
    if (step === 1) {
      assert.equal(results[0].ok, true);
      return emit('browser_cdp', { tab_id: results[0].tab.id, method: 'Runtime.evaluate', params: { expression: '21*2', returnByValue: true } });
    }
    assert.equal(results[1].cdp_result.result.value, 42);
    return done('正式入口 CDP 通过');
  }

  if (testCase === 'unicode-only') {
    if (!step) return emit('browser_open', { url: webBase + '/page?unicode=1' });
    if (step === 1) return emit('browser_cdp', { tab_id: results[0].tab.id, method: 'Runtime.evaluate', params: { expression: "'汉'.repeat(Math.floor((4*1024*1024-64*1024-256)/3))", returnByValue: true } });
    const actual = results[1].cdp_result.result.value;
    const expected = '汉'.repeat(Math.floor((4 * 1024 * 1024 - 64 * 1024 - 256) / 3));
    report.unicodeEvidence = { actualLength: actual.length, expectedLength: expected.length, head: actual.slice(0, 96), tail: actual.slice(-128), bytes: Buffer.byteLength(actual, 'utf8'), expectedSha256: crypto.createHash('sha256').update(expected).digest('hex'), actualSha256: crypto.createHash('sha256').update(actual).digest('hex'), modelEnvelopeBytes: Buffer.byteLength(json(results[1]), 'utf8') };
    await saveReport();
    assert.equal(report.unicodeEvidence.actualSha256, report.unicodeEvidence.expectedSha256);
    assert.ok(report.unicodeEvidence.modelEnvelopeBytes <= 4 * 1024 * 1024);
    return done('中文大结果完整传递通过');
  }

  if (testCase === 'boundaries') {
    if (!step) return emit('browser_open', { url: webBase + '/page?boundary=1' });
    if (step === 1) {
      assert.equal(results[0].ok, true);
      aiTabId = results[0].tab.id;
      return emit('browser_cdp', { tab_id: aiTabId, method: 'Target.getTargets' });
    }
    if (step === 2) {
      const targets = results[1].cdp_result.targetInfos;
      assert.equal(targets.length, 1);
      assert.equal(targets[0].url, webBase + '/page?boundary=1');
      assert.notEqual(targets[0].targetId, foreignTarget.targetId);
      return emit('browser_cdp', { tab_id: aiTabId, method: 'Target.attachToTarget', params: { targetId: foreignTarget.targetId, flatten: true } });
    }
    if (step === 3) {
      assert.equal(results[2].ok, false);
      assert.match(json(results[2]), /当前 AI 标签/);
      return emit('browser_cdp', { tab_id: aiTabId, method: 'Browser.getVersion' });
    }
    if (step === 4) {
      assert.equal(results[3].ok, false);
      assert.match(json(results[3]), /浏览器全局/);
      return emit('browser_cdp', { tab_id: aiTabId, method: 'Storage.getCookies', params: { browserContextId: foreignTarget.browserContextId || 'foreign-context' } });
    }
    if (step === 5) {
      assert.equal(results[4].ok, false);
      assert.match(json(results[4]), /浏览器上下文/);
      return emit('browser_cdp', { tab_id: aiTabId, method: 'Runtime.enable', session_id: 'unowned-session' });
    }
    if (step === 6) {
      assert.equal(results[5].ok, false);
      assert.match(json(results[5]), /子会话/);
      return emit('browser_cdp', { tab_id: aiTabId, method: 'Target.setAutoAttach', params: { autoAttach: true, flatten: true, waitForDebuggerOnStart: false } });
    }
    if (step === 7) {
      assert.equal(results[6].ok, true, json(results[6]));
      return emit('browser_cdp', { tab_id: aiTabId, method: 'Runtime.evaluate', params: { expression: '(async()=>{document.cookie="scodex-ai-marker=owned; path=/";globalThis.boundaryWorker=new Worker(URL.createObjectURL(new Blob(["postMessage(42);"],{type:"text/javascript"})));await new Promise(resolve=>boundaryWorker.onmessage=resolve);return true})()', awaitPromise: true, returnByValue: true } });
    }
    if (step === 8) {
      assert.equal(results[7].cdp_result.result.value, true);
      return emit('browser_cdp_events', { tab_id: aiTabId, after: 0, limit: 100, method: 'Target.attachedToTarget' });
    }
    if (step === 9) {
      const child = results[8].cdp_events.events.find(event => event.params.targetInfo.type === 'worker');
      assert.ok(child, json(results[8]));
      workerSession = child.params.sessionId;
      return emit('browser_cdp', { tab_id: aiTabId, method: 'Runtime.evaluate', session_id: workerSession, params: { expression: '21*2', returnByValue: true } });
    }
    if (step === 10) {
      assert.equal(results[9].cdp_result.result.value, 42);
      return emit('browser_cdp', { tab_id: aiTabId, method: 'Storage.getCookies' });
    }
    if (step === 11) {
      const names = results[10].cdp_result.cookies.map(cookie => cookie.name);
      assert.ok(names.includes('scodex-ai-marker'));
      assert.equal(names.includes('scodex-manual-marker'), false);
      report.cookieIsolation = names;
      return emit('browser_cdp', { tab_id: aiTabId, method: 'Runtime.evaluate', params: { expression: "'汉'.repeat(Math.floor((4*1024*1024-64*1024-256)/3))", returnByValue: true } });
    }
    if (step === 12) {
      assert.equal(results[11].cdp_result.result.value.length, Math.floor((4 * 1024 * 1024 - 64 * 1024 - 256) / 3));
      report.unicodeModelResultBytes = Buffer.byteLength(json(results[11]), 'utf8');
      assert.ok(report.unicodeModelResultBytes <= 4 * 1024 * 1024);
      return done('目标隔离、受管子会话与中文结果包络通过');
    }
    throw new Error('Unexpected boundary step ' + step);
  }

  if (testCase === 'approval-revoked') {
    if (!step) return emit('browser_open', { url: webBase + '/page?revocation=1' });
    if (step === 1) {
      assert.equal(results[0]?.ok, true, json(results[0]));
      aiTabId = results[0].tab.id;
      return emit('browser_cdp', { tab_id: aiTabId, method: 'Runtime.evaluate', params: { expression: 'globalThis.__cdpAfterRevocation=true' } });
    }
    assert.equal(results[1]?.ok, false, json(results[1]));
    assert.match(json(results[1]), /CDP.*关闭|关闭.*CDP|访问权限/);
    return done('审批期间关闭 CDP 后命令被拒绝');
  }

  if (testCase === 'disabled-catalog') {
    assert.equal(names.some((name) => name.startsWith('browser_cdp')), false, 'CDP tools remain in catalog after disabling');
    if (!step) return emit('browser_cdp', { tab_id: aiTabId, method: 'Runtime.evaluate', params: { expression: '1+1' } });
    assert.equal(results[0]?.ok, false, json(results[0]));
    assert.match(json(results[0]), /没有开放此工具|CDP|关闭/);
    return done('关闭状态未暴露或执行 CDP');
  }

  return done('未识别的 CDP 验收场景');
}

const html = '<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>CDP 隔离验收</title><body><h1>本机 CDP 验收页面</h1><p>受控本地页面。</p><script>window.fixtureReady=true;</script></body></html>';

async function launch() {
  child = spawn(executable, [`--remote-debugging-port=${debugPort}`, `--user-data-dir=${profile}`, '--disable-gpu'], {
    cwd: path.dirname(executable), windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, SCODEX_HOME: fakeRoot, SCODEX_REFERENCE_HOME: path.join(temporary, 'reference'), SCODEX_REFERENCE_AGENTS_HOME: path.join(temporary, 'agents') },
  });
  let log = '';
  child.stdout.on('data', (chunk) => { log = (log + chunk).slice(-6000); });
  child.stderr.on('data', (chunk) => { log = (log + chunk).slice(-6000); });
  const target = await wait(async () => {
    if (child.exitCode !== null) throw new Error(`Portable EXE exited ${child.exitCode}: ${log}`);
    return (await fetch(`http://127.0.0.1:${debugPort}/json/list`).then((result) => result.json())).find((item) => item.type === 'page' && item.url.startsWith('file:'));
  }, 'Actual candidate startup', 45000);
  socket = new WebSocket(target.webSocketDebuggerUrl);
  sockets.add(socket);
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
  cdp = connect(socket);
  await cdp.command('Runtime.enable');
  await cdp.command('Page.enable');
  await wait(() => cdp.evaluate('Boolean(window.scodex && document.querySelector("[aria-label=输入工作内容]"))'), 'Actual workbench renderer');
  const state = await cdp.evaluate('window.scodex.getAppState().then(s=>({version:s.version,userDataPath:s.userDataPath,historyError:s.historyError}))');
  assert.equal(state.version, version);
  assert.equal(state.userDataPath.toLowerCase(), profile.toLowerCase());
  assert.equal(state.historyError, '');
  return state;
}

async function cleanupOwnedProcess() {
  try {
    const escapedProfile = profile.replaceAll("'", "''");
    const script = `$needle='${escapedProfile}';Get-CimInstance Win32_Process -Filter "Name='Scodex工作台.exe'" | Where-Object {$_.CommandLine -and $_.CommandLine.Contains($needle) -and $_.CommandLine -notmatch '--type='} | Select-Object -ExpandProperty ProcessId`;
    const result = await execFileAsync('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', script], { windowsHide: true, timeout: 7000 });
    const pids = result.stdout.trim().split(/\s+/).filter((value) => /^\d+$/.test(value));
    for (const pid of pids) await execFileAsync('taskkill.exe', ['/PID', pid, '/T', '/F'], { windowsHide: true, timeout: 8000 });
    report.cleanedIsolatedProcesses = pids.map(Number);
  } catch (error) {
    report.cleanupError = error.message;
  }
}

async function main() {
  try {
    assert.equal(await fs.stat(executable).then(() => true, () => false), true, `Candidate missing: ${executable}`);
    await fs.mkdir(profile, { recursive: true });
    await fs.mkdir(workspace, { recursive: true });
    await fs.mkdir(fakeRoot, { recursive: true });
    await fs.writeFile(settingsPath, json({ workspaceRoot: workspace, preferences: { browserPanelOpen: false, browserAiEnabled: false, browserCdpEnabled: false, trayEnabled: false } }));
    await fs.writeFile(path.join(fakeRoot, 'codex-settings.json'), json({ sandboxMode: 'danger-full-access', approvalPolicy: 'on-request', workspaceDependencies: false }));
    report.candidateSha256 = crypto.createHash('sha256').update(await fs.readFile(executable)).digest('hex');

    server = http.createServer(async (request, response) => {
      try {
        if (request.url === '/v1/chat/completions') {
          const chunks = [];
          for await (const chunk of request) chunks.push(chunk);
          const raw = Buffer.concat(chunks).toString('utf8');
          return await model(JSON.parse(raw), response);
        }
        response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
        response.end(html);
      } catch (error) {
        report.fixtureError = error.stack;
        if (!response.headersSent) response.writeHead(500, { 'content-type': 'application/json' });
        response.end(json({ error: 'Controlled CDP fixture failed.' }));
      }
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    webBase = `http://127.0.0.1:${server.address().port}`;
    debugPort = await freePort();
    const identity = await launch();
    report.program = { ...identity, environment: { platform: os.platform(), release: os.release(), node: process.version }, browser: await cdp.evaluate('navigator.userAgent') };

    await cdp.evaluate(`window.scodex.saveAgentSettings(${json({ sandboxMode: 'danger-full-access', approvalPolicy: 'on-request', networkAccess: true, networkDomains: ['*'], allowLocalBinding: true, networkConfigured: true })},"shared")`);
    await cdp.evaluate(`window.scodex.saveModelConnection(${json({ name: 'CDP 本机验收', baseUrl: `${webBase}/v1`, model: 'controlled-cdp-model', models: ['controlled-cdp-model'], toolProtocol: 'native', apiKey: 'controlled-only' })})`);
    await cdp.evaluate('location.reload()');
    await wait(() => cdp.evaluate('Boolean(document.querySelector("[aria-label=输入工作内容]"))'), 'Workbench reload');

    await check('settings-toggle-and-persistence', async () => {
      await openBrowserSettings();
      await toggle('允许 AI 使用内置浏览器', 'browserAiEnabled', true);
      await toggle('启用完整 CDP 访问权限', 'browserCdpEnabled', true);
      const state = await cdp.evaluate('window.scodex.getAppState().then(s=>({browserAiEnabled:s.preferences.browserAiEnabled,browserCdpEnabled:s.preferences.browserCdpEnabled}))');
      const disk = await preferences();
      assert.equal(state.browserAiEnabled, true);
      assert.equal(state.browserCdpEnabled, true);
      assert.equal(disk.browserAiEnabled, true);
      assert.equal(disk.browserCdpEnabled, true);
      return { state, disk, settingsUI: true };
    });

    const manual = await cdp.evaluate(`window.scodex.browserAction(${json({ type: 'new', url: `${webBase}/page?manual=1` })})`);
    manualTabId = manual.activeId;
    await wait(async () => (await cdp.evaluate('window.scodex.getBrowserState()')).tabs.some((tab) => tab.id === manualTabId && !tab.loading), 'Manual tab ready');

    await check('formal-cdp-smoke', async () => {
      await startChat();
      await submit('smoke');
      // Each expected command is distinct; never re-approve a stale completed DOM.
      const approvalTexts = [await approve(/打开网页|browser_open/), await approve(/Runtime[.]evaluate/)];
      const approvals = approvalTexts.length;
      const answer = await finish();
      assert.match(answer, /正式入口 CDP 通过/);
      const operations = await activeOperations();
      assert.equal(operations.length, 2);
      assert.ok(operations.every(operation => operation.status === 'succeeded'));
      return { approvals, approvalTexts, operations: operations.length, answer };
    });

    await check('unicode-delivery', async () => {
      await startChat();
      await submit('unicode-only');
      const approvals = await approveUntilDone();
      const answer = await finish();
      assert.match(answer, /中文大结果完整传递通过/);
      return { approvals, ...report.unicodeEvidence, answer };
    });

    await check('cdp-target-and-unicode-boundaries', async () => {
      const targets = await cdp.command('Target.getTargets');
      foreignTarget = targets.targetInfos.find(target => target.url === webBase + '/page?manual=1');
      assert.ok(foreignTarget);
      const manualDebugTarget = (await fetch('http://127.0.0.1:' + debugPort + '/json/list').then(response => response.json())).find(target => target.id === foreignTarget.targetId);
      assert.ok(manualDebugTarget?.webSocketDebuggerUrl);
      const manualSocket = new WebSocket(manualDebugTarget.webSocketDebuggerUrl);
      sockets.add(manualSocket);
      await new Promise((resolve, reject) => { manualSocket.addEventListener('open', resolve, { once: true }); manualSocket.addEventListener('error', reject, { once: true }); });
      await connect(manualSocket).command('Network.setCookie', { name: 'scodex-manual-marker', value: 'controlled-only', url: webBase });
      manualSocket.close();
      await startChat();
      await submit('boundaries');
      const approvals = await approveUntilDone();
      const answer = await finish();
      assert.match(answer, /目标隔离、受管子会话与中文结果包络通过/);
      const operations = await activeOperations();
      assert.equal(operations.length, 12);
      assert.equal(operations.filter(operation => operation.status === 'failed').length, 4);
      return { approvals, operations: operations.length, foreignTargetBlocked: foreignTarget.targetId, workerSession, unicodeModelResultBytes: report.unicodeModelResultBytes, answer };
    });

    await check('actual-cdp-command-and-event-pagination', async () => {
      await startChat();
      await submit('flow');
      const approvals = await approveUntilDone();
      const answer = await finish();
      assert.match(answer, /完整 CDP 命令与事件分页通过/);
      const operations = await activeOperations();
      assert.equal(operations.filter((operation) => operation.name.startsWith('browser_cdp') || operation.name === 'browser_open').length, 7);
      assert.equal(operations.filter((operation) => operation.status === 'succeeded').length, 7);
      assert.equal(flowPages.length, 3);
      assert.deepEqual(flowPages.map((page) => page.event_count), [2, 2, 1]);
      assert.equal(flowPages[0].has_more, true);
      assert.equal(flowPages[2].has_more, false);
      return { approvals, operations: operations.length, pages: flowPages, tabId: aiTabId, answer };
    });

    await check('manual-tab-isolation', async () => {
      await startChat();
      await submit('manual-tab');
      const answer = await finish();
      assert.match(answer, /手工标签拒绝通过/);
      assert.equal(await cdp.evaluate('Boolean(document.querySelector(".agent-approval"))'), false);
      const operations = await activeOperations();
      assert.equal(operations.length, 1);
      assert.equal(operations[0].status, 'failed');
      return { manualTabId, aiTabId, rejectedBeforeApproval: true, answer };
    });

    await check('disable-during-approval-revokes-command', async () => {
      await startChat();
      await submit('approval-revoked');
      await approve();
      const approval = await waitForApproval();
      assert.match(approval, /Runtime\.evaluate/);
      await openBrowserSettings();
      await toggle('启用完整 CDP 访问权限', 'browserCdpEnabled', false);
      await wait(async () => (await preferences()).browserCdpEnabled === false, 'CDP setting disabled on disk');
      await click('项目');
      await approve();
      const answer = await finish();
      assert.match(answer, /审批期间关闭 CDP 后命令被拒绝/);
      const operations = await activeOperations();
      assert.equal(operations.length, 2);
      assert.equal(operations[0].status, 'succeeded');
      assert.equal(operations[1].status, 'failed');
      assert.match(operations[1].output, /CDP.*关闭|关闭.*CDP|访问权限/);
      return { persistedDisabled: true, approvalWasShown: true, commandRejected: true, answer };
    });

    await check('disabled-catalog-and-execution', async () => {
      await startChat();
      await submit('disabled-catalog');
      const answer = await finish();
      assert.match(answer, /关闭状态未暴露或执行 CDP/);
      const disabledRequest = requests.find((request) => request.case === 'disabled-catalog');
      assert.ok(disabledRequest);
      assert.equal(disabledRequest.tools.some((name) => name.startsWith('browser_cdp')), false);
      const operations = await activeOperations();
      assert.equal(operations.length, 1);
      assert.equal(operations[0].status, 'failed');
      await click('设置');
      await textClick('.settings-category-list button', '浏览器');
      await wait(() => cdp.evaluate('document.querySelector(".settings-detail-heading h1")?.textContent==="浏览器"'), 'Browser settings after disable');
      const settingSelector = `[aria-label=${json('启用完整 CDP 访问权限')}]`;
      const visible = await cdp.evaluate(`document.querySelector(${json(settingSelector)})?.getAttribute('aria-checked')`);
      assert.equal(visible, 'false');
      return { catalogWithoutCdp: true, forcedCallRejected: true, renderedSwitch: visible, answer };
    });

    await check('restart-keeps-cdp-settings', async () => {
      await openBrowserSettings();
      await toggle('启用完整 CDP 访问权限', 'browserCdpEnabled', true);
      await cdp.evaluate('window.scodex.quitApp()');
      await wait(() => Promise.resolve(child.exitCode !== null), 'First candidate fully exited', 20000);
      socket.close();
      debugPort = await freePort();
      const identity = await launch();
      await openBrowserSettings();
      const selector = '[aria-label="启用完整 CDP 访问权限"]';
      const restored = await cdp.evaluate('document.querySelector(' + json(selector) + ').getAttribute("aria-checked")');
      assert.equal(restored, 'true');
      assert.equal((await preferences()).browserCdpEnabled, true);
      await cdp.evaluate('document.querySelector(' + json(selector) + ').scrollIntoView({block:"center"})');
      const screenshot = await cdp.command('Page.captureScreenshot', { format: 'png' });
      const screenshotPath = path.join(output, 'cdp-settings.png');
      await fs.writeFile(screenshotPath, Buffer.from(screenshot.data, 'base64'));
      return { identity, restored, screenshotPath };
    });
    report.requests = requests;
    report.status = 'passed';
  } catch (error) {
    hadFailure = true;
    report.status = 'failed';
    report.error = error.stack;
    process.exitCode = 1;
    console.error(error);
    try { report.visibleText = await cdp.evaluate('document.body.innerText'); } catch {}
  } finally {
    try {
      if (socket?.readyState === 1) {
        await cdp.evaluate('window.scodex.quitApp()');
        await wait(() => Promise.resolve(child.exitCode !== null), 'Isolated candidate exit', 20000);
      }
    } catch (error) {
      report.quitError = error.message;
    }
    for (const ws of sockets) ws.close();
    if (child?.exitCode === null) child.kill();
    await cleanupOwnedProcess();
    server?.closeAllConnections();
    if (server) await new Promise((resolve) => server.close(resolve));
    report.fixtureDirectory = temporary;
    report.finishedAt = new Date().toISOString();
    await saveReport();
    if (!hadFailure) {
      const tempPath = path.resolve(temporary);
      const tempRoot = path.resolve(os.tmpdir());
      if (!tempPath.startsWith(tempRoot + path.sep) || !path.basename(tempPath).startsWith('scodex-browser-cdp-')) throw new Error('Refusing to clean an unexpected fixture path.');
      await fs.rm(tempPath, { recursive: true, force: true, maxRetries: 8, retryDelay: 250 });
      report.fixtureCleaned = true;
      await saveReport();
    }
    console.log(`RESULT ${report.status} ${path.join(output, 'cdp-ui-verification.json')}`);
  }
}

if (require.main === module) main();
