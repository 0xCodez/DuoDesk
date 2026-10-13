// MacShare — Copyright (C) 2026 MacShare contributors. GPL-3.0, see LICENSE.
// Display › PC → Mac: the PC's screen in a window on this Mac (phase 11). Same structure as
// Mac → PC; the PC picks what it shares (Off / Mirror / Extend), this Mac picks how it shows it.
'use strict';

UI.tab({
  id: 'receive',
  group: 'Display',
  order: 11,
  title: 'Receive screen',
  heading: '{there} on this Mac',
  icon: 'receive',
  desc: 'See its screen in a window here.',
  color: 'linear-gradient(#5ac8fa, #0a84ff)',
  master: { get: (s) => s.receive && s.receive.on, set: (v) => UI.api.setReceive({ on: v }) },
  badge: (s) => (s.receive && s.receive.status === 'live' ? 'on' : ''),
  build(body) {
    const { el, api } = UI;
    const STATUS = { off: 'Off', connecting: 'Connecting…', new: 'Connecting…', live: 'Live', disconnected: 'Reconnecting…', failed: 'Waiting for the PC…', stopped: 'Stopped on the other computer', closed: 'Closed' };

    const fullSw = UI.switch((v) => api.setReceive({ fullScreen: v }), { label: 'Open full screen' });
    const inputSw = UI.switch((v) => api.setReceive({ input: v }), { label: 'Control it' });
    const ctlRow = UI.row('Control {there}', '', [inputSw]);
    ctlRow.label.dataset.peer = 'Control {there}';
    const showBtn = UI.button('Open', () => api.showPcView(), 'primary');
    const winRow = UI.row('Screen window', '', [showBtn]);

    const live = {
      status: UI.row('Status', ''), picture: UI.row('Picture', ''), rate: UI.row('Speed', ''), rtt: UI.row('Round trip', ''),
      codec: UI.row('Codec', ''), decoder: UI.row('Decoder', ''), delay: UI.row('Delay', ''),
    };
    const vals = Object.fromEntries(Object.entries(live).map(([k, r]) => {
      const v = el('span', { class: 'value' });
      r.querySelector('.controls').append(v);
      return [k, v];
    }));

    body.append(
      UI.card('', [
        winRow,
        UI.row('Open full screen', 'Ctrl ⌘ F switches', [fullSw]),
        ctlRow,
      ], { cls: 'keep-on' }),
      UI.card('Details', Object.values(live), { cls: 'keep-on' }),
    );

    return (s) => {
      const r = s.receive;
      if (!r) return;
      fullSw.set(r.fullScreen);
      inputSw.set(r.input);
      const p = UI.peer(s);
      const pc = s.client ? s.client.name : p.same ? p.there : 'your PC';
      showBtn.textContent = r.open ? 'Show' : 'Open';
      winRow.setHint(!s.client ? `Waiting for ${pc}`
        : r.session ? `Showing ${pc}` : `Choose what to share in MacShare on ${pc}`);
      const st = r.stats;
      const isLive = r.status === 'live' && st;
      vals.status.textContent = STATUS[r.status] || r.status;
      vals.picture.textContent = isLive ? `${st.width} × ${st.height} · ${st.fps} fps` : '';
      vals.rate.textContent = isLive ? `${st.mbps} Mbps` : '';
      vals.rtt.textContent = s.client && s.client.rttMs != null ? `${s.client.rttMs} ms` : '';
      vals.codec.textContent = isLive && st.codec ? st.codec : '';
      vals.decoder.textContent = isLive && st.decoder ? st.decoder : '';
      vals.delay.textContent = isLive && st.delayMs != null ? `${st.delayMs} ms` : '';
      for (const k of ['rtt', 'codec', 'decoder', 'delay']) live[k].hidden = !vals[k].textContent;
    };
  },
});
