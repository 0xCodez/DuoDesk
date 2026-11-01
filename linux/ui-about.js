// TwinDesk — Copyright (C) 2026 inukaasith. GPL-3.0, see LICENSE.
// About tab (same cards on all three apps): the app icon and version, update checks, the
// maker, this computer, the app's build and the licence with the original author's notice (GPLv3 §5d). Facts
// come from shared/about.js.
'use strict';

UI.tab({
  id: 'about',
  order: 110,
  title: 'About',
  color: 'linear-gradient(#64d2ff, #0a84ff)',
  desc: '',
  bottom: true,
  badge: (s) => (s.updates && s.updates.available ? '1' : ''),
  build(body) {
    const { el, api } = UI;
    const t = (k, p, d) => (typeof window.t === 'function' ? window.t(k, p, d) : d !== undefined ? d : k);
    // Display text of the fact labels; the English label stays the key set() is called with.
    const FACT = {
      'Computer name': t('about.computer_name', null, 'Computer name'),
      System: t('about.system', null, 'System'),
      Kernel: t('about.kernel', null, 'Kernel'),
      Processor: t('about.processor', null, 'Processor'),
      Memory: t('about.memory', null, 'Memory'),
      Architecture: t('about.architecture', null, 'Architecture'),
      Version: t('about.version', null, 'Version'),
      'Built for': t('about.built_for', null, 'Built for'),
    };
    const link = (label, key) => UI.button(label, () => api.openLink(key), 'small');
    // A card of label → value rows; set({label: text}) fills them and hides the empty ones.
    const facts = (title, labels) => {
      const vals = {};
      const rows = labels.map((label) => {
        vals[label] = el('span', { class: 'value selectable' });
        return UI.row(FACT[label] || label, '', [vals[label]]);
      });
      const card = UI.card(title, rows, { cls: 'keep-on' });
      card.set = (map) => labels.forEach((label, i) => {
        const t = map[label];
        vals[label].textContent = t == null ? '' : String(t);
        rows[i].hidden = t == null || t === '';
      });
      return card;
    };
    const nameEl = el('div', { class: 'about-name', text: 'DuoDesk' });
    const verEl = el('div', { class: 'about-ver' });
    const hero = el('div', { class: 'card about-hero keep-on' }, [
      el('div', { class: 'about-icon', attrs: { role: 'img', 'aria-label': t('about.duodesk_icon', null, 'DuoDesk icon') } }),
      nameEl,
      verEl,
      el('div', { class: 'about-tag', text: t('about.use_two_computers_as_one', null, 'Use two computers as one desk') }),
    ]);

    // Updates: new releases of DuoDesk on GitHub.
    const updStatus = el('span', { class: 'value' });
    const updCheck = UI.button(t('about.check_now', null, 'Check now'), () => api.checkUpdates(), 'small');
    const updNotes = UI.button(t('about.whats_new', null, 'What’s New'), () => window.UpdaterModal && window.UpdaterModal.show(), 'small');
    const updUnskip = UI.button(t('about.dont_skip', null, 'Don’t skip'), () => api.unskipUpdate && api.unskipUpdate(), 'small');
    const updGet = UI.button(t('about.download', null, 'Download'), () => api.openUpdate(), 'small primary');
    const updRow = UI.row('DuoDesk', '', [updStatus, updNotes, updUnskip, updGet, updCheck]);
    const updAuto = UI.switch((v) => api.setUpdates({ auto: v }), { label: t('about.check_for_updates_automatically', null, 'Check for updates automatically') });

    const pc = facts(t('about.this_computer', null, 'This computer'), ['Computer name', 'System', 'Kernel', 'Processor', 'Memory', 'Architecture']);
    const build = facts(t('about.this_app', null, 'This app'), ['Version', 'Built for', 'Electron', 'Chromium', 'Node.js']);
    const thanksRow = UI.row(t('about.thanks', null, 'Thanks'), '');

    body.append(
      hero,
      UI.card(t('about.updates', null, 'Updates'), [
        updRow,
        UI.row(t('about.check_automatically', null, 'Check automatically'), t('about.looks_for_new_releases_on', null, 'Looks for new releases on GitHub every few hours'), [updAuto]),
      ], { cls: 'keep-on' }),
      UI.card(t('about.made_by', null, 'Made by'), [
        UI.row('0xCodez', 'github.com/0xCodez', [link(t('about.profile', null, 'Profile'), 'author')]),
        UI.row(t('about.website', null, 'Website'), 'getduodesk.vercel.app', [link(t('files.open', null, 'Open'), 'website')]),
        UI.row(t('about.source_code', null, 'Source code'), 'github.com/0xCodez/DuoDesk', [link('GitHub', 'github')]),
        UI.row(t('about.all_releases', null, 'All releases'), t('about.downloads_for_macos_windows_linux', null, 'Downloads for macOS, Windows, Linux and Android'), [link(t('about.releases', null, 'Releases'), 'releases')]),
        UI.row(t('about.report_a_problem', null, 'Report a problem'), t('about.open_an_issue_on', null, 'Open an issue on GitHub'), [link(t('about.issues', null, 'Issues'), 'issues')]),
        UI.row(t('about.log_files', null, 'Log files'), t('about.what_duodesk_did_and_any', null, 'What DuoDesk did and any crash, to attach to a bug report'), [link(t('about.open_log_folder', null, 'Open log folder'), 'logs')]),
      ], { cls: 'keep-on' }),
      pc,
      build,
      UI.card(t('about.licence', null, 'Licence'), [
        UI.row(t('about.gnu_general_public_license_v3', null, 'GNU General Public License v3'), t('about.free_and_open_source', null, 'Free and open source. © 2026 0xCodez. Includes code © 2026 Inuka Asith.'), [link(t('about.read', null, 'Read'), 'licence')]),
        UI.row(t('about.original_source', null, 'Original source'), t('about.the_gpl_3_0_code', null, 'The GPL-3.0 code DuoDesk is built on, by Inuka Asith'), [link(t('files.open', null, 'Open'), 'upstream')]),
        thanksRow,
      ], { cls: 'keep-on' }),
    );

    return (s) => {
      const a = s.about || { app: {}, pc: {} };
      nameEl.textContent = a.app.name || 'DuoDesk';
      verEl.textContent = t('about.version_number', { version: a.app.version || s.version || '' }, 'Version ' + (a.app.version || s.version || ''));
      thanksRow.setHint(a.app.thanks || '');
      thanksRow.hidden = !a.app.thanks;
      pc.set({
        'Computer name': a.pc.host,
        System: a.pc.os,
        Kernel: a.pc.kernel,
        Processor: a.pc.cpu ? (a.pc.cores ? t('about.cpu_cores', { cpu: a.pc.cpu, cores: a.pc.cores }, a.pc.cpu + ' · ' + a.pc.cores + ' cores') : a.pc.cpu) : '',
        Memory: a.pc.memory,
        Architecture: a.pc.arch,
      });
      build.set({ Version: a.app.version, 'Built for': a.app.arch, Electron: a.app.electron, Chromium: a.app.chrome, 'Node.js': a.app.node });
      const u = s.updates;
      if (u) {
        updAuto.set(u.auto);
        updCheck.disabled = u.checking;
        updGet.hidden = !u.available;
        updNotes.hidden = !u.available;
        updUnskip.hidden = !u.available || !u.skipped;
        updStatus.textContent = u.checking ? t('about.checking', null, 'Checking…')
          : u.available
            ? (u.skipped ? t('about.version_available_skipped', { version: u.latest }, u.latest + ' is available (skipped)') : t('about.version_available', { version: u.latest }, u.latest + ' is available'))
            : u.checkedAt ? t('about.up_to_date', null, 'Up to date') : '';
        updRow.setHint(u.error ? t('about.couldnt_check', { error: u.error }, 'Couldn’t check: ' + u.error)
          : u.available ? (u.download ? t('about.you_have_download_linux', { version: u.current, file: u.download.name }, 'You have ' + u.current + '. Download ' + u.download.name) : t('about.you_have_opens_release_linux', { version: u.current }, 'You have ' + u.current + '. Opens the release page'))
            : u.noReleases ? t('about.version_no_releases_yet', { version: u.current }, 'Version ' + u.current + '. No releases published yet')
              : u.checkedAt ? t('about.version_checked', { version: u.current, time: new Date(u.checkedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) }, 'Version ' + u.current + ' · checked ' + new Date(u.checkedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }))
                : t('about.version_number', { version: u.current }, 'Version ' + u.current));
      }
    };
  },
});
