import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createLearningMemory, decryptMemory, emptyMemory, encryptMemory, hashMemory, mergeMemories, normalizeMemory, validateText } = require('../electron/learning-memory.cjs');

function encryption() {
  const key = crypto.randomBytes(32);
  return {
    isEncryptionAvailable: () => true,
    encryptString(value) {
      const iv = crypto.randomBytes(12);
      const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
      return Buffer.concat([iv, cipher.update(value, 'utf8'), cipher.final(), cipher.getAuthTag()]);
    },
    decryptString(value) {
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, value.subarray(0, 12));
      decipher.setAuthTag(value.subarray(value.length - 16));
      return Buffer.concat([decipher.update(value.subarray(12, value.length - 16)), decipher.final()]).toString('utf8');
    },
  };
}

async function fixture(t, syncRemote) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'scodex-learning-memory-'));
  const file = path.join(root, 'learning-memory.json');
  const cryptoBox = encryption();
  const store = createLearningMemory(file, { encryption: cryptoBox, syncRemote });
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  return { root, file, cryptoBox, store };
}

test('memory validation rejects credentials, paths, oversized text and keeps safe content', () => {
  assert.equal(validateText('回答使用简洁中文'), '回答使用简洁中文');
  for (const value of ['api_key=secret', 'Bearer abcdefghijklmnop', 'C:\\Users\\name\\secret.txt', '-----BEGIN PRIVATE KEY-----']) {
    assert.throws(() => validateText(value), /凭据|私钥|本机路径/);
  }
  assert.throws(() => validateText('x'.repeat(2001)), /长度/);
});

test('memory persists atomically and supports add, edit, remove and clear', async t => {
  const f = await fixture(t);
  const added = await f.store.add({ kind: 'preference', text: '回答使用简洁中文' });
  assert.equal(added.entries.length, 1);
  const id = added.entries[0].id;
  const edited = await f.store.edit({ id, kind: 'correction', text: '重试直接撤回失败版本' });
  assert.equal(edited.entries[0].kind, 'correction');
  assert.equal((await f.store.remove(id)).entries.length, 0);
  const second = await f.store.add({ kind: 'lesson', text: '关闭时先保存本地记录' });
  assert.equal(second.entries.length, 1);
  assert.equal((await f.store.clear()).entries.length, 0);
  const disk = await fs.readFile(f.file, 'utf8');
  assert.ok(!disk.includes('关闭时先保存本地记录'));
  const reopened = createLearningMemory(f.file, { encryption: f.cryptoBox });
  assert.deepEqual((await reopened.load()).entries, []);
});

test('sync merges remote entries, records hash, and never uploads plaintext', async t => {
  let remote = null;
  const f = await fixture(t, async local => {
    const incoming = remote ? decryptMemory(remote, f.cryptoBox) : emptyMemory();
    const merged = mergeMemories(local, incoming);
    remote = encryptMemory(merged, f.cryptoBox);
    return merged;
  });
  await f.store.add({ kind: 'preference', text: '保留用户已有修改' });
  const result = await f.store.synchronize();
  assert.equal(result.status, 'synced');
  assert.equal(result.entries[0].text, '保留用户已有修改');
  assert.equal(result.sync.status, 'synced');
  assert.match(result.sync.lastSyncedHash, /^[a-f0-9]{64}$/);
  assert.ok(remote && !remote.includes('保留用户已有修改'));
});

test('sync failure preserves local entries and records a retryable error', async t => {
  const f = await fixture(t, async () => { throw new Error('GitHub 请求超时'); });
  await f.store.add({ kind: 'lesson', text: '网络失败时保留本地' });
  const result = await f.store.synchronize();
  assert.equal(result.status, 'failed');
  assert.equal(result.entries[0].text, '网络失败时保留本地');
  assert.equal(result.sync.lastError, 'network');
  const reopened = createLearningMemory(f.file, { encryption: f.cryptoBox });
  assert.equal((await reopened.load()).entries[0].text, '网络失败时保留本地');
});

test('cloud memory normalization rejects malformed or oversized remote data', () => {
  assert.throws(() => normalizeMemory({ schemaVersion: 2, entries: [] }, { cloud: true }), /格式/);
  assert.throws(() => normalizeMemory({ schemaVersion: 1, entries: Array.from({ length: 501 }, (_, index) => ({ id: String(index), kind: 'lesson', text: 'x' })) }, { cloud: true }), /上限/);
});
