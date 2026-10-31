import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { readLaunchOptions, backgroundAction, taskNameForProfile, windowsTaskOperation, createInProcessBackground, createScheduledBackground } = require('../electron/scheduled-background.cjs');
const current = new Date('2026-10-31T00:00:00.000Z');

async function fixture(t) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'scodex-background-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const calls = [];
  let osTask = { registered: false };
  let fail = false;
  const options = {
    filePath: path.join(directory, 'background.json'), profile: path.join(directory, 'profile space'),
    executable: path.join(directory, 'Scodex.exe'), codexHome: path.join(directory, 'Scodex home'),
    platform: 'win32', packaged: true, now: () => current,
    operation: async request => {
      calls.push(request);
      if (fail) throw new Error('scheduler unavailable');
      if (request.mode === 'register') osTask = { registered: true, enabled: true, nextRunAt: request.nextRunAt, ...request.action };
      if (request.mode === 'remove') osTask = { registered: false };
      return structuredClone(osTask);
    },
  };
  const service = createScheduledBackground(options);
  await service.load();
  return { options, calls, service, setFail(value) { fail = value; } };
}

test('launch arguments preserve absolute paths and the action invokes the EXE directly', () => {
  const profile = path.resolve('profile space');
  const home = path.resolve('home space');
  const executable = path.resolve('Scodex.exe');
  assert.deepEqual(readLaunchOptions(['app', '--scodex-background', '--user-data-dir=' + profile, '--scodex-home', home]), { background: true, profile, codexHome: home });
  assert.throws(() => readLaunchOptions(['--user-data-dir=relative']), /绝对路径/);
  assert.throws(() => readLaunchOptions(['--scodex-home=' + home + '\n']), /绝对路径/);
  const action = backgroundAction(executable, profile, home);
  assert.equal(action.executable, executable);
  assert.ok(action.arguments.includes('"--scodex-background"'));
  assert.ok(action.arguments.includes('"--user-data-dir=' + profile + '"'));
  assert.ok(action.arguments.includes('"--scodex-home=' + home + '"'));
  assert.equal(action.workingDirectory, path.dirname(executable));
  assert.equal(taskNameForProfile(profile), taskNameForProfile(profile.toUpperCase()));
  assert.notEqual(taskNameForProfile(profile), taskNameForProfile(home));
});

test('Windows scheduler responses preserve structured task state and Unicode', async () => {
  const expected = { registered: true, executable: 'C:\\工作台\\Scodex.exe', enabled: true };
  const result = await windowsTaskOperation({ mode: 'read', name: 'fixture' }, async () => ({ stdout: JSON.stringify({ ok: true, result: expected }) }));
  assert.deepEqual(result, expected);
});

test('Windows access denied is readable with its HRESULT and the failed operation', async () => {
  for (const [mode, label] of [['read', '读取'], ['register', '登记'], ['remove', '移除']]) {
    await assert.rejects(windowsTaskOperation({ mode, name: 'fixture' }, async () => ({ stdout: JSON.stringify({ ok: false, error: { hresult: -2147024891, message: 'Access is denied.' } }) })), error => {
      assert.equal(error.code, '0x80070005');
      assert.match(error.message, new RegExp(label + '计划任务'));
      assert.match(error.message, /权限不足.*0x80070005/);
      assert.doesNotMatch(error.message, /EncodedCommand|powershell\.exe/);
      return true;
    });
  }
  await assert.rejects(windowsTaskOperation({ mode: 'read', name: 'fixture' }, async () => ({ stdout: JSON.stringify({ ok: false, error: { hresult: -2147023174, message: 'RPC 服务不可用。' } }) })), /0x800706BA.*RPC 服务不可用/);
});

test('process failures and malformed responses never expose the encoded command', async () => {
  for (const [properties, expected] of [[{ code: 'ENOENT' }, /找不到.*PowerShell/], [{ killed: true }, /响应超时/], [{ code: 1 }, /无法调用/]]) {
    await assert.rejects(windowsTaskOperation({ mode: 'read', name: 'fixture' }, async () => { throw Object.assign(new Error('Command failed: powershell.exe -EncodedCommand PRIVATE'), properties); }), error => {
      assert.match(error.message, expected);
      assert.doesNotMatch(error.message, /EncodedCommand|PRIVATE/);
      return true;
    });
  }
  for (const stdout of ['#< CLIXML', 'null', '{"ok":true,"result":{}}', '{"ok":false}']) {
    await assert.rejects(windowsTaskOperation({ mode: 'read', name: 'fixture' }, async () => ({ stdout })), /无效响应/);
  }
});

