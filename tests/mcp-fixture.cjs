// Controlled MCP server: real SDK protocol, isolated files only.
const fs = require('node:fs/promises');
const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { StreamableHTTPServerTransport } = require('@modelcontextprotocol/sdk/server/streamableHttp.js');
const { SSEServerTransport } = require('@modelcontextprotocol/sdk/server/sse.js');
const { ListToolsRequestSchema, CallToolRequestSchema, ListResourcesRequestSchema, ListResourceTemplatesRequestSchema, ReadResourceRequestSchema, ListPromptsRequestSchema, GetPromptRequestSchema } = require('@modelcontextprotocol/sdk/types.js');
const definitions = [
  { name: 'echo', description: '返回中文与参数', inputSchema: { type: 'object', properties: { message: { type: 'string' } }, required: ['message'], additionalProperties: false }, annotations: { readOnlyHint: true } },
  { name: 'record', description: '写入隔离测试记录', inputSchema: { type: 'object', properties: { message: { type: 'string' } }, required: ['message'], additionalProperties: false } },
  { name: 'slow', description: '可取消的等待', inputSchema: { type: 'object', properties: {}, additionalProperties: false }, annotations: { readOnlyHint: true } },
  { name: 'failure', description: '返回工具错误', inputSchema: { type: 'object', properties: {}, additionalProperties: false } },
];
function createFixture({ logFile = process.env.MCP_FIXTURE_LOG, secret = process.env.MCP_FIXTURE_SECRET || '' } = {}) {
  const server = new Server({ name: 'Scodex 隔离 MCP', version: '1.0.0' }, { capabilities: { tools: {} } });
  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: definitions }));
  server.setRequestHandler(CallToolRequestSchema, async (request, extra) => {
    const { name, arguments: args } = request.params;
    if (logFile) await fs.appendFile(logFile, JSON.stringify({ name, args, pid: process.pid }) + '\n');
    if (name === 'slow') await new Promise((resolve) => { const timer = setTimeout(resolve, 30000); extra.signal.addEventListener('abort', () => { clearTimeout(timer); if (logFile) fs.appendFile(logFile, JSON.stringify({ cancelled: name, pid: process.pid }) + '\n').catch(() => {}); resolve(); }, { once: true }); });
    return { content: [{ type: 'text', text: name === 'failure' ? '受控错误 ' + secret : '实际 MCP 中文输出：' + (args?.message || name) + ' ' + secret }], ...(name === 'failure' ? { isError: true } : {}) };
  });
  return server;
}
async function createHttpFixture(options = {}) {
  const http = require('node:http'); const seen = [];
  const listener = http.createServer(async (req, res) => {
    seen.push({ method: req.method, auth: req.headers.authorization, custom: req.headers['x-fixture-key'] });
    if (options.token && req.headers.authorization !== 'Bearer ' + options.token) { res.writeHead(401).end(); return; }
    if (req.method !== 'POST') { res.writeHead(405).end(); return; }
    const server = createFixture(options); const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    try { await server.connect(transport); res.once('close', () => { transport.close(); server.close(); }); await transport.handleRequest(req, res); }
    catch { if (!res.headersSent) res.writeHead(500); res.end(); }
  });
  await new Promise((r) => listener.listen(0, '127.0.0.1', r));
  return { url: 'http://127.0.0.1:' + listener.address().port + '/mcp', seen, close: async () => { listener.closeAllConnections(); await new Promise((r) => listener.close(r)); } };
}
async function createSseFixture(options = {}) {
  const http = require('node:http'); const seen = [], sessions = new Map();
  const listener = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    seen.push({ method: req.method, path: url.pathname, auth: req.headers.authorization, custom: req.headers['x-fixture-key'] });
    if (options.token && req.headers.authorization !== 'Bearer ' + options.token) { res.writeHead(401).end(); return; }
    try {
      if (req.method === 'GET' && url.pathname === '/sse') {
        if (options.endpoint) {
          res.writeHead(200, { 'content-type': 'text/event-stream' });
          res.write('event: endpoint\ndata: ' + options.endpoint + '\n\n');
          return;
        }
        const server = createFixture(options), transport = new SSEServerTransport(options.endpoint || '/messages', res);
        server.registerCapabilities({ resources: {}, prompts: {} });
        server.setRequestHandler(ListResourcesRequestSchema, async () => ({ resources: [{ uri: 'sse://project', name: 'SSE 项目资料', mimeType: 'text/plain' }] }));
        server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => ({ resourceTemplates: [] }));
        server.setRequestHandler(ReadResourceRequestSchema, async () => ({ contents: [{ uri: 'sse://project', text: 'SSE 真实资料 S7419 ' + (options.secret || '') }] }));
        server.setRequestHandler(ListPromptsRequestSchema, async () => ({ prompts: [{ name: 'sse-summary', description: 'SSE 中文摘要', arguments: [{ name: 'topic', required: true }] }] }));
        server.setRequestHandler(GetPromptRequestSchema, async request => ({ messages: [{ role: 'user', content: { type: 'text', text: 'SSE 摘要主题：' + request.params.arguments?.topic } }] }));
        const session = { server, transport, res }; sessions.set(transport.sessionId, session);
        res.once('close', () => { sessions.delete(transport.sessionId); void server.close(); });
        await server.connect(transport); return;
      }
      if (req.method === 'POST' && url.pathname === '/messages') {
        const session = sessions.get(url.searchParams.get('sessionId'));
        if (!session) { res.writeHead(404).end(); return; }
        await session.transport.handlePostMessage(req, res); return;
      }
      res.writeHead(404).end();
    } catch { if (!res.headersSent) res.writeHead(500); res.end(); }
  });
  await new Promise(resolve => listener.listen(0, '127.0.0.1', resolve));
  return { url: 'http://127.0.0.1:' + listener.address().port + '/sse', seen,
    get activeSessions() { return sessions.size; },
    padding: (text) => { for (const session of sessions.values()) session.res.write(text); },
    async disconnectClients() { for (const session of [...sessions.values()]) await session.transport.close(); },
    async close() { for (const session of [...sessions.values()]) await session.server.close(); listener.closeAllConnections(); await new Promise(resolve => listener.close(resolve)); },
  };
}
if (require.main === module) createFixture().connect(new StdioServerTransport()).catch(() => { process.exitCode = 1; });
module.exports = { createHttpFixture, createSseFixture };
