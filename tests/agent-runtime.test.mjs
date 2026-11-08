import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { readCompletion, runModelTask } = require('../electron/agent-runtime.cjs');
const { normalizeLibrary } = require('../electron/conversations.cjs');
const connection = { endpoint: 'http://127.0.0.1/v1/chat/completions', model: 'fixture', apiKey: 'test-only' };
const tools = [{ type: 'function', function: { name: 'read_file', parameters: { type: 'object' } } }];
function stream(events, finish = true, byteSize = 7) {
  const buffer = Buffer.from(events.map((value) => 'data: ' + JSON.stringify(value) + '\r\n\r\n').join('') + (finish ? 'data: [DONE]\r\n\r\n' : ''));
  let offset = 0;
  return new Response(new ReadableStream({ pull(controller) { if (offset >= buffer.length) controller.close(); else { controller.enqueue(buffer.subarray(offset, offset += byteSize)); } } }), { headers: { 'content-type': 'text/event-stream' } });
}
const delta = (value, finish_reason = null) => ({ choices: [{ delta: value, finish_reason }] });
const toolReply = (name = 'read_file', args = '{"path":"文件.txt"}') => stream([
  delta({ tool_calls: [{ index: 0, id: 'call_中文'.replace('中文', 'file'), type: 'function', function: { name, arguments: args } }] }), delta({}, 'tool_calls'),
]);

test('completed tool calls execute without waiting for a gateway to close its stream', async () => {
  let cancelled = false, requests = 0; const events = [];
  const response = new Response(new ReadableStream({ start(controller) {
    controller.enqueue(Buffer.from('data: ' + JSON.stringify(delta({ tool_calls: [{ index: 0, id: 'early', function: { name: 'read_file', arguments: '{}' } }] })) + '\n\ndata: ' + JSON.stringify(delta({}, 'tool_calls')) + '\n\n'));
  }, cancel() { cancelled = true; } }), { headers: { 'content-type': 'text/event-stream' } });
  const started = performance.now();
  const result = await runModelTask({ connection, messages: [], tools, emit: event => events.push(event), executeTool: async () => ({ ok: true }),
    fetchImpl: async () => requests++ ? stream([delta({ content: '完成' }), delta({}, 'stop')]) : response });
  assert.equal(result.operations, 1); assert.equal(cancelled, true); assert.ok(performance.now() - started < 1000);
  const metric = events.find(event => event.type === 'request-metrics');
  assert.notEqual(metric.firstTokenMs, null); assert.notEqual(metric.firstToolCallMs, null); assert.ok(metric.responseHeadersMs >= 0);
  assert.ok(events.some(event => event.type === 'phase' && event.phase === 'tool-input'));
});

test('reasoning activity is visible as a phase without exposing private reasoning text', async () => {
  const events = [];
  await runModelTask({ connection, messages: [], emit: event => events.push(event), fetchImpl: async () => stream([
    delta({ reasoning_content: 'private-chain-do-not-display' }), delta({ content: '答复' }), delta({}, 'stop')]) });
  assert.ok(events.some(event => event.type === 'phase' && event.phase === 'reasoning'));
  assert.ok(!JSON.stringify(events).includes('private-chain-do-not-display'));
  assert.notEqual(events.find(event => event.type === 'request-metrics').firstTokenMs, null);
});

test('incomplete optional usage trailers cannot block or invalidate a completed response', async () => {
  let cancelled = false;
  const response = new Response(new ReadableStream({ start(controller) {
    controller.enqueue(Buffer.from('data: ' + JSON.stringify(delta({ content: 'done' }, 'stop')) + '\n\ndata: {"usage":'));
  }, cancel() { cancelled = true; } }), { headers: { 'content-type': 'text/event-stream' } });
  const started = performance.now(); const message = await readCompletion(response, { usageGraceMs: 150 });
  assert.equal(message.content, 'done'); assert.equal(cancelled, true); assert.ok(performance.now() - started < 800);
});

