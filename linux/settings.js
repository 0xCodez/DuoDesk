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
  const keys = s.keys || {};
  const c = s.clipboard || {};
  const ui = s.ui || {};
  const mon = s.monitor || {};
  const setup = s.setup || {};
  return {
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
    monitor: { autoOpen: bool(mon.autoOpen, true), volume: Math.round(num(mon.volume, 1, 0, 1) * 100) / 100, mute: bool(mon.mute, false) },
    // "Skip for now" on the Setup screen: the missing items it was skipped for (shown again when
    // something else goes missing).
    setup: { skipped: Array.isArray(setup.skipped) ? setup.skipped.filter((x) => typeof x === 'string').slice(0, 10) : [] },
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
