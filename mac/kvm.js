// MacShare — Copyright (C) 2026 MacShare contributors. GPL-3.0, see LICENSE.
// Shared cursor + keyboard (docs/KVM.md): the state machine for both roles.
//   driving: this Mac's input goes to the PC (owner, rows 1–6, 9)
//   driven:  the PC's input drives this Mac (rows 7–9b)
// Ownership model adapted from Beamer's WIRE.md sections 4–5.
//
// Events: 'change' — this.view changed.
'use strict';

const { EventEmitter } = require('events');
const P = require('../shared/protocol.js');

const REFUSED = { busy: 'The PC is driving this Mac right now', not_allowed: 'The PC doesn’t accept input from this Mac' };

class Kvm extends EventEmitter {
  constructor({ server, helper, getSettings, clipboard, input, drop, fileSend }) {
    super();
    Object.assign(this, { server, helper, getSettings, clipboard, input, drop, fileSend });
    this.dragOut = false; // our file drag is on the PC and not yet released
    this.mode = 'home';
    this.route = 0;
    this.peerRoute = 0;
    this.message = '';
    this.tapError = null;
    this.acceptTimer = null;
    this.pendingMove = null; // coalesced k.mm while driving

    setInterval(() => this._tick(), 250);
    server.on('client', () => {
      this._sendLayout();
      this.config();
    });
    server.on('closed', () => {
      if (server.current) return;
      this.config();
      if (this.mode === 'driving') this.goHome('The PC disconnected');
      else if (this.mode === 'driven') this._drivenHome('The PC disconnected');
    });
    const on = (t, fn) => server.on(`t:${t}`, fn);
    on(P.T.KVM_TAKE, (m) => this._onTake(m));
    on(P.T.KVM_ACCEPT, (m) => {
      if (this.mode === 'driving' && m.route === this.route) clearTimeout(this.acceptTimer);
    });
    on(P.T.KVM_REFUSE, (m) => {
      if (this.mode === 'driving' && m.route === this.route) this.goHome(REFUSED[m.why] || 'The PC refused', false);
    });
    on(P.T.KVM_HOME, (m) => {
      if (this.mode !== 'driving' || m.route !== this.route) return;
      const k = this.cfg;
      this.helper.send('capture', typeof m.offset === 'number' ? { on: false, side: k.pcSide, offset: m.offset } : { on: false });
      this._setMode('home', '');
    });
    on(P.T.KVM_RELEASE, (m) => {
      if (this.mode === 'driven' && m.route >= this.peerRoute) this._drivenHome('');
    });
    for (const t of [P.T.K_MOVE, P.T.K_DOWN, P.T.K_UP, P.T.K_WHEEL, P.T.K_KEY_DOWN, P.T.K_KEY_UP]) on(t, (m) => this._onK(m));

    helper.on('ready', () => setTimeout(() => this.config(), 150));
    helper.on('exit', () => {
      if (this.mode === 'driving') this.goHome('The helper stopped');
      else if (this.mode === 'driven') this._drivenHome('The helper stopped');
    });
    helper.on('event', (name, ev) => this._onHelper(name, ev));
  }

  get cfg() {
    return this.getSettings().kvm;
  }

  get view() {
    return { where: this.mode, message: this.message, tapError: this.tapError };
  }

  // Tell the helper where the crossing side is and whether edge crossing is armed.
  // Call after settings.kvm or the link changed.
  config() {
    const k = this.cfg;
    this.helper
      .request('kvmConfig', {
        side: k.pcSide, resistancePx: k.resistancePx, keyboard: !!k.keyboard,
        driveOther: !!(k.driveOther && k.mouse && this.server.current),
      })
      .then(() => this._setTapError(null), (e) => this._setTapError(e.message));
  }

  settingsChanged(prev) {
    if (!prev || prev.pcSide !== this.cfg.pcSide) this._sendLayout();
    this.config();
    const k = this.cfg;
    if (this.mode === 'driving' && !k.driveOther) this.goHome('Turned off');
    if (this.mode === 'driven' && !k.beDriven) this._sendHome(undefined, 'Turned off');
  }

