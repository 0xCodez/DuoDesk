// MacShare — Copyright (C) 2026 MacShare contributors. GPL-3.0, see LICENSE.
// Main window shell: sidebar + one page per registered tab (ui-*.js), pairing banner, accent
// rendering of the state pushed by main (docs/UI.md). Same structure and look as the Mac's.
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
    if (def.group && def.group !== lastGroup) nav.append(el('li', { class: 'group', text: def.group, attrs: { role: 'presentation' } }));
    lastGroup = def.group || null;
    if (def.bottom) nav.append(el('li', { class: 'sep', attrs: { role: 'presentation' } }));
    const stateEl = el('span', { class: 'state' });
    const tile = el('span', { class: 'tile' }, [UI.icon(def.icon || def.id)]);
    tile.style.background = def.color; // CSSOM, allowed by the CSP (inline style attributes aren't)
    const navBtn = el('button', { class: 'nav-item', attrs: { role: 'tab', 'aria-controls': 'page-' + def.id } }, [
      tile,
      el('span', { class: 'label', text: def.title }),
      stateEl,
    ]);
    if (def.group) navBtn.classList.add('grouped');
    navBtn.onclick = () => show(def.id, true);
    nav.append(el('li', {}, [navBtn]));

    const page = el('section', { class: 'page', id: 'page-' + def.id, hidden: true, attrs: { role: 'tabpanel' } });
    const titles = el('div', { class: 'titles' }, [
      el('h1', {}, [def.heading || def.title, def.phase ? el('span', { class: 'pill muted', text: 'Phase ' + def.phase }) : null]),
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
      console.error('render ' + v.def.id + ':', e);
    }
  }

  function renderSidebar(s) {
    const l = s.link;
    const dot = l.state === 'connected' ? 'good' : l.state === 'identity_changed' ? 'bad'
      : (s.pairing || l.state === 'connecting' || l.state === 'reconnecting') ? 'warn' : '';
    $('peer-dot').className = 'dot ' + dot;
    let text = 'No Mac paired';
    if (l.state === 'connected') text = l.macName + (l.rtt != null ? ' · ' + l.rtt + ' ms' : '');
    else if (s.pairing) text = 'Pairing…';
    else if (l.state === 'connecting' || l.state === 'reconnecting') text = 'Reconnecting…';
    else if (l.state === 'identity_changed') text = 'Identity changed';
    $('peer-text').textContent = text;
    for (const v of views.values()) {
      const b = v.def.badge ? v.def.badge(s) : v.def.phase ? 'P' + v.def.phase : '';
      v.stateEl.className = 'state' + (b === 'on' ? ' on' : b === 'warn' ? ' warn' : '');
      v.stateEl.textContent = b === 'on' || b === 'warn' ? '' : b || '';
    }
  }

  function renderBanner(s) {
    const p = s.pairing;
    $('banner').hidden = !p;
    if (!p) return;
    $('banner').classList.toggle('failed', p.phase === 'failed');
    $('pair-title').textContent = 'Pairing with ' + p.macName;
    $('pair-code-wrap').hidden = !p.code;
    $('pair-code').textContent = p.code ? p.code.slice(0, 3) + ' ' + p.code.slice(3) : '';
    $('pair-match').hidden = p.phase !== 'code';
    $('pair-cancel').textContent = p.phase === 'failed' ? 'Close' : 'Cancel';
    const hints = {
      connecting: 'Connecting to ' + p.address + '…',
      starting: 'Waiting for the Mac…',
      code: 'Check that the Mac shows the same code, then click Codes match.',
      waiting: 'Waiting for Allow on the Mac…',
      failed: p.error,
    };
    $('pair-hint').textContent = hints[p.phase] || '';
  }

  function render(s) {
    UI.state = s;
    renderSidebar(s);
    renderBanner(s);
    if (current) renderPage(current, s);
  }

  $('pair-match').onclick = () => api.confirmCode();
  $('pair-cancel').onclick = () => api.cancelPair();
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
    show((s.ui && s.ui.tab) || 'overview', false);
    render(s);
  });
})();
