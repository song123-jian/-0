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
test('line diff counts actual disjoint edits and empty/new/binary files', () => {
  const before = Buffer.from('one\ntwo\nthree\nfour\n'), after = Buffer.from('ONE\ntwo\nthree\nFOUR\n'); const diff = difference(before, after); assert.equal(diff.added, 2); assert.equal(diff.removed, 2); assert.match(diff.diff, / two/);
  assert.equal(difference(null, Buffer.from('a\nb\n')).added, 2); assert.equal(difference(Buffer.from('a\n'), null).removed, 1); assert.equal(difference(null, Buffer.alloc(0)).added, 0); assert.equal(difference(Buffer.from([0]), Buffer.from([1])).added, null);
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
