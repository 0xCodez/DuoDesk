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
//                  inputMonitoring: null|bool },   // null = not checked yet (asked from the helper)
//   helper: { running: bool },
//   sharing: { on, displayId: null|id, bitrateMbps, streamMaxHeight (0 = native),
//              displays: [{ id, label, width, height, pixelWidth, pixelHeight, virtual, primary }],
//              targetId: null|id,                  // the display being shared now
//              virtual: { enabled, width, height, hiDPI, hz, active: bool, error: null|'msg' } },
//   streamInput: bool,                          // accept mouse/keyboard from Monitor 2
//   stream: { status, display, width, height, fps, mbps, encoder, codec },   // see stream.js
// }
'use strict';

const path = require('path');
const { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain, shell, systemPreferences } = require('electron');

app.commandLine.appendSwitch('disable-features', 'WebRtcHideLocalIpsWithMdns');
// Tag every sent video frame with playout delay 0/0 (RTP playout-delay extension): the receiver
// renders frames as soon as they are decoded instead of building up a smoothing jitter buffer.
app.commandLine.appendSwitch('force-fieldtrials', 'WebRTC-ForceSendPlayoutDelay/min_ms:0,max_ms:0/');
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
const { Helper } = require('./helper');
const { Displays } = require('./displays');
const { Stream } = require('./stream');
const { Input } = require('./input');

let win = null;
let tray = null;
let quitting = false;
let settings, id, server, pairing, beacon, helper, displays, stream, input;

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
  helper: { running: false },
  sharing: null,
  streamInput: true,
  stream: null,
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
    state.helper.running = !!(helper && helper.running);
    if (displays) {
      const target = displays.target();
      state.sharing = {
        on: !!settings.sharing.on,
        displayId: settings.sharing.displayId,
        bitrateMbps: settings.bitrateMbps,
        streamMaxHeight: settings.streamMaxHeight,
        displays: displays.list(),
        targetId: target ? target.id : null,
        virtual: { ...settings.virtual, active: displays.virtualId !== null, error: displays.virtualError },
      };
    }
    if (stream) state.stream = stream.view;
    state.streamInput = settings.streamInput !== false;
    if (win && !win.isDestroyed()) win.webContents.send('state', state);
    updateTray();
  });
}

function refreshPermissions() {
  state.permissions.screen = systemPreferences.getMediaAccessStatus('screen');
  state.permissions.accessibility = systemPreferences.isTrustedAccessibilityClient(false);
  if (helper && helper.running) {
    helper.request('permissions').then((r) => {
      state.permissions.inputMonitoring = !!r.inputMonitoring;
      pushState();
    }, () => {});
  }
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
        click: (item) => setSharing(item.checked),
      },
      {
        label: 'Receive input from the PC',
        type: 'checkbox',
        checked: settings.streamInput !== false,
        click: (item) => setStreamInput(item.checked),
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

function setSharing(on) {
  setSetting('sharing', { on: !!on });
  if (on) stream.restart('sharing on');
  else {
    stream.stop('off');
    input.releaseAll();
  }
}

function setStreamInput(on) {
  settings.streamInput = !!on;
  store.saveSettings(settings);
  if (!on) input.releaseAll();
  server.sendToClient({ t: P.T.STREAM_INPUT, on: !!on }); // Windows goes view-only when off
  pushState();
}

const VIRTUAL_KEYS = ['enabled', 'width', 'height', 'hiDPI', 'hz'];

function setVirtual(partial) {
  const clean = {};
  for (const k of VIRTUAL_KEYS) if (partial && k in partial) clean[k] = partial[k];
  if (clean.width !== undefined) clean.width = Math.max(640, Math.min(3840, Math.round(Number(clean.width)) || 1920));
  if (clean.height !== undefined) clean.height = Math.max(480, Math.min(2160, Math.round(Number(clean.height)) || 1080));
  setSetting('virtual', clean);
  displays.applyVirtual();
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
  ipcMain.on('setSharing', (_e, on) => setSharing(on));
  // null = the MacShare virtual display
  ipcMain.on('selectDisplay', (_e, displayId) => {
    setSetting('sharing', { displayId: displayId == null ? null : Number(displayId) });
    stream.restart('display selected');
  });
  ipcMain.on('setVirtual', (_e, partial) => setVirtual(partial));
  ipcMain.on('setStreamMaxHeight', (_e, h) => {
    settings.streamMaxHeight = [0, 1080, 1440, 2160].includes(Number(h)) ? Number(h) : 1080;
    store.saveSettings(settings);
    pushState();
    stream.restart('stream size changed');
  });
  ipcMain.on('setStreamInput', (_e, on) => setStreamInput(on));
  ipcMain.on('setBitrate', (_e, mbps) => {
    settings.bitrateMbps = Math.max(2, Math.min(100, Number(mbps) || 20));
    store.saveSettings(settings);
    pushState();
    stream.restart('bitrate changed');
  });
  // Later phases: setKvm.
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
    server.send(ctx, { t: P.T.STREAM_INPUT, on: settings.streamInput !== false });
    pushState();
  });
  server.on('closed', (ctx) => {
    if (ctx.authed) console.log(`[server] ${ctx.name} disconnected`);
    pushState();
  });
  server.on('rtt', (ctx) => {
    if (process.env.MACSHARE_DEBUG_STATS) console.log(`[server] rtt ${ctx.rttMs} ms`);
    pushState();
  });

  pairing = new Pairing(server, id);
  pairing.on('change', pushState);
  pairing.on('request', showWindow);

  beacon = discovery.start(id);

  helper = new Helper();
  displays = new Displays(helper, () => settings);
  stream = new Stream(server, displays, () => settings);
  // Stream input: only when the switch is on (phases 4–5: and KVM is home).
  input = new Input(server, helper, displays, { enabled: () => settings.streamInput !== false });
  displays.on('change', () => {
    input.releaseAll(); // the shared display moved or changed size mid-press
    pushState();
  });
  stream.on('change', pushState);
  helper.on('exit', pushState);
  if (helper.start()) {
    displays.applyVirtual().then(() => stream.restart('startup'));
    refreshPermissions();
  }

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
  if (stream) stream.stop('off');
  if (helper) helper.stop(); // closes stdin: the helper exits and the virtual display goes away
  if (beacon) beacon.stop();
  if (server) server.close();
});
