// TwinDesk — Copyright (C) 2026 inukaasith. GPL-3.0, see LICENSE.
// Display › Mac → PC: the Mac's screen in the Monitor 2 window; this PC owns the window, the screen
// sound volume and F11/F9. When the other computer lets us (its screen.state `remote`),
// Open and the switch start/stop its sharing there and Extend | Mirror switches it (screen.ctl).
// No "Open automatically" — the other computer sends nothing until Open here.
'use strict';

UI.tab({
  id: 'mac-pc',
  hidden: (s) => UI.isPhone(s), // the Phone page has the phone's screen, sound and apps
  group: 'Display',
  order: 10,
  title: 'Receive screen',
  heading: '{Name}’s screen on {me}',
  icon: 'receive',
  color: 'linear-gradient(#5ac8fa, #0a84ff)',
  desc: 'See the other computer’s screen in a window here.',
  master: {
    get: (s) => s.stream.state === 'on' || !!(s.stream.remote && s.stream.remote.on),
    set: (v) => (v ? UI.api.openMonitor() : UI.api.remoteScreen({ share: false })),
    disabled: (s) => s.link.state !== 'connected' || !(s.stream.remote && s.stream.remote.remote),
  },
  badge: (s) => (s.stream.state === 'on' || (s.stream.remote && s.stream.remote.on) ? 'on' : ''),
  build(body) {
    const { el, api } = UI;
    const t = (k, p, d) => (typeof window.t === 'function' ? window.t(k, p, d) : d !== undefined ? d : k);
    const openBtn = UI.button(t('files.open', null, 'Open'), () => api.openMonitor(), 'primary');
    const winRow = UI.row(t('receive.screen_window', null, 'Screen window'), '', [openBtn]);
    // (as the Mac): one control, the same three choices as on the other computer itself,
    // kept in step by its screen.state; choosing sends screen.ctl.
    const mode = UI.segmented([
      { value: 'off', label: t('clipboard.off', null, 'Off') },
      { value: 'mirror', label: t('receive.mirror', null, 'Mirror') },
      { value: 'extend', label: t('receive.extend', null, 'Extend') },
    ], (v) => api.remoteScreen(v === 'off' ? { share: false } : { share: true, mode: v }));
    const modeRow = UI.row(t('receive.name_shares', null, '{Name} shares'), '', [mode]);
    const volume = UI.slider({ min: 0, max: 1, step: 0.05, format: (v) => Math.round(v * 100) + '%' }, (v) => api.setMonitor({ volume: v }));
    const mute = UI.switch((v) => api.setMonitor({ mute: !v }), { label: t('receive.play_sound', null, 'Play sound') });
    const paceRow = UI.paceRow(); // One Playback setting, synced with the other computer
    const framegen = UI.switch((v) => api.setMonitor({ framegen: v }), { label: t('receive.frame_generation', null, 'Frame generation') });

    const details = UI.details(['Status', 'Display', 'Picture', 'Speed', 'Round trip', 'Codec', 'Decoder', 'Delay', 'Frames dropped', 'Freezes']);

    body.append(
      UI.card('', [
        winRow,
        modeRow,
        paceRow,
        UI.row(t('receive.frame_generation', null, 'Frame generation'), t('receive.fills_in_late_or_dropped_frames', null, 'Fills in late or dropped frames, and adds in-between frames when this screen is faster than the stream'), [framegen]),
        UI.row(t('receive.sound', null, 'Sound'), '', [mute, volume]),
        UI.row(t('receive.full_screen', null, 'Full screen'), '', [el('kbd', { text: 'F11' })]),
      ], { cls: 'keep-on' }),
      details,
    );

    return (s) => {
      const st = s.stream;
      const on = st.state === 'on';
      const connected = s.link.state === 'connected';
      openBtn.disabled = !connected;
      openBtn.textContent = st.watching ? t('receive.show', null, 'Show') : t('files.open', null, 'Open');
      const who = UI.peer(s).the;
      const sharing = on || !!(st.remote && st.remote.on); // on over there, maybe paused while nobody watches
      const r = st.remote;
      winRow.setHint(!connected ? t('receive.waiting_for_name', { name: who }, 'Waiting for {name}') : on ? t('receive.showing_name', { name: st.name }, 'Showing {name}') : sharing ? t('receive.sharing_on_name_open_to', { name: who }, 'Sharing on {name}. Open to watch.')
        : r && r.remote ? t('receive.open_starts_sharing_on_name', { name: who }, 'Open starts sharing on {name}') : t('receive.turn_on_sharing_on_name', { name: who }, 'Turn on sharing on {name}'));
      mode.set(r ? (r.on ? r.mode : 'off') : '');
      const MODES = ['off', 'mirror', 'extend'];
      mode.el.querySelectorAll('button').forEach((b, i) => { b.disabled = !connected || !r || !r.remote || (i > 0 && !(r.modes || []).includes(MODES[i])); });
      modeRow.setHint(!connected ? t('receive.connect_to_choose_from_here', null, 'Connect to choose from here')
        : !r ? t('receive.update_duodesk_on_the_other', null, 'Update DuoDesk on the other computer to choose from here')
          : !r.remote ? t('receive.the_other_computer_doesn_t', null, 'The other computer doesn’t allow choosing from here')
            : r.on ? (r.mode === 'extend' ? t('receive.an_extra_screen_for_it', null, 'An extra screen for it, shown here') : t('receive.its_main_screen_shown_here', null, 'Its main screen, shown here')) : t('receive.pick_mirror_or_extend_or', null, 'Pick Mirror or Extend, or just press Open'));
      mute.set(!s.monitor.mute);
      volume.set(s.monitor.volume);
      paceRow.render(s);
      framegen.set(s.monitor.framegen);
      const x = on && st.stats;
      details.set({
        Status: !connected ? t('sidebar.not_connected', null, 'Not connected') : !on ? (sharing ? t('receive.paused_nobody_watching', null, 'Paused, nobody watching') : t('clipboard.off', null, 'Off')) : s.macInput ? t('receive.live', null, 'Live') : t('receive.live_view_only', null, 'Live, view only'),
        Display: on ? st.name + (st.width ? ', ' + st.width + ' × ' + st.height : x ? ', ' + x.width + ' × ' + x.height : '') : '',
        Picture: x ? x.width + ' × ' + x.height + ', ' + x.fps + ' fps' : '',
        Speed: x ? t('receive.mbps_received', { mbps: x.mbps }, '{mbps} Mbps received') : '',
        'Round trip': x && x.rttMs != null ? x.rttMs + ' ms' : '',
        Codec: x ? x.codec.toUpperCase() : '',
        Decoder: x && x.decoder ? UI.codecImpl(x.decoder, x.hw) : '',
        Delay: x ? x.delayMs + ' ms' : '',
        'Frames dropped': x ? x.dropped : '',
        Freezes: x ? x.freezes || 0 : '',
      });
    };
  },
});
