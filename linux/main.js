// TwinDesk — Copyright (C) 2026 inukaasith. GPL-3.0, see LICENSE.
// Main process (Linux): lifecycle, windows, tray, IPC and the state pushed to the
// main window. Follows windows/main.js: discovery, pairing with the Mac as its
// guest, clipboard, the Mac's screen in a window; L3: mouse and keyboard (kvm.js + linux-helper).
const { app, BrowserWindow, Tray, Menu, nativeImage, nativeTheme } = require('electron');
const crypto = require('crypto');
const os = require('os');
const path = require('path');
const P = require('../shared/protocol.js');
const store = require('./store');
const { Discovery, interfaces } = require('./discovery');
const Link = require('./link');
const Screen = require('./screen');
const Clip = require('./clip');
const Helper = require('./helper');
const Kvm = require('./kvm');
const Hud = require('./hud');
const setupIpc = require('./ipc');
const system = require('./system');
const { normalize } = require('./settings');

app.commandLine.appendSwitch('disable-features', 'WebRtcHideLocalIpsWithMdns');
// Renamed MacShare → TwinDesk: settings, pairing and keys stay in the folder they've always been
// in (Electron would follow the new product name). A dev copy's --user-data-dir still wins.
if (!app.commandLine.hasSwitch('user-data-dir')) app.setPath('userData', path.join(app.getPath('appData'), 'MacShare'));
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  Menu.setApplicationMenu(null); // its accelerators would steal keys meant for the Mac
  app.on('second-instance', () => showMain()); // starting TwinDesk again shows the window (no tray on some desktops)
  app.whenReady().then(start);
}

let mainWin = null;
let tray = null;
let trayMenu = null;
let quitting = false;
let discovery = null;
let link = null;
let settings = null;
let device = null;
let screen = null;
let clip = null;
let helper = null;
let kvm = null;
let hud = null;
let lastMode = 'home';
let fw = { checking: true, ok: null, message: 'Checking…' };
const session = system.session();
const startHidden = process.argv.includes('--hidden');
let lastPairPhase = null;

function loadDevice() {
  let d = store.read('device.json', null);
  if (!d || typeof d.id !== 'string') {
    d = { id: crypto.randomUUID() };
    store.write('device.json', d);
  }
  return { id: d.id, name: os.hostname() };
}

function start() {
  device = loadDevice();
  settings = normalize(store.read('settings.json', {}));

  discovery = new Discovery(device);
  discovery.on('change', pushState);
  discovery.on('invite', () => { pushState(); showMain(); }); // a Mac wants to connect: Pair is focused
  discovery.start();

  link = new Link({
    device,
    store: {
      load: () => {
        const p = store.read('pairing.json', null);
        return p && p.macId && p.token && p.fp && p.address ? p : null;
      },
      save: (p) => store.write('pairing.json', p),
      clear: () => store.remove('pairing.json'),
    },
    resolveAddress: (macId) => discovery.get(macId),
  });
  link.onState(() => {
    discovery.wantProbes = link.snapshot().link.state !== 'connected'; // probe every 10 s only while not connected
    pushState();
  });
  clip = new Clip(link, () => settings.clipboard, pushState);
  screen = new Screen({
    link,
    clip,
    inputAllowed: () => !kvm || kvm.mode === 'home', // no Monitor 2 input while driving or driven
    settings,
    saveSettings,
    onChange: pushState,
    isQuitting: () => quitting,
  });
  // The helper needs X11 (XInput2 + XTest); Wayland comes in L6.
  helper = new Helper(() => (session.type === 'wayland' ? 'Needs an Xorg session' : session.type !== 'x11' ? 'No X11 display' : ''));
  kvm = new Kvm({ link, helper, clip, settings, save: saveSettings, onChange: onKvmChange });
  hud = new Hud(() => settings);
  // Cursor sharing switched on/off (hotkey double-tap, tray, the Cursor tab or the Mac): the big card.
  kvm.onLinked = (on, here) => {
    const name = link.snapshot().link.state === 'connected' ? peerName() : '';
    const key = P.hotkeyName(settings.keys.hotkey, 'win').replace('Windows key', 'Super');
    const sub = !here && name ? 'Turned ' + (on ? 'on' : 'off') + ' on ' + name
      : on ? (name ? 'With ' + name + '. ' : '') + 'Double-tap ' + key + ' to turn it off' : 'Double-tap ' + key + ' to turn it on';
    hud.show(on ? 'linkOn' : 'linkOff', 'Cursor sharing ' + (on ? 'on' : 'off'), sub);
  };
  kvm.onWhere = (mode) => { // the switching popup
    const name = peerName();
    if (mode === 'driving') hud.show('away', (kvm.keyboardOnly ? 'Typing on ' : 'Using ') + name);
    else if (mode === 'driven') hud.show('driven', name + ' is using ' + device.name);
    else hud.show('home', 'Back on ' + device.name);
  };
  helper.start();
  setupIpc({ link, discovery, screen, clip, kvm, settings, save: saveSettings, push: pushState, buildState,
    checkFirewall, fixFirewall });
  nativeTheme.on('updated', pushState);
  link.start();

  createTray();
  createMainWindow();
  checkFirewall();
  if (process.argv.includes('--test-monitor')) screen.open(true); // dev: ?test=1 pattern
}

