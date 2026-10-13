// MacShare — Copyright (C) 2026 MacShare contributors. GPL-3.0, see LICENSE.
// Apps tab. Mac → PC (phase 12): the Mac's apps with their icons; click one and it opens on the Mac,
// its windows appearing here as their own windows with their own taskbar buttons. PC → Mac (phase
// 13): the Mac opens this PC's apps; each of their windows is streamed on its own to a Mac window.
'use strict';

UI.tab({
  id: 'apps',
  macOnly: true, // revision 4: off with a PC or Linux peer for now
  order: 80,
  title: 'Apps',
  color: 'linear-gradient(#bf5af2, #5e5ce6)',
  desc: 'Use apps from the other computer in their own windows.',
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
      { rows: [UI.row('Mac apps on this PC', 'Pick one below'), openCount] },
      { on: { get: (s) => s.pcApps.allow, set: (v) => api.setPcApps({ allow: v }) }, rows: [
        UI.row('PC apps on the Mac', 'Pick them on your Mac'),
        pcState,
      ] },
    );
    body.append(
      pair.el,
      note,
      UI.card('Mac apps', [UI.row('Search', '', [filter]), grid, status], { actions: [refresh] }),
    );
    filter.oninput = () => { key = ''; if (UI.state) render(UI.state); };

    let key = '';
    let asked = false;
    function render(s) {
      const a = s.apps;
      const connected = s.link.state === 'connected';
      if (connected && !asked && !a.list.length) { asked = true; api.listApps(); }
      openCount.hidden = !a.open;
      openCount.label.textContent = a.open + ' open here';
      const pa = s.pcApps;
      pcState.hidden = !pa.allow;
      pcState.label.textContent = pa.streaming ? pa.streaming + ' open on the Mac'
        : !connected ? 'Waiting for your Mac' : !pa.macAccepts ? 'Turned off on the Mac' : pa.open ? 'Connecting…' : 'None open';
      pcState.setHint(pa.message || '');
      if (!connected) asked = false;
      note.set(a.message || '');
      note.className = 'note ' + (/ is in Start/.test(a.message) ? 'info' : 'warn');
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
        // Revision 6: Pin to Start (a shortcut in Start › MacShare Apps), on hover or right-click.
        const pin = el('span', { class: 'app-pin', title: 'Pin to Start', attrs: { role: 'button', tabindex: '0', 'aria-label': 'Pin ' + x.name + ' to Start' } }, [UI.icon('pin')]);
        pin.onclick = (e) => { e.stopPropagation(); api.pinApp(x.id); };
        pin.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); api.pinApp(x.id); } };
        b.oncontextmenu = (e) => { e.preventDefault(); api.pinApp(x.id); };
        b.append(pin);
        return b;
      }));
      status.hidden = items.length > 0;
      status.label.textContent = !connected ? 'Waiting for your Mac' : a.loading ? 'Loading…' : q ? 'No app matches' : 'No apps yet';
      status.setHint(!connected || a.loading || q ? '' : 'Click Refresh to ask the Mac for its apps.');
    }
    return render;
  },
});
