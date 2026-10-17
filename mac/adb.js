// TwinDesk — Copyright (C) 2026 inukaasith. GPL-3.0, see LICENSE.
// The bundled adb (Android platform-tools), for the phone's wireless debugging: pairing with
// its code, connecting, shell commands, pushing scrcpy-server and port forwards. The built app has
// it in Resources/adb (build-app.sh); a dev run uses the Android SDK's or Homebrew's.
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile, spawn } = require('child_process');

function findAdb() {
  const candidates = [
    process.resourcesPath && path.join(process.resourcesPath, 'adb', 'adb'),
    path.join(__dirname, 'vendor', 'adb', 'adb'),
    path.join(os.homedir(), 'Library', 'Android', 'sdk', 'platform-tools', 'adb'),
    '/opt/homebrew/bin/adb',
    '/usr/local/bin/adb',
  ];
  return candidates.find((p) => p && fs.existsSync(p)) || null;
}

function findServer() {
  const candidates = [
    process.resourcesPath && path.join(process.resourcesPath, 'scrcpy-server'),
    path.join(__dirname, 'vendor', 'scrcpy-server'),
  ];
  return candidates.find((p) => p && fs.existsSync(p)) || null;
}

class Adb {
  constructor() {
    this.bin = findAdb();
    this.server = findServer();
  }

  get available() {
    return !!(this.bin && this.server);
  }

  run(args, { timeout = 15000, input } = {}) {
    return new Promise((resolve) => {
      if (!this.bin) return resolve({ code: -1, out: '', err: 'adb is missing' });
      const p = execFile(this.bin, args, { timeout, maxBuffer: 8 * 1024 * 1024 }, (err, out, errOut) => {
        resolve({ code: err ? (typeof err.code === 'number' ? err.code : -1) : 0, out: String(out || ''), err: String(errOut || (err && err.message) || '') });
      });
      if (input != null) p.stdin.end(input);
    });
  }

  // [{serial, state}]
  async devices() {
    const r = await this.run(['devices']);
    return r.out.split('\n').slice(1).map((l) => l.trim().split(/\s+/)).filter((p) => p.length >= 2).map(([serial, state]) => ({ serial, state }));
  }

  // Wireless debugging services the Mac's adb sees on the network:
  // [{name, type: 'pairing'|'connect', address, port}]
  async mdns() {
    const r = await this.run(['mdns', 'services'], { timeout: 5000 });
    const out = [];
    for (const l of r.out.split('\n')) {
      const m = /^(\S+)\s+_adb-tls-(pairing|connect)\._tcp\.?\s+([\d.]+):(\d+)/.exec(l.trim());
      if (m) out.push({ name: m[1], type: m[2], address: m[3], port: Number(m[4]) });
    }
    return out;
  }

  async pair(address, port, code) {
    const r = await this.run(['pair', `${address}:${port}`, String(code)], { timeout: 20000 });
    const text = `${r.out}${r.err}`;
    return { ok: /Successfully paired/i.test(text), text: text.trim() };
  }

  async connect(address, port) {
    const r = await this.run(['connect', `${address}:${port}`], { timeout: 10000 });
    const text = `${r.out}${r.err}`;
    return { ok: /connected to|already connected/i.test(text) && !/failed|unable|cannot/i.test(text), text: text.trim() };
  }

  disconnect(serial) {
    return this.run(['disconnect', serial], { timeout: 5000 });
  }

  shell(serial, command, opts) {
    return this.run(['-s', serial, 'shell', command], opts);
  }

  push(serial, local, remote) {
    return this.run(['-s', serial, 'push', local, remote], { timeout: 30000 });
  }

  // A local TCP port forwarded to an abstract socket on the phone; resolves to the port.
  async forward(serial, abstractName) {
    const r = await this.run(['-s', serial, 'forward', 'tcp:0', `localabstract:${abstractName}`]);
    const port = Number(r.out.trim());
    if (!port) throw new Error(`adb forward failed: ${r.err.trim() || r.out.trim()}`);
    return port;
  }

  unforward(serial, port) {
    return this.run(['-s', serial, 'forward', '--remove', `tcp:${port}`], { timeout: 5000 });
  }

  // A long-running shell command (scrcpy-server), as a child process.
  spawnShell(serial, command) {
    return spawn(this.bin, ['-s', serial, 'shell', command], { stdio: ['ignore', 'pipe', 'pipe'] });
  }
}

module.exports = { Adb };
