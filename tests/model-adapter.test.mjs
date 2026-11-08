import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { runModelTask } = require('../electron/agent-runtime.cjs');
const { DEFAULT_CONNECTION, normalizeConnection } = require('../electron/model-connection.cjs');
const tools = [{ type: 'function', function: { name: 'save_file', parameters: { type: 'object', properties: {} } } }];
const base = { endpoint: 'https://unit.example/v1/chat/completions', apiKey: 'unit-key', model: 'selected-model', toolProtocol: 'auto', retryLimit: 0 };
const reply = message => Response.json({ choices: [{ message }] });
const reject = (message, status = 400) => Response.json({ error: { message } }, { status });
const nativeCall = () => reply({ tool_calls: [{ id: 'call-1', type: 'function', function: { name: 'save_file', arguments: '{}' } }] });
const jsonCall = () => reply({ content: JSON.stringify({ type: 'tool', name: 'save_file', arguments: {} }) });
const jsonFinal = () => reply({ content: JSON.stringify({ type: 'final', content: 'completed' }) });
const unsupported = "Unsupported parameter: 'tools'";

test('new connections default to automatic routing and explicit legacy choices survive', () => {
  assert.equal(DEFAULT_CONNECTION.toolProtocol, 'auto');
  assert.equal(normalizeConnection().toolProtocol, 'auto');
  for (const toolProtocol of ['auto', 'native', 'json']) {
    assert.equal(normalizeConnection({ ...DEFAULT_CONNECTION, toolProtocol, subagentToolProtocol: 'auto' }).toolProtocol, toolProtocol);
  }
});

for (const model of ['main', 'child']) test(model + ' automatically falls back to JSON, executes once and preserves settings', async () => {
  const connection = { ...base, model }, requests = [], events = []; let executions = 0;
  const result = await runModelTask({ connection, tools, messages: [{ role: 'system', content: 'Authorized task.' }, { role: 'user', content: 'Save once.' }],
    emit: event => events.push(event), executeTool: async () => { executions++; return { ok: true }; },
    fetchImpl: async (_url, init) => { const body = JSON.parse(init.body); requests.push(body); return requests.length === 1 ? reject(unsupported) : requests.length === 2 ? jsonCall() : jsonFinal(); } });
  assert.equal(result.text, 'completed'); assert.equal(executions, 1); assert.equal(requests.length, 3);
  assert.ok(requests[0].tools); assert.ok(requests.slice(1).every(body => !body.tools && body.model === model));
  assert.match(requests[1].messages[0].content, /完整 JSON/);
  assert.ok(requests[2].messages.some(message => message.role === 'user' && message.content.includes('本机工具实际结果')));
  assert.equal(connection.toolProtocol, 'auto');
  assert.equal(events.filter(event => event.operation?.name === 'tool_compat').length, 1);
  assert.deepEqual(events.filter(event => event.type === 'request-metrics').map(event => event.toolProtocol), ['native', 'json', 'json']);
});

test('automatic routing keeps native tools when supported', async () => {
  const requests = []; let executions = 0;
  const result = await runModelTask({ connection: base, tools, messages: [], executeTool: async () => { executions++; return { ok: true }; },
    fetchImpl: async (_url, init) => { requests.push(JSON.parse(init.body)); return requests.length === 1 ? nativeCall() : reply({ content: 'completed' }); } });
  assert.equal(result.text, 'completed'); assert.equal(executions, 1);
  assert.ok(requests.every(body => body.tools)); assert.ok(requests[1].messages.some(message => message.role === 'tool'));
});

test('tool and reasoning adaptations compose in either rejection order', async () => {
  for (const first of ['tools', 'reasoning']) {
    const requests = [], events = []; const effortError = 'selected-model does not support reasoning effort "ultra"; use low, high or max';
    await runModelTask({ connection: { ...base, reasoning_effort: 'ultra' }, tools, messages: [], emit: event => events.push(event),
      fetchImpl: async (_url, init) => { const body = JSON.parse(init.body); requests.push(body); if (requests.length === 1) return reject(first === 'tools' ? unsupported : effortError); if (requests.length === 2) return reject(first === 'tools' ? effortError : unsupported); return jsonFinal(); } });
    assert.equal(requests.length, 3); assert.equal(requests[2].reasoning_effort, 'max'); assert.equal(requests[2].tools, undefined);
    assert.equal(events.filter(event => event.operation?.name === 'reasoning_compat').length, 1);
    assert.equal(events.filter(event => event.operation?.name === 'tool_compat').length, 1);
  }
});

for (const [status, detail] of [[401, unsupported], [403, unsupported], [404, unsupported], [503, unsupported], [400, 'Invalid tools schema'], [400, 'Invalid API key; tools not supported']]) {
  test('automatic routing does not mask HTTP ' + status + ' ' + detail, async () => {
    let requests = 0; await assert.rejects(runModelTask({ connection: base, tools, messages: [], fetchImpl: async () => { requests++; return reject(detail, status); } })); assert.equal(requests, 1);
  });
}

test('manual native channel fails directly and JSON channel skips capability probing', async () => {
  let requests = 0;
  await assert.rejects(runModelTask({ connection: { ...base, toolProtocol: 'native' }, tools, messages: [], fetchImpl: async () => { requests++; return reject(unsupported); } }));
  assert.equal(requests, 1);
  await runModelTask({ connection: { ...base, toolProtocol: 'json' }, tools, messages: [], fetchImpl: async (_url, init) => { assert.equal(JSON.parse(init.body).tools, undefined); return jsonFinal(); } });
});

test('cancellation during fallback prevents another request or tool execution', async () => {
  const controller = new AbortController(); let requests = 0, executions = 0;
  await assert.rejects(runModelTask({ connection: base, signal: controller.signal, tools, messages: [], executeTool: async () => { executions++; },
    fetchImpl: async () => { requests++; controller.abort(); return reject(unsupported); } }));
  assert.equal(requests, 1); assert.equal(executions, 0);
});

test('a rejection after native tool execution never changes channel or replays the tool', async () => {
  let requests = 0, executions = 0;
  await assert.rejects(runModelTask({ connection: base, tools, messages: [], executeTool: async () => { executions++; return { ok: true }; },
    fetchImpl: async () => { requests++; return requests === 1 ? nativeCall() : reject(unsupported); } }));
  assert.equal(requests, 2); assert.equal(executions, 1);
});

test('plain advisor output never enters a tool protocol even with auto selected', async () => {
  const result = await runModelTask({ connection: base, tools: [], messages: [], fetchImpl: async (_url, init) => { const body = JSON.parse(init.body); assert.equal(body.tools, undefined); assert.equal(body.messages.length, 0); return reply({ content: '{"verdict":"ready"}' }); } });
  assert.equal(result.text, '{"verdict":"ready"}');
});

test('malformed JSON after switching stops without executing or falling back again', async () => {
  let requests = 0, executions = 0;
  await assert.rejects(runModelTask({ connection: base, tools, messages: [], executeTool: async () => { executions++; },
    fetchImpl: async () => { requests++; return requests === 1 ? reject(unsupported) : reply({ content: 'not JSON' }); } }), /兼容/);
  assert.equal(requests, 2); assert.equal(executions, 0);
});
