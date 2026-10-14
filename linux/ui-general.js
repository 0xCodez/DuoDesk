// TwinDesk — Copyright (C) 2026 inukaasith. GPL-3.0, see LICENSE.
// General tab (same cards as the PC's): open at login, the switching popup, firewall self-check
// (+ Fix), wake from the network, the desktop session and input access (Wayland), the
// helper, this computer, about and Quit (some desktops have no tray to quit from).
'use strict';

UI.tab({
  id: 'general',
  order: 100,
  title: 'General',
  color: 'linear-gradient(#aeaeb2, #636366)',
  desc: '',
  bottom: true,
  badge: (s) => ((s.firewall && s.firewall.ok === false && !s.firewall.checking) || s.setup.missing.includes('input') ? 'warn' : s.updates && s.updates.available ? '1' : ''),
  build(body) {
    const { el, api } = UI;
    const startup = UI.switch((v) => api.setStartup(v), { label: 'Open at login' });
    const hudSw = UI.switch((v) => api.setApp({ hud: v }), { label: 'Show a popup when switching' });
    const fwPill = el('span', { class: 'pill' });
    const fwCheck = UI.button('Check again', () => api.checkFirewall(), 'small');
    const fwFix = UI.button('Fix', () => api.fixFirewall(), 'small primary');
    const fwRow = UI.row('Firewall', '', [fwPill, fwCheck, fwFix]);
    const wakeSw = UI.switch((v) => api.setWake(v), { label: 'Wake from the network' });
    const wakeRow = UI.row('Let the other computer wake {me}', '', [wakeSw]);
    const sessPill = el('span', { class: 'pill' });
    const sessRow = UI.row('Desktop session', '', [sessPill]);
    const inPill = el('span', { class: 'pill' });
    const inFix = UI.button('Fix', () => api.fixInput(), 'small primary');
    const inRow = UI.row('Input access', '', [inPill, inFix]);
    const helperPill = el('span', { class: 'pill' });
    const helperRow = UI.row('Mouse and keyboard helper', '', [helperPill]);
    const deviceName = el('span', { class: 'value' });
    const deviceRow = UI.row('Computer name', 'How other computers see this one', [deviceName]);
    const versionRow = UI.row('TwinDesk for Linux', '');
    // Updates: new releases of TwinDesk on GitHub.
    const updStatus = el('span', { class: 'value' });
    const updCheck = UI.button('Check now', () => api.checkUpdates(), 'small');
    const updGet = UI.button('Download', () => api.openUpdate(), 'small primary');
    const updRow = UI.row('TwinDesk', '', [updStatus, updGet, updCheck]);
    const updAuto = UI.switch((v) => api.setUpdates({ auto: v }), { label: 'Check for updates automatically' });

    body.append(
      UI.card('App', [
        UI.row('Open at login', 'Starts in the tray', [startup]),
        UI.row('Show a popup when switching', 'When the mouse and keyboard move between computers', [hudSw]),
      ]),
      UI.card('Network and sharing', [fwRow, wakeRow]),
      UI.card('This computer', [deviceRow, sessRow, inRow, helperRow]),
      UI.card('Updates', [
        updRow,
        UI.row('Check automatically', 'Looks for new releases on GitHub every few hours', [updAuto]),
      ], { cls: 'keep-on' }),
      UI.card('About', [
        versionRow,
        UI.row('Made by', 'inukaasith'),
        UI.row('Licence', 'Free and open source, GPL v3. Copyright © 2026 inukaasith'),
        UI.row('Quit TwinDesk', 'Stops sharing until you open it again', [UI.button('Quit', () => api.quit(), 'small')]),
      ], { cls: 'keep-on' }),
    );

    return (s) => {
      startup.set(s.startup);
      hudSw.set(s.app.hud);
      const fw = s.firewall || {};
      fwPill.textContent = fw.checking ? 'Checking…' : fw.ok ? 'OK' : fw.ok === false ? 'Needs a fix' : '';
      fwPill.className = 'pill ' + (fw.checking ? 'muted' : fw.ok ? 'good' : 'bad');
      fwRow.setHint(fw.checking ? '' : fw.message || '');
      fwCheck.disabled = !!fw.checking;
      fwFix.hidden = fw.checking || fw.ok !== false;
      const w = s.wake || {};
      wakeSw.set(w.on === true);
      wakeSw.disable(!w.checked || w.on == null || !!w.busy);
      wakeRow.setHint(w.error ? w.error : w.busy ? 'Changing…' : !w.checked ? 'Checking…'
        : w.on == null ? 'No wired network adapter here can wake {me}'
          : 'Its wired network adapter wakes {me} on a magic packet. Asks for your password to change it');

      const ss = s.session || {};
      const x11 = ss.type === 'x11';
      const wl = ss.type === 'wayland';
      sessPill.textContent = x11 ? 'X11' : wl ? 'Wayland' : 'Unknown';
      sessPill.className = 'pill ' + (x11 || wl ? 'good' : 'muted');
      sessRow.setHint([ss.desktop, ss.wsl ? 'WSL' : '', ss.input ? 'input through ' + (ss.input === 'uinput' ? 'uinput (Wayland)' : 'XInput2 and XTest') : ''].filter(Boolean).join(' · '));
      inRow.hidden = !wl;
      const a = ss.access || {};
      const ok = a.uinput && a.read;
      inPill.textContent = ok ? 'OK' : a.uinput ? 'Partly' : 'Needs a fix';
      inPill.className = 'pill ' + (ok ? 'good' : 'bad');
      inFix.hidden = ok;
      inRow.setHint(ss.inputNote || (ok ? 'Reads the mouse and keyboard for crossing; injects through uinput'
        : a.uinput ? 'Can be controlled, but can’t read the mouse and keyboard to cross over (log out and back in after Fix)'
          : 'Needed to share the mouse and keyboard on Wayland. Asks for your password once'));
      const h = s.kvmState.helper;
      helperPill.textContent = h ? (h === 'starting' ? 'Starting…' : 'Not running') : 'Running';
      helperPill.className = 'pill ' + (h ? (h === 'starting' ? 'muted' : 'bad') : 'good');
      helperRow.setHint(h && h !== 'starting' ? h : '');
      deviceName.textContent = s.device.name;
      versionRow.setHint('Version ' + s.version);
      const u = s.updates;
      if (u) {
        updAuto.set(u.auto);
        updCheck.disabled = u.checking;
        updGet.hidden = !u.available;
        updStatus.textContent = u.checking ? 'Checking…' : u.available ? u.latest + ' is available' : u.checkedAt ? 'Up to date' : '';
        updRow.setHint(u.error ? 'Couldn’t check: ' + u.error
          : u.available ? 'You have ' + u.current + '. ' + (u.download ? 'Download ' + u.download.name : 'Opens the release page')
            : u.noReleases ? 'Version ' + u.current + '. No releases published yet'
              : 'Version ' + u.current + (u.checkedAt ? ' · checked ' + new Date(u.checkedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : ''));
      }
    };
  },
});
