import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { messageContentParts } from '../src/lib/message-presentation.js';

const require = createRequire(import.meta.url);
const { runModelTask } = require('../electron/agent-runtime.cjs');
const { DEFAULT_CONNECTION, normalizeConnection } = require('../electron/model-connection.cjs');
const { normalizeLibrary } = require('../electron/conversations.cjs');
const connection = { endpoint: 'http://127.0.0.1/v1/chat/completions', model: 'fixture', apiKey: 'fixture', retryLimit: 6 };
const reply = message => Response.json({ choices: [{ message }] });
const task = options => runModelTask({ connection, messages: [], retryDelayMs: 1, ...options });
const tools = [{ type: 'function', function: { name: 'read_file', parameters: { type: 'object' } } }];
const toolMessage = { content: '先检查文件。', tool_calls: [{ id: 'read', type: 'function', function: { name: 'read_file', arguments: '{}' } }] };

test('six retries recover on request seven across all allowed transient statuses', async () => {
  let calls = 0; const events = [];
  const result = await task({ emit: event => events.push(event), fetchImpl: async () => ++calls <= 6
    ? new Response('', { status: [429, 502, 503, 504][(calls - 1) % 4] }) : reply({ content: '完成' }) });
  assert.equal(calls, 7); assert.equal(result.text, '完成');
  assert.equal(events.filter(event => event.type === 'phase' && event.phase === 'retry').length, 6);
  assert.equal(events.filter(event => event.type === 'request-metrics').length, 7);
});

test('six is a hard retry ceiling and lower or disabled selections remain honored', async () => {
  for (const [limit, expected] of [[0, 1], [1, 2], [2, 3], [6, 7], [999, 7]]) {
    let calls = 0;
    await assert.rejects(task({ connection: { ...connection, retryLimit: limit }, fetchImpl: async () => {
      calls++; return new Response('', { status: 503 });
    } }), /HTTP 503/);
    assert.equal(calls, expected);
  }
  assert.equal(normalizeConnection(DEFAULT_CONNECTION).retryLimit, 6);
  for (let limit = 0; limit <= 6; limit++) assert.equal(normalizeConnection({ ...DEFAULT_CONNECTION, retryLimit: limit }).retryLimit, limit);
  assert.equal(normalizeConnection({ ...DEFAULT_CONNECTION, retryLimit: 999 }).retryLimit, 6);
});

test('authentication, other statuses, transport failure and partial streams never retry', async () => {
  const failures = [
    ...[400, 401, 403, 404, 500].map(status => () => new Response('', { status })),
    () => Response.json({ error: { message: 'Upstream authentication failed' } }, { status: 502 }),
    () => Response.json({ error: { code: 'invalid_api_key' } }, { status: 503 }),
    () => new Response('data: {"choices":[{"delta":{"content":"部分内容"}}]}\n\n', { headers: { 'content-type': 'text/event-stream' } }),
    () => { throw new TypeError('fetch failed'); },
  ];
  for (const failure of failures) {
    let calls = 0;
    await assert.rejects(task({ fetchImpl: async () => { calls++; return failure(); } }));
    assert.equal(calls, 1);
  }
});

test('cancelling retry backoff prevents the next request', async () => {
  const controller = new AbortController(); let calls = 0;
  await assert.rejects(task({ signal: controller.signal, emit: event => {
    if (event.type === 'phase' && event.phase === 'retry') controller.abort();
  }, fetchImpl: async () => { calls++; return new Response('', { status: 429 }); } }), /停止/);
  assert.equal(calls, 1);
});

test('a service failure after returned text or a tool result stops without replay', async () => {
  for (const withTool of [false, true]) {
    let calls = 0, effects = 0;
    await assert.rejects(task({ tools: withTool ? tools : undefined, goal: withTool ? null : {}, maxRounds: 3,
      executeTool: async () => { effects++; return { ok: true }; }, fetchImpl: async () => ++calls === 1
        ? reply(withTool ? toolMessage : { content: '已返回的进展' }) : new Response('', { status: 504 }),
    }), /HTTP 504/);
    assert.equal(calls, 2); assert.equal(effects, withTool ? 1 : 0);
  }
});

test('recorded final-answer boundary survives history normalization without losing source content', async () => {
  let calls = 0;
  const result = await task({ tools, executeTool: async () => ({ ok: true }), fetchImpl: async () =>
    reply(++calls === 1 ? toolMessage : { content: '最后答复。' }) });
  assert.equal(result.text, '先检查文件。\n\n最后答复。');
  const message = { id: 'answer', role: 'assistant', content: result.text, finalContentOffset: result.finalContentOffset };
  const saved = normalizeLibrary({ conversations: [{ id: 'chat', messages: [message] }] }).conversations[0].messages[0];
  assert.equal(saved.content, result.text);
  assert.deepEqual(messageContentParts(saved), { activity: '先检查文件。', answer: '最后答复。' });
  for (const offset of [-1, 1.5, result.text.length, 99999]) {
    assert.deepEqual(messageContentParts({ ...message, finalContentOffset: offset }), { activity: '', answer: result.text });
  }
});

test('streamed progress and failed/cancelled partial answers remain readable', () => {
  const message = { content: '仍在工作', finalContentOffset: 2 };
  assert.deepEqual(messageContentParts({ ...message, pending: true }), { activity: '仍在工作', answer: '' });
  for (const state of [{ error: '失败' }, { cancelled: true }]) {
    assert.deepEqual(messageContentParts({ ...message, ...state }), { activity: '', answer: '仍在工作' });
  }
});
