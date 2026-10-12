// MacShare — Copyright (C) 2026 MacShare contributors. GPL-3.0, see LICENSE.
// Shared cursor and keyboard: the docs/KVM.md state machine, Windows side, both roles
// (rows 1–6 + 9: this PC drives the Mac; rows 7–8c + 9b: the Mac drives this PC).
const fs = require('fs');
const P = require('../shared/protocol.js');

const T = P.T;
const K_TYPES = new Set([T.K_MOVE, T.K_DOWN, T.K_UP, T.K_WHEEL, T.K_KEY_DOWN, T.K_KEY_UP]);

class Kvm {
  // opts: link, helper, clip, fileDrop, fileRecv, settings (shared object), onChange()
  constructor(opts) {
    Object.assign(this, opts);
    this.mode = 'home'; // 'home' | 'driving' | 'driven'
    this.route = 0;
    this.peerRoute = 0;
    this.pcSide = null; // from kvm.layout: where the PC is, seen from the Mac
    this.message = '';
    this.acceptTimer = null;
    this.keepalive = null;
    this.silence = null;
    this.dragPending = false; // we crossed with a file drag; cleared when our left button comes up

    const link = this.link;
    link.on(T.KVM_LAYOUT, (m) => {
      if (!P.SIDES.includes(m.pcSide)) return;
      this.pcSide = m.pcSide;
      this.applyConfig();
      this.onChange();
    });
    link.on(T.KVM_TAKE, (m) => this._onTake(m));
    link.on(T.KVM_ACCEPT, (m) => {
      if (this.mode === 'driving' && m.route === this.route) this._clearAccept();
    });
    link.on(T.KVM_REFUSE, (m) => {
      if (this.mode !== 'driving' || m.route !== this.route) return;
      this._goHome(m.why === P.REFUSE.BUSY ? 'The Mac is driving this PC' : m.why === P.REFUSE.NOT_ALLOWED ? "The Mac doesn't accept input from this PC" : 'The Mac refused');
    });
    link.on(T.KVM_RELEASE, (m) => {
      if (this.mode === 'driven' && m.route >= this.peerRoute) this._drivenHome('The Mac took its input back', false);
    });
    link.on(T.KVM_HOME, (m) => {
      if (this.mode !== 'driving' || m.route !== this.route) return;
      const has = typeof m.offset === 'number';
      this.helper.send('capture', has ? { on: false, side: this.crossingSide, offset: m.offset } : { on: false });
      this._setMode('home', '');
    });
    for (const t of K_TYPES) link.on(t, (m) => this._inject(m));
    link.on('welcome', () => this.applyConfig());
    link.on('closed', () => {
      this._linkLost('The Mac disconnected');
      this.pcSide = null;
      this.applyConfig();
    });

    const helper = this.helper;
    helper.on('ready', () => {
      this.applyConfig();
      // A restarted helper has lost its state: nothing is captured or armed any more.
      if (this.mode === 'driving') this._release('MacShare’s helper restarted');
      else if (this.mode === 'driven') this._drivenHome('MacShare’s helper restarted', true);
    });
    helper.on('event', (name, msg) => this._onHelper(name, msg));
  }

  // Side of this PC that faces the Mac.
  get crossingSide() {
    return this.pcSide ? P.opposite(this.pcSide) : null;
  }

  get cfg() {
    return this.settings.kvm;
  }

  get connected() {
    return this.link.status.state === 'connected';
  }

  // Tell the helper where the edge is and whether to watch it (docs/KVM.md switches).
  applyConfig() {
    const k = this.cfg;
    this.helper.send('kvmConfig', {
      side: this.crossingSide,
      resistancePx: k.resistancePx,
      hotkey: P.HOTKEY_WIN,
      driveOther: !!(k.driveOther && k.mouse && this.connected && this.crossingSide),
      keyboard: !!k.keyboard,
      deadmanMs: P.HELPER_DEADMAN_MS,
      doubleTapMs: P.DOUBLE_TAP_MS,
    });
  }

