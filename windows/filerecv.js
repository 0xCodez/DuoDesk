// MacShare — Copyright (C) 2026 MacShare contributors. GPL-3.0, see LICENSE.
// Files dragged from the Mac across the edge (revision 2 R4, docs/ROADMAP.md): `file.offer
// {drop:'release'}` from the Mac → a temp folder; when the Mac's left button comes up on this PC
// (k.mu b:0 while driven, see kvm.js) they go to the Explorer folder under the pointer, else the
// Desktop if the pointer is on it, else Downloads — never overwriting — and are shown in Explorer.
const { app } = require('electron');
const { spawn } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const P = require('../shared/protocol.js');

const T = P.T;

class FileRecv {
  // opts: link, helper, settings (shared), onChange()
  constructor(opts) {
    Object.assign(this, opts);
    this.dir = path.join(app.getPath('userData'), 'incoming');
    this.files = new Map(); // id → {name, size, got, seq, hash, out, tmp, done, released}
    this.target = null;     // folder chosen at release time for this drag
    this.last = null;       // {name, ok, text, at} for the Files tab
    const link = this.link;
    link.on(T.FILE_OFFER, (m) => this._offer(m));
    link.on(T.FILE_CHUNK, (m) => this._chunk(m));
    link.on(T.FILE_END, (m) => this._end(m));
    link.on(T.FILE_CANCEL, (m) => this._drop(m.id));
    link.on('closed', () => { for (const id of [...this.files.keys()]) this._drop(id); this.target = null; });
    try { fs.rmSync(this.dir, { recursive: true, force: true }); } catch (_) { /* leftovers */ }
  }

  _offer(m) {
    if (typeof m.id !== 'string' || this.files.has(m.id) || m.drop === 'drag') return; // drags: dragrecv.js
    const refuse = (why) => this.link.send({ t: T.FILE_REFUSE, id: m.id, why });
    if (!this.settings.files.acceptFromMac) return refuse('not_allowed');
    if (!(m.size >= 0) || m.size > P.FILE_MAX_BYTES) return refuse('too_big');
    const name = safeName(m.name);
    fs.mkdirSync(this.dir, { recursive: true });
    const tmp = path.join(this.dir, m.id + '.part');
    const f = { id: m.id, name, size: m.size, got: 0, seq: 0, hash: crypto.createHash('sha256'), out: fs.createWriteStream(tmp), tmp, done: false };
    if (this.files.size === 0) this.target = null; // a new drag
    this.files.set(m.id, f);
    this.link.send({ t: T.FILE_ACCEPT, id: m.id });
    this.onChange();
  }

  _chunk(m) {
    const f = this.files.get(m.id);
    if (!f || f.done || m.seq !== f.seq || typeof m.data !== 'string') return;
    const buf = Buffer.from(m.data, 'base64');
    f.seq++;
    f.got += buf.length;
    f.hash.update(buf);
    f.out.write(buf);
  }

  _end(m) {
    const f = this.files.get(m.id);
    if (!f || f.done) return;
    f.done = true;
    f.out.end(() => {
      const ok = f.got === f.size && f.hash.digest('hex') === m.sha256;
      if (!ok) {
        this._finish(f, false, 'checksum mismatch');
        return;
      }
      f.complete = true;
      if (this.target) this._place(f); // released already: put it where the drop was
    });
  }

  // The Mac's left button came up on this PC: decide the folder once, place what's complete.
  async onRelease() {
    if (!this.files.size || this.target) return;
    let folder = '';
    try {
      const r = await this.helper.request('folderAt');
      folder = r.path || '';
    } catch (_) { /* helper busy: Downloads */ }
    this.target = folder && fs.existsSync(folder) ? folder : app.getPath('downloads');
    this.revealed = false;
    for (const f of this.files.values()) if (f.complete) this._place(f);
  }

  _place(f) {
    try {
      const dest = uniquePath(this.target, f.name);
      try { fs.renameSync(f.tmp, dest); } catch (_) { fs.copyFileSync(f.tmp, dest); fs.unlinkSync(f.tmp); } // other drive
      this._finish(f, true, dest);
      if (!this.revealed) { this.revealed = true; spawn('explorer.exe', ['/select,', dest], { detached: true, stdio: 'ignore' }).unref(); }
    } catch (e) {
      this._finish(f, false, e.message);
    }
  }

  _finish(f, ok, pathOrError) {
    this.files.delete(f.id);
    try { if (!ok) fs.unlinkSync(f.tmp); } catch (_) { /* gone */ }
    this.link.send(ok ? { t: T.FILE_DONE, id: f.id, ok: true, path: pathOrError } : { t: T.FILE_DONE, id: f.id, ok: false, error: pathOrError });
    this.last = { name: f.name, ok, text: ok ? 'Saved to ' + path.dirname(pathOrError) : pathOrError, at: Date.now() };
    if (!this.files.size) this.target = null;
    this.onChange();
  }

  _drop(id) {
    const f = this.files.get(id);
    if (!f) return;
    this.files.delete(id);
    f.out.destroy();
    try { fs.unlinkSync(f.tmp); } catch (_) { /* not written yet */ }
    if (!this.files.size) this.target = null;
    this.onChange();
  }

  view() {
    return { receiving: this.files.size, last: this.last };
  }
}

// A plain base name: no folders, no characters Windows forbids, no reserved device names.
function safeName(name) {
  let n = path.basename(String(name || 'file')).replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').replace(/[. ]+$/, '');
  if (!n || /^(con|prn|aux|nul|com\d|lpt\d)(\..*)?$/i.test(n)) n = '_' + (n || 'file');
  return n.slice(0, 200);
}

// "name.txt" → "name 2.txt", "name 3.txt"… if taken.
function uniquePath(dir, name) {
  const ext = path.extname(name);
  const base = name.slice(0, name.length - ext.length);
  let p = path.join(dir, name);
  for (let i = 2; fs.existsSync(p); i++) p = path.join(dir, base + ' ' + i + ext);
  return p;
}

module.exports = FileRecv;
