// TwinDesk — Copyright (C) 2026 inukaasith. GPL-3.0, see LICENSE.
// Display › PC → Mac: this PC's screen in a window on the Mac, controlled from there.
// Mirror shows an existing monitor; Extend adds an extra (virtual) screen (vdd.js).
'use strict';

UI.tab({
  id: 'pc-mac',
  group: 'Display',
  order: 11,
  title: 'Share screen',
  heading: '{me}’s screen on {name}',
  icon: 'display',
  color: 'linear-gradient(#5ac8fa, #0a84ff)',
  desc: 'See {me} in a window on the other computer.',
  master: { get: (s) => s.pcScreen.mode !== 'off', set: (v) => UI.api.setPcScreenMode(v ? 'mirror' : 'off') },
  badge: (s) => (s.pcScreen.status === 'live' ? 'on' : ''),
  build(body) {
    const { el, api } = UI;
    const t = (k, p, d) => (typeof window.t === 'function' ? window.t(k, p, d) : d !== undefined ? d : k);
    const set = (partial) => api.setPcScreen(partial);
    const mode = UI.segmented([
      { value: 'off', label: t('clipboard.off', null, 'Off') },
      { value: 'extend', label: t('share.extend', null, 'Extend') },
      { value: 'mirror', label: t('share.mirror', null, 'Mirror') },
    ], (v) => api.setPcScreenMode(v));
    const monitor = UI.select([], (v) => set({ monitor: v }));
    const extendSize = UI.select([
      { value: 'mac', label: t('share.same_as_the_other_screen', null, 'Same as the other screen') },
      { value: '1920x1080', label: '1920 × 1080' },
      { value: '2560x1440', label: '2560 × 1440' },
      { value: '3840x2160', label: '3840 × 2160' },
    ], (v) => set({ extendSize: v }));
    const streamSize = UI.select([
      { value: 1080, label: t('share.1080p_1920_1080_fastest', null, '1080p (1920 × 1080), fastest') },
      { value: 1440, label: t('share.1440p_2560_1440_sharper', null, '1440p (2560 × 1440), sharper') },
      { value: 0, label: t('share.full_size', null, 'Full size') },
    ], (v) => set({ maxHeight: Number(v) }));
    const quality = UI.select([
      { value: 10, label: t('share.low_10_mbps', null, 'Low, 10 Mbps') },
      { value: 20, label: t('share.medium_20_mbps', null, 'Medium, 20 Mbps') },
      { value: 30, label: t('share.high_30_mbps', null, 'High, 30 Mbps') },
      { value: 50, label: t('share.best_50_mbps_wired', null, 'Best, 50 Mbps (wired)') },
    ], (v) => set({ mbps: Number(v) }));
    const paceRow = UI.paceRow(); // One Playback setting, synced with the other computer
    const sound = UI.switch((v) => set({ sound: v }), { label: t('share.include_sound', null, 'Include sound') });
    const input = UI.switch((v) => set({ input: v }), { label: t('share.receive_input', null, 'Receive input') });
    const inputRow = UI.row(t('share.receive_input', null, 'Receive input'), '', [input]); // "Receive input from Mac" / "from PC2"
    const remote = UI.switch((v) => set({ remote: v }), { label: t('share.remote_start', null, 'Remote start') });
    const remoteRow = UI.row(t('share.let_the_other_computer_start', null, 'Let the other computer start and switch this screen'), '', [remote]); // screen.ctl

    const monitorRow = UI.row(t('share.display', null, 'Display'), '', [monitor]);
    const extendRow = UI.row(t('share.size', null, 'Size'), '', [extendSize]);
    const details = UI.details(['Status', 'Display', 'Picture', 'Speed', 'Round trip', 'Codec', 'Encoder', 'Frames dropped']);

    const installBtn = UI.button(t('share.install', null, 'Install'), () => api.installVdd(), 'small primary');
    const removeBtn = UI.button(t('share.remove', null, 'Remove'), () => api.removeVdd(), 'small');
    const driver = UI.row(t('share.duodesk_virtual_display', null, 'DuoDesk virtual display'), '', [installBtn, removeBtn]); // Extend's screen, from the Virtual Display Driver (vdd.js)
    const note = UI.note('bad', '');
    // No driver: Extend is greyed out; say why, with Install right there.
    const missingBtn = UI.button(t('share.install', null, 'Install'), () => api.installVdd(), 'small primary');
    const missing = el('div', { class: 'note warn' }, [el('span', { text: t('share.virtual_display_driver_not_installed', null, 'Virtual display driver not installed. Install it to use Extend.') }), missingBtn]);
    missing.style.alignItems = 'center';
    missing.style.justifyContent = 'space-between';

    body.append(
      missing,
      UI.card(t('share.screen', null, 'Screen'), [UI.row(t('share.mode', null, 'Mode'), '', [mode]), monitorRow, extendRow]),
      UI.card(t('clipboard.picture', null, 'Picture'), [UI.row(t('share.resolution', null, 'Resolution'), '', [streamSize]), UI.row(t('share.quality', null, 'Quality'), '', [quality]), paceRow], { cls: 'keep-on' }),
      UI.card(t('share.sound_and_control', null, 'Sound and control'), [UI.row(t('share.include_sound', null, 'Include sound'), '', [sound]), inputRow], { cls: 'keep-on' }),
      UI.card(t('nav.remote', null, 'Remote'), [remoteRow], { cls: 'keep-on' }),
      details,
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
      paceRow.render(s);
      sound.set(p.sound);
      input.set(p.input);
      remote.set(p.remote);

      const on = p.mode !== 'off';
      const st = p.status === 'live' && p.stats;
      const who = UI.peer(s).the;
      const mon = p.monitors.find((m) => m.id === p.monitor) || p.monitors.find((m) => /\(main\)$/.test(m.label)) || p.monitors[0];
      const state = !on ? t('clipboard.off', null, 'Off') : p.busy ? t('share.starting_the_extra_screen', null, 'Starting the extra screen…') : p.status === 'live' ? t('share.on_name', { name: who }, 'On {name}')
        : !connected ? t('share.waiting_for_name', { name: who }, 'Waiting for {name}') : !p.mac.accept ? t('share.ready_starts_when_name_opens', { name: who }, 'Ready, starts when {name} opens it') : t('sidebar.connecting', null, 'Connecting…');
      details.set({
        Status: p.error ? t('share.status_error', { status: state, error: p.error }, '{status}: {error}') : state,
        Display: !on ? '' : p.mode === 'extend' ? t('share.virtual_display_size', { width: p.extendPx[0], height: p.extendPx[1] }, 'DuoDesk virtual display, {width} × {height}') : mon ? mon.label : '',
        Picture: st ? `${st.width} × ${st.height}, ${st.fps} fps` : '',
        Speed: st ? (st.targetMbps ? t('share.mbps_sent_network_allows', { mbps: st.mbps, target: st.targetMbps }, '{mbps} Mbps sent, network allows {target}') : t('share.mbps_sent', { mbps: st.mbps }, '{mbps} Mbps sent')) : '',
        'Round trip': st && st.rttMs != null ? st.rttMs + ' ms' : '',
        Codec: st && st.codec ? st.codec.toUpperCase() : '',
        Encoder: st && st.encoder ? UI.codecImpl(st.encoder, st.hw) : '',
        'Frames dropped': st ? st.dropped || 0 : '',
      });

      missing.hidden = !v.checked || v.installed;
      missingBtn.disabled = !!v.busy;
      missingBtn.textContent = v.busy === 'install' ? t('share.installing', null, 'Installing…') : t('share.install', null, 'Install');
      installBtn.hidden = v.installed;
      installBtn.disabled = !!v.busy || !v.checked;
      installBtn.textContent = v.busy === 'install' ? t('share.installing', null, 'Installing…') : t('share.install', null, 'Install');
      removeBtn.hidden = !v.installed;
      removeBtn.disabled = !!v.busy || p.mode === 'extend';
      driver.setHint(v.busy === 'remove' ? t('files.removing', null, 'Removing…') : v.busy === 'install' ? t('share.installing', null, 'Installing…') : v.installed ? t('share.installed_adds_the_extra_screen', null, 'Installed. Adds the extra screen for Extend.') : t('share.adds_an_extra_screen_for', null, 'Adds an extra screen for Extend. Installs a display driver and asks for administrator rights once.'));
      inputRow.label.textContent = t('share.receive_input_from_name', { name: UI.peer(s).them }, 'Receive input from {name}');
      remoteRow.label.textContent = t('share.let_name_start_and_switch', { name: UI.peer(s).the }, 'Let {name} start and switch this screen');
      remoteRow.setHint(p.remote ? t('share.opening_the_screen_window_there', null, 'Opening the screen window there starts sharing; Extend and Mirror can be switched from there.') : '');
      note.set(v.message);
    };
  },
});
