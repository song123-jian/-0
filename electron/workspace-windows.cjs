const path = require('node:path');
const crypto = require('node:crypto');

function validateWindowAction(record, input) {
  if (!input || typeof input.type !== 'string') throw Error('窗口操作无效。');
  const type = input.type, snapshot = record.snapshot;
  if (!snapshot?.available) throw Error('此项目或聊天已不可用。');
  const common = ['focus'], chat = ['send','stop','approval','draft','execution','file','revise','revision','fork','change-details','change-undo'], project = ['new-chat','open-chat'];
  if (![...common, ...(record.kind === 'chat' ? chat : project)].includes(type)) throw Error('此窗口不允许该操作。');
  if (['send','draft','revise'].includes(type) && (typeof input.text !== 'string' || input.text.length > 64000 || input.text.includes('\0'))) throw Error('请输入64000字符以内的文本。');
  if (type === 'send' && !input.text.trim()) throw Error('请输入要发送的内容。');
  if (['revise','revision'].includes(type) && (typeof input.stamp !== 'string' || input.stamp.length > 1000000)) throw Error('版本标识无效。');
  if (type === 'revise' && (!['edit','regenerate'].includes(input.kind) || !snapshot.chat?.messages.some(m => m.id === input.messageId))) throw Error('此消息已变化。');
  if (type === 'fork' && !snapshot.chat?.messages.some(m => m.id === input.messageId && m.role === 'assistant')) throw Error('此回答已变化。');
  if (['change-details','change-undo'].includes(type) && !snapshot.chat?.messages.some(m => m.fileChanges?.id === input.changeId)) throw Error('此文件修改不属于当前聊天。');
  if (type === 'revision' && input.versionId !== (snapshot.chat?.revisionId || 'initial') && !snapshot.chat?.revisions?.some(v => v.id === input.versionId)) throw Error('此版本已变化。');
  if (type === 'approval' && !snapshot.chat?.messages.some(m => m.approval?.id === input.approvalId)) throw Error('此审批已变化。');
  if (type === 'open-chat' && !snapshot.chats?.some(c => c.id === input.chatId)) throw Error('聊天不属于此项目。');
  if (type === 'file' && !snapshot.chat?.messages.some(m => m.operations?.some(o => o.path === input.path))) throw Error('此文件不在当前操作记录中。');
  return { type, ...(['send', 'draft', 'revise'].includes(type) && typeof input.text === 'string' ? { text: input.text } : {}),
    ...(['revise','revision'].includes(type) ? { stamp: input.stamp } : {}),
    ...(type === 'revise' ? { kind: input.kind, messageId: input.messageId, executionEnabled: input.executionEnabled === true } : {}),
    ...(type === 'fork' ? { messageId: input.messageId } : {}),
    ...(['change-details','change-undo'].includes(type) ? { changeId: input.changeId } : {}),
    ...(type === 'revision' ? { versionId: input.versionId } : {}),
    ...(type === 'approval' ? { approvalId: input.approvalId, allowed: input.allowed === true } : {}),
    ...(type === 'file' ? { path: input.path } : {}), ...(type === 'open-chat' ? { chatId: input.chatId } : {}) };
}

