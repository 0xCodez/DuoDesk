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

    // The details card keys its rows by label, so the translated labels are also the keys of details.set.
    const L = {
      status: t('receive.status', null, 'Status'), display: t('receive.display', null, 'Display'), picture: t('clipboard.picture', null, 'Picture'), speed: t('receive.speed', null, 'Speed'),
      rtt: t('receive.round_trip', null, 'Round trip'), codec: t('receive.codec', null, 'Codec'), decoder: t('receive.decoder', null, 'Decoder'), delay: t('receive.delay', null, 'Delay'),
      dropped: t('receive.frames_dropped', null, 'Frames dropped'), freezes: t('receive.freezes', null, 'Freezes'),
    };
    const details = UI.details(Object.values(L));

    body.append(
      UI.card('', [
        winRow,
        modeRow,
        paceRow,
        UI.row(t('receive.frame_generation', null, 'Frame generation'), t('receive.fills_in_late_or_dropped', null, 'Fills in late or dropped frames, and adds in-between frames when this screen is faster than the stream'), [framegen]),
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
      winRow.setHint(!connected ? t('receive.waiting_for_the', { the: who }, 'Waiting for {the}') : on ? t('receive.showing_name', { name: st.name }, 'Showing {name}') : sharing ? t('receive.sharing_on_the_open_to', { the: who }, 'Sharing on {the}. Open to watch.')
        : r && r.remote ? t('receive.open_starts_sharing_on_the', { the: who }, 'Open starts sharing on {the}') : t('receive.turn_on_sharing_on_the', { the: who }, 'Turn on sharing on {the}'));
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
        [L.status]: !connected ? t('sidebar.not_connected', null, 'Not connected') : !on ? (sharing ? t('receive.paused_nobody_watching', null, 'Paused, nobody watching') : t('clipboard.off', null, 'Off')) : s.macInput ? t('receive.live', null, 'Live') : t('receive.live_view_only', null, 'Live, view only'),
        [L.display]: on ? st.name + (st.width ? ', ' + st.width + ' × ' + st.height : x ? ', ' + x.width + ' × ' + x.height : '') : '',
        [L.picture]: x ? x.width + ' × ' + x.height + ', ' + x.fps + ' fps' : '',
        [L.speed]: x ? t('receive.mbps_mbps_received', { mbps: x.mbps }, '{mbps} Mbps received') : '',
        [L.rtt]: x && x.rttMs != null ? x.rttMs + ' ms' : '',
        [L.codec]: x ? x.codec.toUpperCase() : '',
        [L.decoder]: x && x.decoder ? UI.codecImpl(x.decoder, x.hw) : '',
        [L.delay]: x ? x.delayMs + ' ms' : '',
        [L.dropped]: x ? x.dropped : '',
        [L.freezes]: x ? x.freezes || 0 : '',
      });
    };
  },
});
