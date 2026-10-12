// MacShare — Copyright (C) 2026 MacShare contributors. GPL-3.0, see LICENSE.
// Main process: lifecycle, windows, tray, IPC and the state pushed to the main window.
const { app, BrowserWindow, Tray, Menu, nativeImage, nativeTheme } = require('electron');
const crypto = require('crypto');
const os = require('os');
const path = require('path');
const P = require('../shared/protocol.js');
const store = require('./store');
const Discovery = require('./discovery');
const Link = require('./link');
const Screen = require('./screen');
const Clip = require('./clip');
const setupIpc = require('./ipc');
const Helper = require('./helper');
const Kvm = require('./kvm');
const firewall = require('./firewall');
const Terminal = require('./terminal');
const FileDrop = require('./filedrop');
const Smb = require('./smb');
const Apps = require('./apps');
const { normalize } = require('./settings');

app.commandLine.appendSwitch('disable-features', 'WebRtcHideLocalIpsWithMdns');
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  Menu.setApplicationMenu(null); // its accelerators would steal keys meant for the Mac
  app.on('second-instance', () => showMain());
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
let terminal = null;
let fileDrop = null;
let smb = null;
let apps = null;
let kvm = null;
let lastMode = 'home';
let fw = { checking: true, ok: null, message: 'Checking…' }; // firewall self-check (phase 6)
const startHidden = process.argv.includes('--hidden'); // started at sign-in: tray only
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

  discovery = new Discovery(pushState);
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
  link.onState(pushState);
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
  terminal = new Terminal({ link, settings, onChange: pushState });
  fileDrop = new FileDrop({ link, settings, onProgress: (v) => { screen.sendDropProgress(v); pushState(); } });
  screen.fileDrop = fileDrop;
  apps = new Apps({ link, getMonitor: () => screen.win, onChange: pushState });
  screen.apps = apps;
  smb = new Smb({ link, settings, save: saveSettings, onChange: pushState });
  helper = new Helper();
  kvm = new Kvm({ link, helper, clip, settings, onChange: onKvmChange });
  helper.on('exit', pushState);
  helper.start();
  setupIpc({ link, discovery, screen, clip, kvm, terminal, fileDrop, smb, apps, settings, save: saveSettings, push: pushState, buildState,
    checkFirewall, fixFirewall, setStartup });
  nativeTheme.on('updated', pushState);
  link.start();

  createTray();
  createMainWindow();
  setTimeout(checkFirewall, 3000);
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
    // A pairing code to compare: bring the window to the front (docs/UI.md).
    const phase = s.pairing ? s.pairing.phase : null;
    if (phase === 'code' && lastPairPhase !== 'code') showMain();
    lastPairPhase = phase;
    if (mainWin && !mainWin.isDestroyed()) mainWin.webContents.send('state', s);
    if (tray) tray.setToolTip('MacShare — ' + statusLine(s));
    const canMonitor = s.link.state === 'connected';
    if (trayMenu && trayMenu.getMenuItemById('monitor').enabled !== canMonitor) {
      trayMenu.getMenuItemById('monitor').enabled = canMonitor;
      tray.setContextMenu(trayMenu);
    }
  });
}

function buildState() {
  return {
    device,
    ...link.snapshot(),
    macs: discovery.list(),
    discoveryError: discovery.error,
    stream: screen.state,
    macInput: screen.macInput, // the Mac's "Receive input" switch
    input: kvm.mode,
    kvmState: kvm.view(),
    kvm: { ...settings.kvm, pcSide: kvm.pcSide },
    keys: settings.keys,
    monitor: settings.monitor,
    clipboard: { ...settings.clipboard, ...clip.view },
    ui: settings.ui,
    version: app.getVersion(),
    firewall: fw,
    audio: settings.audio,
    terminal: { ...settings.terminal, ...terminal.view() },
    files: { ...settings.files, ...fileDrop.view(), smb: smb.view() },
    apps: apps.view(),
    startup: getStartup(),
  };
}

// KVM mode changed: Monitor 2 stops/starts sending input, and the UI updates.
function onKvmChange() {
  if (kvm.mode !== lastMode) {
    lastMode = kvm.mode;
    screen.refreshInput();
  }
  pushState();
}

// ---- phase 6: firewall, start with Windows ----

async function checkFirewall() {
  fw = { ...fw, checking: true };
  pushState();
  fw = { ...(await firewall.check()), checking: false };
  pushState();
}

async function fixFirewall() {
  fw = { ...fw, checking: true };
  pushState();
  try {
    fw = { ...(await firewall.fix(fw)), checking: false };
  } catch (e) {
    fw = { ...fw, checking: false, message: 'Not fixed: ' + (/cancel/i.test(e.message) ? 'the administrator prompt was declined' : e.message) };
  }
  pushState();
}

// In development the login item starts electron.exe with this app's folder.
const loginItem = () => ({ path: process.execPath, args: app.isPackaged ? ['--hidden'] : [app.getAppPath(), '--hidden'] });
function getStartup() {
  return app.getLoginItemSettings(loginItem()).openAtLogin;
}
function setStartup(on) {
  app.setLoginItemSettings({ openAtLogin: !!on, ...loginItem() });
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
    case 'identity_changed': return "Mac's identity changed";
    default: return 'Not paired';
  }
}

// ---- IPC ----

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
  const icon = nativeImage.createFromPath(path.join(__dirname, 'assets', 'tray.png'));
  tray = new Tray(icon);
  tray.setToolTip('MacShare');
  trayMenu = Menu.buildFromTemplate([
    { label: 'Open MacShare', click: showMain },
    { id: 'monitor', label: 'Open Monitor 2', enabled: false, click: () => screen.open(false) },
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
  if (kvm) kvm.shutdown(); // gives back any captured input and stops the helper
});

// Closing the main window only hides it; the app lives in the tray until Quit.
app.on('window-all-closed', () => {});
