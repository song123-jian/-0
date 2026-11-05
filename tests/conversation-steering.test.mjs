import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { insertSteeringMessage, updateSteeringStatus, settleSteeringMessages, steeringLabel, includesModelHistory } from '../src/lib/conversation-steering.js';
const { normalizeLibrary } = createRequire(import.meta.url)('../electron/conversations.cjs');
const requestId = 'c48b5d76-15c2-4e25-9edb-275cd85c3ba2';
const id = '34436172-5ca0-44cd-aeca-7321f5c9bfd6';
const second = '847c089a-5fe3-4d19-a1a7-cf6b2d8e6d5b';
const initial = () => [{ id: 'original-user', role: 'user', content: '原任务' }, { id: requestId, role: 'assistant', content: '正在处理', pending: true }];
const insert = (messages = initial(), steeringId = id, text = '补充：保留原数据') => insertSteeringMessage(messages, { requestId, steeringId, text });

test('running supplements remain visible exactly once above the original continuing answer', () => {
  const before = initial(), messages = insert(before);
  assert.deepEqual(messages.map(m => m.id), ['original-user', id, requestId]);
  assert.equal(messages[1].content, '补充：保留原数据');
  assert.equal(messages[2], before[1]);
  assert.equal(insert(messages), messages);
  assert.deepEqual(before, initial());
  assert.throws(() => insert([]), /引导未发送/);
});

test('an accepted event arriving before the queued event and IPC reply cannot regress receipt state', () => {
  let messages = insert();
  messages = updateSteeringStatus(messages, requestId, id, 'accepted');
  messages = updateSteeringStatus(messages, requestId, id, 'queued');
  messages = updateSteeringStatus(messages, requestId, id, 'failed');
  assert.equal(messages[1].steering.status, 'accepted');
  assert.match(steeringLabel(messages[1]), /模型已接收/);
  assert.equal(includesModelHistory(messages[1]), true);
});

test('multiple supplements preserve user order, isolate requests, and settle only unreceived entries', () => {
  let messages = insert(insert(), second, '再补充一条');
  messages = updateSteeringStatus(messages, 'other-request', id, 'accepted');
  assert.equal(messages[1].steering.status, 'submitting');
  messages = updateSteeringStatus(messages, requestId, id, 'accepted');
  messages = updateSteeringStatus(messages, requestId, second, 'queued');
  messages = settleSteeringMessages(messages, requestId);
  assert.deepEqual(messages.filter(m => m.steering).map(m => [m.id, m.steering.status]), [[id, 'accepted'], [second, 'expired']]);
  assert.match(steeringLabel(messages[2]), /本次未采用/);
  assert.equal(updateSteeringStatus(messages, requestId, second, 'accepted')[2].steering.status, 'expired');
});

test('rejected and expired supplements remain readable but do not silently enter later requests', () => {
  let messages = updateSteeringStatus(insert(), requestId, id, 'failed');
  assert.match(steeringLabel(messages[1]), /未发送/);
  assert.equal(messages[1].content, '补充：保留原数据');
  assert.deepEqual(messages.filter(includesModelHistory).map(m => m.id), ['original-user', requestId]);
  messages = settleSteeringMessages(messages, requestId);
  assert.equal(messages[1].steering.status, 'failed');
});

test('history normalization keeps accepted supplements and marks interrupted pending submissions unused', () => {
  const messages = updateSteeringStatus(insert(insert(), second, '稍后补充'), requestId, id, 'accepted');
  const chat = normalizeLibrary({ conversations: [{ id: 'chat', messages }], activeId: 'chat' }).conversations[0];
  assert.equal(chat.messages[1].steering.status, 'accepted');
  assert.equal(chat.messages[2].steering.status, 'expired');
  assert.equal(chat.messages[3].cancelled, true);
  assert.deepEqual(chat.messages.filter(includesModelHistory).map(m => m.id), ['original-user', id, requestId]);
});

test('malformed persisted receipt metadata never creates a false received badge', () => {
  const library = normalizeLibrary({ conversations: [{ id: 'chat', messages: [{ id, role: 'user', content: '旧消息', steering: { id: 'bad', requestId, status: 'accepted' } }] }] });
  assert.equal(library.conversations[0].messages[0].steering, undefined);
  assert.equal(steeringLabel(library.conversations[0].messages[0]), '');
});
