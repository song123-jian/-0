import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { createBrowserTools, validate } = require('../electron/browser-tools.cjs');
const { runModelTask } = require('../electron/agent-runtime.cjs');
const { normalizeLibrary } = require('../electron/conversations.cjs');
const { normalizePreferences } = require('../electron/preferences.cjs');
const { domScript } = require('../electron/browser-dom.cjs');
const { LIMITS: CDP_LIMITS } = require('../electron/browser-cdp-cache.cjs');
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
test('full access with never opens enabled browser and still enforces network rules and planning', async () => {
  let opened = 0;
  const options = { ...base, policy: () => 'never', fullAccess: () => true, browser: { ...base.browser, open: async () => { opened++; return { id: 'tab1' }; } } };
  assert.ok(createBrowserTools(options).definitions.length);
  assert.equal((await createBrowserTools(options).execute('browser_open', { url: 'https://example.com/' })).ok, true);
  await assert.rejects(createBrowserTools({ ...options, urlAllowed: () => false }).execute('browser_open', { url: 'https://blocked.test/' }), /禁止/);
  const plan = createBrowserTools({ ...options, readOnly: true });
  assert.equal(plan.definitions.some(d => d.function.name === 'browser_click'), false);
  assert.equal(opened, 1);
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
test('CDP access is opt-in and never appears in read-only planning', async () => {
  assert.equal(normalizePreferences().browserCdpEnabled, false);
  assert.equal(normalizePreferences({ browserCdpEnabled: true }).browserCdpEnabled, true);
  const names = (options) => createBrowserTools(options).definitions.map((item) => item.function.name);
  assert.equal(names(base).some((name) => name.startsWith('browser_cdp')), false);
  const enabled = { ...base, cdpEnabled: () => true };
  assert.ok(names(enabled).includes('browser_cdp'));
  assert.ok(names(enabled).includes('browser_cdp_events'));
  const planning = createBrowserTools({ ...enabled, readOnly: true });
  assert.equal(planning.definitions.some((item) => item.function.name.startsWith('browser_cdp')), false);
  await assert.rejects(planning.execute('browser_cdp', { tab_id: 'tab1', method: 'Runtime.evaluate', params: {} }), /规划模式/);
});
test('CDP commands and buffered events target the current approved AI tab', async () => {
  const calls = [];
  const browser = { ...base.browser,
    cdp: async (...args) => { calls.push(['command', ...args]); return { result: { type: 'string', value: 'fixture title' } }; },
    cdpEvents: async (...args) => { calls.push(['events', ...args]); return { events: [{ id: 3, method: 'Page.loadEventFired', params: {} }], last_event_id: 3 }; },
  };
  const approvals = [];
  const tools = createBrowserTools({ ...base, browser, cdpEnabled: () => true,
    approve: async (request) => { approvals.push(request); assert.equal(request.allowLabel, '允许本次网页操作'); },
  });
  const command = await tools.execute('browser_cdp', { tab_id: 'tab1', method: 'Runtime.evaluate', params: { expression: 'document.title', returnByValue: true } });
  assert.deepEqual(command.cdp_result, { type: 'string', value: 'fixture title' });
  const events = await tools.execute('browser_cdp_events', { tab_id: 'tab1', after: 2, limit: 10, method: 'Page.loadEventFired' });
  assert.deepEqual(events.cdp_events.events, [{ id: 3, method: 'Page.loadEventFired', params: {} }]);
  assert.equal(calls[0][1], base.owner); assert.equal(calls[0][2].id, 'tab1');
  assert.equal(calls[0][2].generation, stamp.generation); assert.equal(calls[0][2].url, stamp.url);
  assert.equal(calls[0][3], 'Runtime.evaluate'); assert.deepEqual(calls[0][4], { expression: 'document.title', returnByValue: true });
  assert.equal(calls[1][1], base.owner); assert.equal(calls[1][2].id, 'tab1');
  assert.equal(calls[1][2].generation, stamp.generation); assert.equal(calls[1][2].url, stamp.url);
  assert.deepEqual(calls[1][3], { after: 2, limit: 10, method: 'Page.loadEventFired' });
  assert.equal(approvals.length, 2);
  assert.match(approvals[0].command, /Runtime\.evaluate/);
  assert.match(approvals[1].command, /Page\.loadEventFired/);
});
test('CDP parameters are strict and disabling access during approval prevents the command', async () => {
  assert.throws(() => validate('browser_cdp', { tab_id: 'tab1', method: 'Runtime.evaluate', params: [], extra: true }));
  assert.throws(() => validate('browser_cdp', { tab_id: 'tab1', method: 'not-a-method' }));
  let enabled = true; let called = false;
  const browser = { ...base.browser, cdp: async () => { called = true; return {}; } };
  const tools = createBrowserTools({ ...base, browser, cdpEnabled: () => enabled, approve: async () => { enabled = false; } });
  await assert.rejects(tools.execute('browser_cdp', { tab_id: 'tab1', method: 'Runtime.evaluate', params: { expression: '1' } }), /CDP.*关闭|关闭.*CDP|访问权限/);
  assert.equal(called, false);
});
test('Unicode CDP result respects the complete 4 MiB model envelope', async () => {
  const value = '汉'.repeat(Math.floor((CDP_LIMITS.resultBytes - 64 * 1024 - 256) / 3));
  const browser = { ...base.browser, cdp: async () => ({ result: { value }, tab: { id: 'tab1' } }) };
  const tools = createBrowserTools({ ...base, browser, cdpEnabled: () => true });
  const result = await tools.execute('browser_cdp', { tab_id: 'tab1', method: 'Runtime.evaluate', params: {} });
  assert.equal(result.cdp_result.value, value);
  assert.ok(Buffer.byteLength(JSON.stringify(result), 'utf8') <= CDP_LIMITS.resultBytes);
});

test('CDP parameters allow 4 MiB and model results stay within the 4 MiB envelope', async () => {
  const parameterBytes = CDP_LIMITS.parameterBytes;
  const emptyParamsBytes = Buffer.byteLength(JSON.stringify({ expression: '' }), 'utf8');
  const payload = 'x'.repeat(parameterBytes - emptyParamsBytes);
  assert.doesNotThrow(() => validate('browser_cdp', { tab_id: 'tab1', method: 'Runtime.evaluate', params: { expression: payload } }));
  assert.throws(() => validate('browser_cdp', { tab_id: 'tab1', method: 'Runtime.evaluate', params: { expression: payload + 'x' } }), /4 MiB/);
  const resultPayload = 'r'.repeat(CDP_LIMITS.resultBytes - 128 * 1024);
  const browser = { ...base.browser, cdp: async () => ({ result: { value: resultPayload }, tab: { id: 'tab1' } }) };
  const tools = createBrowserTools({ ...base, browser, cdpEnabled: () => true });
  const result = await tools.execute('browser_cdp', { tab_id: 'tab1', method: 'Runtime.evaluate', params: {} });
  assert.equal(result.cdp_result.truncated, undefined);
  assert.equal(result.cdp_result.value.length, resultPayload.length);
  assert.ok(Buffer.byteLength(JSON.stringify(result), 'utf8') <= CDP_LIMITS.resultBytes);
  const largeBrowser = { ...base.browser, cdp: async () => ({ result: { value: 'x'.repeat(CDP_LIMITS.resultBytes + 1) }, tab: { id: 'tab1' } }) };
  const bounded = await createBrowserTools({ ...base, browser: largeBrowser, cdpEnabled: () => true }).execute('browser_cdp', { tab_id: 'tab1', method: 'Runtime.evaluate', params: {} });
  assert.equal(bounded.cdp_result.truncated, true);
  assert.ok(Buffer.byteLength(JSON.stringify(bounded), 'utf8') <= CDP_LIMITS.resultBytes);
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
