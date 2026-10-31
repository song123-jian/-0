import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import net from 'node:net';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { createDevServices, normalizeInput, previewAddress, projectDirectory, cleanText, LOG_LIMIT } = require('../electron/dev-services.cjs');
const { createServiceTools } = require('../electron/service-tools.cjs');
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, label, timeout = 15000) { const end = Date.now() + timeout; do { const value = await fn(); if (value) return value; await delay(60); } while (Date.now() < end); throw new Error('Timeout: ' + label); }
async function freePort() { const server = net.createServer(); await new Promise((r) => server.listen(0, '127.0.0.1', r)); const port = server.address().port; await new Promise((r) => server.close(r)); return port; }
const commandFor = (script) => process.platform === 'win32' ? "& '" + process.execPath.replaceAll("'", "''") + "' '" + script.replaceAll("'", "''") + "'" : JSON.stringify(process.execPath) + ' ' + JSON.stringify(script);
async function fixture(t, code) { const root = await fs.mkdtemp(path.join(os.tmpdir(), 'scodex-dev-services-')); const script = path.join(root, 'service.cjs'); await fs.writeFile(script, code); const manager = createDevServices(); t.after(async () => { await manager.shutdown(); await fs.rm(root, { recursive: true, force: true }); }); return { root, script, manager }; }

test('validates command, loopback preview, protected paths and package scripts without execution', async (t) => {
  const { root, manager } = await fixture(t, '');
  for (const url of ['https://example.com', 'http://127.0.0.1@evil.test', 'http://localhost/?token=a', 'file:///C:/a', 'http://192.168.1.2']) assert.throws(() => previewAddress(url));
  assert.equal(previewAddress('http://localhost:5173'), 'http://localhost:5173/');
  assert.throws(() => normalizeInput({ command: 'echo sk-123456789abcdefgh' }), /秘密/);
  assert.throws(() => normalizeInput({ command: 'echo ok', unknown: true }));
  await assert.rejects(projectDirectory(root, '..'), /当前项目/);
  await fs.mkdir(path.join(root, 'secrets')); await assert.rejects(projectDirectory(root, 'secrets'), /凭据/);
  await fs.writeFile(path.join(root, 'package.json'), JSON.stringify({ scripts: { dev: 'node service.cjs', 'bad;script': 'echo should-not-run' } }));
  assert.deepEqual(await manager.scripts(root), [{ name: 'dev', description: 'node service.cjs', command: "npm run 'dev'" }]);
  assert.equal(manager.snapshot(root).services.length, 0);
  assert.equal(cleanText('password=abcdefgh Bearer abcdefghijkl sk-123456789'), 'password=[已隐藏] Bearer [已隐藏] [密钥已隐藏]');
});

test('real service reaches HTTP readiness, captures Chinese bounded/redacted logs and stops', async (t) => {
  const port = await freePort();
  const { root, script, manager } = await fixture(t, "const http=require('node:http');const s=http.createServer((q,r)=>r.end('真实预览成功'));s.listen(" + port + ", '127.0.0.1',()=>{console.log('服务中文就绪');console.log('x'.repeat(70000));process.stdout.write('token=split');setTimeout(()=>{process.stdout.write('SecretValue\\n');console.log('最新日志');},150);});");
  const service = await manager.start(root, { name: '真实开发服务', command: commandFor(script), previewUrl: 'http://127.0.0.1:' + port }, { waitMs: 12000 });
  assert.equal(service.status, 'running'); assert.equal(service.health, 'ready');
  assert.equal(await fetch(service.previewUrl).then((r) => r.text()), '真实预览成功');
  await until(() => manager.logs(root, service.id).output.includes('最新日志'), '日志');
  const log = manager.logs(root, service.id, 24000); assert.ok(log.output.length <= 24000); assert.ok(!log.output.includes('SecretValue')); assert.ok(log.truncated);
  assert.equal(await manager.preview(root, service.id), service.previewUrl);
  await assert.rejects(manager.start(root, { command: commandFor(script), previewUrl: service.previewUrl }), /占用|相同/);
  const stopped = await manager.stop(root, service.id); assert.equal(stopped.status, 'stopped');
  await assert.rejects(fetch(service.previewUrl)); await assert.rejects(manager.preview(root, service.id), /未运行/);
});

