// MacShare — Copyright (C) 2026 MacShare contributors. GPL-3.0, see LICENSE.
// Files dropped onto Monitor 2 → the Mac (phase 9, BUILD_PLAN "Roadmap messages"): one file at a
// time over the control channel in base64 chunks, with a SHA-256 check. Waits while the socket
// is backed up so mouse and keyboard messages never sit behind a big file.
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const P = require('../shared/protocol.js');

const T = P.T;
const HIGH_WATER = 1024 * 1024; // pause sending chunks above this many queued bytes
const ANSWER_MS = 15000; // offer → accept/refuse
const DONE_MS = 120000; // end → done (the Mac hashes and moves the file)

class FileDrop {
  // opts: link, settings (shared), onProgress(view)
  constructor(opts) {
    Object.assign(this, opts);
    this.queue = [];
    this.busy = false;
    this.current = null; // {id, name, size, sent, index, count}
    this.last = null; // {name, ok, text}
    this.waiters = new Map(); // id → {resolve, types}
    for (const t of [T.FILE_ACCEPT, T.FILE_REFUSE, T.FILE_DONE, T.FILE_CANCEL]) this.link.on(t, (m) => this._answer(m));
    this.link.on('closed', () => this._abortAll('The Mac disconnected'));
  }

  // paths from the Monitor 2 drop; x/y normalized over the video (or null).
  drop(paths, x, y) {
    if (!this.settings.files.dropToMac) return this._report(null, false, 'Dropping files onto Monitor 2 is off (Files tab)');
    const files = [];
    for (const p of paths) {
      try {
        const st = fs.statSync(p);
        if (st.isFile()) files.push({ path: p, size: st.size });
      } catch (_) { /* gone */ }
    }
    if (!files.length) return this._report(null, false, 'Only files can be sent (not folders)');
    files.forEach((f, i) => this.queue.push({ ...f, x, y, index: i, count: files.length }));
    this._next();
  }

  async _next() {
    if (this.busy) return;
    const job = this.queue.shift();
    if (!job) return;
    this.busy = true;
    try {
      await this._send(job);
    } catch (e) {
      this._report(path.basename(job.path), false, e.message);
    }
    this.current = null;
    this.busy = false;
    this._next();
  }

  async _send(job) {
    const name = path.basename(job.path);
    if (this.link.status.state !== 'connected') throw new Error('Not connected to the Mac');
    if (job.size > P.FILE_MAX_BYTES) throw new Error('Too big');
    const id = crypto.randomBytes(8).toString('hex');
    this.current = { id, name, size: job.size, sent: 0, index: job.index, count: job.count };
    this._progress();
    const offer = { t: T.FILE_OFFER, id, name, size: job.size, index: job.index, count: job.count };
    if (typeof job.x === 'number') { offer.x = job.x; offer.y = job.y; }
    this.link.send(offer);
    const a = await this._wait(id, [T.FILE_ACCEPT, T.FILE_REFUSE, T.FILE_CANCEL], ANSWER_MS);
    if (a.t !== T.FILE_ACCEPT) throw new Error(a.t === T.FILE_REFUSE ? refuseText(a.why) : 'Cancelled');

    const hash = crypto.createHash('sha256');
    let seq = 0;
    const stream = fs.createReadStream(job.path, { highWaterMark: P.FILE_CHUNK_BYTES });
    try {
      for await (const chunk of stream) {
        if (!this.current || this.current.id !== id) throw new Error('Cancelled');
        while (this.link.bufferedAmount > HIGH_WATER) await sleep(15);
        if (this.link.status.state !== 'connected') throw new Error('The Mac disconnected');
        hash.update(chunk);
        this.link.send({ t: T.FILE_CHUNK, id, seq: seq++, data: chunk.toString('base64') });
        this.current.sent += chunk.length;
        this._progress();
      }
    } finally {
      stream.destroy();
    }
    this.link.send({ t: T.FILE_END, id, sha256: hash.digest('hex') });
    const d = await this._wait(id, [T.FILE_DONE, T.FILE_CANCEL], DONE_MS);
    if (d.t !== T.FILE_DONE || !d.ok) throw new Error(d.error || 'The Mac couldn’t save it');
    this._report(name, true, d.path ? 'Saved on the Mac: ' + d.path : 'Saved on the Mac');
  }

  _wait(id, types, ms) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.waiters.delete(id); reject(new Error('The Mac didn’t answer')); }, ms);
      this.waiters.set(id, { types, resolve: (m) => { clearTimeout(timer); this.waiters.delete(id); resolve(m); }, reject: (e) => { clearTimeout(timer); this.waiters.delete(id); reject(e); } });
    });
  }

  _answer(m) {
    if (m.t === T.FILE_CANCEL && this.current && this.current.id === m.id) this.current.cancelled = true;
    const w = this.waiters.get(m.id);
    if (w && w.types.includes(m.t)) w.resolve(m);
  }

  cancel() {
    if (!this.current) return;
    this.link.send({ t: T.FILE_CANCEL, id: this.current.id });
    const w = this.waiters.get(this.current.id);
    this.queue = [];
    this.current = null; // the chunk loop stops at its next check
    if (w) w.reject(new Error('Cancelled'));
  }

  _abortAll(why) {
    this.queue = [];
    for (const w of [...this.waiters.values()]) w.reject(new Error(why));
  }

  _progress() {
    this.onProgress(this.view());
  }

  _report(name, ok, text) {
    this.last = { name, ok, text, at: Date.now() };
    this.onProgress(this.view());
  }

  view() {
    const c = this.current;
    return {
      current: c ? { name: c.name, size: c.size, sent: c.sent, index: c.index, count: c.count } : null,
      queued: this.queue.length,
      last: this.last,
    };
  }
}

function refuseText(why) {
  return { not_allowed: 'The Mac doesn’t accept dropped files (its Files tab)', too_big: 'Too big for the Mac', busy: 'The Mac is busy with another file' }[why] || 'The Mac refused it';
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

module.exports = FileDrop;
