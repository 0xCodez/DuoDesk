// MacShare — Copyright (C) 2026 MacShare contributors. GPL-3.0, see LICENSE.
// Main process: lifecycle, windows, tray, IPC, and the state pushed to the control window.
//
// State object sent to the control window ('state' channel) on every change:
// {
//   macName, macId, fp,                       // this Mac's identity (fp = cert SHA-256 hex)
//   addresses: ['192.168.1.5:47800', ...],    // where Windows can reach us
//   serverError: null | 'message',            // e.g. port already in use
//   client: null | { id, name, address, rttMs },   // the connected, authenticated PC
//   input: { where: 'home'|'driving'|'driven', message: '', tapError: null|'msg' },   // kvm.js
//   pairing: null | { name, code: null|'123456', confirmed, allowed },
//   paired: [{ id, name, pairedAt, lastSeen }],
//   permissions: { screen: 'granted'|'denied'|'not-determined'|..., accessibility: bool,
//                  inputMonitoring: null|bool },   // null = not checked yet (asked from the helper)
//   helper: { running: bool },
//   sharing: { on, displayId: null|id, bitrateMbps, streamMaxHeight (0 = native),
//              displays: [{ id, label, width, height, pixelWidth, pixelHeight, virtual, primary }],
//              targetId: null|id,                  // the display being shared now
//              virtual: { enabled, width, height, hiDPI, hz, active: bool, error: null|'msg' } },
//   displayMode: 'extend'|'mirror'|'custom',    // what Monitor 2 shows (Display tab)
//   streamInput: bool,                          // accept mouse/keyboard from Monitor 2
//   stream: { status, display, width, height, fps, mbps, encoder, codec, qp, ... },   // stream.js
//   kvm: settings.kvm, keys: settings.keys,     // Cursor / Keyboard tabs (behaviour: phases 4–5)
//   clipboard: { ...settings.clipboard, peerAccepts, lastSkip,
//                history: [{ dir: 'out'|'in', at, size, text (preview) }] },
//   ui: { tab }, app: { openAtLogin, keepAwake },
// }
'use strict';

const path = require('path');
const { app, BrowserWindow, Tray, Menu, nativeImage, systemPreferences } = require('electron');

app.commandLine.appendSwitch('disable-features', 'WebRtcHideLocalIpsWithMdns');
// Tag every sent video frame with playout delay 0/0 (RTP playout-delay extension): the receiver
// renders frames as soon as they are decoded instead of building up a smoothing jitter buffer.
// The hidden capture window plays system audio into WebRTC without any user gesture.
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
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
const { startServices } = require('./services');
const { setupIpc } = require('./ipc');
const login = require('./login');

let win = null;
let tray = null;
let quitting = false;
let startHidden = process.argv.includes('--hidden');
let settings, id, server, pairing, beacon, svc, actions;

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
    const { helper, displays, stream, clipboard: clip, kvm } = svc || {};
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
    if (stream) {
      state.stream = stream.view;
      state.audio = { ...settings.audio, ...stream.audio, peerAccepts: stream.peerAudio };
    }
    state.streamInput = settings.streamInput !== false;
    state.displayMode = displayMode();
    state.kvm = settings.kvm;
    state.keys = settings.keys;
    state.clipboard = clip ? { ...settings.clipboard, ...clip.view } : null;
    state.ui = settings.ui;
    state.app = settings.app;
    if (kvm) state.input = kvm.view;
    if (svc) state.terminal = { ...settings.terminal, ...svc.terminal.view, toPc: svc.sshClient.view };
    if (svc) state.files = { ...settings.files, ...svc.drop.view };
    if (svc) {
      const { secret, ...smb } = settings.smb; // never send the share password to the window
      state.smb = { ...smb, ...svc.smb.view };
      state.apps = { ...settings.apps, ...svc.apps.view };
    }
    if (win && !win.isDestroyed()) win.webContents.send('state', state);
    updateTray();
  });
}

function displayMode() {
  const t = svc && svc.displays.target();
  if (!t) return 'custom';
  if (t.virtual) return 'extend';
  return t.primary && !settings.virtual.enabled ? 'mirror' : 'custom';
}

function refreshPermissions() {
  state.permissions.screen = systemPreferences.getMediaAccessStatus('screen');
  state.permissions.accessibility = systemPreferences.isTrustedAccessibilityClient(false);
  if (svc && svc.helper.running) {
    svc.helper.request('permissions').then((r) => {
      state.permissions.inputMonitoring = !!r.inputMonitoring;
      pushState();
    }, () => {});
  }
  pushState();
}

function createWindow() {
  win = new BrowserWindow({
    width: 900,
    height: 680,
    minWidth: 720,
    minHeight: 520,
    title: 'MacShare',
    show: false,
    titleBarStyle: 'hiddenInset', // the sidebar runs up under the traffic lights
    vibrancy: 'sidebar',
    visualEffectState: 'active',
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload-control.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.webContents.on('console-message', (e) => {
    if (e.level === 'warning' || e.level === 'error') console.log(`[window] ${e.level}: ${e.message}`);
  });
  win.loadFile(path.join(__dirname, 'control.html'));
  win.once('ready-to-show', () => {
    if (startHidden) startHidden = false; // started at login: stay in the menu bar
    else win.show();
  });
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
        click: (item) => actions.setSharing(item.checked),
      },
      {
        label: 'Receive input from the PC',
        type: 'checkbox',
        checked: settings.streamInput !== false,
        click: (item) => actions.setStreamInput(item.checked),
      },
      {
        label: 'Share clipboard',
        type: 'checkbox',
        checked: !!settings.clipboard.enabled,
        click: (item) => actions.setClipboard({ enabled: item.checked }),
      },
      { type: 'separator' },
      { label: 'Quit MacShare', click: () => app.quit() },
    ]),
  );
}

app.whenReady().then(() => {
  if (app.dock) app.dock.hide();
  store.init(app.getPath('userData'));
  settings = store.loadSettings();
  id = identity.load(settings);
  Object.assign(state, { macName: id.macName, macId: id.macId, fp: id.fp, version: app.getVersion() });
  console.log(`[main] ${id.macName} (${id.macId}) fp ${id.fp}`);

  server = new Server(id);
  server.on('listening', () => console.log(`[server] listening on 0.0.0.0:${server.port}`));
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

  svc = startServices({ server, getSettings: () => settings, pushState, onHelperReady: refreshPermissions });
  if (settings.app.openAtLogin !== login.isOn()) login.apply(settings.app.openAtLogin);

  actions = setupIpc({ state, settings, pushState, server, pairing, ...svc, login });
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
  if (svc) svc.shutdown(); // KVM home first, so the helper releases input
  if (beacon) beacon.stop();
  if (server) server.close();
});
