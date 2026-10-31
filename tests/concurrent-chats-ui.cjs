const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const net = require('node:net');
const crypto = require('node:crypto');
const { spawn, execFile } = require('node:child_process');
const { promisify } = require('node:util');
const execFileAsync = promisify(execFile);
const root = path.resolve(__dirname, '..');
const output = path.resolve(process.env.SCODEX_RUNS_OUTPUT || path.join(root, 'release', 'cross-project-chats-20261025'));
const expectedVersion = '1.3.13';
const executable = process.env.SCODEX_RUNS_EXE || path.join(root, 'release', `Scodex-Workbench-${expectedVersion}-x64.exe`);
const resume = process.env.SCODEX_RUNS_FIXTURE;
const only = process.env.SCODEX_RUNS_ONLY || '';
const temporary = resume || path.join(os.tmpdir(), 'scodex-runs-ui-' + crypto.randomUUID());
const profile = path.join(temporary, 'profile'), workspace = path.join(temporary, 'project'), projectB = path.join(temporary, 'project-B'), fakeRoot = path.join(temporary, 'scodex');
const token = crypto.randomBytes(3).toString('hex');
const report = { status: 'running', executable, version: expectedVersion, checks: [], fixtureDirectory: temporary, environment: { platform: os.platform(), release: os.release(), node: process.version },
  limitations: ['External model responses are a deterministic loopback fixture. EXE, React, IPC, files, PowerShell and history are real. CDP drives the actual renderer; this is not native Windows mouse verification.'] };
let child, socket, cdp, modelServer; const children = new Set(), requests = [], streams = new Map(), sharedReady = new Map();
let releaseShared; const bothShared = new Promise(r => { releaseShared = r; });
const json = JSON.stringify;
const wait = async (fn, label, timeout = 25000) => { const end = Date.now() + timeout; let last; while (Date.now() < end) { try { const value = await fn(); if (value) return value; } catch (e) { last = e; } await new Promise((resolve) => setTimeout(resolve, 100)); } throw Error(label + (last ? ': ' + last.message : '')); };
function connect(ws) { let id = 0; const pending = new Map(); ws.addEventListener('message', ({ data }) => { const item = JSON.parse(data); const entry = pending.get(item.id); if (!entry) return; pending.delete(item.id); clearTimeout(entry.timer); item.error ? entry.reject(Error(item.error.message)) : entry.resolve(item.result); }); return {
  command(method, params = {}) { return new Promise((resolve, reject) => { const current = ++id; const timer = setTimeout(() => { pending.delete(current); reject(Error('CDP timeout ' + method)); }, 25000); pending.set(current, { resolve, reject, timer }); ws.send(json({ id: current, method, params })); }); },
  async evaluate(expression) { const result = await this.command('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, userGesture: true }); if (result.exceptionDetails) throw Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text); return result.result?.value; },
}; }
async function check(name, fn) { const evidence = await fn(); report.checks.push({ name, status: 'passed', evidence }); console.log('PASS ' + name); }
async function click(label) { await wait(() => cdp.evaluate(`(()=>{const e=document.querySelector('[aria-label=${json(label)}]');if(!e||e.disabled)return false;e.click();return true})()`), 'Missing button ' + label); }
async function textClick(selector, text) { await wait(() => cdp.evaluate(`(()=>{const e=[...document.querySelectorAll(${json(selector)})].find(e=>e.textContent.trim()===${json(text)});if(!e||e.disabled)return false;e.click();return true})()`), 'Missing ' + text); }
async function insert(selector, value) { await cdp.evaluate(`(()=>{const e=document.querySelector(${json(selector)});if(!e)throw Error('Input missing');e.focus();if(e instanceof HTMLTextAreaElement||e instanceof HTMLInputElement){const setter=Object.getOwnPropertyDescriptor(e instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,'value').set;setter.call(e,${json(value)});e.dispatchEvent(new Event('input',{bubbles:true}));}return true})()`); }
async function key(key, modifiers = 0, code = key) { const virtual = { Enter: 13, Escape: 27, s: 83, p: 80 }; const event = { key, code, modifiers, windowsVirtualKeyCode: virtual[key] || 0, nativeVirtualKeyCode: virtual[key] || 0 }; await cdp.command('Input.dispatchKeyEvent', { ...event, type: 'keyDown' }); await cdp.command('Input.dispatchKeyEvent', { ...event, type: 'keyUp' }); }
async function newChat() { await click('新聊天'); await wait(() => cdp.evaluate('!document.querySelector(".message-list")'), 'New conversation'); }
async function enableExecution() { if (await cdp.evaluate('document.querySelector("[aria-label=执行任务]").getAttribute("aria-pressed")') !== 'true') await click('执行任务'); await wait(() => cdp.evaluate('document.querySelector("[aria-label=执行任务]").getAttribute("aria-pressed")==="true"'), 'Execution enabled'); }
async function submit(prompt) { await insert('[aria-label="输入工作内容"]', prompt); await click('发送消息'); }
async function finish() { await wait(() => cdp.evaluate('!document.querySelector("[aria-label=停止生成]")'), 'Task did not finish', 45000); await cdp.evaluate('document.querySelectorAll(".agent-operation.failed:not([open]) > summary").forEach(e=>e.click())'); return cdp.evaluate('document.querySelector(".message-list")?.innerText||""'); }
async function approveAllUntilDone() { for (let i = 0; i < 30; i++) { const state = await wait(() => cdp.evaluate('document.querySelector(".agent-approval")?"approval":!document.querySelector("[aria-label=停止生成]")?"done":false'), 'Task/approval stalled', 45000); if (state === 'done') return; await textClick('.agent-approval-actions button', '允许本次命令'); } throw Error('Too many approvals'); }
function call(name, args, text = '') { return { content: text || null, tool_calls: [{ id: 'call_' + crypto.randomBytes(6).toString('hex'), type: 'function', function: { name, arguments: json(args) } }] }; }
function sendModel(res, message, broken = false) {
  res.writeHead(200, { 'content-type': 'text/event-stream; charset=utf-8' });
  const delta = { ...(message.content ? { content: message.content } : {}), ...(message.tool_calls ? { tool_calls: message.tool_calls.map((item, index) => ({ index, ...item })) } : {}) };
  res.write('data: ' + json({ choices: [{ delta }] }) + '\n\n');
  if (!broken) res.write('data: ' + json({ choices: [{ delta: {}, finish_reason: message.tool_calls ? 'tool_calls' : 'stop' }] }) + '\n\ndata: [DONE]\n\n');
  res.end();
}
async function freePort() { const server = net.createServer(); await new Promise((r) => server.listen(0, '127.0.0.1', r)); const port = server.address().port; await new Promise((r) => server.close(r)); return port; }
async function launch(port) {
  child = spawn(executable, ['--remote-debugging-port=' + port, '--user-data-dir=' + profile, '--disable-gpu'], { cwd: output, windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'],
    env: { ...process.env, SCODEX_HOME: fakeRoot, SCODEX_REFERENCE_HOME: path.join(temporary, 'reference'), SCODEX_REFERENCE_AGENTS_HOME: path.join(temporary, 'agents') } });
  children.add(child); let errors = ''; child.stderr.on('data', (value) => { errors = (errors + value).slice(-4000); });
  const target = await wait(async () => { if (child.exitCode !== null) throw Error('EXE exited: ' + errors); return (await fetch(`http://127.0.0.1:${port}/json/list`).then((r) => r.json())).find((item) => item.type === 'page' && item.url.startsWith('file:')); }, 'Application startup', 40000);
  socket = new WebSocket(target.webSocketDebuggerUrl); await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); }); cdp = connect(socket);
  await wait(() => cdp.evaluate('Boolean(window.scodex&&document.querySelector(".task-chat-view textarea"))'), 'Renderer ready');
  await cdp.evaluate('document.title="Scodex '+expectedVersion+' 执行验收（隔离配置）"');
  return cdp.evaluate('window.scodex.getAppState().then(s=>({version:s.version,workspaceRoot:s.workspaceRoot,hasCredential:s.hasCredential}))');
}
async function quit() { await cdp.evaluate('window.scodex.quitApp()'); await wait(() => Promise.resolve(child.exitCode !== null), 'Application quit'); socket.close(); }

