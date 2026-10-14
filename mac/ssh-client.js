// TwinDesk — Copyright (C) 2026 inukaasith. GPL-3.0, see LICENSE.
// Terminal, Mac -> PC: send this Mac's key with `ssh.key`; when the PC answers
// `ssh.info {enabled}`, write a pinned `Host macshare-pc` block into ~/.ssh/config so
// `ssh macshare-pc` works with no password and no "trust this host?" question.
//
// Events: 'change' — this.view changed.
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile, execFileSync } = require('child_process');
const { EventEmitter } = require('events');
const P = require('../shared/protocol.js');

const SSH_DIR = path.join(os.homedir(), '.ssh');
const KEY = path.join(SSH_DIR, 'macshare_ed25519');
const KNOWN = path.join(SSH_DIR, 'macshare_known_hosts');
const CONFIG = path.join(SSH_DIR, 'config');
const BEGIN = '# >>> macshare (managed by MacShare — do not edit)';
const END = '# <<< macshare';
const ALIAS = 'macshare-pc';
const safe = (s) => /^[A-Za-z0-9._@ -]{1,100}$/.test(s);

// Remove our marked block (only that) and, with `lines`, append a fresh one at the end.
// The user's own config is otherwise left byte for byte; a one-time backup is kept.
function setConfigBlock(lines) {
  let text = '';
  try {
    text = fs.readFileSync(CONFIG, 'utf8');
  } catch { /* no config yet */ }
  const start = text.indexOf(BEGIN);
  const stop = start < 0 ? -1 : text.indexOf(END, start);
  if (start >= 0 && stop >= 0) {
    let a = start;
    if (text[a - 1] === '\n' && text[a - 2] === '\n') a--; // the blank line we added before it
    let b = stop + END.length;
    if (text[b] === '\n') b++;
    text = text.slice(0, a) + text.slice(b);
  }
  if (lines) text = `${text}${text && !text.endsWith('\n') ? '\n' : ''}${text ? '\n' : ''}${BEGIN}\n${lines.join('\n')}\n${END}\n`;
  fs.mkdirSync(SSH_DIR, { recursive: true, mode: 0o700 });
  const backup = `${CONFIG}.before-macshare`;
  if (fs.existsSync(CONFIG) && !fs.existsSync(backup)) fs.copyFileSync(CONFIG, backup);
  const mode = fs.existsSync(CONFIG) ? fs.statSync(CONFIG).mode & 0o777 : 0o600;
  fs.writeFileSync(CONFIG, text, { mode });
}

class SshClient extends EventEmitter {
  constructor(server, getSettings) {
    super();
    this.server = server;
    this.getSettings = getSettings;
    this.status = { ready: false, why: null, user: null };
    server.on('client', () => this._offer());
    server.on(`t:${P.T.SSH_INFO}`, (m, ctx) => this._onInfo(m, ctx));
  }

  get enabled() {
    return !!this.getSettings().terminal.connectPc;
  }

  _pub() {
    if (!fs.existsSync(KEY)) {
      fs.mkdirSync(SSH_DIR, { recursive: true, mode: 0o700 });
      execFileSync('/usr/bin/ssh-keygen', ['-q', '-t', 'ed25519', '-N', '', '-C', `macshare@${os.hostname().replace(/\.local$/, '')}`, '-f', KEY]);
    }
    return fs.readFileSync(`${KEY}.pub`, 'utf8').trim();
  }

  _offer() {
    if (!this.enabled || !this.server.current) return;
    try {
      this.server.sendToClient({ t: P.T.SSH_KEY, pub: this._pub() });
      this.status = { ready: false, why: 'waiting', user: null };
    } catch (e) {
      this.status = { ready: false, why: `key: ${e.message}`, user: null };
    }
    this.emit('change');
  }

  _onInfo(m, ctx) {
    if (!this.enabled) return;
    if (!m.enabled) {
      this.status = { ready: false, why: m.why || 'not_allowed', user: null };
      return this.emit('change');
    }
    const user = String(m.user || '');
    const port = Number(m.port) || 22;
    const keys = (Array.isArray(m.hostKeys) ? m.hostKeys : []).map(String).filter((k) => /^[a-z0-9-]+ [A-Za-z0-9+/=]+$/.test(k));
    if (!safe(user) || !keys.length) {
      this.status = { ready: false, why: 'bad answer from the other computer', user: null };
      return this.emit('change');
    }
    fs.writeFileSync(KNOWN, keys.map((k) => `${ALIAS} ${k}`).join('\n') + '\n', { mode: 0o600 });
    setConfigBlock([
      `Host ${ALIAS}`,
      `  HostName ${ctx.address}`,
      `  Port ${port}`,
      `  User "${user}"`,
      `  IdentityFile ${KEY}`,
      '  IdentitiesOnly yes',
      `  HostKeyAlias ${ALIAS}`,
      `  UserKnownHostsFile ${KNOWN}`,
      '  StrictHostKeyChecking yes',
    ]);
    this.status = { ready: true, why: null, user };
    this.emit('change');
  }

  // After the "Open a shell on the PC" switch changed.
  applySettings() {
    if (this.enabled) return this._offer();
    if (this.server.current) this.server.sendToClient({ t: P.T.SSH_FORGET });
    setConfigBlock(null);
    fs.rmSync(KNOWN, { force: true });
    this.status = { ready: false, why: null, user: null };
    this.emit('change');
  }

  openShell() {
    if (!this.status.ready) return;
    execFile('/usr/bin/osascript', ['-e', `tell application "Terminal" to do script "ssh ${ALIAS}"`, '-e', 'tell application "Terminal" to activate'], () => {});
  }

  get view() {
    return { ...this.status, alias: ALIAS };
  }
}

module.exports = { SshClient };
