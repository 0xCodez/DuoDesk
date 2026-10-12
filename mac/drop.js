// MacShare — Copyright (C) 2026 MacShare contributors. GPL-3.0, see LICENSE.
// Files dropped onto Monitor 2 (phase 9; BUILD_PLAN "Roadmap messages"): receive file.* chunks,
// check size + SHA-256, save where they were dropped (Finder window under the point, else the
// Desktop if dropped on it, else the Files folder), never overwrite, reveal in Finder.
//
// Events: 'change' — this.view changed.
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { execFile } = require('child_process');
const { shell } = require('electron');
const { EventEmitter } = require('events');
const P = require('../shared/protocol.js');

const DESKTOP = path.join(os.homedir(), 'Desktop');
const DOWNLOADS = path.join(os.homedir(), 'Downloads');
const MAX_RECENT = 20;

function cleanName(name) {
  let n = path.basename(String(name || '')).replace(/[\u0000-\u001f/:\\]/g, '_').trim();
  if (!n || n === '.' || n === '..') n = 'file';
  if (n.length > 200) {
    const ext = path.extname(n).slice(0, 20);
    n = n.slice(0, 200 - ext.length) + ext;
  }
  return n;
}

// "name.ext", "name 2.ext", "name 3.ext"…
function uniquePath(dir, name) {
  const ext = path.extname(name);
  const base = name.slice(0, name.length - ext.length);
  for (let i = 1; ; i++) {
    const p = path.join(dir, i === 1 ? name : `${base} ${i}${ext}`);
    if (!fs.existsSync(p)) return p;
  }
}

// Finder windows with their bounds {left, top, right, bottom} and folder.
function finderWindows() {
  const script = 'tell application "Finder" to set out to ""\n'
    + 'tell application "Finder" to repeat with w in (every Finder window)\n'
    + '  try\n    set b to bounds of w\n'
    + '    set out to out & (item 1 of b) & "," & (item 2 of b) & "," & (item 3 of b) & "," & (item 4 of b) & "," & (POSIX path of (target of w as alias)) & linefeed\n'
    + '  end try\nend repeat\nreturn out';
  return new Promise((resolve) => {
    execFile('/usr/bin/osascript', ['-e', script], { timeout: 3000 }, (err, out) => {
      if (err) return resolve([]);
      resolve(out.split('\n').filter(Boolean).map((l) => {
        const [x1, y1, x2, y2, ...rest] = l.split(',');
        return { x1: +x1, y1: +y1, x2: +x2, y2: +y2, dir: rest.join(',') };
      }));
    });
  });
}

class Drop extends EventEmitter {
  constructor({ server, helper, displays, getSettings }) {
    super();
    Object.assign(this, { server, helper, displays, getSettings });
    this.active = new Map(); // id -> transfer
    this.recent = []; // newest first: {name, size, path, at, ok, error}

    const on = (t, fn) => server.on(`t:${t}`, fn);
    on(P.T.FILE_OFFER, (m) => this._offer(m));
    on(P.T.FILE_CHUNK, (m) => this._chunk(m));
    on(P.T.FILE_END, (m) => this._end(m));
    on(P.T.FILE_CANCEL, (m) => this._abort(m.id, 'cancelled', false));
    server.on('closed', () => {
      if (!server.current) for (const id of [...this.active.keys()]) this._abort(id, 'the PC disconnected', false);
    });
  }

  get cfg() {
    return this.getSettings().files;
  }

  // Where a drop at normalized (x, y) on the shared display should land.
  async _destination(m) {
    const fallback = this.cfg.folder || DOWNLOADS;
    const t = this.displays.target();
    if (!t || typeof m.x !== 'number' || typeof m.y !== 'number') return fallback;
    const gx = t.bounds.x + m.x * t.bounds.width;
    const gy = t.bounds.y + m.y * t.bounds.height;
    try {
      const w = await this.helper.request('windowAt', { x: gx, y: gy });
      if (!w.owner) return DESKTOP; // dropped on the desktop itself
      if (w.owner === 'Finder') {
        const hit = (await finderWindows()).find((f) => Math.abs(f.x1 - w.bounds.x) < 6 && Math.abs(f.y1 - w.bounds.y) < 30 && Math.abs(f.x2 - (w.bounds.x + w.bounds.width)) < 6);
        if (hit && fs.existsSync(hit.dir)) return hit.dir;
      }
    } catch { /* fall back */ }
    return fallback;
  }

