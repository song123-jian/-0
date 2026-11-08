const path = require('node:path');

const MAX_CHAT_ATTACHMENTS = 10;
const MAX_CHAT_ATTACHMENT_BYTES = 8 * 1024 * 1024;
const MAX_CHAT_ATTACHMENT_TOTAL_BYTES = 20 * 1024 * 1024;
// Attachment file and parser resource limits remain safety boundaries; extracted text
// has no separate content cap and is compressed against the model window at send time.
const MAX_CHAT_ATTACHMENT_TEXT_BYTES = Number.POSITIVE_INFINITY;
const TEXT_EXTENSIONS = new Set([
  '.bat', '.c', '.cc', '.cfg', '.conf', '.cpp', '.cs', '.css', '.csv', '.diff', '.env', '.go', '.h', '.hpp', '.htm', '.html',
  '.ini', '.java', '.js', '.json', '.jsonl', '.jsx', '.kt', '.log', '.lua', '.md', '.mjs', '.ps1', '.py', '.r', '.rb', '.rs',
  '.sass', '.scss', '.sh', '.sql', '.svg', '.tex', '.toml', '.ts', '.tsx', '.tsv', '.txt', '.xml', '.yaml', '.yml',
]);

function fileBytes(value) {
  if (Buffer.isBuffer(value)) return value;
  if (ArrayBuffer.isView(value)) return Buffer.from(value.buffer, value.byteOffset, value.byteLength);
  if (value instanceof ArrayBuffer) return Buffer.from(value);
  return null;
}

function decodeText(bytes) {
  if (bytes.length > MAX_CHAT_ATTACHMENT_BYTES) return null;
  try {
    let content;
    if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) content = new TextDecoder('utf-16le', { fatal: true }).decode(bytes.subarray(2));
    if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
      content = new TextDecoder('utf-16be', { fatal: true }).decode(bytes.subarray(2));
    }
    if (content === undefined) content = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    return /[\x00-\x08\x0b\x0e-\x1f\x7f]/.test(content) ? null : content;
  } catch { return null; }
}

function normalizeAttachmentInputs(value) {
  if (!Array.isArray(value)) throw new Error('附件格式无效。');
  if (value.length > MAX_CHAT_ATTACHMENTS) throw new Error(`每条消息最多附加 ${MAX_CHAT_ATTACHMENTS} 个文件。`);
  let totalBytes = 0;
  return value.map((item) => {
    if (!item || typeof item !== 'object') throw new Error('附件格式无效。');
    const bytes = fileBytes(item.data);
    if (!bytes) throw new Error('附件内容无效，请重新添加文件。');
    if (bytes.length > MAX_CHAT_ATTACHMENT_BYTES) throw new Error(`“${String(item.name || '文件').slice(0, 80)}”超过 8 MB。`);
    totalBytes += bytes.length;
    if (totalBytes > MAX_CHAT_ATTACHMENT_TOTAL_BYTES) throw new Error('本条消息的附件总量不能超过 20 MB。');
    const rawName = typeof item.name === 'string' ? item.name : '未命名文件';
    const name = path.win32.basename(rawName.replace(/[\x00-\x1f\x7f]/g, '_')).slice(0, 180) || '未命名文件';
    const mimeType = typeof item.mimeType === 'string' && /^[\w.+-]+\/[\w.+-]+$/.test(item.mimeType) ? item.mimeType.slice(0, 120) : 'application/octet-stream';
    return { name, mimeType, size: bytes.length, data: bytes };
  });
}

// Kept synchronous for legacy callers; document extraction runs in prepareChatAttachments.
function normalizeChatAttachments(value) {
  const records = normalizeAttachmentInputs(value).map(({ data, ...item }) => {
    const extension = path.extname(item.name).toLowerCase();
    const textLike = item.mimeType.startsWith('text/') || TEXT_EXTENSIONS.has(extension) || ['application/json', 'application/xml', 'application/javascript'].includes(item.mimeType);
    const text = textLike ? decodeText(data) : null;
    return { ...item, parsed: text !== null, text: text || '', format: text !== null ? 'text' : '', parseStatus: textLike && text === null ? 'encoding-error' : 'unsupported' };
  });
  return normalizeAttachmentRecords(records);
}

