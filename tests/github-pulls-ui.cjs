// Actual portable EXE, Windows safeStorage and Git. GitHub is a loopback fixture.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises'), path = require('node:path'), os = require('node:os'), crypto = require('node:crypto');
const { spawn, execFile } = require('node:child_process');
const execFileAsync = require('node:util').promisify(execFile);
const { connect, wait, freePort } = require('./agent-workflow-ui.cjs');
const { startGitHubFixture } = require('./github-pulls-fixture.cjs');
const root = path.resolve(__dirname, '..'), version = '1.3.19', json = JSON.stringify;
const executable = path.resolve(process.env.SCODEX_PR_EXE || path.join(root, 'release/pr-flow-20261030/candidate/Scodex-Workbench-' + version + '-x64.exe'));
const output = path.resolve(process.env.SCODEX_PR_OUTPUT || path.join(root, 'release/pr-flow-20261030/candidate-ui'));
const entryOnly = process.env.SCODEX_PR_SCOPE === 'entry';
const fixture = path.join(os.tmpdir(), 'scodex-pr-ui-' + crypto.randomUUID());
const profile = path.join(fixture, 'profile'), project = path.join(fixture, 'project'), home = path.join(fixture, 'scodex'), plain = path.join(fixture, 'plain');
const report = { status: 'running', version, executable, fixture, scope: entryOnly ? 'entry' : 'full', checks: [], environment: { platform: os.platform(), release: os.release(), node: process.version }, limitations: ['Actual packaged EXE/React/IPC, Windows safeStorage, native confirmation and real Git repository.', 'GitHub API and repository state are supplied by a loopback compatible service; no public account, repository, real branch protection or model request is tested.', 'CDP drives renderer interactions; native confirmations are clicked only for this test application PID.'] };
let child, cdp, socket, browserSocket, port, appPid, github;
const save = () => fs.writeFile(path.join(output, 'github-pulls-ui-verification.json'), json(report, null, 2) + '\n');
const ev = expression => cdp.evaluate(expression);
const git = async (...args) => (await execFileAsync('git', ['-c', 'core.hooksPath=' + path.join(fixture, 'hooks'), '-c', 'commit.gpgSign=false', '-C', project, ...args], { windowsHide: true, encoding: 'utf8' })).stdout.trim();
async function check(name, fn) { report.currentCheck = name; await save(); const evidence = await fn(); report.checks.push({ name, status: 'passed', evidence }); await save(); console.log('PASS ' + name); }
async function clickSelector(selector) { await wait(() => ev('(()=>{const e=document.querySelector(' + json(selector) + ');if(!e||e.disabled)return false;e.click();return true})()'), selector); }
const click = label => clickSelector('[aria-label="' + label + '"]');
async function textClick(selector, text) { await wait(() => ev('(()=>{const e=[...document.querySelectorAll(' + json(selector) + ')].find(e=>e.textContent.trim()===' + json(text) + ');if(!e||e.disabled)return false;e.click();return true})()'), text); }
async function input(label, value) { await ev('(()=>{const e=document.querySelector(' + json('[aria-label="' + label + '"]') + ');if(!e)throw Error("Missing input");Object.getOwnPropertyDescriptor(e.tagName==="TEXTAREA"?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,"value").set.call(e,' + json(value) + ');e.dispatchEvent(new Event("input",{bubbles:true}))})()'); }
async function select(label, value) { await ev('(()=>{const e=document.querySelector(' + json('[aria-label="' + label + '"]') + ');e.value=' + json(value) + ';e.dispatchEvent(new Event("change",{bubbles:true}))})()'); }
async function viewport(width, height) { await cdp.command('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false }); await ev('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))'); }
async function settled() { await wait(() => ev('!document.querySelector(".pr-workbench .spin") && !document.querySelector(".pr-dialog footer button:disabled")'), 'PR operation complete', 40000); }
async function openGit() { await click('版本控制'); await wait(() => ev('!!document.querySelector(".pr-workbench")'), 'PR workbench'); await wait(() => ev('!document.querySelector(".git-panel .spin")'), 'Git snapshot ready'); }
async function load() { await textClick('.pr-toolbar button', '读取 PR'); await settled(); await wait(() => ev('!!document.querySelector(".pr-pagination")'), 'PR list loaded'); }
async function closeDialog() { await click('关闭 PR 对话框'); await wait(() => ev('!document.querySelector(".pr-dialog")'), 'PR dialog closed'); }
async function createForm(draft = true) {
  await textClick('.pr-toolbar button', '创建 PR'); await wait(() => ev('!!document.querySelector(' + json('[aria-label="PR 标题"]') + ')'), 'Create form');
  await input('PR 标题', draft ? '工作台草稿：隐藏式文件详情' : '工作台正式 PR：中文说明');
  await input('PR 说明', '验证默认折叠、点击展开、原生确认及提交绑定。\n保留远端分支。');
  if (await ev('document.querySelector(".pr-draft-option input").checked') !== draft) await clickSelector('.pr-draft-option input');
}
async function attach(target) { const ws = new WebSocket(target.webSocketDebuggerUrl); await new Promise((resolve, reject) => { ws.addEventListener('open', resolve, { once: true }); ws.addEventListener('error', reject, { once: true }); }); return { ws, client: connect(ws) }; }
async function launch() {
  port = await freePort();
  child = spawn(executable, ['--remote-debugging-port=' + port, '--user-data-dir=' + profile, '--disable-gpu'], { cwd: path.dirname(executable), windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'], env: { ...process.env, SCODEX_HOME: home, SCODEX_REFERENCE_HOME: path.join(fixture, 'reference'), SCODEX_REFERENCE_AGENTS_HOME: path.join(fixture, 'agents'), SCODEX_GITHUB_TEST_ENDPOINT: github.endpoint } });
  let stderr = ''; child.stderr.on('data', b => { stderr = (stderr + b.toString()).slice(-3000); });
  const target = await wait(async () => { if (child.exitCode !== null) throw Error('EXE exit ' + child.exitCode + ': ' + stderr); return (await fetch('http://127.0.0.1:' + port + '/json/list').then(r => r.json())).find(t => t.type === 'page' && t.url.startsWith('file:')); }, 'Actual EXE startup', 60000);
  const browser = await attach(await fetch('http://127.0.0.1:' + port + '/json/version').then(r => r.json())); browserSocket = browser.ws;
  appPid = (await browser.client.command('SystemInfo.getProcessInfo')).processInfo.find(p => p.type === 'browser').id;
  const renderer = await attach(target); socket = renderer.ws; cdp = renderer.client;
  await wait(() => ev('!!document.querySelector("[aria-label=输入工作内容]")'), 'Renderer ready');
  const identity = await ev('window.scodex.getAppState().then(s=>({version:s.version,workspaceRoot:s.workspaceRoot,userDataPath:s.userDataPath}))');
  assert.equal(identity.version, version); assert.equal(path.resolve(identity.workspaceRoot), project); assert.equal(path.resolve(identity.userDataPath), profile);
  report.appPid = appPid; await cdp.command('Page.bringToFront');
  return { ...identity, pageUrl: target.url, nativeBrowserPid: appPid };
}
async function quit() {
  if (!child || child.exitCode !== null) return;
  await ev('window.scodex.quitApp()'); await wait(() => Promise.resolve(child.exitCode !== null), 'Portable exit', 20000);
  assert.equal(child.exitCode, 0); report.exitCode = child.exitCode; socket?.close(); browserSocket?.close();
}
async function nativeDialog(buttonText){const source="using System; using System.Text; using System.Collections.Generic; using System.Runtime.InteropServices; public static class ScodexRemoteDialog { public delegate bool Callback(IntPtr h,IntPtr p); [DllImport(\"user32.dll\")] public static extern bool EnumWindows(Callback cb,IntPtr p); [DllImport(\"user32.dll\")] public static extern bool EnumChildWindows(IntPtr h,Callback cb,IntPtr p); [DllImport(\"user32.dll\")] public static extern uint GetWindowThreadProcessId(IntPtr h,out uint p); [DllImport(\"user32.dll\",CharSet=CharSet.Unicode)] public static extern int GetClassName(IntPtr h,StringBuilder s,int n); [DllImport(\"user32.dll\",CharSet=CharSet.Unicode)] public static extern int GetWindowText(IntPtr h,StringBuilder s,int n); [DllImport(\"user32.dll\")] public static extern bool IsWindowVisible(IntPtr h); [DllImport(\"user32.dll\")] public static extern IntPtr SendMessage(IntPtr h,uint m,IntPtr w,IntPtr l); static string Class(IntPtr h){var s=new StringBuilder(128);GetClassName(h,s,s.Capacity);return s.ToString();} static string Text(IntPtr h){var s=new StringBuilder(512);GetWindowText(h,s,s.Capacity);return s.ToString();} public static IntPtr Find(uint pid){IntPtr found=IntPtr.Zero;EnumWindows((h,p)=>{uint owner;GetWindowThreadProcessId(h,out owner);if(owner==pid&&IsWindowVisible(h)&&Class(h)==\"#32770\"){found=h;return false;}return true;},IntPtr.Zero);return found;} public static string Click(IntPtr d,string target){var labels=new List<string>();bool clicked=false;EnumChildWindows(d,(h,p)=>{var text=Text(h);if(Class(h)==\"Button\"){labels.Add(text);if(text==target){SendMessage(h,0x00F5,IntPtr.Zero,IntPtr.Zero);clicked=true;return false;}}return true;},IntPtr.Zero);if(!clicked)throw new Exception(\"Native confirmation button not found: \"+String.Join(\"|\",labels));return String.Join(\"|\",labels);}}";const script="$ErrorActionPreference='Stop'; [Console]::OutputEncoding=[Text.UTF8Encoding]::new($false); Add-Type -TypeDefinition '"+source.replace(/'/g,"''")+"'; $deadline=[DateTime]::UtcNow.AddSeconds(12); do{$window=[ScodexRemoteDialog]::Find("+(appPid||child.pid)+"); if($window -eq [IntPtr]::Zero){Start-Sleep -Milliseconds 100}}while($window -eq [IntPtr]::Zero -and [DateTime]::UtcNow -lt $deadline); if($window -eq [IntPtr]::Zero){throw 'Native confirmation not found'}; [Console]::WriteLine([ScodexRemoteDialog]::Click($window,'"+buttonText.replace(/'/g,"''")+"'))";return (await execFileAsync('powershell.exe',['-NoProfile','-NonInteractive','-Command',script],{windowsHide:true,encoding:'utf8',timeout:20000})).stdout.trim();}
async function confirmed(buttonText) { const labels = await nativeDialog(buttonText); report.nativeConfirmations ||= []; report.nativeConfirmations.push({ button: buttonText, labels }); await save(); await settled(); }
async function rejected(expression, pattern) { const result = await ev('(async()=>{try{await (' + expression + ');return{ok:true}}catch(e){return{ok:false,message:e.message}}})()'); assert.equal(result.ok, false); assert.match(result.message, pattern); return result.message; }
async function setup() {
  await fs.mkdir(output, { recursive: true }); for (const dir of [profile, project, home, plain]) await fs.mkdir(dir, { recursive: true });
  await git('init', '-b', 'main'); await git('config', 'user.name', 'Scodex Fixture'); await git('config', 'user.email', 'fixture@example.invalid');
  await fs.writeFile(path.join(project, '工作台.txt'), '初始内容\n'); await git('add', '.'); await git('commit', '-m', 'initial');
  await git('checkout', '-b', 'feature/disclosure'); await fs.appendFile(path.join(project, '工作台.txt'), '折叠式详情\n'); await git('add', '.'); await git('commit', '-m', 'disclosure');
  await git('remote', 'add', 'origin', 'https://github.com/scodex-fixture/workbench.git');
  const now = new Date().toISOString();
  await fs.writeFile(path.join(profile, 'settings.json'), json({ workspaceRoot: project, activeProjectId: 'pr-project', projects: [{ id: 'pr-project', name: 'PR 验收项目', path: project, createdAt: now, updatedAt: now }, { id: 'plain-project', name: '普通文件夹', path: plain, createdAt: now, updatedAt: now }], preferences: { contextAccess: 'manual', trayEnabled: false, browserPanelOpen: false, themeMode: 'light', fontFamily: 'Microsoft YaHei', fontSize: 16, closeConfirmation: 'never' } }));
  await fs.writeFile(path.join(home, 'codex-settings.json'), json({ sandboxMode: 'danger-full-access', approvalPolicy: 'on-request', workspaceDependencies: false }));
  github = await startGitHubFixture({ head: await git('rev-parse', 'HEAD') });
  github.state.pulls.push({ number: 1, node_id: 'PR_Fixture_1', title: '现有 PR：清晰的工作台', body: '中文内容和变更文件默认折叠。', draft: false, state: 'open', merged: false, user: { login: 'scodex-fixture' }, head: { ref: 'feature/review', sha: github.state.head }, base: { ref: 'main' }, updated_at: now, mergeable: true, mergeable_state: 'clean', additions: 12, deletions: 3, changed_files: 2, commits: 1 });
}
async function main() {
  try {
    await setup(); report.sha256 = crypto.createHash('sha256').update(await fs.readFile(executable)).digest('hex');
    await check('packaged-exe-identity', launch);
    await check('public-pr-read-and-windows-encrypted-connection', async () => {
      await openGit(); await load(); assert.match(await ev('document.querySelector(".pr-list").innerText'), /现有 PR：清晰的工作台/);
      assert.equal(github.state.requests.every(r => !r.authenticated), true);
      await textClick('.pr-heading button', '连接 GitHub'); await input('GitHub 访问令牌', github.token); await textClick('.pr-auth-form button', '验证并加密保存');
      await wait(() => ev('document.querySelector(".pr-heading button").textContent==="scodex-fixture"'), 'Connected account');
      const stored = await fs.readFile(path.join(profile, 'github-connection.json'), 'utf8'), state = await ev('window.scodex.githubStatus()');
      assert.equal(stored.includes(github.token), false); assert.ok(JSON.parse(stored).encryptedToken.length > 40); assert.equal(state.connected, true); assert.equal(json(state).includes(github.token), false); assert.equal(state.encryptedToken, undefined);
      await load(); assert.equal(github.state.requests.at(-1).authenticated, true);
      return { publicRead: true, authenticatedRead: true, realWindowsEncryptedFile: true, secretNotReturnedToRenderer: true };
    });
    if (!entryOnly) {
      await check('cancel-and-confirm-draft-create-with-write-lifecycle-guards', async () => {
        await createForm(); await textClick('.pr-dialog footer button', '创建草稿 PR');
        await wait(() => ev('document.querySelector(".pr-dialog footer .primary-button").disabled'), 'Create busy');
        const projectDenied = await rejected('window.scodex.selectProject("plain-project")', /Git 写入正在进行/);
        await ev('window.scodex.quitApp()'); assert.equal(child.exitCode, null);
        await confirmed('取消'); assert.equal(github.state.writes.length, 0); assert.match(await ev('document.querySelector(".pr-dialog").innerText'), /已取消/);
        await textClick('.pr-dialog footer button', '创建草稿 PR'); await confirmed('确认创建');
        assert.equal(github.state.writes.length, 1); assert.equal(github.state.writes[0].body.draft, true);
        await wait(() => ev('document.querySelector(".pr-dialog header h2").textContent.startsWith("#2 ")'), 'Created draft detail');
        assert.match(await ev('document.querySelector(".pr-dialog").innerText'), /PR 已创建并核对远端记录/);
        assert.equal((await ev('window.scodex.getAppState()')).activeProjectId, 'pr-project');
        return { cancelledNoWrite: true, draftVerified: true, projectDenied, quitDeniedDuringWrite: true };
      });
      await check('duplicate-pr-opens-existing-record-without-write', async () => {
        await closeDialog(); await createForm(); await textClick('.pr-dialog footer button', '创建草稿 PR'); await settled();
        await wait(() => ev('document.querySelector(".pr-dialog").innerText.includes("已打开现有记录")'), 'Existing PR detail'); assert.equal(github.state.writes.length, 1);
        return { openedNumber: 2, duplicateWrites: 0 };
      });
      await check('draft-ready-and-sha-bound-squash-merge', async () => {
        await textClick('.pr-dialog footer button', '标记为可审查'); await confirmed('取消'); assert.equal(github.state.pulls[1].draft, true);
        await textClick('.pr-dialog footer button', '标记为可审查'); await confirmed('确认发起审查'); assert.equal(github.state.pulls[1].draft, false);
        await wait(() => ev('!!document.querySelector(' + json('[aria-label="PR 合并方式"]') + ')'), 'Ready merge controls');
        await select('PR 合并方式', 'squash'); await textClick('.pr-dialog footer button', '合并 PR'); await confirmed('取消'); assert.equal(github.state.pulls[1].merged, false);
        await textClick('.pr-dialog footer button', '合并 PR'); await confirmed('确认合并');
        assert.equal(github.state.pulls[1].merged, true); const merge = github.state.writes.find(w => w.type === 'merge'); assert.equal(merge.body.sha, github.state.head); assert.equal(merge.body.merge_method, 'squash');
        assert.match(await ev('document.querySelector(".pr-dialog").innerText'), /PR 已合并/);
        return { readyReadBack: true, mergeReadBack: true, mergeMethod: merge.body.merge_method, shaBound: true, cancellationsMadeNoWrite: true };
      });
      await check('formal-create-head-protection-and-policy-denial', async () => {
        await closeDialog(); await git('checkout', '-b', 'feature/formal'); await fs.appendFile(path.join(project, '工作台.txt'), '正式 PR\n'); await git('add', '.'); await git('commit', '-m', 'formal');
        await textClick('.git-panel .tool-heading button', '刷新仓库'); await wait(() => ev('document.querySelector(".git-branch-bar").innerText.includes("feature/formal")'), 'New snapshot'); await load(); await createForm(false);
        await textClick('.pr-dialog footer button', '创建正式 PR'); await settled(); await wait(() => ev('document.querySelector(".pr-dialog [role=alert]")?.textContent.includes("普通推送")'), 'Unpushed HEAD refused'); assert.equal(github.state.writes.length, 3);
        github.state.head = await git('rev-parse', 'HEAD'); await textClick('.pr-dialog footer button', '创建正式 PR'); await confirmed('确认创建'); assert.equal(github.state.pulls[2].draft, false);
        await closeDialog(); const snapshot = await ev('window.scodex.gitSnapshot(' + json(project) + ')'), payload = { token: snapshot.token, remote: 'origin', type: 'create', title: '只读拒绝', base: 'main', draft: false };
        const before = github.state.requests.length;
        await ev('window.scodex.saveAgentSettings({sandboxMode:"read-only",approvalPolicy:"never"})');
        await rejected('window.scodex.githubAction(' + json(project) + ',' + json(payload) + ')', /权限策略拒绝|只读模式/); assert.equal(github.state.requests.length, before);
        await ev('window.scodex.saveAgentSettings({sandboxMode:"danger-full-access",approvalPolicy:"never",networkAccess:false})');
        await rejected('window.scodex.githubList(' + json(project) + ',' + json({ token: snapshot.token, remote: 'origin' }) + ')', /权限策略拒绝|网络/); assert.equal(github.state.requests.length, before);
        await ev('window.scodex.saveAgentSettings({sandboxMode:"danger-full-access",approvalPolicy:"on-request",networkAccess:true,networkDomains:["127.0.0.1"],allowLocalBinding:true})');
        return { formalCreated: true, unmatchedHeadRejected: true, readOnlyAndNetworkBlockedBeforeRequests: true };
      });
      await check('windows-encrypted-connection-survives-restart', async () => {
        await quit(); await launch(); const state = await ev('window.scodex.githubStatus()'); assert.equal(state.connected, true); assert.equal(state.login, 'scodex-fixture');
        await openGit(); await load(); assert.equal(github.state.requests.at(-1).authenticated, true);
        return { windowsDecryptionAfterActualRestart: true, authenticatedRequestsAfterRestart: true };
      });
    }
    await check('detail-default-collapse-keyboard-and-two-viewport-layouts', async () => {
      await click('查看 PR #1'); await wait(() => ev('!!document.querySelector(".pr-files")'), 'PR detail');
      assert.equal(await ev('document.querySelector(".pr-files").open'), false); assert.equal(await ev('[...document.querySelectorAll(".pr-file-record")].every(e=>!e.open)'), true);
      await ev('document.querySelector(".pr-files summary").focus()');
      await cdp.command('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, text: '\r', unmodifiedText: '\r' });
      await cdp.command('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
      await wait(() => ev('document.querySelector(".pr-files").open'), 'Keyboard expanded files');
      await clickSelector('.pr-file-record summary'); assert.equal(await ev('document.querySelector(".pr-file-record").open'), true); assert.match(await ev('document.querySelector(".pr-file-record pre").textContent'), /清晰的工作台/);
      await clickSelector('.pr-file-record summary'); await clickSelector('.pr-files > summary');
      const layouts = [];
      for (const [width, height] of [[1440, 900], [1064, 660]]) {
        await viewport(width, height);
        const layout = await ev('(()=>{const d=document.querySelector(".pr-dialog"),r=d.getBoundingClientRect(),f=d.querySelector("footer").getBoundingClientRect();return{top:r.top,bottom:r.bottom,right:r.right,footerBottom:f.bottom,horizontal:d.scrollWidth>d.clientWidth+1,font:getComputedStyle(d).fontFamily,size:getComputedStyle(d).fontSize,bodyHorizontal:document.documentElement.scrollWidth>innerWidth+1}})()');
        layouts.push({ width, height, ...layout }); report.layouts = layouts; await save(); assert.ok(layout.top >= 0 && layout.bottom <= height + 1 && layout.right <= width + 1 && layout.footerBottom <= height + 1, json(layout)); assert.equal(layout.horizontal, false); assert.equal(layout.bodyHorizontal, false); assert.match(layout.font, /Microsoft YaHei/); assert.equal(layout.size, '16px');
      }
      await viewport(1440, 900); const shot = await cdp.command('Page.captureScreenshot', { format: 'png' }); report.screenshot = path.join(output, 'github-pull-detail.png'); await fs.writeFile(report.screenshot, Buffer.from(shot.data, 'base64'));
      await closeDialog(); return { nestedDetailsDefaultCollapsed: true, keyboardAndClickExpanded: true, chinesePatchReadable: true, layouts };
    });
    await check('disconnect-removes-only-isolated-credential', async () => {
      await textClick('.pr-heading button', 'scodex-fixture'); await textClick('.pr-auth-form button', '断开连接');
      await wait(async () => !(await ev('window.scodex.githubStatus()')).connected, 'Disconnected'); assert.equal(await fs.stat(path.join(profile, 'github-connection.json')).then(() => true, () => false), false);
      return { disconnected: true, encryptedFileRemoved: true };
    });
    await quit(); report.status = 'passed';
  } catch (error) {
    report.status = 'failed'; report.error = error.stack; process.exitCode = 1; console.error(error);
    try { report.visibleText = (await ev('document.body.innerText')).slice(-10000); } catch {}
  } finally {
    try { await quit(); } catch (error) { report.quitError = error.message; }
    socket?.close(); browserSocket?.close();
    if (github) { report.requests = github.state.requests; report.writes = github.state.writes; await github.close(); }
    if (!child || child.exitCode !== null) { try { const resolved = path.resolve(fixture); assert.equal(path.dirname(resolved), path.resolve(os.tmpdir())); assert.ok(path.basename(resolved).startsWith('scodex-pr-ui-')); await fs.rm(resolved, { recursive: true, force: true }); report.cleanup = 'removed'; } catch (error) { report.cleanup = 'manual-required'; report.cleanupError = error.message; } }
    else report.cleanup = 'deferred-process-still-running';
    report.finishedAt = new Date().toISOString(); await save(); console.log('RESULT ' + report.status);
  }
}
if (require.main === module) main();
