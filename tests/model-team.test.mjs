import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { createModelTeam, executionRoleForMode, advisorReply, supervisionReply, takeoverReply, summarizeTakeoverEvidence, advisorCompatibleEffort, runCompatibleAdvisorRequest, allocateModelShares, proposalReply, reviewReply, runModelDebate, DEBATE_CRITERIA } = require('../electron/model-team.cjs');
const { runModelTask } = require('../electron/agent-runtime.cjs');
const { createSubagentCoordinator } = require('../electron/subagent-coordinator.cjs');
const { createSubagentTools } = require('../electron/subagent-tools.cjs');

const review = () => JSON.stringify({ verdict: 'revise', summary: '核对范围和实际验证', checks: ['保持现有数据', '回读修改并验证'] });
const connection = { endpoint: 'https://unit.example/v1/chat/completions', apiKey: 'main-unit-key', model: 'main', toolProtocol: 'native', retryLimit: 0 };
const tools = ['update_plan', 'write_file', 'read_file', 'run_command', 'subagent_wait'].map(name => ({ type: 'function', function: { name, parameters: { type: 'object', properties: {} } } }));
const call = (name, args = {}) => ({ id: 'call_' + name, type: 'function', function: { name, arguments: JSON.stringify(args) } });
const response = message => Response.json({ choices: [{ message }] });
const proposal = role => JSON.stringify({ title: role + ' plan', summary: '方案摘要', steps: ['检查条件', '实施并验证'], evidenceBasis: ['依据任务描述，未知事实标记为假设'], validation: ['按验收条件检查实际结果'], risks: ['外部依赖可能不可用'] });
const scoreReview = (reviewer, plans, scoreFor = () => 8) => JSON.stringify({ evaluations: plans.map(item => ({ proposalId: item.id, scores: Object.fromEntries(Object.keys(DEBATE_CRITERIA).map(key => [key, scoreFor(item.id, key)])), critique: reviewer + ' 对该方案的具体评议' })) });
const parsedProposals = () => ['main', 'explorer', 'advisor'].map(role => proposalReply(proposal(role), role));
const parsedReviews = (plans, scoreFor) => ['main', 'explorer', 'advisor'].map(reviewer => reviewReply(scoreReview(reviewer, plans, scoreFor), reviewer, plans.map(item => item.id)));

test('composer modes identify the actual team execution role', () => {
  assert.equal(executionRoleForMode('main'), 'main');
  assert.equal(executionRoleForMode('subagent'), 'explorer');
  assert.equal(executionRoleForMode('advisor'), 'advisor');
  assert.equal(executionRoleForMode(), 'main');
});

test('discussion completion and failure retain the selected executor instead of assigning model one', async () => {
  const models = ['main', 'explorer', 'advisor'].map(role => ({ role, model: role + '-fixture' }));
  for (const executorRole of ['main', 'explorer', 'advisor']) {
    const events = [];
    const result = await runModelDebate({ executorRole, task: 'Bounded task', models, emit: event => events.push(event), runModel: async ({ model, stage }) => stage === 'proposal' ? proposal(model.role) : scoreReview(model.role, parsedProposals()) });
    assert.equal(result.executorRole, executorRole);
    const complete = events.findLast(event => event.operation?.name === 'model_debate_result').operation;
    assert.ok(complete.detail.includes(result.executorLabel));
    assert.equal(JSON.parse(complete.output).executorRole, executorRole);
    const failed = await runModelDebate({ executorRole, task: 'Bounded task', models, runModel: async ({ model }) => { if (model.role === 'main') throw Error('unavailable'); return proposal(model.role); } });
    assert.equal(failed.executorRole, executorRole);
    assert.equal(failed.allocation, null);
    assert.ok(failed.reason.includes(failed.executorLabel));
  }
});

