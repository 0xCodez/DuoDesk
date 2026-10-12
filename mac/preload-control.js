// MacShare — Copyright (C) 2026 MacShare contributors. GPL-3.0, see LICENSE.
// Small API for the control window: getState/onState plus one call per action in ipc.js.
'use strict';

const { contextBridge, ipcRenderer } = require('electron');

const ACTIONS = [
  'setSharing', 'setStreamInput', 'selectDisplay', 'setDisplayMode', 'setVirtual', 'setStreamMaxHeight',
  'setBitrate', 'setKvm', 'setApp', 'setAudio', 'setTerminal', 'openSharingSettings', 'setFiles', 'pickDropFolder', 'resetDropFolder', 'revealDrop', 'setSmb', 'setShareMac', 'chooseShareFolder', 'stopSharingFolder', 'openPcShare', 'setApps', 'setReceive', 'showPcView', 'setPcApps', 'listPcApps', 'openPcApp', 'openPcShell', 'setScreenSound', 'setKeys', 'setClipboard', 'copyHistory', 'clearHistory', 'setTab',
  'pairRespond', 'forget', 'openSettings', 'relaunch',
];

const api = {
  getState: () => ipcRenderer.invoke('getState'),
  onState: (fn) => ipcRenderer.on('state', (_e, s) => fn(s)),
};
for (const name of ACTIONS) api[name] = (arg) => ipcRenderer.send(name, arg);

contextBridge.exposeInMainWorld('macshare', api);
