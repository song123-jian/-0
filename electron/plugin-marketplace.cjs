const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { createJsonStore } = require('./storage.cjs');

const MAX_FILES = 256, MAX_FILE = 4 * 1024 * 1024, MAX_PACKAGE = 16 * 1024 * 1024;
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const blobSha = value => crypto.createHash('sha1').update(Buffer.from('blob ' + value.length + '\0')).update(value).digest('hex');
function safePath(value, allowEmpty = false) {
  if (typeof value !== 'string' || value.length > 500 || (!allowEmpty && !value)) throw Error('目录路径无效。');
  if (!value && allowEmpty) return '';
  const parts = value.split('/');
  if (parts.some(p => !p || p === '.' || p === '..' || /[<>:"\\|?*\x00-\x1f\x7f]/.test(p) || /[. ]$/.test(p) || /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(p) || p.toLowerCase() === '.git')) throw Error('目录含不支持或不安全的路径。');
  return value;
}
function normalizeSource(input) {
  const repository = String(input?.repository || '').trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9_.-]{0,99}\/[A-Za-z0-9][A-Za-z0-9_.-]{0,99}$/.test(repository)) throw Error('请输入 GitHub 仓库，例如 openai/skills。');
  const directory = safePath(String(input?.directory ?? 'skills/.curated').trim(), true);
  const ref = String(input?.ref || '').trim();
  if (ref.length > 160 || /[\x00-\x20~^:?*\[\\]/.test(ref) || ref.startsWith('-') || ref.includes('..') || ref.includes('@{')) throw Error('分支或提交无效。');
  const id = sha256(repository.toLowerCase() + '\n' + directory + '\n' + ref).slice(0, 16);
  return { id, repository, directory, ref, name: String(input?.name || repository).replace(/[\x00-\x1f\x7f]/g, '').slice(0, 80) };
}
const defaultSource = normalizeSource({ repository: 'openai/skills', directory: 'skills/.curated', name: 'OpenAI 公开技能库' });
function metadata(bytes) {
  if (bytes.length > 128 * 1024) throw Error('SKILL.md 超过128 KB。');
  const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  const header = text.match(/^---\s*\r?\n([\s\S]*?)\r?\n---/)?.[1];
  if (!header) throw Error('SKILL.md 缺少有效说明头部。');
  function field(name) {
    const match = header.match(new RegExp('^' + name + ':\\s*(.*)$', 'm'));
    if (!match) return '';
    const value = match[1].trim();
    if (/^[>|][-+]?$/.test(value)) return header.slice(match.index + match[0].length).split(/\r?\n/).filter((line, i, lines) => i > 0 && /^\s+\S/.test(line) && !lines.slice(1, i).some(v => v && !/^\s/.test(v))).map(v => v.trim()).join(' ');
    return value.replace(/^(["'])([\s\S]*)\1$/, '$2');
  }
  const name = field('name');
  if (!name || name.length > 160) throw Error('SKILL.md 需要有效 name。');
  return { name, description: field('description').slice(0, 1000), content: text };
}
function createPluginMarketplace({ stateFile, packagesRoot, request = fetch, authorizeUrl = async () => {}, authorizeWrite = async () => {}, assertMutation = () => {}, onChanged = () => {} }) {
  const root = path.resolve(packagesRoot);
  const store = createJsonStore(stateFile, { version: 1, sources: [defaultSource], catalogs: {}, installed: [] });
  let active = null;
  const notify = () => { try { onChanged(active ? { operation: active.operation, done: active.done, total: active.total } : null); } catch {} };
  async function read() {
    const state = await store.read();
    if (state.version !== 1 || !Array.isArray(state.sources) || !Array.isArray(state.installed) || !state.catalogs || typeof state.catalogs !== 'object') throw Error('插件目录记录无效，原文件已保留。');
    return state;
  }
  function current(job, mutable = false) { job.signal.throwIfAborted(); if (mutable) assertMutation(); }
  async function job(operation, execute) {
    if (active) throw Error('另一项插件操作正在进行，请等待或取消。');
    const controller = new AbortController(), entry = { operation, done: 0, total: 0, controller, signal: controller.signal };
    active = entry; notify();
    const timer = setTimeout(() => controller.abort(Error('插件操作超过120秒，请重试。')), 120_000);
    entry.completion = (async () => { try { return await execute(entry); } finally { clearTimeout(timer); if (active === entry) active = null; notify(); } })();
    return entry.completion;
  }
  async function download(url, limit, entry) {
    current(entry); await authorizeUrl(new URL(url)); current(entry);
    const response = await request(url, { headers: { 'User-Agent': 'Scodex-Workbench', Accept: 'application/vnd.github+json' }, redirect: 'error', signal: AbortSignal.any([entry.signal, AbortSignal.timeout(20_000)]) });
    if (!response.ok) { await response.body?.cancel().catch(() => {}); throw Error(response.status === 403 || response.status === 429 ? 'GitHub 目录服务限流或无权访问，请稍后重试。' : 'GitHub 请求失败（HTTP ' + response.status + '），请检查仓库、目录和分支。'); }
    const chunks = []; let size = 0;
    if (response.body) for await (const chunk of response.body) { current(entry); size += chunk.length; if (size > limit) throw Error('插件响应超过允许大小。'); chunks.push(chunk); }
    return Buffer.concat(chunks);
  }
  const api = (source, suffix) => 'https://api.github.com/repos/' + source.repository.split('/').map(encodeURIComponent).join('/') + (suffix ? '/' + suffix : '');
  async function json(url, limit, entry) { try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(await download(url, limit, entry))); } catch (error) { if (error instanceof SyntaxError) throw Error('GitHub 返回的目录格式无效。'); throw error; } }
  function installedPath(item) {
    if (!/^[a-f0-9]{16}$/.test(item.sourceId) || !/^[a-f0-9]{40}$/.test(item.commit)) throw Error('插件安装标识无效。');
    safePath(item.directory); if (item.directory.includes('/')) throw Error('插件目录无效。');
    return path.join(root, item.sourceId, item.directory, item.commit);
  }
  async function guarded(target, allowMissing = false) {
    const relative = path.relative(root, target);
    if (relative.startsWith('..') || path.isAbsolute(relative)) throw Error('插件路径超出管理目录。');
    const components = [root]; let next = root;
    for (const part of relative.split(path.sep).filter(Boolean)) { next = path.join(next, part); components.push(next); }
    for (const candidate of components) { try { if ((await fs.lstat(candidate)).isSymbolicLink()) throw Error('插件目录包含链接，操作已停止。'); } catch (error) { if (allowMissing && error.code === 'ENOENT') break; throw error; } }
    return target;
  }
  async function verify(item) {
    const base = await guarded(installedPath(item)); const expected = new Map(item.files.map(f => [f.path, f.sha256])); let count = 0;
    async function visit(folder, prefix = '') {
      for (const child of await fs.readdir(folder, { withFileTypes: true })) {
        if (++count > MAX_FILES * 3 || child.isSymbolicLink()) throw Error('插件文件已改动或包含链接，原文件已保留。');
        const rel = prefix + child.name, full = path.join(folder, child.name);
        if (child.isDirectory()) { if (![...expected.keys()].some(name => name.startsWith(rel + '/'))) throw Error('插件目录已改动，原文件已保留。'); await visit(full, rel + '/'); }
        else if (!child.isFile() || !expected.has(rel) || (await fs.stat(full)).size > MAX_FILE || sha256(await fs.readFile(full)) !== expected.get(rel)) throw Error('插件文件已改动，请先将修改移出插件目录后重试。');
        else expected.delete(rel);
      }
    }
    await visit(base); if (expected.size) throw Error('插件文件缺失，原记录已保留。');
  }
  function publicItem(item, state) {
    const found = state.installed.find(p => p.id === item.id);
    return { id: item.id, sourceId: item.sourceId, directory: item.directory, name: item.directory, commit: item.commit, fileCount: item.files.length, totalBytes: item.totalBytes, installed: found ? { enabled: found.enabled, commit: found.commit } : null };
  }
  function selection(state, input) {
    const item = Object.values(state.catalogs).flatMap(c => c.plugins).find(p => p.id === input?.id);
    if (!item || item.commit !== input?.commit) throw Error('目录版本已变化，请刷新详情后重试。');
    const source = state.sources.find(s => s.id === item.sourceId); if (!source) throw Error('插件来源已移除。');
    return { item, source };
  }
  async function fileBytes(source, item, file, entry) {
    const value = await json(api(source, 'git/blobs/' + file.blob), MAX_FILE * 2, entry);
    if (value.encoding !== 'base64' || value.sha !== file.blob || value.size !== file.size || typeof value.content !== 'string') throw Error('下载文件与固定提交的内容校验不一致，未安装。');
    const encoded = value.content.replace(/[ \r\n\t]/g, '');
    if (encoded.length !== Math.ceil(file.size / 3) * 4 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded)) throw Error('GitHub 文件编码无效，未安装。');
    const bytes = Buffer.from(encoded, 'base64');
    if (bytes.length !== file.size || blobSha(bytes) !== file.blob) throw Error('下载文件与固定提交的内容校验不一致，未安装。');
    return bytes;
  }
  async function snapshot() {
    const state = await read();
    return { sources: state.sources.map(s => ({ ...s, updatedAt: state.catalogs[s.id]?.updatedAt || '', commit: state.catalogs[s.id]?.commit || '' })), plugins: Object.values(state.catalogs).flatMap(c => c.plugins).map(p => publicItem(p, state)), installed: state.installed.map(({ files, ...p }) => ({ ...p, path: installedPath(p) })), progress: active ? { operation: active.operation, done: active.done, total: active.total } : null };
  }
  return {
    snapshot,
    isMutating: () => Boolean(active && !['读取公开目录', '读取插件详情'].includes(active.operation)),
    cancel() { if (!active) return false; active.controller.abort(Error('插件操作已取消。')); return true; },
    async shutdown() { const pending = active; pending?.controller.abort(Error('应用正在退出。')); await pending?.completion.catch(() => {}); await store.flush(); },
    addSource(input) { return job('添加来源', async entry => { const source = normalizeSource(input); await authorizeWrite(root); current(entry, true); await store.update(state => { if (state.sources.length >= 16) throw Error('最多16个目录来源。'); if (state.sources.some(s => s.id === source.id)) throw Error('该目录来源已存在。'); return { ...state, sources: [...state.sources, source] }; }); return snapshot(); }); },
    removeSource(id) { return job('移除来源', async entry => { await authorizeWrite(root); current(entry, true); await store.update(state => { if (state.installed.some(p => p.sourceId === id)) throw Error('请先卸载此来源的插件，再移除来源。'); const catalogs = { ...state.catalogs }; delete catalogs[id]; return { ...state, catalogs, sources: state.sources.filter(s => s.id !== id) }; }); return snapshot(); }); },
    refresh(id) { return job('读取公开目录', async entry => {
      const state = await read(), source = state.sources.find(s => s.id === id); if (!source) throw Error('目录来源不存在。');
      let ref = source.ref;
      if (!ref) { const repo = await json(api(source, ''), 256 * 1024, entry); ref = repo.default_branch; if (typeof ref !== 'string' || !ref) throw Error('仓库未声明默认分支。'); }
      const commit = await json(api(source, 'commits/' + encodeURIComponent(ref)), 1024 * 1024, entry);
      if (!/^[a-f0-9]{40}$/.test(commit.sha) || !/^[a-f0-9]{40}$/.test(commit.commit?.tree?.sha)) throw Error('目录提交信息无效。');
      const tree = await json(api(source, 'git/trees/' + commit.commit.tree.sha + '?recursive=1'), 8 * 1024 * 1024, entry);
      if (tree.truncated || !Array.isArray(tree.tree) || tree.tree.length > 30_000) throw Error('目录过大或被截断，请选择更小的技能仓库。');
      const prefix = source.directory ? source.directory + '/' : '', groups = new Map();
      for (const row of tree.tree) {
        if (typeof row.path !== 'string' || !row.path.startsWith(prefix)) continue;
        const rel = row.path.slice(prefix.length), slash = rel.indexOf('/'); if (slash < 1) continue;
        const directory = rel.slice(0, slash), sub = rel.slice(slash + 1); if (!groups.has(directory)) groups.set(directory, []); groups.get(directory).push({ ...row, relative: sub });
      }
      const plugins = [];
      for (const [directory, rows] of groups) {
        if (!rows.some(f => f.relative === 'SKILL.md' && f.type === 'blob')) continue;
        try { safePath(directory); } catch { continue; }
        const files = rows.filter(f => f.type !== 'tree'); let totalBytes = 0; const folded = new Set();
        if (files.length > MAX_FILES) continue;
        let valid = true;
        for (const file of files) { try { safePath(file.relative); } catch { valid = false; break; } const key = file.relative.normalize('NFKC').toLowerCase(); if (folded.has(key) || file.type !== 'blob' || !['100644', '100755'].includes(file.mode) || !/^[a-f0-9]{40}$/.test(file.sha) || !Number.isSafeInteger(file.size) || file.size < 0 || file.size > MAX_FILE) { valid = false; break; } folded.add(key); totalBytes += file.size; }
        if (!valid || totalBytes > MAX_PACKAGE) continue;
        plugins.push({ id: source.id + ':' + directory, sourceId: source.id, directory, commit: commit.sha, totalBytes, files: files.map(f => ({ path: f.relative, repositoryPath: f.path, size: f.size, blob: f.sha })) });
      }
      if (plugins.length > 1000) throw Error('目录超过1000项，请缩小来源目录。');
      current(entry); await store.update(s => ({ ...s, catalogs: { ...s.catalogs, [id]: { commit: commit.sha, updatedAt: new Date().toISOString(), plugins } } })); return snapshot();
    }); },
    detail(input) { return job('读取插件详情', async entry => { const state = await read(), { item, source } = selection(state, input); const skill = metadata(await fileBytes(source, item, item.files.find(f => f.path === 'SKILL.md'), entry)); return { ...publicItem(item, state), ...skill, repository: source.repository, files: item.files.map(f => ({ path: f.path, size: f.size })), hasScripts: item.files.some(f => /(^|\/)scripts\//.test(f.path)) }; }); },
    install(input) { return job('安装技能插件', async entry => {
      const state = await read(), { item, source } = selection(state, input), previous = state.installed.find(p => p.id === item.id);
      await authorizeWrite(root); current(entry, true);
      if (previous) await verify(previous);
      if (previous?.commit === item.commit) return snapshot();
      await guarded(root, true); await fs.mkdir(root, { recursive: true });
      const staging = path.join(root, '.stage-' + crypto.randomUUID()), target = installedPath(item); let promoted = false, registered = false;
      await fs.mkdir(staging);
      try {
        const files = []; let skill;
        entry.total = item.files.length; notify();
        for (const file of item.files) { const bytes = await fileBytes(source, item, file, entry); if (file.path === 'SKILL.md') skill = metadata(bytes); const dest = path.join(staging, ...file.path.split('/')); await fs.mkdir(path.dirname(dest), { recursive: true }); await fs.writeFile(dest, bytes, { flag: 'wx' }); files.push({ path: file.path, sha256: sha256(bytes) }); entry.done++; notify(); }
        current(entry, true); if (previous) await verify(previous); await guarded(target, true); await fs.mkdir(path.dirname(target), { recursive: true });
        if (await fs.lstat(target).then(() => true, error => { if (error.code === 'ENOENT') return false; throw error; })) throw Error('此版本安装目录已存在，原文件已保留。');
        await fs.rename(staging, target); promoted = true;
        const installed = { id: item.id, sourceId: item.sourceId, directory: item.directory, commit: item.commit, name: skill.name, description: skill.description, repository: source.repository, enabled: previous?.enabled ?? true, installedAt: new Date().toISOString(), files };
        current(entry, true); await store.update(s => { const latest = s.installed.find(p => p.id === item.id); if ((latest?.commit || '') !== (previous?.commit || '')) throw Error('安装状态已变化，请刷新。'); return { ...s, installed: [...s.installed.filter(p => p.id !== item.id), installed] }; }); registered = true;
        if (previous) await fs.rm(await guarded(installedPath(previous)), { recursive: true });
        return snapshot();
      } finally { if (!registered) await fs.rm(await guarded(promoted ? target : staging), { recursive: true, force: true }); }
    }); },
    setEnabled(input) { return job('更新启用状态', async entry => { await authorizeWrite(root); current(entry, true); await store.update(state => { const found = state.installed.find(p => p.id === input?.id); if (!found || found.commit !== input.commit || typeof input.enabled !== 'boolean') throw Error('插件安装状态已变化，请刷新。'); return { ...state, installed: state.installed.map(p => p.id === input.id ? { ...p, enabled: input.enabled } : p) }; }); return snapshot(); }); },
    remove(input) { return job('卸载技能插件', async entry => {
      const state = await read(), item = state.installed.find(p => p.id === input?.id); if (!item || item.commit !== input.commit) throw Error('插件安装状态已变化，请刷新。');
      await authorizeWrite(root); current(entry, true); await verify(item); current(entry, true);
      const target = installedPath(item), retired = path.join(root, '.remove-' + crypto.randomUUID()); await fs.rename(await guarded(target), retired);
      try { await store.update(s => ({ ...s, installed: s.installed.filter(p => p.id !== item.id) })); }
      catch (error) { await fs.rename(retired, target); throw error; }
      await fs.rm(await guarded(retired), { recursive: true }); return snapshot();
    }); },
    async inventory() {
      const state = await read(), plugins = [], skillRoots = [];
      for (const item of state.installed) {
        const target = await guarded(installedPath(item)).catch(() => null); if (!target) continue;
        plugins.push({ id: 'managed:' + item.id, managedId: item.id, name: item.name, provider: item.repository, source: '在线技能插件', path: target, version: item.commit.slice(0, 10), commit: item.commit, managed: true, enabled: item.enabled, status: 'installed', connected: false, codexEnabled: null });
        if (item.enabled) skillRoots.push({ path: target, sourceRoot: target, idRoot: target, label: '在线技能插件 · ' + item.repository, scope: 'plugin', prefix: 'managed:' + item.id + ':' });
      }
      return { plugins, skillRoots };
    },
  };
}
module.exports = { createPluginMarketplace, normalizeSource, safePath, metadata, blobSha };
