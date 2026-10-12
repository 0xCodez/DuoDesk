// MacShare — Copyright (C) 2026 MacShare contributors. GPL-3.0, see LICENSE.
// Clipboard text sync (docs/KVM.md "Clipboard"): remembers what was last sent/received so
// only real changes travel.
const { clipboard } = require('electron');
const P = require('../shared/protocol.js');

class Clip {
  constructor(link) {
    this.link = link;
    this.lastSync = { sent: null, received: null };
    link.on(P.T.CLIP, (m) => {
      if (!P.clipAllowed(m.text)) return;
      clipboard.writeText(m.text);
      this.lastSync.received = m.text;
    });
  }

  // Send this PC's clipboard text if it changed since it was last sent or received.
  sendIfChanged() {
    const text = clipboard.readText();
    if (!text || text === this.lastSync.sent || text === this.lastSync.received) return;
    if (!P.clipAllowed(text)) return;
    if (this.link.send({ t: P.T.CLIP, text }) !== false) this.lastSync.sent = text;
  }

  request() {
    this.link.send({ t: P.T.CLIP_REQUEST });
  }
}

module.exports = Clip;
