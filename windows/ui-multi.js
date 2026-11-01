// TwinDesk — Copyright (C) 2026 inukaasith. GPL-3.0, see LICENSE.
// Multi-device tab, one-to-one app: what it is and the button that turns it on (multi.js). DuoDesk
// restarts into mesh/main.js, whose own page (mesh/ui-multi.js) has the settings for several devices.
'use strict';

UI.tab({
  id: 'multi',
  order: 95,
  title: 'Multi-device',
  color: 'linear-gradient(#5e5ce6, #3634a3)',
  desc: 'Several computers and phones connected at once',
  bottom: true,
  build(body) {
    const { api } = UI;
    const t = (k, p, d) => (typeof window.t === 'function' ? window.t(k, p, d) : d !== undefined ? d : k);
    // The popup says what it is (shared/mesh-intro.js) before it restarts.
    const turnOn = UI.button(t('multi.turn_on', null, 'Turn on'), () => MeshIntro.confirm(() => {
      turnOn.disabled = true;
      turnOn.textContent = t('multi.restarting', null, 'Restarting…');
      api.setMulti(true);
    }), 'small primary');

    body.append(
      UI.card(t('multi.mesh_mode', null, 'Mesh mode'), [
        UI.row(t('multi.use_several_devices_at_once', null, 'Use several devices at once'),
          t('multi.computers_and_phones_connected_at', null, 'Computers and phones connected at the same time: one clipboard and one set of notifications for all, each screen edge leading to another device, a phone and a computer together'),
          [turnOn]),
      ]),
      UI.note('info', t('multi.duodesk_restarts_when_you_turn', null, 'DuoDesk restarts when you turn it on or off.')),
      MeshIntro.art(),
    );

    return () => {};
  },
});
