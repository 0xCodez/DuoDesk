// MacShare — Copyright (C) 2026 MacShare contributors. GPL-3.0, see LICENSE.
// Audio tab (phase 10): this Mac's sound on the PC (with the screen stream), mute here while
// sending. PC -> Mac sound is listed as coming next.
'use strict';

UI.tab({
  id: 'audio',
  order: 70,
  title: 'Audio',
  desc: 'Hear this Mac on the PC. The sound travels with the screen, so it stays in sync with Monitor 2.',
  color: 'linear-gradient(#ff6482, #ff2d55)',
  master: { get: (s) => s.audio && s.audio.send, set: (v) => UI.api.setAudio({ send: v }) },
  badge: (s) => (s.audio && s.audio.send ? 'on' : ''),
  build(body) {
    const { api } = UI;
    const status = UI.note('info', '');
    const mute = UI.switch((v) => api.setAudio({ muteLocal: v }), { label: 'Mute this Mac while sending' });
    const stateRow = UI.row('Sound to the PC', '');
    body.append(
      status,
      UI.card('This Mac → PC', [
        stateRow,
        UI.row('Mute this Mac while sending', 'Silence this Mac’s speakers; the PC still gets the sound', [mute]),
      ]),
      UI.card('PC → this Mac', [
        UI.row('Play the PC’s sound here', 'Coming next: the PC sends its sound over a second connection', [UI.switch(() => {}, { disabled: true, label: 'Play the PC sound' })]),
      ], { cls: 'keep-on' }),
      UI.card('How it works', [
        UI.row('System sound is captured with ScreenCaptureKit (no extra driver) and sent as high-quality stereo Opus on the same encrypted connection as Monitor 2.', ''),
      ], { cls: 'keep-on' }),
    );
    return (s) => {
      const a = s.audio;
      if (!a) return;
      mute.set(a.muteLocal);
      let text = '';
      let kind = 'info';
      if (!a.send) text = 'Off — the PC hears nothing from this Mac.';
      else if (!s.client) text = 'Waiting for your PC to connect.';
      else if (!a.peerAccepts) { kind = 'warn'; text = `${s.client.name} isn’t playing this Mac’s sound — turn it on in the PC app’s Audio tab.`; }
      else if (a.error) { kind = 'bad'; text = `Can’t capture sound: ${a.error}`; }
      else if (!s.sharing || !s.sharing.on) { kind = 'warn'; text = 'Sound goes with screen sharing — turn on Display › Share.'; }
      else if (a.on) text = `Playing on ${s.client.name}.`;
      else text = 'Starting…';
      status.className = `note ${kind}`;
      status.set(text);
      stateRow.setHint(a.on ? 'Live — stereo, 48 kHz' : 'Not sending');
    };
  },
});
