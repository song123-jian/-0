const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');

function validateExport(input) {
  if (!input || typeof input.text !== 'string' || Buffer.byteLength(input.text, 'utf8') > 4 * 1024 * 1024 || input.text.includes('\0')) throw Error('导出内容无效或超过4MB。');
  const format = input.format === 'txt' ? 'txt' : 'md';
  const name = String(input.title || 'Scodex聊天').replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').trim().slice(0, 80).replace(/[. ]+$/, '') || 'Scodex聊天';
  return { text: input.text.replace(/^\uFEFF/, ''), format, name };
}
async function exportConversation(input, directory) {
  const value = validateExport(input);
  const target = path.join(directory, value.name + '-' + new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14) + '-' + crypto.randomUUID().slice(0, 8) + '.' + value.format);
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(target, value.text, { encoding: 'utf8', flag: 'wx' });
  if (await fs.readFile(target, 'utf8') !== value.text) throw Error('导出后核验失败。');
  return { path: target, bytes: Buffer.byteLength(value.text, 'utf8') };
}
module.exports = { validateExport, exportConversation };
