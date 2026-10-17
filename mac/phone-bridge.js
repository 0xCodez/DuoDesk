// TwinDesk — Copyright (C) 2026 inukaasith. GPL-3.0, see LICENSE.
// Everything the Mac does to the phone through wireless debugging (adb.js + scrcpy.js), while a
// phone is the peer:
//   setup   find the phone's adb (mDNS), pair once with the code from Developer options, connect,
//           then grant the TwinDesk app what it can't ask for itself (switching wireless debugging
//           on by itself next time, notification access, the pointer overlay, background running).
//   control one control-only scrcpy session: the Mac's mouse and keyboard across the screen edge
//           (Kvm drives the phone through us: kvm.take → we answer kvm.accept, inject the input at
//           positions we keep, and send kvm.home when the pointer comes back over the edge), and
//           the phone's clipboard (scrcpy reads it in the background, which the app can't).
//   windows the phone's screen in a window, and phone apps in windows of their own, each on its
//           own virtual display (phoneview.js).
//
// Events: 'change' — this.view changed; 'popup' (kind, text) — for the HUD.
'use strict';

const { EventEmitter } = require('events');
const P = require('../shared/protocol.js');
const { Adb } = require('./adb');
const { Session, ACTION } = require('./scrcpy');
const { KeyState, ANDROID } = require('./android-keys');

const T = P.T;
const APP_ID = 'com.twindesk.android';
const POLL_MS = 3000;
const BUTTON = { 0: 1, 1: 2, 2: 4, 3: 8, 4: 16 }; // our button numbers -> MotionEvent.BUTTON_*
const isPhone = (ctx) => !!ctx && ctx.os === P.OS.ANDROID;

class PhoneBridge extends EventEmitter {
  constructor({ server, phone, getSettings, clipboard }) {
    super();
    Object.assign(this, { server, phone, getSettings, clipboard });
    this.adb = new Adb();
    // off | missing | waitingWifi | needsPair | connecting | ready | error
    this.state = 'off';
    this.message = '';
    this.serial = null;
    this.control = null; // control-only session
    this.kvm = null; // the pointer while the Mac drives the phone: {route, x, y, push}
    this.keys = new KeyState();
    this.views = null; // phoneview.js sets this
    this.setupDone = new Set(); // serials granted this run

    phone.on('adb', () => this._kick());
    phone.on('info', () => this._kick());
    server.on('client', (ctx) => {
      if (isPhone(ctx)) return this._kick();
      this._stopAll('');
    });
    server.on('closed', () => {
      if (!isPhone(server.current)) this._stopAll('');
    });
    setInterval(() => this._poll(), POLL_MS);
  }

  get view() {
    return {
      state: this.state, message: this.message, serial: this.serial, available: this.adb.available,
      control: !!(this.control && !this.control.closed), driving: !!this.kvm,
      windows: this.views ? this.views.list() : [],
    };
  }

  _set(state, message = '') {
    if (state === this.state && message === this.message) return;
    console.log(`[phone] ${state}${message ? `: ${message}` : ''}`);
    this.state = state;
    this.message = message;
    this.emit('change');
  }

  _stopAll(message) {
    if (this.control) this.control.stop();
    this.control = null;
    if (this.kvm) this._kvmEnd(false);
    if (this.views) this.views.closeAll();
    this.serial = null;
    this._set('off', message);
  }

  // ---- setup ----

  _kick() {
    clearTimeout(this.kickTimer);
    this.kickTimer = setTimeout(() => this._poll(), 50);
  }

  // The phone's sound here on its own when Sound › receive is on (the screen window carries its own).
  _sound() {
    if (!this.views) return;
    const want = this.state === 'ready' && isPhone(this.server.current) && !!this.getSettings().audio.receive && !this.views.screenWithSound;
    this.views.sound(want);
  }

  async _poll() {
    this._sound();
    if (this.polling || !isPhone(this.server.current)) return;
    if (this.state === 'ready' && this.control && !this.control.closed) return;
    this.polling = true;
    try {
      await this._step();
    } catch (e) {
      console.log(`[phone] ${e.message}`);
      this._set('error', e.message);
    } finally {
      this.polling = false;
    }
  }

