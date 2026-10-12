// MacShare — Copyright (C) 2026 MacShare contributors. GPL-3.0, see LICENSE.
// Main process: lifecycle, windows, tray, IPC and the state pushed to the main window.
const { app, BrowserWindow, Tray, Menu, ipcMain, nativeImage } = require('electron');
const crypto = require('crypto');
const os = require('os');
const path = require('path');
const P = require('../shared/protocol.js');
const store = require('./store');
const Discovery = require('./discovery');
const Link = require('./link');
const Screen = require('./screen');

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

function loadDevice() {
  let d = store.read('device.json', null);
  if (!d || typeof d.id !== 'string') {
    d = { id: crypto.randomUUID() };
    store.write('device.json', d);
  }
  return { id: d.id, name: os.hostname() };
}

function loadSettings() {
  const s = store.read('settings.json', {});
  const kvm = s.kvm || {};
  return {
    kvm: {
      driveOther: kvm.driveOther !== false,
      beDriven: kvm.beDriven !== false,
      resistancePx: Number.isFinite(kvm.resistancePx) ? kvm.resistancePx : P.RESISTANCE_PX,
      speed: Number.isFinite(kvm.speed) ? kvm.speed : 1.0,
      reverseScroll: kvm.reverseScroll === true,
    },
    windows: s.windows || {},
  };
}

function start() {
  device = loadDevice();
  settings = loadSettings();

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
  screen = new Screen({
    link,
    settings,
    saveSettings: () => store.write('settings.json', settings),
    onChange: pushState,
    isQuitting: () => quitting,
  });
  link.start();

  createTray();
  createMainWindow();
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
    input: 'home', // phases 4–5
    kvm: settings.kvm,
  };
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

ipcMain.handle('getState', () => buildState());

ipcMain.handle('pair', (_e, target) => {
  if (typeof target !== 'string' || !target.trim()) return;
  const mac = discovery.get(target);
  if (mac) return link.startPairing({ address: mac.address, port: mac.port, macName: mac.name });
  const m = /^\s*([^\s:]+)(?::(\d{1,5}))?\s*$/.exec(target);
  if (!m) return;
  const port = m[2] ? Number(m[2]) : P.PORT;
  if (port < 1 || port > 65535) return;
  link.startPairing({ address: m[1], port, macName: m[1] });
});
ipcMain.handle('confirmCode', () => link.confirmCode());
ipcMain.handle('cancelPair', () => link.cancelPair());
ipcMain.handle('forget', () => link.forget());
ipcMain.handle('openMonitor', () => screen.open(false));

// ---- windows and tray ----

function createMainWindow() {
  const b = settings.windows.main || {};
  mainWin = new BrowserWindow({
    width: b.width || 560,
    height: b.height || 720,
    x: b.x,
    y: b.y,
    minWidth: 420,
    minHeight: 480,
    title: 'MacShare',
    icon: path.join(__dirname, 'assets', 'tray@2x.png'),
    backgroundColor: '#f4f5f7',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload-app.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  mainWin.loadFile(path.join(__dirname, 'app.html'));
  mainWin.once('ready-to-show', () => mainWin.show());
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
  store.write('settings.json', settings);
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
});

// Closing the main window only hides it; the app lives in the tray until Quit.
app.on('window-all-closed', () => {});
