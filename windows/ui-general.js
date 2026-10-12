// MacShare — Copyright (C) 2026 MacShare contributors. GPL-3.0, see LICENSE.
// General tab: start with Windows, firewall self-check (+ Fix), helper, this PC, about.
'use strict';

UI.tab({
  id: 'general',
  order: 100,
  title: 'General',
  color: 'linear-gradient(#aeaeb2, #636366)',
  desc: 'Startup, network and about.',
  bottom: true,
  badge: (s) => (s.firewall && s.firewall.ok === false && !s.firewall.checking ? 'warn' : ''),
  build(body) {
    const { el, api } = UI;
    const startup = UI.switch((v) => api.setStartup(v), { label: 'Start with Windows' });
    const fwPill = el('span', { class: 'pill' });
    const fwCheck = UI.button('Check again', () => api.checkFirewall(), 'small');
    const fwFix = UI.button('Fix', () => api.fixFirewall(), 'small primary');
    const fwRow = UI.row('Firewall and network', '', [fwPill, fwCheck, fwFix]);
    const helperPill = el('span', { class: 'pill' });
    const helperRow = UI.row('Input helper', '', [helperPill]);
    const deviceRow = UI.row('', '');
    const versionRow = UI.row('MacShare for Windows', '');

    body.append(
      UI.card('Startup', [
        UI.row('Start with Windows', 'Opens hidden in the tray when you sign in, and reconnects by itself', [startup]),
      ]),
      UI.card('Network', [fwRow]),
      UI.card('This PC', [helperRow, deviceRow]),
      UI.card('About', [
        versionRow,
        UI.row('Licence', 'Free and open source under the GNU GPL v3. Parts adapted from Beamer (Kalkman Code, GPL-3.0).'),
      ], { cls: 'keep-on' }),
    );

    return (s) => {
      startup.set(s.startup);
      const fw = s.firewall || {};
      fwPill.textContent = fw.checking ? 'Checking…' : fw.ok ? 'OK' : fw.ok === false ? 'Needs a fix' : '—';
      fwPill.className = 'pill ' + (fw.checking ? 'muted' : fw.ok ? 'good' : 'bad');
      fwRow.setHint((fw.message || '') + (fw.ok === false && !fw.error ? ' Fix asks for administrator rights once.' : ''));
      fwCheck.disabled = !!fw.checking;
      fwFix.hidden = fw.checking || fw.ok !== false || !!fw.error;
      const h = s.kvmState.helper;
      helperPill.textContent = h ? (h === 'starting' ? 'Starting…' : 'Not running') : 'Running';
      helperPill.className = 'pill ' + (h ? (h === 'starting' ? 'muted' : 'bad') : 'good');
      helperRow.setHint(h && h !== 'starting' ? h : 'Moves the pointer and types for the Mac, and watches the screen edge. Restarts by itself if it stops.');
      deviceRow.label.textContent = s.device.name;
      deviceRow.setHint('Device id ' + s.device.id.slice(0, 8) + '…');
      versionRow.setHint('Version ' + s.version + ' · protocol ' + UI.P.PROTOCOL_VERSION);
    };
  },
});
