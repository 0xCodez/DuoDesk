// TwinDesk — Copyright (C) 2026 inukaasith, Erdoğan Yeşil. GPL-3.0, see LICENSE.
// Display › PC → Mac: this PC's screen in a window on the Mac, controlled from there.
// Mirror shows an existing monitor; Extend adds an extra (virtual) screen (vdd.js).
'use strict';
var tr = (k, p, d) => (typeof t === 'function' ? t(k, p, d) : (d || k));

UI.tab({
  id: 'pc-mac',
  group: 'Display',
  order: 11,
  title: tr('mesh_share.title', null, 'Share screen'),
  heading: '{me}’s screen on {name}',
  icon: 'display',
  color: 'linear-gradient(#5ac8fa, #0a84ff)',
  desc: tr('mesh_share.desc', null, 'See {me} in a window on the other computer.'),
  master: { get: (s) => s.pcScreen.mode !== 'off', set: (v) => UI.api.setPcScreenMode(v ? 'mirror' : 'off') },
  badge: (s) => (s.pcScreen.status === 'live' ? 'on' : ''),
  build(body) {
    const { el, api } = UI;
    const set = (partial) => api.setPcScreen(partial);
    const mode = UI.segmented([
      { value: 'off', label: tr('clipboard.off', null, 'Off') },
      { value: 'extend', label: tr('share.extend', null, 'Extend') },
      { value: 'mirror', label: tr('share.mirror', null, 'Mirror') },
    ], (v) => api.setPcScreenMode(v));
    const monitor = UI.select([], (v) => set({ monitor: v }));
    const extendSize = UI.select([
      { value: 'mac', label: tr('share.same_as_the_other_screen', null, 'Same as the other screen') },
      { value: '1920x1080', label: '1920 × 1080' },
      { value: '2560x1440', label: '2560 × 1440' },
      { value: '3840x2160', label: '3840 × 2160' },
    ], (v) => set({ extendSize: v }));
    const streamSize = UI.select([
      { value: 1080, label: tr('share.1080p_1920_1080_fastest', null, '1080p (1920 × 1080), fastest') },
      { value: 1440, label: tr('share.1440p_2560_1440_sharper', null, '1440p (2560 × 1440), sharper') },
      { value: 0, label: tr('share.full_size', null, 'Full size') },
    ], (v) => set({ maxHeight: Number(v) }));
    const quality = UI.select([
      { value: 10, label: tr('share.low_10_mbps', null, 'Low, 10 Mbps') },
      { value: 20, label: tr('share.medium_20_mbps', null, 'Medium, 20 Mbps') },
      { value: 30, label: tr('share.high_30_mbps', null, 'High, 30 Mbps') },
      { value: 50, label: tr('share.best_50_mbps_wired', null, 'Best, 50 Mbps (wired)') },
    ], (v) => set({ mbps: Number(v) }));
    const paceRow = UI.paceRow(); // One Playback setting, synced with the other computer
    const sound = UI.switch((v) => set({ sound: v }), { label: tr('share.include_sound', null, 'Include sound') });
    const input = UI.switch((v) => set({ input: v }), { label: tr('share.receive_input', null, 'Receive input') });
    const inputRow = UI.row(tr('share.receive_input', null, 'Receive input'), '', [input]); // "Receive input from Mac" / "from PC2"
    const remote = UI.switch((v) => set({ remote: v }), { label: tr('share.remote_start', null, 'Remote start') });
    const remoteRow = UI.row(tr('share.let_the_other_computer_start', null, 'Let the other computer start and switch this screen'), '', [remote]); // screen.ctl

    const monitorRow = UI.row(tr('share.display', null, 'Display'), '', [monitor]);
    const extendRow = UI.row(tr('share.size', null, 'Size'), '', [extendSize]);
    // The details card keys its rows by label, so the translated labels are also the keys of details.set.
    const L = {
      status: tr('share.status', null, 'Status'), display: tr('share.display', null, 'Display'), picture: tr('clipboard.picture', null, 'Picture'), speed: tr('share.speed', null, 'Speed'),
      rtt: tr('share.round_trip', null, 'Round trip'), codec: tr('share.codec', null, 'Codec'), encoder: tr('share.encoder', null, 'Encoder'), dropped: tr('share.frames_dropped', null, 'Frames dropped'),
    };
    const details = UI.details(Object.values(L));

    const installBtn = UI.button(tr('share.install', null, 'Install'), () => api.installVdd(), 'small primary');
    const removeBtn = UI.button(tr('share.remove', null, 'Remove'), () => api.removeVdd(), 'small');
    const driver = UI.row(tr('share.duodesk_virtual_display', null, 'DuoDesk virtual display'), '', [installBtn, removeBtn]); // Extend's screen, from the Virtual Display Driver (vdd.js)
    const note = UI.note('bad', '');
    // No driver: Extend is greyed out; say why, with Install right there.
    const missingBtn = UI.button(tr('share.install', null, 'Install'), () => api.installVdd(), 'small primary');
    const missing = el('div', { class: 'note warn' }, [el('span', { text: tr('share.virtual_display_driver_not_installed', null, 'Virtual display driver not installed. Install it to use Extend.') }), missingBtn]);
    missing.style.alignItems = 'center';
    missing.style.justifyContent = 'space-between';

    // This PC's monitors as the OS arranges them (boxes), and what each connected device gets.
    const map = el('div', { class: 'screen-map' });
    map.style.cssText = 'position:relative;height:120px;margin:8px 0';
    const targetsBox = el('div', { class: 'screen-targets' });
    let targetsKey = '';
    const drawMap = (displays, targets) => {
      map.textContent = '';
      if (!displays.length) return;
      const x0 = Math.min(...displays.map((d) => d.x)), y0 = Math.min(...displays.map((d) => d.y));
      const w = Math.max(...displays.map((d) => d.x + d.w)) - x0, h = Math.max(...displays.map((d) => d.y + d.h)) - y0;
      const k = Math.min(100 / h, 100 / w * (map.clientWidth || 480) / 100, 1);
      for (const d of displays) {
        const who = targets.filter((tg) => tg.mode === 'mirror' && tg.monitor === d.id).map((tg) => tg.name);
        const box = el('div', { text: [d.name + (d.primary ? ' (main)' : ''), d.w + ' × ' + d.h].concat(who.length ? ['→ ' + who.join(', ')] : []).join(String.fromCharCode(10)) });
        box.style.cssText = `position:absolute;box-sizing:border-box;border:1px solid var(--accent,#0a84ff);border-radius:4px;font-size:11px;white-space:pre;overflow:hidden;padding:2px 4px;opacity:${who.length ? 1 : 0.6};`
          + `left:${(d.x - x0) * k}px;top:${(d.y - y0) * k}px;width:${d.w * k}px;height:${d.h * k}px`;
        map.append(box);
      }
      map.style.height = h * k + 'px';
    };
    const drawTargets = (p) => {
      const key = JSON.stringify([p.targets, p.monitors, p.vdd.installed]);
      if (key === targetsKey) return;
      targetsKey = key;
      targetsBox.textContent = '';
      for (const tg of p.targets) {
        const seg = UI.segmented([{ value: 'off', label: tr('clipboard.off', null, 'Off') }, { value: 'extend', label: tr('share.extend', null, 'Extend') }, { value: 'mirror', label: tr('share.mirror', null, 'Mirror') }],
          (v) => api.setPcScreenTarget(tg.id, { mode: v, displayId: tg.monitor || undefined }));
        seg.set(tg.mode);
        seg.el.querySelectorAll('button').forEach((b, i) => { b.disabled = tg.busy || (i === 1 && !p.vdd.installed); });
        const sel = UI.select(p.monitors.map((m) => ({ value: m.id, label: m.label })), (v) => api.setPcScreenTarget(tg.id, { mode: 'mirror', displayId: v }));
        sel.set(tg.monitor || (p.monitors.find((m) => /\(main\)$/.test(m.label)) || p.monitors[0] || { id: '' }).id);
        sel.el.hidden = tg.mode !== 'mirror';
        targetsBox.append(UI.row(tg.name, tg.error || '', [seg, sel]));
      }
    };
    const screens = UI.card(tr('mesh_share.displays', null, 'Displays'), [map, targetsBox]);

    body.append(
      missing,
      screens,
      UI.card(tr('share.screen', null, 'Screen'), [UI.row(tr('share.mode', null, 'Mode'), '', [mode]), monitorRow, extendRow]),
      UI.card(tr('clipboard.picture', null, 'Picture'), [UI.row(tr('share.resolution', null, 'Resolution'), '', [streamSize]), UI.row(tr('share.quality', null, 'Quality'), '', [quality]), paceRow], { cls: 'keep-on' }),
      UI.card(tr('share.sound_and_control', null, 'Sound and control'), [UI.row(tr('share.include_sound', null, 'Include sound'), '', [sound]), inputRow], { cls: 'keep-on' }),
      UI.card(tr('nav.remote', null, 'Remote'), [remoteRow], { cls: 'keep-on' }),
      details,
      UI.card('', [driver, note], { cls: 'keep-on' }),
    );

    return (s) => {
      const p = s.pcScreen;
      const v = p.vdd;
      const connected = s.link.state === 'connected';
      screens.hidden = !(p.displays && p.displays.length);
      drawMap(p.displays || [], p.targets || []);
      targetsBox.hidden = !p.targets || p.targets.length < 2; // one device: the Screen card below does it all
      if (!targetsBox.hidden) drawTargets(p);
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
      details.set({
        [L.status]: (!on ? tr('clipboard.off', null, 'Off') : p.busy ? tr('share.starting_the_extra_screen', null, 'Starting the extra screen…') : p.status === 'live' ? tr('share.on_the', { the: who }, 'On {the}')
          : !connected ? tr('share.waiting_for_the', { the: who }, 'Waiting for {the}') : !p.mac.accept ? tr('share.ready_starts_when_the_opens', { the: who }, 'Ready, starts when {the} opens it') : tr('sidebar.connecting', null, 'Connecting…')) + (p.error ? ': ' + p.error : ''),
        [L.display]: !on ? '' : p.mode === 'extend' ? tr('share.virtual_display_size', { width: p.extendPx[0], height: p.extendPx[1] }, 'DuoDesk virtual display, {width} × {height}') : mon ? mon.label : '',
        [L.picture]: st ? `${st.width} × ${st.height}, ${st.fps} fps` : '',
        [L.speed]: st ? (st.targetMbps ? tr('share.sent_network_allows', { mbps: st.mbps, target: st.targetMbps }, '{mbps} Mbps sent, network allows {target}') : tr('share.mbps_mbps_sent', { mbps: st.mbps }, '{mbps} Mbps sent')) : '',
        [L.rtt]: st && st.rttMs != null ? st.rttMs + ' ms' : '',
        [L.codec]: st && st.codec ? st.codec.toUpperCase() : '',
        [L.encoder]: st && st.encoder ? UI.codecImpl(st.encoder, st.hw) : '',
        [L.dropped]: st ? st.dropped || 0 : '',
      });

      missing.hidden = !v.checked || v.installed;
      missingBtn.disabled = !!v.busy;
      missingBtn.textContent = v.busy === 'install' ? tr('share.installing', null, 'Installing…') : tr('share.install', null, 'Install');
      installBtn.hidden = v.installed;
      installBtn.disabled = !!v.busy || !v.checked;
      installBtn.textContent = v.busy === 'install' ? tr('share.installing', null, 'Installing…') : tr('share.install', null, 'Install');
      removeBtn.hidden = !v.installed;
      removeBtn.disabled = !!v.busy || p.mode === 'extend';
      driver.setHint(v.busy === 'remove' ? tr('files.removing', null, 'Removing…') : v.busy === 'install' ? tr('share.installing', null, 'Installing…') : v.installed ? tr('share.installed_adds_the_extra_screen', null, 'Installed. Adds the extra screen for Extend.') : tr('share.adds_an_extra_screen_for', null, 'Adds an extra screen for Extend. Installs a display driver and asks for administrator rights once.'));
      inputRow.label.textContent = tr('share.receive_input_from_them', { them: UI.peer(s).them }, 'Receive input from {them}');
      remoteRow.label.textContent = tr('share.let_the_start_and_switch', { the: UI.peer(s).the }, 'Let {the} start and switch this screen');
      remoteRow.setHint(p.remote ? tr('share.opening_the_screen_window_there', null, 'Opening the screen window there starts sharing; Extend and Mirror can be switched from there.') : '');
      note.set(v.message);
    };
  },
});
