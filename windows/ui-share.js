// MacShare — Copyright (C) 2026 MacShare contributors. GPL-3.0, see LICENSE.
// Display › PC → Mac (phase 11): this PC's screen in a window on the Mac, controlled from there.
// Mirror shows an existing monitor; Extend adds a virtual monitor (Virtual Display Driver, vdd.js).
'use strict';

UI.tab({
  id: 'pc-mac',
  group: 'Display',
  order: 11,
  title: 'PC → Mac',
  heading: 'This PC’s screen on the Mac',
  icon: 'display',
  color: 'linear-gradient(#5ac8fa, #0a84ff)',
  desc: 'Show this PC’s screen in a window on the Mac, and control the PC from there.',
  master: { get: (s) => s.pcScreen.mode !== 'off', set: (v) => UI.api.setPcScreenMode(v ? 'mirror' : 'off') },
  badge: (s) => (s.pcScreen.status === 'live' ? 'on' : ''),
  build(body) {
    const { el, api } = UI;
    const set = (partial) => api.setPcScreen(partial);
    const mode = UI.segmented([
      { value: 'off', label: 'Off' },
      { value: 'extend', label: 'Extend', title: 'A new, virtual monitor that only the Mac shows' },
      { value: 'mirror', label: 'Mirror', title: 'Show one of this PC’s monitors' },
    ], (v) => api.setPcScreenMode(v));
    const monitor = UI.select([], (v) => set({ monitor: v }));
    // Same choices as the Mac's Display › Mac → PC.
    const quality = UI.select([
      { value: 10, label: '10 Mbps — slow Wi-Fi' },
      { value: 20, label: '20 Mbps — Wi-Fi' },
      { value: 30, label: '30 Mbps — fast Wi-Fi (5 GHz)' },
      { value: 50, label: '50 Mbps — Ethernet' },
    ], (v) => set({ mbps: Number(v) }));
    const streamSize = UI.select([
      { value: 1080, label: '1080p — lowest latency' },
      { value: 1440, label: '1440p — sharper, ~20 ms slower' },
      { value: 0, label: 'Full pixels — 4K adds ~30–60 ms' },
    ], (v) => set({ maxHeight: Number(v) }));
    const extendSize = UI.select([
      { value: 'mac', label: 'Match the Mac' },
      { value: '1920x1080', label: '1920 × 1080' },
      { value: '2560x1440', label: '2560 × 1440' },
      { value: '3840x2160', label: '3840 × 2160 (4K)' },
    ], (v) => set({ extendSize: v }));
    const extendRow = UI.row('Size', '', [extendSize]);
    const stats = {
      picture: UI.row('Picture', ''),
      rate: UI.row('Bitrate', ''),
      enc: UI.row('Encoder', ''),
      delay: UI.row('Network delay', ''),
    };
    const statVals = Object.fromEntries(Object.entries(stats).map(([k, row]) => {
      const v = el('span', { class: 'value' });
      row.querySelector('.controls').append(v);
      return [k, v];
    }));
    const sound = UI.switch((v) => set({ sound: v }), { label: 'Share sound with the screen' });
    const input = UI.switch((v) => set({ input: v }), { label: 'Let the Mac control it' });
    const live = UI.row('', '');
    const livePill = el('span', { class: 'pill' });
    live.querySelector('.controls').append(livePill);
    const monitorRow = UI.row('Monitor', 'Which monitor Mirror shows', [monitor]);

    const installBtn = UI.button('Install display driver', () => api.installVdd(), 'primary');
    const removeBtn = UI.button('Remove', () => api.removeVdd(), 'small');
    const driver = UI.row('Display driver', '', [installBtn, removeBtn]);
    const note = UI.note('bad', '');

    body.append(
      UI.card('This PC shares (this PC)', [
        UI.row('Share', 'Starts off every time MacShare starts', [mode]),
        live,
        monitorRow,
        extendRow,
        UI.row('Stream size', 'Bigger monitors are scaled down on the GPU, so text stays smooth.', [streamSize]),
        UI.row('Quality', 'H.264 at up to 60 fps; frames are dropped rather than queued, for low latency.', [quality]),
        UI.row('Share sound with the screen', 'In sync with the picture. Off = no sound track; the Audio tab sends sound on its own', [sound]),
        UI.row('Let the Mac control it', 'Mouse and keyboard in the Mac’s window drive this PC', [input]),
      ]),
      UI.card('Stream', Object.values(stats)),
      UI.card('Extend: a virtual monitor', [
        driver,
        note,
        UI.row('How it works', 'The open-source Virtual Display Driver (MIT, signed by SignPath Foundation) adds a monitor that only exists while Extend is on, sized to the Mac’s window. Installing it asks for administrator rights once; switching it on and off doesn’t. Arrange it in Windows Settings › Display like any monitor.'),
      ], { cls: 'keep-on' }),
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
      quality.set(p.mbps);
      streamSize.set(p.maxHeight);
      extendSize.set(p.extendSize);
      extendRow.hidden = p.mode !== 'extend';
      extendRow.setHint('The virtual monitor’s resolution — now ' + p.extendPx[0] + ' × ' + p.extendPx[1] + (p.extendSize === 'mac' && !p.mac.width ? ' (the Mac hasn’t asked for a size)' : ''));
      const st = p.status === 'live' && p.stats;
      statVals.picture.textContent = st ? `${st.width} × ${st.height} · ${st.fps} fps` : '—';
      statVals.rate.textContent = st ? `${st.mbps} of ${st.targetMbps || '?'} Mbps` : '—';
      statVals.enc.textContent = st ? `${st.codec || '?'} ${st.encoder || ''} · QP ${st.qp || '–'} · ${st.encodeMs} ms${st.limit && st.limit !== 'none' ? ' · limited by ' + st.limit : ''}` : '—';
      statVals.delay.textContent = st && st.rttMs != null ? `≈ ${Math.max(1, Math.round(st.rttMs / 2))} ms one way` : '—';
      sound.set(p.sound);
      input.set(p.input);

      const on = p.mode !== 'off';
      live.label.textContent = !on ? 'Not sharing' : p.busy ? 'Switching on the virtual monitor…'
        : p.status === 'live' ? 'On the Mac — ' + p.width + ' × ' + p.height
          : !connected ? 'Waiting for the Mac' : !p.mac.accept ? 'The Mac isn’t showing it' : 'Starting…';
      live.setHint(p.error || (on && connected && !p.mac.accept ? 'Turn on Display › PC → Mac in MacShare on the Mac.' : on && p.name ? p.name : ''));
      livePill.textContent = p.status === 'live' ? 'Live' : on ? 'On' : 'Off';
      livePill.className = 'pill ' + (p.status === 'live' ? 'good' : 'muted');

      installBtn.hidden = v.installed;
      installBtn.disabled = !!v.busy || !v.checked;
      installBtn.textContent = v.busy === 'install' ? 'Installing…' : 'Install display driver';
      removeBtn.hidden = !v.installed;
      removeBtn.disabled = !!v.busy || p.mode === 'extend';
      driver.setHint(!v.checked ? 'Checking…' : v.busy === 'remove' ? 'Removing…' : v.installed ? (v.on ? 'Installed — the virtual monitor is on' : 'Installed — the virtual monitor is off') : 'Needed for Extend (one administrator prompt)');
      note.set(v.message);
    };
  },
});
