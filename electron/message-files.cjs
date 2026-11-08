const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const within = (root, target) => { const relative = path.relative(root, target); return !relative || (!path.isAbsolute(relative) && relative !== '..' && !relative.startsWith('..' + path.sep)); };
const TEXT = new Set(['.md', '.txt', '.json', '.toml', '.yaml', '.yml', '.js', '.jsx', '.ts', '.tsx', '.cjs', '.mjs', '.css', '.html', '.xml', '.csv', '.log', '.ps1', '.py', '.go', '.rs', '.sql']);
const IMAGES = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.bmp': 'image/bmp' };

function createMessageFiles({ authorize, openDirectory, revealFile, openFile, now = Date.now }) {
  const grants = new Map();
  const absolute = (value) => {
    if (typeof value !== 'string' || value.length > 4096 || /[\x00-\x1f\x7f]/.test(value) || !path.isAbsolute(value) || /^\\\\|^\/\//.test(value) || (process.platform === 'win32' && !/^[a-z]:[\\/]/i.test(value))) throw Error('请使用本机绝对文件或文件夹路径。');
    return path.resolve(value);
  };
  const checked = async (value) => {
    const target = absolute(value);
    await authorize('file-read', { path: target });
    try {
      const real = await fs.realpath(target);
      if (real !== target) await authorize('file-read', { path: real });
      const info = await fs.stat(real);
      if (!info.isFile() && !info.isDirectory()) throw Error('目标不是普通文件或文件夹。');
      return { target: real, info };
    } catch (error) { if (error.code === 'ENOENT') throw Error('文件或文件夹不存在。'); throw error; }
  };
  const resolve = async (id, value) => {
    const grant = grants.get(id);
    if (!grant || grant.expires <= now()) { grants.delete(id); throw Error('文件浏览授权已过期，请重新点击消息中的路径。'); }
    if (!within(grant.root, absolute(value))) throw Error('只能浏览本次点击路径所在的目录。');
    const resolved = await checked(value);
    if (!within(grant.root, resolved.target)) throw Error('不能通过链接访问授权目录以外的位置。');
    return { ...resolved, root: grant.root };
  };
  return {
    clear() { grants.clear(); },
    async locate(value, reveal = true) {
      const { target, info } = await checked(value);
      const directory = info.isDirectory() ? target : path.dirname(target);
      const id = crypto.randomUUID();
      for (const [key, grant] of grants) if (grant.expires <= now()) grants.delete(key);
      if (grants.size >= 16) grants.delete(grants.keys().next().value);
      grants.set(id, { root: directory, expires: now() + 30 * 60 * 1000 });
      let notice = '';
      if (reveal) {
        try { await authorize('external-open', { path: target }); if (info.isDirectory()) await openDirectory(target); else await revealFile(target); }
        catch (error) { notice = '文件页已定位；资源管理器未打开：' + error.message; }
      }
      return { id, path: target, directory, root: directory, selectedPath: info.isFile() ? target : '', notice };
    },
    async list(id, value) {
      const { target: directory, info, root } = await resolve(id, value);
      if (!info.isDirectory()) throw Error('目标不是文件夹。');
      const entries = await fs.readdir(directory, { withFileTypes: true });
      const visible = entries.filter(entry => !entry.isSymbolicLink() && (entry.isFile() || entry.isDirectory())).slice(0, 1200);
      const items = await Promise.all(visible.map(async entry => ({ name: entry.name, path: path.join(directory, entry.name), directory: entry.isDirectory(), size: entry.isFile() ? await fs.stat(path.join(directory, entry.name)).then(stat => stat.size, () => 0) : 0 })));
      items.sort((a, b) => Number(b.directory) - Number(a.directory) || a.name.localeCompare(b.name, 'zh-CN', { numeric: true }));
      return { root, directory, items, truncated: entries.length > visible.length };
    },
    async preview(id, value) {
      const { target, info } = await resolve(id, value);
      if (!info.isFile()) return { kind: 'directory', path: target };
      const ext = path.extname(target).toLowerCase();
      const result = { path: target, name: path.basename(target), size: info.size, kind: 'unsupported' };
      if (IMAGES[ext] && info.size <= 8 * 1024 * 1024) return { ...result, kind: 'image', dataUrl: `data:${IMAGES[ext]};base64,` + (await fs.readFile(target)).toString('base64') };
      if ((!TEXT.has(ext) && path.basename(target) !== '.gitignore') || info.size > 2 * 1024 * 1024) return result;
      const bytes = await fs.readFile(target);
      if (bytes.includes(0)) return result;
      let content; try { content = new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch { return { ...result, note: '该文件不是 UTF-8 文本，请使用系统应用打开。' }; }
      return { ...result, kind: ext === '.md' ? 'markdown' : 'text', content: content.slice(0, 128000), truncated: content.length > 128000 };
    },
    async reveal(id, value) {
      const { target, info } = await resolve(id, value);
      await authorize('external-open', { path: target });
      if (info.isDirectory()) await openDirectory(target); else await revealFile(target);
      return true;
    },
    async open(id, value) {
      const { target, info } = await resolve(id, value);
      if (!info.isFile()) throw Error('请选择文件。');
      await authorize('external-open', { path: target });
      return openFile(target);
    },
  };
}
module.exports = { createMessageFiles };
