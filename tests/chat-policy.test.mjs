import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
const { requestToolsEnabled, goalInstruction } = createRequire(import.meta.url)('../electron/chat-policy.cjs');

test('normal requests automatically offer tools regardless of the obsolete execution preference', () => {
  for (const executionEnabled of [undefined, false, true]) {
    assert.equal(requestToolsEnabled({ executionEnabled }, { contextAccess: 'manual' }), true);
  }
});
test('chat-only and background requests never gain local tools', () => {
  assert.equal(requestToolsEnabled({ executionEnabled: true }, { contextAccess: 'chat-only' }), false);
  for (const requestKind of ['scheduled', 'subagent']) assert.equal(requestToolsEnabled({ requestKind, executionEnabled: true }), false);
});
test('revision and collaboration use only authorization from the current request', () => {
  for (const requestKind of ['revision', 'collaboration']) {
    assert.equal(requestToolsEnabled({ requestKind }), false);
    assert.equal(requestToolsEnabled({ requestKind, executionEnabled: false }), false);
    assert.equal(requestToolsEnabled({ requestKind, executionEnabled: true }), true);
  }
});
test('goals remain complete and never promise autonomous background execution', () => {
  assert.equal(goalInstruction('  '), '');
  assert.match(goalInstruction('完成计算程序'), /完成计算程序/);
  assert.match(goalInstruction('完成计算程序'), /不宣称在后台持续执行/);
  assert.ok(goalInstruction('文'.repeat(3000)).includes('文'.repeat(3000)));
});
