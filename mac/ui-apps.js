// MacShare — Copyright (C) 2026 MacShare contributors. GPL-3.0, see LICENSE.
// Apps tab (revision 2): Mac apps on the PC and PC apps on this Mac, in equal places.
'use strict';

UI.tab({
  id: 'apps',
  group: 'More',
  order: 80,
  title: 'Apps',
  mixedOnly: true,
  desc: 'Open apps from the other computer in their own windows.',
  color: 'linear-gradient(#bf5af2, #5e5ce6)',
  badge: (s) => ((s.apps && s.apps.offer) || (s.papps && s.papps.on) ? 'on' : ''),
  build(body) {
    const { api, el } = UI;
    const offerSw = UI.switch((v) => api.setApps({ offer: v }), { label: 'Show this Mac’s apps on the PC' });
    const offerRow = UI.row('Share this Mac’s apps', '', [offerSw]);
    const usage = UI.row('Open on the PC', '');
    const pcSw = UI.switch((v) => api.setPcApps({ on: v }), { label: 'PC apps on this Mac' });
    const pcRow = UI.row('Show the PC’s apps here', '', [pcSw]);
    const pcUsage = UI.row('Open here', '');
    const grid = el('div', { class: 'app-grid' });
    const refresh = UI.button('Refresh', () => api.listPcApps(), 'small');
    const filter = el('input', { class: 'app-filter', type: 'search', placeholder: 'Search the PC’s apps' });
    const gridCard = UI.card('The PC’s apps', [el('div', { class: 'app-tools' }, [filter, refresh]), grid], { cls: 'keep-on' });
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
        const b = el('button', { class: `app-tile${open.has(a.id) ? ' running' : ''}`, title: st && st !== 'ok' ? `Couldn’t open: ${st}` : `Open ${a.name} on the PC` }, [
          a.icon ? el('img', { src: a.icon, alt: '' }) : el('span', { class: 'app-noicon', text: (a.name[0] || '?').toUpperCase() }),
          el('span', { class: 'app-name', text: a.name }),
          el('span', { class: 'app-state', text: open.has(a.id) ? 'Open' : st === '' ? 'Opening…' : st && st !== 'ok' ? 'Failed' : '' }),
        ]);
        b.onclick = () => api.openPcApp(a.id);
        // Pin: keep it in the Dock (and Launchpad), like a Mac app.
        const pin = el('span', { class: 'app-pin', title: `Add ${a.name} to the Dock`, attrs: { role: 'button', 'aria-label': `Add ${a.name} to the Dock` } }, [UI.icon('pin')]);
        pin.onclick = (e) => { e.stopPropagation(); api.keepPcAppInDock(a.id); };
        b.append(pin);
        b.oncontextmenu = (e) => { e.preventDefault(); api.keepPcAppInDock(a.id); };
        return b;
      }));
      if (!apps.length) grid.append(el('div', { class: 'app-empty', text: p.listing ? 'Loading the PC’s apps…' : q ? 'No app matches' : 'No apps yet. Press Refresh.' }));
    }
    body.append(
      UI.pair(
        UI.dir('m2w', [
          offerRow,
          usage,
        ]),
        UI.dir('w2m', [pcRow, pcUsage]),
      ),
      gridCard,
    );
    return (s) => {
      const a = s.apps;
      if (!a) return;
      offerSw.set(a.offer);
      offerRow.setHint(!a.offer ? ''
        : !s.sharing || !s.sharing.on ? 'Screen sharing turns on while an app is open'
          : !s.permissions.accessibility ? 'Needs Accessibility (General)' : '');
      const p = s.papps;
      if (p) {
        pcSw.set(p.on);
        pcRow.setHint(p.on && !s.client ? 'Waiting for your PC' : '');
        pcUsage.setHint(p.windows.length ? `${p.windows.length} window${p.windows.length > 1 ? 's' : ''}` : 'Nothing open');
        gridCard.hidden = !p.on || !s.client;
        draw(p);
      }
      usage.setHint(a.launched.length ? `${a.launched.length} app${a.launched.length > 1 ? 's' : ''}` : 'Nothing open');
    };
  },
});
