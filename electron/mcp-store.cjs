const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');

const MAX_SERVERS = 16;
function text(value, label, limit = 2048) {
  if (typeof value !== 'string' || !value.trim() || value.length > limit || value.includes('\0')) throw new Error(label + '无效。');
  return value.trim();
}
function pairs(value, headers = false) {
  if (value === undefined) return {};
  if (!value || Array.isArray(value) || typeof value !== 'object' || Object.keys(value).length > 40) throw new Error('环境变量或请求头应为最多 40 项的 JSON 对象。');
  const result = {};
  for (const [key, val] of Object.entries(value)) {
    if (!(headers ? /^[!#$%&'*+.^_\x60|~0-9A-Za-z-]+$/ : /^[A-Za-z_][A-Za-z0-9_]*$/).test(key)
      || /^(?:__proto__|prototype|constructor)$/i.test(key)
      || (headers && /^(?:host|content-length|connection|origin|authorization|mcp-session-id|mcp-protocol-version|accept|content-type)$/i.test(key))) throw new Error('变量或请求头名称不允许：' + key);
    if (typeof val !== 'string' || val.length > 8192 || /[\0\r\n]/.test(val)) throw new Error('变量和请求头值必须是不含换行的字符串。');
    if (!headers && /^(?:ELECTRON_RUN_AS_NODE|NODE_OPTIONS|SCODEX_DPAPI_FILE|SCODEX_DPAPI_SCRIPT)$/i.test(key)) throw new Error('不允许覆盖运行器内部环境变量。');
    result[key] = val;
  }
  return result;
}
function normalizeConfig(input, previous = {}) {
  if (!input || typeof input !== 'object') throw new Error('连接配置无效。');
  const transport = input.transport;
  if (!['stdio', 'http', 'sse'].includes(transport)) throw new Error('请选择 stdio、Streamable HTTP 或 SSE。');
  const result = { id: previous.id || crypto.randomUUID(), name: text(input.name, '连接名称', 80), transport,
    readOnlyTools: [...new Set((Array.isArray(input.readOnlyTools) ? input.readOnlyTools : []).map((v) => text(v, '只读工具名称', 200)))].slice(0, 128) };
  if (transport === 'stdio') {
    result.command = text(input.command, '启动命令');
    if (!Array.isArray(input.args) || input.args.length > 64 || input.args.some((v) => typeof v !== 'string' || v.length > 4096 || v.includes('\0'))) throw new Error('参数应为最多 64 项的 JSON 字符串数组。');
    result.args = input.args;
    result.cwd = input.cwd ? text(input.cwd, '工作目录', 4096) : '';
    if (result.cwd && !path.isAbsolute(result.cwd)) throw new Error('工作目录必须使用绝对路径。');
  } else {
    const url = new URL(text(input.url, '服务地址', 4096));
    if (url.username || url.password || url.hash || url.search) throw new Error('服务地址不能包含凭据、查询参数或片段；认证请使用加密请求头。');
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname))) throw new Error('HTTP 仅允许回环地址，其他服务必须使用 HTTPS。');
    result.url = url.href;
    result.authMode = input.authMode || 'bearer';
    if (!['bearer', 'oauth'].includes(result.authMode)) throw new Error('请选择 Bearer 或 OAuth 授权。');
    if (result.authMode === 'oauth') {
      result.oauthClientId = input.oauthClientId ? text(input.oauthClientId, 'OAuth客户端ID', 1024) : '';
      result.oauthScope = input.oauthScope ? text(input.oauthScope, 'OAuth权限范围', 1024) : '';
      if (result.oauthScope && !/^[\x21\x23-\x5B\x5D-\x7E]+(?: [\x21\x23-\x5B\x5D-\x7E]+)*$/.test(result.oauthScope)) throw new Error('OAuth权限范围应为以空格分隔的ASCII范围名称。');
      result.oauthIssuer = input.oauthIssuer ? new URL(text(input.oauthIssuer, 'OAuth授权服务器', 4096)).href : '';
      if (result.oauthIssuer) { const issuer = new URL(result.oauthIssuer); if (issuer.username || issuer.password || issuer.search || issuer.hash || issuer.protocol !== 'https:' && !(url.protocol === 'http:' && issuer.protocol === 'http:' && ['127.0.0.1','localhost','[::1]'].includes(issuer.hostname))) throw new Error('OAuth授权服务器必须为HTTPS或同为回环测试服务。'); }
      if (result.oauthClientId && !result.oauthIssuer) throw new Error('预配置客户端ID需要填写所属授权服务器。');
      result.oauthCallbackPort = Number(input.oauthCallbackPort || 0);
      if (!Number.isInteger(result.oauthCallbackPort) || result.oauthCallbackPort !== 0 && (result.oauthCallbackPort < 1024 || result.oauthCallbackPort > 65535)) throw new Error('回调端口填写0自动选择，或1024至65535。');
    }
  }
  return result;
}
function oauthConfigKey(config) {
  return crypto.createHash('sha256').update(JSON.stringify([config.transport,config.url,config.authMode,config.oauthClientId||'',config.oauthIssuer||'',config.oauthScope||'',config.oauthCallbackPort||0])).digest('hex');
}
function createMcpStore(file, { encryption }) {
  let queue = Promise.resolve();
  async function read() {
    let raw;
    try { raw = await fs.readFile(file, 'utf8'); } catch (error) { if (error.code === 'ENOENT') return []; throw error; }
    if (raw.length > 2_000_000) throw new Error('MCP 配置文件过大。');
    const value = JSON.parse(raw);
    if (value.version !== 1 || !Array.isArray(value.servers) || value.servers.length > MAX_SERVERS) throw new Error('MCP 配置格式无效，原文件已保留。');
    return value.servers;
  }
  function decrypt(entry) {
    if (!entry.encrypted) return { env: {}, headers: {}, token: '' };
    if (!encryption?.isEncryptionAvailable()) throw new Error('系统凭据加密不可用，无法读取此连接的认证。');
    return JSON.parse(encryption.decryptString(Buffer.from(entry.encrypted, 'base64')));
  }
  function encode(config, secrets) {
    const hasSecrets = Object.keys(secrets.env||{}).length || Object.keys(secrets.headers||{}).length || secrets.token || secrets.oauth;
    if (hasSecrets && !encryption?.isEncryptionAvailable()) throw new Error('系统凭据加密不可用，未保存任何认证值。');
    return { ...config, envNames: Object.keys(secrets.env||{}), headerNames: Object.keys(secrets.headers||{}), hasToken: Boolean(secrets.token),
      ...(config.authMode==='oauth'?{hasOAuthTokens:Boolean(secrets.oauth?.tokens?.access_token),oauthExpiresAt:secrets.oauth?.expiresAt||0}:{}),
      ...(hasSecrets?{encrypted:encryption.encryptString(JSON.stringify(secrets)).toString('base64')}:{}) };
  }
  function publicEntry(entry) {
    const { encrypted, ...config } = entry;
    // Secret values never leave the main process, including while editing.
    return { ...config, envNames: entry.envNames || [], headerNames: entry.headerNames || [], hasToken: Boolean(entry.hasToken) };
  }
  async function write(entries) {
    await fs.mkdir(path.dirname(file), { recursive: true });
    const temporary = file + '.' + crypto.randomUUID() + '.tmp';
    try { await fs.writeFile(temporary, JSON.stringify({ version: 1, servers: entries }, null, 2), { flag: 'wx', mode: 0o600 }); await fs.rename(temporary, file); }
    finally { await fs.rm(temporary, { force: true }).catch(() => {}); }
  }
  function mutate(fn) { const next = queue.then(fn); queue = next.catch(() => {}); return next; }
  return {
    async list() { await queue; return (await read()).map(publicEntry); },
    async load(id) { await queue; const entry = (await read()).find((v) => v.id === id); if (!entry) throw new Error('找不到此 MCP 连接。'); return { config: publicEntry(entry), secrets: decrypt(entry) }; },
    save(input) { return mutate(async () => {
      const entries = await read(); const previous = input?.id ? entries.find((v) => v.id === input.id) : undefined;
      if (input?.id && !previous) throw new Error('连接已被删除，请刷新后重试。');
      if (!previous && entries.length >= MAX_SERVERS) throw new Error('最多保存 16 个 MCP 连接。');
      const config = normalizeConfig(input, previous);
      const sameEndpoint = previous?.transport === config.transport && (config.transport === 'stdio' || new URL(previous.url).origin === new URL(config.url).origin);
      const old = previous && !input.clearSecrets && sameEndpoint ? decrypt(previous) : { env: {}, headers: {}, token: '' };
      const env = { ...old.env, ...pairs(input.env) }; const headers = { ...old.headers, ...pairs(input.headers, true) };
      const token = input.token === undefined || input.token === '' ? old.token : input.token;
      if (typeof token !== 'string' || token.length > 8192 || /[\0\r\n]/.test(token)) throw new Error('Bearer 认证值无效。');
      const keepOAuth = old.oauth && previous && config.authMode==='oauth' && oauthConfigKey(previous)===oauthConfigKey(config);
      const secrets = config.transport === 'stdio' ? { env, headers: {}, token: '' } : { env: {}, headers, token: config.authMode==='oauth'?'':token, ...(keepOAuth?{oauth:old.oauth}:{}) };
      const entry = encode(config, secrets);
      await write(previous ? entries.map((v) => v.id === entry.id ? entry : v) : [...entries, entry]);
      return publicEntry(entry);
    }); },
    saveOAuth(id, oauth, expectedKey) { return mutate(async () => {
      const entries=await read(),previous=entries.find(v=>v.id===id);
      if (!previous || previous.authMode!=='oauth' || expectedKey!==oauthConfigKey(previous)) throw new Error('OAuth连接配置已变化，未保存旧授权。');
      if (oauth!==undefined && (!oauth || typeof oauth!=='object' || Array.isArray(oauth) || Buffer.byteLength(JSON.stringify(oauth))>128*1024)) throw new Error('OAuth授权状态无效或超过128KB。');
      const secrets=decrypt(previous);delete secrets.oauth;if(oauth!==undefined)secrets.oauth=oauth;
      const {encrypted,hasOAuthTokens,oauthExpiresAt,...config}=previous,entry=encode(config,secrets);
      await write(entries.map(v=>v.id===id?entry:v));return publicEntry(entry);
    }); },
    remove(id) { return mutate(async () => { const entries = await read(); await write(entries.filter((v) => v.id !== id)); }); },
    flush: () => queue,
  };
}
module.exports = { createMcpStore, normalizeConfig, pairs, MAX_SERVERS, oauthConfigKey };
