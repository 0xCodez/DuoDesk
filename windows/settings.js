// MacShare — Copyright (C) 2026 MacShare contributors. GPL-3.0, see LICENSE.
// settings.json: defaults and validation (BUILD_PLAN "Settings and storage"). Every value from
// disk or from the UI goes through normalize(), so main never stores anything out of range.
const P = require('../shared/protocol.js');

const TABS = ['overview', 'share', 'receive', 'cursor', 'keyboard', 'clipboard', 'files', 'terminal', 'audio', 'apps', 'general'];

const bool = (v, d) => (typeof v === 'boolean' ? v : d);
const num = (v, d, min, max) => (Number.isFinite(Number(v)) && v !== null && v !== '' ? Math.min(max, Math.max(min, Number(v))) : d);

function normalize(s) {
  s = s || {};
  const kvm = s.kvm || {};
  const keys = s.keys || {};
  const c = s.clipboard || {};
  const ui = s.ui || {};
  const mon = s.monitor || {};
  const audio = s.audio || {};
  const term = s.terminal || {};
  const files = s.files || {};
  return {
    kvm: {
      mouse: bool(kvm.mouse, true),
      keyboard: bool(kvm.keyboard, true),
      driveOther: bool(kvm.driveOther, true),
      beDriven: bool(kvm.beDriven, true),
      resistancePx: Math.round(num(kvm.resistancePx, P.RESISTANCE_PX, 0, 400)),
      speed: Math.round(num(kvm.speed, 1.0, 0.25, 3) * 100) / 100,
      reverseScroll: bool(kvm.reverseScroll, false),
    },
    keys: { swapCtrlCmd: bool(keys.swapCtrlCmd, true) },
    clipboard: {
      enabled: bool(c.enabled, true),
      send: bool(c.send, true),
      receive: bool(c.receive, true),
      mode: c.mode === 'instant' ? 'instant' : 'switch',
      skipConcealed: bool(c.skipConcealed, true),
      maxKB: Math.round(num(c.maxKB, 256, 1, P.CLIP_MAX_BYTES / 1024)),
      historySize: Math.round(num(c.historySize, 20, 0, 100)),
    },
    monitor: { autoOpen: bool(mon.autoOpen, true) },
    audio: { receive: bool(audio.receive, true), volume: Math.round(num(audio.volume, 1, 0, 1) * 100) / 100 },
    terminal: { enabled: bool(term.enabled, false) },
    files: {
      dropToMac: bool(files.dropToMac, true),
      shareOn: bool(files.shareOn, false), // set only by a successful share setup (smb.js)
      shareFolder: typeof files.shareFolder === 'string' ? files.shareFolder : '',
      mountMac: bool(files.mountMac, true),
    },
    ui: { tab: ui.tab === 'display' ? 'share' : TABS.includes(ui.tab) ? ui.tab : 'overview' }, // 'display' = before the split
    windows: s.windows && typeof s.windows === 'object' ? s.windows : {},
  };
}

// Merge a partial change from the UI into one section and re-validate.
function apply(settings, section, partial) {
  if (!partial || typeof partial !== 'object' || !(section in settings)) return false;
  const next = normalize({ ...settings, [section]: { ...settings[section], ...partial } });
  const changed = JSON.stringify(next[section]) !== JSON.stringify(settings[section]);
  settings[section] = next[section];
  return changed;
}

module.exports = { normalize, apply };
