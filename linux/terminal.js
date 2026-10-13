// TwinDesk — Copyright (C) 2026 inukaasith. GPL-3.0, see LICENSE.
// Terminal, this computer → the other one (Linux version of
// windows/terminal.js): an ed25519 key made once, handed over the paired link (ssh.key); the other
// computer's host keys come back (ssh.info) and are pinned in our own known_hosts, so ssh never
// asks for a password or "trust this host?". Adds a `macshare` command (~/.local/bin) and opens
// the desktop's terminal emulator.
const { app } = require('electron');
const { execFile, spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const P = require('../shared/protocol.js');

const T = P.T;
const WHY = {
  remote_login_off: 'Remote Login is off on {name}.',
  not_allowed: '{Name} doesn’t allow shells from {me} (its Terminal tab).',
};
// Terminal emulators to try, best first: [command, args before the command to run].
const TERMINALS = [
  ['x-terminal-emulator', ['-e']], ['gnome-terminal', ['--']], ['kgx', ['--']], ['ptyxis', ['--']], ['konsole', ['-e']],
  ['xfce4-terminal', ['-x']], ['mate-terminal', ['-x']], ['tilix', ['-e']], ['kitty', []], ['alacritty', ['-e']],
  ['wezterm', ['start', '--']], ['foot', []], ['xterm', ['-e']],
];

const which = (cmd) => (process.env.PATH || '/usr/bin:/bin').split(':').some((d) => d && fs.existsSync(path.join(d, cmd)));

class Terminal {
  // opts: link, settings (shared), onChange()
  constructor(opts) {
    Object.assign(this, opts);
    this.dir = path.join(app.getPath('userData'), 'ssh');
    this.binDir = path.join(os.homedir(), '.local', 'bin');
    this.key = path.join(this.dir, 'macshare_ed25519');
    this.knownHosts = path.join(this.dir, 'known_hosts');
    this.cmdFile = path.join(this.binDir, 'macshare');
    this.info = null; // last ssh.info
    this.status = 'off';
    this.message = '';
    this.onPath = (process.env.PATH || '').split(':').includes(this.binDir);

    this.link.on('welcome', () => this.apply());
    this.link.on('closed', () => { this.info = null; this._set(this.cfg.enabled ? 'no_mac' : 'off', ''); });
    this.link.on(T.SSH_INFO, (m) => this._onInfo(m));
  }

  get cfg() {
    return this.settings.terminal;
  }

  get available() {
    return which('ssh') && which('ssh-keygen');
  }

  async apply() {
    if (!this.cfg.enabled) {
      if (this.info) this.link.send({ t: T.SSH_FORGET });
      this.info = null;
      return this._set('off', '');
    }
    if (!this.available) return this._set('error', 'The OpenSSH client is missing (sudo apt install openssh-client).');
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
      fs.mkdirSync(this.dir, { recursive: true, mode: 0o700 });
      await run('ssh-keygen', ['-q', '-t', 'ed25519', '-N', '', '-C', 'macshare@' + os.hostname(), '-f', this.key]);
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
    fs.mkdirSync(this.dir, { recursive: true, mode: 0o700 });
    fs.writeFileSync(this.knownHosts, keys.map((k) => 'macshare ' + k).join('\n') + '\n');
    this._writeCommand();
    this._set('ready', '');
  }

  // ssh arguments for the paired computer (its address can change; rebuilt each time).
  args() {
    const i = this.info;
    const addr = this.link.snapshot().link.address;
    return ['-i', this.key, '-o', 'IdentitiesOnly=yes', '-o', 'UserKnownHostsFile=' + this.knownHosts,
      '-o', 'HostKeyAlias=macshare', '-o', 'StrictHostKeyChecking=yes', '-p', String(Number(i.port) || 22), i.user + '@' + addr];
  }

  _writeCommand() {
    const q = (a) => "'" + String(a).replace(/'/g, "'\\''") + "'";
    try {
      fs.mkdirSync(this.binDir, { recursive: true });
      fs.writeFileSync(this.cmdFile, '#!/bin/sh\n# TwinDesk: a shell on your paired computer (written by the TwinDesk app)\nexec ssh ' +
        this.args().map(q).join(' ') + ' "$@"\n', { mode: 0o755 });
    } catch (e) {
      this.message = 'Couldn’t write the macshare command: ' + e.message;
    }
  }

  // Opens the desktop's terminal connected to the other computer.
  open() {
    if (this.status !== 'ready') return;
    this._writeCommand(); // the address may have changed
    const t = TERMINALS.find(([cmd]) => which(cmd));
    if (!t) { this.message = 'No terminal app found. Run macshare in any terminal.'; return this.onChange(); }
    const p = spawn(t[0], [...t[1], 'ssh', ...this.args()], { detached: true, stdio: 'ignore' });
    p.on('error', (e) => { this.message = 'Couldn’t open ' + t[0] + ': ' + e.message; this.onChange(); });
    p.unref();
  }

  // ~/.local/bin on PATH for new logins (most distributions already add it when it exists).
  async addToPath() {
    try {
      const f = path.join(os.homedir(), '.profile');
      const line = '\n# TwinDesk: the macshare command\n[ -d "$HOME/.local/bin" ] && case ":$PATH:" in *":$HOME/.local/bin:"*) ;; *) PATH="$HOME/.local/bin:$PATH" ;; esac\n';
      const cur = fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '';
      if (!cur.includes('TwinDesk: the macshare command')) fs.appendFileSync(f, line);
      this.onPath = true;
      this.message = 'Log out and back in once for new terminals to find macshare.';
    } catch (e) {
      this.message = 'Couldn’t change PATH: ' + e.message;
    }
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
    execFile(file, args, { timeout: 30000 }, (err, stdout, stderr) =>
      (err ? reject(new Error(String(stderr || err.message).trim().split('\n')[0])) : resolve(String(stdout))));
  });
}

module.exports = Terminal;
