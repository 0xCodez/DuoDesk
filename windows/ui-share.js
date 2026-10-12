// MacShare — Copyright (C) 2026 MacShare contributors. GPL-3.0, see LICENSE.
// Display › PC → Mac: this PC's screen in a window on the Mac (phase 11). The controls are in their
// final place, disabled until it is built. Extend needs a PC display driver (later).
'use strict';

UI.tab({
  id: 'pc-mac',
  group: 'Display',
  order: 11,
  title: 'PC → Mac',
  heading: 'This PC’s screen on the Mac',
  icon: 'display',
  color: 'linear-gradient(#5ac8fa, #0a84ff)',
  phase: '11',
  desc: 'Show this PC’s screen in a window on the Mac, and control the PC from there.',
  master: { get: () => false, set: () => {}, disabled: true },
  build(body) {
    const { el } = UI;
    const mode = UI.segmented([
      { value: 'off', label: 'Off' },
      { value: 'extend', label: 'Extend', title: 'Needs the PC display driver — coming later' },
      { value: 'mirror', label: 'Mirror' },
    ], () => {});
    mode.set('off');
    mode.el.querySelectorAll('button').forEach((b) => { b.disabled = true; });
    const off = (label) => UI.switch(() => {}, { disabled: true, label });
    const monitor = UI.select([{ value: 'main', label: 'Main monitor' }], () => {});
    monitor.el.disabled = true;
    const quality = UI.select([{ value: 20, label: '20 Mbps' }], () => {});
    quality.el.disabled = true;
    body.append(
      el('div', { class: 'card soon keep-on' }, [
        el('div', { class: 'soon-head' }, [el('span', { class: 'pill', text: 'Coming in phase 11' })]),
        el('div', { class: 'soon-item' }, [el('strong', { text: 'Like Monitor 2, the other way round' }), el('div', { class: 'hint', text: 'This PC captures and encodes its screen; the Mac shows it in a window and its mouse and keyboard control the PC.' })]),
      ]),
      UI.card('This PC shares (this PC)', [
        UI.row('Share', 'Starts off every time MacShare starts', [mode]),
        UI.row('Extend', 'A new, virtual monitor for this PC that only the Mac shows — needs a PC display driver (coming later)'),
        UI.row('Monitor', 'Which monitor Mirror shows', [monitor]),
        UI.row('Quality', '', [quality]),
        UI.row('Share sound with the screen', 'Off = no sound track (lowest latency); the Audio tab sends sound on its own', [off('Share sound')]),
        UI.row('Let the Mac control it', 'Mouse and keyboard in the Mac’s window drive this PC', [off('Let the Mac control it')]),
      ]),
    );
  },
});
