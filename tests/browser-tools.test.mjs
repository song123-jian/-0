import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { createBrowserTools, validate } = require('../electron/browser-tools.cjs');
const { runModelTask } = require('../electron/agent-runtime.cjs');
const { normalizeLibrary } = require('../electron/conversations.cjs');
const { normalizePreferences } = require('../electron/preferences.cjs');
const { domScript } = require('../electron/browser-dom.cjs');
const vm = require('node:vm');

const stamp = { id: 'tab1', generation: 2, url: 'https://example.com/' };
const base = { owner: 'project-chat', enabled: () => true, policy: () => 'on-request', urlAllowed: () => true,
  browser: { describe: () => ({ stamp }), verify: () => true, list: () => [] }, approve: async () => {} };
test('browser is opt-in; chat policy and planning restrict the actual catalog and execution', async () => {
  assert.equal(normalizePreferences().browserAiEnabled, false);
  assert.equal(normalizePreferences({ browserAiEnabled: true }).browserAiEnabled, true);
  for (const overrides of [{ enabled: () => false }, { policy: () => 'never' }]) {
    const t = createBrowserTools({ ...base, ...overrides }); assert.equal(t.definitions.length, 0);
    await assert.rejects(t.execute('browser_tabs', {}), /关闭|策略/);
  }
  const plan = createBrowserTools({ ...base, readOnly: true });
  for (const name of ['browser_click','browser_fill','browser_press_key']) {
    assert.equal(plan.definitions.some((v) => v.function.name === name), false);
    await assert.rejects(plan.execute(name, { tab_id: 'tab1', snapshot_id: 'snap1', ref: 'e1', ...(name === 'browser_fill' ? { text: '' } : name === 'browser_press_key' ? { key: 'Enter' } : {}) }), /模式/);
  }
});
test('invalid or unexpected arguments fail before approval or effects; fixed DOM code escapes injected text', async () => {
  let approved = 0; const t = createBrowserTools({ ...base, approve: async () => approved++ });
  for (const [name,args] of [['browser_click',{ tab_id:'tab1',snapshot_id:'snap1',ref:'e1',javascript:'alert(1)' }],['browser_scroll',{tab_id:'tab1',y:2001}],['browser_press_key',{tab_id:'tab1',snapshot_id:'snap1',ref:'e1',key:'Ctrl+V'}]]) await assert.rejects(t.execute(name,args));
  assert.equal(approved,0);
  assert.throws(() => validate('browser_open', { url: 4 }));
  assert.throws(() => domScript('evaluate',{}));
  new vm.Script(domScript('fill',{text:"中文');globalThis.polluted=true;//\n\\",snapshotId:'snapshot',ref:'e1'}));
});
test('refusal, cancellation and changed policy never open the requested page', async () => {
  let opened=0; const browser={...base.browser,open:async()=>{opened++;}};
  await assert.rejects(createBrowserTools({...base,browser,approve:async()=>{throw Error('用户拒绝');}}).execute('browser_open',{url:'https://example.com/'}),/拒绝/);
  let policy='on-request'; await assert.rejects(createBrowserTools({...base,browser,policy:()=>policy,approve:async()=>{policy='never';}}).execute('browser_open',{url:'https://example.com/'}),/策略/);
  const c=new AbortController(); c.abort(); await assert.rejects(createBrowserTools({...base,browser}).execute('browser_open',{url:'https://example.com/'},{signal:c.signal}),/停止/);
  assert.equal(opened,0);
});
test('approved target fingerprint is rechecked; external page cannot silently replace target', async () => {
  let acted=false,version=2;
  const browser={...base.browser,inspect:async()=>({name:'提交',tag:'button',fingerprint:'exact-target'}),verify:()=>{if(version!==2)throw Error('页面变化');},act:async()=>{acted=true;}};
  const t=createBrowserTools({...base,browser,approve:async(input)=>{assert.match(input.command,/提交/);version=3;}});
  await assert.rejects(t.execute('browser_click',{tab_id:'tab1',snapshot_id:'snap1',ref:'e1'}),/变化/);assert.equal(acted,false);
});
const image = {name:'web.jpg',dataUrl:'data:image/jpeg;base64,'+Buffer.from('controlled-image').toString('base64')};
for (const protocol of ['native','json']) test('screenshots use image_url after complete tool results in '+protocol+' channel',async()=>{
  let round=0;const requests=[];
  const tools=[{type:'function',function:{name:'browser_screenshot',parameters:{type:'object'}}}];
  await runModelTask({connection:{endpoint:'http://unused',model:'fixture',apiKey:'fixture',toolProtocol:protocol},messages:[{role:'user',content:'test'}],tools,
    executeTool:async()=>({ok:true,modelImages:[image],activity:{screenshot:image}}),
    fetchImpl:async(_u,init)=>{const body=JSON.parse(init.body);requests.push(body);round++;
      const message=round===1?(protocol==='json'?{content:JSON.stringify({type:'tool',name:'browser_screenshot',arguments:{}})}:{tool_calls:[{id:'call_screen',type:'function',function:{name:'browser_screenshot',arguments:'{}'}}]}):{content:protocol==='json'?JSON.stringify({type:'final',content:'已收到真实图片消息'}):'已收到真实图片消息'};
      return new Response(JSON.stringify({choices:[{message,finish_reason:round===1&&protocol==='native'?'tool_calls':'stop'}]}),{headers:{'content-type':'application/json'}});
    }});
  const final=requests[1].messages.at(-1);assert.equal(final.role,'user');assert.equal(final.content[1].type,'image_url');assert.equal(final.content[1].image_url.url,image.dataUrl);
  const resultMessage=requests[1].messages.at(-2);assert.equal(JSON.stringify(resultMessage).includes('base64'),false);assert.equal(JSON.stringify(resultMessage).includes('activity'),false);
  assert.equal(resultMessage.role,protocol==='native'?'tool':'user');
});
test('persisted screenshot previews are bounded, data URLs only, and limited to last four operations',()=>{
  const operations=Array.from({length:7},(_,i)=>({id:'op'+i,name:'browser_screenshot',status:'succeeded',screenshot:i===6?{dataUrl:'https://untrusted/image'}:image}));
  const normalized=normalizeLibrary({conversations:[{id:'chat1',messages:[{role:'assistant',id:'message1',content:'图片',operations}]}]});
  const value=normalized.conversations[0].messages[0].operations;
  assert.equal(value.filter(v=>v.screenshot).length,3);assert.equal(value[0].screenshot,undefined);assert.equal(value[6].screenshot,undefined);
});
