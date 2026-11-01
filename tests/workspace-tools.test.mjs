import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
const { copyBundledVerified, createWorkspaceTools, downloadVerified } = createRequire(import.meta.url)('../electron/workspace-tools.cjs');

test('missing, corrupt and escaping tool manifests do not load external executables', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'scodex-tools-unit-'));
  try {
    const service = createWorkspaceTools(root);
    assert.deepEqual(await service.status(), { installed: false });
    assert.deepEqual(await service.environment({ PATH: 'original' }), { PATH: 'original' });
    await fs.mkdir(path.join(root, 'workspace-tools'));
    const manifest = path.join(root, 'workspace-tools', 'active.json');
    await fs.writeFile(manifest, '{');
    assert.match((await service.status()).error, /清单损坏/);
    await fs.writeFile(manifest, JSON.stringify({ version: 1, directory: '../outside' }));
    await assert.rejects(service.environment(), /路径无效/);
    const directory = 'runtime-' + crypto.randomUUID();
    await fs.symlink(os.tmpdir(), path.join(root, 'workspace-tools', directory), 'junction');
    await fs.writeFile(manifest, JSON.stringify({ version: 1, directory }));
    await assert.rejects(service.environment(), /外部目录/);
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});

test('download integrity rejects altered bytes before tool extraction', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'scodex-tools-unit-'));
  const originalFetch = global.fetch;
  try {
    // Only the download transport is substituted; real filesystem/hash verification is exercised.
    global.fetch = async () => new Response('altered archive', { headers: { 'content-length': '15' } });
    await assert.rejects(downloadVerified({ url: 'https://example.invalid/archive', sha256: '0'.repeat(64) }, path.join(root, 'bad.zip')), /校验失败/);
    global.fetch = async () => new Response('known archive');
    const sha256 = crypto.createHash('sha256').update('known archive').digest('hex');
    assert.equal(await downloadVerified({ url: 'https://example.invalid/archive', sha256 }, path.join(root, 'good.zip')), 13);
  } finally { global.fetch = originalFetch; await fs.rm(root, { recursive: true, force: true }); }
});

test('bundled tools are copied only after the pinned archive digest matches', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'scodex-tools-bundle-'));
  const bundle = path.join(root, 'bundle');
  await fs.mkdir(bundle);
  const contents = Buffer.from('known bundled archive');
  const item = { filename: 'node.zip', sha256: crypto.createHash('sha256').update(contents).digest('hex') };
  try {
    await fs.writeFile(path.join(bundle, item.filename), contents);
    const target = path.join(root, 'runtime-node.zip');
    assert.equal(await copyBundledVerified(item, bundle, target), contents.length);
    assert.deepEqual(await fs.readFile(target), contents);
    await fs.writeFile(path.join(bundle, item.filename), 'tampered archive');
    await assert.rejects(copyBundledVerified(item, bundle, path.join(root, 'rejected.zip')), /SHA-256/);
    await assert.rejects(fs.access(path.join(root, 'rejected.zip')));
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});
