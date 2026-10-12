// MacShare — Copyright (C) 2026 MacShare contributors. GPL-3.0, see LICENSE.
// The small API the Monitor 2 window gets: stream/rtc messages in, rtc answers/candidates out.
const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('monitor', {
  onRtc: (fn) => ipcRenderer.on('rtc', (_e, m) => fn(m)),
  send: (m) => ipcRenderer.send('rtc', m),
  ready: () => ipcRenderer.send('monitor-ready'),
  onInputEnabled: (fn) => ipcRenderer.on('input-enabled', (_e, on) => fn(!!on)),
  onAudio: (fn) => ipcRenderer.on('audio', (_e, a) => fn(a)),
  pathFor: (file) => { try { return webUtils.getPathForFile(file); } catch (_) { return ''; } },
  drop: (paths, x, y) => ipcRenderer.send('drop', { paths, x, y }),
  onDropProgress: (fn) => ipcRenderer.on('drop-progress', (_e, v) => fn(v)),
  onToggleStats: (fn) => ipcRenderer.on('toggle-stats', () => fn()),
});
