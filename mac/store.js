// TwinDesk — Copyright (C) 2026 inukaasith. GPL-3.0, see LICENSE.
// JSON files in Electron's userData, written atomically (temp file + rename).
'use strict';

const fs = require('fs');
const path = require('path');

let baseDir = null;

function init(dir) {
  baseDir = dir;
  fs.mkdirSync(baseDir, { recursive: true });
}

function filePath(name) {
  return path.join(baseDir, name);
}

function read(name, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath(name), 'utf8'));
  } catch (e) {
    if (e.code !== 'ENOENT') console.error(`[store] ${name} unreadable, using defaults:`, e.message);
    return fallback;
  }
}

function write(name, data) {
  const target = filePath(name);
  const tmp = `${target}.${process.pid}.tmp`;
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, target);
}

// Settings with defaults from BUILD_PLAN.md "Settings and storage"; missing keys are filled in.
const DEFAULT_SETTINGS = {
  macId: null,
  macName: null,
  rev: 7, // settings revision: older files are upgraded once in loadSettings
  // `on` is reset to false at every start (revision 2). remote: the other computer may start/stop
  // sharing and switch Extend/Mirror (screen.ctl). pace: playback of shared screens, both
  // directions, the same on both computers (pair.sync): 'fast' (shown the moment it arrives) |
  // 'smooth' (about one frame of buffer, even motion).
  sharing: { on: false, displayId: null, audio: false, remote: true, pace: 'fast' },
  virtual: { enabled: true, width: 1920, height: 1080, hiDPI: false, hz: 60 },
  bitrateMbps: 30,
  streamInput: true, // accept mouse/keyboard from Monitor 2
  streamMaxHeight: 1080, // 0 = capture at the display's pixel size; else scale down (GPU) to this height
  kvm: {
    pcSide: 'right',
    mouse: true, // Cursor tab
    keyboard: true, // Keyboard tab
    driveOther: true,
    beDriven: true,
    resistancePx: 120,
    speed: 1.0,
    reverseScroll: false,
    linked: true, // mouse and keyboard sharing on (the hotkey's double-tap switches it); synced with the peer
    linkedBy: {}, // revision 7: the last `linked` per paired device id, restored on connect
    gestures: true, // revision 8: trackpad gestures work on the other computer (synced per pair)
    hotkeySwitch: false, // keyboard only (mouse off): double-tap the hotkey to move the keyboard over and back
  },
  keys: { swapCtrlCmd: true, hotkey: 'AltRight' }, // swap: keys from the PC, Ctrl -> Cmd, Win -> Control. hotkey: double-tap = everything home
  clipboard: {
    enabled: true,
    send: true, // this Mac -> PC
    receive: true, // PC -> this Mac
    mode: 'instant', // 'instant' (whenever you copy, the default since revision 7) | 'switch' (Monitor 2 focus, crossing)
    skipConcealed: true, // passwords from password managers
    maxKB: 256,
    historySize: 20, // memory only
  },
  ui: { tab: 'overview', setupSkipped: '' }, // setupSkipped: the missing items when Setup was skipped
  app: { openAtLogin: false, keepAwake: true, hud: true }, // phase 6; hud = popup when switching computers
  audio: { send: false, receive: false, muteLocal: false, volume: 1 }, // revision 2: independent, both ways
  terminal: { allowPc: false, connectPc: false }, // phase 8: PC -> Mac shell; Mac -> PC (`ssh macshare-pc`)
  files: { acceptDrops: true, folder: '', reveal: true, dragEdge: true, // phase 9: '' = Downloads; dragEdge = drag.policy
    shortcuts: true, copyKeys: 'Control+Alt+C', pasteKeys: 'Control+Alt+V' }, // revision 5: copy/paste files
  notifs: { send: false, receive: true, hideText: false, muted: [] }, // revision 5
  apps: { offer: true }, // phase 12: the PC can list and open this Mac's apps
  papps: { on: true }, // phase 13: PC apps on this Mac, each window here with its own Dock icon
  // phase 11: the other computer's screen in a window here; framegen: shared/framegen.js.
  receive: { on: true, fullScreen: false, input: true, framegen: false },
  wake: { peers: {} }, // revision 7: {deviceId: {name, macs, address, at}} from wol.info, for Wake
  pairSync: {}, // revision 7b: {deviceId: {feature: {out, in}}} two-way switches per pair (pairsync.js)
  smb: { connectPc: true, sharing: false, folder: '', secret: '' }, // phase 7; secret = safeStorage
};

function loadSettings() {
  const s = read('settings.json', {});
  if (s.sharing) s.sharing.on = false; // screen sharing never starts by itself
  const out = { ...DEFAULT_SETTINGS, ...s };
  for (const k of ['wake', 'sharing', 'virtual', 'kvm', 'keys', 'clipboard', 'ui', 'app', 'audio', 'terminal', 'files', 'smb', 'apps', 'receive', 'papps', 'notifs']) out[k] = { ...DEFAULT_SETTINGS[k], ...(s[k] || {}) };
  if ((s.rev || 0) < 7) { // revision 7: clipboard instant by default
    out.clipboard.mode = 'instant';
    out.rev = 7;
  }
  return out;
}

function saveSettings(s) {
  write('settings.json', s);
}

module.exports = { init, filePath, read, write, loadSettings, saveSettings };
