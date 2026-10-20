// TwinDesk — Copyright (C) 2026 inukaasith. GPL-3.0, see LICENSE.
// Calls, Messages and Photos from a phone, for the Mac, PC and Linux apps alike (Hub.kt on the
// phone). Required by main.js only once a phone connects or one of them is switched on, so a
// computer that never uses them never loads this. While each is off nothing of it runs here or on
// the phone; the phone only hears which are on (hub.policy) as a session starts.
//
// server: the phone-facing session (mac/peer.js, or phone-link.js): on('client'|'closed'),
// on('t:<type>'), sendToClient(), current. audio: () => this computer's call sound over Bluetooth
// (callaudio.js), made only while Calls and its Bluetooth option are on with a phone connected.
//
// Events: 'change' (view), 'data' (a reply for the window: forwarded as is), 'call' (call, before).
'use strict';

const { EventEmitter } = require('events');
const P = require('./protocol.js');

const T = P.T;
const WHAT = ['calls', 'messages', 'media'];
const isPhone = (ctx) => !!ctx && ctx.os === P.OS.ANDROID;
const str = (v, n = 200) => (typeof v === 'string' ? v.slice(0, n) : '');
const picture = (v, max) => (typeof v === 'string' && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(v) && v.length <= max ? v : '');

// What the pages may ask the phone for, and which switch it needs.
const ASKS = {
  [T.CALL_DO]: 'calls', [T.CALL_LOG]: 'calls', [T.CONTACTS]: 'calls',
  [T.SMS_THREADS]: 'messages', [T.SMS_THREAD]: 'messages', [T.SMS_PART]: 'messages', [T.SMS_SEND]: 'messages',
  [T.MEDIA_LIST]: 'media', [T.MEDIA_THUMB]: 'media', [T.MEDIA_VIEW]: 'media', [T.MEDIA_SAVE]: 'media',
};
// The phone's answers, passed to the window.
const ANSWERS = {
  [T.CALL_DONE]: 'calls', [T.CALL_LOG]: 'calls', [T.CONTACTS]: 'calls',
  [T.SMS_THREADS]: 'messages', [T.SMS_THREAD]: 'messages', [T.SMS_PART]: 'messages', [T.SMS_SENT]: 'messages', [T.SMS_NEW]: 'messages',
  [T.MEDIA_LIST]: 'media', [T.MEDIA_THUMB]: 'media', [T.MEDIA_VIEW]: 'media',
};

class PhoneHub extends EventEmitter {
  constructor({ server, getSettings, save, audio }) {
    super();
    Object.assign(this, { server, getSettings, save, makeAudio: audio || null });
    this.state = null; // hub.state: the phone's permissions (null: no phone, or one too old to know these)
    this.call = null; // {state: 'ringing'|'offhook', number, name, photo, dir, since}
    this.ended = null; // the call that just ended {..., missed, at}
    this.unread = 0; // texts that came in since the Messages page was last looked at
    this.audio = null;
    this.muted = false;

    server.on('client', (ctx) => isPhone(ctx) && this.started());
    server.on('closed', (ctx) => isPhone(ctx) && this.stopped());
    const on = (t, fn) => server.on(`t:${t}`, (m, ctx) => isPhone(ctx) && fn(m));
    on(T.HUB_STATE, (m) => {
      const perm = (x) => (x && ['ok', 'partial', 'ask', 'none'].includes(x.perm) ? x.perm : 'ask');
      const missing = (x) => (x && Array.isArray(x.missing) ? x.missing.filter((s) => typeof s === 'string').slice(0, 8) : []);
      const bt = m.bt && typeof m.bt === 'object' ? m.bt : {};
      this.state = {
        calls: { perm: perm(m.calls), missing: missing(m.calls) },
        messages: { perm: perm(m.messages), missing: missing(m.messages) },
        media: { perm: perm(m.media) },
        bt: { allowed: bt.allowed !== false, radio: bt.radio !== false, name: str(bt.name, 100), bonded: bt.bonded === true ? true : bt.bonded === false ? false : null },
        opens: !!m.opens,
      };
      if (this.audio) this.audio.phone(this.state.bt.name);
      this.emit('change');
    });
    // Switched on or off on the phone: this computer keeps the setting.
    on(T.HUB_SET, (m) => {
      if (!WHAT.includes(m.what)) return;
      this.settings[m.what] = !!m.on;
      this.save();
      this.applyAudio();
      this.emit('change');
    });
    on(T.CALL_STATE, (m) => this.onCall(m));
    for (const t of Object.keys(ANSWERS)) on(t, (m) => this.onAnswer(m));
  }