  async _step() {
    if (!this.adb.available) return this._set('missing', 'adb or the scrcpy server is missing from this build.');
    const a = this.phone.adb;
    if (!a) return this._set('connecting', 'Waiting for the phone…');
    const address = a.address || (this.server.current && this.server.current.address);
    const ready = await this._findDevice(address);
    if (ready) {
      this.serial = ready;
      await this._setup(ready);
      return this._startControl();
    }
    if (!a.wifi) {
      if (a.canEnable) {
        this.server.sendToClient({ t: T.ADB_ENABLE, on: true });
        return this._set('connecting', 'Turning on wireless debugging…');
      }
      return this._set('waitingWifi', a.devOptions ? 'Turn on Wireless debugging on the phone.' : 'Turn on Developer options and Wireless debugging on the phone.');
    }
    // Wireless debugging is on: connect where it listens (it advertises itself over mDNS).
    const services = await this.adb.mdns();
    const conn = services.find((s) => s.type === 'connect' && s.address === address);
    if (conn) {
      const r = await this.adb.connect(conn.address, conn.port);
      if (r.ok) {
        const serial = await this._findDevice(address);
        if (serial) return this._kick();
      }
      if (/authenticat|unauthorized|refused/i.test(r.text) || !r.ok) {
        return this._set('needsPair', 'Pair this Mac with the phone once: on the phone, Wireless debugging › Pair device with pairing code.');
      }
    }
    this.pairing = services.find((s) => s.type === 'pairing' && s.address === address) || null;
    this._set('needsPair', this.pairing
      ? 'Type the code the phone shows.'
      : 'On the phone: Settings › Developer options › Wireless debugging › Pair device with pairing code.');
  }

  async _findDevice(address) {
    const list = await this.adb.devices();
    const d = list.find((x) => x.state === 'device' && x.serial.startsWith(`${address}:`))
      || list.find((x) => x.state === 'device' && x.serial.includes(address))
      || (process.env.TWINDESK_ADB_SERIAL && list.find((x) => x.serial === process.env.TWINDESK_ADB_SERIAL && x.state === 'device'));
    if (d) return d.serial;
    // Plugged in with a USB cable: the same phone if its Wi-Fi address is the one on the link.
    for (const x of list.filter((y) => y.state === 'device' && !/[:]/.test(y.serial) && !y.serial.startsWith('emulator-'))) {
      const r = await this.adb.shell(x.serial, 'ip -4 addr show wlan0', { timeout: 4000 });
      if (address && new RegExp(`inet ${address.replace(/\./g, '\\.')}/`).test(r.out)) return x.serial;
    }
    return null;
  }

  // The code from "Pair device with pairing code" (and its address:port when mDNS can't see it).
  async pair(code, where) {
    code = String(code || '').replace(/\D/g, '');
    if (code.length !== 6) return this._set('needsPair', 'The pairing code has six digits.');
    let address, port;
    const m = /^([\d.]+):(\d+)$/.exec(String(where || '').trim());
    if (m) [address, port] = [m[1], Number(m[2])];
    else {
      const a = this.phone.adb || {};
      const services = await this.adb.mdns();
      const p = services.find((s) => s.type === 'pairing' && s.address === a.address) || this.pairing;
      if (!p) return this._set('needsPair', 'Can’t see the phone’s pairing code screen. Keep it open, or type its address and port.');
      [address, port] = [p.address, p.port];
    }
    this._set('connecting', 'Pairing…');
    const r = await this.adb.pair(address, port, code);
    if (!r.ok) return this._set('needsPair', `Pairing didn’t work (${r.text.split('\n').pop() || 'no answer'}). Try a new code.`);
    this._set('connecting', 'Paired. Connecting…');
    setTimeout(() => this._kick(), 1000);
  }

  async _setup(serial) {
    if (this.setupDone.has(serial)) return;
    this._set('connecting', 'Setting up the phone…');
    const cmds = [
      `pm grant ${APP_ID} android.permission.WRITE_SECURE_SETTINGS`,
      `pm grant ${APP_ID} android.permission.POST_NOTIFICATIONS`,
      `appops set ${APP_ID} SYSTEM_ALERT_WINDOW allow`,
      `cmd notification allow_listener ${APP_ID}/${APP_ID}.NotifListener`,
      `dumpsys deviceidle whitelist +${APP_ID}`,
      `appops set ${APP_ID} RUN_ANY_IN_BACKGROUND allow`,
    ];
    if (this.getSettings().phone && this.getSettings().phone.wallpaper !== false) cmds.push(`appops set ${APP_ID} MANAGE_EXTERNAL_STORAGE allow`);
    for (const c of cmds) await this.adb.shell(serial, c, { timeout: 8000 });
    this.setupDone.add(serial);
    setTimeout(() => this.server.sendToClient({ t: T.PHONE_APPS_LIST }), 500);
  }

