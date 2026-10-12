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
  sharing: { on: true, displayId: null },
  virtual: { enabled: true, width: 1920, height: 1080, hiDPI: false, hz: 60 },
  bitrateMbps: 20,
  streamMaxHeight: 1080, // 0 = capture at the display's pixel size; else scale down (GPU) to this height
  kvm: {
    pcSide: 'right',
    driveOther: true,
    beDriven: true,
    resistancePx: 120,
    speed: 1.0,
    reverseScroll: false,
  },
};

function loadSettings() {
  const s = read('settings.json', {});
  const out = { ...DEFAULT_SETTINGS, ...s };
  for (const k of ['sharing', 'virtual', 'kvm']) out[k] = { ...DEFAULT_SETTINGS[k], ...(s[k] || {}) };
  return out;
}

function saveSettings(s) {
  write('settings.json', s);
}

module.exports = { init, filePath, read, write, loadSettings, saveSettings };
