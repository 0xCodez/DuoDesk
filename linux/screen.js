// MacShare — Copyright (C) 2026 MacShare contributors. GPL-3.0, see LICENSE.
// Screen sharing (copied from windows/screen.js): stream state, the Monitor 2 window, and relaying stream.*/rtc.* between the
// link (main process) and the Monitor 2 renderer, which owns the RTCPeerConnection.
const { BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const P = require('../shared/protocol.js');

const T = P.T;
const FROM_RENDERER = new Set([T.RTC_ANSWER, T.RTC_ICE]);
const INPUT = new Set([T.IN_MOVE, T.IN_DOWN, T.IN_UP, T.IN_WHEEL, T.IN_KEY_DOWN, T.IN_KEY_UP]);

class Screen {
  // opts: link, clip, settings (shared object, .windows.monitor bounds), saveSettings(), onChange(),
  // isQuitting(), inputAllowed() (false while KVM drives or is driven, phases 4–5)
  constructor(opts) {
    Object.assign(this, opts);
    this.state = { state: 'off', name: '', width: 0, height: 0 };
    this.win = null;
    this.ready = false; // renderer loaded and listening
    this.replay = []; // messages of the current session, for a renderer that (re)loads
    this.autoOpened = false; // opened once per connection on the first stream.info
    this.test = false;
    this.macInput = true; // the Mac's "Receive input" switch (stream.input); assumed on until told

    const link = this.link;
    link.on(T.STREAM_INFO, (m) => this._onInfo(m));
    link.on(T.RTC_OFFER, (m) => typeof m.sdp === 'string' && this._relay(m));
    link.on(T.RTC_ICE, (m) => this._relay(m));
    link.on(T.STREAM_STOP, () => this._stop());
    link.on(T.STREAM_INPUT, (m) => this._setMacInput(m.on !== false));
    link.on('closed', () => {
      this.autoOpened = false;
      this._stop();
      this._setMacInput(true); // the Mac re-sends it after welcome
    });

    ipcMain.on('rtc', (e, m) => {
      if (!this.win || e.sender !== this.win.webContents || this.test) return;
      if (!m) return;
      if (FROM_RENDERER.has(m.t)) this.link.send(m);
      else if (INPUT.has(m.t) && this.state.state === 'on' && this.macInput && this.inputAllowed()) this.link.send(m);
    });
    ipcMain.on('monitor-ready', (e) => {
      if (!this.win || e.sender !== this.win.webContents) return;
      this.ready = true;
      this._pushInput();
      this._pushAudio();
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
    // audio: the Mac's "Share sound with the screen" (revision 2) — only then is there a sound track.
    this.state = { state: 'on', name: typeof m.name === 'string' ? m.name : 'Mac display', width, height, audio: m.audio === true };
    this.replay = []; // a fresh offer follows every stream.info
    this._relay({ t: T.STREAM_INFO, name: this.state.name, width, height, audio: this.state.audio });
    this._title();
    if (this.win && !this.win.isDestroyed()) this.win.streamSize = { width, height };
    if (!this.autoOpened && this.settings.monitor.autoOpen) {
      this.autoOpened = true;
      this.open(false);
    }
    this.onChange();
  }

  // Screen sound (revision 2): played only when the Mac shares it with the screen; local volume.
  applyAudio() {
    this._pushAudio();
  }

  _pushAudio() {
    const m = this.settings.monitor;
    if (this.ready && this.win && !this.win.isDestroyed()) this.win.webContents.send('audio', { on: !m.mute, volume: m.volume });
  }

  // Input allowed changed elsewhere (KVM mode): tell the renderer.
  refreshInput() {
    this._pushInput();
  }

  _setMacInput(on) {
    if (on === this.macInput) return;
    this.macInput = on;
    this._pushInput();
    this.onChange();
  }

  // Tell the renderer whether to capture input at all (off = no listeners work, normal cursor).
  _pushInput() {
    if (this.ready && this.win && !this.win.isDestroyed()) {
      this.win.webContents.send('input-enabled', this.test || (this.macInput && this.inputAllowed()));
    }
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
      ? macName + ' (' + s.width + ' × ' + s.height + ')'
      : macName);
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
        autoplayPolicy: 'no-user-gesture-required', // the Mac's sound plays without a click
      },
    });
    this.win = win;
    this.ready = false;
    win.streamSize = { width: this.state.width || 1920, height: this.state.height || 1080 };
    win.loadFile(path.join(__dirname, 'monitor.html'), { query: this.test ? { test: '1' } : {} });
    win.once('ready-to-show', () => win.show());
    win.on('page-title-updated', (e) => e.preventDefault());
    // Clipboard follows the focus: our text goes over on focus, the Mac's comes back on blur.
    win.on('focus', () => { if (!this.test && this.state.state === 'on') this.clip.sendIfChanged(); });
    win.on('blur', () => { if (!this.test && this.state.state === 'on') this.clip.request(); });
    win.webContents.on('before-input-event', (e, input) => {
      // F11 fullscreen and F9 stats stay local: both key down and up are kept from the page,
      // so they are never sent to the Mac.
      if (input.key !== 'F11' && input.key !== 'F9') return;
      e.preventDefault();
      if (input.type !== 'keyDown' || input.isAutoRepeat) return;
      if (input.key === 'F11') win.setFullScreen(!win.isFullScreen());
      else win.webContents.send('toggle-stats');
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
