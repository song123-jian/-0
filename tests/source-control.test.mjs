import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url), { createGitService, parseStatus } = require('../electron/git-service.cjs');
const execute = promisify(execFile);
const gitAt = async (directory, ...args) => (await execute('git', ['-c', 'core.quotepath=false', '-c', 'commit.gpgSign=false', '-C', directory, ...args], { windowsHide: true, encoding: 'utf8' })).stdout.trim();
async function fixture(t, options = {}) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'scodex-git-unit-'));
  t.after(async () => { assert.ok(path.basename(root).startsWith('scodex-git-unit-')); await fs.rm(root, { recursive: true, force: true }); });
  const repo = path.join(root, 'repo'); await fs.mkdir(repo);
  const git = async (...args) => (await execute('git', ['-c', 'core.hooksPath=' + path.join(root, 'hooks'), '-C', repo, ...args], { windowsHide: true, encoding: 'utf8' })).stdout.trim();
  await git('init', '-b', 'main'); await git('config', 'user.name', 'Fixture'); await git('config', 'user.email', 'fixture@example.invalid'); await git('config', 'commit.gpgSign', 'false');
  const service = createGitService({ hooksDirectory: path.join(root, 'hooks'), confirm: async () => true, ...options });
  const write = (n, value) => fs.writeFile(path.join(repo, n), value);
  const stage = async (n, type = 'stage') => { const s = await service.snapshot(repo), d = await service.diff(repo, { path: n, staged: type === 'unstage', token: s.token }); return service.mutate(repo, { type, path: n, token: s.token, contentToken: d.contentToken }); };
  const commit = async (message = 'fixture commit') => service.mutate(repo, { type: 'commit', token: (await service.snapshot(repo)).token, message });
  return { root, repo, git, service, write, stage, commit };
}
test('NUL status parses Unicode, spaces and rename without quoting loss', () => {
  const files = parseStatus(' M 中文 空格.txt\0R  新名.txt\0旧名.txt\0?? --all.txt\0');
  assert.equal(files[0].path, '中文 空格.txt'); assert.equal(files[1].oldPath, '旧名.txt'); assert.equal(files[1].staged, true); assert.equal(files[2].untracked, true);
});
test('unborn stage and unstage preserve working file even when edited again', async t => {
  const f = await fixture(t); await f.write('新文件.txt', '第一版'); await f.stage('新文件.txt'); await f.write('新文件.txt', '第二版'); await f.stage('新文件.txt', 'unstage');
  const s = await f.service.snapshot(f.repo); assert.equal(s.head, ''); assert.equal(s.files[0].untracked, true); assert.equal(await fs.readFile(path.join(f.repo, '新文件.txt'), 'utf8'), '第二版');
});
test('discard requires confirmation and restores tracked changes or removes one untracked file', async t => {
  let accepted = false;
  const f = await fixture(t, { confirm: async () => accepted }); await f.write('tracked.txt', '提交版本\n'); await f.stage('tracked.txt'); await f.commit();
  await f.write('tracked.txt', '暂存版本\n'); await f.stage('tracked.txt'); await f.write('tracked.txt', '工作区版本\n');
  let state = await f.service.snapshot(f.repo), diff = await f.service.diff(f.repo, { path: 'tracked.txt', token: state.token });
  const cancelled = await f.service.mutate(f.repo, { type: 'discard', path: 'tracked.txt', token: state.token, contentToken: diff.contentToken, confirmed: true });
  assert.equal(cancelled.cancelled, true);
  assert.equal(await fs.readFile(path.join(f.repo, 'tracked.txt'), 'utf8'), '工作区版本\n');
  accepted = true;
  const restored = await f.service.mutate(f.repo, { type: 'discard', path: 'tracked.txt', token: state.token, contentToken: diff.contentToken, confirmed: true });
  assert.equal((await fs.readFile(path.join(f.repo, 'tracked.txt'), 'utf8')).replace(/\r\n/g, '\n'), '提交版本\n'); assert.equal(restored.state.files.length, 0);

  await f.write('untracked.txt', '待删除\n'); state = await f.service.snapshot(f.repo); diff = await f.service.diff(f.repo, { path: 'untracked.txt', token: state.token });
  const removed = await f.service.mutate(f.repo, { type: 'discard', path: 'untracked.txt', token: state.token, contentToken: diff.contentToken, confirmed: true });
  await assert.rejects(fs.lstat(path.join(f.repo, 'untracked.txt')), { code: 'ENOENT' }); assert.equal(removed.state.files.length, 0);
});
test('discard refuses content and repository changes made after the reviewed snapshot', async t => {
  const f = await fixture(t); await f.write('tracked.txt', '提交版本\n'); await f.stage('tracked.txt'); await f.commit(); await f.write('tracked.txt', '查看时内容\n');
  const reviewed = await f.service.snapshot(f.repo), diff = await f.service.diff(f.repo, { path: 'tracked.txt', token: reviewed.token });
  await f.write('tracked.txt', '外部新内容\n');
  await assert.rejects(f.service.mutate(f.repo, { type: 'discard', path: 'tracked.txt', token: reviewed.token, contentToken: diff.contentToken, confirmed: true }), /内容在查看后已变化/);
  assert.equal(await fs.readFile(path.join(f.repo, 'tracked.txt'), 'utf8'), '外部新内容\n');
  const fresh = await f.service.snapshot(f.repo), freshDiff = await f.service.diff(f.repo, { path: 'tracked.txt', token: fresh.token });
  await f.write('other.txt', '索引变化\n'); await f.git('add', '--', 'other.txt');
  await assert.rejects(f.service.mutate(f.repo, { type: 'discard', path: 'tracked.txt', token: fresh.token, contentToken: freshDiff.contentToken, confirmed: true }), /仓库状态已变化/);
  assert.equal(await fs.readFile(path.join(f.repo, 'tracked.txt'), 'utf8'), '外部新内容\n');
});
test('soft, mixed and hard reset preserve or replace the correct Git state', async t => {
  const f = await fixture(t); await f.write('tracked.txt', '基线\n'); await f.stage('tracked.txt'); await f.commit('基线');
  const base = await f.git('rev-parse', 'HEAD'); await f.write('tracked.txt', '第二次提交\n'); await f.stage('tracked.txt'); await f.commit('第二次提交');
  const second = await f.git('rev-parse', 'HEAD'); await f.write('tracked.txt', '本地未提交\n'); await f.write('untracked.txt', '保留的未跟踪文件\n');
  let state = await f.service.snapshot(f.repo);
  const unconfirmed = createGitService({ hooksDirectory: path.join(f.root, 'hooks') });
  await assert.rejects(unconfirmed.mutate(f.repo, { type: 'reset', target: base, mode: 'hard', token: state.token, confirmed: true }), /主进程确认/);
  await assert.rejects(f.service.mutate(f.repo, { type: 'reset', target: 'not-a-commit', mode: 'hard', token: state.token, confirmed: true }), /提交 SHA/);

  const soft = await f.service.mutate(f.repo, { type: 'reset', target: base, mode: 'soft', token: state.token, confirmed: true });
  assert.equal(soft.state.head, base); assert.equal(await fs.readFile(path.join(f.repo, 'tracked.txt'), 'utf8'), '本地未提交\n');
  assert.equal(soft.state.files.find(file => file.path === 'tracked.txt').staged, true);
  const mixed = await f.service.mutate(f.repo, { type: 'reset', target: second, mode: 'mixed', token: soft.state.token, confirmed: true });
  assert.equal(mixed.state.head, second); assert.equal(await fs.readFile(path.join(f.repo, 'tracked.txt'), 'utf8'), '本地未提交\n');
  assert.equal(mixed.state.files.find(file => file.path === 'tracked.txt').staged, false); assert.equal(mixed.state.files.find(file => file.path === 'tracked.txt').unstaged, true);
  const hard = await f.service.mutate(f.repo, { type: 'reset', target: base, mode: 'hard', token: mixed.state.token, confirmed: true });
  assert.equal(hard.state.head, base); assert.equal((await fs.readFile(path.join(f.repo, 'tracked.txt'), 'utf8')).replace(/\r\n/g, '\n'), '基线\n');
  assert.equal(await fs.readFile(path.join(f.repo, 'untracked.txt'), 'utf8'), '保留的未跟踪文件\n'); assert.equal(hard.state.files.length, 1); assert.equal(hard.state.files[0].untracked, true);
});
test('destructive Git operations still honor the write guard and reject detached HEAD resets', async t => {
  const f = await fixture(t); await f.write('tracked.txt', '基线\n'); await f.stage('tracked.txt'); await f.commit();
  const state = await f.service.snapshot(f.repo); let writes = 0;
  const guarded = createGitService({ hooksDirectory: path.join(f.root, 'hooks'), guard: async (_root, write) => { if (write) { writes += 1; throw Error('未保存保护'); } } });
  await assert.rejects(guarded.mutate(f.repo, { type: 'reset', target: 'HEAD', mode: 'hard', token: state.token, confirmed: true }), /未保存保护/);
  assert.ok(writes > 0); assert.equal(await fs.readFile(path.join(f.repo, 'tracked.txt'), 'utf8'), '基线\n');
  await f.git('checkout', '--detach', 'HEAD'); const detached = await f.service.snapshot(f.repo);
  await assert.rejects(f.service.mutate(f.repo, { type: 'reset', target: 'HEAD', mode: 'hard', token: detached.token, confirmed: true }), /分离 HEAD/);
});
test('confirmation holds the Git lock and refuses same-status external content changes', async t => {
  let duringConfirm = async () => true;
  const f = await fixture(t, { confirm: item => duringConfirm(item) });
  await f.write('tracked.txt', '原始'); await f.stage('tracked.txt'); await f.commit(); await f.write('tracked.txt', '查看内容');
  const state = await f.service.snapshot(f.repo), d = await f.service.diff(f.repo, { path: 'tracked.txt', token: state.token });
  duringConfirm = async item => {
    assert.equal(item.type, 'discard'); assert.equal(f.service.isBusy(), true);
    await assert.rejects(f.service.mutate(f.repo, { type: 'commit', token: state.token, message: '并发' }), /操作正在进行/);
    await f.write('tracked.txt', '确认期间的外部内容');
    assert.equal((await f.service.snapshot(f.repo)).token, state.token);
    return true;
  };
  await assert.rejects(f.service.mutate(f.repo, { type: 'discard', path: 'tracked.txt', token: state.token, contentToken: d.contentToken }), /确认期间已变化/);
  assert.equal(await fs.readFile(path.join(f.repo, 'tracked.txt'), 'utf8'), '确认期间的外部内容'); assert.equal(f.service.isBusy(), false);
});

