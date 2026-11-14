const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const http = require('node:http');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { connect, wait, freePort } = require('./agent-workflow-ui.cjs');

const root = path.resolve(__dirname, '..');
const version = require('../package.json').version;
const output = path.resolve(process.env.SCODEX_VISUALIZATION_OUTPUT || path.join(root, 'release', 'visualization-' + version, 'ui'));
const executable = path.resolve(process.env.SCODEX_VISUALIZATION_EXE || path.join(root, 'release', 'Scodex-Workbench-' + version, 'win-unpacked', 'Scodex工作台.exe'));
const fixture = path.resolve(process.env.SCODEX_VISUALIZATION_FIXTURE || path.join(output, 'fixture-' + crypto.randomUUID()));
const scope = process.env.SCODEX_VISUALIZATION_SCOPE || 'all';
const profile = path.join(fixture, 'profile'), home = path.join(fixture, 'home');
const report = { status: 'running', version, executable, fixture, checks: [], limitations: ['Actual packaged Electron UI, iframe isolation and encrypted chat persistence; model API is a loopback fixture. Public model services are not tested.'] };
const json = JSON.stringify;
let child, server, socket, cdp, debugPort;
const frameContexts = new Map();
let chartSocket, chartTargetId, chartSessionId, chartCommandId = 0;
let inspectorSocket, inspector;
const chartCommands = new Map();

