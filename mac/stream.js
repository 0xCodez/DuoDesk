// MacShare — Copyright (C) 2026 MacShare contributors. GPL-3.0, see LICENSE.
// Screen sharing: hidden capture window (getDisplayMedia + RTCPeerConnection, the offerer),
// session numbering, rtc.* relay between the capture window and the Windows client, stats.
//
// Events: 'change' — this.view changed (pushed to the control window as state.stream).
'use strict';

const path = require('path');
const { execFile } = require('child_process');
const { BrowserWindow, ipcMain, session, desktopCapturer } = require('electron');
const { EventEmitter } = require('events');
const P = require('../shared/protocol.js');

const RETRY_MS = 2000;

class Stream extends EventEmitter {
  constructor(server, displays, getSettings, helper) {
    super();
    this.server = server;
    this.displays = displays;
    this.getSettings = getSettings;
    this.helper = helper;
    this.peerAudio = false; // the PC's audio.policy (assume false until it says)
    this.audioOn = false; // helper capturing system audio
    this.pcmRest = null; // bytes of a split stereo frame from the last pipe read
    this.mutedByUs = false;
    this.audio = { on: false, error: null };
    this.win = null;
    this.session = 0;
    this.active = null; // {session, displayId, width, height} while a session runs
    this.retryTimer = null;
    this.view = { status: 'off', display: null, width: 0, height: 0, fps: 0, mbps: 0, encoder: '', codec: '' };

    session.defaultSession.setDisplayMediaRequestHandler(async (_req, cb) => {
      try {
        cb({ video: await this._source() });
      } catch (e) {
        console.error(`[stream] no capture source: ${e.message}`);
        cb({});
      }
    });

    server.on('client', () => {
      this.peerAudio = false;
      this.restart('client');
    });
    server.on(`t:${P.T.AUDIO_POLICY}`, (m) => {
      const accept = m.accept === true;
      if (accept === this.peerAudio) return;
      this.peerAudio = accept;
      this.emit('change');
      if (this.active && !!this.getSettings().audio.send) this.restart('audio policy');
    });
    helper.on('pcm', (buf) => this._onPcm(buf));
    helper.on('exit', () => {
      this.audioOn = false;
    });
    server.on('closed', () => {
      if (!server.current) this._stopWindow('no PC connected');
    });
    server.on(`t:${P.T.RTC_ANSWER}`, (msg) => this._toWindow('remote', msg));
    server.on(`t:${P.T.RTC_ICE}`, (msg) => this._toWindow('remote', msg));
    displays.on('change', () => this._displaysChanged());

    ipcMain.on('capture:out', (e, msg) => {
      if (!this._fromCapture(e) || !this.active || msg.session !== this.active.session) return;
      if (msg.t === P.T.RTC_OFFER || msg.t === P.T.RTC_ICE) server.sendToClient(msg);
    });
    ipcMain.on('capture:stats', (e, s) => {
      if (!this._fromCapture(e) || !this.active || s.session !== this.active.session) return;
      const { fps, mbps, encoder, codec, qp, encodeMs, limit, targetMbps } = s;
      Object.assign(this.view, { fps, mbps, encoder, codec, qp, encodeMs, limit, targetMbps });
      if (process.env.MACSHARE_DEBUG_STATS) console.log(`[stream] ${JSON.stringify(s)}`);
      if (s.width) Object.assign(this.view, { width: s.width, height: s.height });
      this.emit('change');
    });
    ipcMain.on('capture:state', (e, s) => {
      if (!this._fromCapture(e) || !this.active || s.session !== this.active.session) return;
      this._setStatus(s.status);
      if (s.status === 'failed' || s.status.startsWith('error')) this._scheduleRetry();
    });
  }

  _fromCapture(e) {
    return this.win && !this.win.isDestroyed() && e.sender === this.win.webContents;
  }

