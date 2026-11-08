import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {createMcpStore}=require('../electron/mcp-store.cjs');
const {createMcpRuntime}=require('../electron/mcp-runtime.cjs');
const {contextAlias}=require('../electron/mcp-context.cjs');
const {createContextHttp}=require('./mcp-context-fixture.cjs');
const encryption={isEncryptionAvailable:()=>true,encryptString:v=>Buffer.from(v).reverse(),decryptString:v=>Buffer.from(v).reverse().toString()};
const opts=extra=>({guard:async()=>{},approve:async()=>{},policy:()=> 'on-request',...extra});
async function fixture(t,httpOptions) {
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'scodex-mcp-context-')),log=path.join(root,'requests.jsonl');
  const store=createMcpStore(path.join(root,'mcp.json'),{encryption}),runtime=createMcpRuntime({store,getWorkspaceRoot:()=>root});let service;
  t.after(async()=>{await runtime.shutdown();if(service)await service.close();assert.ok(path.basename(root).startsWith('scodex-mcp-context-'));await fs.rm(root,{recursive:true,force:true});});
  if(httpOptions)service=await createContextHttp({...httpOptions,logFile:log});
  const saved=await store.save(service?{name:'资料HTTP',transport:'http',url:service.url,token:httpOptions.token}:{name:'资料进程',transport:'stdio',command:process.execPath,args:[path.resolve('tests/mcp-context-fixture.cjs')],env:{MCP_CONTEXT_LOG:log,MCP_CONTEXT_PRIVATE:'controlled-redaction-value'}});
  await runtime.connect(saved.id);const catalog=await runtime.contextCatalog(saved.id);return{root,log,store,runtime,saved,catalog,service};
}
const input=(f,item,args={})=>({serverId:f.saved.id,generation:f.catalog.generation,catalogId:f.catalog.catalogId,itemId:item.id,arguments:args});
const resource=(f,name)=>f.catalog.resources.find(r=>r.name===name);
const logs=async f=>(await fs.readFile(f.log,'utf8')).trim().split('\n').filter(Boolean).map(JSON.parse);
async function until(fn){for(let i=0;i<100;i++){if(await fn())return;await new Promise(r=>setTimeout(r,20));}throw Error('Expected SDK state not observed');}
test('resource-only stdio service connects and real paginated catalog reads Chinese without credentials',async t=>{
  const f=await fixture(t);const state=(await f.runtime.snapshot()).servers[0];assert.equal(state.status,'connected');assert.equal(state.tools.length,0);assert.deepEqual(state.contextCapabilities,{resources:true,prompts:true});assert.equal(f.catalog.resources.length,8);assert.equal(f.catalog.templates.length,1);assert.equal(f.catalog.prompts.length,1);assert.equal(JSON.stringify(f.catalog).includes('controlled-redaction-value'),false);
  const result=await f.runtime.contextRead(input(f,resource(f,'项目说明')));assert.match(result.text,/C6142/);assert.ok(result.text.includes('[已隐藏]'));assert.equal(JSON.stringify(result).includes('controlled-redaction-value'),false);assert.deepEqual((await logs(f)).filter(r=>r.method==='resources/list').map(r=>r.cursor),[undefined,'page-2']);
});
test('URI template and prompt arguments use real SDK, required fields and roles remain data',async t=>{
  const f=await fixture(t);await assert.rejects(f.runtime.contextRead(input(f,f.catalog.templates[0],{project:'中文'})),/参数/);const r=await f.runtime.contextRead(input(f,f.catalog.templates[0],{project:'中文 A',format:'md'}));assert.match(r.text,/%E4%B8%AD%E6%96%87%20A/);assert.match(r.text,/format=md/);
  await assert.rejects(f.runtime.contextRead(input(f,f.catalog.prompts[0])),/参数/);const p=await f.runtime.contextRead(input(f,f.catalog.prompts[0],{topic:'验收主题'}));assert.match(p.text,/审阅主题：验收主题/);assert.match(p.text,/assistant/);assert.match(p.text,/嵌入的中文资料/);assert.match(p.text,/非文本内容未传送/);assert.equal(Object.hasOwn(p,'messages'),false);assert.match(p.notice,/不会升级/);
});
test('resource text reaches request-time compression in full and binary payload is excluded',async t=>{
  const f=await fixture(t),binary=await f.runtime.contextRead(input(f,resource(f,'binary')));assert.match(binary.text,/非文本内容未传送/);assert.equal(JSON.stringify(binary).includes(Buffer.from('controlled-binary-payload').toString('base64')),false);
  const big=await f.runtime.contextRead(input(f,resource(f,'big')));assert.equal(big.truncated,false);assert.ok(Buffer.byteLength(big.text)>48*1024);assert.ok(big.text.endsWith('大'.repeat(24000)));assert.equal(big.text.includes('\uFFFD'),false);
  const many=await f.runtime.contextRead(input(f,resource(f,'many')));assert.equal(many.truncated,false);assert.match(many.text,/record-44/);
  const multi=await f.runtime.contextRead(input(f,resource(f,'多段资源')));assert.match(multi.text,/第一段中文/);assert.match(multi.text,/第二段中文/);
  const tools=f.runtime.agentTools(opts({policy:()=> 'never',fullAccess:()=>true})),catalog=await tools.execute(contextAlias(f.saved.id,'list'),{}),bigItem=catalog.resources.find(item=>item.name==='big');
  const modelRead=await tools.execute(contextAlias(f.saved.id,'read'),{catalog_id:catalog.catalogId,item_id:bigItem.id});assert.ok(modelRead.activity.output.endsWith('大'.repeat(24000)));
});
test('model tools require this-task catalog and per-call approval; denied read never reaches server',async t=>{
  const f=await fixture(t);let approvals=0;const tools=f.runtime.agentTools(opts({approve:async()=>{approvals++;if(approvals===2)throw Error('用户拒绝');}}));
  assert.equal(tools.definitions.length,3);await assert.rejects(tools.execute(contextAlias(f.saved.id,'read'),{catalog_id:f.catalog.catalogId,item_id:f.catalog.resources[0].id}),/先用本任务/);assert.equal(approvals,0);
  const cat=await tools.execute(contextAlias(f.saved.id,'list'),{});assert.equal(cat.ok,true);await assert.rejects(tools.execute(contextAlias(f.saved.id,'read'),{catalog_id:cat.catalogId,item_id:cat.resources[0].id}),/用户拒绝/);assert.equal((await logs(f)).filter(r=>r.method==='resources/read').length,0);
});
test('full access with never reads actual connected MCP resources', async t => {
  const f = await fixture(t);
  const tools = f.runtime.agentTools(opts({ policy: () => 'never', fullAccess: () => true }));
  const cat = await tools.execute(contextAlias(f.saved.id, 'list'), {});
  const item = cat.resources.find(r => r.name === '项目说明');
  const result = await tools.execute(contextAlias(f.saved.id, 'read'), { catalog_id: cat.catalogId, item_id: item.id });
  assert.equal(result.ok, true); assert.match(result.text, /C6142/);
});

