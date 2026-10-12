// MacShare — Copyright (C) 2026 MacShare contributors. GPL-3.0, see LICENSE.
// The hidden PC-screen window's API (phase 11): commands and rtc2.* in, rtc2.* and state out.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('pcscreen', {
  on: (fn) => ipcRenderer.on('pcscreen', (_e, m) => fn(m)),
  send: (m) => ipcRenderer.send('pcscreen-out', m),
  state: (s) => ipcRenderer.send('pcscreen-state', s),
  stats: (s) => ipcRenderer.send('pcscreen-stats', s),
  ready: () => ipcRenderer.send('pcscreen-ready'),
});
