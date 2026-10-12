// MacShare — Copyright (C) 2026 MacShare contributors. GPL-3.0, see LICENSE.
// Every `rtc2` video session this PC sends (phase 11: its screen; phase 13: one per app window)
// runs in one hidden window (sender.html). Session numbers come from one counter, since the Mac
// routes `rtc2.ice` / `rtc2.stop` by session. Answers and candidates from the Mac are routed here.
// Events: 'state' (session, {status, error}), 'stats' (session, stats).
const { BrowserWindow, ipcMain } = require('electron');
const { EventEmitter } = require('events');
const path = require('path');
const P = require('../shared/protocol.js');

const T = P.T;

class Sender extends EventEmitter {
  constructor(link) {
    super();
    this.link = link;
    this.win = null;
    this.ready = false;
    this.queue = [];
    this.counter = 0;
    this.live = new Set(); // sessions started and not stopped

    link.on(T.RTC2_ANSWER, (m) => this.live.has(m.session) && typeof m.sdp === 'string' && this._toWin(m));
    link.on(T.RTC2_ICE, (m) => this.live.has(m.session) && this._toWin(m));
    link.on('closed', () => { for (const s of [...this.live]) this.stop(s, false); });

    ipcMain.on('sender-out', (e, m) => {
      if (!this._fromWin(e) || !m || !this.live.has(m.session)) return;
      if (m.t === T.RTC2_OFFER || m.t === T.RTC2_ICE) this.link.send(m);
    });
    ipcMain.on('sender-state', (e, s) => {
      if (this._fromWin(e) && s && this.live.has(s.session)) this.emit('state', s.session, { status: String(s.status || ''), error: String(s.error || '') });
    });
    ipcMain.on('sender-stats', (e, s) => {
      if (this._fromWin(e) && s && this.live.has(s.session)) this.emit('stats', s.session, s);
    });
    ipcMain.on('sender-ready', (e) => {
      if (!this._fromWin(e)) return;
      this.ready = true;
      for (const m of this.queue.splice(0)) this.win.webContents.send('sender', m);
    });
  }

  // opts: {sourceId, width, height, follow?, mbps, audio?, offer: {kind, wid?}} → session number
  start(opts) {
    const session = ++this.counter;
    this.live.add(session);
    this._toWin({ ...opts, t: 'start', session });
    return session;
  }

  stop(session, tellMac = true) {
    if (!this.live.delete(session)) return;
    this._toWin({ t: 'stop', session });
    if (tellMac && this.link.status.state === 'connected') this.link.send({ t: T.RTC2_STOP, session });
  }

  _fromWin(e) {
    return this.win && !this.win.isDestroyed() && e.sender === this.win.webContents;
  }

  _toWin(m) {
    if (!this.win || this.win.isDestroyed()) {
      if (m.t !== 'start') return; // nothing to stop
      this._create();
    }
    if (this.ready) this.win.webContents.send('sender', m);
    else this.queue.push(m);
  }

  _create() {
    this.ready = false;
    this.queue = [];
    this.win = new BrowserWindow({
      show: false,
      webPreferences: {
        preload: path.join(__dirname, 'preload-sender.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        backgroundThrottling: false,
      },
    });
    this.win.loadFile(path.join(__dirname, 'sender.html'));
    this.win.on('closed', () => { this.win = null; this.ready = false; });
  }
}

module.exports = Sender;
