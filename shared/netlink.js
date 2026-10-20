// TwinDesk — Copyright (C) 2026 inukaasith. GPL-3.0, see LICENSE.
// Wi-Fi for a session that runs through Bluetooth: files and screens need more than Bluetooth
// carries, so one side hosts a network for a while and the other joins it. Once both are on it,
// discovery sees the host there and the guest moves the session onto it (hello {resume}): nothing
// ends or starts again. When nobody needs it any more the joiner leaves (back to its own network)
// and the host stops it; the session falls back to Bluetooth.
//
// Who hosts: whichever side can host while the other can join. Both can: Windows (its access
// point keeps its own Wi-Fi up), else the session's host. A Mac only joins; a phone hosts a Wi-Fi
// Direct group or joins one. A Mac with a phone, for the screen: the phone's own hotspot, switched
// on by the person (opts.hotspot), so the Mac keeps the internet.
//
// Sent files wait (holdOut) until the session is on Wi-Fi, or go through Bluetooth when it can't be.
//
// Events: 'change' — view changed; 'dropped' — Back to Bluetooth on the other side.
'use strict';

const crypto = require('crypto');
const { EventEmitter } = require('events');
const P = require('./protocol.js');

const T = P.T;
const ASK_TIMEOUT_MS = 60000; // the network up, joined and the session moved onto it, by then
const HOTSPOT_TIMEOUT_MS = 180000; // the person switches the hotspot on and types its password
const LINGER_MS = 15000; // nobody needs it: wait this long before taking it down (another file)
const FILES_IDLE_MS = 20000; // 'files' is needed while files move, and this long after
const HOLD = new Set([T.FILE_OFFER, T.DRAG_START]); // these wait for Wi-Fi; what follows them comes after

class NetLink extends EventEmitter {
  // opts: os; send(msg); current() -> {deviceId, os, role, transport: 'ble'|'ip'} | null;
  //   host: {can(), start(ssid, pass), stop()} | null — this side hosts a network (promises);
  //   join: {can(), start(ssid, pass), stop()} | null — this side joins one;
  //   hotspot(why, peerOs) -> true: ask the person for the peer's hotspot instead (the Mac with a phone, screen);
//   cable() -> true: the peer (a phone) is on a USB cable here and was asked onto it: no Wi-Fi link.
  constructor(opts) {
    super();
    this.o = opts;
    this.state = 'idle'; // idle | asking | hosting | joining | joined | hotspot | failed
    this.kind = ''; // 'direct' | 'hotspot'
    this.error = '';
    this.ssid = '';
    this.needs = new Map(); // why -> {idleMs, last}
    this.peerNeeds = new Set();
    this.peerCaps = null;
    this.held = [];
    this.waiters = [];
    this.timers = {};
    setInterval(() => this._tick(), 1000).unref();
  }

  get view() {
    return { state: this.state, linked: this.linked, kind: this.kind, error: this.error, ssid: this.ssid, why: [...this.needs.keys()], peerWhy: [...this.peerNeeds] };
  }

  get onBle() {
    const c = this.o.current();
    return !!c && c.transport === 'ble';
  }

  // ---- the session ----

  // A session started: on Bluetooth, say what we can do.
  started() {
    this.peerCaps = null;
    if (!this.onBle) return;
    this.o.send({ t: T.NET_CAPS, host: !!(this.o.host && this.o.host.can()), join: !!(this.o.join && this.o.join.can()), hotspot: false });
  }

  ended() {
    clearTimeout(this.timers.linger);
    this.needs.clear();
    this.peerNeeds.clear();
    this.peerCaps = null;
    this._flush();
    this._down();
    this.error = '';
    this._set('idle');
  }