test('hard reset checks tracked and target-only paths after confirmation', async t => {
  let duringConfirm = async () => true;
  const f = await fixture(t, { confirm: item => duringConfirm(item) });
  await f.write('tracked.txt', '第一版'); await f.write('target-only.txt', '目标文件'); await f.stage('tracked.txt'); await f.stage('target-only.txt'); await f.commit();
  const target = await f.git('rev-parse', 'HEAD'); await f.git('rm', '--', 'target-only.txt'); await f.commit(); await f.write('tracked.txt', '本地版本');
  let state = await f.service.snapshot(f.repo);
  duringConfirm = async item => { assert.equal(item.resolved, target); assert.equal(item.fileCount, 2); await f.write('tracked.txt', '确认时外部变化'); return true; };
  await assert.rejects(f.service.mutate(f.repo, { type: 'reset', mode: 'hard', target, token: state.token }), /确认期间已变化/);
  assert.notEqual(await f.git('rev-parse', 'HEAD'), target); assert.equal(await fs.readFile(path.join(f.repo, 'tracked.txt'), 'utf8'), '确认时外部变化');
  await f.write('target-only.txt', '已有未跟踪文件'); state = await f.service.snapshot(f.repo);
  duringConfirm = async () => { await f.write('target-only.txt', '新未跟踪内容'); return true; };
  await assert.rejects(f.service.mutate(f.repo, { type: 'reset', mode: 'hard', target, token: state.token }), /确认期间已变化/);
  assert.equal(await fs.readFile(path.join(f.repo, 'target-only.txt'), 'utf8'), '新未跟踪内容');
});

