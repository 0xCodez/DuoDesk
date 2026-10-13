// MacShare — Copyright (C) 2026 MacShare contributors. GPL-3.0, see LICENSE.
// General tab (Linux): desktop session, firewall (+ Fix), helper, this computer, about, Quit (some
// desktops show no tray icon, so Quit lives here too).
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
    const fwPill = el('span', { class: 'pill' });
    const fwCheck = UI.button('Check again', () => api.checkFirewall(), 'small');
    const fwFix = UI.button('Fix', () => api.fixFirewall(), 'small primary');
    const fwRow = UI.row('Firewall', '', [fwPill, fwCheck, fwFix]);
    const sessPill = el('span', { class: 'pill' });
    const sessRow = UI.row('Desktop session', '', [sessPill]);
    const helperPill = el('span', { class: 'pill' });
    const helperRow = UI.row('Mouse and keyboard helper', '', [helperPill]);
    const hudSw = UI.switch((v) => api.setApp({ hud: v }), { label: 'Show a popup when switching' });
    const deviceRow = UI.row('', '');
    const versionRow = UI.row('MacShare for Linux', '');

    body.append(
      UI.card('Network', [fwRow]),
      UI.card('This computer', [sessRow, helperRow, deviceRow]),
      UI.card('Popups', [UI.row('Show a popup when switching', 'When the mouse and keyboard move between computers', [hudSw])]),
      UI.card('About', [
        versionRow,
        UI.row('Licence', 'Free and open source, GPL v3'),
        UI.row('Quit MacShare', '', [UI.button('Quit', () => api.quit(), 'small')]),
      ], { cls: 'keep-on' }),
    );

    return (s) => {
      const fw = s.firewall || {};
      fwPill.textContent = fw.checking ? 'Checking…' : fw.ok ? 'OK' : fw.ok === false ? 'Needs a fix' : '';
      fwPill.className = 'pill ' + (fw.checking ? 'muted' : fw.ok ? 'good' : 'bad');
      fwRow.setHint(fw.checking ? '' : fw.message || '');
      fwCheck.disabled = !!fw.checking;
      fwFix.hidden = fw.checking || fw.ok !== false;
      const x11 = s.session.type === 'x11';
      sessPill.textContent = x11 ? 'X11' : s.session.type === 'wayland' ? 'Wayland' : 'Unknown';
      sessPill.className = 'pill ' + (x11 ? 'good' : 'muted');
      sessRow.setHint((s.session.wsl ? 'WSL. ' : '') + (x11 ? '' : 'Mouse and keyboard sharing will need Xorg.'));
      const h = s.kvmState.helper;
      helperPill.textContent = h ? (h === 'starting' ? 'Starting…' : 'Not running') : 'Running';
      helperPill.className = 'pill ' + (h ? (h === 'starting' ? 'muted' : 'bad') : 'good');
      helperRow.setHint(h && h !== 'starting' ? h : '');
      hudSw.set(s.app.hud);
      deviceRow.label.textContent = s.device.name;
      versionRow.setHint('Version ' + s.version);
    };
  },
});