  async _startControl() {
    if (this.control && !this.control.closed) return this._set('ready');
    this._set('connecting', 'Connecting to the phone’s screen…');
    const s = new Session(this.adb, this.serial, { video: false, audio: false, control: true, clipboardAutosync: true });
    s.on('clipboard', (text) => this._phoneCopied(text));
    s.on('closed', (why) => {
      if (this.control !== s) return;
      this.control = null;
      if (this.kvm) this._kvmEnd(true);
      this._set('error', `The phone connection stopped (${why}).`);
      setTimeout(() => this._kick(), 2000);
    });
    await s.start();
    this.control = s;
    this._set('ready');
  }

  // The phone copied something (scrcpy sees it even with TwinDesk in the background): it goes
  // through the Mac's clipboard rules as if the app had sent it.
  _phoneCopied(text) {
    if (!text || typeof text !== 'string') return;
    if (text === this.lastPhoneClip) return;
    this.lastPhoneClip = text;
    this.server.inject({ t: T.CLIP, text });
  }

  // ---- the Mac's mouse and keyboard on the phone (Kvm drives us) ----

  drives() {
    return isPhone(this.server.current);
  }

  _display() {
    const info = this.phone.info;
    return info && info.display;
  }

  handle(m) {
    switch (m.t) {
      case T.KVM_TAKE: return this._take(m);
      case T.KVM_RELEASE: return this._kvmEnd(false);
      case T.K_MOVE: return this._move(m);
      case T.K_DOWN: case T.K_UP: return this._button(m);
      case T.K_WHEEL: return this._wheel(m);
      case T.K_KEY_DOWN: case T.K_KEY_UP: return this._key(m);
      case T.K_GESTURE: return this._gesture(m);
      default: break;
    }
  }

  _take(m) {
    const d = this._display();
    if (!this.control || this.control.closed || !d) {
      setImmediate(() => this.server.inject({ t: T.KVM_REFUSE, route: m.route, why: P.REFUSE.NOT_ALLOWED }));
      this.emit('popup', 'home', this.state === 'ready' ? 'The phone isn’t ready yet' : 'Set up wireless debugging on the Phone page first');
      return;
    }
    const off = Math.max(0, Math.min(1, Number(m.offset) || 0.5));
    const side = m.side || 'left';
    const x = side === 'left' ? 0 : side === 'right' ? d.w - 1 : off * (d.w - 1);
    const y = side === 'top' ? 0 : side === 'bottom' ? d.h - 1 : off * (d.h - 1);
    this.kvm = { route: m.route, x, y, side, push: 0, buttons: 0, mouse: m.mouse !== false };
    this.keys.clear();
    // Answer after Kvm's _take returns: it starts its "no answer" timer right after sending kvm.take.
    setImmediate(() => this.server.inject({ t: T.KVM_ACCEPT, route: m.route }));
    this._hover();
    this.emit('change');
  }

  // The pointer is where we say; the app draws it there.
  _pointer(on) {
    const k = this.kvm;
    const now = Date.now();
    if (on && now - (this.lastPointer || 0) < 8) {
      clearTimeout(this.pointerTimer);
      this.pointerTimer = setTimeout(() => this._pointer(true), 8);
      return;
    }
    this.lastPointer = now;
    this.server.sendToClient(on && k ? { t: T.PHONE_POINTER, on: true, x: Math.round(k.x), y: Math.round(k.y) } : { t: T.PHONE_POINTER, on: false });
  }

  _hover() {
    const k = this.kvm;
    const d = this._display();
    if (!k || !d || !this.control) return;
    if (k.buttons) this.control.mouse(ACTION.MOVE, k.x, k.y, d.w, d.h, 0, k.buttons);
    else this.control.mouse(ACTION.HOVER_MOVE, k.x, k.y, d.w, d.h, 0, 0);
    this._pointer(true);
  }

