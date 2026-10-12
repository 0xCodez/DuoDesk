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
  desc: 'Use this Mac as a second screen on your PC.',
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
      off: 'Off', starting: 'Starting…', 'waiting for answer': 'Waiting for the PC…', new: 'Connecting…',
      connecting: 'Connecting…', live: 'Live', disconnected: 'Reconnecting…', failed: 'Retrying…', closed: 'Closed',
    };

    const helperNote = UI.note('bad', 'Something went wrong in the background. Restart MacShare.');

    const mode = UI.segmented([
      { value: 'extend', label: 'Extend' },
      { value: 'mirror', label: 'Mirror' },
    ], (v) => api.setDisplayMode(v));
    const modeRow = UI.row('Mode', '', [mode]);
    const display = UI.select([], (v) => api.selectDisplay(v === 'virtual' ? null : Number(v)));
    const displayRow = UI.row('Display', '', [display]);

    const virtOn = UI.switch((v) => api.setVirtual({ enabled: v }), { label: 'Virtual display' });
    const preset = UI.select(PRESETS.map((p, i) => ({ value: i, label: p.label })), () => { presetDirty = true; applyBtn.disabled = false; });
    let presetDirty = false;
    const applyBtn = UI.button('Apply', () => {
      const p = PRESETS[Number(preset.el.value)];
      presetDirty = false;
      api.setVirtual({ enabled: true, width: p.width, height: p.height, hiDPI: p.hiDPI });
    }, 'small');
    const virtRow = UI.row('Extra screen', '', [virtOn]);
    const sizeRow = UI.row('Size', '', [preset, applyBtn]);

    const streamSize = UI.select([
      { value: 1080, label: '1080p, fastest' },
      { value: 1440, label: '1440p, sharper' },
      { value: 0, label: 'Full size' },
    ], (v) => api.setStreamMaxHeight(Number(v)));
    const quality = UI.select([
      { value: 10, label: 'Low' },
      { value: 20, label: 'Medium' },
      { value: 30, label: 'High' },
      { value: 50, label: 'Best (wired)' },
    ], (v) => api.setBitrate(Number(v)));

    const soundSw = UI.switch((v) => api.setScreenSound(v), { label: 'Share sound with the screen' });
    const soundRow = UI.row('Include sound', '', [soundSw]);
    const inputSw = UI.switch((v) => api.setStreamInput(v), { label: 'Receive input' });
    const inputRow = UI.row('Let the PC control it', '', [inputSw]);

    const stats = {
      status: UI.row('Stream', ''),
      picture: UI.row('Picture', ''),
      rate: UI.row('Bitrate', ''),
    };
    const statVals = Object.fromEntries(Object.entries(stats).map(([k, r]) => {
      const v = el('span', { class: 'value' });
      r.querySelector('.controls').append(v);
      return [k, v];
    }));

    body.append(
      helperNote,
      UI.card('Screen', [modeRow, displayRow]),
      UI.card('Extra screen', [virtRow, sizeRow]),
      UI.card('Picture', [
        UI.row('Resolution', '', [streamSize]),
        UI.row('Quality', '', [quality]),
      ]),
      UI.card('Sound and control', [soundRow, inputRow], { cls: 'keep-on' }),
      UI.card('Status', Object.values(stats)),
    );

    return (s) => {
      helperNote.hidden = !!(s.helper && s.helper.running);
      const sh = s.sharing;
      if (!sh) return;
      mode.set(s.displayMode);
      modeRow.setHint({ extend: 'An extra screen', mirror: 'Same as this Mac', custom: '' }[s.displayMode]);

      display.options([
        { value: 'virtual', label: 'MacShare extra screen' },
        ...sh.displays.filter((d) => !d.virtual).map((d) => ({ value: d.id, label: `${d.label}${d.primary ? ' (main)' : ''}` })),
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
      virtRow.setHint(v.error ? `Couldn’t create it: ${v.error}` : '');

      streamSize.set(sh.streamMaxHeight || 0);
      quality.set(sh.bitrateMbps);

      soundSw.set(sh.audio);
      inputSw.set(s.streamInput);
      const c = s.client;

      const st = s.stream || { status: 'off' };
      const live = st.status === 'live';
      statVals.status.textContent = !sh.on ? 'Off' : !c ? 'Waiting for your PC' : STATUS[st.status] || st.status;
      statVals.picture.textContent = live ? `${st.width} × ${st.height} · ${st.fps} fps` : '';
      statVals.rate.textContent = live ? `${st.mbps} Mbps` : '';
    };
  },
});
