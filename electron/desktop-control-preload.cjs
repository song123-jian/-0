const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('desktopControl', {
  stop: () => ipcRenderer.send('desktop-control:stop'),
  onState: callback => { ipcRenderer.on('desktop-control:state', (_event, state) => callback(state)); },
});
