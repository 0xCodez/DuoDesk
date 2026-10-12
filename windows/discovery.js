// MacShare — Copyright (C) 2026 MacShare contributors. GPL-3.0, see LICENSE.
// Listens for the Macs' UDP beacons and keeps the list of Macs on this network.
const dgram = require('dgram');
const P = require('../shared/protocol.js');

const STALE_MS = 10000;

class Discovery {
  constructor(onChange) {
    this.onChange = onChange;
    this.macs = new Map(); // id -> {id, name, address, port, fp, lastSeen}
    this.error = '';
    this.sock = null;
    this.timer = null;
  }

  start() {
    const sock = dgram.createSocket({ type: 'udp4', reuseAddr: true });
    this.sock = sock;
    sock.on('message', (buf, rinfo) => this._onBeacon(buf, rinfo));
    sock.on('error', (err) => {
      this.error = 'Discovery is off (' + err.code + '): use Add by IP.';
      console.error('[discovery]', err.message);
      try { sock.close(); } catch (e) { /* closed */ }
      this.onChange();
    });
    sock.bind(P.DISCOVERY_PORT);
    this.timer = setInterval(() => this._prune(), 1000);
  }

  stop() {
    clearInterval(this.timer);
    if (this.sock) try { this.sock.close(); } catch (e) { /* closed */ }
  }

  get(id) {
    return this.macs.get(id) || null;
  }

  list() {
    return [...this.macs.values()]
      .map(({ id, name, address, port, fp }) => ({ id, name, address, port, fp }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  _onBeacon(buf, rinfo) {
    let m;
    try {
      m = JSON.parse(buf.toString('utf8'));
    } catch (e) {
      return;
    }
    if (!m || m.t !== P.T.BEACON || m.v !== P.PROTOCOL_VERSION || typeof m.id !== 'string') return;
    const port = Number.isInteger(m.port) && m.port > 0 && m.port < 65536 ? m.port : P.PORT;
    const name = typeof m.name === 'string' && m.name ? m.name.slice(0, 100) : 'Mac';
    const fp = P.normFingerprint(m.fp);
    const old = this.macs.get(m.id);
    const changed = !old || old.name !== name || old.address !== rinfo.address || old.port !== port || old.fp !== fp;
    this.macs.set(m.id, { id: m.id, name, address: rinfo.address, port, fp, lastSeen: Date.now() });
    if (changed) this.onChange();
  }

  _prune() {
    const now = Date.now();
    let changed = false;
    for (const [id, mac] of this.macs) {
      if (now - mac.lastSeen > STALE_MS) {
        this.macs.delete(id);
        changed = true;
      }
    }
    if (changed) this.onChange();
  }
}

module.exports = Discovery;