  // Every message from the peer (the net.* ones are ours).
  onMessage(m) {
    if (m.t === T.FILE_CHUNK) return this.touch('files');
    if (!m.t.startsWith('net.')) return;
    switch (m.t) {
      case T.NET_CAPS:
        this.peerCaps = { host: !!m.host, join: !!m.join, hotspot: !!m.hotspot };
        return;
      case T.NET_NEED:
        if (this.o.cable && this.o.cable()) return; // the session moves onto the cable instead
        this.peerNeeds.add(String(m.why || 'files').slice(0, 20));
        clearTimeout(this.timers.linger);
        if (this.state === 'hosting' || this.state === 'joined') return this._joinMsg();
        if (this._plan() !== 'me') return this.o.send({ t: T.NET_JOIN, error: 'can’t host' });
        return this._startHost();
      case T.NET_JOIN:
        if (m.error || typeof m.ssid !== 'string' || typeof m.pass !== 'string') return this._fail(`The other side can’t host Wi-Fi${m.error ? ` (${m.error})` : ''}`);
        return this._join(m.ssid.slice(0, 32), m.pass.slice(0, 63));
      case T.NET_JOINED:
        if (!m.ok) return this._fail(String(m.error || 'The other side couldn’t join').slice(0, 200));
        return;
      case T.NET_RELEASE:
        if (m.all) return void (this._drop(), this.emit('dropped')); // Back to Bluetooth on the other side
        this.peerNeeds.delete(String(m.why || ''));
        return this._maybeDown();
    }
  }

  // ---- needing it ----

  // Resolves true once the session is on Wi-Fi (or already was), false when it can't be.
  need(why, idleMs = 0) {
    if (!this.onBle || (this.o.cable && this.o.cable())) return Promise.resolve(!this.onBle);
    const n = this.needs.get(why);
    this.needs.set(why, { idleMs, last: Date.now() });
    clearTimeout(this.timers.linger);
    if (!n || ['idle', 'failed'].includes(this.state)) this._ensure(why);
    this.emit('change');
    return new Promise((resolve) => this.waiters.push(resolve));
  }

  release(why) {
    if (!this.needs.delete(why)) return;
    this.o.send({ t: T.NET_RELEASE, why });
    this._maybeDown();
    this.emit('change');
  }

  // The person gave up (the banner's Cancel): everything this side asked for, now.
  cancel() {
    for (const why of [...this.needs.keys()]) this.o.send({ t: T.NET_RELEASE, why });
    this.needs.clear();
    clearTimeout(this.timers.linger);
    this._down();
    this.error = '';
    this._set('idle');
    this._flush();
    this._settle(false);
  }

  // Back to Bluetooth (the person): what either side needed it for ends now, on both.
  drop() {
    if (this.o.current()) this.o.send({ t: T.NET_RELEASE, why: '', all: true });
    this._drop();
  }

  _drop() {
    this.needs.clear();
    this.peerNeeds.clear();
    this.cancel();
  }

  // On a link made here (for whatever reason): Back to Bluetooth can end it.
  get linked() {
    return ['hosting', 'joining', 'joined'].includes(this.state);
  }

  touch(why) {
    const n = this.needs.get(why);
    if (n) n.last = Date.now();
  }

  // Whether a network is possible at all with this peer.
  get possible() {
    return this._plan() !== null;
  }

  // Outgoing session messages: files wait for Wi-Fi. True = held (sent later through sendRaw).
  holdOut(msg, sendRaw) {
    if (msg.t === T.FILE_CHUNK) this.touch('files');
    if (!HOLD.has(msg.t) && !(this.held.length && msg.t.startsWith('file.'))) return false;
    if (!this.onBle || !this.possible) return false;
    this.held.push(msg);
    this.sendRaw = sendRaw;
    if (this.held.length === 1) this.need('files', FILES_IDLE_MS).then(() => this._flush());
    return true;
  }

  // The Mac with a phone: the person switched the hotspot on; join it.
  joinHotspot(ssid, pass) {
    if (this.state !== 'hotspot' && this.state !== 'failed') return Promise.resolve(false);
    this.kind = 'hotspot';
    return this._join(ssid, pass, true);
  }

  // ---- internals ----

  _plan() {
    const c = this.o.current();
    const them = this.peerCaps;
    if (!c || !them) return null;
    const meHost = !!(this.o.host && this.o.host.can()) && them.join;
    const peerHost = them.host && !!(this.o.join && this.o.join.can());
    if (meHost && !peerHost) return 'me';
    if (peerHost && !meHost) return 'peer';
    if (!meHost) return null;
    if ((this.o.os === P.OS.WIN) !== (c.os === P.OS.WIN)) return this.o.os === P.OS.WIN ? 'me' : 'peer';
    return c.role === 'guest' ? 'me' : 'peer'; // role 'guest': they connected to us, we host the session
  }