test('discard handles staged additions and renames without overwriting an occupied original path', async t => {
  const f = await fixture(t); await f.write('old.txt', '保留原文'); await f.stage('old.txt'); await f.commit();
  await f.write('added.txt', '暂存新增'); await f.stage('added.txt');
  let state = await f.service.snapshot(f.repo), d = await f.service.diff(f.repo, { path: 'added.txt', staged: true, token: state.token });
  await f.service.mutate(f.repo, { type: 'discard', path: 'added.txt', staged: true, token: state.token, contentToken: d.contentToken });
  await assert.rejects(fs.access(path.join(f.repo, 'added.txt')), { code: 'ENOENT' });
  await f.git('mv', '--', 'old.txt', 'new.txt');
  state = await f.service.snapshot(f.repo); d = await f.service.diff(f.repo, { path: 'new.txt', staged: true, token: state.token });
  await f.write('old.txt', '不要覆盖的新文件');
  await assert.rejects(f.service.mutate(f.repo, { type: 'discard', path: 'new.txt', staged: true, token: state.token, contentToken: d.contentToken }), /仓库状态已变化|内容在查看后已变化/);
  state = await f.service.snapshot(f.repo); d = await f.service.diff(f.repo, { path: 'new.txt', staged: true, token: state.token });
  await assert.rejects(f.service.mutate(f.repo, { type: 'discard', path: 'new.txt', staged: true, token: state.token, contentToken: d.contentToken }), /原路径/);
  assert.equal(await fs.readFile(path.join(f.repo, 'old.txt'), 'utf8'), '不要覆盖的新文件');
  await fs.unlink(path.join(f.repo, 'old.txt')); state = await f.service.snapshot(f.repo); d = await f.service.diff(f.repo, { path: 'new.txt', staged: true, token: state.token });
  await f.service.mutate(f.repo, { type: 'discard', path: 'new.txt', staged: true, token: state.token, contentToken: d.contentToken });
  assert.equal(await fs.readFile(path.join(f.repo, 'old.txt'), 'utf8'), '保留原文'); await assert.rejects(fs.access(path.join(f.repo, 'new.txt')), { code: 'ENOENT' });
});

