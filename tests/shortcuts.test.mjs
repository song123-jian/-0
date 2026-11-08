import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_SHORTCUTS, formatShortcut, matchesShortcut, normalizeShortcut, normalizeShortcuts, shortcutFromEvent } from '../src/lib/shortcuts.js';

test('shortcut normalization uses the configured defaults for invalid values', () => {
  assert.equal(normalizeShortcut('shift + ctrl + p'), 'Ctrl+Shift+P');
  assert.equal(normalizeShortcut('Ctrl+Ctrl+P', 'Ctrl+S'), 'Ctrl+S');
  assert.deepEqual(normalizeShortcuts({ newChat: 'Alt+N', files: 'invalid' }), { ...DEFAULT_SHORTCUTS, newChat: 'Alt+N' });
});

test('shortcut matching is exact and treats Command as Ctrl', () => {
  assert.equal(matchesShortcut({ key: 'p', ctrlKey: false, metaKey: true, shiftKey: true, altKey: false }, 'Ctrl+Shift+P'), true);
  assert.equal(matchesShortcut({ key: 'p', ctrlKey: true, metaKey: false, shiftKey: false, altKey: false }, 'Ctrl+Shift+P'), false);
  assert.equal(shortcutFromEvent({ key: ' ', ctrlKey: true }), 'Ctrl+Space');
  assert.equal(formatShortcut('Alt+ArrowLeft'), 'Alt+←');
});
