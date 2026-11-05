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

test('main and subagent credentials route independently and never expose either credential', async (t) => {
  const { file, service } = await fixture(t);
  const saved = await service.save({ ...DEFAULT_CONNECTION,
    baseUrl: 'https://main.example/v1', apiKey: 'main-secret', model: 'main-model', models: ['main-model'],
    subagentBaseUrl: 'https://child.example/v1', subagentApiKey: 'child-secret', subagentModel: 'child-model', subagentModels: ['child-model'],
  });
  assert.equal(saved.hasCredential, true);
  assert.equal(saved.hasSubagentCredential, true);
  assert.doesNotMatch(JSON.stringify(saved), /main-secret|child-secret/);
  const bytes = await fs.readFile(file, 'utf8');
  assert.doesNotMatch(bytes, /main-secret|child-secret/);
  const reopened = createModelConnection(file, { encryption });
  const main = await reopened.request('main');
  const child = await reopened.request('subagent');
  assert.deepEqual({ endpoint: main.endpoint, model: main.model, apiKey: main.apiKey }, { endpoint: 'https://main.example/v1/chat/completions', model: 'main-model', apiKey: 'main-secret' });
  assert.deepEqual({ endpoint: child.endpoint, model: child.model, apiKey: child.apiKey }, { endpoint: 'https://child.example/v1/chat/completions', model: 'child-model', apiKey: 'child-secret' });
});

test('a different API path on the same host requires its own subagent key', async (t) => {
  const { service } = await fixture(t);
  const input = { ...DEFAULT_CONNECTION, baseUrl: 'https://provider.example/v1', apiKey: 'main-key',
    model: 'main-model', subagentBaseUrl: 'https://provider.example/child/v1',
    subagentModel: 'child-model', subagentModels: ['child-model'] };
  await assert.rejects(service.save(input), /独立密钥/);
  const saved = await service.save({ ...input, subagentApiKey: 'child-key' });
  assert.equal((await service.request('subagent')).apiKey, 'child-key');
  await assert.rejects(service.save({ ...saved, subagentBaseUrl: 'https://provider.example/other/v1' }), /独立密钥/);
  await assert.rejects(service.models({ ...saved, subagentBaseUrl: 'https://provider.example/other/v1' }, 'subagent'), /独立 API Key/);
});

test('a separate subagent service must select a model before saving', async (t) => {
  const { service } = await fixture(t);
  await assert.rejects(service.save({ ...DEFAULT_CONNECTION, baseUrl: 'https://main.example/v1', apiKey: 'main-key',
    subagentBaseUrl: 'https://child.example/v1', subagentApiKey: 'child-key', subagentModel: '', subagentModels: [] }), /请先选择子模型/);
});

test('subagent tool protocol and reasoning effort are independent of a different main model', async (t) => {
  const { file, service } = await fixture(t);
  await service.save({ ...DEFAULT_CONNECTION, baseUrl: 'https://main.example/v1', apiKey: 'main-key',
    model: 'main-model', reasoningEffort: 'high', toolProtocol: 'json',
    subagentBaseUrl: 'https://child.example/v1', subagentApiKey: 'child-key',
    subagentModels: ['child-model'], subagentModel: 'child-model', subagentReasoningEffort: '', subagentToolProtocol: 'native' });
  const reopened = createModelConnection(file, { encryption });
  const main = await reopened.request('main');
  const child = await reopened.request('subagent');
  assert.equal(main.toolProtocol, 'json');
  assert.equal(main.reasoning_effort, 'high');
  assert.equal(child.toolProtocol, 'native');
  assert.equal('reasoning_effort' in child, false);
  assert.equal((await reopened.get()).subagentToolProtocol, 'native');
});

