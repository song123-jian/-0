import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { createModelTeam, advisorReply, advisorCompatibleEffort, runCompatibleAdvisorRequest } = require('../electron/model-team.cjs');
const { runModelTask } = require('../electron/agent-runtime.cjs');
const { createSubagentCoordinator } = require('../electron/subagent-coordinator.cjs');
const { createSubagentTools } = require('../electron/subagent-tools.cjs');

const review = () => JSON.stringify({ verdict: 'revise', summary: '核对范围和实际验证', checks: ['保持现有数据', '回读修改并验证'] });
const connection = { endpoint: 'https://unit.example/v1/chat/completions', apiKey: 'main-unit-key', model: 'main', toolProtocol: 'native', retryLimit: 0 };
const tools = ['update_plan', 'write_file', 'read_file', 'run_command', 'subagent_wait'].map(name => ({ type: 'function', function: { name, parameters: { type: 'object', properties: {} } } }));
const call = (name, args = {}) => ({ id: 'call_' + name, type: 'function', function: { name, arguments: JSON.stringify(args) } });
const response = message => Response.json({ choices: [{ message }] });

test('advisor is idle for ordinary answers and successful read-only exploration', async () => {
  let count = 0;
  const team = createModelTeam({ enabled: true, consult: async () => { count++; return review(); } });
  assert.equal(await team.beforeTool('read_file', { path: 'README.md' }), null);
  await team.afterTool('read_file', {}, { ok: true, hash: 'read-hash' }, 'succeeded');
  assert.equal(await team.beforeFinal('这是项目文档说明'), null);
  assert.equal(count, 0);
});

test('provider-default advisor sampling works without changing the selected model or effort', async () => {
  let observed;
  const result = await runModelTask({ connection: { ...connection, model: 'strict-model', temperature: null, reasoning_effort: 'ultra', maxOutputTokens: 1200 },
    messages: [{ role: 'user', content: 'review harmless plan' }], tools: [], maxRounds: 1,
    fetchImpl: async (_url, init) => {
      observed = JSON.parse(init.body);
      return Object.hasOwn(observed, 'temperature') ? Response.json({ error: { message: 'non-default temperature not supported' } }, { status: 400 }) : response({ content: review() });
    },
  });
  assert.equal(advisorReply(result.text).verdict, 'revise');
  assert.equal(Object.hasOwn(observed, 'temperature'), false);
  assert.equal(observed.model, 'strict-model'); assert.equal(observed.reasoning_effort, 'ultra');
  assert.equal(observed.max_tokens, 1200); assert.equal(observed.tools, undefined);
});

test('advisor adapts once to an explicitly advertised lower effort without changing saved choices', async () => {
  const configured = { ...connection, model: 'strict-model', temperature: null, reasoning_effort: 'ultra', maxOutputTokens: 1200 };
  const requests = [], adaptations = [];
  const run = current => runModelTask({ connection: current, messages: [{ role: 'user', content: 'review plan' }], tools: [], maxRounds: 1,
    fetchImpl: async (_url, init) => {
      const body = JSON.parse(init.body); requests.push(body);
      return body.reasoning_effort === 'ultra'
        ? Response.json({ error: { message: 'strict-model does not support reasoning effort "ultra"; use low, medium, high, xhigh or max' } }, { status: 400 })
        : response({ content: review() });
    },
  });
  const result = await runCompatibleAdvisorRequest(configured, run, { onAdapt: (from, to) => adaptations.push([from, to]) });
  assert.equal(advisorReply(result.text).verdict, 'revise');
  assert.deepEqual(requests.map(item => item.reasoning_effort), ['ultra', 'max']);
  assert.ok(requests.every(item => item.model === 'strict-model' && item.max_tokens === 1200 && !Object.hasOwn(item, 'temperature') && !Object.hasOwn(item, 'tools')));
  assert.deepEqual(adaptations, [['ultra', 'max']]); assert.equal(configured.reasoning_effort, 'ultra');
});

