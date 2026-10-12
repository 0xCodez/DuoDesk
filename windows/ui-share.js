// MacShare — Copyright (C) 2026 MacShare contributors. GPL-3.0, see LICENSE.
// Display › PC → Mac (phase 11): this PC's screen in a window on the Mac, controlled from there.
// Mirror shows an existing monitor; Extend adds an extra (virtual) screen (vdd.js).
'use strict';

UI.tab({
  id: 'pc-mac',
  group: 'Display',
  order: 11,
  title: 'PC → Mac',
  heading: 'This PC’s screen on the Mac',
  icon: 'display',
  color: 'linear-gradient(#5ac8fa, #0a84ff)',
  desc: 'See this PC in a window on your Mac.',
  master: { get: (s) => s.pcScreen.mode !== 'off', set: (v) => UI.api.setPcScreenMode(v ? 'mirror' : 'off') },
  badge: (s) => (s.pcScreen.status === 'live' ? 'on' : ''),
  build(body) {
    const { el, api } = UI;
    const set = (partial) => api.setPcScreen(partial);
    const mode = UI.segmented([
      { value: 'off', label: 'Off' },
      { value: 'extend', label: 'Extend' },
      { value: 'mirror', label: 'Mirror' },
    ], (v) => api.setPcScreenMode(v));
    const monitor = UI.select([], (v) => set({ monitor: v }));
    const extendSize = UI.select([
      { value: 'mac', label: 'Same as the Mac' },
      { value: '1920x1080', label: '1920 × 1080' },
      { value: '2560x1440', label: '2560 × 1440' },
      { value: '3840x2160', label: '3840 × 2160' },
    ], (v) => set({ extendSize: v }));
    const streamSize = UI.select([
      { value: 1080, label: '1080p, fastest' },
      { value: 1440, label: '1440p, sharper' },
      { value: 0, label: 'Full size' },
    ], (v) => set({ maxHeight: Number(v) }));
    const quality = UI.select([
      { value: 10, label: 'Low' },
      { value: 20, label: 'Medium' },
      { value: 30, label: 'High' },
      { value: 50, label: 'Best (wired)' },
    ], (v) => set({ mbps: Number(v) }));
    const sound = UI.switch((v) => set({ sound: v }), { label: 'Include sound' });
    const input = UI.switch((v) => set({ input: v }), { label: 'Let the Mac control it' });

    const monitorRow = UI.row('Display', '', [monitor]);
    const extendRow = UI.row('Size', '', [extendSize]);
    const stats = { status: UI.row('Status', ''), picture: UI.row('Picture', ''), rate: UI.row('Bitrate', '') };
    const statVals = Object.fromEntries(Object.entries(stats).map(([k, row]) => {
      const v = el('span', { class: 'value' });
      row.querySelector('.controls').append(v);
      return [k, v];
    }));

    const installBtn = UI.button('Install', () => api.installVdd(), 'small primary');
    const removeBtn = UI.button('Remove', () => api.removeVdd(), 'small');
    const driver = UI.row('Extra screen', '', [installBtn, removeBtn]);
    const note = UI.note('bad', '');

    body.append(
      UI.card('Screen', [UI.row('Mode', '', [mode]), monitorRow, extendRow]),
      UI.card('Picture', [UI.row('Resolution', '', [streamSize]), UI.row('Quality', '', [quality])]),
      UI.card('Sound and control', [UI.row('Include sound', '', [sound]), UI.row('Let the Mac control it', '', [input])], { cls: 'keep-on' }),
      UI.card('Status', Object.values(stats)),
      UI.card('', [driver, note], { cls: 'keep-on' }),
    );

    return (s) => {
      const p = s.pcScreen;
      const v = p.vdd;
      const connected = s.link.state === 'connected';
      mode.set(p.mode);
      mode.el.querySelectorAll('button').forEach((b, i) => { b.disabled = p.busy || (i === 1 && !v.installed); });
      monitor.options(p.monitors.map((m) => ({ value: m.id, label: m.label })));
      monitor.set(p.monitor || (p.monitors.find((m) => /\(main\)$/.test(m.label)) || p.monitors[0] || { id: '' }).id);
      monitorRow.hidden = p.mode === 'extend';
      extendRow.hidden = p.mode !== 'extend';
      extendSize.set(p.extendSize);
      extendRow.setHint(p.extendSize === 'mac' ? p.extendPx[0] + ' × ' + p.extendPx[1] : '');
      streamSize.set(p.maxHeight);
      quality.set(p.mbps);
      sound.set(p.sound);
      input.set(p.input);

      const on = p.mode !== 'off';
      const st = p.status === 'live' && p.stats;
      statVals.status.textContent = !on ? 'Off' : p.busy ? 'Starting the extra screen…' : p.status === 'live' ? 'On the Mac'
        : !connected ? 'Waiting for your Mac' : !p.mac.accept ? 'Turned off on the Mac' : 'Connecting…';
      stats.status.setHint(p.error || '');
      statVals.picture.textContent = st ? `${st.width} × ${st.height}, ${st.fps} fps` : '';
      statVals.rate.textContent = st ? `${st.mbps} Mbps` : '';

      installBtn.hidden = v.installed;
      installBtn.disabled = !!v.busy || !v.checked;
      installBtn.textContent = v.busy === 'install' ? 'Installing…' : 'Install';
      removeBtn.hidden = !v.installed;
      removeBtn.disabled = !!v.busy || p.mode === 'extend';
      driver.setHint(v.busy === 'remove' ? 'Removing…' : v.installed ? '' : 'Needed for Extend. Asks for administrator rights once.');
      note.set(v.message);
    };
  },
});
