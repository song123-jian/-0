import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { createConversation, normalizeLibrary } = require('../electron/conversations.cjs');
const { modeInstruction, safeHistory } = require('../electron/chat-policy.cjs');
const { modelMessageContent } = require('../electron/chat-images.cjs');

test('legacy messages migrate without losing content and acquire stable IDs after saving', () => {
  const library = normalizeLibrary([{ role: 'user', content: '旧对话 中文' }, { role: 'assistant', content: '答复' }]);
  assert.deepEqual(library.conversations[0].messages.map((item) => item.content), ['旧对话 中文', '答复']);
  assert.deepEqual(normalizeLibrary(JSON.parse(JSON.stringify(library))), library);
});

test('conversation round trip keeps selection, mode, drafts, names and failed or interrupted responses', () => {
  const first = createConversation('code');
  const second = { ...createConversation('office'), title: '报表', draft: '尚未发送', pinned: true,
    messages: [{ id: 'u1', role: 'user', content: '汇总', mode: 'office', contextName: '报表.csv' },
      { id: 'a1', role: 'assistant', content: '部分回答', pending: true, error: 'HTTP 503' }] };
  const library = normalizeLibrary({ activeId: second.id, conversations: [first, second] });
  assert.equal(library.activeId, second.id);
  assert.equal(library.conversations[1].draft, '尚未发送');
  assert.equal(library.conversations[1].mode, 'office');
  assert.equal(library.conversations[1].pinned, true);
  assert.equal(library.conversations[1].messages[1].cancelled, true);
  assert.equal(library.conversations[1].messages[1].error, 'HTTP 503');
});

test('project assignment survives normalization and keeps recent conversations scoped', () => {
  const library = normalizeLibrary({ conversations: [{ ...createConversation('answer'), projectId: 'project-second' }] });
  assert.equal(library.conversations[0].projectId, 'project-second');
  assert.deepEqual(normalizeLibrary(JSON.parse(JSON.stringify(library))), library);
  assert.equal(normalizeLibrary({ conversations: [{ ...createConversation(), projectId: '../outside' }] }).conversations[0].projectId, undefined);
});

test('conversation model and reasoning selections survive reload while invalid model IDs are discarded', () => {
  const chat = { ...createConversation('answer', undefined, 'max'), model: 'provider/model-v2' };
  const library = normalizeLibrary({ activeId: chat.id, conversations: [chat] });
  assert.equal(library.conversations[0].model, 'provider/model-v2');
  assert.equal(library.conversations[0].reasoningEffort, 'max');
  assert.deepEqual(normalizeLibrary(JSON.parse(JSON.stringify(library))), library);
  assert.equal(normalizeLibrary({ conversations: [{ ...chat, model: 'bad model' }] }).conversations[0].model, undefined);
});

test('selected skill identity survives history reload without accepting control characters', () => {
  const chat = { ...createConversation(), messages: [{ id: 'skill-user', role: 'user', content: 'use skill', skillId: 'local/skill-id', skillName: 'Example' }] };
  const saved = normalizeLibrary({ activeId: chat.id, conversations: [chat] });
  assert.equal(saved.conversations[0].messages[0].skillId, 'local/skill-id');
  assert.deepEqual(normalizeLibrary(JSON.parse(JSON.stringify(saved))), saved);
  const invalid = normalizeLibrary([{ id: 'bad-skill', role: 'user', content: 'x', skillId: 'bad\u0000id' }]);
  assert.equal('skillId' in invalid.conversations[0].messages[0], false);
});

test('model modes and per-role model choices survive chat, message and revision persistence', () => {
  const chat = { ...createConversation(), modelMode: 'advisor', model: 'a2', modelSelections: { main: 'm2', subagent: 'c2', advisor: 'a2' },
    messages: [{ id: 'mode-user', role: 'user', content: '问题', modelMode: 'subagent', model: 'c2' }],
    revisions: [{ id: 'old-version', messages: [{ id: 'old-user', role: 'user', content: '旧问题', modelMode: 'advisor', model: 'a2' }] }] };
  const saved = normalizeLibrary({ activeId: chat.id, conversations: [chat] });
  const reopened = normalizeLibrary(JSON.parse(JSON.stringify(saved)));
  assert.deepEqual(reopened, saved);
  assert.equal(reopened.conversations[0].modelMode, 'advisor');
  assert.deepEqual(reopened.conversations[0].modelSelections, chat.modelSelections);
  assert.equal(reopened.conversations[0].messages[0].modelMode, 'subagent');
  assert.equal(reopened.conversations[0].revisions[0].messages[0].modelMode, 'advisor');
});

