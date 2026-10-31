const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');

const EFFORTS = ['', 'none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max', 'ultra'];
const DEFAULT_CONNECTION = { name: '聚合模组 2', note: '', website: 'https://catbee.online', baseUrl: 'https://catbee.online/v1', addresses: ['https://catbee.online/v1'], models: ['grok-4.7'], model: 'grok-4.7', reasoningEffort: '', toolProtocol: 'json', subagentModel: '', subagentReasoningEffort: '' };
const clean = (value, limit = 200) => typeof value === 'string' ? value.trim().slice(0, limit) : '';
function modelId(value) { const id = clean(value); if (/[\x00-\x20\x7f]/.test(id)) throw new Error('模型 ID 不能包含空格或控制字符。'); return id; }
function normalizeAddress(value, website = false) {
  let url;
  try { url = new URL(clean(value, 2048)); } catch { throw new Error('请填写完整的 HTTP 或 HTTPS 地址。'); }
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (!(url.protocol === 'https:' || (url.protocol === 'http:' && loopback)) || url.username || url.password || url.search || url.hash) throw new Error('地址须使用 HTTPS（本机调试可用 HTTP），且不能包含账号、查询参数或片段。');
  if (!website) {
    url.pathname = url.pathname.replace(/\/(?:chat\/completions|models)\/?$/, '').replace(/\/+$/, '') || '/v1';
  }
  return url.href.replace(/\/+$/, '');
}
function normalizeConnection(input = DEFAULT_CONNECTION) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('模型配置格式无效。');
  const value = { ...DEFAULT_CONNECTION, ...input };
  const name = clean(value.name, 80); if (!name) throw new Error('请填写服务名称。');
  const baseUrl = normalizeAddress(value.baseUrl);
  const model = modelId(value.model); if (!model) throw new Error('请填写默认模型。');
  if (!EFFORTS.includes(value.reasoningEffort) || !EFFORTS.includes(value.subagentReasoningEffort)) throw new Error('推理强度无效。');
  if (!['native', 'json'].includes(value.toolProtocol)) throw new Error('工具执行通道无效。');
  const models = [...new Set([...(Array.isArray(value.models) ? value.models : []).slice(0, 500).map(modelId).filter(Boolean), model])];
  const subagentModel = modelId(value.subagentModel); if (subagentModel && !models.includes(subagentModel)) models.push(subagentModel);
  const addresses = [...new Set([baseUrl, ...(Array.isArray(value.addresses) ? value.addresses : []).slice(0, 19).map((item) => normalizeAddress(item))])];
  return { name, note: clean(value.note, 500), website: value.website ? normalizeAddress(value.website, true) : '', baseUrl, addresses, models, model, reasoningEffort: value.reasoningEffort, toolProtocol: value.toolProtocol, subagentModel, subagentReasoningEffort: value.subagentReasoningEffort };
}
function createModelConnection(file, { encryption, legacyKey, fetchImpl = fetch }) {
  let state; let readError = ''; let queue = Promise.resolve();
  const ensure = async () => {
    if (state) return;
    try {
      const saved = JSON.parse(await fs.readFile(file, 'utf8'));
      state = { config: normalizeConnection(saved.config), encryptedKey: clean(saved.encryptedKey, 32000), keyOrigin: saved.keyOrigin || '' };
    } catch (error) {
      if (error.code !== 'ENOENT') readError = '模型配置无法读取；原文件已保留，请修正后重启程序。';
      state = { config: normalizeConnection(), encryptedKey: '', keyOrigin: '' };
    }
  };
  const origin = (config) => new URL(config.baseUrl).origin;
  const hasKey = (config) => (state.encryptedKey && state.keyOrigin === origin(config)) || (!state.encryptedKey && origin(config) === 'https://catbee.online' && Boolean(legacyKey));
  const publicState = () => ({ ...state.config, hasCredential: Boolean(hasKey(state.config)), credentialSource: state.encryptedKey ? 'Windows 加密凭据' : hasKey(state.config) ? '原有 DPAPI 凭据' : '', error: readError });
  const keyFor = async (config, supplied) => {
    if (typeof supplied === 'string' && supplied.trim()) { if (supplied.length > 8192 || /[\r\n]/.test(supplied)) throw new Error('API Key 格式无效。'); return supplied.trim(); }
    if (state.encryptedKey && state.keyOrigin === origin(config)) {
      if (!encryption.isEncryptionAvailable()) throw new Error('当前 Windows 用户的凭据加密不可用。');
      try { return encryption.decryptString(Buffer.from(state.encryptedKey, 'base64')); } catch { throw new Error('当前 Windows 用户无法解密 API Key，请重新填写。'); }
    }
    if (!state.encryptedKey && origin(config) === 'https://catbee.online' && legacyKey) return legacyKey();
    throw new Error('请为当前服务地址填写 API Key；更换服务主机不会自动转发旧密钥。');
  };
  const list = async (config, supplied) => {
    if (readError) throw new Error(readError);
    let key = await keyFor(config, supplied); const started = Date.now();
    const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const pending = fetchImpl(config.baseUrl + '/models', { headers: { authorization: 'Bearer ' + key }, signal: controller.signal, redirect: 'error' }); key = null;
      const response = await pending; if (!response.ok) throw new Error(`模型列表请求失败（HTTP ${response.status}）。`);
      if (!response.body) throw new Error('模型列表响应为空。');
      const reader = response.body.getReader(); const parts = []; let size = 0;
      try { while (true) { const { value, done } = await reader.read(); if (done) break; size += value.byteLength; if (size > 2 * 1024 * 1024) throw new Error('模型列表超过 2 MB，请改用手动添加。'); parts.push(Buffer.from(value)); } } finally { await reader.cancel().catch(() => {}); }
      let body; try { body = JSON.parse(Buffer.concat(parts).toString('utf8')); } catch { throw new Error('服务未返回有效的 JSON 模型列表。'); }
      if (!Array.isArray(body.data)) throw new Error('服务未返回 OpenAI 兼容模型列表，可手动添加模型。');
      const models = [...new Set(body.data.slice(0, 500).map((item) => modelId(item?.id)).filter(Boolean))].sort();
      if (!models.length) throw new Error('服务返回的模型列表为空，可手动添加模型。');
      return { models, latencyMs: Date.now() - started, address: config.baseUrl };
    } catch (error) {
      if (controller.signal.aborted) throw new Error('连接超时（15 秒），请检查地址后重试。');
      if (error instanceof TypeError) throw new Error('无法连接模型服务，请检查地址、网络或重定向配置。');
      throw error;
    } finally { key = null; clearTimeout(timer); }
  };
  return {
    async get() { await ensure(); return publicState(); },
    save(input) {
      const operation = queue.then(async () => {
        await ensure(); if (readError) throw new Error(readError);
        const config = normalizeConnection(input); let encryptedKey = state.encryptedKey; let keyOrigin = state.keyOrigin;
        if (input.apiKey !== undefined && typeof input.apiKey !== 'string') throw new Error('API Key 格式无效。');
        if (input.apiKey?.trim()) {
          const key = await keyFor(config, input.apiKey);
          if (!encryption.isEncryptionAvailable()) throw new Error('Windows 凭据加密不可用，未保存 API Key。');
          encryptedKey = encryption.encryptString(key).toString('base64'); keyOrigin = origin(config);
        } else if (!hasKey(config)) throw new Error('请填写当前服务的 API Key。');
        const next = { config, encryptedKey, keyOrigin }; const temporary = file + '.' + crypto.randomUUID() + '.tmp';
        await fs.mkdir(path.dirname(file), { recursive: true });
        try { await fs.writeFile(temporary, JSON.stringify(next, null, 2), { flag: 'wx' }); await fs.rename(temporary, file); } catch (error) { await fs.rm(temporary, { force: true }).catch(() => {}); throw error; }
        state = next; return publicState();
      }); queue = operation.catch(() => {}); return operation;
    },
    async models(input) { await ensure(); return list(normalizeConnection(input), input.apiKey); },
    async request(kind, selectedEffort, selectedModel) {
      await ensure(); if (readError) throw new Error(readError); const config = state.config;
      const subagent = kind === 'subagent';
      let model = subagent ? config.subagentModel || config.model : config.model;
      if (!subagent && selectedModel !== undefined && selectedModel !== null && selectedModel !== '') {
        model = modelId(selectedModel);
        if (!config.models.includes(model)) throw new Error('所选模型已不在已配置列表中，请重新选择模型。');
      }
      if (!subagent && selectedEffort && !EFFORTS.includes(selectedEffort)) throw new Error('推理强度无效。');
      const effort = subagent ? config.subagentReasoningEffort || config.reasoningEffort : selectedEffort || config.reasoningEffort;
      return { endpoint: config.baseUrl + '/chat/completions', apiKey: await keyFor(config), model, toolProtocol: config.toolProtocol, ...(effort ? { reasoning_effort: effort } : {}) };
    },
    flush: () => queue,
  };
}
module.exports = { DEFAULT_CONNECTION, EFFORTS, normalizeAddress, normalizeConnection, createModelConnection };
