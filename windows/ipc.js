// MacShare — Copyright (C) 2026 MacShare contributors. GPL-3.0, see LICENSE.
// Main-window actions (preload-app.js → here). Every value is validated by settings.apply().
const { ipcMain, dialog, shell, BrowserWindow } = require('electron');
const P = require('../shared/protocol.js');
const { apply } = require('./settings');

// ctx: link, discovery, screen, clip, kvm, terminal, fileDrop, smb, apps, settings, save(), push(), buildState(),
//      checkFirewall(), fixFirewall(), setStartup(on)
function setupIpc(ctx) {
  const { link, discovery, screen, clip, kvm, terminal, fileDrop, smb, apps, settings } = ctx;

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

  handle('setKvm', (partial) => change('kvm', partial, () => kvm.applyConfig()));
  handle('setKeys', (partial) => change('keys', partial));
  handle('setMonitor', (partial) => change('monitor', partial));
  handle('setClipboard', (partial) => change('clipboard', partial, () => clip.applySettings()));
  handle('copyHistory', (index) => clip.copyHistory(Number(index)));
  handle('clearHistory', () => clip.clearHistory());
  handle('setTab', (tab) => change('ui', { tab })); // invalid names fall back in normalize()
  handle('setAudio', (partial) => change('audio', partial, () => screen.applyAudio()));
  handle('setTerminal', (partial) => change('terminal', partial, () => terminal.apply()));
  handle('openTerminal', () => terminal.open());
  handle('addToPath', () => terminal.addToPath());
  handle('setFiles', (partial) => {
    // shareOn/shareFolder only change through share()/unshare()
    const p = partial && typeof partial === 'object' ? { dropToMac: partial.dropToMac, mountMac: partial.mountMac } : {};
    Object.keys(p).forEach((k) => p[k] === undefined && delete p[k]);
    change('files', p, () => smb.applyMount());
  });
  handle('shareFolder', async () => {
    const win = BrowserWindow.getFocusedWindow();
    const r = await dialog.showOpenDialog(win, { title: 'Folder to share with the Mac', properties: ['openDirectory'] });
    if (!r.canceled && r.filePaths[0]) await smb.share(r.filePaths[0]);
  });
  handle('unshareFolder', () => smb.unshare());
  handle('openMacDrive', () => smb.drive && shell.openPath(smb.drive + '\\'));
  handle('cancelDrop', () => fileDrop.cancel());
  handle('listApps', () => apps.refresh());
  handle('launchApp', (id) => { apps.launch(id); screen.ensureHidden(); });
  handle('checkFirewall', () => ctx.checkFirewall());
  handle('fixFirewall', () => ctx.fixFirewall());
  handle('setStartup', (on) => ctx.setStartup(on === true));
}

module.exports = setupIpc;
