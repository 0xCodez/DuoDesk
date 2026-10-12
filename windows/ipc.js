// MacShare — Copyright (C) 2026 MacShare contributors. GPL-3.0, see LICENSE.
// Main-window actions (preload-app.js → here). Every value is validated by settings.apply().
const { ipcMain } = require('electron');
const P = require('../shared/protocol.js');
const { apply } = require('./settings');

// ctx: link, discovery, screen, clip, settings, save(), push(), buildState()
function setupIpc(ctx) {
  const { link, discovery, screen, clip, settings } = ctx;

  const handle = (name, fn) => ipcMain.handle(name, (_e, ...args) => fn(...args));
  const change = (section, partial, after) => {
    if (!apply(settings, section, partial)) return;
    ctx.save();
    if (after) after();
    ctx.push();
  };

  handle('getState', () => ctx.buildState());

  handle('pair', (target) => {
    if (typeof target !== 'string' || !target.trim()) return;
    const mac = discovery.get(target);
    if (mac) return link.startPairing({ address: mac.address, port: mac.port, macName: mac.name });
    const m = /^\s*([^\s:]+)(?::(\d{1,5}))?\s*$/.exec(target);
    if (!m) return;
    const port = m[2] ? Number(m[2]) : P.PORT;
    if (port < 1 || port > 65535) return;
    link.startPairing({ address: m[1], port, macName: m[1] });
  });
  handle('confirmCode', () => link.confirmCode());
  handle('cancelPair', () => link.cancelPair());
  handle('forget', () => link.forget());
  handle('openMonitor', () => screen.open(false));

  handle('setKvm', (partial) => change('kvm', partial)); // behaviour in phases 4–5
  handle('setKeys', (partial) => change('keys', partial));
  handle('setMonitor', (partial) => change('monitor', partial));
  handle('setClipboard', (partial) => change('clipboard', partial, () => clip.applySettings()));
  handle('copyHistory', (index) => clip.copyHistory(Number(index)));
  handle('clearHistory', () => clip.clearHistory());
  handle('setTab', (tab) => change('ui', { tab })); // invalid names fall back in normalize()
}

module.exports = setupIpc;