test('full access reads despite policy changes while reconnection invalidates the old catalog',async t=>{
  const f=await fixture(t);let policy='on-request',stage='list';const tools=f.runtime.agentTools(opts({policy:()=>policy,approve:async()=>{if(stage==='read')policy='never';}}));const cat=await tools.execute(contextAlias(f.saved.id,'list'),{});stage='read';const read=await tools.execute(contextAlias(f.saved.id,'read'),{catalog_id:cat.catalogId,item_id:cat.resources[0].id});assert.equal(read.ok,true);policy='on-request';await f.runtime.disconnect(f.saved.id);await f.runtime.connect(f.saved.id);await assert.rejects(tools.execute(contextAlias(f.saved.id,'list'),{}),/变化/);assert.equal(f.runtime.agentTools(opts({policy:()=> 'never',fullAccess:()=>true})).definitions.length,3);
});
test('real server list-change notification invalidates observed catalog and planning still approves reads',async t=>{
  const f=await fixture(t);const plan=f.runtime.agentTools(opts({readOnly:true}));assert.equal(plan.definitions.length,3);const cat=await plan.execute(contextAlias(f.saved.id,'list'),{});const item=cat.resources.find(r=>r.name==='notify');await assert.rejects(plan.execute(contextAlias(f.saved.id,'read'),{catalog_id:cat.catalogId,item_id:item.id}),/变化/);await assert.rejects(f.runtime.contextRead(input(f,resource(f,'项目说明'))),/变化/);assert.ok((await f.runtime.snapshot()).servers[0].contextRevision>0);
});
test('cancel request aborts real stdio protocol, errors redact and connection stays usable',async t=>{
  const f=await fixture(t),requestId='ctx-'+crypto.randomUUID();const pending=f.runtime.contextRead({...input(f,resource(f,'slow')),requestId});await until(async()=>(await logs(f)).some(r=>r.uri==='notes://slow'));assert.equal(f.runtime.contextCancel(requestId),true);await assert.rejects(pending,/资料操作已停止或超时/);await until(async()=>(await logs(f)).some(r=>r.cancelled==='notes://slow'));assert.equal((await f.runtime.snapshot()).servers[0].status,'connected');await assert.rejects(f.runtime.contextRead(input(f,resource(f,'failure'))),e=>!e.message.includes('controlled-redaction-value')&&e.message.includes('受控读取失败'));
});
test('Streamable HTTP reads resources and prompts through authenticated actual SDK',async t=>{
  const f=await fixture(t,{token:'controlled-http-credential',secret:'controlled-http-credential'});const r=await f.runtime.contextRead(input(f,f.catalog.resources[0]));assert.match(r.text,/C6142/);assert.equal(JSON.stringify(r).includes('controlled-http-credential'),false);const p=await f.runtime.contextRead(input(f,f.catalog.prompts[0],{topic:'HTTP主题'}));assert.match(p.text,/HTTP主题/);assert.ok(f.service.seen.some(r=>r.auth==='Bearer controlled-http-credential'));
});
test('repeated pagination fails instead of publishing partial catalog; optional templates method is explicit',async t=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'scodex-mcp-context-')),store=createMcpStore(path.join(root,'mcp.json'),{encryption}),runtime=createMcpRuntime({store,getWorkspaceRoot:()=>root}),bad=await createContextHttp({badPagination:true}),optional=await createContextHttp({noTemplates:true});
  t.after(async()=>{await runtime.shutdown();await bad.close();await optional.close();await fs.rm(root,{recursive:true,force:true});});
  const a=await store.save({name:'坏分页',transport:'http',url:bad.url});await runtime.connect(a.id);await assert.rejects(runtime.contextCatalog(a.id),/分页异常/);
  const b=await store.save({name:'无模板方法',transport:'http',url:optional.url});await runtime.connect(b.id);const cat=await runtime.contextCatalog(b.id);assert.equal(cat.templates.length,0);assert.ok(cat.warnings.some(v=>v.includes('listResourceTemplates')));assert.equal(cat.resources.length,8);
});
