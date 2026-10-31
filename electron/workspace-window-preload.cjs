const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('scodexWindow', {
  getSnapshot: () => ipcRenderer.invoke('workspace-window:get'),
  action: input => ipcRenderer.invoke('workspace-window:action', input),
  onSnapshot: listener => { const handler = (_event, value) => listener(value); ipcRenderer.on('workspace-window:snapshot', handler); return () => ipcRenderer.removeListener('workspace-window:snapshot', handler); },
});
