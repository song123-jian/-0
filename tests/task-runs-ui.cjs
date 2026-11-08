const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const net = require('node:net');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const version = '1.3.16';
const output = path.resolve(process.env.SCODEX_TASK_RUNS_OUTPUT || path.join(root, 'release', 'task-scheduled-projects-attachments-20261030', 'evidence', 'candidate-ui'));
const executable = path.resolve(process.env.SCODEX_TASK_RUNS_EXE || path.join(root, 'release', 'task-scheduled-projects-attachments-20261030', 'candidate', `Scodex-Workbench-${version}-x64.exe`));
const fixture = path.resolve(process.env.SCODEX_TASK_RUNS_FIXTURE || path.join(os.tmpdir(), 'scodex-task-runs-' + crypto.randomUUID()));
const profile = path.join(fixture, 'profile');
const workspace = path.join(fixture, 'project');
const secondWorkspace = path.join(fixture, 'project-two');
const fakeHome = path.join(fixture, 'codex');
const report = { status: 'running', version, executable, fixtureDirectory: fixture, checks: [], requests: [], limitations: ['Actual packaged EXE and renderer; projects, scheduled task, and attachments use isolated fixture data. No model or public network requests. CDP drives the renderer, not native Windows mouse input or the native file picker.'] };
let child;
let socket;
let cdp;
const json = JSON.stringify;

