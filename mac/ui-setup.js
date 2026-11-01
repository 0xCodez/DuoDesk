// TwinDesk — Copyright (C) 2026 inukaasith. GPL-3.0, see LICENSE.
// Setup: shown instead of the tabs while something TwinDesk needs
// isn't allowed yet, once: after everything is allowed or it's skipped, General shows what's missing. "Allow" asks macOS first, which puts TwinDesk in the System Settings list, so
// it's one switch there (no + and file browser). Closes by itself when everything is allowed.
'use strict';

UI.setup = (() => {
  const { el, api } = UI;
  const t = (k, p, d) => (typeof window.t === 'function' ? window.t(k, p, d) : d !== undefined ? d : k);
  // label/note are read in refreshText(), not here: the language may not be set when this script loads.
  const ITEMS = [
    { kind: 'screen', label: () => t('setup.screen_recording', null, 'Screen Recording'), note: () => t('setup.to_share_this_macs_screen', null, 'To share this Mac’s screen'), missing: (s) => s.permissions.screen !== 'granted' },
    { kind: 'accessibility', label: () => t('setup.accessibility', null, 'Accessibility'), note: () => t('setup.so_the_other_computer_can', null, 'So the other computer can control this Mac'), missing: (s) => !s.permissions.accessibility },
    { kind: 'inputMonitoring', label: () => t('setup.input_monitoring', null, 'Input Monitoring'), note: () => t('setup.to_use_this_keyboard_on', null, 'To use this keyboard on the other computer'), missing: (s) => s.permissions.inputMonitoring === false },
    { kind: 'localNetwork', label: () => t('setup.local_network', null, 'Local Network'), note: () => t('setup.to_find_your_other_computers', null, 'To find your other computers'), missing: (s) => !!s.discovery && s.discovery.localNetwork === false },
  ];
  const rows = ITEMS.map((it) => {
    const pill = el('span', { class: 'pill good', text: t('setup.allowed', null, 'Allowed') });
    const btn = UI.button(t('pair.allow', null, 'Allow'), () => api.allowPermission(it.kind), 'small primary');
    return { it, pill, btn, row: UI.row(it.label(), it.note(), [pill, btn]) };
  });
  let missingKey = '';
  const title = el('h1', { text: t('setup.set_up_duodesk', null, 'Set up DuoDesk') });
  const lead = el('p', { text: t('setup.macos_needs_your_ok_for', null, 'macOS needs your OK for a few things.') });
  const restartBtn = UI.button(t('setup.restart_duodesk', null, 'Restart DuoDesk'), () => api.relaunch(), '');
  const skipBtn = UI.button(t('setup.skip_for_now', null, 'Skip for now'), () => api.skipSetup(missingKey), '');
  const page = el('section', { class: 'setup-page', hidden: true }, [
    el('div', { class: 'app-mark', attrs: { 'aria-hidden': 'true' } }),
    title,
    lead,
    UI.card('', rows.map((r) => r.row)),
    el('div', { class: 'setup-foot' }, [restartBtn, skipBtn]),
  ]);
  document.getElementById('content').prepend(page);

  // Re-reads every text through t(), so a language picked after load shows up.
  const refreshText = () => {
    title.textContent = t('setup.set_up_duodesk', null, 'Set up DuoDesk');
    lead.textContent = t('setup.macos_needs_your_ok_for', null, 'macOS needs your OK for a few things.');
    restartBtn.textContent = t('setup.restart_duodesk', null, 'Restart DuoDesk');
    skipBtn.textContent = t('setup.skip_for_now', null, 'Skip for now');
    for (const r of rows) {
      r.row.label.textContent = r.it.label();
      r.row.setHint(r.it.note());
      r.btn.textContent = t('pair.allow', null, 'Allow');
    }
  };

  const missing = (s) => (s && s.permissions ? ITEMS.filter((it) => it.missing(s)).map((it) => it.kind) : []);

  return {
    // Returns true while Setup is showing (the tabs are hidden then).
    render(s) {
      const m = missing(s);
      missingKey = m.join(',');
      const skipped = new Set(((s.ui && s.ui.setupSkipped) || '').split(',').filter(Boolean));
      const show = !(s.ui && s.ui.setupDone) && m.length > 0 && m.some((k) => !skipped.has(k));
      page.hidden = !show;
      document.body.classList.toggle('setup', show);
      document.getElementById('pages').hidden = show;
      if (show) refreshText();
      for (const r of rows) {
        const miss = m.includes(r.it.kind);
        r.pill.hidden = miss;
        // Accessibility covers the keyboard tap, so macOS reads Input Monitoring as allowed with its switch off.
        r.pill.textContent = r.it.kind === 'inputMonitoring' && s.permissions && s.permissions.accessibility ? t('setup.allowed_by_accessibility', null, 'Allowed by Accessibility') : t('setup.allowed', null, 'Allowed');
        r.btn.hidden = !miss;
        // Local Network only matters when it's actually blocked.
        r.row.hidden = r.it.kind === 'localNetwork' && !miss;
      }
      return show;
    },
  };
})();
