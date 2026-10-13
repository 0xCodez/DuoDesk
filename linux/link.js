// TwinDesk — Copyright (C) 2026 inukaasith. GPL-3.0, see LICENSE.
// WSS client to the Mac: certificate pinning, pairing, hello, liveness, reconnect.
// After `welcome`, messages are delivered by type through on(type, fn).
const WebSocket = require('ws');
const P = require('../shared/protocol.js');

const T = P.T;
const HELLO_TIMEOUT_MS = P.TIMEOUT_MS; // no `welcome` this long after hello = retry

const PAIR_ERRORS = {
  [P.E.PAIR_REFUSED]: 'The Mac refused pairing.',
  [P.E.PAIR_TIMEOUT]: 'Pairing timed out.',
  [P.E.BUSY]: 'The Mac is already pairing with another device.',
  [P.E.VERSION_MISMATCH]: 'The Mac runs a different TwinDesk version. Update both apps.',
};

class Link {
  // opts: device {id, name}, store {load, save, clear}, resolveAddress(macId) -> {address, port}|null
  constructor(opts) {
    this.device = opts.device;
    this.store = opts.store;
    this.resolveAddress = opts.resolveAddress;
    this.pairing = this.store.load(); // {macId, macName, address, port, fp, token} or null
    this.pairState = null; // pairing in progress: {phase, address, port, macName, code, error}
    this.status = { state: this.pairing ? 'connecting' : 'not_paired', rtt: null, message: '' };
    this.ws = null;
    this.mode = null; // 'session' | 'pair'
    this.authed = false;
    this.attempt = 0;
    this.timers = {};
    this.handlers = new Map();
    this.stateFns = [];
    this.unknown = new Set();
  }

  // ---- public API ----

  start() {
    if (this.pairing) this._connect('session');
  }

  on(type, fn) {
    if (!this.handlers.has(type)) this.handlers.set(type, []);
    this.handlers.get(type).push(fn);
  }

  onState(fn) {
    this.stateFns.push(fn);
  }

  send(obj) {
    if (!this.authed || !this.ws || this.ws.readyState !== WebSocket.OPEN) return false;
    this.ws.send(JSON.stringify(obj));
    return true;
  }

  // Bytes queued on the socket (file transfers wait while this is high).
  get bufferedAmount() {
    return this.ws ? this.ws.bufferedAmount : 0;
  }

  snapshot() {
    const p = this.pairing;
    return {
      link: { ...this.status, macName: p ? p.macName : '', address: p ? p.address : '' },
      pairing: this.pairState ? { ...this.pairState } : null,
      paired: p ? { macId: p.macId, macName: p.macName, address: p.address, port: p.port } : null,
    };
  }

  startPairing({ address, port, macName }) {
    clearTimeout(this.timers.reconnect);
    this.pairState = { phase: 'connecting', address, port: port || P.PORT, macName: macName || address, code: '', error: '' };
    this._connect('pair');
    this._changed();
  }

  confirmCode() {
    const ps = this.pairState;
    if (!ps || ps.phase !== 'code' || this.mode !== 'pair') return;
    this._raw({ t: T.PAIR_CONFIRM });
    ps.phase = 'waiting';
    this._changed();
  }

  cancelPair() {
    const ps = this.pairState;
    if (!ps) return;
    if (this.mode === 'pair' && ps.phase !== 'failed') this._raw({ t: T.PAIR_CANCEL });
    this.pairState = null;
    if (this.mode === 'pair') this._closeSocket();
    this._resume();
  }

  forget() {
    clearTimeout(this.timers.reconnect);
    this._closeSocket();
    this.store.clear();
    this.pairing = null;
    this._setStatus('not_paired', '');
  }

  // ---- connection ----

  _connect(mode) {
    this._closeSocket();
    clearTimeout(this.timers.reconnect);
    this.mode = mode;
    this.nw = this.nm = null;
    const target = mode === 'pair' ? this.pairState : this.pairing;
    const ws = new WebSocket('wss://' + target.address + ':' + target.port, {
      rejectUnauthorized: false, // self-signed; we pin the fingerprint instead
      maxPayload: P.MAX_PAYLOAD,
      handshakeTimeout: 5000,
    });
    this.ws = ws;
    let seenFp = '';
    ws.on('upgrade', (res) => {
      seenFp = P.normFingerprint(res.socket.getPeerCertificate().fingerprint256);
    });
    ws.on('open', () => ws === this.ws && this._onOpen(seenFp));
    ws.on('message', (data, isBinary) => ws === this.ws && !isBinary && this._onMessage(String(data)));
    ws.on('error', (err) => {
      if (ws === this.ws) this.lastError = err.code || err.message;
    });
    ws.on('close', () => ws === this.ws && this._onClose());
  }

