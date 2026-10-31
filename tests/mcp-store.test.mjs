import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { createMcpStore, normalizeConfig, pairs } = require('../electron/mcp-store.cjs');
const encryption = { isEncryptionAvailable: () => true, encryptString: (v) => Buffer.from('test:' + v), decryptString: (v) => v.toString().slice(5) };
async function fixture(t, crypto = encryption) { const root = await fs.mkdtemp(path.join(os.tmpdir(), 'scodex-mcp-store-')); t.after(() => fs.rm(root, { recursive: true, force: true })); const file = path.join(root, 'mcp.json'); return { file, store: createMcpStore(file, { encryption: crypto }) }; }
const stdio = { name: '本地工具', transport: 'stdio', command: 'node', args: [] };
test('MCP validates process, URL, headers and secret environment boundaries', () => {
  for (const url of ['http://example.com/mcp', 'https://u:p@example.com/mcp', 'https://example.com/mcp?token=a']) assert.throws(() => normalizeConfig({ name: 'http', transport: 'http', url }));
  assert.equal(normalizeConfig({ name: 'http', transport: 'http', url: 'http://127.0.0.1:1234/mcp' }).transport, 'http');
  assert.throws(() => normalizeConfig({ ...stdio, args: 'not-array' }));
  assert.throws(() => normalizeConfig({ ...stdio, cwd: 'relative' }));
  for (const key of ['Authorization', 'Host', 'Mcp-Session-Id']) assert.throws(() => pairs({ [key]: 'x' }, true));
  assert.throws(() => pairs({ NODE_OPTIONS: '--require hack' }));
  assert.throws(() => pairs({ SECRET: 'new\nline' }));
});
test('MCP secrets encrypt, remain private, survive edit and clear explicitly', async (t) => {
  const { file, store } = await fixture(t);
  const saved = await store.save({ ...stdio, env: { SERVICE_KEY: 'private-value-测试' } });
  assert.deepEqual(saved.envNames, ['SERVICE_KEY']); assert.equal(JSON.stringify(saved).includes('private-value'), false);
  assert.equal((await fs.readFile(file, 'utf8')).includes('private-value'), false);
  await store.save({ ...saved, name: '重命名' });
  assert.equal((await store.load(saved.id)).secrets.env.SERVICE_KEY, 'private-value-测试');
  const reopened = createMcpStore(file, { encryption }); assert.equal((await reopened.list())[0].name, '重命名');
  await reopened.save({ ...saved, clearSecrets: true }); assert.deepEqual((await reopened.load(saved.id)).secrets.env, {});
  await reopened.remove(saved.id); assert.equal((await reopened.list()).length, 0);
});
test('MCP encryption failure preserves configuration and changed HTTP origin never inherits auth', async (t) => {
  const { file, store } = await fixture(t);
  const saved = await store.save({ name: '远程工具', transport: 'http', url: 'https://one.example/mcp', token: 'only-for-one', headers: { 'X-Key': 'header-secret' } });
  const baseline = await fs.readFile(file, 'utf8');
  const unavailable = createMcpStore(file, { encryption: { isEncryptionAvailable: () => false } });
  await assert.rejects(unavailable.save({ ...saved, name: '无法保存' }), /加密不可用/); assert.equal(await fs.readFile(file, 'utf8'), baseline);
  await store.save({ ...saved, url: 'https://two.example/mcp' }); const next = await store.load(saved.id);
  assert.equal(next.secrets.token, ''); assert.deepEqual(next.secrets.headers, {});
});
test('MCP concurrent saves serialize and malformed config is preserved', async (t) => {
  const { file, store } = await fixture(t);
  await Promise.all([store.save(stdio), store.save({ ...stdio, name: '第二个' })]); assert.equal((await store.list()).length, 2);
  await fs.writeFile(file, 'invalid-json'); await assert.rejects(store.save(stdio)); assert.equal(await fs.readFile(file, 'utf8'), 'invalid-json');
});
