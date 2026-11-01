// TwinDesk — Copyright (C) 2026 inukaasith. GPL-3.0, see LICENSE.
// Explorer's right-click › Send to
// gets "<peer name> (DuoDesk)", a shortcut in shell:sendto to `DuoDesk.exe --send-files`. Explorer
// appends the chosen paths; that copy of DuoDesk hands them to this one (second-instance) and they
// go with the Send files flow (filedrop.js, drop:'send'). The shortcut follows the paired computer's
// name and goes when nothing is paired; the uninstaller removes it too (installer.nsh).
'use strict';

const { app, shell } = require('electron');
const fs = require('fs');
const path = require('path');
const i18n = require('../shared/i18n.js');
const tr = (k, p, d) => i18n.t(k, p, d);

const ARG = '--send-files';
const SUFFIX = ' (DuoDesk).lnk';
const OLD_SUFFIXES = [' (MacShare).lnk', ' (TwinDesk).lnk']; // the app's old names: replaced by the new one

class SendTo {
  // opts: fileDrop, link, peerName() → name | '', popup(kind, text, sub)
  constructor(opts) {
    Object.assign(this, opts);
    this.dir = path.join(app.getPath('appData'), 'Microsoft', 'Windows', 'SendTo');
    this.name = null; // the peer name our shortcut has now ('' = none)
    this.pending = null; // {paths, until}: started with --send-files before the link was up
    this.link.on('welcome', () => {
      const p = this.pending;
      this.pending = null;
      if (p && Date.now() < p.until) this._send(p.paths);
    });
  }

  // Keep the shortcut in step with the paired computer's name (called with every state push).
  sync(peer) {
    const name = peer ? String(peer).replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').replace(/[. ]+$/, '').slice(0, 80) : '';
    if (name === this.name) return;
    this.name = name;
    try {
      for (const f of fs.readdirSync(this.dir)) {
        const old = OLD_SUFFIXES.some((s) => f.endsWith(s)) || (f.endsWith(SUFFIX) && f !== name + SUFFIX);
        if (old && this._ours(path.join(this.dir, f))) fs.rmSync(path.join(this.dir, f), { force: true });
      }
      if (!name) return;
      const args = (app.isPackaged ? [] : [app.getAppPath()]).map((x) => (/\s/.test(x) ? '"' + x + '"' : x)).concat(ARG).join(' ');
      const file = path.join(this.dir, name + SUFFIX);
      const ok = shell.writeShortcutLink(file, fs.existsSync(file) ? 'replace' : 'create', {
        target: process.execPath, args, description: 'Send to ' + name + ' with DuoDesk', icon: process.execPath, iconIndex: 0,
      });
      if (!ok) console.warn('[sendto] Windows refused the Send to shortcut');
    } catch (e) {
      console.warn('[sendto]', e.message);
    }
  }

  _ours(file) {
    try {
      return String(shell.readShortcutLink(file).args).includes(ARG);
    } catch (_) {
      return false;
    }
  }

  // A command line (ours at start, or a second instance's): true when it was a Send to.
  handle(argv) {
    const list = Array.isArray(argv) ? argv : [];
    const at = list.indexOf(ARG);
    if (at < 0) return false;
    // Chromium may move its own switches around, so take every existing absolute path after it.
    const skip = new Set([process.execPath, app.getAppPath()].map((x) => path.resolve(x).toLowerCase()));
    const paths = list.slice(at + 1).filter((a) => typeof a === 'string' && !a.startsWith('--') && path.win32.isAbsolute(a)
      && !skip.has(path.resolve(a).toLowerCase()) && fs.existsSync(a)).slice(0, 1000);
    if (!paths.length) return true;
    const who = this.peerName() || tr('main.the_other_computer', null, 'the other computer');
    if (this.link.status.state !== 'connected') {
      this.pending = { paths, until: Date.now() + 30000 }; // sent once the link is up
      this.popup('away', tr('sendto.not_connected_yet', null, 'Not connected yet'), tr('sendto.sending_once_connected', { name: who }, 'Sending once ' + who + ' is connected'));
      return true;
    }
    this._send(paths);
    return true;
  }

  _send(paths) {
    const r = this.fileDrop.sendBatch(paths, 'send');
    const who = this.peerName() || tr('main.the_other_computer', null, 'the other computer');
    if (!r) {
      const itemDesc = paths.length === 1 ? path.basename(paths[0]) : tr('sendto.those_items', null, 'those items');
      return this.popup('away', tr('sendto.nothing_to_send', null, 'Nothing to send'), tr('sendto.couldnt_read_item', { name: itemDesc }, 'Couldn’t read ' + itemDesc));
    }
    const n = r.items.length;
    const itemsDesc = n === 1 ? r.name : tr('sendto.n_items_other', { count: n }, n + ' items');
    this.popup('away', tr('sendto.sending_n_items_to', { items: itemsDesc, who }, 'Sending ' + itemsDesc + ' to ' + who));
  }
}

module.exports = SendTo;