test('confirmation cannot bypass changed guard or changed index', async t => {
  let allowed = true, changeIndex = false;
  const f = await fixture(t, { guard: async (_root, write) => { if (write && !allowed) throw Error('权限已变化'); }, confirm: async () => { if (changeIndex) await f.git('add', '--', 'extra.txt'); else allowed = false; return true; } });
  await f.write('tracked.txt', '提交内容'); await f.stage('tracked.txt'); await f.commit(); await f.write('tracked.txt', '本地内容');
  let state = await f.service.snapshot(f.repo);
  await assert.rejects(f.service.mutate(f.repo, { type: 'reset', mode: 'hard', target: 'HEAD', token: state.token }), /权限已变化/);
  allowed = true; changeIndex = true; await f.write('extra.txt', '额外文件'); state = await f.service.snapshot(f.repo);
  await assert.rejects(f.service.mutate(f.repo, { type: 'reset', mode: 'mixed', target: 'HEAD', token: state.token }), /仓库状态已变化/);
  assert.equal(await fs.readFile(path.join(f.repo, 'tracked.txt'), 'utf8'), '本地内容');
});

test('commit contains only staged Unicode file and preserves unstaged data', async t => {
  const f = await fixture(t); await f.write('中文 空格.txt', '原文'); await f.stage('中文 空格.txt'); await f.commit(); await f.write('中文 空格.txt', '已暂存内容'); await f.write('保留.txt', '未暂存'); await f.stage('中文 空格.txt');
  const result = await f.commit('中文提交'); assert.equal(result.state.files.length, 1); assert.equal(result.state.files[0].path, '保留.txt'); assert.equal(await f.git('show', 'HEAD:中文 空格.txt'), '已暂存内容'); assert.equal(await fs.readFile(path.join(f.repo, '保留.txt'), 'utf8'), '未暂存');
});
test('same status but changed file content rejects stale staging', async t => {
  const f = await fixture(t); await f.write('a.txt', '原文'); const s = await f.service.snapshot(f.repo), d = await f.service.diff(f.repo, { path: 'a.txt', token: s.token }); await f.write('a.txt', '外部修改');
  assert.equal((await f.service.snapshot(f.repo)).token, s.token); await assert.rejects(f.service.mutate(f.repo, { type: 'stage', path: 'a.txt', token: s.token, contentToken: d.contentToken }), /内容.*变化/); assert.equal((await f.service.snapshot(f.repo)).files[0].untracked, true);
});
test('external index changes reject stale operation', async t => {
  const f = await fixture(t); await f.write('a.txt', 'a'); await f.write('b.txt', 'b'); const s = await f.service.snapshot(f.repo), d = await f.service.diff(f.repo, { path: 'a.txt', token: s.token }); await f.git('add', '--', 'b.txt');
  await assert.rejects(f.service.mutate(f.repo, { type: 'stage', path: 'a.txt', token: s.token, contentToken: d.contentToken }), /仓库状态已变化/); assert.equal(await f.git('diff', '--cached', '--name-only'), 'b.txt');
});
test('literal leading dash filenames stage and inspect, traversal is rejected', async t => {
  const f = await fixture(t); await f.write('--all.txt', '字面路径'); await f.stage('--all.txt'); await f.commit(); await assert.rejects(f.service.diff(f.repo, { path: '../escape', token: (await f.service.snapshot(f.repo)).token }), /路径无效/); assert.equal(await f.git('show', 'HEAD:--all.txt'), '字面路径');
});
test('staged rename can stage newer edits and unstage without losing either path', async t => {
  const f = await fixture(t), original = Array.from({ length: 20 }, (_, i) => '相同内容第' + i + '行').join('\n') + '\n';
  const changed = original.replace('相同内容第5行', '这里是更新内容');
  await f.write('old.txt', original); await f.stage('old.txt'); await f.commit(); await f.git('mv', 'old.txt', 'new.txt'); await f.write('new.txt', changed); await f.stage('new.txt');
  assert.equal((await f.service.snapshot(f.repo)).files.find(f => f.path === 'new.txt').oldPath, 'old.txt');
  await f.stage('new.txt', 'unstage'); assert.equal(await fs.readFile(path.join(f.repo, 'new.txt'), 'utf8'), changed); await assert.rejects(fs.access(path.join(f.repo, 'old.txt'))); assert.equal(await f.git('diff', '--cached', '--name-only'), '');
});
test('independent deletion remains staged when unrelated addition is unstaged', async t => {
  const f = await fixture(t); await f.write('old.txt', '原始一行\n'); await f.stage('old.txt'); await f.commit(); await fs.unlink(path.join(f.repo, 'old.txt')); await f.write('new.txt', '完全不同的新内容\n'); await f.git('add', '--', 'old.txt', 'new.txt');
  assert.equal((await f.service.snapshot(f.repo)).files.find(f => f.path === 'new.txt').oldPath, null); await f.stage('new.txt', 'unstage'); assert.equal(await f.git('diff', '--cached', '--name-only'), 'old.txt'); assert.equal(await fs.readFile(path.join(f.repo, 'new.txt'), 'utf8'), '完全不同的新内容\n');
});
test('tracked deletion and binary previews are real and do not decode binary', async t => {
  const f = await fixture(t); await f.write('a.txt', '待删除'); await f.stage('a.txt'); await f.commit(); await fs.unlink(path.join(f.repo, 'a.txt')); await f.stage('a.txt'); const s = await f.service.snapshot(f.repo); const diff = await f.service.diff(f.repo, { path: 'a.txt', staged: true, token: s.token }); assert.match(diff.text, /deleted file mode/); await f.write('b.bin', Buffer.from([0, 255, 25])); const b = await f.service.snapshot(f.repo); assert.match((await f.service.diff(f.repo, { path: 'b.bin', token: b.token })).text, /二进制/);
});
test('new branch is real and leaves uncommitted content intact', async t => {
  const f = await fixture(t); await f.write('a.txt', '提交'); await f.stage('a.txt'); await f.commit(); await f.write('a.txt', '未提交'); const s = await f.service.snapshot(f.repo); const result = await f.service.mutate(f.repo, { type: 'branch', token: s.token, branch: 'scodex/中文功能' }); assert.equal(result.state.branch, 'scodex/中文功能'); assert.equal(await fs.readFile(path.join(f.repo, 'a.txt'), 'utf8'), '未提交'); await assert.rejects(f.service.mutate(f.repo, { type: 'branch', token: result.state.token, branch: '-bad' }), /分支名称/);
});
test('non-repository is clear and nested project cannot mutate its parent repository', async t => {
  const f = await fixture(t); const plain = path.join(f.root, 'plain'); await fs.mkdir(plain); assert.equal((await f.service.snapshot(plain)).available, false); const nested = path.join(f.repo, 'nested'); await fs.mkdir(nested); await assert.rejects(f.service.snapshot(nested), /仓库子目录/);
});
test('write guard and approval policy are checked again before any write', async t => {
  let denied = false; const f = await fixture(t, { guard: async (_root, write) => { if (write && denied) throw Error('未保存保护'); }, authorize: async () => { denied = true; } }); await f.write('a.txt', '保留'); const s = await f.service.snapshot(f.repo), d = await f.service.diff(f.repo, { path: 'a.txt', token: s.token }); await assert.rejects(f.service.mutate(f.repo, { type: 'stage', path: 'a.txt', token: s.token, contentToken: d.contentToken }), /未保存保护/); assert.equal((await f.service.snapshot(f.repo)).files[0].untracked, true); assert.equal(f.service.isBusy(), false);
});
test('missing identity or empty staged set never loses staged content', async t => {
  const f = await fixture(t); await assert.rejects(f.commit(), /先暂存/); await f.write('a.txt', '已暂存保留'); await f.stage('a.txt'); await f.git('config', 'user.name', ''); await assert.rejects(f.commit(), /Git 操作失败/); assert.equal((await f.service.snapshot(f.repo)).files[0].staged, true);
});
test('unresolved merge conflicts block stage and commit', async t => {
  const f = await fixture(t); await f.write('a.txt', 'base\n'); await f.stage('a.txt'); await f.commit(); await f.git('switch', '-c', 'other'); await f.write('a.txt', 'other\n'); await f.git('commit', '-am', 'other'); await f.git('switch', 'main'); await f.write('a.txt', 'main\n'); await f.git('commit', '-am', 'main'); await assert.rejects(f.git('merge', 'other')); const s = await f.service.snapshot(f.repo); assert.equal(s.conflict, true); await assert.rejects(f.service.mutate(f.repo, { type: 'commit', token: s.token, message: '拒绝冲突提交' }), /冲突/); assert.match(await fs.readFile(path.join(f.repo, 'a.txt'), 'utf8'), /<<<<<<< /);
});

