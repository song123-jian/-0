const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const { normalizeChatImages } = require('./chat-images.cjs');
const { prepareChatAttachments } = require('./chat-attachment-parser.cjs');
const {
  normalizeTaskAttachments,
  TASK_ATTACHMENT_BYTES,
  TASK_ATTACHMENT_TOTAL_BYTES,
  TASK_IMAGE_BYTES,
  TASK_IMAGE_LIMIT,
} = require('./scheduled-tasks.cjs');

async function loadScheduledTaskAttachments(value, options = {}) {
  const references = normalizeTaskAttachments(value, true);
  const readFile = options.readFile || fs.readFile;
  const realpath = options.realpath || fs.realpath;
  const stat = options.stat || fs.stat;
  const parse = options.prepareChatAttachments || prepareChatAttachments;
  const documents = [];
  const images = [];
  let totalBytes = 0;

  for (const reference of references) {
    let target;
    try { target = await realpath(reference.path); }
    catch { throw new Error(`附件“${reference.name}”已不可访问，请在任务中重新添加。`); }
    const info = await stat(target).catch(() => null);
    if (!info?.isFile() || info.size < 1 || info.size > TASK_ATTACHMENT_BYTES) {
      throw new Error(`附件“${reference.name}”已不可用或大小超出限制，请重新添加。`);
    }
    totalBytes += info.size;
    if (totalBytes > TASK_ATTACHMENT_TOTAL_BYTES) throw new Error('附件总量已超过 20 MB，请编辑任务后重新选择。');
    if (reference.mimeType.startsWith('image/') && (images.length >= TASK_IMAGE_LIMIT || info.size > TASK_IMAGE_BYTES)) {
      throw new Error(`图片附件最多 ${TASK_IMAGE_LIMIT} 张且每张不超过 1.9 MB。`);
    }
    const bytes = await readFile(target);
    const data = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
    const hash = crypto.createHash('sha256').update(data).digest('hex');
    if (data.length !== reference.size || hash !== reference.sha256) {
      throw new Error(`附件“${reference.name}”自添加后已变化，请在任务中重新添加。`);
    }
    if (reference.mimeType.startsWith('image/')) {
      images.push({ name: reference.name, dataUrl: `data:${reference.mimeType};base64,${data.toString('base64')}` });
    } else {
      documents.push({ name: reference.name, mimeType: reference.mimeType, data });
    }
  }

  const parsed = documents.length ? await parse(documents) : [];
  const normalizedImages = normalizeChatImages(images);
  if (normalizedImages.length !== images.length) throw new Error('有图片附件的格式不受支持，请重新添加 JPEG、PNG 或 WebP 图片。');
  return { attachments: parsed, images: normalizedImages };
}

module.exports = { loadScheduledTaskAttachments };
