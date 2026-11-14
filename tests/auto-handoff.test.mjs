import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
const require = createRequire(import.meta.url);
const { createAutoHandoff, normalizeAutoHandoff } = require('../electron/auto-handoff.cjs');
const { createModelConnection, normalizeConnection } = require('../electron/model-connection.cjs');
const { runModelTask } = require('../electron/agent-runtime.cjs');
const modes = ['main', 'subagent', 'advisor'];
const config = (patch = {}) => ({ ...normalizeConnection({ name: 'fixture', baseUrl: 'http://127.0.0.1/main/v1', model: 'main', models: ['main'],
  subagentBaseUrl: 'http://127.0.0.1/subagent/v1', subagentModel: 'subagent', subagentModels: ['subagent'],
  advisorBaseUrl: 'http://127.0.0.1/advisor/v1', advisorModel: 'advisor', advisorModels: ['advisor'],
  autoHandoffEnabled: true, modelCapabilityLevels: { main: 1, subagent: 2, advisor: 3 } }),
  hasCredential: true, hasSubagentCredential: true, hasAdvisorCredential: true, ...patch });
const connection = mode => ({ endpoint: `http://127.0.0.1/${mode}/v1/chat/completions`, model: mode, apiKey: 'test-only', toolProtocol: 'native' });
function policy(options = {}) { const events = []; return { events, auto: createAutoHandoff({ config: config(options.config), mode: options.mode || 'main', connection: connection(options.mode || 'main'), emit: e => events.push(e) }) }; }
const request = (auto, evidence = '实际执行证据') => auto.requestAssistance({ reason: '当前实现超出我的能力', evidence });
function apply(auto) { const d = auto.takeDecision(); assert.ok(d); assert.equal(auto.commit(d), true); return d; }
function response(value) { return new Response('data: ' + JSON.stringify({ choices: [{ delta: value, finish_reason: value.tool_calls ? 'tool_calls' : 'stop' }] }) + '\n\ndata: [DONE]\n\n', { headers: { 'content-type': 'text/event-stream' } }); }
let id = 0;
const call = (name, args = {}) => ({ tool_calls: [{ id: 'call-' + ++id, index: 0, type: 'function', function: { name, arguments: JSON.stringify(args) } }] });
const definitions = ['write_file', 'read_file'].map(name => ({ type: 'function', function: { name, parameters: { type: 'object' } } }));
function switching(auto, protocol = 'native') { return () => { const d = auto.takeDecision(); if (!d) return null; auto.commit(d); return { connection: { ...connection(d.candidate.mode), toolProtocol: d.candidate.mode === 'advisor' ? protocol : 'native' }, continuationNote: d.kind === 'return' ? '模式一核验完善并继续' : '较高等级模型接手' }; }; }

test('old settings remain opt-in and capability levels validate without guessing model names', () => {
  assert.deepEqual(normalizeAutoHandoff(), { autoHandoffEnabled: false, modelCapabilityLevels: { main: 0, subagent: 0, advisor: 0 } });
  assert.throws(() => normalizeAutoHandoff({ autoHandoffEnabled: 'yes' }));
  assert.throws(() => normalizeAutoHandoff({ modelCapabilityLevels: { main: 4 } }));
  assert.throws(() => normalizeAutoHandoff({ modelCapabilityLevels: [] }));
});

test('settings survive actual save and fresh connection store while role credentials remain bound', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'scodex-auto-handoff-unit-'));
  try {
    const encryption = { isEncryptionAvailable: () => true, encryptString: x => Buffer.from(x), decryptString: x => x.toString() };
    const file = path.join(dir, 'connection.json');
    const store = createModelConnection(file, { encryption });
    await store.save({ ...config(), apiKey: 'main-test', subagentApiKey: 'sub-test', advisorApiKey: 'advisor-test' });
    const reopened = createModelConnection(file, { encryption }); const saved = await reopened.get();
    assert.equal(saved.autoHandoffEnabled, true); assert.deepEqual(saved.modelCapabilityLevels, { main: 1, subagent: 2, advisor: 3 });
    assert.equal((await reopened.request(undefined, undefined, 'advisor', 'advisor')).apiKey, 'advisor-test');
    assert.equal(saved.hasCredential, true);
  } finally { await fs.rm(dir, { recursive: true, force: true }); }
});

