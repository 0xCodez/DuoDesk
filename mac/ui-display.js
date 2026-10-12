// MacShare — Copyright (C) 2026 MacShare contributors. GPL-3.0, see LICENSE.
// Display › Mac → PC: this Mac's screen on the PC (Monitor 2). Extend/Mirror, which display, the MacShare virtual display, stream quality,
// input from Monitor 2, live stats.
'use strict';

UI.tab({
  id: 'share',
  group: 'Display',
  order: 10,
  title: 'Mac → PC',
  heading: 'This Mac’s screen on the PC',
  icon: 'display',
  desc: 'Show a screen of this Mac in the Monitor 2 window on the PC, and control it from there. Starts off each time MacShare opens.',
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
      off: 'Sharing is off', starting: 'Starting…', 'waiting for answer': 'Waiting for the PC…', new: 'Connecting…',
      connecting: 'Connecting…', live: 'Live', disconnected: 'Interrupted — reconnecting…', failed: 'Failed — retrying', closed: 'Closed',
    };

    const helperNote = UI.note('bad', 'The MacShare helper is not running. Build it with “npm run build:helper”, then restart MacShare.');

    const mode = UI.segmented([
      { value: 'extend', label: 'Extend', title: 'Monitor 2 is an extra screen for this Mac' },
      { value: 'mirror', label: 'Mirror', title: 'Monitor 2 shows this Mac’s main screen' },
    ], (v) => api.setDisplayMode(v));
    const modeRow = UI.row('Monitor 2 shows', '', [mode]);
    const display = UI.select([], (v) => api.selectDisplay(v === 'virtual' ? null : Number(v)));
    const displayRow = UI.row('Display', 'Pick any screen of this Mac to share', [display]);

    const virtOn = UI.switch((v) => api.setVirtual({ enabled: v }), { label: 'Virtual display' });
    const preset = UI.select(PRESETS.map((p, i) => ({ value: i, label: p.label })), () => { presetDirty = true; applyBtn.disabled = false; });
    let presetDirty = false;
    const applyBtn = UI.button('Apply', () => {
      const p = PRESETS[Number(preset.el.value)];
      presetDirty = false;
      api.setVirtual({ enabled: true, width: p.width, height: p.height, hiDPI: p.hiDPI });
    }, 'small');
    const virtRow = UI.row('MacShare virtual display', '', [virtOn]);
    const sizeRow = UI.row('Size', 'HiDPI looks sharp on a 4K PC monitor. The stream size below keeps it fast.', [preset, applyBtn]);

    const streamSize = UI.select([
      { value: 1080, label: '1080p — lowest latency' },
      { value: 1440, label: '1440p — sharper, ~20 ms slower' },
      { value: 0, label: 'Full pixels — 4K adds ~30–60 ms' },
    ], (v) => api.setStreamMaxHeight(Number(v)));
    const quality = UI.select([
      { value: 10, label: '10 Mbps — slow Wi-Fi' },
      { value: 20, label: '20 Mbps — Wi-Fi' },
      { value: 30, label: '30 Mbps — fast Wi-Fi (5 GHz)' },
      { value: 50, label: '50 Mbps — Ethernet' },
    ], (v) => api.setBitrate(Number(v)));

    const soundSw = UI.switch((v) => api.setScreenSound(v), { label: 'Share sound with the screen' });
    const soundRow = UI.row('Share sound with the screen', '', [soundSw]);
    const inputSw = UI.switch((v) => api.setStreamInput(v), { label: 'Receive input' });
    const inputRow = UI.row('Receive input', '', [inputSw]);

    const stats = {
      status: UI.row('Stream', ''),
      picture: UI.row('Picture', ''),
      rate: UI.row('Bitrate', ''),
      enc: UI.row('Encoder', ''),
    };
    const statVals = Object.fromEntries(Object.entries(stats).map(([k, r]) => {
      const v = el('span', { class: 'value' });
      r.querySelector('.controls').append(v);
      return [k, v];
    }));

    body.append(
      helperNote,
      UI.card('Monitor 2', [modeRow, displayRow]),
      UI.card('Virtual display', [virtRow, sizeRow]),
      UI.card('Stream', [
        UI.row('Stream size', 'HiDPI screens are scaled down on the GPU, so text stays smooth.', [streamSize]),
        UI.row('Quality', 'Higher needs a faster network. Too high on Wi-Fi adds lag.', [quality]),
      ]),
      UI.card('Sound and control', [soundRow, inputRow], { cls: 'keep-on' }),
      UI.card('Live', Object.values(stats)),
    );

    return (s) => {
      helperNote.hidden = !!(s.helper && s.helper.running);
      const sh = s.sharing;
      if (!sh) return;
      mode.set(s.displayMode);
      modeRow.setHint({
        extend: 'Extend: Monitor 2 is an extra screen. Drag windows onto “MacShare” in the arrangement.',
        mirror: 'Mirror: Monitor 2 shows this Mac’s main screen.',
        custom: 'Custom: a display you picked below.',
      }[s.displayMode]);

      display.options([
        { value: 'virtual', label: `MacShare virtual display${sh.virtual.active ? '' : ' (off)'}` },
        ...sh.displays.filter((d) => !d.virtual).map((d) => ({ value: d.id, label: `${d.label} — ${d.width} × ${d.height}${d.primary ? ' (main)' : ''}` })),
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
      virtRow.setHint(v.error ? `Error: ${v.error}` : !v.enabled ? 'Off'
        : v.active ? 'On — appears as “MacShare” in System Settings → Displays' : sh.on ? 'Starting…' : 'Created when you start sharing');

      streamSize.set(sh.streamMaxHeight || 0);
      quality.set(sh.bitrateMbps);

      soundSw.set(sh.audio);
      soundRow.setHint(sh.audio
        ? (s.audio && s.audio.screen && s.audio.screen.on ? 'On — this Mac’s sound plays in Monitor 2, in sync' : 'On — starts with the next screen session')
        : 'Off — no sound with the screen (lowest latency). The Audio tab can send sound on its own.');
      inputSw.set(s.streamInput);
      const c = s.client;
      inputRow.setHint(!s.streamInput ? 'Off — Monitor 2 is view only'
        : c && c.rttMs != null ? `The PC’s mouse and keyboard work inside Monitor 2 · input delay ≈ ${Math.max(1, Math.round(c.rttMs / 2))} ms`
          : 'The PC’s mouse and keyboard work inside Monitor 2');

      const st = s.stream || { status: 'off' };
      const live = st.status === 'live';
      statVals.status.textContent = !sh.on ? 'Off' : !c ? 'Waiting for a PC' : `${STATUS[st.status] || st.status}${st.display ? ` — ${st.display}` : ''}`;
      statVals.picture.textContent = live ? `${st.width} × ${st.height} · ${st.fps} fps` : '—';
      statVals.rate.textContent = live ? `${st.mbps} of ${st.targetMbps || '?'} Mbps` : '—';
      statVals.enc.textContent = live
        ? `${st.codec || '?'} ${st.encoder || ''} · QP ${st.qp || '–'}${st.limit && st.limit !== 'none' ? ` · limited by ${st.limit}` : ''}`
        : '—';
    };
  },
});
