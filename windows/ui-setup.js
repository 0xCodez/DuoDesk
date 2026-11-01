// TwinDesk — Copyright (C) 2026 inukaasith. GPL-3.0, see LICENSE.
// Setup screen: a full page before the
// tabs while something isn't ready: firewall and network profile (Fix, one UAC prompt), the
// mouse and keyboard helper, and the display driver for Extend (optional). "Skip for now" is
// remembered until something new is missing. No sidebar while it shows.
'use strict';

UI.setup = (() => {
  const { el, api } = UI;
  const t = (k, p, d) => (typeof window.t === 'function' ? window.t(k, p, d) : d !== undefined ? d : k);

  // Built on first use, not at load: this file runs before app.js picks the language.
  const make = () => {
    const done = () => el('span', { class: 'pill good', text: t('setup.done', null, 'Done') });

    const fwFix = UI.button(t('setup.fix', null, 'Fix'), () => api.fixFirewall(), 'small primary');
    const fwDone = done();
    const fwRow = UI.row(t('setup.firewall_and_network', null, 'Firewall and network'), '', [fwFix, fwDone]);
    const helperPill = el('span', { class: 'pill bad', text: t('setup.not_running', null, 'Not running') });
    const helperDone = done();
    const helperRow = UI.row(t('setup.mouse_and_keyboard_helper', null, 'Mouse and keyboard helper'), '', [helperPill, helperDone]);
    const drvBtn = UI.button(t('setup.install', null, 'Install'), () => api.installVdd(), 'small');
    const drvDone = done();
    const drvRow = UI.row(t('setup.duodesk_virtual_display', null, 'DuoDesk virtual display'), '', [drvBtn, drvDone]);

    const page = el('section', { class: 'setup-page', hidden: true }, [
      el('div', { class: 'app-mark', attrs: { 'aria-hidden': 'true' } }),
      el('h1', { text: t('setup.set_up_duodesk', null, 'Set up DuoDesk') }),
      el('p', { text: t('setup.a_few_things_before_me', null, 'A few things before {me} can share with the other computer.') }),
      UI.card('', [fwRow, helperRow, drvRow]),
      el('div', { class: 'setup-foot' }, [
        el('span', { class: 'hint', text: t('setup.you_can_change_these_later', null, 'You can change these later in General and Display.') }),
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

      const fw = s.firewall || {};
      const fwBad = s.setup.missing.includes('firewall');
      fwRow.hidden = !shown.has('firewall');
      fwRow.setHint(fw.checking ? t('setup.checking', null, 'Checking…') : fwBad ? t('setup.message_fix_asks_for_administrator', { message: fw.message || '' }, '{message} Fix asks for administrator rights once.') : '');
      fwFix.hidden = !fwBad || fw.checking;
      fwDone.hidden = fwBad || fw.checking;

      const h = s.kvmState.helper;
      const helperBad = s.setup.missing.includes('helper');
      helperRow.hidden = !shown.has('helper');
      helperRow.setHint(helperBad ? t('setup.status_restart_duodesk_if_it', { status: h }, '{status}. Restart DuoDesk if it stays like this.') : '');
      helperPill.hidden = !helperBad;
      helperDone.hidden = helperBad;

      const v = s.pcScreen.vdd;
      const drvBad = s.setup.missing.includes('driver');
      drvRow.hidden = !shown.has('driver');
      drvRow.setHint(v.busy === 'install' ? t('setup.installing', null, 'Installing…') : drvBad ? t('setup.optional_adds_an_extra_screen', null, 'Optional. Adds an extra screen for the other computer (Extend). Installs a display driver and asks for administrator rights once.') : '');
      drvBtn.hidden = !drvBad;
      drvBtn.disabled = !!v.busy;
      drvDone.hidden = drvBad;
    }

    return { page, render };
  };

  let ui = null;
  const get = () => ui || (ui = make());
  return { get page() { return get().page; }, render: (s) => get().render(s) };
})();