test('advisor effort compatibility never retries unrelated, cancelled or repeated service errors', async () => {
  const detail = 'strict-model does not support reasoning effort "ultra"; use low, medium, high, xhigh or max';
  assert.equal(advisorCompatibleEffort({ httpStatus: 400, providerDetail: detail }, 'ultra'), 'max');
  assert.equal(advisorCompatibleEffort({ httpStatus: 503, providerDetail: detail }, 'ultra'), '');
  assert.equal(advisorCompatibleEffort({ httpStatus: 400, providerDetail: detail }, 'high'), '');
  assert.equal(advisorCompatibleEffort({ httpStatus: 400, providerDetail: 'unknown request error' }, 'ultra'), '');
  const controller = new AbortController(); controller.abort();
  let calls = 0; const serviceError = Object.assign(Error('rejected'), { httpStatus: 400, providerDetail: detail });
  await assert.rejects(runCompatibleAdvisorRequest({ reasoning_effort: 'ultra' }, async () => { calls++; throw serviceError; }, { signal: controller.signal }), error => error === serviceError);
  assert.equal(calls, 1);
  calls = 0;
  await assert.rejects(runCompatibleAdvisorRequest({ reasoning_effort: 'ultra' }, async () => { calls++; throw serviceError; }), error => error === serviceError);
  assert.equal(calls, 2);
});

for (const streaming of [false, true]) test('advisor service-error details are readable, redacted and never treated as a pass: ' + streaming, async () => {
  let calls = 0; const events = [];
  const team = createModelTeam({ enabled: true, secrets: ['main-unit-key'], emit: e => events.push(e),
    consult: () => runModelTask({ connection, tools: [], messages: [], maxRounds: 1,
      fetchImpl: async () => {
        calls++; const payload = { error: { type: 'invalid_request_error', message: 'unsupported sampling apiKey=provider-hidden main-unit-key' } };
        return streaming ? new Response('data: ' + JSON.stringify(payload) + '\n\n', { headers: { 'content-type': 'text/event-stream' } }) : Response.json(payload);
      },
    }),
  });
  const gate = await team.beforeTool('write_file', {});
  assert.match(gate.advice, /unsupported sampling/); assert.doesNotMatch(gate.advice, /provider-hidden|main-unit-key/);
  assert.match(gate.advice, /未完成/); assert.equal(calls, 1); assert.equal(team.snapshot().unavailable, true);
  assert.equal(events.filter(e => e.operation.status === 'succeeded').length, 0);
});

test('one advisor request per gate, bounded redacted context, changed arguments share repeated-error gate', async () => {
  const seen = [], events = [];
  const team = createModelTeam({ enabled: true, task: 'requirement ' + 'x'.repeat(20000) + 'main-unit-key', secrets: ['main-unit-key'], emit: e => events.push(e),
    consult: async input => { seen.push(input); return review(); } });
  const gate = await team.beforeTool('update_plan', { steps: [{ text: 'main-unit-key', status: 'in_progress' }] });
  assert.equal(gate.requires_advisor_review, true);
  assert.equal(await team.beforeTool('write_file', { path: 'code.js' }), null);
  assert.equal(await team.afterTool('run_command', { command: 'first' }, { ok: false, error: 'missing dependency', output: 'Bearer hidden-key' }, 'failed'), null);
  await team.afterTool('read_file', {}, { ok: true }, 'succeeded');
  assert.match(await team.afterTool('run_command', { command: 'changed command' }, { ok: false, error: 'missing dependency' }, 'failed'), /顾问/);
  assert.equal(await team.afterTool('run_command', {}, { ok: false, error: 'missing dependency' }, 'failed'), null);
  assert.match(await team.beforeFinal('draft'), /顾问/);
  assert.equal(await team.beforeFinal('verified final'), null);
  assert.deepEqual(seen.map(item => item.stage), ['plan', 'repeated-error', 'completion']);
  for (const item of seen) { assert.ok(item.context.length < 12000); assert.doesNotMatch(item.context, /main-unit-key|hidden-key/); }
  assert.equal(events.filter(e => e.operation.status === 'succeeded').length, 3);
});

test('failed or timed-out advisor disables further consultations and never claims a pass', async () => {
  let count = 0;
  const team = createModelTeam({ enabled: true, timeoutMs: 12, consult: ({ signal }) => { count++; return new Promise((_, reject) => signal.addEventListener('abort', () => reject(Error('aborted')), { once: true })); } });
  const gate = await team.beforeTool('write_file', {});
  assert.match(gate.advice, /未完成.*不再重试/);
  assert.equal(await team.beforeFinal('result'), null);
  assert.equal(team.snapshot().unavailable, true);
  assert.equal(count, 1);
});