test('real metadata paths are authorized when .git is a directory link', async t => {
  let authorized; const f = await fixture(t, { authorize: async meta => { authorized = meta; } });
  const external = path.join(f.root, 'external-git'); await fs.rename(path.join(f.repo, '.git'), external); await fs.symlink(external, path.join(f.repo, '.git'), process.platform === 'win32' ? 'junction' : 'dir');
  await f.write('linked.txt', '链接元数据'); await f.stage('linked.txt'); assert.equal(authorized.gitDir, await fs.realpath(external)); assert.equal(authorized.commonDir, await fs.realpath(external)); assert.equal(authorized.indexPath, path.join(await fs.realpath(external), 'index'));
});
test('managed worktree authorizes shared common directory and local index', async t => {
  let authorized; const f = await fixture(t, { authorize: async meta => { authorized = meta; } }); await f.write('a.txt', 'base'); await f.stage('a.txt'); await f.commit();
  const worktree = path.join(f.root, 'tree'); await f.git('worktree', 'add', '--detach', '--', worktree, 'HEAD'); await fs.writeFile(path.join(worktree, 'new.txt'), '隔离修改');
  const s = await f.service.snapshot(worktree), d = await f.service.diff(worktree, { path: 'new.txt', token: s.token }); await f.service.mutate(worktree, { type: 'stage', path: 'new.txt', token: s.token, contentToken: d.contentToken }); assert.equal(authorized.commonDir, await fs.realpath(path.join(f.repo, '.git'))); assert.ok(authorized.indexPath.includes(path.join('worktrees', 'tree', 'index'))); await assert.rejects(fs.access(path.join(f.repo, 'new.txt')));
});

