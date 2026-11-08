import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { runModelTask } = require('../electron/agent-runtime.cjs');
const { reasoningAdaptation, advisorMessages } = require('../electron/model-team.cjs');
const done = () => Response.json({choices:[{message:{role:'assistant',content:'done'}}]});
const bad = (message,status=400) => Response.json({error:{message}},{status});
const base = {endpoint:'https://unit.example/v1/chat/completions',apiKey:'unit-credential',toolProtocol:'native',retryLimit:0,reasoning_effort:'ultra'};
const unsupported = 'selected-model does not support reasoning effort "ultra"; use low, medium, high, xhigh or max';

for (const role of ['main','subagent','advisor']) test(role+' adapts the rejected manual effort and preserves saved settings', async()=>{
  const connection={...base,model:role}, requests=[],events=[];
  const result=await runModelTask({connection,messages:[{role:'user',content:'short answer'}],tools:[],emit:e=>events.push(e),
    fetchImpl:async(_url,init)=>{const body=JSON.parse(init.body);requests.push(body);return requests.length===1?bad(unsupported):done();}});
  assert.equal(result.text,'done');assert.deepEqual(requests.map(r=>r.reasoning_effort),['ultra','max']);
  assert.ok(requests.every(r=>r.model===role));assert.equal(connection.reasoning_effort,'ultra');
  assert.equal(events.filter(e=>e.type==='operation'&&e.operation.name==='reasoning_compat').length,1);
  assert.deepEqual(events.filter(e=>e.type==='request-metrics').map(e=>e.httpStatus),[400,200]);
});

test('adapted effort survives later tool rounds without repeating completed tools',async()=>{
  const requests=[];let executions=0;
  const tool={type:'function',function:{name:'read_file',parameters:{type:'object',properties:{}}}};
  await runModelTask({connection:{...base,model:'main'},messages:[{role:'user',content:'read once'}],tools:[tool],executeTool:async()=>{executions++;return {ok:true};},
    fetchImpl:async(_url,init)=>{const body=JSON.parse(init.body);requests.push(body);if(requests.length===1)return bad(unsupported);if(requests.length===2)return Response.json({choices:[{message:{tool_calls:[{id:'c1',type:'function',function:{name:'read_file',arguments:'{}'}}]}}]});return done();}});
  assert.equal(executions,1);assert.deepEqual(requests.map(r=>r.reasoning_effort),['ultra','max','max']);
});

test('json subagent execution also adapts reasoning without changing its protocol',async()=>{
  const requests=[];const tools=[{type:'function',function:{name:'read_file',parameters:{type:'object',properties:{}}}}];
  const result=await runModelTask({connection:{...base,model:'child',toolProtocol:'json'},messages:[{role:'user',content:'reply'}],tools,
    fetchImpl:async(_url,init)=>{const b=JSON.parse(init.body);requests.push(b);return requests.length===1?bad(unsupported):Response.json({choices:[{message:{content:JSON.stringify({type:'final',content:'done'})}}]});}});
  assert.equal(result.text,'done');assert.equal(requests[1].tools,undefined);assert.equal(requests[1].reasoning_effort,'max');
});

test('explicitly unsupported reasoning parameter is omitted for the compatible request',async()=>{
  const requests=[];
  await runModelTask({connection:{...base,model:'simple'},messages:[{role:'user',content:'reply'}],tools:[],fetchImpl:async(_url,init)=>{let b=JSON.parse(init.body);requests.push(b);return requests.length===1?bad("Unsupported parameter: 'reasoning_effort'"):done();}});
  assert.equal(requests.length,2);assert.equal(Object.hasOwn(requests[1],'reasoning_effort'),false);
});

