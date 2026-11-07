import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
const require = createRequire(import.meta.url);
const { createChatRuns } = require('../electron/chat-runs.cjs');
const { withFileCommit } = require('../electron/file-commit.cjs');
const { createAgentTools } = require('../electron/agent-tools.cjs');
const { createConversation, normalizeLibrary } = require('../electron/conversations.cjs');

test('independent runs remain available without a global concurrency cap', () => {
  const runs = createChatRuns();
  runs.begin('a', 'chat-a'); runs.begin('b', 'chat-b'); runs.begin('c', 'chat-c'); runs.begin('d', 'chat-d');
  assert.throws(() => runs.begin('a', 'chat-e'), /此请求/);
  assert.throws(() => runs.begin('x', 'chat-b'), /此聊天/);
  assert.equal(runs.size(), 4);
  assert.equal(runs.finish('unknown'), false);
  runs.finish('b'); runs.begin('e', 'chat-e');
  assert.equal(runs.size(), 4);
  assert.throws(() => runs.begin('x', 'chat-a'), /此聊天/);
});

test('invalid identifiers never consume slots; standalone panel requests count', () => {
  const runs = createChatRuns();
  for (const value of [undefined, null, {}, '', '../x', 'x'.repeat(101)]) assert.throws(() => runs.begin(value, 'chat'), /标识/);
  assert.throws(() => runs.begin('valid', {}), /标识/);
  assert.equal(runs.size(), 0);
  runs.begin('panel'); runs.begin('a', 'chat-a'); runs.begin('b', 'chat-b'); runs.begin('c', 'chat-c');
  assert.equal(runs.size(), 4);
});

test('running conversations cannot be deleted or archived by history writes', () => {
  const runs = createChatRuns(); runs.begin('a', 'chat-a'); runs.begin('panel');
  assert.doesNotThrow(() => runs.assertRetained({ conversations: [{ id: 'chat-a' }] }));
  assert.throws(() => runs.assertRetained({ conversations: [] }), /不能删除或归档/);
  assert.throws(() => runs.assertRetained({ conversations: [{ id: 'chat-a', archivedAt: '2026-10-25' }] }), /不能删除或归档/);
  runs.finish('a'); assert.doesNotThrow(() => runs.assertRetained({ conversations: [] }));
});

test('unread background results survive normalization and can be acknowledged', () => {
  const chat = { ...createConversation(), unreadResult: true };
  const saved = normalizeLibrary({ activeId: chat.id, conversations: [chat] });
  assert.equal(saved.conversations[0].unreadResult, true);
  assert.deepEqual(normalizeLibrary(JSON.parse(JSON.stringify(saved))), saved);
  saved.conversations[0].unreadResult = false;
  assert.equal(normalizeLibrary(saved).conversations[0].unreadResult, false);
  assert.equal(normalizeLibrary({ conversations: [{ ...chat, unreadResult: 'true' }] }).conversations[0].unreadResult, false);
});

test('same canonical file commit is refused while independent files proceed', async () => {
  let release, entered;
  const started = new Promise(r => { entered = r; });
  const pending = withFileCommit(path.resolve('commit-a'), async () => { entered(); await new Promise(r => { release = r; }); return 'first'; });
  await started;
  await assert.rejects(withFileCommit(path.resolve('.', 'commit-a'), async () => 'second'), /另一个任务/);
  assert.equal(await withFileCommit(path.resolve('commit-b'), async () => 'other'), 'other');
  release(); assert.equal(await pending, 'first');
  assert.equal(await withFileCommit(path.resolve('commit-a'), async () => 'later'), 'later');
});

test('failed commit releases its lock', async () => {
  await assert.rejects(withFileCommit('failed-commit', async () => { throw Error('expected-failure'); }), /expected-failure/);
  assert.equal(await withFileCommit('failed-commit', async () => 'recovered'), 'recovered');
});

test('two actual model toolboxes cannot silently overwrite a shared file', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'scodex-chat-commits-'));
  const target = path.join(root, 'shared.txt');
  t.after(async () => { await fs.unlink(target); await fs.rmdir(root); });
  await fs.writeFile(target, '原始中文\r\n');
  const a = createAgentTools({ workspaceRoot: root }), b = createAgentTools({ workspaceRoot: root });
  const [ra, rb] = await Promise.all([a.execute('read_file', { path: 'shared.txt' }), b.execute('read_file', { path: 'shared.txt' })]);
  const results = await Promise.allSettled([
    a.execute('edit_file', { path: 'shared.txt', expected_hash: ra.hash, old_text: '原始中文', new_text: '任务A' }),
    b.execute('edit_file', { path: 'shared.txt', expected_hash: rb.hash, old_text: '原始中文', new_text: '任务B' }),
  ]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.match(results.find(r => r.status === 'rejected').reason.message, /另一个任务|变化|修改/);
  assert.match(await fs.readFile(target, 'utf8'), /^任务[AB]\r\n$/);
  assert.deepEqual(await fs.readdir(root), ['shared.txt']);
});
