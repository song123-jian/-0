const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { normalizeAutoHandoff } = require('./auto-handoff.cjs');

const EFFORTS = ['', 'none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max', 'ultra'];
const DEFAULT_CONNECTION = { name: '聚合模组 2', note: '', website: 'https://catbee.online', baseUrl: 'https://catbee.online/v1', addresses: ['https://catbee.online/v1'], models: ['grok-4.7'], model: 'grok-4.7', reasoningEffort: '', toolProtocol: 'auto', contextWindowTokens: 0, subagentReasoningEffort: '', subagentToolProtocol: '', subagentContextWindowTokens: 0, subagentMaxConcurrent: 2, subagentAllowEdits: false, advisorEnabled: false, advisorModel: '', advisorReasoningEffort: '', advisorToolProtocol: '', advisorContextWindowTokens: 0 };
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
function normalizeConnection(input = DEFAULT_CONNECTION, { requireModel = true } = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('模型配置格式无效。');
  const value = { ...DEFAULT_CONNECTION, ...input };
  const name = clean(value.name, 80); if (!name) throw new Error('请填写服务名称。');
  const baseUrl = normalizeAddress(value.baseUrl);
  const subagentBaseUrl = normalizeAddress(input.subagentBaseUrl || baseUrl);
  const advisorBaseUrl = normalizeAddress(input.advisorBaseUrl || baseUrl);
  const model = modelId(value.model); if (requireModel && !model) throw new Error('请填写默认模型。');
  if (!EFFORTS.includes(value.reasoningEffort) || !EFFORTS.includes(value.subagentReasoningEffort) || !EFFORTS.includes(value.advisorReasoningEffort)) throw new Error('推理强度无效。');
  if (!['auto', 'native', 'json'].includes(value.toolProtocol)) throw new Error('工具执行通道无效。');
  if (!['', 'auto', 'native', 'json'].includes(value.subagentToolProtocol)) throw new Error('子模型工具执行通道无效。');
  if (!['', 'auto', 'native', 'json'].includes(value.advisorToolProtocol)) throw new Error('模型三任务执行通道无效。');
  const models = [...new Set([...(Array.isArray(value.models) ? value.models : []).slice(0, 500).map(modelId).filter(Boolean), ...(model ? [model] : [])])];
  const subagentModels = [...new Set([...(Array.isArray(input.subagentModels) ? input.subagentModels : subagentBaseUrl === baseUrl ? models : []).slice(0, 500).map(modelId).filter(Boolean)])];
  const subagentModel = modelId(input.subagentModel || (subagentBaseUrl === baseUrl ? model : ''));
  if (subagentModel && !subagentModels.includes(subagentModel)) subagentModels.push(subagentModel);
  const advisorModels = [...new Set([...(Array.isArray(input.advisorModels) ? input.advisorModels : advisorBaseUrl === baseUrl ? models : []).slice(0, 500).map(modelId).filter(Boolean)])];
  const advisorModel = modelId(value.advisorModel);
  if (advisorModel && !advisorModels.includes(advisorModel)) advisorModels.push(advisorModel);
  const subagentMaxConcurrent = Number.isInteger(value.subagentMaxConcurrent) ? Math.min(3, Math.max(1, value.subagentMaxConcurrent)) : 2;
  const addresses = [...new Set([baseUrl, ...(Array.isArray(value.addresses) ? value.addresses : []).slice(0, 19).map((item) => normalizeAddress(item))])];
  const retryLimit = Number.isSafeInteger(value.retryLimit) && value.retryLimit >= 0 ? value.retryLimit : 6;
  const maxOutputTokens = Number.isSafeInteger(value.maxOutputTokens) && value.maxOutputTokens >= 128 ? value.maxOutputTokens : 0;
  const contextWindowTokens = Number.isSafeInteger(value.contextWindowTokens) && value.contextWindowTokens > 0 ? value.contextWindowTokens : 0;
  const subagentContextWindowTokens = Number.isSafeInteger(value.subagentContextWindowTokens) && value.subagentContextWindowTokens > 0 ? value.subagentContextWindowTokens : 0;
  const advisorContextWindowTokens = Number.isSafeInteger(value.advisorContextWindowTokens) && value.advisorContextWindowTokens > 0 ? value.advisorContextWindowTokens : 0;
  return { ...normalizeAutoHandoff(value), retryLimit, maxOutputTokens, contextWindowTokens, subagentContextWindowTokens, advisorContextWindowTokens, reportUsage: value.reportUsage === true, imageModel: modelId(value.imageModel), name, note: clean(value.note, 500), website: value.website ? normalizeAddress(value.website, true) : '', baseUrl, addresses, models, model, reasoningEffort: value.reasoningEffort, toolProtocol: value.toolProtocol, subagentBaseUrl, subagentModels, subagentModel, subagentReasoningEffort: value.subagentReasoningEffort, subagentToolProtocol: value.subagentToolProtocol, subagentMaxConcurrent, subagentAllowEdits: true, advisorEnabled: value.advisorEnabled === true, advisorBaseUrl, advisorModels, advisorModel, advisorReasoningEffort: value.advisorReasoningEffort, advisorToolProtocol: value.advisorToolProtocol };
}
function createModelConnection(file, { encryption, legacyKey, fetchImpl = fetch, blankOnMissing = false }) {
  let state; let readError = ''; let queue = Promise.resolve();
  const ensure = async () => {
    if (state) return;
    try {
      const saved = JSON.parse(await fs.readFile(file, 'utf8'));
      state = { config: normalizeConnection(saved.config), encryptedKey: clean(saved.encryptedKey, 32000), keyOrigin: saved.keyOrigin || '', encryptedSubagentKey: clean(saved.encryptedSubagentKey, 32000), subagentKeyOrigin: saved.subagentKeyOrigin || '', encryptedAdvisorKey: clean(saved.encryptedAdvisorKey, 32000), advisorKeyOrigin: saved.advisorKeyOrigin || '' };
    } catch (error) {
      if (error.code !== 'ENOENT') readError = '模型配置无法读取；原文件已保留，请修正后重启程序。';
      const config = blankOnMissing ? { ...DEFAULT_CONNECTION, name: '', website: '', baseUrl: '', addresses: [], models: [], model: '', subagentBaseUrl: '', subagentModels: [], subagentModel: '', reasoningEffort: '', subagentReasoningEffort: '', subagentToolProtocol: '', advisorToolProtocol: '' } : normalizeConnection();
      state = { config, encryptedKey: '', keyOrigin: '', encryptedSubagentKey: '', subagentKeyOrigin: '', encryptedAdvisorKey: '', advisorKeyOrigin: '' };
    }
  };
  const origin = (config) => config.baseUrl ? new URL(config.baseUrl).origin : '';
  const hasMainKey = (config) => (state.encryptedKey && state.keyOrigin === origin(config)) || (!state.encryptedKey && origin(config) === 'https://catbee.online' && Boolean(legacyKey));
  const hasStoredSubagentKey = (config) => state.encryptedSubagentKey && state.subagentKeyOrigin === origin({ baseUrl: config.subagentBaseUrl }) && state.config.subagentBaseUrl === config.subagentBaseUrl;
  const hasSubagentKey = (config) => hasStoredSubagentKey(config) || (config.subagentBaseUrl === config.baseUrl && hasMainKey(config));
  const hasStoredAdvisorKey = (config) => state.encryptedAdvisorKey && state.advisorKeyOrigin === config.advisorBaseUrl;
  const hasAdvisorKey = (config) => hasStoredAdvisorKey(config) || (config.advisorBaseUrl === config.baseUrl && hasMainKey(config));
  const publicState = () => ({ ...state.config, hasCredential: Boolean(hasMainKey(state.config)), hasSubagentCredential: Boolean(hasSubagentKey(state.config)), subagentCredentialSource: hasStoredSubagentKey(state.config) ? 'Windows 加密凭据' : hasSubagentKey(state.config) ? '跟随主模型凭据' : '', hasAdvisorCredential: Boolean(hasAdvisorKey(state.config)), advisorCredentialSource: hasStoredAdvisorKey(state.config) ? 'Windows 加密凭据' : hasAdvisorKey(state.config) ? '跟随主模型凭据' : '', credentialSource: state.encryptedKey ? 'Windows 加密凭据' : hasMainKey(state.config) ? '原有 DPAPI 凭据' : '', error: readError });
  const keyFor = async (config, supplied, profile = 'main') => {
    if (typeof supplied === 'string' && supplied.trim()) { if (supplied.length > 8192 || /[\r\n]/.test(supplied)) throw new Error('API Key 格式无效。'); return supplied.trim(); }
    if (profile === 'advisor') {
      if (hasStoredAdvisorKey(config)) {
        if (!encryption.isEncryptionAvailable()) throw new Error('当前 Windows 用户的顾问凭据加密不可用。');
        try { return encryption.decryptString(Buffer.from(state.encryptedAdvisorKey, 'base64')); } catch { throw new Error('当前 Windows 用户无法解密顾问 API Key，请重新填写。'); }
      }
      if (config.advisorBaseUrl === config.baseUrl) return keyFor(config, undefined, 'main');
      throw new Error('请为顾问服务地址填写独立 API Key。');
    }
    if (profile === 'subagent') {
      const childOrigin = origin({ baseUrl: config.subagentBaseUrl });
      if (hasStoredSubagentKey(config)) {
        if (!encryption.isEncryptionAvailable()) throw new Error('当前 Windows 用户的子模型凭据加密不可用。');
        try { return encryption.decryptString(Buffer.from(state.encryptedSubagentKey, 'base64')); } catch { throw new Error('当前 Windows 用户无法解密子模型 API Key，请重新填写。'); }
      }
      if (config.subagentBaseUrl === config.baseUrl) return keyFor(config, undefined, 'main');
      throw new Error('请为子模型服务地址填写独立 API Key。');
    }
    if (state.encryptedKey && state.keyOrigin === origin(config)) {
      if (!encryption.isEncryptionAvailable()) throw new Error('当前 Windows 用户的凭据加密不可用。');
      try { return encryption.decryptString(Buffer.from(state.encryptedKey, 'base64')); } catch { throw new Error('当前 Windows 用户无法解密 API Key，请重新填写。'); }
    }
    if (!state.encryptedKey && origin(config) === 'https://catbee.online' && legacyKey) return legacyKey();
    throw new Error('请为当前服务地址填写 API Key；更换服务主机不会自动转发旧密钥。');
  };
  const list = async (config, supplied, credentialConfig = config, profile = 'main') => {
    if (readError) throw new Error(readError);
    let key = await keyFor(credentialConfig, supplied, profile); const started = Date.now();
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
        if (config.subagentBaseUrl !== config.baseUrl && !config.subagentModel) throw new Error('请先选择子模型。');
        if (input.apiKey !== undefined && typeof input.apiKey !== 'string' || input.subagentApiKey !== undefined && typeof input.subagentApiKey !== 'string' || input.advisorApiKey !== undefined && typeof input.advisorApiKey !== 'string') throw new Error('API Key 格式无效。');
        if (input.apiKey?.trim()) {
          const key = await keyFor(config, input.apiKey);
          if (!encryption.isEncryptionAvailable()) throw new Error('Windows 凭据加密不可用，未保存 API Key。');
          encryptedKey = encryption.encryptString(key).toString('base64'); keyOrigin = origin(config);
        } else if (!hasMainKey(config)) throw new Error('请填写当前服务的 API Key。');
        let encryptedSubagentKey = state.encryptedSubagentKey; let subagentKeyOrigin = state.subagentKeyOrigin;
        if (input.subagentApiKey?.trim()) {
          const key = await keyFor(config, input.subagentApiKey, 'subagent');
          if (!encryption.isEncryptionAvailable()) throw new Error('Windows 凭据加密不可用，未保存子模型 API Key。');
          encryptedSubagentKey = encryption.encryptString(key).toString('base64'); subagentKeyOrigin = origin({ baseUrl: config.subagentBaseUrl });
        }
        const childOrigin = origin({ baseUrl: config.subagentBaseUrl });
        const followsMain = config.subagentBaseUrl === config.baseUrl;
        const hasCandidateMainKey = (encryptedKey && keyOrigin === origin(config)) || (!encryptedKey && origin(config) === 'https://catbee.online' && Boolean(legacyKey));
        const hasCandidateSubagentKey = encryptedSubagentKey && subagentKeyOrigin === childOrigin && (input.subagentApiKey?.trim() || state.config.subagentBaseUrl === config.subagentBaseUrl);
        if (!input.subagentApiKey?.trim() && !(hasCandidateSubagentKey || (followsMain && hasCandidateMainKey))) throw new Error('请为子模型服务填写 API Key；更换子模型地址后需要独立密钥。');
        let encryptedAdvisorKey = state.encryptedAdvisorKey; let advisorKeyOrigin = state.advisorKeyOrigin;
        if (input.advisorApiKey?.trim()) {
          const key = await keyFor(config, input.advisorApiKey, 'advisor');
          if (!encryption.isEncryptionAvailable()) throw new Error('Windows 凭据加密不可用，未保存顾问 API Key。');
          encryptedAdvisorKey = encryption.encryptString(key).toString('base64'); advisorKeyOrigin = config.advisorBaseUrl;
        }
        if (config.advisorEnabled) {
          if (!config.advisorModel) throw new Error('请先选择顾问模型。');
          if (!(encryptedAdvisorKey && advisorKeyOrigin === config.advisorBaseUrl) && !(config.advisorBaseUrl === config.baseUrl && hasCandidateMainKey)) throw new Error('请为顾问服务填写独立 API Key；更换地址后不能转发旧密钥。');
        }
        const next = { config, encryptedKey, keyOrigin, encryptedSubagentKey, subagentKeyOrigin, encryptedAdvisorKey, advisorKeyOrigin }; const temporary = file + '.' + crypto.randomUUID() + '.tmp';
        await fs.mkdir(path.dirname(file), { recursive: true });
        try { await fs.writeFile(temporary, JSON.stringify(next, null, 2), { flag: 'wx' }); await fs.rename(temporary, file); } catch (error) { await fs.rm(temporary, { force: true }).catch(() => {}); throw error; }
        state = next; return publicState();
      }); queue = operation.catch(() => {}); return operation;
    },
    async models(input, profile = 'main') {
      await ensure(); const config = normalizeConnection(input, { requireModel: false });
      if (profile === 'advisor') return list({ ...config, baseUrl: config.advisorBaseUrl }, input.advisorApiKey || (config.advisorBaseUrl === config.baseUrl ? input.apiKey : undefined), config, 'advisor');
      if (profile !== 'subagent') return list(config, input.apiKey);
      const childConfig = { ...config, baseUrl: config.subagentBaseUrl };
      return list(childConfig, input.subagentApiKey || (config.subagentBaseUrl === config.baseUrl ? input.apiKey : undefined), config, 'subagent');
    },
    async request(kind, selectedEffort, selectedModel, selectedMode) {
      await ensure(); if (readError) throw new Error(readError); const config = state.config;
      const explicitMode = selectedMode !== undefined;
      if (explicitMode && !['main', 'subagent', 'advisor'].includes(selectedMode)) throw new Error('模型模式无效，请重新选择。');
      const role = explicitMode ? selectedMode : kind;
      if (explicitMode && selectedEffort && !EFFORTS.includes(selectedEffort)) throw new Error('推理强度无效。');
      if (role === 'advisor') {
        if ((!explicitMode && !config.advisorEnabled) || !config.advisorModel) throw new Error('顾问模型尚未配置或启用。');
        const model = explicitMode && selectedModel ? modelId(selectedModel) : config.advisorModel;
        if (!config.advisorModels.includes(model)) throw new Error('所选模型三已不在配置列表中，请重新选择。');
        const effort = explicitMode && selectedEffort || config.advisorReasoningEffort;
        return { endpoint: config.advisorBaseUrl + '/chat/completions', apiKey: await keyFor(config, undefined, 'advisor'), model, toolProtocol: config.advisorToolProtocol || config.toolProtocol, retryLimit: config.retryLimit, temperature: null, reportUsage: config.reportUsage, maxOutputTokens: config.maxOutputTokens, contextWindowTokens: config.advisorContextWindowTokens, ...(effort ? { reasoning_effort: effort } : {}) };
      }
      const subagent = role === 'subagent';
      const childOwnService = config.subagentBaseUrl !== config.baseUrl;
      let model = subagent ? config.subagentModel || (childOwnService ? '' : config.model) : config.model;
      if (subagent && !model) throw new Error('请先获取或选择子模型。');
      if ((!subagent || explicitMode) && selectedModel !== undefined && selectedModel !== null && selectedModel !== '') {
        model = modelId(selectedModel);
        if (!(subagent ? config.subagentModels : config.models).includes(model)) throw new Error('所选模型已不在已配置列表中，请重新选择模型。');
      }
      if (!subagent && selectedEffort && !EFFORTS.includes(selectedEffort)) throw new Error('推理强度无效。');
      const models = subagent ? config.subagentModels : config.models;
      if (subagent && !models.includes(model)) throw new Error('所选子模型已不在子模型列表中，请重新获取模型列表。');
      const effort = subagent ? (explicitMode && selectedEffort || config.subagentReasoningEffort) : selectedEffort || config.reasoningEffort;
      const target = subagent ? { ...config, baseUrl: config.subagentBaseUrl } : config;
      return { endpoint: target.baseUrl + '/chat/completions', apiKey: await keyFor(config, undefined, subagent ? 'subagent' : 'main'), model, toolProtocol: subagent ? config.subagentToolProtocol || config.toolProtocol : config.toolProtocol, retryLimit: config.retryLimit, reportUsage: config.reportUsage, maxOutputTokens: config.maxOutputTokens, contextWindowTokens: subagent ? config.subagentContextWindowTokens : config.contextWindowTokens, imageModel: config.imageModel, ...(effort ? { reasoning_effort: effort } : {}) };
    },
    flush: () => queue,
  };
}
module.exports = { DEFAULT_CONNECTION, EFFORTS, normalizeAddress, normalizeConnection, createModelConnection };
