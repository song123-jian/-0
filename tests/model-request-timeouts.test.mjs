import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { runModelTask } = require('../electron/agent-runtime.cjs');
const connection = { endpoint: 'http://localhost/fixture', model: 'fixture', apiKey: 'fixture' };
const frame = (delta, finish_reason = null) => 'data: ' + JSON.stringify({ choices: [{ delta, finish_reason }] }) + '\n\n';
function timedResponse(chunks, gap = 25, close = true) {
  let timer;
  return new Response(new ReadableStream({ start(controller) {
    let index = 0;
    timer = setInterval(() => {
      if (index < chunks.length) controller.enqueue(Buffer.from(chunks[index++]));
      else if (close) { clearInterval(timer); controller.close(); }
    }, gap);
  }, cancel() { clearInterval(timer); } }), { headers: { 'content-type': 'text/event-stream' } });
}
test('meaningful reasoning continues beyond the idle window without exposing its body', async () => {
  const events = [], chunks = Array.from({ length: 8 }, () => frame({ reasoning_content: 'private-progress' }));
  chunks.push(frame({ content: '完成' }, 'stop'));
  const started = performance.now();
  const result = await runModelTask({ connection, messages: [], requestTimeouts: { idleMs: 110, totalMs: 2000 }, emit: e => events.push(e), fetchImpl: async () => timedResponse(chunks) });
  assert.equal(result.text, '完成'); assert.ok(performance.now() - started > 200);
  assert.ok(!JSON.stringify(events).includes('private-progress'));
});
test('progressive complete tool arguments execute exactly once beyond the old-style cutoff', async () => {
  let requests = 0, executed = 0;
  const chunks = [frame({ tool_calls: [{ index: 0, id: 'call_1', function: { name: 'write_file', arguments: '{' } }] }),
    ...['"path"', ':', '"x.txt"', ',', '"content"', ':', '"ok"', '}'].map(arguments_ => frame({ tool_calls: [{ index: 0, function: { arguments: arguments_ } }] })), frame({}, 'tool_calls')];
  const result = await runModelTask({ connection, messages: [], requestTimeouts: { idleMs: 110, totalMs: 2000 },
    tools: [{ type: 'function', function: { name: 'write_file' } }], executeTool: async (_name,args) => { executed++; assert.deepEqual(args,{path:'x.txt',content:'ok'}); return {ok:true}; },
    fetchImpl: async () => ++requests === 1 ? timedResponse(chunks) : timedResponse([frame({content:'完成'},'stop')]) });
  assert.equal(result.operations,1); assert.equal(executed,1); assert.equal(requests,2);
});
test('heartbeats and empty frames do not replay completed effects', async () => {
  let requests=0,executed=0;
  await assert.rejects(runModelTask({ connection, messages: [], requestTimeouts: {idleMs:100,totalMs:2000},
    tools:[{type:'function',function:{name:'write_file'}}],executeTool:async()=>{executed++;return {ok:true};},
    fetchImpl:async()=>++requests===1?timedResponse([frame({tool_calls:[{index:0,id:'done_1',function:{name:'write_file',arguments:'{}'}}]},'tool_calls')]):timedResponse(Array.from({length:30},()=>': keepalive\n\n'+frame({})),10) }), /流提前中断/);
  assert.equal(executed,1);assert.equal(requests,2);
});
test('continuous meaningful progress is not stopped by a finite total request bound', async () => {
  let executed=0;
  await assert.rejects(runModelTask({ connection,messages:[],requestTimeouts:{idleMs:110,totalMs:180},executeTool:async()=>{executed++;},
    fetchImpl:async()=>timedResponse(Array.from({length:30},()=>frame({reasoning_content:'working'})),20) }), /流提前中断/);
  assert.equal(executed,0);
});
test('waiting for headers has no automatic timeout and user cancellation remains distinct', async () => {
  const fetchImpl=async(_url,{signal})=>new Promise((_,reject)=>signal.addEventListener('abort',()=>reject(signal.reason),{once:true}));
  const controller=new AbortController();setTimeout(()=>controller.abort(),25);
  await assert.rejects(runModelTask({connection,messages:[],signal:controller.signal,fetchImpl}),error=>/停止|abort|aborted/i.test(error.message));
});
