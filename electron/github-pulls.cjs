const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');

const API = 'https://api.github.com';
const PAGE_SIZE = 20;
const clean = (value, max = 1000) => typeof value === 'string' ? value.slice(0, max).replace(/\0/g, '') : '';
const sha = value => typeof value === 'string' && /^[a-f0-9]{40,64}$/i.test(value);
function githubRepository(remote) {
  let pathname;
  if (typeof remote !== 'string' || /[\r\n\0]/.test(remote)) throw Error('GitHub 远端格式无效。');
  const ssh = remote.match(/^git@github\.com:([^?#]+)$/i);
  if (ssh) pathname = ssh[1];
  else {
    let url;
    try { url = new URL(remote); } catch { throw Error('所选远端不是 GitHub 仓库。'); }
    if (!['https:', 'ssh:'].includes(url.protocol) || url.hostname.toLowerCase() !== 'github.com' || url.port || url.search || url.hash) throw Error('目前 PR 工作台支持 github.com 的 HTTPS／SSH 远端。');
    pathname = url.pathname.slice(1);
  }
  const parts = pathname.replace(/\/$/, '').replace(/\.git$/i, '').split('/');
  if (parts.length !== 2 || !parts.every(p => /^[a-z0-9_.-]{1,100}$/i.test(p) && !['.', '..'].includes(p))) throw Error('GitHub 仓库名称无效。');
  return { owner: parts[0], name: parts[1], fullName: parts.join('/') };
}
function apiBase(value = API) {
  if (value === API) return value;
  let url;
  try { url = new URL(value); } catch { throw Error('GitHub 测试端点无效。'); }
  if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) || url.pathname !== '/' || url.username || url.password || url.search || url.hash) throw Error('GitHub 测试端点仅支持本机回环。');
  return url.origin;
}
function pullNumber(value) {
  if (!Number.isSafeInteger(value) || value < 1) throw Error('Pull Request 编号无效。');
  return value;
}
function branchName(value) {
  if (typeof value !== 'string' || !value || value.length > 250 || /[\x00-\x20~^:?*\[\\]/.test(value) || value.includes('..') || value.includes('@{') || value.startsWith('-') || value.startsWith('/') || value.endsWith('/') || value.endsWith('.') || value.split('/').some(p => !p || p.startsWith('.') || p.endsWith('.lock'))) throw Error('请填写有效的目标分支名称。');
  return value;
}
function publicPull(value, repo, detail = false) {
  const number = pullNumber(value?.number);
  const result = {
    number, title: clean(value.title, 256), state: value.merged || value.merged_at ? 'merged' : value.state === 'closed' ? 'closed' : 'open',
    draft: Boolean(value.draft), author: clean(value.user?.login, 100), updatedAt: clean(value.updated_at, 40),
    head: clean(value.head?.ref, 250), headSha: sha(value.head?.sha) ? value.head.sha : '', base: clean(value.base?.ref, 250),
    url: 'https://github.com/' + repo.fullName + '/pull/' + number,
  };
  if (detail) Object.assign(result, {
    body: clean(value.body, 65536), mergeable: value.mergeable === true ? true : value.mergeable === false ? false : null,
    mergeableState: clean(value.mergeable_state, 40), additions: Number(value.additions) || 0, deletions: Number(value.deletions) || 0,
    changedFiles: Number(value.changed_files) || 0, commits: Number(value.commits) || 0,
  });
  return result;
}
function createGitHubPulls({ file, encryption, withRepository, authorize = async () => {}, authorizeCredentials = async () => {}, confirm = async () => false, fetchImpl = fetch, endpoint = API, learningRepository = 'song123-jian/-0' }) {
  const origin = apiBase(endpoint);
  let loaded = false, stored = null, disk = null, readError = '', busy = false;
  async function exclusive(operation) {
    if (busy) throw Error('GitHub 操作正在进行，请稍候。');
    busy = true;
    try { return await operation(); } finally { busy = false; }
  }
  async function readDisk() {
    const info = await fs.lstat(file).catch(e => { if (e.code === 'ENOENT') return null; throw e; });
    if (!info) return null;
    if (info.isSymbolicLink() || !info.isFile() || info.size > 65536) throw Error('GitHub 凭据文件不可安全读取。');
    return fs.readFile(file, 'utf8');
  }
  async function ensure() {
    if (loaded) return;
    try {
      disk = await readDisk();
      stored = disk ? JSON.parse(disk) : null;
      if (stored && (stored.version !== 1 || typeof stored.encryptedToken !== 'string' || !stored.encryptedToken || typeof stored.audience !== 'string' || !stored.login)) throw Error('invalid');
    } catch { readError = 'GitHub 连接文件无法读取，原文件已保留；请修正后重启。'; stored = null; }
    loaded = true;
  }
  async function credentials() {
    await ensure();
    if (readError) throw Error(readError);
    if (!stored || stored.audience !== origin) return '';
    if (!encryption.isEncryptionAvailable()) throw Error('Windows 凭据加密不可用，请重新登录。');
    try { return encryption.decryptString(Buffer.from(stored.encryptedToken, 'base64')); }
    catch { throw Error('当前 Windows 用户无法解密 GitHub 凭据，请重新连接。'); }
  }
  async function authState() {
    await ensure();
    const connected = Boolean(stored && stored.audience === origin && !readError);
    return { connected, login: connected ? clean(stored.login, 100) : '', error: readError, encryption: connected ? 'Windows 加密凭据' : '' };
  }
  async function saveDisk(next) {
    if (await readDisk() !== disk) throw Error('GitHub 连接文件已由其他操作修改，请重启后重新连接。');
    await fs.mkdir(path.dirname(file), { recursive: true });
    const temporary = file + '.' + crypto.randomUUID() + '.tmp', text = JSON.stringify(next, null, 2);
    try { await fs.writeFile(temporary, text, { flag: 'wx', mode: 0o600 }); await fs.rename(temporary, file); }
    finally { await fs.rm(temporary, { force: true }).catch(() => {}); }
    disk = text; stored = next;
  }
  async function request(route, { method = 'GET', body, token, write = false, acceptedStatuses = [], signal, timeoutMs = 20_000 } = {}) {
    if (!route.startsWith('/') || route.startsWith('//')) throw Error('GitHub 请求路径无效。');
    const url = new URL(origin + route);
    if (url.origin !== origin) throw Error('GitHub 请求地址无效。');
    await authorize(url, write);
    let secret = token === undefined ? await credentials() : token;
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), timeoutMs);
    const abort = () => controller.abort();
    signal?.addEventListener('abort', abort, { once: true });
    try {
      const headers = { accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'Scodex-Workbench' };
      if (secret) headers.authorization = 'Bearer ' + secret;
      if (body !== undefined) headers['content-type'] = 'application/json';
      const pending = fetchImpl(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), redirect: 'error', signal: controller.signal }); secret = null;
      const response = await pending;
      if (!response.ok) {
        if (acceptedStatuses.includes(response.status)) {
          await response.body?.cancel().catch(() => {});
          return { value: null, more: false, status: response.status };
        }
        await response.body?.cancel().catch(() => {});
        const reason = ({ 401: 'GitHub 连接已失效，请重新填写访问令牌。', 403: 'GitHub 拒绝访问，请检查令牌权限、分支保护或请求限额。', 404: '找不到仓库、分支或 PR，请检查所选远端及令牌的仓库授权。', 405: 'GitHub 拒绝合并，请检查审查、检查项和分支保护。', 409: '远端提交或 PR 状态已变化，请刷新并重新查看。', 422: 'GitHub 校验未通过，请检查分支差异、已有 PR 或仓库权限。', 429: 'GitHub 请求达到限额，请稍后再试。' })[response.status];
        throw Error(reason || 'GitHub 请求失败（HTTP ' + response.status + '），未展示可能包含敏感信息的服务输出。');
      }
      if (!response.body) throw Error('GitHub 响应为空。');
      const reader = response.body.getReader(), chunks = []; let size = 0;
      try { while (true) { const item = await reader.read(); if (item.done) break; size += item.value.byteLength; if (size > 4 * 1024 * 1024) throw Error('GitHub 响应超过 4 MB，请缩小范围。'); chunks.push(Buffer.from(item.value)); } }
      finally { await reader.cancel().catch(() => {}); }
      let value;
      try { value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks))); } catch { throw Error('GitHub 未返回有效的 UTF-8 JSON。'); }
      return { value, more: /rel="next"/.test(response.headers.get('link') || ''), status: response.status };
    } catch (error) {
      if (controller.signal.aborted) throw Error('GitHub 请求超时或已取消。远端写入可能已完成，请刷新目标文件确认，勿直接覆盖。');
      if (error instanceof TypeError) throw Error('无法连接 GitHub，或服务发生重定向。远端写入状态请刷新确认。');
      throw error;
    } finally { secret = null; clearTimeout(timer); signal?.removeEventListener('abort', abort); }
  }
  const prefix = repo => '/repos/' + encodeURIComponent(repo.owner) + '/' + encodeURIComponent(repo.name);
  async function context(root, input, write, action) {
    return exclusive(() => withRepository(root, { token: input?.token, remote: input?.remote, write }, async scope => {
      const repo = githubRepository(scope.remoteUrl), route = prefix(repo);
      return action({ ...scope, repo, route });
    }));
  }
  async function detailData(scope, number) {
    const route = scope.route + '/pulls/' + pullNumber(number);
    const raw = (await request(route)).value;
    if (!raw || raw.number !== number) throw Error('GitHub PR 响应与请求不一致。');
    const pull = publicPull(raw, scope.repo, true);
    const result = await request(route + '/files?per_page=30');
    if (!Array.isArray(result.value)) throw Error('GitHub 文件清单格式无效。');
    pull.files = result.value.slice(0, 30).map(f => ({ name: clean(f.filename, 1000), status: clean(f.status, 40), additions: Number(f.additions) || 0, deletions: Number(f.deletions) || 0, patch: clean(f.patch, 30000) }));
    pull.filesTruncated = result.more || pull.changedFiles > pull.files.length;
    return { raw, pull };
  }
  async function verifyWrittenPull(scope, number, expected) {
    try {
      const raw = (await request(scope.route + '/pulls/' + pullNumber(number))).value;
      if (raw?.number !== number || !expected(raw)) throw Error('远端记录与预期不一致。');
      await scope.assertUnchanged();
      return publicPull(raw, scope.repo, true);
    } catch {
      throw Error('GitHub 已接受操作，但尚未核对最终记录。请刷新 PR 确认状态，勿直接重复提交。');
    }
  }
  return {
    status: authState,
    isBusy: () => busy,
    syncLearningMemory(input) { return exclusive(async () => {
      if (githubRepository('https://github.com/' + learningRepository + '.git').fullName !== learningRepository) throw Error('学习记忆仓库配置无效。');
      if (typeof input?.content !== 'string' || Buffer.byteLength(input.content, 'utf8') > 512 * 1024 || typeof input?.merge !== 'function') throw Error('学习记忆同步数据无效或超过 512 KB。');
      if (!await credentials()) throw Error('GitHub 尚未连接。');
      const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 25_000);
      const repo = githubRepository('https://github.com/' + learningRepository + '.git');
      const route = prefix(repo);
      const name = 'memory/scodex-learning.json';
      const encodedPath = name.split('/').map(encodeURIComponent).join('/');
      const decodeFile = value => {
        if (value === null) return null;
        if (!value || value.path !== name || value.encoding !== 'base64' || typeof value.content !== 'string' || typeof value.sha !== 'string' || !/^[a-f0-9]{40}$/i.test(value.sha)) throw Error('远端学习记忆文件格式无效。');
        const encoded = value.content.replace(/\s/g, '');
        const bytes = Buffer.from(encoded, 'base64');
        if (bytes.length > 512 * 1024 || bytes.toString('base64') !== encoded) throw Error('远端学习记忆文件超过限制或编码无效。');
        try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch { throw Error('远端学习记忆文件不是有效 UTF-8。'); }
      };
      try {
        const repository = (await request(route, { signal: controller.signal, timeoutMs: 10_000 })).value;
        if (!/^[a-zA-Z0-9_.-]{1,250}$/.test(repository?.default_branch || '')) throw Error('GitHub 仓库默认分支无效。');
        const read = async () => request(route + '/contents/' + encodedPath + '?ref=' + encodeURIComponent(repository.default_branch), { signal: controller.signal, timeoutMs: 10_000, acceptedStatuses: [404] });
        const current = await read();
        const remoteText = current.status === 404 ? null : decodeFile(current.value);
        const nextText = await input.merge(remoteText, input.content);
        if (typeof nextText !== 'string' || Buffer.byteLength(nextText, 'utf8') > 512 * 1024) throw Error('合并后的学习记忆文件无效或超过 512 KB。');
        if (remoteText === nextText) return { content: nextText, changed: false };
        const body = {
          message: 'Update encrypted Scodex learning memory',
          content: Buffer.from(nextText, 'utf8').toString('base64'),
          branch: repository.default_branch,
          ...(current.value?.sha ? { sha: current.value.sha } : {}),
        };
        await request(route + '/contents/' + encodedPath, { method: 'PUT', body, write: true, signal: controller.signal, timeoutMs: 10_000 });
        const verified = await read();
        const verifiedText = verified.status === 404 ? null : decodeFile(verified.value);
        if (verifiedText !== nextText) throw Error('GitHub 已接受学习记忆更新，但回读内容不一致。');
        return { content: nextText, changed: true };
      } finally { clearTimeout(timer); }
    }); },
    connect(token) { return exclusive(async () => {
      await ensure(); if (readError) throw Error(readError);
      if (typeof token !== 'string' || !/^[\x21-\x7e]{10,8192}$/.test(token)) throw Error('请填写有效的 GitHub 访问令牌。');
      if (!encryption.isEncryptionAvailable()) throw Error('Windows 凭据加密不可用，未保存令牌。');
      await authorizeCredentials();
      const { value } = await request('/user', { token });
      if (typeof value?.login !== 'string' || !/^[a-z0-9-]{1,100}$/i.test(value.login)) throw Error('GitHub 账号响应无效。');
      await authorizeCredentials();
      await saveDisk({ version: 1, audience: origin, login: value.login, encryptedToken: encryption.encryptString(token).toString('base64') });
      return authState();
    }); },
    disconnect() { return exclusive(async () => {
      await ensure(); if (readError) throw Error(readError);
      await authorizeCredentials();
      if (await readDisk() !== disk) throw Error('GitHub 连接文件已变化，请重启后处理。');
      await fs.rm(file, { force: true }); disk = null; stored = null;
      return authState();
    }); },
    list(root, input) { return context(root, input, false, async scope => {
      const filter = ['open', 'closed', 'all'].includes(input.state) ? input.state : 'open';
      const page = Number.isSafeInteger(input.page) && input.page >= 1 && input.page <= 100 ? input.page : 1;
      const repository = (await request(scope.route)).value;
      if (typeof repository?.default_branch !== 'string') throw Error('GitHub 仓库响应无效。');
      const result = await request(scope.route + '/pulls?state=' + filter + '&sort=updated&direction=desc&per_page=' + PAGE_SIZE + '&page=' + page);
      if (!Array.isArray(result.value)) throw Error('GitHub PR 列表格式无效。');
      await scope.assertUnchanged();
      return { repository: scope.repo.fullName, branch: scope.state.branch, defaultBranch: clean(repository.default_branch, 250), page, more: result.more, mergeMethods: { merge: repository.allow_merge_commit !== false, squash: repository.allow_squash_merge !== false }, pulls: result.value.slice(0, PAGE_SIZE).map(p => publicPull(p, scope.repo)) };
    }); },
    detail(root, input) { return context(root, input, false, async scope => {
      const { pull } = await detailData(scope, pullNumber(input.number));
      await scope.assertUnchanged(); return pull;
    }); },
    action(root, input) { return context(root, input, true, async scope => {
      if (!['create', 'ready', 'merge'].includes(input?.type)) throw Error('PR 操作无效。');
      if (!await credentials()) throw Error('请先连接有相应仓库权限的 GitHub 账号。');
      // Explicitly enforce the write policy before even preparing a mutation.
      await authorize(new URL(origin + scope.route), true);
      if (input.type === 'create') {
        const base = branchName(input.base), head = branchName(scope.state.branch);
        const title = typeof input.title === 'string' ? input.title.trim() : '', body = typeof input.body === 'string' ? input.body : '';
        if (!title || title.length > 256 || /[\x00-\x1f]/.test(title) || body.length > 65536 || body.includes('\0')) throw Error('请填写有效的 PR 标题（1–256 字符）及说明（最多65536字符）。');
        if (base === head || !scope.state.head) throw Error('目标分支须与当前已提交的分支不同。');
        const verifyHead = async () => {
          const ref = (await request(scope.route + '/git/ref/heads/' + head.split('/').map(encodeURIComponent).join('/'))).value;
          if (ref?.object?.sha !== scope.state.head) throw Error('请先普通推送当前分支；GitHub 分支必须与本地 HEAD 完全一致。');
        };
        await verifyHead();
        const comparison = (await request(scope.route + '/compare/' + encodeURIComponent(base) + '...' + encodeURIComponent(head))).value;
        if (!(comparison?.ahead_by > 0)) throw Error('当前分支相对目标分支没有可提交的差异。');
        const existing = (await request(scope.route + '/pulls?state=open&head=' + encodeURIComponent(scope.repo.owner + ':' + head) + '&base=' + encodeURIComponent(base) + '&per_page=1')).value;
        if (!Array.isArray(existing)) throw Error('GitHub PR 检索响应无效。');
        if (existing.length) { await scope.assertUnchanged(); return { existing: true, pull: publicPull(existing[0], scope.repo, true) }; }
        if (!await confirm({ type: 'create', repository: scope.repo.fullName, title, head, base, draft: Boolean(input.draft) })) return { cancelled: true };
        await scope.assertUnchanged(); await verifyHead();
        const result = (await request(scope.route + '/pulls', { method: 'POST', write: true, body: { title, body, base, head, draft: Boolean(input.draft), maintainer_can_modify: true } })).value;
        const pull = await verifyWrittenPull(scope, result?.number, value => value.state === 'open' && !value.merged && value.head?.ref === head && value.head?.sha === scope.state.head && value.base?.ref === base && value.draft === Boolean(input.draft));
        return { pull };
      }
      const number = pullNumber(input.number), { raw, pull } = await detailData(scope, number);
      if (pull.state !== 'open') throw Error('此 PR 已关闭或合并，请刷新状态。');
      if (!sha(input.headSha) || input.headSha !== pull.headSha) throw Error('PR 提交已变化，请重新查看详情后操作。');
      const method = input.method;
      if (input.type === 'ready') {
        if (!pull.draft || !/^[a-z0-9_=-]{1,256}$/i.test(raw.node_id || '')) throw Error('此 PR 不是可转换的草稿，请刷新。');
      } else {
        if (!['merge', 'squash'].includes(method)) throw Error('请选择合并提交或压缩合并。');
        if (pull.draft) throw Error('请先将草稿标记为可审查。');
        if (pull.mergeable !== true) throw Error(pull.mergeable === null ? 'GitHub 正在计算合并状态，请稍后刷新详情。' : '此 PR 存在冲突，无法合并。');
      }
      if (!await confirm({ type: input.type, repository: scope.repo.fullName, ...pull, method })) return { cancelled: true };
      await scope.assertUnchanged();
      const latest = (await request(scope.route + '/pulls/' + number)).value;
      if (latest?.head?.sha !== pull.headSha || latest?.state !== 'open' || latest?.draft !== raw.draft || latest?.merged) throw Error('PR 在确认期间发生变化，请重新查看后操作。');
      if (input.type === 'ready') {
        const response = (await request('/graphql', { method: 'POST', write: true, body: { query: 'mutation($id:ID!){markPullRequestReadyForReview(input:{pullRequestId:$id}){pullRequest{number isDraft}}}', variables: { id: raw.node_id } } })).value;
        const ready = response?.data?.markPullRequestReadyForReview?.pullRequest;
        if (response.errors?.length || ready?.number !== number || ready.isDraft !== false) throw Error('GitHub 未确认草稿转换成功，请刷新后检查账号权限。');
        const verified = await verifyWrittenPull(scope, number, value => value.state === 'open' && !value.merged && value.draft === false && value.head?.sha === pull.headSha);
        return { pull: verified };
      }
      const result = (await request(scope.route + '/pulls/' + number + '/merge', { method: 'PUT', write: true, body: { sha: pull.headSha, merge_method: method } })).value;
      if (result?.merged !== true) throw Error('GitHub 未确认合并成功，请刷新后检查审查与分支保护。');
      const verified = await verifyWrittenPull(scope, number, value => Boolean(value.merged || value.merged_at) && value.state === 'closed' && (!sha(result.sha) || value.merge_commit_sha === result.sha));
      return { pull: verified, mergeSha: sha(result.sha) ? result.sha : '' };
    }); },
  };
}
module.exports = { createGitHubPulls, githubRepository, branchName };
