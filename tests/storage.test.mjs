import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { normalizeLibrary, createConversation } = require('../electron/conversations.cjs');
const { storageUsage } = require('../electron/storage.cjs');
const { createAgentService } = require('../electron/agents.cjs');
const { createWorktreeService } = require('../electron/worktrees.cjs');
const executeFile = promisify(execFile);
async function temporary(t) { const root = await fs.mkdtemp(path.join(os.tmpdir(), 'scodex-storage-unit-')); t.after(() => fs.rm(root, { recursive: true, force: true })); return root; }
const git = (repo, args) => executeFile('git', ['-C', repo, ...args], { windowsHide: true, encoding: 'utf8' });
async function eventually(predicate) { for (let i = 0; i < 150; i++) { if (await predicate()) return; await new Promise((resolve) => setTimeout(resolve, 20)); } throw new Error('Timed out'); }

test('archives survive v2 round trip and never become the active conversation', () => {
  const archived = { ...createConversation('code'), archivedAt: new Date().toISOString(), draft: '中文草稿 🚀' };
  const library = normalizeLibrary({ activeId: archived.id, conversations: [archived] });
  assert.equal(library.conversations.length, 2);
  assert.notEqual(library.activeId, archived.id);
  assert.equal(library.conversations.find((chat) => chat.id === archived.id).draft, '中文草稿 🚀');
  const roundTrip = normalizeLibrary(JSON.parse(JSON.stringify(library)));
  assert.equal(roundTrip.activeId, library.activeId);
  assert.deepEqual(
    roundTrip.conversations.map(({ id, archivedAt, draft }) => ({ id, archivedAt, draft })),
    library.conversations.map(({ id, archivedAt, draft }) => ({ id, archivedAt, draft })),
  );
  assert.equal(normalizeLibrary({ conversations: [{ id: 'old' }] }).conversations[0].archivedAt, null);
});

test('storage categories sum to actual file bytes, including archives and unknown files', async (t) => {
  const root = await temporary(t);
  const archive = { ...createConversation(), archivedAt: new Date().toISOString(), draft: '归档' };
  const library = normalizeLibrary({ conversations: [createConversation(), archive] });
  const files = { 'conversations.json': JSON.stringify(library), 'agent-runs.json': JSON.stringify({ tasks: [{ result: '独立结果' }] }), 'settings.json': '{"fontSize":16}', 'unknown.bin': Buffer.alloc(90) };
  for (const [name, data] of Object.entries(files)) await fs.writeFile(path.join(root, name), data);
  await fs.mkdir(path.join(root, 'worktrees')); await fs.writeFile(path.join(root, 'worktrees', 'sample.txt'), 'file');
  const result = await storageUsage(root);
  const expected = Object.values(files).reduce((sum, data) => sum + Buffer.byteLength(data), 4);
  assert.equal(result.total, expected);
  assert.equal(result.sizes.worktrees, 4);
  assert.equal(result.sizes.agents, Buffer.byteLength(files['agent-runs.json']));
  assert.equal(result.sizes.archived, Buffer.byteLength(JSON.stringify(library.conversations[1])));
  assert.equal(result.complete, true);
});

test('agent execution persists result; cancellation protects running records and restart marks interruption', async (t) => {
  const root = await temporary(t);
  const agents = createAgentService(root, async (task, controller) => task.prompt === '取消测试' ? new Promise((resolve, reject) => controller.signal.addEventListener('abort', () => reject(new Error('Stopped')), { once: true })) : '测试返回 🚀');
  await agents.initialize();
  const complete = await agents.start({ parentId: 'chat', prompt: '独立测试' });
  await eventually(async () => (await agents.list()).find((task) => task.id === complete.id).status === 'complete');
  assert.equal((await agents.list())[0].result, '测试返回 🚀');
  const pending = await agents.start({ parentId: 'chat', prompt: '取消测试' });
  await eventually(async () => (await agents.list())[0].status === 'running');
  await assert.rejects(agents.remove([pending.id]), /先停止/);
  assert.equal(agents.cancel(pending.id), true);
  await eventually(async () => (await agents.list())[0].status === 'cancelled');
  await agents.remove([pending.id]);
  const file = path.join(root, 'agent-runs.json');
  const state = JSON.parse(await fs.readFile(file, 'utf8')); state.tasks[0].status = 'running'; await fs.writeFile(file, JSON.stringify(state));
  await createAgentService(root, async () => '').initialize();
  assert.equal(JSON.parse(await fs.readFile(file, 'utf8')).tasks[0].status, 'interrupted');
});

