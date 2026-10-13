// MacShare — Copyright (C) 2026 MacShare contributors. GPL-3.0, see LICENSE.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('hud', { on: (fn) => ipcRenderer.on('hud', (_e, m) => fn(m)) });
