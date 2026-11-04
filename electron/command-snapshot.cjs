const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');

const EXCLUDED = new Set(['.git', 'node_modules', 'dist', 'release', 'target', '.next', '.cache', '__pycache__']);
const inside = (root, target) => { const rel = path.relative(root, target); return rel === '' || !path.isAbsolute(rel) && rel !== '..' && !rel.startsWith('..' + path.sep); };
const fingerprint = info => [info.dev, info.ino, info.size, info.mtimeNs, info.ctimeNs].join(':');
const check = signal => { if (signal?.aborted) throw Error('任务已停止。'); };

// Only metadata is reused. Every restorable byte is retained in memory or in a
// bounded encrypted spill file before the command is allowed to start.
function createCommandSnapshot({ root, directory, encryption, read, sensitive, protectedPaths, warn, limits = {} }) {
  const maxEntries = Math.max(1, Math.min(6000, limits.maxEntries || 6000));
  const maxBytes = Math.max(1, Math.min(128 * 1024 * 1024, limits.maxBytes || 128 * 1024 * 1024));
  const maxMs = Math.max(1, Math.min(2000, limits.maxMs || 2000));
  const memoryLimit = 16 * 1024 * 1024, maxFile = 2 * 1024 * 1024;
  const spillFiles = new Set(), skipped = new Set(); let cache = new Map();
  const coverage = { complete: true, commands: 0, scannedFiles: 0, reusedFiles: 0, readBytes: 0, skippedFiles: 0, durationMs: 0, reasons: {} };
  function incomplete(reason, target = '') {
    coverage.complete = false;
    const key = reason + ':' + target;
    if (!skipped.has(key)) { skipped.add(key); coverage.reasons[reason] = (coverage.reasons[reason] || 0) + 1; if (target) coverage.skippedFiles++; }
    warn('命令文件记录不完整；仅展示已确认的修改，整批撤销已停用。');
  }
  async function snapshot({ signal, onProgress = () => {} } = {}) {
    check(signal); const started = performance.now(), queue = [root], files = new Map();
    let entriesSeen = 0, bytes = 0, memoryBytes = 0, complete = true;
    const skip = (reason, target) => { complete = false; incomplete(reason, target); };
    const expired = () => { if (performance.now() - started < maxMs) return false; skip('time'); return true; };
    onProgress({ detail: '正在核对命令文件基线…' });
    outer: while (queue.length) {
      check(signal); if (expired()) break;
      const dir = queue.pop(); let entries;
      try {
        if ((await fs.lstat(dir)).isSymbolicLink()) { skip('link', dir); continue; }
        entries = (await fs.readdir(dir, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name, 'en'));
      } catch { skip('unreadable', dir); continue; }
      for (const entry of entries) {
        check(signal); if (expired()) break outer;
        const target = path.join(dir, entry.name);
        if (entry.isSymbolicLink() || EXCLUDED.has(entry.name.toLowerCase()) || sensitive(path.relative(root, target)) || protectedPaths.some(value => inside(value, target))) continue;
        if (++entriesSeen > maxEntries) { skip('entries'); break outer; }
        if (entry.isDirectory()) { queue.push(target); continue; }
        if (!entry.isFile()) continue;
        try {
          const info = await fs.lstat(target, { bigint: true });
          if (info.isSymbolicLink() || !info.isFile()) { skip('changed', target); continue; }
          const size = Number(info.size); coverage.scannedFiles++;
          if (size > maxFile) { skip('large', target); continue; }
          if (bytes + size > maxBytes) { skip('bytes', target); continue; }
          bytes += size;
          const stamp = fingerprint(info), previous = cache.get(target);
          if (previous?.stamp === stamp) {
            if (previous.value && memoryBytes + size > memoryLimit) { skip('bytes', target); continue; }
            files.set(target, previous); memoryBytes += previous.value?.length || 0; coverage.reusedFiles++; continue;
          }
          const value = await read(target);
          if (value === null || fingerprint(await fs.lstat(target, { bigint: true })) !== stamp) { skip('changed', target); continue; }
          coverage.readBytes += value.length;
          if (memoryBytes + value.length <= memoryLimit) { files.set(target, { stamp, value }); memoryBytes += value.length; }
          else {
            if (!encryption?.isEncryptionAvailable()) { skip('storage', target); continue; }
            await fs.mkdir(directory, { recursive: true, mode: 0o700 });
            const disk = path.join(directory, crypto.randomUUID() + '.bin');
            spillFiles.add(disk);
            await fs.writeFile(disk, encryption.encryptString(value.toString('base64')), { flag: 'wx', mode: 0o600 });
            files.set(target, { stamp, disk });
          }
        } catch { skip('unreadable', target); }
      }
    }
    coverage.durationMs += Math.round(performance.now() - started); cache = files;
    return { files, complete };
  }
  async function bytes(entry) {
    return entry.disk ? Buffer.from(encryption.decryptString(await fs.readFile(entry.disk)), 'base64') : entry.value;
  }
  async function compare(before, after, record) {
    for (const target of new Set([...before.files.keys(), ...after.files.keys()])) {
      const a = before.files.get(target), b = after.files.get(target);
      if (a?.stamp && a.stamp === b?.stamp) continue;
      if (!a && !before.complete) continue; // Absence from a partial scan is not proof of a new file.
      try { record(target, a ? await bytes(a) : null, b ? await bytes(b) : await read(target)); }
      catch { incomplete('changed', target); }
    }
    const keep = new Set([...cache.values()].map(item => item.disk).filter(Boolean));
    for (const file of spillFiles) if (!keep.has(file)) { await fs.rm(file, { force: true }); spillFiles.delete(file); }
  }
  return { coverage, snapshot, compare, async close() { cache.clear(); if (spillFiles.size) await fs.rm(directory, { recursive: true, force: true }); spillFiles.clear(); } };
}

module.exports = { createCommandSnapshot };
