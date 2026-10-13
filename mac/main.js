// MacShare — Copyright (C) 2026 MacShare contributors. GPL-3.0, see LICENSE.
// Main process: lifecycle, windows, tray, IPC, and the state pushed to the control window.
//
// State object sent to the control window ('state' channel) on every change:
// {
//   macName, macId, fp,                       // this Mac's identity (fp = cert SHA-256 hex)
//   addresses: ['192.168.1.5', ...],           // this Mac's IPv4 addresses (the server listens on P.PORT)
//   discovery: { on, error, localNetwork },      // discovery.js status
//   found: [{ id, name, os, address, port, invited }],   // other MacShare computers nearby
//   guest: { status: {state, message}, pairing: null|{phase, name, address, code, error}, hosts: [...] },  // link.js
//   connect: { busy, message, error },           // last "Connect by address" / Pair attempt
//   serverError: null | 'message',            // e.g. port already in use
//   client: null | { id, name, os, role, address, rttMs },   // the session (peer.js); role 'host' = we are its guest
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
//   receive: { on, fullScreen, input, session, kind, status, stats, open },   // phase 11 (pcview.js)
//   papps: { on, apps: [{id, name, icon}], listing, launch: {id: ''|'ok'|why}, windows: [{wid, id, title, live}] },   // phase 13
//   ui: { tab }, app: { openAtLogin, keepAwake },
//   wake: { womp, peers: {id: {name, os, at}}, last },   // revision 7 (wake.js)
// }
'use strict';

const path = require('path');
const { app, BrowserWindow, Tray, Menu, nativeImage, systemPreferences } = require('electron');

app.commandLine.appendSwitch('disable-features', 'WebRtcHideLocalIpsWithMdns');
// The hidden capture window plays system audio into WebRTC without any user gesture.
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
// Revision 7, smoothness: we no longer force playout delay 0/0 on every frame (the receiver showed
// frames the instant they were decoded, so Wi-Fi jitter came out as stutter); the viewer picks its
// own pacing (`receive.pacing`). FlexFEC repairs lost packets without waiting a round trip for a
// resend; it costs bandwidth only while packets are being lost.
app.commandLine.appendSwitch('force-fieldtrials', 'WebRTC-FlexFEC-03/Enabled/WebRTC-FlexFEC-03-Advertised/Enabled/');
if (!app.requestSingleInstanceLock()) {
  app.quit();
  process.exit(0);
}

const P = require('../shared/protocol.js');
const store = require('./store');
const identity = require('./identity');
const { Discovery, interfaces } = require('./discovery');
const { Link } = require('./link');
const { Peer } = require('./peer');
const { Server } = require('./server');
const { Pairing } = require('./pairing');
const { startServices } = require('./services');
const { setupIpc } = require('./ipc');
const login = require('./login');
const { Hud } = require('./hud');
const { PairSync } = require('./pairsync');

let win = null;
let tray = null;
let hud = null;
let quitting = false;
let startHidden = process.argv.includes('--hidden');
let settings, id, server, pairing, discovery, link, peer, svc, actions, pairSync;

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
  discovery: { on: false, error: '', localNetwork: true },
  found: [],
  guest: null,
  connect: { busy: false, message: '', error: false },
};

// macshare://pc-app/<id> from a PC app's Dock icon / Launchpad entry (revision 6). It can arrive
// before the services exist, so it waits in `linkQueue`.
let linkQueue = [];
function handleLink(url) {
  if (!svc) return linkQueue.push(url);
  if (/^macshare:\/\/send\b/.test(String(url))) return handleSendLink(String(url));
  const m = /^macshare:\/\/pc-app\/(.+)$/.exec(String(url));
  if (!m) return;
  const id = decodeURIComponent(m[1]).slice(0, 1024);
  if (!settings.papps.on) actions.setPcApps({ on: true });
  svc.pcApps.openFromLink(id);
}
app.on('open-url', (e, url) => {
  e.preventDefault();
  handleLink(url);
});

let defaultIf = '';
function readDefaultIf() {
  require('child_process').execFile('/sbin/route', ['-n', 'get', 'default'], (err, out) => {
    const m = !err && /interface:\s*(\S+)/.exec(out);
    const name = m ? m[1] : '';
    if (name !== defaultIf) {
      defaultIf = name;
      pushState();
    }
  });
}