test('all three starting modes select a configured higher level and return to mode one', () => {
  for (const mode of modes) {
    const levels = mode === 'advisor' ? { main: 3, subagent: 2, advisor: 1 } : { main: 1, subagent: 2, advisor: 3 };
    const { auto } = policy({ mode, config: { modelCapabilityLevels: levels } });
    assert.equal(request(auto).ok, true); const upgrade = apply(auto); assert.ok(levels[upgrade.candidate.mode] > levels[mode]);
    assert.equal(auto.beforeFinal(), true); assert.equal(apply(auto).candidate.mode, 'main'); assert.equal(auto.snapshot().phase, 'refining');
  }
});

test('same unresolved issue is deduplicated, with no numeric cap for new issues', () => {
  const { auto } = policy();
  for (let episode = 0; episode < 12; episode++) {
    assert.equal(request(auto, '独立问题-' + episode).queued, true); apply(auto); auto.beforeFinal(); apply(auto);
  }
  assert.equal(auto.snapshot().handoffs, 12);
  assert.equal(request(auto, '独立问题-11').ok, false); assert.equal(auto.hasPending(), false);
});

test('one failure or interrupted failure sequence cannot trigger handoff; two matching failures can', () => {
  const { auto } = policy(); const failure = { ok: false, error: 'assertion failed' };
  auto.afterTool('run_command', { command: 'check' }, failure, 'failed'); assert.equal(auto.hasPending(), false);
  auto.afterTool('read_file', {}, { ok: true }, 'succeeded');
  auto.afterTool('run_command', { command: 'check' }, failure, 'failed'); assert.equal(auto.hasPending(), false);
  auto.afterTool('run_command', { command: 'check' }, failure, 'failed'); assert.equal(auto.hasPending(), true);
});

test('permission, credential, network, rate limits and stale-file errors do not mean model weakness', () => {
  for (const error of ['权限拒绝', 'HTTP 401', 'HTTP 429', 'ECONNRESET', '文件已变化，请重新读取 hash', '连接超时']) {
    const { auto } = policy(); for (let n = 0; n < 3; n++) auto.afterTool('run_command', {}, { ok: false, error: '命令退出码：7。', output: error }, 'failed');
    assert.equal(auto.hasPending(), false, error); assert.equal(auto.snapshot().handoffs, 0);
    assert.equal(request(auto, error).ok, false, 'External failure evidence must not request escalation');
  }
});

test('unknown levels, missing credentials, and the same actual model cannot be selected as stronger', () => {
  const variants = [
    { modelCapabilityLevels: { main: 0, subagent: 2, advisor: 3 } },
    { hasAdvisorCredential: false, hasSubagentCredential: false },
    { advisorBaseUrl: 'http://127.0.0.1/main/v1', advisorModel: 'main', advisorModels: ['main'], hasSubagentCredential: false },
  ];
  for (const config of variants) { const { auto } = policy({ config }); assert.equal(request(auto).ok, false); assert.equal(auto.hasPending(), false); }
});

test('preflight rejection tries the next eligible model without returning success; manual override clears pending work', () => {
  const { auto } = policy(); request(auto); const first = auto.takeDecision(); assert.equal(first.candidate.mode, 'advisor'); auto.reject(first);
  assert.equal(auto.takeDecision().candidate.mode, 'subagent');
  request(auto, 'new issue'); auto.manualOverride(); assert.equal(auto.takeDecision(), null); assert.equal(request(auto, 'third issue').ok, false);
});

