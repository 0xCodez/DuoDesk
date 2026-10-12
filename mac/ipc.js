// MacShare — Copyright (C) 2026 MacShare contributors. GPL-3.0, see LICENSE.
// Actions from the control window (and the menu bar): validate, save settings, apply.
'use strict';

const { ipcMain, shell, app, screen, dialog } = require('electron');
const P = require('../shared/protocol.js');
const store = require('./store');

const SETTINGS_URLS = {
  screen: 'x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture',
  accessibility: 'x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility',
  inputMonitoring: 'x-apple.systempreferences:com.apple.preference.security?Privacy_ListenEvent',
};
const TABS = ['overview', 'share', 'receive', 'cursor', 'keyboard', 'clipboard', 'files', 'terminal', 'audio', 'apps', 'general'];

const bool = (v) => !!v;
const clamp = (lo, hi, dflt) => (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : dflt;
};
const oneOf = (list, dflt) => (v) => (list.includes(v) ? v : dflt);

// Allowed keys and their validators, per settings group.
const SCHEMA = {
  virtual: { enabled: bool, width: (v) => Math.round(clamp(640, 3840, 1920)(v)), height: (v) => Math.round(clamp(480, 2160, 1080)(v)), hiDPI: bool, hz: oneOf([30, 60], 60) },
  kvm: {
    pcSide: oneOf(P.SIDES, 'right'), mouse: bool, keyboard: bool, driveOther: bool, beDriven: bool,
    resistancePx: (v) => Math.round(clamp(0, 400, 120)(v)), speed: clamp(0.25, 4, 1), reverseScroll: bool,
  },
  keys: { swapCtrlCmd: bool },
  app: { openAtLogin: bool, keepAwake: bool },
  audio: { send: bool, receive: bool, muteLocal: bool, volume: clamp(0, 1, 1) },
  terminal: { allowPc: bool, connectPc: bool },
  files: { acceptDrops: bool, reveal: bool, dragEdge: bool },
  smb: { connectPc: bool },
  apps: { offer: bool },
  receive: { on: bool, fullScreen: bool, input: bool },
  papps: { on: bool },
  clipboard: {
    enabled: bool, send: bool, receive: bool, mode: oneOf(['switch', 'instant'], 'switch'),
    skipConcealed: bool, maxKB: oneOf([16, 64, 256], 256), historySize: (v) => Math.round(clamp(0, 100, 20)(v)),
  },
};