test('the two other models supervise and can correct execution, including model one', async () => {
  for (const executorRole of ['main', 'explorer', 'advisor']) {
    const seen = [], handoffs = [], consultations = [];
    const team = createModelTeam({ enabled: true, skipPlanReview: true, executorRole, supervisionPlans: parsedProposals(),
      supervise: async input => { seen.push(input.role); return JSON.stringify({ verdict: 'revise', summary: '核对执行', corrections: ['按新需求修正文件'] }); },
      takeover: async input => { handoffs.push(input.role); return { status: 'succeeded', summary: '已修正并验证', evidence: [{ tool: 'edit_file', ok: true }] }; },
      consult: async input => { consultations.push(input.role); return review(); },
    });
    await team.beforeTool('write_file', { path: 'result.txt' });
    await team.afterTool('write_file', { path: 'result.txt' }, { ok: true }, 'succeeded');
    await team.afterTool('read_file', { path: 'result.txt' }, { ok: true }, 'succeeded');
    const others = ['main', 'explorer', 'advisor'].filter(role => role !== executorRole);
    assert.deepEqual(seen, [...others, ...others]);
    assert.deepEqual(handoffs, others);
    await team.beforeFinal('实际结果');
    assert.deepEqual(consultations, [executorRole === 'advisor' ? 'main' : 'advisor']);
    assert.ok(!consultations.includes(executorRole));
  }
});

test('share allocation gives a clear winner 100 percent and excludes weak constraint compliance', () => {
  const plans = parsedProposals();
  const reviews = parsedReviews(plans, role => role === 'main' ? 10 : role === 'explorer' ? 9 : 8);
  const allocation = allocateModelShares(plans, reviews);
  assert.equal(allocation.method, 'clear-winner'); assert.equal(allocation.winner, 'main');
  assert.deepEqual(allocation.plans.map(item => [item.role, item.score, item.share]), [['main', 100, 100], ['explorer', 90, 0], ['advisor', 80, 0]]);
  const constrained = parsedReviews(plans, (role, criterion) => role === 'explorer' && criterion === 'constraints' ? 4 : 8);
  const filtered = allocateModelShares(plans, constrained);
  assert.equal(filtered.plans.find(item => item.role === 'explorer').eligible, false);
  assert.equal(filtered.plans.find(item => item.role === 'explorer').share, 0);
});

test('share allocation weights close plans, rounds to 100, and reports no qualified plan honestly', () => {
  const plans = parsedProposals();
  const weighted = allocateModelShares(plans, parsedReviews(plans));
  assert.equal(weighted.method, 'weighted');
  assert.deepEqual(weighted.plans.map(item => item.share), [34, 33, 33]);
  assert.equal(weighted.plans.reduce((sum, item) => sum + item.share, 0), 100);
  const rejected = allocateModelShares(plans, parsedReviews(plans, (_role, criterion) => criterion === 'constraints' ? 4 : 3));
  assert.equal(rejected.status, 'no-qualified-plan');
  assert.ok(rejected.plans.every(item => !item.eligible && item.share === 0));
});

test('three models independently propose, review every full proposal, and emit one settled activity record', async () => {
  const models = ['main', 'explorer', 'advisor'].map(role => ({ role, model: role + '-fixture' }));
  const calls = [], events = [];
  const result = await runModelDebate({ task: 'Complete a bounded task.', models, emit: event => events.push(event), runModel: async input => {
    calls.push(input);
    if (input.stage === 'proposal') return proposal(input.model.role);
    const data = JSON.parse(input.messages[1].content.match(/<proposal-data>\n([\s\S]*)\n<\/proposal-data>/)[1]);
    assert.deepEqual(data.map(item => item.title), ['main plan', 'explorer plan', 'advisor plan']);
    return scoreReview(input.model.role, data);
  } });
  assert.equal(result.status, 'complete'); assert.equal(calls.length, 6);
  assert.equal(calls.filter(item => item.stage === 'proposal').length, 3);
  assert.equal(calls.filter(item => item.stage === 'review').length, 3);
  for (const role of ['main', 'explorer', 'advisor']) {
    assert.equal(calls.filter(item => item.stage === 'proposal' && item.model.role === role).length, 1);
    assert.equal(calls.filter(item => item.stage === 'review' && item.model.role === role).length, 1);
  }
  assert.equal(result.allocation.plans.reduce((sum, item) => sum + item.share, 0), 100);
  const operations = events.filter(event => event.type === 'operation').map(event => event.operation);
  const summaries = operations.filter(item => item.name === 'model_debate_result');
  assert.equal(summaries.length, 2); assert.equal(summaries[0].id, summaries[1].id);
  assert.deepEqual(summaries.map(item => item.status), ['running', 'succeeded']);
});