test('runtime performs handoff after the complete batch and mode-one refinement preserves tool evidence across protocols', async () => {
  for (const protocol of ['native', 'json']) {
    const { auto } = policy(); let step = 0, writes = 0; const seen = [];
    const result = await runModelTask({ connection: connection('main'), messages: [{ role: 'system', content: 'same authorization' }, { role: 'user', content: 'original task' }],
      tools: definitions, autoHandoff: auto, takeExecution: switching(auto, protocol),
      executeTool: async name => { if (name === 'write_file') writes++; return { ok: true, evidence: 'real-result' }; },
      fetchImpl: async (_url, input) => {
        const body = JSON.parse(input.body); seen.push(body.model);
        assert.match(JSON.stringify(body.messages), /original task/);
        if (step++ === 0) {
          const calls = [...call('request_model_assistance', { reason: '实现超出自身能力', evidence: '需要协助当前片段' }).tool_calls, ...call('write_file', { path: 'once' }).tool_calls];
          calls[1].index = 1; return response({ tool_calls: calls });
        }
        assert.equal(writes, 1); assert.match(JSON.stringify(body.messages), /real-result/);
        if (body.model === 'advisor') return response({ content: protocol === 'json' ? JSON.stringify({ type: 'final', content: '接手总结' }) : '接手总结' });
        assert.match(JSON.stringify(body.messages), /接手总结/); return response({ content: '模式一完善并继续完成' });
      } });
    assert.deepEqual(seen, ['main', 'advisor', 'main']); assert.equal(writes, 1); assert.match(result.text.slice(result.finalContentOffset), /模式一完善/);
  }
});

test('runtime automatically switches on repeated failed execution and preserves both failure results', async () => {
  const { auto } = policy(); const seen = []; let failures = 0;
  await runModelTask({ connection: connection('main'), messages: [], tools: definitions, autoHandoff: auto, takeExecution: switching(auto),
    executeTool: async () => ({ ok: false, error: 'assertion failed' }),
    fetchImpl: async (_url, input) => { const body = JSON.parse(input.body); seen.push(body.model);
      if (failures < 2) { failures++; return response(call('write_file', { path: 'same' })); }
      if (body.model === 'advisor') assert.equal(body.messages.filter(x => x.role === 'tool').length, 2);
      return response({ content: 'done' }); } });
  assert.deepEqual(seen, ['main', 'main', 'advisor', 'main']);
});

test('goal_finish from the stronger executor is deferred until mode one actually continues', async () => {
  const { auto } = policy(); const seen = [];
  const result = await runModelTask({ connection: connection('main'), messages: [], tools: definitions, goal: {}, autoHandoff: auto, takeExecution: switching(auto), executeTool: async () => ({ ok: true }),
    fetchImpl: async (_url, input) => { const body = JSON.parse(input.body); seen.push(body.model);
      return response(seen.length === 1 ? call('request_model_assistance', { reason: '实现需要帮助', evidence: '当前问题' }) : call('goal_finish', { status: 'completed', summary: '已完成', evidence: '已回读结果' })); } });
  assert.deepEqual(seen, ['main', 'advisor', 'main']); assert.equal(result.goalStatus, 'completed');
});

test('cancellation before the switch performs no further model request', async () => {
  const { auto } = policy(); const controller = new AbortController(); let requests = 0;
  await assert.rejects(runModelTask({ connection: connection('main'), messages: [], tools: definitions, signal: controller.signal, autoHandoff: auto, takeExecution: switching(auto),
    executeTool: async () => ({ ok: true }), emit: e => { if (e.operation?.name === 'request_model_assistance' && e.operation.status === 'succeeded') controller.abort(); },
    fetchImpl: async () => { requests++; return response(call('request_model_assistance', { reason: '任务需要协助', evidence: '已有结果' })); } }));
  auto.close('cancelled'); assert.equal(requests, 1); assert.equal(auto.hasPending(), false);
});