  view() {
    return { mode: this.mode, message: this.message, pcSide: this.pcSide, helper: this.helper.running ? '' : this.helper.error || 'starting' };
  }

  // ---- owner (this PC drives the Mac) ----

  _canDrive() {
    const k = this.cfg;
    return this.connected && k.driveOther && (k.mouse || k.keyboard);
  }

  _onHelper(name, msg) {
    switch (name) {
      case 'edge': // row 1 — the helper is already capturing
        if (this.mode !== 'home' || !this._canDrive() || !this.cfg.mouse || !this.crossingSide) {
          this.helper.send('capture', { on: false });
          return;
        }
        {
          const paths = msg.drag && Array.isArray(msg.drag.paths) && this.settings.files.dropToMac ? msg.drag.paths.filter(isFile) : []; // folders aren't sent (iteration later)
          this._take({ side: P.opposite(this.crossingSide), offset: msg.offset, ...(paths.length ? { drag: { count: paths.length } } : {}) });
          if (paths.length) { // the files follow; the Mac places them where its pointer is on release
            this.dragPending = true;
            this.fileDrop.drop(paths, null, null, true);
          }
        }
        break;
      case 'hotkey':
        if (this.mode === 'home') { // row 2
          if (!this._canDrive()) {
            if (this.connected && !this.cfg.driveOther) this._note('Using this PC’s keyboard and mouse on the Mac is off');
            return;
          }
          this.helper.send('capture', { on: true, mouse: !!this.cfg.mouse, keyboard: !!this.cfg.keyboard });
          this._take({});
        } else if (this.mode === 'driving') { // row 5 — the helper already stopped capturing
          this._release('');
        } else { // row 8c via hotkey
          this._sendHome(undefined);
        }
        break;
      case 'return': // row 8c
        if (this.mode === 'driven') this._sendHome(msg.offset);
        break;
      case 'ev':
        if (this.mode === 'driving' && msg.ev && K_TYPES.has(msg.ev.t)) {
          this.link.send(msg.ev);
          if (msg.ev.t === T.K_UP && msg.ev.b === P.BUTTON.LEFT) this.dragPending = false; // released on the Mac
        }
        break;
      case 'captureEnded': // dead-man or a local stop: input is back here
        if (this.mode === 'driving') this._release(msg.reason === 'deadman' ? 'Input came back (safety timer)' : '');
        break;
    }
  }

  _take(where) {
    this.route++;
    const k = this.cfg;
    this.link.send({ t: T.KVM_TAKE, route: this.route, ...where, mouse: !!k.mouse, keyboard: !!k.keyboard });
    this._setMode('driving', '');
    this.clip.sendIfChanged('switch');
    this._clearAccept();
    const route = this.route;
    this.acceptTimer = setTimeout(() => {
      if (this.mode === 'driving' && this.route === route) this._goHome("The Mac didn't answer");
    }, P.KVM_TAKE_TIMEOUT_MS);
  }

  // Row 5: our input goes home by our own choice.
  _release(message) {
    this.route++;
    this.link.send({ t: T.KVM_RELEASE, route: this.route });
    this.helper.send('capture', { on: false });
    this._setMode('home', message);
  }

  // Row 9.
  _goHome(message) {
    this.helper.send('capture', { on: false });
    this._setMode('home', message);
  }

  _clearAccept() {
    clearTimeout(this.acceptTimer);
    this.acceptTimer = null;
  }

  // ---- driven (the Mac drives this PC) ----

