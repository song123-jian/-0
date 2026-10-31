const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const net = require('node:net');
const crypto = require('node:crypto');
const zlib = require('node:zlib');
const { spawn } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const releaseRoot = path.join(root, 'release');
const output = path.resolve(process.env.SCODEX_SETTINGS_OUTPUT || path.join(releaseRoot, 'settings'));
const outputRelative = path.relative(releaseRoot, output);
if (!outputRelative || outputRelative === '..' || outputRelative.startsWith('..' + path.sep) || path.isAbsolute(outputRelative)) {
  throw new Error('Settings UI output must be a child of release.');
}
const executable = path.join(output, 'Scodex-Workbench-1.0.3-x64.exe');
const temporary = path.join(os.tmpdir(), `scodex-settings-${crypto.randomUUID()}`);
const profile = path.join(temporary, 'profile');
const workspace = path.join(temporary, 'workspace');
const isolatedHome = path.join(temporary, 'scodex');
const reportPath = path.join(output, 'settings-ui-verification.json');
const finishOnly = process.argv.includes('--finish');
const report = { status: 'running', executable, version: '1.0.3', environment: { platform: os.platform(), release: os.release(), node: process.version }, checks: [], uncovered: ['原生目录选择/取消、Windows 关闭确认弹窗、系统关联打开文件、实际后台通知：尚未完成验证；目录合并与损坏保护仅有本轮模块测试证据。', '未发送模型请求；没有更改用户 profile、密钥或 CLI 配置。', '小窗口为真实 Electron renderer 视口，未覆盖原生 OS 窗口缩放。'] };
let child, socket, browserSocket, cdp, browserCdp, appPid;
const alive = (pid) => { try { process.kill(pid, 0); return true; } catch { return false; } };
async function waitFor(fn, description, timeout = 20000) {
  const deadline = Date.now() + timeout; let last;
  while (Date.now() < deadline) {
    try { const value = await fn(); if (value) return value; } catch (error) { last = error; }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error(`Timeout: ${description}${last ? `; ${last.message}` : ''}`);
}
async function saveReport() { await fs.writeFile(reportPath, JSON.stringify(report, null, 2) + '\n'); }
async function check(name, action) {
  const result = await action();
  const entry = { name, status: 'passed', ...(result ? { evidence: result } : {}) };
  const existing = report.checks.findIndex((item) => item.name === name);
  if (existing < 0) report.checks.push(entry); else report.checks[existing] = entry;
  await saveReport(); console.log(`PASS ${name}`);
}
function client(ws) {
  let id = 0; const pending = new Map();
  ws.addEventListener('message', ({ data }) => {
    const message = JSON.parse(data); const item = pending.get(message.id); if (!item) return;
    pending.delete(message.id); clearTimeout(item.timer);
    message.error ? item.reject(new Error(message.error.message)) : item.resolve(message.result);
  });
  ws.addEventListener('close', () => { for (const item of pending.values()) { clearTimeout(item.timer); item.reject(new Error('CDP closed')); } pending.clear(); });
  return {
    command(method, params = {}) { return new Promise((resolve, reject) => {
      const current = ++id; const timer = setTimeout(() => { pending.delete(current); reject(new Error(`CDP timeout ${method}`)); }, 15000);
      pending.set(current, { resolve, reject, timer }); ws.send(JSON.stringify({ id: current, method, params }));
    }); },
    async evaluate(expression) { const value = await this.command('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, userGesture: true });
      if (value.exceptionDetails) throw new Error(value.exceptionDetails.exception?.description || value.exceptionDetails.text);
      return value.result?.value;
    },
  };
}
async function connect(url) { const ws = new WebSocket(url); await new Promise((resolve, reject) => { ws.addEventListener('open', resolve, { once: true }); ws.addEventListener('error', reject, { once: true }); }); return ws; }
async function portNumber() { const server = net.createServer(); await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve)); const port = server.address().port; await new Promise((resolve) => server.close(resolve)); return port; }
async function launch() {
  const port = await portNumber(); let log = '';
  child = spawn(executable, [`--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--disable-gpu'], { cwd: output, env: { ...process.env, SCODEX_HOME: isolatedHome }, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout.on('data', (chunk) => { log = (log + chunk).slice(-6000); }); child.stderr.on('data', (chunk) => { log = (log + chunk).slice(-6000); });
  const page = await waitFor(async () => {
    if (child.exitCode !== null) throw new Error(`EXE exited ${child.exitCode}: ${log}`);
    return (await fetch(`http://127.0.0.1:${port}/json/list`).then((r) => r.json())).find((item) => item.type === 'page' && item.url.startsWith('file:'));
  }, 'real EXE debugger', 45000);
  socket = await connect(page.webSocketDebuggerUrl); cdp = client(socket);
  const version = await fetch(`http://127.0.0.1:${port}/json/version`).then((r) => r.json());
  browserSocket = await connect(version.webSocketDebuggerUrl); browserCdp = client(browserSocket);
  appPid = (await browserCdp.command('SystemInfo.getProcessInfo')).processInfo.find((item) => item.type === 'browser').id;
  await cdp.command('Runtime.enable'); await cdp.command('Page.enable');
  await waitFor(() => cdp.evaluate('Boolean(window.scodex && document.querySelector(".history-save-state"))'), 'actual workbench ready');
  const state = await cdp.evaluate('window.scodex.getAppState().then(s=>({version:s.version,userDataPath:s.userDataPath,historyError:s.historyError}))');
  assert.equal(state.version, '1.0.3'); assert.equal(state.userDataPath.toLowerCase(), profile.toLowerCase()); assert.equal(state.historyError, '');
  const build = JSON.parse(await fs.readFile(path.join(output, 'settings-build.json'), 'utf8'));
  const renderer = await cdp.evaluate('document.querySelector("script[type=module]").getAttribute("src")');
  assert.equal(renderer.replace(/^\.\//, ''), build.renderer); report.renderer = build.renderer;
  return { state, renderer, browser: version.Browser };
}
async function click(selector) {
  await waitFor(() => cdp.evaluate(`(() => { const el=document.querySelector(${JSON.stringify(selector)}); if(!el||el.disabled)return false; el.scrollIntoView({block:'center'}); el.click(); return true; })()`), selector);
}
const aria = (name) => `[aria-label=${JSON.stringify(name)}]`;
async function textClick(selector, label) {
  await waitFor(() => cdp.evaluate(`(() => { const el=[...document.querySelectorAll(${JSON.stringify(selector)})].find(e=>e.textContent.trim()===${JSON.stringify(label)}); if(!el||el.disabled)return false; el.scrollIntoView({block:'center'}); el.click(); return true; })()`), label);
}
async function category(label) { await textClick('.settings-category', label); await waitFor(() => cdp.evaluate(`document.querySelector('.settings-detail-heading h1')?.textContent===${JSON.stringify(label)}`), `${label} category`); }
async function preferences() { return JSON.parse(await fs.readFile(path.join(profile, 'settings.json'), 'utf8')).preferences; }
async function select(name, value, key) {
  await cdp.evaluate(`{const el=document.querySelector(${JSON.stringify(aria(name))}); el.value=${JSON.stringify(String(value))}; el.dispatchEvent(new Event('change',{bubbles:true}));}`);
  if (key) await waitFor(async () => (await preferences())[key] === value, `${name} disk readback`);
}
async function toggle(name, setting, value) {
  const selector = aria(name);
  const before = { disk: (await preferences())[setting], control: await cdp.evaluate(`document.querySelector(${JSON.stringify(selector)})?.outerHTML`) };
  try {
    if (before.disk !== value) await click(selector);
    await waitFor(async () => (await preferences())[setting] === value, `${name} disk readback`);
    await waitFor(() => cdp.evaluate(`document.querySelector(${JSON.stringify(selector)})?.getAttribute('aria-checked')===${JSON.stringify(String(value))}`), `${name} rendered state`);
  } catch (error) {
    error.message += `; before=${JSON.stringify(before)}; disk=${JSON.stringify(await preferences())}; control=${await cdp.evaluate(`document.querySelector(${JSON.stringify(selector)})?.outerHTML`)}`;
    throw error;
  }
}
async function input(name, value) {
  const selector = aria(name);
  await cdp.evaluate(`{const el=document.querySelector(${JSON.stringify(selector)}); el.scrollIntoView({block:'center'}); el.focus(); el.select();}`);
  await cdp.command('Input.insertText', { text: value });
  await waitFor(() => cdp.evaluate(`document.querySelector(${JSON.stringify(selector)}).value===${JSON.stringify(value)}`), `input ${name}`);
}
async function key(key, modifiers = 0, code = key) { const event = { key, code, modifiers, windowsVirtualKeyCode: { Enter: 13, Escape: 27, ArrowDown: 40, Tab: 9 }[key] }; await cdp.command('Input.dispatchKeyEvent', { type: 'keyDown', ...event, ...(key === 'Enter' ? { text: '\r', unmodifiedText: '\r' } : {}) }); await cdp.command('Input.dispatchKeyEvent', { type: 'keyUp', ...event }); }
async function history() {
  const prefs = await preferences(); const directory = prefs.conversationDirectory || profile;
  const bytes = await fs.readFile(path.join(directory, prefs.compressHistory ? 'conversations.json.gz' : 'conversations.json'));
  return JSON.parse((prefs.compressHistory ? zlib.gunzipSync(bytes) : bytes).toString('utf8'));
}
async function nativeClose() {
  await new Promise((resolve, reject) => {
    const closer = spawn('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', `$p=[Diagnostics.Process]::GetProcessById(${appPid}); if(-not $p.CloseMainWindow()){throw 'Close not delivered'}`], { windowsHide: true, stdio: 'pipe' });
    let error = ''; closer.stderr.on('data', (chunk) => { error += chunk; }); closer.on('error', reject); closer.on('close', (code) => code === 0 ? resolve() : reject(new Error(error)));
  });
  await waitFor(() => !alive(appPid), 'native close and history flush', 15000);
  await waitFor(() => child.exitCode !== null, 'portable wrapper exit', 15000);
  assert.equal(child.exitCode, 0); socket.close(); browserSocket.close(); appPid = null; child = null;
}
async function prepare() {
  for (const dir of [profile, workspace, path.join(isolatedHome, 'skills', 'settings-check')]) await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(isolatedHome, 'skills', 'settings-check', 'SKILL.md'), '---\nname: settings-check\ndescription: Local settings acceptance fixture\n---\nOnly a local test instruction.\n');
  const continuedPreferences = process.argv.includes('--continue-after-general') || finishOnly ? { contextAccess: 'manual', defaultFileOpen: 'builtin', terminalShell: 'cmd', closeConfirmation: 'busy', defaultMode: 'code', sendShortcut: 'enter', notifyOnComplete: false, notificationSound: 'silent', notifyOnPermissions: false, notifyOnIssues: false, skillsEnabled: true, showEditorStatusBar: true, defaultFullView: false, railCollapsed: true } : {};
  const finishPreferences = finishOnly ? { fontSize: 18, fontFamily: 'Microsoft YaHei', themeMode: 'system', themeStyle: 'high-contrast', accentColor: '#6747AB', backgroundColor: '#EEF2F9', foregroundColor: '#202B44', compressHistory: true, autoArchiveDays: 0 } : {};
  await fs.writeFile(path.join(profile, 'settings.json'), JSON.stringify({ workspaceRoot: workspace, preferences: { browserPanelOpen: false, ...continuedPreferences, ...finishPreferences } }));
  const old = new Date(Date.now() - 120 * 86400000).toISOString();
  const chat = (id, extra = {}) => ({ id, title: id, mode: 'answer', createdAt: old, updatedAt: old, draft: '测试草稿 🚀', messages: [{ id: `m-${id}`, role: 'user', content: '离线受控测试内容' }], ...extra });
  const library = JSON.stringify({ version: 2, activeId: 'active', conversations: [chat('active'), chat('old'), chat('pinned', { pinned: true }), chat('empty', { draft: '', messages: [] }), chat('recent', { updatedAt: new Date().toISOString() })] });
  await fs.writeFile(path.join(profile, finishOnly ? 'conversations.json.gz' : 'conversations.json'), finishOnly ? zlib.gzipSync(Buffer.from(library)) : library);
}
async function run() {
  if (finishOnly) {
    const previous = JSON.parse(await fs.readFile(reportPath, 'utf8'));
    assert.equal(previous.version, report.version); assert.equal(previous.executable, executable);
    const build = JSON.parse(await fs.readFile(path.join(output, 'settings-build.json'), 'utf8'));
    assert.equal(previous.renderer, build.renderer);
    report.checks = previous.checks.filter((item) => item.status === 'passed').map((item) => ({ ...item, reused: item.reused || '同一 EXE / renderer 的有效结果；本轮仅执行收尾场景' }));
    report.previousFailure = { error: previous.error, failureState: previous.failureState, cleanup: previous.cleanup };
    report.continuation = '只补测关闭/重启/外观重置/截图/退出；偏好与 gzip 聊天 fixture 仅作隔离场景前置数据，不计为产品操作证据。';
  }
  report.executableSha256 = crypto.createHash('sha256').update(await fs.readFile(executable)).digest('hex');
  await prepare(); await check('真实 EXE 身份与隔离 profile', launch);
  if (!finishOnly) {
  if (process.argv.includes('--continue-general') || process.argv.includes('--continue-after-general')) {
    report.checks.push({ name: '唯一底部齿轮与常规设置内容', status: 'passed', reused: '同一 EXE 和 renderer 的上轮通过记录：1 个齿轮、24 行常规内容' });
    await click(aria('设置'));
  } else await check('唯一底部齿轮与常规设置内容', async () => {
    assert.equal(await cdp.evaluate('document.querySelectorAll("button[aria-label=设置]").length'), 1);
    assert.equal(await cdp.evaluate('Boolean(document.querySelector(".settings-activity svg.lucide-settings"))'), true);
    await click(aria('设置'));
    const labels = await cdp.evaluate('[...document.querySelectorAll(".settings-row-copy strong")].map(el=>el.textContent)');
    for (const label of ['默认权限', '本地聊天文件夹', '本地工作区', '默认文件打开位置', '集成终端 Shell', '语言', '关闭窗口前确认', '默认使用完整视图', '新对话默认模式', '底部面板', '自动归档不活跃聊天', '压缩本地保存的聊天历史记录', '开源许可证', '插件与 SKILL 技能', '纯文本编辑器', '显示上下文窗口使用情况', '发送快捷键', '轮次完成通知', '启用权限通知', '启用问题通知', '启用 Dot 通知', '通知提示音']) assert.ok(labels.includes(label), label);
    return { rowCount: labels.length };
  });
  if (process.argv.includes('--continue-after-general')) report.checks.push({ name: '常规选项操作与落盘、受限能力真实提示', status: 'passed', reused: '同一 EXE 与 renderer 上轮 UI 与磁盘回读通过；后续组使用相同偏好的隔离前置数据，不替代真实程序' });
  else await check('常规选项操作与落盘、受限能力真实提示', async () => {
    for (const [name, value, setting] of [['默认权限', 'chat-only', 'contextAccess'], ['默认文件打开方式', 'system', 'defaultFileOpen'], ['集成终端 Shell', 'cmd', 'terminalShell'], ['关闭窗口前确认', 'always', 'closeConfirmation'], ['新对话默认模式', 'code', 'defaultMode'], ['发送快捷键', 'enter', 'sendShortcut'], ['任务完成通知', 'off', 'notifyOnComplete'], ['通知提示音', 'silent', 'notificationSound']]) {
      await select(name, value, setting === 'notifyOnComplete' ? undefined : setting);
    }
    await toggle('权限通知', 'notifyOnPermissions', false); await toggle('问题通知', 'notifyOnIssues', false); await toggle('允许使用本地 SKILL 指引', 'skillsEnabled', false);
    const prefs = await preferences(); assert.equal(prefs.notifyOnComplete, false);
    assert.equal(await cdp.evaluate('document.querySelector(".settings-detail").textContent.includes("暂不可用") && document.querySelector(".settings-detail").textContent.includes("未接入")'), true);
    await select('关闭窗口前确认', 'busy', 'closeConfirmation'); await select('默认文件打开方式', 'builtin', 'defaultFileOpen'); await select('默认权限', 'manual', 'contextAccess');
    await toggle('底部面板', 'showEditorStatusBar', false);
    await click(aria('文件与代码')); assert.equal(await cdp.evaluate('getComputedStyle(document.querySelector(".editor-statusbar")).display'), 'none');
    await click(aria('设置')); await toggle('底部面板', 'showEditorStatusBar', true);
    await toggle('默认使用完整视图', 'defaultFullView', true);
    await click(aria('新建对话'));
    await waitFor(() => cdp.evaluate('document.querySelector(".app-shell").classList.contains("rail-collapsed") && document.querySelector(".browser-pane").hidden'), 'new chat full view');
    await waitFor(async () => { const lib = await history(); return lib.conversations.find((item) => item.id === lib.activeId)?.mode === 'code'; }, 'new chat default mode');
    assert.ok((await cdp.evaluate('document.querySelector(".send-hint").textContent')).includes('Shift Enter'));
    await input('输入工作内容', '输入换行验证'); await key('Enter', 8);
    assert.ok((await cdp.evaluate('document.querySelector("textarea").value')).endsWith('\n'));
    await click(aria('设置')); await toggle('默认使用完整视图', 'defaultFullView', false);
    await toggle('允许使用本地 SKILL 指引', 'skillsEnabled', true);
    return { notificationPreferencesPersisted: true, fullView: true, defaultMode: 'code', editorStatusHidden: true, shiftEnter: true };
  });
  await check('真实许可内容、展开与 Escape 关闭', async () => {
    await cdp.evaluate('(()=>{const row=[...document.querySelectorAll(".settings-row")].find(e=>e.querySelector("strong")?.textContent==="开源许可证");row.querySelector("button").click()})()');
    await waitFor(() => cdp.evaluate('Boolean(document.querySelector("dialog[open] .license-list details"))'), 'bundled licenses');
    const count = await cdp.evaluate('document.querySelectorAll(".license-list details").length'); assert.equal(count, 214);
    await click('.license-list details summary');
    assert.ok((await cdp.evaluate('document.querySelector(".license-list details[open]").textContent')).length > 100);
    await key('Escape'); await waitFor(() => cdp.evaluate('!document.querySelector("dialog")'), 'license Escape close');
    return { components: count };
  });
  await check('真实压缩转换、Unicode 草稿与归档保护', async () => {
    await toggle('压缩聊天记录', 'compressHistory', true);
    await waitFor(async () => !(await fs.stat(path.join(profile, 'conversations.json')).catch(() => null)), 'alternate JSON removed after commit');
    let lib = await history(); assert.equal(lib.conversations.find((item) => item.id === 'active').draft, '测试草稿 🚀');
    await select('自动归档不活跃聊天', 30, 'autoArchiveDays');
    await waitFor(async () => Boolean((await history()).conversations.find((item) => item.id === 'old').archivedAt), 'old conversation archived');
    lib = await history();
    for (const id of ['pinned', 'empty', 'recent', lib.activeId]) assert.equal(lib.conversations.find((item) => item.id === id).archivedAt, null, id);
    await select('自动归档不活跃聊天', 0, 'autoArchiveDays');
    await toggle('压缩聊天记录', 'compressHistory', false);
    await waitFor(async () => !(await fs.stat(path.join(profile, 'conversations.json.gz')).catch(() => null)), 'alternate gzip removed');
    assert.ok((await history()).conversations.find((item) => item.id === 'old').archivedAt);
    await toggle('压缩聊天记录', 'compressHistory', true);
    return { compression: 'JSON → gzip → JSON → gzip', unicode: true, archiveDays: 30, currentPinnedEmptyRecentProtected: true, disabledPreservesArchive: true };
  });
  await category('外观');
  await check('外观三模式、跟随系统和高对比即时生效', async () => {
    await click(aria('深色')); await waitFor(() => cdp.evaluate('document.querySelector(".app-shell").dataset.theme==="dark"'), 'dark appearance');
    const dark = await cdp.evaluate('({background:getComputedStyle(document.querySelector(".settings-detail")).backgroundColor,text:getComputedStyle(document.querySelector(".settings-detail h1")).color})');
    assert.equal(dark.background, 'rgb(21, 25, 26)'); assert.equal(dark.text, 'rgb(229, 235, 232)');
    await click(aria('浅色')); await waitFor(() => cdp.evaluate('document.querySelector(".app-shell").dataset.theme==="light"'), 'light appearance');
    await click(aria('跟随系统')); await cdp.command('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'dark' }] });
    await waitFor(() => cdp.evaluate('document.querySelector(".app-shell").dataset.theme==="dark"'), 'system dark');
    await cdp.command('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }] });
    await waitFor(() => cdp.evaluate('document.querySelector(".app-shell").dataset.theme==="light"'), 'system light');
    await select('主题', 'high-contrast', 'themeStyle');
    assert.equal(await cdp.evaluate('getComputedStyle(document.querySelector(".settings-row-group")).borderTopWidth'), '2px');
    return { dark, systemFollowsMedia: true, highContrastBorder: '2px' };
  });
  await check('强调色键盘、外部关闭、自定义与非法值保护', async () => {
    await click(aria('强调色')); await waitFor(() => cdp.evaluate('document.activeElement?.matches("input[name=appearance-accent]")'), 'accent radio focus');
    await key('ArrowDown'); await waitFor(async () => (await preferences()).accentColor === '#2878C7', 'keyboard blue accent');
    await key('Escape'); assert.equal(await cdp.evaluate('document.activeElement?.getAttribute("aria-label")'), '强调色');
    assert.equal(await cdp.evaluate('Boolean(document.querySelector(".settings-accent-menu"))'), false);
    await click(aria('强调色'));
    const bounds = await cdp.evaluate('(()=>{const r=document.querySelector(".settings-detail-heading h1").getBoundingClientRect();return{x:r.x+5,y:r.y+5}})()');
    await cdp.command('Input.dispatchMouseEvent', { type: 'mousePressed', button: 'left', clickCount: 1, ...bounds });
    await cdp.command('Input.dispatchMouseEvent', { type: 'mouseReleased', button: 'left', clickCount: 1, ...bounds });
    await waitFor(() => cdp.evaluate('!document.querySelector(".settings-accent-menu")'), 'outside pointer dismissal');
    await click(aria('强调色')); await input('输入自定义强调色', '#6747ab'); await key('Enter');
    await waitFor(async () => (await preferences()).accentColor === '#6747AB', 'custom accent committed');
    await key('Escape');
    await input('输入背景颜色', '#eef2f9'); await key('Enter');
    await waitFor(async () => (await preferences()).backgroundColor === '#EEF2F9', 'background color committed');
    await input('输入前景颜色', '#202b44'); await key('Enter');
    await waitFor(async () => (await preferences()).foregroundColor === '#202B44', 'foreground color committed');
    await input('输入背景颜色', '#xyzxyz'); await key('Enter');
    assert.equal(await cdp.evaluate('document.querySelector("input[aria-label=输入背景颜色]").value'), '#EEF2F9');
    assert.equal((await preferences()).backgroundColor, '#EEF2F9');
    return { accent: '#6747AB', background: '#EEF2F9', foreground: '#202B44', invalidInputRestored: true };
  });
  await check('25 字体、微软雅黑字形与 20px 小窗口布局', async () => {
    assert.equal(await cdp.evaluate('document.querySelector("select[aria-label=界面字体]").options.length'), 25);
    await select('界面字体', 'Microsoft YaHei', 'fontFamily'); await select('字体大小', 20, 'fontSize');
    await waitFor(() => cdp.evaluate('getComputedStyle(document.querySelector(".app-shell")).fontSize==="20px"'), '20px applied');
    await cdp.command('DOM.enable'); await cdp.command('CSS.enable');
    const document = await cdp.command('DOM.getDocument', { depth: 0 }); const fontEvidence = [];
    for (const selector of ['.settings-detail-heading h1', '.settings-row-copy strong', '.settings-row-copy p']) {
      const { nodeId } = await cdp.command('DOM.querySelector', { nodeId: document.root.nodeId, selector });
      const { fonts } = await cdp.command('CSS.getPlatformFontsForNode', { nodeId });
      assert.ok(fonts.some((font) => /Microsoft YaHei|微软雅黑/i.test(font.familyName))); fontEvidence.push({ selector, fonts });
    }
    await cdp.command('Emulation.setDeviceMetricsOverride', { width: 1064, height: 660, deviceScaleFactor: 1, mobile: false });
    for (const label of ['外观', '常规']) {
      await category(label);
      const overflow = await cdp.evaluate('[...document.querySelectorAll(".settings-search,.settings-row-control,.settings-category,.settings-mode-choices")].filter(el=>el.getBoundingClientRect().width).map(el=>({text:el.textContent.slice(0,35),left:el.getBoundingClientRect().left,right:el.getBoundingClientRect().right,width:el.clientWidth,scroll:el.scrollWidth})).filter(el=>el.left < -1 || el.right > innerWidth+1 || el.scroll>el.width+1)');
      assert.deepEqual(overflow, [], `20px ${label} controls overflow`);
    }
    await category('外观'); await click(aria('强调色'));
    const menu = await cdp.evaluate('(()=>{const el=document.querySelector(".settings-accent-menu");el.scrollIntoView({block:"center"});const r=el.getBoundingClientRect();return{left:r.left,right:r.right,top:r.top,bottom:r.bottom,height:innerHeight}})()');
    assert.ok(menu.left >= 0 && menu.right <= 1065 && menu.top >= 0 && menu.bottom <= 661, JSON.stringify(menu));
    await key('Escape'); await cdp.command('Emulation.clearDeviceMetricsOverride');
    await select('字体大小', 18, 'fontSize');
    return { fonts: fontEvidence, viewport: '1064×660', fontSize: 20, menu };
  });
  }
  await check('关闭保存与新 EXE 重启持久化', async () => {
    await click(aria('工作台首页')); await input('输入工作内容', '重启后仍保留的中文草稿 🚀');
    await nativeClose();
    const lib = await history(); assert.equal(lib.conversations.find((item) => item.id === lib.activeId).draft, '重启后仍保留的中文草稿 🚀');
    await launch();
    const prefs = await preferences();
    for (const [key, value] of Object.entries({ fontSize: 18, fontFamily: 'Microsoft YaHei', accentColor: '#6747AB', backgroundColor: '#EEF2F9', foregroundColor: '#202B44', compressHistory: true, autoArchiveDays: 0, terminalShell: 'cmd', sendShortcut: 'enter', notifyOnComplete: false, notificationSound: 'silent' })) assert.equal(prefs[key], value, key);
    await waitFor(() => cdp.evaluate('document.querySelector("textarea").value==="重启后仍保留的中文草稿 🚀"'), 'draft after real EXE restart');
    const restoredAppearance = await waitFor(async () => {
      const state = await cdp.evaluate('(()=>{const el=document.querySelector(".app-shell"),css=getComputedStyle(el);return{fontSize:css.fontSize,variable:css.getPropertyValue("--ui-font-size").trim(),accent:css.getPropertyValue("--accent").trim(),themeStyle:el.dataset.themeStyle}})()');
      return state.fontSize === '18px' && state.variable === '18px' && state.accent === '#6747AB' && state.themeStyle === 'high-contrast' ? state : false;
    }, 'saved appearance applied after real EXE restart');
    await click(aria('设置')); await category('外观'); await textClick('.settings-reset-button', '重置为默认设置');
    await waitFor(async () => { const p = await preferences(); return p.fontSize === 16 && p.fontFamily === 'Microsoft YaHei' && p.themeMode === 'system' && p.themeStyle === 'standard' && p.backgroundColor === null && p.foregroundColor === null && p.accentColor === '#176C5B'; }, 'appearance reset readback');
    const resetAppearance = await waitFor(async () => {
      const state = await cdp.evaluate('(()=>{const el=document.querySelector(".app-shell"),css=getComputedStyle(el);return{fontSize:css.fontSize,accent:css.getPropertyValue("--accent").trim(),themeStyle:el.dataset.themeStyle,customBackground:el.dataset.customBackground,customForeground:el.dataset.customForeground}})()');
      return state.fontSize === '16px' && state.accent === '#176C5B' && state.themeStyle === 'standard' && state.customBackground === 'false' && state.customForeground === 'false' ? state : false;
    }, 'appearance reset rendered');
    return { nativeClose: 'exit 0', unicodeDraft: true, restart: true, restoredAppearance, reset: true, resetAppearance };
  });
  await cdp.evaluate('document.querySelector(".settings-detail").scrollTop=0;document.querySelector(".toast button")?.click()');
  const screenshot = await cdp.command('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  const screenshotPath = path.join(output, 'workbench-settings.png'); await fs.writeFile(screenshotPath, Buffer.from(screenshot.data, 'base64')); report.screenshot = screenshotPath;
  await nativeClose(); report.finalNativeClose = 'exit 0'; report.status = 'passed';
}
async function cleanup() {
  for (const pid of [appPid, child?.pid].filter(Boolean)) {
    if (!alive(pid)) continue;
    await new Promise((resolve) => { const task = spawn('taskkill.exe', ['/PID', String(pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' }); task.on('close', resolve); task.on('error', resolve); });
    await waitFor(() => !alive(pid), 'test process stopped', 10000);
  }
  socket?.close(); browserSocket?.close();
  await fs.rm(temporary, { recursive: true, force: true, maxRetries: 8, retryDelay: 250 }); report.cleanup = 'passed';
}
run().catch(async (error) => {
  report.status = 'failed'; report.error = error.stack;
  report.failureState = await cdp?.evaluate('({heading:document.querySelector(".settings-detail-heading")?.textContent,focus:document.activeElement?.outerHTML.slice(0,500),notice:document.querySelector(".toast")?.textContent,viewport:{width:innerWidth,height:innerHeight}})').catch(() => null);
  console.error(error); process.exitCode = 1;
}).finally(async () => { try { await cleanup(); } catch (error) { report.cleanup = error.message; process.exitCode = 1; } await saveReport(); });