test('corrupt agent records are preserved and prompt failures never invoke execution', async (t) => {
  const root = await temporary(t); let calls = 0;
  const agents = createAgentService(root, async () => { calls++; return 'unused'; });
  await assert.rejects(agents.start({ prompt: '' }), /填写/);
  await fs.writeFile(path.join(root, 'agent-runs.json'), '{broken');
  await assert.rejects(agents.start({ prompt: '不要覆盖原文件' }), /原文件已保留/);
  assert.equal(await fs.readFile(path.join(root, 'agent-runs.json'), 'utf8'), '{broken');
  assert.equal(calls, 0);
});

test('real Git worktrees retain modified/ignored/new-commit/current copies and clean only approved IDs', async (t) => {
  const root = await temporary(t); const repo = path.join(root, 'repo'); const data = path.join(root, 'profile');
  await fs.mkdir(repo); await fs.mkdir(data);
  await git(repo, ['init']); await fs.writeFile(path.join(repo, 'readme.txt'), 'initial'); await fs.writeFile(path.join(repo, '.gitignore'), 'ignored.txt\n');
  await git(repo, ['add', '.']); await git(repo, ['-c', 'user.name=Storage Test', '-c', 'user.email=storage@example.invalid', 'commit', '-m', 'fixture']);
  let current = repo;
  const trees = createWorktreeService(data, () => current);
  const first = await trees.create(repo); const second = await trees.create(repo);
  assert.equal(await fs.readFile(path.join(first.path, 'readme.txt'), 'utf8'), 'initial');
  await fs.writeFile(path.join(first.path, 'ignored.txt'), 'do not delete');
  await assert.rejects(trees.remove(first.id), /有修改/);
  assert.equal((await trees.list()).trees.find((item) => item.id === first.id).dirty, true);
  await fs.rm(path.join(first.path, 'ignored.txt'));
  await git(first.path, ['-c', 'user.name=Storage Test', '-c', 'user.email=storage@example.invalid', 'commit', '--allow-empty', '-m', 'unmerged']);
  await assert.rejects(trees.remove(first.id), /创建后的提交/);
  current = second.path; await assert.rejects(trees.remove(second.id), /正在使用/); current = repo;
  await trees.setRetention(1);
  await assert.rejects(trees.cleanup([second.id]), /列表已变化/);
  await trees.setRetention(0);
  const results = await trees.cleanup([first.id, second.id]);
  assert.equal(results[0].removed, false); assert.equal(results[1].removed, true);
  await assert.rejects(fs.access(second.path)); await fs.access(first.path);
  await assert.rejects(trees.setRetention(-1), /0–20/);
});

test('worktree root junction cannot redirect deletion outside the managed directory', async (t) => {
  const root = await temporary(t); const profile = path.join(root, 'profile'); const outside = path.join(root, 'outside');
  await fs.mkdir(profile); await fs.mkdir(outside);
  const id = 'd87d5bfb-80b2-4587-a010-83d3b979a8ea';
  await fs.mkdir(path.join(outside, id)); await fs.writeFile(path.join(outside, id, 'keep.txt'), 'preserved');
  await fs.symlink(outside, path.join(profile, 'worktrees'), process.platform === 'win32' ? 'junction' : 'dir');
  await fs.writeFile(path.join(profile, 'worktree-state.json'), JSON.stringify({ retainCount: 0, trees: [{ id, path: path.join(profile, 'worktrees', id), repository: root }] }));
  await assert.rejects(createWorktreeService(profile, () => root).remove(id), /根目录不能是符号链接/);
  assert.equal(await fs.readFile(path.join(outside, id, 'keep.txt'), 'utf8'), 'preserved');
});