  _onTake(m) {
    const route = Number(m.route) || 0;
    if (this.mode === 'driving') { // row 7b
      this.link.send({ t: T.KVM_REFUSE, route, why: P.REFUSE.BUSY });
      return;
    }
    if (this.mode === 'driven') { // row 7c
      if (route <= this.peerRoute) return;
      this.peerRoute = route;
      this.link.send({ t: T.KVM_ACCEPT, route });
      if (m.side && m.mouse !== false) this.helper.send('place', { side: m.side, offset: m.offset });
      return;
    }
    if (!this.cfg.beDriven) { // row 7
      this.link.send({ t: T.KVM_REFUSE, route, why: P.REFUSE.NOT_ALLOWED });
      this._note('The Mac tried to take over this PC (turned off here)');
      return;
    }
    this.peerRoute = route;
    this.link.send({ t: T.KVM_ACCEPT, route });
    this._setMode('driven', '');
    if (m.mouse !== false) {
      this.helper.send('place', P.SIDES.includes(m.side) ? { side: m.side, offset: Number(m.offset) || 0 } : { center: true });
      if (this.crossingSide) this.helper.send('armReturn', { on: true, side: this.crossingSide, resistancePx: this.cfg.resistancePx });
    }
  }

  // Row 8.
  _inject(m) {
    if (this.mode !== 'driven') return;
    const k = this.cfg;
    const ev = { ...m };
    if (ev.t === T.K_KEY_DOWN || ev.t === T.K_KEY_UP) {
      if (typeof ev.code !== 'string') return;
      if (this.settings.keys.swapCtrlCmd) ev.code = P.mapKeyFromOtherPlatform(ev.code);
    } else if (ev.t === T.K_MOVE) {
      ev.dx = (Number(ev.dx) || 0) * k.speed;
      ev.dy = (Number(ev.dy) || 0) * k.speed;
    } else if (ev.t === T.K_WHEEL && k.reverseScroll) {
      ev.dx = -(Number(ev.dx) || 0);
      ev.dy = -(Number(ev.dy) || 0);
    }
    this.helper.send('inject', { ev });
    // The Mac released its left button here: files it dragged across land under the pointer.
    if (ev.t === T.K_UP && ev.b === P.BUTTON.LEFT) this.fileRecv.onRelease();
  }

  // Row 8c: we send the input home (return edge or hotkey).
  _sendHome(offset) {
    this.link.send(typeof offset === 'number' ? { t: T.KVM_HOME, route: this.peerRoute, offset } : { t: T.KVM_HOME, route: this.peerRoute });
    this._drivenHome('', true);
  }

  // Rows 8b, 8c, 9b.
  _drivenHome(message, sendClip) {
    this.helper.send('releaseAll');
    this.helper.send('armReturn', { on: false });
    this._setMode('home', message);
    if (sendClip) this.clip.sendIfChanged('switch');
  }

  _linkLost(message) {
    if (this.mode === 'driving') this._goHome(message);
    else if (this.mode === 'driven') {
      this.helper.send('releaseAll');
      this.helper.send('armReturn', { on: false });
      this._setMode('home', message);
    }
  }

  // ---- shared ----

  _setMode(mode, message) {
    const was = this.mode;
    this.mode = mode;
    if (mode === 'home' && this.dragPending) { // went home before releasing: the files don't go
      this.dragPending = false;
      this.fileDrop.cancelRelease();
    }
    this.message = message || '';
    if (mode === 'driving' && was !== 'driving') {
      clearInterval(this.keepalive);
      this.keepalive = setInterval(() => this.helper.send('keepalive'), P.HELPER_KEEPALIVE_MS);
    } else if (mode !== 'driving') {
      clearInterval(this.keepalive);
      this.keepalive = null;
      this._clearAccept();
    }
    // Silence watch while input is shared (rows 9, 9b).
    clearInterval(this.silence);
    this.silence = null;
    if (mode !== 'home') {
      this.silence = setInterval(() => {
        if (Date.now() - (this.link.lastRx || 0) > P.KVM_SILENCE_MS) this._linkLost('The Mac stopped answering');
      }, 250);
    }
    this.onChange();
  }

  _note(message) {
    this.message = message;
    this.onChange();
  }

  shutdown() {
    if (this.mode === 'driving') this._release('');
    else if (this.mode === 'driven') this._drivenHome('', false);
    this.helper.stop();
  }
}

function isFile(p) {
  try { return typeof p === 'string' && fs.statSync(p).isFile(); } catch (_) { return false; }
}

module.exports = Kvm;