  _onOpen(seenFp) {
    this.seenFp = seenFp;
    this.lastRx = Date.now();
    this.lastError = '';
    if (this.mode === 'pair') {
      this.nw = P.randomHex(16);
      this._raw({ t: T.PAIR_START, v: P.PROTOCOL_VERSION, id: this.device.id, name: this.device.name, os: P.OS.LINUX, commit: P.commitOf(this.nw) });
      this.pairState.phase = 'starting';
      this._changed();
      return;
    }
    if (!seenFp || seenFp !== this.pairing.fp) {
      this._closeSocket();
      this._setStatus('identity_changed', 'This Mac looks different now. Forget it and pair again.');
      return;
    }
    this._hello();
  }

  _hello() {
    const p = this.pairing;
    this._raw({ t: T.HELLO, v: P.PROTOCOL_VERSION, id: this.device.id, name: this.device.name, os: P.OS.LINUX, token: p.token });
    this.timers.hello = setTimeout(() => {
      this.lastError = 'No welcome from the Mac';
      if (this.ws) this.ws.terminate();
    }, HELLO_TIMEOUT_MS);
  }

  _onMessage(text) {
    let msg;
    try {
      msg = JSON.parse(text);
    } catch (e) {
      return;
    }
    if (!msg || typeof msg.t !== 'string') return;
    this.lastRx = Date.now();
    switch (msg.t) {
      case T.PAIR_NONCE: return this._onNonce(msg);
      case T.PAIR_OK: return this._onPairOk(msg);
      case T.PAIR_CANCEL: return this._pairFailed('Pairing was cancelled on the Mac.');
      case T.WELCOME: return this._onWelcome(msg);
      case T.ERROR: return this._onError(msg);
      case T.PING: return this.authed && this._raw({ t: T.PONG, ts: msg.ts });
      case T.PONG:
        if (typeof msg.ts === 'number') this.status.rtt = Math.max(0, Date.now() - msg.ts);
        return this._changed();
    }
    if (!this.authed) return;
    const fns = this.handlers.get(msg.t);
    if (fns) for (const fn of fns) fn(msg);
    else if (!this.unknown.has(msg.t)) {
      this.unknown.add(msg.t);
      console.log('[link] ignoring message type', msg.t);
    }
  }

  _onNonce(msg) {
    const ps = this.pairState;
    if (this.mode !== 'pair' || !ps || !this.nw || this.nm) return;
    if (typeof msg.nonce !== 'string' || !/^[0-9a-f]{32,128}$/.test(msg.nonce) || msg.nonce.length % 2) {
      return this._pairFailed('The Mac sent a bad pairing message.');
    }
    this.nm = msg.nonce;
    this._raw({ t: T.PAIR_REVEAL, nonce: this.nw });
    ps.code = P.sasCode(this.seenFp, this.nw, this.nm);
    ps.phase = 'code';
    this._changed();
  }

  _onPairOk(msg) {
    const ps = this.pairState;
    if (this.mode !== 'pair' || !ps || ps.phase !== 'waiting') return;
    if (typeof msg.token !== 'string' || !msg.token || typeof msg.macId !== 'string') {
      return this._pairFailed('The Mac sent a bad pairing message.');
    }
    this.pairing = {
      macId: msg.macId,
      macName: typeof msg.macName === 'string' && msg.macName ? msg.macName : ps.macName,
      address: ps.address,
      port: ps.port,
      fp: this.seenFp,
      token: msg.token,
    };
    this.store.save(this.pairing);
    this.pairState = null;
    this.mode = 'session';
    this._setStatus('connecting', '');
    this._hello();
  }

