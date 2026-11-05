// Explicit acceptance against the configured provider, with synthetic context only.
const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {spawn}=require('node:child_process');const {connect,wait,freePort}=require('./agent-workflow-ui.cjs');
if(process.env.SCODEX_EXTERNAL_CONTEXT!=='1'){console.log('Skipped: SCODEX_EXTERNAL_CONTEXT=1 required');process.exit(0);}
const root=path.resolve(__dirname,'..'),output=path.join(root,'release/delivery-1.3.37/external');
const fixture=path.join(output,'fixture-'+crypto.randomUUID()),profile=path.join(fixture,'profile'),home=path.join(fixture,'home'),reference=path.join(fixture,'reference'),agents=path.join(fixture,'agents');
const executable=process.env.SCODEX_CONTEXT_EXE||path.join(root,'release/win-unpacked/Scodex工作台.exe'),source=path.join(process.env.APPDATA,'scodex-workbench/model-connection.json');
const copied=path.join(profile,'model-connection.json'),json=JSON.stringify,digest=data=>crypto.createHash('sha256').update(data).digest('hex');
const report={status:'running',executable,fixture,scope:'Actual configured model, unchanged reasoning/credentials; isolated profile and synthetic workspace/rules/skills only. No original history, personal instructions or business files sent.'};
let child,socket,cdp,sourceHash;
(async()=>{
  for(const dir of [profile,home,reference,path.join(fixture,'.codex'),path.join(agents,'skills/requirement-understanding'),path.join(agents,'skills/acceptance-marker')])await fs.mkdir(dir,{recursive:true});
  const config=await fs.readFile(source);sourceHash=digest(config);await fs.writeFile(copied,config,{flag:'wx'});await fs.copyFile(path.join(path.dirname(source),'Local State'),path.join(profile,'Local State'));
  const publicConfig=JSON.parse(config).config;report.model=publicConfig.model;report.reasoningEffort=publicConfig.reasoningEffort;
  await fs.writeFile(path.join(home,'codex-settings.json'),json({sandboxMode:'danger-full-access',approvalPolicy:'never',networkAccess:true,networkDomains:['*'],allowLocalBinding:true,workspaceDependencies:false}));
  await fs.writeFile(path.join(profile,'settings.json'),json({projects:[],activeProjectId:'',preferences:{contextAccess:'full',closeConfirmation:'never',closeToTray:false}}));
  await fs.writeFile(path.join(reference,'AGENTS.md'),'这是合成验收规则，不涉及真实业务。最终答复必须包含 PERSONAL-137。');
  await fs.writeFile(path.join(agents,'skills/requirement-understanding/SKILL.md'),'---\nname: requirement-understanding\ndescription: 每次任务固定前置\n---\n先理解需求再执行。最终答复必须包含 DEFAULT-137。');
  await fs.writeFile(path.join(agents,'skills/acceptance-marker/SKILL.md'),'---\nname: acceptance-marker\ndescription: 验收标记写入、读取与确认\n---\n使用 skill_read 读取 reference.md 中标记，将标记单独一行写入 proof.txt，随后 read_file 回读确认。最多只需此技能和固定前置技能。');
  await fs.writeFile(path.join(agents,'skills/acceptance-marker/reference.md'),'唯一验收标记：PUBLIC-CONTEXT-ACCEPTED-137\n');
  const port=await freePort();child=spawn(executable,['--remote-debugging-port='+port,'--user-data-dir='+profile,'--disable-gpu'],{cwd:output,windowsHide:true,stdio:['ignore','ignore','pipe'],env:{...process.env,SCODEX_HOME:home,SCODEX_REFERENCE_HOME:reference,SCODEX_REFERENCE_AGENTS_HOME:agents}});child.stderr.resume();
  const target=await wait(async()=>{if(child.exitCode!==null)throw Error('EXE exit '+child.exitCode);return(await fetch('http://127.0.0.1:'+port+'/json/list').then(r=>r.json())).find(t=>t.type==='page'&&t.url.startsWith('file:'));},'Actual candidate start',45000);
  socket=new WebSocket(target.webSocketDebuggerUrl);await new Promise((r,j)=>{socket.addEventListener('open',r,{once:true});socket.addEventListener('error',j,{once:true});});cdp=connect(socket);
  await wait(()=>cdp.evaluate('Boolean(document.querySelector("[aria-label=输入工作内容]"))'),'Renderer ready');
  const state=await cdp.evaluate('window.scodex.getAppState()');report.version=state.version;assert.equal(state.version,require('../package.json').version);report.workspace=state.workspaceRoot;
  await fs.writeFile(path.join(state.workspaceRoot,'AGENTS.md'),'这是本项目的合成验收规则。先按真实目录查找适用技能，读取指引及引用资料，再写文件并回读。最终答复必须包含 PROJECT-137，必须如实列出使用的 Skill。');
  await cdp.evaluate('window.__publicEvents=[];window.__publicEnd=null;window.__publicText="";window.scodex.onChatEvent(e=>{if(["phase","request-metrics","operation"].includes(e.type))window.__publicEvents.push(e);if(e.type==="delta")window.__publicText+=e.delta||e.text||"";if(["complete","error","cancelled"].includes(e.type))window.__publicEnd=e;});true');
  const requestId=crypto.randomUUID();report.requestId=requestId;
  await cdp.evaluate('window.scodex.sendMessage('+json({requestId,conversationId:state.library.activeId,prompt:'请在此合成验收项目中完成验收标记写入并回读。自动选择适用 Skill，标记从技能引用资料读取，不要猜测。仅操作 proof.txt，无需命令和计划工具。最终简短答复并遵守已加载的规则。',mode:'answer',messages:[]})+').catch(e=>window.__publicEnd={type:"invoke-error",message:e.message});true');
  await wait(()=>cdp.evaluate('window.__publicEnd'),'Real provider terminal event',650000);
  const terminal=await cdp.evaluate('window.__publicEnd'),events=await cdp.evaluate('window.__publicEvents');report.terminalType=terminal.type;report.terminalMessage=terminal.message;report.requests=events.filter(e=>e.type==='request-metrics');
  report.operations=events.filter(e=>e.type==='operation').map(e=>({name:e.operation?.name,status:e.operation?.status}));
  report.response=terminal.content||terminal.text||await cdp.evaluate('window.__publicText');
  assert.equal(terminal.type,'complete',terminal.message);const data=await fs.readFile(path.join(state.workspaceRoot,'proof.txt'),'utf8');assert.equal(data.trim(),'PUBLIC-CONTEXT-ACCEPTED-137');report.fileHash=digest(Buffer.from(data));
  for(const name of ['skill_search','skill_open','skill_read','write_file','read_file'])assert.ok(report.operations.some(o=>o.name===name&&o.status==='succeeded'),'Missing actual '+name);
  for(const marker of ['PERSONAL-137','PROJECT-137','DEFAULT-137'])assert.ok(report.response.includes(marker),'Missing effective rule '+marker);
  assert.match(report.response,/acceptance-marker/);report.status='passed';
})().catch(e=>{report.status='failed';report.error=e.stack;process.exitCode=1;}).finally(async()=>{
  try{if(child?.exitCode===null&&cdp){await cdp.evaluate('window.scodex.quitApp()');await wait(()=>child.exitCode!==null,'Normal exit',30000);}}catch(e){report.shutdownError=e.stack;process.exitCode=1;}
  socket?.close();report.applicationExitCode=child?.exitCode;
  if(sourceHash)report.originalConnectionUnchanged=digest(await fs.readFile(source))===sourceHash;
  if(child?.exitCode!==null&&path.dirname(copied)===profile&&profile.startsWith(output+path.sep)){for(const file of [copied,path.join(profile,'Local State')])await fs.rm(file,{force:true});report.copiedEncryptedCredentialRemoved=true;}
  await fs.mkdir(output,{recursive:true});await fs.writeFile(path.join(output,'instruction-skill-external.json'),json(report,null,2));console.log(json({status:report.status,error:report.error,requests:report.requests,output}));
});
