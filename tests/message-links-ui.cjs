// Actual packaged UI, file preview, IPC and Windows Explorer; no model service.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn, execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { connect, wait, freePort } = require('./agent-workflow-ui.cjs');
const exec = promisify(execFile), json = JSON.stringify;
const root = path.resolve(__dirname, '..');
const version = process.env.SCODEX_LINKS_VERSION || '1.3.65';
const executable = process.env.SCODEX_LINKS_EXE || path.join(root, 'release/Scodex-Workbench-' + version + '/win-unpacked/Scodex工作台.exe');
const shortcut = process.env.SCODEX_LINKS_SHORTCUT;
const scope = process.env.SCODEX_LINKS_SCOPE || 'all';
assert.ok(['all', 'layout'].includes(scope), 'Unsupported link test scope');
const output = path.resolve(process.env.SCODEX_LINKS_OUTPUT || path.join(root, 'release/file-links-' + version + '/ui'));
const fixture = path.join(output, 'fixture-' + crypto.randomUUID());
const profile = path.join(fixture, 'profile'), home = path.join(fixture, 'home'), project = path.join(fixture, 'project');
const directory = path.join(project, '中文 文档'), documentFile = path.join(directory, '需求 说明.md');
const shortcutFile = path.join(directory, '附件入口.lnk'), missing = path.join(directory, '不存在.md');
const report = { status: 'running', version, scope, executable, shortcut: shortcut || null, fixture, checks: [], limitations: ['Only local link presentation, packaged file navigation and Explorer are covered; no public model requests.'] };
let app, page, socket;
const quote = value => "'" + value.replace(/'/g, "''") + "'";
async function powershell(script) {
  const result = await exec('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')], { windowsHide: true, timeout: 20000, encoding: 'utf8' });
  return result.stdout.trim();
}
async function explorer(close = false) {
  const result = await powershell('[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false);$ErrorActionPreference="Stop";$taskRoot=' + quote(fixture) + ';$taskShell=New-Object -ComObject Shell.Application;$taskRows=@(foreach($taskWindow in @($taskShell.Windows())){try{$taskPath=$taskWindow.Document.Folder.Self.Path;if($taskPath -and ($taskPath -eq $taskRoot -or $taskPath.StartsWith($taskRoot+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase))){$taskSelected=@($taskWindow.Document.SelectedItems()|ForEach-Object{$_.Path});[pscustomobject]@{directory=$taskPath;selected=$taskSelected;handle=[string]$taskWindow.HWND};' + (close ? '$taskWindow.Quit();' : '') + '}}catch{}});ConvertTo-Json -InputObject @($taskRows) -Depth 6');
  return JSON.parse(result || '[]');
}
async function check(name, fn) {
  const evidence = await fn();
  report.checks.push({ name, status: 'passed', evidence });
  await persist(); console.log('PASS ' + name);
}
const persist = () => fs.writeFile(path.join(output, 'message-links-ui.json'), json(report, null, 2) + '\n');
async function clickLink(label, keyboard = false) {
  await wait(() => page.evaluate('(()=>{const e=[...document.querySelectorAll(".assistant-message-content .message-path-link")].find(e=>e.textContent===' + json(label) + ');if(!e)return false;e.scrollIntoView({block:"center"});' + (keyboard ? 'e.focus();' : 'e.click();') + 'return true})()'), 'Link ' + label);
  if (keyboard) for (const type of ['keyDown', 'keyUp']) await page.command('Input.dispatchKeyEvent', { type, key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, ...(type === 'keyDown' ? { text: '\r' } : {}) });
}
async function selectedInExplorer(file) {
  return wait(async () => {
    const windows = await explorer();
    return windows.find(window => window.selected.some(selected => selected.toLowerCase() === file.toLowerCase()));
  }, 'Actual Explorer selection: ' + path.basename(file), 20000);
}
async function launch() {
  const port = await freePort(), args = ['--remote-debugging-port=' + port, '--user-data-dir=' + profile, '--disable-gpu'];
  const env = { ...process.env, SCODEX_HOME: home, SCODEX_REFERENCE_HOME: path.join(fixture, 'reference'), SCODEX_REFERENCE_AGENTS_HOME: path.join(fixture, 'agents') };
  if (shortcut) {
    const result = await exec('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', '$ErrorActionPreference="Stop";$taskProcess=Start-Process -FilePath ' + quote(shortcut) + ' -ArgumentList ' + quote(args.map(arg => '"' + arg + '"').join(' ')) + ' -WindowStyle Hidden -PassThru;$taskProcess.Id'], { windowsHide: true, env: { ...env, APPDATA: path.join(fixture, 'appdata'), LOCALAPPDATA: path.join(fixture, 'localappdata') } });
    const pid = Number(result.stdout.trim()); assert.ok(Number.isSafeInteger(pid) && pid > 0);
    app = { pid, get exitCode() { try { process.kill(pid, 0); return null; } catch { return 0; } } };
  } else app = spawn(executable, args, { cwd: path.dirname(executable), env, windowsHide: true, stdio: 'ignore' });
  const target = await wait(async () => {
    if (app.exitCode !== null) throw Error('Application exited ' + app.exitCode);
    return (await fetch('http://127.0.0.1:' + port + '/json/list').then(r => r.json())).find(target => target.type === 'page' && target.url.startsWith('file:'));
  }, 'Packaged renderer startup', 45000);
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
  page = connect(socket);
  await wait(() => page.evaluate('Boolean(document.querySelector(".message-path-link"))'), 'Saved chat rendering');
  const identity = await page.evaluate('window.scodex.getAppState().then(s=>({version:s.version,userDataPath:s.userDataPath,workspaceRoot:s.workspaceRoot}))');
  assert.equal(identity.version, version); assert.equal(path.resolve(identity.userDataPath), profile); assert.equal(path.resolve(identity.workspaceRoot), project);
  return identity;
}
async function main() {
  await fs.mkdir(output, { recursive: true });
  for (const dir of [profile, home, directory]) await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(documentFile, '# 点击文件验收\n\n中文空格文件预览正常。\n');
  await fs.writeFile(path.join(directory, '数据.json'), '{"内容":"保留原文"}\n');
  await powershell('$ErrorActionPreference="Stop";$taskShell=New-Object -ComObject WScript.Shell;$taskLink=$taskShell.CreateShortcut(' + quote(shortcutFile) + ');$taskLink.TargetPath=' + quote(documentFile) + ';$taskLink.Save()');
  await fs.writeFile(path.join(profile, 'settings.json'), json({ workspaceRoot: project, preferences: { browserPanelOpen: false, trayEnabled: false, closeConfirmation: 'never', defaultFileOpen: 'explorer' } }));
  await fs.writeFile(path.join(home, 'codex-settings.json'), json({ sandboxMode: 'danger-full-access', approvalPolicy: 'never', workspaceDependencies: false }));
  const now = new Date().toISOString(), code = String.fromCharCode(96);
  const content = '已更新 [快捷入口](<' + shortcutFile + '>)。\n\n文件：[需求文档](<' + documentFile + ':2>)\n\n目录：[资料文件夹](<' + directory + '>)\n\n原始路径：' + code + documentFile + code + '\n\n| 相关资料 |\n| --- |\n| [表格附件](<' + documentFile + '>) |\n\n[不存在的文件](<' + missing + '>)';
  await fs.writeFile(path.join(profile, 'conversations.json'), json({ version: 2, activeId: 'file-links', conversations: [{ id: 'file-links', title: '点击文件直达验收', mode: 'answer', createdAt: now, updatedAt: now, messages: [{ id: 'user-links', role: 'user', content: '打开 "' + documentFile + '"。' }, { id: 'assistant-links', role: 'assistant', content }] }] }));
  await check('actual-program-identity', launch);
  report.exeSha256 = crypto.createHash('sha256').update(await fs.readFile(executable)).digest('hex');
  await check('named-labels-file-icons-and-full-path-tooltips', async () => {
    const links = await page.evaluate('[...document.querySelectorAll(".assistant-message-content .message-path-link")].map(e=>({text:e.textContent,title:e.title,label:e.getAttribute("aria-label"),icon:Boolean(e.querySelector("svg[aria-hidden=true]"))}))');
    assert.equal(links.length, 6);
    assert.equal(links.find(link => link.text === '快捷入口').title, shortcutFile);
    assert.equal(links.find(link => link.text === '需求文档').title, documentFile);
    assert.ok(links.every(link => link.icon && link.label.startsWith('打开文件或文件夹：')));
    assert.ok(links.some(link => link.text === path.basename(documentFile)));
    assert.equal(await page.evaluate('document.querySelector(".assistant-message-content").innerText.includes(' + json(directory) + ')'), false);
    return links;
  });
  if (scope !== 'layout') await check('file-click-previews-and-selects-actual-explorer-file', async () => {
    await clickLink('需求文档', true);
    await wait(() => page.evaluate('document.querySelector(".message-file-preview h2")?.textContent==="点击文件验收"'), 'Real Markdown preview');
    assert.ok(await page.evaluate('document.querySelector(".workspace-file-entry[aria-selected=true]")?.textContent.includes("需求 说明.md")'));
    return { keyboardEnter: true, preview: true, explorer: await selectedInExplorer(documentFile) };
  });
  if (!shortcut) {
    if (scope !== 'layout') {
    await check('shortcut-link-and-table-link-preserve-targets', async () => {
      await clickLink('快捷入口');
      await wait(() => page.evaluate('document.querySelector(".message-file-preview-toolbar strong")?.textContent==="附件入口.lnk"'), 'Shortcut selected');
      const windows = await selectedInExplorer(shortcutFile);
      await clickLink('表格附件');
      await wait(() => page.evaluate('document.querySelector(".message-file-preview h2")?.textContent==="点击文件验收"'), 'Table link preview');
      return { shortcut: windows, table: true };
    });
    await check('folder-click-enters-directory-and-errors-remain-visible', async () => {
      await clickLink('资料文件夹');
      await wait(() => page.evaluate('document.querySelectorAll(".workspace-file-entry").length===3&&!document.querySelector(".workspace-file-entry[aria-selected=true]")'), 'Folder listing');
      const windows = await wait(async () => (await explorer()).find(window => window.directory.toLowerCase() === directory.toLowerCase()), 'Actual Explorer folder');
      await clickLink('不存在的文件');
      await wait(() => page.evaluate('document.querySelector(".message-files-panel [role=alert]")?.textContent.includes("不存在")'), 'Missing path error');
      const denied = await page.evaluate('window.scodex.locateMessagePath(' + json(documentFile) + ',false).then(g=>window.scodex.listMessageDirectory(g.id,' + json(project) + ')).then(()=>"unexpected",e=>e.message)');
      assert.match(denied, /只能浏览本次点击路径/);
      return { directory: windows, missing: true, bounded: true };
    });
    }
    await check('inline-links-wrap-and-final-view', async () => {
      await clickLink('需求文档');
      await wait(() => page.evaluate('Boolean(document.querySelector(".message-file-preview h2"))'), 'Final preview');
      await page.evaluate('document.querySelector("[aria-label=隐藏第三工作台]")?.click()');
      await wait(() => page.evaluate('Boolean(document.querySelector(".app-shell:not(.has-browser)"))'), 'Chat visible without third workbench');
      const layouts = [];
      for (const width of [600, 1280]) {
        await page.command('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: false });
        const view = await page.evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r({width:innerWidth,links:[...document.querySelectorAll(".assistant-message-content .message-path-link")].map(e=>{const b=e.getBoundingClientRect(),p=e.parentElement.getBoundingClientRect();return {text:e.textContent,visible:e.checkVisibility({checkOpacity:true,checkVisibilityCSS:true}),left:b.left,right:b.right,width:b.width,height:b.height,parentLeft:p.left,parentRight:p.right,parentWidth:p.width,scroll:e.scrollWidth,client:e.clientWidth}})}))))');
        assert.equal(view.links.length, 6);
        assert.ok(view.links.every(link => link.visible && link.width > 0 && link.height > 0 && link.parentWidth > 0 && link.left >= link.parentLeft - 1 && link.right <= link.parentRight + 1 && link.left >= 0 && link.right <= width && link.scroll <= link.client + 1), json(view));
        layouts.push(view);
      }
      const capture = await page.command('Page.captureScreenshot', { format: 'png' });
      report.screenshot = path.join(output, 'message-links-final.png');
      await fs.writeFile(report.screenshot, Buffer.from(capture.data, 'base64'));
      return layouts;
    });
  }
  report.status = 'passed';
}
main().catch(error => { report.status = 'failed'; report.error = error.stack; console.error(error); process.exitCode = 1; }).finally(async () => {
  try {
    report.closedExplorer = await explorer(true);
    if (app?.exitCode === null && page) await page.evaluate('window.scodex.quitApp()');
    if (app) await wait(() => Promise.resolve(app.exitCode !== null), 'Owned app shutdown', 20000);
    socket?.close(); report.processExited = !app || app.exitCode !== null;
    const resolved = path.resolve(fixture);
    assert.ok(resolved.startsWith(output + path.sep) && path.basename(resolved).startsWith('fixture-'));
    await fs.rm(resolved, { recursive: true, force: true });
    report.fixtureRemoved = !await fs.stat(resolved).then(() => true, error => { if (error.code === 'ENOENT') return false; throw error; });
    report.cleanup = 'passed';
  } catch (error) { report.cleanup = 'failed'; report.cleanupError = error.stack; report.status = 'failed'; process.exitCode = 1; }
  await persist(); console.log(report.status);
});
