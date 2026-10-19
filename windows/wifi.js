// TwinDesk — Copyright (C) 2026 inukaasith. GPL-3.0, see LICENSE.
// Joining another device's Wi-Fi for a while (shared/netlink.js): a phone's Wi-Fi Direct group or
// another PC's access point. A temporary profile, connect, wait for an address; leaving deletes the
// profile and goes back to the network this PC was on. netsh output is localized: only the SSID
// lines (never translated) and interface GUIDs are read.
'use strict';

const { execFile } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const JOIN_MS = 45000;

function netsh(args) {
  return new Promise((resolve, reject) => {
    execFile('netsh', ['wlan', ...args], { windowsHide: true, timeout: 15000 }, (err, out) => {
      if (err) reject(new Error(String(out || err.message).trim().split(/\r?\n/).pop() || 'netsh failed'));
      else resolve(String(out));
    });
  });
}

const esc = (s) => s.replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]));
const hex = (s) => Buffer.from(s, 'utf8').toString('hex').toUpperCase();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// The SSID each Wi-Fi interface is on now ('' = none).
async function current() {
  const out = await netsh(['show', 'interfaces']);
  const m = out.match(/^\s*SSID\s*:\s*(.+)$/m);
  return m ? m[1].trim() : '';
}

class Wifi {
  constructor() {
    this.ok = false; // a Wi-Fi adapter exists
    this.joined = '';
    this.previous = '';
    netsh(['show', 'interfaces'])
      .then((out) => { this.ok = /[0-9a-f]{8}-[0-9a-f]{4}-/i.test(out); })
      .catch(() => {});
  }

  can() {
    return this.ok;
  }

  async join(ssid, pass) {
    this.previous = await current().catch(() => '');
    if (this.previous === ssid) this.previous = '';
    const xml = `<?xml version="1.0"?>
<WLANProfile xmlns="http://www.microsoft.com/networking/WLAN/profile/v1">
  <name>${esc(ssid)}</name>
  <SSIDConfig><SSID><hex>${hex(ssid)}</hex><name>${esc(ssid)}</name></SSID></SSIDConfig>
  <connectionType>ESS</connectionType>
  <connectionMode>manual</connectionMode>
  <MSM><security>
    <authEncryption><authentication>WPA2PSK</authentication><encryption>AES</encryption><useOneX>false</useOneX></authEncryption>
    <sharedKey><keyType>passPhrase</keyType><protected>false</protected><keyMaterial>${esc(pass)}</keyMaterial></sharedKey>
  </security></MSM>
</WLANProfile>`;
    const file = path.join(os.tmpdir(), `twindesk-wifi-${process.pid}.xml`);
    fs.writeFileSync(file, xml, { mode: 0o600 });
    try {
      await netsh(['add', 'profile', `filename=${file}`, 'user=current']);
    } finally {
      fs.rmSync(file, { force: true });
    }
    this.joined = ssid;
    const until = Date.now() + JOIN_MS;
    let tries = 0;
    while (Date.now() < until) {
      // The network may not be in the scan list yet (a group that just came up): ask again.
      if (tries++ % 5 === 0) await netsh(['connect', `name=${ssid}`, `ssid=${ssid}`]).catch(() => {});
      await sleep(1000);
      if ((await current().catch(() => '')) === ssid && this._hasAddress()) {
        await sleep(1500); // DHCP done; let the route settle before discovery looks
        return;
      }
    }
    await this.leave();
    throw new Error('Windows didn’t connect to it');
  }

  _hasAddress() {
    let wifi = false;
    for (const [name, list] of Object.entries(os.networkInterfaces())) {
      if (!/wi-?fi|wlan|wireless/i.test(name)) continue;
      wifi = true;
      if ((list || []).some((a) => a.family === 'IPv4' && !a.internal && !a.address.startsWith('169.254.'))) return true;
    }
    return !wifi; // a renamed adapter: connected is enough
  }

  async leave() {
    const ssid = this.joined;
    this.joined = '';
    if (!ssid) return;
    await netsh(['delete', 'profile', `name=${ssid}`]).catch(() => {});
    // Windows usually goes back by itself (auto-connect); asking makes it quick.
    if (this.previous) await netsh(['connect', `name=${this.previous}`]).catch(() => {});
    this.previous = '';
  }
}

module.exports = { Wifi };