test('a failed independent model leaves allocation absent and skips cross review', async () => {
  const models = ['main', 'explorer', 'advisor'].map(role => ({ role, model: role + '-fixture' }));
  let reviews = 0;
  const result = await runModelDebate({ task: 'Task.', models, runModel: async ({ model, stage }) => {
    if (model.role === 'advisor') throw Error('provider unavailable');
    if (stage === 'review') { reviews++; return '{}'; }
    return proposal(model.role);
  } });
  assert.equal(result.status, 'incomplete'); assert.equal(result.allocation, null); assert.equal(reviews, 0);
  assert.equal(result.proposals.length, 2); assert.match(result.reason, /不生成自动份额/);
});

test('cross-review retries truncated responses with a compact context and does not fabricate allocation', async () => {
  const models = ['main', 'explorer', 'advisor'].map(role => ({ role, model: role + '-fixture' }));
  const calls = [];
  const result = await runModelDebate({ task: 'Task details ' + 'x'.repeat(24000), models, runModel: async input => {
    calls.push(input);
    if (input.stage === 'proposal') return proposal(input.model.role);
    if (input.attempt === 0) throw Error('模型响应被截断或过滤，请缩小任务后重试。');
    return scoreReview(input.model.role, JSON.parse(input.messages[1].content.match(/<proposal-data>\n([\s\S]*)\n<\/proposal-data>/)[1]));
  } });
  assert.equal(result.status, 'complete');
  assert.equal(calls.filter(item => item.stage === 'review').length, 6);
  for (const role of ['main', 'explorer', 'advisor']) {
    const attempts = calls.filter(item => item.stage === 'review' && item.model.role === role);
    assert.deepEqual(attempts.map(item => item.attempt), [0, 1]);
    assert.ok(attempts[1].messages[1].content.length < attempts[0].messages[1].content.length);
  }
  assert.ok(result.failures.length >= 3);
  assert.equal(result.allocation.plans.reduce((sum, item) => sum + item.share, 0), 100);
});

test('debate retry compresses by evidence instead of dropping the middle of the task', async () => {
  const models = ['main', 'explorer', 'advisor'].map(role => ({ role, model: role + '-fixture' }));
  const evidence = 'Critical requirement: E:\\repo\\electron\\model-team.cjs reported Error: preserve this exact failure evidence.';
  const task = [...Array.from({ length: 500 }, (_, index) => `background ${index} ${'x'.repeat(20)}`), evidence,
    ...Array.from({ length: 500 }, (_, index) => `later background ${index} ${'y'.repeat(20)}`)].join('\n');
  const calls = [];
  const result = await runModelDebate({ task, models, runModel: async input => {
    calls.push(input);
    if (input.attempt === 0) throw Error('模型响应被截断或过滤，请缩小任务后重试。');
    assert.ok(input.messages[1].content.includes(evidence));
    return input.stage === 'proposal' ? proposal(input.model.role)
      : scoreReview(input.model.role, JSON.parse(input.messages[1].content.match(/<proposal-data>\n([\s\S]*)\n<\/proposal-data>/)[1]));
  } });
  assert.equal(result.status, 'complete');
  assert.ok(calls.some(item => item.attempt === 1));
});