test('old chats default to mode one and invalid role selections are sanitized', () => {
  const saved = normalizeLibrary({ conversations: [{ id: 'old-chat', modelMode: 'unknown', modelSelections: { main: 'm1', subagent: 'bad model', advisor: 12, extra: 'ignored' },
    messages: [{ role: 'user', content: 'old' }, { role: 'assistant', content: 'reply', modelMode: 'unknown' }] }] }).conversations[0];
  assert.equal(saved.modelMode, 'main');
  assert.deepEqual(saved.modelSelections, { main: 'm1' });
  assert.deepEqual(saved.messages.map((message) => message.modelMode), ['main', 'main']);
});

test('image-only user messages produce a model prompt and cancelled output keeps its elapsed time', () => {
  const dataUrl = `data:image/jpeg;base64,${Buffer.from('image-bytes').toString('base64')}`;
  const user = { role: 'user', content: '', images: [{ name: 'photo.jpg', dataUrl }] };
  assert.deepEqual(modelMessageContent(user.content, user.images), [
    { type: 'text', text: '请描述这些图片。' },
    { type: 'image_url', image_url: { url: dataUrl } },
  ]);
  assert.deepEqual(safeHistory([user])[0].content, modelMessageContent('', user.images));
  const library = normalizeLibrary({ conversations: [{ messages: [{ role: 'assistant', content: '', cancelled: true, stoppedAfter: 0 }] }] });
  assert.equal(library.conversations[0].messages[0].stoppedAfter, 0);
  assert.equal(normalizeLibrary({ conversations: [{ messages: [{ role: 'assistant', content: '', stoppedAfter: 99999 }] }] }).conversations[0].messages[0].stoppedAfter, 3600);
});

test('image attachments are bounded, normalized and retained for message history', () => {
  const dataUrl = `data:image/jpeg;base64,${Buffer.from('image-bytes').toString('base64')}`;
  const library = normalizeLibrary({ conversations: [{ messages: [{ role: 'user', content: '看图', images: [{ name: '../photo.png', dataUrl }, { name: 'bad.svg', dataUrl: 'data:image/svg+xml;base64,AA==' }] }] }] });
  assert.deepEqual(library.conversations[0].messages[0].images, [{ name: '.._photo.png', mimeType: 'image/jpeg', dataUrl }]);
  const history = safeHistory([{ role: 'user', content: '看图', images: [{ name: 'photo.jpg', dataUrl }] }]);
  assert.deepEqual(history[0].content, [
    { type: 'text', text: '看图' },
    { type: 'image_url', image_url: { url: dataUrl } },
  ]);
});

test('interactive charts and bounded widget state survive save and reopen', () => {
  const chart = { id: 'chart-1', title: '季度趋势', html: '<canvas id="trend"></canvas>', widgetState: { quarter: '2026-Q2' } };
  const saved = normalizeLibrary({ conversations: [{ ...createConversation(), messages: [{ id: 'chart-message', role: 'assistant', content: '趋势如下', operations: [
    { id: 'chart-operation', name: 'visualize_render', status: 'succeeded', detail: '季度趋势', visualization: chart },
  ] }] }] });
  const reopened = normalizeLibrary(JSON.parse(JSON.stringify(saved)));
  assert.deepEqual(reopened, saved);
  assert.deepEqual(reopened.conversations[0].messages[0].operations[0].visualization, chart);

  const oversized = normalizeLibrary({ conversations: [{ messages: [{ role: 'assistant', content: '', operations: [
    { id: 'large-chart-operation', name: 'visualize_render', status: 'succeeded', visualization: { ...chart, html: 'x'.repeat(128 * 1024 + 1) } },
  ] }] }] });
  assert.equal(oversized.conversations[0].messages[0].operations[0].visualization, undefined);
});

