// TwinDesk — Copyright (C) 2026 inukaasith. GPL-3.0, see LICENSE.
// Terminal, PC → Mac (phase 8, BUILD_PLAN "Roadmap messages"): an ed25519 key made once, handed to
// the Mac over the paired link (ssh.key); the Mac's host keys come back (ssh.info) and are pinned
// in our own known_hosts, so ssh never asks for a password or "trust this host?". Adds a
// `macshare` command (a .cmd in userData\bin on the user PATH) and opens Windows Terminal.
const { app } = require('electron');
const { execFile, spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const P = require('../shared/protocol.js');

const T = P.T;
const SSH_DIR = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'OpenSSH');
const SSH = path.join(SSH_DIR, 'ssh.exe');
const KEYGEN = path.join(SSH_DIR, 'ssh-keygen.exe');
const WHY = {
  remote_login_off: 'Remote Login is off on {name} (System Settings → General → Sharing).',
  not_allowed: '{Name} doesn’t allow shells from {me} (its Terminal tab).',
};

class Terminal {
  // opts: link, settings (shared), onChange()
  constructor(opts) {
    Object.assign(this, opts);
    this.dir = path.join(app.getPath('userData'), 'ssh');
    this.binDir = path.join(app.getPath('userData'), 'bin');
    this.key = path.join(this.dir, 'macshare_ed25519');
    this.knownHosts = path.join(this.dir, 'known_hosts');
    this.cmdFile = path.join(this.binDir, 'macshare.cmd');
    this.info = null; // last ssh.info
    this.status = 'off';
    this.message = '';
    this.onPath = false;

    this.link.on('welcome', () => this.apply());
    this.link.on('closed', () => { this.info = null; this._set(this.cfg.enabled ? 'no_mac' : 'off', ''); });
    this.link.on(T.SSH_INFO, (m) => this._onInfo(m));
    this._checkPath();
  }

  get cfg() {
    return this.settings.terminal;
  }

  get available() {
    return fs.existsSync(SSH) && fs.existsSync(KEYGEN);
  }

  // Call on welcome and after the Terminal switch changed.
  async apply() {
    if (!this.cfg.enabled) {
      if (this.info) this.link.send({ t: T.SSH_FORGET });
      this.info = null;
      return this._set('off', '');
    }
    if (!this.available) return this._set('error', 'Windows’ OpenSSH client is missing (Settings → System → Optional features → OpenSSH Client).');
    if (this.link.status.state !== 'connected') return this._set('no_mac', '');
    try {
      const pub = await this._ensureKey();
      this._set('waiting', '');
      this.link.send({ t: T.SSH_KEY, pub });
    } catch (e) {
      this._set('error', 'Couldn’t make an SSH key: ' + e.message);
    }
  }

  async _ensureKey() {
    if (!fs.existsSync(this.key + '.pub')) {
      fs.mkdirSync(this.dir, { recursive: true });
      await run(KEYGEN, ['-q', '-t', 'ed25519', '-N', '', '-C', 'macshare@' + os.hostname(), '-f', this.key]);
    }
    return fs.readFileSync(this.key + '.pub', 'utf8').trim();
  }

  _onInfo(m) {
    if (!this.cfg.enabled) return;
    this.info = m;
    if (!m.enabled) return this._set('unavailable', WHY[m.why] || '{Name} can’t open a shell right now.');
    const keys = (Array.isArray(m.hostKeys) ? m.hostKeys : [])
      .map((k) => String(k).trim().split(/\s+/).slice(0, 2).join(' '))
      .filter((k) => /^(ssh|ecdsa)-\S+ [A-Za-z0-9+/=]+$/.test(k));
    if (!keys.length || typeof m.user !== 'string' || !/^[\w.-]+$/.test(m.user)) return this._set('error', '{Name} sent no usable host key or user name.');
    fs.mkdirSync(this.dir, { recursive: true });
    fs.writeFileSync(this.knownHosts, keys.map((k) => 'macshare ' + k).join('\n') + '\n');
    this._writeCommand();
    this._set('ready', '');
  }

  // ssh arguments for the paired Mac (address can change; rebuilt each time).
  args() {
    const i = this.info;
    const addr = this.link.snapshot().link.address;
    return ['-i', this.key, '-o', 'IdentitiesOnly=yes', '-o', 'UserKnownHostsFile=' + this.knownHosts,
      '-o', 'HostKeyAlias=macshare', '-o', 'StrictHostKeyChecking=yes', '-p', String(Number(i.port) || 22), i.user + '@' + addr];
  }

  _writeCommand() {
    fs.mkdirSync(this.binDir, { recursive: true });
    const q = (a) => (/[\s"]/.test(a) ? '"' + a.replace(/"/g, '') + '"' : a);
    fs.writeFileSync(this.cmdFile, '@echo off\r\nrem TwinDesk: a shell on your paired Mac (written by the TwinDesk app)\r\n' +
      q(SSH) + ' ' + this.args().map(q).join(' ') + ' %*\r\n');
  }

  // Opens Windows Terminal (or a console) connected to the Mac.
  open() {
    if (this.status !== 'ready') return;
    this._writeCommand(); // the Mac's address may have changed
    const opts = { detached: true, stdio: 'ignore', windowsHide: false };
    const wt = spawn('wt.exe', ['--title', 'Mac', SSH, ...this.args()], opts);
    wt.on('error', () => spawn('cmd.exe', ['/c', 'start', 'Mac', this.cmdFile], { ...opts, shell: false }).unref());
    wt.unref();
  }

  // Put userData\bin on the user PATH so `macshare` works in new terminals (asked from the UI).
  async addToPath() {
    const d = this.binDir.replace(/'/g, "''");
    const ps = "$d = '" + d + "'; $p = [Environment]::GetEnvironmentVariable('Path','User'); " +
      "if (-not (($p -split ';') -contains $d)) { $n = if ($p) { $p.TrimEnd(';') + ';' + $d } else { $d }; [Environment]::SetEnvironmentVariable('Path', $n, 'User') }";
    try { await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', ps]); } catch (e) { this.message = 'Couldn’t change PATH: ' + e.message; }
    await this._checkPath();
  }

  async _checkPath() {
    try {
      const out = await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', "[Environment]::GetEnvironmentVariable('Path','User')"]);
      this.onPath = out.split(';').map((s) => s.trim().toLowerCase()).includes(this.binDir.toLowerCase());
    } catch (_) { this.onPath = false; }
    this.onChange();
  }

  _set(status, message) {
    this.status = status;
    this.message = message;
    this.onChange();
  }

  view() {
    return { status: this.status, message: this.message, user: this.info && this.info.user, onPath: this.onPath, command: this.cmdFile };
  }
}

function run(file, args) {
  return new Promise((resolve, reject) => {
    execFile(file, args, { windowsHide: true, timeout: 30000 }, (err, stdout, stderr) =>
      (err ? reject(new Error(String(stderr || err.message).trim().split('\n')[0])) : resolve(String(stdout))));
  });
}

module.exports = Terminal;
