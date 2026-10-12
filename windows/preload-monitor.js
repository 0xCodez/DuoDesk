// MacShare — Copyright (C) 2026 MacShare contributors. GPL-3.0, see LICENSE.
// The small API the Monitor 2 window gets: stream/rtc messages in, rtc answers/candidates out.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('monitor', {
  onRtc: (fn) => ipcRenderer.on('rtc', (_e, m) => fn(m)),
  send: (m) => ipcRenderer.send('rtc', m),
  ready: () => ipcRenderer.send('monitor-ready'),
  onToggleStats: (fn) => ipcRenderer.on('toggle-stats', () => fn()),
});
