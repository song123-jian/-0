import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { createGitHubPulls, githubRepository, branchName } = require('../electron/github-pulls.cjs');
const { createGitService } = require('../electron/git-service.cjs');
const { decryptMemory, emptyMemory, encryptMemory, mergeMemories } = require('../electron/learning-memory.cjs');
const { startGitHubFixture } = require('./github-pulls-fixture.cjs');
const execute = promisify(execFile);
async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'scodex-pr-service-')), repo = path.join(root, 'repo'), file = path.join(root, 'profile', 'github.json');
  await fs.mkdir(repo);
  const git = async (...args) => (await execute('git', ['-c', 'core.hooksPath=' + path.join(root, 'hooks'), '-c', 'commit.gpgSign=false', '-C', repo, ...args], { windowsHide: true, encoding: 'utf8' })).stdout.trim();
  await git('init', '-b', 'main'); await git('config', 'user.name', 'Fixture'); await git('config', 'user.email', 'fixture@example.invalid');
  await fs.writeFile(path.join(repo, '中文.txt'), '基线\n'); await git('add', '--', '中文.txt'); await git('commit', '-m', 'fixture'); await git('switch', '-c', 'feature/workbench-pr');
  await git('remote', 'add', 'origin', 'https://github.com/scodex-fixture/workbench.git');
  const api = await startGitHubFixture({ head: await git('rev-parse', 'HEAD') });
  t.after(async () => { await api.close(); assert.ok(path.basename(root).startsWith('scodex-pr-service-')); await fs.rm(root, { force: true, recursive: true }); });
  const key = crypto.randomBytes(32);
  const encryption = { isEncryptionAvailable: () => true, encryptString(value) { const iv = crypto.randomBytes(12), cipher = crypto.createCipheriv('aes-256-gcm', key, iv); const data = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]); return Buffer.concat([iv, cipher.getAuthTag(), data]); }, decryptString(value) { const decipher = crypto.createDecipheriv('aes-256-gcm', key, value.subarray(0, 12)); decipher.setAuthTag(value.subarray(12, 28)); return Buffer.concat([decipher.update(value.subarray(28)), decipher.final()]).toString('utf8'); } };
  const policy = { network: true, write: true, confirm: true };
  const gitService = createGitService({ hooksDirectory: path.join(root, 'hooks') });
  const options = { file, encryption, endpoint: api.endpoint, withRepository: gitService.withRepository, authorize: async (_url, write) => { if (!policy.network) throw Error('网络关闭'); if (write && !policy.write) throw Error('只读模式'); }, authorizeCredentials: async () => {}, confirm: async info => { api.state.confirmed.push(info.type); if (policy.onConfirm) await policy.onConfirm(info); return policy.confirm; } };
  const service = createGitHubPulls(options);
  const input = async extra => ({ token: (await gitService.snapshot(repo)).token, remote: 'origin', ...extra });
  const action = async extra => service.action(repo, await input(extra));
  const create = async (draft = true) => action({ type: 'create', base: 'main', title: '清晰的工作台', body: '实际 Git 与受控 GitHub 服务', draft });
  return { root, repo, file, git, api, service, gitService, input, action, create, policy, options };
}
test('GitHub remote and base validation reject other hosts and invalid refs', () => {
  for (const remote of ['git@github.com:owner/repo.git', 'ssh://git@github.com/owner/repo.git', 'https://github.com/owner/repo']) assert.deepEqual(githubRepository(remote), { owner: 'owner', name: 'repo', fullName: 'owner/repo' });
  for (const remote of ['https://github.com.evil.invalid/o/r', 'https://example.invalid/o/r', 'file:///tmp/repo', 'https://github.com/o/r?token=x']) assert.throws(() => githubRepository(remote));
  for (const ref of ['../main', '-branch', 'a.lock', 'x//y', 'a b', 'x@{1}']) assert.throws(() => branchName(ref));
  assert.equal(branchName('feature/中文'), 'feature/中文');
});
test('connection encrypts, survives service restart, never returns token and binds audience', async t => {
  const f = await fixture(t); const status = await f.service.connect(f.api.token);
  assert.equal(status.connected, true); assert.equal(status.login, 'scodex-fixture'); assert.ok(!JSON.stringify(status).includes(f.api.token));
  const disk = await fs.readFile(f.file, 'utf8'); assert.ok(!disk.includes(f.api.token)); assert.equal(JSON.parse(disk).audience, f.api.endpoint);
  const restarted = createGitHubPulls(f.options); assert.equal((await restarted.status()).connected, true); await restarted.list(f.repo, await f.input());
  assert.ok(f.api.state.requests.at(-1).authenticated);
  let leaked = false;
  const production = createGitHubPulls({ ...f.options, endpoint: undefined, fetchImpl: async (_url, options) => { leaked ||= Boolean(options.headers.authorization); return new Response(JSON.stringify(_url.pathname.endsWith('/pulls') ? [] : { default_branch: 'main' })); } });
  assert.equal((await production.status()).connected, false); await production.list(f.repo, await f.input()); assert.equal(leaked, false);
  assert.throws(() => createGitHubPulls({ ...f.options, endpoint: 'https://example.invalid/' }), /本机回环/);
  await restarted.disconnect(); await assert.rejects(fs.access(f.file)); assert.equal((await restarted.status()).connected, false);
});
test('actual Git and HTTP complete draft, duplicate, review and SHA-bound squash merge', async t => {
  const f = await fixture(t); await f.service.connect(f.api.token);
  const list = await f.service.list(f.repo, await f.input()); assert.equal(list.defaultBranch, 'main'); assert.deepEqual(list.pulls, []);
  const first = await f.create(); assert.equal(first.pull.draft, true); assert.equal(f.api.state.writes.length, 1); assert.match(f.api.state.requests.at(-1).route, /\/pulls\/1$/);
  const duplicate = await f.create(); assert.equal(duplicate.existing, true); assert.equal(f.api.state.writes.length, 1);
  const detail = await f.service.detail(f.repo, await f.input({ number: 1 })); assert.equal(detail.files[0].name, 'src/工作台.jsx'); assert.match(detail.files[0].patch, /清晰的工作台/);
  const ready = await f.action({ type: 'ready', number: 1, headSha: detail.headSha }); assert.equal(ready.pull.draft, false);
  const merged = await f.action({ type: 'merge', number: 1, headSha: detail.headSha, method: 'squash' }); assert.equal(merged.pull.state, 'merged'); assert.match(merged.mergeSha, /^[a-f0-9]{40}$/);
  assert.deepEqual(f.api.state.confirmed, ['create', 'ready', 'merge']); assert.deepEqual(f.api.state.writes.at(-1).body, { sha: detail.headSha, merge_method: 'squash' });
  assert.equal(await f.git('rev-parse', 'HEAD'), detail.headSha); assert.equal(f.api.state.pulls[0].head.ref, 'feature/workbench-pr');
  const closed = await f.service.list(f.repo, await f.input({ state: 'closed' })); assert.equal(closed.pulls[0].state, 'merged');
});
test('network, read-only, cancellation and post-confirm policy changes prevent writes', async t => {
  const f = await fixture(t); await f.service.connect(f.api.token);
  f.policy.network = false; const count = f.api.state.requests.length; await assert.rejects(f.create(), /网络关闭/); assert.equal(f.api.state.requests.length, count);
  f.policy.network = true; f.policy.write = false; await assert.rejects(f.create(), /只读模式/); assert.equal(f.api.state.requests.length, count);
  f.policy.write = true; f.policy.confirm = false; assert.equal((await f.create()).cancelled, true); assert.equal(f.api.state.writes.length, 0);
  f.policy.confirm = true; f.policy.onConfirm = async () => { f.policy.write = false; }; await assert.rejects(f.create(), /只读模式/); assert.equal(f.api.state.writes.length, 0);
});
test('stale snapshot, changed remote, unpushed HEAD and no differences reject create', async t => {
  const f = await fixture(t); await f.service.connect(f.api.token);
  const stale = await f.input({ type: 'create', base: 'main', title: '不得创建' }); await f.git('remote', 'set-url', 'origin', 'https://github.com/scodex-fixture/changed.git');
  await assert.rejects(f.service.action(f.repo, stale), /仓库状态已变化/); await f.git('remote', 'set-url', 'origin', 'https://github.com/scodex-fixture/workbench.git');
  const head = f.api.state.head; f.api.state.head = 'f'.repeat(40); await assert.rejects(f.create(), /普通推送/); f.api.state.head = head;
  f.api.state.ahead = 0; await assert.rejects(f.create(), /没有可提交的差异/); assert.equal(f.api.state.writes.length, 0);
});
test('confirmation binds repository and PR head and shares the Git lock', async t => {
  const f = await fixture(t); await f.service.connect(f.api.token);
  f.policy.onConfirm = async () => { assert.equal(f.gitService.isBusy(), true); await assert.rejects(f.gitService.withRepository(f.repo, await f.input(), async () => {}), /Git 操作正在进行/); await f.git('remote', 'set-url', 'origin', 'https://github.com/scodex-fixture/changed.git'); };
  await assert.rejects(f.create(), /仓库状态已变化/); assert.equal(f.api.state.writes.length, 0); assert.equal(f.service.isBusy(), false);
  await f.git('remote', 'set-url', 'origin', 'https://github.com/scodex-fixture/workbench.git'); f.policy.onConfirm = null; const p = (await f.create(false)).pull;
  f.policy.onConfirm = async () => { f.api.state.pulls[0].head.sha = 'e'.repeat(40); };
  await assert.rejects(f.action({ type: 'merge', number: p.number, headSha: p.headSha, method: 'merge' }), /确认期间发生变化/); assert.equal(f.api.state.writes.length, 1);
});
test('merge state, private errors and size/encoding failures remain truthful', async t => {
  const f = await fixture(t); await f.service.connect(f.api.token); const p = (await f.create()).pull;
  await assert.rejects(f.action({ type: 'merge', number: p.number, headSha: p.headSha, method: 'merge' }), /草稿/);
  f.api.state.pulls[0].draft = false; f.api.state.pulls[0].mergeable = null;
  await assert.rejects(f.action({ type: 'merge', number: p.number, headSha: p.headSha, method: 'merge' }), /正在计算/);
  f.api.state.pulls[0].mergeable = false; await assert.rejects(f.action({ type: 'merge', number: p.number, headSha: p.headSha, method: 'merge' }), /冲突/);
  for (const status of [401, 403, 404, 405, 409, 422, 429, 500]) { f.api.state.failStatus = status; await assert.rejects(f.service.list(f.repo, await f.input()), error => !error.message.includes('private-service-output') && /GitHub|仓库|PR/.test(error.message)); } f.api.state.failStatus = 0;
  for (const [body, expected] of [[Buffer.from([255]), /UTF-8 JSON/], ['x'.repeat(4 * 1024 * 1024 + 1), /超过 4 MB/]]) { const service = createGitHubPulls({ ...f.options, fetchImpl: async () => new Response(body) }); await assert.rejects(service.list(f.repo, await f.input()), expected); }
});
test('successful mutation without matching GET readback never claims completion', async t => {
  const f = await fixture(t); await f.service.connect(f.api.token); f.api.state.failReadback = true;
  await assert.rejects(f.create(), /已接受操作.*尚未核对/); assert.equal(f.api.state.pulls.length, 1); f.api.state.failReadback = false;
  const p = f.api.state.pulls[0]; f.api.state.mismatch = true;
  await assert.rejects(f.action({ type: 'ready', number: p.number, headSha: p.head.sha }), /已接受操作.*尚未核对/);
  p.draft = false; await assert.rejects(f.action({ type: 'merge', number: p.number, headSha: p.head.sha, method: 'merge' }), /已接受操作.*尚未核对/); assert.equal(p.state, 'open');
});
test('learning memory creates and updates only the encrypted fixed GitHub Contents file, then verifies readback', async t => {
  const f = await fixture(t); await f.service.connect(f.api.token);
  const service = createGitHubPulls({ ...f.options, learningRepository: 'scodex-fixture/workbench' });
  const secret = '仅用于本地 fixture 的偏好明文';
  const now = Date.now();
  const makeMemory = (text, updatedAt) => ({ ...emptyMemory(), updatedAt: new Date(updatedAt).toISOString(), entries: [{ id: 'fixture_entry', kind: 'preference', text, createdAt: new Date(now).toISOString(), updatedAt: new Date(updatedAt).toISOString() }] });
  const synchronize = async local => service.syncLearningMemory({
    content: encryptMemory(local, f.options.encryption),
    merge: remoteText => encryptMemory(mergeMemories(local, remoteText === null ? emptyMemory() : decryptMemory(remoteText, f.options.encryption)), f.options.encryption),
  });

  const firstLocal = makeMemory(secret, now);
  const first = await synchronize(firstLocal);
  assert.deepEqual(first, { content: first.content, changed: true });
  assert.equal(f.api.state.memoryWrites.length, 1);
  assert.equal(f.api.state.memoryWrites[0].path, 'memory/scodex-learning.json');
  assert.equal(f.api.state.memoryWrites[0].branch, 'main');
  assert.equal(f.api.state.memoryWrites[0].previousSha, '');
  assert.ok(!f.api.state.memoryWrites[0].content.includes(secret));
  const remoteText = Buffer.from(f.api.state.memoryFile.content, 'base64').toString('utf8');
  assert.equal(remoteText, first.content);
  assert.equal(decryptMemory(remoteText, f.options.encryption).entries[0].text, secret);

  const secondLocal = makeMemory('更新后的安全偏好', now + 1000);
  const second = await synchronize(secondLocal);
  assert.equal(second.changed, true);
  assert.equal(f.api.state.memoryWrites.length, 2);
  assert.equal(f.api.state.memoryWrites[1].previousSha, f.api.state.memoryWrites[0].sha);
  assert.equal(Buffer.from(f.api.state.memoryFile.content, 'base64').toString('utf8'), second.content);
  assert.equal(decryptMemory(second.content, f.options.encryption).entries[0].text, '更新后的安全偏好');
  assert.deepEqual(f.api.state.requests.filter(item => item.route.includes('/contents/')).map(item => item.method), ['GET', 'PUT', 'GET', 'GET', 'PUT', 'GET']);
});
test('credential file concurrency and unavailable encryption preserve existing file', async t => {
  const f = await fixture(t); await f.service.connect(f.api.token); await fs.writeFile(f.file, '{"changed":true}');
  await assert.rejects(f.service.disconnect(), /已变化/); assert.equal(await fs.readFile(f.file, 'utf8'), '{"changed":true}');
  const unavailable = createGitHubPulls({ ...f.options, file: path.join(f.root, 'unavailable.json'), encryption: { isEncryptionAvailable: () => false } });
  await assert.rejects(unavailable.connect(f.api.token), /加密不可用/); await assert.rejects(fs.access(path.join(f.root, 'unavailable.json')));
});
