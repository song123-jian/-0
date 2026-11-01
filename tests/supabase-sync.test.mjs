import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { DEFAULT_SUPABASE_SYNC, normalizeSupabaseConfig, createSupabaseSync } = require('../electron/supabase-sync.cjs');

const encryption = {
  isEncryptionAvailable: () => true,
  encryptString: (value) => Buffer.from(`encrypted:${value}`),
  decryptString: (value) => value.toString().slice('encrypted:'.length),
};

async function fixture(t, options = {}) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'scodex-supabase-sync-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const file = path.join(root, 'supabase-sync.json');
  return { file, service: createSupabaseSync(file, { encryption, ...options }) };
}

function jsonResponse(value, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } });
}

test('Supabase config accepts a project URL and rejects unsafe endpoints', () => {
  const config = normalizeSupabaseConfig({
    ...DEFAULT_SUPABASE_SYNC,
    projectUrl: 'https://example.supabase.co/',
    syncId: 'workspace-main',
    enabled: true,
  });
  assert.equal(config.projectUrl, 'https://example.supabase.co');
  assert.equal(normalizeSupabaseConfig({ ...DEFAULT_SUPABASE_SYNC, projectUrl: 'https://example.supabase.co/rest/v1' }).projectUrl, 'https://example.supabase.co');
  assert.equal(config.syncId, 'workspace-main');
  assert.equal(config.enabled, true);
  for (const value of ['http://example.supabase.co', 'https://user:pass@example.supabase.co', 'https://example.supabase.co/?token=secret', 'not-a-url']) {
    assert.throws(() => normalizeSupabaseConfig({ ...DEFAULT_SUPABASE_SYNC, projectUrl: value }), /Supabase 项目地址/);
  }
  assert.throws(() => normalizeSupabaseConfig({ ...DEFAULT_SUPABASE_SYNC, syncId: 'bad id' }), /同步空间/);
});

test('Supabase credentials are encrypted and never returned or written in plaintext', async (t) => {
  const { file, service } = await fixture(t);
  const saved = await service.save({ projectUrl: 'https://example.supabase.co', anonKey: 'supabase-test-key', syncId: 'unit', enabled: true });
  assert.equal(saved.hasCredential, true);
  assert.equal(JSON.stringify(saved).includes('supabase-test-key'), false);
  const persisted = await fs.readFile(file, 'utf8');
  assert.equal(persisted.includes('supabase-test-key'), false);
  const reopened = createSupabaseSync(file, { encryption });
  assert.equal((await reopened.get()).hasCredential, true);
});

test('first sync inserts version one and the next sync uses a version condition', async (t) => {
  const { service } = await fixture(t);
  await service.save({ projectUrl: 'https://example.supabase.co', anonKey: 'supabase-test-key', syncId: 'unit', enabled: true });
  const records = new Map();
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url, options });
    const method = options.method || 'GET';
    if (method === 'GET') {
      const id = new URL(url).searchParams.get('sync_id')?.replace(/^eq\./, '');
      const record = records.get(id);
      return jsonResponse(record ? [record] : []);
    }
    const body = JSON.parse(options.body);
    if (method === 'POST') {
      if (records.has(body.sync_id)) return jsonResponse({ message: 'duplicate key' }, 409);
      records.set(body.sync_id, body);
      return jsonResponse([body], 201);
    }
    if (method === 'PATCH') {
      const id = new URL(url).searchParams.get('sync_id')?.replace(/^eq\./, '');
      const expected = Number(new URL(url).searchParams.get('version')?.replace(/^eq\./, ''));
      const current = records.get(id);
      if (!current || current.version !== expected) return jsonResponse([], 200);
      const next = { ...current, ...body };
      records.set(id, next);
      return jsonResponse([next]);
    }
    throw new Error(`unexpected ${method}`);
  };
  const sync = createSupabaseSync((await fixture(t)).file, { encryption, fetchImpl });
  await sync.save({ projectUrl: 'https://example.supabase.co', anonKey: 'supabase-test-key', syncId: 'unit', enabled: true });
  const first = await sync.push({ version: 0, data: 'a' });
  assert.deepEqual({ status: first.status, version: first.version }, { status: 'synced', version: 1 });
  const second = await sync.push({ version: 1, data: 'b' });
  assert.equal(second.version, 2);
  const patch = calls.find((call) => call.options.method === 'PATCH');
  assert.match(patch.url, /version=eq\.1/);
  assert.equal(records.get('unit').payload.data, 'b');
});

