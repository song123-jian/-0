// Actual packaged renderer, IPC, files and permission paths; model only is loopback.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const http = require('node:http');
const { spawn } = require('node:child_process');
const { connect, wait, freePort } = require('./agent-workflow-ui.cjs');
const root = path.resolve(__dirname, '..'), version = require('../package.json').version;
const output = path.resolve(process.env.SCODEX_CONTEXT_OUTPUT || path.join(root, 'release/delivery-1.3.37/candidate-ui'));
const executable = process.env.SCODEX_CONTEXT_EXE || path.join(root, 'release/win-unpacked/Scodex工作台.exe');
const fixture = path.join(output, 'fixture-' + crypto.randomUUID()), profile = path.join(fixture, 'profile'), home = path.join(fixture, 'home');
const reference = path.join(fixture, 'reference'), agents = path.join(fixture, 'agents');
const report = { status:'running', version, executable, fixture, checks:[], limitations:['Model responses are loopback fixtures; actual packaged Electron, renderer, IPC, Windows encryption and disk operations. External model acceptance is separate.'] };
let child, socket, cdp, server, workspace, activeScenario = '', automaticMessageId = ''; const timers = new Set(), requests = [];
const json = JSON.stringify;
const state = () => cdp.evaluate('window.scodex.getAppState()');
const frame = data => 'data: ' + json(data) + '\n\n';
function send(res, content, call) {
  res.writeHead(200, {'content-type':'text/event-stream'});
  res.end(frame({choices:[{delta:call ? {tool_calls:[{index:0,id:crypto.randomUUID(),type:'function',function:{name:call.name,arguments:json(call.args)}}]} : {content},finish_reason:call ? 'tool_calls' : 'stop'}]}) + 'data: [DONE]\n\n');
}
function later(res, ms, fn) { const t=setTimeout(()=>{timers.delete(t);if(!res.destroyed)fn();},ms);timers.add(t);res.once('close',()=>{clearTimeout(t);timers.delete(t);}); }
async function click(selector) { await wait(()=>cdp.evaluate('(()=>{const e=document.querySelector('+json(selector)+');if(!e||e.disabled)return false;e.click();return true})()'),selector); }
async function begin(prompt) {
  activeScenario=prompt;
  await cdp.evaluate('window.__contextTerminal=null;if(!window.__contextHarnessListening){window.__contextHarnessListening=true;window.scodex.onChatEvent(e=>{if(["complete","error","cancelled"].includes(e.type))window.__contextTerminal=e;});}true');
  await cdp.evaluate('(()=>{const e=document.querySelector("[aria-label=输入工作内容]");Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,"value").set.call(e,'+json(prompt)+');e.dispatchEvent(new Event("input",{bubbles:true}));})()');
  await click('[aria-label=发送消息]');
  return {prompt};
}
async function finish(token, timeout=45000) {
  return wait(async()=>{const terminal=await cdp.evaluate('window.__contextTerminal');if(!terminal)return false;const busy=await cdp.evaluate('Boolean(document.querySelector("[aria-label=停止生成]"))');const s=await state(),chat=s.library.conversations.find(c=>c.id===s.library.activeId),m=chat?.messages.at(-1);if(!busy&&m?.role==='assistant'&&!m.pending)return {chat,message:m,terminal};return false;},token.prompt+' terminal',timeout);
}
async function submit(prompt) {const token=await begin(prompt);const result=await finish(token);assert.equal(result.terminal.type,'complete',result.terminal.message);assert.ok(!result.message.error,result.message.error);return result;}
async function check(name,fn) {const evidence=await fn();report.checks.push({name,status:'passed',evidence});console.log('PASS '+name);}
async function main() {
  for(const dir of [profile,home,reference,path.join(fixture,'.codex'),path.join(agents,'skills/requirement-understanding'),path.join(agents,'skills/context-probe')])await fs.mkdir(dir,{recursive:true});
  await fs.writeFile(path.join(fixture,'AGENTS.md'),'ANCESTOR-RULE：仅使用本轮验收工作区。\n');
  await fs.writeFile(path.join(reference,'AGENTS.md'),'PERSONAL-RULE：已阅读AGENTS.md文档，按项目规则执行。\n');
  await fs.writeFile(path.join(home,'AGENTS.md'),'SCODEX-PERSONAL-RULE：不得伪造验证。\n');
  await fs.writeFile(path.join(agents,'skills/requirement-understanding/SKILL.md'),'---\nname: requirement-understanding\ndescription: 每轮任务固定需求前置\n---\nDEFAULT-PRECONDITION：先理解需求和验收标准。\n');
  await fs.writeFile(path.join(agents,'skills/context-probe/SKILL.md'),'---\nname: context-probe\ndescription: 本轮规则与技能验收\n---\nSKILL-PROBE-GUIDE：读取 reference.md 后按其中标记写入文件。\n');
  await fs.writeFile(path.join(agents,'skills/context-probe/reference.md'),'SKILL-REFERENCE：accepted-skill-rule\n');
  await fs.writeFile(path.join(home,'codex-settings.json'),json({sandboxMode:'danger-full-access',approvalPolicy:'never',networkAccess:true,networkDomains:['*'],allowLocalBinding:true,workspaceDependencies:false,availableReasoningEfforts:['low'],defaultReasoningEffort:'low'}));
  await fs.writeFile(path.join(profile,'settings.json'),json({projects:[],activeProjectId:'',preferences:{contextAccess:'full',closeConfirmation:'never',closeToTray:false}}));
  server=http.createServer(async(req,res)=>{try{
    let body='';for await(const part of req)body+=part;const input=JSON.parse(body);
    const at=input.messages.findLastIndex(m=>m.role==='user'),prompt=input.messages[at]?.content;
    const results=input.messages.slice(at+1).filter(m=>m.role==='tool').map(m=>JSON.parse(m.content)),step=results.length;
    const names=(input.tools||[]).map(t=>t.function.name),system=input.messages[0]?.content||'';
    requests.push({prompt,step,tools:names,system,results});
    const tool=(name,args)=>send(res,null,{name,args});
    if(prompt==='AUTO-SKILL-RULES'){
      if(step===0){assert.ok(names.includes('skill_search')&&names.includes('skill_open'));for(const marker of ['PERSONAL-RULE','SCODEX-PERSONAL-RULE','ANCESTOR-RULE','PROJECT-END-RULE','DEFAULT-PRECONDITION'])assert.ok(system.includes(marker),marker);assert.ok(system.indexOf('PERSONAL-RULE')<system.indexOf('ANCESTOR-RULE'));assert.ok(!system.includes('SKILL-PROBE-GUIDE'));return tool('skill_search',{query:'规则与技能验收'});}
      if(step===1){assert.equal(results[0].entries[0].name,'context-probe');return tool('skill_open',{skill_id:results[0].entries[0].id});}
      if(step===2){assert.ok(results[1].content.includes('SKILL-PROBE-GUIDE'));return tool('skill_read',{path:'reference.md'});}
      if(step===3){assert.ok(results[2].content.includes('accepted-skill-rule'));return tool('write_file',{path:'nested/accepted.txt',content:'accepted-skill-rule\n',expected_hash:'new'});}
      if(step===4){assert.equal(results[3].ok,false);assert.equal(results[3].requires_instruction_review,true);assert.ok(results[3].instructions.some(r=>r.content.includes('NESTED-RULE')));assert.equal(await fs.readFile(path.join(workspace,'nested/accepted.txt')).catch(e=>e.code),'ENOENT');return tool('write_file',{path:'nested/accepted.txt',content:'accepted-skill-rule\n',expected_hash:'new'});}
      if(step===5){assert.equal(results[4].ok,true);return tool('read_file',{path:'nested/accepted.txt'});}
      assert.match(results[5].content,/^1: accepted-skill-rule/);return send(res,'已阅读AGENTS.md文档。自动技能与目录规则验收完成。使用 Skill：requirement-understanding、context-probe。');
    }
    if(prompt==='DISABLED-SKILL'){
      assert.ok(!system.includes('SKILL-PROBE-GUIDE'));if(!step)return tool('skill_search',{query:'规则与技能验收'});assert.equal(results[0].total,0);return send(res,'停用技能检查完成。');
    }
    if(prompt==='SKILLS-OFF'){assert.ok(!names.some(n=>n.startsWith('skill_')));assert.ok(!system.includes('DEFAULT-PRECONDITION'));return send(res,'全局停用检查完成。');}
    if(prompt==='CHAT-ONLY'){assert.equal(names.length,0);for(const marker of ['PERSONAL-RULE','PROJECT-END-RULE','DEFAULT-PRECONDITION'])assert.ok(!system.includes(marker));return send(res,'仅对话隐私边界检查完成。');}
    if(prompt==='RULE-CHANGED'){
      if(!step){await fs.appendFile(path.join(workspace,'AGENTS.md'),'\nRULE-CHANGED');return tool('write_file',{path:'must-not-exist.txt',content:'blocked',expected_hash:'new'});}
      assert.equal(results[0].ok,false);assert.match(results[0].error,/AGENTS.md.*已变化/);return send(res,'规则已变化，操作暂停，未写入文件。');
    }
    if(prompt==='LONG-PROGRESS'){
      if(step){assert.equal(results[0].ok,true);return send(res,'持续有效进展超过旧 120 秒界限，任务完成。');}
      report.longStart=Date.now();res.writeHead(200,{'content-type':'text/event-stream'});res.flushHeaders();
      res.write(frame({choices:[{delta:{reasoning_content:'PRIVATE-CONTEXT-FIXTURE'}}]}));
      for(const ms of [20000,40000,60000,80000,100000])later(res,ms,()=>res.write(frame({choices:[{delta:{reasoning_content:'有效进展'}}]})));
      later(res,125000,()=>{report.longToolAt=Date.now();res.end(frame({choices:[{delta:{tool_calls:[{index:0,id:'long-once',function:{name:'write_file',arguments:json({path:'long-completed.txt',content:'exactly-once\n',expected_hash:'new'})}}]},finish_reason:'tool_calls'}]})+'data: [DONE]\n\n');});return;
    }
    if(prompt==='CANCEL-WAIT'){res.writeHead(200,{'content-type':'text/event-stream'});res.flushHeaders();res.write(': heartbeat\n\n');return;}
    throw Error('Unexpected acceptance request '+prompt);
  }catch(e){report.serverError=e.stack;if(!res.headersSent)res.writeHead(500);res.end();}});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const port=await freePort();
  child=spawn(executable,['--remote-debugging-port='+port,'--user-data-dir='+profile,'--disable-gpu'],{cwd:output,windowsHide:true,stdio:['ignore','ignore','pipe'],env:{...process.env,SCODEX_HOME:home,SCODEX_REFERENCE_HOME:reference,SCODEX_REFERENCE_AGENTS_HOME:agents}});child.stderr.resume();
  const target=await wait(async()=>{if(child.exitCode!==null)throw Error('EXE exit '+child.exitCode);return(await fetch('http://127.0.0.1:'+port+'/json/list').then(r=>r.json())).find(t=>t.type==='page'&&t.url.startsWith('file:'));},'Packaged startup',45000);
  socket=new WebSocket(target.webSocketDebuggerUrl);await new Promise((r,j)=>{socket.addEventListener('open',r,{once:true});socket.addEventListener('error',j,{once:true});});cdp=connect(socket);await cdp.command('Page.enable');
  socket.addEventListener('message',({data})=>{if(JSON.parse(data).method==='Page.javascriptDialogOpening')cdp.command('Page.handleJavaScriptDialog',{accept:true}).catch(()=>{});});
  await wait(()=>cdp.evaluate('Boolean(document.querySelector("[aria-label=输入工作内容]"))'),'Renderer');
  const s=await state();assert.equal(s.version,version);workspace=s.workspaceRoot;report.workspace=workspace;
  await fs.writeFile(path.join(workspace,'AGENTS.md'),'PROJECT-BEGIN-RULE\n'+'规则不截断。'.repeat(5000)+'\nPROJECT-END-RULE\n');
  await fs.mkdir(path.join(workspace,'nested'));await fs.writeFile(path.join(workspace,'nested/AGENTS.md'),'NESTED-RULE：该目录文件须先读取本规则再写入。');
  const skills=await cdp.evaluate('window.scodex.listSkills()');report.skillNames=skills.map(v=>v.name);const probe=skills.find(v=>v.name==='context-probe');assert.ok(probe);assert.ok(skills.some(v=>v.name==='requirement-understanding'));
  await cdp.evaluate('window.scodex.saveModelConnection('+json({name:'自动技能与规则验收',baseUrl:'http://127.0.0.1:'+server.address().port+'/v1',model:'fixture',models:['fixture'],apiKey:'local-fixture',retryLimit:0,toolProtocol:'native'})+').then(()=>location.reload())');
  await wait(()=>cdp.evaluate('Boolean(document.querySelector("[aria-label=输入工作内容]"))'),'Connection reload');
  await cdp.evaluate('window.__contextEvents=[];window.scodex.onChatEvent(e=>{if(["phase","request-metrics","error","cancelled","operation"].includes(e.type))window.__contextEvents.push(e);});true');
  await check('automatic-search-open-reference-and-scoped-write-with-no-manual-skill',async()=>{const r=await submit('AUTO-SKILL-RULES');automaticMessageId=r.message.id;assert.equal(await fs.readFile(path.join(workspace,'nested/accepted.txt'),'utf8'),'accepted-skill-rule\n');const ops=r.message.operations||[];assert.ok(ops.some(v=>v.name==='skill_search'));assert.ok(ops.some(v=>v.name==='skill_open'));assert.ok(ops.some(v=>v.name==='skill_read'));assert.ok(ops.some(v=>v.name==='write_file'&&v.status==='deferred'));assert.ok(!ops.some(v=>v.status==='failed'));return {operations:ops.map(v=>({name:v.name,status:v.status})),rootRuleBytes:(await fs.stat(path.join(workspace,'AGENTS.md'))).size};});
  await check('rule-disclosure-is-neutral-and-completed-activity-folds',async()=>{const selector='[data-message-id='+json(automaticMessageId)+']';await wait(()=>cdp.evaluate('document.querySelector('+json(selector+' .agent-activity-shell')+').open===false'),'Completed activity folded');assert.equal(await cdp.evaluate('document.querySelectorAll('+json(selector+' .agent-operation.failed')+').length'),0);assert.equal(await cdp.evaluate('document.querySelector('+json(selector+' .agent-operation.deferred summary')+').textContent.includes("原操作未执行")'),true);return {deferred:1,falseFailures:0,folded:true};});
  await cdp.evaluate('window.scodex.savePreferences('+json({disabledSkillIds:[probe.id]})+')');
  await check('disabled-skill-remains-unavailable',()=>submit('DISABLED-SKILL').then(()=>({disabled:true})));
  await cdp.evaluate('window.scodex.savePreferences({skillsEnabled:false})');
  await check('global-skills-off-removes-tool-channel',()=>submit('SKILLS-OFF').then(()=>({toolsAbsent:true})));
  await cdp.evaluate('window.scodex.savePreferences({skillsEnabled:true,disabledSkillIds:[],contextAccess:"chat-only"}).then(()=>location.reload())');
  await wait(()=>cdp.evaluate('Boolean(document.querySelector("[aria-label=输入工作内容]"))'),'Chat-only reload');
  await check('chat-only-does-not-send-local-rules-or-skills',()=>submit('CHAT-ONLY').then(()=>({localContextAbsent:true})));
  await cdp.evaluate('window.scodex.savePreferences({contextAccess:"full"}).then(()=>location.reload())');await wait(()=>cdp.evaluate('Boolean(document.querySelector("[aria-label=输入工作内容]"))'),'Full reload');
  await check('changed-rule-stops-effects-and-can-be-reloaded-next-task',async()=>{await submit('RULE-CHANGED');assert.equal(await fs.readFile(path.join(workspace,'must-not-exist.txt')).catch(e=>e.code),'ENOENT');return {fileAbsent:true};});
  if(process.env.SCODEX_CONTEXT_SKIP_LONG!=='1')await check('actual-request-crosses-120-seconds-with-effective-progress',async()=>{const token=await begin('LONG-PROGRESS');await finish(token,155000);const elapsed=report.longToolAt-report.longStart;assert.ok(elapsed>=124000);assert.equal(await fs.readFile(path.join(workspace,'long-completed.txt'),'utf8'),'exactly-once\n');assert.equal(requests.filter(r=>r.prompt==='LONG-PROGRESS').length,2);return {elapsedMs:elapsed,requests:2};});
  await check('user-cancels-headers-only-wait',async()=>{const token=await begin('CANCEL-WAIT');await wait(()=>requests.some(r=>r.prompt==='CANCEL-WAIT'),'Request entered');await click('[aria-label=停止生成]');const r=await finish(token);assert.ok(r.message.cancelled||r.message.stopped||r.message.content.includes('停止')||!r.message.error);return {terminal:true};});
  const text=await cdp.evaluate('document.body.innerText');assert.ok(!text.includes('PRIVATE-CONTEXT-FIXTURE'));assert.ok(!report.serverError,report.serverError);
  const restored=(await state()).library.conversations.flatMap(c=>c.messages).find(m=>m.id===automaticMessageId);assert.ok(restored.operations.some(o=>o.status==='deferred'));
  if(process.env.SCODEX_CONTEXT_SCREENSHOT==='1'){await cdp.command('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});const selector='[data-message-id='+json(automaticMessageId)+']';await cdp.evaluate('(()=>{const e=document.querySelector('+json(selector+' .agent-activity-shell')+');if(!e.open)e.querySelector("summary").click();document.querySelector('+json(selector)+').scrollIntoView({block:"center"});})()');const shot=await cdp.command('Page.captureScreenshot',{format:'png'});await fs.writeFile(path.join(output,'instruction-skill.png'),Buffer.from(shot.data,'base64'));}
  report.preparation=requests.filter(r=>r.step===0).map(r=>({prompt:r.prompt,tools:r.tools.length,localRules:r.system.includes('PROJECT-END-RULE'),automaticPrerequisite:r.system.includes('DEFAULT-PRECONDITION')}));
  report.status='passed';
}
main().catch(e=>{report.status='failed';report.error=e.stack;process.exitCode=1;console.error(e.stack);}).finally(async()=>{
  try{if(child?.exitCode===null&&cdp){await cdp.evaluate('window.scodex.quitApp()');await wait(()=>child.exitCode!==null,'Normal exit',30000);assert.equal(child.exitCode,0);}}catch(e){report.shutdownError=e.stack;process.exitCode=1;}
  socket?.close();for(const t of timers)clearTimeout(t);if(server){server.closeAllConnections();await new Promise(r=>server.close(r));}
  report.applicationExitCode=child?.exitCode;await fs.mkdir(output,{recursive:true});await fs.writeFile(path.join(output,'instruction-skill-ui.json'),json(report,null,2));console.log(json({status:report.status,checks:report.checks.length,output}));
});
