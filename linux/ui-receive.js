// MacShare — Copyright (C) 2026 MacShare contributors. GPL-3.0, see LICENSE.
// Display › Mac → Linux (copied from windows/ui-receive.js): the Mac's screen in a window. Sharing is switched on the Mac,
// so the switch here only shows it; this computer owns the window, the screen sound volume and F11/F9.
'use strict';

UI.tab({
  id: 'mac-pc',
  group: 'Display',
  order: 10,
  title: 'Mac → Linux',
  heading: 'The Mac’s screen on this computer',
  icon: 'receive',
  color: 'linear-gradient(#5ac8fa, #0a84ff)',
  desc: 'See your Mac’s screen in a window here.',
  master: { get: (s) => s.stream.state === 'on', set: () => {}, disabled: true },
  badge: (s) => (s.stream.state === 'on' ? 'on' : ''),
  build(body) {
    const { el, api } = UI;
    const openBtn = UI.button('Open', () => api.openMonitor(), 'primary');
    const winRow = UI.row('Mac screen', '', [openBtn]);
    const autoOpen = UI.switch((v) => api.setMonitor({ autoOpen: v }), { label: 'Open automatically' });
    const volume = UI.slider({ min: 0, max: 1, step: 0.05, format: (v) => Math.round(v * 100) + '%' }, (v) => api.setMonitor({ volume: v }));
    const mute = UI.switch((v) => api.setMonitor({ mute: !v }), { label: 'Play sound' });

    const live = { status: UI.row('Status', ''), picture: UI.row('Picture', '') };
    const vals = Object.fromEntries(Object.entries(live).map(([k, r]) => {
      const v = el('span', { class: 'value' });
      r.querySelector('.controls').append(v);
      return [k, v];
    }));

    body.append(
      UI.card('', [
        winRow,
        UI.row('Open automatically', '', [autoOpen]),
        UI.row('Sound', '', [mute, volume]),
        UI.row('Full screen', '', [el('kbd', { text: 'F11' })]),
      ], { cls: 'keep-on' }),
      UI.card('Status', Object.values(live)),
    );

    return (s) => {
      const st = s.stream;
      const on = st.state === 'on';
      const connected = s.link.state === 'connected';
      openBtn.disabled = !connected;
      winRow.setHint(!connected ? 'Waiting for your Mac' : on ? 'Showing ' + st.name : 'Turn on sharing on your Mac');
      autoOpen.set(s.monitor.autoOpen);
      mute.set(!s.monitor.mute);
      volume.set(s.monitor.volume);
      vals.status.textContent = !connected ? 'Not connected' : !on ? 'Off' : s.macInput ? 'Live' : 'Live, view only';
      vals.picture.textContent = on ? st.width + ' × ' + st.height : '';
    };
  },
});
