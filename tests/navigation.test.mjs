import test from 'node:test';
import assert from 'node:assert/strict';
import { recordLocation, findLocation } from '../src/lib/navigation.js';
const initial = () => ({ entries: [], index: -1 });

test('navigation deduplicates visits and truncates the forward branch after a new destination', () => {
  let history = recordLocation(initial(), { view: 'assistant', chatId: 'one' });
  history = recordLocation(history, { view: 'files' }); history = recordLocation(history, { view: 'settings' });
  assert.equal(recordLocation(history, { view: 'settings' }), history);
  const previous = findLocation(history, -1); assert.equal(previous.location.view, 'files');
  history = { ...history, index: previous.index }; assert.equal(findLocation(history, 1).location.view, 'settings');
  history = recordLocation(history, { view: 'images' }); assert.equal(findLocation(history, 1), null); assert.deepEqual(history.entries.map((location) => location.view), ['assistant', 'files', 'images']);
});

test('navigation skips deleted or archived conversations, preserves boundaries and caps session history', () => {
  let history = initial(); for (const location of [{ view: 'assistant', chatId: 'one' }, { view: 'assistant', chatId: 'deleted' }, { view: 'settings' }]) history = recordLocation(history, location);
  const target = findLocation(history, -1, (location) => location.chatId !== 'deleted'); assert.equal(target.location.chatId, 'one');
  assert.equal(findLocation({ ...history, index: 0 }, -1), null); assert.equal(findLocation(history, 1), null);
  for (let i = 0; i < 150; i++) history = recordLocation(history, { view: 'assistant', chatId: 'chat-' + i });
  assert.equal(history.entries.length, 100); assert.equal(history.index, 99); assert.equal(history.entries[0].chatId, 'chat-50');
});
