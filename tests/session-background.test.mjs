import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createScheduledBackground, taskNameForProfile } = require('../electron/scheduled-background.cjs');
const { createSessionBackground } = require('../electron/session-background.cjs');
const due = new Date(Date.now() + 60000).toISOString();
const tasks = { tasks: [{ enabled: true, nextRunAt: due }] };

async function fixture(t) {
  const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'scodex-session-中文 space-'));
  const cleanups = [];
  t.after(async () => { for (const cleanup of cleanups) await cleanup(); await fs.rm(profile, { recursive: true, force: true }); });
  const options = { filePath: path.join(profile, 'background.json'), profile, executable: process.execPath, platform: 'win32', packaged: true };
  let native = { registered: false }, session = { registered: false }, nativeError;
  const calls = [];
  options.operation = async request => {
    calls.push({ backend: 'windows', ...request });
    if (request.mode === 'register' && nativeError) throw nativeError;
    if (request.mode === 'register') native = { registered: true, enabled: true, nextRunAt: request.nextRunAt, ...request.action };
    if (request.mode === 'remove') native = { registered: false };
    return structuredClone(native);
  };
  options.sessionOperation = async request => {
    calls.push({ backend: 'session', ...request });
    if (request.mode === 'register') session = { registered: true, enabled: true, helperPid: 42, nextRunAt: request.nextRunAt, ...request.action };
    if (request.mode === 'remove') session = { registered: false };
    return structuredClone(session);
  };
  return { profile, options, calls, cleanups,
    deny(error = Object.assign(new Error('Access denied'), { code: '0x80070005' })) { nativeError = error; },
    native(value) { native = value; }, session(value) { session = value; } };
}

test('registration denial with no existing native task selects and persists the session helper', async t => {
  const f = await fixture(t); f.deny();
  const service = createScheduledBackground(f.options); await service.load();
  const result = await service.configure(true, tasks);
  assert.equal(result.registered, true); assert.equal(result.backend, 'session'); assert.equal(result.sessionOnly, true); assert.equal(result.error, '');
  assert.deepEqual(JSON.parse(await fs.readFile(f.options.filePath, 'utf8')), { version: 2, enabled: true, backend: 'session' });
  const count = f.calls.filter(call => call.backend === 'windows').length;
  const reloaded = createScheduledBackground(f.options); await reloaded.load(); await reloaded.sync(tasks, true);
  assert.equal(f.calls.filter(call => call.backend === 'windows').length, count, 'Restart must not retry unchanged native denial');
  await reloaded.configure(false, tasks);
  assert.equal(reloaded.snapshot().registered, false);
  assert.equal(f.calls.at(-1).backend, 'session'); assert.equal(f.calls.at(-1).mode, 'remove');
});

test('an existing native task or a nonpermission failure never creates a second scheduler', async t => {
  for (const existing of [true, false]) {
    const f = await fixture(t);
    f.deny(existing ? undefined : Object.assign(new Error('RPC unavailable'), { code: '0x800706BA' }));
    if (existing) f.native({ registered: true, enabled: false });
    const service = createScheduledBackground(f.options); await service.load();
    const result = await service.configure(true, tasks);
    assert.notEqual(result.error, ''); assert.equal(result.backend, 'windows');
    assert.equal(f.calls.some(call => call.backend === 'session'), false);
  }
});

test('an unreadable native state does not silently activate a helper', async t => {
  const f = await fixture(t);
  f.options.operation = async () => { throw Object.assign(new Error('Cannot read native state'), { code: '0x80070005' }); };
  const service = createScheduledBackground(f.options); await service.load();
  const result = await service.configure(true, tasks);
  assert.match(result.error, /Cannot read/); assert.equal(result.backend, 'windows');
  assert.equal(f.calls.some(call => call.backend === 'session'), false);
});

test('a live but unregistered session helper is stopped when all plans are paused', async t => {
  const f = await fixture(t); f.deny();
  const service = createScheduledBackground(f.options); await service.load(); await service.configure(true, tasks);
  f.session({ registered: false, helperPid: 42 });
  assert.equal((await service.sync({ tasks: [] })).registered, false);
  assert.equal(f.calls.at(-1).mode, 'remove'); assert.equal(f.calls.at(-1).backend, 'session');
});

test('helper startup failure is visible and does not claim a registered plan', async t => {
  const f = await fixture(t); f.deny();
  f.options.sessionOperation = async () => { throw new Error('Helper unavailable'); };
  const service = createScheduledBackground(f.options); await service.load();
  const result = await service.configure(true, tasks);
  assert.equal(result.registered, false); assert.equal(result.backend, 'session'); assert.match(result.error, /Helper unavailable/);
});

async function wait(check, message) {
  const deadline = Date.now() + 12000;
  do { const result = await check(); if (result) return result; await new Promise(resolve => setTimeout(resolve, 100)); } while (Date.now() < deadline);
  throw new Error(message);
}

test('real Windows helper survives independent operation instances, launches once and stops cooperatively', { skip: process.platform !== 'win32' }, async t => {
  const f = await fixture(t), operate = createSessionBackground({ profile: f.profile });
  f.cleanups.push(() => operate({ mode: 'remove' }));
  const request = { mode: 'register', name: taskNameForProfile(f.profile), nextRunAt: new Date(Date.now() + 1500).toISOString(),
    action: { executable: process.execPath, arguments: '--version', workingDirectory: f.profile } };
  const initial = await operate(request);
  assert.equal(initial.registered, true); assert.ok(initial.helperPid > 0);
  const launched = await wait(async () => { const value = await operate({ mode: 'read' }); return value.launchCount === 1 && value.lastResult === 0 && value; }, 'Real helper launch did not complete');
  const other = createSessionBackground({ profile: f.profile });
  const reused = await other(request);
  assert.equal(reused.helperPid, initial.helperPid);
  assert.equal(reused.launchCount, 1);
  assert.equal(launched.lastError, '');
  const stopped = await operate({ mode: 'remove' });
  assert.equal(stopped.registered, false); assert.equal(stopped.stopped, true);
  await wait(() => { try { process.kill(initial.helperPid, 0); return false; } catch { return true; } }, 'Stopped helper process still exists');
});

test('real Windows helper records missing executables and applies a retry delay', { skip: process.platform !== 'win32' }, async t => {
  const f = await fixture(t), operate = createSessionBackground({ profile: f.profile });
  let helperPid;
  f.cleanups.push(async () => {
    await operate({ mode: 'remove' });
    if (helperPid) await wait(() => { try { process.kill(helperPid, 0); return false; } catch { return true; } }, 'Stopped helper process still exists');
  });
  const initial = await operate({ mode: 'register', name: taskNameForProfile(f.profile), nextRunAt: new Date(Date.now() - 1000).toISOString(),
    action: { executable: path.join(f.profile, 'missing.exe'), arguments: '', workingDirectory: f.profile } });
  helperPid = initial.helperPid;
  const failed = await wait(async () => { const value = await operate({ mode: 'read' }); return value.lastResult === -1 && value; }, 'Missing executable not recorded');
  assert.match(failed.lastError, /Invalid background/); assert.equal(failed.launchCount, 0);
  assert.equal(failed.registered, true, 'The helper remains alive to observe plan updates');
});
