// MacShare — Copyright (C) 2026 MacShare contributors. GPL-3.0, see LICENSE.
// Audio tab (revision 2): sound on its own, both ways, independent of the screen.
'use strict';

UI.tab({
  id: 'audio',
  order: 70,
  title: 'Audio',
  desc: 'Hear one computer on the other.',
  color: 'linear-gradient(#ff6482, #ff2d55)',
  badge: (s) => (s.audio && (s.audio.send || s.audio.receive) ? 'on' : ''),
  build(body) {
    const { api } = UI;
    const sendSw = UI.switch((v) => api.setAudio({ send: v }), { label: 'Send this Mac’s sound' });
    const mute = UI.switch((v) => api.setAudio({ muteLocal: v }), { label: 'Mute this Mac while sending' });
    const recvSw = UI.switch((v) => api.setAudio({ receive: v }), { label: 'Play the PC’s sound here' });
    const vol = UI.slider({ min: 0, max: 1, step: 0.05, format: (v) => `${Math.round(v * 100)}%` }, (v) => api.setAudio({ volume: v }));
    const sendRow = UI.row('Send this Mac’s sound', '', [sendSw]);
    const recvRow = UI.row('Play the PC’s sound here', '', [recvSw]);
    body.append(
      UI.pair(
        UI.dir('m2w', [sendRow, UI.row('Mute this Mac while sending', '', [mute])]),
        UI.dir('w2m', [recvRow, UI.row('Volume', '', [vol])]),
      ),
    );
    const live = (x) => x && x.status === 'live';
    return (s) => {
      const a = s.audio;
      if (!a) return;
      sendSw.set(a.send);
      mute.set(a.muteLocal);
      recvSw.set(a.receive);
      vol.set(a.volume);
      const pc = s.client ? s.client.name : 'the PC';
      sendRow.setHint(!a.send || !s.client ? ''
        : a.screenCarries ? 'Playing with the screen'
          : !a.peerAccepts ? `Turned off on ${pc}`
            : a.error ? `Can’t capture sound: ${a.error}`
              : live(a.sending) ? `Playing on ${pc}` : 'Connecting…');
      recvRow.setHint(!a.receive || !s.client ? '' : live(a.receiving) ? `Playing ${pc}` : `Waiting for ${pc}`);
    };
  },
});
