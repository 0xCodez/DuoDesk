// TwinDesk — Copyright (C) 2026 inukaasith. GPL-3.0, see LICENSE.
// Multi-device tab, one-to-one app: what it is and the button that turns it on (multi.js). TwinDesk
// restarts into mesh/main.js, whose own page (mesh/ui-multi.js) has the settings for several devices.
'use strict';

UI.tab({
  id: 'multi',
  order: 95,
  title: 'Multi-device',
  desc: 'Several computers and phones connected at once',
  color: 'linear-gradient(#5e5ce6, #3634a3)',
  bottom: true,
  build(body) {
    const { api } = UI;
    const turnOn = UI.button('Turn on', () => {
      turnOn.disabled = true;
      turnOn.textContent = 'Restarting…';
      api.setMulti(true);
    }, 'small primary');

    body.append(
      UI.card('Multi-device', [
        UI.row('Use several devices at once',
          'Computers and phones connected at the same time: one clipboard and one set of notifications for all, each screen edge leading to another device, a phone and a computer together',
          [turnOn]),
      ]),
      UI.note('info', 'TwinDesk restarts to turn it on or off, and connections drop for a moment. Turned off again, everything is as it was before. Windows, Mac and Linux computers take part (Linux with other computers on the same network only); the phone app connects to one computer at a time.'),
    );

    return () => {};
  },
});
