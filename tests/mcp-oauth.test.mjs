import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {createMcpStore,normalizeConfig,oauthConfigKey}=require('../electron/mcp-store.cjs');
const {createMcpRuntime,toolAlias}=require('../electron/mcp-runtime.cjs');
const {createMcpOAuth,callbackListener,validOAuthUrl}=require('../electron/mcp-oauth.cjs');
const {createOAuthFixture,consent}=require('./mcp-oauth-fixture.cjs');
const {freePort}=require('./agent-workflow-ui.cjs');
const until=async(fn)=>{for(let i=0;i<500;i++){const result=await fn();if(result)return result;await new Promise(r=>setTimeout(r,10));}throw Error('OAuth fixture wait timed out');};
const encryption=()=>{const key=crypto.randomBytes(32);return{isEncryptionAvailable:()=>true,encryptString:text=>{const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',key,iv),data=Buffer.concat([cipher.update(text,'utf8'),cipher.final()]);return Buffer.concat([iv,cipher.getAuthTag(),data]);},decryptString:data=>{const decipher=crypto.createDecipheriv('aes-256-gcm',key,data.subarray(0,12));decipher.setAuthTag(data.subarray(12,28));return Buffer.concat([decipher.update(data.subarray(28)),decipher.final()]).toString('utf8');}};};
async function fixture(t,options={}){
 const temporary=await fs.mkdtemp(path.join(os.tmpdir(),'scodex-oauth-test-')),project=path.join(temporary,'project');await fs.mkdir(project);const file=path.join(temporary,'mcp.json'),server=await createOAuthFixture(options),store=createMcpStore(file,{encryption:encryption()}),opened=[];let closed=0,currentRoot=project;
 const openAuthorization=async(url,details)=>{opened.push({url:String(url),details});if(options.beforeConsent)await options.beforeConsent(url,details);if(!options.hold)await consent(url,options.deny?'deny':'allow');return{dispose:async()=>{closed++;}};};
 let runtime=createMcpRuntime({store,getWorkspaceRoot:()=>currentRoot,openAuthorization});
 const saved=await store.save({name:'OAuth资料',transport:'http',url:server.url,authMode:'oauth',headers:{'X-MCP-Private':'controlled-header'},...options.config});
 if(options.config?.oauthClientId){const port=options.config.oauthCallbackPort;server.registerPublicClient(options.config.oauthClientId,'http://127.0.0.1:'+port+'/scodex/oauth/'+saved.id);}
 t.after(async()=>{await runtime.shutdown();await server.close();await fs.rm(temporary,{recursive:true,force:true});});
 return{temporary,project,file,server,store,saved,opened,get closed(){return closed;},get runtime(){return runtime;},switchRoot:()=>{currentRoot=path.join(temporary,'another-project');},async reopen(){await runtime.shutdown();runtime=createMcpRuntime({store,getWorkspaceRoot:()=>currentRoot,openAuthorization});await runtime.connect(saved.id);}};
}
async function readResource(f){const c=await f.runtime.contextCatalog(f.saved.id);return f.runtime.contextRead({serverId:f.saved.id,generation:c.generation,catalogId:c.catalogId,itemId:c.resources[0].id,arguments:{}});}

test('SSE OAuth authorizes, sends authenticated GET and POST, and reads real resources',async t=>{
 const f=await fixture(t,{sse:true,expiresIn:3600,config:{transport:'sse'}});await f.runtime.authorize(f.saved.id);
 assert.equal((await f.runtime.snapshot()).servers[0].status,'connected');
 assert.match(JSON.stringify(await readResource(f)),/O8351/);
 const result=await f.runtime.agentTools({guard:async()=>{},approve:async()=>{},policy:()=> 'on-request'}).execute(toolAlias(f.saved.id,'echo'),{message:'SSE OAuth 工具'});
 assert.equal(result.ok,true);assert.match(result.activity.output,/SSE OAuth 工具/);assert.equal(JSON.stringify(result).includes(f.server.tokens().access_token),false);
 assert.ok(f.server.events.some(v=>v.server==='mcp'&&v.method==='GET'&&v.authenticated&&v.hasMcpHeader));
 assert.ok(f.server.events.some(v=>v.server==='mcp'&&v.method==='POST'&&v.path==='/messages'&&v.authenticated&&v.hasMcpHeader));
 assert.ok(f.server.events.filter(v=>v.server==='authorization').every(v=>!v.hasAuthorization&&!v.hasMcpHeader));
 await f.runtime.disconnect(f.saved.id);assert.equal((await f.runtime.snapshot()).servers[0].status,'disconnected');
});

test('SSE OAuth refreshes expired stored tokens after reopening the connection',async t=>{
 const f=await fixture(t,{sse:true,expiresIn:3600,config:{transport:'sse'}});await f.runtime.authorize(f.saved.id);
 const first=f.server.tokens().access_token;const stored=await f.store.load(f.saved.id);stored.secrets.oauth.expiresAt=Date.now()-1000;
 await f.store.saveOAuth(f.saved.id,stored.secrets.oauth,oauthConfigKey(stored.config));await f.reopen();
 assert.ok(f.server.events.some(v=>v.event==='refresh'));assert.notEqual(f.server.tokens().access_token,first);
 assert.match(JSON.stringify(await readResource(f)),/O8351/);assert.equal((await f.runtime.snapshot()).servers[0].status,'connected');
});
async function expireStored(f){await f.runtime.disconnect(f.saved.id);const x=await f.store.load(f.saved.id);await f.store.saveOAuth(f.saved.id,{...x.secrets.oauth,expiresAt:Date.now()-1},oauthConfigKey(x.config));}

test('OAuth config, encrypted state and changed endpoint reject stale credentials',async t=>{
 for(const config of [{oauthClientId:'id'},{oauthCallbackPort:80},{oauthScope:'中文'},{oauthIssuer:'http://public.example'}])assert.throws(()=>normalizeConfig({name:'OAuth',transport:'http',url:'https://service.example/mcp',authMode:'oauth',...config}));
 for(const url of ['file:///C:/x','javascript:alert(1)','http://127.0.0.1/token','https://u:p@example.com/token'])assert.throws(()=>validOAuthUrl(url,'https://service.example/mcp'));
 const f=await fixture(t);await f.runtime.authorize(f.saved.id);const loaded=await f.store.load(f.saved.id),token=loaded.secrets.oauth.tokens.access_token;
 assert.equal(JSON.stringify(await f.store.list()).includes(token),false);assert.equal((await fs.readFile(f.file,'utf8')).includes(token),false);assert.equal(loaded.secrets.oauth.tokens.issuer,loaded.secrets.oauth.discovery.authorizationServerUrl);
 await f.runtime.save({...f.saved,url:f.server.url+'/other'});assert.equal((await f.store.load(f.saved.id)).secrets.oauth,undefined);await assert.rejects(f.store.saveOAuth(f.saved.id,loaded.secrets.oauth,oauthConfigKey(loaded.config)),/已变化/);
});
test('real SDK DCR, PKCE, callback and resource binding connect without leaking credentials',async t=>{
 const f=await fixture(t);const connected=await f.runtime.authorize(f.saved.id);assert.equal(connected.servers[0].status,'connected');assert.equal(f.opened.length,1);assert.equal(f.closed,1);assert.ok(f.server.events.some(v=>v.event==='code-exchange'&&v.pkceValid&&v.resourceValid));assert.ok(f.server.events.some(v=>v.event==='registered'&&v.publicClient));
 const result=await readResource(f);assert.match(result.text,/OAuth真实资料 O8351/);const tokens=f.server.tokens();assert.equal(JSON.stringify(result).includes(tokens.access_token),false);assert.equal(JSON.stringify(await f.runtime.snapshot()).includes(tokens.refresh_token),false);
 assert.ok(f.server.events.some(v=>v.server==='mcp'&&v.authenticated&&v.hasMcpHeader));assert.ok(f.server.events.filter(v=>v.server==='authorization').every(v=>!v.hasAuthorization&&!v.hasMcpHeader));
 let approvals=0;const tool=f.runtime.agentTools({guard:async()=>{},approve:async()=>{approvals++;},policy:()=> 'on-request'});const out=await tool.execute(toolAlias(f.saved.id,'echo'),{message:'授权后的真实调用'});assert.equal(approvals,1);assert.match(out.activity.output,/授权后的真实调用/);assert.equal(JSON.stringify(out).includes(tokens.access_token),false);
});
test('callback rejects wrong unicode state, duplicate state, host and replay while accepting exact state',async t=>{
 const controller=new AbortController(),state='a'.repeat(64),listener=await callbackListener({id:crypto.randomUUID(),state,signal:controller.signal});t.after(()=>listener.close());
 const wrong=new URL(listener.uri);wrong.searchParams.set('code','code-value');wrong.searchParams.set('state','中'.repeat(64));assert.equal((await fetch(wrong)).status,400);
 wrong.searchParams.set('state',state);wrong.searchParams.append('state',state);assert.equal((await fetch(wrong)).status,400);wrong.searchParams.delete('state');wrong.searchParams.set('state',state);
 const hostStatus=await new Promise((resolve,reject)=>{const request=require('node:http').get(wrong,{headers:{host:'localhost:'+wrong.port}},response=>{response.resume();response.on('end',()=>resolve(response.statusCode));});request.on('error',reject);});assert.equal(hostStatus,404);assert.equal((await fetch(wrong)).status,200);assert.equal(await listener.promise,'code-value');assert.equal((await fetch(wrong)).status,409);
});
test('pre-registered public client works without dynamic registration',async t=>{
 const port=await freePort(),f=await fixture(t,{registration:false,config:{oauthClientId:'preconfigured-public',oauthIssuer:'https://placeholder.invalid',oauthCallbackPort:port}});
 await f.store.save({...f.saved,oauthIssuer:f.server.issuer});await f.runtime.authorize(f.saved.id);assert.equal((await f.runtime.snapshot()).servers[0].status,'connected');assert.equal(f.server.events.filter(v=>v.event==='registered').length,0);assert.equal(f.server.events.filter(v=>v.event==='code-exchange'&&v.pkceValid).length,1);
});
test('expired stored access refreshes after restart and secrets from old/new tokens stay redacted',async t=>{
 const f=await fixture(t,{expiresIn:60});await f.runtime.authorize(f.saved.id);const initial=f.server.tokens().access_token;await expireStored(f);await f.reopen();assert.equal(f.opened.length,1);assert.equal(f.server.events.filter(v=>v.event==='refresh').length,1);assert.notEqual(f.server.tokens().access_token,initial);
 const catalog=await f.runtime.contextCatalog(f.saved.id),input={serverId:f.saved.id,generation:catalog.generation,catalogId:catalog.catalogId,itemId:catalog.resources[0].id,arguments:{}};const results=await Promise.all([f.runtime.contextRead(input),f.runtime.contextRead(input)]);for(const result of results){assert.match(result.text,/O8351/);assert.equal(result.text.includes(f.server.tokens().access_token),false);}assert.equal(f.server.events.filter(v=>v.event==='refresh').length,1);
});
test('temporary refresh failure preserves refresh credentials for retry, revoked grant requires manual login',async t=>{
 const f=await fixture(t,{expiresIn:60});await f.runtime.authorize(f.saved.id);await expireStored(f);const old=(await f.store.load(f.saved.id)).secrets.oauth.tokens.refresh_token;f.server.setRefreshMode('server_error');await assert.rejects(f.runtime.connect(f.saved.id),/续期暂时失败/);assert.equal((await f.store.load(f.saved.id)).secrets.oauth.tokens.refresh_token,old);assert.equal(f.opened.length,1);
 f.server.setRefreshMode('ok');await f.runtime.connect(f.saved.id);await expireStored(f);f.server.setRefreshMode('invalid_grant');await assert.rejects(f.runtime.connect(f.saved.id),/重新授权/);assert.equal((await f.store.list())[0].hasOAuthTokens,false);assert.equal(f.opened.length,1);
});
test('login is manual, denial and cancel leave no token and callback is closed',async t=>{
 const missing=await fixture(t);await assert.rejects(missing.runtime.connect(missing.saved.id),/授权并连接/);assert.equal(missing.opened.length,0);
 const denied=await fixture(t,{deny:true});await assert.rejects(denied.runtime.authorize(denied.saved.id),/拒绝/);assert.equal((await denied.store.list())[0].hasOAuthTokens,false);assert.equal(denied.closed,1);
 const f=await fixture(t,{hold:true}),pending=f.runtime.authorize(f.saved.id);pending.catch(()=>{});await until(()=>f.opened.length);const callback=f.opened[0].url&&new URL(f.opened[0].url).searchParams.get('redirect_uri');assert.equal(f.runtime.cancelAuthorization(f.saved.id),true);await assert.rejects(pending,/取消/);assert.equal((await f.store.list())[0].hasOAuthTokens,false);await assert.rejects(fetch(callback));assert.equal(f.closed,1);
});
test('save, remove, project switch and shutdown cancel in-flight authorization without stale writes',async t=>{
 for(const action of ['save','remove','project','shutdown']){
  const f=await fixture(t,{hold:true}),pending=f.runtime.authorize(f.saved.id);pending.catch(()=>{});await until(()=>f.opened.length);
  if(action==='save')await f.runtime.save({...f.saved,name:'编辑后的连接'});else if(action==='remove')await f.runtime.remove(f.saved.id);else if(action==='project'){f.switchRoot();await f.runtime.disconnectAll();}else await f.runtime.shutdown();
  await assert.rejects(pending,/取消|变化|停止/);assert.equal(f.closed,1);const list=await f.store.list();assert.ok(list.every(v=>!v.hasOAuthTokens));if(action==='save')assert.equal(list[0].name,'编辑后的连接');if(action==='remove')assert.equal(list.length,0);
 }
});
test('mismatched issuer and resource are rejected before token exchange',async t=>{
 for(const options of [{issuerMismatch:true},{resourceOverride:'https://other.invalid/mcp'}]){const f=await fixture(t,options);await assert.rejects(f.runtime.authorize(f.saved.id),/issuer|资源|服务器/);assert.equal(f.server.events.filter(v=>v.event==='code-exchange').length,0);assert.equal((await f.store.list())[0].hasOAuthTokens,false);}
});
test('clear local authorization disconnects, and aborted deadline releases callback/window',async t=>{
 const f=await fixture(t);await f.runtime.authorize(f.saved.id);await f.runtime.clearAuthorization(f.saved.id);assert.equal((await f.runtime.snapshot()).servers[0].status,'disconnected');assert.equal((await f.store.load(f.saved.id)).secrets.oauth,undefined);await assert.rejects(f.runtime.connect(f.saved.id),/授权并连接/);
 const g=await fixture(t,{hold:true});let disposed=0;const manager=createMcpOAuth({store:g.store,getWorkspaceRoot:()=>g.project,timeoutMs:250,openAuthorization:async()=>({dispose:async()=>{disposed++;}})});await assert.rejects(manager.authorize(g.saved.id),/取消|超时/);assert.equal((await g.store.list())[0].hasOAuthTokens,false);assert.equal(disposed,1);assert.equal(manager.status(g.saved.id).authorizing,false);
});

test('cancel during delayed token exchange never stores late credentials',async t=>{
 const f=await fixture(t,{hold:true});f.server.setTokenDelay(250);const pending=f.runtime.authorize(f.saved.id);pending.catch(()=>{});await until(()=>f.opened.length);await consent(f.opened[0].url);await until(()=>f.server.events.some(e=>e.server==='authorization'&&e.path==='/token'));assert.equal(f.runtime.cancelAuthorization(f.saved.id),true);await assert.rejects(pending,/取消/);await until(()=>f.server.tokens());assert.equal((await f.store.list())[0].hasOAuthTokens,false);assert.equal((await f.store.load(f.saved.id)).secrets.oauth.tokens,undefined);assert.equal(f.closed,1);
});
