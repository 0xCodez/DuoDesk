// TwinDesk — Copyright (C) 2026 inukaasith. GPL-3.0, see LICENSE.
// Setup screen (same page as the PC's):
// a full page before the tabs while something isn't ready: the desktop session, input access on
// Wayland (Fix = uinput rule + the input group, one password prompt), the firewall (Fix
// through pkexec), the mouse and keyboard helper. "Skip for now" is remembered until something new
// is missing. No sidebar while it shows.
'use strict';

UI.setup = (() => {
  // Built on first use, not when this script loads: app.js picks the saved language after all the
  // scripts load, so strings translated here at load time would stay English.
  let built = null;
  const make = () => {
  const { el, api } = UI;
  const t = (k, p, d) => (typeof window.t === 'function' ? window.t(k, p, d) : d !== undefined ? d : k);
  const done = () => el('span', { class: 'pill good', text: t('setup.done', null, 'Done') });

  const sessPill = el('span', { class: 'pill muted' });
  const sessRow = UI.row(t('setup.desktop_session', null, 'Desktop session'), '', [sessPill]);
  const inFix = UI.button(t('setup.fix', null, 'Fix'), () => api.fixInput(), 'small primary');
  const inDone = done();
  const inRow = UI.row(t('setup.input_access', null, 'Input access'), '', [inFix, inDone]);
  const fwFix = UI.button(t('setup.fix', null, 'Fix'), () => api.fixFirewall(), 'small primary');
  const fwDone = done();
  const fwRow = UI.row(t('setup.firewall', null, 'Firewall'), '', [fwFix, fwDone]);
  const helperPill = el('span', { class: 'pill bad', text: t('setup.not_running', null, 'Not running') });
  const helperDone = done();
  const helperRow = UI.row(t('setup.mouse_and_keyboard_helper', null, 'Mouse and keyboard helper'), '', [helperPill, helperDone]);

  const page = el('section', { class: 'setup-page', hidden: true }, [
    el('div', { class: 'app-mark', attrs: { 'aria-hidden': 'true' } }),
    el('h1', { text: t('setup.set_up_duodesk', null, 'Set up DuoDesk') }),
    el('p', { text: t('setup.a_few_things_before_me', null, 'A few things before {me} can share with the other computer.') }),
    UI.card('', [sessRow, inRow, fwRow, helperRow]),
    el('div', { class: 'setup-foot' }, [
      el('span', { class: 'hint', text: t('setup.you_can_change_these_later_linux', null, 'You can change these later in General.') }),
      UI.button(t('setup.skip_for_now', null, 'Skip for now'), () => api.skipSetup(), ''),
    ]),
  ]);

  // Rows stay once shown (with Done when fixed), so the page doesn't jump while you work through it.
  const shown = new Set();

  function render(s) {
    page.hidden = !s.setup.show;
    document.body.classList.toggle('setup', !page.hidden);
    if (page.hidden) return;
    for (const m of s.setup.missing) shown.add(m);

    const ss = s.session || {};
    sessRow.hidden = !shown.has('session');
    sessPill.textContent = t('setup.no_desktop', null, 'No desktop');
    sessRow.setHint(t('setup.no_x11_or_wayland_display', null, 'No X11 or Wayland display found. Start DuoDesk from your desktop.'));

    const inBad = s.setup.missing.includes('input');
    inRow.hidden = !shown.has('input');
    inRow.setHint(ss.inputNote || (inBad ? t('setup.wayland_lets_duodesk_share_the', null, 'Wayland lets DuoDesk share the mouse and keyboard through /dev/uinput and /dev/input. Fix sets that up once (asks for your password); then log out and back in.') : ''));
    inFix.hidden = !inBad;
    inDone.hidden = inBad;

    const fw = s.firewall || {};
    const fwBad = s.setup.missing.includes('firewall');
    fwRow.hidden = !shown.has('firewall');
    fwRow.setHint(fw.checking ? t('setup.checking', null, 'Checking…') : fwBad ? t('setup.message_fix_lets_ports_port', { message: fw.message || '', port: UI.P.PORT, discovery: UI.P.DISCOVERY_PORT }, '{message} Fix lets ports {port} and {discovery} in (asks for your password).') : '');
    fwFix.hidden = !fwBad || fw.checking;
    fwDone.hidden = fwBad || fw.checking;

    const h = s.kvmState.helper;
    const helperBad = s.setup.missing.includes('helper');
    helperRow.hidden = !shown.has('helper');
    helperRow.setHint(helperBad ? t('setup.helper_restart_duodesk_if_it', { helper: h }, '{helper}. Restart DuoDesk if it stays like this.') : '');
    helperPill.hidden = !helperBad;
    helperDone.hidden = helperBad;
  }

  return { page, render };
  };
  const get = () => built || (built = make());
  return { get page() { return get().page; }, render(s) { get().render(s); } };
})();
