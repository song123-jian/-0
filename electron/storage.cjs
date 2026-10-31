const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { gunzip } = require('node:zlib');
const { promisify } = require('node:util');
const gunzipAsync = promisify(gunzip);

function createJsonStore(file, initial) {
  let queue = Promise.resolve();
  async function read() {
    try { return JSON.parse(await fs.readFile(file, 'utf8')); }
    catch (error) { if (error.code === 'ENOENT') return structuredClone(initial); throw new Error(`无法读取 ${path.basename(file)}，原文件已保留。`); }
  }
  return {
    read: () => queue.then(read),
    update(change) {
      const operation = queue.then(async () => {
        const next = await change(await read());
        const temporary = `${file}.${crypto.randomUUID()}.tmp`;
        await fs.mkdir(path.dirname(file), { recursive: true });
        try { await fs.writeFile(temporary, JSON.stringify(next), { flag: 'wx' }); await fs.rename(temporary, file); }
        catch (error) { await fs.rm(temporary, { force: true }).catch(() => {}); throw error; }
        return next;
      });
      queue = operation.catch(() => {});
      return operation;
    },
    flush: () => queue,
  };
}

async function storageUsage(root, options = {}) {
  const primaryRoot = path.resolve(root);
  const conversationRoot = path.resolve(options.conversationDirectory || primaryRoot);
  const conversationFiles = new Set([
    path.join(conversationRoot, 'conversations.json'),
    path.join(conversationRoot, 'conversations.json.gz'),
    path.join(conversationRoot, 'conversation.json'),
  ]);
  const sizes = { chats: 0, agents: 0, archived: 0, worktrees: 0, other: 0 };
  const warnings = [];
  const visited = new Set();
  let compressedAllocation = false;
  let entries = 0;
  const deadline = Date.now() + 15_000;
  async function visit(target, category = 'other', depth = 0) {
    const visitKey = process.platform === 'win32' ? path.resolve(target).toLowerCase() : path.resolve(target);
    if (visited.has(visitKey)) return;
    visited.add(visitKey);
    if (++entries > 150_000 || depth > 80 || Date.now() > deadline) { warnings.push('文件较多，当前仅显示已扫描的占用；请稍后刷新。'); return; }
    let stat;
    try { stat = await fs.lstat(target); }
    catch (error) { if (error.code !== 'ENOENT') warnings.push(`无法读取 ${path.basename(target)}。`); return; }
    if (stat.isSymbolicLink()) { warnings.push('已跳过符号链接指向的外部数据。'); return; }
    if (stat.isDirectory()) {
      let children;
      try { children = await fs.readdir(target); } catch { warnings.push(`无法扫描 ${path.basename(target)}。`); return; }
      for (const name of children) {
        const nextCategory = depth === 0 ? (name === 'worktrees' ? 'worktrees' : name === 'agent-runs.json' ? 'agents' : 'other') : category;
        await visit(path.join(target, name), nextCategory, depth + 1);
        if (entries > 150_000 || Date.now() > deadline) break;
      }
    } else if (stat.isFile()) {
      const normalizedTarget = path.resolve(target);
      if (conversationFiles.has(normalizedTarget)) {
        try {
          const bytes = await fs.readFile(target);
          const compressed = normalizedTarget.endsWith('.gz');
          const content = (compressed ? await gunzipAsync(bytes) : bytes).toString('utf8');
          const data = JSON.parse(content);
          if (!Array.isArray(data.conversations)) throw new Error('Invalid library');
          // For gzip files, preserve the physical byte total while allocating it by logical content.
          let assigned = 0;
          const categories = { chats: 0, archived: 0 };
          for (const chat of data.conversations) {
            const bytes = Buffer.byteLength(JSON.stringify(chat));
            categories[chat.archivedAt ? 'archived' : 'chats'] += bytes;
            assigned += bytes;
          }
          const physicalBytes = bytes.length;
          const logicalTotal = Math.max(Buffer.byteLength(content), assigned, 1);
          const physicalAssigned = compressed
            ? Math.min(physicalBytes, Math.round(physicalBytes * assigned / logicalTotal))
            : Math.min(physicalBytes, assigned);
          const chatBytes = assigned ? Math.round(physicalAssigned * categories.chats / assigned) : 0;
          sizes.chats += chatBytes;
          sizes.archived += physicalAssigned - chatBytes;
          sizes.other += Math.max(0, physicalBytes - physicalAssigned);
          if (compressed) compressedAllocation = true;
        } catch { sizes.other += stat.size; warnings.push('对话文件无法分类，已计入其他；原文件未改动。'); }
      } else sizes[category] += stat.size;
    }
  }
  await visit(primaryRoot);
  // A user-selected folder can hold unrelated data. Only include its known chat files.
  for (const file of conversationFiles) await visit(file);
  return { root: primaryRoot, conversationRoot, compressedAllocation, sizes, total: Object.values(sizes).reduce((sum, value) => sum + value, 0), complete: warnings.length === 0,
    warnings: [...new Set(warnings)], scannedAt: new Date().toISOString() };
}

module.exports = { createJsonStore, storageUsage };
