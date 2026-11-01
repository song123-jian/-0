import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createCdpEventCache, LIMITS } = require('../electron/browser-cdp-cache.cjs');

test('CDP cache uses the expanded per-tab, global, event, parameter, result, and page limits', () => {
  assert.equal(LIMITS.parameterBytes, 4 * 1024 * 1024);
  assert.equal(LIMITS.resultBytes, 4 * 1024 * 1024);
  assert.equal(LIMITS.eventsPerTab, 10000);
  assert.equal(LIMITS.eventBytes, 8 * 1024 * 1024);
  assert.equal(LIMITS.totalEventBytes, 64 * 1024 * 1024);
  assert.equal(LIMITS.pageEvents, 1000);
});

test('default 64 MiB budget evicts the globally oldest event across AI tabs', () => {
  const cache = createCdpEventCache();
  const first = cache.createState();
  const second = cache.createState();
  const payload = 'x'.repeat(LIMITS.eventBytes - 256);
  for (let index = 0; index < 4; index++) cache.append(first, 'Runtime.event', { payload });
  for (let index = 0; index < 5; index++) cache.append(second, 'Runtime.event', { payload });
  assert.equal(first.events.length, 3);
  assert.equal(second.events.length, 5);
  assert.equal(first.droppedBefore, 1);
  assert.ok(cache.stats().totalBytes <= LIMITS.totalEventBytes);
  assert.ok(cache.stats().totalBytes > LIMITS.totalEventBytes - LIMITS.eventBytes);
  cache.release(first);
  cache.release(second);
  assert.equal(cache.stats().totalBytes, 0);
});

test('events above 8 MiB retain explicit truncation metadata and an advancing cursor', () => {
  const cache = createCdpEventCache();
  const state = cache.createState();
  cache.append(state, 'Runtime.event', { value: 'x'.repeat(LIMITS.eventBytes + 1) });
  const page = cache.page(state);
  assert.equal(page.events[0].truncated, true);
  assert.ok(page.events[0].original_bytes > LIMITS.eventBytes);
  assert.equal(page.next_after, 1);
  assert.equal(page.has_more, false);
  assert.ok(Buffer.byteLength(JSON.stringify(page)) < LIMITS.resultBytes);
  cache.release(state);
});

test('default CDP cache retains the latest 10,000 events per AI tab', () => {
  const cache = createCdpEventCache();
  const state = cache.createState();
  for (let index = 0; index <= LIMITS.eventsPerTab; index++) cache.append(state, 'Page.event', { index });
  assert.equal(state.events.length, LIMITS.eventsPerTab);
  assert.equal(state.events[0].id, 2);
  assert.equal(state.events.at(-1).id, LIMITS.eventsPerTab + 1);
  assert.equal(state.droppedBefore, 1);
  cache.release(state);
  assert.equal(cache.stats().totalBytes, 0);
});

test('CDP event cache evicts oldest events per tab and across tabs, then releases bytes on cleanup', () => {
  const cache = createCdpEventCache({ eventsPerTab: 2, eventBytes: 1024, totalEventBytes: 180 });
  const first = cache.createState();
  const second = cache.createState();
  cache.append(first, 'Page.first', { value: 'a'.repeat(16) });
  cache.append(first, 'Page.second', { value: 'b'.repeat(16) });
  cache.append(first, 'Page.third', { value: 'c'.repeat(16) });
  assert.equal(first.events.length, 2);
  assert.equal(first.droppedBefore, 1);
  cache.append(second, 'Runtime.first', { value: 'd'.repeat(16) });
  assert.ok(cache.stats().totalBytes <= 180);
  assert.equal(first.droppedBefore, 2);
  const firstPage = cache.page(first, { after: 2, limit: 2 });
  assert.deepEqual(firstPage.events.map((event) => event.id), [3]);
  assert.equal(firstPage.has_more, false);
  assert.equal(firstPage.has_gap, false);
  const stalePage = cache.page(first, { after: 0, limit: 2 });
  assert.equal(stalePage.has_gap, true);
  cache.release(first);
  assert.ok(cache.stats().totalBytes < 180);
  cache.release(second);
  assert.deepEqual(cache.stats(), { totalBytes: 0, states: 0 });
});

test('CDP event pages are ordered by cursor and bounded by both event count and bytes', () => {
  const cache = createCdpEventCache({ eventsPerTab: 10, eventBytes: 4096, totalEventBytes: 16384, pageEvents: 2, pageBytes: 550 });
  const state = cache.createState();
  for (let index = 0; index < 5; index++) cache.append(state, 'Page.event', { index, value: 'x'.repeat(80) });
  const first = cache.page(state, { after: 0, limit: 10 });
  assert.ok(first.events.length <= 2);
  assert.equal(first.has_more, true);
  assert.equal(first.next_after, first.events.at(-1).id);
  assert.ok(Buffer.byteLength(JSON.stringify(first), 'utf8') <= 550);
  const second = cache.page(state, { after: first.next_after, limit: 10 });
  assert.ok(second.events[0].id > first.next_after);
  assert.equal(second.next_after, second.events.at(-1).id);
  cache.release(state);
});
