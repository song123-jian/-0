// Actual portable EXE + real Canvas, pixels, native save dialog, IPC and history.
// Only the external model is replaced by a deterministic loopback endpoint.
const assert = require('node:assert/strict'), fs = require('node:fs/promises'), path = require('node:path'), os = require('node:os'), crypto = require('node:crypto'), http = require('node:http');
const { spawn, execFile } = require('node:child_process');
const { png, decodePng } = require('./image-fixtures.cjs');
const { imageHeader } = require('../electron/image-tools.cjs');
const { promisify } = require('node:util'); const execFileAsync = promisify(execFile);
const { connect, wait, freePort } = require('./agent-workflow-ui.cjs');
const root = path.resolve(__dirname, '..'), output = path.join(root, 'release/image-runtime-20261025');
const executable = path.join(output, 'Scodex-Workbench-1.3.3-x64.exe');
const temporary = process.env.SCODEX_IMAGE_FIXTURE || path.join(os.tmpdir(), 'scodex-image-ui-' + crypto.randomUUID());
assert.ok(path.basename(temporary).startsWith('scodex-image-ui-'));
const profile = path.join(temporary, 'profile'), project = path.join(temporary, 'project'), fakeRoot = path.join(temporary, 'scodex');
const only = new Set((process.env.SCODEX_IMAGE_ONLY || '').split(',').filter(Boolean)), json = JSON.stringify;
const reportFile = path.join(output, 'image-ui-verification.json');
let report = { status: 'running', version: '1.3.3', executable, fixtureDirectory: temporary, checks: [], environment: { platform: os.platform(), release: os.release(), node: process.version }, limitations: ['CDP operates actual EXE renderer and file operations; only model replies are deterministic.', 'Real offline Canvas and pixels are tested; no generative image model or public relay is used.', 'Renderer capture is not a Windows desktop screenshot.'] };
let appChild, cdp, socket, modelServer, endpoint, debugPort, workflowId;
const fixtureErrors = [], requests = [], sockets = new Set();
const save = () => fs.writeFile(reportFile, json(report, null, 2));
const evaluate = (s) => cdp.evaluate(s);
async function nativeImageDialog(pid,action,file='') {
  const quote=s=>"'"+String(s).replaceAll("'","''")+"'";
  const code='& ([ScriptBlock]::Create([IO.File]::ReadAllText('+quote(path.join(__dirname,'image-save-dialog.ps1'))+',[Text.Encoding]::UTF8))) -TargetPid '+pid+' -Action '+quote(action)+' -ImageFilePath '+quote(file);
  return execFileAsync(process.env.SCODEX_NATIVE_PWSH||'pwsh.exe',['-NoProfile','-Command',code],{windowsHide:true,timeout:25000});
}
async function check(id, fn) {
  if (only.size && !only.has(id)) return;
  const evidence = await fn(); report.checks = report.checks.filter((c) => c.id !== id);
  report.checks.push({ id, status: 'passed', sha256: report.sha256, evidence }); await save(); console.log('PASS ' + id);
}
async function click(label) { return wait(() => evaluate('(()=>{const e=document.querySelector(' + json('[aria-label="' + label + '"]') + ');if(!e||e.disabled)return false;e.click();return true})()'), label); }
async function textClick(selector, text) { return wait(() => evaluate('(()=>{const e=[...document.querySelectorAll(' + json(selector) + ')].find(e=>e.textContent.trim()===' + json(text) + ');if(!e||e.disabled)return false;e.click();return true})()'), text); }
async function insert(label, value) {
  return evaluate('(()=>{const e=document.querySelector(' + json('[aria-label="' + label + '"]') + ')||document.getElementById('+json(label)+');if(!e)throw Error("Input missing");const p=e instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(p,"value").set.call(e,' + json(value) + ');e.dispatchEvent(new Event("input",{bubbles:true}));return true})()');
}
async function tool(id) { await click('工具命令搜索'); await wait(() => evaluate('Boolean(document.querySelector("#command-' + id + '"))'), id); await evaluate('document.querySelector("#command-' + id + '").click()'); }
async function newChat(execution = true) {
  await evaluate('document.querySelector(".activity-rail [aria-label=项目]").click()'); await click('新聊天');
  await wait(() => evaluate('!document.querySelector(".message-list")'), 'New chat');
  if (execution) await click('执行任务');
}
async function submit(id) { await insert('输入工作内容', 'IMAGE_CASE:' + id); await click('发送消息'); }
async function finish() {
  await wait(() => evaluate('!document.querySelector("[aria-label=停止生成]")'), 'Response finish', 45000);
  if (fixtureErrors.length) throw Error(fixtureErrors.join('\n'));
  return evaluate('document.querySelector(".message-list")?.innerText||""');
}
async function approval(allowed = true) {
  await wait(() => evaluate('!!document.querySelector("[aria-label=图片操作审批]")'), 'Image approval');
  const label = await evaluate('document.querySelector(".agent-approval .primary-button").textContent');
  await textClick('.agent-approval-actions button', allowed ? label : '拒绝');
}
async function approveUntilDone() {
  let count = 0;
  for (; count < 8; count++) {
    const state = await wait(() => evaluate('document.querySelector(".agent-approval")?"approval":!document.querySelector("[aria-label=停止生成]")?"done":false'), 'Image progress', 45000);
    if (state === 'done') { await finish(); return count; }
    await approval();
  }
  throw Error('Too many image approvals');
}
async function stored(predicate = () => true) {
  return wait(async () => { const library = await evaluate('window.scodex.getAppState().then(s=>s.library)'); const m = library.conversations.find((c) => c.id === library.activeId)?.messages.at(-1); return m?.role === 'assistant' && !m.pending && Number.isFinite(m.elapsedMs) && predicate(m) && m; }, 'Stored final state');
}
async function openProjectFile(name) {
  const selector = '.file-tree-item[title=' + json(name) + ']';
  await tool('files'); await wait(() => evaluate('!!document.querySelector(' + json(selector) + ')'), 'Image file in list');
  await evaluate('document.querySelector(' + json(selector) + ').click()'); await imageReady(name);
}
async function imageReady(name, width, height) {
  await wait(() => evaluate('(()=>{const c=document.querySelector(".image-canvas"),h=document.querySelector(".image-view .tool-heading p");return !!c&&h.textContent.includes('+json(name)+')'+(width?'&&c.width==='+width+'&&c.height==='+height:'')+'})()'), 'Loaded image '+name);
}
async function pixel(x, y) { return evaluate('[...document.querySelector(".image-canvas").getContext("2d").getImageData('+x+','+y+',1,1).data]'); }
async function dirty(expected) { await wait(() => evaluate('Boolean(document.querySelector(".image-view .tool-heading p")?.textContent.includes("未导出"))==='+expected), 'Image dirty '+expected); }
async function resetImage() { await textClick('.image-view .heading-actions button', '重置修改'); await dirty(false); }
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

