const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const net = require('node:net');
const assert = require('node:assert/strict');
const { spawn, execFile } = require('node:child_process');
const { promisify } = require('node:util');
const execute = promisify(execFile);
const project = path.resolve(__dirname, '..');
const output = path.join(project, 'release', 'configuration');
const stage = path.join(project, 'release', 'configuration-app');
const continueChat = process.argv.includes('--continue-chat');
const continueActions = process.argv.includes('--continue-actions');
const nativeProbe = process.argv.includes('--native-probe');
const resume = process.argv.includes('--continue-efforts') || continueChat || continueActions || nativeProbe;
const previous = resume ? require(path.join(output, 'configuration-ui-verification.json')) : null;
const temporary = previous?.temporary || path.join(os.tmpdir(), 'scodex-configuration-ui-' + crypto.randomUUID());
const profile = path.join(temporary, 'profile');
const root = path.join(temporary, 'scodex');
const workspace = path.join(temporary, 'workspace');
const sharedFile = path.join(root, 'codex-settings.json');
const workspaceFile = path.join(workspace, '.scodex', 'codex-settings.json');
const report = { date: new Date().toISOString(), environment: `${os.platform()} ${os.release()} ${os.arch()}`, checks: [], status: 'running', temporary, limitations: ['Successful OS-associated editor opening is not automated; missing workspace config is verified.', 'Grok model generation and server support for reasoning levels are outside this configuration test; no credentials are copied.'] };
if (previous) { report.checks = previous.checks; report.reused = { date: previous.date, version: previous.version, renderer: previous.renderer }; report.previousFailures = [...(previous.previousFailures || []), ...(previous.previousFailure ? [previous.previousFailure] : []), previous.error]; }
async function waitFor(predicate, name, milliseconds = 20000) {
  const end = Date.now() + milliseconds; let last;
  while (Date.now() < end) { try { const value = await predicate(); if (value) return value; } catch (error) { last = error; } await new Promise((resolve) => setTimeout(resolve, 120)); }
  throw new Error(name + (last ? ': ' + last.message : ''));
}
function connect(socket) {
  let id = 0; const pending = new Map();
  socket.addEventListener('message', ({ data }) => { const value = JSON.parse(data); const request = pending.get(value.id); if (!request) return; pending.delete(value.id); clearTimeout(request.timer); value.error ? request.reject(new Error(value.error.message)) : request.resolve(value.result); });
  const command = (method, params = {}) => new Promise((resolve, reject) => { const key = ++id; const timer = setTimeout(() => { pending.delete(key); reject(new Error('CDP timeout: ' + method)); }, 20000); pending.set(key, { resolve, reject, timer }); socket.send(JSON.stringify({ id: key, method, params })); });
  return { command, async evaluate(expression) { const result = await command('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, userGesture: true }); if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text); return result.result?.value; } };
}
const psQuote = (text) => "'" + text.replaceAll("'", "''") + "'";
async function nativeButton(title, button) {
  const script = `$ErrorActionPreference='Stop'
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public static class ConfigurationNativeDialog { [DllImport("user32.dll")] public static extern IntPtr SendMessage(IntPtr hWnd, uint msg, IntPtr wParam, IntPtr lParam); }'
$deadline=[DateTime]::UtcNow.AddSeconds(15)
do {
  $windows=[Windows.Automation.AutomationElement]::RootElement.FindAll([Windows.Automation.TreeScope]::Children,[Windows.Automation.Condition]::TrueCondition)
  foreach($window in $windows) {
    $process=Get-CimInstance Win32_Process -Filter ('ProcessId = '+$window.Current.ProcessId)
    if(-not $process.CommandLine -or -not $process.CommandLine.Contains(${psQuote(profile)})) { continue }
    $dialogCondition=New-Object Windows.Automation.PropertyCondition([Windows.Automation.AutomationElement]::NameProperty,${psQuote(title)})
    $dialog=$window.FindFirst([Windows.Automation.TreeScope]::Descendants,$dialogCondition)
    if(-not $dialog -or $dialog.Current.ClassName -ne '#32770') {continue}
    $condition=New-Object Windows.Automation.PropertyCondition([Windows.Automation.AutomationElement]::NameProperty,${psQuote(button)})
    $target=$dialog.FindFirst([Windows.Automation.TreeScope]::Descendants,$condition)
    if($target) {
      if($target.Current.AutomationId -notmatch '^CommandButton_([0-9]+)$' -or $dialog.Current.NativeWindowHandle -eq 0) { throw 'Unknown native task-dialog control' }
      $buttonId=[int]$Matches[1]
      [ConfigurationNativeDialog]::SendMessage([IntPtr]$dialog.Current.NativeWindowHandle,1126,[IntPtr]$buttonId,[IntPtr]::Zero) | Out-Null
      'Invoked native task-dialog button '+${psQuote(button)}; exit 0
    }
  }
  Start-Sleep -Milliseconds 150
} while([DateTime]::UtcNow -lt $deadline)
throw 'Isolated native dialog or button not found'`;
  try { return await execute('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')], { windowsHide: true, timeout: 20000 }); }
  catch (error) { throw new Error('Native dialog: ' + String(error.stderr || error.message).slice(-2500)); }
}
async function main() {
  let child; let socket; let cdp; let diagnostic = '';
  const check = (name, evidence) => { report.checks.push({ name, status: 'passed', ...(evidence ? { evidence } : {}) }); console.log('PASS:', name); };
  const json = async (file) => JSON.parse(await fs.readFile(file, 'utf8'));
  try {
    await fs.mkdir(profile, { recursive: true }); await fs.mkdir(workspace, { recursive: true }); await fs.mkdir(path.join(root, 'bin'), { recursive: true });
    await fs.copyFile(path.resolve(project, '..', 'bin', 'codex.exe'), path.join(root, 'bin', 'codex.exe'));
    for (const file of ['Scodex.cmd', 'Scodex-module-2.cmd', 'start-scodex.ps1']) await fs.copyFile(path.resolve(project, '..', file), path.join(root, file));
    await fs.writeFile(path.join(root, 'config.toml'), 'disable_response_storage = true\n');
    await fs.writeFile(path.join(workspace, 'project-preserved.txt'), '安装重装保留项目中文 🚀');
    if (!resume) await fs.writeFile(path.join(profile, 'settings.json'), JSON.stringify({ workspaceRoot: workspace, preferences: { browserPanelOpen: false, themeMode: 'light', fontSize: 16 } }));
    const manifest = await json(path.join(stage, 'package.json'));
    const renderer = (await fs.readFile(path.join(stage, 'dist', 'index.html'), 'utf8')).match(/assets\/index-[^"\s]+\.js/)[0];
    const executable = path.join(output, `Scodex-Workbench-Configuration-${manifest.version}-x64.exe`);
    report.version = manifest.version; report.renderer = renderer; report.executable = executable;
    if (previous) { assert.equal(previous.renderer, renderer); assert.equal(previous.version, manifest.version); }
    async function start() {
      const server = net.createServer(); await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve)); const port = server.address().port; await new Promise((resolve) => server.close(resolve));
      child = spawn(executable, [`--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--disable-gpu'], { cwd: output, env: { ...process.env, SCODEX_HOME: root }, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
      child.stdout.resume(); child.stderr.on('data', (bytes) => { diagnostic = (diagnostic + bytes).slice(-5000); });
      const target = await waitFor(async () => { if (child.exitCode !== null) throw new Error(diagnostic); const targets = await fetch(`http://127.0.0.1:${port}/json/list`).then((response) => response.json()); return targets.find((item) => item.type === 'page'); }, 'Actual EXE startup');
      socket = new WebSocket(target.webSocketDebuggerUrl); await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); }); cdp = connect(socket);
      await waitFor(() => cdp.evaluate("Boolean(document.querySelector('.app-shell')) && !document.querySelector('.app-loading')"), 'Actual renderer');
      assert.equal((await cdp.evaluate('window.scodex.getAppState()')).version, manifest.version);
      assert.equal(await cdp.evaluate(`[...document.scripts].some(script=>script.src.endsWith(${JSON.stringify(renderer)}))`), true);
    }
    async function stop() { await cdp.command('Browser.close').catch(() => {}); await waitFor(() => child.exitCode !== null, 'Actual EXE exit', 20000); if (socket.readyState === WebSocket.OPEN) socket.close(); }
    const click = (text, selector = 'button') => cdp.evaluate(`(() => { const target=[...document.querySelectorAll(${JSON.stringify(selector)})].find(item=>item.textContent.trim()===${JSON.stringify(text)}); if(!target || target.disabled) throw new Error('Unavailable: '+${JSON.stringify(text)}); target.scrollIntoView({block:'center'}); target.click(); })()`);
    const select = async (label, value) => { await cdp.evaluate(`(() => { const select=document.querySelector(${JSON.stringify('[aria-label="' + label + '"]')}); if(!select || select.disabled) throw new Error('Unavailable select'); select.scrollIntoView({block:'center'}); select.value=${JSON.stringify(value)}; select.dispatchEvent(new Event('change',{bubbles:true})); })()`); await waitFor(() => cdp.evaluate(`document.querySelector(${JSON.stringify('[aria-label="' + label + '"]')})?.value===${JSON.stringify(value)}`), 'Selection rendered: ' + label); };
    const openSettings = async () => { await waitFor(() => cdp.evaluate('Boolean(document.querySelector(\'[aria-label="设置"]\'))'), 'settings entry'); await cdp.evaluate('document.querySelector(\'[aria-label="设置"]\').click()'); await click('配置', '.settings-category'); await waitFor(() => cdp.evaluate('Boolean(document.querySelector(\'[aria-label="配置范围"]\'))'), 'configuration UI'); };
    const scope = async (value) => { await select('配置范围', value); await waitFor(() => cdp.evaluate('!document.querySelector(\'[aria-label="刷新配置检查"]\').disabled'), 'Real configuration status'); };
    const diskValue = (key, value, file = sharedFile) => waitFor(async () => (await json(file))[key] === value, 'Disk readback ' + key);
    const key = async (value, code, keyCode, modifiers = 0) => { await cdp.command('Input.dispatchKeyEvent', { type: 'keyDown', key: value, code, windowsVirtualKeyCode: keyCode, modifiers }); await cdp.command('Input.dispatchKeyEvent', { type: 'keyUp', key: value, code, windowsVirtualKeyCode: keyCode, modifiers }); };
    await start();
    const startupTools = await cdp.evaluate('window.scodex.getWorkspaceTools()');
    assert.equal(startupTools.installed, true);
    assert.equal(startupTools.source, 'application-bundle');
    report.startupTools = startupTools;
    check('Fresh application launch automatically installs bundled tools offline before opening the UI', startupTools);
    await openSettings();
    if (nativeProbe) {
      await click('检查更新');
      const script = `$ErrorActionPreference='Stop'; $ProgressPreference='SilentlyContinue'; [Console]::OutputEncoding=[Text.Encoding]::UTF8; Add-Type -AssemblyName UIAutomationClient; Add-Type -AssemblyName UIAutomationTypes
$processes=@(Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -and $_.CommandLine.Contains(${psQuote(profile)}) -and $_.Name -notlike 'powershell*' })
$ids=@($processes.ProcessId)
$windows=[Windows.Automation.AutomationElement]::RootElement.FindAll([Windows.Automation.TreeScope]::Children,[Windows.Automation.Condition]::TrueCondition)
$result=@(foreach($window in $windows) { if($window.Current.ProcessId -notin $ids) {continue}; $elements=$window.FindAll([Windows.Automation.TreeScope]::Descendants,[Windows.Automation.Condition]::TrueCondition); @{name=$window.Current.Name;class=$window.Current.ClassName;pid=$window.Current.ProcessId;children=@($elements | ForEach-Object { @{name=$_.Current.Name;class=$_.Current.ClassName;type=$_.Current.ControlType.ProgrammaticName;id=$_.Current.AutomationId;handle=$_.Current.NativeWindowHandle;patterns=@($_.GetSupportedPatterns() | ForEach-Object {$_.ProgrammaticName})} })} })
@{processes=@($processes | Select-Object ProcessId,Name,CommandLine);windows=$result} | ConvertTo-Json -Depth 6`;
      const result = await execute('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')], { windowsHide: true, timeout: 20000, maxBuffer: 2000000 });
      await fs.writeFile(path.join(output, 'configuration-native-state.json'), result.stdout); report.status = 'diagnostic-only'; return;
    }
    const openEfforts = () => cdp.evaluate('document.querySelector(".settings-effort-select summary").click()');
    const fields = [
      ['批准策略', 'approvalPolicy', ['never', 'on-request']],
      ['沙盒设置', 'sandboxMode', ['read-only', 'workspace-write', 'danger-full-access']],
      ['网页搜索', 'webSearch', ['disabled', 'cached', 'indexed', 'live']],
      ['输出详细程度', 'outputDetail', ['default', 'low', 'medium', 'high']],
      ['推理摘要', 'reasoningSummary', ['auto', 'concise', 'detailed', 'none']],
    ];
    if (!resume) {
    assert.equal((await cdp.evaluate('window.scodex.getAppState()')).workspaceRoot, workspace);
    await waitFor(() => cdp.evaluate("document.querySelector('.settings-config-status').textContent.includes('disable_response_storage')"), 'Genuine CLI warning on screen');
    check('Actual packaged identity, isolated profile/home, configuration category and genuine CLI warning');
    for (const [label, property, values] of fields) for (const value of values) { await select(label, value); await diskValue(property, value); }
    check('All 17 attachment enum values save through the real UI and read back from disk');
    await scope('workspace'); await select('网页搜索', 'cached'); await diskValue('webSearch', 'cached', workspaceFile);
    assert.deepEqual(await json(workspaceFile), { webSearch: 'cached' });
    await scope('shared'); await select('输出详细程度', 'low'); await diskValue('outputDetail', 'low');
    await scope('workspace'); assert.equal(await cdp.evaluate('document.querySelector(\'[aria-label="输出详细程度"]\').value'), 'low');
    assert.equal(await cdp.evaluate('document.querySelector(\'[aria-label="网页搜索"]\').value'), 'cached');
    const missing = await cdp.evaluate('window.scodex.openCodexConfig("workspace").then(()=>"",error=>error.message)'); assert.match(missing, /尚无 config.toml/);
    await click('使用默认设置'); await waitFor(async () => Object.keys(await json(workspaceFile)).length === 0, 'Inheritance reset on disk');
    assert.equal(await cdp.evaluate('document.querySelector(\'[aria-label="网页搜索"]\').value'), 'live');
    await scope('shared');
    check('Workspace sparse overrides, live inheritance, restore defaults and missing config error');
    await openEfforts();
    await cdp.evaluate('document.querySelector(\'[aria-label="Ultra推理强度"]\').click()');
    await waitFor(async () => (await json(sharedFile)).availableReasoningEfforts.length === 6, 'Six enabled levels');
    for (const label of ['轻度', '高', '极高', 'Max', 'Ultra']) {
      await cdp.evaluate(`document.querySelector(${JSON.stringify('[aria-label="' + label + '推理强度"]')}).click()`);
      await waitFor(() => cdp.evaluate('document.querySelector(".settings-effort-menu").getAttribute("aria-busy")==="false"'), 'Effort save');
    }
    assert.deepEqual((await json(sharedFile)).availableReasoningEfforts, ['medium']);
    assert.equal(await cdp.evaluate('document.querySelector(\'[aria-label="中推理强度"]\').disabled'), true);
    } else if (!continueChat && !continueActions) { assert.deepEqual((await json(sharedFile)).availableReasoningEfforts, ['medium']); await openEfforts(); }
    let firstChat;
    if (!continueChat && !continueActions) {
    await cdp.evaluate('document.querySelector(".settings-effort-select summary").focus()'); await key('Escape', 'Escape', 27);
    assert.equal(await cdp.evaluate('document.querySelector(".settings-effort-select").open'), false);
    await openEfforts();
    const heading = await cdp.evaluate('(() => {const e=document.querySelector(".settings-detail-heading h1");e.scrollIntoView();const r=e.getBoundingClientRect();return {x:r.left+5,y:r.top+5};})()');
    await cdp.command('Input.dispatchMouseEvent', { type: 'mousePressed', ...heading, button: 'left', clickCount: 1 }); await cdp.command('Input.dispatchMouseEvent', { type: 'mouseReleased', ...heading, button: 'left', clickCount: 1 });
    assert.equal(await cdp.evaluate('document.querySelector(".settings-effort-select").open'), false);
    await openEfforts(); await cdp.evaluate('document.querySelector(".settings-effort-select summary").focus()'); await key('Tab', 'Tab', 9, 8);
    assert.equal(await cdp.evaluate('document.querySelector(".settings-effort-select").open'), false);
    await openEfforts(); await cdp.evaluate('document.querySelector(\'[aria-label="高推理强度"]\').click()');
    await waitFor(async () => (await json(sharedFile)).availableReasoningEfforts.length === 2, 'Reenable high'); await key('Escape', 'Escape', 27);
    await select('默认推理强度', 'high'); await diskValue('defaultReasoningEffort', 'high');
    await cdp.evaluate('document.querySelector(\'[aria-label="新建对话"]\').click()');
    await waitFor(() => cdp.evaluate('document.querySelector(\'[aria-label="本轮回答深度"]\')?.value==="high"'), 'New chat default');
    assert.deepEqual(await cdp.evaluate('[...document.querySelector(\'[aria-label="本轮回答深度"]\').options].map(item=>item.value)'), ['medium', 'high']);
    await select('本轮回答深度', 'medium');
    firstChat = await waitFor(() => cdp.evaluate('window.scodex.getAppState().then(state=>state.library.conversations.find(chat=>chat.id===state.library.activeId)?.reasoningEffort==="medium" && state.library.activeId)'), 'Chat-specific depth persisted');
    } else if (continueChat) {
      const state = await cdp.evaluate('window.scodex.getAppState()'); firstChat = state.library.activeId;
      assert.equal(state.library.conversations.find(chat=>chat.id===firstChat).reasoningEffort, 'medium');
      assert.deepEqual(state.agentSettings.availableReasoningEfforts, ['medium', 'high']);
      assert.equal(state.agentSettings.defaultReasoningEffort, 'high');
    } else { firstChat = (await cdp.evaluate('window.scodex.getAppState()')).library.conversations.find(chat=>chat.reasoningEffort==='medium').id; }
    report.firstChat = firstChat;
    if (!continueActions) {
    await cdp.evaluate('document.querySelector(\'[aria-label="新建对话"]\').click()');
    await waitFor(() => cdp.evaluate('document.querySelector(\'[aria-label="本轮回答深度"]\')?.value==="high"'), 'Second chat default');
    check('Six levels, at least one guard, Escape/outside/Tab, restricted composer options and independent chat depth');
    }
    await openSettings();
    if (!continueActions) {
    await cdp.evaluate('document.querySelector(\'[aria-label="Codex 依赖项"]\').click()'); await diskValue('workspaceDependencies', false);
    await cdp.evaluate('document.querySelector(\'[aria-label="Codex 依赖项"]\').click()'); await diskValue('workspaceDependencies', true);
    }
    await click('检查更新'); await nativeButton('更新 Codex CLI', '取消');
    await waitFor(() => cdp.evaluate('document.querySelector(".settings-diagnostic-heading").textContent.includes("已取消")'), 'Update cancelled');
    check('Dependency toggle saves both states; native CLI update cancel performs no update');
    for (let round = 1; round <= 2; round++) {
      await click('重新安装'); await nativeButton('重装工作空间工具', '重新安装');
      const progressTimer = setInterval(async () => { try { console.log('INSTALL:', await cdp.evaluate('document.querySelector(".settings-diagnostic [role=status]")?.textContent || "finishing"')); } catch {} }, 15000);
      try { await waitFor(() => cdp.evaluate('!document.querySelector(".settings-reinstall-button").disabled'), 'Real official tool install ' + round, 360000); }
      finally { clearInterval(progressTimer); }
      const installed = await cdp.evaluate('window.scodex.getWorkspaceTools()');
      report['installation' + round] = { tools: installed, output: await cdp.evaluate('document.querySelector(".settings-diagnostic").textContent') };
      assert.equal(installed.installed, true, report['installation' + round].output);
      assert.equal(installed.source, 'application-bundle');
      assert.match(report['installation' + round].output, /执行完成/);
      assert.doesNotMatch(report['installation' + round].output, /正在下载/);
      if (round === 2) {
        assert.notEqual(installed.directory, report.installation1.tools.directory);
        await fs.access(path.join(report.installation1.tools.directory, 'python', 'python.exe'));
        assert.equal((await json(path.join(root, 'workspace-tools', 'active.json'))).previousDirectory, path.basename(report.installation1.tools.directory));
      }
      assert.equal(await fs.readFile(path.join(workspace, 'project-preserved.txt'), 'utf8'), '安装重装保留项目中文 🚀');
      check('Bundled offline tool install round ' + round + ': checksums, Node/npm/Python/pip execute; project and previous runtime preserved');
    }
    const { createWorkspaceTools } = require(path.join(stage, 'electron', 'workspace-tools.cjs'));
    const manager = createWorkspaceTools(root); const environment = await manager.environment({ PATH: process.env.PATH }); const inspection = await manager.inspect();
    assert.equal(inspection.ok, true, inspection.output); assert.match(environment.SCODEX_NODE, /node\.exe$/); assert.match(environment.SCODEX_PYTHON, /python\.exe$/);
    report.toolInspection = inspection; report.toolEnvironment = { node: environment.SCODEX_NODE, python: environment.SCODEX_PYTHON };
    for (const launcher of ['Scodex.cmd', 'Scodex-module-2.cmd']) {
      const result = await execute('cmd.exe', ['/d', '/c', path.join(root, launcher), 'features', 'list'], { cwd: workspace, env: { ...process.env, CODEX_HOME: root }, windowsHide: true, maxBuffer: 2_000_000 }); assert.match(result.stdout, /workspace_dependencies/);
    }
    check('Offline active runtime inspects successfully and both actual CLI launchers run with enabled tools', inspection.output);
    await click('诊断'); await waitFor(() => cdp.evaluate('!document.querySelector(".settings-reinstall-button").disabled'), 'Real CLI doctor', 60000);
    const diagnosticText = await cdp.evaluate('document.querySelector(".settings-diagnostic").textContent');
    report.diagnostic = diagnosticText;
    assert.match(diagnosticText, /执行完成/); assert.match(diagnosticText, /报告状态：发现问题/); assert.match(diagnosticText, /未配置|missing|auth/);
    const diagnosticDisk = await fs.readFile(path.join(profile, 'codex-diagnostic.txt'), 'utf8'); assert.match(diagnosticDisk, /Health: fail/); assert.match(diagnosticDisk, /pip: pip 25.3/);
    await fs.copyFile(path.join(profile, 'codex-diagnostic.txt'), path.join(output, 'configuration-diagnostic.txt'));
    check('Real CLI doctor completes and separately reports missing-auth health failure; full report persists with installed tool checks');
    const expected = await json(sharedFile);
    await stop(); await start(); await openSettings();
    for (const [label, property] of fields) assert.equal(await cdp.evaluate(`document.querySelector(${JSON.stringify('[aria-label="' + label + '"]')}).value`), expected[property]);
    assert.deepEqual((await cdp.evaluate('window.scodex.getAppState()')).agentSettings, expected);
    assert.equal((await cdp.evaluate('window.scodex.getWorkspaceTools()')).directory, report.installation2.tools.directory);
    assert.equal((await cdp.evaluate('window.scodex.getAppState()')).library.conversations.find((chat) => chat.id === firstChat).reasoningEffort, 'medium');
    check('Full process restart preserves enum settings, active tool installation and per-chat reasoning depth');
    await cdp.evaluate('window.scodex.savePreferences({fontSize:20,themeMode:"dark"})'); await cdp.command('Page.reload'); await waitFor(() => cdp.evaluate('Boolean(document.querySelector(".app-shell"))'), 'Theme reload'); await openSettings();
    await waitFor(() => cdp.evaluate('getComputedStyle(document.querySelector(".app-shell")).getPropertyValue("--ui-font-size").trim()==="20px"'), '20px font applied');
    await cdp.command('Emulation.setDeviceMetricsOverride', { width: 1064, height: 660, deviceScaleFactor: 1, mobile: false });
    const overflow = await cdp.evaluate('[...document.querySelectorAll(".settings-row,.settings-configuration-toolbar,.settings-config-status,.settings-effort-menu")].filter(e=>e.getClientRects().length).map(e=>({class:e.className,left:e.getBoundingClientRect().left,right:e.getBoundingClientRect().right})).filter(r=>r.left < -1 || r.right>innerWidth+1)'); assert.deepEqual(overflow, []);
    await openEfforts();
    const menuOverflow = await cdp.evaluate('(() => {const e=document.querySelector(".settings-effort-menu");e.scrollIntoView({block:"center"}); const r=e.getBoundingClientRect(); return {left:r.left,right:r.right,width:innerWidth};})()'); assert.ok(menuOverflow.left>=0 && menuOverflow.right<=menuOverflow.width);
    await key('Escape', 'Escape', 27); check('Dark theme and 20px controls/menu fit the 1064x660 renderer viewport');
    await cdp.command('Emulation.clearDeviceMetricsOverride'); await cdp.evaluate('window.scodex.savePreferences({fontSize:16,themeMode:"light"})'); await cdp.command('Page.reload'); await waitFor(() => cdp.evaluate('Boolean(document.querySelector(".app-shell"))'), 'Final theme reload'); await openSettings();
    await waitFor(() => cdp.evaluate('!document.querySelector(\'[aria-label="刷新配置检查"]\').disabled'), 'Final config read');
    const screenshot = await cdp.command('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    report.screenshot = path.join(output, 'workbench-configuration.png'); await fs.writeFile(report.screenshot, Buffer.from(screenshot.data, 'base64'));
    await stop(); check('Final light-theme screenshot and complete app shutdown'); report.status = 'passed';
  } catch (error) {
    report.status = 'failed'; report.error = error.stack; console.error(error); process.exitCode = 1;
    if (cdp) report.failureState = await cdp.evaluate('({text:document.querySelector(".settings-detail")?.textContent,notice:document.querySelector(".notice")?.textContent})').catch(() => null);
  } finally {
    if (cdp && child?.exitCode === null) await cdp.command('Browser.close').catch(() => {});
    if (socket?.readyState === WebSocket.OPEN) socket.close();
    if (child?.exitCode === null) await waitFor(() => child.exitCode !== null, 'cleanup exit', 5000).catch(async () => { await execute('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true }).catch(() => {}); });
    report.cleanup = child?.exitCode === null ? 'failed: app still running' : 'app exited; isolated evidence directory retained';
    await fs.writeFile(path.join(output, 'configuration-ui-verification.json'), JSON.stringify(report, null, 2));
  }
}
module.exports = { waitFor, connect };
if (require.main === module) main().catch((error) => { console.error(error); process.exitCode = 1; });
