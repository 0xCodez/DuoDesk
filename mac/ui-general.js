// TwinDesk — Copyright (C) 2026 inukaasith. GPL-3.0, see LICENSE.
// General tab: permissions, app behaviour, about.
'use strict';

UI.tab({
  id: 'general',
  order: 100,
  title: 'General',
  desc: '',
  color: 'linear-gradient(#aeaeb2, #636366)',
  bottom: true,
  badge: (s) => {
    const p = s.permissions;
    return p && (p.screen !== 'granted' || !p.accessibility || p.inputMonitoring === false) ? '!' : '';
  },
  build(body) {
    const { el, api } = UI;
    const PERMS = [
      { kind: 'screen', label: 'Screen Recording', note: 'To share your screen' },
      { kind: 'accessibility', label: 'Accessibility', note: 'So the other computer can control this one' },
      { kind: 'inputMonitoring', label: 'Input Monitoring', note: 'To use this keyboard on the other computer' },
    ];
    const perms = PERMS.map((p) => {
      const pill = el('span', { class: 'pill' });
      const row = UI.row(p.label, p.note, [pill, UI.button('Open', () => api.openSettings(p.kind), 'small')]);
      return { p, pill, row };
    });
    const helperRow = UI.row('Background helper', '');
    const helperVal = el('span', { class: 'value' });
    helperRow.querySelector('.controls').append(helperVal);
    const deviceName = el('span', { class: 'value' });
    const deviceRow = UI.row('Computer name', 'How other computers see this one', [deviceName]);
    const versionRow = UI.row('TwinDesk for macOS', '');
    const loginSw = UI.switch((v) => api.setApp({ openAtLogin: v }), { label: 'Open at login' });
    const awakeSw = UI.switch((v) => api.setApp({ keepAwake: v }), { label: 'Keep the display awake' });
    const hudSw = UI.switch((v) => api.setApp({ hud: v }), { label: 'Show a popup when switching' });
    // Wake this Mac from the other computer; the Share menu entry.
    const wakeSw = UI.switch((v) => api.setWakeOnLan(v), { label: 'Wake from the network' });
    const wakeRow = UI.row('Let {name} wake {me}', '', [wakeSw]);
    const shareRow = UI.row('TwinDesk in the Share menu', 'Share › TwinDesk sends files to the other computer',
      [UI.button('Extensions…', () => api.openSettings('extensions'), 'small')]);

    body.append(
      UI.card('Permissions', [
        ...perms.map((x) => x.row),
        UI.row('Changed a permission?', 'Restart to apply it', [UI.button('Restart', () => api.relaunch(), 'small')]),
      ]),
      UI.card('App', [
        UI.row('Open at login', '', [loginSw]),
        UI.row('Keep the display awake', 'While connected', [awakeSw]),
        UI.row('Show a popup when switching', 'When the mouse and keyboard move between computers', [hudSw]),
      ]),
      UI.card('Network and sharing', [wakeRow, shareRow]),
      UI.card('This computer', [deviceRow, helperRow]),
      UI.card('About', [
        versionRow,
        UI.row('Made by', 'inukaasith'),
        UI.row('Licence', 'Free and open source, GPL v3. Copyright © 2026 inukaasith'),
        UI.row('Thanks', 'DeskPad (virtual display header, MIT)'),
      ], { cls: 'keep-on' }),
    );

    return (s) => {
      for (const { p, pill } of perms) {
        const v = s.permissions[p.kind];
        const ok = p.kind === 'screen' ? v === 'granted' : v === true;
        const unknown = v === null || v === undefined || v === 'unknown';
        pill.className = `pill ${unknown ? 'muted' : ok ? 'good' : 'bad'}`;
        pill.textContent = unknown ? 'Unknown' : ok ? 'Allowed' : 'Not allowed';
      }
      if (s.app) {
        loginSw.set(s.app.openAtLogin);
        awakeSw.set(s.app.keepAwake);
        hudSw.set(s.app.hud !== false);
      }
      const w = s.wake || {};
      wakeSw.set(w.womp === true);
      wakeSw.disable(w.womp == null);
      wakeRow.setHint(w.womp == null ? 'Checking…' : 'Wake for network access. Asks for your password to change it');
      helperVal.textContent = s.helper && s.helper.running ? 'Running' : 'Not running';
      versionRow.setHint(s.version ? `Version ${s.version}` : '');
      deviceName.textContent = s.macName || '';
    };
  },
});
