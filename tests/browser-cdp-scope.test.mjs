import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { createCdpScope } = require('../electron/browser-cdp-scope.cjs');

function fixture() {
  const calls = [];
  const root = { targetId: 'owned', type: 'page', browserContextId: 'own-context' };
  const foreign = { targetId: 'manual', type: 'page', browserContextId: 'manual-context' };
  const api = { async sendCommand(method, params, sessionId) {
    calls.push({ method, params, sessionId });
    if (method === 'Target.getTargetInfo') return { targetInfo: root };
    if (method === 'Target.getTargets') return { targetInfos: [root, foreign] };
    if (method === 'Target.attachToTarget') return { sessionId: 'owned-session' };
    return { value: 'ok' };
  } };
  return { scope: createCdpScope(), api, calls };
}

test('target discovery filters other pages and foreign attachment is blocked before forwarding', async () => {
  const { scope, api, calls } = fixture();
  const result = await scope.execute(api, 'Target.getTargets', {});
  assert.deepEqual(result.targetInfos.map(target => target.targetId), ['owned']);
  await assert.rejects(scope.execute(api, 'Target.attachToTarget', { targetId: 'manual', flatten: true }), /当前 AI 标签/);
  assert.equal(calls.some(call => call.method === 'Target.attachToTarget'), false);
});

test('child sessions are accepted only from the owned target tree and removed on detach', async () => {
  const { scope, api, calls } = fixture();
  await scope.execute(api, 'Runtime.enable', {});
  assert.equal(scope.observe('Target.attachedToTarget', { sessionId: 'child', targetInfo: { targetId: 'frame', type: 'iframe', browserContextId: 'own-context' } }), true);
  await scope.execute(api, 'Runtime.evaluate', { expression: '1' }, 'child');
  assert.equal(calls.at(-1).sessionId, 'child');
  assert.equal(scope.observe('Target.attachedToTarget', { sessionId: 'foreign', targetInfo: { targetId: 'manual', type: 'page', browserContextId: 'manual-context' } }), false);
  await assert.rejects(scope.execute(api, 'Runtime.enable', {}, 'foreign'), /子会话/);
  assert.equal(scope.observe('Target.attachedToTarget', { sessionId: 'nested', targetInfo: { targetId: 'worker', type: 'worker' } }, 'child'), true);
  scope.observe('Target.detachedFromTarget', { sessionId: 'child' });
  await assert.rejects(scope.execute(api, 'Runtime.enable', {}, 'child'), /子会话/);
  await assert.rejects(scope.execute(api, 'Runtime.enable', {}, 'nested'), /子会话/);
});

test('browser-global domains, foreign contexts, and unsafe target tunnels remain unavailable', async () => {
  const { scope, api } = fixture();
  for (const method of ['Browser.close', 'SystemInfo.getInfo', 'Tracing.start', 'Target.attachToBrowserTarget', 'Target.sendMessageToTarget', 'Target.createTarget']) {
    await assert.rejects(scope.execute(api, method, {}), /浏览器全局|当前 AI 标签/);
  }
  await assert.rejects(scope.execute(api, 'Storage.getCookies', { browserContextId: 'manual-context' }), /浏览器上下文/);
  await assert.rejects(scope.execute(api, 'Target.setAutoAttach', { autoAttach: true, flatten: false }), /flatten/);
  await assert.rejects(scope.execute(api, 'Runtime.enable', {}, 'guessed-session'), /子会话/);
  await scope.execute(api, 'Storage.getCookies', { browserContextId: 'own-context' });
  await scope.execute(api, 'Target.setAutoAttach', { autoAttach: true, flatten: true, waitForDebuggerOnStart: false });
});

test('deactivation during target initialization prevents the pending command', async () => {
  let active = true;
  const scope = createCdpScope({ isActive: () => active });
  const calls = [];
  const api = { async sendCommand(method) {
    calls.push(method);
    active = false;
    return { targetInfo: { targetId: 'owned' } };
  } };
  await assert.rejects(scope.execute(api, 'Runtime.evaluate', { expression: '1' }), /权限已关闭/);
  assert.deepEqual(calls, ['Target.getTargetInfo']);
});

test('cancellation during target initialization does not forward the command', async () => {
  const controller = new AbortController();
  const scope = createCdpScope();
  const calls = [];
  const api = { async sendCommand(method) {
    calls.push(method);
    controller.abort();
    return { targetInfo: { targetId: 'owned' } };
  } };
  await assert.rejects(scope.execute(api, 'Runtime.evaluate', { expression: '1' }, undefined, controller.signal), /任务已停止/);
  assert.deepEqual(calls, ['Target.getTargetInfo']);
});

test('cookie read, write, and clear methods route through the owned page Network handler', async () => {
  const { scope, api, calls } = fixture();
  for (const [method, network] of [['Storage.getCookies', 'Network.getAllCookies'], ['Storage.setCookies', 'Network.setCookies'], ['Storage.clearCookies', 'Network.clearBrowserCookies']]) {
    await scope.execute(api, method, { cookies: [] });
    assert.equal(calls.at(-1).method, network);
    assert.equal(Object.hasOwn(calls.at(-1).params, 'browserContextId'), false);
  }
});

test('cookie access fails safely when the runtime supplies no owned context identifier', async () => {
  const scope = createCdpScope();
  const calls = [];
  const api = { async sendCommand(method) { calls.push(method); return { targetInfo: { targetId: 'owned' } }; } };
  await assert.rejects(scope.execute(api, 'Storage.getCookies', {}), /无法确认.*浏览器上下文/);
  assert.deepEqual(calls, ['Target.getTargetInfo']);
});
