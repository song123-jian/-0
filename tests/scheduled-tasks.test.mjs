import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createScheduledTaskService, nextScheduledAt, normalizeTaskInput, normalizeTaskLibrary } = require('../electron/scheduled-tasks.cjs');
const { loadScheduledTaskAttachments } = require('../electron/scheduled-task-attachments.cjs');

test('daily task schedules in the selected timezone and validates once-only dates', () => {
  const daily = nextScheduledAt({ frequency: 'daily', time: '09:00', timezone: 'Asia/Shanghai' }, new Date('2026-10-23T00:00:00.000Z'));
  assert.equal(daily, '2026-10-23T01:00:00.000Z');
  assert.throws(() => normalizeTaskInput({ prompt: 'report', frequency: 'once', date: '2026-10-22', time: '09:00', timezone: 'Asia/Shanghai' }, null, new Date('2026-10-23T00:00:00.000Z')), /晚于当前时间/);
});

test('overlapping ticks and manual execution do not duplicate a due task', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'scodex-tick-lock-'));
  let release;
  let started;
  const gate = new Promise(resolve => { release = resolve; });
  const begun = new Promise(resolve => { started = resolve; });
  let calls = 0;
  let currentTime = new Date('2026-10-23T00:00:00.000Z');
  const service = createScheduledTaskService(path.join(directory, 'tasks.json'), async () => {
    calls += 1;
    started();
    await gate;
    return 'complete';
  }, { now: () => currentTime });
  try {
    await service.create({ prompt: 'due', frequency: 'once', date: '2026-10-23', time: '01:00', timezone: 'UTC' });
    const id = service.snapshot().tasks[0].id;
    currentTime = new Date('2026-10-23T01:00:00.000Z');
    const first = service.tick();
    const second = service.tick();
    assert.equal(first, second);
    await begun;
    await assert.rejects(service.runNow(id), /正在执行/);
    await assert.rejects(service.remove(id), /执行完成/);
    await assert.rejects(service.update(id, { prompt: 'edited', time: '02:00' }), /执行完成/);
    let idle = false;
    const waiting = service.waitForIdle().then(() => { idle = true; });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(idle, false);
    release();
    await Promise.all([first, second, waiting]);
    await service.tick();
    assert.equal(calls, 1);
    assert.equal(service.snapshot().runs.length, 1);
    assert.equal(service.snapshot().runs[0].status, 'succeeded');
    assert.equal(service.snapshot().tasks[0].enabled, false);
  } finally {
    release();
    await service.waitForIdle();
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test('manual run racing a due tick executes once and the next tick advances the schedule', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'scodex-manual-lock-'));
  let release;
  let started;
  let calls = 0;
  const gate = new Promise(resolve => { release = resolve; });
  const begun = new Promise(resolve => { started = resolve; });
  let currentTime = new Date('2026-10-23T00:00:00.000Z');
  const service = createScheduledTaskService(path.join(directory, 'tasks.json'), async () => {
    calls += 1;
    started();
    await gate;
    return 'complete';
  }, { now: () => currentTime });
  try {
    await service.create({ prompt: 'due', frequency: 'daily', time: '01:00', timezone: 'UTC' });
    currentTime = new Date('2026-10-23T01:00:00.000Z');
    const manual = service.runNow(service.snapshot().tasks[0].id);
    await begun;
    await service.tick();
    release();
    await manual;
    assert.equal(calls, 1);
  } finally {
    release();
    await service.waitForIdle();
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test('failed persistence preserves memory and concurrent changes are serialized', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'scodex-store-lock-'));
  const filePath = path.join(directory, 'tasks.json');
  const service = createScheduledTaskService(filePath, async () => 'done', { now: () => new Date('2026-10-23T00:00:00.000Z') });
  try {
    await service.load();
    await fs.mkdir(filePath);
    await assert.rejects(service.create({ prompt: 'must not commit', time: '09:00' }));
    assert.deepEqual(service.snapshot().tasks, []);
    assert.deepEqual(await fs.readdir(directory), ['tasks.json']);
    await fs.rmdir(filePath);
    await Promise.all(['first', 'second'].map(prompt => service.create({ prompt, time: '09:00' })));
    assert.equal(service.snapshot().tasks.length, 2);
    assert.deepEqual(JSON.parse(await fs.readFile(filePath, 'utf8')), service.snapshot());
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test('startup marks interrupted runs failed without retrying the model', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'scodex-interrupted-'));
  const filePath = path.join(directory, 'tasks.json');
  try {
    await fs.writeFile(filePath, JSON.stringify({ tasks: [], runs: [{ id: 'interrupted', taskId: 'task', status: 'running' }] }));
    const service = createScheduledTaskService(filePath, async () => { assert.fail('must not retry'); }, { now: () => new Date('2026-10-23T00:00:00.000Z') });
    const [first, second] = await Promise.all([service.load(), service.load()]);
    assert.deepEqual(first, second);
    assert.equal(first.runs[0].status, 'failed');
    assert.match(first.runs[0].output, /中断/);
    assert.equal(first.runs[0].completedAt, '2026-10-23T00:00:00.000Z');
    assert.deepEqual(JSON.parse(await fs.readFile(filePath, 'utf8')), first);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test('weekday and monthly schedules advance to a valid local calendar date', () => {
  const weekdays = nextScheduledAt({ frequency: 'weekdays', time: '09:00', timezone: 'Asia/Shanghai' }, new Date('2026-10-23T03:00:00.000Z'));
  assert.equal(weekdays, '2026-10-26T01:00:00.000Z');
  const monthly = nextScheduledAt({ frequency: 'monthly', time: '09:00', timezone: 'Asia/Shanghai', monthDay: 31 }, new Date('2026-02-01T00:00:00.000Z'));
  assert.equal(monthly, '2026-02-28T01:00:00.000Z');
});

test('scheduled task records persist runs and retain failures for review', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'scodex-scheduled-'));
  const filePath = path.join(directory, 'tasks.json');
  let currentTime = new Date('2026-10-23T00:00:00.000Z');
  const service = createScheduledTaskService(filePath, async () => { throw new Error('中转站暂时不可用'); }, { now: () => currentTime });
  await service.load();
  await service.create({ name: '每日摘要', prompt: '总结今天的工作', frequency: 'daily', time: '09:00', timezone: 'Asia/Shanghai' });
  const id = service.snapshot().tasks[0].id;
  const run = await service.runNow(id);
  assert.equal(run.status, 'failed');
  assert.match(run.output, /中转站暂时不可用/);
  const reloaded = createScheduledTaskService(filePath, async () => '完成', { now: () => currentTime });
  const state = await reloaded.load();
  assert.equal(state.tasks[0].name, '每日摘要');
  assert.equal(state.runs[0].status, 'failed');
  assert.equal(normalizeTaskLibrary(state).tasks.length, 1);
  currentTime = new Date('2026-10-23T01:00:00.000Z');
  await fs.rm(directory, { recursive: true, force: true });
});

