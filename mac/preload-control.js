// MacShare — Copyright (C) 2026 MacShare contributors. GPL-3.0, see LICENSE.
// Small API for the control window.
'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('macshare', {
  getState: () => ipcRenderer.invoke('getState'),
  onState: (fn) => ipcRenderer.on('state', (_e, s) => fn(s)),
  pairRespond: (allow) => ipcRenderer.send('pairRespond', allow),
  forget: (id) => ipcRenderer.send('forget', id),
  openSettings: (kind) => ipcRenderer.send('openSettings', kind),
  relaunch: () => ipcRenderer.send('relaunch'),
  setSharing: (on) => ipcRenderer.send('setSharing', on),
});