function setupIpc(ctx) {
  const { settings, pushState } = ctx;

  function save() {
    store.saveSettings(settings);
    pushState();
  }

  function setGroup(group, partial) {
    const schema = SCHEMA[group];
    for (const [k, v] of Object.entries(partial || {})) if (schema[k]) settings[group][k] = schema[k](v);
    save();
  }

  const actions = {
    setSharing(on) {
      settings.sharing.on = !!on;
      save();
      if (on) ctx.displays.applyVirtual().then(() => ctx.stream.restart('sharing on'));
      else {
        ctx.stream.stop('off');
        ctx.input.releaseAll();
        ctx.displays.applyVirtual(); // removes the virtual display
      }
    },
    setStreamInput(on) {
      settings.streamInput = !!on;
      save();
      if (!on) ctx.input.releaseAll();
      ctx.server.sendToClient({ t: P.T.STREAM_INPUT, on: !!on }); // Windows goes view-only when off
    },
    // null = the MacShare virtual display
    selectDisplay(displayId) {
      settings.sharing.displayId = displayId == null ? null : Number(displayId);
      save();
      ctx.stream.restart('display selected');
    },
    // Extend: Monitor 2 is the MacShare virtual display. Mirror: it shows this Mac's main screen.
    setDisplayMode(mode) {
      if (mode === 'mirror') {
        settings.sharing.displayId = screen.getPrimaryDisplay().id;
        settings.virtual.enabled = false;
      } else {
        settings.sharing.displayId = null;
        settings.virtual.enabled = true;
      }
      save();
      ctx.displays.applyVirtual().then(() => ctx.stream.restart(`mode ${mode}`));
    },
    setVirtual(partial) {
      setGroup('virtual', partial);
      ctx.displays.applyVirtual();
    },
    setStreamMaxHeight(h) {
      settings.streamMaxHeight = [0, 1080, 1440, 2160].includes(Number(h)) ? Number(h) : 1080;
      save();
      ctx.stream.restart('stream size changed');
    },
    setBitrate(mbps) {
      settings.bitrateMbps = clamp(2, 100, 20)(mbps);
      save();
      ctx.stream.restart('bitrate changed');
    },
    setKvm(partial) {
      const prev = { ...settings.kvm };
      setGroup('kvm', partial);
      ctx.kvm.settingsChanged(prev);
    },
    setTerminal(partial) {
      const prev = settings.terminal.connectPc;
      setGroup('terminal', partial);
      ctx.terminal.applySettings();
      if (settings.terminal.connectPc !== prev) ctx.sshClient.applySettings();
    },
    openPcShell() {
      ctx.sshClient.openShell();
    },
    openSharingSettings() {
      shell.openExternal('x-apple.systempreferences:com.apple.Sharing-Settings.extension');
    },
    setFiles(partial) {
      setGroup('files', partial);
      ctx.fileSend.sendPolicy();
      ctx.kvm.config();
    },
    async pickDropFolder() {
      const r = await dialog.showOpenDialog({ properties: ['openDirectory', 'createDirectory'], buttonLabel: 'Use This Folder' });
      if (r.canceled || !r.filePaths[0]) return;
      settings.files.folder = r.filePaths[0];
      save();
    },
    resetDropFolder() {
      settings.files.folder = '';
      save();
    },
    revealDrop(index) {
      ctx.drop.reveal(Number(index));
    },
    setSmb(partial) {
      setGroup('smb', partial);
      if (settings.smb.connectPc) ctx.smb.mountPc();
      else ctx.smb.unmountPc();
    },
    // One switch: on = share the chosen folder (default ~/MacShare); off = stop sharing.
    setShareMac(on) {
      if (on) ctx.smb.startSharing();
      else ctx.smb.stopSharing();
    },
    async chooseShareFolder() {
      const r = await dialog.showOpenDialog({ properties: ['openDirectory', 'createDirectory'], buttonLabel: 'Share This Folder' });
      if (r.canceled || !r.filePaths[0]) return;
      if (settings.smb.sharing) await ctx.smb.stopSharing();
      settings.smb.folder = r.filePaths[0];
      save();
      ctx.smb.startSharing(r.filePaths[0]);
    },
    stopSharingFolder() {
      ctx.smb.stopSharing();
    },
    openPcShare() {
      ctx.smb.openPc();
    },
    setApps(partial) {
      setGroup('apps', partial);
      ctx.apps.applySettings();
    },
    setReceive(partial) {
      setGroup('receive', partial);
      ctx.pcView.applySettings();
    },
    setPcApps(partial) {
      setGroup('papps', partial);
      ctx.pcApps.applySettings();
    },
    listPcApps() {
      ctx.pcApps.list();
    },
    openPcApp(id) {
      ctx.pcApps.open(String(id));
    },
    showPcView() {
      ctx.pcView.show();
    },
    setAudio(partial) {
      setGroup('audio', partial);
      ctx.audio.applySettings();
    },
    // "Share sound with the screen" (Display › Mac → PC).
    setScreenSound(on) {
      settings.sharing.audio = !!on;
      save();
      ctx.stream.restart('screen sound');
    },
    setApp(partial) {
      setGroup('app', partial);
      ctx.login.apply(settings.app.openAtLogin);
      ctx.updateAwake();
    },
    setKeys(partial) {
      setGroup('keys', partial);
    },
    setClipboard(partial) {
      setGroup('clipboard', partial);
      ctx.clipboard.applySettings();
    },
    copyHistory(index) {
      ctx.clipboard.copyHistory(Number(index));
    },
    clearHistory() {
      ctx.clipboard.clearHistory();
    },
    setTab(tab) {
      if (!TABS.includes(tab)) return;
      settings.ui.tab = tab;
      store.saveSettings(settings); // no state push needed; the window already shows it
    },
    pairRespond(allow) {
      ctx.pairing.respond(!!allow);
    },
    forget(deviceId) {
      ctx.pairing.forget(String(deviceId));
      ctx.terminal.forget(String(deviceId));
    },
    openSettings(kind) {
      if (SETTINGS_URLS[kind]) shell.openExternal(SETTINGS_URLS[kind]);
    },
    relaunch() {
      app.relaunch();
      app.exit(0);
    },
  };

  ipcMain.handle('getState', () => ctx.state);
  for (const [name, fn] of Object.entries(actions)) ipcMain.on(name, (_e, arg) => fn(arg));
  return actions;
}

module.exports = { setupIpc, TABS };
