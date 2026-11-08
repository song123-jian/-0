import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { createSubagentCoordinator } = require('../electron/subagent-coordinator.cjs');

test('non-overlapping edit tasks run concurrently while overlapping paths are rejected', async () => {
  const started = [];
  const release = new Map();
  const coordinator = createSubagentCoordinator({
    workspaceRoot: 'C:/workspace',
    maxConcurrent: 2,
    run: async ({ id, paths }) => {
      started.push({ id, paths });
      await new Promise((resolve) => { release.set(id, resolve); });
      return { text: paths.join(',') };
    },
  });
  const first = await coordinator.start({ task: '修改 A', mode: 'edit', paths: ['src/a.js'], parentRequestId: 'parent-1' });
  const second = await coordinator.start({ task: '修改 B', mode: 'edit', paths: ['src/b.js'], parentRequestId: 'parent-1' });
  assert.equal(started.length, 2);
  assert.throws(() => coordinator.assertNoActiveTasks(), /子任务.*运行/);
  await assert.rejects(coordinator.start({ task: '修改 A2', mode: 'edit', paths: ['src/a.js'], parentRequestId: 'parent-1' }), /路径正在由另一个子任务处理/);
  release.get(first.id)(); release.get(second.id)();
  assert.equal((await coordinator.wait(first.id, 1000, 'parent-1')).status, 'complete');
  assert.equal((await coordinator.wait(second.id, 1000, 'parent-1')).status, 'complete');
  assert.doesNotThrow(() => coordinator.assertNoActiveTasks());
});

test('an edit task may coordinate its own command while another edit task remains protected', async () => {
  const release = new Map();
  const coordinator = createSubagentCoordinator({ workspaceRoot: 'C:/workspace', run: async ({ id }) => new Promise(resolve => release.set(id, resolve)) });
  const first = await coordinator.start({ task: '运行并修改 A', mode: 'edit', paths: ['src/a.js'], parentRequestId: 'parent-command' });
  assert.doesNotThrow(() => coordinator.assertNoActiveTasks({ writesOnly: true, ownerId: first.id }));
  const second = await coordinator.start({ task: '修改 B', mode: 'edit', paths: ['src/b.js'], parentRequestId: 'parent-command' });
  assert.throws(() => coordinator.assertNoActiveTasks({ writesOnly: true, ownerId: first.id }), /子任务.*运行/);
  assert.throws(() => coordinator.assertNoActiveTasks({ writesOnly: true, ownerId: 'unknown' }), /子任务.*运行/);
  release.get(first.id)({ text: 'a' }); release.get(second.id)({ text: 'b' });
  await Promise.all([coordinator.wait(first.id, 1000, 'parent-command'), coordinator.wait(second.id, 1000, 'parent-command')]);
});

test('subagent coordinator rejects edits without an assigned path and cancels parent tasks', async () => {
  const coordinator = createSubagentCoordinator({ workspaceRoot: 'C:/workspace', run: async ({ signal }) => {
    await new Promise((resolve, reject) => { signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true }); });
  } });
  await assert.rejects(coordinator.start({ task: '无范围修改', mode: 'edit', paths: [], parentRequestId: 'parent-2' }), /至少指定一个路径/);
  const task = await coordinator.start({ task: '等待取消', mode: 'analysis', parentRequestId: 'parent-2' });
  await coordinator.cancelParent('parent-2');
  assert.equal((await coordinator.wait(task.id, 1000, 'parent-2')).status, 'cancelled');
});

test('unscoped analysis covers the workspace without blocking another read-only analysis', async () => {
  const release = [];
  const coordinator = createSubagentCoordinator({ workspaceRoot: 'C:/workspace', run: async () => new Promise((resolve) => release.push(resolve)) });
  const first = await coordinator.start({ task: '分析项目', mode: 'analysis', parentRequestId: 'parent-3' });
  const second = await coordinator.start({ task: '并行分析', mode: 'analysis', parentRequestId: 'parent-3' });
  assert.deepEqual(first.paths, ['.']);
  assert.deepEqual(second.paths, ['.']);
  assert.doesNotThrow(() => coordinator.assertWritable('C:/workspace/src/a.js', 'parent-3'));
  assert.doesNotThrow(() => coordinator.assertNoActiveTasks({ writesOnly: true }));
  assert.throws(() => coordinator.assertNoActiveTasks(), /子任务.*运行/);
  await assert.rejects(coordinator.start({ task: '修改文件', mode: 'edit', paths: ['src/a.js'], parentRequestId: 'parent-3' }), /路径正在由另一个子任务处理/);
  release.forEach((resolve) => resolve({ text: 'done' }));
  await Promise.all([coordinator.wait(first.id, 1000, 'parent-3'), coordinator.wait(second.id, 1000, 'parent-3')]);
  assert.doesNotThrow(() => coordinator.assertWritable('C:/workspace/src/a.js', 'parent-3'));
});
