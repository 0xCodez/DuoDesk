// MacShare — Copyright (C) 2026 MacShare contributors. GPL-3.0, see LICENSE.
// Phase 11, Display › PC → Mac (docs/ROADMAP.md): this PC's screen in a window on the Mac.
// Mirror = one existing monitor; Extend = the virtual monitor (vdd.js). Sharing starts off every
// time the app starts. We offer an `rtc2` session (kind `screen` / `screen+audio`) while sharing is
// on and the Mac's `screen.policy` accepts; `in.*` from the Mac are injected by the helper.
const { BrowserWindow, ipcMain, desktopCapturer, screen: displays } = require('electron');
const path = require('path');
const P = require('../shared/protocol.js');

const T = P.T;
const POINTER = new Set([T.IN_MOVE, T.IN_DOWN, T.IN_UP]);

class PcScreen {
  // opts: link, helper, vdd, settings (shared), inputAllowed() (KVM at home), onChange()
  constructor(opts) {
    Object.assign(this, opts);
    this.mode = 'off'; // 'off' | 'mirror' | 'extend' — never saved
    this.mac = { accept: false, width: 0, height: 0 }; // the Mac's screen.policy
    this.win = null;
    this.ready = false;
    this.queue = [];
    this.session = 0;
    this.sending = null; // {session, displayId, rect (physical px), key}
    this.status = { status: 'off', error: '', name: '', width: 0, height: 0 };
    this.injected = false; // keys/buttons may be held down by the Mac
    this.busy = false;

    const link = this.link;
    link.on('welcome', () => { this.mac.accept = false; this.apply(); });
    link.on('closed', () => { this.mac.accept = false; this.apply(); });
    link.on(T.SCREEN_POLICY, (m) => {
      const n = (v) => (Number.isInteger(v) && v >= 320 && v <= 7680 ? v : 0);
      const size = this.mac.width + 'x' + this.mac.height;
      this.mac = { accept: m.accept === true, width: n(m.width), height: n(m.height) };
      if (this.mode === 'extend' && this.cfg.extendSize === 'mac' && size !== this.mac.width + 'x' + this.mac.height) this.sizeExtend();
      else this.apply();
    });
    link.on(T.RTC2_ANSWER, (m) => this.sending && m.session === this.sending.session && typeof m.sdp === 'string' && this._toWin(m));
    link.on(T.RTC2_ICE, (m) => this.sending && m.session === this.sending.session && this._toWin(m));
    for (const t of [T.IN_MOVE, T.IN_DOWN, T.IN_UP, T.IN_WHEEL, T.IN_KEY_DOWN, T.IN_KEY_UP]) link.on(t, (m) => this._input(m));

    ipcMain.on('pcscreen-out', (e, m) => {
      if (!this._fromWin(e) || !m || !this.sending || m.session !== this.sending.session) return;
      if (m.t === T.RTC2_OFFER || m.t === T.RTC2_ICE) this.link.send(m);
    });
    ipcMain.on('pcscreen-state', (e, s) => {
      if (!this._fromWin(e) || !s || !this.sending || s.session !== this.sending.session) return;
      this.status.status = String(s.status || '');
      this.status.error = String(s.error || '');
      if (s.status === 'ended' || s.status === 'failed') this._stopSend(true); // apply() retries on the next change
      this.onChange();
    });
    ipcMain.on('pcscreen-stats', (e, st) => {
      if (!this._fromWin(e) || !st || !this.sending || st.session !== this.sending.session) return;
      this.stats = st;
      this.onChange();
    });
    ipcMain.on('pcscreen-ready', (e) => {
      if (!this._fromWin(e)) return;
      this.ready = true;
      for (const m of this.queue.splice(0)) this.win.webContents.send('pcscreen', m);
    });
    // A monitor came or went (or changed size): the shared one may be different now.
    for (const ev of ['display-added', 'display-removed', 'display-metrics-changed']) displays.on(ev, () => this.apply());
  }

  get cfg() {
    return this.settings.pcScreen;
  }

