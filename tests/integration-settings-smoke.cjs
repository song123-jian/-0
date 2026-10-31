const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const net = require('node:net');
const http = require('node:http');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');

const project = path.resolve(__dirname, '..');
const output = path.join(project, 'release', 'plugin-computer-browser-git-20261023');
const executable = path.join(output, `Scodex-Workbench-${require(path.join(project, 'package.json')).version}-x64.exe`);
const temporary = path.join(os.tmpdir(), `scodex-integration-${crypto.randomUUID()}`);
const profile = path.join(temporary, 'profile');
const workspace = path.join(temporary, 'workspace');
const isolatedHome = path.join(temporary, 'scodex-home');
const downloads = path.join(temporary, 'downloads');
const guardsOnly = process.env.SCODEX_INTEGRATION_SCOPE === 'guards';
const closeOnly = process.env.SCODEX_INTEGRATION_SCOPE === 'close';
const reportPath = path.join(output, closeOnly ? 'integration-clear-close-verification.json' : guardsOnly ? 'integration-guards-verification.json' : 'integration-settings-extended-verification.json');
const report = { status: 'running', executable, environment: { platform: os.platform(), release: os.release(), node: process.version }, checks: [], uncovered: ['MCP 工具连接、鼠标/键盘自动化、真实 Git 提交/推送和远端 PR 未接入；没有发送模型请求。', '原生目录选择及下载保存对话框、本机已安装应用实际启动尚未操作；下载使用隔离目录并验证自动保存。'] };
let child, socket, browserSocket, downloadSocket, cdp, browserCdp, downloadCdp, appPid, server, debugPort;
const alive = (pid) => { try { process.kill(pid, 0); return true; } catch { return false; } };
async function waitFor(fn, description, timeout = 25000) {
  const deadline = Date.now() + timeout; let last;
  while (Date.now() < deadline) {
    try { const value = await fn(); if (value) return value; } catch (error) { last = error; }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error(`Timeout: ${description}${last ? `; ${last.message}` : ''}`);
}
async function portNumber() {
  const listener = net.createServer();
  await new Promise((resolve) => listener.listen(0, '127.0.0.1', resolve));
  const port = listener.address().port;
  await new Promise((resolve) => listener.close(resolve));
  return port;
}
function client(ws) {
  let sequence = 0; const pending = new Map(); const events = [];
  ws.addEventListener('message', ({ data }) => {
    const message = JSON.parse(data); const operation = pending.get(message.id); if (!operation) { if (message.method) events.push(message); return; }
    pending.delete(message.id); clearTimeout(operation.timer);
    message.error ? operation.reject(new Error(message.error.message)) : operation.resolve(message.result);
  });
  ws.addEventListener('close', () => { for (const operation of pending.values()) { clearTimeout(operation.timer); operation.reject(new Error('CDP closed')); } pending.clear(); });
  return {
    command(method, params = {}) { return new Promise((resolve, reject) => {
      const id = ++sequence; const timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout ${method}`)); }, 15000);
      pending.set(id, { resolve, reject, timer }); ws.send(JSON.stringify({ id, method, params }));
    }); },
    async evaluate(expression) {
      const result = await this.command('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, userGesture: true });
      if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
      return result.result?.value;
    },
    async waitForEvent(method) { return waitFor(() => { const index = events.findIndex((event) => event.method === method); return index < 0 ? false : events.splice(index, 1)[0]; }, method); },
  };
}
async function connect(url) {
  const ws = new WebSocket(url);
  await new Promise((resolve, reject) => { ws.addEventListener('open', resolve, { once: true }); ws.addEventListener('error', reject, { once: true }); });
  return ws;
}
async function click(selector) {
  await waitFor(() => cdp.evaluate(`(() => { const el=document.querySelector(${JSON.stringify(selector)}); if(!el||el.disabled)return false; el.scrollIntoView({block:'center'}); el.click(); return true; })()`), `click ${selector}`);
}
async function clickText(selector, label) {
  await waitFor(() => cdp.evaluate(`(() => { const el=[...document.querySelectorAll(${JSON.stringify(selector)})].find(e=>e.textContent.trim()===${JSON.stringify(label)}); if(!el||el.disabled)return false; el.scrollIntoView({block:'center'}); el.click(); return true; })()`), `click ${label}`);
}
async function category(label) {
  await clickText('.settings-category', label);
  await waitFor(() => cdp.evaluate(`document.querySelector('.settings-detail-heading h1')?.textContent===${JSON.stringify(label)}`), `settings page ${label}`);
}
async function fill(label, value) {
  const selector = `[aria-label=${JSON.stringify(label)}]`;
  await waitFor(() => cdp.evaluate(`(() => { const input=document.querySelector(${JSON.stringify(selector)}); if(!input)return false; input.scrollIntoView({block:'center'}); input.focus(); input.select?.(); return true; })()`), `focus ${label}`);
  await cdp.command('Input.insertText', { text: value });
  if (!value) {
    await cdp.command('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Backspace', code: 'Backspace', windowsVirtualKeyCode: 8 });
    await cdp.command('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Backspace', code: 'Backspace', windowsVirtualKeyCode: 8 });
  }
  await waitFor(() => cdp.evaluate(`document.querySelector(${JSON.stringify(selector)}).value===${JSON.stringify(value)}`), `input ${label}`);
}
async function blur(label) { await cdp.evaluate(`document.querySelector(${JSON.stringify(`[aria-label="${label}"]`)}).blur()`); }
async function clickAndWait(selector, predicate, description) { await click(selector); await waitFor(() => cdp.evaluate(predicate), description); }
async function acceptNativeConfirmation() {
  const source = `using System; using System.Text; using System.Collections.Generic; using System.Runtime.InteropServices; public static class ScodexDialog { public delegate bool Callback(IntPtr h, IntPtr p); [DllImport("user32.dll")] public static extern bool EnumWindows(Callback cb,IntPtr p); [DllImport("user32.dll")] public static extern bool EnumChildWindows(IntPtr h,Callback cb,IntPtr p); [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h,out uint p); [DllImport("user32.dll",CharSet=CharSet.Unicode)] public static extern int GetClassName(IntPtr h,StringBuilder s,int n); [DllImport("user32.dll",CharSet=CharSet.Unicode)] public static extern int GetWindowText(IntPtr h,StringBuilder s,int n); [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h); [DllImport("user32.dll")] public static extern int GetDlgCtrlID(IntPtr h); [DllImport("user32.dll")] public static extern IntPtr SendMessage(IntPtr h,uint m,IntPtr w,IntPtr l); public static string Class(IntPtr h){var s=new StringBuilder(256);GetClassName(h,s,s.Capacity);return s.ToString();} public static string Text(IntPtr h){var s=new StringBuilder(256);GetWindowText(h,s,s.Capacity);return s.ToString();} public static IntPtr Find(uint pid){IntPtr found=IntPtr.Zero;EnumWindows((h,p)=>{uint owner;GetWindowThreadProcessId(h,out owner);if(owner==pid&&IsWindowVisible(h)&&Class(h)=="#32770"){found=h;return false;}return true;},IntPtr.Zero);return found;} public static string Accept(IntPtr dialog){IntPtr button=IntPtr.Zero;var labels=new List<string>();EnumChildWindows(dialog,(h,p)=>{int id=GetDlgCtrlID(h);labels.Add(Class(h)+":"+id+":"+Text(h));if(Class(h)=="Button"&&(id==1||id==6))button=h;return true;},IntPtr.Zero);if(button==IntPtr.Zero)throw new Exception("Confirmation button missing: "+String.Join("|",labels));SendMessage(button,0x00F5,IntPtr.Zero,IntPtr.Zero);return String.Join("|",labels);}}`;
  const nativeSource = source.replace('Class(h)=="Button"&&(id==1||id==6)', 'Class(h)=="Button"&&(Text(h).Replace("&","")=="确定"||Text(h).Replace("&","")=="OK")');
  const script = `[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false); Add-Type -TypeDefinition '${nativeSource}'; $deadline=[DateTime]::UtcNow.AddSeconds(10); do { $dialog=[ScodexDialog]::Find(${appPid}); if($dialog -eq [IntPtr]::Zero){Start-Sleep -Milliseconds 100} } while($dialog -eq [IntPtr]::Zero -and [DateTime]::UtcNow -lt $deadline); if($dialog -eq [IntPtr]::Zero){throw 'Native confirmation window not found'}; [Console]::Out.WriteLine([ScodexDialog]::Accept($dialog))`;
  await new Promise((resolve, reject) => {
    const action = spawn('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', script], { windowsHide: true, stdio: 'pipe' });
    let error = ''; action.stdout.on('data', (chunk) => { (report.nativeConfirmation ||= []).push(String(chunk).trim()); });
    action.stderr.on('data', (chunk) => { error += chunk; }); action.on('error', reject); action.on('close', (code) => code === 0 ? resolve() : reject(new Error(error)));
  });
}
async function clearBrowserThroughUi() {
  await cdp.command('Page.disable');
  const clearClick = clickText('button', '清除浏览数据').then(() => null, (error) => error);
  await acceptNativeConfirmation();
  const clickError = await clearClick;
  if (clickError) throw clickError;
  await cdp.command('Page.enable');
  await waitFor(() => cdp.evaluate('document.querySelector(".integration-settings [role=status]")?.textContent==="浏览数据已清除"'), 'clear-data completion in settings UI');
  assert.deepEqual(await cdp.evaluate('window.scodex.getBrowserHistory()'), []);
}
async function preferenceState() { return cdp.evaluate('window.scodex.getAppState().then(state=>state.preferences)'); }
async function browserPage(url) {
  const target = await waitFor(async () => (await fetch(`http://127.0.0.1:${debugPort}/json/list`).then((response) => response.json())).find((item) => item.type === 'page' && item.url === url), 'embedded browser target');
  downloadSocket = await connect(target.webSocketDebuggerUrl); downloadCdp = client(downloadSocket);
  await downloadCdp.command('Runtime.enable');
  return downloadCdp;
}
async function savedPreferences() { return JSON.parse(await fs.readFile(path.join(profile, 'settings.json'), 'utf8')).preferences; }
async function saveCheck(name, predicate, description) {
  await waitFor(async () => predicate(await savedPreferences()), description);
  report.checks.push({ name, status: 'passed', evidence: await savedPreferences() });
}
async function launch() {
  const port = await portNumber();
  debugPort = port;
  child = spawn(executable, [`--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--disable-gpu'], {
    cwd: output, env: { ...process.env, SCODEX_HOME: isolatedHome }, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
  });
  let logs = '';
  child.stdout.on('data', (chunk) => { logs = (logs + chunk).slice(-5000); });
  child.stderr.on('data', (chunk) => { logs = (logs + chunk).slice(-5000); });
  const page = await waitFor(async () => {
    if (child.exitCode !== null) throw new Error(`application exit ${child.exitCode}: ${logs}`);
    const response = await fetch(`http://127.0.0.1:${port}/json/list`);
    return (await response.json()).find((item) => item.type === 'page' && item.url.startsWith('file:'));
  }, 'packaged application renderer', 50000);
  socket = await connect(page.webSocketDebuggerUrl); cdp = client(socket);
  const version = await fetch(`http://127.0.0.1:${port}/json/version`).then((response) => response.json());
  browserSocket = await connect(version.webSocketDebuggerUrl); browserCdp = client(browserSocket);
  appPid = (await browserCdp.command('SystemInfo.getProcessInfo')).processInfo.find((item) => item.type === 'browser').id;
  await cdp.command('Runtime.enable'); await cdp.command('Page.enable');
  await waitFor(() => cdp.evaluate('Boolean(window.scodex && document.querySelector(".history-save-state"))'), 'workbench renderer ready');
  await click('[aria-label="设置"]');
  await waitFor(() => cdp.evaluate('Boolean(document.querySelector(".settings-detail-heading"))'), 'settings renderer ready');
  const state = await cdp.evaluate('window.scodex.getAppState().then(s=>({version:s.version,userDataPath:s.userDataPath,preferences:s.preferences,hasCredential:s.hasCredential}))');
  assert.equal(state.version, require(path.join(project, 'package.json')).version);
  assert.equal(state.userDataPath.toLowerCase(), profile.toLowerCase());
  assert.equal(state.hasCredential, false, 'isolated acceptance must have no model credentials');
  report.version = state.version;
  return state;
}
async function nativeClose() {
  await new Promise((resolve, reject) => {
    const script = `[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false); Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public static class ScodexWindowState { [DllImport("user32.dll")] public static extern bool IsWindowEnabled(IntPtr handle); }'; $p=[Diagnostics.Process]::GetProcessById(${appPid}); $deadline=[DateTime]::UtcNow.AddSeconds(5); do { $p.Refresh(); $ready=$p.MainWindowHandle -ne [IntPtr]::Zero -and [ScodexWindowState]::IsWindowEnabled($p.MainWindowHandle); if(-not $ready){Start-Sleep -Milliseconds 50} } while(-not $ready -and [DateTime]::UtcNow -lt $deadline); [Console]::Out.WriteLine("WindowEnabled=$ready Handle=$($p.MainWindowHandle)"); if(-not $ready -or -not $p.CloseMainWindow()){throw 'Close not delivered'}`;
    const closer = spawn('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', script], { windowsHide: true, stdio: 'pipe' });
    closer.stdout.on('data', (chunk) => { (report.nativeCloseState ||= []).push(String(chunk).trim()); });
    let error = ''; closer.stderr.on('data', (chunk) => { error += chunk; }); closer.on('error', reject); closer.on('close', (code) => code === 0 ? resolve() : reject(new Error(error)));
  });
  await waitFor(() => !alive(appPid), 'native application close', 15000);
  await waitFor(() => child.exitCode !== null, 'Electron process exit', 15000);
  assert.equal(child.exitCode, 0);
  socket?.close(); browserSocket?.close(); downloadSocket?.close(); socket = browserSocket = downloadSocket = null; cdp = browserCdp = downloadCdp = null; appPid = null; child = null;
}
async function cleanup() {
  for (const pid of [appPid, child?.pid].filter(Boolean)) if (alive(pid)) {
    await new Promise((resolve) => { const task = spawn('taskkill.exe', ['/PID', String(pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' }); task.on('close', resolve); task.on('error', resolve); });
  }
  socket?.close(); browserSocket?.close(); downloadSocket?.close();
  if (server?.listening) await new Promise((resolve) => server.close(resolve));
  await fs.rm(temporary, { recursive: true, force: true, maxRetries: 8, retryDelay: 250 });
  report.cleanup = 'passed';
}
async function run() {
  await fs.mkdir(output, { recursive: true });
  for (const directory of [profile, workspace, path.join(isolatedHome, 'skills', 'integration-acceptance')]) await fs.mkdir(directory, { recursive: true });
  await fs.mkdir(downloads, { recursive: true });
  await fs.writeFile(path.join(isolatedHome, 'skills', 'integration-acceptance', 'SKILL.md'), '---\nname: integration-acceptance\ndescription: Isolated UI acceptance fixture\n---\nNever sent during acceptance.\n');
  const siteRequests = { allowed: 0, blocked: 0 };
  server = http.createServer((request, response) => {
    if (request.url.startsWith('/allowed')) siteRequests.allowed += 1;
    if (request.url.startsWith('/blocked')) siteRequests.blocked += 1;
    if (request.url.startsWith('/download')) {
      siteRequests.downloads = (siteRequests.downloads || 0) + 1;
      response.writeHead(200, { 'content-type': 'application/octet-stream', 'content-disposition': 'attachment; filename="fixture.txt"' });
      response.end('isolated browser download');
      return;
    }
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    response.end('<!doctype html><title>Scodex local browser fixture</title><main>Browser settings fixture <a id="download" href="/download">Download fixture</a></main>');
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  await fs.writeFile(path.join(profile, 'settings.json'), JSON.stringify({ workspaceRoot: workspace, preferences: { browserPanelOpen: false, browserDownloadDirectory: downloads } }));
  const state = await launch();
  assert.equal(state.preferences.gitBranchPrefix, 'codex/');
  report.checks.push({ name: '真实 Electron 程序身份及隔离 profile', status: 'passed', evidence: { version: state.version, userDataPath: state.userDataPath, electron: 'portable x64' } });
  if (closeOnly) {
    const fixtureUrl = `http://127.0.0.1:${server.address().port}/allowed`;
    await cdp.evaluate(`window.scodex.browserAction({type:'new',url:${JSON.stringify(fixtureUrl)}})`);
    await waitFor(() => cdp.evaluate(`window.scodex.getBrowserHistory().then(items=>items.some(item=>item.url===${JSON.stringify(fixtureUrl)}))`), 'history precondition for clear UI');
    await category('浏览器');
    await clearBrowserThroughUi();
    await nativeClose();
    report.checks.push({ name: '清理确认后主窗口恢复可用并正常退出', status: 'passed', evidence: { confirmationAccepted: true, historyAfter: 0, exitCode: 0 } });
    return;
  }

  await category('插件');
  await clickText('button', '重新读取');
  await waitFor(() => cdp.evaluate('document.querySelector(".plugin-skill-row strong")?.textContent==="integration-acceptance"'), 'isolated SKILL listed');
  await fill('搜索已安装技能', 'no-matching-skill');
  await waitFor(() => cdp.evaluate('document.querySelector(".integration-empty")?.textContent.includes("没有匹配")'), 'skill search filters results');
  await fill('搜索已安装技能', 'integration-acceptance');
  await waitFor(() => cdp.evaluate('document.querySelector(".plugin-skill-row strong")?.textContent==="integration-acceptance"'), 'skill search finds fixture');
  await fill('搜索已安装技能', '');
  const skillId = await cdp.evaluate('window.scodex.listSkills().then(items=>items.find(s=>s.name==="integration-acceptance").id)');
  await clickAndWait('[aria-label="启用技能 integration-acceptance"]', `window.scodex.getAppState().then(s=>s.preferences.disabledSkillIds.includes(${JSON.stringify(skillId)}))`, 'individual skill disable saved');
  const blockedSkillSend = await cdp.evaluate(`window.scodex.sendMessage({skill:"fixture guide",skillId:${JSON.stringify(skillId)}}).then(()=>({blocked:false}),error=>({blocked:error.message.includes("所选技能已在插件设置中停用"),message:error.message}))`);
  report.guardDiagnostic = blockedSkillSend;
  assert.equal(blockedSkillSend.blocked, true, blockedSkillSend.message);
  report.checks.push({ name: '已停用技能在发送 IPC 前被拒绝', status: 'passed', evidence: { reason: blockedSkillSend.message, modelRequestSent: false } });
  await saveCheck('技能搜索与停用落盘', (p) => p.disabledSkillIds.includes(skillId), 'skill disable preference persisted');
  if (guardsOnly) {
    const fixtureUrl = `http://127.0.0.1:${server.address().port}/allowed`;
    await cdp.evaluate(`window.scodex.browserAction({type:'new',url:${JSON.stringify(fixtureUrl)}})`);
    await waitFor(() => cdp.evaluate(`window.scodex.getBrowserHistory().then(items=>items.some(item=>item.url===${JSON.stringify(fixtureUrl)}))`), 'history precondition for clear UI');
    await category('浏览器');
    await clearBrowserThroughUi();
    report.checks.push({ name: '浏览数据清理按钮、确认和完成反馈', status: 'passed', evidence: { historyBefore: 1, historyAfter: 0, confirmationAccepted: true } });
    await nativeClose();
    return;
  }

  await category('电脑操控');
  await clickAndWait('[aria-label="允许打开桌面应用"]', 'window.scodex.getAppState().then(s=>s.preferences.computerControlEnabled)', 'desktop app master enabled');
  const desktopApps = (await cdp.evaluate('window.scodex.getAppState().then(s=>s.desktopApps)')) || [];
  const installedApp = desktopApps.find((item) => item.installed);
  if (installedApp) {
    await clickAndWait(`[aria-label=${JSON.stringify(`允许打开 ${installedApp.name}`)}]`, `window.scodex.getAppState().then(s=>s.preferences.computerAllowedApps.includes(${JSON.stringify(installedApp.id)}))`, 'individual desktop app authorization saved');
    report.checks.push({ name: '本机应用检测与逐项授权', status: 'passed', evidence: { detected: installedApp.name, launched: false } });
  } else report.checks.push({ name: '本机应用检测', status: 'passed', evidence: { installedApps: 0, launchSkipped: '没有可检测的受支持应用' } });
  await saveCheck('电脑操控全局授权落盘', (p) => p.computerControlEnabled === true, 'desktop control preference persisted');

  await category('Git');
  await fill('分支前缀', '../'); await blur('分支前缀');
  await waitFor(() => cdp.evaluate('document.querySelector("[role=alert]")?.textContent.includes("有效")'), 'invalid branch prefix rejected');
  assert.equal((await savedPreferences()).gitBranchPrefix, 'codex/');
  const invalidIpc = await cdp.evaluate('window.scodex.savePreferences({gitBranchPrefix:"../"}).then(()=>false,()=>true)');
  assert.equal(invalidIpc, true);
  report.checks.push({ name: '非法 Git 分支前缀在界面和 IPC 均拒绝', status: 'passed', evidence: { input: '../', storedPrefix: 'codex/' } });
  await fill('分支前缀', 'codex/acceptance-'); await blur('分支前缀');
  await clickAndWait('.git-settings .integration-segments button:nth-child(2)', 'window.scodex.getAppState().then(s=>s.preferences.gitMergeMethod==="squash")', 'Git squash selection saved');
  await clickAndWait('[aria-label="始终强制推送"]', 'window.scodex.getAppState().then(s=>s.preferences.gitForcePush===true)', 'force push preference saved');
  await clickAndWait('[aria-label="创建草稿 Pull Request"]', 'window.scodex.getAppState().then(s=>s.preferences.gitDraftPullRequest===false)', 'draft Pull Request preference changed');
  await clickText('.git-settings .integration-segments button', '单独');
  await waitFor(() => cdp.evaluate('window.scodex.getAppState().then(s=>s.preferences.gitReviewResultMode==="separate")'), 'separate review presentation saved');
  await fill('提交指令', '提交标题采用简洁祈使句'); await blur('提交指令');
  await fill('Pull Request 指令', '说明变更与验证结果'); await blur('Pull Request 指令');
  await saveCheck('Git 设置与两类指令落盘', (p) => p.gitBranchPrefix === 'codex/acceptance-' && p.gitMergeMethod === 'squash'
    && p.gitForcePush && !p.gitDraftPullRequest && p.gitReviewResultMode === 'separate'
    && p.gitCommitInstructions === '提交标题采用简洁祈使句' && p.gitPullRequestInstructions === '说明变更与验证结果', 'all Git fields persisted');

  await category('浏览器');
  const address = `127.0.0.1:${server.address().port}`;
  await fill('网站或主机名', address);
  await clickText('.integration-site-form button', '添加');
  await waitFor(() => cdp.evaluate(`window.scodex.getAppState().then(s=>s.preferences.browserSiteRules.some(r=>r.host==="127.0.0.1"))`), 'site rule persisted');
  const browserUrl = `http://${address}/allowed`;
  assert.ok(await cdp.evaluate('window.scodex.getAppState().then(s=>s.preferences.browserDownloadDirectory)'));
  await click('[aria-label="下载前询问保存位置"]');
  await waitFor(() => cdp.evaluate('window.scodex.getAppState().then(s=>!s.preferences.browserAskBeforeDownload)'), 'automatic download preference saved');
  const initialSnapshot = await cdp.evaluate(`window.scodex.browserAction({type:'new',url:${JSON.stringify(browserUrl)}})`);
  assert.ok(initialSnapshot.activeId);
  await waitFor(() => siteRequests.allowed === 1, 'actual local browser page request');
  downloadCdp = await browserPage(browserUrl);
  await downloadCdp.evaluate('document.querySelector("#download").click()');
  const downloadedPath = path.join(downloads, 'fixture.txt');
  await waitFor(async () => (await fs.readFile(downloadedPath, 'utf8').catch(() => '')) === 'isolated browser download', 'actual embedded browser download');
  await cdp.evaluate(`(() => { const el=document.querySelector('[aria-label="127.0.0.1 下载权限"]'); el.value='block'; el.dispatchEvent(new Event('change',{bubbles:true})); })()`);
  await waitFor(() => cdp.evaluate('window.scodex.getAppState().then(s=>s.preferences.browserSiteRules.some(r=>r.host==="127.0.0.1"&&r.download==="block"))'), 'site download block saved');
  await downloadCdp.evaluate('document.querySelector("#download").click()');
  await waitFor(() => siteRequests.downloads === 2, 'blocked download request reached actual session');
  await new Promise((resolve) => setTimeout(resolve, 750));
  assert.deepEqual((await fs.readdir(downloads)).sort(), ['fixture.txt']);
  report.checks.push({ name: '内置浏览器自动下载与网站下载拦截', status: 'passed', evidence: { savedFile: 'fixture.txt', payloadBytes: Buffer.byteLength('isolated browser download'), blockedDownloadAddedNoFile: true, isolatedDirectory: true } });
  await clickAndWait('[aria-label="启用内置浏览器"]', 'window.scodex.getAppState().then(s=>s.preferences.browserPanelOpen)', 'browser panel preference enabled');
  await cdp.evaluate(`(() => { const el=document.querySelector('[aria-label="127.0.0.1 浏览权限"]'); el.value='block'; el.dispatchEvent(new Event('change',{bubbles:true})); })()`);
  await waitFor(() => cdp.evaluate('window.scodex.getAppState().then(s=>s.preferences.browserSiteRules.some(r=>r.host==="127.0.0.1"&&r.browse==="block"))'), 'blocked site preference saved');
  const rejected = await cdp.evaluate(`window.scodex.browserAction({type:'navigate',url:${JSON.stringify(`http://${address}/blocked`)}}).then(()=>({blocked:false}),error=>({blocked:true,message:error.message}))`);
  assert.equal(rejected.blocked, true); assert.equal(siteRequests.blocked, 0);
  await saveCheck('浏览器网站规则阻止实际导航', (p) => p.browserSiteRules.some((r) => r.host === '127.0.0.1' && r.browse === 'block')
    && p.browserPanelOpen, 'browser rules persisted');
  await waitFor(() => cdp.evaluate(`window.scodex.getBrowserHistory().then(items=>items.some(item=>item.url===${JSON.stringify(browserUrl)}))`), 'browser navigation history recorded');
  const browserHistory = await cdp.evaluate('window.scodex.getBrowserHistory()');
  assert.ok(browserHistory.some((item) => item.url === browserUrl));
  await clearBrowserThroughUi();
  report.checks.push({ name: '内置浏览器历史、站点拦截与清理确认 UI', status: 'passed', evidence: { allowedRequests: siteRequests.allowed, blockedRequests: siteRequests.blocked, clearData: 'confirmed in isolated profile' } });
  await clickAndWait('[aria-label="启用内置浏览器"]', 'window.scodex.getAppState().then(s=>!s.preferences.browserPanelOpen)', 'browser panel hidden after acceptance');

  const saved = await savedPreferences();
  assert.equal(saved.gitPullRequestInstructions, '说明变更与验证结果');
  await category('Git');
  await fill('提交指令', '关闭窗口前最后一次编辑');
  await nativeClose();
  const restarted = await launch();
  assert.equal(restarted.preferences.gitBranchPrefix, 'codex/acceptance-');
  assert.equal(restarted.preferences.gitMergeMethod, 'squash');
  assert.equal(restarted.preferences.gitReviewResultMode, 'separate');
  assert.equal(restarted.preferences.gitPullRequestInstructions, '说明变更与验证结果');
  assert.equal(restarted.preferences.gitCommitInstructions, '关闭窗口前最后一次编辑');
  assert.equal(restarted.preferences.browserSiteRules.find((rule) => rule.host === '127.0.0.1').browse, 'block');
  assert.ok(restarted.preferences.disabledSkillIds.includes(skillId));
  report.checks.push({ name: '完整偏好经过真实退出和重启恢复', status: 'passed', evidence: { git: 'restored', browserSiteRule: 'restored', disabledSkill: 'restored' } });
  await cdp.command('Emulation.setDeviceMetricsOverride', { width: 1064, height: 660, deviceScaleFactor: 1, mobile: false });
  await category('外观');
  await cdp.evaluate('(() => { const el=document.querySelector("[aria-label=字体大小]"); el.value="20"; el.dispatchEvent(new Event("change",{bubbles:true})); })()');
  await waitFor(() => cdp.evaluate('window.scodex.getAppState().then(s=>s.preferences.fontSize===20)'), '20px font preference');
  await click('[aria-label="深色"]');
  await waitFor(() => cdp.evaluate('window.scodex.getAppState().then(s=>s.preferences.themeMode==="dark")'), 'dark theme preference');
  const layouts = [];
  for (const page of ['插件', '电脑操控', '浏览器', 'Git']) {
    await category(page);
    const layout = await cdp.evaluate('({width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,clientWidth:document.documentElement.clientWidth,detailScroll:document.querySelector(".settings-detail").scrollWidth,detailWidth:document.querySelector(".settings-detail").clientWidth})');
    assert.ok(layout.scrollWidth <= layout.clientWidth + 1 && layout.detailScroll <= layout.detailWidth + 1, `${page} horizontal overflow`);
    layouts.push({ page, ...layout });
  }
  await cdp.evaluate('document.querySelector("[aria-label=分支前缀]").focus()');
  await cdp.command('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
  await cdp.command('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
  assert.equal(await cdp.evaluate('document.activeElement.tagName'), 'BUTTON');
  report.checks.push({ name: '四页窄视口、20px 深色布局及 Git 键盘焦点', status: 'passed', evidence: { layouts, focus: 'Tab moved from prefix to merge button' } });
  await category('外观');
  await clickText('button', '重置为默认设置');
  await waitFor(() => cdp.evaluate('window.scodex.getAppState().then(s=>s.preferences.fontSize===16&&s.preferences.themeMode==="system")'), 'reset isolated appearance');
  await cdp.command('Emulation.clearDeviceMetricsOverride');
  await category('Git');
  await cdp.evaluate('document.querySelector(".settings-detail").scrollTop=0');
  await waitFor(() => cdp.evaluate('document.querySelector(".history-save-state")?.textContent==="已保存到本机"'), 'final saved UI state');
  const screenshot = await cdp.command('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  report.screenshot = path.join(output, 'workbench-integration-settings.png');
  await fs.writeFile(report.screenshot, Buffer.from(screenshot.data, 'base64'));
  report.viewport = await cdp.evaluate('({width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,clientWidth:document.documentElement.clientWidth})');
  assert.ok(report.viewport.scrollWidth <= report.viewport.clientWidth + 1);
  await nativeClose();
}
run().catch(async (error) => {
  report.status = 'failed'; report.error = error.stack;
  report.failureState = await cdp?.evaluate('({heading:document.querySelector(".settings-detail-heading")?.textContent,focus:document.activeElement?.outerHTML.slice(0,300),notice:document.querySelector(".toast")?.textContent})').catch(() => null);
  console.error(error); process.exitCode = 1;
}).finally(async () => {
  try { await cleanup(); } catch (error) { report.cleanup = error.message; process.exitCode = 1; }
  report.status = process.exitCode ? 'failed' : 'passed';
  await fs.mkdir(output, { recursive: true });
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2) + '\n');
  console.log(`Report: ${reportPath}`);
});