test('only an exact registered worktree can use model files inside app data', async t => {
  const f = await fixture(t), { createWorktreeService } = require('../electron/worktrees.cjs'), { createAgentTools } = require('../electron/agent-tools.cjs'); await f.write('base.txt', 'base'); await f.stage('base.txt'); await f.commit();
  const profile = path.join(f.root, 'profile'), manager = createWorktreeService(profile, () => f.repo), tree = await manager.create(f.repo);
  assert.equal(await manager.isManagedWorkspace(tree.path), true); assert.equal(await manager.isManagedWorkspace(profile), false); assert.equal(await manager.isManagedWorkspace(path.join(tree.path, 'child')), false);
  const blocked = createAgentTools({ workspaceRoot: tree.path, protectedPaths: [profile] }); await assert.rejects(blocked.execute('read_file', { path: 'base.txt' }), /受保护目录/);
  const access = await manager.projectAccess(tree.path, [profile, path.join(f.root, 'secrets')]); assert.equal(access.managed, true); assert.deepEqual(access.paths, [path.join(f.root, 'secrets')]); await assert.rejects(manager.projectAccess(profile, [profile]), /必须是路径有效/);
  const tools = createAgentTools({ workspaceRoot: tree.path, protectedPaths: access.paths }); await tools.execute('write_file', { path: 'model.txt', expected_hash: 'new', content: '模型隔离写入' }); assert.equal(await fs.readFile(path.join(tree.path, 'model.txt'), 'utf8'), '模型隔离写入'); await assert.rejects(tools.execute('read_file', { path: '../../settings.json' }), /当前项目/); await assert.rejects(tools.execute('write_file', { path: 'auth.json', expected_hash: 'new', content: '禁止' }), /受保护目录/); await assert.rejects(fs.access(path.join(f.repo, 'model.txt')));
});
test('registered worktree root replaced by junction is not allowed', async t => {
  const f = await fixture(t), { createWorktreeService } = require('../electron/worktrees.cjs'); await f.write('a.txt', 'base'); await f.stage('a.txt'); await f.commit();
  const manager = createWorktreeService(path.join(f.root, 'profile'), () => f.repo), tree = await manager.create(f.repo), moved = path.join(f.root, 'moved'); await fs.rename(tree.path, moved); await fs.symlink(moved, tree.path, process.platform === 'win32' ? 'junction' : 'dir'); assert.equal(await manager.isManagedWorkspace(tree.path), false); await assert.rejects(manager.projectAccess(tree.path, []), /必须是路径有效/);
});

