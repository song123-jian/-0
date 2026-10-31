const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { gzip, gunzip } = require('node:zlib');
const { promisify } = require('node:util');
const { normalizeLibrary } = require('./conversations.cjs');

const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);

function conversationFiles(directory) {
  return {
    json: path.join(directory, 'conversations.json'),
    gzip: path.join(directory, 'conversations.json.gz'),
    legacy: path.join(directory, 'conversation.json'),
  };
}

async function readLibraryFile(file) {
  const bytes = await fs.readFile(file);
  let content;
  try { content = file.endsWith('.gz') ? await gunzipAsync(bytes) : bytes; }
  catch { throw new Error('本地聊天压缩文件无法读取；原文件已保留。'); }
  try { return normalizeLibrary(JSON.parse(content.toString('utf8'))); }
  catch { throw new Error('本地聊天文件无法读取；原文件已保留。'); }
}

async function readConversationLibrary(directory, { compressed = false, legacyDirectory = null, emptyIfMissing = false } = {}) {
  const root = path.resolve(directory);
  const info = await fs.stat(root).catch(() => null);
  if (!info?.isDirectory()) throw new Error('本地聊天文件夹不可用；原数据未改动。');
  const files = conversationFiles(root);
  const candidates = compressed ? [files.gzip, files.json] : [files.json, files.gzip];
  for (const file of candidates) {
    try { return await readLibraryFile(file); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  if (legacyDirectory) {
    try { return await readLibraryFile(conversationFiles(path.resolve(legacyDirectory)).legacy); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  return emptyIfMissing ? { version: 2, activeId: null, conversations: [] } : normalizeLibrary(null);
}

async function atomicWrite(file, bytes) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${crypto.randomUUID()}.tmp`;
  try {
    await fs.writeFile(temporary, bytes, { flag: 'wx' });
    await fs.rename(temporary, file);
  } catch (error) {
    await fs.rm(temporary, { force: true }).catch(() => {});
    throw error;
  }
}

async function writeConversationLibrary(directory, library, { compressed = false, removeAlternate = false } = {}) {
  const root = path.resolve(directory);
  const files = conversationFiles(root);
  const safe = normalizeLibrary(library);
  const serialized = JSON.stringify(safe);
  const bytes = compressed ? await gzipAsync(Buffer.from(serialized, 'utf8')) : Buffer.from(serialized, 'utf8');
  const target = compressed ? files.gzip : files.json;
  await atomicWrite(target, bytes);
  const verified = await readLibraryFile(target);
  if (JSON.stringify(verified) !== serialized) throw new Error('聊天文件写入后的内容核对失败；原文件已保留。');
  const cleanupWarning = removeAlternate ? await cleanupConversationAlternate(root, compressed) : '';
  return { path: target, library: verified, cleanupWarning };
}

async function cleanupConversationAlternate(directory, compressed) {
  const files = conversationFiles(directory);
  try { await fs.rm(compressed ? files.json : files.gzip, { force: true }); return ''; }
  catch { return '聊天已保存；另一格式的旧文件暂时无法移除，将在后续保存时重试。'; }
}

function mergeConversationLibraries(source, destination) {
  const current = normalizeLibrary(source);
  const existing = destination?.conversations?.length ? normalizeLibrary(destination) : { conversations: [], activeId: null };
  const conversations = new Map(existing.conversations.map((chat) => [chat.id, chat]));
  for (const chat of current.conversations) conversations.set(chat.id, chat);
  const activeId = current.conversations.some((chat) => chat.id === current.activeId && !chat.archivedAt)
    ? current.activeId : existing.activeId;
  return normalizeLibrary({ version: 2, activeId, conversations: [...conversations.values()] });
}

async function migrateConversationDirectory(destination, library, { compressed = false } = {}) {
  const targetRoot = await fs.realpath(destination);
  const targetInfo = await fs.stat(targetRoot);
  if (!targetInfo.isDirectory()) throw new Error('所选聊天位置不是文件夹。');
  const existing = await readConversationLibrary(targetRoot, { compressed, legacyDirectory: targetRoot, emptyIfMissing: true });
  const merged = mergeConversationLibraries(library, existing);
  // Keep the original format until the caller has committed the new storage preference.
  const written = await writeConversationLibrary(targetRoot, merged, { compressed });
  if (written.library.conversations.length !== merged.conversations.length) throw new Error('聊天目录核验数量不一致；原目录仍保留。');
  return { directory: targetRoot, library: written.library };
}

module.exports = {
  conversationFiles,
  readConversationLibrary,
  writeConversationLibrary,
  cleanupConversationAlternate,
  mergeConversationLibraries,
  migrateConversationDirectory,
};
