// MacShare — Copyright (C) 2026 MacShare contributors. GPL-3.0, see LICENSE.
// Audio tab: play the Mac's sound here (phase 10). PC → Mac sound comes later.
'use strict';

UI.tab({
  id: 'audio',
  order: 70,
  title: 'Audio',
  color: 'linear-gradient(#ff6482, #ff2d55)',
  desc: 'Hear the Mac’s sound on this PC, in sync with Monitor 2.',
  master: { get: (s) => s.audio.receive, set: (v) => UI.api.setAudio({ receive: v }) },
  badge: (s) => (s.audio.receive ? 'on' : ''),
  build(body) {
    const { api } = UI;
    const volume = UI.slider({ min: 0, max: 1, step: 0.05, format: (v) => Math.round(v * 100) + '%' }, (v) => api.setAudio({ volume: v }));
    const state = UI.row('Now', '');
    body.append(
      UI.card('Mac → this PC', [
        state,
        UI.row('Volume', 'For the Mac’s sound only; Windows’ own volume still applies', [volume]),
      ]),
      UI.card('How it works', [
        UI.row('Part of the screen stream', 'The sound travels with Monitor 2’s video, so it stays in sync. It plays while the Mac shares its screen and has “Send sound” on (Mac: Audio tab).'),
      ], { cls: 'keep-on' }),
      UI.card('Coming later', [
        UI.row('This PC → Mac', 'The PC’s sound on the Mac', [UI.switch(() => {}, { disabled: true, label: 'PC to Mac' })]),
      ], { cls: 'keep-on' }),
    );
    return (s) => {
      volume.set(s.audio.volume);
      state.label.textContent = !s.audio.receive ? 'Off' : s.stream.state === 'on' ? 'Plays when the Mac sends sound' : 'Waiting for the Mac to share its screen';
      state.setHint(s.audio.receive ? 'The Mac is asked to send its sound.' : 'The Mac is told not to send sound.');
    };
  },
});
