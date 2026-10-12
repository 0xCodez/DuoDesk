// MacShare — Copyright (C) 2026 MacShare contributors. GPL-3.0, see LICENSE.
// Main process: lifecycle, windows, tray, IPC, and the state pushed to the control window.
//
// State object sent to the control window ('state' channel) on every change:
// {
//   macName, macId, fp,                       // this Mac's identity (fp = cert SHA-256 hex)
//   addresses: ['192.168.1.5:47800', ...],    // where Windows can reach us
//   serverError: null | 'message',            // e.g. port already in use
//   client: null | { id, name, address, rttMs },   // the connected, authenticated PC
//   input: { where: 'home'|'driving'|'driven', message: '' },   // KVM (phases 4–5)
//   pairing: null | { name, code: null|'123456', confirmed, allowed },
//   paired: [{ id, name, pairedAt, lastSeen }],
//   permissions: { screen: 'granted'|'denied'|'not-determined'|..., accessibility: bool,
//                  inputMonitoring: null|bool },   // null = not checked yet (helper, phase 2)
// }
'use strict';

const path = require('path');
const { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain, shell, systemPreferences } = require('electron');

app.commandLine.appendSwitch('disable-features', 'WebRtcHideLocalIpsWithMdns');
if (!app.requestSingleInstanceLock()) {
  app.quit();
  process.exit(0);
}

const P = require('../shared/protocol.js');
const store = require('./store');
const identity = require('./identity');
const discovery = require('./discovery');
const { Server } = require('./server');
const { Pairing } = require('./pairing');

let win = null;
let tray = null;
let quitting = false;
let settings, id, server, pairing, beacon;

const state = {
  macName: '',
  macId: '',
  fp: '',
  addresses: [],
  serverError: null,
  client: null,
  input: { where: 'home', message: '' },
  pairing: null,
  paired: [],
  permissions: { screen: 'unknown', accessibility: false, inputMonitoring: null },
};

let pushQueued = false;
function pushState() {
  if (pushQueued) return;
  pushQueued = true;
  setImmediate(() => {
    pushQueued = false;
    state.addresses = discovery.interfaces().map((i) => `${i.address}:${P.PORT}`);
    state.pairing = pairing ? pairing.pendingView() : null;
    state.paired = pairing ? pairing.list() : [];
    const c = server && server.current;
    state.client = c ? { id: c.deviceId, name: c.name, address: c.address, rttMs: c.rttMs } : null;
    if (win && !win.isDestroyed()) win.webContents.send('state', state);
    updateTray();
  });
}

function refreshPermissions() {
  state.permissions.screen = systemPreferences.getMediaAccessStatus('screen');
  state.permissions.accessibility = systemPreferences.isTrustedAccessibilityClient(false);
  pushState();
}

function createWindow() {
  win = new BrowserWindow({
    width: 760,
    height: 820,
    minWidth: 560,
    minHeight: 500,
    title: 'MacShare',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload-control.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.loadFile(path.join(__dirname, 'control.html'));
  win.once('ready-to-show', () => win.show());
  win.on('focus', refreshPermissions);
  win.on('close', (e) => {
    if (!quitting) {
      e.preventDefault();
      win.hide();
    }
  });
}

function showWindow() {
  if (!win || win.isDestroyed()) createWindow();
  else {
    win.show();
    win.focus();
  }
  app.focus({ steal: true });
}

function updateTray() {
  if (!tray) return;
  const c = state.client;
  tray.setToolTip(c ? `MacShare — connected to ${c.name}` : 'MacShare — no PC connected');
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: c ? `Connected: ${c.name}` : 'No PC connected', enabled: false },
      { type: 'separator' },
      { label: 'Open MacShare', click: showWindow },
      {
        label: 'Share screen',
        type: 'checkbox',
        checked: !!settings.sharing.on,
        click: (item) => setSetting('sharing', { on: item.checked }),
      },
      { type: 'separator' },
      { label: 'Quit MacShare', click: () => app.quit() },
    ]),
  );
}

function setSetting(key, partial) {
  settings[key] = { ...settings[key], ...partial };
  store.saveSettings(settings);
  pushState();
}

const SETTINGS_URLS = {
  screen: 'x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture',
  accessibility: 'x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility',
  inputMonitoring: 'x-apple.systempreferences:com.apple.preference.security?Privacy_ListenEvent',
};

function setupIpc() {
  ipcMain.handle('getState', () => state);
  ipcMain.on('pairRespond', (_e, allow) => pairing.respond(!!allow));
  ipcMain.on('forget', (_e, deviceId) => pairing.forget(String(deviceId)));
  ipcMain.on('openSettings', (_e, kind) => SETTINGS_URLS[kind] && shell.openExternal(SETTINGS_URLS[kind]));
  ipcMain.on('relaunch', () => {
    app.relaunch();
    app.exit(0);
  });
  // Later phases: setSharing, selectDisplay, setVirtual, setKvm.
  ipcMain.on('setSharing', (_e, on) => setSetting('sharing', { on: !!on }));
}

app.whenReady().then(() => {
  if (app.dock) app.dock.hide();
  store.init(app.getPath('userData'));
  settings = store.loadSettings();
  id = identity.load(settings);
  Object.assign(state, { macName: id.macName, macId: id.macId, fp: id.fp });
  console.log(`[main] ${id.macName} (${id.macId}) fp ${id.fp}`);

  server = new Server(id);
  server.on('listening', () => console.log(`[server] listening on 0.0.0.0:${P.PORT}`));
  server.on('listenError', (err) => {
    state.serverError = `Cannot listen on port ${P.PORT}: ${err.code || err.message}`;
    console.error(`[server] ${state.serverError}`);
    pushState();
  });
  server.on('client', (ctx) => {
    console.log(`[server] ${ctx.name} connected from ${ctx.address}`);
    pushState();
  });
  server.on('closed', (ctx) => {
    if (ctx.authed) console.log(`[server] ${ctx.name} disconnected`);
    pushState();
  });
  server.on('rtt', pushState);

  pairing = new Pairing(server, id);
  pairing.on('change', pushState);
  pairing.on('request', showWindow);

  beacon = discovery.start(id);

  setupIpc();
  tray = new Tray(nativeImage.createEmpty());
  tray.setTitle('MacShare');
  createWindow();
  refreshPermissions();
  setInterval(pushState, 5000); // addresses change when the network does
});

app.on('second-instance', showWindow);
app.on('activate', showWindow);
app.on('window-all-closed', () => {}); // keep running in the menu bar
app.on('before-quit', () => {
  quitting = true;
  // Phases 4–5: send any KVM go-home here so the helper releases input.
  if (beacon) beacon.stop();
  if (server) server.close();
});