  _setTapError(err) {
    if (this.tapError === err) return;
    this.tapError = err;
    this.emit('change');
  }

  _sendLayout() {
    this.server.sendToClient({ t: P.T.KVM_LAYOUT, pcSide: this.cfg.pcSide });
  }

  _setMode(mode, message) {
    this.mode = mode;
    this.message = message || '';
    if (mode !== 'driving') {
      clearTimeout(this.acceptTimer);
      this.pendingMove = null;
    }
    this.emit('change');
  }

  _tick() {
    if (this.mode === 'home') return;
    if (this.mode === 'driving') this.helper.send('keepalive');
    const c = this.server.current;
    if (!c || Date.now() - c.lastRx > P.KVM_SILENCE_MS) {
      if (this.mode === 'driving') this.goHome('The PC stopped answering');
      else this._drivenHome('The PC stopped answering');
    }
  }

  // ---- owner: this Mac drives the PC ----

  _canDrive() {
    return this.mode === 'home' && !!this.server.current && !!this.cfg.driveOther;
  }

  _take(fields) {
    const k = this.cfg;
    this.route++;
    this._setMode('driving', '');
    this.input.releaseAll();
    const take = { t: P.T.KVM_TAKE, route: this.route, mouse: !!fields.mouse, keyboard: !!k.keyboard, ...fields.where };
    if (fields.paths && fields.paths.length) take.drag = { count: fields.paths.length };
    this.server.sendToClient(take);
    if (take.drag) this.dragOut = this.fileSend.send(fields.paths, 'release') > 0;
    this.clipboard.sendIfChanged('switch');
    clearTimeout(this.acceptTimer);
    const route = this.route;
    this.acceptTimer = setTimeout(() => {
      if (this.mode === 'driving' && this.route === route) this.goHome('The PC didn’t answer');
    }, P.KVM_TAKE_TIMEOUT_MS);
  }

  // Row 9: take our input home (helper stops capturing). Tells the PC unless it refused.
  goHome(message, tellPeer = true) {
    if (this.mode !== 'driving') return;
    if (this.dragOut) {
      this.dragOut = false;
      this.fileSend.cancelAll(); // came back without dropping the files on the PC
    }
    this.helper.send('capture', { on: false });
    if (tellPeer && this.server.current) this.server.sendToClient({ t: P.T.KVM_RELEASE, route: ++this.route });
    this._setMode('home', message);
  }

  _flushMove() {
    const m = this.pendingMove;
    this.pendingMove = null;
    if (m && this.mode === 'driving') this.server.sendToClient({ t: P.T.K_MOVE, dx: m.dx, dy: m.dy });
  }

  _onHelper(name, ev) {
    const k = this.cfg;
    switch (name) {
      case 'edge':
        // The helper already captures (it started at the edge); undo that if we can't cross.
        if (!this._canDrive() || !k.mouse) {
          this.helper.send('capture', { on: false });
          if (!this.server.current) this._setMode('home', 'No PC connected');
          return;
        }
        this._take({ mouse: true, where: { side: P.opposite(k.pcSide), offset: ev.offset }, paths: ev.drag && ev.drag.paths });
        break;
      case 'hotkey':
        if (this.mode === 'home') {
          if (!this._canDrive() || !(k.mouse || k.keyboard)) return;
          this.helper.send('capture', { on: true, mouse: !!k.mouse, keyboard: !!k.keyboard });
          this._take({ mouse: !!k.mouse, where: {} });
        } else if (this.mode === 'driving') {
          this.goHome(''); // the helper already stopped capturing if it was a local hotkey
        } else {
          this._sendHome(undefined, '');
        }
        break;
      case 'ev': {
        if (this.mode !== 'driving' || !ev.ev) return;
        const e = ev.ev;
        if (e.t === P.T.K_MOVE) {
          if (!this.pendingMove) {
            this.pendingMove = { dx: 0, dy: 0 };
            setImmediate(() => this._flushMove());
          }
          this.pendingMove.dx += e.dx;
          this.pendingMove.dy += e.dy;
          return;
        }
        this._flushMove();
        if (this.dragOut && e.t === P.T.K_UP && e.b === 0) this.dragOut = false; // dropped on the PC
        this.server.sendToClient(e);
        break;
      }
      case 'captureEnded':
        if (this.mode === 'driving') this.goHome(ev.reason === 'deadman' ? 'Input came back by itself (safety timeout)' : '');
        break;
      case 'return':
        if (this.mode === 'driven') this._sendHome(ev.offset, '');
        break;
    }
  }