test('development service resolves only a registered app-data worktree', async t => {
  const f = await fixture(t), { createWorktreeService } = require('../electron/worktrees.cjs'), { createDevServices } = require('../electron/dev-services.cjs'); await f.write('a.txt', 'base'); await f.stage('a.txt'); await f.commit();
  const profile = path.join(f.root, 'profile'), manager = createWorktreeService(profile, () => f.repo), tree = await manager.create(f.repo);
  const services = createDevServices({ protectedPaths: async root => (await manager.projectAccess(root, [profile])).paths }); t.after(() => services.shutdown());
  assert.equal((await services.resolve(tree.path, '.')).target, await fs.realpath(tree.path)); await assert.rejects(services.resolve(profile, '.'), /必须是路径有效/); await fs.mkdir(path.join(tree.path, '.codex')); await assert.rejects(services.resolve(tree.path, '.codex'), /凭据或应用配置目录/); await assert.rejects(services.resolve(tree.path, '../..'), /当前项目/);
});

test('fetch reports remote tracking counts and Pull fast-forwards only a clean worktree', async t => {
  const f = await fixture(t), bare = path.join(f.root, 'origin.git'), peer = path.join(f.root, 'peer');
  await f.write('base.txt', '初始内容\n'); await f.stage('base.txt'); await f.commit('初始提交');
  await execute('git', ['init', '--bare', '--initial-branch=main', bare], { windowsHide: true });
  await f.git('remote', 'add', 'origin', bare); await f.git('push', '--set-upstream', 'origin', 'HEAD');
  const branch = await f.git('branch', '--show-current');
  await execute('git', ['clone', '--branch', branch, '--', bare, peer], { windowsHide: true });
  await gitAt(peer, 'config', 'user.name', 'Peer'); await gitAt(peer, 'config', 'user.email', 'peer@example.invalid');
  await fs.writeFile(path.join(peer, 'remote.txt'), '远端提交\n'); await gitAt(peer, 'add', '--', 'remote.txt'); await gitAt(peer, 'commit', '-m', '远端提交'); await gitAt(peer, 'push');

  const beforeFetch = await f.service.snapshot(f.repo);
  assert.equal(beforeFetch.upstream.remote, 'origin'); assert.equal(beforeFetch.upstream.ahead, 0); assert.equal(beforeFetch.upstream.behind, 0);
  const fetched = await f.service.remote(f.repo, { type: 'fetch', remote: 'origin', token: beforeFetch.token });
  assert.equal(fetched.state.upstream.behind, 1); assert.notEqual(fetched.state.token, beforeFetch.token);
  await fs.writeFile(path.join(f.repo, 'base.txt'), '保留本地内容\n');
  const dirty = await f.service.snapshot(f.repo);
  await assert.rejects(f.service.remote(f.repo, { type: 'pull', token: dirty.token }), /工作区必须干净/);
  assert.equal(await fs.readFile(path.join(f.repo, 'base.txt'), 'utf8'), '保留本地内容\n');
  await f.git('checkout', '--', 'base.txt');
  const clean = await f.service.snapshot(f.repo), pulled = await f.service.remote(f.repo, { type: 'pull', token: clean.token });
  assert.equal(pulled.state.upstream.behind, 0); assert.equal(pulled.state.files.length, 0);
  assert.equal((await fs.readFile(path.join(f.repo, 'remote.txt'), 'utf8')).replace(/\r\n/g, '\n'), '远端提交\n');
});

