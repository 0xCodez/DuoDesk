// MacShare — Copyright (C) 2026 MacShare contributors. GPL-3.0, see LICENSE.
// Apps tab (phase 12): the Mac's apps with their icons; click one and it opens on the Mac, its
// windows appearing here as their own windows with their own taskbar buttons.
'use strict';

UI.tab({
  id: 'apps',
  order: 80,
  title: 'Apps',
  color: 'linear-gradient(#bf5af2, #5e5ce6)',
  desc: 'Mac apps as their own windows on this PC, each with its own taskbar button.',
  badge: (s) => (s.apps.open ? String(s.apps.open) : ''),
  build(body) {
    const { el, api } = UI;
    const note = UI.note('warn', '');
    const refresh = UI.button('Refresh', () => api.listApps(), 'small');
    const filter = el('input', { type: 'text', placeholder: 'Search apps', autocomplete: 'off', spellcheck: false, attrs: { 'aria-label': 'Search apps' } });
    const grid = el('div', { class: 'app-grid' });
    const status = UI.row('', '');
    const openCount = UI.row('', '');
    const pair = UI.dirCards(
      { rows: [UI.row('Mac apps on this PC', 'Pick one below: it opens on the Mac and each of its windows shows here as its own window, with its own taskbar button'), openCount] },
      { soon: '13', rows: [UI.row('PC apps on the Mac', 'This PC’s apps in their own windows on the Mac, each with its own Dock icon', [UI.switch(() => {}, { disabled: true, label: 'PC apps on the Mac' })])] },
    );
    body.append(
      pair.el,
      note,
      UI.card('Mac apps', [UI.row('Search', '', [filter]), grid, status], { actions: [refresh] }),
      UI.card('How it works', [
        UI.row('Windows from the Mac’s screen', 'The app opens on the Mac’s shared display; this PC cuts each of its windows out of the screen stream into its own window. Menus and dialogs appear inside the window they belong to. Needs screen sharing on (the Mac’s Display › Share).'),
      ], { cls: 'keep-on' }),
    );
    filter.oninput = () => { key = ''; if (UI.state) render(UI.state); };

    let key = '';
    let asked = false;
    function render(s) {
      const a = s.apps;
      const connected = s.link.state === 'connected';
      if (connected && !asked && !a.list.length) { asked = true; api.listApps(); }
      openCount.label.textContent = a.open ? a.open + ' Mac window' + (a.open > 1 ? 's' : '') + ' open here' : 'No Mac app windows open';
      openCount.setHint(a.open ? 'Close one here to close it on the Mac.' : '');
      if (!connected) asked = false;
      note.set(a.message || (connected && s.stream.state !== 'on' ? 'The Mac isn’t sharing its screen, so app windows can’t be shown yet.' : ''));
      refresh.disabled = !connected || a.loading;
      const q = filter.value.trim().toLowerCase();
      const k = JSON.stringify([a.list.length, a.loading, connected, q]);
      if (k === key) return;
      key = k;
      const items = a.list.filter((x) => !q || x.name.toLowerCase().includes(q));
      grid.replaceChildren(...items.map((x) => {
        const b = el('button', { class: 'app-tile', title: 'Open ' + x.name + ' on the Mac' }, [
          x.icon ? el('img', { src: x.icon, alt: '' }) : el('span', { class: 'app-noicon', text: x.name.slice(0, 1) }),
          el('span', { class: 'app-name', text: x.name }),
        ]);
        b.onclick = () => api.launchApp(x.id);
        return b;
      }));
      status.hidden = items.length > 0;
      status.label.textContent = !connected ? 'Connect to your Mac first' : a.loading ? 'Loading the Mac’s apps…' : q ? 'No app matches' : 'No apps yet';
      status.setHint(!connected || a.loading || q ? '' : 'Click Refresh to ask the Mac for its apps.');
    }
    return render;
  },
});
