import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { listTasks, readTask, prepareTaskHandoff, taskStamp } from '../src/lib/task-collaboration.js';
const { createCollaborationBridge, createCollaborationTools } = createRequire(import.meta.url)('../electron/task-collaboration.cjs');
const projects = [{ id: 'A', name: '项目 A' }, { id: 'B', name: '项目 B' }, { id: 'old', name: '归档项目', archivedAt: '2026-10-30' }];
function fixture() {
  const source = { id: 'source', title: '来源', projectId: 'A', messages: [] };
  const target = { id: 'target', title: '接收', projectId: 'B', executionEnabled: true, messages: [{ id: 'm1', role: 'assistant', content: '已保存的中文结果' }] };
  return { source, target, library: { conversations: [source, target] } };
}
const inputFor = target => ({ sourceId: 'source', conversationId: target.id, text: '继续核对结果。', expectedStamp: taskStamp(target) });

test('列表区分项目、运行、草稿和归档；旧聊天允许查看且不会猜测项目', () => {
  const { library, target } = fixture(); target.draft = '未发送';
  library.conversations.push({ id: 'old', title: '旧任务', projectId: 'old' }, { id: 'legacy', title: '未分组历史' });
  const result = listTasks(library, projects, ['target'], { sourceId: 'source', limit: 1 });
  assert.equal(result.total, 2); assert.equal(result.truncated, true);
  const item = listTasks(library, projects, ['target'], { query: '项目 B' }).tasks[0];
  assert.equal(item.running, true); assert.equal(item.hasDraft, true); assert.equal(item.projectId, 'B');
  const legacy = readTask(library, projects, [], { conversationId: 'legacy' });
  assert.equal(legacy.available, false); assert.equal(legacy.projectName, '未绑定项目');
  assert.equal(listTasks(library, projects, [], { includeArchived: true }).tasks.length, 4);
});

test('文本读取有总预算、单条预算、分页，不泄漏附件正文', () => {
  const { library, target } = fixture();
  target.messages = Array.from({ length: 35 }, (_, i) => ({ id: 'm' + i, role: i % 2 ? 'assistant' : 'user', content: '文'.repeat(9000), attachments: [{ content: 'PRIVATE_ATTACHMENT' }] }));
  const result = readTask(library, projects, [], { conversationId: target.id, limit: 30 });
  assert.equal(result.messages.length, 30); assert.equal(result.nextBefore, 'm5');
  assert.ok(result.messages.every(m => m.content.length <= 8000 && m.attachmentCount === 1));
  assert.equal(result.messages.reduce((sum, m) => sum + m.content.length, 0), 24000);
  assert.equal(JSON.stringify(result).includes('PRIVATE_ATTACHMENT'), false);
  const earlier = readTask(library, projects, [], { conversationId: target.id, before: result.nextBefore });
  assert.equal(earlier.messages.length, 5); assert.equal(earlier.nextBefore, '');
  assert.throws(() => readTask(library, projects, [], { conversationId: target.id, before: 'removed' }), /位置已变化/);
});

test('默认交接带可追溯来源、保留原草稿设置和真实换行', () => {
  const { library, target, source } = fixture(); source.projectId = undefined;
  const before = JSON.stringify(target);
  const result = prepareTaskHandoff(library, projects, [], inputFor(target));
  assert.match(result.prompt, /来自“来源”（source）\n/);
  assert.match(result.prompt, /用户确认发送/); assert.equal(result.target.id, 'target');
  assert.equal(JSON.stringify(target), before);
});

for (const [name, mutate, running, pattern, extra] of [
  ['目标变化', t => { t.messages[0].content = '新结果'; }, [], /已变化/],
  ['草稿', t => { t.draft = '草稿'; }, [], /草稿/, { freshStamp: true }],
  ['归档', t => { t.archivedAt = '2026-10-31'; }, [], /归档/],
  ['项目归档', t => { t.projectId = 'old'; }, [], /归档/],
  ['目标运行', () => {}, ['target'], /仍在运行/],
  ['并发上限', () => {}, ['source', 'x', 'y'], /最多同时运行3/],
  ['执行开关', t => { t.executionEnabled = false; }, [], /未启用项目工具/, { freshStamp: true, executionEnabled: true }],
  ['未分组目标', t => { delete t.projectId; }, [], /未绑定项目/],
]) test('交接拒绝：' + name, () => {
  const { library, target } = fixture(); const input = inputFor(target); mutate(target);
  if (extra?.freshStamp) input.expectedStamp = taskStamp(target);
  if (extra?.executionEnabled) input.executionEnabled = true;
  assert.throws(() => prepareTaskHandoff(library, projects, running, input), pattern);
});

test('自身、空白及超长交接不会通过；删除后的任务不可读', () => {
  const { library, target } = fixture();
  assert.throws(() => prepareTaskHandoff(library, projects, [], { ...inputFor(target), conversationId: 'source' }), /其他任务/);
  for (const text of ['', '  ', '字'.repeat(16001)]) assert.throws(() => prepareTaskHandoff(library, projects, [], { ...inputFor(target), text }), /16000/);
  assert.throws(() => readTask(library, projects, [], { conversationId: 'deleted' }), /不存在/);
});

test('桥接在提交前取消时拒绝claim，释放槽位', async () => {
  let request; const bridge = createCollaborationBridge({ deliver: value => { request = value; } });
  const controller = new AbortController();
  const result = assert.rejects(bridge.request('send', {}, { signal: controller.signal }), /未提交/);
  controller.abort(); await result;
  assert.equal(bridge.claim(request.id), false); assert.equal(bridge.complete({ id: request.id, ok: true }), false);
});

