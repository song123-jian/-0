import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { normalizeChatAttachments, normalizeAttachmentRecords, chatAttachmentContext, MAX_CHAT_ATTACHMENT_TEXT_BYTES } = require('../electron/chat-attachments.cjs');
const { assertContextAccess } = require('../electron/preferences.cjs');
const { normalizeLibrary } = require('../electron/conversations.cjs');
const { safeHistory } = require('../electron/chat-policy.cjs');
const file = (name, data, mimeType = '') => ({ name, data, mimeType });

test('arbitrary extensions add as metadata; UTF-8 and BOM UTF-16 text decode accurately', () => {
  const records = normalizeChatAttachments([
    file('文档.docx', new Uint8Array([80, 75, 0, 1])),
    file('中文.txt', Buffer.from('中文 🚀')),
    file('utf16.txt', Buffer.concat([Buffer.from([255, 254]), Buffer.from('中文', 'utf16le')])),
    file('utf16be.txt', Buffer.from([254, 255, 78, 45, 101, 135])),
    file('empty.txt', Buffer.alloc(0)),
  ]);
  assert.equal(records[0].parsed, false);
  assert.match(chatAttachmentContext(records), /请勿声称已经读取正文/);
  assert.equal(records[1].text, '中文 🚀');
  assert.equal(records[2].text, '中文');
  assert.equal(records[3].text, '中文');
  assert.equal(records[4].parsed, true);
  assert.equal(records.some((item) => 'data' in item), false);
});

test('complete UTF-8 attachment text survives extraction and persisted/IPC records', () => {
  const records = normalizeChatAttachments([file('a.txt', Buffer.from('中🚀'.repeat(40000))), file('b.txt', Buffer.from('文'.repeat(50000)))]);
  assert.ok(records.reduce((sum, item) => sum + Buffer.byteLength(item.text), 0) <= MAX_CHAT_ATTACHMENT_TEXT_BYTES);
  assert.equal(records[0].text.includes('�'), false);
  assert.equal(records[0].truncated, false);
  assert.equal(records[0].text, '中🚀'.repeat(40000));
  assert.equal(records[1].text, '文'.repeat(50000));
  assert.deepEqual(normalizeAttachmentRecords(JSON.parse(JSON.stringify(records))), records);
  assert.throws(() => normalizeAttachmentRecords([{ text: 'bypass', size: -1 }]), /大小无效/);
});

test('malformed payload, sizes/counts, invalid text, and chat-only permission are enforced', () => {
  assert.throws(() => normalizeChatAttachments({}), /格式无效/);
  assert.throws(() => normalizeChatAttachments([file('bad.txt', 'raw')]), /内容无效/);
  assert.throws(() => normalizeChatAttachments(Array.from({ length: 11 }, () => file('a', Buffer.alloc(0)))), /10/);
  assert.throws(() => normalizeChatAttachments([file('huge', Buffer.alloc(8 * 1024 * 1024 + 1))]), /8 MB/);
  assert.throws(() => normalizeChatAttachments(Array.from({ length: 3 }, () => file('large', Buffer.alloc(8 * 1024 * 1024)))), /20 MB/);
  assert.equal(normalizeChatAttachments([file('bad.txt', Buffer.from([255, 0]))])[0].parsed, false);
  assert.throws(() => assertContextAccess({ contextAccess: 'chat-only' }, { attachments: [{}] }), /仅对话/);
});

test('file-only message survives save/reload and remains usable in model history without raw binary', () => {
  const attachments = normalizeChatAttachments([file('data.txt', Buffer.from('attachment history 中文'))]);
  const saved = normalizeLibrary([{ role: 'user', content: '', attachments }]);
  const restored = normalizeLibrary(JSON.parse(JSON.stringify(saved)));
  const message = restored.conversations[0].messages[0];
  assert.deepEqual(message.attachments, attachments);
  assert.match(safeHistory([message])[0].content, /attachment history 中文/);
  assert.match(safeHistory([message])[0].content, /不可信/);
});
