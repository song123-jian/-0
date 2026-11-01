import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{createImageTools,validate,imageHeader}=require('../electron/image-tools.cjs');
const {createAgentTools}=require('../electron/agent-tools.cjs'),{runModelTask}=require('../electron/agent-runtime.cjs'),{png}=require('./image-fixtures.cjs');
const preview='data:image/png;base64,'+png(10,10).toString('base64');

test('full access with never exposes image read/edit while planning remains read only', async t => {
  const f = await fixture(t, { policy: () => 'never', fullAccess: () => true });
  assert.deepEqual(f.tools.definitions.map(d => d.function.name), ['image_read', 'image_edit']);
  const before = await f.read(); await f.edit(before.hash);
  assert.equal((await fs.stat(path.join(f.root, 'out.png'))).isFile(), true);
  const plan = await fixture(t, { policy: () => 'never', fullAccess: () => true, readOnly: true });
  assert.deepEqual(plan.tools.definitions.map(d => d.function.name), ['image_read']);
  await assert.rejects(plan.edit('a'.repeat(64)), /规划/);
});
async function fixture(t,extra={}) {
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'scodex-image-unit-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));
  await fs.writeFile(path.join(root,'a.png'),png(10,10));
  const approvals=[],changes=[];
  const tools=createImageTools({projectFiles:createAgentTools({workspaceRoot:root}).projectFiles,policy:()=> 'on-request',
    processor:async()=>({width:10,height:10,preview,thumbnail:preview,dataUrl:preview}),approve:async input=>approvals.push(input),onFileChanged:p=>changes.push(p),...extra});
  return {root,tools,approvals,changes,read:(name='a.png',context)=>tools.execute('image_read',{path:name},context),
    edit:(h,rest={},context)=>tools.execute('image_edit',{path:'a.png',expected_hash:h,output_path:'out.png',output_expected_hash:'new',operations:[{type:'flip',axis:'horizontal'}],...rest},context)};
}
test('header dimensions, animation, malformed data and operation bounds are checked before decoding',()=>{
  assert.deepEqual(imageHeader(png(10,20)),{width:10,height:20,mime:'png'});
  const huge=png(1,1);huge.writeUInt32BE(30000,16);assert.throws(()=>imageHeader(huge),/尺寸|像素/);
  assert.throws(()=>imageHeader(Buffer.from('<svg>')),/静态/);
  for(const op of [{type:'crop',x:0,y:0,width:0,height:1},{type:'rotate',degrees:15},{type:'text',x:0,y:0,text:'中文',font_size:12,color:'#fff'},{type:'brightness',percent:NaN},{type:'resize',width:10000,height:10000},{type:'flip',axis:'horizontal',javascript:'bad'}])assert.throws(()=>validate('image_edit',{path:'a.png',expected_hash:'a'.repeat(64),output_path:'b.png',output_expected_hash:'new',operations:[op]}));
});
test('read approval returns genuine image envelope; saved output emits hash and never modifies source',async t=>{
  const f=await fixture(t),r=await f.read();assert.equal(f.approvals.length,1);assert.ok(r.modelImages[0].dataUrl.startsWith('data:image/png'));
  const before=await fs.readFile(path.join(f.root,'a.png')),saved=await f.edit(r.hash);assert.equal(saved.ok,true);
  assert.deepEqual(await fs.readFile(path.join(f.root,'a.png')),before);assert.deepEqual(await fs.readFile(path.join(f.root,'out.png')),before);
  assert.equal(f.changes.length,1);assert.equal(f.approvals.length,2);
});
test('dirty, stale/unread target and source conflicts prevent overwrite',async t=>{
  let dirty=false,approve=async()=>{};const f=await fixture(t,{isDirty:()=>dirty,approve:()=>approve()});const r=await f.read();
  dirty=true;await assert.rejects(f.edit(r.hash),/未保存/);dirty=false;
  await fs.writeFile(path.join(f.root,'out.png'),png(8,8));await assert.rejects(f.edit(r.hash),/目标版本/);
  approve=async()=>fs.writeFile(path.join(f.root,'a.png'),png(8,8));
  await assert.rejects(f.edit(r.hash,{output_path:'other.png'}),/源图已变化/);await assert.rejects(fs.access(path.join(f.root,'other.png')));
});
test('refusal, cancelled and changed policy are enforced after approvals',async t=>{
  const f=await fixture(t,{approve:async()=>{throw Error('用户拒绝');}});await assert.rejects(f.read(),/拒绝/);
  let policy='on-request';const c=new AbortController(),g=await fixture(t,{policy:()=>policy,approve:async()=>{c.abort();}});await assert.rejects(g.read('a.png',{signal:c.signal}),/停止/);
  const h=await fixture(t,{policy:()=>policy,approve:async()=>{policy='never';}});await assert.rejects(h.read(),/当前权限不允许图片操作/);
});
test('plan and never catalogs, traversal, credentials and processor failure preserve files',async t=>{
  const f=await fixture(t,{readOnly:true});assert.deepEqual(f.tools.definitions.map(d=>d.function.name),['image_read']);await assert.rejects(f.edit('a'.repeat(64)),/规划/);
  const n=await fixture(t,{policy:()=> 'never'});assert.equal(n.tools.definitions.length,0);await assert.rejects(n.read(),/当前权限不允许图片操作/);
  const g=await fixture(t);await assert.rejects(g.read('../a.png'),/项目/);await assert.rejects(g.read('.codex/a.png'),/保护/);
  let fail=false;const h=await fixture(t,{processor:async()=>{if(fail)throw Error('解码失败');return {width:10,height:10,preview,thumbnail:preview};}});const r=await h.read();fail=true;await assert.rejects(h.edit(r.hash),/解码失败/);await assert.rejects(fs.access(path.join(h.root,'out.png')));
});
for(const protocol of ['native','json'])test('project images follow complete tool results in '+protocol,async()=>{
  let round=0;const requests=[];
  await runModelTask({connection:{endpoint:'http://unused',model:'fixture',apiKey:'fixture',toolProtocol:protocol},messages:[{role:'user',content:'看图'}],
    tools:[{type:'function',function:{name:'image_read',parameters:{type:'object'}}}],executeTool:async()=>({ok:true,modelImages:[{name:'a.png',dataUrl:preview}],activity:{screenshot:{name:'a.png',dataUrl:preview}}}),
    fetchImpl:async(_u,init)=>{requests.push(JSON.parse(init.body));const first=++round===1,m=first?(protocol==='json'?{content:JSON.stringify({type:'tool',name:'image_read',arguments:{}})}:{tool_calls:[{id:'image_1',type:'function',function:{name:'image_read',arguments:'{}'}}]}):{content:protocol==='json'?'{"type":"final","content":"收到图片"}':'收到图片'};
    return new Response(JSON.stringify({choices:[{message:m,finish_reason:first&&protocol==='native'?'tool_calls':'stop'}]}),{headers:{'content-type':'application/json'}});}});
  assert.equal(requests[1].messages.at(-1).content[1].image_url.url,preview);assert.equal(JSON.stringify(requests[1].messages.at(-2)).includes('base64'),false);
});