  // ---- driven: the PC drives this Mac ----

  _onTake(m) {
    const refuse = (why) => this.server.sendToClient({ t: P.T.KVM_REFUSE, route: m.route, why });
    if (this.mode === 'driving') return refuse(P.REFUSE.BUSY);
    if (!this.cfg.beDriven) return refuse(P.REFUSE.NOT_ALLOWED);
    if (this.mode === 'driven' && !(m.route > this.peerRoute)) return;
    const first = this.mode !== 'driven';
    this.peerRoute = m.route;
    if (m.drag) this.drop.armDrag();
    this._setMode('driven', '');
    this.server.sendToClient({ t: P.T.KVM_ACCEPT, route: m.route });
    if (first) this.input.releaseAll();
    if (m.mouse !== false) {
      if (typeof m.side === 'string') this.helper.send('place', { side: m.side, offset: Number(m.offset) || 0.5 });
      else if (first) this.helper.send('place', { center: true });
      this.helper.send('armReturn', { on: true, side: this.cfg.pcSide, resistancePx: this.cfg.resistancePx });
    }
  }

  _onK(m) {
    if (this.mode !== 'driven') return;
    const k = this.cfg;
    const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
    let ev;
    switch (m.t) {
      case P.T.K_MOVE:
        ev = { t: m.t, dx: num(m.dx) * k.speed, dy: num(m.dy) * k.speed };
        break;
      case P.T.K_DOWN:
      case P.T.K_UP:
        ev = { t: m.t, b: Math.max(0, Math.min(4, num(m.b) | 0)) };
        if (m.t === P.T.K_UP && ev.b === 0) this.drop.release(); // a drag from the PC ends here
        break;
      case P.T.K_WHEEL: {
        const s = k.reverseScroll ? -1 : 1;
        ev = { t: m.t, dx: num(m.dx) * s, dy: num(m.dy) * s, mode: m.mode === 'line' ? 'line' : 'pixel' };
        break;
      }
      default:
        if (typeof m.code !== 'string' || m.code.length > 32) return;
        ev = { t: m.t, code: this.getSettings().keys.swapCtrlCmd !== false ? P.mapKeyFromOtherPlatform(m.code) : m.code };
    }
    this.helper.send('inject', { ev });
  }

  // Rows 8c: send the input home to the PC (return edge or hotkey).
  _sendHome(offset, message) {
    if (this.mode !== 'driven') return;
    const msg = { t: P.T.KVM_HOME, route: this.peerRoute };
    if (typeof offset === 'number') msg.offset = offset;
    this.server.sendToClient(msg);
    this._drivenHome(message);
  }

  // Rows 8b / 9b: stop being driven.
  _drivenHome(message) {
    if (this.mode !== 'driven') return;
    this.drop.cancelDrag();
    this.helper.send('releaseAll');
    this.helper.send('armReturn', { on: false });
    this._setMode('home', message);
    this.clipboard.sendIfChanged('switch');
  }

  // App quitting: give everything back.
  shutdown() {
    if (this.mode === 'driving') this.goHome('');
    else if (this.mode === 'driven') this._sendHome(undefined, '');
  }
}

module.exports = { Kvm };