const wait = async (fn, label, timeout = 30000) => {
  const end = Date.now() + timeout;
  let last;
  while (Date.now() < end) {
    try {
      const value = await fn();
      if (value) return value;
    } catch (error) { last = error; }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw Error(label + (last ? ': ' + last.message : ''));
};

function connect(ws) {
  let id = 0;
  const pending = new Map();
  ws.addEventListener('message', ({ data }) => {
    const message = JSON.parse(data);
    const entry = pending.get(message.id);
    if (!entry) return;
    pending.delete(message.id);
    clearTimeout(entry.timer);
    message.error ? entry.reject(Error(message.error.message)) : entry.resolve(message.result);
  });
  return {
    command(method, params = {}) {
      return new Promise((resolve, reject) => {
        const current = ++id;
        const timer = setTimeout(() => { pending.delete(current); reject(Error('CDP timeout ' + method)); }, 20000);
        pending.set(current, { resolve, reject, timer });
        ws.send(json({ id: current, method, params }));
      });
    },
    async evaluate(expression) {
      const result = await this.command('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, userGesture: true });
      if (result.exceptionDetails) throw Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
      return result.result?.value;
    },
  };
}

async function freePort() {
  const server = net.createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

async function start() {
  const port = await freePort();
  child = spawn(executable, ['--remote-debugging-port=' + port, '--user-data-dir=' + profile, '--disable-gpu'], {
    cwd: path.dirname(executable),
    windowsHide: true,
    stdio: ['ignore', 'ignore', 'pipe'],
    env: {
      ...process.env,
      SCODEX_HOME: fakeHome,
      SCODEX_REFERENCE_HOME: path.join(fixture, 'reference'),
      SCODEX_REFERENCE_AGENTS_HOME: path.join(fixture, 'agents'),
    },
  });
  let stderr = '';
  child.stderr.on('data', (chunk) => { stderr = (stderr + chunk.toString('utf8')).slice(-3000); });
  const target = await wait(async () => {
    if (child.exitCode !== null) throw Error('EXE exited: ' + stderr);
    const targets = await fetch(`http://127.0.0.1:${port}/json/list`).then((response) => response.json());
    return targets.find((item) => item.type === 'page' && item.url.startsWith('file:'));
  }, 'Application did not start', 60000);
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
  cdp = connect(socket);
  await wait(() => cdp.evaluate('Boolean(window.scodex && document.querySelector(".task-chat-view textarea"))'), 'Renderer did not become ready');
  await cdp.evaluate(`document.title=${json(`Scodex ${version} 定时任务记录验收`)}`);
  const state = await cdp.evaluate('window.scodex.getAppState()');
  report.runtime = {
    spawnedPid: child.pid,
    targetUrl: target.url,
    pageUrl: await cdp.evaluate('location.href'),
    loadedScripts: await cdp.evaluate('[...document.scripts].map((script) => script.src)'),
    appVersion: state.version,
    userDataPath: state.userDataPath,
    workspaceRoot: state.workspaceRoot,
  };
  return state;
}

async function check(name, fn) {
  const evidence = await fn();
  report.checks.push({ name, status: 'passed', evidence });
  console.log('PASS ' + name);
}

async function key(keyName, keyCode) {
  const event = { key: keyName, code: keyName, windowsVirtualKeyCode: keyCode, nativeVirtualKeyCode: keyCode };
  await cdp.command('Input.dispatchKeyEvent', { type: 'keyDown', ...event, text: keyName === 'Enter' ? '\r' : '' });
  await cdp.command('Input.dispatchKeyEvent', { type: 'keyUp', ...event, text: '' });
}

async function setupFixture() {
  await fs.mkdir(profile, { recursive: true });
  await fs.mkdir(workspace, { recursive: true });
  await fs.mkdir(secondWorkspace, { recursive: true });
  await fs.mkdir(fakeHome, { recursive: true });
  const attachmentPath = path.join(fixture, 'brief.txt');
  const attachmentData = Buffer.from('isolated attachment used by the scheduled task UI check');
  await fs.writeFile(attachmentPath, attachmentData);
  const attachment = {
    path: attachmentPath,
    name: 'brief.txt',
    mimeType: 'application/octet-stream',
    size: attachmentData.length,
    sha256: crypto.createHash('sha256').update(attachmentData).digest('hex'),
  };
  const startedAt = '2026-10-25T14:30:00.000Z';
  const task = {
    id: 'task-disclosure-fixture',
    name: '附件处理任务',
    prompt: '隔离的任务记录显示验收。',
    projectId: 'project-a',
    attachments: [attachment],
    frequency: 'daily',
    time: '09:00',
    timezone: 'Asia/Shanghai',
    enabled: false,
    nextRunAt: null,
    createdAt: startedAt,
    updatedAt: startedAt,
    lastRunAt: null,
  };
  const successOutput = '任务结果已整理。\n' + '附件清单、处理状态与结论均保存在此条运行记录中。'.repeat(8);
  await fs.writeFile(path.join(profile, 'settings.json'), json({
    workspaceRoot: workspace,
    projects: [
      { id: 'project-a', name: '验收项目 A', path: workspace },
      { id: 'project-b', name: '验收项目 B', path: secondWorkspace },
    ],
    activeProjectId: 'project-a',
    preferences: { fontFamily: 'Microsoft YaHei', fontSize: 16, browserPanelOpen: false, trayEnabled: false },
  }));
  await fs.writeFile(path.join(profile, 'scheduled-tasks.json'), json({
    version: 1,
    tasks: [task],
    runs: [
      { id: 'run-running', taskId: task.id, taskName: task.name, status: 'running', startedAt, completedAt: null, output: '正在读取任务输入并整理结果。' },
      { id: 'run-failed', taskId: task.id, taskName: task.name, status: 'failed', startedAt, completedAt: startedAt, output: '执行失败：受控错误详情仍可直接查看。' },
      { id: 'run-success', taskId: task.id, taskName: task.name, status: 'succeeded', startedAt, completedAt: startedAt, output: successOutput },
    ],
  }));
  report.successOutputLength = successOutput.length;
}

async function main() {
  try {
    await fs.mkdir(output, { recursive: true });
    if (!(await fs.stat(executable).catch(() => null))) throw Error('Candidate executable is missing: ' + executable);
    report.executableSha256 = crypto.createHash('sha256').update(await fs.readFile(executable)).digest('hex');
    await setupFixture();
    const state = await start();
    assert.equal(state.version, version);
    report.environment = { platform: os.platform(), release: os.release(), node: process.version };
    report.workspaceRoot = state.workspaceRoot;

    await check('all run statuses start as compact record rows', async () => {
      await wait(() => cdp.evaluate('Boolean(document.querySelector("button[aria-label=定时任务]"))'), 'Scheduled tasks navigation missing');
      await cdp.evaluate('document.querySelector("button[aria-label=定时任务]").click()');
      await wait(() => cdp.evaluate('Boolean(document.querySelector(".scheduled-view .task-run-row"))'), 'Task run records did not render');
      const snapshot = await cdp.evaluate(`(()=>({
        url: location.href,
        title: document.title,
        scripts: [...document.scripts].map((script) => script.src),
        rows: [...document.querySelectorAll('.task-run-row')].map((row) => ({
          id: row.dataset.runId,
          open: row.open,
          hasOpenAttribute: row.hasAttribute('open'),
          summary: row.querySelector('summary')?.innerText || '',
          outerHTML: row.outerHTML,
        })),
      }))()`);
      report.initialRendererSnapshot = snapshot;
      console.log('RUNTIME ' + json({ ...report.runtime, rows: snapshot.rows.map(({ id, open, hasOpenAttribute }) => ({ id, open, hasOpenAttribute })) }));
      const rows = snapshot.rows;
      assert.deepEqual(rows.map((row) => row.id), ['run-running', 'run-failed', 'run-success']);
      assert.deepEqual(rows.map((row) => row.open), [false, false, false], JSON.stringify(rows));
      assert.deepEqual(rows.map((row) => row.hasOpenAttribute), [false, false, false]);
      assert.match(rows[0].summary, /正在执行/);
      assert.match(rows[1].summary, /执行失败/);
      assert.match(rows[2].summary, /执行成功/);
      assert.match(rows[2].summary, /附件清单、处理状态/);
      assert.ok(rows[2].summary.length < report.successOutputLength);
      return rows;
    });

    await check('click and keyboard toggle the complete successful result', async () => {
      const row = 'document.querySelector(".task-run-row[data-run-id=run-success]")';
      await cdp.evaluate(`(${row}).querySelector('summary').click()`);
      await wait(() => cdp.evaluate(`${row}.open`), 'Successful run did not expand on click');
      const fullOutput = await cdp.evaluate(`${row}.querySelector('.task-run-output').textContent`);
      assert.equal(fullOutput.length, report.successOutputLength);
      assert.match(fullOutput, /处理状态与结论均保存在此条运行记录中/);
      await cdp.evaluate(`(${row}).querySelector('summary').click()`);
      await wait(() => cdp.evaluate(`!${row}.open`), 'Successful run did not collapse on click');
      const focus = await cdp.evaluate(`(()=>{const summary=(${row}).querySelector('summary');summary.focus();return{isSummary:document.activeElement===summary,tagName:document.activeElement.tagName,className:document.activeElement.className}})()`);
      assert.deepEqual(focus, { isSummary: true, tagName: 'SUMMARY', className: 'task-run-summary' });
      report.keyboardFocus = focus;
      await key('Enter', 13);
      await wait(() => cdp.evaluate(`${row}.open`), 'Successful run did not expand from keyboard');
      await key('Enter', 13);
      await wait(() => cdp.evaluate(`!${row}.open`), 'Successful run did not collapse from keyboard');
      const failed = 'document.querySelector(".task-run-row[data-run-id=run-failed]")';
      await cdp.evaluate(`(${failed}).querySelector('summary').click()`);
      await wait(() => cdp.evaluate(`${failed}.open`), 'Failed run did not expand on click');
      const failureOutput = await cdp.evaluate(`${failed}.querySelector('.task-run-output').textContent`);
      assert.match(failureOutput, /受控错误详情仍可直接查看/);
      return { clickToggles: 3, keyboardToggles: 2, fullOutputLength: fullOutput.length, failureOutput };
    });

    await check('task record rows fit the supported desktop viewports', async () => {
      const layouts = [];
      for (const [width, height] of [[1440, 900], [1064, 660]]) {
        await cdp.command('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
        await new Promise((resolve) => setTimeout(resolve, 120));
        const layout = await cdp.evaluate(`(()=>{
          const view=document.querySelector('.scheduled-view');
          const panel=document.querySelector('.scheduled-detail-scroll');
          const summary=document.querySelector('.task-run-row[data-run-id=run-success] > summary');
          const preview=summary.querySelector('.task-run-preview');
          return {
            viewport:[innerWidth,innerHeight],
            view:[view.scrollWidth,view.clientWidth],
            panel:[panel.scrollWidth,panel.clientWidth],
            summary:[summary.scrollWidth,summary.clientWidth],
            preview:[preview.scrollWidth,preview.clientWidth],
            font:getComputedStyle(summary).fontFamily,
            labelSize:parseFloat(getComputedStyle(summary.querySelector('.task-run-label')).fontSize),
            previewSize:parseFloat(getComputedStyle(preview).fontSize),
            timeSize:parseFloat(getComputedStyle(summary.querySelector('.task-run-time')).fontSize),
          };
        })()`);
        assert.ok(layout.view[0] <= layout.view[1] + 1, 'Scheduled task view overflowed.');
        assert.ok(layout.panel[0] <= layout.panel[1] + 1, 'Task details overflowed.');
        assert.ok(layout.summary[0] <= layout.summary[1] + 1, 'Task summary row overflowed.');
        assert.ok(layout.labelSize >= 15 && layout.previewSize >= 15 && layout.timeSize >= 14);
        assert.match(layout.font, /Microsoft YaHei/);
        layouts.push(layout);
      }
      await cdp.command('Emulation.clearDeviceMetricsOverride');
      return layouts;
    });

    await check('collapsed record screenshot is captured from the packaged EXE', async () => {
      await cdp.evaluate('document.querySelector(".task-run-row[data-run-id=run-failed] summary").click()');
      await wait(() => cdp.evaluate('!document.querySelector(".task-run-row[data-run-id=run-failed]").open'), 'Failed record did not return to compact row');
      await wait(() => cdp.evaluate('[...document.querySelectorAll(".task-run-row")].every(row=>!row.open)'), 'Record rows did not collapse for screenshot');
      await cdp.evaluate('document.querySelector(".scheduled-detail-scroll").scrollTop=0');
      await cdp.command('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
      const capture = await cdp.command('Page.captureScreenshot', { format: 'png', fromSurface: true });
      const image = Buffer.from(capture.data, 'base64');
      assert.ok(image.length > 10000, 'Screenshot must contain rendered content.');
      const screenshot = path.join(output, 'task-runs.png');
      await fs.writeFile(screenshot, image);
      report.screenshot = screenshot;
      return { screenshot, bytes: image.length, collapsedRows: await cdp.evaluate('document.querySelectorAll(".task-run-row:not([open])").length') };
    });

    await check('task attachments collapse, expand, remove, and remain assigned to their selected project', async () => {
      await cdp.evaluate('document.querySelector(".scheduled-new-button").click()');
      await wait(() => cdp.evaluate('Boolean(document.querySelector(".task-editor"))'), 'New task editor did not open');
      const defaultProject = await cdp.evaluate('document.querySelector(".task-editor select").value');
      assert.equal(defaultProject, 'project-a');
      await cdp.evaluate('document.querySelector(".task-editor-actions button[type=button]").click()');
      await wait(() => cdp.evaluate('!document.querySelector(".task-editor")'), 'New task editor did not close');

      const edit = 'document.querySelector(".scheduled-detail-actions .secondary-button")';
      await cdp.evaluate(`${edit}.click()`);
      await wait(() => cdp.evaluate('Boolean(document.querySelector(".task-editor .task-attachment-disclosure"))'), 'Task attachment row did not render');
      const collapsed = await cdp.evaluate(`(()=>{
        const row=document.querySelector('.task-attachment-disclosure');
        const projectSelect=[...document.querySelectorAll('.task-editor label.task-field')]
          .find((label)=>label.querySelector('span')?.textContent==='所属项目')?.querySelector('select');
        return{open:row.open,summary:row.querySelector('summary').innerText,project:projectSelect?.value,options:projectSelect?[...projectSelect.options].map(option=>option.textContent):[]};
      })()`);
      assert.equal(collapsed.open, false);
      assert.match(collapsed.summary, /brief\.txt/);
      assert.equal(collapsed.project, 'project-a');
      assert.deepEqual(collapsed.options, ['验收项目 A', '验收项目 B']);
      const collapsedCapture = await cdp.command('Page.captureScreenshot', { format: 'png', fromSurface: true });
      const collapsedScreenshot = path.join(output, 'task-attachment-collapsed.png');
      const collapsedImage = Buffer.from(collapsedCapture.data, 'base64');
      await fs.writeFile(collapsedScreenshot, collapsedImage);

      await cdp.evaluate('document.querySelector(".task-attachment-disclosure summary").click()');
      await wait(() => cdp.evaluate('document.querySelector(".task-attachment-disclosure").open'), 'Task attachment disclosure did not expand');
       const expanded = await cdp.evaluate(`(()=>{const row=document.querySelector('.task-attachment-disclosure');return{open:row.open,name:row.querySelector('.task-attachment-copy strong')?.textContent,pathVisible:Boolean(row.querySelector('.task-attachment-path')),remove:row.querySelector('.task-attachment-row button')?.getAttribute('aria-label')}})()`);
      assert.equal(expanded.open, true);
      assert.equal(expanded.name, 'brief.txt');
       assert.equal(expanded.pathVisible, false);
      assert.equal(expanded.remove, '移除附件 brief.txt');
      const modalLayouts = [];
      for (const [width, height] of [[1440, 900], [1064, 660]]) {
        await cdp.command('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
        await new Promise((resolve) => setTimeout(resolve, 120));
        const layout = await cdp.evaluate(`(()=>{
          const editor=document.querySelector('.task-editor');
          const body=editor.querySelector('.task-editor-body');
          const actions=editor.querySelector('.task-editor-actions').getBoundingClientRect();
          const dialog=editor.getBoundingClientRect();
          return{viewport:[innerWidth,innerHeight],dialog:[dialog.top,dialog.bottom],body:[body.scrollHeight,body.clientHeight],actions:[actions.top,actions.bottom]};
        })()`);
        assert.ok(layout.dialog[0] >= 0 && layout.dialog[1] <= height, `Task editor exceeds ${width}x${height}: ${JSON.stringify(layout)}`);
        assert.ok(layout.body[0] > layout.body[1], `Task editor body should scroll at ${width}x${height}: ${JSON.stringify(layout)}`);
        assert.ok(layout.actions[0] >= 0 && layout.actions[1] <= height, `Task editor actions are clipped at ${width}x${height}: ${JSON.stringify(layout)}`);
        modalLayouts.push(layout);
      }
      await cdp.command('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
      const expandedCapture = await cdp.command('Page.captureScreenshot', { format: 'png', fromSurface: true });
      const expandedScreenshot = path.join(output, 'task-attachment-expanded.png');
      const expandedImage = Buffer.from(expandedCapture.data, 'base64');
      const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
      assert.ok(collapsedImage.subarray(0, 8).equals(pngSignature) && expandedImage.subarray(0, 8).equals(pngSignature));
      assert.deepEqual([collapsedImage.readUInt32BE(16), collapsedImage.readUInt32BE(20)], [1440, 900]);
      assert.deepEqual([expandedImage.readUInt32BE(16), expandedImage.readUInt32BE(20)], [1440, 900]);
      assert.notEqual(crypto.createHash('sha256').update(collapsedImage).digest('hex'), crypto.createHash('sha256').update(expandedImage).digest('hex'));
      await fs.writeFile(expandedScreenshot, expandedImage);

      await cdp.evaluate('document.querySelector(".task-attachment-row button").click()');
      await wait(() => cdp.evaluate('!document.querySelector(".task-attachment-disclosure")'), 'Removing the task attachment did not update the editor');
      await cdp.evaluate(`(()=>{const element=document.querySelector('.task-editor select');const setter=Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set;setter.call(element,'project-b');element.dispatchEvent(new Event('change',{bubbles:true}));})()`);
      await cdp.evaluate('document.querySelector(".task-editor-actions button.primary-button").click()');
      await wait(() => cdp.evaluate('!document.querySelector(".task-editor")'), 'Edited task was not saved');
      let tasks = await cdp.evaluate('window.scodex.listScheduledTasks()');
      assert.equal(tasks.tasks[0].projectId, 'project-b');
      assert.deepEqual(tasks.tasks[0].attachments, []);

      await cdp.evaluate('document.querySelector(".project-item[data-project-id=project-b]").click()');
      await wait(() => cdp.evaluate('window.scodex.getAppState().then(state=>state.activeProjectId==="project-b")'), 'Active project B did not open');
      await cdp.evaluate('document.querySelector(".project-item[data-project-id=project-a]").click()');
      await wait(() => cdp.evaluate('window.scodex.getAppState().then(state=>state.activeProjectId==="project-a")'), 'Active project A did not reopen');
      await cdp.evaluate('document.querySelector("button[aria-label=定时任务]").click()');
      await wait(() => cdp.evaluate('Boolean(document.querySelector(".scheduled-detail-heading .scheduled-project-label"))'), 'Scheduled task details did not return');
      tasks = await cdp.evaluate('window.scodex.listScheduledTasks()');
      const appState = await cdp.evaluate('window.scodex.getAppState()');
      const finalLabel = await cdp.evaluate('document.querySelector(".scheduled-detail-heading .scheduled-project-label").innerText');
      assert.equal(appState.activeProjectId, 'project-a');
      assert.equal(tasks.tasks[0].projectId, 'project-b');
      assert.match(finalLabel, /验收项目 B/);
      return { defaultProject, collapsed, expanded, modalLayouts, collapsedScreenshot, expandedScreenshot, activeProjectId: appState.activeProjectId, scheduledProjectId: tasks.tasks[0].projectId, finalLabel };
    });

    report.status = 'passed';
  } catch (error) {
    report.status = 'failed';
    report.error = error.stack;
    console.error(error);
    process.exitCode = 1;
  } finally {
    try { if (cdp) await cdp.evaluate('window.scodex.quitApp()'); } catch {}
    if (child && child.exitCode === null) {
      await wait(() => Promise.resolve(child.exitCode !== null), 'Application quit timed out', 15000).catch(() => {});
      if (child.exitCode === null) child.kill();
      await wait(() => Promise.resolve(child.exitCode !== null), 'Owned application process did not exit', 5000).catch(() => {});
    }
    socket?.close();
    report.exitCode = child?.exitCode ?? null;
    try {
      await fs.rm(fixture, { recursive: true, force: true });
      report.cleanup = { status: 'removed', fixture };
    } catch (error) {
      report.cleanup = { status: 'manual-cleanup-required', fixture, error: error.message };
    }
    report.finishedAt = new Date().toISOString();
    await fs.mkdir(output, { recursive: true });
    await fs.writeFile(path.join(output, 'scheduled-task-ui-verification.json'), json(report));
    console.log('RESULT ' + report.status);
  }
}

main();
