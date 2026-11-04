const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { AsyncLocalStorage } = require('node:async_hooks');
const context = new AsyncLocalStorage();
const hash = value => value === null ? null : crypto.createHash('sha256').update(value).digest('hex');
const MAX_FILE = 2 * 1024 * 1024, MAX_TOTAL = 16 * 1024 * 1024;
const excluded = new Set(['.git', 'node_modules', 'dist', 'release', 'target', '.next', '.cache', '__pycache__']);
const inside = (root, target) => { const rel = path.relative(root, target); return rel === '' || !path.isAbsolute(rel) && rel !== '..' && !rel.startsWith('..' + path.sep); };
async function read(target) {
  let handle;
  try {
    const parent = path.dirname(target), realParent = await fs.realpath(parent);
    const key = value => process.platform === 'win32' ? path.resolve(value).toLowerCase() : path.resolve(value);
    if (key(parent) !== key(realParent)) throw Error('文件路径包含目录联接或符号链接');
    const info = await fs.lstat(target);
    if (!info.isFile() || info.isSymbolicLink() || info.size > MAX_FILE) throw Error('文件过大或不是普通文件');
    handle = await fs.open(target, 'r'); const value = Buffer.alloc(info.size + 1); const result = await handle.read(value, 0, value.length, 0);
    if (result.bytesRead !== info.size || (await handle.stat()).size !== info.size || key(await fs.realpath(parent)) !== key(parent)) throw Error('读取期间文件发生变化');
    return value.subarray(0, result.bytesRead);
  } catch (error) { if (error.code === 'ENOENT') return null; throw error; }
  finally { await handle?.close(); }
}
function lines(buffer) { if (buffer === null || !buffer.length) return []; const text = new TextDecoder('utf-8', { fatal: true }).decode(buffer); if (text.includes('\0')) throw Error('binary'); const result = text.replace(/\r\n/g, '\n').split('\n'); if (result.at(-1) === '') result.pop(); return result; }
function difference(before, after) {
  let a, b; try { a = lines(before); b = lines(after); } catch { return { added: null, removed: null, diff: '二进制或非 UTF-8 文件：已保存真实文件快照，无法显示文本行差异。' }; }
  let start = 0, endA = a.length, endB = b.length;
  while (start < endA && start < endB && a[start] === b[start]) start++;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) { endA--; endB--; }
  const left = a.slice(start, endA), right = b.slice(start, endB); let edits = [];
  if (left.length * right.length <= 2000000) {
    const width = right.length + 1, table = new Uint32Array((left.length + 1) * width);
    for (let i = left.length - 1; i >= 0; i--) for (let j = right.length - 1; j >= 0; j--) table[i * width + j] = left[i] === right[j] ? table[(i + 1) * width + j + 1] + 1 : Math.max(table[(i + 1) * width + j], table[i * width + j + 1]);
    let i = 0, j = 0; while (i < left.length || j < right.length) { if (i < left.length && j < right.length && left[i] === right[j]) { edits.push(' ' + left[i++]); j++; } else if (j < right.length && (i === left.length || table[i * width + j + 1] > table[(i + 1) * width + j])) edits.push('+' + right[j++]); else edits.push('-' + left[i++]); }
  } else return { added: null, removed: null, diff: '文本差异超过在线计算上限；请在编辑器中比较完整文件。' };
  const added = edits.filter(line => line[0] === '+').length, removed = edits.filter(line => line[0] === '-').length;
  const first = Math.max(0, start - 3), tail = Math.min(3, a.length - endA, b.length - endB);
  const diff = [`@@ -${first + 1},${endA - first + tail} +${first + 1},${endB - first + tail} @@`, ...a.slice(first, start).map(line => ' ' + line), ...edits, ...a.slice(endA, endA + tail).map(line => ' ' + line)].join('\n');
  return { added, removed, diff: diff || '仅文件存在状态、换行符或字节编码发生变化。' };
}
async function observeCommit(target, commit) {
  const tracker = context.getStore(); if (!tracker) return commit();
  let before; try { before = await read(target); } catch { tracker.warn('部分大文件未记录，不能撤销未记录的文件。'); return commit(); }
  try { return await commit(); } finally { try { tracker.record(target, before, await read(target)); } catch { tracker.warn('部分文件无法记录，不能撤销未记录的文件。'); } }
}
function createTaskFileChanges(directory, { encryption, sensitive = () => false, protectedPaths = [] } = {}) {
  const busy = new Set();
  function file(id) { if (!/^[0-9a-f-]{36}$/i.test(id || '')) throw Error('无效的任务修改记录'); return path.join(directory, id + '.bin'); }
  async function save(record) { if (!encryption?.isEncryptionAvailable()) throw Error('系统加密不可用，未保存撤销记录'); await fs.mkdir(directory, { recursive: true }); const destination = file(record.id), temporary = destination + '.tmp'; await fs.writeFile(temporary, encryption.encryptString(JSON.stringify(record))); await fs.rename(temporary, destination); }
  async function load(id) { const target = file(id); if ((await fs.stat(target)).size > 48 * 1024 * 1024) throw Error('文件修改记录超过读取限制'); return JSON.parse(encryption.decryptString(await fs.readFile(target))); }
  function summary(record) { return { id: record.id, undone: !!record.undone, warning: record.warning || '', files: record.files.map(item => ({ path: item.relative, ...difference(item.before === null ? null : Buffer.from(item.before, 'base64'), item.after === null ? null : Buffer.from(item.after, 'base64')), kind: item.before === null ? 'added' : item.after === null ? 'deleted' : 'modified' })).map(({ diff, ...item }) => item) }; }
  function begin(id, workspaceRoot, conversationId) {
    const changes = new Map(); let total = 0, warning = '';
    const warn = value => { warning = value; };
    const record = (target, before, after) => {
      if (hash(before) === hash(after)) return; const prior = changes.get(target);
      if (prior && hash(prior.after) !== hash(before)) { warn('文件在任务期间被其他操作修改；撤销已停用，请查看差异。'); prior.conflict = true; }
      const size = ((prior ? prior.before : before)?.length || 0) + (after?.length || 0);
      const previousSize = prior ? (prior.before?.length || 0) + (prior.after?.length || 0) : 0;
      if (total - previousSize + size > MAX_TOTAL || changes.size >= 100 && !prior) { warn('修改记录达到容量限制，未记录的文件不能撤销。'); return; }
      total = total - previousSize + size; changes.set(target, { before: prior ? prior.before : before, after, conflict: prior?.conflict || false });
    };
    const tracker = { record, warn, async run(action) { return context.run(tracker, action); },
      async command(action) {
        async function snapshot() { const result = new Map(), queue = [workspaceRoot]; let count = 0, bytes = 0; while (queue.length) { const dir = queue.pop(); let entries; try { if ((await fs.lstat(dir)).isSymbolicLink()) { warn('命令扫描发现路径联接，未读取其内容。'); continue; } entries = await fs.readdir(dir, { withFileTypes: true }); } catch { warn('命令扫描无法读取部分目录，记录不完整。'); continue; } for (const entry of entries) { const target = path.join(dir, entry.name); if (entry.isSymbolicLink() || excluded.has(entry.name.toLowerCase()) || sensitive(path.relative(workspaceRoot, target)) || protectedPaths.some(root => inside(root, target))) continue; if (++count > 6000) { warn('命令文件扫描达到上限；仅展示已覆盖的工作区文件。'); return result; } if (entry.isDirectory()) queue.push(target); else if (entry.isFile()) { try { const value = await read(target); if (bytes + (value?.length || 0) > MAX_TOTAL) { warn('命令文件扫描达到容量限制；仅展示已覆盖的工作区文件。'); continue; } bytes += value?.length || 0; result.set(target, value); } catch { warn('命令中的部分大文件无法记录；项目外、依赖和构建目录不纳入命令差异。'); } } } } return result; }
        const before = await snapshot(); try { return await action(); } finally { const after = await snapshot(); for (const target of new Set([...before.keys(), ...after.keys()])) {
          if (!before.has(target)) { if (warning) continue; record(target, null, after.get(target)); }
          else { try { record(target, before.get(target), await read(target)); } catch { warn('命令修改中的部分文件无法记录；未覆盖的文件不能撤销。'); } }
        } }
      },
      async finish() { const files = [...changes].filter(([, item]) => hash(item.before) !== hash(item.after)).map(([target, item]) => ({ target, relative: path.relative(workspaceRoot, target).replaceAll('\\', '/'), before: item.before === null ? null : item.before.toString('base64'), after: item.after === null ? null : item.after.toString('base64'), conflict: item.conflict })); if (!files.length && !warning) return null; const value = { id, workspaceRoot, conversationId, warning, files }; try { await save(value); } catch { return { ...summary(value), unavailable: true, warning: '无法保存加密记录；撤销与完整差异不可用。' }; } return summary(value); } }; return tracker;
  }
  async function details(id, conversationId) { const record = await load(id); if (record.conversationId !== conversationId) throw Error('记录不属于此对话'); return { ...summary(record), files: record.files.map(item => ({ path: item.relative, ...difference(item.before === null ? null : Buffer.from(item.before, 'base64'), item.after === null ? null : Buffer.from(item.after, 'base64')) })) }; }
  async function undo(id, { conversationId, validate, withCommit }) {
    if (busy.has(id)) throw Error('撤销正在进行'); busy.add(id);
    try { const record = await load(id); if (record.conversationId !== conversationId || record.undone) throw Error('记录不可撤销'); if (record.warning || record.files.some(item => item.conflict)) throw Error('此任务的修改记录不完整或存在并发修改，请手动检查差异。');
      const files = record.files.filter(item => !item.restored).sort((a, b) => a.target.localeCompare(b.target));
      async function verify(item) { await validate(item.target, record.workspaceRoot); if (hash(await read(item.target)) !== hash(item.after === null ? null : Buffer.from(item.after, 'base64'))) throw Error('文件已被后续修改，撤销已停止：' + item.relative); }
      const lock = async index => { if (index < files.length) return withCommit(files[index].target, () => lock(index + 1));
        for (const item of files) await verify(item);
        for (const item of files) {
          await verify(item);
          if (item.before === null) await fs.unlink(item.target);
          else {
            await fs.mkdir(path.dirname(item.target), { recursive: true });
            await verify(item);
            const temporary = item.target + '.scodex-undo-' + crypto.randomUUID() + '.tmp';
            try {
              await fs.writeFile(temporary, Buffer.from(item.before, 'base64'), { flag: 'wx' });
              await verify(item);
              if (item.after === null) { await fs.link(temporary, item.target); await fs.unlink(temporary); } else await fs.rename(temporary, item.target);
            } finally { await fs.rm(temporary, { force: true }); }
          }
          if (hash(await read(item.target)) !== hash(item.before === null ? null : Buffer.from(item.before, 'base64'))) throw Error('撤销后回读未通过：' + item.relative);
          item.restored = true; await save(record);
        }
        record.undone = true; await save(record); return summary(record);
      }; return await lock(0);
    } finally { busy.delete(id); }
  }
  return { begin, details, undo, isBusy: () => busy.size > 0 };
}
module.exports = { createTaskFileChanges, observeCommit, difference };
