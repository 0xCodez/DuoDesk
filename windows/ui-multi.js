// TwinDesk — Copyright (C) 2026 inukaasith. GPL-3.0, see LICENSE.
// Multi-device tab, one-to-one app: what it is and the button that turns it on (multi.js). TwinDesk
// restarts into mesh/main.js, whose own page (mesh/ui-multi.js) has the settings for several devices.
'use strict';

UI.tab({
  id: 'multi',
  order: 95,
  title: 'Multi-device',
  color: 'linear-gradient(#5e5ce6, #3634a3)',
  desc: 'Several computers and phones connected at once',
  tag: 'Beta',
  bottom: true,
  build(body) {
    const { api } = UI;
    // Mesh mode is in beta: the popup says what's still rough (shared/mesh-intro.js) before it restarts.
    const turnOn = UI.button('Turn on', () => MeshIntro.confirm('win', () => {
      turnOn.disabled = true;
      turnOn.textContent = 'Restarting…';
      api.setMulti(true);
    }), 'small primary');

    body.append(
      UI.card('Mesh mode', [
        UI.row('Use several devices at once',
          'Computers and phones connected at the same time: one clipboard and one set of notifications for all, each screen edge leading to another device, a phone and a computer together',
          [turnOn]),
      ]),
      UI.note('info', 'TwinDesk restarts to turn it on or off, and connections drop for a moment. Turned off again, your pairings are as they were; settings both modes have (cursor, clipboard, keys…) keep what you set. Windows, Mac and Linux computers take part (Linux with other computers on the same network only); the phone app connects to one computer at a time.'),
      MeshIntro.art(),
    );

    return () => {};
  },
});
