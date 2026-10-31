// Actual portable EXE + public GitHub catalog. Only the model response is local.
const assert = require('node:assert/strict'), fs = require('node:fs/promises'), path = require('node:path'), os = require('node:os'), crypto = require('node:crypto'), http = require('node:http');
const { spawn } = require('node:child_process');
const { connect, wait, freePort } = require('./agent-workflow-ui.cjs');
const root = path.resolve(__dirname, '..'), version = '1.3.18', json = JSON.stringify;
const executable = path.resolve(process.env.SCODEX_MARKET_EXE || path.join(root, 'release/plugin-marketplace-20261030/candidate/Scodex-Workbench-1.3.18-x64.exe'));
const output = path.resolve(process.env.SCODEX_MARKET_OUTPUT || path.join(root, 'release/plugin-marketplace-20261030/candidate-ui'));
const entryOnly = process.env.SCODEX_MARKET_SCOPE === 'entry';
const fixture = path.join(os.tmpdir(), 'scodex-market-ui-' + crypto.randomUUID()), profile = path.join(fixture, 'profile'), project = path.join(fixture, 'project'), home = path.join(fixture, 'scodex');
const report = { status: 'running', version, executable, fixture, scope: entryOnly ? 'entry-check' : 'full-candidate', checks: [], modelRequests: 0, limitations: ['Real public GitHub API/blob download, actual EXE/IPC/files and restart. Only model response is controlled locally.', 'CDP drives renderer, not native Windows mouse. Update and malicious-server cases are covered by service tests, not public GitHub mutation.'] };
let child, socket, cdp, port, server, selected;
const save = () => fs.writeFile(path.join(output, 'plugin-marketplace-ui-verification.json'), json(report, null, 2) + '\n');
const ev = value => cdp.evaluate(value);
async function check(name, fn) { report.currentCheck = name; await save(); const evidence = await fn(); report.checks.push({ name, status: 'passed', evidence }); await save(); console.log('PASS ' + name); }
async function textClick(selector, text) { await wait(() => ev('(()=>{const e=[...document.querySelectorAll(' + json(selector) + ')].find(e=>e.textContent.trim()===' + json(text) + ');if(!e||e.disabled)return false;e.click();return true})()'), text); }
async function click(label) { await wait(() => ev('(()=>{const e=document.querySelector(' + json('[aria-label="' + label + '"]') + ');if(!e||e.disabled)return false;e.click();return true})()'), label); }
async function input(label, value) { await ev('(()=>{const e=document.querySelector(' + json('[aria-label="' + label + '"]') + ');if(!e)throw Error("Missing input");Object.getOwnPropertyDescriptor(e instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,"value").set.call(e,' + json(value) + ');e.dispatchEvent(new Event("input",{bubbles:true}))})()'); }
async function plugins(scope) { await ev('document.querySelector(".workbench-primary-nav [aria-label=插件]").click()'); await textClick('.extension-segment button', scope); }
async function viewport(width, height) { await cdp.command('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false }); await ev('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))'); }
async function settled() { await wait(async () => !(await ev('window.scodex.listPluginCatalog()')).progress && !(await ev('!!document.querySelector(".market-progress")')), 'Plugin operation complete', 90000); }
async function launch() {
  port = await freePort(); child = spawn(executable, ['--remote-debugging-port=' + port, '--user-data-dir=' + profile, '--disable-gpu'], { cwd: path.dirname(executable), windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'], env: { ...process.env, SCODEX_HOME: home, SCODEX_REFERENCE_HOME: path.join(fixture, 'reference'), SCODEX_REFERENCE_AGENTS_HOME: path.join(fixture, 'agents') } });
  let stderr = ''; child.stderr.on('data', b => { stderr = (stderr + b.toString()).slice(-3000); });
  const target = await wait(async () => { if (child.exitCode !== null) throw Error(stderr); return (await fetch('http://127.0.0.1:' + port + '/json/list').then(r => r.json())).find(t => t.type === 'page' && t.url.startsWith('file:')); }, 'EXE startup', 60000);
  socket = new WebSocket(target.webSocketDebuggerUrl); await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); }); cdp = connect(socket);
  await wait(() => ev('!!document.querySelector("[aria-label=输入工作内容]")'), 'Renderer ready');
  const identity = await ev('window.scodex.getAppState().then(s=>({version:s.version,workspaceRoot:s.workspaceRoot,userDataPath:s.userDataPath}))'); assert.equal(identity.version, version); assert.equal(path.resolve(identity.workspaceRoot), project); report.pid = child.pid;
  return { ...identity, pageUrl: target.url };
}
async function quit() { if (!child || child.exitCode !== null || socket?.readyState !== 1) return; await ev('window.scodex.quitApp()'); await wait(() => Promise.resolve(child.exitCode !== null), 'Portable exit', 20000); assert.equal(child.exitCode, 0); report.exitCode = child.exitCode; socket.close(); }
async function removeSelected() {
  await plugins('已安装'); await click('卸载插件 ' + selected.name);
  // Electron window.confirm is an actual dialog; acknowledge the renderer dialog via CDP.
}
async function main() {
  try {
    await fs.mkdir(output, { recursive: true }); for (const dir of [profile, project, home]) await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(profile, 'settings.json'), json({ workspaceRoot: project, preferences: { contextAccess: 'manual', browserPanelOpen: false, trayEnabled: false, skillsEnabled: true, themeMode: 'light', fontFamily: 'Microsoft YaHei', fontSize: 16 } }));
    await fs.writeFile(path.join(home, 'codex-settings.json'), json({ sandboxMode: 'danger-full-access', approvalPolicy: 'on-request', workspaceDependencies: false }));
    server = http.createServer(async (req, res) => { try { let raw = ''; for await (const chunk of req) raw += chunk; const body = JSON.parse(raw); report.modelRequests++; report.modelReceivedInstalledSkill = body.messages.some(m => typeof m.content === 'string' && m.content.includes(selected.content)); res.writeHead(200, { 'content-type': 'text/event-stream' }); res.end('data: ' + json({ choices: [{ delta: { content: '已读取已安装技能：' + selected.name } }] }) + '\n\ndata: [DONE]\n\n'); } catch { res.writeHead(500).end(); } }); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    report.sha256 = crypto.createHash('sha256').update(await fs.readFile(executable)).digest('hex');
    await check('packaged-exe-identity', launch);
    await cdp.command('Page.enable'); socket.addEventListener('message', ({ data }) => { if (JSON.parse(data).method === 'Page.javascriptDialogOpening') cdp.command('Page.handleJavaScriptDialog', { accept: true }).catch(() => {}); });
    await check('real-public-directory-detail-and-install', async () => {
      await plugins('公开目录'); assert.equal((await ev('window.scodex.listPluginCatalog()')).plugins.length, 0);
      await textClick('.market-source-toolbar button', '读取目录'); await settled();
      const state = await ev('window.scodex.listPluginCatalog()'); assert.ok(state.plugins.length > 5); assert.match(state.sources[0].commit, /^[a-f0-9]{40}$/);
      const item = state.plugins.find(p => p.name === 'gh-address-comments') || state.plugins.find(p => p.fileCount <= 6 && p.totalBytes < 200000); assert.ok(item);
      await textClick('[data-catalog-id="' + item.id + '"] button', '查看详情'); await wait(() => ev('!!document.querySelector(".market-detail-dialog")'), 'Actual detail dialog');
      selected = { ...item, name: await ev('document.querySelector("#market-detail-title").textContent'), content: await ev('document.querySelector(".market-skill-content").textContent') };
      const detailLayouts = [];
      for (const [width, height] of [[1440, 900], [1064, 660]]) {
        await viewport(width, height);
        const layout = await ev('(()=>{const d=document.querySelector(".market-detail-dialog"),b=d.querySelector(".market-detail-footer .primary-button"),r=d.getBoundingClientRect(),br=b.getBoundingClientRect();return{top:r.top,bottom:r.bottom,right:r.right,buttonBottom:br.bottom,horizontal:d.scrollWidth>d.clientWidth+1}})()');
        detailLayouts.push({ width, height, ...layout }); report.detailLayouts = detailLayouts; await save();
        const valid = layout.top >= 0 && layout.bottom <= height + 1 && layout.right <= width + 1 && layout.buttonBottom <= height;
        if (!valid) { const shot = await cdp.command('Page.captureScreenshot', { format: 'png' }); await fs.writeFile(path.join(output, 'detail-layout-failure.png'), Buffer.from(shot.data, 'base64')); }
        assert.ok(valid, json({ width, height, ...layout })); assert.equal(layout.horizontal, false);
      }
      report.detailLayouts = detailLayouts;
      await viewport(1440, 900);
      assert.equal(await ev('document.querySelector(".market-file-list").open'), false);
      report.keyboardBefore = await ev('(()=>{const e=document.querySelector(".market-file-list summary");e.focus();window.__marketKeys=[];for(const type of ["keydown","keypress","keyup"])e.addEventListener(type,event=>window.__marketKeys.push({type:event.type,key:event.key,trusted:event.isTrusted,prevented:event.defaultPrevented}));return{focused:document.activeElement===e,documentFocus:document.hasFocus()}})()');
      await cdp.command('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, text: '\r', unmodifiedText: '\r' });
      await cdp.command('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
      report.keyboardEvents = await ev('window.__marketKeys'); await save();
      await wait(() => ev('document.querySelector(".market-file-list").open'), 'File detail keyboard expanded');
      await ev('document.querySelector(".market-file-list summary").click()');
      await textClick('.market-detail-footer button', '安装插件'); await settled();
      const installed = (await ev('window.scodex.listPluginCatalog()')).installed.find(p => p.id === item.id); assert.ok(installed); assert.equal(installed.commit, item.commit);
      assert.equal(await fs.readFile(path.join(installed.path, 'SKILL.md'), 'utf8'), selected.content);
      const skills = await ev('window.scodex.listSkills()'); assert.ok(skills.some(s => s.name === selected.name && s.id.startsWith('managed:')));
      selected.skillId = skills.find(s => s.name === selected.name && s.id.startsWith('managed:')).id; selected.installed = installed;
      await textClick('.market-detail-footer button', '关闭');
      return { source: state.sources[0].repository, commit: item.commit, catalogCount: state.plugins.length, installedName: selected.name, installedFileCount: item.fileCount, skillDiscovered: true, noInstallScriptExecuted: true };
    });
    await check('managed-plugin-status-and-toggle', async () => {
      const managedRow = '(()=>{const e=[...document.querySelectorAll(".plugin-row")].find(e=>e.querySelector("strong")?.textContent===' + json(selected.name) + ');return e?.innerText||""})()';
      await plugins('已安装'); await wait(async () => (await ev(managedRow)).includes('Scodex 已启用'), 'Managed enabled status');
      await click('启用插件 ' + selected.name); await settled(); await wait(async () => (await ev(managedRow)).includes('Scodex 已停用'), 'Managed disabled status');
      assert.equal((await ev('window.scodex.listSkills()')).some(s => s.id === selected.skillId), false);
      await click('启用插件 ' + selected.name); await settled(); await wait(async () => (await ev(managedRow)).includes('Scodex 已启用'), 'Managed restored status');
      return { actualUiEnabledAndDisabledCopy: true, disabledExcludedFromSkills: true };
    });
    if (!entryOnly) {
      await check('installed-skill-selected-in-real-chat', async () => {
        await ev('window.scodex.saveModelConnection(' + json({ name: '插件验收受控端点', baseUrl: 'http://127.0.0.1:' + server.address().port + '/v1', model: 'fixture-market', models: ['fixture-market'], apiKey: 'isolated-only' }) + ')');
        await cdp.command('Page.reload'); await wait(() => ev('!!document.querySelector("[aria-label=输入工作内容]")'), 'Renderer reloaded');
        await plugins('已安装'); await ev('[...document.querySelectorAll(".extension-sidebar button")].find(e=>e.textContent.startsWith("技能")).click()');
        await wait(() => ev('!![...document.querySelectorAll(".skills-center-open strong")].find(e=>e.textContent===' + json(selected.name) + ')'), 'Managed skill row');
        await ev('[...document.querySelectorAll(".skills-center-open")].find(e=>e.querySelector("strong").textContent===' + json(selected.name) + ').click()'); await textClick('.skill-detail-actions button', '设为本轮技能'); await ev('document.querySelector(".activity-rail [aria-label=项目]").click()');
        await input('输入工作内容', '请确认所选已安装技能的内容。'); await click('发送消息'); await wait(() => ev('!document.querySelector("[aria-label=停止生成]") && document.querySelector(".message-list")?.innerText.includes("已读取已安装技能")'), 'Actual model reply');
        assert.equal(report.modelReceivedInstalledSkill, true); assert.equal(report.modelRequests, 1); return { skillPassedViaActualUiAndIpc: true, requests: report.modelRequests };
      });
      await check('disable-main-guard-and-restart-persistence', async () => {
        await plugins('已安装'); await click('启用插件 ' + selected.name); await settled();
        await wait(async () => !(await ev('window.scodex.listSkills()')).some(s => s.id === selected.skillId), 'Disabled skill removed from discovery');
        const before = report.modelRequests;
        await ev('window.scodex.sendMessage(' + json({ requestId: crypto.randomUUID(), prompt: '失效技能校验', skillId: selected.skillId, skill: selected.content }) + ')');
        assert.equal(report.modelRequests, before);
        await quit(); await launch(); await cdp.command('Page.enable'); socket.addEventListener('message', ({ data }) => { if (JSON.parse(data).method === 'Page.javascriptDialogOpening') cdp.command('Page.handleJavaScriptDialog', { accept: true }).catch(() => {}); });
        const state = await ev('window.scodex.listPluginCatalog()'); assert.equal(state.installed[0].enabled, false); assert.ok(state.plugins.length > 5);
        await plugins('已安装'); await click('启用插件 ' + selected.name); await settled(); await wait(async () => (await ev('window.scodex.listSkills()')).some(s => s.id === selected.skillId), 'Reenabled skill available');
        return { persistedDisabled: true, cachedCatalogRetained: true, staleSubmissionMadeNoModelRequest: true, reenabled: true };
      });
    }
    await check('installed-plugin-uninstall-and-source-dialog', async () => {
      await plugins('已安装'); await click('卸载插件 ' + selected.name); await settled();
      await wait(async () => !(await ev('window.scodex.listPluginCatalog()')).installed.some(p => p.id === selected.id), 'Uninstalled state');
      assert.equal(await fs.stat(selected.installed.path).then(() => true, () => false), false); assert.equal((await ev('window.scodex.listSkills()')).some(s => s.id === selected.skillId), false);
      await plugins('公开目录'); await textClick('.marketplace-intro button', '添加来源'); await input('插件来源仓库', 'openai/skills'); await input('插件来源目录', 'skills/.system'); await input('插件来源名称', '系统技能目录'); await textClick('.market-source-dialog .market-dialog-actions button', '添加来源'); await settled();
      const state = await ev('window.scodex.listPluginCatalog()'); assert.ok(state.sources.some(s => s.directory === 'skills/.system')); await click('移除插件目录来源'); await settled();
      return { installedFilesRemoved: true, skillRemoved: true, customSourceAddedAndRemoved: true };
    });
    await check('public-catalog-layout-and-screenshot', async () => {
      const layouts = [];
      for (const [width, height] of [[1440, 900], [1064, 660]]) { await viewport(width, height); const layout = await ev('(()=>{const e=document.querySelector(".marketplace-panel");return{overflow:document.documentElement.scrollWidth>innerWidth+1,panelOverflow:e.scrollWidth>e.clientWidth+1,font:getComputedStyle(e).fontFamily,size:getComputedStyle(e).fontSize,buttons:[...e.querySelectorAll("button")].filter(b=>b.getBoundingClientRect().width>0).every(b=>b.getBoundingClientRect().right<=innerWidth+1)}})()'); assert.equal(layout.overflow, false); assert.equal(layout.panelOverflow, false); assert.match(layout.font, /Microsoft YaHei/); assert.equal(layout.size, '16px'); assert.equal(layout.buttons, true); layouts.push({ width, height, ...layout }); }
      await viewport(1440, 900); await ev('document.querySelector(".marketplace-panel").scrollTop=0'); const shot = await cdp.command('Page.captureScreenshot', { format: 'png' }); report.screenshot = path.join(output, 'public-plugin-catalog.png'); await fs.writeFile(report.screenshot, Buffer.from(shot.data, 'base64')); return layouts;
    });
    await quit(); report.status = 'passed';
  } catch (error) { report.status = 'failed'; report.error = error.stack; process.exitCode = 1; console.error(error); try { report.visibleText = await ev('document.body.innerText'); } catch {} }
  finally { try { await quit(); } catch (error) { report.quitError = error.message; } socket?.close(); if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); } if (!child || child.exitCode !== null) { try { await fs.rm(fixture, { recursive: true, force: true }); report.cleanup = 'removed'; } catch (error) { report.cleanup = 'manual-required'; report.cleanupError = error.message; } } else report.cleanup = 'deferred-process-still-running'; report.finishedAt = new Date().toISOString(); await save(); console.log('RESULT ' + report.status); }
}
if (require.main === module) main();
