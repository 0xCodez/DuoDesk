// TwinDesk — Copyright (C) 2026 inukaasith, Erdoğan Yeşil. GPL-3.0, see LICENSE.
// Boots the control window: sidebar + one page per registered tab, pairing banner, rendering.
'use strict';

(() => {
  const { el, api } = UI;
  const M = window.SidebarModel; // shared/sidebar-model.js: device tiles and the sections per kind
  const $ = (id) => document.getElementById(id);
  const nav = $('nav');
  const pages = $('pages');
  const views = new Map(); // id -> { def, page, navBtn, stateEl, master, render }
  let current = null;

  // Language: the saved choice (General page), else the system's. Same keys as the main window.
  let handedOverLang = false;
  function syncSavedLanguage(s) {
    if (handedOverLang || !s || !s.app) return;
    let saved = null;
    try { saved = localStorage.getItem('duodesk.general.language') || localStorage.getItem('duodesk.lang'); } catch (_) {}
    if (saved && saved !== 'auto' && s.app.lang === 'auto') {
      handedOverLang = true;
      if (api.setApp) api.setApp({ lang: saved });
    }
  }

  let saved = null;
  try { saved = localStorage.getItem('duodesk.general.language') || localStorage.getItem('duodesk.lang'); } catch (_) {}
  if (typeof DuoDeskI18n !== 'undefined') DuoDeskI18n.setLanguage(saved && saved !== 'auto' ? saved : (navigator.language || 'en'));
  const tr = (k, d, p) => (typeof t === 'function' ? t(k, p || null, d) : d);
  const navTitleOf = (def) => tr('nav.' + def.id, def.title);
  // A tab's heading / description; the tab file's own text is the English.
  const tabText = (def, field) => (def[field] ? tr('tab.' + def.id + '.' + field + '_mac', tr('tab.' + def.id + '.' + field, def[field])) : '');

  // The sidebar's order and groups (as ../ui-start.js): the device and Connection, the phone's own
  // things, screens, input, sharing, media; General below a line.
  const GROUP = { overview: 0, connection: 0, messages: 1, calls: 1, media: 1, papps: 1, mirror: 2, receive: 2, share: 2, apps: 2, cursor: 3, keyboard: 3, remote: 3, clipboard: 4, notifications: 4, files: 4, pfiles: 4, mount: 4, audio: 5, camera: 5, rezume: 5, terminal: 5 };
  const ORDER = { overview: 0, connection: 1, messages: 5, calls: 6, media: 7, papps: 8, mirror: 10, receive: 11, share: 12, apps: 13, cursor: 20, keyboard: 21, remote: 22, clipboard: 40, notifications: 41, files: 42, pfiles: 43, mount: 44, audio: 60, camera: 61, rezume: 62, terminal: 63, multi: 95, general: 100, about: 110 };
  const orderOf = (d) => ORDER[d.id] ?? d.order ?? 50;
  let lastGroup = null;
  let gap = null; // the gap before the current group (hidden with the group: renderSidebar)
  for (const def of UI.tabs.slice().sort((a, b) => orderOf(a) - orderOf(b))) {
    if (def.id in GROUP) def.group = GROUP[def.id];
    if (def.navHidden) { // reached another way (the phone tile)
      views.set(def.id, { def, ...buildPage(def), navBtn: el('button'), stateEl: el('span') });
      continue;
    }
    if (def.bottom && !nav.querySelector('.sep')) nav.append(el('li', { class: 'sep', attrs: { role: 'presentation' } })); // one line above General and About
    // Groups (System Settings style): a small gap before each, no heading, icons in one column.
    if (def.group !== lastGroup && !def.bottom && nav.children.length) nav.append(gap = el('li', { class: 'gap', attrs: { role: 'presentation' } }));
    lastGroup = def.group;
    const stateEl = el('span', { class: 'state' });
    const tile = el('span', { class: 'tile' }, [UI.icon(def.icon || def.id)]);
    tile.style.background = def.color; // CSSOM, allowed by the CSP (inline style attributes aren't)
    const navTitle = navTitleOf(def);
    const label = el('span', { class: 'label', text: navTitle });
    if (navTitle.includes('{')) label.dataset.peer = navTitle; // peer-dependent (UI.names)
    const navBtn = el('button', { class: 'nav-item', attrs: { role: 'tab', 'aria-controls': `page-${def.id}` } }, [
      tile,
      label,
      stateEl,
    ]);
    navBtn.onclick = () => show(def.id, true);
    nav.append(el('li', {}, [navBtn]));
    views.set(def.id, { def, ...buildPage(def), navBtn, stateEl, gap });
  }

  function buildPage(def) {
    const page = el('section', { class: 'page', id: `page-${def.id}`, hidden: true, attrs: { role: 'tabpanel' } });
    const headTpl = def.heading ? tabText(def, 'heading') : navTitleOf(def);
    const descTpl = tabText(def, 'desc');
    const h1Text = el('span', { text: headTpl });
    const descEl = el('p', { text: descTpl });
    const devTag = el('span', { class: 'pill muted dev-tag', hidden: true }); // names the selected device on its own sections
    if (headTpl.includes('{')) h1Text.dataset.peer = headTpl;
    if (descTpl.includes('{')) descEl.dataset.peer = descTpl;
    const titles = el('div', { class: 'titles' }, [
      el('h1', {}, [h1Text, def.phase ? el('span', { class: 'pill muted', text: `Phase ${def.phase}` }) : null,
        def.tag ? el('span', { class: 'pill beta', text: def.tag }) : null, devTag]),
      descEl,
    ]);
    let master = null;
    if (def.master) {
      master = UI.switch((v) => def.master.set(v), { label: navTitleOf(def), disabled: !!def.master.disabled });
    }
    page.append(el('header', { class: 'page-head' }, [titles, master ? master.el : null]));
    // Over Bluetooth, a page that needs Wi-Fi (and doesn't move the session onto it) says so, with
    // the button that moves it there.
    const wifiNote = def.wifiOnly ? UI.wifiGate() : null;
    if (wifiNote) page.append(wifiNote.el);
    page.classList.toggle('free', FeatureArt.FREE.includes(def.id)); // works with nothing connected: its switches stay blue
    // Until it's turned on, an introduction in place of the settings (shared/feature-art.js).
    const art = FeatureArt.has(def.id) ? FeatureArt.create(def.id, {
      color: def.color,
      keep: !def.master, // without a switch at the top, an introduction once
      onDismiss: () => UI.state && renderPage(views.get(def.id), UI.state),
    }) : null;
    if (art) page.append(art.el);
    const body = el('div', { class: 'page-body' });
    page.append(body);
    pages.append(page);
    let render = () => {};
    try {
      render = def.build(body, page) || render;
    } catch (e) { // one tab that fails to build doesn't take the rest of the sidebar with it
      console.error('build ' + def.id + ':', e);
    }
    return { page, body, master, render, wifiNote, devTag, art };
  }

  // The session is through Bluetooth (pages that need Wi-Fi say so).
  const onBle = (s) => !!(s && s.client && s.client.transport === 'ble');

  // Something to work with: the other computer, or a phone.
  const linked = (s) => !!(s && (s.client || (s.phone && s.phone.connected)));

  function show(id, user) {
    const v = views.get(id === 'phone' ? 'overview' : id) || views.get('connection'); // 'phone': the old Phone page
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
    markTiles();
    if (user) api.setTab(v.def.id);
    if (UI.state) renderPage(v, UI.state);
  }

  function renderPage(v, s) {
    if (v.wifiNote) {
      const off = onBle(s);
      v.wifiNote.render(s, off);
      v.body.inert = off; // shown as it is; it works again on Wi-Fi
    }
    if (v.master) {
      const on = !!v.def.master.get(s);
      v.master.set(on);
      v.master.disable(!!v.def.master.disabled);
      v.page.classList.toggle('off', !on);
    }
    if (v.art) { // while the page's switch is off; on a page without one, until dismissed
      let off = !v.def.master;
      try {
        if (v.def.master) off = !v.def.master.get(s);
      } catch (e) { /* its state isn't there yet */ }
      v.art.set(off);
      v.body.hidden = !v.art.el.hidden;
    }
    if (v.devTag) { // the selected device's name on the sections that show its settings and data
      // devName: a page about another device than the selected one for now (Camera: whose runs here).
      const n = M.isScoped(v.def.id) ? (v.def.devName && v.def.devName(s)) || (s.client ? s.client.name : '') : '';
      v.devTag.hidden = !n;
      v.devTag.textContent = n || '';
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
    const gs = s.guest && s.guest.status && s.guest.status.state;
    $('peer-text').textContent = c ? `${c.name}${UI.via(s) !== 'Wi-Fi' ? ` · ${UI.via(s)}` : ''}${c.rttMs != null ? ` · ${c.rttMs} ms` : ''}`
      : s.pairing || (s.guest && s.guest.pairing) ? tr('sidebar.pairing', 'Pairing…') : gs === 'connecting' || gs === 'reconnecting' ? tr('sidebar.connecting', 'Connecting…') : tr('sidebar.not_connected', 'Not connected');
    renderPhones(s);
    // Tabs that don't apply to the peer (a phone has no terminal or screen to share to it…).
    for (const v of views.values()) {
      const hide = !!(v.def.hidden && v.def.hidden(s));
      if (v.navBtn.parentElement) v.navBtn.parentElement.hidden = hide;
      if (hide && current === v) show(M.firstSection(kindOfState(s), availableFor(kindOfState(s))), false);
    }
    // A group with every tab hidden takes its gap with it.
    for (const v of views.values()) if (v.gap) v.gap.hidden = [...views.values()].every((x) => x.gap !== v.gap || !x.navBtn.parentElement || x.navBtn.parentElement.hidden);
    for (const v of views.values()) {
      let b = v.def.badge ? v.def.badge(s) : v.def.phase ? `P${v.def.phase}` : '';
      if (b === 'on' && !linked(s)) b = 'warn'; // on, but nothing connected: it waits (yellow), it isn't working
      v.stateEl.className = `state${b === 'on' ? ' on' : b === 'warn' ? ' warn' : ''}`;
      v.stateEl.textContent = b === 'on' || b === 'warn' ? '' : b || '';
    }
  }

  // The kind of the selected device: its sections follow it (shared/sidebar-model.js).
  const kindOfState = (s) => (UI.isPhone(s) ? 'phone' : M.selectedKind(s.peers) === 'none' ? 'none' : 'computer');
  // Sections that exist for a kind of device.
  const availableFor = (kind) => [...views.keys()].filter((id) => M.sectionVisible(id, kind));

  // Tiles of the selected device's sections: lit while one of its own sections is open.
  function markTiles() {
    const scoped = !!(current && M.isScoped(current.def.id));
    for (const t of $('phones').children) t.classList.toggle('active', scoped && t.dataset.selected === '1');
  }

  // A tile was clicked: a connected device becomes the selected one (hub.select) and its sections
  // open (the open one when it exists for it, else its first); a phone nearby connects.
  let goAfter = null; // { id, kind, timer }: open the sections once the new selection reached this window
  function pick(t) {
    if (t.action === 'connect') return api.connectPhone(t.id);
    if (t.action !== 'select') return;
    const go = () => {
      if (goAfter) clearTimeout(goAfter.timer);
      goAfter = null;
      show(M.targetSection(current && current.def.id, t.kind, availableFor(t.kind)), true);
    };
    if (t.selected) return go();
    if (goAfter) clearTimeout(goAfter.timer);
    goAfter = { id: t.id, go, timer: setTimeout(go, 1500) }; // the state push with the new selection runs it (render)
    Promise.resolve(api.selectPeer(t.id)).catch(() => go());
  }

  // Every known device above the sections: paired phones (wallpaper, name, link) and computers (OS icon,
  // name, ping/transport), devices only another one reaches with a "via" line (not clickable).
  let phonesKey = '';
  let assetsSeen = -1;
  function renderPhones(s) {
    const ph = s.phone || { nearby: [] };
    if (ph.assets !== assetsSeen) {
      assetsSeen = ph.assets;
      api.phoneAssets().then((a) => {
        UI.phoneAssets = a;
        UI.phoneWall = a.wallpaper ? 'url("' + a.wallpaper + '")' : '';
        phonesKey = '';
        if (UI.state) render(UI.state);
      }, () => {});
    }
    const info = ph.info || {};
    const colors = info.colors && info.colors.length ? info.colors : null;
    // The connected phone's line (ping, battery) changes often: written in place, the tiles (and
    // their wallpaper) built again only when something else changed, else they flicker.
    const subOf = (d) => {
      const mine = (ph.phones || []).find((x) => x.id === d.id) || null; // this phone's own numbers, not the active one's
      if (!d.connected) return ph.connecting && ph.connecting.id === d.id ? tr('sidebar.connecting', 'Connecting…') : tr('sidebar.nearby_click_to_connect', 'Nearby · Click to connect');
      const rtt = mine ? mine.rttMs : ph.connected && ph.connected.rttMs;
      const bat = mine ? mine.battery : info.battery;
      const chg = mine ? mine.charging : info.charging;
      return (rtt != null ? rtt + ' ms' : tr('sidebar.connected', 'Connected')) + (bat != null ? ' · ' + bat + '%' + (chg ? ' ⚡' : '') : '');
    };
    const phones = ph.nearby.map((d) => ({ id: d.id, name: d.name, connected: !!d.connected, connecting: !!(ph.connecting && ph.connecting.id === d.id), sub: subOf(d) }));
    const tiles = M.buildTiles({ peers: s.peers || [], phones, transport: UI.via(s) });
    const key = JSON.stringify([tiles.map((tl) => [tl.id, tl.kind, tl.name, tl.os, tl.state, tl.selected, tl.action, tl.via, tl.forget]), ph.held, ph.activeId, (ph.phones || []).map((x) => [x.id, x.colors]), colors, UI.phoneWall ? UI.phoneWall.length : 0, current && current.def.id]);
    if (key === phonesKey) {
      const subs = new Map(tiles.map((tl) => [tl.id, tl.sub]));
      for (const b of $('phones').children) {
        const sub = b.querySelector('.phone-sub');
        if (sub && subs.has(b.dataset.id) && sub.textContent !== subs.get(b.dataset.id)) sub.textContent = subs.get(b.dataset.id);
      }
      return;
    }
    phonesKey = key;
    $('phones').replaceChildren(...tiles.map((tl) => {
      let wall;
      if (tl.kind === 'phone') {
        const mine = (ph.phones || []).find((x) => x.id === tl.id) || null;
        const dcolors = mine && mine.colors ? mine.colors : colors;
        wall = el('span', { class: 'phone-wall' }, [UI.icon('phone')]);
        if (tl.connected && UI.phoneWall && (!ph.activeId || ph.activeId === tl.id)) wall.style.backgroundImage = UI.phoneWall;
        else if (tl.connected && dcolors) wall.style.backgroundImage = 'linear-gradient(160deg, ' + dcolors.join(', ') + (dcolors.length === 1 ? ', ' + dcolors[0] : '') + ')';
      } else {
        wall = el('span', { class: 'phone-wall computer-wall' }, [UI.osIcon(tl.os)]);
      }
      const b = el('button', {
        class: 'phone-tile' + (tl.kind === 'computer' ? ' computer' : '') + (tl.connected ? ' connected' : '') + (tl.selected ? ' selected' : '') + (tl.state === 'via' ? ' via' : ''),
        title: tl.state === 'via' ? tr('meshm_start.is_reached_through', '{name} is reached through {via}', { name: tl.name, via: tl.via.join(', ') }) : tl.action === 'connect' ? tr('sidebar.connect_to', 'Connect to {name}', { name: tl.name }) : tl.name,
      }, [
        wall,
        el('span', { class: 'phone-text' }, [el('span', { class: 'phone-name', text: tl.name }), el('span', { class: 'phone-sub', text: tl.sub })]),
        tl.connected ? el('span', { class: 'dot good' }) : tl.state === 'connecting' ? el('span', { class: 'spin', attrs: { 'aria-hidden': 'true' } }) : tl.state === 'via' ? el('span', { class: 'pill muted', text: tr('sidebar.via', 'via {name}', { name: tl.via[0] || '…' }) }) : null,
      ]);
      b.dataset.id = tl.id;
      b.dataset.connected = tl.connected ? '1' : '';
      b.dataset.selected = tl.selected ? '1' : '';
      if (tl.action === 'none') b.setAttribute('aria-disabled', 'true');
      b.onclick = () => pick(tl);
      if (tl.forget && tl.forget.length) { // paired but offline: forget it (right-click, or the x on hover); a stale twin goes too
        const forget = () => { for (const id of tl.forget) Promise.resolve(api.forgetPeer(id)).catch(() => {}); };
        b.appendChild(el('span', { class: 'tile-x', role: 'button', title: tr('meshm_start.forget_name', 'Forget {name}', { name: tl.name }), text: '×', onclick: (e) => { e.stopPropagation(); forget(); } }));
        b.oncontextmenu = (e) => { e.preventDefault(); forget(); };
      }
      return b;
    }));
    markTiles();
  }

  // Two kinds of pairing request: someone pairs with this Mac (Allow / Deny), or this Mac pairs
  // with another Mac as its guest (Codes match / Cancel, like the PC app).
  let bannerMode = null;
  // A sentence with the other computer's name in bold: the template is cut at {name}.
  const withName = (key, name, def) => {
    const [a, b = ''] = tr(key, def).split('{name}');
    return [a, el('strong', { text: name }), b];
  };
  function renderBanner(s) {
    const p = s.pairing;
    const g = s.guest && s.guest.pairing;
    // This Mac asked a phone to pair: it goes on there (Cancel only hides this).
    const inv = !p && !g && s.connect && s.connect.inviting && !(s.client && s.client.id === s.connect.inviting.id) ? s.connect.inviting : null;
    bannerMode = p ? 'host' : g ? 'guest' : inv ? 'guest' : null;
    $('banner').hidden = !bannerMode;
    if (!bannerMode) return;
    if (inv) {
      $('pair-title').replaceChildren(...withName('pair.press_pair_on', inv.name, 'Press Pair on {name}'));
      $('pair-code').hidden = $('pair-code-label').hidden = true;
      $('pair-allow').hidden = true;
      $('pair-deny').textContent = tr('pair.cancel', 'Cancel');
      $('pair-hint').textContent = tr('start.duodesk_on_name_asks_to', 'DuoDesk on {name} asks to pair with this Mac. Press Pair there, then compare the codes.', { name: inv.name });
      return;
    }
    const code = (p || g).code;
    $('pair-code').textContent = code ? `${code.slice(0, 3)} ${code.slice(3)}` : '…';
    $('pair-code').hidden = $('pair-code-label').hidden = !!(p && p.wired); // on the USB cable: nothing to compare
    if (p) {
      $('pair-title').replaceChildren(...withName('pair.wants_to_pair', p.name, '{name} wants to pair'));
      $('pair-allow').textContent = tr('pair.allow', 'Allow');
      $('pair-deny').textContent = tr('pair.deny', 'Deny');
      $('pair-allow').hidden = false;
      $('pair-allow').disabled = !p.code || p.allowed;
      const other = p.name;
      let hint = tr('start.check_that_name_shows_the', 'Check that {name} shows the same code.', { name: other });
      if (p.wired) hint = p.allowed ? tr('sidebar.pairing', 'Pairing…') : tr('start.name_is_on_the_usb', '{name} is on the USB cable. Click Allow to pair.', { name: other });
      else if (!p.code) hint = tr('start.waiting_for_the_code', 'Waiting for the code…');
      else if (p.allowed && !p.confirmed) hint = tr('start.allowed_waiting_for_codes_match', 'Allowed. Waiting for “Codes match” on {name}…', { name: other });
      else if (p.confirmed && !p.allowed) hint = tr('start.name_confirmed_the_code_click', '{name} confirmed the code. Click Allow if it matches.', { name: `${other[0].toUpperCase()}${other.slice(1)}` });
      $('pair-hint').textContent = hint;
      return;
    }
    $('pair-title').replaceChildren(...withName('pair.title_with', g.name, 'Pairing with {name}'));
    $('pair-allow').textContent = tr('pair.match', 'Codes match');
    $('pair-deny').textContent = g.phase === 'failed' ? tr('start.ok', 'OK') : tr('pair.cancel', 'Cancel');
    $('pair-allow').hidden = g.phase === 'failed';
    $('pair-allow').disabled = g.phase !== 'code';
    $('pair-hint').textContent = g.phase === 'failed' ? g.error
      : g.phase === 'code' ? tr('start.check_that_name_shows_the', 'Check that {name} shows the same code.', { name: g.name })
        : g.phase === 'waiting' ? tr('start.waiting_for_allow_on_name', 'Waiting for Allow on {name}…', { name: g.name }) : tr('sidebar.connecting', 'Connecting…');
  }

  // Wi-Fi for a session through Bluetooth (netlink.js): what's happening, and for a phone's screen
  // its hotspot's name and password (kept for that phone; the password field empty = the saved one).
  let netShown = '';
  function renderNet(s) {
    const n = s.net;
    const c = s.client;
    const name = (c && c.name) || tr('start.the_other_device', 'the other device');
    const show = n && ['asking', 'hosting', 'joining', 'hotspot', 'failed'].includes(n.state) && (n.state !== 'failed' || n.error);
    $('net-banner').hidden = !show;
    if (!show) return void (netShown = '');
    const form = n.state === 'hotspot';
    $('net-form').hidden = !form;
    $('net-join').hidden = !form;
    $('net-cancel').textContent = n.state === 'failed' ? tr('start.ok', 'OK') : tr('pair.cancel', 'Cancel');
    if (form && netShown !== 'hotspot') { // fill in once, not while typing
      $('net-ssid').value = n.hotspotSsid || '';
      $('net-pass').value = '';
      $('net-pass').placeholder = n.hotspotSaved ? tr('overview.password_saved', 'Password (saved)') : tr('overview.password', 'Password');
      setTimeout(() => (n.hotspotSsid ? $('net-pass') : $('net-ssid')).focus(), 0);
    }
    netShown = n.state;
    const TITLES = {
      asking: tr('start.moving_to_wifi_with_name', 'Moving to Wi-Fi with {name}…', { name }),
      hosting: tr('overview.starting_wifi_for', 'Starting Wi-Fi for {name}…', { name }),
      joining: tr('overview.joining_ssid', 'Joining {ssid}…', { ssid: n.ssid || 'Wi-Fi' }),
      hotspot: tr('start.switch_on_names_hotspot', 'Switch on {name}’s hotspot', { name }),
      failed: tr('start.couldnt_move_to_wifi', 'Couldn’t move to Wi-Fi'),
    };
    $('net-title').textContent = TITLES[n.state];
    $('net-hint').textContent = n.state === 'hotspot'
      ? tr('start.name_isnt_on_this_macs', '{name} isn’t on this Mac’s network. Its screen needs Wi-Fi: switch its hotspot on, then type its name and password here.', { name })
      : n.state === 'failed' ? tr('start.error_still_connected_over', '{error}. Still connected over Bluetooth.', { error: n.error })
        : n.kind === 'direct' ? (n.why.includes('user') || n.peerWhy.includes('user') ? tr('start.name_isnt_on_this_network', '{name} isn’t on this network: a direct Wi-Fi link. This Mac is off its own Wi-Fi meanwhile.', { name })
          : n.why.includes('files') || n.peerWhy.includes('files') ? tr('start.name_isnt_on_this_network_files', '{name} isn’t on this network: a direct Wi-Fi link for the files. This Mac is off its own Wi-Fi meanwhile.', { name })
            : tr('start.name_isnt_on_this_network_screen', '{name} isn’t on this network: a direct Wi-Fi link for the screen. This Mac is off its own Wi-Fi meanwhile.', { name })) : '';
  }
  $('net-join').onclick = () => api.netJoinHotspot({ ssid: $('net-ssid').value, pass: $('net-pass').value });
  $('net-pass').onkeydown = $('net-ssid').onkeydown = (e) => { if (e.key === 'Enter') $('net-join').click(); };
  $('net-cancel').onclick = () => api.netCancel();

  // The selected device changed: the sections show the new device (no data of the previous one stays), and
  // the section a clicked tile asked for opens.
  let selKey = null;
  function selectionChanged(s) {
    const sel = M.selectedOf(s.peers);
    const k = sel ? sel.id : '';
    if (selKey === null) { selKey = k; return; }
    if (k !== selKey) {
      selKey = k;
      window.dispatchEvent(new CustomEvent('twindesk-device', { detail: k }));
    }
    if (goAfter && k === goAfter.id) goAfter.go();
  }

  function render(s) {
    UI.state = s;
    document.body.classList.toggle('no-peer', !linked(s)); // switches of what needs a device can't be changed (shared/feature-art.js)
    selectionChanged(s);
    UI.names(s);
    if (UI.setup.render(s)) {
      renderBanner(s);
      return;
    }
    renderSidebar(s);
    renderBanner(s);
    renderNet(s);
    if (current) renderPage(current, s);
  }

  $('pair-allow').onclick = () => (bannerMode === 'guest' ? api.confirmGuestCode() : api.pairRespond(true));
  $('pair-deny').onclick = () => (bannerMode === 'guest' ? api.cancelGuestPair() : api.pairRespond(false));
  PairPop.attach($('banner'), $('pair-allow')); // the popup over the window, Allow there presses this one
  window.addEventListener('macshare-go', (e) => show(e.detail, true));
  if (api.onGo) api.onGo((tab) => typeof tab === 'string' && views.has(tab) && show(tab, true));

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

  api.onState((s) => { syncSavedLanguage(s); render(s); });
  api.getState().then((s) => {
    syncSavedLanguage(s);
    const saved = s.ui && s.ui.tab;
    show(saved === 'display' ? 'share' : saved || 'connection', false); // 'display' = before the split
    render(s);
  });
})();
