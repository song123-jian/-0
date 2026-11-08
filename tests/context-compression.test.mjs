import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { compressContext, groupMessages } = require('../electron/context-compression.cjs');

test('compresses an oversized current request while retaining system rules and task evidence', () => {
  const system = { role: 'system', content: 'System rules must remain byte-for-byte intact.' };
  const marker = 'Current task: fix E:\\repo\\src\\auth.cjs; prior Error: permission denied must be reviewed.';
  const user = { role: 'user', content: ['Please resolve this task.', ...Array.from({ length: 1200 }, (_, index) => `background detail ${index} ${'x'.repeat(28)}`), marker].join('\n') };

  const result = compressContext([system, user], { contextWindowTokens: 180 });

  assert.equal(result.messages[0].content, system.content);
  assert.ok(result.compressed);
  assert.ok(result.finalTokens <= result.capacityTokens);
  assert.match(result.messages[1].content, /Please resolve this task/);
  assert.ok(result.messages[1].content.includes(marker));
  assert.equal(result.overBudget, false);
});

test('keeps tool calls and matching results as one context unit', () => {
  const messages = [
    { role: 'assistant', content: null, tool_calls: [{ id: 'call-1', type: 'function', function: { name: 'read_file', arguments: '{"path":"E:\\\\repo\\\\src\\\\auth.cjs"}' } }] },
    { role: 'tool', tool_call_id: 'call-1', content: 'Error: access denied\npath: E:\\repo\\src\\auth.cjs\n' + 'detail '.repeat(500) },
    { role: 'user', content: 'Please fix the current task.' },
  ];

  assert.deepEqual(groupMessages(messages), [[0, 1], [2]]);
  const result = compressContext(messages, { contextWindowTokens: 160 });
  assert.deepEqual(groupMessages(result.messages), [[0, 1], [2]]);
  assert.equal(result.messages[0].tool_calls[0].id, result.messages[1].tool_call_id);
  assert.match(result.messages[1].content, /Error: access denied/);
  assert.match(result.messages[1].content, /E:\\repo\\src\\auth\.cjs/);
});

test('reports when required path and error evidence cannot fit instead of silently dropping it', () => {
  const evidence = Array.from({ length: 80 }, (_, index) =>
    'Error: access denied at E:\\repo\\src\\file-' + index + '.cjs'
  ).join('\n');
  const result = compressContext([
    { role: 'system', content: 'System policy remains intact.' },
    { role: 'user', content: 'Current request: fix the access failure.' },
    { role: 'tool', tool_call_id: 'call-1', content: evidence },
  ], { contextWindowTokens: 150, preserveMessageIndices: [1] });

  assert.equal(result.messages[1].content, 'Current request: fix the access failure.');
  assert.equal(result.preservationOverflow, true);
  assert.equal(result.overBudget, true);
});
