// MacShare — Copyright (C) 2026 MacShare contributors. GPL-3.0, see LICENSE.
// General tab: start with Windows, the switching popup, firewall self-check (+ Fix), helper, this PC, about.
'use strict';

UI.tab({
  id: 'general',
  order: 100,
  title: 'General',
  color: 'linear-gradient(#aeaeb2, #636366)',
  desc: '',
  bottom: true,
  badge: (s) => (s.firewall && s.firewall.ok === false && !s.firewall.checking ? 'warn' : ''),
  build(body) {
    const { el, api } = UI;
    const startup = UI.switch((v) => api.setStartup(v), { label: 'Start with Windows' });
    const hudSw = UI.switch((v) => api.setApp({ hud: v }), { label: 'Show a popup when switching' });
    const fwPill = el('span', { class: 'pill' });
    const fwCheck = UI.button('Check again', () => api.checkFirewall(), 'small');
    const fwFix = UI.button('Fix', () => api.fixFirewall(), 'small primary');
    const fwRow = UI.row('Firewall', '', [fwPill, fwCheck, fwFix]);
    const helperPill = el('span', { class: 'pill' });
    const helperRow = UI.row('Mouse and keyboard helper', '', [helperPill]);
    const deviceRow = UI.row('', '');
    const versionRow = UI.row('MacShare for Windows', '');

    body.append(
      UI.card('App', [
        UI.row('Start with Windows', '', [startup]),
        UI.row('Show a popup when switching', 'When the mouse and keyboard move between computers', [hudSw]),
      ]),
      UI.card('Network', [fwRow]),
      UI.card('This PC', [helperRow, deviceRow]),
      UI.card('About', [
        versionRow,
        UI.row('Licence', 'Free and open source, GPL v3'),
      ], { cls: 'keep-on' }),
    );

    return (s) => {
      startup.set(s.startup);
      hudSw.set(s.app.hud);
      const fw = s.firewall || {};
      fwPill.textContent = fw.checking ? 'Checking…' : fw.ok ? 'OK' : fw.ok === false ? 'Needs a fix' : '';
      fwPill.className = 'pill ' + (fw.checking ? 'muted' : fw.ok ? 'good' : 'bad');
      fwRow.setHint(fw.ok === false ? fw.message || '' : '');
      fwCheck.disabled = !!fw.checking;
      fwFix.hidden = fw.checking || fw.ok !== false || !!fw.error;
      const h = s.kvmState.helper;
      helperPill.textContent = h ? (h === 'starting' ? 'Starting…' : 'Not running') : 'Running';
      helperPill.className = 'pill ' + (h ? (h === 'starting' ? 'muted' : 'bad') : 'good');
      helperRow.setHint(h && h !== 'starting' ? h : '');
      deviceRow.label.textContent = s.device.name;
      versionRow.setHint('Version ' + s.version);
    };
  },
});
