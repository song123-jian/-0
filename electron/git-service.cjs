const fs = require('node:fs/promises');
const { createReadStream } = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const execute = promisify(execFile);
const digest = value => crypto.createHash('sha256').update(value).digest('hex');
const pathKey = value => process.platform === 'win32' ? path.resolve(value).toLowerCase() : path.resolve(value);
const conflicts = new Set(['DD', 'AU', 'UD', 'UA', 'DU', 'AA', 'UU']);
function relativeFile(value) {
  if (typeof value !== 'string' || !value || value.includes('\0') || path.isAbsolute(value) || value.split(/[\\/]/).some(p => p === '..' || p === '.git')) throw Error('Git 文件路径无效。');
  return value;
}
function resetTarget(value) {
  const target = typeof value === 'string' ? value.trim() : '';
  if (target.length > 64 || !/^(?:HEAD(?:~\d{1,6})?|[a-f0-9]{7,64})$/i.test(target)) throw Error('请输入 HEAD、HEAD~N 或 7–64 位提交 SHA。');
  return target;
}
function parseStatus(raw) {
  const parts = raw.split('\0'), files = [];
  for (let i = 0; i < parts.length && parts[i]; i++) {
    const row = parts[i], code = row.slice(0, 2), name = relativeFile(row.slice(3));
    const oldPath = /[RC]/.test(code) ? relativeFile(parts[++i]) : null;
    files.push({ path: name, oldPath, index: code[0], working: code[1], untracked: code === '??', conflict: conflicts.has(code), staged: code[0] !== ' ' && code[0] !== '?', unstaged: code[1] !== ' ' });
  }
  return files;
}
function createGitService({ hooksDirectory, guard = async () => {}, authorize = async () => {}, confirm }) {
  let busy = false;
  const env = { ...process.env, GIT_TERMINAL_PROMPT: '0', LC_ALL: 'C' };
  for (const key of Object.keys(env)) if (/^GIT_(DIR|WORK_TREE|INDEX_FILE|OBJECT_DIRECTORY|ALTERNATE_OBJECT_DIRECTORIES|CONFIG.*|NAMESPACE|CEILING_DIRECTORIES)$/i.test(key)) delete env[key];
  async function git(root, args, optional = false, timeout = 30_000) {
    try {
      return (await execute('git', ['--literal-pathspecs', '-c', 'core.quotepath=false', '-c', 'core.fsmonitor=false', '-c', 'core.hooksPath=' + hooksDirectory, '-c', 'submodule.recurse=false', '-C', root, ...args], { env: { ...env, GIT_OPTIONAL_LOCKS: '0' }, windowsHide: true, encoding: 'utf8', timeout, maxBuffer: 4 * 1024 * 1024 })).stdout;
    } catch (error) {
      if (optional && (error.code === 1 || error.code === 128)) return null;
      if (error.code === 'ENOENT') throw Error('未找到 Git，请先安装 Git。');
      throw Error(('Git 操作失败：' + (error.stderr || error.message)).slice(0, 1600));
    }
  }
  async function metadata(root) {
    const real = await fs.realpath(root); await guard(real, false);
    const top = await git(real, ['rev-parse', '--show-toplevel'], true);
    if (top === null) return null;
    if (pathKey(await fs.realpath(top.trim())) !== pathKey(real)) throw Error('当前项目位于仓库子目录，请将仓库根目录作为项目打开后使用版本控制。');
    const gitDir = await fs.realpath((await git(real, ['rev-parse', '--absolute-git-dir'])).trim());
    const indexName = path.resolve(real, (await git(real, ['rev-parse', '--git-path', 'index'])).trim());
    const indexPath = await fs.realpath(indexName).catch(async error => { if (error.code !== 'ENOENT') throw error; return path.join(await fs.realpath(path.dirname(indexName)), path.basename(indexName)); });
    const commonDir = await fs.realpath(path.resolve(real, (await git(real, ['rev-parse', '--git-common-dir'])).trim()));
    return { root: real, gitDir, indexPath, commonDir };
  }
  async function snapshot(root) {
    const meta = await metadata(root);
    if (!meta) return { available: false, root, files: [], message: '此项目不是 Git 仓库。请选择已有仓库项目，或在终端初始化后刷新。' };
    const head = (await git(meta.root, ['rev-parse', '--verify', 'HEAD'], true))?.trim() || '';
    const branch = (await git(meta.root, ['symbolic-ref', '--quiet', '--short', 'HEAD'], true))?.trim() || '';
    const remotes = ((await git(meta.root, ['remote'], true)) || '').split(/\r?\n/).filter(Boolean);
    const remoteConfigTokens = await Promise.all(remotes.map(async name => {
      const urls = await git(meta.root, ['config', '--get-all', `remote.${name}.url`], true) || '';
      const pushUrls = await git(meta.root, ['config', '--get-all', `remote.${name}.pushurl`], true) || '';
      return [name, digest(urls), digest(pushUrls)];
    }));
    let upstream = null;
    if (branch) {
      const remote = (await git(meta.root, ['config', '--get', `branch.${branch}.remote`], true))?.trim();
      const merge = (await git(meta.root, ['config', '--get', `branch.${branch}.merge`], true))?.trim();
      if (remote && remotes.includes(remote) && merge?.startsWith('refs/heads/')) {
        const ref = (await git(meta.root, ['rev-parse', '--verify', '--symbolic-full-name', '@{upstream}'], true))?.trim() || '';
        const counts = ref ? (await git(meta.root, ['rev-list', '--left-right', '--count', `HEAD...${ref}`], true))?.trim() : '';
        const [ahead, behind] = counts ? counts.split(/\s+/).map(Number) : [];
        upstream = {
          remote,
          branch: merge.slice('refs/heads/'.length),
          ref: merge,
          name: ref ? ref.replace(/^refs\/remotes\//, '') : `${remote}/${merge.slice('refs/heads/'.length)}`,
          ahead: Number.isInteger(ahead) ? ahead : null,
          behind: Number.isInteger(behind) ? behind : null,
        };
      }
    }
    const raw = await git(meta.root, ['status', '--porcelain=v1', '-z', '--untracked-files=all']);
    const files = parseStatus(raw);
    if (files.length > 1000) throw Error('改动超过 1000 项，请先在终端处理或减少未跟踪文件后刷新。');
    const index = await fs.readFile(meta.indexPath).catch(error => { if (error.code === 'ENOENT') return Buffer.alloc(0); throw error; });
    if (index.length > 32 * 1024 * 1024) throw Error('Git 索引过大，请在终端处理此仓库。');
    await guard(meta.root, false);
    return { available: true, root: meta.root, head, branch, remotes, upstream, files, token: digest(JSON.stringify([meta.root, meta.gitDir, meta.indexPath, meta.commonDir, head, branch, remotes, remoteConfigTokens, upstream, digest(index), raw])), conflict: files.some(f => f.conflict) };
  }
  async function fingerprint(root, name) {
    relativeFile(name);
    let current = root;
    const parts = name.split(/[\\/]/);
    for (const part of parts.slice(0, -1)) {
      current = path.join(current, part);
      const info = await fs.lstat(current).catch(error => { if (error.code === 'ENOENT') return null; throw error; });
      if (!info) return 'missing';
      if (info.isSymbolicLink() || !info.isDirectory()) throw Error('文件父目录是链接或不再是文件夹，请在终端检查。');
    }
    const file = path.join(root, name), info = await fs.lstat(file).catch(error => { if (error.code === 'ENOENT') return null; throw error; });
    if (!info) return 'missing';
    if (info.isSymbolicLink()) return 'link:' + digest(await fs.readlink(file));
    if (!info.isFile()) throw Error('子模块或特殊目录请在终端管理。');
    if (info.size > 64 * 1024 * 1024) throw Error('此文件超过 64 MB，请在终端暂存。');
    const hash = crypto.createHash('sha256');
    for await (const bytes of createReadStream(file)) hash.update(bytes);
    return hash.digest('hex');
  }
  async function matching(root, token) {
    const state = await snapshot(root);
    if (!state.available || typeof token !== 'string' || token !== state.token) throw Error('仓库状态已变化，请刷新并重新查看差异后操作。');
    return state;
  }
  async function fileFingerprint(state, file) {
    const paths = [file.path, ...(file.oldPath ? [file.oldPath] : [])];
    return digest(JSON.stringify(await Promise.all(paths.map(async name => [name, await fingerprint(state.root, name)]))));
  }
  async function hardResetFingerprint(state, resolved) {
    const current = await git(state.root, ['ls-files', '--cached', '-z']);
    const target = await git(state.root, ['ls-tree', '-r', '--name-only', '-z', resolved]);
    const paths = [...new Set((current + target).split('\0').filter(Boolean))].sort();
    if (paths.length > 2000) throw Error('Hard 重置涉及超过 2000 个文件，请在终端核对后处理。');
    const values = [];
    for (const name of paths) values.push([relativeFile(name), await fingerprint(state.root, name)]);
    return { token: digest(JSON.stringify(values)), count: paths.length };
  }
  async function confirmMutation(state, input, descriptor, validateContents) {
    if (typeof confirm !== 'function') throw Error('此操作需要主进程确认。');
    const accepted = await confirm(descriptor);
    await guard(state.root, true);
    const fresh = await matching(state.root, input.token);
    if (!accepted) return { cancelled: true, state: fresh };
    await validateContents();
    return null;
  }
  async function diff(root, input) {
    const state = await matching(root, input?.token), name = relativeFile(input?.path);
    const file = state.files.find(f => f.path === name);
    if (!file || (input.staged ? !file.staged : !file.unstaged)) throw Error('文件状态已变化，请重新选择。');
    const contentToken = await fileFingerprint(state, file);
    let text;
    if (file.untracked) {
      const target = path.join(state.root, name), info = await fs.lstat(target);
      if (info.isSymbolicLink()) text = '新符号链接 → ' + await fs.readlink(target);
      else if (info.size > 1024 * 1024) text = '新文件超过 1 MB，暂不显示全文；仍可选择暂存。';
      else { const bytes = await fs.readFile(target); try { text = bytes.includes(0) ? '二进制新文件（不显示正文）' : new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch { text = '非 UTF-8 或二进制新文件（不显示正文）'; } }
    } else text = await git(state.root, ['diff', ...(input.staged ? ['--cached'] : []), '--no-ext-diff', '--no-textconv', '--no-color', '--unified=3', '--', name, ...(file.oldPath ? [file.oldPath] : [])]);
    if (contentToken !== await fileFingerprint(state, file) || state.token !== (await snapshot(root)).token) throw Error('读取期间文件已变化，请刷新后重新选择。');
    return { path: name, staged: Boolean(input.staged), text: text.slice(0, 200000), truncated: text.length > 200000, contentToken, token: state.token };
  }
  async function mutate(root, input) {
    if (busy) throw Error('Git 操作正在进行，请稍候。');
    if (!['stage', 'unstage', 'commit', 'branch', 'discard', 'reset'].includes(input?.type)) throw Error('Git 操作无效。');
    busy = true;
    try {
      let state = await matching(root, input.token); await guard(state.root, true);
      const meta = await metadata(state.root); await authorize(meta); await guard(state.root, true);
      state = await matching(root, input.token);
      if (input.type === 'stage' || input.type === 'unstage') {
        const name = relativeFile(input.path), file = state.files.find(f => f.path === name);
        if (!file || file.conflict || (input.type === 'stage' ? !file.unstaged : !file.staged)) throw Error('此文件当前不能执行该操作，请先处理冲突或刷新。');
        if (typeof input.contentToken !== 'string' || input.contentToken !== await fileFingerprint(state, file)) throw Error('文件内容在查看后已变化，请重新查看差异。');
        const paths = [name, ...(file.oldPath && (input.type === 'unstage' || /[RC]/.test(file.working)) ? [file.oldPath] : [])];
        if (input.type === 'stage') await git(state.root, ['add', '--', ...paths]);
        else if (state.head) await git(state.root, ['restore', '--staged', '--', ...paths]);
        else await git(state.root, ['update-index', '--force-remove', '--', ...paths]);
      } else if (input.type === 'commit') {
        if (state.conflict) throw Error('请先在终端解决合并冲突。');
        if (!state.files.some(f => f.staged)) throw Error('请先暂存需要提交的文件。');
        const message = typeof input.message === 'string' ? input.message.trim() : '';
        if (!message || message.length > 10000 || message.includes('\0')) throw Error('请输入 1–10000 字符的提交说明。');
        await git(state.root, ['-c', 'commit.gpgSign=false', 'commit', '--no-gpg-sign', '--no-verify', '-m', message]);
      } else if (input.type === 'branch') {
        const name = typeof input.branch === 'string' ? input.branch.trim() : '';
        if (!state.head) throw Error('请完成首次提交后再创建分支。');
        if (!name || name.length > 180 || /^[-.]/.test(name) || /[\s\x00-\x1f{}]/.test(name) || name.includes('@{')) throw Error('请输入有效的新分支名称。');
        await git(state.root, ['check-ref-format', '--branch', name]);
        await git(state.root, ['switch', '-c', name, '--no-track']);
      } else if (input.type === 'discard') {
        const name = relativeFile(input.path), file = state.files.find(entry => entry.path === name);
        if (!file || file.conflict || (input.staged ? !file.staged : !file.unstaged)) throw Error('此文件当前不能丢弃，请先刷新或在终端处理冲突。');
        if (typeof input.contentToken !== 'string' || input.contentToken !== await fileFingerprint(state, file)) throw Error('文件内容在查看后已变化，请重新查看差异。');
        const renamed = file.oldPath && /R/.test(file.index + file.working);
        if (renamed && await fingerprint(state.root, file.oldPath) !== 'missing') throw Error('重命名前的路径已有本地内容，请在终端核对；未覆盖原路径。');
        if (!file.untracked && !state.head) throw Error('尚无提交的仓库不能恢复已跟踪文件。');
        const cancelled = await confirmMutation(state, input, { type: 'discard', path: name, oldPath: renamed ? file.oldPath : null, untracked: file.untracked }, async () => {
          if (input.contentToken !== await fileFingerprint(state, file)) throw Error('文件内容在确认期间已变化，请重新查看差异。');
        });
        if (cancelled) return cancelled;
        if (file.untracked) {
          const target = path.join(state.root, name), info = await fs.lstat(target);
          if (!info.isFile() && !info.isSymbolicLink()) throw Error('仅支持丢弃单个普通文件或符号链接；特殊目录请在终端处理。');
          await fs.unlink(target);
        } else {
          const paths = [name, ...(renamed ? [relativeFile(file.oldPath)] : [])];
          await git(state.root, ['restore', '--source=HEAD', '--staged', '--worktree', '--', ...paths]);
        }
      } else {
        if (!state.head || !state.branch) throw Error('重置需要位于已有提交的分支上；分离 HEAD 或首次提交请在终端处理。');
        if (state.conflict) throw Error('请先在终端核对并处理合并冲突，再重置分支。');
        const mode = ['soft', 'mixed', 'hard'].includes(input.mode) ? input.mode : '';
        if (!mode) throw Error('请选择 soft、mixed 或 hard 重置模式。');
        const target = resetTarget(input.target);
        const resolved = (await git(state.root, ['rev-parse', '--verify', `${target}^{commit}`], true))?.trim();
        if (!resolved || !/^[a-f0-9]{40,64}$/i.test(resolved)) throw Error('找不到有效的目标提交。');
        const reviewed = mode === 'hard' ? await hardResetFingerprint(state, resolved) : null;
        await matching(root, input.token);
        const cancelled = await confirmMutation(state, input, { type: 'reset', mode, target, resolved, branch: state.branch, head: state.head, fileCount: reviewed?.count }, async () => {
          if (reviewed && reviewed.token !== (await hardResetFingerprint(state, resolved)).token) throw Error('受影响文件在确认期间已变化，请刷新后重新确认。');
        });
        if (cancelled) return cancelled;
        await git(state.root, ['reset', `--${mode}`, resolved]);
      }
      return { state: await snapshot(root), action: input.type };
    } finally { busy = false; }
  }
  async function remote(root, input) {
    if (busy) throw Error('Git 操作正在进行，请稍候。');
    if (!['fetch', 'pull', 'push'].includes(input?.type)) throw Error('Git 远端操作无效。');
    if (input.type === 'push' && input.confirmed !== true) throw Error('普通推送需要主进程确认。');
    busy = true;
    try {
      let state = await matching(root, input.token);
      await guard(state.root, true);
      const meta = await metadata(state.root); await authorize(meta); await guard(state.root, true);
      state = await matching(root, input.token);
      let args, pushRemote = '';
      if (input.type === 'fetch') {
        const name = typeof input.remote === 'string' ? input.remote : '';
        if (!state.remotes.includes(name)) throw Error('请选择当前仓库中已配置的远端。');
        args = ['fetch', '--no-tags', '--', name];
      } else if (input.type === 'pull') {
        if (!state.upstream) throw Error('当前分支没有可用的远端跟踪分支。');
        if (state.files.length) throw Error('工作区必须干净才能快进 Pull；本地文件未被修改。');
        if (state.upstream.ahead === null || state.upstream.behind === null) throw Error('请先 Fetch 并刷新跟踪分支状态。');
        if (state.upstream.ahead > 0 && state.upstream.behind > 0) throw Error('本地与远端提交已分叉；快进 Pull 不会改写或丢弃提交。');
        if (state.upstream.behind === 0) throw Error('远端没有可快进的提交。');
        args = ['pull', '--ff-only', '--no-rebase'];
      } else {
        if (!state.head || !state.branch) throw Error('请先在有提交的分支上操作推送。');
        const name = state.upstream?.remote || (typeof input.remote === 'string' ? input.remote : '');
        if (!state.remotes.includes(name)) throw Error('请选择当前仓库中已配置的远端。');
        pushRemote = name;
        if (state.upstream) args = ['push', '--', name, `HEAD:${state.upstream.ref}`];
        else args = ['push', '--set-upstream', '--', name, 'HEAD'];
      }
      try {
        await git(state.root, args, false, 120_000);
      } catch (error) {
        if (error.message === '未找到 Git，请先安装 Git。') throw error;
        throw Error('远端 Git 操作失败。请检查网络、认证和远端状态；为避免泄露凭据，详细输出已隐藏。');
      }
      let warning = '';
      if (pushRemote) {
        try { await git(state.root, ['fetch', '--no-tags', '--', pushRemote], false, 120_000); }
        catch { warning = '推送已成功，但远端状态未刷新；请稍后手动获取远端更新。'; }
      }
      return { state: await snapshot(root), action: input.type, warning };
    } finally { busy = false; }
  }
  // Share the existing Git lock and snapshot validation with remote PR operations.
  // The caller enforces remote-write permissions; this helper never changes Git files.
  async function withRepository(root, input, action) {
    if (busy) throw Error('Git 操作正在进行，请稍候。');
    busy = true;
    try {
      const state = await matching(root, input?.token);
      const assertUnchanged = async () => { await guard(state.root, Boolean(input.write)); await matching(root, input.token); };
      await assertUnchanged();
      if (!state.remotes.includes(input.remote)) throw Error('请选择当前仓库中已配置的远端。');
      const urls = (await git(state.root, ['config', '--get-all', 'remote.' + input.remote + '.url'])).trim().split(/\r?\n/);
      if (urls.length !== 1) throw Error('PR 操作需要只有一个仓库地址的远端。');
      return await action({ state, remoteUrl: urls[0], assertUnchanged });
    } finally { busy = false; }
  }
  return { snapshot, diff, mutate, remote, withRepository, isBusy: () => busy };
}
module.exports = { createGitService, parseStatus, resetTarget };