test('streaming emits its first text immediately and batches subsequent fragments without losing content', async () => {
  const events = []; const fragments = Array.from({ length: 300 }, () => delta({ content: '中' }));
  const result = await runModelTask({ connection, messages: [], emit: event => events.push(event), fetchImpl: async () => stream([...fragments, delta({}, 'stop')], true, 10000) });
  const deltas = events.filter(event => event.type === 'delta');
  assert.equal(deltas[0].text, '中'); assert.equal(deltas.map(event => event.text).join(''), result.text);
  assert.equal(result.text.length, 300); assert.ok(deltas.length < 10);
});

test('SSE parser preserves UTF8 split across bytes and assembles fragmented tools', async () => {
  const fragments = [];
  const value = await readCompletion(stream([
    delta({ content: '正在读取中文' }),
    delta({ tool_calls: [{ index: 0, id: 'call_1', type: 'function', function: { name: 'read_', arguments: '{"pa' } }] }),
    delta({ tool_calls: [{ index: 0, function: { name: 'file', arguments: 'th":"中文.txt"}' } }] }), delta({}, 'tool_calls'),
  ], true, 1), { onDelta: (text) => fragments.push(text) });
  assert.equal(fragments.join(''), '正在读取中文');
  assert.deepEqual(value.tool_calls[0], { id: 'call_1', type: 'function', function: { name: 'read_file', arguments: '{"path":"中文.txt"}' } });
});

test('runtime sends actual tool result back to model before completing', async () => {
  const requests = []; const events = []; let executed = 0;
  const result = await runModelTask({ connection, messages: [{ role: 'user', content: '读取文件' }], tools,
    emit: (e) => events.push(e), executeTool: async (name, args) => { executed++; assert.equal(args.path, '文件.txt'); return { ok: true, content: '实际正文' }; },
    fetchImpl: async (_url, init) => { const body = JSON.parse(init.body); requests.push(body); return requests.length === 1 ? toolReply() : stream([delta({ content: '文件中包含实际正文。' }), delta({}, 'stop')]); } });
  assert.equal(executed, 1); assert.equal(result.rounds, 2); assert.match(result.text, /实际正文/);
  assert.equal(requests[1].messages.at(-1).role, 'tool'); assert.match(requests[1].messages.at(-1).content, /实际正文/);
  assert.deepEqual(events.filter((e) => e.type === 'operation').map((e) => e.operation.status), ['running', 'succeeded']);
});

test('incomplete or length-truncated tool response never executes', async () => {
  for (const response of [stream([delta({ tool_calls: [{ index: 0, id: 'call_1', function: { name: 'read_file', arguments: '{}' } }] })], false), stream([delta({}, 'length')])]) {
    let executed = false;
    await assert.rejects(runModelTask({ connection, messages: [], tools, executeTool: async () => { executed = true; }, fetchImpl: async () => response }), /中断|截断/);
    assert.equal(executed, false);
  }
});

test('unsupported tool and malformed arguments are reported as failed without execution', async () => {
  for (const [name, args] of [['hidden_tool', '{}'], ['read_file', '{bad']]) {
    let requests = 0; let executed = false; const events = [];
    await runModelTask({ connection, messages: [], tools, emit: (e) => events.push(e), executeTool: async () => { executed = true; },
      fetchImpl: async () => ++requests === 1 ? toolReply(name, args) : stream([delta({ content: '已停止此操作。' }), delta({}, 'stop')]) });
    assert.equal(executed, false); assert.equal(events.filter((e) => e.type === 'operation').at(-1).operation.status, 'failed');
  }
});

test('consecutive identical failures do not impose an automatic stop; command failure keeps real output', async () => {
  const events = []; let requests = 0;
  const result = await runModelTask({ connection, messages: [], tools, emit: (e) => events.push(e),
    executeTool: async () => ({ ok: false, error: '失败', output: '实际 stderr', activity: { output: '实际 stderr' } }),
    fetchImpl: async () => { requests++; return requests <= 3 ? toolReply() : stream([delta({ content: '已根据实际错误继续处理。' }), delta({}, 'stop')]); } });
  assert.equal(requests, 4); assert.match(result.text, /继续处理/);
  assert.match(events.filter((e) => e.type === 'operation').at(-1).operation.output, /实际 stderr\n失败/);
});