  _ensure(why) {
    const c = this.o.current();
    if (this.o.hotspot && this.o.hotspot(why, c && c.os)) {
      this.kind = 'hotspot';
      this.error = '';
      this.o.send({ t: T.NET_HOTSPOT, on: true });
      this._set('hotspot');
      this._deadline(HOTSPOT_TIMEOUT_MS);
      return;
    }
    const plan = this._plan();
    if (!plan) return this._fail(this.peerCaps ? 'Neither side can host Wi-Fi' : 'The other side can’t move to Wi-Fi');
    this.kind = 'direct';
    this.error = '';
    if (plan === 'me') return this._startHost();
    this._set('asking');
    this._deadline();
    this.o.send({ t: T.NET_NEED, why });
  }

  _deadline(ms = ASK_TIMEOUT_MS) {
    clearTimeout(this.timers.ask);
    this.timers.ask = setTimeout(() => this.onBle && this.waiters.length && this._fail('Wi-Fi didn’t come up in time'), ms);
  }

  async _startHost() {
    this.kind = 'direct';
    this.ssid = `DIRECT-TD-${crypto.randomBytes(3).toString('hex')}`;
    this.pass = crypto.randomBytes(12).toString('base64').replace(/[+/=]/g, 'x');
    this._set('hosting');
    this._deadline();
    try {
      await this.o.host.start(this.ssid, this.pass);
    } catch (e) {
      this.o.send({ t: T.NET_JOIN, error: e.message });
      return this._fail(`Couldn’t host Wi-Fi: ${e.message}`);
    }
    if (this.state === 'hosting') this._joinMsg();
  }

  _joinMsg() {
    this.o.send({ t: T.NET_JOIN, ssid: this.ssid, pass: this.pass });
  }

  async _join(ssid, pass, hotspot = false) {
    this.ssid = ssid;
    this._set('joining');
    this._deadline();
    try {
      await this.o.join.start(ssid, pass);
    } catch (e) {
      if (!hotspot) this.o.send({ t: T.NET_JOINED, ok: false, error: e.message });
      this._fail(`Couldn’t join ${ssid}: ${e.message}`);
      return false;
    }
    if (!hotspot) this.o.send({ t: T.NET_JOINED, ok: true });
    this._set('joined');
    return true;
  }

  _fail(error) {
    console.log(`[netlink] ${error}`);
    this.error = error;
    this.needs.clear();
    this._down();
    this._set('failed');
    this._flush();
    this._settle(false);
  }

  _maybeDown() {
    if (this.needs.size || this.peerNeeds.size || this.state === 'idle' || this.state === 'failed') return;
    clearTimeout(this.timers.linger);
    this.timers.linger = setTimeout(() => {
      if (this.needs.size || this.peerNeeds.size) return;
      this._down();
      this._set('idle');
    }, LINGER_MS);
  }

  _down() {
    clearTimeout(this.timers.ask);
    const was = this.state;
    if ((was === 'joining' || was === 'joined') && this.o.join) this.o.join.stop().catch(() => {});
    if (was === 'hosting' && this.o.host) this.o.host.stop().catch(() => {});
    if (was === 'hotspot' && this.o.current()) this.o.send({ t: T.NET_HOTSPOT, on: false });
    this.ssid = '';
  }

  _flush() {
    const held = this.held.splice(0);
    if (held.length && this.sendRaw) for (const m of held) this.sendRaw(m);
  }

  _settle(ok) {
    for (const w of this.waiters.splice(0)) w(ok);
  }

  _set(state) {
    if (this.state === state) return;
    this.state = state;
    this.emit('change');
  }

  _tick() {
    if (this.waiters.length && !this.onBle && this.o.current()) {
      clearTimeout(this.timers.ask);
      this._settle(true);
    }
    const now = Date.now();
    for (const [why, n] of this.needs) if (n.idleMs && now - n.last > n.idleMs) this.release(why);
  }
}

module.exports = { NetLink };