// ---- state ----

let pushQueued = false;
function pushState() {
  if (pushQueued) return;
  pushQueued = true;
  setImmediate(() => {
    pushQueued = false;
    const s = buildState();
    const phase = s.pairing ? s.pairing.phase : null;
    if (phase === 'code' && lastPairPhase !== 'code') showMain(); // a code to compare: to the front
    lastPairPhase = phase;
    if (mainWin && !mainWin.isDestroyed()) mainWin.webContents.send('state', s);
    if (tray) tray.setToolTip('TwinDesk: ' + statusLine(s));
    updateTray(s);
  });
}

// Setup items that aren't ready.
function missing() {
  const m = [];
  if (session.type !== 'x11') m.push('session');
  if (fw.ok === false && !fw.checking) m.push('firewall');
  const h = kvm.view().helper;
  if (session.type === 'x11' && h && h !== 'starting') m.push('helper');
  return m;
}

function buildState() {
  const miss = missing();
  return {
    device,
    ...link.snapshot(),
    found: discovery.list(),
    discovery: { ...discovery.status },
    addresses: ownAddresses(),
    stream: screen.state,
    macInput: screen.macInput, // the Mac's "Receive input" switch
    input: kvm.mode,
    kvmState: { ...kvm.view(), message: fillNames(kvm.message) },
    kvm: { ...settings.kvm, pcSide: kvm.pcSide },
    keys: settings.keys,
    monitor: settings.monitor,
    clipboard: { ...settings.clipboard, ...clip.view },
    ui: settings.ui,
    app: settings.app,
    version: app.getVersion(),
    firewall: fw,
    session,
    setup: { missing: miss, show: !fw.checking && miss.some((x) => !settings.setup.skipped.includes(x)) },
  };
}

// The Mac's name for popups and messages.
function peerName() {
  return link.snapshot().link.macName || 'the Mac';
}

// kvm.js messages name the computers as {Name} / {me} (shared wording with the PC).
function fillNames(t) {
  if (!t || !String(t).includes('{')) return t || '';
  const name = peerName();
  const v = { me: 'this computer', name, Name: name.charAt(0).toUpperCase() + name.slice(1) };
  return String(t).replace(/\{(me|name|Name)\}/g, (m, k) => v[k]);
}

// This computer's addresses for the Overview: real adapters first (Copy takes the first one).
function ownAddresses() {
  const rank = (n) => (/^(docker|br-|veth|virbr|tun|tap|wg)/.test(n) ? 2 : /^(wl|en|eth)/.test(n) ? 0 : 1);
  return interfaces().sort((a, b) => rank(a.name) - rank(b.name)).map((i) => i.address);
}

// KVM mode changed: Monitor 2 stops/starts sending input, and the UI updates.
function onKvmChange() {
  if (kvm.mode !== lastMode) {
    lastMode = kvm.mode;
    screen.refreshInput();
  }
  pushState();
}

