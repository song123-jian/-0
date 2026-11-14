import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { MAX_VISUALIZATION_HTML_BYTES, MAX_WIDGET_STATE_BYTES, normalizeWidgetState } = require('../electron/visualization-contract.cjs');
const { createVisualizationTools } = require('../electron/visualization-tools.cjs');
const { createVisualizationDocuments } = require('../electron/visualization-documents.cjs');

test('visualization tool returns bounded self-contained HTML and JSON state as display activity', async () => {
  const tools = createVisualizationTools();
  const result = await tools.execute('visualize_render', { title: '趋势', html: '<canvas id="chart"></canvas>', widget_state: { selected: '2026-Q1' } });
  assert.equal(result.ok, true);
  assert.equal(result.activity.title, '交互图表');
  assert.equal(result.activity.visualization.title, '趋势');
  assert.deepEqual(result.activity.visualization.widgetState, { selected: '2026-Q1' });
  assert.match(result.activity.visualization.id, /^[0-9a-f-]{36}$/i);
});

test('visualization tool rejects oversized payloads, invalid state and a fourth chart', async () => {
  await assert.rejects(createVisualizationTools().execute('visualize_render', { title: ' ', html: '<p>x</p>' }), /标题/);
  await assert.rejects(createVisualizationTools().execute('visualize_render', { title: '大图', html: 'x'.repeat(MAX_VISUALIZATION_HTML_BYTES + 1) }), /128 KiB/);
  await assert.rejects(createVisualizationTools().execute('visualize_render', { title: '大状态', html: '<p>x</p>', widget_state: { value: 'x'.repeat(MAX_WIDGET_STATE_BYTES) } }), /16 KiB/);
  const tools = createVisualizationTools();
  for (let index = 0; index < 3; index += 1) await tools.execute('visualize_render', { title: '图' + index, html: '<p>x</p>' });
  await assert.rejects(tools.execute('visualize_render', { title: '第四图', html: '<p>x</p>' }), /最多生成 3 个图表/);
});

test('widget state rejects cycles, excessive nesting, unsafe keys and non-JSON values', () => {
  const cycle = {}; cycle.self = cycle;
  assert.equal(normalizeWidgetState(cycle), undefined);
  assert.equal(normalizeWidgetState({ constructor: 'unsafe' }), undefined);
  assert.equal(normalizeWidgetState({ value: Number.NaN }), undefined);
  assert.equal(normalizeWidgetState({ value: () => undefined }), undefined);
  let deep = 'leaf';
  for (let index = 0; index < 12; index += 1) deep = { child: deep };
  assert.equal(normalizeWidgetState(deep), undefined);
  assert.deepEqual(normalizeWidgetState({ valid: [1, true, null] }), { valid: [1, true, null] });
});

test('chart documents enforce unique capability URLs, nonce CSP, read-only access and revocation', async () => {
  const documents = createVisualizationDocuments();
  const input = { html: '<p>trend</p>', nonce: 'a'.repeat(32) };
  const url = documents.register(input), other = documents.register(input);
  assert.notEqual(url, other);
  assert.match(url, /^scodex-chart:\/\/view\/[a-f0-9]{64}$/);
  const response = documents.respond({ method: 'GET', url });
  assert.equal(response.status, 200);
  assert.equal(await response.text(), input.html);
  assert.match(response.headers.get('Content-Security-Policy'), /sandbox allow-scripts;.*script-src 'nonce-a{32}';/);
  assert.match(response.headers.get('Content-Security-Policy'), /connect-src 'none'/);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.equal(documents.respond({ method: 'POST', url }).status, 404);
  assert.equal(documents.respond({ method: 'GET', url: url + '?bypass=1' }).status, 404);
  assert.equal(documents.release(url), true);
  assert.equal(documents.respond({ method: 'GET', url }).status, 404);
  documents.clear();
  assert.equal(documents.respond({ method: 'GET', url: other }).status, 404);
});

test('chart document storage bounds count and bytes and recovers capacity after release', () => {
  const documents = createVisualizationDocuments({ maxEntries: 2, maxDocumentBytes: 10, maxTotalBytes: 12 });
  const input = { html: '123456', nonce: 'a'.repeat(32) };
  assert.throws(() => documents.register({ ...input, nonce: 'bad' }), /无效/);
  assert.throws(() => documents.register({ ...input, html: 'x'.repeat(11) }), /过大/);
  const url = documents.register(input);
  assert.throws(() => documents.register({ ...input, html: 'x'.repeat(7) }), /过多/);
  documents.register(input);
  assert.throws(() => documents.register(input), /过多/);
  documents.release(url);
  documents.register(input);
  documents.clear();
  documents.register(input);
});

test('navigation checks destinations without trusting a possibly detached source frame', () => {
  const documents = createVisualizationDocuments();
  const url = documents.register({ html: 'chart', nonce: 'a'.repeat(32) });
  assert.equal(documents.allowsNavigation({ url, isMainFrame: false }), true);
  assert.equal(documents.allowsNavigation({ url, isMainFrame: true }), false);
  for (const destination of ['data:text/html,probe', 'https://example.com/', 'file:///secret', 'about:blank', 'scodex-chart://view/unknown']) {
    assert.equal(documents.allowsNavigation({ url: destination, isMainFrame: false }), false);
  }
  assert.equal(documents.allowsNavigation({ url: 'about:srcdoc', isMainFrame: false, fromMainFrame: true }), true);
  assert.equal(documents.allowsNavigation({ url: 'about:srcdoc', isMainFrame: false, fromMainFrame: false }), false);
  documents.release(url);
  assert.equal(documents.allowsNavigation({ url, isMainFrame: false }), false);
});

test('request guard blocks external and local child documents only in the workbench window', () => {
  const documents = createVisualizationDocuments();
  const url = documents.register({ html: 'chart', nonce: 'a'.repeat(32) });
  const child = { resourceType: 'subFrame', webContentsId: 12 };
  assert.equal(documents.allowsRequest({ ...child, url }, 12), true);
  for (const destination of ['https://example.com/', 'http://127.0.0.1/probe', 'file:///secret', url + '?bypass']) {
    assert.equal(documents.allowsRequest({ ...child, url: destination }, 12), false);
    assert.equal(documents.allowsRequest({ ...child, url: destination, webContentsId: 13 }, 12), true);
  }
  assert.equal(documents.allowsRequest({ ...child, url: 'file:///app', resourceType: 'mainFrame' }, 12), true);
});