test('桥接claim只能一次；提交后的目标不被来源取消撤回', async () => {
  let request; const bridge = createCollaborationBridge({ deliver: value => { request = value; } });
  const controller = new AbortController(); const result = bridge.request('send', {}, { signal: controller.signal });
  assert.equal(bridge.claim(request.id), true); assert.equal(bridge.claim(request.id), false);
  controller.abort(); assert.equal(bridge.complete({ id: request.id, ok: true, result: { submitted: true } }), true);
  assert.deepEqual(await result, { submitted: true });
});

test('桥接有界超时、数量上限和关闭均正确回收', async () => {
  const requests = []; const bridge = createCollaborationBridge({ deliver: r => requests.push(r), timeoutMs: 25 });
  const timed = assert.rejects(bridge.request('read', {}), /未确认协作结果/); await timed;
  assert.equal(bridge.claim(requests[0].id), false);
  const work = Array.from({ length: 8 }, () => assert.rejects(bridge.request('read', {}), /已关闭/));
  await assert.rejects(bridge.request('read', {}), /请求过多/); bridge.close(); await Promise.all(work);
});

test('投递失败立即释放桥接，后续请求不受污染', async () => {
  let fail = true, bridge;
  bridge = createCollaborationBridge({ deliver: r => { if (fail) throw Error('窗口不可用'); bridge.complete({ id: r.id, ok: true, result: { tasks: [] } }); } });
  await assert.rejects(bridge.request('list', {}), /窗口不可用/); fail = false;
  assert.deepEqual(await bridge.request('list', {}), { tasks: [] });
});

test('规划、禁止审批和交接接收请求均不能发送', async () => {
  for (const options of [{ readOnly: true }, { allowSend: false }, { policy: () => 'never' }]) {
    const tools = createCollaborationTools({ sourceId: 'source', policy: () => 'on-request', ...options });
    assert.equal(tools.definitions.some(d => d.function.name === 'task_send'), false);
    await assert.rejects(tools.execute('task_send', { conversation_id: 'target', expected_stamp: 's', text: '发送' }), /不允许/);
  }
});

function integrated(approve) {
  const f = fixture(); let sends = 0, bridge;
  bridge = createCollaborationBridge({ deliver: r => {
    try {
      let result;
      if (r.action === 'read') result = readTask(f.library, projects, [], r.input);
      else { result = prepareTaskHandoff(f.library, projects, [], r.input); assert.equal(bridge.claim(r.id), true); sends++; result = { submitted: true, conversationId: result.target.id }; }
      bridge.complete({ id: r.id, ok: true, result });
    } catch (error) { bridge.complete({ id: r.id, ok: false, error: error.message }); }
  } });
  return { ...f, bridge, sends: () => sends, tools: createCollaborationTools({ bridge, sourceId: 'source', policy: () => 'on-request', approve: (input, signal) => approve(input, signal, f) }) };
}
const argsFor = target => ({ conversation_id: target.id, expected_stamp: taskStamp(target), text: '经批准的跨项目交接' });

test('模型发送先审批，目标独立提交的回执不会误称完成', async () => {
  let approval;
  const f = integrated(async input => { approval = input; });
  const result = await f.tools.execute('task_send', argsFor(f.target));
  assert.equal(f.sends(), 1); assert.equal(result.submitted, true); assert.equal(result.settled, undefined);
  assert.match(approval.path, /项目 B/); assert.equal(approval.command, '经批准的跨项目交接'); assert.match(approval.note, /仅回答/);
});

test('审批后目标变化由renderer再次校验，不发送', async () => {
  const f = integrated(async (_input, _signal, state) => { state.target.draft = '审批期间的用户草稿'; });
  await assert.rejects(f.tools.execute('task_send', argsFor(f.target)), /已变化/); assert.equal(f.sends(), 0);
  assert.equal(f.target.draft, '审批期间的用户草稿');
});

test('用户拒绝及审批期间停止均无发送副作用', async () => {
  const refused = integrated(async () => { throw Error('用户拒绝'); });
  await assert.rejects(refused.tools.execute('task_send', argsFor(refused.target)), /用户拒绝/); assert.equal(refused.sends(), 0);
  const controller = new AbortController(); const stopped = integrated(async () => controller.abort());
  await assert.rejects(stopped.tools.execute('task_send', argsFor(stopped.target), { signal: controller.signal }), /已停止/); assert.equal(stopped.sends(), 0);
});

test('参数验证拒绝未知字段、NUL及超出边界的等待', async () => {
  const tools = createCollaborationTools({ sourceId: 'source' });
  for (const [name, args] of [['task_read', { conversation_id: 'x', extra: true }], ['task_read', { conversation_id: '\0x' }], ['task_wait', { conversation_id: 'x', timeout_ms: 30001 }]]) await assert.rejects(tools.execute(name, args), /协作参数/);
  await assert.rejects(tools.execute('task_wait', { conversation_id: 'source' }), /不能等待当前/);
});

test('等待有界超时保留running状态，停止与错误结果仍可区分', async () => {
  const bridge = { request: async () => ({ running: true, status: 'running', messages: [] }) };
  const tools = createCollaborationTools({ sourceId: 'source', bridge });
  const result = await tools.execute('task_wait', { conversation_id: 'target', timeout_ms: 1000 });
  assert.equal(result.timedOut, true); assert.equal(result.settled, false); assert.equal(result.status, 'running');
  bridge.request = async () => ({ running: false, status: 'error', messages: [{ error: '失败' }] });
  const failed = await tools.execute('task_wait', { conversation_id: 'target' });
  assert.equal(failed.settled, true); assert.equal(failed.status, 'error'); assert.equal(failed.messages[0].error, '失败');
});
