// Actual portable EXE + real XLSX/CSV, IPC, approval, history and editor.
// Only the external model is replaced by a deterministic loopback endpoint.
const assert = require('node:assert/strict'), fs = require('node:fs/promises'), path = require('node:path'), os = require('node:os'), crypto = require('node:crypto'), http = require('node:http');
const { spawn } = require('node:child_process'), ExcelJS = require('exceljs');
const { connect, wait, freePort } = require('./agent-workflow-ui.cjs');
const root = path.resolve(__dirname, '..'), output = path.join(root, 'release/spreadsheet-runtime-20261025');
const executable = path.join(output, 'Scodex-Workbench-1.3.2-x64.exe');
const temporary = process.env.SCODEX_SHEET_FIXTURE || path.join(os.tmpdir(), 'scodex-sheet-ui-' + crypto.randomUUID());
assert.ok(path.basename(temporary).startsWith('scodex-sheet-ui-'));
const profile = path.join(temporary, 'profile'), project = path.join(temporary, 'project'), fakeRoot = path.join(temporary, 'scodex');
const only = new Set((process.env.SCODEX_SHEET_ONLY || '').split(',').filter(Boolean)), json = JSON.stringify;
const reportFile = path.join(output, 'spreadsheet-ui-verification.json');
let report = { status: 'running', version: '1.3.2', executable, fixtureDirectory: temporary, checks: [], environment: { platform: os.platform(), release: os.release(), node: process.version }, limitations: ['CDP operates actual EXE renderer and file operations; only model replies are deterministic.', 'Formula persistence and recalculation flags are verified; no formula engine is provided.', 'Renderer capture is not a Windows desktop screenshot.'] };
let appChild, cdp, socket, modelServer, endpoint, debugPort, workflowId;
const fixtureErrors = [], requests = [], sockets = new Set();
const save = () => fs.writeFile(reportFile, json(report, null, 2));
const evaluate = (s) => cdp.evaluate(s);
async function check(id, fn) {
  if (only.size && !only.has(id)) return;
  const evidence = await fn(); report.checks = report.checks.filter((c) => c.id !== id);
  report.checks.push({ id, status: 'passed', sha256: report.sha256, evidence }); await save(); console.log('PASS ' + id);
}
async function click(label) { return wait(() => evaluate('(()=>{const e=document.querySelector(' + json('[aria-label="' + label + '"]') + ');if(!e||e.disabled)return false;e.click();return true})()'), label); }
async function textClick(selector, text) { return wait(() => evaluate('(()=>{const e=[...document.querySelectorAll(' + json(selector) + ')].find(e=>e.textContent.trim()===' + json(text) + ');if(!e||e.disabled)return false;e.click();return true})()'), text); }
async function insert(label, value) {
  return evaluate('(()=>{const e=document.querySelector(' + json('[aria-label="' + label + '"]') + ');if(!e)throw Error("Input missing");const p=e instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(p,"value").set.call(e,' + json(value) + ');e.dispatchEvent(new Event("input",{bubbles:true}));return true})()');
}
async function tool(id) { await click('工具命令搜索'); await wait(() => evaluate('Boolean(document.querySelector("#command-' + id + '"))'), id); await evaluate('document.querySelector("#command-' + id + '").click()'); }
async function newChat(execution = true) {
  await evaluate('document.querySelector(".activity-rail [aria-label=项目]").click()'); await click('新聊天');
  await wait(() => evaluate('!document.querySelector(".message-list")'), 'New chat');
  if (execution) await click('执行任务');
}
async function submit(id) { await insert('输入工作内容', 'SHEET_CASE:' + id); await click('发送消息'); }
async function finish() {
  await wait(() => evaluate('!document.querySelector("[aria-label=停止生成]")'), 'Response finish', 45000);
  if (fixtureErrors.length) throw Error(fixtureErrors.join('\n'));
  return evaluate('document.querySelector(".message-list")?.innerText||""');
}
async function approval(allowed = true) {
  await wait(() => evaluate('!!document.querySelector("[aria-label=表格修改审批]")'), 'Spreadsheet approval');
  return textClick('.agent-approval-actions button', allowed ? '允许本次表格修改' : '拒绝');
}
async function stored(predicate = () => true) {
  return wait(async () => { const library = await evaluate('window.scodex.getAppState().then(s=>s.library)'); const m = library.conversations.find((c) => c.id === library.activeId)?.messages.at(-1); return m?.role === 'assistant' && !m.pending && Number.isFinite(m.elapsedMs) && predicate(m) && m; }, 'Stored final state');
}
async function workbook(name) { const wb = new ExcelJS.Workbook(); await wb.xlsx.readFile(path.join(project, name)); return wb; }
async function openProjectFile(name) {
  const selector = '.file-tree-item[title=' + json(name) + ']';
  await tool('files'); await wait(() => evaluate('!!document.querySelector(' + json(selector) + ')'), 'File list');
  await evaluate('document.querySelector(' + json(selector) + ').click()'); await wait(() => evaluate('!!document.querySelector(".spreadsheet")'), 'Table editor');
}
async function saveTable() {
  await textClick('.table-view .heading-actions button', '保存');
  await wait(() => evaluate('!document.querySelector(".table-dimensions .dirty-dot")'), 'Saved table');
}
async function launch() {
  debugPort = await freePort();
  appChild = spawn(executable, ['--remote-debugging-port=' + debugPort, '--user-data-dir=' + profile, '--disable-gpu'], { windowsHide: true, cwd: output, stdio: 'ignore', env: { ...process.env, SCODEX_HOME: fakeRoot, SCODEX_REFERENCE_HOME: path.join(temporary, 'reference'), SCODEX_REFERENCE_AGENTS_HOME: path.join(temporary, 'agents') } });
  const target = await wait(async () => (await fetch('http://127.0.0.1:' + debugPort + '/json/list').then((r) => r.json())).find((t) => t.type === 'page' && t.url.startsWith('file:')), 'EXE startup', 60000);
  socket = new WebSocket(target.webSocketDebuggerUrl); sockets.add(socket);
  await new Promise((resolve) => socket.addEventListener('open', resolve, { once: true })); cdp = connect(socket);
  await cdp.command('Page.enable'); await cdp.command('Emulation.setFocusEmulationEnabled', { enabled: true });
  await wait(() => evaluate('!!document.querySelector("[aria-label=输入工作内容]")'), 'Renderer ready');
}
async function quit() {
  await evaluate('window.scodex.quitApp()'); await wait(async () => { try { await fetch('http://127.0.0.1:' + debugPort + '/json/list'); return false; } catch { return true; } }, 'Actual main endpoint closed', 25000);
  await wait(() => Promise.resolve(appChild.exitCode !== null), 'Portable launcher exit', 15000); assert.equal(appChild.exitCode, 0); socket.close();
}
function send(res, delta) {
  res.writeHead(200, { 'content-type': 'text/event-stream; charset=utf-8' });
  res.end('data: ' + json({ choices: [{ delta }] }) + '\n\ndata: ' + json({ choices: [{ delta: {}, finish_reason: delta.tool_calls ? 'tool_calls' : 'stop' }] }) + '\n\ndata: [DONE]\n\n');
}
const changes = (value) => [{ type: 'set_cells', cells: [{ address: 'A1', value }] }];
async function model(body, res) {
  const jsonProtocol = String(body.messages[0]?.content).includes('中转兼容执行通道');
  const user = body.messages.findLast((m) => m.role === 'user' && String(m.content).includes('SHEET_CASE:'));
  const id = String(user?.content).split('SHEET_CASE:')[1]?.split('\n')[0];
  const index = body.messages.indexOf(user);
  const results = jsonProtocol ? body.messages.slice(index + 1).filter((m) => m.role === 'user' && String(m.content).startsWith('本机工具实际结果')).map((m) => JSON.parse(m.content.slice(m.content.indexOf('\n') + 1))) : body.messages.slice(index + 1).filter((m) => m.role === 'tool').map((m) => JSON.parse(m.content));
  const names = (body.tools || []).map((t) => t.function.name), step = results.length;
  requests.push({ id, step, protocol: jsonProtocol ? 'json' : 'native', names });
  const call = (name, args) => jsonProtocol ? send(res, { content: json({ type: 'tool', name, arguments: args }) }) : send(res, { tool_calls: [{ index: 0, id: 'call_' + crypto.randomBytes(6).toString('hex'), type: 'function', function: { name, arguments: json(args) } }] });
  const final = (text) => send(res, { content: jsonProtocol ? json({ type: 'final', content: text }) : text });
  if (['native', 'refresh'].includes(id)) {
    if (!step) return call('spreadsheet_read', { path: '办公.xlsx', range: 'A1:D3' });
    if (step === 1) {
      assert.equal(results[0].ok, true); assert.ok(results[0].instructions.some((i) => i.content.includes('保留中文')));
      return call('spreadsheet_edit', { path: '办公.xlsx', expected_hash: results[0].hash, operations: id === 'refresh' ? [{ type: 'set_cells', cells: [{ address: 'A3', value: '后台刷新完成' }] }] : [
        { type: 'set_cells', cells: [{ address: 'B2', value: 15 }, { address: 'D2', formula: 'SUM(B2:C2)', style: { num_format: '0.00', bold: true } }, { address: 'A3', value: '实际表格修改' }] },
        { type: 'add_sheet', name: '汇总' }, { type: 'set_cells', sheet: '汇总', cells: [{ address: 'A1', value: '中文汇总' }] },
      ] });
    }
    if (step === 2) { assert.equal(results[1].ok, true); return call('spreadsheet_read', { path: '办公.xlsx', range: 'A1:D3' }); }
    assert.equal(results[2].ok, true);
    return final(id === 'native' ? '实际工作簿修改并回读完成；公式已保存，尚未计算。' : '后台刷新完成。');
  }
  if (id === 'create') {
    if (!step) return call('spreadsheet_edit', { path: '新建.xlsx', expected_hash: 'new', operations: changes('新工作簿') });
    if (step === 1) { assert.equal(results[0].ok, true); return call('spreadsheet_read', { path: '新建.xlsx', range: 'A1' }); }
    return final('已新建并读取工作簿。');
  }
  if (id === 'json-csv') {
    if (!step) return call('spreadsheet_read', { path: '数据.csv', range: 'A1:C3' });
    if (step === 1) return call('spreadsheet_edit', { path: '数据.csv', expected_hash: results[0].hash, operations: [{ type: 'set_cells', cells: [{ address: 'A2', value: '中文,\n"引号"' }, { address: 'B2', value: '=1+1' }] }] });
    if (step === 2) { assert.equal(results[1].ok, true); return call('spreadsheet_read', { path: '数据.csv', range: 'A1:C3' }); }
    assert.equal(results[2].cells.find((c) => c.address === 'B2').value, '=1+1'); return final('兼容通道 CSV 修改并回读完成。');
  }
  if (['plan', 'never'].includes(id)) {
    if (!step) { assert.ok(!names.includes('spreadsheet_edit')); return call('spreadsheet_edit', { path: '越权.csv', expected_hash: 'new', operations: changes('不该写入') }); }
    assert.equal(results[0].ok, false); return final('当前模式拒绝修改：' + results[0].error);
  }
  const files = { deny: '拒绝.csv', cancel: '取消.csv', concurrent: '并发.csv', dirty: '办公.xlsx', 'approval-dirty': '办公.xlsx', 'policy-change': '权限.csv', complex: '复杂.xlsx' };
  const file = files[id]; if (!file) return final('受控普通回复。');
  if (!step && id !== 'cancel') return call('spreadsheet_read', { path: file, range: 'A1:D3' });
  if ((!step && id === 'cancel') || step === 1) return call('spreadsheet_edit', { path: file, expected_hash: id === 'cancel' ? 'new' : results[0].hash, operations: changes('不应覆盖') });
  assert.equal(results.at(-1).ok, false); return final('已保护文件：' + results.at(-1).error);
}
async function seed() {
  await fs.mkdir(project, { recursive: true }); await fs.mkdir(profile); await fs.mkdir(fakeRoot);
  await fs.writeFile(path.join(profile, 'settings.json'), json({ workspaceRoot: project, preferences: { contextAccess: 'manual', browserPanelOpen: false, trayEnabled: false, fontFamily: 'Microsoft YaHei', fontSize: 16, themeMode: 'light' } }));
  await fs.writeFile(path.join(fakeRoot, 'codex-settings.json'), json({ sandboxMode: 'danger-full-access', approvalPolicy: 'on-request', workspaceDependencies: false, availableReasoningEfforts: ['low'], defaultReasoningEffort: 'low' }));
  await fs.writeFile(path.join(project, 'AGENTS.md'), '受控项目规则：保留中文与未修改的工作表。\n');
  const wb = new ExcelJS.Workbook(), sheet = wb.addWorksheet('Sheet1'); sheet.addRow(['项目', '数量', '单价', '合计']); sheet.addRow(['办公', 10, 7, { formula: 'B2*C2', result: 70 }]); sheet.getCell('A1').font = { name: 'Microsoft YaHei', size: 16, bold: true }; sheet.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDDEEFF' } }; wb.addWorksheet('保留').getCell('A1').value = '未修改内容'; await wb.xlsx.writeFile(path.join(project, '办公.xlsx'));
  const complex = new ExcelJS.Workbook(), cs = complex.addWorksheet('Sheet1'); cs.getCell('A1').value = '含图片不覆盖'; cs.addImage(complex.addImage({ buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aIpkAAAAASUVORK5CYII=', 'base64'), extension: 'png' }), 'B2:C3'); await complex.xlsx.writeFile(path.join(project, '复杂.xlsx'));
  for (const n of ['拒绝.csv', '并发.csv', '权限.csv', '数据.csv']) await fs.writeFile(path.join(project, n), '名称,值\r\n原始,10');
}
async function selectWorkflow() {
  await evaluate('document.querySelector(".activity-rail [aria-label=项目]").click()');
  const title = await evaluate('window.scodex.getAppState().then(s=>s.library.conversations.find(c=>c.id===' + json(workflowId) + ')?.title)');
  await tool('recent');
  await wait(() => evaluate('[...document.querySelectorAll(".history-open strong")].some(e=>e.textContent===' + json(title) + ')'), 'Workflow in all recent chats');
  await evaluate('[...document.querySelectorAll(".history-open")].find(e=>e.querySelector("strong").textContent===' + json(title) + ').click()'); await wait(() => evaluate('document.querySelector(".assistant-message-content")?.innerText.includes("实际工作簿")'), 'Workflow selected');
}
async function main() {
  try {
    if (process.env.SCODEX_SHEET_FIXTURE) { const previous = JSON.parse(await fs.readFile(reportFile, 'utf8')); report.checks = previous.checks; workflowId = previous.workflowId; report.workflowId = workflowId; }
    else await seed();
    report.sha256 = crypto.createHash('sha256').update(await fs.readFile(executable)).digest('hex'); await save();
    modelServer = http.createServer(async (req, res) => { try { let raw = ''; for await (const chunk of req) raw += chunk; await model(JSON.parse(raw), res); } catch (e) { fixtureErrors.push(e.stack); if (!res.headersSent) res.writeHead(500); res.end('Fixture failure'); } });
    const modelPort = await freePort(); await new Promise((r) => modelServer.listen(modelPort, '127.0.0.1', r)); endpoint = 'http://127.0.0.1:' + modelPort + '/v1';
    await launch();
    await evaluate('window.scodex.saveModelConnection(' + json({ name: '表格实际验收', baseUrl: endpoint, model: 'controlled-sheet-model', models: ['controlled-sheet-model'], toolProtocol: 'native', apiKey: 'controlled-only' }) + ')');
    await evaluate('location.reload()'); await wait(() => evaluate('!!document.querySelector("[aria-label=输入工作内容]")'), 'Configured');
    await check('identity', async () => { const s = await evaluate('window.scodex.getAppState().then(s=>({version:s.version,workspaceRoot:s.workspaceRoot}))'); assert.equal(s.version, '1.3.2'); assert.equal(path.resolve(s.workspaceRoot), path.resolve(project)); return s; });
    await check('native-xlsx-read-edit-read', async () => {
      await newChat(); await submit('native'); await wait(() => evaluate('!!document.querySelector(".agent-approval")'), 'Preview');
      const preview = await evaluate('document.querySelector(".agent-approval").innerText'); assert.match(preview, /办公.xlsx/); assert.match(preview, /SUM\(B2:C2\)/); assert.match(preview, /before/);
      await approval(); await finish(); const m = await stored((m) => m.operations?.length === 3 && m.operations.every((o) => o.status === 'succeeded'));
      const wb = await workbook('办公.xlsx'); assert.equal(wb.worksheets[0].getCell('B2').value, 15); assert.equal(wb.worksheets[0].getCell('D2').formula, 'SUM(B2:C2)'); assert.equal(wb.worksheets[0].getCell('D2').numFmt, '0.00'); assert.equal(wb.worksheets[0].getCell('A1').fill.fgColor.argb, 'FFDDEEFF'); assert.equal(wb.getWorksheet('保留').getCell('A1').value, '未修改内容'); assert.equal(wb.getWorksheet('汇总').getCell('A1').value, '中文汇总');
      workflowId = await evaluate('window.scodex.getAppState().then(s=>s.library.activeId)'); report.workflowId = workflowId; return { operations: m.operations.map((o) => o.name), stylesAndOtherSheetsPreserved: true, formulaCalculated: false };
    });
    await check('record-open-and-background-editor-refresh', async () => {
      await selectWorkflow(); await evaluate('document.querySelector(".agent-operation>summary").click()'); await textClick('.agent-operation button', '在表格中查看');
      await wait(() => evaluate('document.querySelector(".spreadsheet [aria-label=B2]")?.value==="15"'), 'Opened workbook');
      await newChat(); await submit('refresh'); await approval(); await finish(); await tool('tables');
      await wait(() => evaluate('document.querySelector(".spreadsheet [aria-label=A3]")?.value==="后台刷新完成"'), 'Auto refreshed clean workbook');
      assert.equal(await evaluate('!!document.querySelector(".table-dimensions .dirty-dot")'), false); return { openFromRecord: true, autoRefresh: true };
    });
    await check('dirty-editor-protection-and-manual-save', async () => {
      await openProjectFile('办公.xlsx'); await insert('A1', '手工未保存');
      await wait(() => evaluate('!!document.querySelector(".table-dimensions .dirty-dot")'), 'Dirty'); await newChat(); await submit('dirty');
      assert.match(await finish(), /未保存/); await tool('tables'); assert.equal(await evaluate('document.querySelector("[aria-label=A1]").value'), '手工未保存');
      assert.notEqual((await workbook('办公.xlsx')).worksheets[0].getCell('A1').value, '手工未保存'); await saveTable();
      assert.equal((await workbook('办公.xlsx')).worksheets[0].getCell('A1').value, '手工未保存'); return { protectedDirty: true, savedAndReadBack: true };
    });
    await check('refusal', async () => { const before = await fs.readFile(path.join(project, '拒绝.csv')); await newChat(); await submit('deny'); await approval(false); assert.match(await finish(), /拒绝/); assert.deepEqual(await fs.readFile(path.join(project, '拒绝.csv')), before); return { unchanged: true }; });
    await check('cancel-awaiting-approval', async () => { await newChat(); await submit('cancel'); await wait(() => evaluate('!!document.querySelector(".agent-approval")'), 'Cancel preview'); await click('停止生成'); assert.match(await finish(), /停止/); await assert.rejects(fs.access(path.join(project, '取消.csv'))); return { noFileCreated: true }; });
    await check('approval-external-conflict', async () => { await newChat(); await submit('concurrent'); await wait(() => evaluate('!!document.querySelector(".agent-approval")'), 'Concurrent preview'); await fs.writeFile(path.join(project, '并发.csv'), '外部保留'); await approval(); assert.match(await finish(), /其他程序修改/); assert.equal(await fs.readFile(path.join(project, '并发.csv'), 'utf8'), '外部保留'); return { externalChangePreserved: true }; });
    await check('approval-unsaved-edit-conflict', async () => {
      await openProjectFile('办公.xlsx'); await newChat(); await submit('approval-dirty'); await wait(() => evaluate('!!document.querySelector(".agent-approval")'), 'Dirty preview'); await tool('tables'); await insert('A1', '审批期间手工编辑'); await wait(() => evaluate('!!document.querySelector(".table-dimensions .dirty-dot")'), 'Approval dirty');
      await evaluate('document.querySelector(".activity-rail [aria-label=项目]").click()'); await approval(); assert.match(await finish(), /未保存/); assert.notEqual((await workbook('办公.xlsx')).worksheets[0].getCell('A1').value, '不应覆盖'); await tool('tables'); assert.equal(await evaluate('document.querySelector("[aria-label=A1]").value'), '审批期间手工编辑'); await saveTable(); return { dirtyDuringApprovalPreserved: true };
    });
    await check('approval-policy-change', async () => { await newChat(); await submit('policy-change'); await wait(() => evaluate('!!document.querySelector(".agent-approval")'), 'Policy preview'); await evaluate("window.scodex.saveAgentSettings({approvalPolicy:'never'},'shared')"); await approval(); assert.match(await finish(), /逐次审批/); assert.match(await fs.readFile(path.join(project, '权限.csv'), 'utf8'), /原始/); await evaluate("window.scodex.saveAgentSettings({approvalPolicy:'on-request'},'shared')"); return { changedPolicyBlocked: true }; });
    await check('planning-and-never', async () => {
      await newChat(); await click('添加工具和上下文'); await evaluate('[...document.querySelectorAll(".composer-menu-item")].find(e=>e.textContent.startsWith("计划模式")).click()'); await submit('plan'); assert.match(await finish(), /没有开放此工具/);
      await evaluate("window.scodex.saveAgentSettings({approvalPolicy:'never'},'shared')"); await newChat(); await submit('never'); assert.match(await finish(), /没有开放此工具/); await assert.rejects(fs.access(path.join(project, '越权.csv'))); await evaluate("window.scodex.saveAgentSettings({approvalPolicy:'on-request'},'shared')"); return { mutationNotAdvertisedOrExecuted: true };
    });
    await check('complex-workbook-protection', async () => { const before = await fs.readFile(path.join(project, '复杂.xlsx')); await newChat(); await submit('complex'); assert.match(await finish(), /未覆盖原工作簿/); assert.deepEqual(await fs.readFile(path.join(project, '复杂.xlsx')), before); return { imageWorkbookUnchanged: true }; });
    await check('create-workbook', async () => { await newChat(); await submit('create'); await approval(); await finish(); assert.equal((await workbook('新建.xlsx')).worksheets[0].getCell('A1').value, '新工作簿'); return { createdAndRead: true }; });
    await check('json-csv-read-edit-read', async () => {
      await evaluate('window.scodex.saveModelConnection(' + json({ name: '表格兼容验收', baseUrl: endpoint, model: 'controlled-sheet-model', models: ['controlled-sheet-model'], toolProtocol: 'json', apiKey: 'controlled-only' }) + ')'); await newChat(); await submit('json-csv'); await approval(); assert.match(await finish(), /兼容通道/);
      const m = await stored((m) => m.operations?.length === 3); assert.ok(m.operations.every((o) => o.status === 'succeeded')); const text = await fs.readFile(path.join(project, '数据.csv'), 'utf8'); assert.match(text, /"中文,\n""引号"""/); assert.match(text, /=1\+1/); return { actions: m.operations.map((o) => o.name), quotedChineseAndRawValue: true };
    });
    await check('table-help-entry-and-layout', async () => {
      await openProjectFile('办公.xlsx'); const samples = [];
      for (const [width, height] of [[1440, 900], [1080, 700]]) {
        await cdp.command('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
        samples.push(await evaluate('(()=>{const p=document.querySelector(".table-ai-help"),a=document.querySelector("[aria-label=A1]");return{width:innerWidth,height:innerHeight,scroll:document.documentElement.scrollWidth,font:getComputedStyle(a).fontFamily,size:getComputedStyle(a).fontSize,helpSize:getComputedStyle(p).fontSize,button:!![...document.querySelectorAll(".heading-actions button")].find(e=>e.innerText.includes("让 AI"))}})()'));
      }
      for (const s of samples) { assert.ok(s.scroll <= s.width); assert.match(s.font, /YaHei|微软雅黑/); assert.ok(parseFloat(s.size) >= 14); assert.ok(parseFloat(s.helpSize) >= 14); assert.equal(s.button, true); }
      await textClick('.table-view .heading-actions button', '让 AI 处理表格'); await wait(() => evaluate('!!document.querySelector("[aria-label=输入工作内容]")'), 'AI table action'); assert.equal(await evaluate('document.querySelector("[aria-label=执行任务]").getAttribute("aria-pressed")'), 'true'); assert.match(await evaluate('document.querySelector("[aria-label=输入工作内容]").value'), /办公.xlsx/);
      await tool('tables'); await cdp.command('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
      await fs.writeFile(path.join(output, 'spreadsheet-workbench.png'), Buffer.from((await cdp.command('Page.captureScreenshot', { format: 'png' })).data, 'base64')); return samples;
    });
    await check('history-restart', async () => {
      await selectWorkflow(); await wait(() => evaluate('window.scodex.getAppState().then(s=>s.library.activeId===' + json(workflowId) + ')'), 'Workflow persisted'); await quit(); await launch(); await selectWorkflow();
      const m = await stored((m) => m.operations?.length === 3); assert.ok(m.operations.every((o) => o.status === 'succeeded')); assert.equal(Boolean(m.approval), false); assert.equal(await evaluate('!!document.querySelector(".agent-approval")'), false);
      await evaluate('document.querySelector(".agent-operation>summary").click()'); await textClick('.agent-operation button', '在表格中查看'); await wait(() => evaluate('!!document.querySelector(".spreadsheet")'), 'History file action'); return { operationsPreserved: 3, noLiveApproval: true, historyFileOpened: true };
    });
    await quit(); appChild = null; report.status = 'passed'; report.completedAt = new Date().toISOString(); report.requests = requests; await save();
  } catch (error) {
    report.status = 'failed'; report.error = error.stack; report.requests = requests; await save(); console.error(error.stack);
  } finally {
    if (appChild && cdp) { try { await quit(); appChild = null; } catch (e) { report.cleanupError = e.message; } }
    for (const s of sockets) s.close(); if (modelServer) await new Promise((r) => modelServer.close(r));
    report.processExited = !appChild || appChild.exitCode !== null; await save(); console.log('RESULT ' + report.status); if (report.status !== 'passed') process.exitCode = 1;
  }
}
if (require.main === module) main();
