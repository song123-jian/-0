import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { snapshot, mergeSnapshots } = require('../electron/sync-snapshot.cjs');
const chat = (id, content) => ({ id, title: id, createdAt: '2026-11-01T00:00:00Z', updatedAt: '2026-11-01T00:00:00Z', messages: [{ id: id + '-msg', role: 'user', content }] });
const data = entries => ({ library: { version: 2, activeId: entries[0]?.id, conversations: entries }, preferences: {} });
test('independent device additions merge and simultaneous edits preserve both', () => {
  const base = data([chat('same', 'base')]);
  const merged = mergeSnapshots(base, data([chat('same', 'local'), chat('a', 'A')]), data([chat('same', 'remote'), chat('b', 'B')]));
  assert.equal(merged.conflicts, 1); assert.equal(merged.snapshot.library.conversations.length, 4);
  assert.ok(merged.snapshot.library.conversations.some(c => c.messages[0].content === 'remote'));
  assert.equal(mergeSnapshots(merged.snapshot, merged.snapshot, merged.snapshot).conflicts, 0);
});
test('unchanged remote accepts deletion; delete versus edit retains edited data', () => {
  const base = data([chat('keep', 'keep'), chat('removed', 'old')]);
  const local = data([chat('keep', 'keep')]);
  assert.equal(mergeSnapshots(base, local, base).snapshot.library.conversations.length, 1);
  assert.equal(mergeSnapshots(base, local, data([chat('keep','keep'),chat('removed','new')])).snapshot.library.conversations.length, 2);
});
test('portable snapshot excludes credentials, permission settings and project bindings', () => {
  const s = data([{ ...chat('id', 'body'), projectId: 'machine-project' }]);
  s.preferences = { fontSize: 18, contextAccess: 'manual', apiKey: 'secret' };
  const result = snapshot(s); assert.deepEqual(result.preferences, { fontSize: 18 });
  assert.equal(result.library.conversations[0].projectId, undefined);
  assert.throws(() => snapshot({ library: {} }), /有效聊天库/);
});
