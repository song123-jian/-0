import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { createDesktopControl } = require('../electron/desktop-control.cjs');
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };

function fixture({ ready = Promise.resolve(), closing = Promise.resolve(), load = Promise.resolve() } = {}) {
  const windows = [], watchers = [], ipcMain = new EventEmitter(), screen = new EventEmitter();
  screen.getPrimaryDisplay = () => ({ workArea: { x: -800, y: 0, width: 800, height: 600 } });
  class Window extends EventEmitter {
    constructor(options) {
      super(); this.options = options; this.destroyed = false;
      this.webContents = new EventEmitter();
      this.webContents.mainFrame = {};
      this.webContents.isDestroyed = () => this.destroyed;
      this.webContents.setWindowOpenHandler = callback => { this.open = callback; };
      this.webContents.send = (_channel, state) => { this.state = state; };
      windows.push(this);
    }
    setBounds(bounds) { this.bounds = bounds; }
    setAlwaysOnTop() {}
    setVisibleOnAllWorkspaces() {}
    loadFile() { return load; }
    isDestroyed() { return this.destroyed; }
    showInactive() { this.visible = true; }
    destroy() { this.destroyed = true; this.emit('closed'); }
  }
  const control = createDesktopControl({ BrowserWindow: Window, ipcMain, screen, watchEscape(callbacks) {
    const watcher = { ...callbacks, ready, closed: false, async close() { await closing; this.closed = true; } };
    watchers.push(watcher); return watcher;
  } });
  return { control, windows, watchers, ipcMain, screen };
}

test('desktop banner waits for protection, shares sessions and ignores stop IPC from other frames', async () => {
  const gate = deferred(), f = fixture({ ready: gate.promise }), a = new AbortController(), b = new AbortController();
  const first = f.control.acquire('a', a);
  await Promise.resolve(); assert.equal(f.windows[0].visible, undefined);
  gate.resolve(); await first; await f.control.acquire('b', b);
  assert.equal(f.windows.length, 1); assert.equal(f.windows[0].state.count, 2);
  assert.equal(f.windows[0].options.focusable, false);
  assert.deepEqual(f.windows[0].bounds, { x: -650, y: 514, width: 500, height: 66 });
  f.ipcMain.emit('desktop-control:stop', { sender: {}, senderFrame: {} });
  f.ipcMain.emit('desktop-control:stop', { sender: f.windows[0].webContents, senderFrame: {} });
  assert.equal(a.signal.aborted, false);
  f.ipcMain.emit('desktop-control:stop', { sender: f.windows[0].webContents, senderFrame: f.windows[0].webContents.mainFrame });
  assert.equal(a.signal.aborted, true); assert.equal(b.signal.aborted, true);
  await f.control.release('unrelated'); assert.equal(f.windows[0].destroyed, false);
  await f.control.release('a'); assert.equal(f.windows[0].destroyed, false);
  await f.control.release('b'); assert.equal(f.windows[0].destroyed, true); assert.equal(f.watchers[0].closed, true);
  await f.control.dispose();
});

test('release during startup cannot destroy a subsequent desktop session', async () => {
  const gate = deferred(), f = fixture({ ready: gate.promise });
  const first = f.control.acquire('a', new AbortController());
  await Promise.resolve();
  const release = f.control.release('a');
  const second = f.control.acquire('b', new AbortController());
  gate.resolve(); await Promise.all([first, release, second]);
  assert.equal(f.windows.at(-1).destroyed, false); assert.equal(f.windows.at(-1).visible, true);
  f.watchers.at(-1).onCancel();
  assert.equal(f.windows.at(-1).state.stopping, true);
  await f.control.release('b'); await f.control.dispose();
});

test('new sessions wait for an earlier listener to exit before opening another', async () => {
  const gate = deferred(), f = fixture({ closing: gate.promise });
  await f.control.acquire('a', new AbortController());
  const release = f.control.release('a');
  const next = f.control.acquire('b', new AbortController());
  await Promise.resolve(); await Promise.resolve(); assert.equal(f.watchers.length, 1);
  gate.resolve(); await Promise.all([release, next]);
  assert.equal(f.watchers.length, 2); assert.equal(f.watchers[0].closed, true);
  await f.control.release('b'); await f.control.dispose();
});

test('listener failure and window load failure cancel owners and permit a clean later start', async () => {
  const gate = deferred(), f = fixture({ ready: gate.promise }), owner = new AbortController();
  const pending = f.control.acquire('a', owner);
  await Promise.resolve(); gate.reject(new Error('listener unavailable'));
  await assert.rejects(pending, /listener unavailable/); assert.equal(owner.signal.aborted, true);
  await f.control.release('a'); assert.equal(f.watchers[0].closed, true);
  await f.control.dispose();
  const g = fixture({ load: Promise.reject(new Error('load failed')) }), other = new AbortController();
  await assert.rejects(g.control.acquire('b', other), /load failed/);
  assert.equal(other.signal.aborted, true); await g.control.release('b'); await g.control.dispose();
});

test('Escape stops every desktop owner; a completed session can restart; dispose removes listeners', async () => {
  const f = fixture(), a = new AbortController(), b = new AbortController();
  await f.control.acquire('a', a); await f.control.acquire('b', b);
  f.watchers[0].onCancel(); assert.equal(a.signal.aborted, true); assert.equal(b.signal.aborted, true);
  await assert.rejects(f.control.acquire('c', new AbortController()), /停止/);
  await f.control.release('a'); await f.control.release('b');
  const c = new AbortController(); await f.control.acquire('c', c);
  assert.equal(f.windows.at(-1).state.stopping, false);
  await f.control.dispose(); assert.equal(c.signal.aborted, true); assert.equal(f.watchers.at(-1).closed, true);
  assert.equal(f.ipcMain.listenerCount('desktop-control:stop'), 0);
  assert.equal(f.screen.listenerCount('display-metrics-changed'), 0);
  await assert.rejects(f.control.acquire('d', new AbortController()), /停止/);
});