test('responses larger than four megabytes are accepted when the stream is complete', async () => {
  const content = '长响应'.repeat(1_500_000);
  const result = await runModelTask({ connection, messages: [], fetchImpl: async () => stream([delta({ content }), delta({}, 'stop')], true, 64 * 1024) });
  assert.equal(result.text, content);
});

test('request refuses a context that cannot fit its protected system instructions', async () => {
  let requests = 0;
  await assert.rejects(runModelTask({ connection: { ...connection, contextWindowTokens: 8 },
    messages: [{ role: 'system', content: 'This required instruction is longer than the configured context window.' }, { role: 'user', content: 'Do the task.' }],
    fetchImpl: async () => { requests++; return stream([delta({ content: 'unexpected' }), delta({}, 'stop')]); },
  }), /上下文.*超过|context.*capacity/i);
  assert.equal(requests, 0);
});

test('context-length retry does not replay completed tools and keeps their history paired', async () => {
  const largeTask = ['Current task: preserve this request.', ...Array.from({ length: 1600 }, (_, index) => `background ${index} ${'x'.repeat(20)}`), 'Error evidence: E:\\repo\\failure.log'].join('\n');
  let requests = 0, executed = 0;
  const bodies = [];
  const result = await runModelTask({ connection, messages: [{ role: 'user', content: largeTask }], tools,
    executeTool: async () => { executed++; return { ok: true, output: 'actual completed tool result' }; },
    fetchImpl: async (_url, init) => {
      bodies.push(JSON.parse(init.body));
      requests++;
      if (requests === 1) return toolReply();
      if (requests === 2) return Response.json({ error: { message: 'maximum context length exceeded' } }, { status: 400 });
      return stream([delta({ content: '已依据真实结果完成。' }), delta({}, 'stop')]);
    },
  });
  assert.equal(result.rounds, 2);
  assert.equal(requests, 3);
  assert.equal(executed, 1);
  const retryMessages = bodies[2].messages;
  const callId = 'call_file';
  const callIndex = retryMessages.findIndex(item => item.tool_calls?.some(call => call.id === callId));
  assert.ok(callIndex >= 0);
  assert.equal(retryMessages[callIndex + 1].tool_call_id, callId);
});

test('cancelled task cannot execute a later tool in the same batch', async () => {
  const controller = new AbortController(); let count = 0;
  await assert.rejects(runModelTask({ connection, messages: [], tools, signal: controller.signal,
    executeTool: async () => { count++; controller.abort(); return { ok: true }; },
    fetchImpl: async () => stream([delta({ tool_calls: [0, 1].map((index) => ({ index, id: 'call_' + index, function: { name: 'read_file', arguments: '{}' } })) }), delta({}, 'tool_calls')]) }), /停止/);
  assert.equal(count, 1);
});

test('dialogue requests omit tools and reject unexpected calls; JSON endpoints are supported', async () => {
  const result = await runModelTask({ connection, messages: [], fetchImpl: async (_url, init) => {
    assert.equal(JSON.parse(init.body).tools, undefined);
    return Response.json({ choices: [{ message: { role: 'assistant', content: '普通回答' }, finish_reason: 'stop' }] });
  } });
  assert.equal(result.text, '普通回答');
  await assert.rejects(runModelTask({ connection, messages: [], fetchImpl: async () => toolReply() }), /不允许执行工具/);
});

test('tool HTTP rejection is clear and never silently retries with tools disabled', async () => {
  let requests = 0;
  await assert.rejects(runModelTask({ connection, messages: [], tools, fetchImpl: async () => { requests++; return new Response('', { status: 400 }); } }), /HTTP 400.*参数与工具能力/);
  assert.equal(requests, 1);
});

test('activity persistence retains differences and exit codes but never restores live approvals', () => {
  const library = normalizeLibrary({ conversations: [{ executionEnabled: true, messages: [{ role: 'assistant', content: '', pending: true,
    approval: { id: 'stale' }, operations: [{ id: 'op1', name: 'edit_file', status: 'running', path: '中文.js', diff: '-旧\n+新', output: '中文输出', exitCode: 3, plan: [{ text: '检查', status: 'completed' }] }] }] }] });
  assert.equal(library.conversations[0].executionEnabled, true);
  const message = library.conversations[0].messages[0];
  assert.equal(message.approval, undefined); assert.equal(message.operations[0].status, 'interrupted'); assert.equal(message.operations[0].exitCode, 3); assert.match(message.operations[0].diff, /新/);
  assert.deepEqual(normalizeLibrary(JSON.parse(JSON.stringify(library))), library);
});


