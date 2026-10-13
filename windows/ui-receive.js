// MacShare — Copyright (C) 2026 MacShare contributors. GPL-3.0, see LICENSE.
// Display › Mac → PC: the Mac's screen in the Monitor 2 window. Sharing is switched on the Mac,
// so the switch here only shows it; this PC owns the window, the screen sound volume and F11/F9.
'use strict';

UI.tab({
  id: 'mac-pc',
  group: 'Display',
  order: 10,
  title: 'Receive screen',
  heading: 'The Mac’s screen on this PC',
  icon: 'receive',
  color: 'linear-gradient(#5ac8fa, #0a84ff)',
  desc: 'See the other computer’s screen in a window here.',
  master: { get: (s) => s.stream.state === 'on', set: () => {}, disabled: true },
  badge: (s) => (s.stream.state === 'on' ? 'on' : ''),
  build(body) {
    const { el, api } = UI;
    const openBtn = UI.button('Open', () => api.openMonitor(), 'primary');
    const winRow = UI.row('Screen window', '', [openBtn]);
    const autoOpen = UI.switch((v) => api.setMonitor({ autoOpen: v }), { label: 'Open automatically' });
    const volume = UI.slider({ min: 0, max: 1, step: 0.05, format: (v) => Math.round(v * 100) + '%' }, (v) => api.setMonitor({ volume: v }));
    const mute = UI.switch((v) => api.setMonitor({ mute: !v }), { label: 'Play sound' });

    const details = UI.details(['Status', 'Display', 'Picture', 'Speed', 'Round trip', 'Codec', 'Decoder', 'Delay', 'Frames dropped']);

    body.append(
      UI.card('', [
        winRow,
        UI.row('Open automatically', '', [autoOpen]),
        UI.row('Sound', '', [mute, volume]),
        UI.row('Full screen', '', [el('kbd', { text: 'F11' })]),
      ], { cls: 'keep-on' }),
      details,
    );

    return (s) => {
      const st = s.stream;
      const on = st.state === 'on';
      const connected = s.link.state === 'connected';
      openBtn.disabled = !connected;
      const who = UI.peer(s).the;
      winRow.setHint(!connected ? 'Waiting for ' + who : on ? 'Showing ' + st.name : 'Turn on sharing on ' + who);
      autoOpen.set(s.monitor.autoOpen);
      mute.set(!s.monitor.mute);
      volume.set(s.monitor.volume);
      const x = on && st.stats;
      details.set({
        Status: !connected ? 'Not connected' : !on ? 'Off' : s.macInput ? 'Live' : 'Live, view only',
        Display: on ? st.name + (st.width ? ', ' + st.width + ' × ' + st.height : x ? ', ' + x.width + ' × ' + x.height : '') : '',
        Picture: x ? x.width + ' × ' + x.height + ', ' + x.fps + ' fps' : '',
        Speed: x ? x.mbps + ' Mbps received' : '',
        'Round trip': x && x.rttMs != null ? x.rttMs + ' ms' : '',
        Codec: x ? x.codec.toUpperCase() : '',
        Decoder: x && x.decoder ? UI.codecImpl(x.decoder, x.hw) : '',
        Delay: x ? x.delayMs + ' ms' : '',
        'Frames dropped': x ? x.dropped : '',
      });
    };
  },
});
