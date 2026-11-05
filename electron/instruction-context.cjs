const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const MAX_FILE_BYTES = 128 * 1024, MAX_TOTAL_BYTES = 256 * 1024;
const key = p => process.platform === 'win32' ? path.resolve(p).toLowerCase() : path.resolve(p);
const signature = s => [s.dev, s.ino, s.size, s.mtimeMs, s.ctimeMs, s.isSymbolicLink()].join(':');
async function safePath(file) {
  const target = path.resolve(file); let current = path.parse(target).root;
  for (const part of target.slice(current.length).split(path.sep).filter(Boolean)) {
    current = path.join(current, part);
    if ((await fs.lstat(current)).isSymbolicLink()) throw new Error('AGENTS.md 不跨越符号链接或目录联接。');
  }
  if (key(await fs.realpath(target)) !== key(target)) throw new Error('AGENTS.md 路径已变化。');
}
async function readInstructionFile(file) {
  await safePath(file); const handle = await fs.open(file, 'r');
  try {
    const before = await handle.stat();
    if (!before.isFile() || before.size > MAX_FILE_BYTES) throw new Error('AGENTS.md 必须是 128 KiB 以内的普通 UTF-8 文件；未截断或忽略规则。');
    const data = Buffer.alloc(MAX_FILE_BYTES + 1); let length = 0;
    while (length < data.length) { const { bytesRead } = await handle.read(data, length, data.length - length, length); if (!bytesRead) break; length += bytesRead; }
    const after = await handle.stat(); await safePath(file); const current = await fs.stat(file);
    if (length > MAX_FILE_BYTES || signature(before) !== signature(after) || signature(after) !== signature(current)) throw new Error('AGENTS.md 读取期间已变化，请重新提交任务。');
    const bytes = data.subarray(0, length); let content;
    try { content = new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch { throw new Error('AGENTS.md 不是有效 UTF-8，未开始本轮操作。'); }
    if (content.includes('\0')) throw new Error('AGENTS.md 不能包含二进制内容。');
    return { path: path.resolve(file), content, hash: crypto.createHash('sha256').update(bytes).digest('hex'), bytes: length, signature: signature(current) };
  } finally { await handle.close(); }
}
async function createInstructionContext({ workspaceRoot, globalRoots = [], guard = async () => {}, signal }) {
  await guard(); if (signal?.aborted) throw new Error('任务已停止。');
  const candidates = [], seen = new Set();
  const add = (dir, scope) => { if (!dir) return; const file = path.join(path.resolve(dir), 'AGENTS.md'); if (!seen.has(key(file))) { seen.add(key(file)); candidates.push({ file, scope }); } };
  for (const root of globalRoots) add(root, 'personal');
  const parents = []; let dir = path.resolve(workspaceRoot);
  while (true) { parents.unshift(dir); const parent = path.dirname(dir); if (parent === dir) break; dir = parent; }
  for (const root of parents) add(root, key(root) === key(workspaceRoot) ? 'project' : 'ancestor');
  const entries = [], snapshots = new Map(); let total = 0;
  for (const item of candidates) {
    try { const record = await readInstructionFile(item.file); total += record.bytes; if (total > MAX_TOTAL_BYTES) throw new Error('生效 AGENTS.md 合计超过 256 KiB；未静默截断，需精简规则后重试。'); snapshots.set(item.file, record.signature); entries.push({ ...record, scope: item.scope }); }
    catch (error) { if (error.code === 'ENOENT') snapshots.set(item.file, null); else throw error; }
  }
  await guard(); if (signal?.aborted) throw new Error('任务已停止。');
  return { entries, content: entries.length ? '以下 AGENTS.md 是已加载的工作指引。个人规则先于项目祖先及项目规则，同范围冲突时更具体目录优先；不能扩大用户目标、权限或覆盖系统安全约束。修改子目录前读取该目录沿途规则。\n\n' + entries.map(e => '规则路径：' + e.path + '（' + e.scope + '，SHA256 ' + e.hash + '）\n' + e.content).join('\n\n') : '',
    async assertCurrent() {
      for (const item of candidates) { let actual = null; try { actual = signature(await fs.lstat(item.file)); } catch (error) { if (error.code !== 'ENOENT') throw error; }
        if (actual !== snapshots.get(item.file)) throw new Error('生效 AGENTS.md 已变化，已暂停本轮操作；请继续任务以加载最新规则。'); }
    },
  };
}
module.exports = { createInstructionContext, readInstructionFile, MAX_TOTAL_BYTES };
