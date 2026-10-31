const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const http = require('node:http');
const net = require('node:net');
const { spawn, execFile } = require('node:child_process');
const executeFile = require('node:util').promisify(execFile);
const project = path.resolve(__dirname, '..');
const output = path.resolve(project, process.env.SCODEX_CHAT_OUTPUT || 'release/chat-reference-20261024');
const temp = path.join(os.tmpdir(), 'scodex-chat-reference-' + crypto.randomUUID());
const profile = path.join(temp, 'profile'), workspace = path.join(temp, 'workspace'), fakeRoot = path.join(temp, 'root');
const json = JSON.stringify;
const remainingOnly = process.env.SCODEX_CHAT_UI_SCOPE === "remaining";
const captureOnly = process.env.SCODEX_CHAT_UI_SCOPE === 'layout-capture';
const layoutOnly = process.env.SCODEX_CHAT_UI_SCOPE === 'layout' || captureOnly;
const requestOffset = remainingOnly ? 2 : 0;
const report = { date: new Date().toISOString(), environment: os.platform() + ' ' + os.release(), checks: [], status: 'running', limitations: ['Controlled local SSE service replaces public model generation.', 'CDP delivers actual local files to the packaged app; physical pointer drag and native OS picker are not automated.'] };
async function waitFor(fn, label, duration = 20000) {
  const end = Date.now() + duration; let last;
  while (Date.now() < end) { try { const value = await fn(); if (value) return value; } catch (e) { last = e; } await new Promise(r => setTimeout(r, 100)); }
  throw new Error(label + (last ? ': ' + last.message : ''));
}
function connect(socket) {
  let id = 0; const pending = new Map();
  socket.addEventListener('message', ({ data }) => { const m = JSON.parse(data), p = pending.get(m.id); if (!p) return; pending.delete(m.id); clearTimeout(p.timer); m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result); });
  const command = (method, params = {}) => new Promise((resolve, reject) => { const key = ++id; const timer = setTimeout(() => { pending.delete(key); reject(new Error('CDP timeout ' + method)); }, 20000); pending.set(key, { resolve, reject, timer }); socket.send(json({ id: key, method, params })); });
  return { command, async evaluate(expression) { const r = await command('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, userGesture: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result?.value; } };
}
async function main() {
  let child, socket, cdp; let behavior = 'normal'; const posts = [];
  const server = http.createServer(async (req, res) => {
    if (req.method !== 'POST') { res.writeHead(200, { 'content-type': 'application/json' }); res.end(json({ data: [{ id: 'reference-model' }] })); return; }
    let raw = ''; for await (const chunk of req) raw += chunk; posts.push(JSON.parse(raw));
    if (behavior === 'error') { behavior = 'normal'; res.writeHead(503).end(); return; }
    res.writeHead(200, { 'content-type': 'text/event-stream' }); res.write('data: ' + json({ choices: [{ delta: { content: '已收到附件与输入。中文输出正常。' } }] }) + '\n\n');
    if (behavior === 'slow') { behavior = 'normal'; const timer = setTimeout(() => res.end('data: [DONE]\n\n'), 45000); res.on('close', () => clearTimeout(timer)); }
    else res.end('data: [DONE]\n\n');
  });
  const check = name => { report.checks.push({ name, status: 'passed' }); console.log('PASS ' + name); };
  const launch = async () => {
    const ports = net.createServer(); await new Promise(r => ports.listen(0, '127.0.0.1', r)); const port = ports.address().port; await new Promise(r => ports.close(r));
    const executable = path.join(output, 'win-unpacked', 'Scodex工作台.exe');
    child = spawn(executable, ['--remote-debugging-port=' + port, '--user-data-dir=' + profile, '--disable-gpu'], { cwd: project, env: { ...process.env, SCODEX_HOME: fakeRoot }, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    child.stdout.resume(); let diagnostic = ''; child.stderr.on('data', b => { diagnostic = (diagnostic + b).slice(-5000); });
    const target = await waitFor(async () => { if (child.exitCode !== null) throw new Error(diagnostic); return (await fetch('http://127.0.0.1:' + port + '/json/list').then(r => r.json())).find(t => t.type === 'page'); }, 'App startup', 60000);
    socket = new WebSocket(target.webSocketDebuggerUrl); await new Promise((r, j) => { socket.addEventListener('open', r, { once: true }); socket.addEventListener('error', j, { once: true }); }); cdp = connect(socket);
    await waitFor(() => cdp.evaluate('Boolean(document.querySelector(".task-chat-view .composer-box"))'), 'Main chat ready');
    const state = await cdp.evaluate('window.scodex.getAppState()'), build = JSON.parse(await fs.readFile(path.join(output, 'integration-build.json'), 'utf8'));
    assert.equal(state.version, build.version); assert.equal(await cdp.evaluate('[...document.scripts].some(s=>s.src.endsWith(' + json(build.renderer) + '))'), true);
    Object.assign(report, { executable, version: state.version, renderer: build.renderer });
  };
  const close = async () => { await cdp.command('Browser.close').catch(() => {}); await waitFor(() => child.exitCode !== null, 'App exit'); socket.close(); cdp = null; };
  const click = selector => cdp.evaluate('(()=>{const e=document.querySelector(' + json(selector) + ');if(!e||e.disabled)throw new Error("Unavailable " + ' + json(selector) + ');e.click();})()');
  const clickText = (value, selector = 'button') => cdp.evaluate('(()=>{const e=[...document.querySelectorAll(' + json(selector) + ')].find(e=>e.textContent.trim()===' + json(value) + '&&!e.disabled);if(!e)throw new Error("Unavailable button "+' + json(value) + ');e.click();})()');
  const input = async (selector, value) => { await cdp.evaluate('document.querySelector(' + json(selector) + ').focus()'); for (const type of ['keyDown', 'keyUp']) await cdp.command('Input.dispatchKeyEvent', { type, key: 'a', code: 'KeyA', modifiers: 2, windowsVirtualKeyCode: 65 }); await cdp.command('Input.insertText', { text: value }); };
  const done = () => waitFor(() => cdp.evaluate('!document.querySelector(".thinking-indicator") && !document.querySelector(\'[aria-label="停止生成"]\')'), 'Generation complete');
  const pick = async (files) => { const doc = await cdp.command('DOM.getDocument'); const { nodeId } = await cdp.command('DOM.querySelector', { nodeId: doc.root.nodeId, selector: '[aria-label="选择聊天附件"]' }); assert.ok(nodeId); await cdp.command('DOM.setFileInputFiles', { nodeId, files }); };
  const drag = async files => {
    const rect = await cdp.evaluate('(()=>{const r=document.querySelector(".task-chat-view").getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()');
    const data = { items: [], files, dragOperationsMask: 1 };
    await cdp.command('Input.dispatchDragEvent', { type: 'dragEnter', ...rect, data });
    await waitFor(() => cdp.evaluate('document.querySelector(".chat-file-drop-overlay")?.textContent.includes("松开即可添加")'), 'Drop overlay');
    await cdp.command('Input.dispatchDragEvent', { type: 'dragOver', ...rect, data }); await cdp.command('Input.dispatchDragEvent', { type: 'drop', ...rect, data });
  };
  try {
    await fs.mkdir(profile, { recursive: true }); await fs.mkdir(workspace); await fs.mkdir(fakeRoot);
    const manualSkillDirectory = path.join(fakeRoot, 'skills', 'reference-manual');
    await fs.mkdir(manualSkillDirectory, { recursive: true });
    await fs.writeFile(path.join(manualSkillDirectory, 'SKILL.md'), '---\nname: reference-manual\ndescription: Controlled manual selection fixture\n---\nREFERENCE_MANUAL_SKILL_MARKER\n');
    await fs.writeFile(path.join(profile, 'settings.json'), json({ workspaceRoot: workspace, preferences: { browserPanelOpen: false, themeMode: 'light', fontSize: 16, notifyOnComplete: false, notifyOnIssues: false } }));
    const textPath = path.join(temp, '拖入文本.txt'), docPath = path.join(temp, '任意文件.docx'), pngPath = path.join(temp, 'photo.png');
    await fs.writeFile(textPath, '文件正文：中文与 emoji 🚀'); await fs.writeFile(docPath, Buffer.from([80, 75, 0, 1, 3]));
    await fs.copyFile(path.join(project, "build/icon.png"), pngPath);
    if (layoutOnly) {
      const now = new Date().toISOString();
      await fs.writeFile(path.join(profile, 'conversations.json'), json({ version: 2, activeId: 'layout-reference', conversations: [{ id: 'layout-reference', title: '第二工作页面', createdAt: now, updatedAt: now, reasoningEffort: 'max', messages: [{ id: 'layout-user', role: 'user', content: '按照参考图使用第二工作页面。' }, { id: 'layout-assistant', role: 'assistant', content: '在这里输入工作内容，或将文件拖入聊天页。\n\n输入栏提供附件、权限、模型和回答深度选择；聊天内容保存在本机。' }] }] }));
    }
    if (remainingOnly) {
      const { normalizeChatAttachments } = require('../electron/chat-attachments.cjs');
      const attachments = normalizeChatAttachments([{ name: '拖入文本.txt', data: await fs.readFile(textPath) }, { name: '任意文件.docx', data: await fs.readFile(docPath) }]);
      const now = new Date().toISOString();
      await fs.writeFile(path.join(profile, 'conversations.json'), json({ version: 2, activeId: 'resume-reference', conversations: [{ id: 'resume-reference', title: '附件验收', createdAt: now, updatedAt: now, messages: [{ id: 'resume-user', role: 'user', content: '', attachments }, { id: 'resume-assistant', role: 'assistant', content: '受控历史测试数据' }] }] }));
      report.reused = 'chat-ui-first-verification.json: first two groups; product unchanged. Seeded history is controlled test data.';
    }
    await fs.writeFile(path.join(workspace, '验收代码.txt'), '实际文件内容'); await fs.mkdir(path.join(workspace, '子目录'));
    await new Promise(r => server.listen(0, '127.0.0.1', r)); const endpoint = 'http://127.0.0.1:' + server.address().port;
    await launch();
    const savedConnection = await cdp.evaluate('window.scodex.saveModelConnection(' + json({ name: '隔离验收服务', baseUrl: endpoint + '/v1', model: 'reference-model', models: ['reference-model', 'alternate-model'], reasoningEffort: '', subagentReasoningEffort: '', apiKey: crypto.randomUUID() }) + ')');
    assert.equal(savedConnection.model, 'reference-model');
    await cdp.command('Page.reload'); await waitFor(() => cdp.evaluate('window.scodex.getAppState().then(s=>s.model==="reference-model")'), 'Configuration applied');
    await waitFor(() => cdp.evaluate('Boolean(document.querySelector(".task-chat-view .composer-box"))'), 'Chat renderer after reload');
    const controls = ['添加工具和上下文', '更改权限', '回答深度', '选择模型'].map((label) => 'Boolean(document.querySelector(' + json(`[aria-label="${label}"]`) + '))').join('&&');
    assert.equal(await cdp.evaluate(controls), true);
    if (layoutOnly) {
      const baseline = JSON.parse(await fs.readFile(path.join(project, 'release/chat-reference-final-ui-20261024/chat-ui-verification.json'), 'utf8'));
      assert.equal(baseline.status, 'passed'); assert.equal(baseline.cleanup, 'passed');
      report.reusedFunctional = { report: 'release/chat-reference-final-ui-20261024/chat-ui-verification.json', renderer: baseline.renderer, checks: baseline.checks.length, requests: baseline.requests, reason: 'Only the second-page permission-button display/alignment CSS changed; request, persistence, file, terminal and other behavior sources are unchanged.' };
      if (captureOnly) {
        const previous = JSON.parse(await fs.readFile(path.join(output, 'chat-layout-verification.json'), 'utf8'));
        assert.equal(previous.status, 'passed'); assert.equal(previous.cleanup, 'passed'); assert.equal(previous.renderer, report.renderer);
        report.reusedLayout = { report: 'chat-layout-verification.json', checks: previous.checks.length }; report.geometry = previous.geometry;
        await cdp.evaluate('document.querySelector("[aria-label=\\"输入工作内容\\"]").focus()');
        await waitFor(() => cdp.evaluate('!document.querySelector(".toast")&&!document.querySelector(".composer-popover")'), 'Unobstructed composer screenshot');
        const shot = await cdp.command('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }); report.screenshot = path.join(output, 'workbench-main-chat.png'); await fs.writeFile(report.screenshot, Buffer.from(shot.data, 'base64'));
        assert.equal(posts.length, 0); report.requests = 0; await close(); check('Clean final screenshot without transient overlay; zero model requests and clean exit'); report.status = 'passed'; return;
      }
      report.geometry = [];
      const geometry = async (label) => {
        const value = await cdp.evaluate('(()=>{const p=document.querySelector(".composer-permission"),i=p.querySelector("svg").getBoundingClientRect(),t=p.querySelector("span").getBoundingClientRect(),b=p.getBoundingClientRect(),c=document.querySelector(".composer-box").getBoundingClientRect();return {width:innerWidth,height:innerHeight,text:p.textContent,iconLeft:i.left,iconRight:i.right,textLeft:t.left,centerDelta:Math.abs(i.y+i.height/2-t.y-t.height/2),buttonLeft:b.left,buttonRight:b.right,composerLeft:c.left,composerRight:c.right,composerBottom:c.bottom,documentWidth:document.documentElement.scrollWidth}})()');
        assert.ok(value.iconRight <= value.textLeft, label + ': icon precedes text'); assert.ok(value.centerDelta < 1, label + ': centered horizontally');
        assert.ok(value.buttonLeft >= value.composerLeft && value.buttonRight <= value.composerRight && value.composerLeft >= 0 && value.composerRight <= value.width && value.composerBottom <= value.height && value.documentWidth <= value.width, label + ': viewport bounds');
        report.geometry.push({ label, ...value });
      };
      await geometry('1464×901 manual permission');
      await click('[aria-label="更改权限"]'); await click('[role="radio"][aria-checked="false"]'); await waitFor(() => cdp.evaluate('document.querySelector(".composer-permission").textContent.includes("仅对话")'), 'Restricted permission layout');
      await geometry('1464×901 restricted permission');
      await click('[aria-label="更改权限"]'); await click('[role="radio"][aria-checked="false"]'); await waitFor(() => cdp.evaluate('document.querySelector(".composer-permission").textContent.includes("完全访问")'), 'Full permission restored');
      check('Permission icon/text share a horizontal centerline in both modes');
      await cdp.command('Emulation.setDeviceMetricsOverride', { width: 1064, height: 660, deviceScaleFactor: 1, mobile: false });
      await geometry('1064×660 manual permission');
      await click('[aria-label="添加工具和上下文"]'); await waitFor(() => cdp.evaluate('Boolean(document.querySelector(".composer-popover"))'), 'Narrow tools menu');
      assert.equal(await cdp.evaluate('(()=>{const r=document.querySelector(".composer-popover").getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight})()'), true);
      await cdp.evaluate('document.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",bubbles:true}))'); await waitFor(() => cdp.evaluate('!document.querySelector(".composer-popover")'), 'Tools dismissed');
      await cdp.command('Emulation.clearDeviceMetricsOverride'); await geometry('1464×901 restored permission');
      check('Wide/narrow input bar and tool menu remain within the viewport');
      const shot = await cdp.command('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }); report.screenshot = path.join(output, 'workbench-main-chat.png'); await fs.writeFile(report.screenshot, Buffer.from(shot.data, 'base64'));
      assert.equal(posts.length, 0); report.requests = 0; await close(); check('Final layout screenshot, zero model requests and clean exit'); report.status = 'passed'; return;
    }
    await click('[aria-label="添加工具和上下文"]'); await waitFor(() => cdp.evaluate('Boolean(document.querySelector(".composer-popover[aria-label=\\"添加工具和上下文\\"]"))'), 'Composer tools popover');
    assert.equal(await cdp.evaluate('document.querySelector(".composer-popover").textContent.includes("文件和文件夹")'), true);
    await waitFor(() => cdp.evaluate('[...document.querySelectorAll(".composer-menu-item")].some(e=>e.querySelector(".composer-item-copy > span")?.textContent==="reference-manual")'), 'Manual skill available');
    await cdp.evaluate('[...document.querySelectorAll(".composer-menu-item")].find(e=>e.querySelector(".composer-item-copy > span")?.textContent==="reference-manual").click()');
    await waitFor(() => cdp.evaluate('!document.querySelector(".composer-popover")'), 'Manual skill selected');
    await click('[aria-label="添加工具和上下文"]');
    await waitFor(() => cdp.evaluate('Boolean(document.querySelector(".composer-popover"))'), 'Composer tools reopened');
    await cdp.evaluate('[...document.querySelectorAll(".composer-menu-item")].find(e=>e.querySelector(".composer-item-copy > span")?.textContent==="计划模式").click()');
    await waitFor(() => cdp.evaluate('!document.querySelector(".composer-popover")'), 'Plan mode selected');
    await click('[aria-label="添加工具和上下文"]');
    await waitFor(() => cdp.evaluate('Boolean(document.querySelector(".composer-popover"))'), 'Composer tools reopened after plan');
    await cdp.evaluate('document.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",bubbles:true}))'); await waitFor(() => cdp.evaluate('!document.querySelector(".composer-popover")'), 'Composer tools dismissed');
    assert.equal(await cdp.evaluate('(()=>{const model=document.querySelector("[aria-label=\\"选择模型\\"]"),effort=document.querySelector("[aria-label=\\"回答深度\\"]"),set=Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,"value").set;set.call(model,"alternate-model");model.dispatchEvent(new Event("change",{bubbles:true}));set.call(effort,"high");effort.dispatchEvent(new Event("change",{bubbles:true}));return model.value==="alternate-model"&&effort.value==="high";})()'), true);
    check('Composer tool menu, permission, model and effort controls');
    assert.equal(await cdp.evaluate('[...document.querySelectorAll(".composer-box input[type=file]")].every(e=>getComputedStyle(e).clipPath==="inset(50%)"&&e.getBoundingClientRect().width<=1)'), true);
    if (!remainingOnly) {
    await drag([textPath, docPath]); await waitFor(() => cdp.evaluate('document.querySelectorAll(".composer-attachment-list .chat-file-card").length===2'), 'Dropped files ready');
    assert.equal(await cdp.evaluate('document.querySelector(".composer-attachment-list").textContent.includes("正文暂不解析")'), true);
    await click('[aria-label="移除附件 任意文件.docx"]'); await pick([docPath]); await waitFor(() => cdp.evaluate('document.querySelectorAll(".composer-attachment-list .chat-file-card").length===2'), 'Re-added file'); check('Main page drag overlay, arbitrary files, remove and picker');
    await click('[aria-label="发送消息"]'); await waitFor(() => posts.length===1, 'File request'); await done();
    assert.equal(posts[0].model, 'alternate-model'); assert.equal(posts[0].reasoning_effort, 'high');
    assert.match(posts[0].messages[0].content, /REFERENCE_MANUAL_SKILL_MARKER/);
    assert.match(posts[0].messages[0].content, /当前为规划模式/);
    assert.match(posts[0].messages.at(-1).content, /文件正文：中文与 emoji 🚀/); assert.match(posts[0].messages.at(-1).content, /请勿声称已经读取正文/); assert.equal(await cdp.evaluate('document.querySelectorAll(".message-file-list .chat-file-card").length'), 2);
    await waitFor(() => cdp.evaluate('window.scodex.getAppState().then(s=>{const m=s.library.conversations.find(c=>c.id===s.library.activeId)?.messages.find(x=>x.role==="user");return m?.model==="alternate-model"&&m.reasoningEffort==="high"&&m.skillId==="skills/reference-manual/SKILL.md"&&m.mode==="plan"})'), 'Selected model, depth, skill and mode persisted');
    check('Selected model, depth, manual skill and plan mode reach request and saved message');
    const currentConnection = await cdp.evaluate('window.scodex.getModelConnection()');
    await cdp.evaluate('window.scodex.saveModelConnection(' + json({ ...currentConnection, models: ['reference-model'], model: 'reference-model' }) + ')');
    await cdp.command('Page.reload'); await waitFor(() => cdp.evaluate('Boolean(document.querySelector(".task-chat-view .composer-box"))&&document.querySelector("[aria-label=\\"选择模型\\"]")?.value==="reference-model"'), 'Removed model fallback');
    check('Removed model selection falls back to configured default');
    await input('[aria-label="输入工作内容"]', '继续分析'); await click('[aria-label="发送消息"]'); await waitFor(() => posts.length===2, 'History request'); await done(); assert.equal(posts[1].model, 'reference-model'); assert.equal(posts[1].reasoning_effort, 'high'); assert.ok(posts[1].messages.some(m=>m.role==='user'&&typeof m.content==='string'&&m.content.includes('文件正文：中文'))); check('File-only send, actual request content, file echo and continued history');
    }
    await pick([pngPath]); await waitFor(() => cdp.evaluate('document.querySelectorAll(".composer-attachment-list img").length===1'), 'Image preview'); await click('[aria-label="发送消息"]'); await waitFor(() => posts.length===(3-requestOffset), 'Image request'); await done(); assert.equal(posts[2-requestOffset].messages.at(-1).content[1].type, 'image_url'); assert.equal(await cdp.evaluate('document.querySelectorAll(".user-message .message-image-list img").length'), 1); check('Image-only send and multimodal message echo');
    await pick([textPath]); await waitFor(() => cdp.evaluate('Boolean(document.querySelector(".composer-attachment-list"))'), 'Pending file'); await click('[aria-label="更改权限"]'); await click('[role="radio"][aria-checked="false"]'); await waitFor(() => cdp.evaluate('document.querySelector(".composer-permission").textContent.includes("仅对话")&&!document.querySelector(".composer-attachment-list")'), 'Restricted mode');
    assert.match(await cdp.evaluate('window.scodex.prepareChatAttachments([{name:"x",data:new Uint8Array([1])}]).then(()=>"unexpected").catch(e=>e.message)'), /仅对话/);
    await input('[aria-label="输入工作内容"]', '仅对话检查'); await click('[aria-label="发送消息"]'); await waitFor(() => posts.length===(4-requestOffset), 'Restricted request'); await done(); assert.equal(posts[3-requestOffset].messages.some(m=>Array.isArray(m.content)||(m.role==='user'&&m.content.includes('文件正文：中文'))), false); await click('[aria-label="更改权限"]'); await click('[role="radio"][aria-checked="false"]'); check('Permission clear, IPC rejection and historical attachment/image stripping');
    behavior='slow'; await input('[aria-label="输入工作内容"]', '停止验收'); await click('[aria-label="发送消息"]'); await waitFor(() => posts.length===(5-requestOffset), 'Slow stream'); await click('[aria-label="停止生成"]'); await waitFor(() => cdp.evaluate('document.querySelector(".cancelled-label")?.textContent.includes("停止了")'), 'Stopped label');
    behavior='error'; await pick([textPath]); await waitFor(() => cdp.evaluate('Boolean(document.querySelector(".composer-attachment-list"))'), 'Retry file'); await input('[aria-label="输入工作内容"]', '错误重试验收'); await click('[aria-label="发送消息"]'); await waitFor(() => cdp.evaluate('document.querySelector(".message-error")?.textContent.includes("503")'), '503 card'); await click('.retry-message'); await waitFor(() => posts.length===(7-requestOffset), 'Retry request'); await done(); assert.match(posts.at(-1).messages.at(-1).content, /文件正文：中文/); check('Streaming cancel, elapsed label, 503 error and file-aware retry');
    await pick([docPath]); await waitFor(() => cdp.evaluate('Boolean(document.querySelector(".composer-attachment-list"))'), 'Unsent file'); await click('[aria-label="新聊天"]'); await waitFor(() => cdp.evaluate('!document.querySelector(".composer-attachment-list")&&!document.querySelector(".user-message")'), 'New chat'); check('New chat isolates pending files');
    await click('[aria-label="打开第三工作台"]'); await waitFor(() => cdp.evaluate('Boolean(document.querySelector(".browser-newtab"))'), 'Tools'); await clickText('侧边聊天', '.browser-tool-list button'); await input('[aria-label="输入侧边聊天内容"]', '临时侧聊验收'); await click('[aria-label="发送侧边聊天消息"]'); await waitFor(() => cdp.evaluate('document.querySelector(".side-chat-reply")?.textContent.includes("中文输出正常")'), 'Side reply'); check('Tool start page and actual side chat');
    await click('[aria-label="新建标签页"]'); await waitFor(() => cdp.evaluate('Boolean(document.querySelector(".browser-tool-list"))'), 'Terminal start'); await clickText('终端PowerShell', '.browser-tool-list button'); await waitFor(() => cdp.evaluate('document.querySelector(\'[aria-label="PowerShell 命令"]\')?.disabled===false'), 'PowerShell ready'); await input('[aria-label="PowerShell 命令"]', 'Write-Output "终端中文验证"'); await click('[aria-label="执行命令"]'); await waitFor(() => cdp.evaluate('document.querySelector(".terminal-output")?.textContent.split("终端中文验证").length>=3&&document.querySelector(\'[aria-label="PowerShell 命令"]\')?.disabled===false'), 'PowerShell output'); check('Real embedded PowerShell UTF-8 execution and prompt');
    await click('[aria-label="新建标签页"]'); await waitFor(() => cdp.evaluate('Boolean(document.querySelector(".browser-tool-list"))'), 'File start'); await clickText('文件', '.browser-tool-list button'); await waitFor(() => cdp.evaluate('document.querySelector(".workspace-file-items")?.textContent.includes("验收代码.txt")'), 'Files'); await input('[aria-label="筛选文件"]', '验收代码'); await clickText('验收代码.txt', '.workspace-file-entry'); await clickText('打开文件', '.workspace-file-preview button'); await waitFor(() => cdp.evaluate('document.querySelector(".cm-content")?.textContent.includes("实际文件内容")'), 'Editor'); check('File panel actual listing, filter, selection and editor open');
    await click('[aria-label="关闭标签 终端"]'); await click('[aria-label="收起标签工作台"]');
    const saved = await cdp.evaluate('window.scodex.getAppState().then(s=>s.library.conversations.find(c=>c.messages.some(m=>m.attachments?.length)))'); assert.ok(saved); assert.match(saved.title, /\.txt$/); await cdp.evaluate('[...document.querySelectorAll(".recent-item")].find(e=>e.textContent===' + json(saved.title) + ').click()'); await waitFor(() => cdp.evaluate('document.querySelectorAll(".message-file-list .chat-file-card").length>=2'), 'Select history'); await waitFor(async () => JSON.parse(await fs.readFile(path.join(profile, 'conversations.json'), 'utf8')).conversations.some(c=>c.messages.some(m=>m.attachments?.length)), 'Persisted attachments');
    await close(); await launch(); assert.equal(await cdp.evaluate('document.querySelectorAll(".message-file-list .chat-file-card").length>=2'), true); assert.equal(await cdp.evaluate('document.querySelector("[aria-label=\\"选择模型\\"]").value==="reference-model"&&document.querySelector("[aria-label=\\"回答深度\\"]").value==="high"'), true); check('Clean app restart restores file, image, model and depth history');
    await cdp.command('Emulation.setDeviceMetricsOverride', { width:1064,height:660,deviceScaleFactor:1,mobile:false }); assert.equal(await cdp.evaluate('document.documentElement.scrollWidth<=innerWidth&&(()=>{const r=document.querySelector(".composer-box").getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.bottom<=innerHeight;})()'), true); await cdp.command('Emulation.clearDeviceMetricsOverride'); check('1064×660 composer viewport bounds');
    const shot=await cdp.command('Page.captureScreenshot',{format:'png',captureBeyondViewport:false}); report.screenshot=path.join(output,'workbench-main-chat.png'); await fs.writeFile(report.screenshot,Buffer.from(shot.data,'base64')); await close(); check('Final screenshot and clean application exit'); report.requests=posts.length; report.status='passed';
  } catch(e) { report.status='failed';report.error=e.stack;console.error(e);process.exitCode=1;if(cdp)report.ui=await cdp.evaluate('Promise.all([window.scodex.getAppState(),window.scodex.getModelConnection()]).then(([state,connection])=>({body:document.body.innerText.slice(-3500),url:location.href,appModel:state.model,connectionModel:connection.model,connectionError:connection.error,hasCredential:connection.hasCredential}))').catch(async()=>cdp.evaluate('({body:document.body.innerText.slice(-3500),url:location.href})').catch(()=>null)); }
  finally {
    if(cdp&&child?.exitCode===null)await cdp.command('Browser.close').catch(()=>{});if(socket?.readyState===WebSocket.OPEN)socket.close();if(child?.exitCode===null)await waitFor(()=>child.exitCode!==null,'Cleanup exit',5000).catch(()=>executeFile('taskkill.exe',['/PID',String(child.pid),'/T','/F'],{windowsHide:true}).catch(()=>{}));
    server.closeAllConnections();await new Promise(r=>server.close(r));try{if(path.dirname(temp)!==os.tmpdir()||!path.basename(temp).startsWith('scodex-chat-reference-'))throw new Error('Unsafe cleanup');await fs.rm(temp,{recursive:true,force:true,maxRetries:3});report.cleanup='passed';}catch(e){report.cleanup=e.message;process.exitCode=1;}
    await fs.writeFile(path.join(output,captureOnly ? 'chat-capture-verification.json' : layoutOnly ? 'chat-layout-verification.json' : 'chat-ui-verification.json'),json(report,null,2));
  }
}
main().catch(e=>{console.error(e);process.exitCode=1;});
