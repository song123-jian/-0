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

test('consecutive identical failure stops loops; command failure keeps real output', async () => {
  const events = []; let requests = 0;
  await assert.rejects(runModelTask({ connection, messages: [], tools, emit: (e) => events.push(e),
    executeTool: async () => ({ ok: false, error: '失败', output: '实际 stderr', activity: { output: '实际 stderr' } }),
    fetchImpl: async () => { requests++; return toolReply(); } }), /连续失败三次/);
  assert.equal(requests, 3);
  assert.match(events.filter((e) => e.type === 'operation').at(-1).operation.output, /实际 stderr\n失败/);
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
  await assert.rejects(runModelTask({ connection, messages: [], tools, fetchImpl: async () => { requests++; return new Response('', { status: 400 }); } }), /支持.*function tools/);
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
