// MacShare — Copyright (C) 2026 MacShare contributors. GPL-3.0, see LICENSE.
// Setup screen (docs/ROADMAP.md "Setup screen", docs/UI.md "Revision 4"): a full page before the
// tabs while something isn't ready: the desktop session (X11 for mouse and keyboard sharing) and
// the firewall (Fix asks for the password once) and the mouse and keyboard helper. "Skip for now" is remembered until something
// new is missing. No sidebar while it shows.
'use strict';

UI.setup = (() => {
  const { el, api } = UI;
  const check = () => el('span', { class: 'pill good', text: 'Done' });

  const sessPill = el('span', { class: 'pill muted' });
  const sessRow = UI.row('Desktop session', '', [sessPill]);
  const fwFix = UI.button('Fix', () => api.fixFirewall(), 'small primary');
  const fwDone = check();
  const fwRow = UI.row('Firewall', '', [fwFix, fwDone]);
  const helperPill = el('span', { class: 'pill bad', text: 'Not running' });
  const helperRow = UI.row('Mouse and keyboard helper', '', [helperPill]);

  const page = el('section', { class: 'setup-page', hidden: true }, [
    el('div', { class: 'app-mark', attrs: { 'aria-hidden': 'true' } }),
    el('h1', { text: 'Set up MacShare' }),
    el('p', { text: 'A few things before this computer can share with your Mac.' }),
    UI.card('', [sessRow, fwRow, helperRow]),
    el('div', { class: 'setup-foot' }, [
      el('span', { class: 'hint', text: 'You can change these later in General.' }),
      UI.button('Skip for now', () => api.skipSetup(), ''),
    ]),
  ]);

  function render(s) {
    page.hidden = !s.setup.show;
    document.body.classList.toggle('setup', !page.hidden);
    if (page.hidden) return;
    const x11 = s.session.type === 'x11';
    sessRow.hidden = x11;
    sessPill.textContent = s.session.type === 'wayland' ? 'Wayland' : 'No X11';
    sessRow.setHint(s.session.type === 'wayland'
      ? 'This is a Wayland session. Log in with Xorg for now to share the mouse and keyboard. Screen and clipboard work already.'
      : 'No X11 display found.');
    const fw = s.firewall;
    const fwOk = fw.ok !== false;
    fwRow.hidden = fwOk && !s.setup.missing.includes('firewall') && !fw.checking;
    fwRow.setHint(fw.checking ? 'Checking…' : fwOk ? '' : fw.message + ' Fix lets ports ' + UI.P.PORT + ' and ' + UI.P.DISCOVERY_PORT + ' in.');
    fwFix.hidden = fwOk || fw.checking;
    fwDone.hidden = !fwOk || fw.checking;
    const helperBad = s.setup.missing.includes('helper');
    helperRow.hidden = !helperBad;
    helperRow.setHint(helperBad ? s.kvmState.helper + '. Restart MacShare if it stays like this.' : '');
  }

  return { page, render };
})();
