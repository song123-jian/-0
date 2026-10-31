import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { DEFAULT_CONNECTION, normalizeAddress, normalizeConnection, createModelConnection } = require('../electron/model-connection.cjs');
const { normalizeLibrary, createConversation } = require('../electron/conversations.cjs');
const encryption = { isEncryptionAvailable: () => true, encryptString: (text) => Buffer.from('controlled:' + text), decryptString: (bytes) => bytes.toString().slice(11) };
async function fixture(t, options = {}) { const root = await fs.mkdtemp(path.join(os.tmpdir(), 'scodex-model-unit-')); t.after(() => fs.rm(root, { recursive: true, force: true })); const file = path.join(root, 'model-connection.json'); return { file, service: createModelConnection(file, { encryption, ...options }) }; }

test('addresses normalize root and known suffixes and reject credential or unsafe URLs', () => {
  assert.equal(normalizeAddress('https://example.com'), 'https://example.com/v1');
  assert.equal(normalizeAddress('https://example.com/api/v2/chat/completions/'), 'https://example.com/api/v2');
  assert.equal(normalizeAddress('http://127.0.0.1:1234/v1/models'), 'http://127.0.0.1:1234/v1');
  for (const address of ['http://example.com', 'file:///C:/test', 'https://a:b@example.com', 'https://example.com/?key=secret']) assert.throws(() => normalizeAddress(address));
  assert.throws(() => normalizeConnection({ ...DEFAULT_CONNECTION, name: '' }));
  assert.throws(() => normalizeConnection({ ...DEFAULT_CONNECTION, model: 'two words' }));
});

test('credentials are persisted through encryption, never returned, and isolated by origin', async (t) => {
  let legacyCalls = 0; const { file, service } = await fixture(t, { legacyKey: () => { legacyCalls++; return 'legacy-unit-key'; } });
  assert.equal((await service.get()).hasCredential, true);
  await assert.rejects(service.models({ ...DEFAULT_CONNECTION, baseUrl: 'https://another.example' }), /填写 API Key/);
  assert.equal(legacyCalls, 0);
  const saved = await service.save({ ...DEFAULT_CONNECTION, baseUrl: 'https://new.example/v1', apiKey: 'controlled-unit-key', model: 'main-test', subagentModel: 'child-test', reasoningEffort: 'high', subagentReasoningEffort: 'minimal' });
  assert.equal(JSON.stringify(saved).includes('controlled-unit-key'), false);
  const bytes = await fs.readFile(file, 'utf8'); assert.equal(bytes.includes('controlled-unit-key'), false);
  const reopened = createModelConnection(file, { encryption });
  const main = await reopened.request(); assert.equal(main.apiKey, 'controlled-unit-key'); assert.equal(main.model, 'main-test'); assert.equal(main.reasoning_effort, 'high');
  const child = await reopened.request('subagent', 'ultra'); assert.equal(child.model, 'child-test'); assert.equal(child.reasoning_effort, 'minimal');
  const selected = await reopened.request(undefined, 'max', 'child-test'); assert.equal(selected.model, 'child-test'); assert.equal(selected.reasoning_effort, 'max');
  await assert.rejects(reopened.request(undefined, 'max', 'not-configured'), /已配置列表/);
  assert.equal((await reopened.request(undefined, 'low')).reasoning_effort, 'low');
  await assert.rejects(reopened.save({ ...saved, baseUrl: 'https://different.example' }), /API Key/);
  assert.equal((await reopened.get()).baseUrl, 'https://new.example/v1');
  await reopened.save({ ...saved, subagentModel: '', subagentReasoningEffort: '', reasoningEffort: '' });
  const inherited = await reopened.request('subagent'); assert.equal(inherited.model, 'main-test'); assert.equal('reasoning_effort' in inherited, false);
  assert.equal((await reopened.request(undefined, 'max', 'main-test')).reasoning_effort, 'max');
  assert.equal('reasoning_effort' in await reopened.request(undefined, '', 'main-test'), false);
});

test('model list uses the configured URL, refuses redirects and handles HTTP and malformed lists', async (t) => {
  let response = new Response(JSON.stringify({ data: [{ id: 'z-model' }, { id: 'a-model' }, { id: 'z-model' }] }));
  let call; const { service } = await fixture(t, { fetchImpl: async (url, options) => { call = { url, options }; return response; } });
  const input = { ...DEFAULT_CONNECTION, baseUrl: 'https://model.example', apiKey: 'controlled-unit-key' };
  assert.deepEqual((await service.models(input)).models, ['a-model', 'z-model']);
  assert.equal(call.url, 'https://model.example/v1/models'); assert.equal(call.options.redirect, 'error');
  response = new Response('no', { status: 401 }); await assert.rejects(service.models(input), /HTTP 401/);
  response = new Response('{}'); await assert.rejects(service.models(input), /兼容模型列表/);
  response = new Response('not json'); await assert.rejects(service.models(input), /JSON/);
});

test('damaged config is retained and encryption unavailability cannot overwrite state', async (t) => {
  const { file } = await fixture(t); await fs.writeFile(file, '{damaged');
  const service = createModelConnection(file, { encryption }); assert.match((await service.get()).error, /无法读取/);
  await assert.rejects(service.save(DEFAULT_CONNECTION), /无法读取/); assert.equal(await fs.readFile(file, 'utf8'), '{damaged');
  const unavailable = await fixture(t, { encryption: { isEncryptionAvailable: () => false } });
  await assert.rejects(unavailable.service.save({ ...DEFAULT_CONNECTION, apiKey: 'controlled-unit-key' }), /加密不可用/);
  await assert.rejects(fs.access(unavailable.file));
});

test('none and minimal conversation effort survive reload without changing archive semantics', () => {
  for (const effort of ['none', 'minimal']) { const chat = createConversation('answer', undefined, effort); assert.equal(normalizeLibrary({ activeId: chat.id, conversations: [chat] }).conversations[0].reasoningEffort, effort); }
  const chat = createConversation(); chat.messages = [{ id: 'model-response', role: 'assistant', model: 'configured-model', content: '你好' }];
  assert.equal(normalizeLibrary({ activeId: chat.id, conversations: [chat] }).conversations[0].messages[0].model, 'configured-model');
});


test('tool protocol selection survives save and old Grok configurations gain compatible execution', async (t) => {
  assert.equal(normalizeConnection().toolProtocol,'json');
  assert.throws(()=>normalizeConnection({...DEFAULT_CONNECTION,toolProtocol:'unknown'}),/通道/);
  const {file,service}=await fixture(t,{legacyKey:()=> 'legacy-unit-key'});
  await service.save({...DEFAULT_CONNECTION,toolProtocol:'native'});
  assert.equal((await service.request()).toolProtocol,'native');
  const reopened=createModelConnection(file,{encryption,legacyKey:()=> 'legacy-unit-key'});
  assert.equal((await reopened.get()).toolProtocol,'native');
});
