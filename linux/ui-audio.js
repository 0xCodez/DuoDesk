// TwinDesk — Copyright (C) 2026 inukaasith. GPL-3.0, see LICENSE.
// Audio tab (copy of windows/ui-audio.js): sound both ways, each its own stream: play the
// other computer's sound here, and send this computer's sound there (PulseAudio/PipeWire loopback,
// loopback.js). Screen sound lives in Share screen.
'use strict';

UI.tab({
  id: 'audio',
  wifiOnly: true, // over Bluetooth it can't work and doesn't move the session onto Wi-Fi: says so, with Connect with Wi-Fi Direct
  order: 70,
  title: 'Audio',
  color: 'linear-gradient(#ff6482, #ff2d55)',
  desc: 'Hear one computer on the other.',
  master: { get: (s) => s.audio.send || s.audio.receive, set: (v) => UI.api.setAudio({ send: v, receive: v }) },
  badge: (s) => (s.audio.receiving || s.audio.sending ? 'on' : ''),
  build(body) {
    const { api } = UI;
    const t = (k, p, d) => (typeof window.t === 'function' ? window.t(k, p, d) : d !== undefined ? d : k);
    const set = (partial) => api.setAudio(partial);
    const volume = UI.slider({ min: 0, max: 1, step: 0.05, format: (v) => Math.round(v * 100) + '%' }, (v) => set({ volume: v }));
    const mute = UI.switch((v) => set({ muteLocal: v }), { label: t('audio.mute_me_while_sending', null, 'Mute {me} while sending') });
    const recvState = UI.row('', '');
    const sendState = UI.row('', '');
    const pair = UI.dirCards(
      { on: { get: (s) => s.audio.receive, set: (v) => set({ receive: v }) }, label: t('audio.play_name_s_sound_on', null, 'Play {name}’s sound on {me}'), rows: [
        UI.row(t('audio.volume', null, 'Volume'), '', [volume]),
        recvState,
      ] },
      { on: { get: (s) => s.audio.send, set: (v) => set({ send: v }) }, label: t('audio.play_me_s_sound_on', null, 'Play {me}’s sound on {name}'), rows: [
        sendState,
      ] },
    );
    const phoneCard = UI.phoneAudioCard(); // a phone: its sound here over Bluetooth, its media controls
    body.append(
      pair.el,
      phoneCard.el,
    );
    return (s) => {
      phoneCard.update(s);
      const a = s.audio;
      const connected = s.link.state === 'connected';
      pair.update(s);
      volume.set(a.volume);
      mute.set(a.muteLocal); // not on Linux: the loopback hears what the speakers play
      recvState.hidden = !a.receive;
      const nm = UI.peer(s).name;
      const phone = UI.phoneSound && UI.phoneSound(s);
      recvState.label.textContent = phone != null ? phone : a.receiving ? t('audio.playing_name', { name: nm }, 'Playing {name}') : connected ? t('clipboard.turned_off_on', { name: nm }, 'Turned off on {name}') : t('audio.waiting_for_name', { name: nm }, 'Waiting for {name}');
      sendState.hidden = !a.send && !a.error;
      sendState.label.textContent = a.sending ? t('audio.playing_on_name', { name: nm }, 'Playing on {name}') : !connected ? t('audio.waiting_for_name', { name: nm }, 'Waiting for {name}') : !a.macAccepts ? t('clipboard.turned_off_on', { name: nm }, 'Turned off on {name}') : t('sidebar.connecting', null, 'Connecting…');
      sendState.setHint(a.error || '');
    };
  },
});
