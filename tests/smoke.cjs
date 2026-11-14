const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const zlib = require('node:zlib');
const ExcelJS = require('exceljs');

const projectRoot = path.resolve(__dirname, '..');
const scodexRoot = path.resolve(projectRoot, '..');
const releaseRoot = path.join(projectRoot, 'release');
const smokeId = `scodex-smoke-${crypto.randomUUID()}`;
const workspaceRoot = path.join(projectRoot, 'workspace');
const fixtureRoot = path.join(workspaceRoot, smokeId);
const tempRoot = path.join(os.tmpdir(), smokeId);
const smokeScope = process.env.SCODEX_SMOKE_SCOPE || 'full';
const skipNativeClose = smokeScope === 'composer' && process.env.SCODEX_SMOKE_SKIP_NATIVE_CLOSE === '1';

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data = Buffer.alloc(0)) {
  const name = Buffer.from(type, 'ascii');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([length, name, data, checksum]);
}

function createPng(width, height) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  const rows = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y += 1) {
    const row = y * (1 + width * 4);
    rows[row] = 0;
    for (let x = 0; x < width; x += 1) {
      const pixel = row + 1 + x * 4;
      rows[pixel] = x ? 46 : 36;
      rows[pixel + 1] = y ? 150 : 115;
      rows[pixel + 2] = x ? 207 : 87;
      rows[pixel + 3] = 255;
    }
  }
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', header),
    pngChunk('IDAT', zlib.deflateSync(rows)),
    pngChunk('IEND'),
  ]);
}

async function reservePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => server.once('error', reject).listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

async function waitFor(predicate, description, timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const value = await predicate();
      if (value) return value;
    } catch (error) { lastError = error; }
    await new Promise((resolve) => setTimeout(resolve, 180));
  }
  throw new Error(`Timed out waiting for ${description}${lastError ? `: ${lastError.message}` : ''}`);
}

function createCdp(socket) {
  let nextId = 0;
  const pending = new Map();
  socket.addEventListener('message', (event) => {
    let message;
    try { message = JSON.parse(event.data); } catch { return; }
    if (!message.id || !pending.has(message.id)) return;
    const { resolve, reject, timer } = pending.get(message.id);
    clearTimeout(timer);
    pending.delete(message.id);
    if (message.error) reject(new Error(message.error.message));
    else resolve(message.result);
  });
  socket.addEventListener('close', () => {
    for (const { reject, timer } of pending.values()) {
      clearTimeout(timer);
      reject(new Error('CDP connection closed before a response was received.'));
    }
    pending.clear();
  });
  return {
    command(method, params = {}) {
      const id = ++nextId;
      return new Promise((resolve, reject) => {
        if (socket.readyState !== WebSocket.OPEN) { reject(new Error('CDP connection is not open.')); return; }
        const timer = setTimeout(() => {
          if (!pending.has(id)) return;
          pending.delete(id);
          reject(new Error(`CDP command timed out: ${method}`));
        }, 10_000);
        pending.set(id, { resolve, reject, timer });
        socket.send(JSON.stringify({ id, method, params }));
      });
    },
    async evaluate(expression) {
      const response = await this.command('Runtime.evaluate', {
        expression,
        awaitPromise: true,
        returnByValue: true,
        userGesture: true,
      });
      if (response.exceptionDetails) throw new Error(response.exceptionDetails.exception?.description || response.exceptionDetails.text || 'Renderer evaluation failed');
      return response.result?.value;
    },
  };
}

async function clickByText(cdp, selector, label) {
  const encodedLabel = JSON.stringify(label);
  await waitFor(() => cdp.evaluate(`(() => { const button = [...document.querySelectorAll(${JSON.stringify(selector)})].find((item) => item.textContent.includes(${encodedLabel})); if (!button || button.disabled) return false; button.click(); return true; })()`), `enabled ${label} control`);
}

async function replaceFocusedText(cdp, selector, value) {
  const focused = await cdp.evaluate(`(() => { const element = document.querySelector(${JSON.stringify(selector)}); if (!element) return false; element.focus(); if (typeof element.select === 'function') { element.select(); return 'native'; } return 'editable'; })()`);
  assert.ok(focused, `Expected editable control ${selector}`);
  if (focused === 'editable') {
    await cdp.command('Input.dispatchKeyEvent', { type: 'keyDown', key: 'a', code: 'KeyA', modifiers: 2, commands: ['selectAll'] });
    await cdp.command('Input.dispatchKeyEvent', { type: 'keyUp', key: 'a', code: 'KeyA', modifiers: 2 });
  }
  await cdp.command('Input.insertText', { text: value });
  await waitFor(() => cdp.evaluate(`(() => { const element = document.querySelector(${JSON.stringify(selector)}); return (element?.value ?? element?.textContent) === ${JSON.stringify(value)}; })()`), `exact field value in ${selector}`);
}

function isAlive(pid) {
  try { process.kill(pid, 0); return true; } catch { return false; }
}

async function stopProcessTree(pids) {
  for (const pid of [...new Set(pids)].filter(Boolean)) {
    if (!isAlive(pid)) continue;
    if (process.platform === 'win32') {
      await new Promise((resolve, reject) => {
        const killer = spawn('taskkill.exe', ['/PID', String(pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
        killer.once('close', (code) => code === 0 || !isAlive(pid) ? resolve() : reject(new Error(`Could not stop test process ${pid}`)));
        killer.once('error', reject);
      });
    } else process.kill(pid, 'SIGTERM');
    await waitFor(() => !isAlive(pid), `test process ${pid} exit`, 8000);
  }
}

async function prepareNativeCloser() {
  const child = spawn('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command',
    "$ErrorActionPreference = 'Stop'; [Console]::Out.WriteLine('READY'); $testPid = [Console]::ReadLine(); $testProcess = [Diagnostics.Process]::GetProcessById([int]$testPid); if (-not $testProcess.CloseMainWindow()) { throw 'Native window close was not delivered' }"], {
    windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'],
  });
  let output = '';
  let errorText = '';
  child.stdout.on('data', (chunk) => { output += chunk; });
  child.stderr.on('data', (chunk) => { errorText += chunk; });
  const completion = new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('close', (code) => code === 0 ? resolve() : reject(new Error(errorText || `Native close failed: ${code}`)));
  });
  completion.catch(() => {});
  try { await waitFor(() => output.includes('READY'), 'prepared native-close helper', 8000); }
  catch (error) { child.kill(); throw error; }
  return { child, close(pid) { child.stdin.end(`${pid}\n`); return completion; } };
}

