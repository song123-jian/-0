// The actual Electron EXE, React, IPC, persistence and file tools are exercised.
// Only the model HTTP responses are replaced with a controlled loopback server.
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
const http = require('node:http');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const { connect, wait, freePort } = require('./agent-workflow-ui.cjs');
const root = path.resolve(__dirname, '..');
const output = process.env.SCODEX_PROJECTLESS_OUTPUT || path.join(root, 'release/projectless-chat-20261101/candidate-ui');
const executable = process.env.SCODEX_PROJECTLESS_EXE || path.join(root, 'release/projectless-chat-20261101/candidate/win-unpacked/Scodex工作台.exe');
const report = { status: 'running', executable, version: '1.3.31', checks: [], modelRequests: 0, limitations: ['Model HTTP is controlled loopback; public model generation is not tested.'] };
const json = JSON.stringify;
let temporary, profile, home, projectFolder, app, socket, cdp, server;
async function persist() { await fs.mkdir(output, { recursive: true }); await fs.writeFile(path.join(output, 'projectless-ui-verification.json'), json(report, null, 2)); }
async function check(name, fn) { const evidence = await fn(); report.checks.push({ name, status: 'passed', evidence }); await persist(); console.log('PASS ' + name); }
async function state() { return cdp.evaluate('window.scodex.getAppState()'); }
async function ready() { await wait(() => cdp.evaluate('Boolean(document.querySelector("[aria-label=输入工作内容]"))'), 'React input ready'); }
async function reload() { await cdp.evaluate('location.reload()'); await ready(); await wait(() => cdp.evaluate('document.querySelector(".history-save-state")?.textContent === "已保存到本机"'), 'History settled'); }
async function launch() {
  const port = await freePort();
  app = spawn(executable, ['--remote-debugging-port=' + port, '--user-data-dir=' + profile, ...(process.env.SCODEX_PROJECTLESS_DEFAULT_HOME ? [] : ['--scodex-home=' + home]), '--disable-gpu'], { cwd: path.dirname(executable), windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
  let stderr = ''; app.stderr.on('data', b => { stderr = (stderr + b).slice(-2000); });
  const target = await wait(async () => {
    if (app.exitCode !== null) throw Error('EXE exited: ' + stderr);
    return (await fetch('http://127.0.0.1:' + port + '/json/list').then(r => r.json())).find(t => t.type === 'page' && t.url.startsWith('file:') && !t.url.endsWith('desktop-control.html'));
  }, 'Actual EXE ready', 60000);
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
  cdp = connect(socket); await ready();
  const current = await state(); assert.equal(current.version, report.version); assert.equal(path.resolve(current.userDataPath), profile);
}
async function stop() {
  if (!app || app.exitCode !== null) return;
  await cdp.evaluate('window.scodex.quitApp()').catch(() => {});
  await wait(() => app.exitCode !== null, 'Clean EXE exit', 25000); socket?.close(); app = null;
}
async function click(selector) { await wait(() => cdp.evaluate('(()=>{const e=document.querySelector(' + json(selector) + ');if(!e||e.disabled)return false;e.click();return true})()'), 'Click ' + selector); }
async function textClick(selector, text) { await wait(() => cdp.evaluate('(()=>{const e=[...document.querySelectorAll(' + json(selector) + ')].find(e=>e.textContent.trim()===' + json(text) + ');if(!e||e.disabled)return false;e.click();return true})()'), 'Button ' + text); }
async function fill(selector, value) {
  await cdp.evaluate('(()=>{const e=document.querySelector(' + json(selector) + ');if(!e)throw Error("Missing input");const proto=e instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,"value").set.call(e,' + json(value) + ');e.dispatchEvent(new Event("input",{bubbles:true}));})()');
}
async function submit(prompt, expected) {
  const previous = new Set((await state()).library.conversations.flatMap(c => c.messages.map(m => m.id)));
  await fill('[aria-label="输入工作内容"]', prompt); await click('[aria-label="发送消息"]');
  await wait(async () => {
    const s = await state(); const chat = s.library.conversations.find(c => c.id === s.library.activeId);
    return chat?.messages.some(m => !previous.has(m.id) && m.role === 'assistant' && !m.error && !m.pending && m.content.includes(expected));
  }, 'Saved assistant result ' + expected, 45000);
  await wait(() => cdp.evaluate('!document.querySelector("[aria-label=停止生成]")'), 'Request complete');
}
async function createProject() {
  await click('[aria-label="创建项目"]');
  await fill('[aria-label="项目名称"]', '可选项目'); await fill('[aria-label="项目文件夹"]', projectFolder);
  await click('.project-editor button.primary-button');
  await wait(async () => (await state()).activeProjectId, 'Project selected');
  await wait(() => cdp.evaluate('!document.querySelector(".project-editor")'), 'Project form closed');
  return (await state()).activeProjectId;
}
async function projectMenu(id, text) {
  await wait(() => cdp.evaluate('!document.querySelector(".app-shell[inert]")'), 'Project update complete before next menu');
  await cdp.evaluate('(()=>{const e=document.querySelector(' + json('[data-project-id="' + id + '"]') + ');const r=e.getBoundingClientRect();e.dispatchEvent(new MouseEvent("contextmenu",{bubbles:true,clientX:r.left+35,clientY:r.top+12}));})()');
  const action = { '归档': 'archive', '恢复': 'restore', '永久删除': 'delete' }[text];
  await click('[role="menuitem"][data-action="' + action + '"]');
}
function model(res, message) {
  res.writeHead(200, { 'content-type': 'text/event-stream; charset=utf-8' });
  const delta = message.tool_calls ? { tool_calls: message.tool_calls.map((item, index) => ({ index, ...item })) } : { content: message.content };
  res.end('data: ' + json({ choices: [{ delta }] }) + '\n\ndata: ' + json({ choices: [{ delta: {}, finish_reason: message.tool_calls ? 'tool_calls' : 'stop' }] }) + '\n\ndata: [DONE]\n\n');
}
async function main() {
  temporary = process.env.SCODEX_PROJECTLESS_TEMP || await fs.mkdtemp(path.join(os.tmpdir(), 'scodex-projectless-ui-')); report.temporary = temporary;
  profile = path.join(temporary, 'profile'); home = path.join(temporary, 'home'); projectFolder = path.join(temporary, 'optional-project');
  await fs.mkdir(home, { recursive: true }); await fs.mkdir(projectFolder, { recursive: true });
  if (!process.env.SCODEX_PROJECTLESS_TEMP) await fs.writeFile(path.join(projectFolder, '保留.txt'), '项目文件必须保留');
  server = http.createServer(async (req, res) => {
    try {
      const chunks = []; for await (const b of req) chunks.push(b); const body = JSON.parse(Buffer.concat(chunks).toString()); report.modelRequests++;
      const toolResult = body.messages.some(m => m.role === 'tool');
      const prompt = [...body.messages].reverse().find(m => m.role === 'user')?.content;
      if (String(prompt).includes('无项目执行验收') && !toolResult) model(res, { tool_calls: [{ id: 'projectless-write', type: 'function', function: { name: 'write_file', arguments: json({ path: '无项目结果.txt', expected_hash: 'new', content: '无项目也能完成文件任务\n' }) } }] });
      else model(res, { content: toolResult ? 'PROJECTLESS_TASK_OK' : 'PROJECTLESS_CHAT_OK' });
    } catch (error) { report.serverError = error.stack; res.writeHead(500); res.end(); }
  }); server.listen(0, '127.0.0.1'); await once(server, 'listening');
  await launch();
  if (!process.env.SCODEX_PROJECTLESS_RESUME) await check('fresh installation opens ordinary conversation with zero projects', async () => {
    const s = await state(); assert.equal(s.projects.length, 0); assert.equal(s.activeProjectId, '');
    assert.equal(await cdp.evaluate('document.querySelector("[aria-label=普通对话（无需项目）]")?.getAttribute("aria-current")'), 'true');
    return { projects: 0, activeProjectId: '', inputReady: true };
  });
  await cdp.evaluate('window.scodex.saveModelConnection(' + json({ name: '仅本机验收', baseUrl: 'http://127.0.0.1:' + server.address().port + '/v1', model: 'projectless-fixture', models: ['projectless-fixture'], apiKey: 'controlled-test-only', toolProtocol: 'native' }) + ')');
  await cdp.evaluate('window.scodex.saveAgentSettings({sandboxMode:"danger-full-access",approvalPolicy:"never",networkAccess:true,networkDomains:["127.0.0.1"],allowLocalBinding:true,workspaceDependencies:false},"shared")');
  await reload();
  let ordinaryChat;
  if (['after-chat', 'after-projects', 'after-delete'].includes(process.env.SCODEX_PROJECTLESS_RESUME)) {
    ordinaryChat = (await state()).library.conversations.find(c => !c.projectId && c.messages.some(m => m.content.includes('PROJECTLESS_CHAT_OK')))?.id;
    assert.ok(ordinaryChat); report.reused = process.env.SCODEX_PROJECTLESS_RESUME === 'after-projects' ? 'candidate-final-ui: fresh startup, ordinary chat, last-project archive and restore' : 'candidate-ui: fresh startup; candidate-ui-r2: ordinary chat persisted';
  } else await check('ordinary chat sends and persists without creating a project', async () => {
    await submit('无项目普通对话验收', 'PROJECTLESS_CHAT_OK'); const s = await state(); ordinaryChat = s.library.activeId;
    assert.equal(s.projects.length, 0); assert.equal(s.library.conversations.find(c => c.id === ordinaryChat).projectId || '', ''); return { chatId: ordinaryChat, saved: true };
  });
  if (process.env.SCODEX_PROJECTLESS_SCOPE !== 'formal' && !['after-projects', 'after-delete'].includes(process.env.SCODEX_PROJECTLESS_RESUME)) {
  await check('last project can be archived and restored through actual menus', async () => {
    const saved = (await state()).projects.find(p => p.name === '可选项目');
    const id = saved?.id || await createProject();
    if (!saved?.archivedAt) { await projectMenu(id, '归档'); await wait(async () => !(await state()).activeProjectId, 'Archived last project'); }
    assert.equal((await state()).projects.find(p => p.id === id).archivedAt !== null, true);
    await reload();
    await click('[aria-label="查看已归档项目"]'); await projectMenu(id, '恢复');
    await wait(async () => !(await state()).projects.find(p => p.id === id).archivedAt, 'Project restored');
    await wait(() => cdp.evaluate('!document.querySelector(".app-shell[inert]")'), 'Restore UI complete');
    await click('[aria-label="返回项目列表"]'); await click('[data-project-id="' + id + '"]');
    await wait(async () => (await state()).activeProjectId === id, 'Restored project selected'); return { projectId: id, archivedAndRestored: true };
  });
  }
  if (process.env.SCODEX_PROJECTLESS_RESUME !== 'after-delete') {
  await check('ordinary conversation can be selected while optional projects still exist', async () => {
    if (!(await state()).projects.length) await createProject();
    await click('[aria-label="普通对话（无需项目）"]'); await wait(async () => { const s = await state(); return !s.activeProjectId && s.library.activeId === ordinaryChat; }, 'Ordinary selection persisted');
    const s = await state(); assert.equal(s.projects.length, 1); assert.equal(s.library.activeId, ordinaryChat);
    await submit('保留项目时普通对话验收', 'PROJECTLESS_CHAT_OK'); return { projectCount: 1, selectedProject: '', chatPreserved: true };
  });
  }
  if (process.env.SCODEX_PROJECTLESS_RESUME !== 'after-delete') {
  await check('deleting the last project leaves ordinary chat and disk files intact', async () => {
    const id = (await state()).projects[0].id; await click('[data-project-id="' + id + '"]');
    await projectMenu(id, '永久删除'); await textClick('[role="dialog"] button', '永久删除');
    await wait(async () => (await state()).projects.length === 0, 'Last project deleted');
    await wait(() => cdp.evaluate('!document.querySelector("[role=dialog]")'), 'Delete dialog closed');
    const s = await state(); assert.equal(s.activeProjectId, ''); assert.equal(s.library.conversations.some(c => c.projectId === id), false);
    assert.equal(s.library.conversations.some(c => c.id === ordinaryChat), true); assert.equal(await fs.readFile(path.join(projectFolder, '保留.txt'), 'utf8'), '项目文件必须保留');
    return { projects: 0, removedProjectChats: true, ordinaryChatRetained: true, diskFileRetained: true };
  });
  }
  await check('file task executes in general workspace without a registered project', async () => {
    await click('[aria-label="新聊天"]');
    assert.equal(await cdp.evaluate('document.querySelector("[aria-label=更改权限]")?.textContent.includes("完全访问")'), true);
    await submit('无项目执行验收：生成测试文件', 'PROJECTLESS_TASK_OK');
    const s = await state(); const content = await fs.readFile(path.join(s.workspaceRoot, '无项目结果.txt'), 'utf8'); assert.equal(content, '无项目也能完成文件任务\n');
    assert.equal(s.projects.length, 0); return { workspace: s.workspaceRoot, fileContent: content, projectCount: 0 };
  });
  await stop(); await launch();
  await check('restart retains zero projects, conversation results and a usable composer', async () => {
    const s = await state(); assert.equal(s.projects.length, 0); assert.equal(s.activeProjectId, '');
    assert.equal(s.library.conversations.some(c => c.messages.some(m => m.content.includes('PROJECTLESS_TASK_OK'))), true);
    await click('[aria-label="新聊天"]'); await submit('重启后无项目对话验收', 'PROJECTLESS_CHAT_OK');
    const screen = await cdp.command('Page.captureScreenshot', { format: 'png' }); await fs.writeFile(path.join(output, 'projectless-final.png'), Buffer.from(screen.data, 'base64'));
    return { projectCount: 0, savedResultsRestored: true, postRestartSend: true };
  });
  report.status = 'passed';
}
main().catch(error => { report.status = 'failed'; report.error = error.stack; process.exitCode = 1; console.error(error.stack); }).finally(async () => {
  if (app && app.exitCode === null) await stop().catch(error => { report.cleanupError = error.message; });
  socket?.close(); if (server) await new Promise(resolve => server.close(resolve));
  if (report.status === 'passed') { await fs.rm(temporary, { recursive: true, force: true }); report.temporaryRemoved = true; }
  await persist(); console.log('RESULT ' + report.status);
});
