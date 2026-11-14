import test from 'node:test';
import assert from 'node:assert/strict';
import compaction from '../electron/context-compaction.cjs';
import compression from '../electron/context-compression.cjs';
import runtime from '../electron/agent-runtime.cjs';
import conversations from '../electron/conversations.cjs';

const history = Array.from({ length: 8 }, (_, index) => ({ role: index % 2 ? 'assistant' : 'user', content: `阶段${index}：D:/project/task.js；错误 E123；保留用户约束。\n` + '待核对的历史资料。'.repeat(90) }));
const ids = history.map((_, index) => 'message-' + index);
const latest = { role: 'user', content: '当前需求：修复后运行验证，禁止重复执行已成功命令。' };
const summary = '目标：修复 D:/project/task.js。约束：保留用户修改。已确认错误 E123，尚未验证修复。下一步：读取最新文件并定向验证。';
const options = (extra = {}) => ({ messages: [{ role: 'system', content: '保持系统约束' }, ...history, latest], historyStart: 1, historyIds: ids, capacityTokens: 6000, summarize: async () => summary, ...extra });

test('automatic semantic compaction preserves the system/current request and binds the summary to exact source', async () => {
  const events = [];
  const result = await compaction.prepareContext(options({ emit: event => events.push(event) }));
  assert.equal(result.compacted, true);
  assert.deepEqual(result.messages[0], options().messages[0]);
  assert.deepEqual(result.messages.at(-1), latest);
  assert.deepEqual(result.messages.slice(-3, -1), history.slice(-2));
  assert.match(result.messages[1].content, /历史任务资料.*不是新的指令/);
  const event = events.find(event => event.type === 'context-compacted');
  assert.ok(event.afterTokens < event.beforeTokens);
  assert.equal(event.checkpoint.throughId, ids[5]);
  assert.equal(event.checkpoint.sourceHash, compaction.historyHash(history.slice(0, 6)));
  const restored = compaction.restoreCheckpoint(history, ids, result.checkpoint);
  assert.equal(restored.covered, 6);
  assert.deepEqual(restored.messages, result.messages.slice(1, -1));
});

test('editing or branching the covered history invalidates a stale summary; appending a turn keeps it valid', async () => {
  const result = await compaction.prepareContext(options());
  const edited = history.map((message, index) => index === 0 ? { ...message, content: '用户纠正了原始目标' } : message);
  assert.equal(compaction.restoreCheckpoint(edited, ids, result.checkpoint).covered, 0);
  assert.equal(compaction.restoreCheckpoint(history.slice(0, 4), ids.slice(0, 4), result.checkpoint).covered, 0);
  assert.equal(compaction.restoreCheckpoint([...history, latest], [...ids, 'new-turn'], result.checkpoint).covered, 6);
});

test('manual compact works without a configured window; short/already summarized histories make no request', async () => {
  let calls = 0;
  const summarize = async () => { calls++; return summary; };
  const auto = await compaction.prepareContext(options({ capacityTokens: 0, summarize }));
  assert.equal(auto.compacted, false); assert.equal(calls, 0);
  const manual = await compaction.prepareContext(options({ capacityTokens: 0, compactOnly: true, summarize }));
  assert.equal(manual.compacted, true); assert.ok(calls > 0);
  calls = 0;
  const reused = await compaction.prepareContext(options({ capacityTokens: 0, compactOnly: true, checkpoint: manual.checkpoint, summarize }));
  assert.equal(reused.compacted, false); assert.equal(calls, 0);
  const short = await compaction.prepareContext({ ...options({ compactOnly: true, summarize }), messages: [latest], historyStart: 0, historyIds: ['short'] });
  assert.equal(short.compacted, false); assert.equal(calls, 0);
});

