// MacShare — Copyright (C) 2026 MacShare contributors. GPL-3.0, see LICENSE.
// Phase 3: input inside Monitor 2 (in.* -> mac-helper `input`, keys swapped Ctrl<->Cmd) and
// clipboard text (`clip` / `clip.request`).
//
// Stream input is applied only while `enabled()` is true (KVM home; phases 4–5 switch it off).
// Everything we hold is released when the PC goes away, when Monitor 2 loses focus (Windows
// sends `clip.request` then), and when the stream restarts.
'use strict';

const { clipboard } = require('electron');
const P = require('../shared/protocol.js');

const IN_TYPES = [P.T.IN_MOVE, P.T.IN_DOWN, P.T.IN_UP, P.T.IN_WHEEL, P.T.IN_KEY_DOWN, P.T.IN_KEY_UP];
// Electron 44's clipboard.readText() returns a Promise in the main process (older: a string).
const readClipboard = async () => String((await clipboard.readText()) || '');
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

class Input {
  constructor(server, helper, displays, { enabled = () => true } = {}) {
    this.server = server;
    this.helper = helper;
    this.displays = displays;
    this.enabled = enabled;
    this.dirty = false; // something may be held in the helper
    this.lastClip = null; // last clipboard text sent or received

    for (const t of IN_TYPES) server.on(`t:${t}`, (msg) => this._onInput(msg));
    server.on('closed', () => {
      if (!server.current) this.releaseAll();
    });
    server.on(`t:${P.T.CLIP}`, (msg) => this._onClip(msg));
    server.on(`t:${P.T.CLIP_REQUEST}`, () => {
      this.releaseAll(); // Monitor 2 lost focus
      this.sendClipIfChanged();
    });
  }

  _onInput(msg) {
    if (!this.enabled()) return;
    const target = this.displays.target();
    if (!target) return;
    let ev;
    switch (msg.t) {
      case P.T.IN_MOVE:
        ev = { t: msg.t, x: num(msg.x), y: num(msg.y) };
        break;
      case P.T.IN_DOWN:
      case P.T.IN_UP:
        ev = { t: msg.t, x: num(msg.x), y: num(msg.y), b: Math.max(0, Math.min(4, num(msg.b) | 0)) };
        break;
      case P.T.IN_WHEEL:
        ev = { t: msg.t, dx: num(msg.dx), dy: num(msg.dy) };
        break;
      default: // in.kd / in.ku
        if (typeof msg.code !== 'string' || msg.code.length > 32) return;
        ev = { t: msg.t, code: P.mapKeyFromOtherPlatform(msg.code) };
    }
    if (msg.t !== P.T.IN_MOVE && msg.t !== P.T.IN_WHEEL) this.dirty = true;
    this.helper.send('input', { ev, bounds: target.bounds });
  }

  releaseAll() {
    if (!this.dirty) return;
    this.dirty = false;
    this.helper.send('releaseAll');
  }

  async _onClip(msg) {
    if (!P.clipAllowed(msg.text)) return;
    this.lastClip = msg.text;
    if ((await readClipboard()) !== msg.text) clipboard.writeText(msg.text);
  }

  // Send our clipboard text if it changed since it was last sent or received.
  async sendClipIfChanged() {
    const text = await readClipboard();
    if (!text || text === this.lastClip || !P.clipAllowed(text)) return;
    this.lastClip = text;
    this.server.sendToClient({ t: P.T.CLIP, text });
  }
}

module.exports = { Input };
