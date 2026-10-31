const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const net = require('node:net');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'release', 'tray-tools-20261024');
const executable = path.join(output, 'Scodex-Workbench-1.0.5-x64.exe');
const resumeDirectory = process.env.SCODEX_RESUME_TRAY;
const temporary = resumeDirectory || path.join(os.tmpdir(), 'scodex-tray-' + crypto.randomUUID());
const profile = path.join(temporary, 'profile'); const workspace = path.join(temporary, 'workspace');
const fakeRoot = path.join(temporary, 'scodex'); const nativeHome = path.join(temporary, 'native-codex');
const report = { status: 'running', executable, version: '1.0.5', environment: { platform: os.platform(), release: os.release(), node: process.version }, checks: [], limitations: ['External models and MCP processes are not connected; scheduler failure uses an intentionally missing credential.'] };
let child, socket, cdp; const children = new Set();
const json = JSON.stringify;
async function wait(fn, label, timeout=30000) { const end=Date.now()+timeout; let last; while(Date.now()<end){try{const v=await fn();if(v)return v;}catch(e){last=e;} await new Promise(r=>setTimeout(r,120));}throw Error(label+(last?': '+last.message:'')); }
function connect(ws){let id=0;const pending=new Map();ws.addEventListener('message',({data})=>{const m=JSON.parse(data);const p=pending.get(m.id);if(!p)return;pending.delete(m.id);clearTimeout(p.timer);m.error?p.reject(Error(m.error.message)):p.resolve(m.result);});return {command(method,params={}){return new Promise((resolve,reject)=>{const current=++id;const timer=setTimeout(()=>{pending.delete(current);reject(Error('CDP timeout '+method));},25000);pending.set(current,{resolve,reject,timer});ws.send(json({id:current,method,params}));});},async evaluate(expression){const r=await this.command('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true,userGesture:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result?.value;}};}
var reused = [];
async function check(name,fn){const prior=reused.find(x=>x.name===name&&x.status==='passed');if(prior){report.checks.push({...prior,reused:true});console.log('REUSE '+name);return;}const evidence=await fn();report.checks.push({name,status:'passed',evidence});console.log('PASS '+name);}
async function port(){const server=net.createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));const p=server.address().port;await new Promise(r=>server.close(r));return p;}
function launch(portNumber){const p=spawn(executable,['--remote-debugging-port='+portNumber,'--user-data-dir='+profile,'--disable-gpu'],{cwd:output,windowsHide:true,stdio:['ignore','ignore','pipe'],env:{...process.env,SCODEX_HOME:fakeRoot,SCODEX_REFERENCE_HOME:nativeHome,SCODEX_REFERENCE_AGENTS_HOME:path.join(temporary,'agents')}});children.add(p);p.stderr.on('data',()=>{});return p;}
async function start(){const p=await port();child=launch(p);const target=await wait(async()=>{if(child.exitCode!==null)throw Error('EXE exited '+child.exitCode);return(await fetch('http://127.0.0.1:'+p+'/json/list').then(r=>r.json())).find(x=>x.type==='page'&&x.url.startsWith('file:'));},'App start failed',60000);socket=new WebSocket(target.webSocketDebuggerUrl);await new Promise((r,j)=>{socket.addEventListener('open',r,{once:true});socket.addEventListener('error',j,{once:true});});cdp=connect(socket);await wait(()=>cdp.evaluate('Boolean(window.scodex&&document.querySelector(".task-chat-view textarea"))'),'Renderer ready failed');await cdp.evaluate('document.title="Scodex 1.0.5 托盘验收（隔离配置）"');}
async function click(label){await wait(()=>cdp.evaluate('(()=>{const e=document.querySelector('+json('button[aria-label="'+label+'"]')+');if(!e||e.disabled)return false;e.scrollIntoView({block:"center"});e.focus();e.click();return true})()'),'Click '+label);}
async function textClick(selector,text){await wait(()=>cdp.evaluate('(()=>{const e=[...document.querySelectorAll('+json(selector)+')].find(x=>x.textContent.trim()==='+json(text)+'||x.getAttribute("title")==='+json(text)+');if(!e||e.disabled)return false;e.scrollIntoView({block:"center"});e.focus();e.click();return true})()'),'Click '+text);}
async function key(keyName,modifiers=0,code){const keycode={Escape:27,Enter:13,ArrowLeft:37,ArrowRight:39,ArrowUp:38,ArrowDown:40,',':188,p:80,P:80,j:74,s:83}[keyName];const props={key:keyName,modifiers,windowsVirtualKeyCode:keycode,nativeVirtualKeyCode:keycode,...(code?{code}:{})};await cdp.command('Input.dispatchKeyEvent',{type:'keyDown',...props});await cdp.command('Input.dispatchKeyEvent',{type:'keyUp',...props});}
async function insert(selector,text){await cdp.evaluate('document.querySelector('+json(selector)+').focus()');await cdp.command('Input.insertText',{text});}
async function secondLaunch(){const duplicate=launch(await port());await wait(()=>Promise.resolve(duplicate.exitCode!==null),'Second launcher did not exit',30000);await wait(()=>cdp.evaluate('window.scodex.getDesktopState().then(s=>s.visible)'),'Second-instance restore failed');}
async function quit(){await cdp.evaluate('window.scodex.quitApp()');await wait(()=>Promise.resolve(child.exitCode!==null),'Explicit quit did not exit',30000);socket.close();}
async function main(){try{
  report.executableSha256=crypto.createHash('sha256').update(await fs.readFile(executable)).digest('hex');
  if(process.env.SCODEX_REUSE_TRAY==='1'){const previous=JSON.parse(await fs.readFile(path.join(output,'tray-tools-ui-verification.json'),'utf8'));if(previous.executable!==executable||previous.version!==report.version)throw Error('Reuse identity mismatch');reused=previous.checks;report.previousFailure=previous.error;}
  if(resumeDirectory){
    const previous=JSON.parse(await fs.readFile(path.join(output,'tray-tools-ui-verification.json'),'utf8'));
    assert.equal(previous.fixtureDirectory,temporary);assert.equal(previous.executable,executable);assert.equal(previous.version,report.version);
    assert.equal(path.dirname(path.resolve(temporary)).toLowerCase(),path.resolve(os.tmpdir()).toLowerCase());assert.match(path.basename(temporary),/^scodex-tray-[0-9a-f-]{36}$/);
    const settingsFile=path.join(profile,'settings.json');const settingsBaseline=await fs.readFile(settingsFile,'utf8');const state=JSON.parse(settingsBaseline);assert.equal(state.workspaceRoot,workspace);
    let legacyId;
    if(process.env.SCODEX_FINAL_DELTA==='1'&&!process.env.SCODEX_POINTER_ONLY){
      const file=path.join(workspace,'.codex','skills','legacy-check','SKILL.md');await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,'---\nname: Legacy Check\ndescription: 旧项目技能验收\n---\n保留旧版停用选择。\n',{flag:'wx'});
      legacyId='workspace:'+path.relative(fakeRoot,file).replaceAll(path.sep,'/');state.preferences.disabledSkillIds=[...(state.preferences.disabledSkillIds||[]),legacyId];
      assert.equal(await fs.readFile(settingsFile,'utf8'),settingsBaseline);await fs.writeFile(settingsFile,json(state));
    }
    report.checks.push(...previous.checks.map(check=>({...check,reused:true})));report.screenshot=previous.screenshot;report.baseRun={finishedAt:previous.finishedAt,status:previous.status,checks:previous.checks.length,executableSha256:previous.executableSha256||process.env.SCODEX_BASE_BUILD_SHA256};reused=[];await start();
    if(process.env.SCODEX_LAYOUT_ONLY==='1'){
      report.checks=report.checks.filter(item=>item.name!=='readable tool overview at desktop renderer viewports');
      await click('工具与操作');await wait(()=>cdp.evaluate('Boolean(document.querySelector(".tools-overview"))'),'Final tools view');
      if(await cdp.evaluate('document.querySelector(".browser-toggle")?.getAttribute("aria-pressed")')==='true')await click('隐藏第三工作台');
      await check('readable tool overview at desktop renderer viewports',async()=>{
        const results=[];for(const [width,height]of[[1440,900],[1064,660]]){
          await cdp.command('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});await new Promise(resolve=>setTimeout(resolve,150));
          const layout=await cdp.evaluate('(()=>{const e=document.querySelector(".tools-overview");return{scroll:e.scrollWidth,client:e.clientWidth,font:getComputedStyle(e).fontFamily,body:getComputedStyle(e).fontSize,hintMinimum:Math.min(...[...e.querySelectorAll("kbd,.tools-eyebrow,.tool-card-copy>span")].map(x=>parseFloat(getComputedStyle(x).fontSize))),cardCount:e.querySelectorAll(".tool-card").length}})()');
          assert.ok(layout.scroll<=layout.client+1);assert.equal(layout.cardCount,18);assert.match(layout.font,/Microsoft YaHei/);assert.ok(parseFloat(layout.body)>=16);assert.ok(layout.hintMinimum>=14);
          await key('P',10,'KeyP');await wait(()=>cdp.evaluate('Boolean(document.querySelector(".command-palette[open]"))'),'Command popup');
          const command=await cdp.evaluate('(()=>{const e=document.querySelector(".command-palette");const r=e.getBoundingClientRect();return{left:r.left,right:r.right,bottom:r.bottom,viewport:[innerWidth,innerHeight],hintMinimum:Math.min(...[...e.querySelectorAll("kbd,small,footer")].map(x=>parseFloat(getComputedStyle(x).fontSize)))}})()');assert.ok(command.left>=0&&command.right<=width);assert.ok(command.bottom<=height);assert.ok(command.hintMinimum>=14);await key('Escape');results.push({width,height,...layout,command});
        }await cdp.command('Emulation.clearDeviceMetricsOverride');return results;
      });
      const finalCapture=await cdp.command('Page.captureScreenshot',{format:'png'});report.screenshot=path.join(output,'tools-overview.png');await fs.writeFile(report.screenshot,Buffer.from(finalCapture.data,'base64'));report.status='passed';return;
    }
    if(process.env.SCODEX_FINAL_DELTA==='1'){
      if(!process.env.SCODEX_POINTER_ONLY){
      await click('技能');await wait(()=>cdp.evaluate('Boolean(document.querySelector(".skills-center-open"))'),'Skills ready');
      await check('legacy project Skill disable choice survives the expanded source inventory',async()=>{
        const skills=await cdp.evaluate('window.scodex.listSkills()');assert.ok(skills.some(skill=>skill.id===legacyId));
        await textClick('.skills-center-open','Legacy Check旧项目技能验收');await wait(()=>cdp.evaluate('document.querySelector(".skill-readme")?.textContent.includes("保留旧版停用选择")'),'Legacy Skill detail');
        assert.ok(await cdp.evaluate("[...document.querySelectorAll(\"button\")].some(e=>e.getAttribute(\"aria-label\")===\"启用技能 Legacy Check\")"));
        await click('启用技能 Legacy Check');await wait(()=>cdp.evaluate('window.scodex.getAppState()').then(s=>!s.preferences.disabledSkillIds.includes(legacyId)),'Legacy Skill enabled');
        const saved=JSON.parse(await fs.readFile(settingsFile,'utf8'));assert.ok(!saved.preferences.disabledSkillIds.includes(legacyId));return{legacyId,restoredDisabled:true,enabledAndPersisted:true};
      });
      }
      await key('j',2,'KeyJ');await wait(()=>cdp.evaluate('Boolean(document.querySelector(".terminal-panel"))'),'Terminal for pointer resize');
      if(process.env.SCODEX_POINTER_DIAGNOSTIC==='1'){
        report.pointerDiagnostic=await cdp.evaluate('(()=>{const e=document.querySelector("[aria-label=调整第三工作台宽度]");const r=e.getBoundingClientRect();const hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return{viewport:[innerWidth,innerHeight],rect:r.toJSON(),display:getComputedStyle(e).display,paneWidth:e.parentElement.getBoundingClientRect().width,hit:hit?.outerHTML.slice(0,400)}})()');console.log(json(report.pointerDiagnostic));report.status='diagnostic';return;
      }
      await check('third workbench pointer drag saves its width',async()=>{
        const handle=await cdp.evaluate('(()=>{const e=document.querySelector("[aria-label=调整第三工作台宽度]");const r=e.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()');const before=await cdp.evaluate('window.scodex.getAppState().then(s=>s.preferences.browserPanelWidth)');
        await fs.rm(path.join(output,'native-complete.json'),{force:true});
        await fs.writeFile(path.join(output,'native-ready.json'),json({status:'ready',phase:'resize',title:'Scodex 1.0.5 托盘验收（隔离配置）',profile,temporary,executable,handle,expectedWidth:before+40}));console.log('NATIVE_READY resize');
        await wait(async()=>{try{const signal=JSON.parse(await fs.readFile(path.join(output,'native-complete.json'),'utf8'));return signal.phase==='resize'&&signal.profile===profile;}catch{return false;}},'Native pointer acceptance not supplied',180000);
        await wait(()=>cdp.evaluate('window.scodex.getAppState()').then(s=>s.preferences.browserPanelWidth===before+40),'Pointer width persistence');assert.equal(JSON.parse(await fs.readFile(settingsFile,'utf8')).preferences.browserPanelWidth,before+40);return{before,after:before+40};
      });
      await click('工具与操作');await wait(()=>cdp.evaluate('Boolean(document.querySelector(".tools-overview"))'),'Final tools view');
      if(await cdp.evaluate('document.querySelector(".browser-toggle")?.getAttribute("aria-pressed")')==='true')await click('隐藏第三工作台');
      const finalCapture=await cdp.command('Page.captureScreenshot',{format:'png'});report.screenshot=path.join(output,'tools-overview.png');await fs.writeFile(report.screenshot,Buffer.from(finalCapture.data,'base64'));
      report.status='passed';return;
    }
  } else {
  for(const folder of [profile,workspace,fakeRoot,path.join(workspace,'.codex'),path.join(nativeHome,'skills','native-check'),path.join(nativeHome,'plugins','cache','provider','no-skill','26.10.1')])await fs.mkdir(folder,{recursive:true});
  await fs.writeFile(path.join(nativeHome,'skills','native-check','SKILL.md'),'---\nname: Native Check\ndescription: 中文本机技能验收\n---\n只作为测试说明。\n');
  await fs.writeFile(path.join(nativeHome,'config.toml'),'[plugins."no-skill@provider"]\nenabled=true\n[mcp_servers.fixture]\ncommand="PRIVATE_COMMAND"\n[mcp_servers.fixture.env]\nTOKEN="PRIVATE_TOKEN"\n');
  await fs.writeFile(path.join(workspace,'demo.js'),'console.log("fixture");\n');
  await fs.writeFile(path.join(profile,'settings.json'),json({workspaceRoot:workspace,preferences:{browserPanelOpen:false}}));
  const scheduled={id:'tray-timer',name:'托盘后台检查',prompt:'isolated timer check',frequency:'daily',time:'09:00',timezone:'Asia/Shanghai',enabled:true,nextRunAt:new Date(Date.now()+90000).toISOString()};
  await fs.writeFile(path.join(profile,'scheduled-tasks.json'),json({version:1,tasks:[scheduled],runs:[]}));
  await start();
  await check('packaged identity and actual tray creation',async()=>{const state=await cdp.evaluate('window.scodex.getAppState()');assert.equal(state.version,'1.0.5');assert.equal(state.desktop.available,true);assert.equal(state.preferences.trayEnabled,true);return{version:state.version,desktop:state.desktop,renderer:await cdp.evaluate('[...document.scripts].map(s=>s.src).find(s=>s.includes("assets/index-"))')};});
  await click('工具与操作');await wait(()=>cdp.evaluate('Boolean(document.querySelector(".tools-overview"))'),'Tools overview');
  await check('local sources, MCP redaction and plugins without Skills',async()=>{const data=await cdp.evaluate('window.scodex.getLocalCapabilities()');assert.ok(data.sources.some(s=>s.path.toLowerCase()===nativeHome.toLowerCase()));assert.equal(data.plugins[0].name,'no-skill');assert.equal(data.plugins[0].connected,false);assert.equal(data.servers[0].name,'fixture');assert.doesNotMatch(json(data),/PRIVATE/);assert.match(await cdp.evaluate('document.querySelector(".tools-overview").innerText'),/运行时未连接/);return{sources:data.sources.length,plugins:data.plugins.length,servers:data.servers.length};});
  await click('插件');await wait(()=>cdp.evaluate('document.querySelector(".plugin-row-copy")?.textContent.includes("no-skill")'),'Native plugin row');
  await check('plugin source and real enable state displayed',async()=>{const text=await cdp.evaluate('document.querySelector(".extension-center").textContent');assert.match(text,/Codex 已启用/);assert.match(text,/Scodex 运行时未连接/);return true;});
  await click('技能');await wait(()=>cdp.evaluate('Boolean(document.querySelector(".skills-center-open"))'),'Skills list');await textClick('.skills-center-open','Native Check中文本机技能验收');
  await check('native Skill can be read, disabled and re-enabled',async()=>{assert.match(await cdp.evaluate('document.querySelector(".skill-readme").textContent'),/只作为测试说明/);await click('停用技能 Native Check');await wait(()=>cdp.evaluate('window.scodex.getAppState().then(s=>s.preferences.disabledSkillIds.length===1)'),'Disable skill persistence');await click('启用技能 Native Check');await wait(()=>cdp.evaluate('window.scodex.getAppState().then(s=>!s.preferences.disabledSkillIds.length)'),'Enable skill persistence');return true;});
  await click('工具命令搜索');await wait(()=>cdp.evaluate('Boolean(document.querySelector(".command-palette[open]"))'),'Command dialog');await key('Escape');await check('Escape restores command-search focus',async()=>{await wait(()=>cdp.evaluate('!document.querySelector(".command-palette")'),'Palette close');assert.equal(await cdp.evaluate('document.activeElement.getAttribute("aria-label")'),'工具命令搜索');return true;});
  await key('P',10,'KeyP');await wait(()=>cdp.evaluate('Boolean(document.querySelector(".command-palette[open]"))'),'Ctrl Shift P');await insert('[aria-label="搜索工作台操作"]','文件与代码');await key('Enter');await wait(()=>cdp.evaluate('Boolean(document.querySelector(".file-view"))'),'Command executes file view');
  await check('command keyboard search executes real tool navigation',async()=>{assert.equal(await cdp.evaluate('Boolean(document.querySelector(".command-palette"))'),false);return true;});
  await textClick('.file-tree-item','demo.js');await wait(()=>cdp.evaluate('document.querySelector(".cm-content")?.textContent.includes("fixture")'),'Open fixture in editor');await insert('.cm-content','// 未保存的托盘编辑\n');
  await key('j',2,'KeyJ');await wait(()=>cdp.evaluate('Boolean(document.querySelector(".terminal-panel"))'),'Integrated terminal');
  await check('resizer keyboard changes and persists width',async()=>{await cdp.evaluate('document.querySelector("[aria-label=调整第三工作台宽度]").focus()');await key('ArrowLeft');await wait(()=>cdp.evaluate('window.scodex.getAppState().then(s=>s.preferences.browserPanelWidth===420)'),'Panel width saved');return{width:420};});
  if(await cdp.evaluate('document.querySelector(".browser-toggle")?.getAttribute("aria-pressed")')==='true') await click('隐藏第三工作台');
  await cdp.evaluate('document.querySelector(".activity-rail [aria-label=项目]").click()');await insert('.task-chat-view textarea','托盘草稿持久化检查');
  if(process.env.SCODEX_NATIVE_TRAY==='1'){
    await fs.rm(path.join(output,'native-complete.json'),{force:true});
    await fs.writeFile(path.join(output,'native-ready.json'),json({status:'ready',phase:'close',title:'Scodex 1.0.5 托盘验收（隔离配置）',profile,temporary,executable}));console.log('NATIVE_READY close');
    await wait(async()=>{try{const signal=JSON.parse(await fs.readFile(path.join(output,'native-complete.json'),'utf8'));return signal.closed===true&&signal.phase==='close'&&signal.profile===profile;}catch{return false;}},'Native close acceptance not supplied',180000);
  }else await cdp.evaluate('window.close()');
  await wait(()=>cdp.evaluate('window.scodex.getDesktopState().then(s=>!s.visible)'),'Close did not hide to tray');
  const hiddenAt=Date.now();
  await check('close-to-tray retains running process and writes Unicode draft',async()=>{assert.equal(child.exitCode,null);const files=await fs.readdir(profile);const history=JSON.parse(await fs.readFile(path.join(profile,'conversations.json'),'utf8'));assert.match(json(history),/托盘草稿持久化检查/);return{processAlive:true,visible:false,historyFile:'conversations.json'};});
  await check('scheduled timer executes while window is hidden',async()=>{const state=await wait(async()=>{const value=await cdp.evaluate('window.scodex.listScheduledTasks()');return value.runs.some(r=>r.taskId==='tray-timer'&&r.status==='failed')&&value;},'Hidden scheduler did not record its controlled missing-credential failure',120000);assert.equal(await cdp.evaluate('window.scodex.getDesktopState().then(s=>s.visible)'),false);assert.ok(Date.parse(state.runs[0].startedAt)>=hiddenAt,'Timer must start after native hide');return{status:state.runs[0].status,output:state.runs[0].output};});
  await secondLaunch();
  await check('second launch restores one existing instance and preserves unsaved editor',async()=>{await key('p',2,'KeyP');await wait(()=>cdp.evaluate('Boolean(document.querySelector(".file-view"))'),'File view restored');assert.match(await cdp.evaluate('document.querySelector(".cm-content").textContent'),/未保存的托盘编辑/);await key('s',2,'KeyS');await wait(async()=>/未保存的托盘编辑/.test(await fs.readFile(path.join(workspace,'demo.js'),'utf8')),'Edited file save');return true;});
  }
  await key(',',2);await wait(()=>cdp.evaluate('document.querySelector(".settings-detail-heading h1")?.textContent==="常规"'),'General settings');
  if(!await cdp.evaluate('window.scodex.getAppState().then(s=>s.preferences.minimizeToTray)'))await click('最小化到托盘');await wait(()=>cdp.evaluate('window.scodex.getAppState().then(s=>s.preferences.minimizeToTray)'),'Minimize setting');
  if(process.env.SCODEX_NATIVE_TRAY!=='1')throw Error('SCODEX_NATIVE_TRAY=1 is required for native minimize acceptance');
  await fs.rm(path.join(output,'native-complete.json'),{force:true});
  await fs.writeFile(path.join(output,'native-ready.json'),json({status:'ready',phase:'minimize',title:'Scodex 1.0.5 托盘验收（隔离配置）',profile,temporary,executable}));console.log('NATIVE_READY minimize');
  await wait(async()=>{try{const signal=JSON.parse(await fs.readFile(path.join(output,'native-complete.json'),'utf8'));return signal.phase==='minimize'&&signal.profile===profile;}catch{return false;}},'Native minimize acceptance not supplied',180000);
  await wait(()=>cdp.evaluate('window.scodex.getDesktopState().then(s=>!s.visible)'),'Minimize did not hide');await secondLaunch();
  await check('minimize-to-tray and disabled-tray fallback',async()=>{await click('启用系统托盘');await wait(()=>cdp.evaluate('window.scodex.getDesktopState().then(s=>!s.available&&s.visible)'),'Disable tray fallback');const state=await cdp.evaluate('window.scodex.getDesktopState()');assert.equal(state.closeToTray,false);return state;});
  await quit();await start();
  await check('preferences, draft and scheduled result survive full restart',async()=>{const state=await cdp.evaluate('window.scodex.getAppState()');assert.equal(state.preferences.trayEnabled,false);assert.equal(state.desktop.available,false);assert.equal(state.preferences.browserPanelWidth,420);assert.match(json(state.library),/托盘草稿持久化检查/);assert.ok(state.scheduledTasks.runs.some(r=>r.status==='failed'));return true;});
  await click('工具与操作');await key(',',2);await wait(()=>cdp.evaluate('document.querySelector(".settings-detail-heading h1")?.textContent==="常规"'),'General settings after restart');await click('启用系统托盘');await wait(()=>cdp.evaluate('window.scodex.getDesktopState().then(s=>s.available)'),'Tray recreated');await click('工具与操作');
  await check('readable tool overview at desktop renderer viewports',async()=>{const results=[];for(const [width,height]of[[1440,900],[1064,660]]){await cdp.command('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});await new Promise(r=>setTimeout(r,150));const layout=await cdp.evaluate('(()=>{const e=document.querySelector(".tools-overview");return{viewport:innerWidth,scroll:e.scrollWidth,client:e.clientWidth,font:getComputedStyle(e).fontFamily,body:getComputedStyle(e).fontSize,cards:[...e.querySelectorAll(".tool-card")].every(x=>x.getBoundingClientRect().width>200)}})()');assert.ok(layout.scroll<=layout.client+1);assert.ok(layout.cards);assert.match(layout.font,/Microsoft YaHei/);results.push({width,height,...layout});}await cdp.command('Emulation.clearDeviceMetricsOverride');return results;});
  const capture=await cdp.command('Page.captureScreenshot',{format:'png'});const screenshot=path.join(output,'tools-overview.png');await fs.writeFile(screenshot,Buffer.from(capture.data,'base64'));report.screenshot=screenshot;
  await check('explicit quit exits even when close-to-tray is enabled',async()=>{await key(',',2);await wait(()=>cdp.evaluate('document.querySelector(".settings-detail-heading h1")?.textContent==="常规"'),'Exit controls');await textClick('.desktop-action-buttons button','退出程序');await wait(()=>Promise.resolve(child.exitCode!==null),'Exit menu failed');socket.close();return{exitCode:child.exitCode};});
  report.status='passed';
}catch(error){report.status='failed';report.error=error.stack;console.error(error);process.exitCode=1;}
finally{try{if(socket?.readyState===1){if(report.status==='failed'){await key('Escape');await key('p',2,'KeyP');await new Promise(r=>setTimeout(r,250));if(await cdp.evaluate('Boolean(document.querySelector(".file-view .dirty-dot"))')){await key('s',2,'KeyS');await new Promise(r=>setTimeout(r,300));}}await cdp.evaluate('window.scodex.quitApp()').catch(()=>{});await new Promise(r=>setTimeout(r,1200));}}catch{}for(const p of children){if(p.exitCode===null){p.kill();await wait(()=>Promise.resolve(p.exitCode!==null),'Child cleanup',10000).catch(()=>{});}}socket?.close();report.finishedAt=new Date().toISOString();report.fixtureDirectory=temporary;await fs.writeFile(path.join(output,'tray-tools-ui-verification.json'),json(report));console.log('RESULT '+report.status);}}
main();