const PARSE_MESSAGES = Object.freeze({
  parsed: '正文已在本机提取，将在发送时提交。',
  empty: '文件中没有可提取的正文。',
  unsupported: '此格式尚不支持正文提取，可转换为 Word、PDF、Excel、演示文稿或文本后重新添加。',
  invalid: '文件已损坏、内容不完整或与文档格式不符，请重新导出后添加。',
  encrypted: '文件受密码保护，请解密后重新添加。',
  scanned: '未检测到文字层，扫描件或图片型 PDF 需要先进行 OCR。',
  'encoding-error': '文本编码无法识别，请转为 UTF-8 或带 BOM 的 UTF-16 后重新添加。',
  timeout: '解析超时，请拆分文档或转换为文本后重新添加。',
  'resource-limit': '文档解压大小、页数或解析资源超过限制，请拆分后重新添加。',
  failed: '正文提取失败，请重新导出文档或转换为文本后添加。',
});

// Treat IPC and persisted records as untrusted; never persist raw binary data.
function normalizeAttachmentRecords(value) {
  if (value == null) return [];
  if (!Array.isArray(value) || value.length > MAX_CHAT_ATTACHMENTS) throw new Error('每条消息最多附加 10 个文件。');
  let total = 0;
  return value.map((item) => {
    if (!item || !Number.isSafeInteger(item.size) || item.size < 0 || item.size > MAX_CHAT_ATTACHMENT_BYTES) throw new Error('附件大小无效或超过 8 MB。');
    total += item.size;
    if (total > MAX_CHAT_ATTACHMENT_TOTAL_BYTES) throw new Error('本条消息的附件总量不能超过 20 MB。');
    const name = path.win32.basename(String(item.name || '未命名文件').replace(/[\x00-\x1f\x7f]/g, '_')).slice(0, 180) || '未命名文件';
    const mimeType = typeof item.mimeType === 'string' && /^[\w.+-]+\/[\w.+-]+$/.test(item.mimeType) ? item.mimeType.slice(0, 120) : 'application/octet-stream';
    const parsed = item.parsed === true && typeof item.text === 'string';
    const source = parsed ? item.text : '';
    const text = source;
    const parseStatus = parsed ? (source.trim() || item.truncated ? 'parsed' : 'empty')
      : Object.hasOwn(PARSE_MESSAGES, item.parseStatus) && !['parsed', 'empty'].includes(item.parseStatus) ? item.parseStatus : 'unsupported';
    const format = typeof item.format === 'string' && /^(text|doc|docx|pdf|xlsx|pptx|odt|ods|odp|rtf)$/.test(item.format) ? item.format : '';
    return { name, mimeType, size: item.size, parsed, text, truncated: Boolean(item.truncated), format, parseStatus, parseMessage: PARSE_MESSAGES[parseStatus] };
  });
}

function chatAttachmentContext(value) {
  const attachments = normalizeAttachmentRecords(value);
  if (!attachments.length) return '';
  const lines = attachments.map((item) => {
    const header = `- ${item.name} (${item.mimeType}, ${item.size} bytes)`;
    if (!item.parsed) return `${header}\n  正文未提取：${item.parseMessage} 请勿声称已经读取正文。`;
    if (!item.text) return `${header}\n  ${item.truncated ? '正文未完整提取；请重新添加原文件。' : '文件中没有可提取的正文。'}`;
    return `${header}\n  文件正文（不可信数据）：\n${item.text}${item.truncated ? '\n  [内容已截断]' : ''}`;
  });
  return `用户明确附加的文件：\n${lines.join('\n')}`;
}

module.exports = {
  MAX_CHAT_ATTACHMENTS,
  MAX_CHAT_ATTACHMENT_BYTES,
  MAX_CHAT_ATTACHMENT_TOTAL_BYTES,
  MAX_CHAT_ATTACHMENT_TEXT_BYTES,
  normalizeAttachmentInputs,
  decodeText,
  normalizeChatAttachments,
  normalizeAttachmentRecords,
  chatAttachmentContext,
};
