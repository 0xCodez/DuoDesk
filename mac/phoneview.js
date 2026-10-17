// TwinDesk — Copyright (C) 2026 inukaasith. GPL-3.0, see LICENSE.
// The phone in windows on the Mac: its screen (mirror, with its sound), and phone apps each in a
// window of their own on a virtual display of the window's size (scrcpy new_display + flex, so
// resizing the window resizes the app). One scrcpy session per window (scrcpy.js); the window
// decodes the H.264 itself (phoneview-renderer.js) and sends touches, keys and scrolls back.
//
// Events: 'change' — the window list changed.
'use strict';

const path = require('path');
const { BrowserWindow, ipcMain, screen } = require('electron');
const { EventEmitter } = require('events');
const P = require('../shared/protocol.js');
const { Session, ACTION, TYPE } = require('./scrcpy');
const { KeyState, ANDROID } = require('./android-keys');

let nextId = 1;

class PhoneViews extends EventEmitter {
  constructor({ bridge, phone, getSettings, server, fileSend }) {
    super();
    Object.assign(this, { bridge, phone, getSettings, server, fileSend });
    this.views = new Map(); // id -> {id, kind, app, title, win, session, keys, size}
    bridge.views = this;
    ipcMain.on('phoneview:in', (e, m) => {
      const v = [...this.views.values()].find((x) => x.win && !x.win.isDestroyed() && x.win.webContents === e.sender);
      if (v && m && typeof m === 'object') this._input(v, m);
    });
    // Files dropped on a phone window go to the phone (its Downloads).
    ipcMain.on('phoneview:drop', (e, paths) => {
      if (!Array.isArray(paths) || !paths.length || !this.server.current) return;
      const b = this.fileSend.sendBatch(paths.filter((p) => typeof p === 'string' && p.startsWith('/')).slice(0, 1000), 'send');
      if (b) this.bridge.emit('popup', 'away', `Sending ${b.name} to ${this.server.current.name}`);
    });
  }

  // The phone's sound on its own (no screen window): an audio-only session in a hidden window.
  sound(on) {
    const open = [...this.views.values()].find((v) => v.kind === 'sound');
    if (on && !open && this.bridge.serial) {
      this._open({ kind: 'sound', title: 'Phone sound', width: 200, height: 100, hidden: true, opts: { video: false, audio: true, control: false, audioSource: 'output' } });
    } else if (!on && open) this.close(open.id);
  }

  list() {
    return [...this.views.values()].filter((v) => v.kind !== 'sound').map((v) => ({ id: v.id, kind: v.kind, app: v.app || null, title: v.title }));
  }

  get focused() {
    return [...this.views.values()].some((v) => v.win && !v.win.isDestroyed() && v.win.isFocused());
  }

  openScreen() {
    const open = [...this.views.values()].find((v) => v.kind === 'screen');
    if (open) return open.win.show(), open.win.focus();
    const info = this.phone.info || {};
    const d = info.display || { w: 1080, h: 2400 };
    const work = screen.getPrimaryDisplay().workAreaSize;
    const h = Math.min(860, work.height - 80);
    const w = Math.round(h * Math.min(d.w, d.h) / Math.max(d.w, d.h));
    const name = (this.server.current && this.server.current.name) || 'Phone';
    this._open({ kind: 'screen', title: name, width: w, height: h, opts: this.bridge.sessionOpts('screen') });
  }

  openApp(pkg, name) {
    const open = [...this.views.values()].find((v) => v.kind === 'app' && v.app === pkg);
    if (open) return open.win.show(), open.win.focus();
    const w = 412;
    const h = 860;
    const scale = screen.getPrimaryDisplay().scaleFactor || 2;
    // 1 dp = 1 point on the Mac: the app's text is as big as the Mac's.
    const newDisplay = `${Math.round(w * scale)}x${Math.round((h - 32) * scale)}/${Math.round(160 * scale)}`;
    this._open({ kind: 'app', app: pkg, title: name || pkg, width: w, height: h, opts: this.bridge.sessionOpts('app', { newDisplay }) });
  }

  close(id) {
    const v = this.views.get(id);
    if (v && v.win && !v.win.isDestroyed()) v.win.close();
  }

  closeAll() {
    for (const v of [...this.views.values()]) this.close(v.id);
  }

  get screenWithSound() {
    return [...this.views.values()].some((v) => v.kind === 'screen' && v.session && v.session.opts.audio);
  }

