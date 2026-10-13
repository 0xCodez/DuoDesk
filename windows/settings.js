// MacShare — Copyright (C) 2026 MacShare contributors. GPL-3.0, see LICENSE.
// settings.json: defaults and validation (BUILD_PLAN "Settings and storage"). Every value from
// disk or from the UI goes through normalize(), so main never stores anything out of range.
const P = require('../shared/protocol.js');

const TABS = ['overview', 'mac-pc', 'pc-mac', 'cursor', 'keyboard', 'clipboard', 'files', 'terminal', 'audio', 'apps', 'general'];

const OLD_TABS = { display: 'mac-pc', receive: 'mac-pc', share: 'pc-mac' }; // names before revision 2

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
  const pcs = s.pcScreen || {};
  const pca = s.pcApps || {};
  const setup = s.setup || {};
  return {
    kvm: {
      mouse: bool(kvm.mouse, true),
      keyboard: bool(kvm.keyboard, true),
      driveOther: bool(kvm.driveOther, true),
      beDriven: bool(kvm.beDriven, true),
      resistancePx: Math.round(num(kvm.resistancePx, P.RESISTANCE_PX, 0, 400)),
      pcSide: P.SIDES.includes(kvm.pcSide) ? kvm.pcSide : null, // where this PC is, seen from the other computer (kvm.layout)
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
    monitor: { autoOpen: bool(mon.autoOpen, true), volume: Math.round(num(mon.volume, 1, 0, 1) * 100) / 100, mute: bool(mon.mute, false) },
    audio: {
      receive: bool(audio.receive, true), // play the Mac's sound here (audio.policy W→M)
      volume: Math.round(num(audio.volume, 1, 0, 1) * 100) / 100,
      send: bool(audio.send, false), // send this PC's sound to the Mac (dir w2m)
      muteLocal: bool(audio.muteLocal, false), // silence this PC while sending
    },
    terminal: {
      enabled: bool(term.enabled, false), // shell on the Mac from this PC
      allowMac: bool(term.allowMac, false), // let the Mac open a shell here (needs OpenSSH Server)
      installedKey: typeof term.installedKey === 'string' ? term.installedKey : '', // digest of the Mac key line we installed
    },
    files: {
      dropToMac: bool(files.dropToMac, true),
      shareOn: bool(files.shareOn, false), // set only by a successful share setup (smb.js)
      shareFolder: typeof files.shareFolder === 'string' ? files.shareFolder : '',
      mountMac: bool(files.mountMac, true),
      acceptFromMac: bool(files.acceptFromMac, true), // files dragged from the Mac across the edge
      edgeDrag: bool(files.edgeDrag, true), // drag files/folders across the screen edge, both ways (drag.policy)
    },
    pcScreen: { // Display › PC → Mac (phase 11); Off/Mirror/Extend itself is never saved
      monitor: typeof pcs.monitor === 'string' ? pcs.monitor : '', // Electron display id for Mirror ('' = main)
      mbps: [10, 20, 30, 50].includes(pcs.mbps) ? pcs.mbps : 20, // same presets as the Mac
      maxHeight: [0, 1080, 1440].includes(pcs.maxHeight) ? pcs.maxHeight : 1080, // stream size (0 = full pixels)
      extendSize: ['mac', '1920x1080', '2560x1440', '3840x2160'].includes(pcs.extendSize) ? pcs.extendSize : 'mac', // the virtual monitor
      sound: bool(pcs.sound, false), // the screen's sound in the same session
      input: bool(pcs.input, true), // the Mac's mouse and keyboard drive this PC
    },
    pcApps: { allow: bool(pca.allow, true) }, // phase 13: the Mac may open this PC's apps (it shows them only if it accepts)
    // Setup screen 'Skip for now': the missing items it was skipped for (shown again when
    // something else goes missing).
    setup: { skipped: Array.isArray(setup.skipped) ? setup.skipped.filter((x) => typeof x === 'string').slice(0, 10) : [] },
    ui: { tab: OLD_TABS[ui.tab] || (TABS.includes(ui.tab) ? ui.tab : 'overview') },
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
