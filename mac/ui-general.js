// MacShare — Copyright (C) 2026 MacShare contributors. GPL-3.0, see LICENSE.
// General tab: permissions, app behaviour, about.
'use strict';

UI.tab({
  id: 'general',
  order: 100,
  title: 'General',
  desc: 'Permissions, startup and information about MacShare.',
  color: 'linear-gradient(#aeaeb2, #636366)',
  bottom: true,
  badge: (s) => {
    const p = s.permissions;
    return p && (p.screen !== 'granted' || !p.accessibility || p.inputMonitoring === false) ? '!' : '';
  },
  build(body) {
    const { el, api } = UI;
    const PERMS = [
      { kind: 'screen', label: 'Screen Recording', note: 'Needed to share a screen' },
      { kind: 'accessibility', label: 'Accessibility', note: 'Needed for the PC to control this Mac' },
      { kind: 'inputMonitoring', label: 'Input Monitoring', note: 'Needed to use this Mac’s keyboard on the PC' },
    ];
    const perms = PERMS.map((p) => {
      const pill = el('span', { class: 'pill' });
      const row = UI.row(p.label, p.note, [pill, UI.button('Open Settings', () => api.openSettings(p.kind), 'small')]);
      return { p, pill, row };
    });
    const helperRow = UI.row('Helper', 'Creates the virtual display and injects input');
    const helperVal = el('span', { class: 'value' });
    helperRow.querySelector('.controls').append(helperVal);
    const version = el('span', { class: 'value' });
    const loginSw = UI.switch((v) => api.setApp({ openAtLogin: v }), { label: 'Open at login' });
    const awakeSw = UI.switch((v) => api.setApp({ keepAwake: v }), { label: 'Keep the display awake' });

    body.append(
      UI.card('Permissions', [
        ...perms.map((x) => x.row),
        UI.row('After granting a permission', 'macOS applies it when MacShare restarts', [UI.button('Restart MacShare', () => api.relaunch(), 'small')]),
      ]),
      UI.card('App', [
        UI.row('Open at login', 'Start MacShare in the menu bar when you log in (no window)', [loginSw]),
        UI.row('Keep the display awake', 'While a PC is connected, so Monitor 2 never goes dark', [awakeSw]),
        helperRow,
      ]),
      UI.card('About', [
        UI.row('MacShare', 'A Mac and a Windows PC that work as one. Free software under the GNU GPL v3.', [version]),
        UI.row('Thanks', 'Beamer by Kalkman Code (GPL-3.0) for the shared-input design; DeskPad (MIT) for the virtual display header.'),
      ]),
    );

    return (s) => {
      for (const { p, pill } of perms) {
        const v = s.permissions[p.kind];
        const ok = p.kind === 'screen' ? v === 'granted' : v === true;
        const unknown = v === null || v === undefined || v === 'unknown';
        pill.className = `pill ${unknown ? 'muted' : ok ? 'good' : 'bad'}`;
        pill.textContent = unknown ? 'Unknown' : ok ? 'Granted' : 'Not granted';
      }
      if (s.app) {
        loginSw.set(s.app.openAtLogin);
        awakeSw.set(s.app.keepAwake);
      }
      helperVal.textContent = s.helper && s.helper.running ? 'Running' : 'Not running';
      version.textContent = s.version ? `Version ${s.version}` : '';
    };
  },
});
