// MacShare — Copyright (C) 2026 MacShare contributors. GPL-3.0, see LICENSE.
// General tab: start at sign-in and firewall check (phase 6), this PC, about.
'use strict';

UI.tab({
  id: 'general',
  order: 100,
  title: 'General',
  color: 'linear-gradient(#aeaeb2, #636366)',
  desc: 'Startup, network and about.',
  bottom: true,
  build(body) {
    const { el } = UI;
    const deviceRow = UI.row('', '');
    const versionRow = UI.row('MacShare for Windows', '');

    body.append(
      UI.card('Startup', [
        UI.row('Start with Windows', 'Opens hidden in the tray when you sign in (phase 6)', [UI.switch(() => {}, { disabled: true, label: 'Start with Windows' })]),
      ]),
      UI.card('Network', [
        UI.row('Firewall check', 'Checks that the network is Private and MacShare is allowed through Windows Firewall (phase 6)', [el('span', { class: 'pill muted', text: 'Phase 6' })]),
      ]),
      UI.card('This PC', [deviceRow]),
      UI.card('About', [
        versionRow,
        UI.row('Licence', 'Free and open source under the GNU GPL v3. Parts adapted from Beamer (Kalkman Code, GPL-3.0).'),
      ], { cls: 'keep-on' }),
    );

    return (s) => {
      deviceRow.label.textContent = s.device.name;
      deviceRow.setHint('Device id ' + s.device.id.slice(0, 8) + '…');
      versionRow.setHint('Version ' + s.version + ' · protocol ' + UI.P.PROTOCOL_VERSION);
    };
  },
});