  async setMode(mode) {
    if (!['off', 'mirror', 'extend'].includes(mode) || this.busy) return;
    const was = this.mode;
    this.mode = mode;
    this.status.error = '';
    this.onChange();
    if (mode === 'extend' && was !== 'extend') {
      this.busy = true;
      this.onChange();
      try {
        const [w, h] = this._extendSize();
        this.vdd.addMode(w, h);
        const mon = await this.vdd.setOn(true);
        if (mon && mon.name) await this.vdd.setMode(mon, w, h);
        if (!mon) this.mode = 'off';
      } finally {
        this.busy = false;
      }
    } else if (was === 'extend' && mode !== 'extend') {
      this._stopSend(true);
      this.vdd.setOn(false);
    }
    this.apply();
  }

  // The virtual monitor's size: chosen, or what the Mac asks for (else 1920 × 1080).
  _extendSize() {
    const m = /^(\d+)x(\d+)$/.exec(this.cfg.extendSize);
    if (m) return [Number(m[1]), Number(m[2])];
    return this.mac.width ? [this.mac.width, this.mac.height] : [1920, 1080];
  }

  // Extend size changed while Extend is on: a size the driver doesn't know yet needs a device restart.
  async sizeExtend() {
    if (this.mode !== 'extend' || this.busy) return this.apply();
    this.busy = true;
    this.onChange();
    try {
      const [w, h] = this._extendSize();
      if (this.vdd.addMode(w, h)) {
        this._stopSend(true);
        await this.vdd.setOn(false);
        await this.vdd.setOn(true);
      }
      const mon = await this.vdd.find().catch(() => null);
      if (mon) await this.vdd.setMode(mon, w, h);
    } finally {
      this.busy = false;
    }
    this.apply();
  }

  // Stream size: scale down (on the GPU, by the capturer) to at most maxHeight, keeping the shape.
  _streamSize(rect) {
    const max = this.cfg.maxHeight;
    if (!max || rect.height <= max) return [rect.width, rect.height];
    return [Math.round((rect.width * max) / rect.height / 2) * 2, max];
  }

  // The display to share: Extend → the virtual monitor; Mirror → the chosen one (else the main one).
  async _target() {
    const all = displays.getAllDisplays();
    if (this.mode === 'extend') {
      const mon = await this.vdd.find().catch(() => null);
      if (!mon) return null;
      return all.find((d) => { const r = displays.dipToScreenRect(null, d.bounds); return r.x === mon.x && r.y === mon.y; }) || null;
    }
    return all.find((d) => String(d.id) === this.cfg.monitor) || displays.getPrimaryDisplay();
  }

  // After welcome, a policy, a settings or display change.
  async apply() {
    if (this.applying) { this.again = true; return; }
    this.applying = true;
    try {
      do {
        this.again = false;
        await this._applyOnce();
      } while (this.again);
    } finally {
      this.applying = false;
    }
    this.onChange();
  }