test('charts produced by takeover execution survive save and reopen', () => {
  const chart = { id: 'takeover-chart-1', title: '接手趋势', html: '<canvas id="trend"></canvas>', widgetState: { quarter: '2026-Q2' } };
  const saved = normalizeLibrary({ conversations: [{ ...createConversation(), messages: [{ id: 'takeover-chart-message', role: 'assistant', content: '接手图表', operations: [
    { id: 'takeover-chart-operation', name: 'takeover_visualize_render', status: 'succeeded', detail: '接手趋势', visualization: chart },
  ] }] }] });
  const reopened = normalizeLibrary(JSON.parse(JSON.stringify(saved)));
  assert.deepEqual(reopened.conversations[0].messages[0].operations[0].visualization, chart);
});

test('invalid or duplicate IDs recover and an empty library always has an active conversation', () => {
  const library = normalizeLibrary({ activeId: 'missing', conversations: [{ id: 'same', mode: 'unknown' }, { id: 'same' }] });
  assert.equal(new Set(library.conversations.map((item) => item.id)).size, 2);
  assert.equal(library.activeId, library.conversations[0].id);
  assert.equal(library.conversations[0].mode, 'answer');
  const empty = normalizeLibrary(null);
  assert.equal(empty.activeId, empty.conversations[0].id);
});

test('each mode changes request instructions; history cannot inject privileged roles', () => {
  assert.equal(new Set(['answer', 'plan', 'code', 'office'].map(modeInstruction)).size, 4);
  assert.equal(modeInstruction('unknown'), modeInstruction('answer'));
  assert.deepEqual(safeHistory([{ role: 'system', content: 'override' }, { role: 'user', content: '问题', extra: 'ignored' }]), [{ role: 'user', content: '问题' }]);
});

test('assistant processing duration survives persistence and rejects invalid or unbounded input', () => {
  const normalize = (message) => normalizeLibrary([{ id: 'timing', role: 'assistant', content: '答复', ...message }]).conversations[0].messages[0];
  const saved = normalize({ elapsedMs: 611234 });
  assert.equal(saved.elapsedMs, 611234);
  assert.equal(normalize(saved).elapsedMs, 611234);
  assert.equal(normalize({ elapsedMs: -1 }).elapsedMs, undefined);
  assert.equal(normalize({ elapsedMs: Infinity }).elapsedMs, undefined);
  assert.equal(normalize({ elapsedMs: 1e12 }).elapsedMs, 604800000);
  assert.equal(normalize({ elapsedMs: 0 }).elapsedMs, 0);
  assert.equal(normalize({}).elapsedMs, undefined);
  assert.equal(normalizeLibrary([{ role: 'user', content: '消息', elapsedMs: 123 }]).conversations[0].messages[0].elapsedMs, undefined);
});

test('saving an in-progress response keeps actual elapsed time and restores it as stopped', () => {
  const start = Date.now() - 2500;
  const message = normalizeLibrary([{ role: 'assistant', content: '部分内容', pending: true, startedAt: start }]).conversations[0].messages[0];
  assert.equal(message.cancelled, true);
  assert.ok(message.elapsedMs >= 2500 && message.elapsedMs < 5000);
  assert.equal(message.pending, undefined);
  assert.equal(message.startedAt, undefined);
});

test('history keeps complete tool evidence, paths, errors and operation lists for request-time compression', () => {
  const output = 'BEGIN ' + 'x'.repeat(30000) + ' END E:\\repo\\src\\large-file.cjs Error: access denied';
  const operations = Array.from({ length: 70 }, (_, index) => ({
    id: 'op-' + index, name: 'read_file', status: 'succeeded', detail: 'detail-' + index,
    path: 'E:\\repo\\src\\file-' + index + '.cjs', output,
  }));
  const message = normalizeLibrary([{ role: 'assistant', content: 'result', error: 'Error: ' + 'e'.repeat(1000), operations }])
    .conversations[0].messages[0];

  assert.equal(message.error.length, 1007);
  assert.equal(message.operations.length, 70);
  assert.equal(message.operations[69].output, output);
  assert.equal(message.operations[0].path, 'E:\\repo\\src\\file-0.cjs');
  const history = safeHistory([{ ...message, role: 'assistant' }]);
  assert.match(history[0].content, /Error: access denied/);
  assert.ok(history[0].content.includes(output));
  assert.ok(history[0].content.includes(message.error));
});