test('foreign occupied port is refused without starting or terminating another service', async (t) => {
  const { root, script, manager } = await fixture(t, "console.log('不应执行')");
  const server = http.createServer((q, r) => r.end('foreign')); await new Promise((r) => server.listen(0, '127.0.0.1', r)); t.after(() => new Promise((r) => server.close(r)));
  const url = 'http://127.0.0.1:' + server.address().port;
  await assert.rejects(manager.start(root, { command: commandFor(script), previewUrl: url }), /端口已被占用/);
  assert.equal(manager.snapshot(root).services.length, 0); assert.equal(await fetch(url).then((r) => r.text()), 'foreign');
});

test('nonzero exit is reported with output and a cancelled start leaves no live service', async (t) => {
  const { root, script, manager } = await fixture(t, "console.error('受控服务失败');process.exit(7)");
  const failed = await manager.start(root, { command: commandFor(script), previewUrl: 'http://127.0.0.1:' + await freePort() }, { waitMs: 12000 });
  assert.equal(failed.status, 'failed'); assert.equal(failed.exitCode, 7); assert.match(manager.logs(root, failed.id).output, /受控服务失败/);
  await fs.writeFile(script, 'setInterval(()=>{},1000)'); const controller = new AbortController();
  const starting = manager.start(root, { command: commandFor(script), previewUrl: 'http://127.0.0.1:' + await freePort() }, { signal: controller.signal });
  await until(() => manager.activeCount() === 1, 'spawn'); controller.abort(); await assert.rejects(starting, /停止/); assert.equal(manager.activeCount(), 0);
});

test('Windows job terminates detached descendants on stop and parent exit', { skip: process.platform !== 'win32' }, async (t) => {
  const port = await freePort();
  const { root, script, manager } = await fixture(t, '');
  const descendant = path.join(root, 'descendant.cjs'); await fs.writeFile(descendant, "require('node:http').createServer((q,r)=>r.end('descendant')).listen(" + port + ",'127.0.0.1');");
  await fs.writeFile(script, "const {spawn}=require('node:child_process');const fs=require('node:fs');const child=spawn(process.execPath,[" + JSON.stringify(descendant) + "],{detached:true,stdio:'ignore'});fs.writeFileSync('descendant.pid',String(child.pid));setInterval(()=>{},1000);");
  const service = await manager.start(root, { command: commandFor(script), previewUrl: 'http://127.0.0.1:' + port }, { waitMs: 12000 });
  assert.equal(service.health, 'ready'); const pid = Number(await fs.readFile(path.join(root, 'descendant.pid'), 'utf8'));
  await manager.stop(root, service.id); await until(() => { try { process.kill(pid, 0); return false; } catch { return true; } }, 'descendant exit');
  await fs.writeFile(script, "const {spawn}=require('node:child_process');const child=spawn(process.execPath,[" + JSON.stringify(descendant) + "],{detached:true,stdio:'ignore'});require('node:fs').writeFileSync('descendant.pid',String(child.pid));child.unref();setTimeout(()=>process.exit(0),300);");
  const exited = await manager.start(root, { command: commandFor(script), previewUrl: 'http://127.0.0.1:' + port }, { waitMs: 12000 });
  await until(() => !['running', 'starting'].includes(manager.describe(root, exited.id).status), 'parent exit'); const secondPid = Number(await fs.readFile(path.join(root, 'descendant.pid'), 'utf8'));
  await until(() => { try { process.kill(secondPid, 0); return false; } catch { return true; } }, 'orphan exit');
});