test('background is opt-in, registers the earliest enabled task and removes inactive plans', async t => {
  const { service, calls, options } = await fixture(t);
  const state = { tasks: [
    { enabled: true, nextRunAt: '2026-10-31T02:00:00.000Z' },
    { enabled: false, nextRunAt: '2026-10-31T00:30:00.000Z' },
    { enabled: true, nextRunAt: '2026-10-31T01:00:00.000Z' },
  ] };
  assert.equal((await service.sync(state)).enabled, false);
  assert.equal(calls.some(r => r.mode === 'register'), false);
  const enabled = await service.configure(true, state);
  assert.equal(enabled.registered, true);
  assert.equal(enabled.nextRunAt, '2026-10-31T01:00:00.000Z');
  assert.equal(calls.find(r => r.mode === 'register').action.executable, options.executable);
  const count = calls.length;
  await service.sync(state);
  assert.equal(calls.length, count);
  await service.sync(state, true);
  assert.equal(calls.filter(r => r.mode === 'register').length, 1);
  assert.equal((await service.sync({ tasks: [] })).registered, false);
  assert.equal(calls.at(-1).mode, 'remove');
  const reloaded = createScheduledBackground(options);
  assert.equal((await reloaded.load()).enabled, true);
  assert.equal((await reloaded.configure(false, state)).registered, false);
  assert.equal(JSON.parse(await fs.readFile(options.filePath, 'utf8')).enabled, false);
});

test('registration denial selects the in-process backend when it is available', async t => {
  const f = await fixture(t);
  f.options.operation = async request => {
    f.calls.push({ backend: 'windows', ...request });
    if (request.mode === 'register') throw Object.assign(new Error('Access denied'), { code: '0x80070005' });
    return { registered: false };
  };
  f.options.processOperation = createInProcessBackground({ pid: 4242, now: () => new Date('2026-10-31T00:00:00.000Z') });
  const service = createScheduledBackground(f.options);
  await service.load();
  const tasks = { tasks: [{ enabled: true, nextRunAt: '2026-10-31T01:00:00.000Z' }] };
  const result = await service.configure(true, tasks);
  assert.equal(result.backend, 'process');
  assert.equal(result.inProcess, true);
  assert.equal(result.sessionOnly, true);
  assert.equal(result.registered, true);
  assert.equal(result.os.helperPid, 4242);
  assert.equal(f.calls.some(call => call.backend === 'session'), false);
  await service.configure(false, tasks);
  assert.equal(service.snapshot().registered, false);
});

test('overdue triggers are rearmed once and a refresh preserves a pending wake', async t => {
  const { service, calls } = await fixture(t);
  const state = { tasks: [{ enabled: true, nextRunAt: '2026-10-30T23:59:00.000Z' }] };
  await service.configure(true, state);
  assert.equal(calls.find(r => r.mode === 'register').nextRunAt, '2026-10-31T00:00:05.000Z');
  await service.sync(state, true);
  assert.equal(calls.filter(r => r.mode === 'register').length, 1);
});

test('a future trigger within five seconds is not delayed', async t => {
  const { service, calls } = await fixture(t);
  const state = { tasks: [{ enabled: true, nextRunAt: '2026-10-31T00:00:03.000Z' }] };
  await service.configure(true, state);
  await service.sync(state, true);
  assert.equal(calls.find(r => r.mode === 'register').nextRunAt, state.tasks[0].nextRunAt);
  assert.equal(calls.filter(r => r.mode === 'register').length, 1);
});

test('OS failures are reported and recovered by a subsequent sync', async t => {
  const { service, setFail } = await fixture(t);
  const state = { tasks: [{ enabled: true, nextRunAt: '2026-10-31T01:00:00.000Z' }] };
  setFail(true);
  assert.match((await service.configure(true, state)).error, /scheduler unavailable/);
  setFail(false);
  const recovered = await service.sync(state);
  assert.equal(recovered.error, '');
  assert.equal(recovered.registered, true);
});

test('configuration writes serialize and a failed write preserves the previous preference', async t => {
  const { service, options } = await fixture(t);
  await fs.mkdir(options.filePath);
  await assert.rejects(service.configure(true, { tasks: [] }));
  assert.equal(service.snapshot().enabled, false);
  await fs.rmdir(options.filePath);
  await Promise.all([service.configure(true, { tasks: [] }), service.configure(false, { tasks: [] })]);
  await service.flush();
  assert.equal(service.snapshot().enabled, false);
  assert.equal(JSON.parse(await fs.readFile(options.filePath, 'utf8')).enabled, false);
});

test('development and unsupported platforms cannot enable OS registration', async t => {
  const { options, calls } = await fixture(t);
  for (const overrides of [{ platform: 'linux' }, { packaged: false }]) {
    const service = createScheduledBackground({ ...options, ...overrides });
    await service.load();
    assert.equal(service.snapshot().available, false);
    await assert.rejects(service.configure(true, { tasks: [] }), /Windows/);
  }
  assert.equal(calls.length, 0);
});
