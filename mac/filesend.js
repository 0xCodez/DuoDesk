// MacShare — Copyright (C) 2026 MacShare contributors. GPL-3.0, see LICENSE.
// Sends files to the PC (docs/ROADMAP.md "Drag files across the screen edge"): `file.offer`
// with `drop:'release'`, then chunks with backpressure on the socket (so input and pings never
// wait behind a big file), then `file.end` with the SHA-256. Folders are skipped for now.
//
// Events: 'change' — this.view changed.
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { EventEmitter } = require('events');
const P = require('../shared/protocol.js');

const HIGH_WATER = 1024 * 1024; // pause reading while the socket has more than this queued

class FileSend extends EventEmitter {
  constructor(server) {
    super();
    this.server = server;
    this.outgoing = new Map(); // id -> { id, name, size, path, sent, state }
    this.recent = []; // newest first: { name, size, at, ok, where|error }
    server.on(`t:${P.T.FILE_ACCEPT}`, (m) => this._pump(m.id));
    server.on(`t:${P.T.FILE_REFUSE}`, (m) => this._finish(m.id, false, `refused (${m.why || 'no reason'})`));
    server.on(`t:${P.T.FILE_DONE}`, (m) => this._finish(m.id, !!m.ok, m.ok ? m.path : m.error));
    server.on(`t:${P.T.FILE_CANCEL}`, (m) => this._finish(m.id, false, 'cancelled on the PC'));
    server.on('closed', () => {
      if (!server.current) for (const id of [...this.outgoing.keys()]) this._finish(id, false, 'the PC disconnected');
    });
  }

  // Offer each regular file; returns how many were offered.
  send(paths, drop = 'release') {
    const files = [];
    for (const p of paths) {
      try {
        const st = fs.statSync(p);
        if (st.isFile()) files.push({ p, size: st.size });
      } catch { /* vanished */ }
    }
    files.forEach((f, index) => {
      const id = crypto.randomUUID();
      this.outgoing.set(id, { id, name: path.basename(f.p), size: f.size, path: f.p, sent: 0, state: 'offered' });
      this.server.sendToClient({ t: P.T.FILE_OFFER, id, name: path.basename(f.p), size: f.size, drop, index, count: files.length });
    });
    this.emit('change');
    return files.length;
  }

  // Abort everything not yet confirmed (the drag went home before it was dropped).
  cancelAll() {
    for (const id of [...this.outgoing.keys()]) {
      this.server.sendToClient({ t: P.T.FILE_CANCEL, id });
      this._finish(id, false, 'cancelled');
    }
  }

  async _pump(id) {
    const f = this.outgoing.get(id);
    if (!f || f.state !== 'offered') return;
    f.state = 'sending';
    const ws = this.server.current && this.server.current.ws;
    const hash = crypto.createHash('sha256');
    let seq = 0;
    try {
      const stream = fs.createReadStream(f.path, { highWaterMark: P.FILE_CHUNK_BYTES });
      for await (const chunk of stream) {
        if (!this.outgoing.has(id) || !ws || ws.readyState !== ws.OPEN) return stream.destroy();
        while (ws.bufferedAmount > HIGH_WATER) await new Promise((r) => setTimeout(r, 10));
        hash.update(chunk);
        this.server.sendToClient({ t: P.T.FILE_CHUNK, id, seq: seq++, data: chunk.toString('base64') });
        f.sent += chunk.length;
        if (seq % 64 === 0) this.emit('change');
      }
      if (this.outgoing.has(id)) this.server.sendToClient({ t: P.T.FILE_END, id, sha256: hash.digest('hex') });
    } catch (e) {
      this.server.sendToClient({ t: P.T.FILE_CANCEL, id });
      this._finish(id, false, e.message);
    }
  }

  _finish(id, ok, info) {
    const f = this.outgoing.get(id);
    if (!f) return;
    this.outgoing.delete(id);
    this.recent.unshift({ name: f.name, size: f.size, at: Date.now(), ok, ...(ok ? { where: info } : { error: info }) });
    this.recent.length = Math.min(this.recent.length, 20);
    this.emit('change');
  }

  get view() {
    return {
      sending: [...this.outgoing.values()].map((f) => ({ name: f.name, size: f.size, sent: f.sent })),
      sent: this.recent,
    };
  }
}

module.exports = { FileSend };
