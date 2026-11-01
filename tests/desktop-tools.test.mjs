import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

test('desktop tools enforce enablement, full access, planning and cancellation before native work', async () => {
  const { createDesktopTools } = require('../electron/desktop-tools.cjs');
  let calls = 0;
  for (const settings of [{ enabled: () => false }, { fullAccess: () => false }]) {
    const tools = createDesktopTools({ enabled: () => true, fullAccess: () => true, native: async () => { calls++; }, ...settings });
    await assert.rejects(tools.execute('desktop_screenshot', {}), /启用|完整访问/);
  }
  const plan = createDesktopTools({ enabled: () => true, fullAccess: () => true, readOnly: true, native: async () => { calls++; } });
  assert.deepEqual(plan.definitions.map(t => t.function.name), ['desktop_screenshot']);
  await assert.rejects(plan.execute('desktop_type', { text: '不得写入' }), /只读/);
  const controller = new AbortController(); controller.abort();
  await assert.rejects(plan.execute('desktop_screenshot', {}, { signal: controller.signal }), /停止/);
  assert.equal(calls, 0);
});

test('cancellation while desktop protection starts prevents native and queued actions', async () => {
  const { createDesktopTools } = require('../electron/desktop-tools.cjs');
  const controller = new AbortController(); let beginCount = 0, nativeCount = 0, unblock;
  const gate = new Promise(resolve => { unblock = resolve; });
  const tools = createDesktopTools({ enabled: () => true, fullAccess: () => true,
    begin: async () => { beginCount++; await gate; }, native: async () => { nativeCount++; } });
  const first = tools.execute('desktop_screenshot', {}, { signal: controller.signal });
  const second = tools.execute('desktop_screenshot', {}, { signal: controller.signal });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(beginCount, 1); controller.abort(); unblock();
  await assert.rejects(first, /停止/); await assert.rejects(second, /停止/);
  assert.equal(nativeCount, 0); assert.equal(beginCount, 1);
});

test('desktop actions require a current snapshot, map virtual coordinates and return fresh images', async () => {
  const { createDesktopTools } = require('../electron/desktop-tools.cjs');
  const calls = [];
  const native = async input => { calls.push(input); return { desktop: { x: -1920, y: 0, width: 3840, height: 1080 }, image: { width: 1600, height: 450, dataUrl: 'data:image/jpeg;base64,/9j/2Q==' } }; };
  const tools = createDesktopTools({ enabled: () => true, fullAccess: () => true, native });
  await assert.rejects(tools.execute('desktop_click', { x: 1, y: 1, screenshot_id: 'old' }), /截图/);
  const shot = await tools.execute('desktop_screenshot', {});
  const click = await tools.execute('desktop_click', { x: 800, y: 225, screenshot_id: shot.screenshot_id });
  assert.equal(calls.at(-1).x, 0); assert.equal(calls.at(-1).y, 540);
  assert.equal(click.modelImages.length, 1); assert.notEqual(click.screenshot_id, shot.screenshot_id);
  await assert.rejects(tools.execute('desktop_type', { screenshot_id: shot.screenshot_id, text: 'stale' }), /截图/);
  await assert.rejects(tools.execute('desktop_click', { screenshot_id: click.screenshot_id, x: 1600, y: 0 }), /坐标/);
  await assert.rejects(tools.execute('desktop_key', { screenshot_id: click.screenshot_id, key: 'ENTER;evil' }), /按键/);
  const typed = await tools.execute('desktop_type', { screenshot_id: click.screenshot_id, text: '中文🙂' });
  assert.equal(calls.at(-1).text, '中文🙂');
  const other = createDesktopTools({ enabled: () => true, fullAccess: () => true, native });
  const otherShot = await other.execute('desktop_screenshot', {});
  await other.execute('desktop_key', { screenshot_id: otherShot.screenshot_id, key: 'CTRL+A' });
  await assert.rejects(tools.execute('desktop_key', { screenshot_id: typed.screenshot_id, key: 'ENTER' }), /截图/);
});
