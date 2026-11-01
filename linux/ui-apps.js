// TwinDesk — Copyright (C) 2026 inukaasith. GPL-3.0, see LICENSE.
// Apps tab (copy of windows/ui-apps.js). The other computer → here: its apps with their icons;
// click one and it opens there, its windows appearing here as their own windows (a Mac: apps.js,
// cropped from its screen stream, with Add to app menu; a PC or Linux: peerapps.js). Here → there:
// it opens this computer's apps (pcapps.js, Xorg only); each window is streamed on its own.
'use strict';

UI.tab({
  id: 'apps',
  hidden: (s) => UI.isPhone(s), // the Phone page has the phone's screen, sound and apps
  order: 80,
  title: 'Apps',
  color: 'linear-gradient(#bf5af2, #5e5ce6)',
  desc: 'Use apps from the other computer in their own windows.',
  master: { get: (s) => s.macApps.on || s.pcApps.allow, set: (v) => { UI.api.setMacApps({ on: v }); UI.api.setPcApps({ allow: v }); } },
  badge: (s) => (s.apps.open + s.pcApps.streaming ? String(s.apps.open + s.pcApps.streaming) : ''),
  build(body) {
    const { el, api } = UI;
    const t = (k, p, d) => (typeof window.t === 'function' ? window.t(k, p, d) : d !== undefined ? d : k);
    const note = UI.note('warn', '');
    const refresh = UI.button(t('overview.refresh', null, 'Refresh'), () => api.listApps(), 'small');
    const filter = el('input', { type: 'text', placeholder: t('phone.search_apps', null, 'Search apps'), autocomplete: 'off', spellcheck: false, attrs: { 'aria-label': t('phone.search_apps', null, 'Search apps') } });
    const grid = el('div', { class: 'app-grid' });
    const status = UI.row('', '');
    const openCount = UI.row('', '');
    const pcState = UI.row('', '');
    const pair = UI.dirCards(
      { on: { get: (s) => s.macApps.on, set: (v) => api.setMacApps({ on: v }) }, label: t('apps.open_name_s_apps_on', null, 'Open {name}’s apps on {me}'), hint: t('apps.pick_one_below', null, 'Pick one below'), rows: [openCount] },
      { on: { get: (s) => s.pcApps.allow, set: (v) => api.setPcApps({ allow: v }) }, label: t('apps.open_me_s_apps_on', null, 'Open {me}’s apps on {name}'), hint: t('apps.pick_them_over_there', null, 'Pick them over there'), rows: [pcState] },
    );
    const listCard = UI.card(t('apps.mac_apps', null, 'Mac apps'), [UI.row(t('apps.search', null, 'Search'), '', [filter]), grid, status], { actions: [refresh] });
    const rezume = UI.rezumeCard ? UI.rezumeCard() : { el: UI.el('div', { hidden: true }), update() {} }; // the other computer's ReZume (shared/ui-rezume.js; not in Multi-device)
    body.append(pair.el, rezume.el, note, listCard);
    filter.oninput = () => { key = ''; if (UI.state) render(UI.state); };

    let key = '';
    let asked = false;
    function render(s) {
      rezume.update(s);
      const a = s.apps;
      const connected = s.link.state === 'connected';
      pair.update(s); // the two direction switches follow the settings
      listCard.hidden = !s.macApps.on;
      listCard.querySelector('.card-title > span').textContent = t('apps.name_s_apps', { name: UI.peer(s).name }, '{name}’s apps');
      if (connected && s.macApps.on && !asked && !a.list.length) { asked = true; api.listApps(); }
      openCount.hidden = !a.open;
      openCount.label.textContent = t('apps.count_open_here', { count: a.open }, '{count} open here');
      const pa = s.pcApps;
      pcState.hidden = !pa.allow;
      pcState.label.textContent = pa.streaming ? t('apps.count_open_on_name', { count: pa.streaming }, '{count} open on {name}')
        : !connected ? t('apps.waiting_for_name', null, 'Waiting for {name}') : !pa.macAccepts ? t('clipboard.turned_off_on', null, 'Turned off on {name}') : pa.open ? t('sidebar.connecting', null, 'Connecting…') : t('apps.none_open', null, 'None open');
      pcState.setHint(pa.message || (pa.wayland ? t('apps.needs_an_xorg_session_wayland', null, 'Needs an Xorg session: Wayland doesn’t let apps show other apps’ windows') : ''));
      if (!connected) asked = false;
      note.set(a.message || '');
      note.className = 'note ' + (/ is in the app menu/.test(a.message) ? 'info' : 'warn');
      refresh.disabled = !connected || a.loading;
      const q = filter.value.trim().toLowerCase();
      const k = JSON.stringify([a.list.length, a.loading, connected, q, !!a.peerPc]);
      if (k === key) return;
      key = k;
      const items = a.list.filter((x) => !q || x.name.toLowerCase().includes(q));
      grid.replaceChildren(...items.map((x) => {
        const b = el('button', { class: 'app-tile', title: t('apps.open_app_on_name', { app: x.name }, 'Open {app} on {name}') }, [
          UI.appIcon(x.icon),
          el('span', { class: 'app-name', text: x.name }),
        ]);
        b.onclick = () => api.launchApp(x.id);
        if (a.peerPc) return b; // apps of a PC or Linux computer: no launcher yet
        // Add to the app menu (a launcher you can pin to the dock), on hover or right-click.
        const pin = el('span', { class: 'app-pin', title: t('apps.add_to_the_app_menu', null, 'Add to the app menu'), attrs: { role: 'button', tabindex: '0', 'aria-label': t('apps.add_app_to_the_app', { app: x.name }, 'Add {app} to the app menu') } }, [UI.icon('pin')]);
        pin.onclick = (e) => { e.stopPropagation(); api.pinApp(x.id); };
        pin.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); api.pinApp(x.id); } };
        b.oncontextmenu = (e) => { e.preventDefault(); api.pinApp(x.id); };
        b.append(pin);
        return b;
      }));
      status.hidden = items.length > 0;
      status.label.textContent = !connected ? t('apps.waiting_for_name', null, 'Waiting for {name}') : a.loading ? t('apps.loading', null, 'Loading…') : q ? t('apps.no_app_matches', null, 'No app matches') : t('apps.no_apps_yet', null, 'No apps yet');
      status.setHint(!connected || a.loading || q ? '' : t('apps.click_refresh_to_ask_name', null, 'Click Refresh to ask {name} for its apps.'));
    }
    return render;
  },
});