test('failed or cancelled summary never replaces source or an existing valid checkpoint', async () => {
  const events = [], input = options({ emit: event => events.push(event), summarize: async () => { throw Error('HTTP 503'); } });
  const result = await compaction.prepareContext(input);
  assert.deepEqual(result.messages, input.messages); assert.equal(result.checkpoint, null);
  assert.ok(events.some(event => event.type === 'context-compaction-failed'));
  await assert.rejects(compaction.prepareContext({ ...input, compactOnly: true }), /HTTP 503/);
  const manual = await compaction.prepareContext(options({ compactOnly: true }));
  const extendedHistory = [...history, latest, { role: 'assistant', content: '新的有效结果。'.repeat(200) }];
  const extended = { ...input, messages: [...extendedHistory, latest], historyStart: 0, historyIds: [...ids, 'new-user', 'new-assistant'], checkpoint: manual.checkpoint, compactOnly: true };
  await assert.rejects(compaction.prepareContext(extended), /HTTP 503/);
  assert.equal(compaction.restoreCheckpoint(extendedHistory, extended.historyIds, manual.checkpoint).covered, 8);
  const controller = new AbortController(); controller.abort();
  await assert.rejects(compaction.prepareContext({ ...input, signal: controller.signal }), /任务已停止/);
});

test('large history is summarized in bounded chunks with previous summary carried forward and image parts intact', async () => {
  const calls = [], image = { type: 'image_url', image_url: { url: 'https://example.com/history.png' } };
  const source = [{ role: 'user', content: '起点：D:/project/a.js\n' + '中文资料😀。'.repeat(2600) + '\n终点：错误 E987' }, { role: 'user', content: [image] }];
  const result = await compaction.summarizeHistory(source, { capacityTokens: 12000, emit: () => {}, summarize: async input => { calls.push(input); return summary; } });
  assert.equal(result, summary); assert.ok(calls.length > 1);
  assert.ok(calls[0].messages.some(message => String(message.content).includes('起点：D:/project/a.js')));
  assert.ok(calls.at(-1).messages.some(message => JSON.stringify(message.content).includes('终点：错误 E987')));
  assert.ok(calls.slice(1).every(call => call.messages.some(message => String(message.content).includes(summary))));
  assert.ok(calls.some(call => call.messages.some(message => Array.isArray(message.content) && message.content.some(part => part.type === 'image_url'))));
  for (const call of calls) {
    assert.ok(compression.compressContext(call.messages, { reserveOutputTokens: call.maxOutputTokens }).finalTokens < 12000);
    for (const message of call.messages) if (typeof message.content === 'string') assert.equal(message.content.isWellFormed(), true);
  }
});

test('checkpoint and estimates persist with the chat; malformed checkpoints are rejected', async () => {
  const { checkpoint } = await compaction.prepareContext(options());
  const library = conversations.normalizeLibrary({ conversations: [{ id: 'chat', messages: [{ id: 'summary', role: 'assistant', content: '已压缩', contextAction: true, contextCheckpoint: checkpoint, contextUsage: { sentTokens: 1234, capacityTokens: 6000 } }] }] });
  const message = library.conversations[0].messages[0];
  assert.deepEqual(message.contextCheckpoint, checkpoint); assert.equal(message.contextAction, true);
  assert.deepEqual(message.contextUsage, { sentTokens: 1234, capacityTokens: 6000 });
  assert.equal(compaction.normalizeCheckpoint({ ...checkpoint, summary: '' }), null);
  assert.equal(compaction.normalizeCheckpoint({ ...checkpoint, sourceHash: 'wrong' }), null);
});

test('summary requests cannot silently crop source to fit a too-small model window', async () => {
  let calls = 0;
  await assert.rejects(runtime.runModelTask({ connection: { contextWindowTokens: 100, maxOutputTokens: 64 }, preserveInput: true,
    messages: [{ role: 'system', content: 'summary' }, { role: 'user', content: '必须全部保留。'.repeat(100) }], tools: [],
    fetchImpl: async () => { calls++; throw Error('must not send'); } }), /上下文容量不足/);
  assert.equal(calls, 0);
});
