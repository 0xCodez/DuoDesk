// TwinDesk — Copyright (C) 2026 inukaasith. GPL-3.0, see LICENSE.
// Share screen (copy of windows/ui-share.js): this computer's screen in a window on the
// other computer, controlled from there. Mirror shows an existing monitor; Extend adds an extra
// (virtual) screen (vdd.js: Mutter's on GNOME Wayland, a spare output on X11, which needs the
// helper Install puts in once). On Wayland the desktop asks which screen to share each time sharing starts.
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
    // The details card keys its rows by label, so the translated labels are also the keys of details.set.
    const L = {
      status: t('share.status', null, 'Status'), display: t('share.display', null, 'Display'), picture: t('clipboard.picture', null, 'Picture'), speed: t('share.speed', null, 'Speed'),
      rtt: t('share.round_trip', null, 'Round trip'), codec: t('share.codec', null, 'Codec'), encoder: t('share.encoder', null, 'Encoder'), dropped: t('share.frames_dropped', null, 'Frames dropped'),
    };
    const details = UI.details(Object.values(L));

    const note = UI.note('info', '');
    // X11: Extend's screen is a spare output switched on through a small root helper (vdd.js).
    const installBtn = UI.button(t('share.install', null, 'Install'), () => api.installVdd(), 'small primary');
    const removeBtn = UI.button(t('share.remove', null, 'Remove'), () => api.removeVdd(), 'small');
    const driver = UI.row(t('share.duodesk_virtual_display', null, 'DuoDesk virtual display'), '', [installBtn, removeBtn]);
    const driverCard = UI.card('', [driver], { cls: 'keep-on' });

    body.append(
      UI.card(t('share.screen', null, 'Screen'), [UI.row(t('share.mode', null, 'Mode'), '', [mode]), monitorRow, extendRow]),
      UI.card(t('clipboard.picture', null, 'Picture'), [UI.row(t('share.resolution', null, 'Resolution'), '', [streamSize]), UI.row(t('share.quality', null, 'Quality'), '', [quality]), paceRow], { cls: 'keep-on' }),
      UI.card(t('share.sound_and_control', null, 'Sound and control'), [UI.row(t('share.include_sound', null, 'Include sound'), '', [sound]), inputRow], { cls: 'keep-on' }),
      UI.card(t('nav.remote', null, 'Remote'), [remoteRow], { cls: 'keep-on' }),
      details,
      driverCard,
      note,
    );

    return (s) => {
      const p = s.pcScreen;
      const connected = s.link.state === 'connected';
      mode.set(p.mode);
      const v = p.vdd;
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
      details.set({
        [L.status]: (!on ? t('clipboard.off', null, 'Off') : p.busy ? t('share.starting_the_extra_screen', null, 'Starting the extra screen…') : p.status === 'live' ? t('share.on_the', { the: who }, 'On {the}')
          : !connected ? t('share.waiting_for_the', { the: who }, 'Waiting for {the}') : !p.mac.accept ? t('share.ready_starts_when_the_opens', { the: who }, 'Ready, starts when {the} opens it') : t('sidebar.connecting', null, 'Connecting…')) + (p.error ? ': ' + p.error : ''),
        [L.display]: !on ? '' : p.mode === 'extend' ? t('share.virtual_monitor_width_height', { width: p.extendPx[0], height: p.extendPx[1] }, 'Virtual monitor, {width} × {height}') : mon ? mon.label : '',
        [L.picture]: st ? `${st.width} × ${st.height}, ${st.fps} fps` : '',
        [L.speed]: st ? (st.targetMbps ? t('share.sent_network_allows', { mbps: st.mbps, target: st.targetMbps }, '{mbps} Mbps sent, network allows {target}') : t('share.mbps_mbps_sent', { mbps: st.mbps }, '{mbps} Mbps sent')) : '',
        [L.rtt]: st && st.rttMs != null ? st.rttMs + ' ms' : '',
        [L.codec]: st && st.codec ? st.codec.toUpperCase() : '',
        [L.encoder]: st && st.encoder ? UI.codecImpl(st.encoder, st.hw) : '',
        [L.dropped]: st ? st.dropped || 0 : '',
      });

      inputRow.label.textContent = t('share.receive_input_from_them', { them: UI.peer(s).them }, 'Receive input from {them}');
      remoteRow.label.textContent = t('share.let_the_start_and_switch', { the: UI.peer(s).the }, 'Let {the} start and switch this screen');
      remoteRow.setHint(p.remote ? t('share.opening_the_screen_window_there', null, 'Opening the screen window there starts sharing; Extend and Mirror can be switched from there.') : '');
      const wayland = s.session && s.session.type === 'wayland';
      monitorRow.hidden = wayland || p.mode === 'extend';
      driverCard.hidden = !(v.setup || v.removable || v.busy);
      installBtn.hidden = !v.setup;
      installBtn.disabled = !!v.busy;
      installBtn.textContent = v.busy === 'install' ? t('share.installing', null, 'Installing…') : t('share.install', null, 'Install');
      removeBtn.hidden = !v.removable;
      removeBtn.disabled = !!v.busy || p.mode === 'extend';
      driver.setHint(v.busy === 'remove' ? t('files.removing', null, 'Removing…') : v.busy === 'install' ? t('share.installing', null, 'Installing…') : v.hint ? v.hint : v.removable ? t('share.installed_adds_the_extra_screen', null, 'Installed. Adds the extra screen for Extend.')
        : t('share.adds_an_extra_screen_for_linux', null, 'Adds an extra screen for Extend by switching on a spare display output. Installs a small helper and asks for your password once.'));
      const extend = !v.checked || (v.setup && !v.message) ? '' : !v.installed ? (v.message ? v.message + '.' : t('share.extend_isn_t_available_on', null, 'Extend isn’t available on this desktop.'))
        : v.message ? v.message + '.' : '';
      note.set([
        wayland ? (p.mode === 'extend' ? t('share.wayland_asks_extend', null, 'Wayland: your desktop asks which screen to share each time sharing starts, choose “Virtual remote monitor”.') : t('share.wayland_asks', null, 'Wayland: your desktop asks which screen to share each time sharing starts.')) : '',
        wayland && s.session.input !== 'uinput' ? t('share.input_from_the_needs_input', { the: UI.peer(s).the }, 'Input from {the} needs input access (General).') : '',
        extend,
      ].filter(Boolean).join(' '));
    };
  },
});
