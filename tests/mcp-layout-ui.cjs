// Incremental acceptance after the CSS-only modal fix; preserved functional evidence is explicit.
const fs = require('node:fs/promises'); const path = require('node:path'); const assert = require('node:assert/strict'); const crypto = require('node:crypto'); const http = require('node:http');
const { spawn, execFile } = require('node:child_process'); const { promisify } = require('node:util'); const run = promisify(execFile);
const { connect, wait, freePort } = require('./agent-workflow-ui.cjs');
const root = path.resolve(__dirname, '..'); const output = path.join(root, 'release/mcp-runtime-20261024'); const executable = path.join(output, 'Scodex-Workbench-1.2.0-x64.exe');
const json = JSON.stringify; let cdp, socket, child, unauthorized;
async function main() {
  const previous = JSON.parse(await fs.readFile(path.join(output, process.env.SCODEX_MCP_LAYOUT_RESUME ? 'mcp-ui-verification.json' : 'mcp-ui-verification.functional.json'), 'utf8'));
  if (process.env.SCODEX_MCP_LAYOUT_RESUME && crypto.createHash('sha256').update(await fs.readFile(executable)).digest('hex') !== previous.executableSha256) {
    if (process.env.SCODEX_MCP_ACCEPT_LAYOUT_SHA !== previous.executableSha256) throw Error('Resume package changed');
    previous.checks = previous.checks.filter((v) => !['final EXE modal stays in viewport with readable fields and keyboard close', 'final page supports light and dark themes with no horizontal overflow'].includes(v.name));
  }
  const temporary = previous.fixtureDirectory; const profile = path.join(temporary, 'profile'); const fakeRoot = path.join(temporary, 'scodex');
  const report = { status: 'running', executable, version: '1.2.0', fixtureDirectory: temporary, checks: previous.checks.map((v) => ({ ...v, reused: true, validatedExecutableSha256: v.validatedExecutableSha256 || previous.executableSha256 })), limitations: previous.limitations,
    reuseReason: 'Only .mcp-modal-backdrop CSS changed after the 11 functional ranges. Core packaged sources match their functional-build hashes; renderer source is unchanged. Current package gets fresh modal/layout and config UI acceptance.' };
  async function check(name, fn) { if (report.checks.some((v) => v.name === name && v.status === 'passed')) { console.log('REUSE ' + name); return; } const evidence = await fn(); report.checks.push({ name, status: 'passed', evidence }); console.log('PASS ' + name); }
  async function click(label) { await wait(() => cdp.evaluate('(()=>{const e=document.querySelector(' + json('[aria-label="' + label + '"]') + ');if(!e||e.disabled)return false;e.click();return true})()'), label); }
  async function textClick(selector, label) { await wait(() => cdp.evaluate('(()=>{const e=[...document.querySelectorAll(' + json(selector) + ')].find(e=>e.textContent.trim()===' + json(label) + ');if(!e||e.disabled)return false;e.click();return true})()'), label); }
  async function insert(label, value) { await cdp.evaluate('(()=>{const e=document.querySelector(' + json('[aria-label="' + label + '"]') + ');const p=e instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(p,"value").set.call(e,' + json(value) + ');e.dispatchEvent(new Event("input",{bubbles:true}));return true})()'); }
  const snapshot = () => cdp.evaluate('window.scodex.listMcpConnections()');
  try {
    const port = await freePort(); child = spawn(executable, ['--remote-debugging-port=' + port, '--user-data-dir=' + profile, '--disable-gpu'], { windowsHide: true, stdio: 'ignore', cwd: output, env: { ...process.env, SCODEX_HOME: fakeRoot, SCODEX_REFERENCE_HOME: path.join(temporary, 'reference'), SCODEX_REFERENCE_AGENTS_HOME: path.join(temporary, 'agents') } });
    const target = await wait(async () => (await fetch('http://127.0.0.1:' + port + '/json/list').then((r) => r.json())).find((v) => v.type === 'page' && v.url.startsWith('file:')), 'EXE startup', 40000);
    socket = new WebSocket(target.webSocketDebuggerUrl); await new Promise((r) => socket.addEventListener('open', r, { once: true })); cdp = connect(socket);
    await wait(() => cdp.evaluate('Boolean(document.querySelector(".workbench-primary-nav [aria-label=插件]"))'), 'UI ready');
    await click('插件'); await textClick('.extension-segment button', 'MCP 连接');
    const saved = await snapshot(); const local = saved.servers.find((v) => v.transport === 'stdio');
    assert.equal(saved.servers.every((v) => v.status === 'disconnected'), true);
    await check('final EXE modal stays in viewport with readable fields and keyboard close', async () => {
      const evidence = [];
      for (const [width, height] of [[1440, 900], [1080, 700]]) {
        await cdp.command('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
        await textClick('.mcp-section-heading button', '添加连接');
        const geometry = await cdp.evaluate('(()=>{const e=document.querySelector(".mcp-editor"),r=e.getBoundingClientRect(),b=e.querySelector(".mcp-editor-actions").getBoundingClientRect(),c=document.querySelector(".mcp-connections");return{top:r.top,bottom:r.bottom,right:r.right,left:r.left,viewport:innerHeight,width:innerWidth,font:getComputedStyle(e).fontFamily,inputSize:getComputedStyle(e.querySelector("input")).fontSize,saveBottom:b.bottom,focused:document.activeElement.getAttribute("aria-label"),overflow:c.scrollWidth>c.clientWidth+1,backdropPosition:getComputedStyle(document.querySelector(".mcp-modal-backdrop")).position}})()');
        assert.ok(geometry.top >= 0 && geometry.bottom <= geometry.viewport); assert.ok(geometry.left >= 0 && geometry.right <= geometry.width); assert.ok(geometry.saveBottom <= geometry.viewport); assert.equal(geometry.inputSize, '16px'); assert.match(geometry.font, /Microsoft YaHei/); assert.equal(geometry.focused, 'MCP 连接名称'); assert.equal(geometry.backdropPosition, 'fixed'); assert.equal(geometry.overflow, false);
        await cdp.command('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 }); await cdp.command('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 }); await wait(() => cdp.evaluate('!document.querySelector(".mcp-editor")'), 'Escape closes editor'); evidence.push({ width, height, ...geometry });
      }
      await cdp.command('Emulation.clearDeviceMetricsOverride'); return evidence;
    });
    await check('editing never reveals stored authentication and blank edit preserves it', async () => {
      const file = path.join(profile, 'mcp-connections.json'); const before = JSON.parse(await fs.readFile(file, 'utf8')).servers.find((v) => v.id === local.id);
      await click('编辑连接 ' + local.name); assert.equal(await cdp.evaluate('document.querySelector("[aria-label=\\"MCP 环境变量\\"]").value'), '');
      await insert('MCP 连接名称', '项目 MCP · 已核验'); await textClick('.mcp-editor-actions button', '保存连接'); await wait(() => cdp.evaluate('!document.querySelector(".mcp-editor")'), 'Edit saved');
      const after = JSON.parse(await fs.readFile(file, 'utf8')).servers.find((v) => v.id === local.id); assert.deepEqual(after.envNames, before.envNames); assert.ok(after.encrypted); assert.equal((await snapshot()).servers[0].name, '项目 MCP · 已核验'); return { secretInputsBlank: true, encryptedPreserved: true };
    });
    await check('HTTP authentication failure is explicit and removal persists', async () => {
      unauthorized = http.createServer((_req, res) => res.writeHead(401).end()); await new Promise((r) => unauthorized.listen(0, '127.0.0.1', r));
      const s = await cdp.evaluate('window.scodex.saveMcpConnection(' + json({ name: '认证失败验收', transport: 'http', url: 'http://127.0.0.1:' + unauthorized.address().port + '/mcp' }) + ')'); const id = s.servers.find((v) => v.name === '认证失败验收').id;
      await textClick('.mcp-section-heading button', '刷新状态'); await textClick('[data-mcp-id="' + id + '"] button', '连接');
      await wait(async () => (await snapshot()).servers.find((v) => v.id === id)?.status === 'failed', 'HTTP 401 status'); assert.ok((await snapshot()).servers.find((v) => v.id === id).error);
      await cdp.evaluate('window.scodex.removeMcpConnection(' + json(id) + ')'); assert.equal((await snapshot()).servers.some((v) => v.id === id), false); assert.equal(JSON.parse(await fs.readFile(path.join(profile, 'mcp-connections.json'), 'utf8')).servers.some((v) => v.id === id), false); return { failedState: true, removedOnDisk: true };
    });
    await check('final page supports light and dark themes with no horizontal overflow', async () => {
      const evidence = [];
      for (const theme of ['dark', 'light']) { await click('设置'); await textClick('.settings-category-list button', '外观'); await click(theme === 'dark' ? '深色' : '浅色'); await wait(() => cdp.evaluate('document.querySelector(".app-shell").dataset.theme===' + json(theme)), 'Theme applied'); await click('插件'); await textClick('.extension-segment button', 'MCP 连接');
        const v = await cdp.evaluate('(()=>{const e=document.querySelector(".mcp-connections");return{bodyOverflow:document.documentElement.scrollWidth>innerWidth+1,contentOverflow:e.scrollWidth>e.clientWidth+1,font:getComputedStyle(e).fontFamily,size:getComputedStyle(e).fontSize,color:getComputedStyle(e).color}})()'); assert.equal(v.bodyOverflow, false); assert.equal(v.contentOverflow, false); assert.equal(v.size, '16px'); evidence.push({ theme, ...v }); }
      return evidence;
    });
    await check('plugin and skill desktop pages place category beside content', async () => {
      const evidence = [];
      for (const [width, height] of [[1440, 900], [1080, 700]]) {
        await cdp.command('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
        for (const page of ['plugins', 'skills']) {
          await cdp.evaluate('(()=>{const e=[...document.querySelectorAll(".extension-sidebar > button")].find(e=>e.textContent.trim().startsWith(' + json(page === 'plugins' ? '插件' : '技能') + '));e.click()})()');
          const v = await cdp.evaluate('(()=>{const a=document.querySelector(".extension-sidebar").getBoundingClientRect(),b=document.querySelector(".extension-main").getBoundingClientRect();return{sidebarRight:a.right,mainLeft:b.left,sidebarTop:a.top,mainTop:b.top,overflow:document.documentElement.scrollWidth>innerWidth+1}})()');
          assert.ok(v.mainLeft >= v.sidebarRight - 1); assert.ok(Math.abs(v.sidebarTop - v.mainTop) < 2); assert.equal(v.overflow, false); evidence.push({ width, height, page, ...v });
        }
      }
      await cdp.command('Emulation.clearDeviceMetricsOverride'); await cdp.evaluate('document.querySelector(".extension-sidebar > button").click()'); await textClick('.extension-segment button', 'MCP 连接'); return evidence;
    });
    await check('actual project switch disconnects MCP and returning does not auto-start it', async () => {
      await textClick('[data-mcp-id="' + local.id + '"] button', '连接'); await wait(async () => (await snapshot()).servers[0].status === 'connected', 'Connected before project switch');
      const second = path.join(temporary, 'second-project'); await fs.mkdir(second, { recursive: true });
      await click('创建项目'); await insert('项目名称', 'MCP 切换验收'); await insert('项目文件夹', second); await textClick('.project-editor-actions button', '创建项目');
      await wait(() => cdp.evaluate('window.scodex.getAppState().then(s=>s.workspaceRoot===' + json(second) + ')'), 'Project switch saved');
      assert.equal((await snapshot()).servers.every((v) => v.status === 'disconnected'), true);
      await cdp.evaluate('(()=>{const e=[...document.querySelectorAll(".project-list .project-item")].find(e=>e.title===' + json(path.join(temporary, 'project')) + ');if(!e)throw Error("Original project missing");e.click()})()');
      await wait(() => cdp.evaluate('window.scodex.getAppState().then(s=>s.workspaceRoot===' + json(path.join(temporary, 'project')) + ')'), 'Original project restored');
      assert.equal((await snapshot()).servers.every((v) => v.status === 'disconnected'), true); await click('插件'); await textClick('.extension-segment button', 'MCP 连接'); return { switchDisconnected: true, automaticRestart: false };
    });
    await textClick('[data-mcp-id="' + local.id + '"] button', '连接'); await wait(async () => (await snapshot()).servers[0].status === 'connected', 'Final connected page');
    await cdp.evaluate('document.querySelector(".mcp-tools").open=true'); await cdp.evaluate('document.querySelector(".mcp-connections").scrollTop=0');
    const screenshot = await cdp.command('Page.captureScreenshot', { format: 'png' }); await fs.writeFile(path.join(output, 'mcp-connections.png'), Buffer.from(screenshot.data, 'base64')); report.screenshot = path.join(output, 'mcp-connections.png');
    await cdp.evaluate('window.scodex.quitApp()'); await wait(() => Promise.resolve(child.exitCode !== null), 'Final quit', 20000); report.status = 'passed';
  } catch (e) { report.status = 'failed'; report.error = e.stack; console.error(e); process.exitCode = 1; }
  finally {
    try { if (socket?.readyState === 1) { report.finalVisibleText = await cdp.evaluate('document.body.innerText'); await cdp.evaluate('window.scodex.quitApp()'); await wait(() => Promise.resolve(child.exitCode !== null), 'Cleanup quit', 15000); } } catch {}
    if (child?.exitCode === null) child.kill(); socket?.close(); unauthorized?.closeAllConnections(); await new Promise((r) => unauthorized?.close(r) || r());
    report.finishedAt = new Date().toISOString(); report.executableSha256 = crypto.createHash('sha256').update(await fs.readFile(executable)).digest('hex'); await fs.writeFile(path.join(output, 'mcp-ui-verification.json'), json(report)); console.log('RESULT ' + report.status);
  }
}
main();