  async _source() {
    const target = this.displays.target();
    const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: 0, height: 0 } });
    const src = (target && sources.find((s) => s.display_id === String(target.id))) || sources[0];
    if (!src) throw new Error('no screens (Screen Recording permission?)');
    return src;
  }

  _ensureWindow() {
    if (this.win && !this.win.isDestroyed()) return Promise.resolve();
    this.win = new BrowserWindow({
      show: false,
      webPreferences: {
        preload: path.join(__dirname, 'preload-capture.js'),
        contextIsolation: true,
        nodeIntegration: false,
        backgroundThrottling: false,
      },
    });
    this.win.webContents.on('render-process-gone', (_e, d) => {
      console.error(`[stream] capture window gone: ${d.reason}`);
      this.win = null;
      this._scheduleRetry();
    });
    this.win.webContents.on('console-message', (e) => console.log(`[capture] ${e.message}`));
    return this.win.loadFile(path.join(__dirname, 'capture.html'));
  }

  _toWindow(channel, msg) {
    if (this.win && !this.win.isDestroyed()) this.win.webContents.send(channel, msg);
  }

  _setStatus(status) {
    this.view.status = status;
    this.emit('change');
  }

  _scheduleRetry() {
    clearTimeout(this.retryTimer);
    this.retryTimer = setTimeout(() => this.restart('retry'), RETRY_MS);
  }

  // Start a fresh WebRTC session (or stop, if sharing is off or no PC is connected).
  async restart(reason) {
    clearTimeout(this.retryTimer);
    if (!this.getSettings().sharing.on) return this.stop('off');
    if (!this.server.current) return this._stopWindow('no PC connected');
    const target = this.displays.target();
    if (!target) return this._stopWindow('no display to share');

    const s = ++this.session;
    const { width, height } = this._outSize(target);
    const audio = await this._setAudio(!!this.getSettings().audio.send && this.peerAudio);
    if (this.session !== s) return;
    this.active = { session: s, displayId: target.id, width: target.pixelWidth, height: target.pixelHeight };
    Object.assign(this.view, { display: target.label, width, height, fps: 0, mbps: 0 });
    this._setStatus('starting');
    console.log(`[stream] session ${s} (${reason}): ${target.label} ${target.pixelWidth}x${target.pixelHeight} -> ${width}x${height}`);
    this.server.sendToClient({ t: P.T.STREAM_INFO, name: target.label, width, height, audio });
    try {
      await this._ensureWindow();
      if (!this.active || this.active.session !== s) return;
      const src = await this._source();
      this._toWindow('start', { session: s, bitrateMbps: this.getSettings().bitrateMbps, sourceId: src.id, width, height, audio });
    } catch (e) {
      console.error(`[stream] start failed: ${e.message}`);
      this._setStatus(`error: ${e.message}`);
      this._scheduleRetry();
    }
  }

  // Capture size: the display's pixels, scaled down to settings.streamMaxHeight if that is smaller.
  // Encoding 4K costs ~30 ms of latency on an M3; a GPU downscale to 1440p costs almost nothing.
  _outSize(d) {
    const max = this.getSettings().streamMaxHeight;
    if (!max || d.pixelHeight <= max) return { width: d.pixelWidth, height: d.pixelHeight };
    const k = max / d.pixelHeight;
    return { width: Math.round((d.pixelWidth * k) / 2) * 2, height: max };
  }

  _displaysChanged() {
    if (!this.active) return;
    const t = this.displays.target();
    if (!t || t.id !== this.active.displayId || t.pixelWidth !== this.active.width || t.pixelHeight !== this.active.height) {
      this.restart('display changed');
    }
  }

  // Start/stop the helper's system-audio capture; returns whether audio is on.
  async _setAudio(want) {
    if (want && !this.audioOn) {
      try {
        await this.helper.request('audioCapture', { on: true });
        this.audioOn = true;
        this.audio.error = null;
      } catch (e) {
        this.audio.error = e.message;
        console.error(`[stream] audio: ${e.message}`);
      }
    } else if (!want && this.audioOn) {
      this.audioOn = false;
      this.helper.request('audioCapture', { on: false }).catch(() => {});
    }
    this.pcmRest = null;
    this._localMute(this.audioOn && !!this.getSettings().audio.muteLocal);
    this.audio.on = this.audioOn;
    this.emit('change');
    return this.audioOn;
  }

  // "Mute this Mac while sending": the capture taps app audio, so the system mute doesn't affect it.
  _localMute(on) {
    if (on === this.mutedByUs) return;
    this.mutedByUs = on;
    execFile('/usr/bin/osascript', ['-e', on ? 'set volume with output muted' : 'set volume without output muted'], () => {});
  }

  // Forward whole stereo float32 frames (8 bytes) to the capture window.
  _onPcm(buf) {
    if (!this.audioOn || !this.win || this.win.isDestroyed()) return;
    if (this.pcmRest) buf = Buffer.concat([this.pcmRest, buf]);
    const whole = buf.length - (buf.length % 8);
    this.pcmRest = whole < buf.length ? Buffer.from(buf.subarray(whole)) : null;
    if (whole) this.win.webContents.send('pcm', buf.subarray(0, whole));
  }

  _stopWindow(status) {
    clearTimeout(this.retryTimer);
    if (this.audioOn) this._setAudio(false);
    this.active = null;
    this._toWindow('stop', {});
    Object.assign(this.view, { fps: 0, mbps: 0 });
    this._setStatus(status);
  }

  // Sharing off: tell Windows too, so it shows "Mac is not sharing".
  stop(status = 'off') {
    if (this.server.current) this.server.sendToClient({ t: P.T.STREAM_STOP });
    this._stopWindow(status);
  }
}

module.exports = { Stream };
