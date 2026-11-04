import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { createTaskFileChanges, difference } = require('../electron/task-file-changes.cjs');
const { withFileCommit } = require('../electron/file-commit.cjs');
const encryption = { isEncryptionAvailable: () => true, encryptString: text => Buffer.from(text), decryptString: buffer => buffer.toString() };
async function fixture(t) { const root = await fs.mkdtemp(path.join(os.tmpdir(), 'scodex-file-changes-')); t.after(() => fs.rm(root, { recursive: true, force: true })); const workspace = path.join(root, 'workspace'); await fs.mkdir(workspace); const directory = path.join(root, 'records'); return { root, workspace, directory, service: createTaskFileChanges(directory, { encryption }) }; }

test('command capture is not exhausted by 16 MiB of unchanged workspace files and reuses safe baselines', async t => {
  const { workspace, service, directory } = await fixture(t);
  for (let i = 0; i < 36; i++) await fs.writeFile(path.join(workspace, String(i).padStart(2, '0') + '.txt'), Buffer.alloc(512 * 1024, 97));
  const target = path.join(workspace, 'z.txt'); await fs.writeFile(target, 'original\n');
  const tracker = service.begin(crypto.randomUUID(), workspace, 'chat');
  await tracker.command(() => fs.writeFile(target, 'changed\n'));
  await tracker.command(() => fs.writeFile(target, 'final\n'));
  const result = await tracker.finish(); assert.equal(result.warning, '');
  assert.equal(result.files.length, 1); assert.equal(result.files[0].path, 'z.txt');
  assert.ok(result.coverage.reusedFiles >= 70); assert.ok(result.coverage.readBytes < 20 * 1024 * 1024);
  await service.undo(result.id, { conversationId: 'chat', validate: async () => {}, withCommit: withFileCommit });
  assert.equal(await fs.readFile(target, 'utf8'), 'original\n');
  assert.ok(!(await fs.readdir(directory)).some(name => name.startsWith('scan-')));
});

test('limited command inventory reports incomplete coverage and never invents an addition baseline', async t => {
  const { workspace, directory } = await fixture(t);
  const service = createTaskFileChanges(directory, { encryption, scanLimits: { maxEntries: 2 } });
  for (const name of ['a', 'b', 'z']) await fs.writeFile(path.join(workspace, name), 'user content\n');
  const tracker = service.begin(crypto.randomUUID(), workspace, 'chat');
  await tracker.command(async () => { await fs.unlink(path.join(workspace, 'a')); await fs.writeFile(path.join(workspace, 'z'), 'changed\n'); });
  const result = await tracker.finish(); assert.match(result.warning, /不完整/);
  assert.equal(result.coverage.complete, false); assert.equal(result.coverage.reasons.entries > 0, true);
  assert.ok(!result.files.some(file => file.path === 'z' && file.kind === 'added'));
  await assert.rejects(() => service.undo(result.id, { conversationId: 'chat', validate: async () => {}, withCommit: withFileCommit }), /不完整/);
});

test('aborting before capture prevents the command from running', async t => {
  const { workspace, service } = await fixture(t), controller = new AbortController(); controller.abort();
  const tracker = service.begin(crypto.randomUUID(), workspace, 'chat'); let ran = false;
  await assert.rejects(() => tracker.command(async () => { ran = true; }, { signal: controller.signal }), /停止/);
  assert.equal(ran, false); await tracker.finish();
});
test('line diff counts actual disjoint edits and empty/new/binary files', () => {
  const before = Buffer.from('one\ntwo\nthree\nfour\n'), after = Buffer.from('ONE\ntwo\nthree\nFOUR\n'); const diff = difference(before, after); assert.equal(diff.added, 2); assert.equal(diff.removed, 2); assert.match(diff.diff, / two/);
  assert.equal(difference(null, Buffer.from('a\nb\n')).added, 2); assert.equal(difference(Buffer.from('a\n'), null).removed, 1); assert.equal(difference(null, Buffer.alloc(0)).added, 0); assert.equal(difference(Buffer.from([0]), Buffer.from([1])).added, null);
});

