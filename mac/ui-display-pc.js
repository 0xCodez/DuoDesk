// MacShare — Copyright (C) 2026 MacShare contributors. GPL-3.0, see LICENSE.
// Display › PC → Mac: the PC's screen in a window on this Mac (phase 11). Same structure as
// Mac → PC; the PC picks what it shares, this Mac picks how it shows it.
'use strict';

UI.tab({
  id: 'receive',
  group: 'Display',
  order: 11,
  title: 'PC → Mac',
  heading: 'The PC’s screen on this Mac',
  icon: 'receive',
  phase: '11',
  desc: 'Show a screen of the PC in a window on this Mac, and control the PC from it.',
  color: 'linear-gradient(#5ac8fa, #0a84ff)',
  master: { get: () => false, set: () => {}, disabled: true },
  build(body) {
    const off = (label) => UI.switch(() => {}, { disabled: true, label });
    const seg = UI.segmented([{ value: 'extend', label: 'Extend' }, { value: 'mirror', label: 'Mirror' }], () => {});
    seg.set('mirror');
    seg.el.querySelectorAll('button').forEach((b) => { b.disabled = true; });
    body.append(
      UI.note('info', 'Coming in phase 11. The PC shares, this Mac shows it — the same way this Mac shares with the PC today.'),
      UI.card('Chosen on the PC', [
        UI.row('The Mac window shows', 'Extend needs the MacShare display driver on the PC (later). Mirror shows one of the PC’s monitors.', [seg]),
        UI.row('Share sound with the screen', 'Off by default for the lowest latency', [off('Share sound with the screen')]),
        UI.row('Let this Mac control the PC', 'Mouse and keyboard inside the window on this Mac', [off('Let this Mac control the PC')]),
      ], { cls: 'keep-on' }),
      UI.card('On this Mac', [
        UI.row('Show the PC’s screen in a window', '', [off('Show the PC screen')]),
        UI.row('Open full screen', '', [off('Open full screen')]),
      ], { cls: 'keep-on' }),
    );
  },
});
