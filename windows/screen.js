// MacShare — Copyright (C) 2026 MacShare contributors. GPL-3.0, see LICENSE.
// Screen sharing: stream state, the Monitor 2 window, and relaying stream.*/rtc.* between the
// link (main process) and the Monitor 2 renderer, which owns the RTCPeerConnection.
const { BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const P = require('../shared/protocol.js');

const T = P.T;
const FROM_RENDERER = new Set([T.RTC_ANSWER, T.RTC_ICE]);

class Screen {
  // opts: link, settings (shared object, .windows.monitor bounds), saveSettings(), onChange(), isQuitting()
  constructor(opts) {
    Object.assign(this, opts);
    this.state = { state: 'off', name: '', width: 0, height: 0 };
    this.win = null;
    this.ready = false; // renderer loaded and listening
    this.replay = []; // messages of the current session, for a renderer that (re)loads
    this.autoOpened = false; // opened once per connection on the first stream.info
    this.test = false;

    const link = this.link;
    link.on(T.STREAM_INFO, (m) => this._onInfo(m));
    link.on(T.RTC_OFFER, (m) => typeof m.sdp === 'string' && this._relay(m));
    link.on(T.RTC_ICE, (m) => this._relay(m));
    link.on(T.STREAM_STOP, () => this._stop());
    link.on('closed', () => {
      this.autoOpened = false;
      this._stop();
    });

    ipcMain.on('rtc', (e, m) => {
      if (!this.win || e.sender !== this.win.webContents || this.test) return;
      if (m && FROM_RENDERER.has(m.t)) this.link.send(m);
    });
    ipcMain.on('monitor-ready', (e) => {
      if (!this.win || e.sender !== this.win.webContents) return;
      this.ready = true;
      for (const m of this.replay) this._toRenderer(m);
    });
  }

  open(test) {
    this.test = !!test;
    if (!this.win || this.win.isDestroyed()) this._create();
    else if (!this.win.isVisible()) this.win.show();
    this.win.focus();
  }

  _onInfo(m) {
    const width = Number(m.width) || 0;
    const height = Number(m.height) || 0;
    this.state = { state: 'on', name: typeof m.name === 'string' ? m.name : 'Mac display', width, height };
    this.replay = []; // a fresh offer follows every stream.info
    this._relay({ t: T.STREAM_INFO, name: this.state.name, width, height });
    this._title();
    if (!this.autoOpened) {
      this.autoOpened = true;
      this.open(false);
    }
    this.onChange();
  }

  _stop() {
    if (this.state.state === 'off' && !this.replay.length) return;
    this.state = { state: 'off', name: '', width: 0, height: 0 };
    this.replay = [];
    this._toRenderer({ t: T.STREAM_STOP });
    this._title();
    this.onChange();
  }

  _relay(m) {
    this.replay.push(m);
    this._toRenderer(m);
  }

  _toRenderer(m) {
    if (this.ready && this.win && !this.win.isDestroyed()) this.win.webContents.send('rtc', m);
  }

  _title() {
    if (!this.win || this.win.isDestroyed()) return;
    const macName = this.link.snapshot().link.macName || 'Mac';
    const s = this.state;
    this.win.setTitle(s.state === 'on'
      ? 'Monitor 2 — ' + macName + ' (' + s.width + '×' + s.height + ')'
      : 'Monitor 2 — ' + macName);
  }

  _create() {
    const b = this.settings.windows.monitor || {};
    const aspect = this.state.width && this.state.height ? this.state.width / this.state.height : 16 / 9;
    const win = new BrowserWindow({
      width: b.width || 1280,
      height: b.height || Math.round(1280 / aspect),
      x: b.x,
      y: b.y,
      minWidth: 320,
      minHeight: 200,
      backgroundColor: '#000000',
      title: 'Monitor 2',
      icon: path.join(__dirname, 'assets', 'tray@2x.png'),
      show: false,
      webPreferences: {
        preload: path.join(__dirname, 'preload-monitor.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        backgroundThrottling: false, // keep decoding while covered or in the background
      },
    });
    this.win = win;
    this.ready = false;
    win.loadFile(path.join(__dirname, 'monitor.html'), { query: this.test ? { test: '1' } : {} });
    win.once('ready-to-show', () => win.show());
    win.on('page-title-updated', (e) => e.preventDefault());
    win.webContents.on('before-input-event', (e, input) => {
      if (input.key === 'F11' && input.type === 'keyDown') {
        win.setFullScreen(!win.isFullScreen());
        e.preventDefault();
      } else if (input.key === 'F9' && input.type === 'keyDown') {
        win.webContents.send('toggle-stats'); // video stats overlay (kept local, like F11)
        e.preventDefault();
      }
    });
    win.webContents.on('did-start-loading', () => { this.ready = false; });
    // Closing only hides it, so the peer connection survives and reopening is instant.
    win.on('close', (e) => {
      this._saveBounds();
      if (!this.isQuitting()) {
        e.preventDefault();
        if (win.isFullScreen()) win.setFullScreen(false);
        win.hide();
      }
    });
    win.on('closed', () => {
      if (this.win === win) this.win = null;
    });
    this._title();
  }

  _saveBounds() {
    const win = this.win;
    if (!win || win.isDestroyed() || win.isMinimized() || win.isFullScreen()) return;
    this.settings.windows.monitor = win.getNormalBounds();
    this.saveSettings();
  }
}

module.exports = Screen;