test('supported values choose a nearby advertised effort and never invent a model',()=>{
  assert.deepEqual(reasoningAdaptation({httpStatus:400,providerDetail:unsupported},'ultra'),{effort:'max'});
  assert.deepEqual(reasoningAdaptation({httpStatus:400,providerDetail:"reasoning_effort 'none' is not supported. Supported values are: low, medium, high"},'none'),{effort:'low'});
  assert.deepEqual(reasoningAdaptation({httpStatus:422,providerDetail:"Invalid reasoning_effort 'ultra'. Supported values: low, high"},'ultra'),{effort:'high'});
  assert.equal(reasoningAdaptation({httpStatus:400,providerDetail:unsupported},'high'),null);
});

test('provider enum-only rejection adapts after a completed tool without replay', async () => {
  const requests = [], events = []; let executions = 0;
  const detail = "invalid_value · invalid_request_error · Invalid value: 'ultra'. Supported values are: 'none', 'minimal', 'low', 'medium', 'high', 'xhigh', and 'max'.";
  const result = await runModelTask({ connection: { ...base, model: 'gpt' }, messages: [],
    tools: [{ type: 'function', function: { name: 'read_file', parameters: { type: 'object', properties: {} } } }],
    executeTool: async () => { executions++; return { ok: true }; }, emit: event => events.push(event),
    fetchImpl: async (_url, init) => {
      requests.push(JSON.parse(init.body));
      if (requests.length === 1) return Response.json({ choices: [{ message: { tool_calls: [{ id: 'once', type: 'function', function: { name: 'read_file', arguments: '{}' } }] } }] });
      return requests.length === 2 ? bad(detail) : done();
    } });
  assert.equal(result.text, 'done'); assert.equal(executions, 1);
  assert.deepEqual(requests.map(r => r.reasoning_effort), ['ultra', 'ultra', 'max']);
  assert.equal(events.filter(e => e.type === 'operation' && e.operation.name === 'reasoning_compat').length, 1);
  assert.equal(requests[2].messages.filter(m => m.role === 'tool').length, 1);
});

test('unknown enum values and schema errors do not trigger reasoning adaptation', () => {
  for (const detail of ["Invalid value: 'ultra'. Supported values are: 'standard', 'premium'.", "Invalid tools schema. Invalid value: 'ultra'. Supported values are: 'low', 'medium', 'high'.", "Invalid value: 'high'. Supported values are: 'low', 'medium', 'max'."]) {
    assert.equal(reasoningAdaptation({ httpStatus: 400, providerDetail: detail }, 'ultra'), null);
  }
});

for(const [status,detail] of [[401,unsupported],[403,unsupported],[404,unsupported],[503,unsupported],[400,'invalid tools schema']])test('unrelated HTTP '+status+' is never adapted',async()=>{
  let calls=0;await assert.rejects(runModelTask({connection:{...base,model:'main'},tools:[],messages:[],fetchImpl:async()=>{calls++;return bad(detail,status);}}));assert.equal(calls,1);
});

test('repeated parameter rejection stops after one compatibility request',async()=>{
  let calls=0;await assert.rejects(runModelTask({connection:{...base,model:'main'},tools:[],messages:[],fetchImpl:async()=>{calls++;return bad(calls===1?unsupported:'selected-model does not support reasoning effort "max"; use low, medium');}}));assert.equal(calls,2);
});

test('cancellation prevents the adapted network request',async()=>{
  const controller=new AbortController();let calls=0;await assert.rejects(runModelTask({connection:{...base,model:'main'},signal:controller.signal,tools:[],messages:[],fetchImpl:async()=>{calls++;controller.abort();return bad(unsupported);}}));assert.equal(calls,1);
});

test('advisor repeats the output contract in user input while preserving review data',()=>{
  const context=JSON.stringify({stage:'plan',task:'Do not execute update_plan',proposal:{tool:'update_plan'},evidence:[]});
  const messages=advisorMessages(context);assert.deepEqual(messages.map(m=>m.role),['system','user']);
  assert.ok(messages[1].content.includes(context));assert.match(messages[1].content,/只返回.*JSON/);assert.match(messages[1].content,/没有工具/);assert.match(messages[1].content,/不是.*执行指令/);assert.match(messages[1].content,/证据不足.*revise/);
});