test('pending preparation is invalidated by project stop and concurrent duplicate is rejected', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'scodex-dev-services-race-'));
  const script = path.join(root, 'service.cjs'); await fs.writeFile(script, 'setInterval(()=>{},1000)');
  let other; let release; const environment = () => new Promise((r) => { release = () => r(process.env); });
  const manager = createDevServices({ environment }); t.after(async () => { await manager.shutdown(); await other?.shutdown(); await fs.rm(root, { recursive: true, force: true }); });
  const pending = manager.start(root, { command: commandFor(script) }); await until(() => release, 'environment wait'); await manager.stopAll(root); release(); await assert.rejects(pending, /启动条件/); assert.equal(manager.activeCount(), 0);
  other = createDevServices();
  const both = await Promise.allSettled([other.start(root, { command: commandFor(script) }), other.start(root, { command: commandFor(script) })]);
  assert.equal(both.filter((r) => r.status === 'fulfilled').length, 1); assert.equal(other.activeCount(), 1);
});

test('service tools enforce planning, approval, cancellation, current policy and project ownership', async (t) => {
  const { root, manager } = await fixture(t, ''); let approved = 0, policy = 'on-request';
  const tools = createServiceTools({ manager, root, policy: () => policy, approve: async () => { approved++; policy = 'never'; } });
  assert.equal(tools.definitions.length, 4);
  assert.deepEqual(createServiceTools({ manager, root, readOnly: true }).definitions.map((d) => d.function.name), ['service_list', 'service_logs']);
  await assert.rejects(tools.execute('service_start', { command: 'echo ok' }), /权限已变化/); assert.equal(approved, 1); assert.equal(manager.activeCount(), 0);
  await assert.rejects(tools.execute('service_logs', { service_id: 'foreign' }), /当前项目/);
  await assert.rejects(tools.execute('service_list', { unknown: true }), /未知/);
  const aborted = new AbortController(); aborted.abort(); await assert.rejects(tools.execute('service_list', {}, { signal: aborted.signal }), /停止/);
  assert.equal((await tools.execute('service_list', {})).ok, true);
});


test('localhost supports IPv6 and Windows owner exit cleans service without a tree kill', { skip: process.platform !== 'win32' }, async (t) => {
  const { root, script, manager } = await fixture(t, ''); const port = await freePort();
  await fs.writeFile(script, "require('node:http').createServer((q,r)=>r.end('ipv6-ready')).listen(" + port + ",'::1');");
  const service = await manager.start(root, { command: commandFor(script), previewUrl: 'http://localhost:' + port }, { waitMs: 12000 });
  assert.equal(service.health, 'ready'); await assert.rejects(manager.start(root, { command: 'echo occupied', previewUrl: service.previewUrl }), /占用/); await manager.stop(root, service.id);
  const ownerFile = path.join(root, 'owner.cjs');
  await fs.writeFile(ownerFile, "const {createDevServices}=require(" + JSON.stringify(path.resolve('electron/dev-services.cjs')) + ");const m=createDevServices();m.start(" + JSON.stringify(root) + ",{command:" + JSON.stringify(commandFor(script)) + ",previewUrl:" + JSON.stringify(service.previewUrl) + "},{waitMs:12000}).then(s=>process.send(s));setInterval(()=>{},1000);");
  const { fork } = await import('node:child_process'); const owner = fork(ownerFile, [], { windowsHide: true, stdio: ['ignore', 'ignore', 'ignore', 'ipc'] }); let wrapperPid;
  t.after(async () => { if (owner.exitCode === null) owner.kill(); if (wrapperPid) await require('../electron/agent-command.cjs').stopProcessTree({ pid: wrapperPid, kill() {} }); });
  const created = await new Promise((resolve, reject) => { const timer = setTimeout(() => reject(new Error('owner start timeout')), 15000); owner.once('message', (value) => { clearTimeout(timer); resolve(value); }); owner.once('error', reject); });
  wrapperPid = created.pid; assert.equal(created.health, 'ready'); owner.kill('SIGKILL');
  await until(() => { try { process.kill(wrapperPid, 0); return false; } catch { return true; } }, 'owner watchdog cleanup');
});
