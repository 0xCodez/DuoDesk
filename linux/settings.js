// MacShare — Copyright (C) 2026 MacShare contributors. GPL-3.0, see LICENSE.
// settings.json: defaults and validation (BUILD_PLAN "Settings and storage"), the parts of
// windows/settings.js the Linux app has so far. Every value from disk or the UI goes through
// normalize(), so main never stores anything out of range.
const P = require('../shared/protocol.js');

const TABS = ['overview', 'mac-pc', 'pc-mac', 'cursor', 'keyboard', 'clipboard', 'files', 'terminal', 'audio', 'apps', 'general'];

const bool = (v, d) => (typeof v === 'boolean' ? v : d);
const num = (v, d, min, max) => (Number.isFinite(Number(v)) && v !== null && v !== '' ? Math.min(max, Math.max(min, Number(v))) : d);

function normalize(s) {
  s = s || {};
  const kvm = s.kvm || {};
  const keys = s.keys || {};
  const c = s.clipboard || {};
  const ui = s.ui || {};
  const mon = s.monitor || {};
  const setup = s.setup || {};
  const appS = s.app || {};
  return {
    kvm: {
      mouse: bool(kvm.mouse, true),
      keyboard: bool(kvm.keyboard, true),
      driveOther: bool(kvm.driveOther, true),
      beDriven: bool(kvm.beDriven, true),
      resistancePx: Math.round(num(kvm.resistancePx, P.RESISTANCE_PX, 0, 400)),
      pcSide: P.SIDES.includes(kvm.pcSide) ? kvm.pcSide : null, // where this computer is, seen from the other one (kvm.layout)
      speed: Math.round(num(kvm.speed, 1.0, 0.25, 3) * 100) / 100,
      reverseScroll: bool(kvm.reverseScroll, false),
      linked: bool(kvm.linked, true), // cursor sharing on (the hotkey's double-tap switches it, kvm.link)
      // the last `linked` per paired device id, restored on connect
      linkedBy: kvm.linkedBy && typeof kvm.linkedBy === 'object'
        ? Object.fromEntries(Object.entries(kvm.linkedBy).filter(([, v]) => typeof v === 'boolean').slice(0, 50)) : {},
      gestures: bool(kvm.gestures, true), // the Mac's trackpad gestures done the Linux way
      hotkeySwitch: bool(kvm.hotkeySwitch, false), // keyboard only (Cursor off): double-tap moves the keyboard over and back
    },
    // hotkey: double-tap = cursor sharing off/on (docs/KVM.md "Hotkey (revision 4)")
    keys: { swapCtrlCmd: bool(keys.swapCtrlCmd, true), hotkey: P.HOTKEYS.includes(keys.hotkey) ? keys.hotkey : P.HOTKEY_WIN },
    clipboard: {
      enabled: bool(c.enabled, true),
      send: bool(c.send, true),
      receive: bool(c.receive, true),
      mode: c.mode === 'instant' ? 'instant' : 'switch',
      skipConcealed: bool(c.skipConcealed, true),
      maxKB: Math.round(num(c.maxKB, 256, 1, P.CLIP_MAX_BYTES / 1024)),
      historySize: Math.round(num(c.historySize, 20, 0, 100)),
    },
    monitor: { autoOpen: bool(mon.autoOpen, true), volume: Math.round(num(mon.volume, 1, 0, 1) * 100) / 100, mute: bool(mon.mute, false) },
    // "Skip for now" on the Setup screen: the missing items it was skipped for (shown again when
    // something else goes missing).
    setup: { skipped: Array.isArray(setup.skipped) ? setup.skipped.filter((x) => typeof x === 'string').slice(0, 10) : [] },
    app: { hud: bool(appS.hud, true) }, // popup when switching computers (docs/UI.md "Popups and the menu bar")
    ui: { tab: TABS.includes(ui.tab) ? ui.tab : 'overview' },
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
