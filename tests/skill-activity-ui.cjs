// Actual packaged application; only model replies are deterministic loopback data.
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto'),http=require('node:http');
const {spawn}=require('node:child_process'),{connect,wait,freePort}=require('./agent-workflow-ui.cjs');
const root=path.resolve(__dirname,'..'),version=require('../package.json').version,json=JSON.stringify;
const output=path.resolve(process.env.SCODEX_ACTIVITY_OUTPUT||path.join(root,'release/delivery-'+version,'candidate-ui'));
const executable=process.env.SCODEX_ACTIVITY_EXE||path.join(root,'release/win-unpacked/Scodex工作台.exe');
const fixture=path.join(output,'fixture-'+crypto.randomUUID()),profile=path.join(fixture,'profile'),home=path.join(fixture,'home'),agents=path.join(fixture,'agents');
const report={status:'running',version,executable,fixture,checks:[],limitations:['Actual Electron/React/IPC/Windows encryption/commands/files; model replies replaced by loopback fixtures. No public model performance or quality claim.']};
let app,page,socket,server,workspace,held,workAnswer,singleAnswer;
const css=id=>'[data-message-id='+json(id)+']';
const state=()=>page.evaluate('window.scodex.getAppState()');
const chat=async()=>{const s=await state();return s.library.conversations.find(c=>c.id===s.library.activeId);};
async function click(selector){await wait(()=>page.evaluate('(()=>{const e=document.querySelector('+json(selector)+');if(!e||e.disabled)return false;e.click();return true})()'),'Click '+selector);}
async function check(name,fn){const evidence=await fn();report.checks.push({name,status:'passed',evidence});console.log('PASS '+name);}
async function send(prompt){const before=(await chat())?.messages.length||0;await page.evaluate('(()=>{const e=document.querySelector("[aria-label=输入工作内容]");Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,"value").set.call(e,'+json(prompt)+');e.dispatchEvent(new Event("input",{bubbles:true}));})()');await click('[aria-label="发送消息"]');return before;}
async function done(before){return wait(async()=>{const c=await chat(),m=c?.messages.at(-1);if(!m||c.messages.length<=before||m.role!=='assistant')return false;const status=await page.evaluate('document.querySelector('+json(css(m.id)+' .message-progress')+')?.dataset.state');if(status==='failed')throw Error(m.error);return status==='complete'&&m.content.trim()&&!m.operations.some(o=>['running','interrupted'].includes(o.status))?m:false;},'Completed answer and persisted operations',60000);}
async function reload(){const origin=await page.evaluate('performance.timeOrigin');await page.command('Page.reload');await wait(()=>page.evaluate('performance.timeOrigin!=='+origin+'&&Boolean(window.scodex&&document.querySelector("[aria-label=输入工作内容]"))'),'Reload');}
function reply(res,content,call){res.writeHead(200,{'content-type':'text/event-stream'});res.end('data: '+json({choices:[{delta:call?{tool_calls:[{index:0,id:crypto.randomUUID(),type:'function',function:{name:call.name,arguments:json(call.args)}}]}:{content},finish_reason:call?'tool_calls':'stop'}]})+'\n\ndata: [DONE]\n\n');}
async function model(req,res){
 let raw='';for await(const b of req)raw+=b;const body=JSON.parse(raw),at=body.messages.findLastIndex(m=>m.role==='user'),prompt=body.messages[at]?.content;
 const results=body.messages.slice(at+1).filter(m=>m.role==='tool').map(m=>JSON.parse(m.content)),step=results.length,tool=(name,args)=>reply(res,null,{name,args});
 if(prompt==='ACTIVITY-SINGLE'){assert.ok(!body.tools.some(t=>t.function.name.startsWith('skill_')));if(!step)return tool('run_command',{command:"Write-Output 'compact-proof'"});assert.equal(results[0].ok,true);return reply(res,'单条命令执行完成。');}
 if(prompt==='ACTIVITY-SKILLS'){
  assert.ok(body.messages[0].content.includes('DEFAULT-ACTIVITY-PRECONDITION'));assert.ok(!body.messages[0].content.includes('零至三个'));
  if(step===0)return tool('skill_search',{query:'activity'});
  const found=name=>results[0].entries.find(e=>e.name===name)?.id;
  if(step>=1&&step<=4)return tool('skill_open',{skill_id:found('activity-'+step)});
  if(step===5)return tool('skill_open',{skill_id:found('activity-copy')});
  if(step===6){assert.equal(results[5].reused,true);assert.equal(results[5].skill_name,'activity-1');return tool('skill_open',{skill_id:found('activity-1')});}
  if(step===7){assert.equal(results[6].reused,true);assert.equal(results[6].content,'');return tool('skill_open',{skill_id:'missing-activity-skill'});}
  assert.equal(results[7].ok,false);held=()=>reply(res,'五个互补 Skill 已使用，重复正文已复用。');return;
 }
 if(prompt==='ACTIVITY-APPROVAL'){
  if(step===0)return tool('read_file',{path:'readme.txt'});
  if(step===1)return tool('run_command',{command:"Write-Output 'approval-proof'"});
  assert.equal(results[1].ok,false);return reply(res,'审批已拒绝，命令没有执行。');
 }
 throw Error('Unexpected UI fixture prompt '+String(prompt));
}
async function main(){
 for(const directory of [output,profile,home,agents,path.join(fixture,'reference')])await fs.mkdir(directory,{recursive:true});
 for(const [name,description,body] of [['requirement-understanding','前置需求','DEFAULT-ACTIVITY-PRECONDITION'],...[1,2,3,4].map(i=>['activity-'+i,'activity distinct responsibility '+i,'ACTIVITY-GUIDANCE-'+i]),['activity-copy','activity copied package','ACTIVITY-GUIDANCE-1']]){const dir=path.join(agents,'skills',name);await fs.mkdir(dir,{recursive:true});await fs.writeFile(path.join(dir,'SKILL.md'),'---\nname: '+name+'\ndescription: '+description+'\n---\n'+body);}
 await fs.writeFile(path.join(profile,'settings.json'),json({projects:[],activeProjectId:'',preferences:{contextAccess:'full',skillsEnabled:false,browserPanelOpen:false,trayEnabled:false,closeToTray:false,closeConfirmation:'never',fontSize:16}}));
 await fs.writeFile(path.join(home,'codex-settings.json'),json({sandboxMode:'danger-full-access',approvalPolicy:'never',networkAccess:true,networkDomains:['*'],allowLocalBinding:true,workspaceDependencies:false,availableReasoningEfforts:['low'],defaultReasoningEffort:'low'}));
 server=http.createServer((req,res)=>model(req,res).catch(error=>{report.serverError=error.stack;if(!res.headersSent)res.writeHead(500);res.end();}));await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const port=await freePort();app=spawn(executable,['--remote-debugging-port='+port,'--user-data-dir='+profile,'--disable-gpu'],{cwd:output,windowsHide:true,stdio:['ignore','ignore','pipe'],env:{...process.env,SCODEX_HOME:home,SCODEX_REFERENCE_HOME:path.join(fixture,'reference'),SCODEX_REFERENCE_AGENTS_HOME:agents}});app.stderr.resume();
 const target=await wait(async()=>{if(app.exitCode!==null)throw Error('EXE exit '+app.exitCode);return(await fetch('http://127.0.0.1:'+port+'/json/list').then(r=>r.json())).find(p=>p.type==='page'&&p.url.startsWith('file:')&&!p.url.includes('workspaceWindow='));},'Packaged startup',45000);
 socket=new WebSocket(target.webSocketDebuggerUrl);await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});});page=connect(socket);
 await wait(()=>page.evaluate('Boolean(window.scodex&&document.querySelector("[aria-label=输入工作内容]"))'),'Renderer');const actual=await state();assert.equal(actual.version,version);workspace=actual.workspaceRoot;assert.ok(path.resolve(workspace).startsWith(path.resolve(fixture)+path.sep));
 await fs.writeFile(path.join(workspace,'readme.txt'),'real-file-proof\n');
 await page.evaluate('window.scodex.saveModelConnection('+json({name:'Skill 与紧凑操作验收',baseUrl:'http://127.0.0.1:'+server.address().port+'/v1',model:'fixture',models:['fixture'],apiKey:'local-fixture',retryLimit:0,toolProtocol:'native'})+')');await reload();
 await check('single-command-direct-compact-row-and-real-output',async()=>{
  singleAnswer=await done(await send('ACTIVITY-SINGLE'));assert.equal(singleAnswer.operations.length,1);
  const selector=css(singleAnswer.id),layout=await page.evaluate('(()=>{const e=document.querySelector('+json(selector+' .agent-operation > summary')+'),s=getComputedStyle(e);return {group:!!document.querySelector('+json(selector+' .agent-operation-group')+'),outerTag:document.querySelector('+json(selector+' .message-execution')+').tagName,height:e.getBoundingClientRect().height,font:parseFloat(s.fontSize)}})()');
  assert.equal(layout.group,false);assert.equal(layout.outerTag,'DIV');assert.ok(layout.height<=30);assert.ok(layout.font<=13);await click(selector+' .agent-operation > summary');
  assert.ok(await page.evaluate('document.querySelector('+json(selector+' .agent-operation-output')+').innerText.includes("compact-proof")'));return layout;
 });
 await page.evaluate('window.scodex.savePreferences({skillsEnabled:true})');await reload();await page.evaluate('window.__activityEvents=[];window.scodex.onChatEvent(e=>{if(e.type==="operation")window.__activityEvents.push(e.operation);});true');
 const before=await send('ACTIVITY-SKILLS');await wait(()=>Boolean(held),'Five distinct Skills loaded and duplicates attempted');
 await check('running-multiple-records-fold-and-Skill-load-names-are-visible',async()=>{
  const m=(await chat()).messages.at(-1);const selector=css(m.id);
  const ui=await page.evaluate('(()=>{const group=document.querySelector('+json(selector+' .agent-operation-group')+');return {open:group.open,summary:group.querySelector("summary").innerText,skills:document.querySelector('+json(selector+' .message-skill-notice')+').innerText,loadNames:window.__activityEvents.filter(e=>e.title==="加载 Skill").map(e=>e.detail)}})()');
  assert.equal(ui.open,false);assert.match(ui.summary,/1 失败/);for(const name of ['requirement-understanding',...Array.from({length:4},(_,i)=>'activity-'+(i+1))])assert.ok(ui.skills.includes(name),name);assert.ok(ui.loadNames.includes('activity-4'));return ui;
 });
 held();held=null;workAnswer=await done(before);
 await check('completed-summary-keeps-Skills-and-keyboard-expands-all-records',async()=>{
  const selector=css(workAnswer.id);assert.equal(workAnswer.operations.filter(o=>o.title==='使用 Skill').length,5);assert.equal(workAnswer.operations.filter(o=>o.title==='复用 Skill').length,2);
  assert.equal(await page.evaluate('document.querySelector('+json(selector+' .message-execution')+').open'),false);
  assert.ok(await page.evaluate('document.querySelector('+json(selector+' .message-execution-summary .message-skill-notice')+').getBoundingClientRect().width>0'));
  await click(selector+' .message-execution-summary');await page.evaluate('document.querySelector('+json(selector+' .agent-operation-group > summary')+').focus()');
  await page.command('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});await page.command('Input.dispatchKeyEvent',{type:'char',text:'\r'});await page.command('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
  await wait(()=>page.evaluate('document.querySelector('+json(selector+' .agent-operation-group')+').open'),'Keyboard group expansion');
  const rows=await page.evaluate('[...document.querySelectorAll('+json(selector+' .agent-operation > summary')+')].map(e=>({height:e.getBoundingClientRect().height,font:parseFloat(getComputedStyle(e).fontSize)}))');assert.ok(rows.every(r=>r.height<=30&&r.font<=13));
  await click(selector+' .agent-operation.failed > summary');assert.ok(await page.evaluate('document.querySelector('+json(selector+' .agent-operation.failed .agent-operation-output')+').innerText.includes("skill_search")'));
  return {operations:workAnswer.operations.length,actualLoads:5,reused:2,failed:1,rows};
 });
 await page.evaluate('window.scodex.saveAgentSettings({approvalPolicy:"on-request"},"shared")');
 await check('approval-remains-visible-outside-collapsed-group-and-rejection-does-not-run',async()=>{
  const count=await send('ACTIVITY-APPROVAL');await wait(()=>page.evaluate('Boolean(document.querySelector(".agent-approval"))'),'Command approval');
  const ui=await page.evaluate('(()=>{const e=document.querySelector(".agent-approval"),group=e.closest(".agent-activity").querySelector(".agent-operation-group");return {visible:e.getBoundingClientRect().height>0,insideGroup:!!e.closest(".agent-operation-group"),groupOpen:group.open}})()');assert.equal(ui.visible,true);assert.equal(ui.insideGroup,false);assert.equal(ui.groupOpen,false);
  await click('.agent-approval-actions .secondary-button');const m=await done(count);assert.equal(m.operations.filter(o=>o.name==='run_command'&&o.status==='succeeded').length,0);return ui;
 });
 await check('history-retains-Skill-notices-and-single-record-layout',async()=>{
  await reload();const c=await chat(),m=c.messages.find(m=>m.id===workAnswer.id);assert.equal(m.operations.filter(o=>o.title==='使用 Skill').length,5);
  const ui=await page.evaluate('({skills:document.querySelector('+json(css(workAnswer.id)+' .message-skill-notice')+').textContent,single:document.querySelector('+json(css(singleAnswer.id)+' .message-execution')+').tagName,folded:!document.querySelector('+json(css(workAnswer.id)+' .message-execution')+').open})');assert.equal(ui.single,'DIV');assert.equal(ui.folded,true);assert.ok(ui.skills.includes('activity-4'));return ui;
 });
 await check('narrow-controls-and-final-desktop-compact-visual',async()=>{
  const selector=css(workAnswer.id);await click(selector+' .message-execution-summary');await click(selector+' .agent-operation-group > summary');
  await page.command('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:false});await page.evaluate('document.querySelector('+json(selector)+').scrollIntoView({block:"center"})');
  const narrow=await page.evaluate('({width:innerWidth,scroll:document.documentElement.scrollWidth,rows:[...document.querySelectorAll('+json(selector+' .agent-activity-summary,'+selector+' .agent-operation > summary')+')].map(e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right,height:r.height}})})');assert.ok(narrow.scroll<=narrow.width);assert.ok(narrow.rows.every(r=>r.left>=0&&r.right<=narrow.width));
  await page.command('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});await page.evaluate('document.querySelector('+json(selector)+').scrollIntoView({block:"center"})');const shot=await page.command('Page.captureScreenshot',{format:'png'});await fs.writeFile(path.join(output,'compact-skill-activity.png'),Buffer.from(shot.data,'base64'));
  return {narrow,screenshot:'compact-skill-activity.png'};
 });
 assert.ok(!report.serverError,report.serverError);report.status='passed';report.workspace=workspace;
}
main().catch(error=>{report.status='failed';report.error=error.stack;process.exitCode=1;console.error(error);}).finally(async()=>{
 try{if(app?.exitCode===null&&page){if(await page.evaluate('Boolean(document.querySelector("[aria-label=停止生成]"))'))await click('[aria-label="停止生成"]');await page.evaluate('window.scodex.quitApp()');await wait(()=>app.exitCode!==null,'Normal exit',30000);assert.equal(app.exitCode,0);}}catch(error){report.shutdownError=error.stack;report.status='failed';process.exitCode=1;}
 socket?.close();if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}report.exitCode=app?.exitCode;report.finishedAt=new Date().toISOString();report.exeSha256=crypto.createHash('sha256').update(await fs.readFile(executable)).digest('hex');await fs.mkdir(output,{recursive:true});await fs.writeFile(path.join(output,'skill-activity-ui.json'),json(report,null,2));console.log(json({status:report.status,checks:report.checks.length,output}));
});