test('compatible protocol executes only a complete explicit action and keeps raw protocol out of user text', async () => {
  let requests = 0; let executed = 0; const deltas = [];
  const result = await runModelTask({ connection: { ...connection, toolProtocol: 'json' }, messages: [{role:'system',content:'Use project tools.'},{role:'user',content:'Read the file'}], tools,
    emit: (event) => { if (event.type==='delta') deltas.push(event.text); },
    executeTool: async (name,args) => { executed++; assert.equal(name,'read_file');assert.equal(args.path,'中文.txt');return {ok:true,content:'真实文件'}; },
    fetchImpl: async (_url,init) => { const body=JSON.parse(init.body);assert.equal(body.tools,undefined);assert.match(body.messages[0].content,/中转兼容执行通道/);
      if(requests++) { assert.equal(body.messages.at(-1).role,'user');assert.match(body.messages.at(-1).content,/真实文件/); }
      return stream([delta({content:JSON.stringify(requests===1?{type:'tool',name:'read_file',arguments:{path:'中文.txt'}}:{type:'final',content:'读取完成。'})}),delta({},'stop')]);
    } });
  assert.equal(executed,1);assert.equal(result.text,'读取完成。');assert.equal(deltas.join(''),'读取完成。');
});

test('compatible protocol rejects commentary, embedded actions and malformed JSON without execution', async () => {
  for (const content of ['已修改文件。', '说明：'+JSON.stringify({type:'tool',name:'read_file',arguments:{}}), '{"type":"tool","name":"read_file","arguments":[] }']) {
    let executed=false;
    await assert.rejects(runModelTask({connection:{...connection,toolProtocol:'json'},messages:[],tools,executeTool:async()=>{executed=true;},fetchImpl:async()=>stream([delta({content}),delta({},'stop')])}),/兼容/);
    assert.equal(executed,false);
  }
});

test('service error details redact the configured credential and other bearer strings', async () => {
  await assert.rejects(runModelTask({connection,messages:[],fetchImpl:async()=>Response.json({message:'Upgrade required; test-only sk-private-key Bearer private-token'},{status:426})}),error=>{
    assert.match(error.message,/HTTP 426/);assert.match(error.message,/Upgrade required/);assert.doesNotMatch(error.message,/test-only|sk-private-key|private-token/);return true;
  });
});

test('upstream authentication failures from a gateway explain why model-list latency still succeeds', async () => {
  await assert.rejects(runModelTask({connection,messages:[{role:'user',content:'请修复'}],fetchImpl:async()=>Response.json({message:'Upstream authentication failed, please contact administrator'},{status:502})}),error=>{
    assert.match(error.message,/上游鉴权失败（HTTP 502）/);
    assert.match(error.message,/测速只检查 \/models/);
    assert.match(error.message,/服务管理员检查上游密钥和模型路由/);
    return true;
  });
});

test('desktop screenshots are forwarded to the model as actual image evidence', async () => {
  let requests = 0;
  const desktopTools = [{ type: 'function', function: { name: 'desktop_screenshot', parameters: { type: 'object', properties: {} } } }];
  await runModelTask({ connection, messages: [], tools: desktopTools,
    executeTool: async () => ({ ok: true, screenshot_id: 'current', modelImages: [{ name: 'desktop.jpg', dataUrl: 'data:image/jpeg;base64,/9j/2Q==' }] }),
    fetchImpl: async (_url, init) => {
      if (++requests === 1) return toolReply('desktop_screenshot', '{}');
      const messages = JSON.parse(init.body).messages;
      assert.ok(messages.some(message => Array.isArray(message.content) && message.content.some(part => part.type === 'image_url')));
      assert.ok(!messages.filter(message => message.role === 'tool').some(message => message.content.includes('base64')));
      return stream([delta({ content: '已查看桌面。' }), delta({}, 'stop')]);
    } });
  assert.equal(requests, 2);
});
