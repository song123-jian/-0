// Live relay verification. Key arrives on stdin, never in source, arguments or report.
const fs=require('node:fs/promises'),path=require('node:path'),http=require('node:http'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const{spawn,execFile}=require('node:child_process'),{promisify}=require('node:util'),{connect,wait,freePort}=require('./agent-workflow-ui.cjs');
const execFileAsync=promisify(execFile),json=JSON.stringify;
const root=path.resolve(__dirname,'..'),output=path.join(root,'release/browser-runtime-20261024'),executable=path.join(output,'Scodex-Workbench-1.3.0-x64.exe');
const temporary=process.env.SCODEX_BROWSER_FIXTURE||process.argv[2];if(!temporary)throw Error('Existing isolated fixture is required');
const profile=path.join(temporary,'profile'),fakeRoot=path.join(temporary,'scodex');
let secret='',child,socket,cdp,server,base,port;
const code='V'+crypto.randomInt(10000,99999),records=[],report={status:'running',executable,model:'deepseek-v4.1-flash',relay:'https://catbee.online',checks:[],limitations:['Uses the real portable EXE, actual relay model, local controlled project and website. CDP drives the app renderer.','Does not establish Grok availability, arbitrary desktop control, or third-party website/account compatibility.']};
async function click(label){await wait(()=>cdp.evaluate('(()=>{const e=document.querySelector('+json('[aria-label="'+label+'"]')+');if(!e||e.disabled)return false;e.click();return true})()'),'Button '+label);}
async function textClick(selector,label){await wait(()=>cdp.evaluate('(()=>{const e=[...document.querySelectorAll('+json(selector)+')].find(e=>e.textContent.trim()==='+json(label)+');if(!e||e.disabled)return false;e.click();return true})()'),'Button '+label);}
async function insert(label,value){await cdp.evaluate('(()=>{const e=document.querySelector('+json('[aria-label="'+label+'"]')+');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,"value").set.call(e,'+json(value)+');e.dispatchEvent(new Event("input",{bubbles:true}));return true})()');}
async function check(name,fn){try{const evidence=await fn();report.checks.push({name,status:'passed',evidence});console.log('PASS '+name);}catch(e){report.checks.push({name,status:'not-verified',error:String(e.message).split(secret).join('[hidden]')});console.log('NOT VERIFIED '+name);try{if(await cdp.evaluate('Boolean(document.querySelector("[aria-label=停止生成]"))')){await click('停止生成');await wait(()=>cdp.evaluate('!document.querySelector("[aria-label=停止生成]")'),'Stop');}}catch{}}await save();}
async function save(){await fs.writeFile(path.join(output,'live-relay-verification.json'),json(report).split(secret||'\0').join('[hidden]'));}
async function task(prompt){
 await cdp.evaluate('document.querySelector(".activity-rail [aria-label=项目]").click()');await click('新聊天');await wait(()=>cdp.evaluate('!document.querySelector(".message-list")'),'New chat');await click('执行任务');await insert('输入工作内容',prompt);await click('发送消息');
 const approvals=[];const deadline=Date.now()+180000;
 while(Date.now()<deadline){const status=await wait(()=>cdp.evaluate('document.querySelector(".agent-approval")?"approval":!document.querySelector("[aria-label=停止生成]")?"done":false'),'Real model response',60000);
  if(status==='done'){const current=await wait(()=>cdp.evaluate('window.scodex.getAppState().then(s=>{const m=s.library.conversations.find(c=>c.id===s.library.activeId).messages.at(-1);return m&&(m.content||m.error)&&m})'),'Final history persistence',12000);return{text:current.content||'',error:current.error||'',operations:(current.operations||[]).map(o=>({name:o.name,status:o.status,detail:o.detail,output:o.output?.slice(-1200)})),approvals};}
  const approval=await cdp.evaluate('({text:document.querySelector(".agent-approval").innerText,params:document.querySelector(".agent-approval pre").textContent})');
  const params=JSON.parse(approval.params);assert.ok(params.url?.startsWith(base+'/'),'Only this controlled website may be approved');assert.ok(approvals.length<15);
  approvals.push({url:params.url,target:params.target?.name||'',action:approval.text.split('\n')[0]});await textClick('.agent-approval-actions button','允许本次网页操作');
 }
 throw Error('Live task exceeded 180 seconds');
}
async function main(){
 try{
  for await(const chunk of process.stdin)secret+=chunk;secret=secret.trim();if(!secret.startsWith('sk-'))throw Error('Test key missing');
  report.expectedVisualCode=code;
  report.sha256=crypto.createHash('sha256').update(await fs.readFile(executable)).digest('hex');
  server=http.createServer(async(req,res)=>{if(req.url==='/record'){let raw='';for await(const c of req)raw+=c;records.push(JSON.parse(raw));res.writeHead(200,{'content-type':'text/plain; charset=utf-8'});return res.end('已保存：'+records.at(-1).title);}
   res.writeHead(200,{'content-type':'text/html; charset=utf-8'});
   if(req.url==='/vision')return res.end('<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#e9f2ef}canvas{width:100%;max-width:900px}</style><canvas id="c" width="900" height="600"></canvas><script>const c=document.getElementById("c").getContext("2d");c.fillStyle="#176c5b";c.fillRect(0,0,900,600);c.fillStyle="white";c.font="bold 110px Arial";c.textAlign="center";c.fillText('+json(code)+',450,330);</script>');
   res.end('<!doctype html><meta charset="utf-8"><title>中转站实际网页测试</title><style>body{font:18px/1.8 "Microsoft YaHei";padding:24px}input,button{font:inherit;padding:12px;max-width:90%;box-sizing:border-box}button{background:#176c5b;color:white;display:block;margin-top:16px}</style><h1>网页任务验收</h1><label>记录标题<input aria-label="记录标题" id="title"></label><button id="save">保存记录</button><p id="result">尚未保存</p><script>document.querySelector("#save").onclick=async()=>{const r=await fetch("/record",{method:"POST",body:JSON.stringify({title:document.querySelector("#title").value})});document.querySelector("#result").textContent=await r.text()};</script>');
  });await new Promise(r=>server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+server.address().port;port=await freePort();
  child=spawn(executable,['--remote-debugging-port='+port,'--user-data-dir='+profile,'--disable-gpu'],{windowsHide:true,cwd:output,stdio:'ignore',env:{...process.env,SCODEX_HOME:fakeRoot,SCODEX_REFERENCE_HOME:path.join(temporary,'reference'),SCODEX_REFERENCE_AGENTS_HOME:path.join(temporary,'agents')}});
  const target=await wait(async()=>(await fetch('http://127.0.0.1:'+port+'/json/list').then(r=>r.json())).find(v=>v.type==='page'&&v.url.startsWith('file:')),'Live EXE startup',40000);
  socket=new WebSocket(target.webSocketDebuggerUrl);await new Promise(r=>socket.addEventListener('open',r,{once:true}));cdp=connect(socket);await wait(()=>cdp.evaluate('Boolean(document.querySelector("[aria-label=输入工作内容]"))'),'UI');
  const identity=await cdp.evaluate('window.scodex.getAppState().then(s=>({version:s.version,workspaceRoot:s.workspaceRoot}))');assert.equal(identity.version,'1.3.0');assert.ok(identity.workspaceRoot.startsWith(temporary));
  await cdp.evaluate('window.scodex.saveAgentSettings({approvalPolicy:"on-request",sandboxMode:"danger-full-access",networkAccess:true,networkDomains:["*"],allowLocalBinding:true},"shared")');await cdp.evaluate('window.scodex.savePreferences({browserAiEnabled:true,browserSiteRules:[]})');
  await cdp.evaluate('window.scodex.saveModelConnection('+json({name:'真实中转站隔离验收',baseUrl:'https://catbee.online/v1',model:'deepseek-v4.1-flash',models:['deepseek-v4.1-flash'],toolProtocol:'native',apiKey:secret})+')');await cdp.evaluate('location.reload()');await wait(()=>cdp.evaluate('Boolean(document.querySelector("[aria-label=输入工作内容]"))'),'Reload');
  const proof=path.join(identity.workspaceRoot,'relay-proof.txt');await fs.writeFile(proof,'待验证\n');
  await check('live-model-read-edit-read',async()=>{const result=await task('这是隔离测试项目。请实际使用 read_file 读取 relay-proof.txt，使用 edit_file 或 write_file 将文件完整改为“中转站实际工具往返成功”一行，然后再次 read_file 回读验证。只处理此文件，不运行命令。不要只提供建议，必须调用真实工具。');const value=await fs.readFile(proof,'utf8');assert.equal(value.trim(),'中转站实际工具往返成功');assert.equal(result.error,'');assert.ok(result.operations.filter(o=>o.name==='read_file'&&o.status==='succeeded').length>=2);return{...result,actualFileContent:value};});
  await check('live-model-browser-form',async()=>{const result=await task('请只使用浏览器工具完成隔离网页验收：打开 '+base+'/form ，读取网页，将“记录标题”填为“真实中转网页提交成功”，重新读取再点击“保存记录”，最后再次读取确认页面的已保存文字。所有操作等待用户批准，不使用文件或命令工具。目标只包含此本地测试站点。');assert.equal(result.error,'');assert.equal(records.filter(v=>v.title==='真实中转网页提交成功').length,1);assert.ok(result.operations.some(o=>o.name==='browser_click'&&o.status==='succeeded'));assert.ok(result.operations.filter(o=>o.name==='browser_snapshot'&&o.status==='succeeded').length>=2);return{...result,records:[...records]};});
  await check('live-model-visual-screenshot',async()=>{const result=await task('请只使用浏览器工具：打开 '+base+'/vision ，调用 browser_screenshot 截图，然后读出图片中央的识别码。识别码仅存在于画布像素中。不要编造，不使用文件或命令工具。');assert.equal(result.error,'');assert.ok(result.operations.some(o=>o.name==='browser_screenshot'&&o.status==='succeeded'));assert.ok(result.text.includes(code));return{...result,expectedVisualCode:code};});
  report.status=report.checks.every(c=>c.status==='passed')?'passed':'partial';
 }catch(e){report.status='failed';report.error=String(e.stack).split(secret||'\0').join('[hidden]');process.exitCode=1;}
 finally{
  try{if(socket?.readyState===1){await cdp.evaluate('window.scodex.saveModelConnection('+json({name:'验收后受控占位',baseUrl:base+'/v1',model:'controlled-browser-model',models:['controlled-browser-model'],toolProtocol:'native',apiKey:'controlled-only'})+')');report.testCredentialReplaced=true;await cdp.evaluate('window.scodex.quitApp()');await wait(()=>Promise.resolve(child.exitCode!==null),'Exit',20000);}}catch(e){report.cleanupError=String(e.message).split(secret||'\0').join('[hidden]');}
  socket?.close();if(child?.exitCode===null)child.kill();server?.closeAllConnections();await new Promise(r=>server?.close(r)||r());
  report.finishedAt=new Date().toISOString();report.fixtureDirectory=temporary;await save();secret='';console.log('RESULT '+report.status);
 }
}
if(require.main===module)main();
