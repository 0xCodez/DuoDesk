// MacShare — Copyright (C) 2026 MacShare contributors. GPL-3.0, see LICENSE.
// Linux checks for Setup and General (docs/LINUX.md): the desktop session (X11 needed for input
// sharing until the Wayland phase) and the firewall (ufw or firewalld must let 47800/tcp and
// 47801/udp in). Fix asks for the password once through pkexec.
'use strict';

const { execFile } = require('child_process');
const fs = require('fs');
const P = require('../shared/protocol.js');

const PORTS = { tcp: P.PORT, udp: P.DISCOVERY_PORT };

function run(cmd, args, timeout = 8000) {
  return new Promise((resolve) => {
    execFile(cmd, args, { timeout }, (err, stdout, stderr) => {
      resolve({ ok: !err, code: err ? (typeof err.code === 'number' ? err.code : -1) : 0, out: String(stdout || '').trim(), err: String(stderr || '').trim() });
    });
  });
}

// 'x11' | 'wayland' | 'unknown'; wsl: running in WSL (WSLg).
function session() {
  const t = String(process.env.XDG_SESSION_TYPE || '').toLowerCase();
  const type = t === 'x11' || t === 'wayland' ? t
    : process.env.WAYLAND_DISPLAY ? 'wayland' : process.env.DISPLAY ? 'x11' : 'unknown';
  let wsl = false;
  try { wsl = /microsoft/i.test(fs.readFileSync('/proc/version', 'utf8')); } catch (_) { /* not Linux */ }
  return { type, wsl, desktop: process.env.XDG_CURRENT_DESKTOP || '' };
}

// {ok, tool: 'ufw'|'firewalld'|'', message}. `fixed` = this app already ran the ufw fix (ufw's
// rules can't be read without root).
async function checkFirewall(fixed) {
  const ufw = await run('systemctl', ['is-active', 'ufw']);
  if (ufw.out === 'active') {
    return fixed ? { ok: true, tool: 'ufw', message: 'ufw lets MacShare in' }
      : { ok: false, tool: 'ufw', message: 'ufw is on and may block MacShare.' };
  }
  const fwd = await run('firewall-cmd', ['--state']);
  if (fwd.out === 'running') {
    const tcp = await run('firewall-cmd', ['--query-port=' + PORTS.tcp + '/tcp']);
    const udp = await run('firewall-cmd', ['--query-port=' + PORTS.udp + '/udp']);
    const ok = tcp.out === 'yes' && udp.out === 'yes';
    return { ok, tool: 'firewalld', message: ok ? 'firewalld lets MacShare in' : 'firewalld blocks MacShare.' };
  }
  return { ok: true, tool: '', message: 'No firewall is on' };
}

async function fixFirewall(tool) {
  const script = tool === 'firewalld'
    ? 'firewall-cmd --permanent --add-port=' + PORTS.tcp + '/tcp --add-port=' + PORTS.udp + '/udp && firewall-cmd --reload'
    : 'ufw allow ' + PORTS.tcp + '/tcp && ufw allow ' + PORTS.udp + '/udp';
  const r = await run('pkexec', ['sh', '-c', script], 120000);
  if (r.ok) return true;
  throw new Error(r.code === 126 ? 'the password prompt was closed' : r.err || 'pkexec failed');
}

module.exports = { session, checkFirewall, fixFirewall };
