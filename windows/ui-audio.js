// MacShare — Copyright (C) 2026 MacShare contributors. GPL-3.0, see LICENSE.
// Audio tab: sound both ways, each its own stream (revision 2): play the Mac's sound (Mac → PC)
// and send this PC's sound (PC → Mac). Screen sound lives in Display.
'use strict';

UI.tab({
  id: 'audio',
  order: 70,
  title: 'Audio',
  color: 'linear-gradient(#ff6482, #ff2d55)',
  desc: 'Hear one computer on the other.',
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
        UI.row('Play the Mac’s sound here', ''),
        UI.row('Volume', '', [volume]),
        recvState,
      ] },
      { on: { get: (s) => s.audio.send, set: (v) => set({ send: v }) }, rows: [
        UI.row('Send this PC’s sound', ''),
        UI.row('Mute this PC while sending', '', [mute]),
        sendState,
      ] },
    );
    body.append(
      pair.el,
    );
    return (s) => {
      const a = s.audio;
      const connected = s.link.state === 'connected';
      pair.update(s);
      volume.set(a.volume);
      mute.set(a.muteLocal);
      recvState.hidden = !a.receive;
      recvState.label.textContent = a.receiving ? 'Playing your Mac' : connected ? 'Turned off on the Mac' : 'Waiting for your Mac';
      sendState.hidden = !a.send && !a.error;
      sendState.label.textContent = a.sending ? 'Playing on your Mac' : !connected ? 'Waiting for your Mac' : !a.macAccepts ? 'Turned off on the Mac' : 'Connecting…';
      sendState.setHint(a.error || '');
    };
  },
});
