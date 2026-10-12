// MacShare — Copyright (C) 2026 MacShare contributors. GPL-3.0, see LICENSE.
// Audio tab: sound both ways, each its own stream (revision 2): play the Mac's sound (Mac → PC)
// and send this PC's sound (PC → Mac). Screen sound lives in Display.
'use strict';

UI.tab({
  id: 'audio',
  order: 70,
  title: 'Audio',
  color: 'linear-gradient(#ff6482, #ff2d55)',
  desc: 'Hear one computer’s sound on the other — each direction on its own.',
  badge: (s) => (s.audio.receiving || s.audio.sending ? 'on' : ''),
  build(body) {
    const { api } = UI;
    const set = (partial) => api.setAudio(partial);
    const volume = UI.slider({ min: 0, max: 1, step: 0.05, format: (v) => Math.round(v * 100) + '%' }, (v) => set({ volume: v }));
    const mute = UI.switch((v) => set({ muteLocal: v }), { label: 'Mute this PC while sending' });
    const recvState = UI.row('', '');
    const sendState = UI.row('', '');
    const pair = UI.dirCards(
      { on: { get: (s) => s.audio.receive, set: (v) => set({ receive: v }) }, rows: [
        UI.row('Play the Mac’s sound here', 'On this PC’s speakers or headphones'),
        UI.row('Volume', 'Windows’ own volume still applies', [volume]),
        recvState,
      ] },
      { on: { get: (s) => s.audio.send, set: (v) => set({ send: v }) }, rows: [
        UI.row('Send this PC’s sound to the Mac', 'Everything this PC plays'),
        UI.row('Mute this PC while sending', 'Sound only comes out of the Mac', [mute]),
        sendState,
      ] },
    );
    body.append(
      pair.el,
      UI.card('Good to know', [
        UI.row('Low latency, its own stream', 'Sound travels separately from the screen (Opus, stereo), so a sound-only setup has no video delay. Screen sound — in sync with Monitor 2 — is an option in Display.'),
      ], { cls: 'keep-on' }),
    );
    return (s) => {
      const a = s.audio;
      const connected = s.link.state === 'connected';
      pair.update(s);
      volume.set(a.volume);
      mute.set(a.muteLocal);
      recvState.label.textContent = !a.receive ? 'Off' : a.receiving ? 'Playing the Mac’s sound' : 'Waiting for the Mac';
      recvState.setHint(a.receive && !a.receiving ? 'Starts when the Mac turns on “Send this Mac’s sound” (Mac: Audio tab).' : '');
      sendState.label.textContent = !a.send ? 'Off' : a.sending ? 'Sending to the Mac' : !connected ? 'Waiting for the Mac' : !a.macAccepts ? 'The Mac isn’t playing it' : 'Starting…';
      sendState.setHint(a.error || (a.send && connected && !a.macAccepts ? 'Turn on “Play the PC’s sound” on the Mac (Audio tab).' : ''));
    };
  },
});