  async _offer(m) {
    const refuse = (why) => this.server.sendToClient({ t: P.T.FILE_REFUSE, id: m.id, why });
    if (typeof m.id !== 'string' || this.active.has(m.id)) return;
    if (!this.cfg.acceptDrops) return refuse('not_allowed');
    const size = Number(m.size);
    if (!Number.isFinite(size) || size < 0 || size > P.FILE_MAX_BYTES) return refuse('too_big');
    const name = cleanName(m.name);
    const dir = await this._destination(m);
    const tmp = path.join(dir, `.${name}.${m.id.slice(0, 8)}.macshare-part`);
    let fd;
    try {
      fs.mkdirSync(dir, { recursive: true });
      fd = fs.openSync(tmp, 'w', 0o644);
    } catch (e) {
      console.error(`[drop] ${tmp}: ${e.message}`);
      return refuse('not_allowed');
    }
    this.active.set(m.id, { id: m.id, name, size, dir, tmp, fd, got: 0, seq: 0, hash: crypto.createHash('sha256'), at: Date.now() });
    this.server.sendToClient({ t: P.T.FILE_ACCEPT, id: m.id });
    this.emit('change');
  }

  _chunk(m) {
    const t = this.active.get(m.id);
    if (!t) return;
    if (m.seq !== t.seq || typeof m.data !== 'string') return this._abort(m.id, 'chunks out of order', true);
    const buf = Buffer.from(m.data, 'base64');
    if (t.got + buf.length > t.size) return this._abort(m.id, 'more data than offered', true);
    fs.writeSync(t.fd, buf);
    t.hash.update(buf);
    t.got += buf.length;
    t.seq++;
    if (t.seq % 64 === 0) this.emit('change'); // progress, ~every 4 MB
  }

  _end(m) {
    const t = this.active.get(m.id);
    if (!t) return;
    const digest = t.hash.digest('hex');
    fs.closeSync(t.fd);
    t.fd = null;
    if (t.got !== t.size || String(m.sha256).toLowerCase() !== digest) {
      return this._abort(m.id, t.got !== t.size ? 'size mismatch' : 'checksum mismatch', true);
    }
    const final = uniquePath(t.dir, t.name);
    fs.renameSync(t.tmp, final);
    this.active.delete(m.id);
    this.server.sendToClient({ t: P.T.FILE_DONE, id: m.id, ok: true, path: final.replace(os.homedir(), '~') });
    this._remember({ name: path.basename(final), size: t.size, path: final, ok: true });
    if (this.cfg.reveal) shell.showItemInFolder(final);
  }

  _abort(id, error, tell) {
    const t = this.active.get(id);
    if (!t) return;
    this.active.delete(id);
    if (t.fd !== null) try { fs.closeSync(t.fd); } catch { /* already closed */ }
    fs.rmSync(t.tmp, { force: true });
    if (tell) this.server.sendToClient({ t: P.T.FILE_DONE, id, ok: false, error });
    this._remember({ name: t.name, size: t.size, path: null, ok: false, error });
  }

  _remember(r) {
    this.recent.unshift({ ...r, at: Date.now() });
    this.recent.length = Math.min(this.recent.length, MAX_RECENT);
    this.emit('change');
  }

  reveal(index) {
    const r = this.recent[index];
    if (r && r.path && fs.existsSync(r.path)) shell.showItemInFolder(r.path);
  }

  get view() {
    return {
      receiving: [...this.active.values()].map((t) => ({ name: t.name, size: t.size, got: t.got })),
      recent: this.recent,
      defaultFolder: DOWNLOADS,
    };
  }
}

module.exports = { Drop };