test('subagent model discovery uses its own address and key and cannot silently lose a required key', async (t) => {
  let seen;
  const { file, service } = await fixture(t, { fetchImpl: async (url, options) => { seen = { url, authorization: options.headers.authorization }; return Response.json({ data: [{ id: 'child-model' }] }); } });
  const input = { ...DEFAULT_CONNECTION, apiKey: 'main-secret', baseUrl: 'https://main.example/v1', subagentApiKey: 'child-secret', subagentBaseUrl: 'https://child.example/v1', subagentModels: ['child-model'], subagentModel: 'child-model' };
  await service.save(input);
  const result = await service.models(input, 'subagent');
  assert.equal(result.address, 'https://child.example/v1');
  assert.deepEqual(seen, { url: 'https://child.example/v1/models', authorization: 'Bearer child-secret' });
  const reopened = createModelConnection(file, { encryption });
  await assert.rejects(reopened.save({ ...input, subagentBaseUrl: 'https://other-child.example/v1', subagentApiKey: '' }), /独立密钥/);
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

test('fetched replacement survives persistence and reopening without resurrecting old selections', async (t) => {
  const { replaceModelList } = await import('../src/lib/model-list.js');
  const models = Array.from({ length: 36 }, (_, index) => 'fetched-' + String(index + 1).padStart(2, '0'));
  const { file, service } = await fixture(t, { fetchImpl: async () => new Response(JSON.stringify({ data: models.map(id => ({ id })) })) });
  const old = await service.save({ ...DEFAULT_CONNECTION, models: ['old-main', 'old-child'], model: 'old-main', subagentModel: 'old-child', baseUrl: 'https://replace.example/v1', apiKey: 'controlled-unit-key' });
  const fetched = await service.models(old);
  await service.save({ ...old, ...replaceModelList(old, fetched.models) });
  const reopened = createModelConnection(file, { encryption });
  const saved = await reopened.get();
  assert.deepEqual(saved.models, models);
  assert.equal(saved.model, models[0]);
  assert.equal(saved.subagentModel, models[0]);
  assert.equal((await reopened.request('subagent')).model, models[0]);
  // Manual IDs remain supported by the editable default/subagent fields.
  const manual = await reopened.save({ ...saved, model: 'manual-model' });
  assert.ok(manual.models.includes('manual-model'));
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

test('legacy configs keep model choices, default to two read-only explorers and leave advisor off', () => {
  const result = normalizeConnection({ ...DEFAULT_CONNECTION, model: 'existing-model', subagentModel: 'existing-child' });
  assert.equal(result.model, 'existing-model'); assert.equal(result.subagentModel, 'existing-child');
  assert.equal(result.subagentMaxConcurrent, 2); assert.equal(result.subagentAllowEdits, false);
  assert.equal(result.advisorEnabled, false); assert.equal(result.advisorModel, '');
  assert.equal(normalizeConnection({ ...DEFAULT_CONNECTION, subagentMaxConcurrent: 999 }).subagentMaxConcurrent, 3);
});

test('advisor uses its independently encrypted connection with no retries or tools protocol inheritance', async t => {
  const { file, service } = await fixture(t);
  const saved = await service.save({ ...DEFAULT_CONNECTION, baseUrl: 'https://main.example/v1', apiKey: 'main-secret', model: 'main-model', toolProtocol: 'json',
    subagentBaseUrl: 'https://child.example/v1', subagentApiKey: 'child-secret', subagentModel: 'child-model',
    advisorEnabled: true, advisorBaseUrl: 'https://advisor.example/v1', advisorApiKey: 'advisor-secret', advisorModel: 'advisor-model', advisorReasoningEffort: 'high' });
  assert.doesNotMatch(JSON.stringify(saved), /main-secret|child-secret|advisor-secret/);
  assert.doesNotMatch(await fs.readFile(file, 'utf8'), /main-secret|child-secret|advisor-secret/);
  const reopened = createModelConnection(file, { encryption });
  const advisor = await reopened.request('advisor');
  assert.equal(advisor.endpoint, 'https://advisor.example/v1/chat/completions'); assert.equal(advisor.apiKey, 'advisor-secret');
  assert.equal(advisor.model, 'advisor-model'); assert.equal(advisor.reasoning_effort, 'high');
  assert.equal(advisor.retryLimit, 0); assert.equal(advisor.maxOutputTokens, 1200); assert.equal(advisor.toolProtocol, 'native');
  assert.equal((await reopened.request('main')).apiKey, 'main-secret'); assert.equal((await reopened.request('subagent')).apiKey, 'child-secret');
});

test('advisor requires a model and exact service key, including disabled address changes', async t => {
  const { service } = await fixture(t);
  const input = { ...DEFAULT_CONNECTION, baseUrl: 'https://provider.example/v1', apiKey: 'main-key', advisorEnabled: true };
  await assert.rejects(service.save(input), /选择顾问模型/);
  const saved = await service.save({ ...input, advisorModel: 'advisor', advisorBaseUrl: 'https://provider.example/advisor/v1', advisorApiKey: 'advisor-key' });
  const disabled = await service.save({ ...saved, advisorEnabled: false, advisorBaseUrl: 'https://provider.example/new/v1' });
  await assert.rejects(service.request('advisor'), /尚未配置或启用/);
  await assert.rejects(service.save({ ...disabled, advisorEnabled: true }), /独立 API Key/);
  assert.equal((await service.get()).advisorEnabled, false);
  await assert.rejects(service.models(disabled, 'advisor'), /独立 API Key/);
  const followed = await service.save({ ...disabled, advisorEnabled: true, advisorBaseUrl: input.baseUrl });
  assert.equal((await service.request('advisor')).apiKey, 'main-key'); assert.equal(followed.hasAdvisorCredential, true);
});

test('advisor discovery routes its own address and key and validates independent effort', async t => {
  let seen;
  const { service } = await fixture(t, { fetchImpl: async (url, options) => { seen = { url, key: options.headers.authorization }; return Response.json({ data: [{ id: 'advisor' }] }); } });
  const input = { ...DEFAULT_CONNECTION, baseUrl: 'https://main.example/v1', apiKey: 'main-key', advisorBaseUrl: 'https://advisor.example/v1', advisorApiKey: 'advisor-key' };
  assert.deepEqual((await service.models(input, 'advisor')).models, ['advisor']);
  assert.deepEqual(seen, { url: 'https://advisor.example/v1/models', key: 'Bearer advisor-key' });
  assert.throws(() => normalizeConnection({ ...input, advisorReasoningEffort: 'invented' }), /推理强度/);
});