  get settings() {
    return this.getSettings().hub;
  }

  get phone() {
    const c = this.server.current;
    return isPhone(c) ? c : null;
  }

  // A phone's session started (or this was loaded while one is connected).
  started() {
    this.state = null;
    this.call = null;
    this.unread = 0;
    this.policy();
    this.applyAudio();
    this.emit('change');
  }

  stopped() {
    const had = this.call;
    this.state = null;
    this.call = null;
    this.applyAudio();
    if (had) this.emit('call', null, had);
    this.emit('change');
  }

  policy() {
    const s = this.settings;
    this.server.sendToClient({ t: T.HUB_POLICY, calls: !!s.calls, messages: !!s.messages, media: !!s.media, bt: !!(s.calls && s.callAudio) });
  }

  // ---- from the window ----

  // {do: 'set', what, on} | {do: 'opt', callAudio?, btDevice?} | {do: 'ask', what} | {do: 'seen'}
  // | {do: 'send', msg} | {do: 'audio', a: 'here'|'phone'|'connect'|'pair'} | {do: 'call', a, number?, on?}
  act(r) {
    if (!r || typeof r !== 'object') return;
    const s = this.settings;
    switch (r.do) {
      case 'set':
        if (!WHAT.includes(r.what)) return;
        s[r.what] = !!r.on;
        this.save();
        if (this.phone) this.policy();
        this.applyAudio();
        return this.emit('change');
      case 'opt':
        if (typeof r.callAudio === 'boolean') s.callAudio = r.callAudio;
        if (typeof r.btDevice === 'string') s.btDevice = r.btDevice.slice(0, 400); // Windows' device ids are long
        this.save();
        if (this.phone) this.policy();
        if (typeof r.btDevice === 'string' && this.audio) { this.audio.stop(); this.audio = null; }
        this.applyAudio();
        return this.emit('change');
      case 'ask':
        if (WHAT.includes(r.what)) this.server.sendToClient({ t: T.HUB_ASK, what: r.what });
        return;
      case 'seen':
        if (!this.unread) return;
        this.unread = 0;
        return this.emit('change');
      case 'send':
        return this.ask(r.msg);
      case 'audio':
        return this.audioAct(String(r.a || ''));
      case 'call':
        return this.callAct(String(r.a || ''), r);
      default:
    }
  }

  // What a page asks the phone for: only the fields each takes, only while that one is on.
  ask(m) {
    if (!m || typeof m !== 'object' || !ASKS[m.t] || !this.settings[ASKS[m.t]] || !this.phone) return;
    const n = (v, max, d) => Math.max(1, Math.min(max, Number.isInteger(v) ? v : d));
    const ids = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string' && /^[a-z]?\d{1,18}$/.test(x)).slice(0, 300) : []);
    const out = { t: m.t };
    switch (m.t) {
      case T.CALL_DO: return this.callAct(str(m.a, 20), m);
      case T.CALL_LOG: out.n = n(m.n, 300, 100); break;
      case T.CONTACTS: out.q = str(m.q, 80); break;
      case T.SMS_THREADS: out.n = n(m.n, 300, 60); break;
      case T.SMS_THREAD: Object.assign(out, { id: str(m.id, 20), before: Number(m.before) || 0, n: n(m.n, 200, 50) }); break;
      case T.SMS_PART: out.id = str(m.id, 40); break;
      case T.SMS_SEND: Object.assign(out, { to: str(m.to, 60), body: str(m.body, 5000), ref: str(m.ref, 60) }); break;
      case T.MEDIA_LIST: Object.assign(out, { kind: ['all', 'photos', 'videos', 'screenshots'].includes(m.kind) ? m.kind : 'all', before: str(m.before, 40), n: n(m.n, 500, 120) }); break;
      case T.MEDIA_THUMB: out.ids = ids(m.ids); break;
      case T.MEDIA_VIEW: out.id = str(m.id, 40); break;
      case T.MEDIA_SAVE: out.ids = ids(m.ids); break;
      default: return;
    }
    this.server.sendToClient(out);
  }

