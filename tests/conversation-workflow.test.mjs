import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { MAX_QUEUED_MESSAGES, queueText, createQueuedMessage, changeQueuedMessages, canImplementPlan } from '../src/lib/conversation-workflow.js';
import { forkChatRecord, forkChatAtMessage } from '../src/lib/conversation-actions.js';
const require = createRequire(import.meta.url);
const { normalizeLibrary } = require('../electron/conversations.cjs');
const selection = { mode: 'plan', modelMode: 'advisor', model: 'model-three', reasoningEffort: 'high', executionEnabled: false, scopeProjectId: 'project-one', workspaceRoot: 'D:\\project-one' };
const plan = () => ({ id: 'chat', title: '规划', draft: '保留草稿', messages: [{ id: 'user', role: 'user', content: '先做计划', mode: 'plan' }, { id: 'assistant', role: 'assistant', content: '先检查，再修改和验证。', mode: 'plan' }] });

test('queue entries capture their model, mode, permission and project without changing selections', () => {
  const before = structuredClone(selection), item = createQueuedMessage('  下一轮文字  ', selection);
  assert.equal(item.text, '下一轮文字');
  for (const key of Object.keys(selection)) assert.equal(item[key], selection[key]);
  assert.match(item.id, /^[a-f0-9-]{36}$/);
  assert.ok(Number.isFinite(Date.parse(item.createdAt)));
  assert.deepEqual(selection, before);
});

test('queue text rejects empty, NUL and overlong input while accepting the maximum size', () => {
  for (const value of ['', ' \n ', null, 'a\0b', 'a'.repeat(64001)]) assert.throws(() => queueText(value), /64000/);
  assert.equal(queueText('中'.repeat(64000)).length, 64000);
});

test('editing, sorting and removing queue entries preserve their captured execution scope', () => {
  const entries = ['一', '二', '三'].map(text => createQueuedMessage(text, selection)), original = structuredClone(entries);
  let next = changeQueuedMessages(entries, entries[0].id, 'edit', '第一条修改');
  assert.deepEqual(next[0], { ...entries[0], text: '第一条修改' });
  next = changeQueuedMessages(next, entries[0].id, 'down');
  assert.deepEqual(next.map(item => item.text), ['二', '第一条修改', '三']);
  next = changeQueuedMessages(next, entries[2].id, 'remove');
  assert.deepEqual(next.map(item => item.text), ['二', '第一条修改']);
  assert.equal(changeQueuedMessages(next, next[0].id, 'up'), next);
  assert.deepEqual(entries, original);
  assert.throws(() => changeQueuedMessages(next, 'missing', 'remove'), /已变化/);
  assert.throws(() => changeQueuedMessages(next, next[0].id, 'edit', ' '), /64000/);
});

test('queue save and reopen retain FIFO and draft but always pause pending execution', () => {
  const chat = { ...plan(), queuedMessages: ['一', '二'].map(text => createQueuedMessage(text, selection)), queuePaused: false };
  const saved = normalizeLibrary({ activeId: chat.id, conversations: [chat] });
  assert.equal(saved.conversations[0].queuePaused, true);
  assert.deepEqual(saved.conversations[0].queuedMessages, chat.queuedMessages);
  assert.equal(saved.conversations[0].draft, chat.draft);
  assert.deepEqual(normalizeLibrary(JSON.parse(JSON.stringify(saved))), saved);
});

test('persisted queues discard invalid and duplicate records and apply a bounded capacity', () => {
  const valid = createQueuedMessage('有效消息', selection);
  const input = [{ ...valid, text: '\0' }, { ...valid, model: 'bad model' }, valid, valid, ...Array.from({ length: 30 }, (_, index) => ({ ...valid, id: 'queued-' + index }))];
  const chat = normalizeLibrary({ conversations: [{ ...plan(), queuedMessages: input }] }).conversations[0];
  assert.equal(chat.queuedMessages.length, MAX_QUEUED_MESSAGES);
  assert.equal(new Set(chat.queuedMessages.map(item => item.id)).size, MAX_QUEUED_MESSAGES);
  assert.equal(chat.queuedMessages[0].text, '有效消息');
});

test('both conversation forks keep history while leaving source pending work in the source', () => {
  const source = { ...plan(), queuedMessages: [createQueuedMessage('源任务', selection)], queuePaused: false }, before = structuredClone(source);
  for (const fork of [forkChatRecord(source), forkChatAtMessage(source, 'assistant')]) {
    assert.equal(fork.queuedMessages, undefined);
    assert.equal(fork.queuePaused, true);
    assert.equal(fork.messages.length, source.messages.length);
  }
  assert.deepEqual(source, before);
});

test('only the latest successful completed plan offers implementation, including legacy plan answers', () => {
  const chat = plan();
  assert.equal(canImplementPlan(chat, 'assistant'), true);
  delete chat.messages[1].mode;
  assert.equal(canImplementPlan(chat, 'assistant'), true);
  chat.messages.push({ id: 'steer', role: 'user', content: '补充', steering: {} });
  assert.equal(canImplementPlan(chat, 'assistant'), false);
  for (const patch of [{ pending: true }, { error: '失败' }, { cancelled: true }, { content: ' ' }]) {
    const current = plan(); Object.assign(current.messages[1], patch);
    assert.equal(canImplementPlan(current, 'assistant'), false);
  }
  const answer = plan(); answer.messages.forEach(message => { message.mode = 'answer'; });
  assert.equal(canImplementPlan(answer, 'assistant'), false);
  assert.equal(canImplementPlan(plan(), 'missing'), false);
});