test('stale sync returns conflict without overwriting remote data', async (t) => {
  const first = await fixture(t);
  const second = await fixture(t);
  const records = new Map();
  const fetchImpl = async (url, options = {}) => {
    const method = options.method || 'GET';
    const id = (new URL(url).searchParams.get('sync_id') || JSON.parse(options.body || '{}').sync_id)?.replace(/^eq\./, '');
    if (method === 'GET') return jsonResponse(records.has(id) ? [records.get(id)] : []);
    const body = JSON.parse(options.body);
    if (method === 'POST') {
      if (records.has(id)) return jsonResponse({ message: 'duplicate key' }, 409);
      records.set(id, body); return jsonResponse([body], 201);
    }
    const current = records.get(id);
    const expected = Number(new URL(url).searchParams.get('version'));
    if (!current || current.version !== expected) return jsonResponse([]);
    records.set(id, { ...current, ...body }); return jsonResponse([records.get(id)]);
  };
  for (const item of [first, second]) await item.service.save({ projectUrl: 'https://example.supabase.co', anonKey: 'supabase-test-key', syncId: 'shared', enabled: true });
  const a = createSupabaseSync(first.file, { encryption, fetchImpl });
  const b = createSupabaseSync(second.file, { encryption, fetchImpl });
  await a.push({ data: 'from-a' });
  const result = await b.push({ data: 'from-b' });
  assert.equal(result.status, 'conflict');
  assert.equal(result.remote.payload.data, 'from-a');
  assert.equal(records.get('shared').payload.data, 'from-a');
});

test('network failures are reported and do not change the local sync version', async (t) => {
  const { file } = await fixture(t);
  const service = createSupabaseSync(file, { encryption, fetchImpl: async () => { throw new TypeError('offline'); } });
  await service.save({ projectUrl: 'https://example.supabase.co', anonKey: 'supabase-test-key', syncId: 'unit', enabled: true });
  await assert.rejects(service.push({ data: 'offline' }), /无法连接 Supabase/);
  const reopened = createSupabaseSync(file, { encryption });
  assert.equal((await reopened.get()).version, 0);
});

test('hung Supabase requests abort after the bounded timeout', async (t) => {
  const { service } = await fixture(t);
  await service.save({ projectUrl: 'https://example.supabase.co', anonKey: 'supabase-test-key', syncId: 'unit', enabled: true });
  const fetchImpl = async (_url, options) => {
    if (!options.signal) throw new Error('missing signal');
    return new Promise((_resolve, reject) => {
    options.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
    });
  };
  const bounded = createSupabaseSync((await fixture(t)).file, { encryption, fetchImpl, timeoutMs: 25 });
  await bounded.save({ projectUrl: 'https://example.supabase.co', anonKey: 'supabase-test-key', syncId: 'unit', enabled: true });
  await assert.rejects(bounded.push({ data: 'hang' }), /无法连接 Supabase/);
});

test('changing the service host cannot forward a saved credential', async t => {
  const { service } = await fixture(t);
  await service.save({ projectUrl: 'https://first.supabase.co', anonKey: 'supabase-test-key', enabled: true });
  await assert.rejects(service.save({ projectUrl: 'https://second.supabase.co', enabled: true }), /key|Key|凭据/);
  assert.equal((await service.get()).projectUrl, 'https://first.supabase.co');
});

test('bidirectional sync pulls remote, preserves concurrent edits and persists merge base', async t => {
  let record = null;
  const fetchImpl = async (url, init = {}) => {
    if (init.method === 'GET') return jsonResponse(record ? [record] : []);
    const body = JSON.parse(init.body);
    if (init.method === 'POST') { record = body; return jsonResponse([record]); }
    const version = Number(new URL(url).searchParams.get('version').slice(3));
    if (record.version !== version) return jsonResponse([]);
    record = { ...record, ...body }; return jsonResponse([record]);
  };
  const a = await fixture(t, { fetchImpl }), b = await fixture(t, { fetchImpl });
  for (const x of [a, b]) await x.service.save({ projectUrl: 'https://example.supabase.co', anonKey: 'supabase-test-key', syncSecret: 'fixture-shared-secret-32-characters', enabled: true });
  const snapshot = id => ({ library: { version: 2, activeId: id, conversations: [{ id, title: id, createdAt: '2026-11-01', updatedAt: '2026-11-01', messages: [] }] }, preferences: { fontSize: 18 } });
  const first = await a.service.sync(snapshot('device-a'));
  const uncommitted = JSON.parse(await fs.readFile(a.file, 'utf8'));
  assert.equal(Boolean(uncommitted.base), false, 'remote write must not mark unapplied local data as merged');
  await a.service.accept(first.version, first.snapshot);
  const result = await b.service.sync(snapshot('device-b'));
  await b.service.accept(result.version, result.snapshot);
  assert.deepEqual(result.snapshot.library.conversations.map(c => c.id).sort(), ['device-a', 'device-b']);
  const reopened = createSupabaseSync(a.file, { encryption, fetchImpl });
  const final = await reopened.sync(snapshot('device-a'));
  assert.equal(final.snapshot.library.conversations.length, 2); assert.equal(final.version, 3);
});
