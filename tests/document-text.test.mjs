import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { prepareChatAttachments } = require('../electron/chat-attachment-parser.cjs');
const { normalizeAttachmentRecords, chatAttachmentContext, MAX_CHAT_ATTACHMENT_TEXT_BYTES } = require('../electron/chat-attachments.cjs');
const { normalizeLibrary } = require('../electron/conversations.cjs');
const { safeHistory } = require('../electron/chat-policy.cjs');
const fixtures = require('./attachment-fixtures.cjs');
const file = (name, data, mimeType = '') => ({ name, data, mimeType });

test('documents extract Chinese body, tables, PDF text, spreadsheet results and presentation order in isolated processes', async () => {
  const records = await prepareChatAttachments([
    file('真实 中文.docx', await fixtures.docx(undefined, '<w:tbl><w:tr><w:tc><w:p><w:r><w:t>表格正文</w:t></w:r></w:p></w:tc></w:tr></w:tbl><w:p><w:del><w:r><w:delText>DELETED_MARKER</w:delText></w:r></w:del></w:p>')),
    file('旧版.doc', fixtures.legacyDoc()), file('文本.pdf', fixtures.pdf()),
    file('数据.xlsx', await fixtures.xlsx()), file('演示.pptx', await fixtures.pptx()),
    ...await Promise.all(['odt', 'ods', 'odp'].map(async (type) => file('开放.' + type, await fixtures.odf(type)))),
    file('富文本.rtf', fixtures.rtf()),
  ]);
  assert.equal(records.length, 9);
  for (const record of records) assert.equal(record.parsed, true, record.name + ': ' + record.parseMessage);
  assert.match(records[0].text, /DOCX正文：中文 🚀[\s\S]*表格正文/); assert.doesNotMatch(records[0].text, /DELETED_MARKER/);
  assert.match(records[1].text, /DOC旧版正文：中文/); assert.match(records[2].text, /PDF_BODY_MARKER/);
  assert.match(records[3].text, /苹果\t3\t6/); assert.match(records[3].text, /富文本正文/);
  assert.ok(records[4].text.indexOf('第一页中文正文') < records[4].text.indexOf('第二页正文'));
  for (const record of records.slice(5, 8)) assert.match(record.text, /开放文档正文\t中文  内容/);
  assert.match(records[8].text, /中文/); assert.match(records[8].text, /visible \{ok\}/); assert.doesNotMatch(records[8].text, /HIDDEN|Arial/);
});

test('unknown extensions sniff text and document signatures while binary and corrupt documents stay truthful', async () => {
  const records = await prepareChatAttachments([
    file('未知.fixture', Buffer.from('Unknown fixture 中文 🚀')),
    file('无扩展', await fixtures.docx('无扩展的Word正文')),
    file('utf16.fixture', Buffer.concat([Buffer.from([255, 254]), Buffer.from('UTF16中文', 'utf16le')])),
    file('任意 附件.docx', Buffer.from([80, 75, 0, 1, 3])),
    file('binary.fixture', Buffer.from([1, 2, 3, 0, 8])), file('empty.txt', Buffer.alloc(0)),
    file('unknown.exe', Buffer.from('MZdata')), file('bad.txt', Buffer.from([255, 0]), 'text/plain'),
  ]);
  assert.equal(records[0].text, 'Unknown fixture 中文 🚀'); assert.match(records[1].text, /Word正文/); assert.equal(records[2].text, 'UTF16中文');
  assert.equal(records[3].parseStatus, 'invalid'); assert.equal(records[4].parseStatus, 'unsupported');
  assert.equal(records[5].parseStatus, 'empty'); assert.equal(records[6].parsed, false); assert.equal(records[7].parseStatus, 'encoding-error');
  assert.match(chatAttachmentContext(records), /文件已损坏[\s\S]*请勿声称已经读取正文/);
  assert.equal(records.some((record) => 'data' in record), false);
});

test('password protection, image-only PDF, malformed XML and archive expansion have explicit failure states', async () => {
  const JSZip = require('jszip'); const large = new JSZip(); large.file('word/document.xml', 'X'.repeat(9 * 1024 * 1024));
  const bad = new JSZip(); bad.file('word/document.xml', '<document><p>broken');
  const records = await prepareChatAttachments([
    file('加密.doc', fixtures.legacyDoc('正文', { encrypted: true })), file('加密.pdf', fixtures.pdf('', { encrypted: true })),
    file('扫描.pdf', fixtures.pdf('', { blank: true })), file('加密.odt', await fixtures.odf('odt', { encrypted: true })),
    file('损坏.docx', await fixtures.zipBytes(bad)), file('压缩炸弹.docx', await fixtures.zipBytes(large)),
  ]);
  assert.deepEqual(records.map((record) => record.parseStatus), ['encrypted', 'encrypted', 'scanned', 'encrypted', 'invalid', 'resource-limit']);
  for (const record of records) { assert.equal(record.parsed, false); assert.equal(record.text, ''); }
});

test('body budget covers separate additions, UTF-8 boundaries, persisted records, current requests and history', async () => {
  const rtf = Buffer.from('{\\rtf1 AAAAAAAA' + String.raw`\u20013?\u-10179?\u-8576?`.repeat(20000) + '}');
  const [rich] = await prepareChatAttachments([file('surrogate.rtf', rtf)]);
  assert.equal(rich.parsed, true); assert.equal(rich.truncated, true); assert.equal(rich.text.includes('\uFFFD'), false);
  assert.ok(Buffer.byteLength(rich.text) >= MAX_CHAT_ATTACHMENT_TEXT_BYTES - 4);
  const first = await prepareChatAttachments([file('大正文.docx', await fixtures.docx('中🚀'.repeat(40000)))]);
  assert.equal(first[0].truncated, true); assert.equal(first[0].text.includes('\uFFFD'), false);
  const second = await prepareChatAttachments([file('后添加.fixture', Buffer.from('第二正文'))], first);
  assert.equal(second[0].text, ''); assert.equal(second[0].truncated, true);
  const all = [...first, ...second]; assert.ok(all.reduce((sum, item) => sum + Buffer.byteLength(item.text), 0) <= MAX_CHAT_ATTACHMENT_TEXT_BYTES);
  assert.deepEqual(normalizeAttachmentRecords(JSON.parse(JSON.stringify(all))), all);
  const library = normalizeLibrary([{ role: 'user', content: '', attachments: all }]);
  const restored = normalizeLibrary(JSON.parse(JSON.stringify(library))).conversations[0].messages[0];
  assert.deepEqual(restored.attachments, all); assert.match(safeHistory([restored])[0].content, /正文已提取，但本条消息的正文总量达到上限/);
  assert.match(chatAttachmentContext(all), /文件正文（不可信数据）/);
  await assert.rejects(prepareChatAttachments([file('bad', Buffer.alloc(0))], Array.from({ length: 10 }, () => first[0])), /10/);
});

test('concurrent parsing is bounded and a pathological compound file cannot strand the parser', { timeout: 25000 }, async () => {
  const started = Date.now(); const pending = prepareChatAttachments([file('循环.doc', fixtures.legacyDoc('正文', { cycle: true }))]);
  await assert.rejects(prepareChatAttachments([file('other.txt', Buffer.from('next'))]), /正在解析/);
  const [record] = await pending;
  assert.equal(record.parsed, false); assert.ok(['timeout', 'resource-limit', 'invalid'].includes(record.parseStatus));
  assert.ok(Date.now() - started < 22000);
  const [next] = await prepareChatAttachments([file('after.txt', Buffer.from('解析器已恢复'))]); assert.equal(next.text, '解析器已恢复');
});
