import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
const require = createRequire(import.meta.url);
const { readCompletion, runModelTask } = require('../electron/agent-runtime.cjs');
const connection = { endpoint: 'http://127.0.0.1/v1/chat/completions', model: 'fixture', apiKey: 'test-only', retryLimit: 1, reportUsage: true };
test('usage-only SSE chunk is retained without adding fields to model messages', async () => {
  let usage;
  const body = [{ choices: [{ delta: { content: '完成' }, finish_reason: 'stop' }] }, { choices: [], usage: { prompt_tokens: 40, completion_tokens: 12, total_tokens: 52 } }].map(x => `data: ${JSON.stringify(x)}\n\n`).join('') + 'data: [DONE]\n\n';
  const message = await readCompletion(new Response(body), { onUsage: value => { usage = value; } });
  assert.equal(message.content, '完成'); assert.equal(usage.totalTokens, 52); assert.equal(message.usage, undefined);
});
test('transient HTTP failure retries once and emits actual usage and attempts', async () => {
  let count = 0; const events = [];
  const result = await runModelTask({ connection, messages: [], emit: e => events.push(e), retryDelayMs: 1, fetchImpl: async (_url, init) => {
    assert.equal(JSON.parse(init.body).stream_options.include_usage, true);
    if (++count === 1) return new Response('', { status: 503 });
    return Response.json({ choices: [{ message: { content: '完成' } }], usage: { prompt_tokens: 5, completion_tokens: 7, total_tokens: 12 } });
  } });
  assert.equal(count, 2); assert.equal(result.usage.totalTokens, 12);
  assert.equal(events.filter(e => e.type === 'request-metrics').length, 2);
});
test('authentication failures and partial streams are never retried', async () => {
  for (const type of ['auth', 'partial']) {
    let count = 0;
    await assert.rejects(runModelTask({ connection, messages: [], retryDelayMs: 1, fetchImpl: async () => {
      count++; return type === 'auth' ? new Response('', { status: 401 }) : new Response('data: {"choices":[{"delta":{"content":"部分"}}]}\n\n');
    } })); assert.equal(count, 1);
  }
});
test('usage ledger persists bounded metadata only, with unknown usage kept distinct', async t => {
  const { createUsageLedger } = require('../electron/model-usage.cjs');
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'scodex-usage-')); t.after(() => fs.rm(root, { recursive: true, force: true }));
  const file = path.join(root, 'usage.json'); const ledger = createUsageLedger(file);
  await ledger.record({ model: 'fixture', status: 'succeeded', durationMs: 25, usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 }, prompt: 'private', apiKey: 'secret' });
  await ledger.record({ model: 'fixture', status: 'failed', durationMs: 5 });
  const stats = await createUsageLedger(file).get();
  assert.equal(stats.requests, 2); assert.equal(stats.unknownUsage, 1); assert.equal(stats.totalTokens, 30);
  assert.doesNotMatch(await fs.readFile(file, 'utf8'), /private|secret/);
});

test('usage ledger persists independent proposal and review stages', async t => {
  const { createUsageLedger } = require('../electron/model-usage.cjs');
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'scodex-debate-usage-')); t.after(() => fs.rm(root, { recursive: true, force: true }));
  const file = path.join(root, 'usage.json'); const ledger = createUsageLedger(file);
  for (const stage of ['debate-proposal', 'debate-review']) await ledger.record({
    model: 'fixture', role: 'advisor', stage, status: 'succeeded', durationMs: 10,
    usage: { inputTokens: 4, outputTokens: 3, totalTokens: 7 },
  });
  const records = (await createUsageLedger(file).get()).records;
  assert.deepEqual(records.map(record => record.stage), ['debate-review', 'debate-proposal']);
  assert.ok(records.every(record => record.role === 'advisor'));
});
