import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';
const require = createRequire(import.meta.url);
const { normalizePreferences } = require('../electron/preferences.cjs');
const { normalizeAddress } = require('../electron/panel-browser.cjs');

test('legacy and malformed preferences get readable safe defaults', () => {
  for (const value of [undefined, null, [], 1]) {
    const defaults = normalizePreferences(value);
    assert.deepEqual(defaults, normalizePreferences());
    assert.equal(defaults.defaultMode, 'answer');
    assert.equal(defaults.railCollapsed, false);
    assert.equal(defaults.browserPanelOpen, true);
    assert.equal(defaults.browserPanelExpanded, false);
    assert.equal(defaults.fontSize, 16);
    assert.equal(defaults.contextAccess, 'manual');
  }
  assert.equal(normalizePreferences({ fontSize: 9 }).fontSize, 16);
  assert.equal(normalizePreferences({ fontSize: '20' }).fontSize, 16);
  const saved = normalizePreferences({ defaultMode: 'code', fontSize: 20, browserPanelOpen: false });
  assert.equal(saved.defaultMode, 'code');
  assert.equal(saved.fontSize, 20);
  assert.equal(saved.browserPanelOpen, false);
});
test('browser accepts web addresses, ports and search while rejecting privileged protocols', () => {
  assert.equal(normalizeAddress('example.com/docs'), 'https://example.com/docs');
  assert.equal(normalizeAddress('localhost:4178/path'), 'https://localhost:4178/path');
  assert.equal(normalizeAddress('http://127.0.0.1:1000/'), 'http://127.0.0.1:1000/');
  assert.equal(new URL(normalizeAddress('微软雅黑 字号')).searchParams.get('q'), '微软雅黑 字号');
  for (const value of ['', 'file:///C:/Windows/win.ini', 'javascript:alert(1)', 'data:text/html,hi',
    'https://user:password@example.com', 'https://', 'x'.repeat(4097)]) {
    assert.throws(() => normalizeAddress(value), Error);
  }
});
