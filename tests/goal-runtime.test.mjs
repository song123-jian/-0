import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { runModelTask } = require('../electron/agent-runtime.cjs');
const { normalizeLibrary } = require('../electron/conversations.cjs');
const connection = { endpoint: 'http://127.0.0.1', apiKey: 'fixture', model: 'fixture' };
test('explicit goal continues after interim answer then stops at evidence-bearing finish', async () => {
  let calls = 0;
  const result = await runModelTask({ connection, messages: [], tools: [], goal: { maxRequests: 4 }, fetchImpl: async () => {
    calls++;
    return Response.json({ choices: [{ message: calls === 1 ? { content: '继续检查' } : { tool_calls: [{ id: 'finish', type: 'function', function: { name: 'goal_finish', arguments: JSON.stringify({ status: 'completed', summary: '已完成', evidence: '已回读结果' }) } }] } }] });
  } });
  assert.equal(calls, 2); assert.equal(result.goalStatus, 'completed'); assert.match(result.text, /已完成/);
});
test('goal ignores a legacy request budget and continues until an evidence-bearing finish', async () => {
  let calls = 0;
  const result = await runModelTask({ connection, messages: [], goal: { maxRequests: 1 }, fetchImpl: async () => { calls++; return Response.json({ choices: [{ message: calls === 1 ? { content: '仍在处理' } : { tool_calls: [{ id: 'finish', type: 'function', function: { name: 'goal_finish', arguments: JSON.stringify({ status: 'completed', summary: '已完成', evidence: '已回读结果' }) } }] } }] }); } });
  assert.equal(calls, 2); assert.equal(result.goalStatus, 'completed');
});
test('ordinary chat does not silently enter a goal loop', async () => {
  let calls = 0;
  await runModelTask({ connection, messages: [], fetchImpl: async () => { calls++; return Response.json({ choices: [{ message: { content: '回答' } }] }); } });
  assert.equal(calls, 1);
});
test('restart changes persisted running goal to paused', () => {
  const result = normalizeLibrary({ conversations: [{ id: 'goal', goal: '完成文件', goalRun: { status: 'running', rounds: 2, maxRequests: 8, minutes: 10 }, messages: [] }] });
  assert.equal(result.conversations[0].goalRun.status, 'paused'); assert.equal(result.conversations[0].goalRun.rounds, 2);
});
