const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');

const { snapshot: portableSnapshot, mergeSnapshots } = require('./sync-snapshot.cjs');
const MAX_SYNC_BYTES = 16 * 1024 * 1024;
const { sealSnapshot, openSnapshot } = require('./sync-crypto.cjs');
const TABLE = 'scodex_sync_records';
const DEFAULT_SUPABASE_SYNC = {
  projectUrl: '',
  syncId: 'default',
  enabled: false,
};

function clean(value, limit = 512) {
  return typeof value === 'string' ? value.trim().slice(0, limit) : '';
}

function normalizeProjectUrl(value, required = false) {
  const text = clean(value, 2048);
  if (!text) {
    if (required) throw new Error('请填写 Supabase 项目地址。');
    return '';
  }
  let url;
  try { url = new URL(text); } catch { throw new Error('Supabase 项目地址必须是 HTTPS 地址。'); }
  if (!(url.protocol === 'https:' || url.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) || url.username || url.password || url.search || url.hash) throw new Error('Supabase 项目地址必须是 HTTPS 地址，且不能包含账号、查询参数或片段。');
  url.pathname = url.pathname.replace(/\/rest\/v1\/?$/i, '').replace(/\/+$/, '');
  return url.href.replace(/\/+$/, '');
}

function normalizeSyncId(value) {
  const id = clean(value || DEFAULT_SUPABASE_SYNC.syncId, 128);
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(id)) throw new Error('同步空间只能包含字母、数字、点、下划线和连字符。');
  return id;
}

function normalizeSupabaseConfig(input = DEFAULT_SUPABASE_SYNC) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Supabase 配置格式无效。');
  const value = { ...DEFAULT_SUPABASE_SYNC, ...input };
  const enabled = Boolean(value.enabled);
  const projectUrl = normalizeProjectUrl(value.projectUrl, enabled);
  return { projectUrl, syncId: normalizeSyncId(value.syncId), enabled };
}

function keyValue(value) {
  const key = clean(value, 8192);
  if (!key || /[\r\n]/.test(key)) throw new Error('Supabase Key 格式无效。');
  return key;
}