const state = () => cdp.evaluate('window.scodex.getAppState()');
const runRows = () => cdp.evaluate('[...document.querySelectorAll(".chat-run-row")].map(e=>({id:e.dataset.runChat,text:e.innerText}))');
async function currentId() {
  await wait(()=>cdp.evaluate('document.querySelector(".history-save-state")?.textContent==="已保存到本机"'),'History saved');
  return (await state()).library.activeId;
}
async function createChat(execute = false) {
  await currentId(); const before = await state(); await newChat();
  const id = await wait(async () => { const s = await state(); return s.library.conversations.length === before.library.conversations.length + 1 && s.library.activeId !== before.library.activeId && s.library.activeId; }, 'New chat saved');
  if (execute) await enableExecution(); return id;
}
async function goChat(id) {
  const row = await cdp.evaluate('(()=>{const e=[...document.querySelectorAll(".chat-run-row")].find(e=>e.dataset.runChat==='+json(id)+');if(!e)return false;e.querySelector(".chat-run-open").click();return true})()');
  if (!row) {
    await currentId();
    const s=await state(), chats=s.library.conversations.filter(c=>!c.archivedAt&&(!c.projectId||c.projectId===s.activeProjectId)).sort((a,b)=>Number(b.pinned)-Number(a.pinned)||String(b.updatedAt).localeCompare(String(a.updatedAt)));
    const index=chats.findIndex(c=>c.id===id);assert.ok(index>=0,'Chat missing '+id);
    const recent=index<12&&await cdp.evaluate('(()=>{const e=document.querySelectorAll(".recent-list[aria-label=最近对话] button")['+index+'];if(!e)return false;e.click();return true})()');
    if(!recent){
      await cdp.evaluate('document.querySelector(".task-more-menu summary").click()');
      await textClick('.task-more-menu button','最近聊天');
      await wait(()=>cdp.evaluate('Boolean(document.querySelector(".recent-view"))'),'Recent page');
      await cdp.evaluate('document.querySelectorAll(".recent-view .history-open")['+index+'].click()');
    }
  }
  await wait(async()=>await currentId()===id && await cdp.evaluate('Boolean(document.querySelector("[aria-label=输入工作内容]"))'),'Select chat '+id);
}
async function goProject(id) {
  await wait(() => cdp.evaluate(`(()=>{const e=[...document.querySelectorAll('.project-item')].find(e=>e.dataset.projectId===${json(id)});if(!e)return false;e.click();return true})()`), 'Project row ' + id);
  await wait(async () => (await state()).activeProjectId === id, 'Active project ' + id);
  await wait(() => cdp.evaluate(`Boolean(document.querySelector('.project-item.active[data-project-id=${json(id)}]'))`), 'Rendered project ' + id);
}
async function stopChat(id) {
  await wait(()=>cdp.evaluate('(()=>{const e=[...document.querySelectorAll(".chat-run-row")].find(e=>e.dataset.runChat==='+json(id)+');if(!e)return false;e.querySelector(".chat-run-stop").click();return true})()'),'Stop row '+id);
  await wait(async()=>!(await runRows()).some(r=>r.id===id),'Stopped row removed');
}
async function savedChat(id, predicate = ()=>true) {
  return wait(async()=>{const s=await state();const c=s.library.conversations.find(c=>c.id===id);return c&&predicate(c)&&c;},'Persisted chat '+id);
}
async function attachFile(selector, file) {
  const {root:doc}=await cdp.command('DOM.getDocument');
  const {nodeId}=await cdp.command('DOM.querySelector',{nodeId:doc.nodeId,selector});
  assert.ok(nodeId);await cdp.command('DOM.setFileInputFiles',{nodeId,files:[file]});
  const name=path.basename(file);
  await wait(()=>cdp.evaluate('(()=>{const list=document.querySelector(".composer-attachment-list");return !document.querySelector(".attachment-loading")&&Boolean(list?.textContent.includes('+json(name)+'))})()'),'Attachment preview '+name);
}
async function expectRejected(expression, pattern) {
  const result=await cdp.evaluate('(async()=>{try{await ('+expression+');return {ok:true}}catch(e){return {ok:false,message:e.message}}})()');
  assert.equal(result.ok,false);assert.match(result.message,pattern);return result.message;
}
function contentText(message) { return Array.isArray(message.content) ? message.content.filter(c=>c.type==='text').map(c=>c.text).join('\n') : String(message.content||''); }
function beginStream(res, first) {
  res.writeHead(200,{'content-type':'text/event-stream; charset=utf-8'});
  streamDelta(res,first);
}
function streamDelta(res, text) { if(!res.destroyed)res.write('data: '+json({choices:[{delta:{content:text}}]})+'\n\n'); }
function endStream(res, text) { if(res.destroyed)return;streamDelta(res,text);res.end('data: '+json({choices:[{delta:{},finish_reason:'stop'}]})+'\n\ndata: [DONE]\n\n'); }
async function modelResponse(body, res) {
  const latest=body.messages.findLastIndex(m=>m.role==='user'), prompt=contentText(body.messages[latest]), tag=prompt.split('\n')[0];
  const completed=body.messages.slice(latest+1).filter(m=>m.role==='tool').map(m=>JSON.parse(m.content));
  const step=completed.length;requests.push({tag,step,reasoningEffort:body.reasoning_effort||'',images:Array.isArray(body.messages[latest].content)?body.messages[latest].content.filter(c=>c.type==='image_url').length:0,hasNote:prompt.includes('仅附件D的中文正文'),tools:(body.tools||[]).map(t=>t.function.name)});
  if(tag.startsWith('STREAM-')) { streams.set(tag,res);beginStream(res,tag+'开始。');return; }
  if(tag.startsWith('ERROR-')) {res.writeHead(503,{'content-type':'application/json'});res.end(json({error:{message:'独立错误验收'}}));return;}
  if(tag.startsWith('ROUTE-')) {
    const letter=tag.split('-')[1];
    if(step===0)sendModel(res,call('run_command',{command:"[IO.File]::WriteAllText('route-"+letter+".txt','来自项目"+letter+"')",timeout_ms:15000}));
    else sendModel(res,{content:'项目 '+letter+'任务完成。'});
    return;
  }
  if(tag.startsWith('CMD-')) {
    const letter=tag.split('-')[1];
    sendModel(res,step?{content:'审批任务'+letter+'已结束。'}:call('run_command',{command:"[IO.File]::WriteAllText('command-"+letter+".txt','来自任务"+letter+"')",timeout_ms:15000}));return;
  }
  if(tag.startsWith('SHARED-')) {
    const letter=tag.split('-')[1];
    if(step===0)sendModel(res,call('read_file',{path:'shared.txt'}));
    else if(step===1){sharedReady.set(letter,completed[0]);if(sharedReady.size===2)releaseShared();await bothShared;sendModel(res,call('edit_file',{path:'shared.txt',expected_hash:completed[0].hash,old_text:'初始值',new_text:'任务'+letter}));}
    else if(step===2)sendModel(res,call('read_file',{path:'shared.txt'}));
    else sendModel(res,{content:'共享任务'+letter+'已回读：'+(completed[1].ok?'成功保存':'冲突已阻止')});return;
  }
  if(tag.startsWith('DRAFT-')) {assert.equal(requests.at(-1).images,1);assert.equal(prompt.includes('仅附件D的中文正文'),true);sendModel(res,{content:'仅D附件已收到。'});return;}
  sendModel(res,{content:'本轮验收完成。'});
}
async function runCheck(name, fn) {
  if(only && only!==name)return;
  if(report.checks.some(c=>c.name===name&&c.status==='passed'))return;
  await check(name,fn);
}
async function main() {
 try {
  await fs.mkdir(output,{recursive:true});
  report.executableSha256=crypto.createHash('sha256').update(await fs.readFile(executable)).digest('hex');
  if(resume){
    const previous=JSON.parse(await fs.readFile(path.join(output,'cross-project-chats-ui-verification.json'),'utf8'));
    assert.equal(previous.fixtureDirectory,temporary);
    assert.equal(previous.executableSha256,report.executableSha256,'Changed EXE requires explicit affected-scope review');
    report.checks=previous.checks.filter(c=>c.status==='passed'&&(!only||c.name!==only)).map(c=>({...c,reused:true}));
    report.priorFailures=[...(previous.priorFailures||[]),...(previous.error?[{error:previous.error,at:previous.finishedAt}]:[])];
    report.chatIds=previous.chatIds||{};
  } else {
    await fs.mkdir(workspace,{recursive:true});await fs.mkdir(profile);await fs.mkdir(fakeRoot);
    await fs.writeFile(path.join(workspace,'shared.txt'),'初始值\r\n');
    await fs.writeFile(path.join(workspace,'note-D.txt'),'仅附件D的中文正文');
    await fs.writeFile(path.join(workspace,'picture-D.png'),Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j6XcAAAAASUVORK5CYII=','base64'));
    await fs.mkdir(path.join(workspace,'.codex','skills','parallel'),{recursive:true});
    await fs.writeFile(path.join(workspace,'.codex','skills','parallel','SKILL.md'),'---\nname: 并行验收技能\ndescription: 只属于此聊天的技能\n---\n并行技能正文。\n');
    await fs.writeFile(path.join(fakeRoot,'codex-settings.json'),json({sandboxMode:'danger-full-access',approvalPolicy:'on-request',availableReasoningEfforts:['low'],defaultReasoningEffort:'low',workspaceDependencies:false}));
    await fs.writeFile(path.join(profile,'settings.json'),json({workspaceRoot:workspace,preferences:{browserPanelOpen:false,trayEnabled:false,fontFamily:'Microsoft YaHei',fontSize:16}}));
    report.chatIds={};
  }
  modelServer=http.createServer(async(req,res)=>{try{let text='';for await(const chunk of req)text+=chunk;await modelResponse(JSON.parse(text),res);}catch(error){report.modelFixtureError=error.stack;if(!res.headersSent)res.writeHead(500);res.end();}});
  await new Promise(r=>modelServer.listen(0,'127.0.0.1',r));
  const endpoint='http://127.0.0.1:'+modelServer.address().port+'/v1';
  const identity=await launch(await freePort());assert.equal(identity.version,expectedVersion);assert.equal(path.resolve(identity.workspaceRoot),workspace);
  if(!report.checks.some(c=>c.name==='identity'))report.checks.push({name:'identity',status:'passed',evidence:identity});
  await cdp.evaluate('window.scodex.saveModelConnection({name:"并行协议验收",baseUrl:'+json(endpoint)+',model:"fixture-parallel",toolProtocol:"native",models:["fixture-parallel"],apiKey:"isolated-test-credential"}).then(()=>location.reload())');
  await wait(()=>cdp.evaluate('Boolean(document.querySelector("[aria-label=输入工作内容]"))'),'Reloaded');
  await runCheck('cross-project-routing',async()=>{
    const initial=await state(),projectA=initial.projects.find(p=>path.resolve(p.path)===workspace);
    assert.ok(projectA,'Initial project A is registered');
    await fs.mkdir(path.join(projectB,'.scodex'),{recursive:true});
    await fs.writeFile(path.join(projectB,'.scodex','codex-settings.json'),json({approvalPolicy:'on-request',sandboxMode:'workspace-write',networkAccess:true,allowLocalBinding:true,availableReasoningEfforts:['medium'],defaultReasoningEffort:'medium',workspaceDependencies:false}));
    const added=await cdp.evaluate('window.scodex.addProject({name:"项目 B",path:'+json(projectB)+'})');
    const projectBId=added.activeProjectId;
    await cdp.command('Page.reload');
    await wait(()=>cdp.evaluate('Boolean(window.scodex&&document.querySelector("[aria-label=输入工作内容]"))'),'Reload with project B');
    const stateB=await state(),registeredB=stateB.projects.find(p=>p.id===projectBId);
    assert.ok(registeredB,'Project B persisted');
    assert.deepEqual(stateB.agentSettings.availableReasoningEfforts,['medium']);
    const chatB=await createChat(true);
    assert.equal((await savedChat(chatB)).projectId,projectBId);
    await goProject(projectA.id);
    const chatA=await createChat(true);
    assert.equal((await savedChat(chatA)).projectId,projectA.id);

    const tagA='ROUTE-A-'+token,tagB='ROUTE-B-'+token;
    await submit(tagA);await wait(()=>cdp.evaluate('Boolean(document.querySelector(".agent-approval"))'),'Project A command approval');
    const rowsA=await runRows();assert.equal(rowsA.length,1);assert.match(rowsA[0].text,new RegExp(projectA.name));
    await goProject(projectBId);await goChat(chatB);
    await submit(tagB);await wait(()=>cdp.evaluate('Boolean(document.querySelector(".agent-approval"))'),'Project B command approval');
    const rowsBoth=await runRows();assert.equal(rowsBoth.length,2);
    assert.match(rowsBoth.find(r=>r.id===chatA).text,new RegExp(projectA.name));
    assert.match(rowsBoth.find(r=>r.id===chatB).text,/项目 B/);

    await goChat(chatA);await textClick('.agent-approval-actions button','允许本次命令');await finish();
    assert.equal(await fs.readFile(path.join(workspace,'route-A.txt'),'utf8'),'来自项目A');
    await goChat(chatB);await textClick('.agent-approval-actions button','允许本次命令');await finish();
    assert.equal(await fs.readFile(path.join(projectB,'route-B.txt'),'utf8'),'来自项目B');
    assert.equal(requests.find(r=>r.tag===tagA)?.reasoningEffort,'low');
    assert.equal(requests.find(r=>r.tag===tagB)?.reasoningEffort,'medium');

    await goProject(projectA.id);
    const stopChatA=await createChat(),streamA='STREAM-CROSS-A-'+token;await submit(streamA);await wait(()=>streams.has(streamA),'Project A held stream');
    await goProject(projectBId);
    const continueB=await createChat(),streamB='STREAM-CROSS-B-'+token;await submit(streamB);await wait(()=>streams.has(streamB),'Project B held stream');
    const crossRows=await runRows();assert.equal(crossRows.length,2);
    assert.match(crossRows.find(r=>r.id===stopChatA).text,new RegExp(projectA.name));
    assert.match(crossRows.find(r=>r.id===continueB).text,/项目 B/);
    await stopChat(stopChatA);
    assert.equal((await runRows()).length,1);assert.equal((await runRows())[0].id,continueB);
    endStream(streams.get(streamB),'项目 B 仍独立完成。');await finish();
    const completedChatB=await savedChat(continueB,c=>c.messages.at(-1)?.role==='assistant'&&c.messages.at(-1)?.content?.includes('项目 B 仍独立完成'));
    assert.match(completedChatB.messages.at(-1).content,/项目 B 仍独立完成/);
    const cancelled=await savedChat(stopChatA,c=>c.messages.at(-1)?.cancelled);
    report.chatIds.crossProject=[chatA,chatB,stopChatA,continueB];
    return {projectA:projectA.name,projectB:registeredB.name,chatA,chatB,reasoningEfforts:{A:'low',B:'medium'},writes:{A:path.join(workspace,'route-A.txt'),B:path.join(projectB,'route-B.txt')},stopped:stopChatA,continued:continueB,cancelled:cancelled.messages.at(-1).cancelled};
  });
  await runCheck('interleaving-cap-stop-unread',async()=>{
    const ids={},tags={};
    for(const letter of ['A','B','C']){ids[letter]=await createChat();tags[letter]='STREAM-'+letter+'-'+token;await submit(tags[letter]);await wait(()=>streams.has(tags[letter]),'Stream '+letter);}
    assert.equal((await runRows()).length,3);
    const duplicate=await expectRejected('window.scodex.sendMessage({requestId:crypto.randomUUID(),conversationId:'+json(ids.A)+',prompt:"duplicate"})',/此聊天已有/);
    ids.D=await createChat();await insert('[aria-label="输入工作内容"]','三项满时仍可编辑的草稿');
    assert.equal(await cdp.evaluate('document.querySelector("[aria-label=发送消息]").disabled'),true);
    const cap=await expectRejected('window.scodex.sendMessage({requestId:crypto.randomUUID(),conversationId:'+json(ids.D)+',prompt:"fourth"})',/最多同时运行3/);
    await expectRejected('window.scodex.getAppState().then(s=>window.scodex.saveHistory({...s.library,conversations:s.library.conversations.filter(c=>c.id!=='+json(ids.A)+')}))',/不能删除或归档/);
    streamDelta(streams.get(tags.A),'只属于A的第二段。');streamDelta(streams.get(tags.B),'只属于B的第二段。');
    await goChat(ids.B);await wait(()=>cdp.evaluate('document.querySelector(".message-list").innerText.includes("只属于B的第二段")'),'B routed');
    assert.equal(await cdp.evaluate('document.querySelector(".message-list").innerText.includes("只属于A的第二段")'),false);
    await goChat(ids.A);await wait(()=>cdp.evaluate('document.querySelector(".message-list").innerText.includes("只属于A的第二段")'),'A routed');
    assert.equal(await cdp.evaluate('document.querySelector(".message-list").innerText.includes("只属于B的第二段")'),false);
    await stopChat(ids.C);assert.equal((await runRows()).length,2);
    endStream(streams.get(tags.C),'迟到C回复不得串入。');
    await goChat(ids.D);endStream(streams.get(tags.B),'B最终完成。');
    const background=await savedChat(ids.B,c=>c.unreadResult&&c.messages.at(-1)?.content.includes('B最终完成'));
    await wait(()=>cdp.evaluate('Boolean(document.querySelector(".chat-unread-dot"))'),'Unread visible');
    assert.equal(await cdp.evaluate('document.querySelector("[aria-label=输入工作内容]").value'),'三项满时仍可编辑的草稿');
    await goChat(ids.B);assert.equal((await savedChat(ids.B,c=>!c.unreadResult)).unreadResult,false);
    await goChat(ids.A);endStream(streams.get(tags.A),'A最终完成。');await finish();
    const a=await savedChat(ids.A,c=>c.messages.at(-1)?.content.includes('A最终完成')),cancelled=await savedChat(ids.C,c=>c.messages.at(-1)?.cancelled);
    assert.doesNotMatch(a.messages.at(-1).content,/只属于B|迟到C/);assert.doesNotMatch(cancelled.messages.at(-1).content,/迟到C/);
    report.chatIds.interleaving=ids;
    return {ids,duplicate,cap,backgroundUnread:background.unreadResult,cancelled:cancelled.messages.at(-1).cancelled,runsLeft:(await runRows()).length};
  });
  await runCheck('drafts-attachments-skill-mode',async()=>{
    const projectAId=(await state()).projects.find(p=>path.resolve(p.path)===workspace)?.id;assert.ok(projectAId,'Project A is registered');await goProject(projectAId);
    const d=await createChat();await insert('[aria-label="输入工作内容"]','DRAFT-'+token);
    const originalPng=(await fs.readFile(path.join(workspace,'picture-D.png'))).toString('base64');
    report.fixtureImageProbe=await cdp.evaluate('(async()=>{try{const b=Uint8Array.from(atob('+json(originalPng)+'),c=>c.charCodeAt(0));const i=await createImageBitmap(new Blob([b],{type:"image/png"}));const size=[i.width,i.height];i.close();return {ok:true,size}}catch(e){return {ok:false,message:e.message}}})()');
    if(!report.fixtureImageProbe.ok) {
      const valid=await cdp.evaluate('(()=>{const c=document.createElement("canvas");c.width=32;c.height=24;const x=c.getContext("2d");x.fillStyle="#176c5b";x.fillRect(0,0,32,24);return c.toDataURL("image/png").split(",")[1]})()');
      await fs.writeFile(path.join(workspace,'picture-D.png'),Buffer.from(valid,'base64'));
    }
    await attachFile('[aria-label="选择聊天附件"]',path.join(workspace,'note-D.txt'));
    await attachFile('[aria-label="选择聊天图片"]',path.join(workspace,'picture-D.png'));
    await wait(()=>cdp.evaluate('Boolean(document.querySelector(".composer-attachment-disclosure"))&&document.querySelectorAll(".chat-image-preview").length===1&&document.querySelectorAll(".composer-attachment-list .chat-file-card").length===1'),'Attachment previews');
    const draftAttachmentState=()=>cdp.evaluate('(()=>{const details=document.querySelector(".composer-attachment-disclosure"),summary=details?.querySelector("summary"),rect=summary?.getBoundingClientRect();return details?{open:details.open,label:summary.getAttribute("aria-label"),visibleFiles:[...details.querySelectorAll(".chat-file-card")].filter(e=>e.getClientRects().length).length,visibleImages:[...details.querySelectorAll(".chat-image-preview")].filter(e=>e.getClientRects().length).length,bounds:{left:rect.left,right:rect.right,viewport:innerWidth,fontSize:parseFloat(getComputedStyle(summary.querySelector(".message-attachment-name")).fontSize)}}:null})()');
    const draftCollapsed=await draftAttachmentState();assert.equal(draftCollapsed.open,false);assert.equal(draftCollapsed.visibleFiles,0);assert.equal(draftCollapsed.visibleImages,0);assert.match(draftCollapsed.label,/2 项/);assert.ok(draftCollapsed.bounds.left>=0&&draftCollapsed.bounds.right<=draftCollapsed.bounds.viewport);assert.ok(draftCollapsed.bounds.fontSize>=14);
    await wait(()=>cdp.evaluate('!document.querySelector(".toast")'),'Draft attachment screenshot unobstructed');
    const draftCollapsedScreenshot=path.join(output,'draft-attachments-collapsed.png');await fs.writeFile(draftCollapsedScreenshot,Buffer.from((await cdp.command('Page.captureScreenshot',{format:'png'})).data,'base64'));
    await cdp.evaluate('document.querySelector(".composer-attachment-disclosure summary").click()');
    const draftExpanded=await draftAttachmentState();assert.equal(draftExpanded.open,true);assert.equal(draftExpanded.visibleFiles,1);assert.equal(draftExpanded.visibleImages,1);
    const draftExpandedScreenshot=path.join(output,'draft-attachments-expanded.png');await fs.writeFile(draftExpandedScreenshot,Buffer.from((await cdp.command('Page.captureScreenshot',{format:'png'})).data,'base64'));
    await cdp.evaluate(`(()=>{const button=[...document.querySelectorAll('.composer-attachment-disclosure button')].find(e=>e.getAttribute('aria-label')===${json('移除附件 note-D.txt')});if(!button)throw Error('Remove attachment button missing');button.click()})()`);
    await wait(()=>cdp.evaluate('document.querySelectorAll(".composer-attachment-list .chat-file-card").length===0'),'Remove draft attachment');
    await attachFile('[aria-label="选择聊天附件"]',path.join(workspace,'note-D.txt'));
    await wait(()=>cdp.evaluate('document.querySelectorAll(".composer-attachment-list .chat-file-card").length===1'),'Restore draft attachment');
    await cdp.evaluate('document.querySelector(".composer-attachment-disclosure summary").click()');
    assert.equal((await draftAttachmentState()).open,false);
    await click('添加工具和上下文');await wait(()=>cdp.evaluate('Boolean(document.querySelector(".composer-popover"))'),'Workbench context menu');
    await cdp.evaluate(`(()=>{const item=[...document.querySelectorAll('.composer-menu-item')].find(e=>e.textContent.includes('附加 Scodex 工作台'));if(!item)throw Error('Workbench context action missing');item.click()})()`);
    await wait(()=>cdp.evaluate('document.querySelector(".composer-attachment-disclosure summary")?.getAttribute("aria-label").includes("3 项")'),'Workbench context preview');
    const withWorkbenchContext=await draftAttachmentState();assert.equal(withWorkbenchContext.open,false);assert.equal(withWorkbenchContext.visibleFiles,0);assert.equal(withWorkbenchContext.visibleImages,0);
    await cdp.evaluate('document.querySelector(".composer-attachment-disclosure summary").click()');
    const expandedWorkbenchContext=await draftAttachmentState();assert.equal(expandedWorkbenchContext.visibleFiles,2);assert.equal(expandedWorkbenchContext.visibleImages,1);
    await cdp.evaluate(`(()=>{const button=[...document.querySelectorAll('.composer-attachment-disclosure button')].find(e=>e.getAttribute('aria-label')===${json('移除附件 Scodex 工作台')});if(!button)throw Error('Remove context button missing');button.click()})()`);
    await wait(()=>cdp.evaluate('document.querySelectorAll(".composer-attachment-list .chat-file-card").length===1'),'Remove workbench context');
    await click('添加工具和上下文');await wait(()=>cdp.evaluate('Boolean(document.querySelector(".composer-popover"))'),'Skill menu');
    await textClick('.composer-menu-item','并行验收技能只属于此聊天的技能');
    await click('添加工具和上下文');await textClick('.composer-menu-item','计划模式开启计划模式');
    const other=await createChat();assert.equal(await cdp.evaluate('document.querySelectorAll(".chat-image-preview,.composer-attachment-list .chat-file-card").length'),0);
    await insert('[aria-label="输入工作内容"]','其他聊天草稿');
    await goChat(d);assert.equal(await cdp.evaluate('document.querySelector("[aria-label=输入工作内容]").value'),'DRAFT-'+token);
    assert.equal(await cdp.evaluate('document.querySelector(".composer-attachment-disclosure")?.open'),false);
    assert.equal(await cdp.evaluate('document.querySelectorAll(".chat-image-preview").length'),1);
    assert.equal(await cdp.evaluate('document.querySelectorAll(".composer-attachment-list .chat-file-card").length'),1);
    await click('添加工具和上下文');
    const menu=await cdp.evaluate('document.querySelector(".composer-popover").innerText');assert.match(menu,/已开启/);
    const checked=await cdp.evaluate('[...document.querySelectorAll(".composer-menu-item")].filter(e=>e.textContent.includes("并行验收技能")).map(e=>e.innerHTML)');assert.match(checked[0],/lucide-check/);
    await click('添加工具和上下文');await click('发送消息');const answer=await finish();assert.match(answer,/仅D附件已收到/);
    const saved=await savedChat(d,c=>c.messages.at(-1)?.content.includes('仅D附件已收到'));
    assert.equal(saved.messages[0].images.length,1);assert.equal(saved.messages[0].attachments.length,1);assert.equal(saved.messages[0].mode,'plan');assert.match(saved.messages[0].skillName,/并行验收/);
    const disclosure=()=>cdp.evaluate(`(()=>{const message=[...document.querySelectorAll('[data-message-id]')].find(e=>e.dataset.messageId===${json(saved.messages[0].id)});const details=message?.querySelector('.message-attachment-disclosure');const summary=details?.querySelector('summary'),rect=summary?.getBoundingClientRect();return details?{open:details.open,label:summary.getAttribute('aria-label'),files:[...details.querySelectorAll('.chat-file-card strong')].map(e=>e.textContent),fileStatus:details.querySelector('.chat-file-card small')?.textContent,visibleFiles:[...details.querySelectorAll('.chat-file-card')].filter(e=>e.getClientRects().length).length,images:[...details.querySelectorAll('.message-image-list img')].map(e=>e.alt),visibleImages:[...details.querySelectorAll('.message-image-list img')].filter(e=>e.getClientRects().length).length,bounds:{left:rect.left,right:rect.right,viewport:innerWidth,documentWidth:document.documentElement.scrollWidth,fontSize:parseFloat(getComputedStyle(summary.querySelector('.message-attachment-name')).fontSize)}}:null})()`);
    const collapsed=await disclosure();assert.equal(collapsed.open,false);assert.equal(collapsed.visibleFiles,0);assert.equal(collapsed.visibleImages,0);assert.match(collapsed.label,/2 项/);assert.ok(collapsed.bounds.left>=0&&collapsed.bounds.right<=collapsed.bounds.viewport&&collapsed.bounds.documentWidth<=collapsed.bounds.viewport);assert.ok(collapsed.bounds.fontSize>=14);
    await wait(()=>cdp.evaluate('!document.querySelector(".toast")'),'Attachment screenshot unobstructed');
    const collapsedScreenshot=path.join(output,'message-attachments-collapsed.png');await fs.writeFile(collapsedScreenshot,Buffer.from((await cdp.command('Page.captureScreenshot',{format:'png'})).data,'base64'));
    await cdp.evaluate(`(()=>{const message=[...document.querySelectorAll('[data-message-id]')].find(e=>e.dataset.messageId===${json(saved.messages[0].id)});message.querySelector('.message-attachment-disclosure summary').click()})()`);
    const expanded=await disclosure();assert.equal(expanded.open,true);assert.deepEqual(expanded.files,['note-D.txt']);assert.match(expanded.fileStatus,/正文已解析/);assert.equal(expanded.visibleFiles,1);assert.deepEqual(expanded.images,['picture-D.png']);assert.equal(expanded.visibleImages,1);
    const expandedScreenshot=path.join(output,'message-attachments-expanded.png');await fs.writeFile(expandedScreenshot,Buffer.from((await cdp.command('Page.captureScreenshot',{format:'png'})).data,'base64'));
    await goChat(other);assert.equal(await cdp.evaluate('document.querySelector("[aria-label=输入工作内容]").value'),'其他聊天草稿');
    report.chatIds.draft=d;return {d,other,images:1,attachments:1,draftAttachments:{collapsedByDefault:true,clickExpands:true,removeAndRestore:true,workbenchContextCollapsedExpandedRemoved:true,chatSwitchResetsToCollapsed:true,bounds:draftCollapsed.bounds,collapsedScreenshot:draftCollapsedScreenshot,expandedScreenshot:draftExpandedScreenshot},attachmentDetails:{collapsedByDefault:true,clickExpands:true,restartCheckPending:true,bounds:collapsed.bounds,collapsedScreenshot,expandedScreenshot},mode:saved.messages[0].mode,skill:saved.messages[0].skillName};
  });
  await runCheck('background-errors-and-global-guards',async()=>{
    const hold=await createChat();const tag='STREAM-GUARD-'+token;await submit(tag);await wait(()=>streams.has(tag),'Guard stream');
    const err=await createChat();await submit('ERROR-'+token);await goChat(hold);
    const failed=await savedChat(err,c=>c.messages.at(-1)?.error?.includes('503'));assert.match(failed.messages.at(-1).error,/503/);
    assert.equal((await runRows()).length,1);assert.equal((await runRows())[0].id,hold);
    const guards=[];
    guards.push(await expectRejected('window.scodex.saveModelConnection({name:"blocked",baseUrl:'+json(endpoint)+',model:"fixture-parallel",models:["fixture-parallel"]})',/停止|等待/));
    guards.push(await expectRejected('window.scodex.getAppState().then(s=>window.scodex.configureConversationStorage({compressHistory:true},s.library))',/停止/));
    const projects=(await state()).projects,projectA=projects.find(project=>path.resolve(project.path)===workspace),projectBRecord=projects.find(project=>path.resolve(project.path)===projectB);
    assert.ok(projectA&&projectBRecord,'Both isolated projects remain registered');
    await goProject(projectBRecord.id);assert.equal((await runRows()).some(row=>row.id===hold),true);
    await goProject(projectA.id);
    endStream(streams.get(tag),'其他任务错误后仍完成。');await finish();
    const stable=await savedChat(hold,c=>c.messages.at(-1)?.content.includes('仍完成'));assert.equal(stable.messages.at(-1).error,undefined);
    return {hold,err,guards,projectSwitchDuringRun:{allowed:true,taskContinued:true,returnedToProjectA:true}};
  });
  await runCheck('approval-ownership-and-independent-refusal',async()=>{
    const a=await createChat(true);await submit('CMD-A-'+token);await wait(()=>cdp.evaluate('Boolean(document.querySelector(".agent-approval"))'),'A approval');
    const b=await createChat(true);await submit('CMD-B-'+token);await wait(()=>cdp.evaluate('Boolean(document.querySelector(".agent-approval"))'),'B approval');
    const rows=await runRows();assert.equal(rows.filter(r=>r.text.includes('等待审批')).length,2);
    await goChat(a);assert.match(await cdp.evaluate('document.querySelector(".agent-approval").innerText'),/command-A/);
    await textClick('.agent-approval-actions button','允许本次命令');await finish();
    assert.equal(await fs.readFile(path.join(workspace,'command-A.txt'),'utf8'),'来自任务A');
    assert.equal((await runRows()).length,1);await goChat(b);
    assert.match(await cdp.evaluate('document.querySelector(".agent-approval").innerText'),/command-B/);
    await textClick('.agent-approval-actions button','拒绝');await finish();await assert.rejects(fs.access(path.join(workspace,'command-B.txt')));
    const ca=await savedChat(a,c=>c.messages.at(-1)?.operations?.some(o=>o.status==='succeeded')),cb=await savedChat(b,c=>c.messages.at(-1)?.operations?.some(o=>o.status==='failed'));
    report.chatIds.approval={a,b};return {a,b,aStatus:ca.messages.at(-1).operations[0].status,bStatus:cb.messages.at(-1).operations[0].status};
  });
  await runCheck('background-approval-stop',async()=>{
    const stopped=await createChat(true);await submit('CMD-C-'+token);await wait(()=>cdp.evaluate('Boolean(document.querySelector(".agent-approval"))'),'C approval');
    const other=await createChat();const tag='STREAM-OTHER-'+token;await submit(tag);await wait(()=>streams.has(tag),'Other stream');
    await stopChat(stopped);assert.equal((await runRows()).length,1);await assert.rejects(fs.access(path.join(workspace,'command-C.txt')));
    endStream(streams.get(tag),'停止另一项后继续完成。');await finish();
    await goChat(stopped);assert.equal(await cdp.evaluate('Boolean(document.querySelector(".agent-approval"))'),false);
    const saved=await savedChat(stopped,c=>c.messages.at(-1)?.cancelled);return {stopped,other,cancelled:saved.messages.at(-1).cancelled};
  });
  await runCheck('shared-file-read-edit-read-conflict',async()=>{
    await fs.writeFile(path.join(workspace,'shared.txt'),'初始值\r\n');
    const ids=[];for(const letter of ['A','B']){ids.push(await createChat(true));await submit('SHARED-'+letter+'-'+token);}
    await wait(async()=>sharedReady.size===2,'Both observed shared file');
    await wait(async()=>(await runRows()).length===0,'Shared tasks completed',45000);
    const chats=await Promise.all(ids.map(id=>savedChat(id,c=>c.messages.at(-1)?.operations?.length===3)));
    const edits=chats.map(c=>c.messages.at(-1).operations.find(o=>o.name==='edit_file'));
    assert.equal(edits.filter(o=>o.status==='succeeded').length,1);assert.equal(edits.filter(o=>o.status==='failed').length,1);
    assert.match(edits.find(o=>o.status==='failed').output||edits.find(o=>o.status==='failed').detail,/变化|修改|保存|基线/);
    const saved=await fs.readFile(path.join(workspace,'shared.txt'),'utf8');assert.match(saved,/^任务[AB]\r\n$/);
    for(const chat of chats){assert.equal(chat.messages.at(-1).operations.at(-1).status,'succeeded');}
    report.chatIds.shared=ids;return {ids,editStatuses:edits.map(o=>o.status),saved,readBacks:2};
  });
  await runCheck('navigation-and-layout',async()=>{
    if(await cdp.evaluate('Boolean(document.querySelector("[aria-label=展开侧栏]"))')) {await click('展开侧栏');await wait(()=>cdp.evaluate('!document.querySelector(".rail-collapsed")'),'Sidebar expanded');}
    const a=await createChat();const tag='STREAM-LAYOUT-'+token;await submit(tag);await wait(()=>streams.has(tag),'Layout stream');
    const b=await createChat();
    // The click below verifies navigation; do not navigate twice.
    // Use the visible navigation controls after focusing out of the composer.
    await cdp.evaluate('document.activeElement?.blur()');
    const back=await cdp.evaluate('(()=>{const e=document.querySelector("[aria-label=后退]")||document.querySelector("[title*=后退]");if(!e||e.disabled)return false;e.click();return true})()');
    assert.equal(back,true);await wait(async()=>await currentId()===a,'Back to running chat');
    const measurements=[];
    for(const viewport of [{width:1440,height:900},{width:1080,height:700}]){
      await cdp.command('Emulation.setDeviceMetricsOverride',{...viewport,deviceScaleFactor:1,mobile:false});
      await cdp.evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
      const geo=await cdp.evaluate('(()=>{const t=document.querySelector("[aria-label=输入工作内容]"),r=document.querySelector(".chat-runs"),s=getComputedStyle(t);return {width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,textarea:t.getBoundingClientRect().toJSON(),runs:r.getBoundingClientRect().toJSON(),font:s.fontFamily,fontSize:s.fontSize,small:[...r.querySelectorAll("small,p")].map(e=>parseFloat(getComputedStyle(e).fontSize)),stopVisible:[...r.querySelectorAll(".chat-run-stop")].every(e=>e.getBoundingClientRect().bottom<=innerHeight)}})()');
      assert.ok(geo.scrollWidth<=geo.width+1);assert.ok(geo.textarea.bottom<=geo.height+1);assert.match(geo.font,/Microsoft YaHei/);assert.ok(parseFloat(geo.fontSize)>=16);assert.ok(geo.small.every(n=>n>=14));assert.equal(geo.stopVisible,true);measurements.push(geo);
    }
    await click('收起侧栏');await wait(()=>cdp.evaluate('document.querySelector(".chat-runs").classList.contains("collapsed")'),'Sidebar collapsed');await click('展开侧栏');await wait(()=>cdp.evaluate('!document.querySelector(".chat-runs").classList.contains("collapsed")'),'Sidebar expanded');
    await cdp.command('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});
    await cdp.evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
    const image=await cdp.command('Page.captureScreenshot',{format:'png'});await fs.writeFile(path.join(output,'concurrent-chats.png'),Buffer.from(image.data,'base64'));
    endStream(streams.get(tag),'布局检查已完成。');await finish();
    return {a,b,measurements,screenshot:path.join(output,'concurrent-chats.png')};
  });
  await runCheck('restart-history',async()=>{
    const before=await state();await quit();await launch(await freePort());
    const after=await state();assert.equal(after.version,expectedVersion);assert.equal((await runRows()).length,0);
    for(const ids of Object.values(report.chatIds).flatMap(value=>typeof value==='string'?[value]:Array.isArray(value)?value:Object.values(value))){
      const saved=after.library.conversations.find(c=>c.id===ids);assert.ok(saved,'Stored '+ids);assert.equal(saved.messages.some(m=>m.approval||m.pending),false);
    }
    const current=after.library.conversations.find(c=>c.id===report.chatIds.draft);if(current){assert.equal(current.messages[0].images.length,1);assert.equal(current.messages[0].attachments.length,1);}
    if(report.chatIds.draft){await goChat(report.chatIds.draft);const disclosure=await cdp.evaluate('(()=>{const details=document.querySelector(".message-attachment-disclosure");return details?{open:details.open,files:details.querySelectorAll(".chat-file-card").length,images:details.querySelectorAll(".message-image-list img").length}:null})()');assert.deepEqual(disclosure,{open:false,files:1,images:1});}
    const disk=JSON.parse(await fs.readFile(path.join(profile,'conversations.json'),'utf8'));assert.equal(disk.conversations.length,after.library.conversations.length);
    return {before:before.library.conversations.length,after:after.library.conversations.length,noActiveRequests:true};
  });
  await runCheck('final-entry',async()=>{
    const s=await state();assert.equal(s.version,expectedVersion);
    const ids=report.chatIds.shared;assert.ok(ids?.length);await goChat(ids[0]);
    assert.match(await cdp.evaluate('document.querySelector(".message-list").innerText'),/共享任务/);
    const disk=JSON.parse(await fs.readFile(path.join(profile,'conversations.json'),'utf8'));assert.ok(disk.conversations.some(c=>c.messages.some(m=>m.images?.length&&m.attachments?.length)));
    return {version:s.version,executableSha256:report.executableSha256,sharedHistory:ids.length,storedChats:disk.conversations.length};
  });
  report.status='passed';
 }catch(error){report.status='failed';report.error=error.stack;console.error(error.stack);
  if(cdp)try{report.failureUI=await cdp.evaluate('({notice:document.querySelector(".toast")?.textContent,preview:document.querySelector(".composer-attachment-list")?.innerText,images:document.querySelectorAll(".chat-image-preview").length,cards:document.querySelectorAll(".composer-attachment-list .chat-file-card").length,loading:Boolean(document.querySelector(".attachment-loading")),view:document.querySelector("main")?.innerText?.slice(-1800)})');}catch{}
 }
 finally{
   report.requests=requests;report.fixtureDirectory=temporary;
   if(cdp&&child?.exitCode===null){try{
     await cdp.evaluate('document.querySelectorAll(".chat-run-stop").forEach(e=>e.click())');
     await wait(async()=>(await runRows()).length===0,'Cleanup cancels owned tasks');
     for(const res of streams.values()){if(!res.writableEnded)res.end();}
     await quit();
   }catch(e){report.cleanupError=e.message;socket?.close();}}
   for(const res of streams.values()){if(!res.writableEnded)res.end();}
   if(modelServer){modelServer.closeAllConnections();await new Promise(r=>modelServer.close(r));}
   report.childExitCode=child?.exitCode;report.ownedChildren=[...children].map(c=>({pid:c.pid,exitCode:c.exitCode}));
   report.finishedAt=new Date().toISOString();
   const name=only==='final-entry'?'post-replacement-verification.json':'cross-project-chats-ui-verification.json';
   await fs.writeFile(path.join(output,name),json(report,null,2)+'\n');
   console.log(json({status:report.status,checks:report.checks.length,fixture:temporary,report:name}));if(report.status!=='passed')process.exitCode=1;
 }
}
main();