test('scheduled tasks keep project and attachment references across edits and pass them to the runner', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'scodex-scheduled-project-'));
  try {
    const filePath = path.join(directory, 'tasks.json');
    const attachmentPath = path.join(directory, 'brief.txt');
    const body = Buffer.from('release checklist');
    await fs.writeFile(attachmentPath, body);
    const reference = {
      path: attachmentPath,
      name: 'brief.txt',
      mimeType: 'application/octet-stream',
      size: body.length,
      sha256: crypto.createHash('sha256').update(body).digest('hex'),
    };
    let receivedTask;
    const service = createScheduledTaskService(filePath, async (task) => { receivedTask = task; return 'done'; }, { now: () => new Date('2026-10-23T00:00:00.000Z') });
    await service.load();
    await service.create({ name: 'Project report', prompt: 'Summarize the brief', projectId: 'project-a', attachments: [reference], frequency: 'daily', time: '09:00', timezone: 'Asia/Shanghai' });
    const id = service.snapshot().tasks[0].id;
    await service.update(id, { name: 'Project report v2', prompt: 'Summarize the brief', frequency: 'daily', time: '09:00', timezone: 'Asia/Shanghai' });
    const run = await service.runNow(id);
    assert.equal(run.status, 'succeeded');
    assert.equal(receivedTask.projectId, 'project-a');
    assert.equal(receivedTask.attachments[0].sha256, reference.sha256);
    const reloaded = createScheduledTaskService(filePath, async () => 'done');
    const state = await reloaded.load();
    assert.equal(state.tasks[0].projectId, 'project-a');
    assert.deepEqual(state.tasks[0].attachments, [reference]);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test('legacy scheduled tasks normalize without project binding or attachments', () => {
  const state = normalizeTaskLibrary({ tasks: [{ id: 'legacy', prompt: 'old task', enabled: false, frequency: 'daily', time: '09:00' }] });
  assert.equal(state.tasks[0].projectId, '');
  assert.deepEqual(state.tasks[0].attachments, []);
  const updated = normalizeTaskInput({ prompt: 'updated', time: '09:00', frequency: 'daily' }, {
    id: 'existing', projectId: 'project-b', attachments: [], createdAt: '2026-10-23T00:00:00.000Z', enabled: false,
  }, new Date('2026-10-23T00:00:00.000Z'));
  assert.equal(updated.projectId, 'project-b');
});

test('startup project migration persists only previously unassigned scheduled tasks', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'scodex-scheduled-migration-'));
  try {
    const filePath = path.join(directory, 'tasks.json');
    await fs.writeFile(filePath, JSON.stringify({
      tasks: [
        { id: 'legacy', prompt: 'old task', enabled: false, frequency: 'daily', time: '09:00' },
        { id: 'assigned', prompt: 'new task', projectId: 'project-b', enabled: false, frequency: 'daily', time: '09:00' },
      ],
      runs: [{ id: 'run-1', taskId: 'legacy', taskName: 'old task', status: 'failed', startedAt: '2026-10-23T00:00:00.000Z', output: 'existing run' }],
    }));
    const service = createScheduledTaskService(filePath, async () => 'done');
    await service.load();

    const migrated = await service.bindUnassignedProject('project-a');
    assert.deepEqual(migrated.tasks.map((task) => task.projectId), ['project-a', 'project-b']);
    assert.equal(migrated.runs[0].output, 'existing run');

    const reloaded = createScheduledTaskService(filePath, async () => 'done');
    await reloaded.load();
    const unchanged = await reloaded.bindUnassignedProject('project-c');
    assert.deepEqual(unchanged.tasks.map((task) => task.projectId), ['project-a', 'project-b']);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test('scheduled attachments are parsed from the unchanged selected file and reject changes', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'scodex-scheduled-attachment-'));
  try {
    const filePath = path.join(directory, 'brief.txt');
    const body = Buffer.from('selected attachment');
    await fs.writeFile(filePath, body);
    const reference = {
      path: filePath,
      name: 'brief.txt',
      mimeType: 'application/octet-stream',
      size: body.length,
      sha256: crypto.createHash('sha256').update(body).digest('hex'),
    };
    let parsedNames;
    const loaded = await loadScheduledTaskAttachments([reference], {
      prepareChatAttachments: async (files) => {
        parsedNames = files.map((file) => file.name);
        return [{ name: files[0].name, mimeType: files[0].mimeType, size: files[0].data.length, parsed: true, text: files[0].data.toString('utf8'), parseStatus: 'parsed' }];
      },
    });
    assert.deepEqual(parsedNames, ['brief.txt']);
    assert.equal(loaded.attachments[0].text, 'selected attachment');
    assert.deepEqual(loaded.images, []);
    await fs.writeFile(filePath, 'changed attachment');
    await assert.rejects(loadScheduledTaskAttachments([reference]), /已变化/);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});
