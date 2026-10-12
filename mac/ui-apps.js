// MacShare — Copyright (C) 2026 MacShare contributors. GPL-3.0, see LICENSE.
// Apps tab (revision 2): Mac apps on the PC and PC apps on this Mac, in equal places.
'use strict';

UI.tab({
  id: 'apps',
  order: 80,
  title: 'Apps',
  desc: 'Open an app of one computer from the other. Each app window shows up as its own window there, with its own taskbar or Dock icon.',
  color: 'linear-gradient(#bf5af2, #5e5ce6)',
  badge: (s) => ((s.apps && s.apps.offer) || (s.papps && s.papps.on) ? 'on' : ''),
  build(body) {
    const { api, el } = UI;
    const offerSw = UI.switch((v) => api.setApps({ offer: v }), { label: 'Show this Mac’s apps on the PC' });
    const offerRow = UI.row('Show this Mac’s apps on the PC', '', [offerSw]);
    const usage = UI.row('Opened from the PC', '');
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
        return b;
      }));
      if (!apps.length) grid.append(el('div', { class: 'app-empty', text: p.listing ? 'Loading the PC’s apps…' : q ? 'No app matches' : 'No apps yet — press Refresh' }));
    }
    body.append(
      UI.pair(
        UI.dir('m2w', [
          offerRow,
          usage,
          UI.row('How it works', 'The app opens here on the screen you share (Display › Mac → PC) and its windows move onto it; the PC cuts each window out of the stream at 1:1 size. Extend with the MacShare virtual display keeps them off this Mac’s own screen.'),
        ], { role: 'this Mac’s apps' }),
        UI.dir('w2m', [pcRow, pcUsage, UI.row('How it works', 'The PC captures each window of an app you open here and sends it on its own; it shows up here in its own window, the same size as on the PC, with the app’s own Dock icon. Close a window here and it closes on the PC.')], { role: 'the PC’s apps' }),
      ),
      gridCard,
    );
    return (s) => {
      const a = s.apps;
      if (!a) return;
      offerSw.set(a.offer);
      offerRow.setHint(!a.offer ? 'Off — the PC can’t see or open this Mac’s apps'
        : !s.sharing || !s.sharing.on ? 'App windows come from the shared screen — turn on Display › Mac → PC'
          : !s.permissions.accessibility ? 'Grant Accessibility (General) so app windows can be moved onto the shared screen'
            : s.client ? `Ready — open the Apps tab in ${s.client.name}’s MacShare app` : 'Ready — waiting for your PC to connect');
      const p = s.papps;
      if (p) {
        pcSw.set(p.on);
        pcRow.setHint(!p.on ? 'Off — the PC sends no app windows here'
          : s.client ? `Ready — pick an app below to open it on ${s.client.name}` : 'Waiting for your PC to connect');
        pcUsage.setHint(p.windows.length ? `${p.windows.length} PC window${p.windows.length > 1 ? 's' : ''} open here: ${p.windows.map((w) => w.title).filter(Boolean).slice(0, 4).join(', ')}` : 'Nothing yet');
        gridCard.hidden = !p.on || !s.client;
        draw(p);
      }
      usage.setHint(a.launched.length ? `${a.launched.length} app${a.launched.length > 1 ? 's' : ''} · ${a.windows} window${a.windows === 1 ? '' : 's'} on the PC` : 'Nothing yet');
    };
  },
});