test('debate timeout compacts the request, retries, and keeps honest failure evidence', async () => {
  const models = ['main', 'explorer', 'advisor'].map(role => ({ role, model: role + '-fixture' }));
  const task = 'Task details ' + 'x'.repeat(24000);
  const calls = [];
  const result = await runModelDebate({ task, models, timeoutMs: 15, runModel: async input => {
    calls.push(input);
    if (input.attempt === 0) return new Promise((_, reject) => input.signal.addEventListener('abort', () => reject(Error('request aborted')), { once: true }));
    if (input.stage === 'proposal') return proposal(input.model.role);
    return scoreReview(input.model.role, JSON.parse(input.messages[1].content.match(/<proposal-data>\n([\s\S]*)\n<\/proposal-data>/)[1]));
  } });
  assert.equal(result.status, 'complete');
  assert.ok(result.failures.some(item => /等待超过时限/.test(item.reason)));
  for (const role of ['main', 'explorer', 'advisor']) {
    for (const stage of ['proposal', 'review']) {
      const attempts = calls.filter(item => item.model.role === role && item.stage === stage);
      assert.deepEqual(attempts.map(item => item.attempt), [0, 1]);
      assert.ok(attempts[1].messages[1].content.length < attempts[0].messages[1].content.length);
    }
  }
});

test('proposal and review parsers reject incomplete, duplicate, and out-of-range judgments', () => {
  assert.throws(() => proposalReply('{"title":"missing fields"}', 'main'), /格式/);
  const plans = parsedProposals();
  const invalid = JSON.parse(scoreReview('main', plans)); invalid.evaluations[0].scores.risk = 11;
  assert.throws(() => reviewReply(JSON.stringify(invalid), 'main', plans.map(item => item.id)), /0 到 10/);
  const duplicate = JSON.parse(scoreReview('main', plans)); duplicate.evaluations[1].proposalId = 'main';
  assert.throws(() => reviewReply(JSON.stringify(duplicate), 'main', plans.map(item => item.id)), /重复/);
});

test('execution supervision returns structured corrections and marks the repeated fragment for takeover', async () => {
  const plans = parsedProposals();
  const seen = [], handoffs = [];
  const team = createModelTeam({ enabled: true, task: 'execute the plan', supervisionPlans: plans,
    supervise: async ({ role, context }) => { seen.push({ role, context }); return JSON.stringify({ verdict: 'revise', summary: role + '发现偏移', corrections: ['重新读取真实结果', '按片段验收'], takeover: false }); },
    takeover: async input => { handoffs.push(input); return { status: 'succeeded', summary: input.role + '已执行接手片段', evidence: [{ tool: 'read_file', ok: true }] }; },
  });
  const first = await team.afterTool('write_file', { path: 'target.txt' }, { ok: true, output: 'actual evidence' }, 'succeeded');
  assert.match(first, /execution-supervision/); assert.match(first, /模型二/); assert.match(first, /模型三/); assert.doesNotMatch(first, /takeover-requested/);
  const second = await team.afterTool('read_file', { path: 'target.txt' }, { ok: true, output: 'actual evidence 2' }, 'succeeded');
  assert.match(second, /"status":"succeeded"/); assert.match(second, /已执行接手片段/); assert.equal(handoffs.length, 2);
  assert.deepEqual(seen.map(item => item.role), ['explorer', 'advisor', 'explorer', 'advisor']);
  assert.ok(seen.every(item => item.context.includes('ownProposal')));
  assert.deepEqual(supervisionReply('{"verdict":"ready","summary":"证据一致","corrections":[],"takeover":false}', 'explorer').verdict, 'ready');
  assert.deepEqual(takeoverReply('{"status":"execute","summary":"按纠错执行","actions":[{"tool":"read_file","arguments":{"path":"target.txt"}}],"verification":["回读文件"]}', 'explorer').actions[0].tool, 'read_file');
});

