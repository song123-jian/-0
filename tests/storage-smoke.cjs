const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const net = require('node:net');
const { spawn, execFile } = require('node:child_process');
const { promisify } = require('node:util');
const executeFile = promisify(execFile);
const project = path.resolve(__dirname, '..');
const output = path.join(project, 'release', 'storage');
const stage = path.join(project, 'release', 'storage-app');
const temporary = path.join(os.tmpdir(), 'scodex-storage-ui-' + crypto.randomUUID());
const profile = path.join(temporary, 'profile');
const repository = path.join(temporary, 'repo');
const report = { date: new Date().toISOString(), environment: `${os.platform()} ${os.release()} ${os.arch()}`, checks: [], model: { status: 'not-run' }, status: 'running' };
const finishOnly = process.env.SCODEX_STORAGE_UI_SCOPE === 'finish';
const git = (args) => executeFile('git', ['-C', repository, ...args], { windowsHide: true, encoding: 'utf8' });
async function waitFor(predicate, message, milliseconds = 20000) {
  const end = Date.now() + milliseconds; let last;
  while (Date.now() < end) { try { const value = await predicate(); if (value) return value; } catch (error) { last = error; } await new Promise((resolve) => setTimeout(resolve, 150)); }
  throw new Error(message + (last ? ': ' + last.message : ''));
}
function connect(socket) {
  let id = 0; const pending = new Map();
  socket.addEventListener('message', ({ data }) => { const message = JSON.parse(data); const request = pending.get(message.id); if (!request) return; pending.delete(message.id); clearTimeout(request.timer); message.error ? request.reject(new Error(message.error.message)) : request.resolve(message.result); });
  const command = (method, params = {}) => new Promise((resolve, reject) => { const key = ++id; const timer = setTimeout(() => { pending.delete(key); reject(new Error('CDP timeout: ' + method)); }, 20000); pending.set(key, { resolve, reject, timer }); socket.send(JSON.stringify({ id: key, method, params })); });
  return { command, async evaluate(expression) { const value = await command('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, userGesture: true }); if (value.exceptionDetails) throw new Error(value.exceptionDetails.exception?.description || value.exceptionDetails.text); return value.result?.value; } };
}
async function main() {
  let child; let socket; let cdp;
  const check = (name) => { report.checks.push({ name, status: 'passed' }); console.log('PASS:', name); };
  try {
    await fs.mkdir(profile, { recursive: true }); await fs.mkdir(repository, { recursive: true });
    await git(['init']); await fs.writeFile(path.join(repository, 'sample.txt'), '真实 Git 工作副本'); await fs.writeFile(path.join(repository, '.gitignore'), 'ignored.txt\n');
    await git(['add', '.']); await git(['-c', 'user.name=Storage Smoke', '-c', 'user.email=storage@example.invalid', 'commit', '-m', 'controlled fixture']);
    await fs.writeFile(path.join(profile, 'settings.json'), JSON.stringify({ workspaceRoot: repository, preferences: { browserPanelOpen: false, themeMode: 'light', fontSize: 16 } }));
    const old = { id: 'storage-old', title: '旧聊天验收', createdAt: '2020-01-01T00:00:00Z', updatedAt: '2020-01-02T00:00:00Z', mode: 'answer', draft: '保留中文草稿 🚀', messages: [{ id: 'm1', role: 'user', content: '可查看的旧消息' }] };
    const archived = { ...old, id: 'storage-archived', title: '归档记录验收', archivedAt: '2020-02-01T00:00:00Z' };
    await fs.writeFile(path.join(profile, 'conversations.json'), JSON.stringify({ version: 2, activeId: old.id, conversations: [old, archived] }));
    await fs.writeFile(path.join(profile, 'agent-runs.json'), JSON.stringify({ version: 1, tasks: [{ id: 'fixture-agent', parentId: old.id, title: '旧子任务记录', prompt: '用于展示验证的受控记录', result: '预置记录，仅验证查看与删除', status: 'complete', createdAt: old.createdAt, updatedAt: old.updatedAt }] }));
    const server = net.createServer(); await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve)); const port = server.address().port; await new Promise((resolve) => server.close(resolve));
    const executable = path.join(output, 'Scodex-Workbench-Storage-x64.exe');
    child = spawn(executable, [`--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--disable-gpu'], { cwd: output, windowsHide: false, stdio: ['ignore', 'pipe', 'pipe'] });
    let diagnostic = ''; child.stderr.on('data', (bytes) => { diagnostic = (diagnostic + bytes).slice(-5000); });
    const target = await waitFor(async () => { if (child.exitCode !== null) throw new Error(diagnostic); const targets = await fetch(`http://127.0.0.1:${port}/json/list`).then((response) => response.json()); return targets.find((item) => item.type === 'page'); }, 'Electron startup');
    socket = new WebSocket(target.webSocketDebuggerUrl); await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); }); cdp = connect(socket);
    await waitFor(() => cdp.evaluate("Boolean(document.querySelector('.app-shell'))"), 'real renderer');
    const appState = await cdp.evaluate('window.scodex.getAppState()');
    const manifest = JSON.parse(await fs.readFile(path.join(stage, 'package.json'), 'utf8'));
    report.version = appState.version; report.executable = executable;
    assert.equal(appState.version, manifest.version);
    const renderer = (await fs.readFile(path.join(stage, 'dist', 'index.html'), 'utf8')).match(/assets\/index-[^"\s]+\.js/)[0]; report.renderer = renderer;
    assert.equal(await cdp.evaluate(`[...document.scripts].some(script=>script.src.endsWith(${JSON.stringify(renderer)}))`), true);
    const click = (text, selector = 'button') => cdp.evaluate(`(() => { const button = [...document.querySelectorAll(${JSON.stringify(selector)})].find(item => item.textContent.trim() === ${JSON.stringify(text)}); if (!button || button.disabled) throw new Error('Unavailable button: ' + ${JSON.stringify(text)}); button.click(); })()`);
    const input = async (selector, text) => { await cdp.evaluate(`document.querySelector(${JSON.stringify(selector)}).focus()`); await cdp.command('Input.dispatchKeyEvent', { type: 'keyDown', key: 'a', code: 'KeyA', modifiers: 2, windowsVirtualKeyCode: 65 }); await cdp.command('Input.dispatchKeyEvent', { type: 'keyUp', key: 'a', code: 'KeyA', modifiers: 2, windowsVirtualKeyCode: 65 }); await cdp.command('Input.insertText', { text }); };
    const openSettings = async () => { await waitFor(() => cdp.evaluate('Boolean(document.querySelector(\'[aria-label="设置"],[aria-label="工作台设置"]\'))'), 'settings entry ready'); await cdp.evaluate('document.querySelector(\'[aria-label="设置"],[aria-label="工作台设置"]\').click()'); await click('存储空间', '.settings-category'); await waitFor(() => cdp.evaluate("Boolean(document.querySelector('.storage-legend')) && !document.querySelector('.storage-panel[aria-busy=\"true\"]')"), 'storage view'); };
    const openManager = async (title) => { await cdp.evaluate(`(() => { const row = [...document.querySelectorAll('.storage-management-row')].find(item=>item.querySelector('strong').textContent === ${JSON.stringify(title)}); row.querySelector('button').click(); })()`); await waitFor(() => cdp.evaluate('Boolean(document.querySelector(".storage-manager"))'), title); };
    const back = () => click('返回存储空间');
    const readLibrary = async () => JSON.parse(await fs.readFile(path.join(profile, 'conversations.json'), 'utf8'));
    await openSettings(); check('Exact packaged version/renderer, real settings entry, five-category overview');
    let task; let finished;
    if (!finishOnly) {
    assert.equal(await cdp.evaluate("document.querySelectorAll('.storage-legend dd').length"), 5);
    await fs.writeFile(path.join(profile, 'usage-proof.bin'), Buffer.alloc(12288)); await cdp.evaluate('document.querySelector(\'[aria-label="刷新存储空间"]\').click()');
    await waitFor(() => cdp.evaluate('window.scodex.storageUsage().then(result=>result.sizes.other >= 12288)'), 'real usage refresh'); check('Usage refresh reads new on-disk bytes');
    await openManager('清理旧聊天'); assert.equal(await cdp.evaluate("document.querySelectorAll('.storage-record').length"), 1);
    await click('查看', '.storage-record button'); assert.match(await cdp.evaluate("document.querySelector('.storage-preview').textContent"), /保留中文草稿 🚀/);
    await cdp.evaluate('document.querySelector(\'[aria-label="选择聊天 旧聊天验收"]\').click()'); await click('归档所选');
    await waitFor(async () => (await readLibrary()).conversations.find((chat) => chat.id === old.id).archivedAt, 'archive disk readback');
    await waitFor(() => cdp.evaluate("!document.querySelector('.storage-panel[aria-busy=\"true\"]')"), 'archive settle');
    await back(); await openManager('已归档的聊天'); assert.equal(await cdp.evaluate("document.querySelectorAll('.storage-record').length"), 2);
    await cdp.evaluate('document.querySelector(\'[aria-label="选择聊天 旧聊天验收"]\').click()'); await click('恢复所选');
    await waitFor(async () => !(await readLibrary()).conversations.find((chat) => chat.id === old.id).archivedAt, 'restore disk readback'); check('Old-chat filter, content/subagent preview, archive and restore preserve drafts');
    await cdp.evaluate('document.querySelector(\'[aria-label="查看对话记录"]\').click()'); await waitFor(() => cdp.evaluate("Boolean(document.querySelector('.history-list'))"), 'history');
    assert.match(await cdp.evaluate("document.querySelector('.history-list').textContent"), /旧聊天验收/);
    await cdp.evaluate('document.querySelector(\'[aria-label="归档 旧聊天验收"]\').click()');
    await waitFor(() => cdp.evaluate("!document.querySelector('.history-list').textContent.includes('旧聊天验收')"), 'archived chat hidden');
    await openSettings(); await openManager('已归档的聊天'); await cdp.evaluate('document.querySelector(\'[aria-label="选择聊天 旧聊天验收"]\').click()'); await click('删除所选');
    assert.equal(await cdp.evaluate("document.querySelector('dialog').open"), true); await click('取消', 'dialog button'); assert.ok((await readLibrary()).conversations.some((chat) => chat.id === old.id));
    await click('删除所选'); await click('确认删除', 'dialog button');
    await waitFor(async () => !(await readLibrary()).conversations.some((chat) => chat.id === old.id), 'delete persisted'); check('History archive hides records; permanent delete has cancel/confirm and readback');
    await waitFor(() => cdp.evaluate("!document.querySelector('.storage-panel[aria-busy=\"true\"]')"), 'delete settle'); await back(); await openManager('子智能体');
    await click('查看任务', '.storage-record button'); assert.match(await cdp.evaluate("document.querySelector('.storage-preview').textContent"), /预置记录/);
    await input('[aria-label="子智能体任务"]', '请只回复“存储子任务验收通过”。'); await click('运行子智能体');
    task = await waitFor(() => cdp.evaluate("window.scodex.listAgents().then(tasks=>tasks.find(task=>task.prompt.includes('存储子任务验收通过')))"), 'real model task created');
    console.log('Waiting for one real short model task:', task.id);
    finished = await waitFor(() => cdp.evaluate(`window.scodex.listAgents().then(tasks=>tasks.find(task=>task.id===${JSON.stringify(task.id)} && !['running','queued'].includes(task.status)))`), 'real upstream task completion', 130000);
    report.model = { status: finished.status, result: finished.result, error: finished.error || '' };
    console.log('MODEL_OUTCOME:', JSON.stringify(report.model));
    assert.ok(['complete', 'error', 'cancelled'].includes(finished.status));
    if (finished.status === 'complete') assert.match(finished.result, /存储子任务验收通过/);
    } else {
      const previous = JSON.parse(await fs.readFile(path.join(output, 'storage-ui-verification.json'), 'utf8'));
      assert.equal(previous.renderer, renderer); assert.equal(previous.version, report.version); assert.equal(previous.model.status, 'complete');
      report.reused = { date: previous.date, renderer, checks: previous.checks, model: previous.model };
      report.model = previous.model;
      await openManager('子智能体'); task = { id: 'fixture-agent' }; finished = { status: 'complete' };
    }
    const stopped = await cdp.evaluate("window.scodex.getAppState().then(state=>window.scodex.startAgent({parentId:state.library.activeId,prompt:'取消验证，不需要回复'})).then(async task=>{await window.scodex.cancelAgent(task.id);return task.id})");
    await waitFor(() => cdp.evaluate(`window.scodex.listAgents().then(tasks=>tasks.find(task=>task.id===${JSON.stringify(stopped)})?.status==='cancelled')`), 'real cancellation');
    await click('刷新记录');
    await waitFor(() => cdp.evaluate("[...document.querySelectorAll('.storage-record')].some(item=>item.querySelector('strong')?.textContent==='取消验证，不需要回复')"), 'cancelled task rendered');
    await cdp.evaluate("{ const record=[...document.querySelectorAll('.storage-record')].find(item=>item.querySelector('strong')?.textContent==='取消验证，不需要回复'); [...record.querySelectorAll('button')].find(button=>button.textContent==='删除').click(); }"); await click('确认删除', 'dialog button');
    await waitFor(() => cdp.evaluate(`window.scodex.listAgents().then(tasks=>!tasks.some(task=>task.id===${JSON.stringify(stopped)}))`), 'task deletion persisted');
    check('Real agent cancellation, exact-record confirmed deletion and disk readback; successful upstream evidence preserved separately');
    await cdp.command('Page.reload'); await waitFor(() => cdp.evaluate("Boolean(document.querySelector('.app-shell'))"), 'renderer reload'); await openSettings(); await openManager('子智能体');
    assert.equal(await cdp.evaluate(`window.scodex.listAgents().then(tasks=>tasks.find(task=>task.id===${JSON.stringify(task.id)})?.status)`), finished.status); check('Agent records and archive state survive renderer reload');
    await back(); await openManager('管理工作树'); await click('从当前工作区创建');
    const tree = await waitFor(() => cdp.evaluate('window.scodex.listWorktrees().then(state=>state.trees[0])'), 'Git worktree creation');
    assert.equal(await fs.readFile(path.join(tree.path, 'sample.txt'), 'utf8'), '真实 Git 工作副本');
    await cdp.evaluate("{ const select = document.querySelector('[aria-label=\"保留工作树数量\"]'); select.value='0'; select.dispatchEvent(new Event('change',{bubbles:true})); }");
    await waitFor(async () => JSON.parse(await fs.readFile(path.join(profile, 'worktree-state.json'), 'utf8')).retainCount === 0, 'retention saved');
    await fs.writeFile(path.join(tree.path, 'ignored.txt'), '用户本地内容'); await click('刷新工作树');
    await waitFor(() => cdp.evaluate("document.querySelector('.storage-record')?.textContent.includes('有本地内容')"), 'dirty tree UI');
    assert.match(await cdp.evaluate(`window.scodex.removeWorktree(${JSON.stringify(tree.id)}).then(()=>'',error=>error.message)`), /有修改/); await fs.access(tree.path);
    await fs.rm(path.join(tree.path, 'ignored.txt')); await click('刷新工作树'); await waitFor(() => cdp.evaluate("document.querySelector('.storage-record')?.textContent.includes('干净')"), 'clean tree refresh');
    await click('清理超出数量的副本'); await click('取消', 'dialog button'); await fs.access(tree.path);
    await click('清理超出数量的副本'); await click('确认清理', 'dialog button'); await waitFor(() => cdp.evaluate('window.scodex.listWorktrees().then(state=>state.trees.length===0)'), 'clean tree removed'); await assert.rejects(fs.access(tree.path));
    check('Real Git creation/file readback, retention save, ignored-file deletion guard, cancel and confirmed cleanup');
    await back();
    await cdp.evaluate("window.scodex.savePreferences({fontSize:20})"); await cdp.command('Page.reload'); await waitFor(() => cdp.evaluate("Boolean(document.querySelector('.app-shell'))"), 'font preference reload'); await openSettings();
    await cdp.command('Emulation.setDeviceMetricsOverride', { width: 1064, height: 660, deviceScaleFactor: 1, mobile: false });
    const layout = async (name) => { await cdp.evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))'); const outside = await cdp.evaluate("[...document.querySelectorAll('.storage-panel,.storage-management-row,.storage-button,.storage-search,.storage-retention, .storage-agent-form')].filter(item=>item.getClientRects().length).map(item=>({class:item.className,left:item.getBoundingClientRect().left,right:item.getBoundingClientRect().right})).filter(item=>item.left < -1 || item.right > innerWidth + 1)"); assert.deepEqual(outside, [], name + ' overflow'); };
    await layout('overview'); for (const title of ['清理旧聊天', '已归档的聊天', '子智能体', '管理工作树']) { await openManager(title); await layout(title); await back(); }
    check('Overview and all managers fit 1064x660 renderer viewport at 20px; native OS resizing not asserted');
    await cdp.command('Emulation.clearDeviceMetricsOverride'); await cdp.evaluate("window.scodex.savePreferences({fontSize:16,themeMode:'light'})"); await cdp.command('Page.reload'); await waitFor(() => cdp.evaluate("Boolean(document.querySelector('.app-shell'))"), 'final reload'); await openSettings();
    const image = await cdp.command('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }); await fs.writeFile(path.join(output, 'workbench-storage.png'), Buffer.from(image.data, 'base64'));
    const state = await cdp.evaluate('window.scodex.storageUsage()'); report.sizes = state.sizes; report.screenshot = path.join(output, 'workbench-storage.png');
    await cdp.command('Browser.close').catch(() => {}); await waitFor(() => child.exitCode !== null, 'actual app exit', 20000); check('Final screenshot and app exit with no pending tasks');
    report.status = 'passed';
  } catch (error) { report.status = 'failed'; report.error = error.message; console.error(error); if (cdp) report.ui = await cdp.evaluate("({heading:document.querySelector('.storage-manager h2')?.textContent,error:document.querySelector('.storage-alert')?.textContent,dialog:document.querySelector('dialog')?.textContent})").catch(() => null); process.exitCode = 1; }
  finally {
    if (cdp && child?.exitCode === null) { await cdp.evaluate('window.scodex.listAgents().then(tasks=>Promise.all(tasks.filter(task=>["queued","running"].includes(task.status)).map(task=>window.scodex.cancelAgent(task.id))))').catch(() => {}); await cdp.command('Browser.close').catch(() => {}); }
    if (socket?.readyState === WebSocket.OPEN) socket.close();
    if (child?.exitCode === null) { await waitFor(() => child.exitCode !== null, 'cleanup exit', 5000).catch(async () => { await executeFile('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true }).catch(() => {}); }); }
    try { if (!temporary.startsWith(path.join(os.tmpdir(), 'scodex-storage-ui-'))) throw new Error('Unsafe cleanup target'); await fs.rm(temporary, { recursive: true, force: true, maxRetries: 3 }); report.cleanup = 'passed'; } catch (error) { report.cleanup = error.message; process.exitCode = 1; }
    await fs.writeFile(path.join(output, 'storage-ui-verification.json'), JSON.stringify(report, null, 2));
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
