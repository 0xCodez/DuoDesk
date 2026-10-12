// MacShare — Copyright (C) 2026 MacShare contributors. GPL-3.0, see LICENSE.
// Files dropped onto Monitor 2 → the Mac (phase 9, BUILD_PLAN "Roadmap messages"), and files and
// folders dragged across the edge (revision 3: `drag.start` + `file.offer {drop:'drag', rel}`, the
// Mac shows a real drag and the drop target pulls the data): one file at a time over the control
// channel in base64 chunks, with a SHA-256 check. Waits while the socket is backed up so mouse and
// keyboard messages never sit behind a big file.
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const P = require('../shared/protocol.js');

const T = P.T;
const HIGH_WATER = 1024 * 1024;
const MAX_DRAG_FILES = 10000; // pause sending chunks above this many queued bytes
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
    this.drag = null; // {drag, name} while a drag's files are being sent
    this.link.on(T.DRAG_END, (m) => this._dragEnd(m));
    this.link.on('closed', () => this._abortAll('The Mac disconnected'));
  }

  // paths from the Monitor 2 drop (x/y normalized over the video, or null), or from a drag across
  // the edge (release = true: the Mac places them where its pointer is when the button comes up).
  drop(paths, x, y, release) {
    if (!this.settings.files.dropToMac) return this._report(null, false, 'Dropping files onto Monitor 2 is off (Files tab)');
    const files = [];
    for (const p of paths) {
      try {
        const st = fs.statSync(p);
        if (st.isFile()) files.push({ path: p, size: st.size });
      } catch (_) { /* gone */ }
    }
    if (!files.length) return this._report(null, false, 'Only files can be sent (not folders)');
    files.forEach((f, i) => this.queue.push({ ...f, x, y, release: !!release, index: i, count: files.length }));
    this._next();
  }

  // A drag across the edge (revision 3), step 1: walk the folders. Returns what kvm.take and
  // beginDrag need, or null when nothing can go. Nothing is sent yet: kvm.take goes first.
  prepareDrag(paths) {
    if (!this.settings.files.dropToMac || this.link.status.state !== 'connected') return null;
    const items = [], dirs = [], list = [], jobs = [];
    let bytes = 0;
    const walk = (abs, rel) => {
      let st;
      try { st = fs.lstatSync(abs); } catch (_) { return; }
      if (st.isSymbolicLink()) return;
      if (st.isDirectory()) {
        dirs.push(rel);
        let names = [];
        try { names = fs.readdirSync(abs); } catch (_) { /* unreadable: sent empty */ }
        for (const n of names.sort()) { if (list.length >= MAX_DRAG_FILES) return; walk(path.join(abs, n), rel + '/' + n); }
      } else if (st.isFile() && st.size <= P.FILE_MAX_BYTES && list.length < MAX_DRAG_FILES) {
        list.push({ rel, size: st.size });
        jobs.push({ path: abs, size: st.size, rel });
        bytes += st.size;
      }
    };
    for (const p of paths) {
      const name = path.basename(p);
      const before = bytes;
      let dir = false;
      try { dir = fs.lstatSync(p).isDirectory(); } catch (_) { continue; }
      walk(p, name);
      items.push({ name, dir, size: bytes - before });
    }
    if (!items.length) return null;
    return { drag: crypto.randomBytes(8).toString('hex'), items, dirs, list, jobs, bytes, count: items.length };
  }

  // Step 2, right after kvm.take: describe everything in `drag.start`, then send the files.
  beginDrag(d) {
    this.cancelRelease(); // one drag at a time
    const { drag, items, dirs, list, jobs, bytes } = d;
    this.drag = { drag, name: items.length > 1 ? items.length + ' items' : items[0].name };
    this.link.send({ t: T.DRAG_START, drag, items, dirs, list, files: list.length, bytes });
    jobs.forEach((j, i) => this.queue.push({ ...j, drag, index: i, count: jobs.length }));
    this._next();
  }

  // The Mac says how the drag ended: dropped (show where), or cancelled — stop sending.
  _dragEnd(m) {
    if (!this.drag || m.drag !== this.drag.drag) return;
    const d = this.drag;
    this.drag = null;
    if (m.result === 'dropped') this._report(d.name, true, 'Dropped on the Mac' + (typeof m.where === 'string' && m.where ? ' in ' + m.where : ''));
    else {
      this._stopDrag(d.drag, false);
      this._report(d.name, false, m.result === 'failed' ? 'The Mac couldn’t take the drag' : 'Drag cancelled');
    }
  }

  _stopDrag(drag, tellMac) {
    if (tellMac) this.link.send({ t: T.DRAG_CANCEL, drag });
    this.queue = this.queue.filter((j) => j.drag !== drag);
    if (this.current && this.current.drag === drag) this.cancel();
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
    this.current = { id, name, size: job.size, sent: 0, index: job.index, count: job.count, release: job.release, drag: job.drag };
    this._progress();
    const offer = { t: T.FILE_OFFER, id, name, size: job.size, index: job.index, count: job.count };
    if (job.drag) Object.assign(offer, { drop: 'drag', drag: job.drag, rel: job.rel });
    else if (job.release) offer.drop = 'release';
    else { offer.drop = 'point'; if (typeof job.x === 'number') { offer.x = job.x; offer.y = job.y; } }
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
    if (job.drag) return; // the Mac answers file.done when the drop target has it; drag.end says how it went
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

  // Input went home before the button came up: the dragged files don't go (revision 2 R4), and a
  // revision 3 drag is cancelled on the Mac.
  cancelRelease() {
    this.queue = this.queue.filter((j) => !j.release);
    if (this.current && this.current.release) this.cancel();
    if (this.drag) {
      const d = this.drag;
      this.drag = null;
      this._stopDrag(d.drag, true);
    }
  }

  cancel() {
    if (!this.current) return;
    this.link.send({ t: T.FILE_CANCEL, id: this.current.id });
    const w = this.waiters.get(this.current.id);
    if (!this.current.drag) this.queue = [];
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