test('parent cancellation aborts advisor without continuing the task', async () => {
  const parent = new AbortController(); let advisorSignal;
  const team = createModelTeam({ enabled: true, signal: parent.signal, consult: async ({ signal }) => { advisorSignal = signal; parent.abort(); return review(); } });
  await assert.rejects(team.beforeTool('write_file', {}), /停止/);
  assert.equal(advisorSignal.aborted, true);
});

test('deferred directory rules and unrelated first failures do not escalate', async () => {
  const seen = [];
  const team = createModelTeam({ enabled: true, consult: async input => { seen.push(input); return review(); } });
  await team.afterTool('read_file', {}, { ok: false, requires_instruction_review: true }, 'deferred');
  await team.afterTool('read_file', {}, { ok: false, error: 'A' }, 'failed');
  await team.afterTool('read_file', {}, { ok: false, error: 'B' }, 'failed');
  assert.equal(seen.length, 0);
  assert.throws(() => advisorReply('{"verdict":"ready","summary":"no checks"}'), /格式/);
});

for (const protocol of ['native', 'json']) test(protocol + ' runtime defers plan and batched effects; main incorporates completion advice once', async () => {
  let requests = 0, writes = 0; const seen = [];
  const team = createModelTeam({ enabled: true, consult: async input => { seen.push(input.stage); return review(); } });
  const result = await runModelTask({ connection: { ...connection, toolProtocol: protocol }, messages: [{ role: 'user', content: 'modify one file' }], tools, team,
    executeTool: async name => { if (name === 'write_file') writes++; return { ok: true }; },
    fetchImpl: async (_, init) => {
      requests++; const body = JSON.parse(init.body);
      const step = protocol === 'native' ? [
        { tool_calls: [call('update_plan', { steps: [{ text: 'write and verify' }] }), call('write_file', { path: 'file.js' })] },
        { tool_calls: [call('write_file', { path: 'file.js' })] },
        { content: 'draft answer' }, { content: 'verified answer' },
      ] : [
        { type: 'tool', name: 'update_plan', arguments: { steps: [{ text: 'write and verify' }] } },
        { type: 'tool', name: 'write_file', arguments: { path: 'file.js' } },
        { type: 'final', content: 'draft answer' }, { type: 'final', content: 'verified answer' },
      ];
      if (requests === 2) { assert.equal(writes, 0); assert.match(JSON.stringify(body.messages), /requires_advisor_review/); }
      if (requests === 4) assert.match(JSON.stringify(body.messages), /顾问的独立核验意见/);
      return response(protocol === 'native' ? step[requests - 1] : { content: JSON.stringify(step[requests - 1]) });
    },
  });
  assert.equal(writes, 1); assert.equal(requests, 4);
  assert.deepEqual(seen, ['plan', 'completion']);
  assert.equal(result.text.slice(result.finalContentOffset), 'verified answer');
});

test('runtime keeps native tool call/results paired before adding repeated-error advice', async () => {
  let requests = 0, invoked = 0;
  const team = createModelTeam({ enabled: true, consult: async () => review() });
  await runModelTask({ connection, messages: [], tools, team,
    executeTool: async () => { invoked++; return { ok: false, error: 'same error' }; },
    fetchImpl: async (_, init) => {
      requests++; const body = JSON.parse(init.body);
      if (requests === 1) return response({ tool_calls: [call('read_file', { path: 'a' }), { ...call('read_file', { path: 'b' }), id: 'b' }, { ...call('read_file', { path: 'c' }), id: 'c' }] });
      if (requests === 2) {
        assert.equal(invoked, 2);
        assert.deepEqual(body.messages.slice(1, 4).map(m => m.role), ['tool', 'tool', 'tool']);
      }
      return response({ content: requests === 2 ? 'draft' : 'verified' });
    },
  });
});

test('unfinished child work blocks main completion even with advisor disabled', async () => {
  let active = true, requests = 0;
  const team = createModelTeam({ activeTasks: () => active ? [{ id: 'sub-pending', status: 'running' }] : [] });
  const result = await runModelTask({ connection, messages: [], tools, team,
    executeTool: async name => { assert.equal(name, 'subagent_wait'); active = false; return { ok: true, status: 'complete' }; },
    fetchImpl: async () => { requests++; return response(requests === 1 ? { content: 'premature' } : requests === 2 ? { tool_calls: [call('subagent_wait', { task_id: 'sub-pending' })] } : { content: 'integrated' }); },
  });
  assert.equal(result.text.slice(result.finalContentOffset), 'integrated'); assert.equal(requests, 3);
});

