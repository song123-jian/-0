const path = require('node:path');
const { startEscapeWatcher } = require('./desktop-escape.cjs');

function createDesktopControl({ BrowserWindow, ipcMain, screen, watchEscape = startEscapeWatcher, getComputerConfig = () => ({}) }) {
  const sessions = new Map();
  let window; let watcher; let stopping = false; let disposed = false;
  let lifecycle = Promise.resolve();
  function serialize(action) {
    const operation = lifecycle.then(action);
    lifecycle = operation.catch(() => {});
    return operation;
  }
  const channel = 'desktop-control:stop';
  function state() {
    if (window && !window.isDestroyed() && !window.webContents.isDestroyed()) {
      window.webContents.send('desktop-control:state', { stopping, count: sessions.size, config: getComputerConfig() || {} });
    }
  }
  function stop() {
    stopping = true;
    for (const controller of sessions.values()) controller.abort();
    state();
  }
  function onStop(event) {
    if (window && !window.isDestroyed() && event.sender === window.webContents && event.senderFrame === window.webContents.mainFrame) stop();
  }
  ipcMain.on(channel, onStop);
  function position() {
    if (!window || window.isDestroyed()) return;
    const area = screen.getPrimaryDisplay().workArea;
    const width = Math.min(500, area.width);
    window.setBounds({ x: Math.round(area.x + (area.width - width) / 2), y: area.y + area.height - 86, width, height: 66 });
  }
  screen.on('display-metrics-changed', position);
  screen.on('display-removed', position);
  async function close() {
    const previousWindow = window; const previousWatcher = watcher;
    window = null; watcher = null;
    try {
      if (previousWindow && !previousWindow.isDestroyed()) previousWindow.destroy();
    } finally {
      await previousWatcher?.close();
      if (!sessions.size) stopping = false;
    }
  }
  async function start() {
    watcher = watchEscape({ onCancel: stop, onFailure: stop });
    // Observe failures even if constructing the window throws before Promise.all is reached.
    watcher.ready.catch(() => {});
    window = new BrowserWindow({ width: 500, height: 66, show: false, frame: false, resizable: false, maximizable: false, minimizable: false,
      focusable: false, skipTaskbar: true, alwaysOnTop: true, backgroundColor: '#171b23', title: 'Scodex 电脑操控',
      webPreferences: { preload: path.join(__dirname, 'desktop-control-preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true } });
    window.setAlwaysOnTop(true, 'screen-saver');
    window.setVisibleOnAllWorkspaces(true);
    window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    window.webContents.on('will-navigate', event => event.preventDefault());
    window.webContents.on('render-process-gone', stop);
    const current = window;
    current.on('closed', () => { if (window === current) { window = null; stop(); } });
    position();
    await Promise.all([watcher.ready, window.loadFile(path.join(__dirname, 'desktop-control.html'))]);
    if (!window || window.isDestroyed() || stopping || disposed) throw new Error('电脑操控已停止。');
    state(); window.showInactive();
  }
  return {
    acquire(requestId, controller) {
      return serialize(async () => {
        if (disposed || controller.signal.aborted || stopping) throw new Error('电脑操控已停止。');
        sessions.set(requestId, controller);
        try {
          if (!window) await start();
          if (controller.signal.aborted || stopping || disposed) throw new Error('电脑操控已停止。');
          state();
        } catch (error) { stop(); throw error; }
      });
    },
    release(requestId) {
      return serialize(async () => {
        if (!sessions.delete(requestId)) return;
        if (sessions.size) { state(); return; }
        await close();
      });
    },
    dispose() {
      disposed = true; stop();
      ipcMain.removeListener(channel, onStop);
      screen.removeListener('display-metrics-changed', position);
      screen.removeListener('display-removed', position);
      return serialize(async () => { sessions.clear(); await close(); });
    },
  };
}

module.exports = { createDesktopControl };