const operations = [
  { type: 'crop', x: 0, y: 0, width: 120, height: 80 }, { type: 'rotate', degrees: 90 },
  { type: 'resize', width: 40, height: 60 }, { type: 'brightness', percent: 50 },
  { type: 'text', x: 2, y: 2, text: 'AI', font_size: 14, color: '#ffffff', outline: '#000000', bold: true },
];
const sourceFor = (id) => ({'source-conflict':'源冲突.png',dirty:'native.png','approval-dirty':'图片.png',refresh:'刷新.png',jpeg:'透明.png'}[id]||'图片.png');
const targetFor = (id) => ({native:'native.png','json-flip':'json.png',jpeg:'white.jpg',refresh:'刷新.png',dirty:'native.png','target-conflict':'目标冲突.png','source-conflict':'不创建-源.png','cancel-edit':'不创建-取消.png','deny-edit':'不创建-拒绝.png','policy-change':'不创建-策略.png','invalid-crop':'不创建-裁剪.png','approval-dirty':'不创建-dirty.png'}[id]||'不创建.png');
async function model(body,res) {
  const compatible = String(body.messages[0]?.content).includes('中转兼容执行通道');
  const user = body.messages.findLast(m=>m.role==='user'&&typeof m.content==='string'&&m.content.includes('IMAGE_CASE:'));
  const id = user?.content.split('IMAGE_CASE:')[1]?.split('\n')[0], index=body.messages.indexOf(user);
  const messages=body.messages.slice(index+1);
  const results=compatible?messages.filter(m=>m.role==='user'&&typeof m.content==='string'&&m.content.startsWith('本机工具实际结果')).map(m=>JSON.parse(m.content.slice(m.content.indexOf('\n')+1))):messages.filter(m=>m.role==='tool').map(m=>JSON.parse(m.content));
  const images=messages.flatMap(m=>m.role==='user'&&Array.isArray(m.content)?m.content.filter(c=>c.type==='image_url'):[]);
  const names=(body.tools||[]).map(t=>t.function.name), step=results.length;
  requests.push({id,step,protocol:compatible?'json':'native',imageCount:images.length,imageBytes:images.map(i=>i.image_url.url.length),imageTools:names.filter(n=>n.startsWith('image_'))});
  for(const i of images) assert.match(i.image_url.url,/^data:image\/jpeg;base64,/);
  const call=(name,args)=>compatible?send(res,{content:json({type:'tool',name,arguments:args})}):send(res,{tool_calls:[{index:0,id:'call_'+crypto.randomBytes(6).toString('hex'),type:'function',function:{name,arguments:json(args)}}]});
  const final=text=>send(res,{content:compatible?json({type:'final',content:text}):text});
  if(id==='never') { if(!step){assert.ok(!names.includes('image_read'));assert.ok(!names.includes('image_edit'));return call('image_read',{path:'图片.png'});}assert.equal(results[0].ok,false);return final('已保护：'+results[0].error); }
  if(id==='plan') { if(!step){assert.ok(names.includes('image_read'));assert.ok(!names.includes('image_edit'));return call('image_read',{path:'图片.png'});}if(step===1){assert.equal(results[0].ok,true);return call('image_edit',{path:'图片.png',expected_hash:results[0].hash,output_path:'越权.png',output_expected_hash:'new',operations:[{type:'flip',axis:'horizontal'}]});}assert.equal(results[1].ok,false);return final('规划拒绝修改：'+results[1].error); }
  const source=sourceFor(id),target=targetFor(id);
  if(!step)return call('image_read',{path:source});
  if(id==='deny-read'){assert.equal(results[0].ok,false);assert.equal(images.length,0);return final('读取已拒绝：'+results[0].error);}
  assert.equal(results[0].ok,true); assert.ok(images.length>=1); assert.ok(results[0].instructions.some(i=>i.content.includes('保留中文')));
  if(id==='target-conflict'&&step===1)return call('image_read',{path:target});
  const editStep=id==='target-conflict'?2:1;
  if(step===editStep) {
    const ops=id==='native'?operations:id==='refresh'?[{type:'resize',width:90,height:50}]:id==='json-flip'?[{type:'flip',axis:'horizontal'},{type:'flip',axis:'vertical'}]:id==='jpeg'?[{type:'resize',width:32,height:32}]:id==='invalid-crop'?[{type:'crop',x:230,y:0,width:120,height:80}]:[{type:'brightness',percent:70}];
    return call('image_edit',{path:source,expected_hash:results[0].hash,output_path:target,output_expected_hash:source===target?results[0].hash:id==='target-conflict'?results[1].hash:'new',operations:ops});
  }
  const success=['native','refresh','json-flip','jpeg'].includes(id);
  if(!success){assert.equal(results.at(-1).ok,false);return final('已保护图片：'+results.at(-1).error);}
  assert.equal(results.at(-1).ok,true);
  if(step===editStep+1)return call('image_read',{path:target});
  assert.equal(images.length,3); return final('实际图片修改并回读完成：'+target+'，'+results.at(-1).width+' × '+results.at(-1).height+(compatible?'，兼容通道。':'。'));
}
async function seed() {
  await fs.mkdir(project,{recursive:true});await fs.mkdir(profile);await fs.mkdir(fakeRoot);
  await fs.writeFile(path.join(profile,'settings.json'),json({workspaceRoot:project,preferences:{contextAccess:'manual',browserPanelOpen:false,trayEnabled:false,fontFamily:'Microsoft YaHei',fontSize:16,themeMode:'light'}}));
  await fs.writeFile(path.join(fakeRoot,'codex-settings.json'),json({sandboxMode:'danger-full-access',approvalPolicy:'on-request',workspaceDependencies:false,availableReasoningEfforts:['low'],defaultReasoningEffort:'low'}));
  await fs.writeFile(path.join(project,'AGENTS.md'),'受控项目规则：保留中文与未修改图片。\n');
  const data=png(240,160,(x,y)=>y<80?x<120?[240,20,20,255]:[20,220,20,255]:x<120?[20,20,240,255]:[240,220,20,255]);
  for(const n of ['图片.png','刷新.png','源冲突.png','目标冲突.png'])await fs.writeFile(path.join(project,n),data);
  await fs.writeFile(path.join(project,'透明.png'),png(16,16,()=>[0,0,0,0]));
}
async function selectWorkflow() {
  await evaluate('document.querySelector(".activity-rail [aria-label=项目]").click()');
  const title=await evaluate('window.scodex.getAppState().then(s=>s.library.conversations.find(c=>c.id==='+json(workflowId)+')?.title)');
  await tool('recent');await wait(()=>evaluate('[...document.querySelectorAll(".history-open strong")].some(e=>e.textContent==='+json(title)+')'),'Saved image chat');
  await evaluate('[...document.querySelectorAll(".history-open")].find(e=>e.querySelector("strong").textContent==='+json(title)+').click()');
  await wait(()=>evaluate('document.querySelector(".assistant-message-content")?.innerText.includes("实际图片修改")'),'Selected image history');
}
async function main() {
  try {
    if(process.env.SCODEX_IMAGE_FIXTURE){const old=JSON.parse(await fs.readFile(reportFile,'utf8'));report.checks=old.checks;workflowId=old.workflowId;report.workflowId=workflowId;} else await seed();
    report.sha256=crypto.createHash('sha256').update(await fs.readFile(executable)).digest('hex');await save();
    modelServer=http.createServer(async(req,res)=>{try{let raw='';for await(const b of req)raw+=b;await model(JSON.parse(raw),res);}catch(e){fixtureErrors.push(e.stack);if(!res.headersSent)res.writeHead(500);res.end('Fixture failure');}});
    const port=await freePort();await new Promise(r=>modelServer.listen(port,'127.0.0.1',r));endpoint='http://127.0.0.1:'+port+'/v1';await launch();
    const connection={name:'图片实际验收',baseUrl:endpoint,model:'controlled-image-model',models:['controlled-image-model'],toolProtocol:'native',apiKey:'controlled-only'};
    await evaluate('window.scodex.saveModelConnection('+json(connection)+')');await evaluate('location.reload()');await wait(()=>evaluate('!!document.querySelector("[aria-label=输入工作内容]")'),'Configured');
    await check('identity',async()=>{const s=await evaluate('window.scodex.getAppState().then(s=>({version:s.version,workspaceRoot:s.workspaceRoot}))');assert.equal(s.version,'1.3.3');assert.equal(path.resolve(s.workspaceRoot),path.resolve(project));return s;});
    await check('native-read-edit-read-pixels',async()=>{
      const before=await fs.readFile(path.join(project,'图片.png'));await newChat();await submit('native');await approval();await wait(()=>evaluate('!!document.querySelector(".agent-approval")'),'Edit preview');
      const preview=await evaluate('document.querySelector(".agent-approval").innerText');assert.match(preview,/native.png/);assert.match(preview,/crop/);assert.match(preview,/读取|保存/);
      await approval();await approval();assert.match(await finish(),/40 × 60/);const m=await stored(m=>m.operations?.length===3&&m.operations.every(o=>o.status==='succeeded'));assert.ok(m.operations.every(o=>o.screenshot?.dataUrl.startsWith('data:image/jpeg')));
      const out=decodePng(await fs.readFile(path.join(project,'native.png')));assert.equal(out.width,40);assert.equal(out.height,60);assert.deepEqual(out.pixel(30,55),[120,10,10,255]);let textPixels=0;for(let y=2;y<28;y++)for(let x=2;x<35;x++)if(out.pixel(x,y)[1]>80)textPixels++;assert.ok(textPixels>15);assert.deepEqual(await fs.readFile(path.join(project,'图片.png')),before);
      workflowId=await evaluate('window.scodex.getAppState().then(s=>s.library.activeId)');report.workflowId=workflowId;return{approvals:3,actions:m.operations.map(o=>o.name),size:[40,60],pixel:out.pixel(30,55),textPixels,sourceUnchanged:true};
    });
    await check('record-open-and-background-refresh',async()=>{
      await selectWorkflow();await evaluate('document.querySelector(".agent-operation>summary").click()');await textClick('.agent-operation button','在图片中查看');await imageReady('图片.png',240,160);
      await openProjectFile('刷新.png');await newChat();await submit('refresh');assert.equal(await approveUntilDone(),3);await tool('images');await imageReady('刷新.png',90,50);await dirty(false);return{recordOpensRealImage:true,cleanEditorRefreshed:[90,50]};
    });
    await check('dirty-before-send-and-reset',async()=>{
      await openProjectFile('native.png');await insert('brightness','120');await dirty(true);const before=await fs.readFile(path.join(project,'native.png'));await newChat();await submit('dirty');await approval();assert.match(await finish(),/未保存/);assert.deepEqual(await fs.readFile(path.join(project,'native.png')),before);await tool('images');await dirty(true);assert.equal(await evaluate('document.querySelector("#brightness").value'),'120');await resetImage();await imageReady('native.png',40,60);return{dirtyPreserved:true,resetClean:true};
    });
    await check('deny-read-and-deny-edit',async()=>{
      await newChat();await submit('deny-read');await approval(false);assert.match(await finish(),/拒绝/);await newChat();await submit('deny-edit');await approval();await approval(false);assert.match(await finish(),/拒绝/);await assert.rejects(fs.access(path.join(project,targetFor('deny-edit'))));return{noImageSharedAfterReadDenial:true,noFileAfterEditDenial:true};
    });
    await check('cancel-awaiting-edit',async()=>{await newChat();await submit('cancel-edit');await approval();await wait(()=>evaluate('!!document.querySelector(".agent-approval")'),'Cancel image edit');await click('停止生成');assert.match(await finish(),/停止/);assert.equal(await evaluate('!!document.querySelector(".agent-approval")'),false);await assert.rejects(fs.access(path.join(project,targetFor('cancel-edit'))));return{noFile:true,noLiveApproval:true};});
    await check('source-and-target-conflicts',async()=>{
      await newChat();await submit('source-conflict');await approval();await wait(()=>evaluate('!!document.querySelector(".agent-approval")'),'Source preview');const changed=png(240,160,()=>[25,50,75,255]);await fs.writeFile(path.join(project,'源冲突.png'),changed);await approval();assert.match(await finish(),/源图已变化/);assert.deepEqual(await fs.readFile(path.join(project,'源冲突.png')),changed);await assert.rejects(fs.access(path.join(project,targetFor('source-conflict'))));
      await newChat();await submit('target-conflict');await approval();await approval();await wait(()=>evaluate('!!document.querySelector(".agent-approval")'),'Target preview');await fs.writeFile(path.join(project,'目标冲突.png'),changed);await approval();assert.match(await finish(),/其他程序修改/);assert.deepEqual(await fs.readFile(path.join(project,'目标冲突.png')),changed);return{externalSourcePreserved:true,externalTargetPreserved:true};
    });
    await check('dirty-during-approval',async()=>{
      await openProjectFile('图片.png');await newChat();await submit('approval-dirty');await approval();await wait(()=>evaluate('!!document.querySelector(".agent-approval")'),'Dirty preview');await tool('images');await insert('brightness','130');await dirty(true);await evaluate('document.querySelector(".activity-rail [aria-label=项目]").click()');await approval();assert.match(await finish(),/未保存/);await tool('images');assert.equal(await evaluate('document.querySelector("#brightness").value'),'130');await resetImage();await assert.rejects(fs.access(path.join(project,targetFor('approval-dirty'))));return{editingPreserved:true,noOutput:true};
    });
    await check('policy-during-approval',async()=>{await newChat();await submit('policy-change');await approval();await wait(()=>evaluate('!!document.querySelector(".agent-approval")'),'Policy preview');await evaluate("window.scodex.saveAgentSettings({approvalPolicy:'never'},'shared')");await approval();assert.match(await finish(),/逐次审批/);await assert.rejects(fs.access(path.join(project,targetFor('policy-change'))));await evaluate("window.scodex.saveAgentSettings({approvalPolicy:'on-request'},'shared')");return{newPolicyEnforced:true};});
    await check('plan-and-never',async()=>{
      await newChat();await click('添加工具和上下文');await evaluate('[...document.querySelectorAll(".composer-menu-item")].find(e=>e.textContent.startsWith("计划模式")).click()');await submit('plan');await approval();assert.match(await finish(),/没有开放此工具/);await assert.rejects(fs.access(path.join(project,'越权.png')));
      await evaluate("window.scodex.saveAgentSettings({approvalPolicy:'never'},'shared')");await newChat();await submit('never');assert.match(await finish(),/没有开放此工具/);await evaluate("window.scodex.saveAgentSettings({approvalPolicy:'on-request'},'shared')");return{planReadApproved:true,forgedEditsBlocked:true,neverNoImageTools:true};
    });
    await check('invalid-crop-real-processor-error',async()=>{await newChat();await submit('invalid-crop');await approval();await approval();assert.match(await finish(),/裁剪区域超出/);await assert.rejects(fs.access(path.join(project,targetFor('invalid-crop'))));return{realCanvasErrorReadable:true,noOutput:true};});
    await check('jpeg-alpha-white-background',async()=>{await newChat();await submit('jpeg');await approveUntilDone();const b=await fs.readFile(path.join(project,'white.jpg'));const h=imageHeader(b);assert.equal(h.mime,'jpeg');assert.equal(h.width,32);assert.equal(h.height,32);await openProjectFile('white.jpg');await imageReady('white.jpg',32,32);assert.deepEqual(await pixel(5,5),[255,255,255,255]);return{mime:h.mime,size:[h.width,h.height],pixel:await pixel(5,5)};});
    await check('json-read-edit-read-flip-pixels',async()=>{
      await evaluate('window.scodex.saveModelConnection('+json({...connection,name:'图片JSON验收',toolProtocol:'json'})+')');await newChat();await submit('json-flip');assert.equal(await approveUntilDone(),3);assert.match(await finish(),/兼容通道/);const out=decodePng(await fs.readFile(path.join(project,'json.png')));assert.deepEqual(out.pixel(10,10),[240,220,20,255]);assert.deepEqual(out.pixel(230,150),[240,20,20,255]);const m=await stored(m=>m.operations?.length===3);assert.ok(m.operations.every(o=>o.status==='succeeded'));return{actions:m.operations.map(o=>o.name),topLeft:out.pixel(10,10),bottomRight:out.pixel(230,150),realImages:3};
    });
    await check('manual-crop-reset-and-native-export',async()=>{
      await openProjectFile('图片.png');await evaluate('(()=>{for(const [field,value]of [["宽",80],["高",50]]){const e=[...document.querySelectorAll(".crop-grid label")].find(l=>l.querySelector("span").textContent===field).querySelector("input");Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").set.call(e,value);e.dispatchEvent(new Event("input",{bubbles:true}));}})()');await textClick('.image-controls button','应用裁剪');await imageReady('图片.png',80,50);await dirty(true);await resetImage();await imageReady('图片.png',240,160);
      await insert('brightness','50');await dirty(true);const version=await fetch('http://127.0.0.1:'+debugPort+'/json/version').then(r=>r.json());const browserSocket=new WebSocket(version.webSocketDebuggerUrl);sockets.add(browserSocket);await new Promise(r=>browserSocket.addEventListener('open',r,{once:true}));const browser=connect(browserSocket);const mainPid=(await browser.command('SystemInfo.getProcessInfo')).processInfo.find(p=>p.type==='browser').id;
      const exitRequest=evaluate('window.scodex.quitApp()');const retained=await nativeImageDialog(mainPid,'KeepEditing');assert.match(retained.stdout,/native-image-warning-keep-editing/);await exitRequest;await dirty(true);assert.equal((await evaluate('window.scodex.getAppState().then(s=>s.version)')),'1.3.3');
      const exported=path.join(project,'手工导出.png');await textClick('.image-view .heading-actions button','导出 PNG');
      const native=await nativeImageDialog(mainPid,'Save',exported);assert.match(native.stdout,/selected-native-save-target/);
      await wait(async()=>{try{return(await fs.stat(exported)).size>0;}catch{return false;}},'Actual native export saved');await imageReady('手工导出.png',240,160);await dirty(false);const out=decodePng(await fs.readFile(exported));assert.deepEqual(out.pixel(20,20),[120,10,10,255]);browserSocket.close();return{cropDirtyAndReset:true,nativeDialog:true,cleanExport:true,pixel:out.pixel(20,20)};
    });
    await check('help-entry-and-layout',async()=>{
      await openProjectFile('图片.png');const samples=[];
      for(const[width,height]of[[1440,900],[1080,700]]){await cdp.command('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});samples.push(await evaluate('(()=>{const p=document.querySelector(".image-note"),b=[...document.querySelectorAll(".image-view .heading-actions button")];return{width:innerWidth,height:innerHeight,scroll:document.documentElement.scrollWidth,font:getComputedStyle(p).fontFamily,size:getComputedStyle(p).fontSize,buttonBounds:b.map(e=>({text:e.innerText,x:e.getBoundingClientRect().x,right:e.getBoundingClientRect().right,top:e.getBoundingClientRect().top,bottom:e.getBoundingClientRect().bottom})),canvas:!!document.querySelector(".image-canvas")}})()'));}
      for(const s of samples){assert.ok(s.scroll<=s.width);assert.match(s.font,/YaHei|微软雅黑/);assert.ok(parseFloat(s.size)>=14);assert.ok(s.buttonBounds.every(b=>b.x>=0&&b.right<=s.width));}
      await textClick('.image-view .heading-actions button','让 AI 处理图片');await wait(()=>evaluate('!!document.querySelector("[aria-label=输入工作内容]")'),'Image AI entry');assert.equal(await evaluate('document.querySelector("[aria-label=执行任务]").getAttribute("aria-pressed")'),'true');assert.match(await evaluate('document.querySelector("[aria-label=输入工作内容]").value'),/图片.png/);
      await tool('images');await cdp.command('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});await fs.writeFile(path.join(output,'image-workbench.png'),Buffer.from((await cdp.command('Page.captureScreenshot',{format:'png'})).data,'base64'));return samples;
    });
    await check('project-switch-pending-image',async()=>{
      const second=path.join(temporary,'second-project');await fs.mkdir(second,{recursive:true});
      await evaluate('document.querySelector(".activity-rail [aria-label=项目]").click()');
      if(!await evaluate('[...document.querySelectorAll(".project-item")].some(e=>e.title==='+json(second)+')')) {
        await click('创建项目');await insert('项目名称','图片切换验收');await insert('项目文件夹',second);await textClick('.project-editor-actions button','创建项目');await wait(()=>evaluate('window.scodex.getAppState().then(s=>s.workspaceRoot==='+json(second)+')'),'Created second project');
      }
      const select=async target=>{await evaluate('document.querySelector(".activity-rail [aria-label=项目]").click()');await evaluate('[...document.querySelectorAll(".project-item")].find(e=>e.title==='+json(target)+').click()');await wait(()=>evaluate('[...document.querySelectorAll(".project-item")].some(e=>e.title==='+json(target)+'&&e.getAttribute("aria-current")==="true")'),'Project selected');};
      await select(second);await select(project);await tool('files');
      await evaluate('(()=>{window.__realImage=window.Image;window.__imageDecoded=false;window.Image=function(...args){const image=new window.__realImage(...args);let onload;Object.defineProperty(image,"onload",{get:()=>onload,set:fn=>{onload=fn}});image.addEventListener("load",event=>{window.__imageDecoded=true;window.__releaseImage=()=>onload.call(image,event);},{once:true});return image;};})()');
      try {
        await wait(()=>evaluate('[...document.querySelectorAll(".file-tree-item")].some(e=>e.title==="图片.png")'),'Race image file');
        await evaluate('[...document.querySelectorAll(".file-tree-item")].find(e=>e.title==="图片.png").click()');await wait(()=>evaluate('window.__imageDecoded'),'Real image decoded with delayed callback');
        await select(second);await evaluate('window.Image=window.__realImage;window.__releaseImage()');await new Promise(r=>setTimeout(r,250));await tool('images');
        assert.equal(await evaluate('!!document.querySelector(".image-canvas")'),false,'Old project image must not appear after project reset');
        return{controlledDelay:'only the real image load callback is held; file read and decoding are real',secondWorkspaceEmpty:true};
      } finally {await evaluate('window.Image=window.__realImage;delete window.__releaseImage');await select(project);}
    });
    await check('history-restart',async()=>{
      await selectWorkflow();await wait(()=>evaluate('window.scodex.getAppState().then(s=>s.library.activeId==='+json(workflowId)+')'),'Saved active workflow');await quit();await launch();await selectWorkflow();const m=await stored(m=>m.operations?.length===3);assert.ok(m.operations.every(o=>o.status==='succeeded'&&o.screenshot?.dataUrl));assert.equal(Boolean(m.approval),false);assert.equal(await evaluate('!!document.querySelector(".agent-approval")'),false);await evaluate('document.querySelector(".agent-operation>summary").click()');await textClick('.agent-operation button','在图片中查看');await imageReady('图片.png',240,160);return{operations:3,thumbnails:3,noLiveApproval:true,openFromHistory:true};
    });
    await quit();appChild=null;report.status='passed';report.completedAt=new Date().toISOString();report.requests=requests;await save();
  }catch(error){report.status='failed';report.error=error.stack;report.requests=requests;await save();console.error(error.stack);}
  finally{
    if(appChild&&cdp){try{await quit();appChild=null;}catch(e){report.cleanupError=e.message;}}
    for(const s of sockets)s.close();if(modelServer)await new Promise(r=>modelServer.close(r));report.processExited=!appChild||appChild.exitCode!==null;await save();console.log('RESULT '+report.status);if(report.status!=='passed')process.exitCode=1;
  }
}
if(require.main===module)main();