function createSupabaseSync(file, { encryption, fetchImpl = fetch, timeoutMs = 15000 } = {}) {
  if (!encryption || typeof encryption.encryptString !== 'function' || typeof encryption.decryptString !== 'function') throw new Error('当前系统不支持安全凭据存储。');
  let state;
  let readError = '';
  let queue = Promise.resolve();

  const ensure = async () => {
    if (state) return;
    try {
      const saved = JSON.parse(await fs.readFile(file, 'utf8'));
      state = {
        config: normalizeSupabaseConfig(saved.config),
        base: saved.base || null,
        encryptedSecret: clean(saved.encryptedSecret, 32768),
        encryptedKey: clean(saved.encryptedKey, 32768),
        version: Number.isSafeInteger(saved.version) && saved.version >= 0 ? saved.version : 0,
      };
    } catch (error) {
      if (error.code !== 'ENOENT') readError = 'Supabase 配置无法读取；原文件已保留，请修正后重启程序。';
      state = { config: normalizeSupabaseConfig(), encryptedKey: '', version: 0 };
    }
  };

  const publicState = () => ({
    ...state.config,
    hasCredential: Boolean(state.encryptedKey),
    hasSyncSecret: Boolean(state.encryptedSecret),
    credentialSource: state.encryptedKey ? 'Windows 加密凭据' : '',
    version: state.version,
    error: readError,
  });

  const persist = async () => {
    const temporary = `${file}.${crypto.randomUUID()}.tmp`;
    await fs.mkdir(path.dirname(file), { recursive: true });
    try {
      await fs.writeFile(temporary, JSON.stringify(state, null, 2), { flag: 'wx' });
      await fs.rename(temporary, file);
    } catch (error) {
      await fs.rm(temporary, { force: true }).catch(() => {});
      throw error;
    }
  };

  const decryptKey = () => {
    if (!state.encryptedKey) throw new Error('请先在设置中填写 Supabase anon key。');
    if (!encryption.isEncryptionAvailable()) throw new Error('当前 Windows 用户的凭据加密不可用。');
    try { return encryption.decryptString(Buffer.from(state.encryptedKey, 'base64')); }
    catch { throw new Error('当前 Windows 用户无法解密 Supabase Key，请重新填写。'); }
  };

  const request = async (url, options, key, remoteId = state.config.syncId) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(url, {
        ...options,
        signal: controller.signal,
        redirect: 'error',
        headers: {
          apikey: key,
          authorization: `Bearer ${key}`,
          'x-scodex-sync-id': remoteId,
          ...(options?.headers || {}),
        },
      });
      let body = null;
      if (response.body) { const reader = response.body.getReader(); const chunks = []; let size = 0; try { for (;;) { const { done, value } = await reader.read(); if (done) break; size += value.byteLength; if (size > MAX_SYNC_BYTES + 65536) throw new Error('同步响应超过16MB上限。'); chunks.push(Buffer.from(value)); } } finally { await reader.cancel().catch(() => {}); } try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new Error('同步服务未返回有效JSON。'); } }
      if (!response.ok) {
        const message = `HTTP ${response.status}`;
        const error = new Error(`Supabase 请求失败（${message}）。`);
        error.status = response.status;

        throw error;
      }
      return body;
    } catch (error) {
      if (error?.status) throw error;
      if (error instanceof TypeError || error?.name === 'AbortError') throw new Error('无法连接 Supabase，请检查项目地址、网络或超时配置。');
      throw error;
    } finally {
      clearTimeout(timer);
    }
  };

  const recordUrl = (config, query = '') => `${config.projectUrl}/rest/v1/${TABLE}${query}`;
  const readRemote = async (key, remoteId = state.config.syncId) => {
    const query = `?select=sync_id,version,payload,updated_at&sync_id=eq.${encodeURIComponent(remoteId)}`;
    const body = await request(recordUrl(state.config, query), { method: 'GET' }, key, remoteId);
    if (!Array.isArray(body)) throw new Error('远端同步记录格式无效。');
    const record = body[0] || null;
    if (record && (!Number.isSafeInteger(record.version) || record.version < 1 || !record.payload || typeof record.payload !== 'object')) throw new Error('远端版本或内容格式无效。');
    return record;
  };

  const push = async (snapshot, remoteId) => {
    await ensure();
    if (readError) throw new Error(readError);
    if (!state.config.enabled) throw new Error('请先在设置中启用 Supabase 应用同步。');
    remoteId ||= state.config.syncId;
    if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) throw new Error('同步内容格式无效。');
    const expectedVersion = Number.isSafeInteger(snapshot.version) && snapshot.version >= 0 ? snapshot.version : state.version;
    const payload = { ...snapshot };
    delete payload.version;
    const serialized = JSON.stringify(payload);
    if (Buffer.byteLength(serialized, 'utf8') > MAX_SYNC_BYTES) throw new Error('同步内容超过16MB上限；请先归档或减少附件。');
    const key = decryptKey();
    const remote = await readRemote(key, remoteId);
    if (remote && Number(remote.version) !== expectedVersion) return { status: 'conflict', expectedVersion, remote };
    const next = { sync_id: remoteId, version: expectedVersion + 1, payload };
    let result;
    if (!remote) {
      try {
        result = await request(recordUrl(state.config), { method: 'POST', headers: { 'content-type': 'application/json', prefer: 'return=representation', }, body: JSON.stringify(next) }, key, remoteId);
      } catch (error) {
        if (error.status !== 409) throw error;
        return { status: 'conflict', expectedVersion, remote: await readRemote(key, remoteId) };
      }
    } else {
      const query = `?sync_id=eq.${encodeURIComponent(remoteId)}&version=eq.${expectedVersion}`;
      result = await request(recordUrl(state.config, query), { method: 'PATCH', headers: { 'content-type': 'application/json', prefer: 'return=representation', }, body: JSON.stringify({ version: next.version, payload }) }, key, remoteId);
      if (!Array.isArray(result) || !result[0]) return { status: 'conflict', expectedVersion, remote: await readRemote(key, remoteId) };
    }
    const saved = Array.isArray(result) ? result[0] : null;
    if (!saved || saved.version !== next.version) throw new Error('远端未确认写入，未推进本地同步版本。');
    state.version = saved.version;
    await persist();
    return { status: 'synced', version: state.version, record: saved || next };
  };

  return {
    async get() { await ensure(); return publicState(); },
    save(input) {
      const operation = queue.then(async () => {
        await ensure();
        if (readError) throw new Error(readError);
        const config = normalizeSupabaseConfig(input);
        if (input?.anonKey !== undefined && typeof input.anonKey !== 'string') throw new Error('Supabase Key 格式无效。');
        let encryptedKey = config.projectUrl !== state.config.projectUrl ? '' : state.encryptedKey;
        if (input?.anonKey?.trim()) {
          if (!encryption.isEncryptionAvailable()) throw new Error('Windows 凭据加密不可用，未保存 Supabase Key。');
          encryptedKey = encryption.encryptString(keyValue(input.anonKey)).toString('base64');
        } else if (config.enabled && !encryptedKey) {
          throw new Error('启用 Supabase 同步前请填写 anon key。');
        }
        let encryptedSecret = config.projectUrl !== state.config.projectUrl || config.syncId !== state.config.syncId ? '' : state.encryptedSecret;
        if (input.syncSecret) { if (typeof input.syncSecret !== 'string' || input.syncSecret.length < 16 || input.syncSecret.length > 512) throw new Error('同步口令须为16至512字符。'); if (!encryption.isEncryptionAvailable()) throw new Error('凭据加密不可用。'); encryptedSecret = encryption.encryptString(input.syncSecret).toString('base64'); }
        const previous = state;
        const changed = config.syncId !== previous.config.syncId || config.projectUrl !== previous.config.projectUrl;
        const nextState = { config, encryptedKey, encryptedSecret, version: changed ? 0 : previous.version, base: changed ? null : previous.base };
        state = nextState;
        try { await persist(); } catch (error) { state = previous; throw error; }
        return publicState();
      });
      queue = operation.catch(() => {});
      return operation;
    },
    push(input) { const op = queue.then(() => push(input)); queue = op.catch(() => {}); return op; },
    sync(input) {
      const operation = queue.then(async () => {
        await ensure(); if (readError) throw new Error(readError);
        if (!state.config.enabled) throw new Error('请先启用同步。');
        if (!state.encryptedSecret || !encryption.isEncryptionAvailable()) throw new Error('请先设置所有设备共用的同步口令。');
        const secret = encryption.decryptString(Buffer.from(state.encryptedSecret, 'base64'));
        const remoteId = crypto.createHmac('sha256', secret).update('scodex-sync:' + state.config.syncId).digest('hex');
        const local = portableSnapshot(input), remote = await readRemote(decryptKey(), remoteId);
        const merged = remote ? mergeSnapshots(state.base, local, await openSnapshot(remote.payload, secret)) : { snapshot: local, conflicts: 0 };
        const sealed = await sealSnapshot(merged.snapshot, secret);
        const result = await push({ ...sealed, version: remote?.version || 0 }, remoteId);
        if (result.status === 'conflict') return { status: 'conflict' };

        return { status: 'synced', version: result.version, conflicts: merged.conflicts, snapshot: merged.snapshot };
      }); queue = operation.catch(() => {}); return operation;
    },
    accept(version, snapshot) {
      const operation = queue.then(async () => {
        await ensure(); if (state.version !== version) throw new Error('同步版本已变化，未推进合并基线。');
        const previous = state.base; state.base = portableSnapshot(snapshot);
        try { await persist(); } catch (error) { state.base = previous; throw error; }
      }); queue = operation.catch(() => {}); return operation;
    },
    flush: () => queue,
  };
}

module.exports = { DEFAULT_SUPABASE_SYNC, normalizeSupabaseConfig, createSupabaseSync };
