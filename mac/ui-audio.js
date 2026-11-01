// TwinDesk — Copyright (C) 2026 inukaasith. GPL-3.0, see LICENSE.
// Audio tab: sound on its own, both ways, independent of the screen.
'use strict';

UI.tab({
  id: 'audio',
  wifiOnly: true, // over Bluetooth it can't work and doesn't move the session onto Wi-Fi: says so, with Connect with Wi-Fi Direct
  group: 'More',
  order: 70,
  title: 'Audio',
  desc: 'Hear one computer on the other.',
  color: 'linear-gradient(#ff6482, #ff2d55)',
  master: { get: (s) => !!(s.audio && (s.audio.send || s.audio.receive)), set: (v) => UI.api.setAudio({ send: v, receive: v }) },
  badge: (s) => (s.audio && (s.audio.send || s.audio.receive) ? 'on' : ''),
  build(body) {
    const { api } = UI;
    const t = (k, p, d) => (typeof window.t === 'function' ? window.t(k, p, d) : d !== undefined ? d : k);
    const sendSw = UI.switch((v) => api.setAudio({ send: v }), { label: t('audio.send_sound', null, 'Send sound') });
    const mute = UI.switch((v) => api.setAudio({ muteLocal: v }), { label: t('audio.mute_while_sending', null, 'Mute while sending') });
    const recvSw = UI.switch((v) => api.setAudio({ receive: v }), { label: t('audio.play_sound_here', null, 'Play sound here') });
    const vol = UI.slider({ min: 0, max: 1, step: 0.05, format: (v) => `${Math.round(v * 100)}%` }, (v) => api.setAudio({ volume: v }));
    const sendRow = UI.row(t('audio.play_mes_sound_on', null, 'Play {me}’s sound on {name}'), '', [sendSw]);
    const recvRow = UI.row(t('audio.play_names_sound_on', null, 'Play {name}’s sound on {me}'), '', [recvSw]);
    const phoneCard = UI.phoneAudioCard(); // a phone: its media controls on Overview
    body.append(
      UI.pair(
        UI.dir('m2w', [sendRow, UI.row(t('audio.mute_me_while_sending', null, 'Mute {me} while sending'), '', [mute])]),
        UI.dir('w2m', [recvRow, UI.row(t('audio.volume', null, 'Volume'), '', [vol])]),
      ),
      phoneCard.el,
    );
    const live = (x) => x && x.status === 'live';
    return (s) => {
      const a = s.audio;
      if (!a) return;
      phoneCard.update(s);
      sendSw.set(a.send);
      mute.set(a.muteLocal);
      recvSw.set(a.receive);
      vol.set(a.volume);
      sendRow.setHint(!a.send || !s.client ? ''
        : a.screenCarries ? t('audio.playing_with_the_screen', null, 'Playing with the screen')
          : !a.peerAccepts ? t('clipboard.turned_off_on', null, 'Turned off on {name}')
            : a.error ? t('audio.cant_capture_sound', { error: a.error }, 'Can’t capture sound: {error}')
              : live(a.sending) ? t('audio.playing_on_name', null, 'Playing on {name}') : t('sidebar.connecting', null, 'Connecting…'));
      const phone = UI.phoneSound && UI.phoneSound(s);
      recvRow.setHint(!a.receive ? '' : phone != null ? phone : !s.client ? '' : live(a.receiving) ? t('audio.playing_name', null, 'Playing {name}') : t('audio.waiting_for_name', null, 'Waiting for {name}'));
    };
  },
});