test('completed goal_finish is deferred for advisor, then commits the verified result', async () => {
  let requests = 0; const seen = [];
  const team = createModelTeam({ enabled: true, consult: async input => { seen.push(input.stage); return review(); } });
  const result = await runModelTask({ connection, messages: [], tools, team, goal: { maxRequests: 8 }, executeTool: async () => ({ ok: true }),
    fetchImpl: async () => { requests++; return response({ tool_calls: [requests < 3 ? call('update_plan', { steps: [{ text: 'work' }] }) : call('goal_finish', { status: 'completed', summary: 'done', evidence: 'actual file check' })] }); },
  });
  assert.equal(result.goalStatus, 'completed'); assert.equal(requests, 4); assert.deepEqual(seen, ['plan', 'completion']);
});

test('explorers merge identical active work without fixed concurrency or task budgets', async () => {
  const release = new Map(); let runs = 0;
  const coordinator = createSubagentCoordinator({ workspaceRoot: 'C:/workspace',
    run: async ({ id }) => { runs++; return new Promise(resolve => release.set(id, resolve)); } });
  const args = { task: 'read docs', mode: 'analysis', paths: ['docs'], parentRequestId: 'parent' };
  const first = await coordinator.start(args);
  const duplicate = await coordinator.start(args);
  assert.equal(duplicate.id, first.id); assert.equal(duplicate.reused, true); assert.equal(runs, 1);
  assert.doesNotThrow(() => coordinator.assertWritable('C:/workspace/docs/guide.md'));
  const second = await coordinator.start({ ...args, task: 'read interfaces' });
  const third = await coordinator.start({ ...args, task: 'third' });
  release.get(first.id)('first'); release.get(second.id)('second');
  release.get(third.id)('third');
  await coordinator.wait(first.id, 1000, 'parent'); await coordinator.wait(second.id, 1000, 'parent'); await coordinator.wait(third.id, 1000, 'parent');
  const next = await coordinator.start({ ...args, task: 'next' });
  assert.equal(runs, 4); release.get(next.id)('next'); await coordinator.wait(next.id, 1000, 'parent');
});

test('read-only delegation rejects edits before network preparation', async () => {
  let prepare = 0;
  const delegation = createSubagentTools({ coordinator: {}, parentRequestId: 'parent', allowEdits: false, prepare: async () => { prepare++; } });
  const start = delegation.definitions.find(item => item.function.name === 'subagent_start');
  assert.deepEqual(start.function.parameters.properties.mode.enum, ['analysis']);
  await assert.rejects(delegation.execute('subagent_start', { task: 'edit', mode: 'edit', paths: ['file'] }), /默认只读/);
  assert.equal(prepare, 0);
});

test('active task deduplication never shares results with another parent', async () => {
  const release = [];
  const coordinator = createSubagentCoordinator({ workspaceRoot: 'C:/workspace', run: async () => new Promise(resolve => release.push(resolve)) });
  const input = { task: 'same file analysis', mode: 'analysis', paths: ['docs'] };
  const a = await coordinator.start({ ...input, parentRequestId: 'parent-a' });
  const b = await coordinator.start({ ...input, parentRequestId: 'parent-b' });
  assert.notEqual(a.id, b.id); assert.equal(release.length, 2);
  await assert.rejects(coordinator.read(a.id, 'parent-b'), /不属于/);
  release.forEach(resolve => resolve('done'));
  await Promise.all([coordinator.wait(a.id, 1000, 'parent-a'), coordinator.wait(b.id, 1000, 'parent-b')]);
});

test('escaped context stays bounded and quoted credential fields are redacted', async () => {
  let context;
  const team = createModelTeam({ enabled: true, task: '\0'.repeat(5000), consult: async input => { context = input.context; return review(); } });
  await team.beforeTool('write_file', { content: '\0'.repeat(5000), apiKey: 'quoted-unit-secret' });
  assert.ok(context.length <= 12000); assert.doesNotThrow(() => JSON.parse(context));
  const { redact } = require('../electron/model-team.cjs');
  assert.doesNotMatch(redact('{"apiKey":"quoted-unit-secret"}'), /quoted-unit-secret/);
});
