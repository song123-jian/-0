const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { createJsonStore } = require('./storage.cjs');
const executeFile = promisify(execFile);
const within = (root, candidate) => { const relative = path.relative(root, candidate); return relative === '' || (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative)); };

function createWorktreeService(root, currentWorkspace) {
  const worktreesRoot = path.join(root, 'worktrees');
  const store = createJsonStore(path.join(root, 'worktree-state.json'), { version: 1, retainCount: 5, trees: [] });
  let operations = Promise.resolve();
  const exclusive = (action) => { const result = operations.then(action); operations = result.catch(() => {}); return result; };
  const treesOf = (data) => { if (!Array.isArray(data.trees)) throw new Error('工作树记录格式无效，原文件已保留。'); return data.trees; };
  async function git(directory, args) {
    try {
      const result = await executeFile('git', ['-c', 'core.hooksPath=' + path.join(root, 'disabled-git-hooks'), '-c', 'submodule.recurse=false', '-C', directory, ...args], { windowsHide: true, timeout: 60_000, maxBuffer: 4 * 1024 * 1024, encoding: 'utf8' });
      return result.stdout.trim();
    } catch (error) { if (error.code === 'ENOENT') throw new Error('未找到 Git，请安装 Git 后重试。'); throw new Error((error.stderr || error.message || 'Git 操作失败。').slice(0, 800)); }
  }
  async function safeTree(tree) {
    const expected = path.join(worktreesRoot, tree.id);
    if (!/^[0-9a-f-]{36}$/i.test(tree.id) || path.resolve(tree.path) !== path.resolve(expected)) throw new Error('工作树记录的路径无效。');
    if ((await fs.lstat(worktreesRoot)).isSymbolicLink()) throw new Error('工作树根目录不能是符号链接。');
    const real = await fs.realpath(tree.path);
    if (!within(await fs.realpath(worktreesRoot), real) || real !== await fs.realpath(expected)) throw new Error('工作树路径越界。');
    if ((await fs.lstat(tree.path)).isSymbolicLink()) throw new Error('不能操作符号链接工作树。');
    return real;
  }
  async function removeOne(id) {
    const state = await store.read();
    const tree = treesOf(state).find((item) => item.id === id);
    if (!tree) throw new Error('工作树不存在，请刷新后重试。');
    const real = await safeTree(tree);
    if (within(real, await fs.realpath(currentWorkspace()))) throw new Error('当前正在使用此工作树，请先切换工作区。');
    if (await git(real, ['status', '--porcelain=v1', '--untracked-files=all', '--ignored'])) throw new Error('工作树有修改、未跟踪或忽略文件，已保留；请先保存到其他位置。');
    if (await git(real, ['rev-parse', 'HEAD']) !== tree.head) throw new Error('工作树包含创建后的提交，已保留；请先合并或备份提交。');
    // Git performs its own final dirty/locked/main-worktree checks; never force-remove.
    await git(tree.repository, ['worktree', 'remove', '--', real]);
    await store.update((data) => ({ ...data, trees: treesOf(data).filter((item) => item.id !== id) }));
    return id;
  }
  return {
    async isManagedWorkspace(directory) {
      const key = value => process.platform === 'win32' ? path.resolve(value).toLowerCase() : path.resolve(value);
      const data = await store.read();
      const tree = treesOf(data).find(item => key(item.path) === key(directory));
      if (!tree) return false;
      try { return key(await safeTree(tree)) === key(await fs.realpath(directory)); }
      catch { return false; }
    },
    async projectAccess(directory, protectedPaths) {
      const managed = await this.isManagedWorkspace(directory);
      if (!managed && within(path.resolve(root), path.resolve(directory))) throw new Error('应用数据中的项目必须是路径有效且已登记的工作树。');
      const same = value => process.platform === 'win32' ? path.resolve(value).toLowerCase() === path.resolve(root).toLowerCase() : path.resolve(value) === path.resolve(root);
      return { managed, paths: protectedPaths.filter(value => !managed || !value || !same(value)) };
    },
    async list() {
      const data = await store.read();
      return { ...data, trees: await Promise.all(treesOf(data).map(async (tree) => {
        try { const real = await safeTree(tree); const dirty = Boolean(await git(real, ['status', '--porcelain=v1', '--untracked-files=all', '--ignored'])); const changedHead = await git(real, ['rev-parse', 'HEAD']) !== tree.head;
          return { ...tree, dirty, changedHead, current: within(real, await fs.realpath(currentWorkspace())) };
        } catch (error) { return { ...tree, error: error.message }; }
      })) };
    },
    create(repository) { return exclusive(async () => {
      const state = await store.read(); if (treesOf(state).length >= 20) throw new Error('最多管理 20 个工作树，请先清理旧副本。');
      const repo = await git(repository, ['rev-parse', '--show-toplevel']);
      const head = await git(repo, ['rev-parse', '--verify', 'HEAD']);
      await fs.mkdir(worktreesRoot, { recursive: true }); await fs.mkdir(path.join(root, 'disabled-git-hooks'), { recursive: true });
      if ((await fs.lstat(worktreesRoot)).isSymbolicLink()) throw new Error('工作树根目录不能是符号链接。');
      const id = crypto.randomUUID(); const target = path.join(worktreesRoot, id);
      await git(repo, ['worktree', 'add', '--detach', '--', target, head]);
      const tree = { id, path: target, repository: repo, head, name: path.basename(repo) + ' · ' + id.slice(0, 8), createdAt: new Date().toISOString() };
      try { await store.update((data) => ({ ...data, trees: [tree, ...treesOf(data)] })); }
      catch (error) { await git(repo, ['worktree', 'remove', '--', target]).catch(() => {}); throw error; }
      return tree;
    }); },
    setRetention(count) { return exclusive(async () => { if (!Number.isInteger(count) || count < 0 || count > 20) throw new Error('保留数量必须在 0–20 之间。'); await store.update((data) => ({ ...data, retainCount: count })); return count; }); },
    remove(id) { return exclusive(() => removeOne(id)); },
    cleanup(ids) { return exclusive(async () => {
      const data = await store.read();
      const eligible = new Set([...treesOf(data)].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(data.retainCount).map((tree) => tree.id));
      if (!Array.isArray(ids) || ids.length > 20 || ids.some((id) => !eligible.has(id))) throw new Error('清理列表已变化，请刷新后重新确认。');
      const results = [];
      for (const id of ids) { try { await removeOne(id); results.push({ id, removed: true }); } catch (error) { results.push({ id, removed: false, error: error.message }); } }
      return results;
    }); },
  };
}

module.exports = { createWorktreeService };
