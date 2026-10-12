// MacShare — Copyright (C) 2026 MacShare contributors. GPL-3.0, see LICENSE.
// The small API the main window gets from the main process.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('macshare', {
  getState: () => ipcRenderer.invoke('getState'),
  onState: (fn) => ipcRenderer.on('state', (_e, s) => fn(s)),
  pair: (idOrAddress) => ipcRenderer.invoke('pair', idOrAddress),
  confirmCode: () => ipcRenderer.invoke('confirmCode'),
  cancelPair: () => ipcRenderer.invoke('cancelPair'),
  forget: () => ipcRenderer.invoke('forget'),
  openMonitor: () => ipcRenderer.invoke('openMonitor'),
});
