const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const http = require('node:http');
const net = require('node:net');
const { spawn } = require('node:child_process');
const fixtures = require('./attachment-fixtures.cjs');
const project = path.resolve(__dirname, '..');
const output = path.resolve(project, process.env.SCODEX_ATTACHMENT_OUTPUT || 'release/attachment-body-ready-20261024');
const temp = path.join(os.tmpdir(), 'scodex-attachment-body-' + crypto.randomUUID());
const profile = path.join(temp, 'profile'), workspace = path.join(temp, 'workspace'), home = path.join(temp, 'home');
const json = JSON.stringify;
const finishOnly = process.argv.includes('--finish');
const exited = (child) => child.exitCode !== null || child.signalCode !== null;
const report = { date: new Date().toISOString(), environment: os.platform() + ' ' + os.release(), checks: [], status: 'running', limitations: ['Local SSE replaces public model generation.', 'CDP supplies controlled files to the real packaged UI; native picker/drop results are inherited from the previous unchanged entry points.'] };

async function waitFor(fn, label, duration = 25000) {
  const end = Date.now() + duration; let last;
  while (Date.now() < end) { try { const value = await fn(); if (value) return value; } catch (error) { last = error; } await new Promise((resolve) => setTimeout(resolve, 100)); }
  throw new Error(label + (last ? ': ' + last.message : ''));
}