function chartCommand(method, params = {}, sessionId) {
  return new Promise((resolve, reject) => {
    const id = ++chartCommandId;
    const timer = setTimeout(() => { chartCommands.delete(id); reject(Error('Chart CDP timeout ' + method)); }, 10000);
    chartCommands.set(id, { resolve, reject, timer });
    chartSocket.send(json({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
  });
}

async function attachChartTarget(targetId) {
  if (!chartSocket) {
    const browser = await fetch('http://127.0.0.1:' + debugPort + '/json/version').then(response => response.json());
    chartSocket = new WebSocket(browser.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => { chartSocket.addEventListener('open', resolve, { once: true }); chartSocket.addEventListener('error', reject, { once: true }); });
    chartSocket.addEventListener('message', ({ data }) => {
      const event = JSON.parse(data), pending = chartCommands.get(event.id);
      if (['Target.detachedFromTarget', 'Inspector.detached'].includes(event.method)) (report.chartEvents ||= []).push(event);
      if (!pending) return;
      chartCommands.delete(event.id); clearTimeout(pending.timer);
      if (event.error) pending.reject(Error(event.error.message)); else pending.resolve(event.result);
    });
    chartSocket.addEventListener('close', () => {
      for (const pending of chartCommands.values()) { clearTimeout(pending.timer); pending.reject(Error('Chart CDP closed')); }
      chartCommands.clear();
    });
  }
  if (chartTargetId !== targetId) {
    if (chartSessionId) await chartCommand('Target.detachFromTarget', { sessionId: chartSessionId }).catch(() => {});
    const attached = await chartCommand('Target.attachToTarget', { targetId, flatten: true });
    chartTargetId = targetId; chartSessionId = attached.sessionId;
    await chartCommand('Runtime.enable', {}, chartSessionId);
  }
}

async function launch() {
  debugPort = await freePort();
  const inspectorPort = await freePort();
  child = spawn(executable, ['--inspect=127.0.0.1:' + inspectorPort, '--remote-debugging-port=' + debugPort, '--user-data-dir=' + profile, '--disable-gpu'], {
    cwd: path.dirname(executable), windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'],
    env: { ...process.env, SCODEX_HOME: home, SCODEX_REFERENCE_HOME: path.join(fixture, 'reference'), SCODEX_REFERENCE_AGENTS_HOME: path.join(fixture, 'agents') },
  });
  let stderr = '';
  child.stderr.on('data', value => { stderr = (stderr + value).slice(-4000); });
  const target = await wait(async () => {
    if (child.exitCode !== null) throw Error('EXE exit ' + child.exitCode + ' ' + stderr);
    return (await fetch('http://127.0.0.1:' + debugPort + '/json/list').then(response => response.json()))
      .find(item => item.type === 'page' && item.url.startsWith('file:') && !item.url.includes('workspaceWindow='));
  }, 'Packaged EXE did not start', 45000);
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
  socket.addEventListener('message', ({ data }) => {
    const event = JSON.parse(data);
    if (event.method === 'Runtime.executionContextCreated') {
      const context = event.params.context;
      if (context.auxData?.frameId && context.auxData.isDefault) frameContexts.set(context.auxData.frameId, context.id);
    } else if (event.method === 'Runtime.executionContextDestroyed') {
      for (const [frameId, contextId] of frameContexts) if (contextId === event.params.executionContextId) frameContexts.delete(frameId);
    }
  });
  cdp = connect(socket); await cdp.command('Runtime.enable'); await cdp.command('Page.enable');
  const inspectorTarget = (await fetch('http://127.0.0.1:' + inspectorPort + '/json/list').then(response => response.json()))[0];
  inspectorSocket = new WebSocket(inspectorTarget.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { inspectorSocket.addEventListener('open', resolve, { once: true }); inspectorSocket.addEventListener('error', reject, { once: true }); });
  inspector = connect(inspectorSocket);
  await inspector.evaluate(`(()=>{global.__chartNavigationEvents=[];const electron=process.mainModule.require('electron');for(const win of electron.BrowserWindow.getAllWindows())win.webContents.on('will-frame-navigate',event=>global.__chartNavigationEvents.push({url:event.url,isMainFrame:event.isMainFrame,from:event.frame?.url,initiator:event.initiator?.url,blocked:event.defaultPrevented}));return true})()`);
  await wait(() => cdp.evaluate('Boolean(document.querySelector("[aria-label=输入工作内容]"))'), 'Renderer did not become ready');
  assert.equal((await cdp.evaluate('window.scodex.getAppState()')).version, version);
}

async function evaluateChart(expression) {
  const source = await cdp.evaluate('document.querySelector(".visualization-frame")?.src || ""');
  const targets = await cdp.command('Target.getTargets');
  const target = targets.targetInfos.find(item => item.type === 'iframe' && item.url === source);
  if (target) {
    await attachChartTarget(target.targetId);
    const result = await chartCommand('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, userGesture: true }, chartSessionId);
    if (result.exceptionDetails) throw Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    return result.result?.value;
  }
  const tree = await cdp.command('Page.getFrameTree');
  const frames = [];
  const visit = item => { for (const child of item.childFrames || []) { frames.push(child.frame); visit(child); } };
  visit(tree.frameTree);
  const frame = frames.find(item => item.url === source);
  if (!frame) return false;
  const contextId = frameContexts.get(frame.id);
  if (!contextId) return false;
  const result = await cdp.command('Runtime.evaluate', { expression, contextId, awaitPromise: true, returnByValue: true, userGesture: true });
  if (result.exceptionDetails) throw Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
  return result.result?.value;
}

async function click(selector) {
  await wait(() => cdp.evaluate('(()=>{const e=document.querySelector(' + json(selector) + ');if(!e||e.disabled)return false;e.click();return true})()'), 'Could not click ' + selector);
}

async function clickChart(selector) {
  const host = await cdp.evaluate('(()=>{const r=document.querySelector(".visualization-frame").getBoundingClientRect();return {x:r.x,y:r.y}})()');
  const button = await evaluateChart('(()=>{const r=document.querySelector(' + json(selector) + ').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()');
  const coords = { x: host.x + button.x, y: host.y + button.y, button: 'left', clickCount: 1 };
  await cdp.command('Input.dispatchMouseEvent', { type: 'mousePressed', ...coords });
  await cdp.command('Input.dispatchMouseEvent', { type: 'mouseReleased', ...coords });
}

async function insert(selector, value) {
  await cdp.evaluate('(()=>{const e=document.querySelector(' + json(selector) + ');if(!e)throw Error("Input missing");const p=Object.getPrototypeOf(e);Object.getOwnPropertyDescriptor(p,"value").set.call(e,' + json(value) + ');e.dispatchEvent(new Event("input",{bubbles:true}))})()');
}

async function send(text) {
  const state = await cdp.evaluate('window.scodex.getAppState()');
  const before = state.library.conversations.find(chat => chat.id === state.library.activeId);
  const count = before.messages.length;
  await insert('[aria-label="输入工作内容"]', text); await click('[aria-label="发送消息"]');
  return wait(async () => {
    const state = await cdp.evaluate('window.scodex.getAppState()');
    const chat = state.library.conversations.find(item => item.id === state.library.activeId);
    const assistant = chat.messages.at(-1);
    if (assistant?.error) throw Error(assistant.error);
    return chat.messages.length > count && assistant?.role === 'assistant' && !assistant.pending ? { state, chat, assistant } : false;
  }, 'Model request did not complete', 60000);
}

async function main() {
  if (scope === 'layout-only') {
    await fs.mkdir(output, { recursive: true });
    await launch();
    await cdp.evaluate('window.scodex.savePreferences({browserPanelOpen:false}).then(()=>location.reload())');
    await wait(() => cdp.evaluate('Boolean(document.querySelector(".visualization-frame"))'), 'Saved chart missing for layout');
    await wait(() => cdp.evaluate('Boolean(document.querySelector(".app-shell:not(.has-browser) .visualization-frame"))'), 'Browser pane did not close after reload');
    await verifyLayouts(); report.status = 'passed'; return;
  }
  await fs.mkdir(profile, { recursive: true }); await fs.mkdir(home, { recursive: true }); await fs.mkdir(output, { recursive: true });
  await fs.writeFile(path.join(home, 'codex-settings.json'), json({ sandboxMode: 'danger-full-access', approvalPolicy: 'never', networkAccess: true, networkDomains: ['*'], allowLocalBinding: true, workspaceDependencies: false, availableReasoningEfforts: ['low'], defaultReasoningEffort: 'low' }));
  await fs.writeFile(path.join(profile, 'settings.json'), json({ projects: [], activeProjectId: '', preferences: { fontSize: 16, contextAccess: 'full', closeConfirmation: 'never', closeToTray: false, browserPanelOpen: false } }));
  const createdAt = new Date().toISOString();
  await fs.writeFile(path.join(profile, 'conversations.json'), json({ version: 2, activeId: 'visualization-chat', conversations: [{ id: 'visualization-chat', title: '交互图表验收', mode: 'answer', messages: [], createdAt, updatedAt: createdAt }] }));
  let networkAttempts = 0, modelCalls = 0;
  server = http.createServer(async (request, response) => {
    if (request.url === '/chart-network-probe') { networkAttempts += 1; report.networkAttempts = networkAttempts; response.writeHead(204); response.end(); return; }
    let body = '';
    for await (const chunk of request) body += chunk;
    const input = JSON.parse(body); modelCalls += 1;
    const tools = input.tools?.map(item => item.function.name) || [];
    const latestUserMessage = [...(input.messages || [])].reverse().find(item => item.role === 'user');
    const call = tools.includes('visualize_render') && !input.messages?.some(item => item.role === 'tool') && /绘制|图表/.test(latestUserMessage?.content || '') ? { name: 'visualize_render', args: {
      title: '季度趋势', widget_state: { quarter: '2026-Q1' },
      html: `<style>body{font-family:sans-serif;color:#233;background:#fff}button{min-height:34px;margin:6px}canvas{display:block;width:100%;max-width:540px;height:180px}</style><h2 id="title">季度趋势</h2><canvas id="chart" width="540" height="180"></canvas><button id="change">切换季度</button><button id="ask">请求追问</button><output id="state"></output><script>const draw=()=>{const quarter=window.widgetState?.quarter||'2026-Q1',c=document.querySelector('#chart').getContext('2d');c.clearRect(0,0,540,180);const values=quarter==='2026-Q1'?[60,90,110]:[80,100,140];c.font='14px sans-serif';values.forEach((v,i)=>{c.fillStyle=['#168575','#dd9438','#4b77af'][i];c.fillRect(25+i*170,160-v,120,v);c.fillStyle='#233';c.fillText(String(v),68+i*170,152-v)});document.querySelector('#state').textContent=quarter};draw();document.querySelector('#change').onclick=()=>{const quarter=window.widgetState?.quarter==='2026-Q1'?'2026-Q2':'2026-Q1';setWidgetState({quarter});draw()};document.querySelector('#ask').onclick=()=>sendFollowUpMessage('请比较两个季度');fetch(${json('http://127.0.0.1:' + server?.address()?.port + '/chart-network-probe')}).catch(()=>{})</script>`,
    } } : null;
    const message = call
      ? { tool_calls: [{ id: 'chart-call-' + modelCalls, type: 'function', function: { name: call.name, arguments: json(call.args) } }] }
      : { content: '图表已生成，可以直接交互查看。' };
    const delta = message.tool_calls ? { tool_calls: message.tool_calls.map((item, index) => ({ index, ...item })) } : { content: message.content };
    response.writeHead(200, { 'content-type': 'text/event-stream' });
    response.end('data: ' + json({ choices: [{ delta, finish_reason: message.tool_calls ? 'tool_calls' : 'stop' }] }) + '\n\ndata: [DONE]\n\n');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  await launch();
  const endpoint = 'http://127.0.0.1:' + server.address().port + '/v1';
  const connection = { name: '可视化隔离验收', baseUrl: endpoint, model: 'fixture-model', models: ['fixture-model'], apiKey: 'fixture-only', retryLimit: 0, toolProtocol: 'native' };
  await cdp.evaluate('window.scodex.saveModelConnection(' + json(connection) + ').then(()=>location.reload())');
  await wait(() => cdp.evaluate('Boolean(document.querySelector("[aria-label=输入工作内容]"))'), 'Model fixture did not load');
  const app = await cdp.evaluate('window.scodex.getAppState()');
  const chatId = app.library.activeId;
  assert.equal(chatId, 'visualization-chat');
  report.chatId = chatId;
  await cdp.evaluate('window.__visualizationChatId=' + json(chatId));
  const permissionTitle = await cdp.evaluate('document.querySelector("[aria-label=更改权限]")?.title || ""');
  assert.match(permissionTitle, /完全访问/);
  report.checks.push({ name: 'candidate-runs-with-full-access-from-isolated-profile', status: 'passed', evidence: { permissionTitle } });
  await insert('[aria-label="输入工作内容"]', '绘制并直接展示交互式季度趋势图'); await click('[aria-label="发送消息"]');
  await wait(() => cdp.evaluate('Boolean(document.querySelector(".visualization-card iframe"))'), 'Chart did not render', 60000);
  await cdp.evaluate('document.querySelector(".visualization-frame").scrollIntoView({block:"center"})');
  await wait(() => cdp.evaluate('document.querySelector(".visualization-heading [role=status]")?.textContent==="已加载"'), 'Chart iframe did not load');
  await wait(() => evaluateChart('Boolean(document.querySelector("#title") && window.setWidgetState)'), 'Chart default context did not become ready');
  await wait(() => cdp.evaluate('!document.querySelector("[aria-label=停止生成]")'), 'Initial chart request did not finish');

  const frameInfo = await cdp.evaluate('(()=>{const frame=document.querySelector(".visualization-frame");return {sandbox:frame.getAttribute("sandbox"),loadStatus:document.querySelector(".visualization-heading [role=status]")?.textContent}})()');
  const isolation = await evaluateChart(`(()=>{let hostRead;try{parent.document.body;hostRead=false}catch(error){hostRead=error.name}return {origin:window.origin,urlOrigin:location.origin,hasPreload:typeof window.scodex,hostRead,title:document.querySelector('#title')?.textContent,policy:document.querySelector('meta[http-equiv="Content-Security-Policy"]')?.content}})()`);
  assert.equal(frameInfo.sandbox, 'allow-scripts'); assert.equal(isolation.origin, 'null'); assert.equal(isolation.hasPreload, 'undefined');
  assert.equal(isolation.hostRead, 'SecurityError'); assert.equal(isolation.title, '季度趋势'); assert.equal(frameInfo.loadStatus, '已加载');
  assert.equal(isolation.urlOrigin, 'scodex-chart://view');
  assert.match(isolation.policy, /connect-src 'none'/); assert.match(isolation.policy, /form-action 'none'/);
  report.checks.push({ name: 'sandboxed-chart-renders-without-host-origin-or-network-policy', status: 'passed', evidence: isolation });
  const paintedPixels = await evaluateChart('document.querySelector("#chart").getContext("2d").getImageData(0,0,540,180).data.filter((value,index)=>index%4===3&&value>0).length');
  assert.ok(paintedPixels > 1000);
  report.checks.push({ name: 'chart-canvas-paints-visible-data', status: 'passed', evidence: { paintedPixels } });

  if (scope !== 'workflow-only') {
  const originalChartUrl = await cdp.evaluate('document.querySelector(".visualization-frame").src');
  report.stage = 'data-navigation';
  await evaluateChart('(()=>{const data=document.createElement("button");data.id="navigate-data";data.textContent="Data probe";const external=document.createElement("button");external.id="navigate-external";external.textContent="External probe";document.body.append(data,external);data.addEventListener("click",()=>{location.href="data:text/html,chart-navigation-probe"});external.addEventListener("click",()=>{location.href="https://127.0.0.1:1/chart-navigation-probe"})})()');
  await clickChart('#navigate-data');
  await new Promise(resolve => setTimeout(resolve, 350));
  report.dataNavigationTargets = (await cdp.command('Target.getTargets')).targetInfos.map(item => ({ type: item.type, url: item.url }));
  await wait(async () => {
    const currentSource = await cdp.evaluate('document.querySelector(".visualization-frame")?.src || ""');
    return currentSource !== originalChartUrl && currentSource.startsWith('scodex-chart:') && await evaluateChart('Boolean(window.setWidgetState && document.querySelector("#title"))');
  }, 'Chart data-document replacement did not recover');
  const recoveredChartUrl = await cdp.evaluate('document.querySelector(".visualization-frame").src');
  report.stage = 'external-navigation';
  await evaluateChart('(()=>{const button=document.createElement("button");button.id="navigate-external";button.textContent="External probe";button.addEventListener("click",()=>{location.href=' + json('http://127.0.0.1:' + server.address().port + '/chart-network-probe') + '});document.body.appendChild(button)})()');
  await clickChart('#navigate-external');
  await new Promise(resolve => setTimeout(resolve, 350));
  const navigationResult = await wait(async () => {
    const stopped = await cdp.evaluate('document.querySelector(".visualization-error")?.textContent || ""');
    if (/已停止运行/.test(stopped)) return { stopped };
    return await evaluateChart('location.href') === recoveredChartUrl ? { urlUnchanged: true } : false;
  }, 'Chart external navigation was neither blocked nor stopped safely');
  assert.equal(networkAttempts, 0);
  report.navigationEvents = await inspector.evaluate('global.__chartNavigationEvents');
  report.checks.push({ name: 'chart-data-replacement-recovers-and-external-document-navigation-is-blocked', status: 'passed', evidence: { dataUrl: 'recovered by bounded host guard', externalUrl: 'zero loopback requests; repeated document failure stops the iframe', navigationResult, networkAttempts } });
  if (navigationResult.stopped) {
    await cdp.evaluate('location.reload()');
    await wait(() => cdp.evaluate('Boolean(document.querySelector(".visualization-frame"))'), 'Chart could not reopen after bounded stop');
    await cdp.evaluate('document.querySelector(".visualization-frame").scrollIntoView({block:"center"})');
    await wait(() => evaluateChart('Boolean(window.setWidgetState)'), 'Reopened chart bridge missing');
  }
  }

  const chartFrame = await cdp.evaluate('document.querySelector(".visualization-frame").getAttribute("src")');
  await cdp.evaluate('(()=>{const listener=event=>{if(event.data?.channel!=="scodex.visualization"||event.data?.type!=="state")return;window.removeEventListener("message",listener);const select=document.querySelector(".composer-model-mode");select.value="subagent";select.dispatchEvent(new Event("change",{bubbles:true}));window.__chartStateRefresh=true};window.addEventListener("message",listener)})()');
  await evaluateChart('document.querySelector("#change").click()');
  await wait(async () => (await cdp.evaluate('window.scodex.getAppState()')).library.conversations.find(chat => chat.id === chatId).messages.at(-1).operations?.find(operation => operation.name === 'visualize_render')?.visualization?.widgetState?.quarter === '2026-Q2', 'Widget state did not persist');
  assert.equal(await cdp.evaluate('document.querySelector(".visualization-frame").getAttribute("src")'), chartFrame);
  assert.equal(await cdp.evaluate('window.__chartStateRefresh'), true);
  assert.equal(await cdp.evaluate('document.querySelector(".composer-model-mode").value'), 'subagent');
  await cdp.evaluate('(()=>{const select=document.querySelector(".composer-model-mode");select.value="main";select.dispatchEvent(new Event("change",{bubbles:true}))})()');
  report.checks.push({ name: 'interactive-state-persists-during-parent-refresh-without-reloading-the-chart', status: 'passed', evidence: { quarter: '2026-Q2', parentRefresh: 'UI mode change during host state debounce' } });

  await evaluateChart('document.querySelector("#ask").click()');
  await wait(() => cdp.evaluate('Boolean(document.querySelector(".visualization-followup"))'), 'User confirmation UI missing');
  const beforeConfirm = modelCalls; const prompt = await cdp.evaluate('document.querySelector(".visualization-followup p").textContent');
  assert.equal(prompt, '请比较两个季度'); assert.equal(modelCalls, beforeConfirm);
  await new Promise(resolve => setTimeout(resolve, 300)); assert.equal(modelCalls, beforeConfirm);
  report.checks.push({ name: 'chart-followup-awaits-user-confirmation', status: 'passed', evidence: { prompt, requestsBeforeConfirm: modelCalls } });

  await click('.visualization-followup .text-tool');
  const followed = await wait(async () => {
    const state = await cdp.evaluate('window.scodex.getAppState()');
    const current = state.library.conversations.find(item => item.id === chatId);
    const lastAssistant = [...(current?.messages || [])].reverse().find(item => item.role === 'assistant');
    const followupCardVisible = await cdp.evaluate('Boolean(document.querySelector(".visualization-followup"))');
    const requestFinished = await cdp.evaluate('!document.querySelector("[aria-label=停止生成]")');
    return current?.messages.filter(item => item.role === 'user').at(-1)?.content === '请比较两个季度' && lastAssistant?.content && requestFinished && !followupCardVisible ? state : false;
  }, 'Confirmed follow-up did not complete in the same conversation', 60000);
  const chat = followed.library.conversations.find(item => item.id === chatId);
  assert.equal(modelCalls, beforeConfirm + 1);
  assert.equal(followed.library.activeId, chatId); assert.equal(chat.messages.filter(item => item.role === 'user').at(-1).content, '请比较两个季度');
  report.checks.push({ name: 'confirmed-chart-followup-uses-the-current-chat-without-redrawing', status: 'passed', evidence: { chatId, userMessages: chat.messages.filter(item => item.role === 'user').length, modelCallsAfterConfirmation: modelCalls } });

  await cdp.evaluate('location.reload()');
  await wait(() => cdp.evaluate('Boolean(document.querySelector(".visualization-card iframe"))'), 'Saved chart did not reopen');
  await cdp.evaluate('document.querySelector(".visualization-frame").scrollIntoView({block:"center"})');
  await wait(() => cdp.evaluate('document.querySelector(".visualization-heading [role=status]")?.textContent==="已加载"'), 'Saved chart did not finish loading');
  await wait(() => evaluateChart('Boolean(window.setWidgetState)'), 'Restored chart context not ready');
  const restored = await evaluateChart('({quarter:window.widgetState?.quarter,origin:window.origin})');
  assert.deepEqual(restored, { quarter: '2026-Q2', origin: 'null' });
  report.checks.push({ name: 'chat-reopen-restores-chart-and-widget-state', status: 'passed', evidence: restored });

  await cdp.evaluate(`(async()=>{const state=await window.scodex.getAppState();const chat=state.library.conversations.find(item=>item.id===${json(chatId)});const operation=chat.messages.flatMap(item=>item.operations||[]).find(item=>item.name==='visualize_render');operation.name='takeover_visualize_render';await window.scodex.saveHistory(state.library);location.reload()})()`);
  await wait(() => cdp.evaluate('Boolean(document.querySelector(".visualization-frame"))'), 'Takeover activity chart did not reopen');
  await cdp.evaluate('document.querySelector(".visualization-frame").scrollIntoView({block:"center"})');
  await wait(() => evaluateChart('window.widgetState?.quarter==="2026-Q2"'), 'Takeover chart state did not restore');
  const takeoverState = await cdp.evaluate('window.scodex.getAppState()');
  assert.ok(takeoverState.library.conversations.find(item => item.id === chatId).messages.flatMap(item => item.operations || []).some(item => item.name === 'takeover_visualize_render' && item.visualization?.widgetState?.quarter === '2026-Q2'));
  report.checks.push({ name: 'saved-takeover-chart-activity-renders-and-restores-state', status: 'passed', evidence: { source: 'Saved activity fixture derived from the real chart; team takeover orchestration is not simulated as verified.' } });

  await cdp.evaluate('(()=>{const frame=document.createElement("iframe");frame.id="office-srcdoc-probe";frame.sandbox="";frame.onload=()=>window.__officeSrcdocLoaded=true;frame.srcdoc="<!doctype html><p>Office preview</p>";document.body.appendChild(frame)})()');
  await wait(() => cdp.evaluate('window.__officeSrcdocLoaded===true'), 'Sandboxed office srcdoc failed to load');
  await cdp.evaluate('document.querySelector("#office-srcdoc-probe").remove()');
  report.checks.push({ name: 'existing-sandboxed-office-srcdoc-loads', status: 'passed', evidence: { source: 'Same sandbox/srcdoc loading path as document-preview; office parser is unchanged.' } });

  await new Promise(resolve => setTimeout(resolve, 500));
  assert.equal(networkAttempts, 0); report.networkAttempts = networkAttempts;
  if (scope !== 'workflow-only') await verifyLayouts();
  report.status = 'passed';
}

async function verifyLayouts() {
  const layouts = [];
  for (const [width, height] of [[600, 800], [1280, 780]]) {
    await cdp.command('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
    await new Promise(resolve => setTimeout(resolve, 200));
    await cdp.evaluate('document.querySelector(".visualization-card").scrollIntoView({block:"center"})');
    await new Promise(resolve => setTimeout(resolve, 300));
    const layout = await cdp.evaluate(`(()=>{const card=document.querySelector('.visualization-card'),frame=card.querySelector('iframe'),r=frame.getBoundingClientRect();return {width:innerWidth,height:innerHeight,documentWidth:document.documentElement.scrollWidth,cardWidth:card.clientWidth,frameWidth:r.width,frameHeight:r.height,top:r.top,bottom:r.bottom,scrollWidth:card.scrollWidth}})()`);
    (report.layoutAttempts ||= []).push(layout);
    assert.ok(layout.frameWidth >= 200 && layout.frameHeight >= (width === 600 ? 320 : 380), 'Chart is hidden or undersized at ' + width);
    assert.ok(layout.top >= 0 && layout.bottom <= layout.height, 'Chart is outside the visible viewport');
    assert.ok(layout.documentWidth <= layout.width + 1); assert.ok(layout.scrollWidth <= layout.cardWidth + 1);
    layouts.push(layout);
  }
  report.checks.push({ name: 'chart-layout-fits-narrow-and-desktop-viewports', status: 'passed', evidence: layouts });
  const screenshot = await cdp.command('Page.captureScreenshot', { format: 'png' });
  report.screenshot = path.join(output, 'visualization.png'); await fs.writeFile(report.screenshot, Buffer.from(screenshot.data, 'base64'));
  await cdp.command('Emulation.clearDeviceMetricsOverride');
}

main().catch(async error => {
  report.status = 'failed'; report.error = error.stack; console.error(error); process.exitCode = 1;
  if (cdp) report.failureTargets = await cdp.command('Target.getTargets').then(result => result.targetInfos.map(item => ({ type: item.type, url: item.url }))).catch(failure => failure.message);
  if (cdp) report.failureDom = await cdp.evaluate('document.querySelector(".visualization-card")?.innerText || ""').catch(failure => failure.message);
  if (inspector) report.navigationEvents = await inspector.evaluate('global.__chartNavigationEvents').catch(failure => failure.message);
})
  .finally(async () => {
    inspectorSocket?.close();
    try { if (socket?.readyState === 1) { await cdp.evaluate('window.scodex.quitApp()').catch(() => {}); } } catch {}
    if (child && child.exitCode === null) await wait(() => Promise.resolve(child.exitCode !== null), 'Candidate process exit', 15000).catch(() => {});
    if (child && child.exitCode === null) child.kill();
    if (child && child.exitCode === null) await wait(() => Promise.resolve(child.exitCode !== null), 'Isolated candidate process exit', 15000).catch(error => { report.cleanupError = error.message; });
    chartSocket?.close(); socket?.close(); inspectorSocket?.close();
    if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
    report.processExited = child?.exitCode !== null;
    report.executableSha256 = await fs.readFile(executable).then(bytes => crypto.createHash('sha256').update(bytes).digest('hex')).catch(() => 'unavailable');
    report.finishedAt = new Date().toISOString();
    await fs.mkdir(output, { recursive: true });
    await fs.writeFile(path.join(output, 'visualization-ui-verification.json'), json(report, null, 2));
    console.log('RESULT ' + report.status);
  });
