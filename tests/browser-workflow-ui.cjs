// Actual portable EXE + Chromium pages. Only deterministic model replies and controlled web data are fixtures.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const http = require('node:http');
const { spawn, execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { connect, wait, freePort } = require('./agent-workflow-ui.cjs');
const execFileAsync = promisify(execFile);
const root = path.resolve(__dirname, '..'), output = path.join(root,'release/browser-runtime-20261024');
const executable = path.join(output,'Scodex-Workbench-1.3.0-x64.exe');
const temporary = process.env.SCODEX_BROWSER_FIXTURE || path.join(os.tmpdir(),'scodex-browser-ui-'+crypto.randomUUID());
const profile = path.join(temporary,'profile'), workspace = path.join(temporary,'project'), fakeRoot = path.join(temporary,'scodex');
const only = new Set((process.env.SCODEX_BROWSER_ONLY || '').split(',').filter(Boolean));
const report = {status:'running',version:'1.3.0',executable,checks:[],fixtureDirectory:temporary,environment:{platform:os.platform(),release:os.release(),node:process.version},limitations:['CDP drives the real EXE renderer; native mouse/keyboard delivery by the test driver is not claimed. The product sends its own Chromium key input.','Model replies and target website data are controlled local fixtures; actual Electron/Chromium DOM, IPC, UI and web effects are real. Public relay is tested separately.']};
const json=JSON.stringify, requests=[], effects=[],webRequests=[],sockets=new Set();
let cdp,socket,child,server,port,base,manualId,priorTab,workflowChat,slowStarted=0,slowCancelled=0;
const selected=(id)=>!only.size||only.has(id);
async function check(id,fn){if(!selected(id))return;const evidence=await fn();report.checks.push({id,status:'passed',evidence,sha256:report.sha256});await save();console.log('PASS '+id);}
async function save(){await fs.writeFile(path.join(output,'browser-ui-verification.json'),json(report));}
async function click(label){await wait(()=>cdp.evaluate('(()=>{const e=document.querySelector('+json('[aria-label="'+label+'"]')+');if(!e||e.disabled)return false;e.click();return true})()'),'Button '+label);}
async function textClick(selector,text){await wait(()=>cdp.evaluate('(()=>{const e=[...document.querySelectorAll('+json(selector)+')].find(e=>e.textContent.trim()==='+json(text)+');if(!e||e.disabled)return false;e.click();return true})()'),'Text '+text);}
async function insert(label,value){await cdp.evaluate('(()=>{const e=document.querySelector('+json('[aria-label="'+label+'"]')+');if(!e)throw Error("Input missing");const p=e instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(p,"value").set.call(e,'+json(value)+');e.dispatchEvent(new Event("input",{bubbles:true}));return true})()');}
async function state(){return cdp.evaluate('window.scodex.getBrowserState()');}
async function chat(execution=true){const current=await state();if(current.tabs.length>=8)for(const tab of current.tabs.filter(t=>t.ai).slice(0,4))await cdp.evaluate('window.scodex.browserAction('+json({type:'close',id:tab.id})+')');await cdp.evaluate('document.querySelector(".activity-rail [aria-label=项目]").click()');await click('新聊天');await wait(()=>cdp.evaluate('!document.querySelector(".message-list")'),'New chat');if(execution)await click('执行任务');}
async function submit(id){await insert('输入工作内容','SCODEX_BROWSER_CASE:'+id);await click('发送消息');}
async function finish(){await wait(()=>cdp.evaluate('!document.querySelector("[aria-label=停止生成]")'),'Generation finished',45000);await cdp.evaluate('document.querySelectorAll(".agent-operation.failed > summary").forEach(e=>{if(!e.parentElement.open)e.click()})');return cdp.evaluate('document.querySelector(".message-list")?.innerText||""');}
async function pendingApproval(){return wait(()=>cdp.evaluate('document.querySelector(".agent-approval")?.innerText'),'Browser approval',35000);}
async function approve(allowed=true){const text=await pendingApproval();await textClick('.agent-approval-actions button',allowed?'允许本次网页操作':'拒绝');return text;}
async function untilDone(callback){let count=0;while(count<22){const state=await wait(()=>cdp.evaluate('document.querySelector(".agent-approval")?"approval":!document.querySelector("[aria-label=停止生成]")?"done":false'),'Approval or finish',40000);if(state==='done')return count;if(callback)await callback(count);await approve();count++;}throw Error('Approval limit');}
async function setProtocol(protocol){await cdp.evaluate('window.scodex.saveModelConnection('+json({name:'浏览器实际验收',baseUrl:base+'/v1',model:'controlled-browser-model',models:['controlled-browser-model'],toolProtocol:protocol,apiKey:'controlled-only'})+')');}
async function enableAI(){await click('设置');await textClick('.settings-category-list button','浏览器');const enabled=await cdp.evaluate('document.querySelector("[aria-label=\\"允许 AI 使用内置浏览器\\"]").getAttribute("aria-checked")');if(enabled!=='true')await click('允许 AI 使用内置浏览器');await wait(()=>cdp.evaluate('window.scodex.getAppState().then(s=>s.preferences.browserAiEnabled)'),'AI setting persisted');}
async function pageConnection(fragment='/page'){const target=await wait(async()=>(await fetch('http://127.0.0.1:'+port+'/json/list').then(r=>r.json())).find(v=>v.type==='page'&&v.url.startsWith(base+fragment)),'Web page target');const ws=new WebSocket(target.webSocketDebuggerUrl);sockets.add(ws);await new Promise(r=>ws.addEventListener('open',r,{once:true}));return connect(ws);}
function reply(res,value){res.writeHead(200,{'content-type':'text/event-stream; charset=utf-8'});res.end('data: '+json({choices:[{delta:value}]})+'\n\ndata: '+json({choices:[{delta:{},finish_reason:value.tool_calls?'tool_calls':'stop'}]})+'\n\ndata: [DONE]\n\n');}
function call(name,args){return{tool_calls:[{index:0,id:'call_'+crypto.randomBytes(6).toString('hex'),type:'function',function:{name,arguments:json(args)}}]};}
const textOf=v=>typeof v==='string'?v:Array.isArray(v)?v.filter(p=>p.type==='text').map(p=>p.text).join('\n'):'';
async function model(body,res){
 const prompt=body.messages.find(m=>m.role==='user'&&textOf(m.content).includes('SCODEX_BROWSER_CASE:'));
 const id=textOf(prompt?.content).split('SCODEX_BROWSER_CASE:')[1]?.split('\n')[0]||'unknown';
 const structured=body.messages[0]?.content.includes('中转兼容执行通道');
 const results=body.messages.filter(m=>m.role==='tool'||m.role==='user'&&textOf(m.content).startsWith('本机工具实际结果')).map(m=>JSON.parse(m.role==='tool'?m.content:m.content.slice(m.content.indexOf('\n')+1)));
 const names=(body.tools||[]).map(t=>t.function.name),i=results.length;
 requests.push({case:id,step:i,names,images:body.messages.flatMap(m=>Array.isArray(m.content)?m.content.filter(v=>v.type==='image_url'):[]).length,structured});
 const emit=(value)=>{if(!structured)return reply(res,value);const c=value.tool_calls?.[0];reply(res,{content:json(c?{type:'tool',name:c.function.name,arguments:JSON.parse(c.function.arguments)}:{type:'final',content:value.content})});};
 const done=(content='本轮网页验收完成')=>emit({content});
 const tab=results[0]?.tab?.id, snap=[...results].reverse().find(r=>r.snapshot_id);
 const target=(label)=>{const e=snap?.elements.find(e=>e.name===label);assert.ok(e,'Missing actual element '+label+' '+json(snap));return{tab_id:tab,snapshot_id:snap.snapshot_id,ref:e.ref};};
 const open=()=>emit(call('browser_open',{url:base+'/page'}));
 const read=()=>emit(call('browser_snapshot',{tab_id:tab}));
 if(['dialogue','disabled','never'].includes(id)){assert.equal(names.some(n=>n.startsWith('browser_')),false);return done('当前模式没有浏览器工具');}
 if(id==='network-block'){if(!i)return emit(call('browser_open',{url:'https://scodex-network-denied.invalid/page'}));assert.equal(results[0].ok,false);return done('网络阻止已生效');}
 if(id==='cross-chat'){if(!i)return emit(call('browser_snapshot',{tab_id:priorTab}));assert.equal(results[0].ok,false);return done('跨对话访问已拒绝');}
 if(id==='slow'){if(!i)return emit(call('browser_open',{url:base+'/slow'}));return emit(call('browser_open',{url:base+'/should-not-run'}));}
 if(id==='redirect'){if(!i)return emit(call('browser_open',{url:base+'/redirect'}));assert.equal(results[0].ok,false);return done('重定向已阻止');}
 if(id==='basic'||id==='json'){
   assert.equal(results.every(r=>r.ok),true,'Actual tool failure '+json(results.at(-1)));
   const steps=[
    open,read,()=>emit(call('browser_fill',{...target('记录标题'),text:'实际中文填入'})),read,
    ()=>emit(call('browser_click',target('保存记录'))),
    async()=>{await wait(()=>Promise.resolve(effects.some(e=>e.kind==='record'&&e.title==='实际中文填入')),'Real web POST');return read();},
    ()=>emit(call('browser_fill',{...target('按键文本'),text:'键盘中文'})),read,
    ()=>emit(call('browser_press_key',{...target('按键文本'),key:'Enter'})),
    async()=>{await wait(()=>Promise.resolve(effects.some(e=>e.kind==='key'&&e.value==='键盘中文')),'Actual product Enter event');return read();},
    ()=>emit(call('browser_screenshot',{tab_id:tab})),
    ()=>{const images=body.messages.flatMap(m=>Array.isArray(m.content)?m.content.filter(v=>v.type==='image_url'):[]);assert.ok(images.length);const bytes=Buffer.from(images.at(-1).image_url.url.split(',')[1],'base64');assert.equal(bytes[0],255);assert.equal(bytes[1],216);assert.ok(bytes.length>2000);report.visionMessage={bytes:bytes.length,mime:'image/jpeg',actualChromiumCapture:true};return emit(call('browser_scroll',{tab_id:tab,y:600}));},
    read,
    ()=>{assert.ok(snap.viewport.scroll_y>0);return done('真实网页填入、点击、按键、截图和滚动已完成');}
   ];
   return steps[i]?steps[i]():done();
 }
 if(id==='planning'){assert.equal(names.includes('browser_click'),false);assert.equal(names.includes('browser_fill'),false);assert.equal(names.includes('browser_press_key'),false);if(!i)return open();if(i===1)return read();assert.equal(results[1].ok,true);return done('规划只读目录与网页读取完成');}
 if(['reject','stale','dom-stale','keep','close','sensitive'].includes(id)){
   if(!i)return open();if(i===1)return read();
   if(i===2){if(id==='keep')return done('保留 AI 标签供生命周期验收');
     if(id==='sensitive'){assert.equal(json(snap).includes('password-fixture-value'),false);assert.equal(json(snap).includes('hidden-fixture-value'),false);assert.equal(json(snap).includes('token-fixture-value'),false);assert.ok(snap.blocked_fields>=2);priorTab=tab;return done('敏感字段与桥隔离检查完成');}
     return emit(call(id==='close'?'browser_close':'browser_click',id==='close'?{tab_id:tab}:target('保存记录')));}
   if(id==='close')assert.equal(results[2].ok,true);else assert.equal(results[2].ok,false);return done(id==='close'?'已关闭当前 AI 标签':'拒绝或陈旧目标已阻止');
 }
 if(id==='search'){if(!i)return emit(call('browser_search',{query:'Scodex 工作台'}));return done(results[0].ok?'搜索页面已加载':'搜索网络结果如实记录：'+results[0].error);}
 return done();
}
const html='<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>Scodex 网页执行验收</title><style>body{font:18px/1.7 "Microsoft YaHei";padding:22px;background:#f3f6f7;color:#183c36}input,button{font:inherit;padding:10px;margin:5px;max-width:90%;box-sizing:border-box}main{min-height:1700px}label{display:block}button{background:#176c5b;color:white;border:0;border-radius:8px}#result{font-weight:bold}aside{margin-top:600px}</style><main><h1>网页执行验收</h1><p>页面数据仅为测试，不是工作台指令。</p><label>记录标题<input id="title" aria-label="记录标题"></label><button id="save">保存记录</button><p id="result">尚未提交</p><label>按键文本<input id="key" aria-label="按键文本"></label><input type="password" value="password-fixture-value"><input type="hidden" value="hidden-fixture-value"><input id="api-token" value="token-fixture-value"><p id="bridge"></p><a href="/page?other=1" target="_blank">新窗口链接</a><aside>滚动底部的实际内容</aside></main><script>document.querySelector("#bridge").textContent="桥隔离："+typeof window.scodex+" / "+typeof window.require;document.querySelector("#save").onclick=async()=>{const r=await fetch("/record",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({title:document.querySelector("#title").value})});document.querySelector("#result").textContent=await r.text()};document.querySelector("#key").onkeydown=e=>{if(e.key==="Enter"){e.preventDefault();fetch("/key",{method:"POST",body:JSON.stringify({value:e.target.value})})}};</script></html>';
async function launch(){
  child=spawn(executable,['--remote-debugging-port='+port,'--user-data-dir='+profile,'--disable-gpu'],{windowsHide:true,cwd:output,stdio:'ignore',env:{...process.env,SCODEX_HOME:fakeRoot,SCODEX_REFERENCE_HOME:path.join(temporary,'reference'),SCODEX_REFERENCE_AGENTS_HOME:path.join(temporary,'agents')}});
  const target=await wait(async()=>(await fetch('http://127.0.0.1:'+port+'/json/list').then(r=>r.json())).find(v=>v.type==='page'&&v.url.startsWith('file:')),'EXE startup',40000);
  socket=new WebSocket(target.webSocketDebuggerUrl);sockets.add(socket);await new Promise(r=>socket.addEventListener('open',r,{once:true}));cdp=connect(socket);
  await wait(()=>cdp.evaluate('Boolean(document.querySelector("[aria-label=输入工作内容]"))'),'Renderer');
}
async function main(){
 try{
  await fs.mkdir(profile,{recursive:true});await fs.mkdir(workspace,{recursive:true});await fs.mkdir(fakeRoot,{recursive:true});
  if(!process.env.SCODEX_BROWSER_FIXTURE){await fs.writeFile(path.join(profile,'settings.json'),json({workspaceRoot:workspace,preferences:{browserPanelOpen:false,trayEnabled:false}}));await fs.writeFile(path.join(fakeRoot,'codex-settings.json'),json({sandboxMode:'danger-full-access',approvalPolicy:'on-request',workspaceDependencies:false}));}
  report.sha256=crypto.createHash('sha256').update(await fs.readFile(executable)).digest('hex');
  server=http.createServer(async(req,res)=>{try{
    webRequests.push({url:req.url,host:req.headers.host,cookie:req.headers.cookie||''});
    if(req.url==='/v1/chat/completions'){let raw='';for await(const chunk of req)raw+=chunk;return await model(JSON.parse(raw),res);}
    if(req.url==='/slow'){slowStarted++;req.on('close',()=>slowCancelled++);return;}
    if(req.url==='/redirect'){res.writeHead(302,{location:'http://localhost:'+server.address().port+'/blocked-target'});return res.end();}
    if(req.url==='/record'||req.url==='/key'){let raw='';for await(const chunk of req)raw+=chunk;effects.push({kind:req.url.slice(1),...JSON.parse(raw)});res.writeHead(200,{'content-type':'text/plain; charset=utf-8'});return res.end('已保存：'+JSON.parse(raw).title);}
    if(req.url==='/manual')res.setHeader('set-cookie','manual_session=manual-fixture; SameSite=Lax');
    res.writeHead(200,{'content-type':'text/html; charset=utf-8'});res.end(html);
  }catch(e){report.fixtureError=e.stack;if(!res.headersSent)res.writeHead(500);res.end();}});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+server.address().port;port=await freePort();
  await launch();
  const identity=await cdp.evaluate('window.scodex.getAppState().then(s=>({version:s.version,workspaceRoot:s.workspaceRoot,enabled:s.preferences.browserAiEnabled}))');assert.equal(identity.version,'1.3.0');
  await cdp.evaluate('window.scodex.saveAgentSettings({sandboxMode:"danger-full-access",approvalPolicy:"on-request",networkAccess:true,networkDomains:["*"],allowLocalBinding:true},"shared")');
  await cdp.evaluate('window.scodex.saveModelConnection('+json({name:'浏览器实际验收',baseUrl:base+'/v1',model:'controlled-browser-model',models:['controlled-browser-model'],toolProtocol:'native',apiKey:'controlled-only'})+')');await cdp.evaluate('location.reload()');await wait(()=>cdp.evaluate('Boolean(document.querySelector("[aria-label=输入工作内容]"))'),'Reload');
  await check('identity-default-off',async()=>{assert.equal(identity.enabled,false);await chat();await submit('disabled');assert.match(await finish(),/没有浏览器/);return identity;});
  await enableAI();
  await check('setting-real-ui-and-persistence',async()=>{const app=await cdp.evaluate('window.scodex.getAppState()');const disk=JSON.parse(await fs.readFile(path.join(profile,'settings.json'),'utf8'));assert.equal(app.preferences.browserAiEnabled,true);assert.equal(disk.preferences.browserAiEnabled,true);return{realSwitch:true,persisted:true};});
  const manual=await cdp.evaluate('window.scodex.browserAction('+json({type:'new',url:base+'/manual'})+')');manualId=manual.activeId;await wait(async()=>(await state()).tabs.some(t=>t.id===manualId&&!t.loading),'Manual page ready');
  await check('actual-browser-roundtrip',async()=>{await chat();workflowChat=(await cdp.evaluate('window.scodex.getAppState()')).library.activeId;await submit('basic');const approvals=await untilDone();const text=await finish();assert.match(text,/真实网页填入/);assert.equal(effects.filter(e=>e.kind==='record').length,1);assert.equal(effects.filter(e=>e.kind==='key').length,1);const s=await state();const tab=s.tabs.find(t=>t.ai);assert.ok(tab);priorTab=tab.id;const page=await pageConnection();const probe=await page.evaluate('({bridge:typeof window.scodex,require:typeof window.require,cookie:document.cookie})');assert.deepEqual(probe,{bridge:'undefined',require:'undefined',cookie:''});assert.equal(webRequests.filter(r=>r.url==='/page').every(r=>!r.cookie.includes('manual_session')),true);return{approvals,effects:[...effects],bridge:probe,...report.visionMessage};});
  await check('json-channel-browser-images',async()=>{const before=effects.length;await setProtocol('json');await chat();await submit('json');const approvals=await untilDone();assert.match(await finish(),/真实网页填入/);assert.equal(effects.length,before+2);await setProtocol('native');return{approvals,actualEffects:2};});
  await check('refusal-prevents-side-effect',async()=>{const before=effects.length;await chat();await submit('reject');await approve();await approve();const approval=await approve(false);assert.match(approval,/保存记录/);await finish();assert.equal(effects.length,before);return{effectsUnchanged:true};});
  await check('navigation-invalidates-approved-reference',async()=>{const before=effects.length;await chat();await submit('stale');await approve();await approve();await pendingApproval();const s=await state();await cdp.evaluate('window.scodex.browserAction('+json({type:'navigate',id:s.activeId,url:base+'/page?changed=1'})+')');await wait(async()=>!(await state()).tabs.find(t=>t.id===s.activeId)?.loading,'Changed page loaded');await approve();assert.match(await finish(),/变化|失效/);assert.equal(effects.length,before);return{navigationGuard:true};});
  await check('dom-replacement-invalidates-target',async()=>{const before=effects.length;await chat();await submit('dom-stale');await approve();await approve();await pendingApproval();const page=await pageConnection();await page.evaluate('document.querySelector("#save").textContent="替换后的按钮"');await approve();assert.match(await finish(),/变化|失效/);assert.equal(effects.length,before);return{fingerprintGuard:true};});
  await check('sensitive-fields-and-chat-ownership',async()=>{await chat();await submit('sensitive');await untilDone();assert.match(await finish(),/敏感字段/);await chat();await submit('cross-chat');assert.match(await finish(),/跨对话访问/);assert.equal(await cdp.evaluate('Boolean(document.querySelector(".agent-approval"))'),false);return{secretsOmitted:true,crossChatDenied:true};});
  await check('stop-cancels-load',async()=>{await chat();await submit('slow');await approve();await wait(()=>Promise.resolve(slowStarted>0),'Slow request');await click('停止生成');await finish();await wait(()=>Promise.resolve(slowCancelled>0),'Navigation cancelled');assert.equal(webRequests.some(r=>r.url==='/should-not-run'),false);return{slowStarted,slowCancelled,laterRequest:false};});
  await check('planning-read-only',async()=>{await chat();await click('添加工具和上下文');await textClick('.composer-menu-item','计划模式开启计划模式');await submit('planning');await untilDone();assert.match(await finish(),/规划只读/);return{writeToolsOmitted:true};});
  await check('dialogue-and-never-policy',async()=>{await chat(false);await submit('dialogue');assert.match(await finish(),/没有浏览器/);await cdp.evaluate('window.scodex.saveAgentSettings({approvalPolicy:"never"},"shared")');await chat();await submit('never');assert.match(await finish(),/没有浏览器/);await cdp.evaluate('window.scodex.saveAgentSettings({approvalPolicy:"on-request"},"shared")');return true;});
  await check('network-and-redirect-rules',async()=>{
    await cdp.evaluate('window.scodex.saveAgentSettings({networkAccess:true,networkDomains:["allowed.invalid"],allowLocalBinding:true,networkConfigured:true},"shared")');await chat();await submit('network-block');assert.match(await finish(),/网络阻止/);
    await cdp.evaluate('window.scodex.saveAgentSettings({networkAccess:true,networkDomains:["*"],allowLocalBinding:true},"shared")');await cdp.evaluate('window.scodex.savePreferences({browserSiteRules:[{host:"localhost",browse:"block"}]})');await chat();await submit('redirect');await approve();assert.match(await finish(),/阻止/);assert.equal(webRequests.some(r=>r.url==='/blocked-target'),false);await cdp.evaluate('window.scodex.savePreferences({browserSiteRules:[]})');return{preApprovalNetworkBlock:true,redirectBlockedBeforeRequest:true};
  });
  await check('close-owned-tab',async()=>{await chat();await submit('close');await untilDone();assert.match(await finish(),/已关闭/);return{closedThroughTool:true};});
  await check('public-search-result',async()=>{await chat();await submit('search');await untilDone();const text=await finish();const tab=(await state()).tabs.find(t=>t.ai&&t.url.startsWith('https://www.bing.com/search?'));report.publicSearch={loaded:Boolean(tab&&!tab.error),url:tab?.url||'',error:tab?.error||'',answer:text.slice(-500)};return report.publicSearch;});
  await check('settings-and-history-layout',async()=>{
    await enableAI();const sizes=[];for(const[width,height]of[[1440,900],[1080,700]]){await cdp.command('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});const g=await cdp.evaluate('(()=>{const e=document.querySelector(".settings-detail"),s=document.querySelector("[aria-label=\\"允许 AI 使用内置浏览器\\"]");return{overflow:document.documentElement.scrollWidth>innerWidth+1,font:getComputedStyle(e).fontFamily,size:getComputedStyle(e).fontSize,switchName:s.getAttribute("aria-label")}})()');assert.equal(g.overflow,false);assert.match(g.font,/Microsoft YaHei/);assert.equal(g.size,'16px');sizes.push({width,height,...g});}await cdp.command('Emulation.clearDeviceMetricsOverride');return sizes;
  });
  await check('project-reset-preserves-manual-tabs',async()=>{
    await chat();await submit('keep');await untilDone();await finish();assert.ok((await state()).tabs.some(t=>t.ai));
    const other=path.join(temporary,'project-two');await fs.mkdir(other,{recursive:true});await click('创建项目');await insert('项目名称','浏览器项目切换验收');await insert('项目文件夹',other);await textClick('.project-editor-actions button','创建项目');await wait(()=>cdp.evaluate('!document.querySelector(".project-editor")'),'Project switched');const current=await state();assert.equal(current.tabs.some(t=>t.ai),false);assert.ok(current.tabs.some(t=>t.id===manualId));return{aiClosed:true,manualPreserved:true};
  });
  await check('restart-keeps-history-not-ai-sessions',async()=>{
    const library=await cdp.evaluate('window.scodex.getAppState().then(s=>s.library)');const screenshot=library.conversations.flatMap(c=>c.messages).flatMap(m=>m.operations||[]).find(o=>o.screenshot);if(selected('actual-browser-roundtrip'))assert.ok(screenshot?.screenshot.dataUrl.startsWith('data:image/jpeg;base64,'));
    await cdp.evaluate('window.scodex.quitApp()');await wait(()=>Promise.resolve(child.exitCode!==null),'Actual full exit',20000);socket.close();port=await freePort();await launch();assert.equal((await state()).tabs.some(t=>t.ai),false);const restored=await cdp.evaluate('window.scodex.getAppState().then(s=>s.library)');if(screenshot)assert.ok(restored.conversations.flatMap(c=>c.messages).flatMap(m=>m.operations||[]).some(o=>o.screenshot));return{previewPersisted:Boolean(screenshot),approvalsRestored:false,fullExeRestart:true};
  });
  // Final state: show a fresh readable AI page and the actual operation history.
  await chat();await submit('keep');await untilDone();await finish();
  await cdp.evaluate('document.querySelectorAll(".agent-operation > summary").forEach(e=>{if(!e.parentElement.open)e.click()})');
  const capture=await cdp.command('Page.captureScreenshot',{format:'png'});await fs.writeFile(path.join(output,'browser-workbench.png'),Buffer.from(capture.data,'base64'));report.screenshot=path.join(output,'browser-workbench.png');
  report.status='passed';
 }catch(e){report.status='failed';report.error=e.stack;console.error(e);process.exitCode=1;try{report.visibleText=await cdp.evaluate('document.body.innerText');report.browserState=await state();}catch{}}
 finally{
  try{if(socket?.readyState===1){await cdp.evaluate('window.scodex.quitApp()');await wait(()=>Promise.resolve(child.exitCode!==null),'Quit',20000);}}catch(e){report.quitError=e.message;}
  for(const ws of sockets)ws.close();
  if(child?.exitCode===null)child.kill();
  try{const script="$needle='"+profile.replaceAll("'","''")+"';Get-CimInstance Win32_Process -Filter \"Name='Scodex工作台.exe'\" | Where-Object {$_.CommandLine -and $_.CommandLine.Contains($needle) -and $_.CommandLine -notmatch '--type='} | Select-Object -ExpandProperty ProcessId";const r=await execFileAsync('powershell.exe',['-NoLogo','-NoProfile','-NonInteractive','-Command',script],{windowsHide:true,timeout:7000});const pids=r.stdout.trim().split(/\s+/).filter(v=>/^\d+$/.test(v));for(const pid of pids)await execFileAsync('taskkill.exe',['/pid',pid,'/T','/F'],{windowsHide:true,timeout:8000});report.cleanedIsolatedProcesses=pids.map(Number);}catch(e){report.cleanupError=e.message;}
  server?.closeAllConnections();await new Promise(r=>server?.close(r)||r());
  report.finishedAt=new Date().toISOString();report.requests=requests;report.effects=effects;report.webRequests=webRequests.filter(r=>r.url!=='/v1/chat/completions');await save();console.log('RESULT '+report.status+' '+temporary);
 }
}
if(require.main===module)main();