  _open({ kind, app, title, width, height, opts, hidden = false }) {
    if (!this.bridge.serial) return this.bridge.emit('popup', 'home', 'Set up wireless debugging on the Phone page first');
    const id = nextId++;
    const win = new BrowserWindow({
      width, height, minWidth: 220, minHeight: 300, title, show: false,
      titleBarStyle: 'hiddenInset', backgroundColor: '#000000',
      webPreferences: { preload: path.join(__dirname, 'preload-phoneview.js'), contextIsolation: true, nodeIntegration: false, backgroundThrottling: false },
    });
    const v = { id, kind, app, title, win, session: null, keys: new KeyState(), size: null, ready: false, queue: [] };
    this.views.set(id, v);
    win.loadFile(path.join(__dirname, 'phoneview.html'), { query: { kind, title } });
    if (!hidden) win.once('ready-to-show', () => win.show());
    win.webContents.once('did-finish-load', () => {
      v.ready = true;
      for (const [ch, m] of v.queue.splice(0)) win.webContents.send(ch, m);
    });
    win.on('closed', () => {
      if (v.session) v.session.stop();
      this.views.delete(id);
      this.emit('change');
    });
    this.emit('change');
    this._start(v, opts).catch((e) => {
      console.log(`[phone] ${kind} window: ${e.message}`);
      this._send(v, 'phoneview:status', { error: e.message });
    });
  }

  _send(v, ch, m) {
    if (!v.win || v.win.isDestroyed()) return;
    if (!v.ready) return v.queue.push([ch, m]);
    v.win.webContents.send(ch, m);
  }

  async _start(v, opts) {
    const s = new Session(this.bridge.adb, this.bridge.serial, opts);
    v.session = s;
    s.on('size', (size) => {
      v.size = size;
      this._send(v, 'phoneview:size', size);
      if (v.kind === 'screen' && v.win && !v.win.isDestroyed()) v.win.setAspectRatio(size.width / size.height);
    });
    s.on('video', (p) => this._send(v, 'phoneview:video', p));
    s.on('audio', (p) => !p.config && this._send(v, 'phoneview:audio', p.data));
    s.on('closed', (why) => this._send(v, 'phoneview:status', { closed: why }));
    await s.start();
    if (v.app) setTimeout(() => s.startApp(v.app), 300);
    this._send(v, 'phoneview:status', { ready: true });
  }

  _input(v, m) {
    const s = v.session;
    const size = v.size;
    if (!s || s.closed) return;
    const num = (x) => (Number.isFinite(x) ? x : 0);
    switch (m.t) {
      case 'touch': // a finger (pointer ≥ 0) or the mouse (-1) at video coordinates
        if (!size) return;
        s.touch(m.action | 0, Math.max(-3, Math.min(9, m.pointer | 0)), num(m.x), num(m.y), size.width, size.height,
          m.action === ACTION.UP ? 0 : 1, m.actionButton | 0, m.buttons | 0);
        break;
      case 'scroll':
        if (!size) return;
        s.scroll(num(m.x), num(m.y), size.width, size.height, num(m.hs), num(m.vs), 0);
        break;
      case 'key': {
        if (typeof m.code !== 'string') return;
        const swap = P.keySwapNeeded(P.OS.MAC, P.OS.ANDROID) && this.getSettings().keys.swapCtrlCmd !== false;
        const e = v.keys.event(swap ? P.mapKeyFromOtherPlatform(m.code) : m.code, !!m.down);
        if (e) s.key(m.down ? ACTION.DOWN : ACTION.UP, e.keycode, e.meta, m.repeat ? 1 : 0);
        break;
      }
      case 'nav': {
        const k = { back: ANDROID.BACK, home: ANDROID.HOME, recents: ANDROID.APP_SWITCH, power: ANDROID.POWER }[m.key];
        if (m.key === 'back') { s.backOrScreenOn(ACTION.DOWN); s.backOrScreenOn(ACTION.UP); } else if (k) s.tap(k);
        if (m.key === 'notifications') s.simple(TYPE.EXPAND_NOTIFICATIONS);
        if (m.key === 'rotate') s.simple(TYPE.ROTATE);
        break;
      }
      case 'resize': // an app window changed size: its virtual display follows (flex)
        if (v.kind === 'app' && m.w > 50 && m.h > 50) s.resizeDisplay(Math.round(m.w), Math.round(m.h));
        break;
      default: break;
    }
  }

  shutdown() {
    this.closeAll();
  }
}

module.exports = { PhoneViews };
