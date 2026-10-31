// Real relay + actual portable EXE. Uses Scodex's existing DPAPI credential
// through the application; never prints, copies or embeds the credential.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { spawn, execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { connect, wait, freePort } = require('./agent-workflow-ui.cjs');
const execFileAsync = promisify(execFile);
const root = path.resolve(__dirname, '..'); const output = path.join(root, 'release', 'agent-workflow-20261024');
const executable = path.join(output, 'Scodex-Workbench-1.1.0-x64.exe');
const temporary = path.join(os.tmpdir(), 'scodex-real-relay-' + crypto.randomUUID()); const profile = path.join(temporary, 'profile'); const workspace = path.join(temporary, 'project');
const report = { status: 'running', executable, version: '1.1.0', relay: 'https://catbee.online', checks: [], scope: 'Read, exact edit and readback of one disposable UTF8 text file. No commands or external publication.' };
let child, socket, cdp;
const json = JSON.stringify;
async function main() {
  try {
    await fs.mkdir(path.join(workspace, '.scodex'), { recursive: true }); await fs.mkdir(profile);
    await fs.writeFile(path.join(workspace, '.scodex', 'codex-settings.json'), json({ sandboxMode: 'danger-full-access', approvalPolicy: 'never', networkAccess: true, networkDomains: ['catbee.online'], allowLocalBinding: false, availableReasoningEfforts: ['low'], defaultReasoningEffort: 'low', workspaceDependencies: false }));
    await fs.writeFile(path.join(workspace, 'relay-input.txt'), '状态：待验收\n');
    await fs.writeFile(path.join(profile, 'settings.json'), json({ workspaceRoot: workspace, preferences: { trayEnabled: false, browserPanelOpen: false } }));
    const port = await freePort();
    child = spawn(executable, ['--remote-debugging-port=' + port, '--user-data-dir=' + profile, '--disable-gpu'], { cwd: output, windowsHide: true, stdio: ['ignore', 'ignore', 'ignore'], env: { ...process.env, SCODEX_HOME: path.resolve(root, '..'), SCODEX_REFERENCE_HOME: path.join(temporary, 'reference'), SCODEX_REFERENCE_AGENTS_HOME: path.join(temporary, 'agents') } });
    const target = await wait(async () => (await fetch(`http://127.0.0.1:${port}/json/list`).then((r) => r.json())).find((t) => t.type === 'page' && t.url.startsWith('file:')), 'Real relay EXE startup', 40000);
    socket = new WebSocket(target.webSocketDebuggerUrl); await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); }); cdp = connect(socket);
    await wait(() => cdp.evaluate('Boolean(document.querySelector("[aria-label=执行任务]"))'), 'Real renderer ready');
    const state = await cdp.evaluate('window.scodex.getAppState().then(s=>({version:s.version,model:s.model,hasCredential:s.hasCredential,endpoint:s.endpoint}))');
    report.connection = state; report.protocol = await cdp.evaluate('window.scodex.getModelConnection().then(s=>s.toolProtocol)'); assert.equal(state.version, '1.1.0'); assert.equal(state.hasCredential, true); assert.equal(new URL(state.endpoint).hostname, 'catbee.online');
    if (process.env.SCODEX_RELAY_DIAGNOSE === 'read') {
      report.scope='One read-only tool request in the actual EXE; no writes or commands';
      report.events=await cdp.evaluate(`(async()=>{const id=crypto.randomUUID(),events=[];const off=window.scodex.onChatEvent(e=>{if(e.requestId===id)events.push(e)});try{await window.scodex.sendMessage({requestId:id,prompt:'请使用read_file只读取relay-input.txt，完成后报告其中状态。不得运行命令或写入文件。',executionEnabled:true,mode:'plan',reasoningEffort:'low'});return events}finally{off()}})()`);
      report.status=report.events.some(e=>e.type==='operation'&&e.operation?.name==='read_file'&&e.operation.status==='succeeded')&&report.events.some(e=>e.type==='complete')?'passed':'blocked';return;
    }
    if (process.env.SCODEX_RELAY_DIAGNOSE === '1') {
      report.scope='Two minimal dialogue requests from the actual EXE; only reasoning effort differs; no files or tools sent';
      report.probes=[];
      for (const effort of [null,'low']) {
        const events=await cdp.evaluate(`(async()=>{const id=crypto.randomUUID(),events=[];const off=window.scodex.onChatEvent(e=>{if(e.requestId===id)events.push(e)});try{await window.scodex.sendMessage({requestId:id,prompt:'仅回复OK',executionEnabled:false,${effort ? 'reasoningEffort:'+json(effort) : ''}});return events}finally{off()}})()`);
        report.probes.push({effort,events:events.filter(e=>['complete','error','cancelled'].includes(e.type)).map(e=>({type:e.type,text:e.text,message:e.message}))});
      }
      report.status=report.probes.every(p=>p.events.some(e=>e.type==='complete'))?'passed':'blocked'; return;
    }
    await cdp.evaluate('document.querySelector("[aria-label=执行任务]").click()');
    const prompt = '这是 Scodex 的工具集成验收，当前项目是隔离临时目录。请使用 read_file 读取 relay-input.txt，再使用 edit_file 将唯一的“待验收”替换为“Grok工具验收通过”，最后再次 read_file 核对落盘结果。不要调用 run_command，不要访问其他文件。必须用真实工具完成，简短报告结果。';
    await cdp.evaluate(`(()=>{const e=document.querySelector('[aria-label=输入工作内容]');e.focus();Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(e,${json(prompt)});e.dispatchEvent(new Event('input',{bubbles:true}));})()`);
    await wait(() => cdp.evaluate('!document.querySelector("[aria-label=发送消息]").disabled'), 'Real send ready');
    await cdp.evaluate('document.querySelector("[aria-label=发送消息]").click()');
    await wait(() => cdp.evaluate('Boolean(document.querySelector(".assistant-message"))'), 'Real task submitted');
    await wait(() => cdp.evaluate('!document.querySelector("[aria-label=停止生成]")'), 'Real model task finish', 180000);
    const text = await cdp.evaluate('document.querySelector(".assistant-message").innerText'); const content = await fs.readFile(path.join(workspace, 'relay-input.txt'), 'utf8');
    report.actualText = text.slice(-8000); report.actualFile = content;
    if (!content.includes('Grok工具验收通过')) { report.status = 'blocked'; report.reason = text.slice(-1500) || 'Real model did not perform the edit.'; }
    else {
      const state = await cdp.evaluate('window.scodex.getAppState()'); const operations = state.library.conversations.find((c) => c.id === state.library.activeId).messages.at(-1).operations || [];
      assert.ok(operations.some((op) => op.name === 'edit_file' && op.status === 'succeeded'));
      assert.ok(operations.filter((op) => op.name === 'read_file' && op.status === 'succeeded').length >= 2);
      assert.equal(operations.some((op) => op.name === 'run_command'), false);
      report.checks.push({ name: 'Actual Grok reads, edits and re-reads the disposable file through the EXE', status: 'passed', operations: operations.map((op) => ({ name: op.name, status: op.status })) }); report.status = 'passed';
    }
  } catch (error) { report.status = 'blocked'; report.reason = String(error.message).slice(0, 1500); }
  finally {
    try { if (socket?.readyState === 1) { await cdp.evaluate('(async()=>{const s=await window.scodex.getAppState();for(const c of s.library.conversations)for(const m of c.messages)if(m.role==="assistant")await window.scodex.cancelMessage(m.id);await window.scodex.quitApp()})()'); } } catch {}
    try {
      const script = "$needle='" + profile.replaceAll("'", "''") + "';Get-CimInstance Win32_Process -Filter \"Name='Scodex工作台.exe'\" | Where-Object {$_.CommandLine -and $_.CommandLine.Contains($needle) -and $_.CommandLine -notmatch '--type='} | Select-Object -ExpandProperty ProcessId";
      const result = await execFileAsync('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', script], { windowsHide: true, timeout: 5000 });
      for (const pid of result.stdout.trim().split(/\s+/).filter((p) => /^\d+$/.test(p))) await execFileAsync('taskkill.exe', ['/pid', pid, '/T', '/F'], { windowsHide: true, timeout: 8000 });
    } catch (error) { report.cleanupError = error.message; }
    socket?.close(); if (child?.exitCode === null) child.kill(); report.finishedAt = new Date().toISOString(); report.fixtureDirectory = temporary;
    report.executableSha256 = crypto.createHash('sha256').update(await fs.readFile(executable)).digest('hex');
    await fs.writeFile(path.join(output, process.env.SCODEX_RELAY_DIAGNOSE === 'read' ? 'real-relay-read-diagnostic.json' : process.env.SCODEX_RELAY_DIAGNOSE === '1' ? 'real-relay-diagnostic.json' : 'real-relay-verification.json'), json(report));
    console.log(json({ status: report.status, version: report.version, model: report.connection?.model, reason: report.reason, checks: report.checks.length }));
  }
}
main();
