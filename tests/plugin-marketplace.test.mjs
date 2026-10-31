import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { createPluginMarketplace, normalizeSource, safePath, blobSha } = require('../electron/plugin-marketplace.cjs');
const commitA = 'a'.repeat(40), commitB = 'b'.repeat(40), treeSha = 'c'.repeat(40);
const skill = '--' + '-\nname: fixture-market\ndescription: 安装管理核对\n---\n\n读取 scripts/check.py，输出 MARKET9517。\n';
async function fixture(t, options = {}) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'scodex-market-'));
  const data = { commit: commitA, skill, corrupt: false, delay: false, rows: null, seen: [], guards: [] };
  const files = () => [{ path: 'skills/.curated/fixture-market/SKILL.md', bytes: Buffer.from(data.skill) }, { path: 'skills/.curated/fixture-market/scripts/check.py', bytes: Buffer.from('print("MARKET9517")\n') }];
  const request = async (url, init) => {
    data.seen.push(url); assert.equal(init.redirect, 'error');
    if (data.delay) await new Promise((resolve, reject) => { init.signal.addEventListener('abort', () => reject(init.signal.reason), { once: true }); });
    if (url.includes('/git/trees/')) return Response.json({ tree: data.rows || files().map(f => ({ path: f.path, type: 'blob', mode: '100644', size: f.bytes.length, sha: blobSha(f.bytes) })) });
    if (url.includes('/commits/')) return Response.json({ sha: data.commit, commit: { tree: { sha: treeSha } } });
    if (url.includes('/git/blobs/')) { const row = files().find(f => url.endsWith('/' + blobSha(f.bytes))); if (!row) return Response.json({}, { status: 404 }); return Response.json({ encoding: data.badEncoding ? 'utf-8' : 'base64', sha: blobSha(row.bytes), size: row.bytes.length, content: (data.corrupt ? Buffer.alloc(row.bytes.length, 63) : row.bytes).toString('base64') }); }
    if (url === 'https://api.github.com/repos/openai/skills') return Response.json({ default_branch: 'main' });
    return Response.json({ message: 'Not Found' }, { status: 404 });
  };
  const config = { stateFile: path.join(root, 'market.json'), packagesRoot: path.join(root, 'packages'), request, authorizeUrl: async u => data.guards.push(u.hostname), ...options };
  const service = createPluginMarketplace(config);
  t.after(async () => { await service.shutdown(); await fs.rm(root, { recursive: true, force: true }); });
  return { root, data, service, config, async catalog() { const state = await service.snapshot(); return (await service.refresh(state.sources[0].id)).plugins[0]; } };
}
test('catalog validates public GitHub source and Windows paths', () => {
  assert.equal(normalizeSource({ repository: 'openai/skills' }).directory, 'skills/.curated');
  for (const repository of ['https://github.com/owner/repo', 'owner/repo/extra', 'owner/repo?token=x']) assert.throws(() => normalizeSource({ repository }));
  for (const value of ['../file', 'a\\b', '/absolute', 'AUX.txt', 'a/.git/b', 'a:stream', 'a/']) assert.throws(() => safePath(value));
});
test('catalog pins commits, installs scripts without running, loads skills and persists disable across restart', async t => {
  const f = await fixture(t); assert.equal(f.data.seen.length, 0);
  const item = await f.catalog(); assert.equal(item.commit, commitA); assert.equal(item.fileCount, 2);
  const detail = await f.service.detail(item); assert.equal(detail.name, 'fixture-market'); assert.equal(detail.hasScripts, true);
  await f.service.install(item); let state = await f.service.snapshot(); assert.equal(state.installed.length, 1);
  const dir = state.installed[0].path; assert.equal(await fs.readFile(path.join(dir, 'scripts/check.py'), 'utf8'), 'print("MARKET9517")\n');
  assert.equal((await f.service.inventory()).skillRoots.length, 1);
  await f.service.setEnabled({ ...state.installed[0], enabled: false }); assert.equal((await f.service.inventory()).skillRoots.length, 0);
  await f.service.shutdown(); const reopened = createPluginMarketplace(f.config); t.after(() => reopened.shutdown());
  assert.equal((await reopened.snapshot()).installed[0].enabled, false); assert.equal((await reopened.inventory()).plugins.length, 1);
  assert.ok(f.data.guards.includes('api.github.com')); assert.ok(f.data.seen.some(u => u.includes('/git/blobs/'))); assert.ok(f.data.guards.every(h => h === 'api.github.com'));
});
test('update replaces exact managed version and uninstall preserves project files', async t => {
  const f = await fixture(t); const first = await f.catalog(); await f.service.install(first); const old = (await f.service.snapshot()).installed[0].path;
  f.data.commit = commitB; f.data.skill = skill + '\n更新核对'; const update = await f.catalog();
  await assert.rejects(f.service.install(first), /目录版本已变化/); await f.service.install(update);
  const item = (await f.service.snapshot()).installed[0]; assert.equal(item.commit, commitB); assert.equal(await fs.stat(old).then(() => true, () => false), false);
  const projectFile = path.join(f.root, 'project.txt'); await fs.writeFile(projectFile, '保留'); await f.service.remove(item);
  assert.equal((await f.service.snapshot()).installed.length, 0); assert.equal(await fs.readFile(projectFile, 'utf8'), '保留');
});
test('local content changes refuse update or uninstall and keep original files', async t => {
  const f = await fixture(t); const item = await f.catalog(); await f.service.install(item); const installed = (await f.service.snapshot()).installed[0];
  await fs.writeFile(path.join(installed.path, 'SKILL.md'), skill + '用户修改'); await assert.rejects(f.service.remove(installed), /已改动/);
  f.data.commit = commitB; const next = await f.catalog(); await assert.rejects(f.service.install(next), /已改动/);
  assert.equal((await f.service.snapshot()).installed[0].commit, commitA); assert.match(await fs.readFile(path.join(installed.path, 'SKILL.md'), 'utf8'), /用户修改/);
});
test('invalid symlink, traversal and oversized packages are excluded from catalog', async t => {
  const f = await fixture(t); const valid = { path: 'skills/.curated/a/SKILL.md', type: 'blob', mode: '100644', size: 50, sha: commitA };
  f.data.rows = [valid, { ...valid, path: 'skills/.curated/a/scripts/link', mode: '120000' }, { ...valid, path: 'skills/.curated/b/SKILL.md' }, { ...valid, path: 'skills/.curated/b/../outside' }, { ...valid, path: 'skills/.curated/c/SKILL.md', size: 99999999 }];
  await f.catalog(); assert.equal((await f.service.snapshot()).plugins.length, 0);
});
test('download mismatch and write denial leave no installation behind', async t => {
  const f = await fixture(t); const item = await f.catalog(); f.data.corrupt = true;
  await assert.rejects(f.service.install(item), /校验不一致/); assert.equal((await f.service.snapshot()).installed.length, 0);
  assert.deepEqual(await fs.readdir(path.join(f.root, 'packages')), []);
  const denied = createPluginMarketplace({ ...f.config, authorizeWrite: async () => { throw Error('权限拒绝'); } });
  await assert.rejects(denied.install(item), /权限拒绝/); await denied.shutdown();
});
test('network errors retain cached catalog and cancel aborts an in-flight request', async t => {
  const f = await fixture(t); await f.catalog(); const before = await f.service.snapshot(); f.data.delay = true;
  const pending = f.service.refresh(before.sources[0].id); while (f.data.seen.at(-1) !== 'https://api.github.com/repos/openai/skills') await new Promise(resolve => setTimeout(resolve, 5));
  assert.equal(f.service.cancel(), true); await assert.rejects(pending, /取消/); assert.equal((await f.service.snapshot()).plugins.length, 1); assert.equal((await f.service.snapshot()).progress, null);
});
test('source removal requires uninstall and mutations respect running task guard', async t => {
  let blocked = false; const f = await fixture(t, { assertMutation: () => { if (blocked) throw Error('任务运行中'); } });
  const item = await f.catalog(); await f.service.install(item); const installed = (await f.service.snapshot()).installed[0];
  await assert.rejects(f.service.removeSource(item.sourceId), /先卸载/); blocked = true;
  await assert.rejects(f.service.setEnabled({ ...installed, enabled: false }), /任务运行中/); assert.equal((await f.service.snapshot()).installed[0].enabled, true);
});

test('blob API invalid encoding rejects detail and leaves no partial installation', async t => {
  const f = await fixture(t); const item = await f.catalog(); f.data.badEncoding = true;
  await assert.rejects(f.service.detail(item), /校验不一致/);
  await assert.rejects(f.service.install(item), /校验不一致/);
  assert.equal((await f.service.snapshot()).installed.length, 0);
  assert.deepEqual(await fs.readdir(path.join(f.root, 'packages')), []);
});
