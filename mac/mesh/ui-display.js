// TwinDesk — Copyright (C) 2026 inukaasith, Erdoğan Yeşil. GPL-3.0, see LICENSE.
// Display › Mac → PC: this Mac's screen on the PC (Monitor 2). Extend/Mirror, which display, the DuoDesk virtual display, stream quality,
// input from Monitor 2, live stats.
'use strict';
(() => { // own scope: every mesh/ui-*.js declares `tr`, and top-level consts of classic scripts collide
var tr = (k, p, d) => (typeof t === 'function' ? t(k, p, d) : (d || k));

UI.tab({
  id: 'share',
  group: 'Display',
  order: 10,
  title: tr('mesh_share.title', null, 'Share screen'),
  heading: '{me} on {name}',
  icon: 'display',
  desc: tr('mesh_display.desc', null, 'Use {me} as a second screen for {name}.'),
  color: 'linear-gradient(#5ac8fa, #0a84ff)',
  master: { get: (s) => s.sharing && s.sharing.on, set: (v) => UI.api.setSharing(v) },
  badge: (s) => (s.sharing && s.sharing.on ? 'on' : ''),
  build(body) {
    const { el, api } = UI;
    const PRESETS = [
      { label: '1280 × 720', width: 1280, height: 720, hiDPI: false },
      { label: '1920 × 1080', width: 1920, height: 1080, hiDPI: false },
      { label: '2560 × 1440', width: 2560, height: 1440, hiDPI: false },
      { label: '1920 × 1080 HiDPI (3840 × 2160 px)', width: 1920, height: 1080, hiDPI: true },
      { label: '2560 × 1440 HiDPI (5120 × 2880 px)', width: 2560, height: 1440, hiDPI: true },
    ];
    const STATUS = {
      off: tr('clipboard.off', null, 'Off'), starting: tr('display.starting', null, 'Starting…'), 'waiting for answer': tr('display.waiting_for_name_ellipsis', null, 'Waiting for {name}…'), new: tr('overview.connecting', null, 'Connecting…'),
      connecting: tr('overview.connecting', null, 'Connecting…'), live: tr('display.live', null, 'Live'), 'no viewer': tr('display.ready_starts_when_name_opens', null, 'Ready — starts when {name} opens it'), 'waiting for Wi-Fi': tr('display.waiting_for_wifi', null, 'Waiting for Wi-Fi'), 'nothing connected': tr('display.waiting_for_name', null, 'Waiting for {name}'), 'no display to share': tr('display.no_display_to_share', null, 'No display to share'), disconnected: tr('sidebar.reconnecting', null, 'Reconnecting…'), failed: tr('display.retrying', null, 'Retrying…'), closed: tr('display.closed', null, 'Closed'),
    };

    const helperNote = UI.note('bad', tr('display.something_went_wrong_in_the', null, 'Something went wrong in the background. Restart DuoDesk.'));

    const mode = UI.segmented([
      { value: 'extend', label: tr('display.extend', null, 'Extend') },
      { value: 'mirror', label: tr('display.mirror', null, 'Mirror') },
    ], (v) => api.setDisplayMode(v));
    const modeRow = UI.row(tr('display.mode', null, 'Mode'), '', [mode]);
    const display = UI.select([], (v) => api.selectDisplay(v === 'virtual' ? null : Number(v)));
    const displayRow = UI.row(tr('display.display', null, 'Display'), '', [display]);

    const virtOn = UI.switch((v) => api.setVirtual({ enabled: v }), { label: tr('display.virtual_display', null, 'Virtual display') });
    const preset = UI.select(PRESETS.map((p, i) => ({ value: i, label: p.label })), () => { presetDirty = true; applyBtn.disabled = false; });
    let presetDirty = false;
    const applyBtn = UI.button(tr('display.apply', null, 'Apply'), () => {
      const p = PRESETS[Number(preset.el.value)];
      presetDirty = false;
      api.setVirtual({ enabled: true, width: p.width, height: p.height, hiDPI: p.hiDPI });
    }, 'small');
    const virtRow = UI.row(tr('display.duodesk_virtual_display', null, 'DuoDesk virtual display'), '', [virtOn]);
    const sizeRow = UI.row(tr('display.size', null, 'Size'), '', [preset, applyBtn]);

    const streamSize = UI.select([
      { value: 1080, label: tr('display.1080p_fastest', null, '1080p, fastest') },
      { value: 1440, label: tr('display.1440p_sharper', null, '1440p, sharper') },
      { value: 0, label: tr('display.full_size', null, 'Full size') },
    ], (v) => api.setStreamMaxHeight(Number(v)));
    const quality = UI.select([
      { value: 10, label: tr('display.low_10_mbps', null, 'Low, 10 Mbps') },
      { value: 20, label: tr('display.medium_20_mbps', null, 'Medium, 20 Mbps') },
      { value: 30, label: tr('display.high_30_mbps', null, 'High, 30 Mbps') },
      { value: 50, label: tr('display.best_50_mbps_wired', null, 'Best, 50 Mbps (wired)') },
      { value: 80, label: tr('display.max_80_mbps_wired', null, 'Max, 80 Mbps (wired)') },
    ], (v) => api.setBitrate(Number(v)));

    const paceRow = UI.paceRow();
    const remoteSw = UI.switch((v) => api.setSharingOpts({ remote: v }), { label: tr('display.remote_start', null, 'Remote start') });
    const remoteRow = UI.row(tr('display.let_name_start_and_switch', null, 'Let {name} start and switch this screen'), tr('display.open_it_on_name_no', null, 'Open it on {name} — no need to touch {me}'), [remoteSw]);

    const soundSw = UI.switch((v) => api.setScreenSound(v), { label: tr('display.share_sound_with_the_screen', null, 'Share sound with the screen') });
    const soundRow = UI.row(tr('display.include_sound', null, 'Include sound'), '', [soundSw]);
    const inputSw = UI.switch((v) => api.setStreamInput(v), { label: tr('display.receive_input', null, 'Receive input') });
    const inputRow = UI.row(tr('display.let_name_use_me_in', null, 'Let {name} use {me} in its window'), '', [inputSw]);

    const stats = {
      status: UI.row(tr('display.status', null, 'Status'), ''),
      display: UI.row(tr('display.display', null, 'Display'), ''),
      picture: UI.row(tr('display.picture', null, 'Picture'), ''),
      rate: UI.row(tr('display.speed', null, 'Speed'), ''),
      rtt: UI.row(tr('display.round_trip', null, 'Round trip'), ''),
      codec: UI.row(tr('display.codec', null, 'Codec'), ''),
      encoder: UI.row(tr('display.encoder', null, 'Encoder'), ''),
      encode: UI.row(tr('display.encode_time', null, 'Encode time'), ''),
    };
    const statVals = Object.fromEntries(Object.entries(stats).map(([k, r]) => {
      const v = el('span', { class: 'value' });
      r.querySelector('.controls').append(v);
      return [k, v];
    }));

    // This Mac's displays as the OS arranges them, and what each connected device gets.
    const map = el('div', { class: 'screen-map' });
    map.style.cssText = 'position:relative;height:120px;margin:8px 0';
    const targetsBox = el('div', { class: 'screen-targets' });
    let targetsKey = '';
    const drawMap = (displays, targets) => {
      map.textContent = '';
      if (!displays.length) return;
      const x0 = Math.min(...displays.map((d) => d.x)), y0 = Math.min(...displays.map((d) => d.y));
      const w = Math.max(...displays.map((d) => d.x + d.w)) - x0, h = Math.max(...displays.map((d) => d.y + d.h)) - y0;
      const k = Math.min(100 / h, (map.clientWidth || 480) / w, 1);
      for (const d of displays) {
        const who = targets.filter((tg) => tg.mode === 'mirror' && tg.displayId === d.id).map((tg) => tg.name);
        const box = el('div', { text: [d.primary ? tr('display.label_main', { label: d.name }, '{label} (main)') : d.name, d.w + ' × ' + d.h].concat(who.length ? ['→ ' + who.join(', ')] : []).join(String.fromCharCode(10)) });
        box.style.cssText = `position:absolute;box-sizing:border-box;border:1px solid var(--accent,#0a84ff);border-radius:4px;font-size:11px;white-space:pre;overflow:hidden;padding:2px 4px;opacity:${who.length ? 1 : 0.6};`
          + `left:${(d.x - x0) * k}px;top:${(d.y - y0) * k}px;width:${d.w * k}px;height:${d.h * k}px`;
        map.append(box);
      }
      map.style.height = h * k + 'px';
    };
    const drawTargets = (st) => {
      const key = JSON.stringify([st.targets, st.displays]);
      if (key === targetsKey) return;
      targetsKey = key;
      targetsBox.textContent = '';
      for (const tg of st.targets) {
        const choices = [{ value: 'default', label: tr('meshm_display.as_set_above', null, 'As set above') }, { value: 'none', label: tr('clipboard.off', null, 'Off') }, { value: 'virtual', label: tr('display.virtual_display', null, 'Virtual display') },
          ...st.displays.map((d) => ({ value: 'mirror:' + d.id, label: tr('meshm_display.mirror_display', { display: d.name }, 'Mirror {display}') }))];
        const sel = UI.select(choices, (v) => api.setStreamTarget(tg.id, v.startsWith('mirror:') ? { mode: 'mirror', displayId: v.slice(7) } : { mode: v }));
        sel.set(tg.mode === 'mirror' ? 'mirror:' + tg.displayId : tg.mode);
        targetsBox.append(UI.row(tg.name, '', [sel]));
      }
    };
    const screens = UI.card(tr('meshm_display.displays', null, 'Displays'), [map, targetsBox]);

    body.append(
      helperNote,
      screens,
      UI.card(tr('display.screen', null, 'Screen'), [modeRow, displayRow]),
      UI.card(tr('display.virtual_display', null, 'Virtual display'), [virtRow, sizeRow]),
      UI.card(tr('display.picture', null, 'Picture'), [
        UI.row(tr('display.resolution', null, 'Resolution'), '', [streamSize]),
        UI.row(tr('display.quality', null, 'Quality'), '', [quality]),
        paceRow,
      ]),
      UI.card(tr('display.sound_and_control', null, 'Sound and control'), [remoteRow, soundRow, inputRow], { cls: 'keep-on' }),
      UI.card(tr('display.details', null, 'Details'), Object.values(stats), { cls: 'keep-on' }),
    );

    return (s) => {
      helperNote.hidden = !!(s.helper && s.helper.running);
      const sh = s.sharing;
      if (!sh) return;
      const sd = s.stream && s.stream.displays;
      screens.hidden = !(sd && sd.length);
      if (sd && sd.length) {
        drawMap(sd, s.stream.targets || []);
        targetsBox.hidden = !s.stream.targets || s.stream.targets.length < 2; // one device: the cards below do it all
        if (!targetsBox.hidden) drawTargets(s.stream);
      }
      mode.set(s.displayMode);
      modeRow.setHint({ extend: tr('display.shows_the_duodesk_virtual_display', null, 'Shows the DuoDesk virtual display'), mirror: tr('display.shows_mes_main_screen', null, 'Shows {me}’s main screen'), custom: '' }[s.displayMode]);

      display.options([
        { value: 'virtual', label: tr('display.duodesk_virtual_display', null, 'DuoDesk virtual display') },
        ...sh.displays.filter((d) => !d.virtual).map((d) => ({ value: d.id, label: d.primary ? tr('display.label_main', { label: d.label }, '{label} (main)') : d.label })),
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
      virtRow.setHint(v.error ? tr('display.couldnt_create_it_error', { error: v.error }, 'Couldn’t create it: {error}') : vd ? (vd.pixelWidth !== vd.width ? tr('display.on_width_height_pixelwidth_pixelheight', { width: vd.width, height: vd.height, pixelWidth: vd.pixelWidth, pixelHeight: vd.pixelHeight }, 'On, {width} × {height} ({pixelWidth} × {pixelHeight} px)') : tr('display.on_width_height', { width: vd.width, height: vd.height }, 'On, {width} × {height}')) : v.enabled ? tr('display.on_while_sharing', null, 'On while sharing') : '');

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
      statVals.status.textContent = !sh.on ? tr('clipboard.off', null, 'Off') : !c ? tr('display.waiting_for_name', { name: p.name }, 'Waiting for {name}') : UI.fill(STATUS[st.status] || st.status);
      const shown = sh.displays.find((d) => d.id === sh.targetId);
      statVals.display.textContent = shown ? `${shown.virtual ? tr('display.duodesk_virtual_display', null, 'DuoDesk virtual display') : shown.label} · ${shown.pixelWidth} × ${shown.pixelHeight}` : '';
      statVals.picture.textContent = live ? `${st.width} × ${st.height} · ${st.fps} fps` : '';
      statVals.rate.textContent = live ? (st.targetMbps ? tr('display.mbps_of_target', { mbps: st.mbps, target: st.targetMbps }, '{mbps} Mbps of {target}') : tr('display.mbps', { mbps: st.mbps }, '{mbps} Mbps')) : '';
      statVals.rtt.textContent = c && c.rttMs != null ? `${c.rttMs} ms` : '';
      statVals.codec.textContent = live && st.codec ? st.codec : '';
      statVals.encoder.textContent = live && st.encoder ? st.encoder : '';
      statVals.encode.textContent = live && st.encodeMs != null ? (st.limit && st.limit !== 'none' ? tr('display.ms_limited_by', { ms: st.encodeMs, limit: st.limit }, '{ms} ms · limited by {limit}') : `${st.encodeMs} ms`) : '';
      for (const k of ['codec', 'encoder', 'encode', 'rtt', 'display']) stats[k].hidden = !statVals[k].textContent;
    };
  },
});
})();
