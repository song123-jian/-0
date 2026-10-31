const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const net = require('node:net');
const assert = require('node:assert/strict');
const { spawn, execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { waitFor, connect } = require('./configuration-smoke.cjs');
const execute = promisify(execFile);
const project = path.resolve(__dirname, '..');
const output = path.join(project, 'release', 'configuration');
const stage = path.join(project, 'release', 'configuration-app');
const continueLink = process.argv.includes('--continue-after-link');
const report = { date: new Date().toISOString(), environment: `${os.platform()} ${os.release()} ${os.arch()}`, checks: [], status: 'running' };
const json = async (file) => JSON.parse(await fs.readFile(file, 'utf8'));
async function main() {
  let child; let socket; let cdp;
  const check = (name, evidence) => { report.checks.push({ name, status: 'passed', ...(evidence ? { evidence } : {}) }); console.log('PASS:', name); };
  try {
    const previous = await json(path.join(output, 'configuration-ui-verification.json'));
    const base = await json(path.join(output, 'configuration-base-build.json'));
    const build = await json(path.join(output, 'configuration-build.json'));
    const earlier = continueLink ? await json(path.join(output, 'configuration-final-verification.json')) : null;
    if (earlier) { report.checks = earlier.checks; report.previousFailure = earlier.error; }
    const temporary = previous.temporary; const profile = path.join(temporary, 'profile'); const root = path.join(temporary, 'scodex'); const workspace = path.join(temporary, 'workspace');
    report.temporary = temporary;
    assert.ok(temporary.startsWith(path.join(os.tmpdir(), 'scodex-configuration-ui-')));
    assert.ok(previous.checks.some(item=>item.name.startsWith('Bundled offline tool install round 2')));
    for (const file of ['electron/agent-settings.cjs', 'electron/codex-config-status.cjs', 'electron/preload.cjs']) assert.equal(build.sources[file], base.sources[file], 'Reused source changed: ' + file);
    report.reused = { date: previous.date, renderer: previous.renderer, checks: previous.checks, evidence: 'configuration-ui-verification.json', unchangedSources: ['agent-settings.cjs', 'codex-config-status.cjs', 'preload.cjs'], limitations: previous.limitations };
    const executable = path.join(output, `Scodex-Workbench-Configuration-${build.version}-x64.exe`);
    const renderer = (await fs.readFile(path.join(stage, 'dist', 'index.html'), 'utf8')).match(/assets\/index-[^"\s]+\.js/)[0];
    report.version = build.version; report.renderer = renderer; report.executable = executable;
    if (earlier) assert.equal(earlier.renderer, renderer, 'Continuation requires unchanged renderer');
    async function start() {
      const server = net.createServer(); await new Promise(resolve=>server.listen(0, '127.0.0.1', resolve)); const port = server.address().port; await new Promise(resolve=>server.close(resolve));
      child = spawn(executable, [`--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--disable-gpu'], { cwd: output, env: { ...process.env, SCODEX_HOME: root }, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }); child.stdout.resume(); child.stderr.resume();
      const target = await waitFor(async () => (await fetch(`http://127.0.0.1:${port}/json/list`).then(r=>r.json())).find(t=>t.type==='page'), 'Final EXE startup');
      socket = new WebSocket(target.webSocketDebuggerUrl); await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});}); cdp=connect(socket);
      await waitFor(()=>cdp.evaluate('Boolean(document.querySelector(".app-shell")) && Boolean(document.querySelector(\'[aria-label="设置"]\'))'), 'Final app ready');
      const state=await cdp.evaluate('window.scodex.getAppState()'); assert.equal(state.version,build.version); assert.equal(state.workspaceRoot,workspace);
      assert.equal(await cdp.evaluate(`[...document.scripts].some(e=>e.src.endsWith(${JSON.stringify(renderer)}))`),true);
    }
    async function stop() { await cdp.command('Browser.close').catch(()=>{}); await waitFor(()=>child.exitCode!==null,'Final app exit'); if(socket.readyState===WebSocket.OPEN)socket.close(); }
    const click=(text,selector='button')=>cdp.evaluate(`(()=>{const e=[...document.querySelectorAll(${JSON.stringify(selector)})].find(e=>e.textContent.trim()===${JSON.stringify(text)});if(!e||e.disabled)throw new Error('Unavailable '+${JSON.stringify(text)});e.scrollIntoView({block:'center'});e.click();})()`);
    const select=async(label,value)=>{await waitFor(()=>cdp.evaluate(`(()=>{const e=document.querySelector(${JSON.stringify('[aria-label="'+label+'"]')});if(!e||e.disabled)return false;e.scrollIntoView({block:'center'});e.value=${JSON.stringify(value)};e.dispatchEvent(new Event('change',{bubbles:true}));return true;})()`),'Enabled selection '+label);await waitFor(()=>cdp.evaluate(`document.querySelector(${JSON.stringify('[aria-label="'+label+'"]')})?.value===${JSON.stringify(value)}`),'Rendered selection '+label);};
    const open=async()=>{await cdp.evaluate('document.querySelector(\'[aria-label="设置"]\').click()');await click('配置','.settings-category');await waitFor(()=>cdp.evaluate('Boolean(document.querySelector(\'[aria-label="配置范围"]\'))'),'Configuration ready');};
    const disk=async(key,value,file=path.join(root,'codex-settings.json'))=>waitFor(async()=>(await json(file))[key]===value,'Final disk '+key);
    if (!continueLink) await fs.writeFile(path.join(root,'config.toml'),'disable_response_storage = true\n');
    await start();
    let chatId;
    if (!continueLink) {
    await cdp.evaluate('window.scodex.getModelConnection().then(config=>window.scodex.saveModelConnection({...config,apiKey:"configuration-fixture-no-network",name:"配置兼容验收",website:"",baseUrl:"https://configuration-test.invalid/v1",addresses:["https://configuration-test.invalid/v1"],models:["configuration-fixture"],model:"configuration-fixture",reasoningEffort:"ultra",subagentModel:"",subagentReasoningEffort:""}))');
    await cdp.command('Page.reload'); await waitFor(()=>cdp.evaluate('Boolean(document.querySelector(".app-shell"))'),'Connection fixture reload'); await open();
    await waitFor(()=>cdp.evaluate('document.querySelector(".settings-config-status").textContent.includes("disable_response_storage")'),'Final genuine warning',35000);
    const config=await json(path.join(root,'codex-settings.json')); assert.deepEqual(config.availableReasoningEfforts,['medium','high']);
    const oldId=(await cdp.evaluate('window.scodex.getAppState()')).library.activeId;
    await cdp.evaluate('document.querySelector(\'[aria-label="新建对话"]\').click()');
    await waitFor(()=>cdp.evaluate('document.querySelector(\'[aria-label="本轮回答深度"]\')?.value==="high"'),'Config default outranks connection');
    assert.deepEqual(await cdp.evaluate('[...document.querySelector(\'[aria-label="本轮回答深度"]\').options].map(e=>e.value)'),['medium','high']);
    chatId=await waitFor(()=>cdp.evaluate(`window.scodex.getAppState().then(s=>s.library.activeId!==${JSON.stringify(oldId)}&&s.library.conversations.find(c=>c.id===s.library.activeId)?.reasoningEffort==='high'&&s.library.activeId)`),'New final chat saved');
    await select('本轮回答深度','medium'); await waitFor(()=>cdp.evaluate(`window.scodex.getAppState().then(s=>s.library.conversations.find(c=>c.id===${JSON.stringify(chatId)})?.reasoningEffort==='medium')`),'Final chat depth saved');
    check('Final renderer excludes disabled connection strength, honors configuration default and persists per-chat depth; no model request');
    await open(); await select('输出详细程度','medium'); await disk('outputDetail','medium'); await select('配置范围','workspace'); await select('输出详细程度','high');
    const workspaceFile=path.join(workspace,'.scodex','codex-settings.json'); await disk('outputDetail','high',workspaceFile); assert.deepEqual(await json(workspaceFile),{outputDetail:'high'});
    await click('使用默认设置'); await waitFor(async()=>Object.keys(await json(workspaceFile)).length===0,'Final restore inheritance');
    await waitFor(()=>cdp.evaluate('document.querySelector(\'[aria-label="输出详细程度"]\').value==="medium"'),'Inherited value displayed');
    check('Final package configuration save, sparse workspace override and restore inheritance');
    const outside=path.join(temporary,'configuration-outside'); await fs.mkdir(outside,{recursive:true}); const outsideFile=path.join(outside,'codex-settings.json');await fs.writeFile(outsideFile,'{}');
    await fs.unlink(workspaceFile); await fs.rmdir(path.dirname(workspaceFile)); await fs.symlink(outside,path.dirname(workspaceFile),'junction');
    await cdp.evaluate('(()=>{const e=document.querySelector(\'[aria-label="网页搜索"]\');e.value="cached";e.dispatchEvent(new Event("change",{bubbles:true}));})()');
    await waitFor(()=>cdp.evaluate('document.querySelector(".settings-agent-error")?.textContent.includes("不能使用链接")'),'Real UI rejects linked config directory');
    assert.equal(await fs.readFile(outsideFile,'utf8'),'{}');
    await fs.unlink(path.dirname(workspaceFile));await fs.mkdir(path.dirname(workspaceFile));await fs.writeFile(workspaceFile,'{}');
    await select('网页搜索','cached');await disk('webSearch','cached',workspaceFile);await click('使用默认设置');await waitFor(async()=>Object.keys(await json(workspaceFile)).length===0,'Restore after rejected link');
    check('Actual EXE refuses junction-backed workspace writes, preserves external file and recovers after directory repair');
    } else {
      const state=await cdp.evaluate('window.scodex.getAppState()');chatId=state.library.activeId;
      assert.equal(state.library.conversations.find(c=>c.id===chatId).reasoningEffort,'medium');
      await open();await select('配置范围','workspace');await click('使用默认设置');
      await waitFor(async()=>Object.keys(await json(path.join(workspace,'.scodex','codex-settings.json'))).length===0,'Actual retry-path restore after rejected link');
      assert.equal(await fs.readFile(path.join(temporary,'configuration-outside','codex-settings.json'),'utf8'),'{}');
      check('Actual EXE recovers after directory repair; previous junction rejection and external-file preservation reused');
    }
    report.chatId=chatId;
    await click('诊断'); await waitFor(()=>cdp.evaluate('!document.querySelector(".settings-reinstall-button").disabled'),'Final doctor',60000);
    const diagnostic=await fs.readFile(path.join(profile,'codex-diagnostic.txt'),'utf8');
    const diagnosticCwd=JSON.parse(diagnostic.match(/"cwd":\s*("(?:\\.|[^"\\])*")/)[1]);assert.equal(path.resolve(diagnosticCwd).toLowerCase(),path.resolve(workspace).toLowerCase());
    assert.match(await cdp.evaluate('document.querySelector(".settings-diagnostic").textContent'),/报告状态：发现问题/);await fs.copyFile(path.join(profile,'codex-diagnostic.txt'),path.join(output,'configuration-diagnostic.txt'));
    check('Final doctor runs in actual current workspace; valid report completion remains separate from missing-auth health failure', {cwd:diagnosticCwd});
    await select('配置范围','shared');await waitFor(()=>cdp.evaluate('!document.querySelector(\'[aria-label="刷新配置检查"]\').disabled'),'Shared config status complete',35000);
    const toml=path.join(root,'config.toml');await fs.writeFile(toml,'model = [\n');await cdp.evaluate('document.querySelector(\'[aria-label="刷新配置检查"]\').click()');
    await waitFor(()=>cdp.evaluate('Boolean(document.querySelector(".settings-config-status [role=alert]"))'),'Malformed TOML error shown',35000);
    await fs.writeFile(toml,'disable_response_storage = true\n');await waitFor(()=>cdp.evaluate('!document.querySelector(\'[aria-label="刷新配置检查"]\').disabled'),'Error read complete');await cdp.evaluate('document.querySelector(\'[aria-label="刷新配置检查"]\').click()');
    await waitFor(()=>cdp.evaluate('document.querySelector(".settings-config-status").textContent.includes("disable_response_storage")'),'Config warning recovers',35000);
    check('Real CLI malformed-config error and refresh recovery render correctly');
    await stop();await start();await open();
    const state=await cdp.evaluate('window.scodex.getAppState()');assert.equal(state.agentSettings.outputDetail,'medium');assert.equal(state.library.conversations.find(c=>c.id===chatId).reasoningEffort,'medium');assert.equal(state.connection.reasoningEffort,'ultra');
    assert.equal((await cdp.evaluate('window.scodex.getWorkspaceTools()')).directory,previous.installation2.tools.directory);
    check('Final process restart preserves saved values, model connection, independent depth and real installed runtime');
    await cdp.evaluate('window.scodex.savePreferences({fontSize:20,themeMode:"dark"})');await cdp.command('Page.reload');await waitFor(()=>cdp.evaluate('Boolean(document.querySelector(".app-shell"))'),'Dark reload');await open();
    await waitFor(()=>cdp.evaluate('getComputedStyle(document.querySelector(".app-shell")).getPropertyValue("--ui-font-size").trim()==="20px" && document.querySelector(".app-shell").dataset.theme==="dark"'),'Actual dark/20px apply');
    await cdp.command('Emulation.setDeviceMetricsOverride',{width:1064,height:660,deviceScaleFactor:1,mobile:false});
    const overflow=await cdp.evaluate('[...document.querySelectorAll(".settings-row,.settings-configuration-toolbar,.settings-config-status")].map(e=>({class:e.className,left:e.getBoundingClientRect().left,right:e.getBoundingClientRect().right})).filter(e=>e.left< -1||e.right>innerWidth+1)');assert.deepEqual(overflow,[]);
    await cdp.evaluate('document.querySelector(".settings-effort-select summary").click()');
    const bounds=await cdp.evaluate('(()=>{const e=document.querySelector(".settings-effort-menu");e.scrollIntoView({block:"center"});const r=e.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:innerWidth,height:innerHeight};})()');assert.ok(bounds.left>=0&&bounds.right<=bounds.width&&bounds.top>=0&&bounds.bottom<=bounds.height,JSON.stringify(bounds));
    await cdp.evaluate('document.querySelector(".settings-effort-select").open=false');
    check('Final dark configuration and menu fit 1064x660 at 20px with horizontal and vertical bounds',bounds);
    await cdp.command('Emulation.clearDeviceMetricsOverride');await cdp.evaluate('window.scodex.savePreferences({fontSize:16,themeMode:"light"})');await cdp.command('Page.reload');await waitFor(()=>cdp.evaluate('Boolean(document.querySelector(".app-shell"))'),'Light reload');await open();
    await waitFor(()=>cdp.evaluate('!document.querySelector(\'[aria-label="刷新配置检查"]\').disabled'),'Final warning complete',35000);
    await cdp.evaluate('document.querySelector(".settings-detail").scrollTop=0');await cdp.evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
    const screenshot=await cdp.command('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});report.screenshot=path.join(output,'workbench-configuration.png');await fs.writeFile(report.screenshot,Buffer.from(screenshot.data,'base64'));
    await stop();check('Final light configuration screenshot, exact package identity and full shutdown');report.status='passed';
  } catch(error) { report.status='failed';report.error=error.stack;console.error(error);process.exitCode=1;if(cdp)report.failureState=await cdp.evaluate('({text:document.querySelector(".settings-detail")?.textContent,theme:document.querySelector(".app-shell")?.dataset.theme})').catch(()=>null); }
  finally {
    if(cdp&&child?.exitCode===null)await cdp.command('Browser.close').catch(()=>{});if(socket?.readyState===WebSocket.OPEN)socket.close();
    if(child?.exitCode===null)await waitFor(()=>child.exitCode!==null,'Cleanup exit',5000).catch(()=>execute('taskkill.exe',['/PID',String(child.pid),'/T','/F'],{windowsHide:true}).catch(()=>{}));
    report.cleanup=child?.exitCode===null?'failed':'app exited; isolated test data and real runtimes retained as evidence';
    await fs.writeFile(path.join(output,'configuration-final-verification.json'),JSON.stringify(report,null,2));
  }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
