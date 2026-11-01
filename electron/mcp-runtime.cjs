const crypto = require('node:crypto');
const { pathToFileURL } = require('node:url');
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');
const { StreamableHTTPClientTransport } = require('@modelcontextprotocol/sdk/client/streamableHttp.js');
const { SSEClientTransport } = require('@modelcontextprotocol/sdk/client/sse.js');
const { boundedMcpResponse } = require('./mcp-network.cjs');
const { AjvJsonSchemaValidator } = require('@modelcontextprotocol/sdk/validation/ajv');
const { ListRootsRequestSchema, ToolListChangedNotificationSchema, ResourceListChangedNotificationSchema, PromptListChangedNotificationSchema, ResourceUpdatedNotificationSchema } = require('@modelcontextprotocol/sdk/types.js');
const { commandEnvironment, stopProcessTree } = require('./agent-command.cjs');

const { createMcpContext, contextCapabilities } = require('./mcp-context.cjs');
const { createMcpOAuth } = require('./mcp-oauth.cjs');
const { oauthConfigKey } = require('./mcp-store.cjs');
const MAX_TOOLS = 96;
const MAX_RESULT = 64_000;
const hash = (value) => crypto.createHash('sha256').update(value).digest('hex').slice(0, 10);
const toolAlias = (id, name) => ('mcp_' + hash(id) + '_' + name.replace(/[^A-Za-z0-9_]/g, '_').slice(0, 26) + '_' + hash(name)).slice(0, 64);
function scrub(value, secrets) {
  let result = String(value);
  for (const secret of secrets) if (secret) {
    result = result.split(secret).join('[已隐藏]');
    const encoded = JSON.stringify(secret).slice(1, -1);
    if (encoded !== secret) result = result.split(encoded).join('[已隐藏]');
  }
  return result;
}
function redactValue(value, redact) {
  if (typeof value === 'string') return redact(value);
  if (Array.isArray(value)) return value.map((item) => redactValue(item, redact));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [redact(key), redactValue(item, redact)]));
  return value;
}
function safeResult(result, redact) {
  // Binary payloads and resource links stay out of model messages and history.
  const content = (Array.isArray(result?.content) ? result.content : []).slice(0, 40).map((item) => item.type === 'text'
    ? { type: 'text', text: String(item.text || '').slice(0, MAX_RESULT) }
    : { type: 'text', text: '[服务返回 ' + String(item.type || '未知') + ' 内容，本轮仅接收文本结果]' });
  const value = redactValue({ content, ...(result?.structuredContent !== undefined ? { structuredContent: result.structuredContent } : {}) }, redact);
  const clean = JSON.stringify(value);
  if (clean.length > MAX_RESULT) return { content: [{ type: 'text', text: clean.slice(0, MAX_RESULT) }], truncated: true };
  return value;
}
function createMcpRuntime({ store, getWorkspaceRoot, environment = async () => process.env, onChanged = () => {}, authorizeConnect = async () => {}, openAuthorization, authorizeOAuthUrl = async () => {} }) {
  const entries = new Map(); const validator = new AjvJsonSchemaValidator();
  const contexts = createMcpContext({ entries });
  let management = Promise.resolve(); let closing = false;
  const notify = () => { Promise.resolve().then(onChanged).catch(() => {}); };
  const manage = (fn) => { const task = management.then(() => { if (closing) throw new Error('应用正在退出。'); return fn(); }); management = task.catch(() => {}); return task; };
  const authorizationRequests=new Map();
  const oauth=createMcpOAuth({store,getWorkspaceRoot,openAuthorization,onChanged:notify,authorizeUrl:authorizeOAuthUrl});
  function cancelAuthorization(id){const request=authorizationRequests.get(id);request?.abort();return oauth.cancel(id)||Boolean(request);}
  function state(entry) { return { status: entry?.status || 'disconnected', error: entry?.error || '', generation: entry?.generation || '', contextRevision: entry?.contextRevision || 0,
    serverVersion: entry?.version, contextCapabilities: contextCapabilities(entry), tools: (entry?.tools || []).map((tool) => ({ name: tool.name, description: tool.description, inputSchema: tool.inputSchema,
      readOnly: tool.annotations?.readOnlyHint === true, allowedInPlan: tool.annotations?.readOnlyHint === true && entry.config.readOnlyTools.includes(tool.name) })) }; }
  async function snapshot() { return { servers: (await store.list()).map(config=>{
    const normal=state(entries.get(config.id)),authorization=oauth.status(config.id);
    return{...config,...normal,...authorization,status:authorizationRequests.has(config.id)?'authorizing':authorization.authError&&normal.status!=='connected'?'failed':normal.status,error:authorization.authError||normal.error};
  }) }; }
  async function dispose(entry) {
    if (!entry || entry.disposing) return entry?.disposing;
    entry.status = 'disconnecting'; entry.oauthSession?.dispose(); notify();
    entry.disposing = (async () => {
      for (const controller of entry.calls) controller.abort();
      // Kill the Windows process tree before its parent exits, so grandchildren
      // cannot become detached from the PID used for cleanup.
      const pid = entry.transport?.pid;
      if (pid) await stopProcessTree({ pid, kill: () => { try { process.kill(pid, 'SIGKILL'); } catch {} } });
      await entry.client?.close().catch(() => {});
      await entry.transport?.close().catch(() => {});
      contexts.invalidate(entry); entry.tools = []; entry.status = 'disconnected'; entry.version = undefined; entry.secretValues = []; notify();
    })();
    return entry.disposing;
  }
  async function discover(entry) {
    if (!entry.client.getServerCapabilities()?.tools) { entry.tools = []; entry.revision++; notify(); return; }
    const tools = []; let cursor; const cursors = new Set();
    for (let page = 0; page < 8; page++) {
      const result = await entry.client.listTools(cursor ? { cursor } : {}, { timeout: 15_000 });
      for (const tool of result.tools || []) {
        if (tools.length >= MAX_TOOLS) throw new Error('单个连接最多接收 96 项工具，请缩小服务工具目录。');
        if (!tool.name || tool.name.length > 200 || tools.some((v) => v.name === tool.name)) throw new Error('服务工具名称缺失、过长或重复。');
        const schema = tool.inputSchema;
        if (schema?.type !== 'object' || JSON.stringify(schema).length > 32_000) throw new Error('工具参数应为 32 KB 以内的对象 JSON Schema。');
        validator.getValidator(schema);
        tools.push({ ...tool, name: entry.redact(tool.name), description: entry.redact(String(tool.description || '').slice(0, 2400)), inputSchema: redactValue(schema, entry.redact) });
      }
      cursor = result.nextCursor;
      if (!cursor) break;
      if (cursors.has(cursor) || page === 7) throw new Error('工具目录分页异常。');
      cursors.add(cursor);
    }
    if (entry.status !== 'connecting' && entry.status !== 'connected') throw new Error('连接已断开。');
    entry.tools = tools; entry.revision++; notify();
  }
  async function connectNow(id) {
    if (entries.get(id)?.status === 'connected') return snapshot();
    await dispose(entries.get(id));
    const { config, secrets } = await store.load(id);
    await authorizeConnect(config);
    const secretValues = [...Object.values(secrets.env), ...Object.values(secrets.headers), secrets.token].filter(Boolean);
    const entry = { config, generation: crypto.randomUUID(), revision: 0, status: 'connecting', tools: [], calls: new Set(), secretValues,
      redact: (value) => scrub(value, secretValues) };
    entries.set(id, entry); notify();
    try {
      const client = new Client({ name: 'scodex-workbench', version: require('../package.json').version }, { capabilities: { roots: { listChanged: false } } });
      entry.client = client;
      client.setRequestHandler(ListRootsRequestSchema, async () => ({ roots: getWorkspaceRoot() ? [{ uri: pathToFileURL(getWorkspaceRoot()).href, name: '当前项目' }] : [] }));
      client.onclose = () => { if (['connecting', 'connected'].includes(entry.status)) { entry.status = 'failed'; entry.tools = []; entry.error = 'MCP 服务已关闭，请检查配置后重新连接。'; for (const c of entry.calls) c.abort(); notify(); } };
      client.onerror = () => {};
      for (const schema of [ResourceListChangedNotificationSchema, PromptListChangedNotificationSchema, ResourceUpdatedNotificationSchema]) client.setNotificationHandler(schema, () => { contexts.invalidate(entry); notify(); });
      client.setNotificationHandler(ToolListChangedNotificationSchema, async () => {
        if (entry.status !== 'connected') return;
        entry.revision++; entry.tools = []; notify();
        try { await discover(entry); } catch (error) { entry.error = entry.redact(error.message).slice(0, 1200); notify(); }
      });
      if (config.transport === 'stdio') {
        entry.transport = new StdioClientTransport({ command: config.command, args: config.args, cwd: config.cwd || getWorkspaceRoot(),
          env: { ...commandEnvironment(await environment()), ...secrets.env }, stderr: 'pipe', maxBufferSize: 1_048_576 });
        // Drain stderr without logging untrusted output or credentials.
        entry.transport.stderr?.on('data', () => {});
      } else if(config.authMode==='oauth') {
        if(!secrets.oauth?.tokens?.access_token)throw new Error('此MCP服务需要网页登录，请点击“授权并连接”。');
        entry.oauthSession=oauth.client(config,secrets,{secretValues,onSseEnd:()=>{if(['connecting','connected'].includes(entry.status))void entry.transport?.close();},guard:async()=>{if(entries.get(id)!==entry||!['connecting','connected'].includes(entry.status))throw new Error('MCP连接已变化。');}});
        const Transport = config.transport === 'sse' ? SSEClientTransport : StreamableHTTPClientTransport;
        entry.transport=new Transport(new URL(config.url),{authProvider:entry.oauthSession.provider,requestInit:{redirect:'error'},reconnectionOptions:{maxRetries:0},fetch:entry.oauthSession.transportFetch});
      } else {
        const origin = new URL(config.url).origin;
        const headers = { ...secrets.headers, ...(secrets.token ? { Authorization: 'Bearer ' + secrets.token } : {}) };
        const Transport = config.transport === 'sse' ? SSEClientTransport : StreamableHTTPClientTransport;
        entry.transport = new Transport(new URL(config.url), { requestInit: { headers, redirect: 'error' },
          reconnectionOptions: { maxRetries: 0 }, fetch: async (input, init) => {
            const target = new URL(typeof input === 'string' || input instanceof URL ? String(input) : input.url);
            if (target.origin !== origin) throw new Error('已拒绝向其他主机转发 MCP 认证。');
            const response = await fetch(input, { ...init, redirect: 'error' });
            return boundedMcpResponse(response,2_000_000,{eventStream:config.transport==='sse',onStreamEnd:()=>{if(['connecting','connected'].includes(entry.status))void entry.transport?.close();}});
          } });
      }
      let deadline;
      try {
        await Promise.race([client.connect(entry.transport, { timeout: 15_000 }), new Promise((_, reject) => { deadline = setTimeout(() => reject(new Error('MCP 初始化超过 15 秒，请检查服务地址。')), 15_000); })]);
      } finally { clearTimeout(deadline); }
      await discover(entry);
      if (entry.status !== 'connecting') throw new Error('MCP 连接在初始化时关闭。');
      entry.version = redactValue(client.getServerVersion() || {}, entry.redact);
      entry.status = 'connected'; entry.error = ''; notify();
    } catch (error) {
      const message = entry.redact(error.message || '连接失败').slice(0, 1200);
      await dispose(entry); entry.status = 'failed'; entry.error = message; notify(); throw new Error(message);
    }
    return snapshot();
  }
  async function authorizeConnection(id){
    if(authorizationRequests.has(id))throw new Error('此连接正在授权。');
    const controller=new AbortController(),root=getWorkspaceRoot();authorizationRequests.set(id,controller);notify();
    try{
      await manage(async()=>{const {config}=await store.load(id);if(config.authMode!=='oauth')throw new Error('此连接未配置OAuth。');await authorizeConnect(config);await dispose(entries.get(id));});
      if(controller.signal.aborted||getWorkspaceRoot()!==root)throw new Error('OAuth授权已取消或项目已变化。');
      await oauth.authorize(id,{signal:controller.signal});
      await manage(async()=>{if(controller.signal.aborted||getWorkspaceRoot()!==root)throw new Error('OAuth授权已取消或项目已变化。');oauth.clearError(id);return connectNow(id);});
    }finally{authorizationRequests.delete(id);notify();}
    return snapshot();
  }
  function agentTools({ readOnly = false, guard, approve, policy, fullAccess = () => false }) {
    const captured = new Map();
    if (!require('./permission-policy.cjs').toolPolicyAllowed(policy(), fullAccess())) return { definitions: [], execute: async () => { throw new Error('当前策略不允许 MCP 工具。'); } };
    for (const entry of entries.values()) if (entry.status === 'connected') for (const tool of entry.tools) {
      if (captured.size >= MAX_TOOLS) break;
      if (readOnly && !(tool.annotations?.readOnlyHint === true && entry.config.readOnlyTools.includes(tool.name))) continue;
      const name = toolAlias(entry.config.id, tool.name);
      captured.set(name, { entry, tool, generation: entry.generation, revision: entry.revision, validate: validator.getValidator(tool.inputSchema) });
    }
    function current(item) {
      if (!require('./permission-policy.cjs').toolPolicyAllowed(policy(), fullAccess())) throw new Error('当前策略不允许 MCP 调用。');
      if (entries.get(item.entry.config.id) !== item.entry || item.entry.status !== 'connected' || item.entry.generation !== item.generation || item.entry.revision !== item.revision) throw new Error('MCP 连接或工具目录已变化，请重新发起任务。');
    }
    const contextual = contexts.agentTools({ readOnly, guard, approve, policy, fullAccess, limit: Math.max(0, MAX_TOOLS - captured.size) });
    return {
      definitions: [...contextual.definitions, ...[...captured].map(([name, { entry, tool }]) => ({ type: 'function', function: { name,
        description: ('MCP · ' + entry.config.name + ' / ' + tool.name + '\n' + tool.description).slice(0, 3000), parameters: tool.inputSchema } }))],
      async execute(name, args, context = {}) {
        if (name.startsWith('mcp_context_')) return contextual.execute(name, args, context);
        const item = captured.get(name); if (!item) throw new Error('此 MCP 工具未开放给当前任务。');
        await guard(); current(item);
        if (context.signal?.aborted) throw new Error('任务已停止。');
        const serialized = JSON.stringify(args);
        if (serialized.length > 16_000) throw new Error('MCP 参数超过 16 KB 限制。');
        const valid = item.validate(args); if (!valid.valid) throw new Error('MCP 工具参数不符合声明：' + item.entry.redact(valid.errorMessage || '参数无效').slice(0, 1000));
        const { entry, tool } = item;
        context.onProgress?.({ title: 'MCP · ' + entry.config.name, detail: tool.name });
        await approve({ title: '调用 MCP 工具', server: entry.config.name, tool: tool.name, kind: 'mcp', command: entry.redact(JSON.stringify(args, null, 2)),
          note: '请确认服务器、工具和参数。此服务使用自身权限运行，项目目录不是系统沙箱；允许本次调用可能产生外部副作用。', allowLabel: '允许本次调用' }, context.signal);
        await guard(); current(item); if (context.signal?.aborted) throw new Error('任务已停止。');
        const controller = new AbortController(); entry.calls.add(controller);
        const abort = () => controller.abort(); context.signal?.addEventListener('abort', abort, { once: true });
        if (context.signal?.aborted) abort();
        try {
          const result = await entry.client.callTool({ name: tool.name, arguments: args }, undefined, { timeout: 60_000, signal: controller.signal });
          if (controller.signal.aborted) throw new Error('MCP 调用已停止；已发生的外部操作不会自动撤销。');
          const clean = safeResult(result, entry.redact); const output = clean.content.map((v) => v.text).join('\n');
          return { ok: !result.isError, ...clean, ...(result.isError ? { error: 'MCP 服务报告工具执行失败。' } : {}),
            activity: { title: 'MCP · ' + entry.config.name, detail: tool.name, output: output.slice(0, 24_000), truncated: Boolean(clean.truncated) } };
        } catch (error) { throw new Error(entry.redact(error.message || 'MCP 调用失败').slice(0, 1600)); }
        finally { context.signal?.removeEventListener('abort', abort); entry.calls.delete(controller); }
      },
    };
  }
  return { snapshot, agentTools,
    contextCatalog: (id, options) => contexts.catalog(id, options),
    contextRead: (input, options) => contexts.read(input, options),
    contextCancel: (requestId) => contexts.cancel(requestId),
    connect: (id) => manage(()=>{oauth.clearError(id);return connectNow(id);}),
    authorize: authorizeConnection,
    cancelAuthorization,
    clearAuthorization: id=>{cancelAuthorization(id);return manage(async()=>{await oauth.settle(id);await dispose(entries.get(id));const {config}=await store.load(id);await store.saveOAuth(id,undefined,oauthConfigKey(config));entries.delete(id);oauth.clearError(id);notify();return snapshot();});},
    disconnect: id=>{cancelAuthorization(id);return manage(async()=>{await oauth.settle(id);await dispose(entries.get(id));return snapshot();});},
    save: input=>{if(input?.id)cancelAuthorization(input.id);return manage(async()=>{if(input?.id){await oauth.settle(input.id);await dispose(entries.get(input.id));oauth.clearError(input.id);}await store.save(input);return snapshot();});},
    remove: id=>{cancelAuthorization(id);return manage(async()=>{await oauth.settle(id);await dispose(entries.get(id));entries.delete(id);await store.remove(id);oauth.clearError(id);notify();return snapshot();});},
    disconnectAll:()=>{for(const id of authorizationRequests.keys())cancelAuthorization(id);oauth.cancelAll();return manage(async()=>{await oauth.settleAll();await Promise.all([...entries.values()].map(dispose));});},
    async shutdown(){closing=true;for(const id of authorizationRequests.keys())cancelAuthorization(id);oauth.cancelAll();await oauth.settleAll();await management;await Promise.all([...entries.values()].map(dispose));await store.flush();},
  };
}
module.exports = { createMcpRuntime, toolAlias, scrub, safeResult, MAX_TOOLS };
