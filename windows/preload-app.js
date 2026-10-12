// MacShare — Copyright (C) 2026 MacShare contributors. GPL-3.0, see LICENSE.
// The small API the main window gets from the main process.
const { contextBridge, ipcRenderer } = require('electron');

const call = (name) => (...args) => ipcRenderer.invoke(name, ...args);

contextBridge.exposeInMainWorld('macshare', {
  getState: call('getState'),
  onState: (fn) => ipcRenderer.on('state', (_e, s) => fn(s)),
  pair: call('pair'),
  confirmCode: call('confirmCode'),
  cancelPair: call('cancelPair'),
  forget: call('forget'),
  openMonitor: call('openMonitor'),
  setKvm: call('setKvm'),
  setKeys: call('setKeys'),
  setMonitor: call('setMonitor'),
  setClipboard: call('setClipboard'),
  copyHistory: call('copyHistory'),
  clearHistory: call('clearHistory'),
  setTab: call('setTab'),
});
