// MacShare — Copyright (C) 2026 MacShare contributors. GPL-3.0, see LICENSE.
// Display › PC → Mac: the PC's screen in a window on this Mac (phase 11). Same structure as
// Mac → PC; the PC picks what it shares (Off / Mirror / Extend), this Mac picks how it shows it.
'use strict';

UI.tab({
  id: 'receive',
  group: 'Display',
  order: 11,
  title: 'PC → Mac',
  heading: 'The PC’s screen on this Mac',
  icon: 'receive',
  desc: 'Show a screen of the PC in a window on this Mac, and control the PC from it.',
  color: 'linear-gradient(#5ac8fa, #0a84ff)',
  master: { get: (s) => s.receive && s.receive.on, set: (v) => UI.api.setReceive({ on: v }) },
  badge: (s) => (s.receive && s.receive.status === 'live' ? 'on' : ''),
  build(body) {
    const { el, api } = UI;
    const STATUS = { off: 'Off', connecting: 'Connecting…', new: 'Connecting…', live: 'Live', disconnected: 'Interrupted — reconnecting…', failed: 'Failed — waiting for the PC to retry', stopped: 'The PC stopped sharing', closed: 'Closed' };

    const onSw = UI.switch((v) => api.setReceive({ on: v }), { label: 'Show the PC’s screen here' });
    const fullSw = UI.switch((v) => api.setReceive({ fullScreen: v }), { label: 'Open full screen' });
    const inputSw = UI.switch((v) => api.setReceive({ input: v }), { label: 'Control the PC from the window' });
    const onRow = UI.row('Show the PC’s screen in a window', '', [onSw]);
    const showBtn = UI.button('Open the PC’s screen', () => api.showPcView(), 'primary');
    const winRow = UI.row('PC screen window', '', [showBtn]);

    const live = { status: UI.row('Stream', ''), picture: UI.row('Picture', ''), rate: UI.row('Bitrate', ''), dec: UI.row('Decoder', ''), delay: UI.row('Delay here', '') };
    const vals = Object.fromEntries(Object.entries(live).map(([k, r]) => {
      const v = el('span', { class: 'value' });
      r.querySelector('.controls').append(v);
      return [k, v];
    }));

    body.append(
      UI.card('On this Mac', [
        onRow,
        UI.row('Open full screen', 'Ctrl-⌘-F switches full screen while the window has focus', [fullSw]),
        UI.row('Control the PC from the window', 'Mouse and keyboard inside the window go to the PC (⌘ arrives as Ctrl when “swap” is on)', [inputSw]),
        winRow,
      ], { cls: 'keep-on' }),
      UI.card('Chosen on the PC', [
        UI.row('What the window shows', 'In the PC app, Display › PC → Mac: Mirror shows one of its monitors, Extend adds a monitor sized like this Mac’s screen.'),
        UI.row('Sound and quality', 'Also set on the PC. Sound plays here at the Audio tab’s volume.'),
      ], { cls: 'keep-on' }),
      UI.card('Live', Object.values(live)),
    );

    return (s) => {
      const r = s.receive;
      if (!r) return;
      onSw.set(r.on);
      fullSw.set(r.fullScreen);
      inputSw.set(r.input);
      const pc = s.client ? s.client.name : 'the PC';
      onRow.setHint(!r.on ? 'Off — the PC can’t show its screen here'
        : !s.client ? 'Waiting for your PC to connect'
          : r.session ? `Showing ${pc}` : `Waiting for ${pc} to share (Display › PC → Mac in the PC app)`);
      showBtn.textContent = r.open ? 'Show the window' : 'Open the PC’s screen';
      winRow.setHint(r.open ? (r.session ? 'Open' : 'Open — waiting for the PC to share') : 'Like Monitor 2 on the PC: opens the window now; the picture comes when the PC shares');
      const st = r.stats;
      const isLive = r.status === 'live' && st;
      vals.status.textContent = STATUS[r.status] || r.status;
      vals.picture.textContent = isLive ? `${st.width} × ${st.height} · ${st.fps} fps` : '—';
      vals.rate.textContent = isLive ? `${st.mbps} Mbps` : '—';
      vals.dec.textContent = isLive ? `${st.codec || '?'} ${st.decoder || ''}` : '—';
      vals.delay.textContent = isLive ? `buffer ${st.bufferMs} ms · decode ${st.decodeMs} ms` : '—';
    };
  },
});
