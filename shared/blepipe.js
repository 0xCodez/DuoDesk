// TwinDesk — Copyright (C) 2026 inukaasith. GPL-3.0, see LICENSE.
// The session through Bluetooth LE, for two devices that aren't on one network (P.BLE). The native
// helper does the radio; this joins it to the session as a plain byte pipe, so TLS, the pinned
// certificate, the token and every message work exactly as over the network:
//   BleHost  — we host (Mac, a PC that hosts): advertise, and give each guest that opens a pipe a
//              TCP connection to our server on 127.0.0.1. Its local port marks the session as
//              Bluetooth (server.blePorts), so it gets the longer timeout and no USB relay.
//   BleGuest — we connect to a host (a PC to its Mac or PC): scan, and open() a pipe to a host,
//              which gives a 127.0.0.1 port to connect the session's WSS to.
// Helper commands: bleStart {info}, bleStop, bleSend {dev, data}, bleCtrl {dev, msg} (host);
//   bleScan {on}, bleOpen {dev, hello}, bleSend {dev, data}, bleClose {dev} (guest).
// Helper events: ble.state, ble.guest, ble.open, ble.data, ble.close, ble.gone, ble.sent (host);
//   ble.state, ble.found {dev, info}, ble.invite {dev}, ble.opened {dev}, ble.data, ble.close,
//   ble.gone, ble.sent (guest).
'use strict';

const net = require('net');
const { EventEmitter } = require('events');
const P = require('./protocol.js');

const HIGH_WATER = 64 * 1024; // bytes handed to the helper and not sent yet: stop reading the socket
const LOW_WATER = 16 * 1024;
const FOUND_STALE_MS = 15000; // a host not seen in a scan for this long is gone
const OPEN_TIMEOUT_MS = 15000;

const str = (v, n = 100) => (typeof v === 'string' ? v.slice(0, n) : '');

// One pipe: a TCP socket on one side, the helper on the other, with flow control both ways.
class Pipe {
  constructor(helper, dev, sock) {
    this.helper = helper;
    this.dev = dev;
    this.sock = sock;
    this.inflight = 0;
    sock.setNoDelay(true);
    sock.on('data', (buf) => {
      helper.send('bleSend', { dev, data: buf.toString('base64') });
      this.inflight += buf.length;
      if (this.inflight > HIGH_WATER) sock.pause();
    });
  }

  sent(bytes) {
    this.inflight = Math.max(0, this.inflight - bytes);
    if (this.inflight < LOW_WATER && this.sock.isPaused()) this.sock.resume();
  }

  data(b64) {
    if (!this.sock.destroyed) this.sock.write(Buffer.from(b64, 'base64'));
  }

  close() {
    this.sock.destroy();
  }
}

// Events: 'change' (guests nearby or the radio changed), 'state' (state).
class BleHost extends EventEmitter {
  // info() -> this device's beacon {id, name, os, port, fp}; server: ours (server.blePorts is set here).
  constructor({ helper, server, info, enabled = () => true }) {
    super();
    Object.assign(this, { helper, server, info, enabled });
    this.state = 'off';
    this.guests = new Map(); // dev -> {id, name, os, at}
    this.pipes = new Map(); // dev -> Pipe
    server.blePorts = new Map(); // local port -> when bytes last came through it
    helper.on('event', (name, m) => this._event(name, m));
    helper.on('ready', () => { this.applied = null; this.apply(); });
    this.apply();
  }

  // Start or stop advertising (enabled() changed, the name changed, the helper restarted).
  apply() {
    if (!this.helper.running) return;
    const on = !!this.enabled();
    const key = on ? JSON.stringify(this.info()) : '';
    if (key === this.applied) return;
    this.applied = key;
    if (on) this.helper.request('bleStart', { info: key }).catch((e) => console.log(`[ble] ${e.message}`));
    else {
      this.helper.request('bleStop').catch(() => {});
      for (const dev of [...this.pipes.keys()]) this._closePipe(dev);
      this.guests.clear();
      this.emit('change');
    }
  }

  // Guests that are near (said hello on Bluetooth): [{id, name, os, address: 'ble:<dev>', ble: true}].
  list() {
    const out = [];
    for (const [dev, g] of this.guests) {
      out.push({ id: g.id, name: g.name, os: g.os, address: `ble:${dev}`, port: 0, fp: '', ble: true });
    }
    return out;
  }

  // Ask a guest (by device id) to connect, as discovery's invite does over the network.
  invite(deviceId) {
    for (const [dev, g] of this.guests) {
      if (g.id === deviceId) {
        this.helper.send('bleCtrl', { dev, msg: JSON.stringify({ op: 'invite' }) });
        return true;
      }
    }
    return false;
  }

