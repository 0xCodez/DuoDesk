// MacShare — Copyright (C) 2026 MacShare contributors. GPL-3.0, see LICENSE.
// Apps tab. Mac → PC (phase 12): the Mac's apps with their icons; click one and it opens on the Mac,
// its windows appearing here as their own windows with their own taskbar buttons. PC → Mac (phase
// 13): the Mac opens this PC's apps; each of their windows is streamed on its own to a Mac window.
'use strict';

UI.tab({
  id: 'apps',
  order: 80,
  title: 'Apps',
  color: 'linear-gradient(#bf5af2, #5e5ce6)',
  desc: 'Apps of one computer as their own windows on the other — with their own taskbar button or Dock icon.',
  badge: (s) => (s.apps.open + s.pcApps.streaming ? String(s.apps.open + s.pcApps.streaming) : ''),
  build(body) {
    const { el, api } = UI;
    const note = UI.note('warn', '');
    const refresh = UI.button('Refresh', () => api.listApps(), 'small');
    const filter = el('input', { type: 'text', placeholder: 'Search apps', autocomplete: 'off', spellcheck: false, attrs: { 'aria-label': 'Search apps' } });
    const grid = el('div', { class: 'app-grid' });
    const status = UI.row('', '');
    const openCount = UI.row('', '');
    const pcState = UI.row('', '');
    const pair = UI.dirCards(
      { rows: [UI.row('Mac apps on this PC', 'Pick one below: it opens on the Mac and each of its windows shows here as its own window, with its own taskbar button'), openCount] },
      { on: { get: (s) => s.pcApps.allow, set: (v) => api.setPcApps({ allow: v }) }, rows: [
        UI.row('PC apps on the Mac', 'The Mac lists this PC’s apps (Apps tab on the Mac); one you pick opens here and each of its windows shows on the Mac as its own window, with the app’s own Dock icon. Mouse and keyboard there drive it here.'),
        pcState,
      ] },
    );
    body.append(
      pair.el,
      note,
      UI.card('Mac apps', [UI.row('Search', '', [filter]), grid, status], { actions: [refresh] }),
      UI.card('How it works', [
        UI.row('Mac apps here: windows from the Mac’s screen', 'The app opens on the Mac’s shared display; this PC cuts each of its windows out of the screen stream into its own window. Menus and dialogs appear inside the window they belong to. Needs screen sharing on (the Mac’s Display › Share).'),
        UI.row('PC apps on the Mac: one stream per window', 'Each window is captured on its own (even when covered here), at its own size, with the low-latency settings and the Quality of Display › PC → Mac. Clicking or typing in it on the Mac brings it to the front here. Menus and pop-ups show only on this PC for now. Uses “Let the Mac control it” from Display › PC → Mac.'),
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
      const pa = s.pcApps;
      pcState.label.textContent = !pa.allow ? 'Off' : pa.streaming ? pa.streaming + ' window' + (pa.streaming > 1 ? 's' : '') + ' on the Mac'
        : !connected ? 'Waiting for the Mac' : !pa.macAccepts ? 'The Mac isn’t showing PC apps' : pa.open ? 'Starting…' : 'No PC app open on the Mac';
      pcState.setHint(pa.message || (pa.allow && connected && !pa.macAccepts ? 'Turn on “PC apps on this Mac” in the Mac’s Apps tab.' : ''));
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