  _move(m) {
    const k = this.kvm;
    const d = this._display();
    if (!k || !d || !k.mouse) return;
    const cfg = this.getSettings().kvm;
    const scale = Math.max(1, Math.min(3.5, (d.dpi || 420) / 160)) * (cfg.speed || 1);
    const dx = (Number(m.dx) || 0) * scale;
    const dy = (Number(m.dy) || 0) * scale;
    // Back over the edge toward the Mac (after a little push, the resistance).
    const back = { left: [dx, k.x <= 0, -1], right: [dx, k.x >= d.w - 1, 1], top: [dy, k.y <= 0, -1], bottom: [dy, k.y >= d.h - 1, 1] }[k.side];
    if (back && back[1] && Math.sign(back[0]) === back[2]) {
      k.push += Math.abs(back[0]);
      if (k.push > Math.max(8, (cfg.resistancePx ?? P.RESISTANCE_PX) / 3)) {
        return this._goHome();
      }
    } else k.push = 0;
    k.x = Math.max(0, Math.min(d.w - 1, k.x + dx));
    k.y = Math.max(0, Math.min(d.h - 1, k.y + dy));
    this._hover();
  }

  _goHome() {
    const k = this.kvm;
    const d = this._display();
    if (!k) return;
    const offset = k.side === 'left' || k.side === 'right' ? k.y / Math.max(1, d.h - 1) : k.x / Math.max(1, d.w - 1);
    const route = k.route;
    this._kvmEnd(false);
    this.server.inject({ t: T.KVM_HOME, route, offset });
  }

  _kvmEnd(tellKvm) {
    const k = this.kvm;
    if (!k) return;
    const d = this._display();
    if (k.buttons && d && this.control) this.control.mouse(ACTION.UP, k.x, k.y, d.w, d.h, k.buttons, 0);
    for (const code of [...this.keys.held]) this._key({ t: T.K_KEY_UP, code });
    this.kvm = null;
    clearTimeout(this.pointerTimer);
    this._pointer(false);
    if (tellKvm) this.server.inject({ t: T.KVM_HOME, route: k.route });
    this.emit('change');
  }

  _button(m) {
    const k = this.kvm;
    const d = this._display();
    if (!k || !d || !this.control) return;
    const down = m.t === T.K_DOWN;
    const b = Number(m.b) | 0;
    // Like scrcpy: right = Back, middle = Home; left (and the side buttons) are the mouse's.
    if (b === 1) return this.control.backOrScreenOn(down ? ACTION.DOWN : ACTION.UP);
    if (b === 2) return void (down && this.control.tap(ANDROID.HOME));
    if (b === 3) return void (down && this.control.tap(ANDROID.BACK));
    const bit = BUTTON[b] || 1;
    if (down) k.buttons |= bit;
    else k.buttons &= ~bit;
    this.control.mouse(down ? ACTION.DOWN : ACTION.UP, k.x, k.y, d.w, d.h, bit, k.buttons);
  }

  _wheel(m) {
    const k = this.kvm;
    const d = this._display();
    if (!k || !d || !this.control) return;
    const line = m.mode === 'line';
    const rev = this.getSettings().kvm.reverseScroll ? -1 : 1;
    const hs = (-(Number(m.dx) || 0) / (line ? 1 : 40)) * rev;
    const vs = (-(Number(m.dy) || 0) / (line ? 1 : 40)) * rev;
    if (hs || vs) this.control.scroll(k.x, k.y, d.w, d.h, hs, vs, k.buttons);
  }

  _key(m) {
    if (!this.kvm || !this.control || typeof m.code !== 'string') return;
    const swap = this.server.keySwap(this.getSettings());
    const code = swap ? P.mapKeyFromOtherPlatform(m.code) : m.code;
    const down = m.t === T.K_KEY_DOWN;
    const e = this.keys.event(code, down);
    if (e) this.control.key(down ? ACTION.DOWN : ACTION.UP, e.keycode, e.meta);
  }

  _gesture(m) {
    if (!this.control || m.phase === 'begin' || m.phase === 'change') return;
    const key = { back: ANDROID.BACK, overview: ANDROID.APP_SWITCH, appWindows: ANDROID.APP_SWITCH, desktop: ANDROID.HOME, launcher: ANDROID.ALL_APPS }[m.g];
    if (key) this.control.tap(key);
  }

  // ---- windows (phoneview.js) ----

  // Options for a new screen/app session, from settings.
  sessionOpts(kind, extra = {}) {
    const ph = this.getSettings().phone || {};
    const base = { video: true, control: true, maxFps: 60, videoBitRate: (ph.bitrateMbps || 8) * 1000000 };
    if (kind === 'screen') return { ...base, audio: ph.sound !== false, maxSize: ph.maxSize || 0, stayAwake: true, ...extra };
    return { ...base, audio: false, flex: true, ...extra };
  }

  setupView() {
    return { state: this.state, message: this.message, pairing: !!this.pairing };
  }
}

module.exports = { PhoneBridge };