  _event(name, m) {
    if (!name.startsWith('ble.')) return;
    const dev = str(m.dev, 64);
    switch (name) {
      case 'ble.state':
        this.state = str(m.state, 20);
        if (this.state !== 'on') {
          for (const d of [...this.pipes.keys()]) this._closePipe(d);
          this.guests.clear();
        }
        this.emit('state', this.state);
        return this.emit('change');
      case 'ble.guest': {
        const h = m.hello || {};
        if (typeof h.id !== 'string' || !h.id) return;
        const old = this.guests.get(dev);
        this.guests.set(dev, { id: h.id.slice(0, 64), name: str(h.name, 64) || 'Device', os: Object.values(P.OS).includes(h.os) ? h.os : P.OS.ANDROID, at: Date.now() });
        if (!old || old.id !== h.id) this.emit('change');
        return;
      }
      case 'ble.open': return this._open(dev);
      case 'ble.data': {
        const g = this.guests.get(dev);
        if (g) g.at = Date.now();
        const p = this.pipes.get(dev);
        if (p) {
          p.data(m.data);
          if (p.localPort) this.server.blePorts.set(p.localPort, Date.now()); // a big message takes a while: its bytes count as alive
        }
        return;
      }
      case 'ble.sent': {
        const p = this.pipes.get(dev);
        if (p) p.sent(Number(m.bytes) || 0);
        return;
      }
      case 'ble.close': return this._closePipe(dev);
      case 'ble.gone':
        this._closePipe(dev);
        if (this.guests.delete(dev)) this.emit('change');
        return;
    }
  }

  _open(dev) {
    this._closePipe(dev);
    const sock = net.connect({ host: '127.0.0.1', port: this.server.port });
    const p = new Pipe(this.helper, dev, sock);
    this.pipes.set(dev, p);
    sock.on('connect', () => {
      p.localPort = sock.localPort;
      this.server.blePorts.set(sock.localPort, Date.now());
      const g = this.guests.get(dev);
      console.log(`[ble] pipe open for ${g ? g.name : dev}`);
    });
    const done = () => {
      if (p.localPort) this.server.blePorts.delete(p.localPort);
      if (this.pipes.get(dev) !== p) return;
      this.pipes.delete(dev);
      this.helper.send('bleCtrl', { dev, msg: JSON.stringify({ op: 'closed' }) });
    };
    sock.on('close', done);
    sock.on('error', () => {});
  }

  _closePipe(dev) {
    const p = this.pipes.get(dev);
    if (!p) return;
    this.pipes.delete(dev);
    if (p.localPort) setTimeout(() => this.server.blePorts.delete(p.localPort), 1000);
    p.close();
  }
}

// Events: 'change' (hosts found), 'invite' (host id): a host asked us to connect.
class BleGuest extends EventEmitter {
  // hello() -> {id, name, os}: who we are, for the host's list.
  constructor({ helper, hello }) {
    super();
    Object.assign(this, { helper, hello });
    this.state = 'off';
    this.scanning = false;
    this.found = new Map(); // host id -> {dev, id, name, os, port, fp, lastSeen}
    this.pipes = new Map(); // dev -> Pipe
    this.waiting = new Map(); // dev -> {resolve, reject, timer}
    helper.on('event', (name, m) => this._event(name, m));
    helper.on('ready', () => this.scanning && this.helper.send('bleScan', { on: true }));
    this.timer = setInterval(() => this._prune(), 5000);
  }

  scan(on) {
    if (this.scanning === !!on) return;
    this.scanning = !!on;
    this.helper.send('bleScan', { on: this.scanning });
  }

  get(id) {
    return this.found.get(id) || null;
  }

  list() {
    return [...this.found.values()].map(({ id, name, os, dev, fp, port, invited }) => ({ id, name, os, address: `ble:${dev}`, port, fp, ble: true, invited: !!invited }));
  }

