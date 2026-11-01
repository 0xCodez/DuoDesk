// TwinDesk — Copyright (C) 2026 inukaasith. GPL-3.0, see LICENSE.
// Apps tab: Mac apps on the PC and PC apps on this Mac, in equal places.
'use strict';

UI.tab({
  id: 'apps',
  hidden: (s) => UI.isPhone(s), // the Phone page has the phone's screen, sound and apps
  group: 'More',
  order: 80,
  title: 'Apps',
  desc: 'Open apps from the other computer in their own windows.',
  color: 'linear-gradient(#bf5af2, #5e5ce6)',
  master: { get: (s) => !!((s.apps && s.apps.offer) || (s.papps && s.papps.on)), set: (v) => { UI.api.setApps({ offer: v }); UI.api.setPcApps({ on: v }); } },
  badge: (s) => ((s.apps && s.apps.offer) || (s.papps && s.papps.on) ? 'on' : ''),
  build(body) {
    const { api, el } = UI;
    const t = (k, p, d) => (typeof window.t === 'function' ? window.t(k, p, d) : d !== undefined ? d : k);
    const offerSw = UI.switch((v) => api.setApps({ offer: v }), { label: t('apps.share_apps', null, 'Share apps') });
    const offerRow = UI.row(t('apps.open_mes_apps_on', null, 'Open {me}’s apps on {name}'), '', [offerSw]);
    const usage = UI.row(t('apps.open_there_now', null, 'Open there now'), '');
    const pcSw = UI.switch((v) => api.setPcApps({ on: v }), { label: t('apps.show_apps_here', null, 'Show apps here') });
    const pcRow = UI.row(t('apps.open_names_apps_on', null, 'Open {name}’s apps on {me}'), '', [pcSw]);
    const pcUsage = UI.row(t('apps.open_here_now', null, 'Open here now'), '');
    const grid = el('div', { class: 'app-grid' });
    const refresh = UI.button(t('overview.refresh', null, 'Refresh'), () => api.listPcApps(), 'small');
    const filter = el('input', { class: 'app-filter', type: 'search', placeholder: t('phone.search_apps', null, 'Search apps') });
    const gridCard = UI.card(t('apps.names_apps', null, '{Name}’s apps'), [el('div', { class: 'app-tools' }, [filter, refresh]), grid], { cls: 'keep-on' });
    let lastKey = '';
    let last = null;
    filter.oninput = () => { lastKey = ''; if (last) draw(last); };
    function draw(p) {
      last = p;
      const q = filter.value.trim().toLowerCase();
      const apps = p.apps.filter((a) => !q || a.name.toLowerCase().includes(q));
      const key = JSON.stringify([q, apps.map((a) => a.id), p.launch, p.windows.map((w) => w.id)]);
      if (key === lastKey) return;
      lastKey = key;
      const open = new Set(p.windows.map((w) => w.id));
      grid.replaceChildren(...apps.map((a) => {
        const st = p.launch[a.id];
        const b = el('button', { class: `app-tile${open.has(a.id) ? ' running' : ''}`, title: st && st !== 'ok' ? t('apps.couldnt_open', { error: st }, 'Couldn’t open: {error}') : UI.fill(t('apps.open_app_on', { app: a.name }, 'Open {app} on {name}')) }, [
          UI.appIcon(a.icon),
          el('span', { class: 'app-name', text: a.name }),
          el('span', { class: 'app-state', text: open.has(a.id) ? t('files.open', null, 'Open') : st === '' ? t('apps.opening', null, 'Opening…') : st && st !== 'ok' ? t('apps.failed', null, 'Failed') : '' }),
        ]);
        b.onclick = () => api.openPcApp(a.id);
        // Pin: keep it in the Dock (and Launchpad), like a Mac app.
        const addToDock = t('apps.add_to_the_dock', { app: a.name }, 'Add {app} to the Dock');
        const pin = el('span', { class: 'app-pin', title: addToDock, attrs: { role: 'button', 'aria-label': addToDock } }, [UI.icon('pin')]);
        pin.onclick = (e) => { e.stopPropagation(); api.keepPcAppInDock(a.id); };
        b.append(pin);
        b.oncontextmenu = (e) => { e.preventDefault(); api.keepPcAppInDock(a.id); };
        return b;
      }));
      if (!apps.length) grid.append(el('div', { class: 'app-empty', text: p.listing ? UI.fill(t('apps.loading_names_apps', null, 'Loading {name}’s apps…')) : q ? t('apps.no_app_matches', null, 'No app matches') : t('apps.no_apps_yet_press_refresh', null, 'No apps yet. Press Refresh.') }));
    }
    const rezume = UI.rezumeCard ? UI.rezumeCard() : { el: UI.el('div', { hidden: true }), update() {} }; // the other computer's ReZume (shared/ui-rezume.js; not in Multi-device)
    body.append(
      UI.pair(
        UI.dir('m2w', [
          offerRow,
          usage,
        ]),
        UI.dir('w2m', [pcRow, pcUsage]),
      ),
      rezume.el,
      gridCard,
    );
    return (s) => {
      rezume.update(s);
      const a = s.apps;
      if (!a) return;
      offerSw.set(a.offer);
      offerRow.setHint(!a.offer ? ''
        : !s.sharing || !s.sharing.on ? t('apps.screen_sharing_turns_on_while', null, 'Screen sharing turns on while an app is open')
          : !s.permissions.accessibility ? t('apps.needs_accessibility_general', null, 'Needs Accessibility (General)') : '');
      const p = s.papps;
      if (p) {
        pcSw.set(p.on);
        pcRow.setHint(p.on && !s.client ? t('apps.waiting_for_name', null, 'Waiting for {name}') : '');
        pcUsage.setHint(p.windows.length ? (p.windows.length === 1 ? t('apps.windows_one', { count: p.windows.length }, '{count} window') : t('apps.windows_other', { count: p.windows.length }, '{count} windows')) : t('apps.nothing_open', null, 'Nothing open'));
        gridCard.hidden = !p.on || !s.client;
        draw(p);
      }
      usage.setHint(a.launched.length ? (a.launched.length === 1 ? t('apps.apps_one', { count: a.launched.length }, '{count} app') : t('apps.apps_other', { count: a.launched.length }, '{count} apps')) : t('apps.nothing_open', null, 'Nothing open'));
    };
  },
});
