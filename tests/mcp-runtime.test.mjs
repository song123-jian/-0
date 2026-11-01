import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { createMcpStore } = require('../electron/mcp-store.cjs');
const { createMcpRuntime, toolAlias, safeResult, scrub } = require('../electron/mcp-runtime.cjs');
const { createHttpFixture } = require('./mcp-fixture.cjs');
const encryption = { isEncryptionAvailable: () => true, encryptString: (v) => Buffer.from(v).reverse(), decryptString: (v) => Buffer.from(v).reverse().toString() };
async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'scodex-mcp-runtime-')); const file = path.join(root, 'mcp.json'); const log = path.join(root, 'calls.jsonl');
  const store = createMcpStore(file, { encryption }); const runtime = createMcpRuntime({ store, getWorkspaceRoot: () => root });
  t.after(async () => { await runtime.shutdown(); await fs.rm(root, { recursive: true, force: true }); });
  const saved = await store.save({ name: '真实隔离进程', transport: 'stdio', command: process.execPath, args: [path.resolve('tests/mcp-fixture.cjs')], readOnlyTools: ['echo'], env: { MCP_FIXTURE_LOG: log, MCP_FIXTURE_SECRET: 'never-expose-this-测试' } });
  await runtime.connect(saved.id); return { runtime, store, saved, log, root };
}
const opts = (extra = {}) => ({ guard: async () => {}, approve: async () => {}, policy: () => 'on-request', ...extra });
test('MCP SDK stdio handshake, typed tool call, private results and process shutdown', async (t) => {
  const { runtime, saved, log } = await fixture(t);
  const state = await runtime.snapshot(); assert.equal(state.servers[0].status, 'connected'); assert.equal(state.servers[0].tools.length, 4);
  assert.equal(state.servers[0].tools.filter((v) => v.allowedInPlan).length, 1);
  let approval; const tools = runtime.agentTools(opts({ approve: async (input) => { approval = input; } }));
  const result = await tools.execute(toolAlias(saved.id, 'echo'), { message: '实际工具调用' });
  assert.equal(result.ok, true); assert.match(result.activity.output, /实际工具调用/); assert.equal(JSON.stringify(result).includes('never-expose'), false);
  assert.equal(approval.tool, 'echo'); assert.equal(approval.server, '真实隔离进程'); assert.match(approval.command, /实际工具调用/);
  const call = JSON.parse((await fs.readFile(log, 'utf8')).trim()); assert.equal(call.name, 'echo');
  await runtime.disconnect(saved.id); assert.equal((await runtime.snapshot()).servers[0].status, 'disconnected'); assert.throws(() => process.kill(call.pid, 0));
});
test('MCP rejects invalid parameters, refusal and stale approval before side effects', async (t) => {
  const { runtime, saved, log } = await fixture(t);
  let approvals = 0; const toolbox = runtime.agentTools(opts({ approve: async () => { approvals++; throw Error('用户拒绝'); } }));
  await assert.rejects(toolbox.execute(toolAlias(saved.id, 'record'), { message: 42 }), /参数/); assert.equal(approvals, 0);
  await assert.rejects(toolbox.execute(toolAlias(saved.id, 'record'), { message: '拒绝' }), /用户拒绝/); assert.equal(approvals, 1);
  const stale = runtime.agentTools(opts({ approve: async () => { await runtime.disconnect(saved.id); await runtime.connect(saved.id); } }));
  await assert.rejects(stale.execute(toolAlias(saved.id, 'record'), { message: '旧连接' }), /已变化/);
  await assert.rejects(fs.readFile(log), { code: 'ENOENT' });
});
test('MCP planning whitelist and never policy do not expose mutating tools', async (t) => {
  const { runtime, saved } = await fixture(t);
  const plan = runtime.agentTools(opts({ readOnly: true })); assert.deepEqual(plan.definitions.map((v) => v.function.name), [toolAlias(saved.id, 'echo')]);
  await assert.rejects(plan.execute(toolAlias(saved.id, 'record'), { message: 'no' }), /未开放/);
  assert.deepEqual(runtime.agentTools(opts({ policy: () => 'never' })).definitions, []);
  assert.match(toolAlias('id', '中文 tool-' + 'x'.repeat(100)), /^[a-zA-Z0-9_]{1,64}$/);
  assert.notEqual(toolAlias('a', 'echo'), toolAlias('b', 'echo'));
});
test('full access with never calls the connected MCP process and preserves plan whitelist', async t => {
  const { runtime, saved, log } = await fixture(t);
  const options = opts({ policy: () => 'never', fullAccess: () => true });
  const result = await runtime.agentTools(options).execute(toolAlias(saved.id, 'echo'), { message: '自动授权真实往返' });
  assert.equal(result.ok, true); assert.match(await fs.readFile(log, 'utf8'), /自动授权真实往返/);
  const plan = runtime.agentTools({ ...options, readOnly: true });
  assert.deepEqual(plan.definitions.map(d => d.function.name), [toolAlias(saved.id, 'echo')]);
});

test('MCP errors redact secrets and cancellation aborts the actual protocol request', async (t) => {
  const { runtime, saved, log } = await fixture(t); const toolbox = runtime.agentTools(opts());
  const failure = await toolbox.execute(toolAlias(saved.id, 'failure'), {}); assert.equal(failure.ok, false); assert.equal(JSON.stringify(failure).includes('never-expose'), false);
  const controller = new AbortController(); const pending = toolbox.execute(toolAlias(saved.id, 'slow'), {}, { signal: controller.signal });
  for (let i = 0; i < 100; i++) { if ((await fs.readFile(log, 'utf8')).includes('slow')) break; await new Promise((r) => setTimeout(r, 20)); }
  controller.abort(); await assert.rejects(pending); assert.equal((await runtime.snapshot()).servers[0].status, 'connected');
});
test('MCP Streamable HTTP really authenticates, discovers and executes through SDK', async (t) => {
  const fixtureServer = await createHttpFixture({ token: 'http-test-token', secret: 'http-test-token' }); t.after(() => fixtureServer.close());
  const { runtime, store } = await fixture(t);
  const server = await store.save({ name: '真实 HTTP', transport: 'http', url: fixtureServer.url, token: 'http-test-token', headers: { 'X-Fixture-Key': 'http-custom-secret' } });
  await runtime.connect(server.id); const result = await runtime.agentTools(opts()).execute(toolAlias(server.id, 'echo'), { message: 'HTTP 中文' });
  assert.equal(result.ok, true); assert.match(result.activity.output, /HTTP 中文/); assert.equal(JSON.stringify(result).includes('http-test-token'), false);
  assert.ok(fixtureServer.seen.some((v) => v.method === 'POST' && v.auth === 'Bearer http-test-token' && v.custom === 'http-custom-secret'));
  await runtime.disconnect(server.id);
});

test('MCP sanitizes quoted credentials without damaging result JSON', () => {
  const secret = 'quote"credential';
  const value = safeResult({ content: [{ type: 'text', text: secret }], structuredContent: { result: secret } }, (s) => scrub(s, [secret]));
  assert.equal(value.structuredContent.result, '[已隐藏]'); assert.equal(value.content[0].text, '[已隐藏]');
});