  async _applyOnce() {
    const connected = this.link.status.state === 'connected';
    const want = connected && this.mode !== 'off' && !this.busy && this.mac.accept;
    if (!want) return this._stopSend(connected);
    const d = await this._target();
    if (!d) return this._stopSend(true);
    const rect = displays.dipToScreenRect(null, d.bounds);
    const [width, height] = this._streamSize(rect);
    const key = [d.id, rect.x, rect.y, rect.width, rect.height, width, this.cfg.mbps, this.cfg.sound].join(',');
    if (this.sending && this.sending.key === key) return;
    const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: 0, height: 0 } });
    const src = sources.find((s) => s.display_id === String(d.id));
    if (!src) {
      this.status.error = 'Windows didn’t offer that monitor for capture';
      return this._stopSend(true);
    }
    this._stopSend(true);
    this.sending = { session: ++this.session, displayId: d.id, rect, key };
    this.stats = null;
    Object.assign(this.status, { status: 'starting', error: '', name: d.label || src.name, width: rect.width, height: rect.height });
    this._toWin({ t: 'start', session: this.sending.session, sourceId: src.id, width, height, mbps: this.cfg.mbps, audio: this.cfg.sound });
  }

  _stopSend(tellMac) {
    this._release();
    if (!this.sending) return;
    const { session } = this.sending;
    this.sending = null;
    this.stats = null;
    this.status.status = 'off';
    this._toWin({ t: 'stop' });
    if (tellMac && this.link.status.state === 'connected') this.link.send({ t: T.RTC2_STOP, session });
  }

  // in.* from the Mac's PC window: coordinates are normalized over the shared monitor.
  _input(m) {
    if (!this.sending || !this.cfg.input || !this.inputAllowed()) return;
    const ev = (e) => this.helper.send('inject', { ev: e });
    if (POINTER.has(m.t)) {
      const x = Number(m.x), y = Number(m.y);
      if (Number.isFinite(x) && Number.isFinite(y)) {
        const r = this.sending.rect;
        const c = (v) => Math.min(1, Math.max(0, v));
        this.helper.send('moveTo', { x: Math.round(r.x + c(x) * (r.width - 1)), y: Math.round(r.y + c(y) * (r.height - 1)) });
      }
      if (m.t !== T.IN_MOVE && Number.isInteger(m.b)) {
        ev({ t: m.t === T.IN_DOWN ? T.K_DOWN : T.K_UP, b: m.b });
        this.injected = true;
      }
    } else if (m.t === T.IN_WHEEL) {
      ev({ t: T.K_WHEEL, dx: Number(m.dx) || 0, dy: Number(m.dy) || 0, mode: 'pixel' });
    } else if (typeof m.code === 'string') {
      const code = this.settings.keys.swapCtrlCmd ? P.mapKeyFromOtherPlatform(m.code) : m.code;
      ev({ t: m.t === T.IN_KEY_DOWN ? T.K_KEY_DOWN : T.K_KEY_UP, code });
      this.injected = true;
    }
  }

  // Let go of anything the Mac still holds (session ended, input switched off).
  _release() {
    if (!this.injected) return;
    this.injected = false;
    if (this.inputAllowed()) this.helper.send('releaseAll');
  }

  applyInput() {
    if (!this.cfg.input) this._release();
  }

  _fromWin(e) {
    return this.win && !this.win.isDestroyed() && e.sender === this.win.webContents;
  }

  _toWin(m) {
    if (!this.win || this.win.isDestroyed()) {
      if (m.t !== 'start') return; // nothing to stop
      this._create();
    }
    if (this.ready) this.win.webContents.send('pcscreen', m);
    else this.queue.push(m);
  }

  _create() {
    this.ready = false;
    this.queue = [];
    this.win = new BrowserWindow({
      show: false,
      webPreferences: {
        preload: path.join(__dirname, 'preload-pcscreen.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        backgroundThrottling: false,
      },
    });
    this.win.loadFile(path.join(__dirname, 'pcscreen.html'));
    this.win.on('closed', () => { this.win = null; this.ready = false; });
  }

  // Monitors for the Mirror picker.
  monitors() {
    const primary = displays.getPrimaryDisplay().id;
    const v = this.vdd.state.on && this.vdd.mon; // the virtual monitor is Extend's, not Mirror's
    return displays.getAllDisplays()
      .map((d) => ({ d, r: displays.dipToScreenRect(null, d.bounds) }))
      .filter(({ r }) => !(v && r.x === v.x && r.y === v.y))
      .map(({ d, r }) => {
        return { id: String(d.id), label: (d.label || 'Monitor') + ' — ' + r.width + ' × ' + r.height + (d.id === primary ? ' (main)' : '') };
      });
  }

  // Sharing ends with the app; the virtual monitor too.
  shutdown() {
    this._stopSend(true);
    if (this.mode === 'extend') this.vdd.setOn(false);
  }

  view() {
    return { ...this.cfg, mode: this.mode, busy: this.busy, mac: this.mac, ...this.status, stats: this.stats || null, extendPx: this._extendSize(), sending: !!this.sending, monitors: this.monitors(), vdd: this.vdd.view() };
  }
}

module.exports = PcScreen;