test('Push requires main-process confirmation, sets upstream once, and uses an ordinary refspec', async t => {
  const f = await fixture(t), bare = path.join(f.root, 'origin.git');
  await f.write('push.txt', '推送内容\n'); await f.stage('push.txt'); await f.commit('待推送');
  await execute('git', ['init', '--bare', '--initial-branch=main', bare], { windowsHide: true }); await f.git('remote', 'add', 'origin', bare);
  const initial = await f.service.snapshot(f.repo);
  await assert.rejects(f.service.remote(f.repo, { type: 'push', remote: 'origin', token: initial.token }), /主进程确认/);
  assert.equal(await gitAt(bare, 'for-each-ref', '--format=%(refname)', 'refs/heads'), '');
  const result = await f.service.remote(f.repo, { type: 'push', remote: 'origin', token: initial.token, confirmed: true });
  assert.equal(result.state.upstream.remote, 'origin'); assert.equal(result.state.upstream.ahead, 0); assert.equal(result.state.upstream.behind, 0); assert.equal(result.warning, '');
  assert.equal(await gitAt(bare, 'rev-parse', 'refs/heads/main'), await f.git('rev-parse', 'HEAD'));
});

test('diverged Pull and credential-bearing remote failures are refused without leaking URLs', async t => {
  const f = await fixture(t), bare = path.join(f.root, 'origin.git'), peer = path.join(f.root, 'peer');
  await f.write('base.txt', '初始内容\n'); await f.stage('base.txt'); await f.commit('初始提交');
  await execute('git', ['init', '--bare', '--initial-branch=main', bare], { windowsHide: true });
  await f.git('remote', 'add', 'origin', bare); await f.git('push', '--set-upstream', 'origin', 'HEAD');
  await execute('git', ['clone', '--branch', 'main', '--', bare, peer], { windowsHide: true });
  await gitAt(peer, 'config', 'user.name', 'Peer'); await gitAt(peer, 'config', 'user.email', 'peer@example.invalid');
  await fs.writeFile(path.join(peer, 'peer.txt'), '远端独有\n'); await gitAt(peer, 'add', '--', 'peer.txt'); await gitAt(peer, 'commit', '-m', '远端独有'); await gitAt(peer, 'push');
  await f.write('local.txt', '本地独有\n'); await f.stage('local.txt'); await f.commit('本地独有');
  const fetched = await f.service.remote(f.repo, { type: 'fetch', remote: 'origin', token: (await f.service.snapshot(f.repo)).token });
  assert.equal(fetched.state.upstream.ahead, 1); assert.equal(fetched.state.upstream.behind, 1);
  await assert.rejects(f.service.remote(f.repo, { type: 'pull', token: fetched.state.token }), /提交已分叉/);
  const remoteHead = await gitAt(bare, 'rev-parse', 'refs/heads/main');
  await f.git('remote', 'set-url', 'origin', 'https://user:remote-secret@127.0.0.1:1/repository.git');
  const changedRemote = await f.service.snapshot(f.repo);
  assert.notEqual(changedRemote.token, fetched.state.token);
  await assert.rejects(f.service.remote(f.repo, { type: 'fetch', remote: 'origin', token: changedRemote.token }), error => {
    assert.match(error.message, /详细输出已隐藏/); assert.doesNotMatch(error.message, /user|remote-secret|127\.0\.0\.1/); return true;
  });
  await f.git('remote', 'set-url', 'origin', bare);
  const restored = await f.service.snapshot(f.repo);
  await assert.rejects(f.service.remote(f.repo, { type: 'push', token: restored.token, remote: 'origin', confirmed: true }), /远端 Git 操作失败/);
  assert.equal(await gitAt(bare, 'rev-parse', 'refs/heads/main'), remoteHead);
});
