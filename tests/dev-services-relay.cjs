// Uses the real EXE and relay. The test key arrives only on stdin.
const fs = require('node:fs/promises'), path = require('node:path'), crypto = require('node:crypto');
const assert = require('node:assert/strict'), { spawn, execFile } = require('node:child_process');
const { promisify } = require('node:util'), { connect, wait, freePort } = require('./agent-workflow-ui.cjs');
const runFile = promisify(execFile), json = JSON.stringify;
const root = path.resolve(__dirname, '..'), output = path.join(root, 'release/dev-services-20261025');
const executable = path.join(output, 'Scodex-Workbench-1.4.0-x64.exe');
const temporary = process.argv[2];
if (!temporary || !path.basename(temporary).startsWith('scodex-dev-services-ui-')) throw Error('Existing isolated service fixture required');
const profile = path.join(temporary, 'profile'), fakeRoot = path.join(temporary, 'scodex'), project = path.join(temporary, 'project');
const token = 'S' + crypto.randomInt(10000, 99999), sockets = new Set();
const report = { status: 'running', version: '1.4.0', executable, model: 'deepseek-v4.1-flash', relay: 'https://catbee.online', checks: [], fixtureDirectory: temporary, limitations: ['Actual EXE, real relay and service process; CDP drives the renderer.', 'Controlled local project only. Does not prove Grok availability or arbitrary service compatibility.'] };
let secret = '', child, socket, cdp, debugPort, servicePort, previewUrl, expectedCommand;
const state = () => cdp.evaluate('window.scodex.listDevServices()');
const active = value => value.services.filter(s => ['starting', 'running', 'stopping'].includes(s.status));
const scrub = value => String(value).split(secret || '\0').join('[hidden]').replace(/sk-[A-Za-z0-9_-]{16,}/g, '[hidden]');
async function save() { await fs.writeFile(path.join(output, 'live-services-verification.json'), scrub(json(report, null, 2)) + '\n'); }
async function click(label) { return wait(() => cdp.evaluate('(()=>{const e=document.querySelector(' + json('[aria-label="' + label + '"]') + ');if(!e||e.disabled)return false;e.click();return true})()'), 'Button ' + label); }
async function textClick(selector, text) { return wait(() => cdp.evaluate('(()=>{const e=[...document.querySelectorAll(' + json(selector) + ')].find(e=>e.textContent.trim()===' + json(text) + ');if(!e||e.disabled)return false;e.click();return true})()'), 'Text ' + text); }
async function insert(value) { return cdp.evaluate('(()=>{const e=document.querySelector("[aria-label=输入工作内容]");Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,"value").set.call(e,' + json(value) + ');e.dispatchEvent(new Event("input",{bubbles:true}));return true})()'); }
async function launch() {
  debugPort = await freePort();
  child = spawn(executable, ['--remote-debugging-port=' + debugPort, '--user-data-dir=' + profile, '--disable-gpu'], { windowsHide: true, cwd: output, stdio: 'ignore', env: { ...process.env, SCODEX_HOME: fakeRoot, SCODEX_REFERENCE_HOME: path.join(temporary, 'reference'), SCODEX_REFERENCE_AGENTS_HOME: path.join(temporary, 'agents') } });
  const target = await wait(async () => (await fetch('http://127.0.0.1:' + debugPort + '/json/list').then(r => r.json())).find(t => t.type === 'page' && t.url.startsWith('file:')), 'Relay EXE startup', 45000);
  socket = new WebSocket(target.webSocketDebuggerUrl); sockets.add(socket); await new Promise(r => socket.addEventListener('open', r, { once: true })); cdp = connect(socket);
  await wait(() => cdp.evaluate('Boolean(document.querySelector("[aria-label=输入工作内容]"))'), 'Renderer');
}
async function runTask() {
  await cdp.evaluate('document.querySelector(".activity-rail [aria-label=项目]").click()'); await click('新聊天');
  await wait(() => cdp.evaluate('!document.querySelector(".message-list")'), 'New chat'); await click('执行任务');
  await insert('这是隔离的开发服务验收。请只调用 service_start、service_logs、service_list、service_stop，不调用文件、命令或浏览器工具。按顺序实际执行：1. service_start 名称“真实中转服务”，command 必须原样为 ' + json(expectedCommand) + '，cwd 为 .，preview_url 为 ' + previewUrl + '。2. 用返回的 id 调用 service_logs 读取日志。3. service_list 核对服务就绪。4. 用同一 id 调用 service_stop 停止。启动和停止等待逐次审批。最后用中文报告真实状态，并引用日志里的识别码。不要只给建议或编造结果。');
  await click('发送消息'); await wait(() => cdp.evaluate('Boolean(document.querySelector("[aria-label=停止生成]"))'), 'Generation started');
  const approvals = [], until = Date.now() + 180000;
  while (Date.now() < until) {
    const phase = await wait(() => cdp.evaluate('document.querySelector(".agent-approval")?"approval":!document.querySelector("[aria-label=停止生成]")?"done":false'), 'Model / approval', 55000);
    if (phase === 'done') {
      const last = await wait(() => cdp.evaluate('window.scodex.getAppState().then(s=>{const m=s.library.conversations.find(c=>c.id===s.library.activeId)?.messages.at(-1);return m&&m.role==="assistant"&&(m.content||m.error)&&m})'), 'Final persisted history', 15000);
      return { text: last.content || '', error: last.error || '', operations: (last.operations || []).map(o => ({ name: o.name, status: o.status, detail: o.detail, output: o.output?.slice(-1600) })), approvals, expectedLogCode: token };
    }
    const approval = await cdp.evaluate('({title:document.querySelector(".agent-approval strong")?.innerText||"",params:document.querySelector(".agent-approval pre")?.textContent})');
    const params = JSON.parse(approval.params); assert.ok(approvals.length < 3, 'Unexpected repeat approval');
    if (params.id) {
      const service = (await state()).services.find(s => s.id === params.id);
      assert.ok(service && service.command === expectedCommand && service.previewUrl === previewUrl + '/');
      assert.equal(service.health, 'ready');
      assert.match(await fetch(service.previewUrl).then(r => r.text()), /真实中转开发服务/);
      report.httpObservedBeforeStop = true;
    } else {
      assert.equal(params.command, expectedCommand); assert.equal(params.cwd, '.'); assert.equal(params.previewUrl, previewUrl + '/');
    }
    approvals.push({ action: params.id ? 'stop' : 'start', serviceId: params.id || '', command: params.command, previewUrl: params.previewUrl });
    await textClick('.agent-approval-actions button', '允许本次服务操作');
  }
  throw Error('Live service task exceeded 180 seconds');
}
async function capturePanel() {
  const service = await cdp.evaluate('window.scodex.startDevService(' + json({ name: '真实中转预览', command: expectedCommand, cwd: '.', previewUrl }) + ',' + json(project) + ')');
  await wait(async () => (await state()).services.some(s => s.id === service.id && s.health === 'ready'), 'Screenshot service ready');
  await cdp.evaluate('window.scodex.browserAction({type:"new"})'); await textClick('.browser-tool-list button', '运行与预览');
  await wait(() => cdp.evaluate('document.querySelector(".dev-service-log")?.innerText.includes(' + json(token) + ')'), 'Visible real log');
  await cdp.evaluate('(()=>{const form=document.querySelector(".dev-service-launch");if(form.open)form.querySelector("summary").click();const panel=document.querySelector(".dev-services-panel");panel.scrollTop=0})()');
  await cdp.command('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  const shot = await cdp.command('Page.captureScreenshot', { format: 'png' }); await fs.writeFile(path.join(output, 'services-workbench.png'), Buffer.from(shot.data, 'base64'));
  report.screenshot = { file: 'services-workbench.png', viewport: '1440x900', scope: 'Actual renderer only; native web layer excluded' };
  await cdp.evaluate('window.scodex.stopDevService(' + json(service.id) + ')');
}
async function main() {
  try {
    if (process.env.SCODEX_CREDENTIAL_PIPE) {
      const pipeName = process.env.SCODEX_CREDENTIAL_PIPE;
      assert.ok(/^\\\\\.\\pipe\\scodex-service-test-[a-f0-9-]+$/.test(pipeName), 'Unexpected credential pipe');
      secret = await new Promise((resolve, reject) => {
        const server = require('node:net').createServer(socket => {
          let value = ''; socket.setEncoding('utf8');
          socket.on('data', chunk => { value += chunk; if (value.length > 8192) socket.destroy(new Error('Credential too long')); });
          socket.once('error', error => { clearTimeout(timer); server.close(); reject(error); });
          socket.once('end', () => { clearTimeout(timer); server.close(); resolve(value); });
        });
        const timer = setTimeout(() => { server.close(); reject(Error('Credential pipe timeout')); }, 45000);
        server.once('error', error => { clearTimeout(timer); reject(error); });
        server.listen({path:pipeName,readableAll:false,writableAll:false}, () => console.log('READY_CREDENTIAL_PIPE'));
      });
    } else for await (const chunk of process.stdin) secret += chunk;
    secret = secret.trim(); if (!secret.startsWith('sk-')) throw Error('Missing test key');
    report.sha256 = crypto.createHash('sha256').update(await fs.readFile(executable)).digest('hex');
    servicePort = await freePort(); previewUrl = 'http://127.0.0.1:' + servicePort;
    expectedCommand = "& '" + process.execPath.replaceAll("'", "''") + "' '.\\relay-service.cjs'";
    await fs.writeFile(path.join(project, 'relay-service.cjs'), "const http=require('node:http');console.log(" + json('中转服务就绪 ' + token) + ");http.createServer((q,r)=>{r.setHeader('Content-Type','text/html; charset=utf-8');r.end('<!doctype html><meta charset=utf-8><h1>真实中转开发服务</h1>')}).listen(" + servicePort + ",'127.0.0.1');\n");
    await launch();
    const identity = await cdp.evaluate('window.scodex.getAppState().then(s=>({version:s.version,workspaceRoot:s.workspaceRoot}))');
    assert.equal(identity.version, '1.4.0'); assert.equal(identity.workspaceRoot, project);
    await cdp.evaluate('window.scodex.saveAgentSettings({approvalPolicy:"on-request",sandboxMode:"danger-full-access",networkAccess:true,networkDomains:["*"],allowLocalBinding:true},"shared")');
    await cdp.evaluate('window.scodex.savePreferences({trayEnabled:false,closeConfirmation:"unsaved"})');
    await cdp.evaluate('window.scodex.saveModelConnection(' + json({ name: '真实中转服务隔离验收', baseUrl: 'https://catbee.online/v1', model: report.model, models: [report.model], toolProtocol: 'native', apiKey: secret }) + ')');
    await cdp.evaluate('location.reload()'); await wait(() => cdp.evaluate('Boolean(document.querySelector("[aria-label=输入工作内容]"))'), 'Relay UI reloaded');
    const result = await runTask();
    assert.equal(result.error, '');
    for (const name of ['service_start', 'service_logs', 'service_list', 'service_stop']) assert.ok(result.operations.some(o => o.name === name && o.status === 'succeeded'), 'Missing actual tool ' + name);
    assert.ok(result.operations.every(o => o.name.startsWith('service_')), 'Unexpected tool operation');
    assert.equal(result.approvals.length, 2); assert.equal(report.httpObservedBeforeStop, true); assert.ok(result.text.includes(token));
    assert.equal(active(await state()).length, 0); await assert.rejects(fetch(previewUrl));
    report.checks.push({ name: 'live-model-service-start-logs-list-stop', status: 'passed', evidence: result }); console.log('PASS live-model-service-start-logs-list-stop');
    await capturePanel(); report.status = 'passed';
  } catch (error) { report.status = 'not-verified'; report.error = scrub(error.stack); process.exitCode = 1; }
  finally {
    try {
      if (socket?.readyState === 1) {
        if (await cdp.evaluate('Boolean(document.querySelector("[aria-label=停止生成]"))')) { await click('停止生成'); await wait(() => cdp.evaluate('!document.querySelector("[aria-label=停止生成]")'), 'Stop live generation'); }
        for (const service of active(await state())) await cdp.evaluate('window.scodex.stopDevService(' + json(service.id) + ')');
        await cdp.evaluate('window.scodex.saveModelConnection(' + json({ name: '验收后受控占位', baseUrl: 'http://127.0.0.1:9/v1', model: 'controlled-services-model', models: ['controlled-services-model'], toolProtocol: 'native', apiKey: 'controlled-only' }) + ')');
        report.testCredentialReplaced = true;
        await cdp.evaluate('window.scodex.quitApp()'); await wait(() => Promise.resolve(child.exitCode !== null), 'Live EXE exit', 20000); report.actualExitCode = child.exitCode;
      }
    } catch (error) { report.cleanupError = scrub(error.message); }
    for (const ws of sockets) ws.close();
    if (child?.exitCode === null) {
      try { const needle = profile.replaceAll("'", "''"); const ps = "$needle='" + needle + "';Get-CimInstance Win32_Process -Filter \"Name='Scodex工作台.exe'\" | Where-Object {$_.CommandLine -and $_.CommandLine.Contains($needle) -and $_.CommandLine -notmatch '--type='} | Select-Object -ExpandProperty ProcessId"; const owner = Number((await runFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', ps], { windowsHide: true, timeout: 7000 })).stdout.trim()); if (owner > 0) await runFile('taskkill.exe', ['/PID', String(owner), '/T', '/F'], { windowsHide: true, timeout: 7000 }); } catch {}
      child.kill(); report.forcedCleanup = true;
    }
    report.finishedAt = new Date().toISOString(); await save(); secret = ''; console.log('RESULT ' + report.status);
  }
}
if (require.main === module) main();