  // A pipe to the host with this id: resolves to the 127.0.0.1 port to connect the session to.
  open(id) {
    const h = this.found.get(id);
    if (!h) return Promise.reject(new Error('not near'));
    const dev = h.dev;
    this._closePipe(dev);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.waiting.delete(dev);
        this.helper.send('bleClose', { dev });
        reject(new Error('no answer over Bluetooth'));
      }, OPEN_TIMEOUT_MS);
      this.waiting.set(dev, { resolve, reject, timer });
      this.helper.send('bleOpen', { dev, hello: JSON.stringify(this.hello()) });
    });
  }

  _opened(dev) {
    const w = this.waiting.get(dev);
    if (!w) return this.helper.send('bleClose', { dev });
    this.waiting.delete(dev);
    clearTimeout(w.timer);
    // One connection: the session's socket, then the listener closes.
    const srv = net.createServer((sock) => {
      srv.close();
      const p = new Pipe(this.helper, dev, sock);
      this.pipes.set(dev, p);
      sock.on('close', () => {
        if (this.pipes.get(dev) !== p) return;
        this.pipes.delete(dev);
        this.helper.send('bleClose', { dev });
      });
      sock.on('error', () => {});
    });
    srv.on('error', (e) => w.reject(e));
    srv.listen(0, '127.0.0.1', () => w.resolve(srv.address().port));
    setTimeout(() => srv.close(), OPEN_TIMEOUT_MS).unref();
  }

  _event(name, m) {
    if (!name.startsWith('ble.')) return;
    const dev = str(m.dev, 64);
    switch (name) {
      case 'ble.state':
        this.state = str(m.state, 20);
        return this.emit('change');
      case 'ble.found': {
        let info;
        try { info = JSON.parse(m.info); } catch { return; }
        if (!info || typeof info.id !== 'string' || !info.id) return;
        const old = this.found.get(info.id);
        if (old && old.dev !== dev && old.invited) old.invited = false;
        const port = Number.isInteger(info.port) ? info.port : P.PORT;
        this.found.set(info.id, {
          dev, id: info.id.slice(0, 64), name: str(info.name, 64) || 'Computer',
          os: Object.values(P.OS).includes(info.os) ? info.os : P.OS.MAC, port, fp: P.normFingerprint(info.fp), lastSeen: Date.now(),
          invited: !!(old && old.invited),
        });
        if (!old || old.dev !== dev || old.name !== info.name) this.emit('change');
        return;
      }
      case 'ble.invite': { // from a host we're connected to (its dev), or one that found us (its id)
        const h = typeof m.id === 'string' && m.id ? this.found.get(m.id) : [...this.found.values()].find((x) => x.dev === dev);
        if (!h) return;
        h.invited = true;
        this.emit('invite', h.id);
        this.emit('change');
        return;
      }
      case 'ble.opened': return this._opened(dev);
      case 'ble.data': {
        const p = this.pipes.get(dev);
        if (p) {
          p.data(m.data);
          this.lastDown = Date.now(); // link.js: bytes of a big message count as alive
        }
        return;
      }
      case 'ble.sent': {
        const p = this.pipes.get(dev);
        if (p) p.sent(Number(m.bytes) || 0);
        return;
      }
      case 'ble.close':
      case 'ble.gone': {
        const w = this.waiting.get(dev);
        if (w) {
          this.waiting.delete(dev);
          clearTimeout(w.timer);
          w.reject(new Error(str(m.error, 200) || 'Bluetooth link closed'));
        }
        this._closePipe(dev);
        return;
      }
    }
  }

  _closePipe(dev) {
    const p = this.pipes.get(dev);
    if (!p) return;
    this.pipes.delete(dev);
    p.close();
  }

  // The person acted on an invite: an ordinary entry again.
  clearInvite(id) {
    const h = this.found.get(id);
    if (h && h.invited) {
      h.invited = false;
      this.emit('change');
    }
  }

  _prune() {
    const now = Date.now();
    let changed = false;
    for (const [id, h] of this.found) {
      if (now - h.lastSeen > FOUND_STALE_MS && !this.pipes.has(h.dev)) {
        this.found.delete(id);
        changed = true;
      }
    }
    if (changed) this.emit('change');
  }

  stop() {
    clearInterval(this.timer);
    this.scan(false);
    for (const dev of [...this.pipes.keys()]) this._closePipe(dev);
  }
}

// The host side looking around (a Mac, whose guests can't be found otherwise until they connect):
// computers that advertise, shown in its list, and asked to connect (they open a pipe to us).
// Helper: bleLook {on}, bleInvite {dev, msg}; event ble.seen {dev, info}. Events: 'change'.
class BleLook extends EventEmitter {
  // self() -> {id, name, os}: who we are, for the invite.
  constructor({ helper, self }) {
    super();
    Object.assign(this, { helper, self });
    this.on_ = false;
    this.seen = new Map(); // id -> {dev, id, name, os, lastSeen}
    helper.on('event', (name, m) => {
      if (name !== 'ble.seen') return;
      let info;
      try { info = JSON.parse(m.info); } catch { return; }
      if (!info || typeof info.id !== 'string' || !info.id) return;
      const old = this.seen.get(info.id);
      const d = { dev: str(m.dev, 64), id: info.id.slice(0, 64), name: str(info.name, 64) || 'Computer', os: Object.values(P.OS).includes(info.os) ? info.os : P.OS.WIN, lastSeen: Date.now() };
      this.seen.set(d.id, d);
      if (!old || old.name !== d.name || old.dev !== d.dev) this.emit('change');
    });
    helper.on('ready', () => this.on_ && helper.request('bleLook', { on: true }).catch(() => {}));
    setInterval(() => {
      let changed = false;
      for (const [id, d] of this.seen) if (Date.now() - d.lastSeen > FOUND_STALE_MS) changed = this.seen.delete(id);
      if (changed) this.emit('change');
    }, 5000).unref();
  }

  look(on) {
    if (this.on_ === !!on) return;
    this.on_ = !!on;
    this.helper.request('bleLook', { on: this.on_ }).catch(() => {});
    if (!on && this.seen.size) {
      this.seen.clear();
      this.emit('change');
    }
  }

  list() {
    return [...this.seen.values()].map(({ id, name, os, dev }) => ({ id, name, os, address: `ble:${dev}`, port: 0, fp: '', ble: true }));
  }

  invite(id) {
    const d = this.seen.get(id);
    if (!d) return false;
    this.helper.request('bleInvite', { dev: d.dev, msg: JSON.stringify({ op: 'invite', ...this.self() }) }).catch(() => {});
    return true;
  }
}

module.exports = { BleHost, BleGuest, BleLook };