test('takeover evidence requires a real successful tool operation for native, json, and auto channels', async () => {
  const toolDefinitions = [{ type: 'function', function: { name: 'read_file', parameters: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'], additionalProperties: false } } }];
  for (const protocol of ['native', 'json', 'auto']) {
    let requests = 0; const events = []; let executions = 0;
    const result = await runModelTask({ connection: { ...connection, model: 'takeover-' + protocol, toolProtocol: protocol, maxOutputTokens: 0 },
      messages: [{ role: 'user', content: '接手并读取 target.txt' }], tools: toolDefinitions,
      executeTool: async (name, args) => { executions += 1; assert.equal(name, 'read_file'); assert.equal(args.path, 'target.txt'); return { ok: true, hash: 'target-hash', output: 'target evidence' }; },
      fetchImpl: async (_url, options) => {
        requests += 1;
        const body = JSON.parse(options.body);
        if (requests === 1) {
          if (protocol === 'json') return Response.json({ choices: [{ message: { role: 'assistant', content: JSON.stringify({ type: 'tool', name: 'read_file', arguments: { path: 'target.txt' } }) } }] });
          return Response.json({ choices: [{ message: { role: 'assistant', content: null, tool_calls: [call('read_file', { path: 'target.txt' })] } }] });
        }
        if (protocol === 'json') assert.equal(body.tools, undefined);
        return Response.json({ choices: [{ message: { role: 'assistant', content: protocol === 'json' ? JSON.stringify({ type: 'final', content: '接手完成' }) : '接手完成' } }] });
      },
      emit: event => events.push(event),
    });
    assert.equal(executions, 1);
    assert.equal(result.operations, 1);
    assert.ok(result.text.includes('接手完成'));
    const toolEvents = events.filter(event => event.type === 'operation' && event.operation.name === 'read_file');
    assert.ok(toolEvents.some(event => event.operation.status === 'succeeded'));
    assert.deepEqual(summarizeTakeoverEvidence(toolEvents.map(event => event.operation)), { status: 'succeeded', successfulToolOperations: 1 });
  }
  assert.deepEqual(summarizeTakeoverEvidence([{ name: 'read_file', status: 'failed' }]), { status: 'failed', successfulToolOperations: 0 });
});

test('advisor is idle for ordinary answers and successful read-only exploration', async () => {
  let count = 0;
  const team = createModelTeam({ enabled: true, consult: async () => { count++; return review(); } });
  assert.equal(await team.beforeTool('read_file', { path: 'README.md' }), null);
  await team.afterTool('read_file', {}, { ok: true, hash: 'read-hash' }, 'succeeded');
  assert.equal(await team.beforeFinal('这是项目文档说明'), null);
  assert.equal(count, 0);
});

test('completed model discussion replaces duplicate plan gate but retains completion review', async () => {
  const seen = [];
  const team = createModelTeam({ enabled: true, skipPlanReview: true, consult: async input => { seen.push(input.stage); return review(); } });
  assert.equal(await team.beforeTool('update_plan', { steps: [{ text: 'implement' }] }), null);
  assert.deepEqual(seen, []);
  assert.match(await team.beforeFinal('verified result'), /顾问/);
  assert.deepEqual(seen, ['completion']);
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
  const requests = [], adaptations = [], events = [];
  const run = current => runModelTask({ connection: current, messages: [{ role: 'user', content: 'review plan' }], tools: [], maxRounds: 1, emit: event => events.push(event),
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
  assert.deepEqual(adaptations, []); assert.equal(configured.reasoning_effort, 'ultra');
  assert.equal(events.filter(event => event.type === 'operation' && event.operation.name === 'reasoning_compat').length, 1);
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

test('one advisor request per gate preserves long redacted context and changed arguments share repeated-error gate', async () => {
  const seen = [], events = [];
  const team = createModelTeam({ enabled: true, task: 'requirement ' + 'x'.repeat(20000) + 'END-REQUIREMENT-MARKER main-unit-key', secrets: ['main-unit-key'], emit: e => events.push(e),
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
  for (const item of seen) { assert.ok(item.context.length > 12000); assert.ok(item.context.includes('END-REQUIREMENT-MARKER')); assert.doesNotMatch(item.context, /main-unit-key|hidden-key/); }
  assert.equal(events.filter(e => e.operation.status === 'succeeded').length, 3);
});

test('advisor supervision context keeps older path and error evidence instead of fixed tail slicing', async () => {
  const marker = 'E:\\repo\\logs\\earlier-failure.log Error: access denied';
  const contexts = [];
  const team = createModelTeam({ enabled: true, task: 'task ' + 'x'.repeat(16000),
    supervisionPlans: parsedProposals(),
    supervise: async input => { contexts.push(input.context); return JSON.stringify({ verdict: 'ready', summary: '已核对', corrections: [] }); },
  });
  await team.afterTool('run_command', {}, { ok: false, output: marker + ' ' + 'detail '.repeat(2000) }, 'failed');
  for (let index = 0; index < 10; index++) {
    await team.afterTool('read_file', { path: `E:\\repo\\file-${index}.txt` }, { ok: true, output: `result ${index}` }, 'succeeded');
  }
  assert.ok(contexts.at(-1).includes('earlier-failure.log'));
  assert.ok(contexts.at(-1).includes('Error: access denied'));
  assert.ok(contexts.at(-1).length > 12000);
});

test('proposal and supervision parsing do not impose fixed response-length or item caps', () => {
  const proposalValue = JSON.parse(proposal('main'));
  proposalValue.summary = 's'.repeat(5000);
  proposalValue.steps = Array.from({ length: 9 }, (_, index) => `step ${index} ` + 'x'.repeat(700));
  assert.equal(proposalReply(JSON.stringify(proposalValue), 'main').steps.length, 9);

  const corrections = Array.from({ length: 14 }, (_, index) => `correction ${index} ` + 'y'.repeat(1200));
  const result = supervisionReply(JSON.stringify({ verdict: 'revise', summary: 'z'.repeat(3000), corrections }), 'explorer');
  assert.equal(result.corrections.length, 14);
  assert.equal(result.corrections[0].length, corrections[0].length);
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

test('team completion guard reads canonical task states rather than model prose', () => {
  const tasks = [
    { id: 'running', status: 'running' }, { id: 'queued', status: 'queued' },
    { id: 'complete', status: 'complete' }, { id: 'error', status: 'error' }, { id: 'cancelled', status: 'cancelled' },
  ];
  const team = createModelTeam({ activeTasks: () => tasks });
  assert.equal(team.snapshot().activeTasks, 2);
  tasks[0].status = 'complete'; tasks[1].status = 'error';
  assert.equal(team.snapshot().activeTasks, 0);
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

test('runtime executor changes reassign supervisors and completion reviewer while retaining facts', async () => {
  const supervised = [], consulted = [];
  const team = createModelTeam({ enabled: true, skipPlanReview: true, supervisionPlans: parsedProposals(),
    supervise: async input => { supervised.push(input.role); return JSON.stringify({ verdict: 'ready', summary: 'checked', corrections: [] }); },
    consult: async input => { consulted.push(input); return review(); },
  });
  await team.beforeTool('edit_file', {});
  await team.afterTool('edit_file', { path: 'kept.txt' }, { ok: true }, 'succeeded');
  assert.deepEqual(supervised.sort(), ['advisor', 'explorer']);
  team.setExecutorRole('advisor'); supervised.length = 0;
  await team.afterTool('read_file', { path: 'kept.txt' }, { ok: true }, 'succeeded');
  assert.deepEqual(supervised.sort(), ['explorer', 'main']);
  await team.beforeFinal('verified');
  assert.equal(consulted[0].role, 'main');
  assert.match(consulted[0].context, /kept.txt/);
  assert.match(consulted[0].context, /executor-switch/);
  assert.throws(() => team.setExecutorRole('unknown'), /无效/);
});

test('escaped long context remains valid JSON and quoted credential fields are redacted', async () => {
  let context;
  const team = createModelTeam({ enabled: true, task: '\0'.repeat(5000), consult: async input => { context = input.context; return review(); } });
  await team.beforeTool('write_file', { content: '\0'.repeat(5000), apiKey: 'quoted-unit-secret' });
  assert.ok(context.length > 12000); assert.doesNotThrow(() => JSON.parse(context));
  const { redact } = require('../electron/model-team.cjs');
  assert.doesNotMatch(redact('{"apiKey":"quoted-unit-secret"}'), /quoted-unit-secret/);
});
