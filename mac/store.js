// MacShare — Copyright (C) 2026 MacShare contributors. GPL-3.0, see LICENSE.
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
  sharing: { on: false, displayId: null, audio: false }, // `on` is reset to false at every start (revision 2)
  virtual: { enabled: true, width: 1920, height: 1080, hiDPI: false, hz: 60 },
  bitrateMbps: 20,
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
  },
  keys: { swapCtrlCmd: true }, // keys from the PC: Ctrl -> Cmd, Win -> Control
  clipboard: {
    enabled: true,
    send: true, // this Mac -> PC
    receive: true, // PC -> this Mac
    mode: 'switch', // 'switch' (Monitor 2 focus, crossing) | 'instant' (whenever you copy)
    skipConcealed: true, // passwords from password managers
    maxKB: 256,
    historySize: 20, // memory only
  },
  ui: { tab: 'overview' },
  app: { openAtLogin: false, keepAwake: true }, // phase 6
  audio: { send: false, receive: false, muteLocal: false, volume: 1 }, // revision 2: independent, both ways
  terminal: { allowPc: false, connectPc: false }, // phase 8: PC -> Mac shell; Mac -> PC (`ssh macshare-pc`)
  files: { acceptDrops: true, folder: '', reveal: true }, // phase 9: '' = Downloads
  apps: { offer: true }, // phase 12: the PC can list and open this Mac's apps
  papps: { on: true }, // phase 13: PC apps on this Mac, each window here with its own Dock icon
  receive: { on: true, fullScreen: false, input: true }, // phase 11: the PC's screen in a window here
  smb: { connectPc: true, sharing: false, folder: '', secret: '' }, // phase 7; secret = safeStorage
};

function loadSettings() {
  const s = read('settings.json', {});
  if (s.sharing) s.sharing.on = false; // screen sharing never starts by itself
  const out = { ...DEFAULT_SETTINGS, ...s };
  for (const k of ['sharing', 'virtual', 'kvm', 'keys', 'clipboard', 'ui', 'app', 'audio', 'terminal', 'files', 'smb', 'apps', 'receive', 'papps']) out[k] = { ...DEFAULT_SETTINGS[k], ...(s[k] || {}) };
  return out;
}

function saveSettings(s) {
  write('settings.json', s);
}

module.exports = { init, filePath, read, write, loadSettings, saveSettings };
