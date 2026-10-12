// MacShare — Copyright (C) 2026 MacShare contributors. GPL-3.0, see LICENSE.
// Display › Mac → PC: the Mac's screen in the Monitor 2 window. Sharing is switched on the Mac,
// so the switch here only shows it; this PC owns the window, the screen sound volume and F11/F9.
'use strict';

UI.tab({
  id: 'mac-pc',
  group: 'Display',
  order: 10,
  title: 'Mac → PC',
  heading: 'The Mac’s screen on this PC',
  icon: 'receive',
  color: 'linear-gradient(#5ac8fa, #0a84ff)',
  desc: 'The Mac’s screen in a window here — a second monitor you can control the Mac in.',
  master: { get: (s) => s.stream.state === 'on', set: () => {}, disabled: true },
  badge: (s) => (s.stream.state === 'on' ? 'on' : ''),
  build(body) {
    const { el, api } = UI;
    const shown = UI.row('Showing', '');
    const shownPill = el('span', { class: 'pill' });
    shown.querySelector('.controls').append(shownPill);
    const input = UI.row('Mouse and keyboard', '');
    const inputPill = el('span', { class: 'pill' });
    input.querySelector('.controls').append(inputPill);
    const openBtn = UI.button('Open Monitor 2', () => api.openMonitor(), 'primary');
    const autoOpen = UI.switch((v) => api.setMonitor({ autoOpen: v }), { label: 'Open automatically' });
    const volume = UI.slider({ min: 0, max: 1, step: 0.05, format: (v) => Math.round(v * 100) + '%' }, (v) => api.setMonitor({ volume: v }));
    const mute = UI.switch((v) => api.setMonitor({ mute: !v }), { label: 'Play screen sound' });
    const soundRow = UI.row('Screen sound', '', [mute, volume]);

    body.append(
      UI.card('Monitor 2 (this PC)', [
        shown,
        UI.row('Window', 'Drag it to any monitor. Closing it only hides it.', [openBtn]),
        UI.row('Open automatically', 'When the Mac starts sharing', [autoOpen]),
        soundRow,
        input,
      ]),
      UI.card('Shortcuts in Monitor 2', [
        UI.row('Full screen', 'Fills the monitor the window is on', [el('kbd', { text: 'F11' })]),
        UI.row('Video stats', 'Frame rate, bitrate, decoder and delays', [el('kbd', { text: 'F9' })]),
      ], { cls: 'keep-on' }),
      UI.card('Set on the Mac', [
        UI.row('Off / Extend / Mirror, size, quality, sound', 'In Display › Mac → PC of MacShare on the Mac. Screen sharing starts off each time the Mac app starts. Sharpest: Monitor 2 full screen on a monitor whose resolution matches the stream size.'),
      ], { cls: 'keep-on' }),
    );

    return (s) => {
      const st = s.stream;
      const on = st.state === 'on';
      const connected = s.link.state === 'connected';
      shown.label.textContent = on ? st.name : 'Not sharing';
      shown.setHint(on ? st.width + ' × ' + st.height + ' pixels' : connected ? 'Turn on screen sharing on the Mac.' : 'Connect to your Mac first.');
      shownPill.textContent = on ? 'Live' : connected ? 'Off' : 'Offline';
      shownPill.className = 'pill ' + (on ? 'good' : 'muted');
      openBtn.disabled = !connected;
      autoOpen.set(s.monitor.autoOpen);
      mute.set(!s.monitor.mute);
      volume.set(s.monitor.volume);
      soundRow.setHint(on && st.audio ? 'The Mac shares its sound with the screen.' : 'Plays when the Mac turns on “Share sound with the screen”.');
      const viewOnly = on && !s.macInput;
      inputPill.textContent = !on ? '—' : viewOnly ? 'View only' : 'On';
      inputPill.className = 'pill ' + (viewOnly ? 'bad' : on ? 'good' : 'muted');
      input.setHint(viewOnly ? 'Input is off on the Mac (“let the PC control it”), so Monitor 2 only shows the screen.'
        : 'Click into Monitor 2 to use the Mac. Windows keeps the Windows key, Alt+Tab, Alt+F4 and Ctrl+Alt+Del.');
    };
  },
});
