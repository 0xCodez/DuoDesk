// MacShare — Copyright (C) 2026 MacShare contributors. GPL-3.0, see LICENSE.
// Network drives (phase 7, docs/ROADMAP.md): mount the PC's share when it offers one, and share
// one folder of this Mac with the PC (admin setup once via scripts/smb-share.sh).
// The share password is kept encrypted with Electron safeStorage (Keychain-backed) in settings.
//
// Events: 'change' — this.view changed.
'use strict';

const fs = require('fs');
const os = require('os');
const net = require('net');
const path = require('path');
const crypto = require('crypto');
const { execFile } = require('child_process');
const { safeStorage, shell } = require('electron');
const { EventEmitter } = require('events');
const P = require('../shared/protocol.js');

const SCRIPTS = path.join(__dirname, 'scripts');
const q = (s) => `'${String(s).replace(/'/g, `'\\''`)}'`; // POSIX shell quoting

function portOpen(host, port, ms = 3000) {
  return new Promise((resolve) => {
    const s = net.connect({ host, port, timeout: ms });
    const done = (v) => { s.destroy(); resolve(v); };
    s.on('connect', () => done(true));
    s.on('error', () => done(false));
    s.on('timeout', () => done(false));
  });
}

// Run a script as root through the macOS administrator prompt.
function asAdmin(cmd, prompt) {
  const script = `do shell script ${JSON.stringify(cmd)} with prompt ${JSON.stringify(prompt)} with administrator privileges`;
  return new Promise((resolve, reject) => {
    execFile('/usr/bin/osascript', ['-e', script], { timeout: 120000 }, (err, out, errOut) => {
      if (err) reject(new Error(/User canceled|-128/.test(String(errOut)) ? 'cancelled' : String(errOut || err.message).trim()));
      else resolve(out.trim());
    });
  });
}

class Smb extends EventEmitter {
  constructor({ server, helper, getSettings, saveSettings }) {
    super();
    Object.assign(this, { server, helper, getSettings, saveSettings });
    this.offer = null; // the PC's last smb.offer (+ its address)
    this.mount = { path: null, error: null, busy: false };
    this.share = { busy: false, error: null, peer: null }; // peer = the PC's smb.state for our share

    server.on(`t:${P.T.SMB_OFFER}`, (m, ctx) => {
      this.offer = { share: String(m.share || ''), user: String(m.user || ''), password: String(m.password || ''), port: Number(m.port) || 445, host: ctx.address };
      this.mountPc();
    });
    server.on(`t:${P.T.SMB_REVOKE}`, () => {
      this.offer = null;
      this.unmountPc();
    });
    server.on(`t:${P.T.SMB_STATE}`, (m) => {
      this.share.peer = { mounted: !!m.mounted, error: m.error || null };
      this.emit('change');
    });
    server.on('client', () => this._offerOurs());
  }

  get cfg() {
    return this.getSettings().smb;
  }

  _state(fields) {
    if (this.offer) this.server.sendToClient({ t: P.T.SMB_STATE, share: this.offer.share, ...fields });
  }

  // ---- the PC's folder here ----

  async mountPc() {
    const o = this.offer;
    if (!o || !this.cfg.connectPc || this.mount.busy) return this.emit('change');
    if (this.mount.path && fs.existsSync(this.mount.path)) return this._state({ mounted: true });
    this.mount = { path: null, error: null, busy: true };
    this.emit('change');
    let err = null;
    if (!(await portOpen(o.host, o.port))) {
      err = `can’t reach ${o.host}:${o.port} — is file sharing allowed through the PC’s firewall?`;
    } else {
      const url = `smb://${o.host}${o.port === 445 ? '' : `:${o.port}`}/${encodeURIComponent(o.share)}`;
      try {
        this.mount.path = (await this.helper.request('smbMount', { url, user: o.user, password: o.password }, 60000)).path;
      } catch (e) {
        err = e.message;
      }
    }
    this.mount.busy = false;
    this.mount.error = err;
    this._state(err ? { mounted: false, error: err } : { mounted: true });
    this.emit('change');
  }

  async unmountPc() {
    const p = this.mount.path;
    this.mount = { path: null, error: null, busy: false };
    if (p) await this.helper.request('smbUnmount', { path: p }).catch((e) => console.error(`[smb] unmount: ${e.message}`));
    this.emit('change');
  }

  openPc() {
    if (this.mount.path) shell.openPath(this.mount.path);
  }

  // ---- a folder of this Mac on the PC ----

  _secret() {
    const s = this.cfg.secret;
    if (!s) return null;
    try {
      return safeStorage.decryptString(Buffer.from(s, 'base64'));
    } catch {
      return null;
    }
  }

  _offerOurs() {
    const pw = this._secret();
    if (this.cfg.sharing && pw) this.server.sendToClient({ t: P.T.SMB_OFFER, share: 'MacShare', user: 'macshare', password: pw, port: 445 });
  }

  async startSharing(folder) {
    if (this.share.busy || !folder) return;
    this.share = { busy: true, error: null, peer: null };
    this.emit('change');
    const pw = crypto.randomBytes(18).toString('base64url');
    const pwFile = path.join(os.tmpdir(), `macshare-${crypto.randomBytes(6).toString('hex')}`);
    fs.writeFileSync(pwFile, pw, { mode: 0o600 });
    try {
      await asAdmin(`/bin/sh ${q(path.join(SCRIPTS, 'smb-share.sh'))} ${q(folder)} ${q(pwFile)}`, 'MacShare wants to share a folder with your PC.');
      const c = this.cfg;
      c.sharing = true;
      c.folder = folder;
      c.secret = safeStorage.encryptString(pw).toString('base64');
      this.saveSettings();
      this._offerOurs();
    } catch (e) {
      this.share.error = e.message === 'cancelled' ? null : e.message;
    } finally {
      fs.rmSync(pwFile, { force: true });
      this.share.busy = false;
      this.emit('change');
    }
  }

  async stopSharing() {
    const c = this.cfg;
    if (this.share.busy || !c.sharing) return;
    this.share = { busy: true, error: null, peer: null };
    this.emit('change');
    try {
      await asAdmin(`/bin/sh ${q(path.join(SCRIPTS, 'smb-unshare.sh'))} ${q(c.folder)}`, 'MacShare wants to stop sharing the folder.');
      this.server.sendToClient({ t: P.T.SMB_REVOKE, share: 'MacShare' });
      c.sharing = false;
      c.secret = '';
      this.saveSettings();
    } catch (e) {
      this.share.error = e.message === 'cancelled' ? null : e.message;
    } finally {
      this.share.busy = false;
      this.emit('change');
    }
  }

  get view() {
    return {
      pcOffered: !!this.offer,
      pcShare: this.offer ? `\\\\${this.offer.host}\\${this.offer.share}` : null,
      mounted: this.mount.path,
      mountError: this.mount.error,
      mounting: this.mount.busy,
      shareBusy: this.share.busy,
      shareError: this.share.error,
      peer: this.share.peer,
    };
  }
}

module.exports = { Smb };