let pushQueued = false;
function pushState() {
  if (pushQueued) return;
  pushQueued = true;
  setImmediate(() => {
    pushQueued = false;
    // The address the other computer can reach, first (revision 7b: the UI shows only this one):
    // on the peer's network, then real adapters (en*), the default route, VPN tunnels and bridges last.
    const peerNet = String((peer && peer.current && peer.current.address) || '').replace(/^::ffff:/, '').split('.').slice(0, 3).join('.');
    const rank = (i) => (peerNet && i.address.startsWith(`${peerNet}.`) ? 0 : /^en\d/.test(i.name) ? 1
      : /^(utun|bridge|vmnet|vnic|llw|awdl)/.test(i.name) ? 4 : i.name === defaultIf ? 2 : 3);
    state.addresses = interfaces().sort((a, b) => rank(a) - rank(b)).map((i) => i.address);
    state.pairing = pairing ? pairing.pendingView() : null;
    state.paired = pairing ? pairing.list() : [];
    if (discovery) {
      state.discovery = { ...discovery.status };
      state.found = discovery.list();
    }
    if (link) state.guest = link.view();
    const c = peer && peer.current;
    state.client = c ? { id: c.deviceId, name: c.name, os: c.os, role: c.role, address: c.address, rttMs: c.rttMs } : null;
    const { helper, displays, stream, clipboard: clip, kvm } = svc || {};
    state.helper.running = !!(helper && helper.running);
    if (displays) {
      const target = displays.target();
      state.sharing = {
        on: !!settings.sharing.on,
        audio: !!settings.sharing.audio,
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
      state.audio = { ...settings.audio, ...svc.audio.view, screen: stream.audio };
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
    if (svc) state.files = { ...settings.files, ...svc.drop.view, ...svc.fileSend.view, clip: svc.fileClip.view };
    if (svc) state.notifs = { ...settings.notifs, ...svc.notifs.view };
    if (svc) {
      const { secret, ...smb } = settings.smb; // never send the share password to the window
      state.smb = { ...smb, ...svc.smb.view };
      state.apps = { ...settings.apps, ...svc.apps.view };
      state.receive = { ...settings.receive, ...svc.pcView.view };
      state.papps = { ...settings.papps, ...svc.pcApps.view };
    }
    if (svc) state.wake = svc.wake.view;
    if (pairSync) pairSync.check();
    sendScreenState();
    if (win && !win.isDestroyed()) win.webContents.send('state', state);
    updateTray();
  });
}

// Revision 7: tell the viewer what we share, so it can show Start / Extend / Mirror itself
// (screen.state); only when something changed or the peer is new.
let screenStateKey = '';
function sendScreenState() {
  const c = peer && peer.current;
  if (!c || !svc) return void (screenStateKey = '');
  const msg = { t: P.T.SCREEN_STATE, on: !!settings.sharing.on, mode: displayMode(), remote: settings.sharing.remote !== false, modes: ['extend', 'mirror'] };
  const key = JSON.stringify([c.deviceId, msg]);
  if (key === screenStateKey) return;
  screenStateKey = key;
  peer.sendToClient(msg);
}

// Revision 7: the viewer on the other computer starts/stops our sharing or switches Extend/Mirror.
function onScreenCtl(m) {
  if (settings.sharing.remote === false) return void (screenStateKey = '', pushState()); // re-send: remote false
  if (m.mode === 'extend' || m.mode === 'mirror') {
    if (displayMode() !== m.mode) actions.setDisplayMode(m.mode);
  }
  if (typeof m.share === 'boolean' && m.share !== !!settings.sharing.on) actions.setSharing(m.share, 'remote');
}

// macshare://send?p=<path>&p=… from the Share menu extension (revision 7): Send files to the peer.
function handleSendLink(url) {
  let u;
  try { u = new URL(url); } catch { return; }
  const paths = u.searchParams.getAll('p').filter((x) => x.startsWith('/')).slice(0, 1000);
  if (!paths.length) return;
  if (!peer.current) return hud && hud.show('away', 'Not connected', 'Open MacShare on the other computer first');
  actions.sendFiles(paths);
  hud && hud.show('away', `Sending ${paths.length} item${paths.length === 1 ? '' : 's'} to ${peer.current.name}`);
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
      if (r.screen === true) state.permissions.screen = 'granted'; // the helper sees a fresh grant first
      pushState();
    }, () => {});
  }
  pushState();
}