  // Answer, Decline, End, Call, Mute (the popup, the Calls page). Over Bluetooth the microphone
  // muted is this computer's; otherwise the phone's.
  callAct(a, m = {}) {
    if (!this.settings.calls || !this.phone) return;
    if (a === 'mute') {
      this.muted = !!m.on;
      if (this.audio && this.audio.view.state === 'ready' && this.audio.view.canMute !== false) this.audio.mute(this.muted);
      else this.server.sendToClient({ t: T.CALL_DO, a: 'mute', on: this.muted });
      return this.emit('change');
    }
    if (a === 'dial') {
      const number = str(m.number, 60).replace(/[^\d+*#,;]/g, '');
      if (number) this.server.sendToClient({ t: T.CALL_DO, a, number });
      return;
    }
    if (a === 'answer' || a === 'end') this.server.sendToClient({ t: T.CALL_DO, a });
  }

  // ---- from the phone ----

  onCall(m) {
    if (!this.settings.calls) return;
    const was = this.call;
    const st = m.state === 'ringing' || m.state === 'offhook' ? m.state : 'idle';
    if (st === 'idle') {
      this.call = null;
      this.muted = false;
      if (was && this.audio) this.audio.idle(); // the microphone as it was, the next call here again
      if (was) this.ended = { ...was, missed: was.state === 'ringing' && was.dir === 'in', at: Date.now() };
    } else {
      const same = was && was.state === st;
      this.call = {
        state: st,
        number: str(m.number, 40) || (was ? was.number : ''),
        name: str(m.name, 100) || (was ? was.name : ''),
        photo: picture(m.photo, 60000) || (was ? was.photo : ''),
        dir: m.dir === 'out' ? 'out' : 'in',
        since: same ? was.since : Date.now(), // this computer's clock: the timer counts from here
      };
    }
    this.emit('call', this.call, was);
    this.emit('change');
  }

  onAnswer(m) {
    if (!this.settings[ANSWERS[m.t]]) return;
    if ('data' in m) m = { ...m, data: picture(m.data, 12e6) }; // pictures only (thumbnails, previews, MMS)
    if (m.t === T.SMS_NEW && m.msg && !m.msg.out) {
      this.unread++;
      this.emit('change');
    }
    this.emit('data', m);
  }

  // ---- call sound over Bluetooth ----

  // Running only while Calls and its Bluetooth option are on, with a phone connected.
  applyAudio() {
    const s = this.settings;
    const want = !!(this.makeAudio && s.calls && s.callAudio && this.phone);
    if (!want) {
      if (this.audio) {
        this.audio.stop();
        this.audio = null;
        this.emit('change');
      }
      return;
    }
    if (this.audio) return;
    try {
      this.audio = this.makeAudio({ device: () => this.settings.btDevice, save: (id) => { this.settings.btDevice = id; this.save(); } });
    } catch (e) {
      console.log(`[hub] call sound: ${e.message}`);
      this.audio = null;
      return;
    }
    if (!this.audio) return;
    this.audio.on('change', () => this.emit('change'));
    this.audio.on('address', (address) => this.phone && this.server.sendToClient({ t: T.HUB_BT, address }));
    this.audio.start(this.state ? this.state.bt.name : '');
  }

  audioAct(a) {
    if (!this.audio) return;
    if (a === 'here' || a === 'phone') this.audio.transfer(a === 'here');
    else if (a === 'connect') this.audio.start(this.state ? this.state.bt.name : '');
    else if (a === 'pair' && this.audio.view.address) {
      this.audio.pair();
      this.server.sendToClient({ t: T.HUB_BT, address: this.audio.view.address, bond: true });
    }
  }

  get view() {
    const s = this.settings;
    return {
      calls: !!s.calls, messages: !!s.messages, media: !!s.media, callAudio: !!s.callAudio, btDevice: s.btDevice || '',
      connected: !!this.phone, name: this.phone ? this.phone.name : '',
      supported: !!this.state, // the phone app answered (an older one doesn't know these)
      perm: this.state, call: this.call, ended: this.ended, unread: this.unread, muted: this.muted,
      audio: this.audio ? this.audio.view : null, canAudio: !!this.makeAudio,
    };
  }
}

module.exports = { PhoneHub };
