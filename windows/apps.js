// MacShare — Copyright (C) 2026 MacShare contributors. GPL-3.0, see LICENSE.
// Mac apps on the PC (phase 12, docs/ROADMAP.md), main-process side: the app list and launching
// for the Apps tab, and the per-app windows. Those windows are opened by the Monitor 2 renderer
// (window.open, so they can show the same video stream, cropped); here they get the app's title,
// icon and their own AppUserModelID, so each Mac app has its own taskbar button.
const { app, nativeImage, screen: displays } = require('electron');
const fs = require('fs');
const path = require('path');
const P = require('../shared/protocol.js');

const T = P.T;

class Apps {
  // opts: link, getMonitor() → BrowserWindow|null, onChange()
  constructor(opts) {
    Object.assign(this, opts);
    this.list = [];       // [{id, name, icon}] from apps.result
    this.windows = [];    // last app.windows list
    this.picture = null;  // {width, height}: stream pixel size from app.windows pw/ph
    this.message = '';
    this.loading = false;
    this.iconDir = path.join(app.getPath('userData'), 'app-icons');

    this.link.on(T.APPS_RESULT, (m) => {
      this.loading = false;
      this.list = (Array.isArray(m.apps) ? m.apps : [])
        .filter((a) => a && typeof a.id === 'string' && typeof a.name === 'string')
        .map((a) => ({ id: a.id, name: a.name, icon: typeof a.icon === 'string' && a.icon.startsWith('data:image/png;base64,') ? a.icon : '' }));
      this.onChange();
    });
    this.link.on(T.APP_LAUNCHED, (m) => {
      const a = this.list.find((x) => x.id === m.id);
      this.message = m.ok ? '' : 'Couldn’t open ' + (a ? a.name : m.id) + (m.why ? ': ' + m.why : '');
      this.onChange();
    });
    this.link.on(T.APP_WINDOWS, (m) => {
      this.windows = (Array.isArray(m.windows) ? m.windows : []).filter(validWindow);
      if (m.pw > 0 && m.ph > 0) this.picture = { width: Number(m.pw), height: Number(m.ph) };
      this._toMonitor();
    });
    this.link.on('closed', () => { this.windows = []; this._toMonitor(); });
  }

  refresh() {
    if (this.link.send({ t: T.APPS_LIST })) { this.loading = true; this.onChange(); }
  }

  launch(id) {
    if (typeof id !== 'string') return;
    this.message = '';
    this.link.send({ t: T.APP_LAUNCH, id });
    this.onChange();
  }

  // The Monitor 2 renderer (re)loaded: give it the current windows.
  _toMonitor() {
    const w = this.getMonitor();
    if (w && !w.isDestroyed()) w.webContents.send('app-windows', this.windows);
  }

  resend() { this._toMonitor(); }

  // Called once per Monitor 2 window: lets the renderer open app windows and dresses them up.
  attach(monitorWin) {
    const wc = monitorWin.webContents;
    wc.setWindowOpenHandler((d) => {
      if (!/^app-\d+$/.test(d.frameName)) return { action: 'deny' };
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          backgroundColor: '#000000',
          autoHideMenuBar: true,
          show: true,
          webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false, backgroundThrottling: false },
        },
      };
    });
    wc.on('did-create-window', (win, d) => {
      const wid = Number(String(d.frameName).slice(4));
      this._dress(win, wid);
      win.setMenu(null);
      win.on('page-title-updated', (e) => e.preventDefault());
    });
  }

  // Title, size, icon and taskbar identity for one app window.
  _dress(win, wid) {
    const w = this.windows.find((x) => x.wid === wid);
    if (!w) return;
    const a = this.list.find((x) => x.id === w.id);
    win.setTitle(w.title || (a ? a.name : 'Mac app'));
    // 1:1 with the Mac's pixels: w·pw × h·ph device pixels, ÷ the scale of the monitor it opens on.
    const mon = this.getMonitor();
    const stream = this.picture || (mon && mon.streamSize) || { width: 1920, height: 1080 };
    const scale = displays.getDisplayMatching(win.getBounds()).scaleFactor || 1;
    let width = (w.w * stream.width) / scale, height = (w.h * stream.height) / scale;
    const grow = Math.max(1, 200 / width, 120 / height); // tiny windows grow, keeping their shape
    width = Math.round(width * grow);
    height = Math.round(height * grow);
    win.setContentSize(width, height);
    win.setAspectRatio(width / height);
    if (a && a.icon) {
      const img = nativeImage.createFromDataURL(a.icon);
      if (!img.isEmpty()) {
        win.setIcon(img);
        const ico = this._ico(a.id, img);
        // Own AppUserModelID → own taskbar button, with the Mac app's icon.
        if (ico && win.setAppDetails) win.setAppDetails({ appId: 'MacShare.MacApp.' + a.id, appIconPath: ico, appIconIndex: 0, relaunchDisplayName: a.name });
      }
    }
  }

  // A .ico that embeds the PNG (supported since Windows Vista), cached per app.
  _ico(id, img) {
    try {
      fs.mkdirSync(this.iconDir, { recursive: true });
      const file = path.join(this.iconDir, id.replace(/[^\w.-]/g, '_') + '.ico');
      if (fs.existsSync(file)) return file;
      const png = img.resize({ width: 64, height: 64 }).toPNG();
      const head = Buffer.alloc(22);
      head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(1, 4); // ICONDIR: 1 image
      head.writeUInt8(64, 6); head.writeUInt8(64, 7); head.writeUInt8(0, 8); head.writeUInt8(0, 9);
      head.writeUInt16LE(1, 10); head.writeUInt16LE(32, 12); head.writeUInt32LE(png.length, 14); head.writeUInt32LE(22, 18);
      fs.writeFileSync(file, Buffer.concat([head, png]));
      return file;
    } catch (_) { return ''; }
  }

  view() {
    return { list: this.list, loading: this.loading, message: this.message, open: this.windows.length };
  }
}

function validWindow(w) {
  const n = (v) => typeof v === 'number' && v >= 0 && v <= 1;
  return w && Number.isInteger(w.wid) && typeof w.id === 'string' && n(w.x) && n(w.y) && n(w.w) && n(w.h) && w.w > 0 && w.h > 0;
}

module.exports = Apps;
