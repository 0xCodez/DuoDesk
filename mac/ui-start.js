// MacShare — Copyright (C) 2026 MacShare contributors. GPL-3.0, see LICENSE.
// Boots the control window: sidebar + one page per registered tab, pairing banner, rendering.
'use strict';

(() => {
  const { el, api } = UI;
  const $ = (id) => document.getElementById(id);
  const nav = $('nav');
  const pages = $('pages');
  const views = new Map(); // id -> { def, page, navBtn, stateEl, master, render }
  let current = null;

  let lastGroup = null;
  for (const def of UI.tabs.slice().sort((a, b) => (a.order ?? 50) - (b.order ?? 50))) {
    if (def.bottom) nav.append(el('li', { class: 'sep', attrs: { role: 'presentation' } }));
    if (def.group && def.group !== lastGroup) nav.append(el('li', { class: 'group', text: def.group, attrs: { role: 'presentation' } }));
    lastGroup = def.group || null;
    const stateEl = el('span', { class: 'state' });
    const tile = el('span', { class: 'tile' }, [UI.icon(def.icon || def.id)]);
    tile.style.background = def.color; // CSSOM, allowed by the CSP (inline style attributes aren't)
    const navBtn = el('button', { class: 'nav-item', attrs: { role: 'tab', 'aria-controls': `page-${def.id}` } }, [
      tile,
      el('span', { class: 'label', text: def.title }),
      stateEl,
    ]);
    if (def.group) navBtn.classList.add('grouped');
    navBtn.onclick = () => show(def.id, true);
    nav.append(el('li', {}, [navBtn]));

    const page = el('section', { class: 'page', id: `page-${def.id}`, hidden: true, attrs: { role: 'tabpanel' } });
    const titles = el('div', { class: 'titles' }, [
      el('h1', {}, [def.heading || def.title, def.phase ? el('span', { class: 'pill muted', text: `Phase ${def.phase}` }) : null]),
      el('p', { text: def.desc || '' }),
    ]);
    let master = null;
    if (def.master) {
      master = UI.switch((v) => def.master.set(v), { label: def.title, disabled: !!def.master.disabled });
    }
    page.append(el('header', { class: 'page-head' }, [titles, master ? master.el : null]));
    const body = el('div', { class: 'page-body' });
    page.append(body);
    pages.append(page);
    const render = def.build(body, page) || (() => {});
    views.set(def.id, { def, page, navBtn, stateEl, master, render });
  }

  function show(id, user) {
    const v = views.get(id) || views.get('overview');
    if (current === v) return;
    if (current) {
      current.page.hidden = true;
      current.navBtn.classList.remove('active');
      current.navBtn.setAttribute('aria-selected', 'false');
    }
    current = v;
    v.page.hidden = false;
    v.navBtn.classList.add('active');
    v.navBtn.setAttribute('aria-selected', 'true');
    $('content').scrollTop = 0;
    if (user) api.setTab(v.def.id);
    if (UI.state) renderPage(v, UI.state);
  }

  function renderPage(v, s) {
    if (v.master) {
      const on = !!v.def.master.get(s);
      v.master.set(on);
      v.page.classList.toggle('off', !on);
    }
    try {
      v.render(s);
    } catch (e) {
      console.error(`render ${v.def.id}:`, e);
    }
  }

  function renderSidebar(s) {
    const c = s.client;
    $('peer-dot').className = `dot ${c ? 'good' : s.pairing ? 'warn' : ''}`;
    $('peer-text').textContent = c ? `${c.name}${c.rttMs != null ? ` · ${c.rttMs} ms` : ''}` : s.pairing ? 'Pairing…' : 'No PC connected';
    for (const v of views.values()) {
      const b = v.def.badge ? v.def.badge(s) : v.def.phase ? `P${v.def.phase}` : '';
      v.stateEl.className = `state${b === 'on' ? ' on' : ''}`;
      v.stateEl.textContent = b === 'on' ? '' : b || '';
    }
  }

  function renderBanner(s) {
    const p = s.pairing;
    $('banner').hidden = !p;
    if (!p) return;
    $('pair-name').textContent = p.name;
    $('pair-code').textContent = p.code ? `${p.code.slice(0, 3)} ${p.code.slice(3)}` : '…';
    $('pair-allow').disabled = !p.code || p.allowed;
    let hint = 'Check that the PC shows the same code.';
    if (!p.code) hint = 'Waiting for the code…';
    else if (p.allowed && !p.confirmed) hint = 'Allowed. Waiting for “Codes match” on the PC…';
    else if (p.confirmed && !p.allowed) hint = 'The PC confirmed the code. Click Allow if it matches.';
    $('pair-hint').textContent = hint;
  }

  function render(s) {
    UI.state = s;
    renderSidebar(s);
    renderBanner(s);
    if (current) renderPage(current, s);
  }

  $('pair-allow').onclick = () => api.pairRespond(true);
  $('pair-deny').onclick = () => api.pairRespond(false);
  window.addEventListener('macshare-go', (e) => show(e.detail, true));

  // ↑/↓ move between tabs while the sidebar has focus.
  nav.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const ids = [...views.keys()];
    const i = ids.indexOf(current.def.id) + (e.key === 'ArrowDown' ? 1 : -1);
    const next = ids[(i + ids.length) % ids.length];
    show(next, true);
    views.get(next).navBtn.focus();
  });

  // Relative times ("2 min ago") age without a state push.
  setInterval(() => UI.state && current && renderPage(current, UI.state), 15000);

  api.onState(render);
  api.getState().then((s) => {
    const saved = s.ui && s.ui.tab;
    show(saved === 'display' ? 'share' : saved || 'overview', false); // 'display' = before the split
    render(s);
  });
})();