function createWindow() {
  win = new BrowserWindow({
    width: 1060,
    height: 720,
    minWidth: 760,
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
    else showWindow();
  });
  // In the Dock and ⌘-Tab only while the window is open; menu bar only otherwise.
  win.on('show', dockIcon);
  win.on('hide', dockIcon);
  win.on('closed', dockIcon);
  win.on('focus', refreshPermissions);
  win.on('close', (e) => {
    if (!quitting) {
      e.preventDefault();
      win.hide();
    }
  });
}

function dockIcon() {
  if (!app.dock) return;
  const visible = !!(win && !win.isDestroyed() && win.isVisible());
  if (visible && !app.dock.isVisible()) {
    app.dock.show().then(() => win && !win.isDestroyed() && win.focus()); // showing the Dock icon can take focus away
  } else if (!visible && app.dock.isVisible()) {
    app.dock.hide();
  }
}

function showWindow() {
  if (!win || win.isDestroyed()) createWindow();
  else {
    win.show();
    win.focus();
  }
  app.focus({ steal: true });
}

// Menu bar: the app mark as a template icon; the switches people reach for most, one click away.
function updateTray() {
  if (!tray) return;
  const c = state.client;
  const name = c ? c.name : 'the other computer';
  const k = settings.kvm;
  const where = state.input && state.input.where;
  tray.setToolTip(c ? `MacShare: ${c.name}` : 'MacShare');
  const check = (label, checked, click, enabled = true) => ({ label, type: 'checkbox', checked: !!checked, enabled, click });
  const found = (state.found || []).filter((d) => !c || d.id !== c.id);
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: c ? `Connected to ${c.name}${c.rttMs != null ? ` · ${c.rttMs} ms` : ''}` : 'Not connected', enabled: false },
      ...(where === 'driving' || where === 'driven'
        ? [{ label: 'Bring Mouse and Keyboard Back', click: () => svc.kvm.home() }] : []),
      check('Cursor Sharing', k.linked !== false, (i) => actions.setKvm({ linked: i.checked })),
      { type: 'separator' },
      check('Share Screen', settings.sharing.on, (i) => actions.setSharing(i.checked)),
      check('Receive Screen', settings.receive.on, (i) => actions.setReceive({ on: i.checked })),
      check(`Use Mouse and Keyboard on ${c ? name : 'Other Computer'}`, k.driveOther, (i) => actions.setKvm({ driveOther: i.checked })),
      check(`Let ${c ? name : 'Other Computer'} Control ${id.macName}`, k.beDriven, (i) => actions.setKvm({ beDriven: i.checked })),
      check('Share Clipboard', settings.clipboard.enabled, (i) => actions.setClipboard({ enabled: i.checked })),
      check('Send Sound', settings.audio.send, (i) => actions.setAudio({ send: i.checked })),
      { type: 'separator' },
      {
        label: 'Connect To',
        submenu: [
          ...(found.length ? found.map((d) => ({ label: `${d.name} (${d.os === 'mac' ? 'Mac' : d.os === 'linux' ? 'Linux' : 'PC'})`, click: () => actions.pairWith(d.id) }))
            : [{ label: 'Nobody nearby', enabled: false }]),
          { type: 'separator' },
          { label: 'Connect by Address…', click: () => { actions.setTab('overview'); showWindow(); } },
          { label: 'Look Again', click: () => actions.refreshDiscovery() },
        ],
      },
      check('Show a Popup When Switching', settings.app.hud !== false, (i) => actions.setApp({ hud: i.checked })),
      { type: 'separator' },
      { label: 'Open MacShare…', click: showWindow },
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
  });
  server.on('closed', (ctx) => {
    if (ctx.authed) console.log(`[server] ${ctx.name} disconnected`);
    pushState();
  });
  server.on('rtt', (ctx) => {
    if (process.env.MACSHARE_DEBUG_STATS) console.log(`[server] rtt ${ctx.rttMs} ms`);
    pushState();
  });

  discovery = new Discovery(id, server.port);
  discovery.on('change', pushState);
  discovery.start();
  link = new Link(id, {
    canConnect: () => !server.current && !(pairing && pairing.pending),
    resolve: (hostId) => discovery.get(hostId),
  });
  link.on('change', pushState);
  link.on('request', showWindow);
  pairing = new Pairing(server, id, { busy: () => !!link.ctx });
  pairing.on('change', pushState);
  pairing.on('request', showWindow);
  peer = new Peer(server, link);
  peer.on('client', (ctx) => {
    console.log(`[peer] session with ${ctx.name} (${ctx.os}, ${ctx.role === 'host' ? 'we are its guest' : 'it is our guest'})`);
    peer.send(ctx, { t: P.T.STREAM_INPUT, on: settings.streamInput !== false });
    pushState();
  });
  peer.on('closed', pushState);
  peer.on('rtt', pushState);
  link.start();

  svc = startServices({ server: peer, getSettings: () => settings, pushState, onHelperReady: refreshPermissions });
  if (settings.app.openAtLogin !== login.isOn()) login.apply(settings.app.openAtLogin);

  svc.apps.setSharing = (on, by) => actions.setSharing(on, by);
  peer.on(`t:${P.T.SCREEN_CTL}`, (m) => onScreenCtl(m));
  // Two-way switches shared with the other computer, per pair (pairsync.js).
  const SYNC_ACTIONS = {
    clipboard: (dir, on) => actions.setClipboard({ [dir === 'out' ? 'send' : 'receive']: on }),
    notifs: (dir, on) => actions.setNotifs({ [dir === 'out' ? 'send' : 'receive']: on }),
    apps: (dir, on) => (dir === 'out' ? actions.setApps({ offer: on }) : actions.setPcApps({ on })),
    audio: (dir, on) => actions.setAudio({ [dir === 'out' ? 'send' : 'receive']: on }),
    cursor: (dir, on) => actions.setKvm({ [dir === 'out' ? 'driveOther' : 'beDriven']: on }),
  };
  pairSync = new PairSync({ server: peer, getSettings: () => settings, saveSettings: () => store.saveSettings(settings),
    apply: (f, dir, on) => SYNC_ACTIONS[f](dir, on) });
  actions = setupIpc({ state, settings, pushState, server: peer, pairing, discovery, link, ...svc, login, refreshPermissions });
  tray = new Tray(nativeImage.createFromPath(path.join(__dirname, 'assets', 'trayTemplate.png'))); // "Template": macOS tints it
  hud = new Hud(() => settings);
  svc.kvm.on('where', (mode) => {
    const name = peer.current ? peer.current.name : 'the other computer';
    if (mode === 'driving') hud.show('away', settings.kvm.mouse ? `Using ${name}` : `Typing on ${name}`);
    else if (mode === 'driven') hud.show('driven', `${name} is using ${id.macName}`);
    else hud.show('home', `Back on ${id.macName}`);
  });
  svc.fileClip.on('popup', (kind, text) => hud.show(kind, text));
  svc.pcApps.on('popup', (kind, text) => hud.show(kind, text));
  if (app.isPackaged) app.setAsDefaultProtocolClient('macshare');
  for (const url of linkQueue.splice(0)) handleLink(url);
  // The hotkey's double-tap: the big card "Cursor sharing on/off" (also when the other side switched it).
  svc.kvm.on('linked', (on, here) => {
    const name = peer.current ? peer.current.name : '';
    const key = P.hotkeyName(settings.keys.hotkey);
    const sub = !here && name ? `Turned ${on ? 'on' : 'off'} on ${name}`
      : on ? `${name ? `With ${name}. ` : ''}Double-tap ${key} to turn it off` : `Double-tap ${key} to turn it on`;
    hud.show(on ? 'linkOn' : 'linkOff', `Cursor sharing ${on ? 'on' : 'off'}`, sub);
  });
  svc.drop.on('batch', (b) => {
    if (b.kind === 'send') hud.show('driven', `Received ${b.files} file${b.files === 1 ? '' : 's'} from ${peer.current ? peer.current.name : 'the other computer'}`);
  });
  createWindow();
  refreshPermissions();
  readDefaultIf();
  setInterval(() => {
    readDefaultIf();
    pushState();
  }, 5000); // addresses change when the network does
  // While Setup shows something missing, notice the grant without waiting for a window focus.
  setInterval(() => {
    const p = state.permissions;
    const missing = p.screen !== 'granted' || !p.accessibility || p.inputMonitoring === false;
    if (missing && win && !win.isDestroyed() && win.isVisible()) refreshPermissions();
  }, 3000);
});

app.on('second-instance', showWindow);
app.on('activate', showWindow);
app.on('window-all-closed', () => {}); // keep running in the menu bar
app.on('will-quit', () => {
  const { globalShortcut } = require('electron');
  globalShortcut.unregisterAll();
});
app.on('before-quit', () => {
  quitting = true;
  if (svc) svc.shutdown(); // KVM home first, so the helper releases input
  if (discovery) discovery.stop();
  if (link) link.stop();
  if (server) server.close();
});
