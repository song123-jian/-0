import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { runModelTask } = require('../electron/agent-runtime.cjs');
const { createAgentTools } = require('../electron/agent-tools.cjs');
const { createSubagentCoordinator } = require('../electron/subagent-coordinator.cjs');
const { createSubagentTools } = require('../electron/subagent-tools.cjs');

const connection = (endpoint, model, apiKey) => ({ endpoint, model, apiKey, toolProtocol: 'native', retryLimit: 0 });
const delta = (value, finish_reason = null) => ({ choices: [{ delta: value, finish_reason }] });
const stream = (events) => {
  const body = Buffer.from(events.map((event) => `data: ${JSON.stringify(event)}\r\n\r\n`).join('') + 'data: [DONE]\r\n\r\n');
  return new Response(body, { headers: { 'content-type': 'text/event-stream' } });
};
const toolReply = (name, args) => stream([
  delta({ tool_calls: [{ index: 0, id: `call_${name}`, type: 'function', function: { name, arguments: JSON.stringify(args) } }] }),
  delta({}, 'tool_calls'),
]);
const finalReply = (content) => stream([delta({ content }), delta({}, 'stop')]);

test('planning mode cannot start analysis or edit subagent tasks', async () => {
  let started = 0;
  const delegation = createSubagentTools({
    parentRequestId: 'planning-parent',
    readOnly: true,
    coordinator: { start: async () => { started += 1; } },
  });
  assert.deepEqual(delegation.definitions, []);
  await assert.rejects(delegation.execute('subagent_start', { task: 'edit', mode: 'edit', paths: ['src/a.js'] }), /不允许子模型委派/);
  assert.equal(started, 0);
});

test('main model delegates an edit, child uses its own connection, and main integrates the verified result', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'scodex-subagent-runtime-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.mkdir(path.join(root, 'src'));
  await fs.writeFile(path.join(root, 'src', 'owned.txt'), 'before');

  const mainConnection = connection('http://127.0.0.1:4101/v1/chat/completions', 'main-model', 'main-key');
  const childConnection = connection('http://127.0.0.1:4102/v1/chat/completions', 'child-model', 'child-key');
  const seen = { main: [], child: [] };
  let mainRequests = 0;
  let childRequests = 0;
  let coordinator;

  const childRun = async (child) => {
    const childTools = createAgentTools({
      workspaceRoot: root,
      readOnly: false,
      fullAccess: false,
      allowedPaths: child.paths,
      allowedTools: ['read_file', 'edit_file', 'update_plan'],
      authorize: async (operation, input) => {
        if (operation === 'file-write') coordinator.assertWritable(input.path, child.id);
      },
    });
    assert.equal(childTools.definitions.some((item) => item.function.name === 'run_command'), false);
    return runModelTask({
      connection: childConnection,
      messages: [{ role: 'user', content: child.task }],
      tools: childTools.definitions,
      executeTool: childTools.execute,
      signal: child.signal,
      maxRounds: 6,
      retryDelayMs: 0,
      fetchImpl: async (url, init) => {
        assert.equal(url, childConnection.endpoint);
        assert.equal(init.headers.authorization, 'Bearer child-key');
        seen.child.push(JSON.parse(init.body));
        childRequests += 1;
        const messages = JSON.parse(init.body).messages;
        if (childRequests === 1) return toolReply('read_file', { path: 'src/owned.txt' });
        if (childRequests === 2) {
          const result = JSON.parse(messages.at(-1).content);
          assert.equal(result.path, 'src/owned.txt');
          assert.equal(result.content.includes('before'), true);
          return toolReply('edit_file', { path: 'src/owned.txt', expected_hash: result.hash, old_text: 'before', new_text: 'after' });
        }
        assert.equal(messages.at(-1).role, 'tool');
        return finalReply('child edit complete');
      },
    });
  };

  coordinator = createSubagentCoordinator({ workspaceRoot: root, run: childRun });
  const parentId = 'parent-runtime';
  const delegation = createSubagentTools({ coordinator, parentRequestId: parentId });
  const parentTools = createAgentTools({
    workspaceRoot: root,
    allowedTools: ['read_file'],
    authorize: async (operation, input) => {
      if (operation === 'file-write') coordinator.assertWritable(input.path, parentId);
    },
  });
  const tools = [...parentTools.definitions, ...delegation.definitions];
  const executeTool = (name, args, context) => name.startsWith('subagent_')
    ? delegation.execute(name, args, context)
    : parentTools.execute(name, args, context);

  const result = await runModelTask({
    connection: mainConnection,
    messages: [{ role: 'user', content: 'delegate the edit and verify it' }],
    tools,
    executeTool,
    maxRounds: 8,
    retryDelayMs: 0,
    fetchImpl: async (url, init) => {
      assert.equal(url, mainConnection.endpoint);
      assert.equal(init.headers.authorization, 'Bearer main-key');
      const body = JSON.parse(init.body);
      seen.main.push(body);
      mainRequests += 1;
      if (mainRequests === 1) return toolReply('subagent_start', { title: 'edit owned file', task: 'Change before to after in the assigned file.', mode: 'edit', paths: ['src/owned.txt'] });
      const last = JSON.parse(body.messages.at(-1).content);
      if (mainRequests === 2) {
        assert.equal(last.status, 'running');
        return toolReply('subagent_wait', { task_id: last.id, wait_ms: 30_000 });
      }
      if (mainRequests === 3) {
        assert.equal(last.status, 'complete');
        return toolReply('read_file', { path: 'src/owned.txt' });
      }
      assert.equal(last.path, 'src/owned.txt');
      assert.equal(last.content, '1: after');
      return finalReply('main integrated the child result');
    },
  });

  assert.equal(result.text, 'main integrated the child result');
  assert.equal(await fs.readFile(path.join(root, 'src', 'owned.txt'), 'utf8'), 'after');
  assert.equal(mainRequests, 4);
  assert.equal(childRequests, 3);
  assert.ok(seen.main.every((body) => body.model === 'main-model'));
  assert.ok(seen.child.every((body) => body.model === 'child-model'));
  assert.equal(coordinator.snapshot().every((task) => task.status === 'complete'), true);
});