function createWorkspaceWindows({ app, BrowserWindow, ipcMain, getMainWindow, resolveTarget }) {
  const windows = new Map(), pending = new Map();
  const subscriptions = () => [...windows.values()].map(r => ({ windowId: r.window.webContents.id, kind: r.kind, id: r.id }));
  const mainEvent = (channel, value) => { const main = getMainWindow(); if (main && !main.isDestroyed()) main.webContents.send(channel, value); };
  const broadcastSubscriptions = () => mainEvent('workspace-window:subscriptions', subscriptions());
  function assertMain(event) {
    const main = getMainWindow(); if (!main || event.sender !== main.webContents || event.senderFrame !== main.webContents.mainFrame) throw Error('此页面不能控制工作台窗口。');
  }
  function childRecord(event) {
    const record = [...windows.values()].find(r => r.window.webContents === event.sender);
    if (!record || event.senderFrame !== record.window.webContents.mainFrame) throw Error('此页面没有窗口权限。');
    return record;
  }
  async function open(kind, id) {
    if (!['chat','project'].includes(kind) || typeof id !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(id)) throw Error('窗口目标无效。');
    const target = await resolveTarget(kind, id); if (!target) throw Error('找不到这个项目或聊天。');
    const key = kind + ':' + id, existing = windows.get(key);
    if (existing && !existing.window.isDestroyed()) { existing.window.show(); existing.window.focus(); return { opened: true, windowId: existing.window.webContents.id }; }
    if (windows.size >= 8) throw Error('最多打开8个独立工作台窗口，请先关闭一个。');
    const window = new BrowserWindow({ width: 1060, height: 820, minWidth: 760, minHeight: 600, title: target.title + ' · Scodex',
      show: false, backgroundColor: '#f5f7f6', autoHideMenuBar: true,
      webPreferences: { preload: path.join(__dirname, 'workspace-window-preload.cjs'), sandbox: true, contextIsolation: true, nodeIntegration: false,
        partition: 'scodex-workspace-' + crypto.randomUUID() } });
    const record = { window, kind, id, snapshot: null }; windows.set(key, record);
    window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    window.webContents.on('will-navigate', event => event.preventDefault());
    window.webContents.on('will-attach-webview', event => event.preventDefault());
    window.webContents.session.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
    window.webContents.session.setPermissionCheckHandler(() => false);
    window.webContents.session.on('will-download', event => event.preventDefault());
    window.webContents.on('did-finish-load', () => { broadcastSubscriptions(); if(record.snapshot)window.webContents.send('workspace-window:snapshot',record.snapshot); });
    window.once('ready-to-show', () => window.show());
    window.on('closed', () => {
      windows.delete(key);
      for (const [requestId, task] of pending) if (task.record === record) { clearTimeout(task.timer); pending.delete(requestId); task.reject(Error('窗口已关闭，主工作台中的任务仍继续。')); }
      broadcastSubscriptions();
    });
    if (!app.isPackaged) await window.loadURL('http://127.0.0.1:4178/?workspaceWindow=' + kind);
    else await window.loadFile(path.join(app.getAppPath(), 'dist', 'index.html'), { query: { workspaceWindow: kind } });
    broadcastSubscriptions(); return { opened: true, windowId: window.webContents.id };
  }
  ipcMain.handle('workspace-window:open', (event, kind, id) => { assertMain(event); return open(kind, id); });
  ipcMain.handle('workspace-window:subscriptions-get', event => { assertMain(event); return subscriptions(); });
  ipcMain.handle('workspace-window:publish', (event, values) => {
    assertMain(event); if (!Array.isArray(values) || values.length > 8) throw Error('窗口快照无效。');
    for (const value of values) {
      const record = [...windows.values()].find(r => r.window.webContents.id === value.windowId);
      if (!record || !value.snapshot || value.snapshot.kind !== record.kind || value.snapshot.id !== record.id) continue;
      record.snapshot = value.snapshot;
      record.window.setTitle(String(value.snapshot.title || 'Scodex').slice(0,120) + ' · Scodex');
      record.window.webContents.send('workspace-window:snapshot', record.snapshot);
    }
    return true;
  });
  ipcMain.handle('workspace-window:get', event => childRecord(event).snapshot);
  ipcMain.handle('workspace-window:action', async (event, input) => {
    const record = childRecord(event), action = validateWindowAction(record, input);
    if (action.type === 'open-chat') return open('chat', action.chatId);
    const requestId = crypto.randomUUID();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { pending.delete(requestId); reject(Error('主工作台响应超时，请回到主窗口检查任务状态。')); }, 10 * 60 * 1000);
      pending.set(requestId, { record, resolve, reject, timer });
      if (action.type === 'focus') { getMainWindow()?.show(); getMainWindow()?.focus(); }
      mainEvent('workspace-window:action-request', { requestId, kind: record.kind, id: record.id, action });
    });
  });
  ipcMain.handle('workspace-window:action-complete', (event, result) => {
    assertMain(event); const task = pending.get(result?.requestId); if (!task) return false;
    clearTimeout(task.timer); pending.delete(result.requestId);
    result.error ? task.reject(Error(String(result.error).slice(0,1000))) : task.resolve(result.value ?? true); return true;
  });
  return { closeAll() { for (const record of [...windows.values()]) record.window.destroy(); }, subscriptions };
}
module.exports = { createWorkspaceWindows, validateWindowAction };