  _onWelcome(msg) {
    if (this.mode !== 'session' || this.authed) return;
    clearTimeout(this.timers.hello);
    this.authed = true;
    this.attempt = 0;
    if (typeof msg.macName === 'string' && msg.macName && msg.macName !== this.pairing.macName) {
      this.pairing.macName = msg.macName;
      this.store.save(this.pairing);
    }
    this.status.rtt = null;
    this.timers.ping = setInterval(() => {
      if (Date.now() - this.lastRx > P.TIMEOUT_MS) {
        this.lastError = 'The Mac stopped answering';
        if (this.ws) this.ws.terminate();
        return;
      }
      this._raw({ t: T.PING, ts: Date.now() });
    }, P.PING_MS);
    this._setStatus('connected', '');
    this._emit('welcome', msg);
  }

  _onError(msg) {
    const code = msg.code;
    if (this.mode === 'pair') return this._pairFailed(PAIR_ERRORS[code] || 'Pairing failed (' + code + ').');
    if (code === P.E.BAD_TOKEN) {
      this.forget();
      this._setStatus('not_paired', 'Your Mac forgot this computer. Pair again.');
      return;
    }
    if (code === P.E.VERSION_MISMATCH) this.lastError = PAIR_ERRORS[code];
    else if (code === P.E.REPLACED) this.lastError = 'Another connection from this computer replaced this one';
    else this.lastError = 'The Mac closed the link (' + code + ')';
    // The Mac closes the socket after an error; _onClose reconnects.
  }

  _pairFailed(error) {
    const ps = this.pairState;
    if (!ps) return;
    ps.phase = 'failed';
    ps.error = error;
    ps.code = '';
    this._closeSocket();
    this._changed();
    this._resume();
  }

  _onClose() {
    const wasAuthed = this.authed;
    this._clearSocketTimers();
    this.ws = null;
    this.authed = false;
    if (wasAuthed) this._emit('closed', {});
    if (this.mode === 'pair') {
      const ps = this.pairState;
      if (ps && ps.phase !== 'failed') {
        const nobody = /^(ECONNREFUSED|ETIMEDOUT|EHOSTUNREACH|ENETUNREACH)$/.test(this.lastError);
        this._pairFailed(ps.phase === 'connecting'
          ? (nobody ? 'No TwinDesk at ' + ps.address + '.' : 'Could not connect to ' + ps.address + (this.lastError ? ' (' + this.lastError + ')' : '') + '.')
          : 'The connection to the Mac closed.');
      }
      return;
    }
    if (this.pairing && this.status.state !== 'identity_changed') this._scheduleReconnect();
  }

  // Back to the stored pairing (if any) after a pairing attempt ended.
  _resume() {
    if (this.pairing) {
      this.attempt = 0;
      if (!this.ws || this.mode !== 'session') this._scheduleReconnect();
    } else {
      this._setStatus('not_paired', this.status.message);
    }
  }

  _scheduleReconnect() {
    clearTimeout(this.timers.reconnect);
    const delays = P.RECONNECT_MS;
    const delay = delays[Math.min(this.attempt, delays.length - 1)];
    this.attempt++;
    this._setStatus('reconnecting', this.lastError || '');
    this.timers.reconnect = setTimeout(() => {
      if (!this.pairing || this.pairState) return;
      const seen = this.resolveAddress(this.pairing.macId);
      if (seen && (seen.address !== this.pairing.address || seen.port !== this.pairing.port)) {
        this.pairing.address = seen.address;
        this.pairing.port = seen.port;
        this.store.save(this.pairing);
      }
      this._connect('session');
    }, delay);
  }

  _closeSocket() {
    const ws = this.ws;
    this._clearSocketTimers();
    this.ws = null;
    const wasAuthed = this.authed;
    this.authed = false;
    if (wasAuthed) this._emit('closed', {});
    if (!ws) return;
    if (ws.readyState === WebSocket.OPEN) ws.close();
    else ws.terminate();
  }

  _clearSocketTimers() {
    clearInterval(this.timers.ping);
    clearTimeout(this.timers.hello);
  }

  _raw(obj) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(obj));
  }

  // Local events ('welcome', 'closed') share the handler table with message types.
  _emit(type, msg) {
    const fns = this.handlers.get(type);
    if (fns) for (const fn of fns) fn(msg);
  }

  _setStatus(state, message) {
    this.status.state = state;
    this.status.message = message;
    if (state !== 'connected') this.status.rtt = null;
    this._changed();
  }

  _changed() {
    for (const fn of this.stateFns) fn();
  }
}

module.exports = Link;
