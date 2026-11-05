import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { createSteeringQueue } = require('../electron/steering-queue.cjs');
const { runModelTask } = require('../electron/agent-runtime.cjs');

const stream = (chunks) => new Response(chunks.map((chunk) => `data: ${JSON.stringify({ choices: [{ delta: chunk }] })}\n\n`).join('') + 'data: [DONE]\n\n', { headers: { 'content-type': 'text/event-stream' } });

test('steering queue validates, drains once, and expires after close', () => {
  const queue = createSteeringQueue();
  assert.equal(queue.enqueue({ id: 's1', text: '继续检查结果' }), true);
  assert.deepEqual(queue.drain(), [{ id: 's1', text: '继续检查结果' }]);
  assert.deepEqual(queue.drain(), []);
  assert.throws(() => queue.enqueue({ id: 's4', text: ' ' }), /引导内容/);
  queue.enqueue({ id: 's2', text: '不要重复写入' });
  assert.deepEqual(queue.close(), [{ id: 's2', text: '不要重复写入' }]);
  assert.throws(() => queue.enqueue({ id: 's3', text: '已结束' }), /已结束/);
});

test('runtime injects steering at the next model request boundary and acknowledges it', async () => {
  const queue = createSteeringQueue();
  const requests = [], events = [];
  const result = await runModelTask({
    connection: { endpoint: 'http://fixture', model: 'fixture', apiKey: 'fixture' },
    messages: [{ role: 'user', content: '执行任务' }],
    takeSteering: () => queue.drain(),
    emit: event => events.push(event),
    fetchImpl: async (_url, init) => {
      const body = JSON.parse(init.body); requests.push(body);
      if (requests.length === 1) queue.enqueue({ id: 's1', text: '请在下一轮先核对已有结果' });
      return stream(requests.length === 1
        ? [{ tool_calls: [{ index: 0, id: 'call_1', type: 'function', function: { name: 'read_file', arguments: '{}' } }] }, { content: '' }, { content: '' }]
        : [{ content: '已按引导核对结果。' }, { content: '' }]);
    },
    tools: [{ type: 'function', function: { name: 'read_file', parameters: { type: 'object' } } }],
    executeTool: async () => ({ ok: true, output: '结果' }),
  });
  assert.equal(result.text, '已按引导核对结果。');
  assert.equal(requests.length, 2);
  assert.match(JSON.stringify(requests[1].messages), /请在下一轮先核对已有结果/);
  assert.deepEqual(events.filter(event => event.type === 'steering-accepted').map(event => event.steeringId), ['s1']);
});

test('several running supplements are injected in order once without replaying a tool', async () => {
  const queue = createSteeringQueue(), requests = [], events = [];
  let effects = 0;
  await runModelTask({ connection: { endpoint: 'http://fixture', model: 'fixture' }, messages: [{ role: 'user', content: '原始任务' }],
    takeSteering: () => queue.drain(), emit: event => events.push(event),
    tools: [{ type: 'function', function: { name: 'write_file', parameters: { type: 'object' } } }],
    executeTool: async () => { effects++; queue.enqueue({ id: 'first', text: '补充第一条' }); queue.enqueue({ id: 'second', text: '补充第二条' }); return { ok: true }; },
    fetchImpl: async (_url, init) => {
      const body = JSON.parse(init.body); requests.push(body);
      return stream(requests.length === 1 ? [{ tool_calls: [{ index: 0, id: 'write_once', type: 'function', function: { name: 'write_file', arguments: '{}' } }] }] : [{ content: '已整合补充' }]);
    },
  });
  assert.equal(effects, 1); assert.equal(requests.length, 2);
  assert.deepEqual(requests[1].messages.filter(m => m.role === 'user').map(m => m.content.split('\n').at(-1)), ['原始任务', '补充第一条', '补充第二条']);
  assert.deepEqual(events.filter(e => e.type === 'steering-accepted').map(e => e.steeringId), ['first', 'second']);
});