function connect(socket) {
  let id = 0; const pending = new Map();
  socket.addEventListener('message', ({ data }) => { const value = JSON.parse(data), entry = pending.get(value.id); if (!entry) return; pending.delete(value.id); clearTimeout(entry.timer); value.error ? entry.reject(new Error(value.error.message)) : entry.resolve(value.result); });
  socket.addEventListener('close', () => { for (const entry of pending.values()) { clearTimeout(entry.timer); entry.reject(new Error('App connection closed')); } pending.clear(); });
  const command = (method, params = {}) => new Promise((resolve, reject) => { const key = ++id, timer = setTimeout(() => { pending.delete(key); reject(new Error('CDP timeout ' + method)); }, 25000); pending.set(key, { resolve, reject, timer }); socket.send(json({ id: key, method, params })); });
  return { command, async evaluate(expression) { const result = await command('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, userGesture: true }); if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text); return result.result?.value; } };
}

async function main() {
  let child, socket, cdp; const posts = [], paths = {};
  const server = http.createServer(async (request, response) => {
    if (request.method !== 'POST') { response.writeHead(200, { 'content-type': 'application/json' }); response.end(json({ data: [{ id: 'parser-test-model' }] })); return; }
    let raw = ''; for await (const chunk of request) raw += chunk;
    posts.push(JSON.parse(raw));
    response.writeHead(200, { 'content-type': 'text/event-stream' });
    response.end('data: ' + json({ choices: [{ delta: { content: '正文解析受控验收完成。' } }] }) + '\n\ndata: [DONE]\n\n');
  });
  const check = (name, evidence = {}) => { report.checks.push({ name, status: 'passed', ...evidence }); console.log('PASS ' + name); };
  const launch = async () => {
    const listener = net.createServer(); await new Promise((resolve) => listener.listen(0, '127.0.0.1', resolve)); const port = listener.address().port; await new Promise((resolve) => listener.close(resolve));
    const executable = path.join(output, 'win-unpacked/Scodex工作台.exe');
    child = spawn(executable, ['--remote-debugging-port=' + port, '--user-data-dir=' + profile, '--disable-gpu'], { cwd: project, env: { ...process.env, SCODEX_HOME: home }, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    child.stdout.resume(); let diagnostic = ''; child.stderr.on('data', (chunk) => { diagnostic = (diagnostic + chunk).slice(-4000); });
    const target = await waitFor(async () => { if (child.exitCode !== null) throw new Error(diagnostic); return (await fetch(`http://127.0.0.1:${port}/json/list`).then((response) => response.json())).find((item) => item.type === 'page'); }, 'Packaged startup', 60000);
    socket = new WebSocket(target.webSocketDebuggerUrl); await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
    cdp = connect(socket); await waitFor(() => cdp.evaluate('Boolean(document.querySelector(".task-chat-view .composer-box"))'), 'Main chat ready');
    await cdp.evaluate('document.title="Scodex 正文解析验收（仅测试）"');
    const state = await cdp.evaluate('window.scodex.getAppState()'), build = JSON.parse(await fs.readFile(path.join(output, 'integration-build.json'), 'utf8'));
    assert.equal(state.version, build.version); assert.equal(path.resolve(state.userDataPath), profile); assert.equal(path.resolve(state.workspaceRoot), workspace);
    assert.equal(await cdp.evaluate('[...document.scripts].some(s=>s.src.endsWith(' + json(build.renderer) + '))'), true);
    Object.assign(report, { executable, version: state.version, renderer: build.renderer, buildSha256: build.executableSha256 });
  };
  const close = async () => { await cdp.command('Browser.close').catch(() => {}); await waitFor(() => exited(child), 'App exit'); assert.equal(child.exitCode, 0); socket.close(); cdp = null; };
  const click = (selector) => cdp.evaluate('(()=>{const e=document.querySelector(' + json(selector) + ');if(!e||e.disabled)throw new Error("Unavailable " + ' + json(selector) + ');e.click();})()');
  const input = async (value) => { await cdp.evaluate('document.querySelector("[aria-label=\\"输入工作内容\\"]").focus()'); for (const type of ['keyDown', 'keyUp']) await cdp.command('Input.dispatchKeyEvent', { type, key: 'a', code: 'KeyA', modifiers: 2, windowsVirtualKeyCode: 65 }); await cdp.command('Input.insertText', { text: value }); };
  const pick = async (names) => { const doc = await cdp.command('DOM.getDocument'); const { nodeId } = await cdp.command('DOM.querySelector', { nodeId: doc.root.nodeId, selector: '[aria-label="选择聊天附件"]' }); assert.ok(nodeId); await cdp.command('DOM.setFileInputFiles', { nodeId, files: names.map((name) => paths[name]) }); };
  const cards = () => cdp.evaluate('[...document.querySelectorAll(".composer-attachment-list .chat-file-card")].map(e=>({name:e.querySelector("strong").textContent,status:e.querySelector("small").textContent,title:e.title}))');
  const ready = (count) => waitFor(async () => { const value = await cards(); return value.length === count && await cdp.evaluate('!document.querySelector(".attachment-loading")') ? value : false; }, 'Prepared file cards', 45000);
  const saved = () => fs.readFile(path.join(profile, 'conversations.json'), 'utf8').then(JSON.parse);
  const allMessages = (library) => library.conversations.flatMap((chat) => chat.messages);
  const send = async (count) => { await click('[aria-label="发送消息"]'); await waitFor(() => posts.length === count, 'Controlled request ' + count); await waitFor(() => cdp.evaluate('!document.querySelector(".thinking-indicator")&&!document.querySelector("[aria-label=\\"停止生成\\"]")'), 'Generation complete'); };
  const content = (request) => request.messages.map((message) => typeof message.content === 'string' ? message.content : json(message.content)).join('\n');
  try {
    for (const directory of [profile, workspace, home]) await fs.mkdir(directory, { recursive: true });
    await fs.writeFile(path.join(profile, 'settings.json'), json({ workspaceRoot: workspace, preferences: { contextAccess: 'manual', browserPanelOpen: false, themeMode: 'light', fontSize: 16, notifyOnComplete: false, notifyOnIssues: false } }));
    const files = {
      '中文 Word.docx': await fixtures.docx(), '旧版 Word.doc': fixtures.legacyDoc(), '文字层.pdf': fixtures.pdf(),
      '数据.xlsx': await fixtures.xlsx(), '幻灯片.pptx': await fixtures.pptx(),
      '开放.odt': await fixtures.odf('odt'), '开放.ods': await fixtures.odf('ods'), '开放.odp': await fixtures.odf('odp'), '富文本.rtf': fixtures.rtf(),
      '未知.fixture': Buffer.from('UNKNOWN_BODY_MARKER 中文'), '损坏.docx': Buffer.from([80, 75, 0, 1, 3]),
      '加密.doc': fixtures.legacyDoc('DO_NOT_SUBMIT_ENCRYPTED_BODY', { encrypted: true }), '加密.pdf': fixtures.pdf('', { encrypted: true }),
      '扫描.pdf': fixtures.pdf('', { blank: true }), '二进制.fixture': Buffer.from([1, 2, 0, 8]),
      '大正文.docx': await fixtures.docx('中🚀'.repeat(40000)), '后添加.txt': Buffer.from('SECOND_ADDITION_BODY'), '异常循环.doc': fixtures.legacyDoc('正文', { cycle: true }),
    };
    for (const [name, data] of Object.entries(files)) { paths[name] = path.join(temp, name); await fs.writeFile(paths[name], data); }
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    await launch(); check('Actual packaged app/build and isolated profile/workspace');
    await cdp.evaluate('window.scodex.saveModelConnection(' + json({ name: '正文解析本机验收', baseUrl: `http://127.0.0.1:${server.address().port}/v1`, model: 'parser-test-model', models: ['parser-test-model'], apiKey: crypto.randomUUID() }) + ')');
    await cdp.command('Page.reload'); await waitFor(() => cdp.evaluate('window.scodex.getAppState().then(s=>s.model==="parser-test-model")'), 'Local service applied');
    await waitFor(() => cdp.evaluate('Boolean(document.querySelector(".task-chat-view .composer-box"))'), 'Reloaded composer');
    if (!finishOnly) {
    const successful = Object.keys(files).slice(0, 10);
    await pick(successful); const goodCards = await ready(10);
    assert.equal(goodCards.every((item) => item.status.includes('正文已解析')), true, json(goodCards));
    check('Ten document/text types parse through real file inputs and packaged child processes', { cards: goodCards });
    await send(1);
    for (const marker of ['DOCX正文：中文 🚀', 'DOC旧版正文：中文', 'PDF_BODY_MARKER', '苹果\t3\t6', '第一页中文正文', '开放文档正文', 'RTFbody', 'UNKNOWN_BODY_MARKER']) assert.ok(content(posts[0]).includes(marker), 'Missing request body ' + marker);
    const library = await waitFor(async () => { const value = await saved(); return allMessages(value).some((item) => item.attachments?.length === 10) ? value : false; }, 'Bodies saved');
    const record = allMessages(library).find((item) => item.attachments?.length === 10);
    assert.equal(record.attachments.every((item) => item.parsed && item.parseStatus === 'parsed' && item.format && !('data' in item)), true);
    check('Current request contains extracted bodies and disk retains normalized text/status without raw binary');
    await close(); await launch();
    await waitFor(() => cdp.evaluate('document.querySelectorAll(".message-file-list .chat-file-card").length===10'), 'Restored history cards');
    assert.equal(await cdp.evaluate('[...document.querySelectorAll(".message-file-list .chat-file-card small")].every(e=>e.textContent.includes("正文已解析"))'), true);
    await input('请继续使用上一条附件正文。'); await send(2);
    assert.ok(content(posts[1]).includes('DOCX正文：中文 🚀')); assert.ok(content(posts[1]).includes('UNKNOWN_BODY_MARKER'));
    check('Actual restart restores status/text and follow-up request uses saved attachment history');
    await pick(['损坏.docx', '加密.doc', '加密.pdf', '扫描.pdf', '二进制.fixture']);
    const badCards = await ready(5);
    for (const [index, label] of ['解析失败', '需要密码', '需要密码', '需要 OCR', '格式不支持'].entries()) assert.ok(badCards[index].status.includes(label), json(badCards));
    await send(3); const badBody = content(posts[2]); assert.match(badBody, /文件已损坏/); assert.match(badBody, /密码保护/); assert.match(badBody, /文字层/); assert.doesNotMatch(badBody, /DO_NOT_SUBMIT_ENCRYPTED_BODY/);
    await waitFor(async () => allMessages(await saved()).some((item) => item.attachments?.some((file) => file.parseStatus === 'scanned')), 'Failure status saved');
    check('Corrupt/encrypted/scanned/unsupported cards and request explanations are truthful', { cards: badCards });
    await pick(['大正文.docx']); await ready(1); await pick(['后添加.txt']); const budgetCards = await ready(2);
    assert.ok(budgetCards.every((item) => item.status.includes('正文已截断')), json(budgetCards));
    await send(4); assert.equal(content(posts[3]).includes('SECOND_ADDITION_BODY'), false); assert.match(content(posts[3]), /正文总量达到上限/);
    const large = await waitFor(async () => allMessages(await saved()).find((item) => item.attachments?.some((file) => file.name === '大正文.docx')), 'Truncated text saved');
    assert.ok(large.attachments.reduce((sum, item) => sum + Buffer.byteLength(item.text), 0) <= 128 * 1024);
    assert.equal(large.attachments[0].text.includes('\ufffd'), false); assert.equal(large.attachments[1].text, '');
    check('Separate additions share UTF-8-safe 128 KiB budget in cards, request and persisted data');
    } else {
      const previous = JSON.parse(await fs.readFile(path.join(output, 'attachment-ui-first-verification.json'), 'utf8'));
      assert.equal(previous.renderer, report.renderer); assert.equal(previous.executable, report.executable); assert.equal(previous.checks.length, 6);
      if (previous.cleanup !== 'passed') {
        const recovery = JSON.parse(await fs.readFile(path.join(project, 'release/attachment-parsing-20261024/cleanup-recovery.json'), 'utf8'));
        assert.equal(recovery.status, 'passed'); assert.equal(recovery.noMatchingProcesses, true);
        report.cleanupRecovery = 'release/attachment-parsing-20261024/cleanup-recovery.json';
      }
      assert.equal(previous.checks.every((item) => item.status === 'passed'), true);
      report.reused = { report: 'attachment-ui-first-verification.json', checks: 6, controlledRequests: 4, reason: 'Same packaged app and extracted-text implementation; only UI malformed-file expectation corrected to match the already-tested invalid/timeout/resource-limit outcomes.' };
      report.checks.push(...previous.checks.slice(1));
    }
    await pick(['异常循环.doc', '未知.fixture']);
    const afterFailure = await ready(2);
    assert.ok(afterFailure[0].status.includes('超出解析限制') || afterFailure[0].status.includes('解析超时') || (afterFailure[0].status.includes('解析失败') && afterFailure[0].title.includes('文件已损坏')), json(afterFailure));
    assert.ok(afterFailure[1].status.includes('正文已解析')); assert.equal((await cdp.evaluate('window.scodex.getAppState()')).version, report.version);
    check('Pathological parser process is contained and next attachment still parses; app stays alive', { cards: afterFailure });
    for (const name of ['异常循环.doc', '未知.fixture']) await click(`[aria-label="移除附件 ${name}"]`);
    await click('[aria-label="更改权限"]'); await click('[role="radio"][aria-checked="false"]');
    await waitFor(() => cdp.evaluate('document.querySelector(".composer-permission").textContent.includes("仅对话")'), 'Restricted permission');
    const guarded = await cdp.evaluate('window.scodex.prepareChatAttachments([{name:"guard.txt",data:new Uint8Array([65])}]).then(()=>false,e=>e.message.includes("仅对话"))');
    assert.equal(guarded, true); assert.equal(await cdp.evaluate('document.querySelector("[aria-label=\\"选择聊天附件\\"]").disabled'), true);
    await click('[aria-label="更改权限"]'); await click('[role="radio"][aria-checked="false"]');
    await waitFor(() => cdp.evaluate('!document.querySelector("[aria-label=\\"选择聊天附件\\"]").disabled'), 'Full permission restored');
    check('Permission guard still blocks parsing and file input in chat-only mode');
    await pick(['中文 Word.docx', '未知.fixture', '损坏.docx']); await ready(3);
    await cdp.command('Emulation.setDeviceMetricsOverride', { width: 1064, height: 660, deviceScaleFactor: 1, mobile: false });
    const geometry = await cdp.evaluate('(()=>{const c=document.querySelector(".composer-box").getBoundingClientRect();return {width:innerWidth,height:innerHeight,documentWidth:document.documentElement.scrollWidth,composer:{left:c.left,right:c.right,bottom:c.bottom},cards:[...document.querySelectorAll(".composer-attachment-list .chat-file-card")].map(e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right,bottom:r.bottom};})}})()');
    assert.ok(geometry.documentWidth <= geometry.width && geometry.composer.left >= 0 && geometry.composer.right <= geometry.width && geometry.composer.bottom <= geometry.height);
    assert.ok(geometry.cards.every((item) => item.left >= 0 && item.right <= geometry.width));
    await cdp.command('Emulation.clearDeviceMetricsOverride');
    await waitFor(() => cdp.evaluate('!document.querySelector(".toast")'), 'Final unobstructed screenshot');
    const shot = await cdp.command('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    report.screenshot = path.join(output, 'attachment-body.png'); await fs.writeFile(report.screenshot, Buffer.from(shot.data, 'base64'));
    check('Parsed/failure cards remain within narrow viewport; final desktop screenshot captured', { geometry });
    report.requestsThisRun = posts.length; report.requests = posts.length + (finishOnly ? 4 : 0); assert.equal(posts.length, finishOnly ? 0 : 4); await close(); check('Clean app exit; controlled local request count verified', { requestsThisRun: posts.length, requestsTotal: report.requests }); report.status = 'passed';
  } catch (error) {
    report.error = error.stack; report.status = 'failed'; report.requestsThisRun = posts.length;
    if (cdp) try { report.failureState = await cdp.evaluate('({body:document.body.innerText.slice(-5000),cards:[...document.querySelectorAll(".chat-file-card")].map(e=>({text:e.innerText,title:e.title}))})'); } catch { /* Preserve original failure. */ }
    throw error;
  } finally {
    socket?.close();
    if (child && !exited(child)) { child.kill(); await waitFor(() => exited(child), 'Test process cleanup').catch(() => {}); }
    await new Promise((resolve) => server.close(resolve));
    const boundary = path.relative(os.tmpdir(), temp);
    if (!boundary.startsWith('scodex-attachment-body-') || boundary.includes(path.sep) || path.isAbsolute(boundary)) throw new Error('Unexpected cleanup boundary');
    if (!child || exited(child)) { await fs.rm(temp, { recursive: true, force: true }); report.cleanup = 'passed'; }
    else report.cleanup = 'failed: process still running';
    if (child) report.processExit = { code: child.exitCode, signal: child.signalCode };
    await fs.writeFile(path.join(output, 'attachment-ui-verification.json'), json(report, null, 2) + '\n');
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