// ---- firewall ----

async function checkFirewall() {
  fw = { ...fw, checking: true };
  pushState();
  fw = { ...(await system.checkFirewall(!!store.read('firewall.json', {}).fixed)), checking: false };
  pushState();
}

async function fixFirewall() {
  fw = { ...fw, checking: true };
  pushState();
  try {
    await system.fixFirewall(fw.tool);
    if (fw.tool === 'ufw') store.write('firewall.json', { fixed: true });
    fw = { ...(await system.checkFirewall(true)), checking: false };
  } catch (e) {
    fw = { ...fw, checking: false, message: 'Not fixed: ' + e.message };
  }
  pushState();
}

function saveSettings() {
  store.write('settings.json', settings);
}

function statusLine(s) {
  switch (s.link.state) {
    case 'connected': return 'Connected to ' + s.link.macName;
    case 'connecting': return 'Connecting…';
    case 'reconnecting': return 'Reconnecting…';
    case 'identity_changed': return 'Pair again';
    default: return 'Not paired';
  }
}

// ---- windows and tray ----

function createMainWindow() {
  const b = settings.windows.main || {};
  mainWin = new BrowserWindow({
    width: b.width || 900,
    height: b.height || 680,
    x: b.x,
    y: b.y,
    minWidth: 720,
    minHeight: 480,
    title: 'TwinDesk',
    icon: path.join(__dirname, 'assets', 'icon.png'),
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#2b2b2e' : '#e9e9ee',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload-app.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  mainWin.loadFile(path.join(__dirname, 'app.html'));
  mainWin.once('ready-to-show', () => { if (!startHidden) mainWin.show(); });
  mainWin.on('close', (e) => {
    saveBounds();
    if (!quitting) {
      e.preventDefault();
      mainWin.hide();
    }
  });
}

function saveBounds() {
  if (!mainWin || mainWin.isDestroyed() || mainWin.isMinimized()) return;
  settings.windows.main = mainWin.getNormalBounds();
  saveSettings();
}

function showMain() {
  if (!mainWin || mainWin.isDestroyed()) return;
  if (mainWin.isMinimized()) mainWin.restore();
  mainWin.show();
  mainWin.focus();
}

function createTray() {
  try {
    tray = new Tray(nativeImage.createFromPath(path.join(__dirname, 'assets', 'tray@2x.png')));
  } catch (e) {
    console.error('[tray]', e.message); // no tray on this desktop: start TwinDesk again to show the window
    return;
  }
  tray.setToolTip('TwinDesk');
  tray.on('click', showMain);
  updateTray(buildState());
}

// The tray menu, rebuilt when what it shows changes (some
// Linux trays only take a new menu, not changes to the old one).
let trayKey = '';
function updateTray(s) {
  if (!tray) return;
  const connected = s.link.state === 'connected';
  const linked = settings.kvm.linked !== false && settings.kvm.mouse;
  const key = JSON.stringify([connected, linked, kvm.mode, settings.app.hud]);
  if (key === trayKey) return;
  trayKey = key;
  trayMenu = Menu.buildFromTemplate([
    { label: 'Open TwinDesk', click: showMain },
    { id: 'monitor', label: 'Show the Mac’s screen', enabled: connected, click: () => screen.open(false) },
    { type: 'separator' },
    { label: 'Cursor Sharing', type: 'checkbox', checked: linked, click: (i) => kvm.setLinked(i.checked) },
    { label: 'Bring Mouse and Keyboard Back', enabled: kvm.mode !== 'home', click: () => kvm.home() },
    { label: 'Show a Popup When Switching', type: 'checkbox', checked: settings.app.hud, click: (i) => { settings.app.hud = i.checked; saveSettings(); pushState(); } },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() },
  ]);
  tray.setContextMenu(trayMenu);
}

app.on('before-quit', () => {
  quitting = true;
  saveBounds();
  if (kvm) kvm.shutdown(); // gives back any captured input and stops the helper
  if (discovery) discovery.stop();
});

// Closing the main window only hides it; the app lives in the tray until Quit.
app.on('window-all-closed', () => {});
