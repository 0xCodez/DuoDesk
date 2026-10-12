// MacShare — Copyright (C) 2026 MacShare contributors. GPL-3.0, see LICENSE.
// Small API for the PC-screen viewer window (phase 11).
'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('pcview', {
  on: (fn) => ipcRenderer.on('pcview', (_e, m) => fn(m)), // offer | rtc2.ice | blur | input | volume
  send: (msg) => ipcRenderer.send('pcview:out', msg),
  state: (s) => ipcRenderer.send('pcview:state', s),
  ready: () => ipcRenderer.send('pcview:ready'),
});