async function main() {
  const expectedVersion = JSON.parse(await fs.readFile(path.join(projectRoot, 'package.json'), 'utf8')).version;
  const executable = process.env.SCODEX_SMOKE_EXE
    ? path.resolve(process.env.SCODEX_SMOKE_EXE)
    : path.join(releaseRoot, 'Scodex-Workbench-' + expectedVersion + '-x64.exe');
  const executableRoot = path.dirname(executable);
  await fs.access(executable);
  const codeFile = path.join(fixtureRoot, 'editor-check.txt');
  const csvFile = path.join(fixtureRoot, 'table-check.csv');
  const xlsxFile = path.join(fixtureRoot, 'table-check.xlsx');
  const imageFile = path.join(fixtureRoot, 'image-check.png');
  const originalCode = `smoke source ${smokeId}`;
  const updatedCode = `saved from editor ${smokeId}`;
  const updatedCell = `csv saved ${smokeId}`;
  let child;
  let socket;
  let cdp;
  let browserSocket;
  let browserCdp;
  let applicationPid;
  let primaryError;
  let nativeCloser;
  let port;
  let processOutput = '';
  const profileRoot = path.join(tempRoot, 'profile');
  const codexHomeRoot = path.join(tempRoot, 'codex-home');
  const smokeSkillName = '本地工作台验收技能';
  const smokeSkillId = 'skills/workbench-smoke/SKILL.md';
  const smokeProjectName = '工作台验收项目';
  const smokeProjectPath = path.join(fixtureRoot, 'second-project');
  const launchEnvironment = { ...process.env };
  delete launchEnvironment.SCODEX_HOME;
  if (smokeScope === 'workbench-changes') launchEnvironment.SCODEX_HOME = codexHomeRoot;
  let screenshotPath = path.join(executableRoot, smokeScope === 'workbench-changes' ? 'workbench-home.png' : smokeScope.startsWith('composer') ? 'workbench-composer.png' : 'workbench-smoke.png');

  await fs.mkdir(fixtureRoot, { recursive: true });
  await fs.mkdir(tempRoot, { recursive: true });
  await fs.mkdir(profileRoot, { recursive: true });
  if (smokeScope === 'workbench-changes') {
    await fs.mkdir(path.join(codexHomeRoot, 'skills', 'workbench-smoke'), { recursive: true });
    await fs.writeFile(path.join(codexHomeRoot, 'skills', 'workbench-smoke', 'SKILL.md'), `---\nname: ${smokeSkillName}\ndescription: Isolated packaged-workbench verification\n---\n\nOnly used by the isolated Scodex Smoke test.\n`, 'utf8');
    await fs.mkdir(smokeProjectPath, { recursive: true });
  }
  await fs.writeFile(path.join(profileRoot, 'settings.json'), JSON.stringify({ workspaceRoot: fixtureRoot }));
  const legacyHistory = JSON.stringify([{ role: 'user', content: '旧版中文对话' }, { role: 'assistant', content: '历史回答已保留。' }]);
  await fs.writeFile(path.join(profileRoot, 'conversation.json'), legacyHistory);
  await fs.writeFile(codeFile, originalCode, 'utf8');
  await fs.writeFile(csvFile, 'name,value\r\nalpha,1\r\n', 'utf8');
  await fs.writeFile(imageFile, createPng(2, 1));
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Smoke');
  sheet.addRow(['name', 'value']);
  sheet.addRow(['alpha', 1]);
  await workbook.xlsx.writeFile(xlsxFile);

  try {
    const launchApplication = async () => {
      port = await reservePort();
      processOutput = '';
      child = spawn(executable, [`--remote-debugging-port=${port}`, `--user-data-dir=${profileRoot}`, '--disable-gpu'], {
        cwd: releaseRoot,
        env: launchEnvironment,
        windowsHide: false,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      child.stdout.on('data', (chunk) => { processOutput = `${processOutput}${chunk}`.slice(-4000); });
      child.stderr.on('data', (chunk) => { processOutput = `${processOutput}${chunk}`.slice(-4000); });

      const page = await waitFor(async () => {
        if (child.exitCode !== null) throw new Error(`App exited (${child.exitCode}): ${processOutput}`);
        const response = await fetch(`http://127.0.0.1:${port}/json/list`);
        if (!response.ok) return null;
        const targets = await response.json();
        return targets.find((target) => target.type === 'page' && target.webSocketDebuggerUrl);
      }, 'Electron remote debugging target');
      const browserTarget = await fetch(`http://127.0.0.1:${port}/json/version`).then((response) => response.json());
      browserSocket = new WebSocket(browserTarget.webSocketDebuggerUrl);
      await new Promise((resolve, reject) => {
        browserSocket.addEventListener('open', resolve, { once: true });
        browserSocket.addEventListener('error', reject, { once: true });
      });
      browserCdp = createCdp(browserSocket);
      const processes = await browserCdp.command('SystemInfo.getProcessInfo');
      applicationPid = processes.processInfo.find((item) => item.type === 'browser')?.id;
      assert.ok(applicationPid, 'Expected the real portable app process PID for cleanup.');
      socket = new WebSocket(page.webSocketDebuggerUrl);
      await new Promise((resolve, reject) => {
        socket.addEventListener('open', resolve, { once: true });
        socket.addEventListener('error', reject, { once: true });
      });
      cdp = createCdp(socket);
      await cdp.command('Runtime.enable');
      await cdp.command('Page.enable');
      await waitFor(() => cdp.evaluate("Boolean(document.querySelector('.app-shell .rail'))"), 'workbench UI render');
    };
    const restartApplication = async () => {
      if (browserSocket?.readyState === WebSocket.OPEN) await browserCdp.command('Browser.close').catch(() => {});
      if (socket?.readyState === WebSocket.OPEN) socket.close();
      if (browserSocket?.readyState === WebSocket.OPEN) browserSocket.close();
      await stopProcessTree([applicationPid, child?.pid]);
      socket = null;
      cdp = null;
      browserSocket = null;
      browserCdp = null;
      child = null;
      applicationPid = null;
      await launchApplication();
    };
    await launchApplication();
    const state = await cdp.evaluate('window.scodex.getAppState()');
    assert.equal(state.version, expectedVersion, 'Test must run the new package version');
    const expectedRenderer = (await fs.readFile(path.join(projectRoot, 'dist', 'index.html'), 'utf8')).match(/assets\/index-[^"\s]+\.js/)?.[0];
    assert.ok(expectedRenderer, 'Expected an exact renderer build identity');
    assert.equal(await cdp.evaluate(`[...document.scripts].some(script=>script.src.endsWith(${JSON.stringify(expectedRenderer)}))`), true, 'The EXE must contain the final renderer, even when rebuilding the same version');
    console.log('Verified renderer:', expectedRenderer);
    if (['workbench-changes', 'composer'].includes(smokeScope)) {
      assert.equal(state.hasCredential, false, 'Workbench acceptance must use a clean profile without real model credentials.');
    } else {
      assert.equal(state.model, 'grok-4.7');
      assert.equal(state.hasCredential, true, 'Expected the module-2 DPAPI credential to be discoverable.');
    }
    const skillCount = await cdp.evaluate('window.scodex.listSkills().then((items) => items.length)');
    assert.ok(skillCount > 0, 'Expected installed SKILL.md instructions to be discoverable.');
    await waitFor(() => cdp.evaluate("document.querySelector('.message-list')?.textContent.includes('旧版中文对话')"), 'legacy conversation migration');
    if (smokeScope === 'workbench-changes') {
      const navigation = await cdp.evaluate("[...document.querySelectorAll('.nav-item')].map((item) => item.textContent.trim())");
      assert.ok(navigation.some((label) => label.includes('定时任务')), 'Scheduled tasks must replace the old navigation entry.');
      assert.ok(!navigation.some((label) => label.includes('对话记录')), 'Conversation history must not remain as a navigation item.');
      await clickByText(cdp, '.new-task-button', '新建对话');

      const checkWelcomeLayout = async (width, height) => {
        await cdp.command('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
        await waitFor(() => cdp.evaluate(`innerWidth === ${width} && innerHeight === ${height}`), `${width} x ${height} renderer viewport`);
        await cdp.evaluate('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
        const layout = await cdp.evaluate("(() => { const title = document.querySelector('.workspace-home-content h1'); const subtitle = document.querySelector('.workspace-home-content p'); const composer = document.querySelector('.composer-box'); const items = [title, subtitle, document.querySelector('.workspace-home-content'), composer].filter(Boolean).map((element) => ({ text: element.textContent.trim().slice(0, 32), left: element.getBoundingClientRect().left, right: element.getBoundingClientRect().right, top: element.getBoundingClientRect().top, bottom: element.getBoundingClientRect().bottom })); return { title: title?.textContent.trim(), subtitle: subtitle?.textContent.trim(), documentWidth: document.documentElement.scrollWidth, items }; })()");
        assert.match(layout.title || '', /GDP/);
        assert.equal(layout.subtitle, '你的本地 AI 工作空间');
        assert.ok(layout.documentWidth <= width + 1, `Welcome screen has horizontal overflow at ${width} x ${height}.`);
        for (const item of layout.items) assert.ok(item.left >= -1 && item.right <= width + 1 && item.top >= -1 && item.bottom <= height + 1, `${item.text} is outside the ${width} x ${height} viewport.`);
        return layout;
      };

      await cdp.evaluate("document.querySelector('button[aria-label=\"工作台首页\"]').click()");
      await waitFor(() => cdp.evaluate("Boolean(document.querySelector('.workspace-home-content h1'))"), 'screenshot-inspired assistant start screen');
      await checkWelcomeLayout(1440, 900);
      await checkWelcomeLayout(1064, 660);

      await cdp.evaluate("document.querySelector('button[aria-label=\"定时任务\"]').click()");
      await waitFor(() => cdp.evaluate("Boolean(document.querySelector('.scheduled-view'))"), 'scheduled task workspace');
      await clickByText(cdp, '.scheduled-new-button', '新建任务');
      await replaceFocusedText(cdp, '.task-editor textarea', '隔离验收任务：验证失败记录与重启持久化');
      await replaceFocusedText(cdp, '.task-editor input', '隔离验收任务');
      await clickByText(cdp, '.task-editor-actions .primary-button', '创建任务');
      const taskFile = path.join(profileRoot, 'scheduled-tasks.json');
      await waitFor(async () => JSON.parse(await fs.readFile(taskFile, 'utf8')).tasks.some((task) => task.name === '隔离验收任务' && task.enabled), 'task creation persisted');
      await waitFor(() => cdp.evaluate("document.querySelector('.scheduled-detail-heading h2')?.textContent === '隔离验收任务'"), 'created task selected');
      await clickByText(cdp, '.scheduled-detail-actions button', '暂停');
      await waitFor(async () => JSON.parse(await fs.readFile(taskFile, 'utf8')).tasks.some((task) => task.name === '隔离验收任务' && !task.enabled && !task.nextRunAt), 'task pause persisted');
      await clickByText(cdp, '.scheduled-detail-actions button', '立即运行');
      await waitFor(async () => JSON.parse(await fs.readFile(taskFile, 'utf8')).runs.some((run) => run.taskName === '隔离验收任务' && run.status === 'failed' && run.output), 'controlled missing-credential failure persisted');
      const failedRun = JSON.parse(await fs.readFile(taskFile, 'utf8')).runs.find((run) => run.taskName === '隔离验收任务');
      assert.ok(failedRun.completedAt, 'Failed task run must have a completion time.');
      assert.match(await cdp.evaluate("document.querySelector('.task-run-status.failed')?.nextElementSibling?.textContent || ''"), /执行失败/);

      await cdp.evaluate("document.querySelector('.activity-more > button').click()");
      await clickByText(cdp, '.activity-menu button', '插件');
      await waitFor(() => cdp.evaluate("document.querySelector('.extension-center h1')?.textContent === '插件'"), 'plugin center');
      await waitFor(() => cdp.evaluate("document.querySelector('.extension-empty strong')?.textContent === '当前没有已发现的插件包'"), 'honest local plugin inventory');
      await clickByText(cdp, '.extension-segment button', '公开目录');
      await waitFor(() => cdp.evaluate("document.querySelector('.extension-public-empty strong')?.textContent === '公开插件目录尚未配置'"), 'unconfigured marketplace state');
      await clickByText(cdp, '.extension-sidebar > button', '技能');
      await waitFor(() => cdp.evaluate("document.querySelector('.extension-center h1')?.textContent === '技能'"), 'Skills center');
      const smokeSkill = (await cdp.evaluate('window.scodex.listSkills()')).find((skill) => skill.id === smokeSkillId);
      assert.ok(smokeSkill, 'The isolated local SKILL.md must appear in the Skills center.');
      await cdp.evaluate(`([...document.querySelectorAll('.skill-enable-toggle')].find((button) => button.getAttribute('aria-label') === ${JSON.stringify(`停用技能 ${smokeSkillName}`)})?.click())`);
      await waitFor(async () => (JSON.parse(await fs.readFile(path.join(profileRoot, 'settings.json'), 'utf8')).preferences?.disabledSkillIds || []).includes(smokeSkillId), 'skill disable state persisted');
      await cdp.evaluate(`([...document.querySelectorAll('.skill-enable-toggle')].find((button) => button.getAttribute('aria-label') === ${JSON.stringify(`启用技能 ${smokeSkillName}`)})?.click())`);
      await waitFor(async () => !(JSON.parse(await fs.readFile(path.join(profileRoot, 'settings.json'), 'utf8')).preferences?.disabledSkillIds || []).includes(smokeSkillId), 'skill enable state persisted');

      await cdp.evaluate("document.querySelector('.workspace-switch').click()");
      await waitFor(() => cdp.evaluate("Boolean(document.querySelector('.project-menu'))"), 'project switcher');
      await clickByText(cdp, '.project-menu button', '创建项目');
      await replaceFocusedText(cdp, 'input[aria-label="项目名称"]', smokeProjectName);
      await replaceFocusedText(cdp, 'input[aria-label="项目文件夹"]', smokeProjectPath);
      await clickByText(cdp, '.project-editor-actions .primary-button', '创建项目');
      await waitFor(() => cdp.evaluate(`window.scodex.getAppState().then((appState) => appState.workspaceRoot === ${JSON.stringify(smokeProjectPath)})`), 'new project selected');
      await waitFor(() => cdp.evaluate("!document.querySelector('.project-editor') && !document.querySelector('.project-menu')"), 'project creation dialog and menu close before switching folders');
      await cdp.evaluate("document.querySelector('.workspace-switch').click()");
      await waitFor(() => cdp.evaluate("Boolean(document.querySelector('.project-menu'))"), 'project switch back to original folder');
      await waitFor(() => cdp.evaluate(`[...document.querySelectorAll('.project-menu [role="menuitem"]')].some((button) => button.title === ${JSON.stringify(fixtureRoot)})`), 'original project menu entry');
      assert.equal(await cdp.evaluate(`(() => { const button = [...document.querySelectorAll('.project-menu [role="menuitem"]')].find((item) => item.title === ${JSON.stringify(fixtureRoot)}); if (!button) return false; button.click(); return true; })()`), true, 'Original project menu entry must be clickable.');
      await waitFor(() => cdp.evaluate("!document.querySelector('.project-menu')"), 'project menu closes after switching back');
      await waitFor(() => cdp.evaluate(`window.scodex.getAppState().then((appState) => appState.workspaceRoot === ${JSON.stringify(fixtureRoot)})`), 'original project reselected');
      await cdp.evaluate("document.querySelector('.workspace-switch').click()");
      await waitFor(() => cdp.evaluate("Boolean(document.querySelector('.project-menu'))"), 'project switch to new folder');
      await waitFor(() => cdp.evaluate(`[...document.querySelectorAll('.project-menu [role="menuitem"]')].some((button) => button.title === ${JSON.stringify(smokeProjectPath)})`), 'new project menu entry');
      await waitFor(() => cdp.evaluate(`[...document.querySelectorAll('.project-menu [role="menuitem"]')].some((button) => button.title === ${JSON.stringify(fixtureRoot)} && button.classList.contains('selected'))`), 'original project selected marker');
      assert.equal(await cdp.evaluate(`(() => { const button = [...document.querySelectorAll('.project-menu [role="menuitem"]')].find((item) => item.title === ${JSON.stringify(smokeProjectPath)}); if (!button) return false; button.click(); return true; })()`), true, 'New project menu entry must be clickable.');
      await waitFor(() => cdp.evaluate("!document.querySelector('.project-menu')"), 'project menu closes after selecting new project');
      await waitFor(() => cdp.evaluate(`window.scodex.getAppState().then((appState) => appState.workspaceRoot === ${JSON.stringify(smokeProjectPath)})`), 'new project reselected');
      await cdp.evaluate("document.querySelector('.workspace-switch').click()");
      await waitFor(() => cdp.evaluate("Boolean(document.querySelector('.project-menu'))"), 'new project selection confirmation');
      await waitFor(() => cdp.evaluate(`[...document.querySelectorAll('.project-menu [role="menuitem"]')].some((button) => button.title === ${JSON.stringify(smokeProjectPath)} && button.classList.contains('selected'))`), 'new project selected marker');
      await cdp.evaluate("document.querySelector('.workspace-switch').click()");
      const savedSettings = JSON.parse(await fs.readFile(path.join(profileRoot, 'settings.json'), 'utf8'));
      assert.ok(savedSettings.projects.some((project) => project.path === smokeProjectPath), 'Project registry must be written to settings.');
      assert.equal(savedSettings.workspaceRoot, smokeProjectPath);

      await restartApplication();
      const restartedState = await cdp.evaluate('window.scodex.getAppState()');
      assert.equal(restartedState.hasCredential, false, 'The restarted acceptance profile must remain credential-free.');
      assert.equal(restartedState.workspaceRoot, smokeProjectPath, 'The selected project must survive a full app restart.');
      assert.ok(restartedState.scheduledTasks.tasks.some((task) => task.name === '隔离验收任务' && !task.enabled), 'Paused task must survive a full app restart.');
      assert.ok(restartedState.scheduledTasks.runs.some((run) => run.taskName === '隔离验收任务' && run.status === 'failed'), 'Failed run history must survive a full app restart.');
      assert.equal(await fs.readFile(path.join(profileRoot, 'conversation.json'), 'utf8'), legacyHistory, 'Conversation history source must remain intact.');
      await cdp.evaluate("document.querySelector('button[aria-label=\"定时任务\"]').click()");
      await waitFor(() => cdp.evaluate("document.querySelector('.scheduled-detail-heading h2')?.textContent === '隔离验收任务' && Boolean(document.querySelector('.task-run-status.failed'))"), 'task and failure visible after restart');
      await cdp.evaluate("document.querySelector('.activity-more > button').click()");
      await clickByText(cdp, '.activity-menu button', '技能');
      await waitFor(() => cdp.evaluate(`[...document.querySelectorAll('.skill-enable-toggle')].some((button) => button.getAttribute('aria-label') === ${JSON.stringify(`停用技能 ${smokeSkillName}`)} && button.getAttribute('aria-checked') === 'true')`), 'enabled local skill visible after restart');
      await cdp.evaluate("document.querySelector('button[aria-label=\"工作台首页\"]').click()");
      await waitFor(() => cdp.evaluate("Boolean(document.querySelector('.workspace-home-content h1'))"), 'assistant start screen after restart');
      await checkWelcomeLayout(1440, 900);
      await cdp.command('Emulation.clearDeviceMetricsOverride');
      console.log('Workbench-change scope passed: scheduled task create/pause/failure history, plugin/Skills status and toggle, project creation/switch/restart, preserved conversation data, and welcome layout at 1440 x 900 and 1064 x 660.');
    }
    if (['full', 'conversations'].includes(smokeScope)) {
    await clickByText(cdp, '.new-task-button', '新建对话');
    await waitFor(() => cdp.evaluate("document.querySelectorAll('.mode-card').length === 4"), 'four dashboard work modes');
    for (const label of ['问答', '规划', '编程', '办公']) {
      await clickByText(cdp, '.mode-card', label);
      await waitFor(() => cdp.evaluate(`document.querySelector('.mode-switch .selected')?.textContent === ${JSON.stringify(label)}`), `${label} mode selection`);
    }
    await clickByText(cdp, '.mode-switch button', '规划');
    await replaceFocusedText(cdp, 'textarea[aria-label="输入工作内容"]', '规划草稿：中文与 emoji 🚀');
    await clickByText(cdp, '.nav-item', '对话记录');
    await waitFor(() => cdp.evaluate("document.querySelectorAll('.history-card').length === 2"), 'conversation list');
    await cdp.evaluate("document.querySelector('.history-card.selected button[title=\"重命名\"]').click()");
    await replaceFocusedText(cdp, 'input[aria-label="对话标题"]', '测试规划记录');
    await cdp.evaluate("document.querySelector('button[aria-label=\"保存标题\"]').click()");
    await waitFor(() => cdp.evaluate("document.querySelector('.history-card.selected .history-open strong')?.textContent.includes('测试规划记录')"), 'conversation rename');
    await cdp.evaluate("document.querySelector('.history-card.selected button[aria-label=\"置顶对话\"]').click()");
    await waitFor(() => cdp.evaluate("Boolean(document.querySelector('.history-card.selected .is-pinned'))"), 'conversation pin');
    await replaceFocusedText(cdp, 'input[aria-label="搜索对话"]', '不存在的关键词');
    await waitFor(() => cdp.evaluate("document.querySelectorAll('.history-card').length === 0 && Boolean(document.querySelector('.history-empty'))"), 'empty conversation search');
    await replaceFocusedText(cdp, 'input[aria-label="搜索对话"]', '测试规划');
    await waitFor(() => cdp.evaluate("document.querySelectorAll('.history-card').length === 1 && document.querySelector('.history-open')?.textContent.includes('测试规划记录')"), 'filtered conversation search result');
    await clickByText(cdp, '.history-open', '测试规划记录');
    await waitFor(() => cdp.evaluate("document.querySelector('textarea')?.value === '规划草稿：中文与 emoji 🚀'"), 'draft restoration');
    await clickByText(cdp, '.new-task-button', '新建对话');
    await clickByText(cdp, '.nav-item', '对话记录');
    await waitFor(() => cdp.evaluate("document.querySelectorAll('.history-card').length === 3"), 'new conversation');
    await cdp.evaluate("document.querySelector('.history-card.selected button[title=\"删除\"]').click()");
    await clickByText(cdp, '.history-actions .danger-button', '确认删除');
    await waitFor(() => cdp.evaluate("document.querySelectorAll('.history-card').length === 2"), 'conversation delete');
    await cdp.evaluate("document.querySelector('button[aria-label=\"工作台设置\"]').click()");
    await waitFor(() => cdp.evaluate("Boolean(document.querySelector('.settings-detail'))"), 'settings panel');
    await cdp.evaluate("const select = document.querySelector('select[aria-label=\"新对话默认模式\"]'); select.value = 'office'; select.dispatchEvent(new Event('change', { bubbles: true }));");
    await waitFor(async () => JSON.parse(await fs.readFile(path.join(profileRoot, 'settings.json'), 'utf8')).preferences?.defaultMode === 'office', 'saved mode preference');
    await clickByText(cdp, '.settings-category', '工作台与标签');
    await cdp.evaluate("document.querySelector('button[aria-label=\"收起左侧导航\"]').click()");
    await waitFor(() => cdp.evaluate("Boolean(document.querySelector('.app-shell.rail-collapsed'))"), 'collapsed navigation');
    await cdp.evaluate("document.querySelector('button[aria-label=\"收起左侧导航\"]').click()");
    await waitFor(() => cdp.evaluate("!document.querySelector('.app-shell.rail-collapsed')"), 'expanded navigation');
    await cdp.evaluate("document.querySelector('button[aria-label=\"工作台首页\"]').click()");
    await clickByText(cdp, '.new-task-button', '新建对话');
    await waitFor(() => cdp.evaluate("document.querySelector('.mode-switch .selected')?.textContent === '办公'"), 'default mode in new conversation');
    await waitFor(async () => {
      const saved = JSON.parse(await fs.readFile(path.join(profileRoot, 'conversations.json'), 'utf8'));
      const renamed = saved.conversations.find((chat) => chat.title === '测试规划记录');
      return saved.conversations.length === 3 && renamed?.pinned && renamed.draft.includes('🚀') && renamed.mode === 'plan';
    }, 'persisted conversations, pin and Unicode draft');
    assert.equal(await fs.readFile(path.join(profileRoot, 'conversation.json'), 'utf8'), legacyHistory, 'Legacy source must remain intact.');
    await cdp.command('Page.reload');
    await waitFor(() => cdp.evaluate("document.querySelector('.mode-switch .selected')?.textContent === '办公' && document.querySelectorAll('.recent-item').length === 3"), 'conversation and preference persistence after reload');

    if (smokeScope === 'full') {
    await clickByText(cdp, '.nav-item', '文件与代码');
    await waitFor(() => cdp.evaluate("document.querySelector('.file-workspace')?.textContent.includes('文件')"), 'file workspace');

    await clickByText(cdp, '.file-tree-item', 'editor-check.txt');
    await waitFor(() => cdp.evaluate(`document.querySelector('.cm-content')?.textContent.includes(${JSON.stringify(originalCode)})`), 'code editor content');
    await replaceFocusedText(cdp, '.cm-content', updatedCode);
    await clickByText(cdp, '.file-view .save-button', '保存');
    await waitFor(async () => (await fs.readFile(codeFile, 'utf8')) === updatedCode, 'saved editor file');

    await clickByText(cdp, '.file-tree-item', 'table-check.csv');
    await waitFor(() => cdp.evaluate("Boolean(document.querySelector('.spreadsheet input[aria-label=\"B2\"]'))"), 'CSV table grid');
    await replaceFocusedText(cdp, '.spreadsheet input[aria-label="B2"]', updatedCell);
    await clickByText(cdp, '.table-view .tool-heading .primary-button', '保存');
    await waitFor(() => cdp.evaluate("document.querySelector('.toast')?.textContent.includes('表格已保存') && !document.querySelector('.table-dimensions .dirty-dot')"), 'CSV save completion in UI');
    await waitFor(async () => (await fs.readFile(csvFile, 'utf8')).includes(updatedCell), 'saved CSV cell');
    await clickByText(cdp, '.attach-table', '附加到对话');
    await waitFor(() => cdp.evaluate("Boolean(document.querySelector('.file-chip')) && document.querySelector('.mode-switch .selected')?.textContent === '办公'"), 'table context attachment');
    await cdp.evaluate("document.querySelector('.file-chip').click()");

    await clickByText(cdp, '.nav-item', '文件与代码');
    await clickByText(cdp, '.file-tree-item', 'table-check.xlsx');
    await waitFor(() => cdp.evaluate("Boolean(document.querySelector('.spreadsheet input[aria-label=\"B2\"]'))"), 'XLSX table grid');
    await replaceFocusedText(cdp, '.spreadsheet input[aria-label="B2"]', '42');
    await clickByText(cdp, '.table-view .tool-heading .primary-button', '保存');
    await waitFor(async () => {
      const savedWorkbook = new ExcelJS.Workbook();
      await savedWorkbook.xlsx.readFile(xlsxFile);
      return savedWorkbook.getWorksheet('Smoke').getCell('B2').value === 42;
    }, 'saved XLSX cell');

    await clickByText(cdp, '.nav-item', '文件与代码');
    await clickByText(cdp, '.file-tree-item', 'image-check.png');
    await waitFor(() => cdp.evaluate("Boolean(document.querySelector('.image-canvas')?.width === 2 && document.querySelector('.image-canvas')?.height === 1)"), 'image canvas render');
    await clickByText(cdp, '.image-controls button', '右转');
    await waitFor(() => cdp.evaluate("Boolean(document.querySelector('.image-canvas')?.width === 1 && document.querySelector('.image-canvas')?.height === 2)"), 'image rotation');
    await clickByText(cdp, '.nav-item', '助手');
    await clickByText(cdp, '.nav-item', '图片');
    await waitFor(() => cdp.evaluate("document.querySelector('.image-canvas')?.width === 1 && document.querySelector('.image-canvas')?.height === 2"), 'image canvas restoration after navigation');
    const exportedImage = path.join(fixtureRoot, 'exported.png');
    await cdp.evaluate(`(async () => { const canvas = document.querySelector('.image-canvas'); const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png')); return window.scodex.saveBinaryFile(${JSON.stringify(exportedImage)}, new Uint8Array(await blob.arrayBuffer())); })()`);
    const imageBytes = await fs.readFile(exportedImage);
    assert.equal(imageBytes.readUInt32BE(16), 1);
    assert.equal(imageBytes.readUInt32BE(20), 2);

    await clickByText(cdp, '.nav-item', '技能');
    await waitFor(() => cdp.evaluate("document.querySelectorAll('.skill-row').length > 0"), 'skill library');
    await cdp.evaluate("document.querySelector('.skill-row').click()");
    await waitFor(() => cdp.evaluate("Boolean(document.querySelector('.skill-detail-head h2'))"), 'skill detail');
    await clickByText(cdp, '.skill-detail-actions .primary-button', '设为本轮技能');
    await clickByText(cdp, '.nav-item', '助手');
    await waitFor(() => cdp.evaluate("Boolean(document.querySelector('.context-chip.skill-chip'))"), 'active skill in assistant');
    await cdp.evaluate("document.querySelector('.context-chip.skill-chip').click()");
    }
    } else if (!['workbench-changes', 'shell', 'polish', 'composer', 'composer-finish'].includes(smokeScope)) {
      await clickByText(cdp, '.new-task-button', '新建对话');
      await waitFor(() => cdp.evaluate("document.querySelectorAll('.mode-card').length === 4"), 'dashboard after review fixes');
      await cdp.evaluate("document.querySelector('button[aria-label=\"工作台设置\"]').click()");
      await waitFor(() => cdp.evaluate("Boolean(document.querySelector('.settings-detail'))"), 'settings after review fixes');
    }

    if (!['layout', 'workbench-changes', 'shell', 'polish', 'composer', 'composer-finish'].includes(smokeScope)) {
    await cdp.evaluate("Promise.all([window.scodex.savePreferences({ defaultMode: 'code' }), window.scodex.savePreferences({ railCollapsed: true })])");
    const concurrentPreferences = JSON.parse(await fs.readFile(path.join(profileRoot, 'settings.json'), 'utf8')).preferences;
    assert.equal(concurrentPreferences.defaultMode, 'code');
    assert.equal(concurrentPreferences.railCollapsed, true);
    await cdp.evaluate("window.scodex.savePreferences({ defaultMode: 'answer', railCollapsed: false })");
    await waitFor(() => cdp.evaluate("document.querySelector('.history-save-state')?.textContent === '已保存到本机'"), 'new conversation saved before intentional renderer reload');
    await cdp.command('Page.reload');
    await waitFor(() => cdp.evaluate("document.querySelectorAll('.mode-card').length === 4 && !document.querySelector('.app-shell.rail-collapsed')"), 'review-fix preferences persisted and reloaded');
    await clickByText(cdp, '.mode-switch button', '问答');
    }

    if (smokeScope === 'layout') {
      await cdp.command('Emulation.setDeviceMetricsOverride', { width: 1064, height: 660, deviceScaleFactor: 1, mobile: false });
      await waitFor(() => cdp.evaluate('innerWidth === 1064 && innerHeight === 660'), 'minimum desktop renderer viewport');
      for (const label of ['助手', '文件与代码', '图片', '表格', '技能', '对话记录', '工作台设置']) {
        await clickByText(cdp, '.nav-item', label);
        await cdp.evaluate('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))');
        const overflow = await cdp.evaluate("[...document.querySelectorAll('.tool-heading button, .composer-box, .dashboard, .settings-detail, .history-search')].map(element => ({ label: element.textContent.slice(0, 24), right: element.getBoundingClientRect().right, left: element.getBoundingClientRect().left })).filter(item => item.right > innerWidth + 1 || item.left < -1)");
        assert.deepEqual(overflow, [], `Controls outside the minimum desktop viewport in ${label}`);
      }
      await cdp.command('Emulation.clearDeviceMetricsOverride');
      await clickByText(cdp, '.nav-item', '助手');
      console.log('Renderer viewport layout checks passed for all seven views at 1064 x 660 (native window resize was not available).');
    }

    if (['full', 'shell'].includes(smokeScope)) {
      await require('./shell-checks.cjs')({ cdp, createCdp, clickByText, replaceFocusedText, waitFor, profileRoot, releaseRoot, port, stopProcessTree, applicationPid });
    }

    if (smokeScope === 'polish') await require('./finish-checks.cjs')({ cdp, clickByText, replaceFocusedText, waitFor, profileRoot, stopProcessTree });
    if (smokeScope === 'composer') await require('./composer-checks.cjs')({ cdp, clickByText, replaceFocusedText, waitFor, profileRoot, fixtureRoot, codeFile, originalCode });
    if (smokeScope === 'composer-finish') {
      await clickByText(cdp, '.new-task-button', '新建对话');
      await clickByText(cdp, '.composer-tools button', '');
      await clickByText(cdp, '.composer-menu-item', '目标');
      await replaceFocusedText(cdp, '#composer-goal', '收尾验证：目标与中文草稿保存 🚀');
      await clickByText(cdp, '.composer-goal-form button', '保存目标');
      await waitFor(async () => JSON.parse(await fs.readFile(path.join(profileRoot, 'conversations.json'), 'utf8')).conversations.some(chat => chat.goal.includes('收尾验证')), 'goal persisted in final package');
      await cdp.evaluate("document.querySelector('button[aria-label=\"添加工具和上下文\"]').click()");
      await waitFor(() => cdp.evaluate("Boolean(document.querySelector('.composer-popover'))"), 'final package menu');
    }

    const boundaryError = await cdp.evaluate(`window.scodex.readTextFile(${JSON.stringify(path.join(projectRoot, 'package.json'))}).then(() => '', error => error.message)`);
    assert.match(boundaryError, /工作区/, 'Files outside the chosen workspace must be rejected.');
    await waitFor(() => cdp.evaluate("document.querySelector('.history-save-state')?.textContent === '已保存到本机'"), 'final history save');
    await cdp.evaluate("document.querySelector('button[aria-label=\"关闭提示\"]')?.click()");
    await cdp.evaluate("new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))");
    const screenshot = await cdp.command('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    await fs.writeFile(screenshotPath, Buffer.from(screenshot.data, 'base64'));

    if (skipNativeClose) {
      console.log('Native close and close-time draft flush skipped: the candidate has no native window handle; scoped cleanup will stop this test process.');
    } else {
      const closingDraft = '关闭前的草稿需要完整保存 🚀';
      const closeSignalFile = path.join(fixtureRoot, 'close-signal.json');
      await cdp.evaluate(`window.scodex.onPrepareClose(() => { window.scodex.saveTextFile(${JSON.stringify(closeSignalFile)}, JSON.stringify({ prepareClose: true, draft: document.querySelector('textarea')?.value, saveState: document.querySelector('.history-save-state')?.textContent })); })`);
      nativeCloser = await prepareNativeCloser();
      await replaceFocusedText(cdp, 'textarea[aria-label="输入工作内容"]', closingDraft);
      await nativeCloser.close(applicationPid);
      await waitFor(() => !isAlive(applicationPid), 'native app close after history flush', 10_000).catch(async (error) => {
        console.error('Native-close diagnostic signal:', await fs.readFile(closeSignalFile, 'utf8').catch(() => 'not recorded'));
        const diagnosticLibrary = JSON.parse(await fs.readFile(path.join(profileRoot, 'conversations.json'), 'utf8'));
        console.error('Native-close persisted draft:', JSON.stringify(diagnosticLibrary.conversations.find(chat => chat.id === diagnosticLibrary.activeId)?.draft));
        const { execFileSync } = require('node:child_process');
        console.error('Native-close windows:', execFileSync('powershell.exe', ['-NoLogo','-NoProfile','-NonInteractive','-Command', `$testProcess=Get-Process -Id ${applicationPid}; $testProcess | Select-Object Id,MainWindowTitle,MainWindowHandle,Responding | ConvertTo-Json -Compress`], {windowsHide:true,encoding:'utf8'}).trim());
        throw error;
      });
      console.log('Native-close signal:', await fs.readFile(closeSignalFile, 'utf8').catch(() => 'prepare-close signal not recorded'));
      const closedLibrary = JSON.parse(await fs.readFile(path.join(profileRoot, 'conversations.json'), 'utf8'));
      assert.equal(closedLibrary.conversations.find((chat) => chat.id === closedLibrary.activeId)?.draft, closingDraft);
    }

    console.log(smokeScope === 'workbench-changes'
      ? 'Workbench changes passed on the packaged 1.0.4 executable: scheduled task state and failed-run persistence, local plugin/Skills inventory and toggle, project switching after full restart, legacy conversation preservation, and assistant start-screen viewport checks.'
      : smokeScope === 'composer-finish'
      ? 'Composer finish passed: final 1.0.2 EXE, goal persistence, menu, workspace boundary, native close and Unicode draft readback. Full menu/permissions/search/font assertions remain valid from composer scope.'
      : smokeScope === 'composer'
      ? `Composer scope passed: actual portable EXE tools, files/folders/search, skills, plan/goal persistence, permission enforcement, keyboard/outside dismissal and viewport/font checks. ${skipNativeClose ? 'Native close/draft flush skipped; scoped cleanup follows.' : 'Native close/draft flush and cleanup complete.'}`
      : smokeScope === 'layout'
      ? 'Layout scope passed: seven renderer views at 1064 x 660, startup, workspace boundary and native close/draft flush. Preference and file/table/image/skill results are reused from their accepted scopes.'
      : smokeScope === 'polish'
      ? 'Final polish scope passed: real interactive terminal process and cleanup, actual Microsoft YaHei glyphs, 20px settings viewport, workspace boundary, native close/draft flush and final screenshot. Other accepted shell and local workflow results are reused.'
      : smokeScope === 'shell'
      ? 'Shell scope passed: activity rail, tab lifecycle and real isolated web content, categorized settings/search/preferences, single settings entry, Microsoft YaHei and desktop layout.'
      : smokeScope === 'full'
      ? 'Electron portable EXE checks passed: legacy migration, conversation CRUD/search/pin/drafts, four modes, settings/reload, code/CSV/XLSX save with readback, table context, image rotation/canvas export, skills, workspace boundary, concurrent preferences and native close/draft flush.'
      : `${smokeScope === 'conversations' ? 'Conversation regression and refinement' : 'Refinement'} checks passed: legacy load, dashboard/settings, concurrent preference merge/readback/reload, workspace boundary and native close/draft flush. Previous unchanged file/table/image/skill results remain valid.`);
    console.log('Native file-selection/save dialogs and real model generation are not automated in this run.');
    console.log(`Executable: ${executable}`);
    console.log(`Visual QA screenshot: ${screenshotPath}`);
  } catch (error) {
    primaryError = error;
    if (socket?.readyState === WebSocket.OPEN) {
      const diagnostic = await cdp.evaluate("({ activeView: document.querySelector('.breadcrumb')?.textContent, search: document.querySelector('input[aria-label=\"搜索对话\"]')?.value, titles: [...document.querySelectorAll('.history-open strong')].map(item => item.textContent), focus: document.activeElement?.outerHTML.slice(0, 500), buttons: [...document.querySelectorAll('.tool-heading button')].map(item => ({ label: item.textContent, disabled: item.disabled })), notice: document.querySelector('.toast')?.textContent })").catch(() => null);
      console.error('Failure UI state:', JSON.stringify(diagnostic));
    }
    throw error;
  } finally {
    const cleanupErrors = [];
    if (browserSocket?.readyState === WebSocket.OPEN) await browserCdp.command('Browser.close').catch(() => {});
    if (socket?.readyState === WebSocket.OPEN) socket.close();
    if (browserSocket?.readyState === WebSocket.OPEN) browserSocket.close();
    try { await stopProcessTree([applicationPid, child?.pid, nativeCloser?.child.pid]); } catch (error) { cleanupErrors.push(error); }
    for (const directory of [fixtureRoot, tempRoot]) {
      try { await fs.rm(directory, { recursive: true, force: true, maxRetries: 8, retryDelay: 250 }); }
      catch (error) { cleanupErrors.push(error); }
    }
    if (cleanupErrors.length) {
      const cleanupError = new AggregateError(cleanupErrors, 'Smoke-test cleanup failed.');
      if (primaryError) console.error(cleanupError);
      else throw cleanupError;
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