test('summary requests avoid loading full diffs but preserve counts and conversation binding', async t => {
  const { workspace, service } = await fixture(t), tracker = service.begin(crypto.randomUUID(), workspace, 'chat');
  await tracker.run(() => withFileCommit(path.join(workspace, 'new.txt'), () => fs.writeFile(path.join(workspace, 'new.txt'), 'new\n')));
  const record = await tracker.finish(), summary = await service.details(record.id, 'chat', { summaryOnly: true });
  assert.equal(summary.files[0].added, 1); assert.equal(summary.files[0].diff, undefined);
  assert.match((await service.details(record.id, 'chat')).files[0].diff, /[+]new/);
  await assert.rejects(service.details(record.id, 'other', { summaryOnly: true }), /不属于/);
});
test('repeated writes aggregate task baseline, preserve dirty prior content and persist undo', async t => {
  const { workspace, directory, service } = await fixture(t), file = path.join(workspace, 'dirty.txt'), created = path.join(workspace, 'new.txt'); await fs.writeFile(file, 'user unsaved-to-git\n');
  const tracker = service.begin(crypto.randomUUID(), workspace, 'chat');
  await tracker.run(async () => { await withFileCommit(file, () => fs.writeFile(file, 'intermediate\n')); await withFileCommit(file, () => fs.writeFile(file, 'final\n')); await withFileCommit(created, () => fs.writeFile(created, 'new\n')); });
  const summary = await tracker.finish(); assert.equal(summary.files.length, 2); assert.equal(summary.files[0].added, 1);
  const reopened = createTaskFileChanges(directory, { encryption }); const details = await reopened.details(summary.id, 'chat'); assert.match(details.files[0].diff, /-user unsaved-to-git/); assert.doesNotMatch(details.files[0].diff, /intermediate/);
  await assert.rejects(() => reopened.details(summary.id, 'wrong-chat'), /不属于/);
  const result = await reopened.undo(summary.id, { conversationId: 'chat', validate: async () => {}, withCommit: withFileCommit }); assert.equal(result.undone, true); assert.equal(await fs.readFile(file, 'utf8'), 'user unsaved-to-git\n'); await assert.rejects(() => fs.stat(created), { code: 'ENOENT' }); assert.equal((await reopened.details(summary.id, 'chat')).undone, true);
});
test('preflight rejects later changes before restoring any files', async t => {
  const { workspace, service } = await fixture(t), a = path.join(workspace, 'a'), b = path.join(workspace, 'b'); await fs.writeFile(a, 'old a'); await fs.writeFile(b, 'old b'); const tracker = service.begin(crypto.randomUUID(), workspace, 'chat');
  await tracker.run(async () => { await withFileCommit(a, () => fs.writeFile(a, 'task a')); await withFileCommit(b, () => fs.writeFile(b, 'task b')); }); const summary = await tracker.finish(); await fs.writeFile(b, 'later user edit');
  await assert.rejects(() => service.undo(summary.id, { conversationId: 'chat', validate: async () => {}, withCommit: withFileCommit }), /后续修改/); assert.equal(await fs.readFile(a, 'utf8'), 'task a'); assert.equal(await fs.readFile(b, 'utf8'), 'later user edit');
});
test('real command disk snapshots capture additions and deletions, exclude dependencies', async t => {
  const { workspace, service } = await fixture(t), old = path.join(workspace, 'old.txt'); await fs.writeFile(old, 'old\n'); await fs.mkdir(path.join(workspace, 'node_modules')); const tracker = service.begin(crypto.randomUUID(), workspace, 'chat');
  await tracker.run(() => tracker.command(async () => { await fs.unlink(old); await fs.writeFile(path.join(workspace, 'new.txt'), 'new\n'); await fs.writeFile(path.join(workspace, 'node_modules', 'ignored'), 'dependency'); })); const summary = await tracker.finish(); assert.equal(summary.files.length, 2); assert.deepEqual(summary.files.map(f => f.kind).sort(), ['added', 'deleted']);
  await service.undo(summary.id, { conversationId: 'chat', validate: async () => {}, withCommit: withFileCommit }); assert.equal(await fs.readFile(old, 'utf8'), 'old\n');
});
test('failed and no-op actions only report actual disk changes', async t => {
  const { workspace, service } = await fixture(t), file = path.join(workspace, 'a'); await fs.writeFile(file, 'same'); const tracker = service.begin(crypto.randomUUID(), workspace, 'chat'); await tracker.run(() => withFileCommit(file, () => fs.writeFile(file, 'same'))); assert.equal(await tracker.finish(), null);
  await assert.rejects(() => tracker.run(() => withFileCommit(file, async () => { await fs.writeFile(file, 'changed'); throw Error('failure'); })), /failure/); assert.equal((await tracker.finish()).files.length, 1);
});
test('command deletion restores the original file and its removed parent directories', async t => {
  const { workspace, service } = await fixture(t), folder = path.join(workspace, 'nested'), target = path.join(folder, 'old.txt');
  await fs.mkdir(folder); await fs.writeFile(target, 'existing user data\n');
  const tracker = service.begin(crypto.randomUUID(), workspace, 'chat');
  await tracker.command(() => fs.rm(folder, { recursive: true })); const summary = await tracker.finish();
  assert.equal(summary.files.length, 1); assert.equal(summary.files[0].removed, 1);
  await service.undo(summary.id, { conversationId: 'chat', validate: async () => {}, withCommit: withFileCommit });
  assert.equal(await fs.readFile(target, 'utf8'), 'existing user data\n');
});
test('undo exposes busy state and does not proceed while validation is pending', async t => {
  const { workspace, service } = await fixture(t), target = path.join(workspace, 'a'); const tracker = service.begin(crypto.randomUUID(), workspace, 'chat');
  await tracker.run(() => withFileCommit(target, () => fs.writeFile(target, 'new'))); const summary = await tracker.finish();
  let release, entered; const reached = new Promise(resolve => { entered = resolve; }), gate = new Promise(resolve => { release = resolve; });
  const undo = service.undo(summary.id, { conversationId: 'chat', withCommit: withFileCommit, validate: async () => { entered(); await gate; } });
  await reached; assert.equal(service.isBusy(), true); assert.equal(await fs.readFile(target, 'utf8'), 'new'); release(); await undo; assert.equal(service.isBusy(), false);
});
test('detached change actions bind to a visible record and strip injected paths', () => {
  const { validateWindowAction } = require('../electron/workspace-windows.cjs');
  const record = { kind: 'chat', snapshot: { available: true, chat: { messages: [{ fileChanges: { id: 'record' } }] } } };
  assert.deepEqual(validateWindowAction(record, { type: 'change-details', changeId: 'record', path: '../secret', conversationId: 'other' }), { type: 'change-details', changeId: 'record' });
  assert.throws(() => validateWindowAction(record, { type: 'change-undo', changeId: 'other' }), /不属于/);
});
