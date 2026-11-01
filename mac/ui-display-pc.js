// TwinDesk — Copyright (C) 2026 inukaasith. GPL-3.0, see LICENSE.
// Display › PC → Mac: the PC's screen in a window on this Mac. Same structure as
// Mac → PC; the PC picks what it shares (Off / Mirror / Extend), this Mac picks how it shows it.
'use strict';

UI.tab({
  id: 'receive',
  hidden: (s) => UI.isPhone(s), // the Phone page has the phone's screen, sound and apps
  group: 'Display',
  order: 11,
  title: 'Receive screen',
  heading: '{name} on {me}',
  icon: 'receive',
  desc: 'See its screen in a window here.',
  color: 'linear-gradient(#5ac8fa, #0a84ff)',
  // The switch is the screen window (open = watching = the other side sends).
  master: { get: (s) => !!(s.receive && s.receive.open), set: (v) => (v ? UI.api.showPcView() : UI.api.closePcView()) },
  badge: (s) => (s.receive && s.receive.status === 'live' ? 'on' : ''),
  build(body) {
    const { el, api } = UI;
    const t = (k, p, d) => (typeof window.t === 'function' ? window.t(k, p, d) : d !== undefined ? d : k);
    const STATUS = { off: t('clipboard.off', null, 'Off'), connecting: t('overview.connecting', null, 'Connecting…'), new: t('overview.connecting', null, 'Connecting…'), live: t('display.live', null, 'Live'), disconnected: t('sidebar.reconnecting', null, 'Reconnecting…'), failed: t('display.waiting_for_name_ellipsis', null, 'Waiting for {name}…'), stopped: t('display_pc.stopped_on_the_other_computer', null, 'Stopped on the other computer'), closed: t('display.closed', null, 'Closed') };

    const fullSw = UI.switch((v) => api.setReceive({ fullScreen: v }), { label: t('display_pc.open_full_screen', null, 'Open full screen') });
    const inputSw = UI.switch((v) => api.setReceive({ input: v }), { label: t('display_pc.control_it', null, 'Control it') });
    const ctlRow = UI.row(t('display_pc.control_name_from_its_window', null, 'Control {name} from its window'), '', [inputSw]);
    const showBtn = UI.button(t('files.open', null, 'Open'), () => api.showPcView(), 'primary');
    const winRow = UI.row(t('display_pc.screen_window', null, 'Screen window'), '', [showBtn]);
    // Run the other computer's sharing from here (screen.ctl), when it allows that.
    // One control, the same three choices as on the PC itself, kept in step (screen.state).
    const rMode = UI.segmented([
      { value: 'off', label: t('clipboard.off', null, 'Off') },
      { value: 'mirror', label: t('display.mirror', null, 'Mirror') },
      { value: 'extend', label: t('display.extend', null, 'Extend') },
    ], (v) => api.remoteScreen(v === 'off' ? { share: false } : { share: true, mode: v }));
    const rRow = UI.row(t('display_pc.name_shares', null, '{name} shares'), '', [rMode]);
    rRow.label.dataset.peer = t('display_pc.name_shares', null, '{name} shares');
    const paceRow = UI.paceRow();
    const fgSw = UI.switch((v) => api.setReceive({ framegen: v }), { label: t('display_pc.frame_generation', null, 'Frame generation') });
    const fgRow = UI.row(t('display_pc.frame_generation', null, 'Frame generation'), t('display_pc.fills_in_late_or_dropped', null, 'Fills in late or dropped frames, and adds in-between frames when this screen is faster than the stream'), [fgSw]);

    const live = {
      status: UI.row(t('display.status', null, 'Status'), ''), picture: UI.row(t('display.picture', null, 'Picture'), ''), rate: UI.row(t('display.speed', null, 'Speed'), ''), rtt: UI.row(t('display.round_trip', null, 'Round trip'), ''),
      codec: UI.row(t('display.codec', null, 'Codec'), ''), decoder: UI.row(t('display_pc.decoder', null, 'Decoder'), ''), delay: UI.row(t('display_pc.delay', null, 'Delay'), ''), smooth: UI.row(t('display_pc.smoothness', null, 'Smoothness'), ''),
    };
    const vals = Object.fromEntries(Object.entries(live).map(([k, r]) => {
      const v = el('span', { class: 'value' });
      r.querySelector('.controls').append(v);
      return [k, v];
    }));

    body.append(
      UI.card('', [
        winRow,
        rRow,
        UI.row(t('display_pc.open_full_screen', null, 'Open full screen'), t('display_pc.ctrl_f_switches', null, 'Ctrl ⌘ F switches'), [fullSw]),
        ctlRow,
        paceRow,
        fgRow,
      ], { cls: 'keep-on' }),
      UI.card(t('display.details', null, 'Details'), Object.values(live), { cls: 'keep-on' }),
    );

    return (s) => {
      const r = s.receive;
      if (!r) return;
      fullSw.set(r.fullScreen);
      paceRow.render(s);
      fgSw.set(!!r.framegen);
      const rs = r.remote;
      rMode.set(rs ? (rs.on ? rs.mode : 'off') : '');
      rMode.disable(!s.client || !rs || !rs.remote);
      rRow.setHint(!s.client ? t('display_pc.connect_to_choose_from_here', null, 'Connect to choose from here')
        : !rs ? t('display_pc.update_duodesk_on_the_other', null, 'Update DuoDesk on the other computer to choose from here')
          : !rs.remote ? t('display_pc.the_other_computer_doesnt_allow', null, 'The other computer doesn’t allow choosing from here')
            : rs.on ? (rs.mode === 'extend' ? t('display_pc.an_extra_screen_for_it', null, 'An extra screen for it, shown here') : t('display_pc.its_main_screen_shown_here', null, 'Its main screen, shown here')) : t('display_pc.pick_mirror_or_extend_or', null, 'Pick Mirror or Extend — or just press Open'));
      inputSw.set(r.input);
      const p = UI.peer(s);
      const pc = p.name;
      showBtn.textContent = r.open ? t('files.show', null, 'Show') : t('files.open', null, 'Open');
      const canStart = r.remote && r.remote.remote;
      winRow.setHint(!s.client ? t('display.waiting_for_name', { name: pc }, 'Waiting for {name}')
        : r.session ? t('display_pc.showing_name', { name: pc }, 'Showing {name}') : canStart ? t('display_pc.open_starts_it_on_name', { name: pc }, 'Open starts it on {name}') : t('display_pc.choose_what_to_share_in', { name: pc }, 'Choose what to share in DuoDesk on {name}'));
      const st = r.stats;
      const isLive = r.status === 'live' && st;
      vals.status.textContent = UI.fill(STATUS[r.status] || r.status);
      vals.picture.textContent = isLive ? `${st.width} × ${st.height} · ${st.fps} fps` : '';
      vals.rate.textContent = isLive ? t('display.mbps', { mbps: st.mbps }, '{mbps} Mbps') : '';
      vals.rtt.textContent = s.client && s.client.rttMs != null ? `${s.client.rttMs} ms` : '';
      vals.codec.textContent = isLive && st.codec ? st.codec : '';
      vals.decoder.textContent = isLive && st.decoder ? st.decoder : '';
      vals.delay.textContent = isLive && st.bufferMs != null ? t('display_pc.ms_buffer_ms_decode', { buffer: st.bufferMs, decode: st.decodeMs }, '{buffer} ms buffer · {decode} ms decode') : '';
      vals.smooth.textContent = isLive ? t(st.framegen ? 'display_pc.dropped_freezes_frame_generation' : 'display_pc.dropped_freezes', { dropped: st.dropped || 0, freezes: st.freezes || 0 }, st.framegen ? '{dropped} dropped · {freezes} freezes · frame generation on' : '{dropped} dropped · {freezes} freezes') : '';
      for (const k of ['picture', 'rate', 'rtt', 'codec', 'decoder', 'delay', 'smooth']) live[k].hidden = !vals[k].textContent;
    };
  },
});
