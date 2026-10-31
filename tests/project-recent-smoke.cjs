const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const net = require('node:net');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const output = path.resolve(root, process.env.SCODEX_PROJECT_RECENT_OUTPUT || 'release/project-recent-final-20261024');
const exe = path.join(output, 'Scodex-Workbench-ProjectRecent-1.0.4-x64.exe');
const id = `project-recent-${crypto.randomUUID()}`;
const temp = path.join(root, 'workspace', id);
const profile = path.join(require('node:os').tmpdir(), id, 'profile');
const codexHome = path.join(require('node:os').tmpdir(), id, 'codex-home');
const second = path.join(temp, 'second-project');
const reportPath = path.join(output, 'project-recent-ui-verification.json');

async function port() { const server = net.createServer(); await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve)); const value = server.address().port; await new Promise((resolve) => server.close(resolve)); return value; }
async function waitFor(fn, label, timeout = 20000) { const end = Date.now() + timeout; let last; while (Date.now() < end) { try { const value = await fn(); if (value) return value; } catch (error) { last = error; } await new Promise((resolve) => setTimeout(resolve, 160)); } throw new Error(`Timed out waiting for ${label}${last ? `: ${last.message}` : ''}`); }
function cdp(socket) { let next = 0; const pending = new Map(); socket.addEventListener('message', (event) => { let message; try { message = JSON.parse(typeof event.data === 'string' ? event.data : event.data.toString()); } catch { return; } const item = pending.get(message.id); if (!item) return; pending.delete(message.id); message.error ? item.reject(new Error(message.error.message)) : item.resolve(message.result); }); return { command(method, params = {}) { const id = ++next; return new Promise((resolve, reject) => { pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params })); }); }, eval(expression) { return this.command('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, userGesture: true }).then((result) => result?.result?.value); } }; }
async function stop(child) { if (!child || child.exitCode !== null) return; child.kill(); await new Promise((resolve) => { const timer = setTimeout(resolve, 5000); child.once('exit', () => { clearTimeout(timer); resolve(); }); }); }

async function main() {
  await fs.mkdir(temp, { recursive: true }); await fs.mkdir(second, { recursive: true }); await fs.mkdir(profile, { recursive: true });
  await fs.writeFile(path.join(profile, 'settings.json'), JSON.stringify({ workspaceRoot: temp }));
  const p = await port();
  let processOutput = '';
  const child = spawn(exe, [`--remote-debugging-port=${p}`, `--user-data-dir=${profile}`, '--disable-gpu'], { cwd: path.dirname(exe), env: { ...process.env, SCODEX_HOME: codexHome }, windowsHide: false, stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout.on('data', (chunk) => { processOutput = `${processOutput}${chunk}`.slice(-4000); });
  child.stderr.on('data', (chunk) => { processOutput = `${processOutput}${chunk}`.slice(-4000); });
  let socket;
  const result = { status: 'failed', checks: [], executable: exe, profile, codexHome };
  try {
    const target = await waitFor(async () => { if (child.exitCode !== null) throw new Error(`应用已退出(${child.exitCode})：${processOutput}`); try { const response = await fetch(`http://127.0.0.1:${p}/json/list`); if (!response.ok) return null; const items = await response.json(); return items.find((item) => item.type === 'page' && item.webSocketDebuggerUrl); } catch { return null; } }, 'renderer target', 60000);
    socket = new WebSocket(target.webSocketDebuggerUrl); await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
    const page = cdp(socket); await waitFor(() => page.eval("Boolean(document.querySelector('.app-shell'))"), 'workbench shell');
    const initial = await page.eval('window.scodex.getAppState()');
    const projectState = await page.eval(`window.scodex.addProject(${JSON.stringify({ name: '第二项目', path: second })})`);
    const conversation = { ...initial.library.conversations[0], id: crypto.randomUUID(), title: '项目最近验收', projectId: projectState.activeProjectId, updatedAt: new Date().toISOString(), messages: [{ id: crypto.randomUUID(), role: 'user', content: '项目联动验收' }, { id: crypto.randomUUID(), role: 'assistant', content: '第二项目通过' }] };
    const firstProjectConversation = { ...conversation, id: crypto.randomUUID(), title: '首个项目最近', projectId: initial.activeProjectId, updatedAt: new Date(Date.now() - 1000).toISOString(), messages: [{ id: crypto.randomUUID(), role: 'user', content: '首个项目联动验收' }, { id: crypto.randomUUID(), role: 'assistant', content: '首个项目通过' }] };
    const library = { ...initial.library, activeId: conversation.id, conversations: [conversation, firstProjectConversation] };
    await waitFor(() => page.eval("document.querySelector('.history-save-state')?.textContent === '已保存到本机'"), 'initial history save');
    await page.eval(`window.scodex.saveHistory(${JSON.stringify(library)})`);
    await waitFor(() => page.eval(`(async () => Boolean((await window.scodex.getAppState())?.library?.conversations?.some((chat) => chat.id === ${JSON.stringify(conversation.id)} && chat.projectId === ${JSON.stringify(projectState.activeProjectId)})))()`), 'project chat history write');
    await page.eval('location.reload()');
    await waitFor(() => page.eval("Boolean(document.querySelector('.app-shell') && document.querySelector('.project-list'))"), 'project sidebar');
    await waitFor(() => page.eval(`(async () => Boolean((await window.scodex.getAppState())?.library?.conversations?.some((chat) => chat.id === ${JSON.stringify(conversation.id)} && chat.projectId === ${JSON.stringify(projectState.activeProjectId)})))()`), 'project chat history restore');
    const restored = await page.eval('window.scodex.getAppState()');
    assert.equal(restored.library.conversations.find((chat) => chat.id === conversation.id)?.projectId, projectState.activeProjectId);
    result.checks.push({ name: '项目聊天保存/重载保留 projectId', status: 'passed' });
    await waitFor(() => page.eval("Boolean(document.querySelector('.assistant-view'))"), 'project assistant view');
    const labels = await page.eval("[...document.querySelectorAll('.project-item')].map((item) => item.textContent.trim())");
    assert.ok(labels.some((label) => label.includes('第二项目'))); result.checks.push({ name: '项目列表', status: 'passed', labels });
    const sidebar = await page.eval("({ nav: [...document.querySelectorAll('.activity-button')].map((item) => item.getAttribute('aria-label')).filter((label) => ['项目','最近'].includes(label)), sections: [...document.querySelectorAll('.rail-section-head')].map((item) => item.textContent.trim()), recent: [...document.querySelectorAll('.rail .recent-list:not(.project-list) .recent-item')].map((item) => item.textContent.trim()) })");
    assert.deepEqual(sidebar.nav, ['项目', '最近']); assert.ok(sidebar.sections.some((item) => item.startsWith('项目'))); assert.ok(sidebar.sections.some((item) => item.startsWith('最近'))); assert.ok(sidebar.recent.some((item) => item.includes('项目最近验收'))); result.checks.push({ name: '第一工作页面项目/最近结构', status: 'passed', sidebar });
    await page.eval("document.querySelector('.recent-item[title=\"项目最近验收\"]')?.click()");
    assert.equal(await page.eval('document.querySelector(".breadcrumb strong")?.textContent'), '项目最近验收'); result.checks.push({ name: '最近打开对话', status: 'passed' });
    await page.eval("document.querySelector('.activity-button[aria-label=\"最近\"]')?.click()");
    await waitFor(() => page.eval("document.querySelector('.recent-view h1')?.textContent === '最近'"), 'recent view');
    assert.ok((await page.eval("document.querySelector('.recent-view')?.textContent.includes('项目最近验收')"))); result.checks.push({ name: '最近页面', status: 'passed' });
    await page.eval("document.querySelector('.activity-button[aria-label=\"项目\"]')?.click()");
    await waitFor(() => page.eval("Boolean(document.querySelector('.assistant-view'))"), 'return to project view');
    const hidden = await page.eval("({ file: Boolean([...document.querySelectorAll('button')].find((item) => ['文件与代码','图片','表格','技能','插件','定时任务'].includes(item.textContent?.trim()))), composer: Boolean(document.querySelector('.mode-switch, .reasoning-picker, .composer-project-chip, .composer-plus, .composer-model-button, .composer-effort')), auto: document.querySelector('.auto-mode-badge')?.textContent?.trim() || '' })");
    assert.equal(hidden.file, false); assert.equal(hidden.composer, false); assert.equal(hidden.auto, 'AI 自动处理'); result.checks.push({ name: '项目主输入区仅保留 AI 自动处理', status: 'passed', hidden });
    const projectNames = await page.eval("[...document.querySelectorAll('.project-item')].map((item) => item.textContent.trim())");
    assert.ok(projectNames.length >= 2, '需要至少两个项目用于联动验收');
    const firstName = projectNames.find((name) => !name.includes('第二项目')) || projectNames[0];
    await page.eval(`(() => { const item = [...document.querySelectorAll('.project-item')].find((node) => node.textContent.trim() === ${JSON.stringify(firstName)}); item?.click(); return Boolean(item); })()`);
    await waitFor(() => page.eval(`document.querySelector('.breadcrumb strong')?.textContent === ${JSON.stringify('首个项目最近')}`), 'first project chat');
    const firstProjectVisible = await page.eval("({ active: document.querySelector('.project-item[aria-current=\"true\"]')?.textContent?.trim() || '', title: document.querySelector('.breadcrumb strong')?.textContent || '', body: document.querySelector('.assistant-view')?.textContent.includes('首个项目通过') || false, second: document.querySelector('.assistant-view')?.textContent.includes('第二项目通过') || false })");
    assert.equal(firstProjectVisible.body, true); assert.equal(firstProjectVisible.second, false); result.checks.push({ name: '切换首个项目显示对应聊天', status: 'passed', evidence: firstProjectVisible });
    await page.eval("(() => { const item = [...document.querySelectorAll('.project-item')].find((node) => node.textContent.includes('第二项目')); item?.click(); return Boolean(item); })()");
    await waitFor(() => page.eval(`document.querySelector('.breadcrumb strong')?.textContent === ${JSON.stringify('项目最近验收')}`), 'second project chat');
    const secondProjectVisible = await page.eval("({ active: document.querySelector('.project-item[aria-current=\"true\"]')?.textContent?.trim() || '', title: document.querySelector('.breadcrumb strong')?.textContent || '', body: document.querySelector('.assistant-view')?.textContent.includes('第二项目通过') || false, first: document.querySelector('.assistant-view')?.textContent.includes('首个项目通过') || false })");
    assert.equal(secondProjectVisible.body, true); assert.equal(secondProjectVisible.first, false); result.checks.push({ name: '切换第二项目恢复对应聊天', status: 'passed', evidence: secondProjectVisible });
    result.screenshot = path.join(output, 'workbench-project-recent.png');
    const shot = await page.command('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    await fs.writeFile(result.screenshot, Buffer.from(shot.data, 'base64'));
    await page.eval("document.querySelector('.settings-activity')?.click()"); await waitFor(() => page.eval("Boolean(document.querySelector('.settings-view'))"), 'settings');
    await page.eval("(() => { const item = [...document.querySelectorAll('.settings-category')].find((node) => node.textContent.includes('SKILL')); item?.click(); return Boolean(item); })()");
    await waitFor(() => page.eval("Boolean(document.querySelector('.plugin-settings'))"), 'SKILL settings');
    const settings = await page.eval("({ skillCategory: [...document.querySelectorAll('.settings-category')].filter((item) => item.textContent.includes('SKILL')).map((item) => item.textContent.trim()), auto: document.body.textContent.includes('AI 自动调用 SKILL') || document.body.textContent.includes('自动调用 SKILL') })");
    assert.equal(settings.skillCategory.length, 1); assert.equal(settings.auto, true); result.checks.push({ name: '设置唯一 SKILL 自动调用入口', status: 'passed', settings });
    result.status = 'passed';
  } finally {
    if (socket) socket.close(); await stop(child); await fs.writeFile(reportPath, JSON.stringify({ ...result, completedAt: new Date().toISOString() }, null, 2) + '\n');
  }
  console.log(JSON.stringify(result, null, 2));
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
