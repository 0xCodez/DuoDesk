// MacShare — Copyright (C) 2026 MacShare contributors. GPL-3.0, see LICENSE.
// UDP beacon sender: every BEACON_MS to each interface's broadcast address and 255.255.255.255.
'use strict';

const dgram = require('dgram');
const os = require('os');
const P = require('../shared/protocol.js');

function ipToInt(ip) {
  return ip.split('.').reduce((n, o) => ((n << 8) | Number(o)) >>> 0, 0);
}

function intToIp(n) {
  return [24, 16, 8, 0].map((s) => (n >>> s) & 255).join('.');
}

// Non-internal IPv4 interfaces: [{address, broadcast}]
function interfaces() {
  const out = [];
  for (const list of Object.values(os.networkInterfaces())) {
    for (const i of list || []) {
      if (i.family !== 'IPv4' || i.internal) continue;
      const bc = (ipToInt(i.address) | ~ipToInt(i.netmask)) >>> 0;
      out.push({ address: i.address, broadcast: intToIp(bc) });
    }
  }
  return out;
}

function start({ macId, macName, fp }) {
  const sock = dgram.createSocket({ type: 'udp4', reuseAddr: true });
  const loggedErrors = new Set();
  let timer = null;
  const payload = Buffer.from(
    JSON.stringify({ t: P.T.BEACON, v: P.PROTOCOL_VERSION, id: macId, name: macName, port: P.PORT, fp }),
  );

  const logOnce = (target, err) => {
    const key = `${target}:${err.code || err.message}`;
    if (loggedErrors.has(key)) return;
    loggedErrors.add(key);
    console.error(`[discovery] send to ${target} failed: ${err.code || err.message}`);
  };

  const send = () => {
    const targets = new Set(interfaces().map((i) => i.broadcast));
    targets.add('255.255.255.255');
    for (const target of targets) {
      sock.send(payload, P.DISCOVERY_PORT, target, (err) => err && logOnce(target, err));
    }
  };

  sock.on('error', (err) => logOnce('socket', err));
  sock.bind(() => {
    sock.setBroadcast(true);
    send();
    timer = setInterval(send, P.BEACON_MS);
  });

  return {
    stop() {
      clearInterval(timer);
      try { sock.close(); } catch {}
    },
  };
}

module.exports = { start, interfaces };
