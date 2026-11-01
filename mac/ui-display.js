// TwinDesk — Copyright (C) 2026 inukaasith. GPL-3.0, see LICENSE.
// Display › Mac → PC: this Mac's screen on the PC (Monitor 2). Extend/Mirror, which display, the DuoDesk virtual display, stream quality,
// input from Monitor 2, live stats.
'use strict';

UI.tab({
  id: 'share',
  group: 'Display',
  order: 10,
  title: 'Share screen',
  heading: '{me} on {name}',
  icon: 'display',
  desc: 'Use {me} as a second screen for {name}.',
  color: 'linear-gradient(#5ac8fa, #0a84ff)',
  master: { get: (s) => s.sharing && s.sharing.on, set: (v) => UI.api.setSharing(v) },
  badge: (s) => (s.sharing && s.sharing.on ? 'on' : ''),
  build(body) {
    const { el, api } = UI;
    const t = (k, p, d) => (typeof window.t === 'function' ? window.t(k, p, d) : d !== undefined ? d : k);
    const PRESETS = [
      { label: '1280 × 720', width: 1280, height: 720, hiDPI: false },
      { label: '1920 × 1080', width: 1920, height: 1080, hiDPI: false },
      { label: '2560 × 1440', width: 2560, height: 1440, hiDPI: false },
      { label: '1920 × 1080 HiDPI (3840 × 2160 px)', width: 1920, height: 1080, hiDPI: true },
      { label: '2560 × 1440 HiDPI (5120 × 2880 px)', width: 2560, height: 1440, hiDPI: true },
    ];
    const STATUS = {
      off: t('clipboard.off', null, 'Off'), starting: t('display.starting', null, 'Starting…'), 'waiting for answer': t('display.waiting_for_name_ellipsis', null, 'Waiting for {name}…'), new: t('overview.connecting', null, 'Connecting…'),
      connecting: t('overview.connecting', null, 'Connecting…'), live: t('display.live', null, 'Live'), 'no viewer': t('display.ready_starts_when_name_opens', null, 'Ready — starts when {name} opens it'), 'waiting for Wi-Fi': t('display.waiting_for_wifi', null, 'Waiting for Wi-Fi'), 'nothing connected': t('display.waiting_for_name', null, 'Waiting for {name}'), 'no display to share': t('display.no_display_to_share', null, 'No display to share'), disconnected: t('sidebar.reconnecting', null, 'Reconnecting…'), failed: t('display.retrying', null, 'Retrying…'), closed: t('display.closed', null, 'Closed'),
    };

    const helperNote = UI.note('bad', t('display.something_went_wrong_in_the', null, 'Something went wrong in the background. Restart DuoDesk.'));

    const mode = UI.segmented([
      { value: 'extend', label: t('display.extend', null, 'Extend') },
      { value: 'mirror', label: t('display.mirror', null, 'Mirror') },
    ], (v) => api.setDisplayMode(v));
    const modeRow = UI.row(t('display.mode', null, 'Mode'), '', [mode]);
    const display = UI.select([], (v) => api.selectDisplay(v === 'virtual' ? null : Number(v)));
    const displayRow = UI.row(t('display.display', null, 'Display'), '', [display]);

    const virtOn = UI.switch((v) => api.setVirtual({ enabled: v }), { label: t('display.virtual_display', null, 'Virtual display') });
    const preset = UI.select(PRESETS.map((p, i) => ({ value: i, label: p.label })), () => { presetDirty = true; applyBtn.disabled = false; });
    let presetDirty = false;
    const applyBtn = UI.button(t('display.apply', null, 'Apply'), () => {
      const p = PRESETS[Number(preset.el.value)];
      presetDirty = false;
      api.setVirtual({ enabled: true, width: p.width, height: p.height, hiDPI: p.hiDPI });
    }, 'small');
    const virtRow = UI.row(t('display.duodesk_virtual_display', null, 'DuoDesk virtual display'), '', [virtOn]);
    const sizeRow = UI.row(t('display.size', null, 'Size'), '', [preset, applyBtn]);

    const streamSize = UI.select([
      { value: 1080, label: t('display.1080p_fastest', null, '1080p, fastest') },
      { value: 1440, label: t('display.1440p_sharper', null, '1440p, sharper') },
      { value: 0, label: t('display.full_size', null, 'Full size') },
    ], (v) => api.setStreamMaxHeight(Number(v)));
    const quality = UI.select([
      { value: 10, label: t('display.low_10_mbps', null, 'Low, 10 Mbps') },
      { value: 20, label: t('display.medium_20_mbps', null, 'Medium, 20 Mbps') },
      { value: 30, label: t('display.high_30_mbps', null, 'High, 30 Mbps') },
      { value: 50, label: t('display.best_50_mbps_wired', null, 'Best, 50 Mbps (wired)') },
      { value: 80, label: t('display.max_80_mbps_wired', null, 'Max, 80 Mbps (wired)') },
    ], (v) => api.setBitrate(Number(v)));

    const paceRow = UI.paceRow();
    const remoteSw = UI.switch((v) => api.setSharingOpts({ remote: v }), { label: t('display.remote_start', null, 'Remote start') });
    const remoteRow = UI.row(t('display.let_name_start_and_switch', null, 'Let {name} start and switch this screen'), t('display.open_it_on_name_no', null, 'Open it on {name} — no need to touch {me}'), [remoteSw]);

    const soundSw = UI.switch((v) => api.setScreenSound(v), { label: t('display.share_sound_with_the_screen', null, 'Share sound with the screen') });
    const soundRow = UI.row(t('display.include_sound', null, 'Include sound'), '', [soundSw]);
    const inputSw = UI.switch((v) => api.setStreamInput(v), { label: t('display.receive_input', null, 'Receive input') });
    const inputRow = UI.row(t('display.let_name_use_me_in', null, 'Let {name} use {me} in its window'), '', [inputSw]);

    const stats = {
      status: UI.row(t('display.status', null, 'Status'), ''),
      display: UI.row(t('display.display', null, 'Display'), ''),
      picture: UI.row(t('display.picture', null, 'Picture'), ''),
      rate: UI.row(t('display.speed', null, 'Speed'), ''),
      rtt: UI.row(t('display.round_trip', null, 'Round trip'), ''),
      codec: UI.row(t('display.codec', null, 'Codec'), ''),
      encoder: UI.row(t('display.encoder', null, 'Encoder'), ''),
      encode: UI.row(t('display.encode_time', null, 'Encode time'), ''),
    };
    const statVals = Object.fromEntries(Object.entries(stats).map(([k, r]) => {
      const v = el('span', { class: 'value' });
      r.querySelector('.controls').append(v);
      return [k, v];
    }));

    body.append(
      helperNote,
      UI.card(t('display.screen', null, 'Screen'), [modeRow, displayRow]),
      UI.card(t('display.virtual_display', null, 'Virtual display'), [virtRow, sizeRow]),
      UI.card(t('display.picture', null, 'Picture'), [
        UI.row(t('display.resolution', null, 'Resolution'), '', [streamSize]),
        UI.row(t('display.quality', null, 'Quality'), '', [quality]),
        paceRow,
      ]),
      UI.card(t('display.sound_and_control', null, 'Sound and control'), [remoteRow, soundRow, inputRow], { cls: 'keep-on' }),
      UI.card(t('display.details', null, 'Details'), Object.values(stats), { cls: 'keep-on' }),
    );

    return (s) => {
      helperNote.hidden = !!(s.helper && s.helper.running);
      const sh = s.sharing;
      if (!sh) return;
      mode.set(s.displayMode);
      modeRow.setHint({ extend: t('display.shows_the_duodesk_virtual_display', null, 'Shows the DuoDesk virtual display'), mirror: t('display.shows_mes_main_screen', null, 'Shows {me}’s main screen'), custom: '' }[s.displayMode]);

      display.options([
        { value: 'virtual', label: t('display.duodesk_virtual_display', null, 'DuoDesk virtual display') },
        ...sh.displays.filter((d) => !d.virtual).map((d) => ({ value: d.id, label: d.primary ? t('display.label_main', { label: d.label }, '{label} (main)') : d.label })),
      ]);
      const picked = sh.displays.find((d) => d.id === sh.displayId && !d.virtual);
      display.set(picked ? picked.id : 'virtual');

      const v = sh.virtual;
      virtOn.set(v.enabled);
      if (!presetDirty) {
        const i = PRESETS.findIndex((p) => p.width === v.width && p.height === v.height && p.hiDPI === !!v.hiDPI);
        preset.set(i < 0 ? 1 : i);
        applyBtn.disabled = true;
      }
      const vd = sh.displays.find((d) => d.virtual);
      virtRow.setHint(v.error ? t('display.couldnt_create_it_error', { error: v.error }, 'Couldn’t create it: {error}') : vd ? (vd.pixelWidth !== vd.width ? t('display.on_width_height_pixelwidth_pixelheight', { width: vd.width, height: vd.height, pixelWidth: vd.pixelWidth, pixelHeight: vd.pixelHeight }, 'On, {width} × {height} ({pixelWidth} × {pixelHeight} px)') : t('display.on_width_height', { width: vd.width, height: vd.height }, 'On, {width} × {height}')) : v.enabled ? t('display.on_while_sharing', null, 'On while sharing') : '');

      streamSize.set(sh.streamMaxHeight || 0);
      quality.set(sh.bitrateMbps);

      soundSw.set(sh.audio);
      remoteSw.set(sh.remote !== false);
      paceRow.render(s);
      inputSw.set(s.streamInput);
      const c = s.client;

      const st = s.stream || { status: 'off' };
      const live = st.status === 'live';
      const p = UI.peer(s);
      statVals.status.textContent = !sh.on ? t('clipboard.off', null, 'Off') : !c ? t('display.waiting_for_name', { name: p.name }, 'Waiting for {name}') : UI.fill(STATUS[st.status] || st.status);
      const shown = sh.displays.find((d) => d.id === sh.targetId);
      statVals.display.textContent = shown ? `${shown.virtual ? t('display.duodesk_virtual_display', null, 'DuoDesk virtual display') : shown.label} · ${shown.pixelWidth} × ${shown.pixelHeight}` : '';
      statVals.picture.textContent = live ? `${st.width} × ${st.height} · ${st.fps} fps` : '';
      statVals.rate.textContent = live ? (st.targetMbps ? t('display.mbps_of_target', { mbps: st.mbps, target: st.targetMbps }, '{mbps} Mbps of {target}') : t('display.mbps', { mbps: st.mbps }, '{mbps} Mbps')) : '';
      statVals.rtt.textContent = c && c.rttMs != null ? `${c.rttMs} ms` : '';
      statVals.codec.textContent = live && st.codec ? st.codec : '';
      statVals.encoder.textContent = live && st.encoder ? st.encoder : '';
      statVals.encode.textContent = live && st.encodeMs != null ? (st.limit && st.limit !== 'none' ? t('display.ms_limited_by', { ms: st.encodeMs, limit: st.limit }, '{ms} ms · limited by {limit}') : `${st.encodeMs} ms`) : '';
      for (const k of ['codec', 'encoder', 'encode', 'rtt', 'display']) stats[k].hidden = !statVals[k].textContent;
    };
  },
});
