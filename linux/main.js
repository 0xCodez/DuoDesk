// MacShare — Copyright (C) 2026 MacShare contributors. GPL-3.0, see LICENSE.
// Main process (Linux, docs/LINUX.md): lifecycle, windows, tray, IPC and the state pushed to the
// main window. Follows windows/main.js; phases L0–L2: discovery, pairing with the Mac as its
// guest, clipboard, the Mac's screen in a window. Mouse and keyboard sharing come in L3.
const { app, BrowserWindow, Tray, Menu, nativeImage, nativeTheme } = require('electron');
const crypto = require('crypto');
const os = require('os');
const path = require('path');
const store = require('./store');
const { Discovery, interfaces } = require('./discovery');
const Link = require('./link');
const Screen = require('./screen');
const Clip = require('./clip');
const setupIpc = require('./ipc');
const system = require('./system');
const { normalize } = require('./settings');

app.commandLine.appendSwitch('disable-features', 'WebRtcHideLocalIpsWithMdns');
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  Menu.setApplicationMenu(null); // its accelerators would steal keys meant for the Mac
  app.on('second-instance', () => showMain()); // starting MacShare again shows the window (no tray on some desktops)
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
    inputAllowed: () => true, // no shared mouse and keyboard yet (L3)
    settings,
    saveSettings,
    onChange: pushState,
    isQuitting: () => quitting,
  });
  setupIpc({ link, discovery, screen, clip, settings, save: saveSettings, push: pushState, buildState,
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
    if (tray) tray.setToolTip('MacShare: ' + statusLine(s));
    const canMonitor = s.link.state === 'connected';
    if (trayMenu && trayMenu.getMenuItemById('monitor').enabled !== canMonitor) {
      trayMenu.getMenuItemById('monitor').enabled = canMonitor;
      tray.setContextMenu(trayMenu);
    }
  });
}

// Setup items that aren't ready (docs/ROADMAP.md "Setup screen").
function missing() {
  const m = [];
  if (session.type !== 'x11') m.push('session');
  if (fw.ok === false && !fw.checking) m.push('firewall');
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
    keys: settings.keys,
    monitor: settings.monitor,
    clipboard: { ...settings.clipboard, ...clip.view },
    ui: settings.ui,
    version: app.getVersion(),
    firewall: fw,
    session,
    setup: { missing: miss, show: !fw.checking && miss.some((x) => !settings.setup.skipped.includes(x)) },
  };
}

// This computer's addresses for the Overview: real adapters first (Copy takes the first one).
function ownAddresses() {
  const rank = (n) => (/^(docker|br-|veth|virbr|tun|tap|wg)/.test(n) ? 2 : /^(wl|en|eth)/.test(n) ? 0 : 1);
  return interfaces().sort((a, b) => rank(a.name) - rank(b.name)).map((i) => i.address);
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
    title: 'MacShare',
    icon: path.join(__dirname, 'assets', 'tray@2x.png'),
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
    console.error('[tray]', e.message); // no tray on this desktop: start MacShare again to show the window
    return;
  }
  tray.setToolTip('MacShare');
  trayMenu = Menu.buildFromTemplate([
    { label: 'Open MacShare', click: showMain },
    { id: 'monitor', label: 'Show the Mac’s screen', enabled: false, click: () => screen.open(false) },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() },
  ]);
  tray.setContextMenu(trayMenu);
  tray.on('click', showMain);
}

app.on('before-quit', () => {
  quitting = true;
  saveBounds();
  if (discovery) discovery.stop();
});

// Closing the main window only hides it; the app lives in the tray until Quit.
app.on('window-all-closed', () => {});
