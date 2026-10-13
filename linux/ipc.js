// MacShare — Copyright (C) 2026 MacShare contributors. GPL-3.0, see LICENSE.
// Main-window actions (preload-app.js → here), the parts of windows/ipc.js the Linux app has.
// Every value is validated by settings.apply().
const { app, ipcMain, clipboard } = require('electron');
const P = require('../shared/protocol.js');
const { apply } = require('./settings');

// ctx: link, discovery, screen, clip, settings, save(), push(), buildState(), checkFirewall(), fixFirewall()
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

  const pairWith = (d) => {
    discovery.clearInvite(d.id);
    link.startPairing({ address: d.address, port: d.port, macName: d.name });
  };
  handle('pair', (target) => {
    if (typeof target !== 'string' || !target.trim()) return;
    const found = discovery.get(target);
    if (found) pairWith(found);
  });
  // Connect by address: ask who is there (unicast probe works where broadcast is blocked); no
  // answer in PROBE_REPLY_MS → try WSS on that address directly ("No MacShare at …" if nothing).
  handle('connectAddress', async (text) => {
    const m = typeof text === 'string' && /^\s*([^\s:]+)(?::(\d{1,5}))?\s*$/.exec(text);
    if (!m) return;
    const d = m[2] ? null : await discovery.ask(m[1]);
    if (d) return pairWith(d);
    const port = m[2] ? Number(m[2]) : P.PORT;
    if (port >= 1 && port <= 65535) link.startPairing({ address: m[1], port, macName: m[1] });
  });
  handle('refreshFound', () => discovery.probe());
  handle('copyText', (text) => typeof text === 'string' && text.length < 1000 && clipboard.writeText(text));
  handle('confirmCode', () => link.confirmCode());
  handle('cancelPair', () => link.cancelPair());
  handle('forget', () => link.forget());
  handle('openMonitor', () => screen.open(false));

  handle('setKeys', (partial) => change('keys', partial));
  handle('setMonitor', (partial) => change('monitor', partial, () => screen.applyAudio()));
  handle('setClipboard', (partial) => change('clipboard', partial, () => clip.applySettings()));
  handle('copyHistory', (index) => clip.copyHistory(Number(index)));
  handle('clearHistory', () => clip.clearHistory());
  handle('setTab', (tab) => change('ui', { tab })); // invalid names fall back in normalize()
  handle('skipSetup', () => change('setup', { skipped: ctx.buildState().setup.missing }));
  handle('checkFirewall', () => ctx.checkFirewall());
  handle('fixFirewall', () => ctx.fixFirewall());
  handle('quit', () => app.quit());
}

module.exports = setupIpc;
