// DuoDesk — PageFX core. Based on TwinDesk — Copyright (C) 2026 inukaasith. GPL-3.0, see LICENSE.
// The common mechanics every page's "personality" uses (header insert, accent, switch-in, state):
//   - which page is showing: #pages > .page without [hidden] (+ #nav aria-selected) → body[data-page]
//   - per-page accent: --pg-a / --pg-b (the two stops of the tab def's colour) on #page-<id>;
//     --pg-glow / --pg-grad / --pg-soft / --pg-line follow in core.css. The showing page's stops are
//     also put on body (--pg-a / --pg-b) for chrome tints.
//   - a registry: PageFX.register(id | [ids], { mount, update, enter, leave }) with a ctx of helpers
//   - state: UI.api.onState (this file loads after app.js / aurora-shell.js, so pages rendered first),
//     coalesced to one update per frame, only for the page that shows, never while the window is hidden
//   - switch-in: .pg-in on the page for 900 ms, --i (stagger index) on .page-body's children
//   - one rAF loop + timers for every page, run only for the page that shows, stopped while
//     document.hidden / html.au-paused, and (loops) under prefers-reduced-motion
// Loaded by windows/linux app.html and mac/control.html (and their mesh/ variants): every state access
// is guarded (Windows/Linux s.link + s.peer, Mac s.client + s.paired[], mesh s.peers[]).
// CSP (style-src 'self'): no style attributes, no <style>, no innerHTML — CSSOM and classes only.
'use strict';

(() => {
  if (window.PageFX) return;
  const UI = window.UI || {};
  const tr = (k, p, d) => (typeof window !== 'undefined' && typeof window.t === 'function' ? window.t(k, p, d) : d !== undefined ? d : k);
  const api = UI.api || window.macshare || {};
  const html = document.documentElement;
  const pagesEl = document.getElementById('pages');
  const navEl = document.getElementById('nav');
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const IN_MS = 900;

  const safe = (fn, dflt) => { try { const v = fn(); return v === undefined ? dflt : v; } catch (e) { return dflt; } };
  const report = (id, where, e) => console.error('pagefx ' + id + ' ' + where + ':', e);
  const num = (v) => (typeof v === 'number' && isFinite(v) ? v : null);

  // ======================================================================
  // Motion gates
  // ======================================================================
  const mqReduce = window.matchMedia ? matchMedia('(prefers-reduced-motion: reduce)') : null;
  const reduced = () => !!(mqReduce && mqReduce.matches);
  const paused = () => document.hidden || html.classList.contains('au-paused');
  const syncReduced = () => html.classList.toggle('pg-reduced', reduced());
  syncReduced();

  // ======================================================================
  // Safe state getters (Windows / Linux single, Mac single, mesh)
  // ======================================================================
  const plat = (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || navigator.userAgent || '';
  const PLATFORM = /mac/i.test(plat) ? 'mac' : /win/i.test(plat) ? 'win' : 'linux';

  function get(s, path, dflt) {
    let v = s;
    for (const k of String(path).split('.')) { if (v == null) return dflt; v = v[k]; }
    return v === undefined || v === null ? dflt : v;
  }
  const meshPeers = (s) => (s && Array.isArray(s.peers) ? s.peers.filter((p) => p && p.os !== 'android') : null);
  const peerLive = (p) => !!(p && (p.connected || p.state === 'connected'));
  // The mesh peer that pages talk about: the selected live one, else any live one, else the selected one.
  const meshPeer = (s) => {
    const ps = meshPeers(s);
    if (!ps || !ps.length) return null;
    return ps.find((p) => p.selected && peerLive(p)) || ps.find(peerLive) || ps.find((p) => p.selected) || null;
  };
  const macPaired = (s) => (s && Array.isArray(s.paired) ? s.paired[0] : null);
  // A computer is linked (not a phone).
  const pcLinked = (s) => !!(s && (
    (s.link && s.link.state === 'connected' && !isPhone(s))
    || (s.client && s.client.os !== 'android')
    || (meshPeers(s) || []).some(peerLive)));
  function isPhone(s) {
    if (!s) return false;
    if (safe(() => typeof UI.isPhone === 'function' && UI.isPhone(s), false)) return true;
    return !!((s.session && s.session.os === 'android') || (s.peerSession && s.peerSession.os === 'android') || (s.client && s.client.os === 'android'));
  }
  // The connected phone (bridge or session), normalised; null: none.
  function phone(s) {
    if (!s) return null;
    const ph = s.phone || {};
    let c = ph.connected;
    if (!c && Array.isArray(ph.phones)) c = ph.phones.find((p) => p && p.id === ph.activeId && (p.connected || p.state === 'connected')) || ph.phones.find((p) => p && (p.connected || p.state === 'connected')) || null;
    const session = isPhone(s);
    if (!c && !session) return null;
    const info = ph.info || {};
    const name = (c && c.name) || (session && ((s.peer && s.peer.name) || (s.client && s.client.name) || s.link && s.link.macName)) || safe(() => UI.phoneName(s), '') || tr('nav.phone', null, 'Phone');
    const rtt = num(c && (c.rttMs != null ? c.rttMs : c.rtt)) ?? (session ? num(get(s, 'link.rtt')) ?? num(get(s, 'client.rttMs')) : null);
    return {
      id: (c && c.id) || null, name, usb: !!(c && c.usb), rtt, session,
      battery: num(info.battery), charging: !!info.charging,
      colors: Array.isArray(info.colors) ? info.colors.filter(Boolean) : [],
    };
  }
  // The phone is what the pages are about (it's the session, or it's the only thing connected).
  const phoneFirst = (s) => isPhone(s) || (!pcLinked(s) && !!phone(s));
  const linked = (s) => !!(s && ((s.link && s.link.state === 'connected') || (s.phone && s.phone.connected) || s.client || (meshPeers(s) || []).some(peerLive) || (get(s, 'phone.phones', []).some && get(s, 'phone.phones', []).some((p) => p && (p.connected || p.state === 'connected')))));
  // connected | connecting | reconnecting | pairing | identity_changed | not_connected | not_paired | stopped
  function linkState(s) {
    if (!s) return 'not_paired';
    if (linked(s)) return 'connected';
    if (s.pairing) return 'pairing';
    if (s.phone && s.phone.connecting) return 'connecting';
    const ps = meshPeers(s);
    if (ps) {
      if (ps.some((p) => p.state === 'connecting')) return 'connecting';
      return ps.length ? 'not_connected' : 'not_paired';
    }
    if (s.link && s.link.state) return s.link.state;
    const g = get(s, 'guest.status.state');
    if (g === 'connecting' || g === 'reconnecting') return g;
    if (Array.isArray(s.paired)) return s.paired.length ? 'not_connected' : 'not_paired';
    return 'not_paired';
  }
  function peerName(s) {
    if (!s) return '';
    if (phoneFirst(s)) return (phone(s) || {}).name || '';
    const mp = meshPeer(s);
    const p0 = macPaired(s);
    return (s.peer && s.peer.name) || (s.link && s.link.macName) || (s.client && s.client.name) || (mp && mp.name)
      || (s.paired && !Array.isArray(s.paired) && s.paired.macName) || (p0 && (p0.name || p0.macName)) || '';
  }
  function peerOs(s) {
    if (!s) return null;
    if (phoneFirst(s)) return 'android';
    const mp = meshPeer(s);
    const p0 = macPaired(s);
    return (s.peer && s.peer.os) || (s.client && s.client.os) || (mp && mp.os)
      || (s.paired && !Array.isArray(s.paired) && s.paired.os) || (p0 && p0.os) || null;
  }
  const myName = (s) => (s && ((s.device && s.device.name) || s.macName)) || safe(() => UI.peer(s).me, '') || tr('general.this_computer', null, 'This computer');
  // Round trip in ms of the link the pages are about; null when not linked or unknown.
  function rtt(s) {
    if (!linked(s)) return null;
    if (phoneFirst(s)) return (phone(s) || {}).rtt ?? null;
    const mp = meshPeer(s);
    return num(get(s, 'link.rtt')) ?? num(get(s, 'client.rttMs')) ?? num(mp && mp.rtt);
  }
  // usb | ble | hotspot | wifi-direct | wifi
  function transport(s) {
    if (!s) return 'wifi';
    const p = phoneFirst(s) ? phone(s) : null;
    if (p && p.usb) return 'usb';
    if ((s.client && s.client.transport === 'ble') || (s.net && s.net.transport === 'ble') || (s.link && s.link.transport === 'ble')) return 'ble';
    const v = via(s);
    return /hotspot/i.test(v) ? 'hotspot' : /direct/i.test(v) ? 'wifi-direct' : /bluetooth/i.test(v) ? 'ble' : 'wifi';
  }
  // The route's words, as the pages say it: USB, Bluetooth, Wi-Fi, Wi-Fi Direct, Hotspot, Temporary …
  function via(s) {
    if (!s) return 'Wi-Fi';
    const p = phoneFirst(s) ? phone(s) : null;
    if (p && p.usb) return 'USB';
    const v = safe(() => (typeof UI.via === 'function' ? UI.via(s) : ''), '');
    if (v) return v;
    if ((s.client && s.client.transport === 'ble') || (s.net && s.net.transport === 'ble')) return 'Bluetooth';
    return 'Wi-Fi';
  }
  // { level 0-100, charging, of: 'phone' | 'pc' } or null.
  function battery(s) {
    if (!s) return null;
    if (phoneFirst(s)) { const p = phone(s); return p && p.battery != null ? { level: p.battery, charging: p.charging, of: 'phone' } : null; }
    const level = num(get(s, 'peerInfo.battery'));
    return level != null ? { level, charging: !!get(s, 'peerInfo.charging'), of: 'pc' } : null;
  }
  // Every other device this desk knows: [{ id, name, os, kind: 'pc'|'phone', live, wait, rtt, selected, paired }].
  function peers(s) {
    const out = [];
    if (!s) return out;
    const add = (d) => { if (d && d.name && !out.some((x) => (d.id && x.id === d.id) || (x.kind === d.kind && x.name === d.name))) out.push(d); };
    const ps = meshPeers(s);
    if (ps) for (const p of ps) add({ id: p.id, name: p.name || tr('aurora.computer', null, 'Computer'), os: p.os || 'win', kind: 'pc', live: peerLive(p), wait: p.state === 'connecting', rtt: num(p.rtt), selected: !!p.selected, paired: true });
    if (s.link) {
      const st = s.link.state;
      const pr = s.paired && !Array.isArray(s.paired) ? s.paired : null;
      if (!isPhone(s)) {
        const name = (s.peer && s.peer.name) || s.link.macName || (pr && pr.macName);
        if (name) add({ id: (s.peer && s.peer.id) || (pr && pr.macId) || null, name, os: (s.peer && s.peer.os) || (pr && pr.os) || 'mac', kind: 'pc', live: st === 'connected', wait: st === 'connecting' || st === 'reconnecting', rtt: st === 'connected' ? num(s.link.rtt) : null, selected: true, paired: !!pr });
      }
      for (const g of Array.isArray(s.guests) ? s.guests : []) add({ id: g.id || null, name: g.name || g.macName, os: g.os || 'win', kind: 'pc', live: false, wait: false, rtt: null, selected: false, paired: true });
    } else if (s.client || Array.isArray(s.paired)) {
      const c = s.client;
      if (c && c.os !== 'android') add({ id: c.id || null, name: c.name, os: c.os || 'win', kind: 'pc', live: true, wait: false, rtt: num(c.rttMs), selected: true, paired: true });
      for (const p of Array.isArray(s.paired) ? s.paired : []) add({ id: p.id || null, name: p.name || p.macName, os: p.os || 'win', kind: 'pc', live: false, wait: false, rtt: null, selected: false, paired: true });
      for (const p of get(s, 'guest.hosts', [])) add({ id: p.id || null, name: p.name, os: p.os || 'win', kind: 'pc', live: false, wait: false, rtt: null, selected: false, paired: true });
    }
    const ph = s.phone || {};
    const pc = phone(s);
    const list = Array.isArray(ph.nearby) ? ph.nearby : Array.isArray(ph.phones) ? ph.phones : [];
    for (const d of list) {
      if (!d) continue;
      const on = !!(d.connected || d.state === 'connected' || (ph.connected && ph.connected.id === d.id));
      add({ id: d.id || null, name: d.name || tr('nav.phone', null, 'Phone'), os: 'android', kind: 'phone', live: on, wait: !!(ph.connecting && ph.connecting.id === d.id), rtt: on && pc ? pc.rtt : null, selected: on, paired: true, usb: !!(d.usb || (on && pc && pc.usb)) });
    }
    if (pc && pc.session) add({ id: pc.id, name: pc.name, os: 'android', kind: 'phone', live: true, wait: false, rtt: pc.rtt, selected: true, paired: true, usb: pc.usb });
    return out;
  }
  const ago = (ts) => safe(() => UI.ago(ts), '');
  const bytes = (n) => safe(() => UI.bytes(n), n == null ? '' : n + ' B');
  const hash = (str) => { let x = 2166136261; for (const ch of String(str)) { x ^= ch.codePointAt(0); x = Math.imul(x, 16777619); } return x >>> 0; };

  const getters = { get, linked, linkState, isPhone, phone, phoneFirst, peerName, peerOs, myName, rtt, via, transport, battery, peers, meshPeer, ago, bytes, hash, platform: PLATFORM };

  // ======================================================================
  // DOM helpers (CSP-safe)
  // ======================================================================
  function setAttrs(e, attrs, isSvg) {
    if (!attrs) return;
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'style') { console.warn('pagefx: style attributes are blocked by the CSP; use ctx.css()'); continue; }
      if (k === 'text') e.textContent = v;
      else if (k === 'data') for (const [dk, dv] of Object.entries(v)) e.dataset[dk] = dv;
      else if (k === 'on') for (const [ev, fn] of Object.entries(v)) e.addEventListener(ev, fn);
      else if (k === 'css') css(e, v);
      else if (!isSvg && (k === 'hidden' || k === 'disabled' || k === 'title' || k === 'type' || k === 'tabIndex')) e[k] = v;
      else e.setAttribute(k, v === true ? '' : v);
    }
  }
  function append(e, kids) {
    for (const c of [].concat(kids == null ? [] : kids)) {
      if (c == null || c === false) continue;
      e.append(typeof c === 'string' || typeof c === 'number' ? String(c) : c);
    }
  }
  // el('div', 'pg-chip', [kids], { text, title, 'aria-label', data: {k: v}, on: {click: fn}, css: {'--x': v} })
  function el(tag, cls, kids, attrs) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (tag === 'button') e.type = 'button';
    setAttrs(e, attrs, false);
    append(e, kids);
    return e;
  }
  // svg('circle', { cx, cy, r, class }, [kids])
  function svg(tag, attrs, kids) {
    const e = document.createElementNS(SVG_NS, tag);
    setAttrs(e, attrs, true);
    append(e, kids);
    return e;
  }
  // svgRoot('0 0 300 100', 'pg-radar-svg', [kids]) — decorative: aria-hidden, never focusable.
  function svgRoot(viewBox, cls, kids, attrs) {
    return svg('svg', Object.assign({ viewBox, class: cls || null, 'aria-hidden': 'true', focusable: 'false' }, attrs || {}), kids);
  }
  // 24×24 line glyphs (stroke currentColor); `fill` ones are solid shapes.
  const ICONS = {
    mac: { fill: true, d: 'M16.4 12.7c0-2.1 1.7-3.1 1.8-3.2-1-1.4-2.5-1.6-3-1.6-1.3-.1-2.5.8-3.1.8-.7 0-1.7-.8-2.7-.7-1.4 0-2.7.8-3.4 2.1-1.5 2.5-.4 6.2 1 8.2.7 1 1.5 2.1 2.6 2.1 1 0 1.4-.7 2.7-.7s1.6.7 2.7.7c1.1 0 1.8-1 2.5-2 .8-1.2 1.1-2.3 1.1-2.3s-2.2-.9-2.2-3.4zM14.4 6.5c.6-.7 1-1.7.9-2.6-.8 0-1.8.6-2.4 1.3-.5.6-1 1.6-.9 2.5.9.1 1.8-.5 2.4-1.2z' },
    win: { fill: true, d: 'M3.5 5.6 10.5 4.6v6.9h-7zM11.8 4.4 20.5 3.2v8.3h-8.7zM3.5 12.8h7v6.9l-7-1zM11.8 12.8h8.7v8.3l-8.7-1.2z' },
    linux: { d: 'M12 3.2c-1.9 0-3 1.6-3 3.8 0 1.6-.6 2.6-1.6 4.1-1.2 1.7-2 3.6-1.5 5.6M12 3.2c1.9 0 3 1.6 3 3.8 0 1.6.6 2.6 1.6 4.1 1.2 1.7 2 3.6 1.5 5.6M7.6 19.8c1.2-.9 2.7-1.3 4.4-1.3s3.2.4 4.4 1.3M10.6 7.4h.01M13.4 7.4h.01M10.9 9.6l1.1.7 1.1-.7' },
    android: { d: 'M6.5 11a5.5 5.5 0 0 1 11 0v6.2a.8.8 0 0 1-.8.8H7.3a.8.8 0 0 1-.8-.8zM8.4 6.4 7 4.2M15.6 6.4 17 4.2M10 10h.01M14 10h.01' },
    phone: { d: 'M8.5 2.5h7a2 2 0 0 1 2 2v15a2 2 0 0 1-2 2h-7a2 2 0 0 1-2-2v-15a2 2 0 0 1 2-2zM11 18.5h2' },
    laptop: { d: 'M5.5 5h13a1.5 1.5 0 0 1 1.5 1.5V16H4V6.5A1.5 1.5 0 0 1 5.5 5zM2 19h20' },
    desktop: { d: 'M4.5 4h15A1.5 1.5 0 0 1 21 5.5v9a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 14.5v-9A1.5 1.5 0 0 1 4.5 4zM8 20h8M12 16v4' },
    wifi: { d: 'M2 9a15 15 0 0 1 20 0M5.5 12.5a10 10 0 0 1 13 0M9 16a5 5 0 0 1 6 0M12 19.5h.01' },
    bt: { d: 'M7 7l10 10-5 4V3l5 4L7 17' },
    usb: { d: 'M12 3v15M12 18a2 2 0 1 0 0 .01M8 7l4-4 4 4M7 11v2l5 3M17 9v3l-5 3' },
    bolt: { d: 'M13 2 4.5 13.5H11L10 22l8.5-11.5H12z' },
    link: { d: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1' },
    lock: { d: 'M6.5 11h11a1.5 1.5 0 0 1 1.5 1.5v6a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 18.5v-6A1.5 1.5 0 0 1 6.5 11zM8 11V8a4 4 0 0 1 8 0v3' },
    arrow: { d: 'M5 12h14M13 6l6 6-6 6' },
    swap: { d: 'M4 8h14M14 4l4 4-4 4M20 16H6M10 12l-4 4 4 4' },
    check: { d: 'M5 12.5l4.5 4.5L19 7.5' },
    warn: { d: 'M12 3.5 21.5 20h-19zM12 10v4.5M12 17.2h.01' },
    clock: { d: 'M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18zM12 7v5l3.2 2' },
    play: { fill: true, d: 'M8 5.5v13l10.5-6.5z' },
    pause: { fill: true, d: 'M7 5h3.5v14H7zM13.5 5H17v14h-3.5z' },
    note: { d: 'M9 18V5l11-2v13M9 18a3 3 0 1 1-3-3 3 3 0 0 1 3 3zM20 16a3 3 0 1 1-3-3 3 3 0 0 1 3 3z' },
    file: { d: 'M7 3h7l5 5v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM14 3v5h5' },
    folder: { d: 'M3 7.5A1.5 1.5 0 0 1 4.5 6H9l2 2h8.5A1.5 1.5 0 0 1 21 9.5v8a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5z' },
    bell: { d: 'M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15zM10 20.5a2 2 0 0 0 4 0' },
    clip: { d: 'M9 4h6v3H9zM8 5.5H6.5A1.5 1.5 0 0 0 5 7v12.5A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V7a1.5 1.5 0 0 0-1.5-1.5H16' },
    spark: { d: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z' },
  };
  function icon(name, cls) {
    const def = ICONS[name] || ICONS.spark;
    return svgRoot('0 0 24 24', 'pg-ico' + (def.fill ? ' pg-ico-fill' : '') + (cls ? ' ' + cls : ''), [svg('path', { d: def.d })], { 'data-ico': name });
  }
  const OS_ICON = { mac: 'mac', win: 'win', windows: 'win', linux: 'linux', android: 'android', phone: 'phone' };
  const osIcon = (os, cls) => icon(OS_ICON[os] || 'desktop', cls);
  const OS_NAME = { mac: 'macOS', win: 'Windows', linux: 'Linux', android: 'Android' };

  // Write-if-changed setters: a push every second never touches the DOM when nothing changed.
  function css(e, prop, val) {
    if (!e) return;
    if (prop && typeof prop === 'object') { for (const [k, v] of Object.entries(prop)) css(e, k, v); return; }
    const v = val == null || val === false ? '' : String(val);
    if (e.style.getPropertyValue(prop) === v) return;
    if (v === '') e.style.removeProperty(prop); else e.style.setProperty(prop, v);
  }
  function text(e, str) { if (!e) return; const v = str == null ? '' : String(str); if (e.textContent !== v) e.textContent = v; }
  function attr(e, k, v) {
    if (!e) return;
    if (v == null || v === false) { if (e.hasAttribute(k)) e.removeAttribute(k); return; }
    const sv = v === true ? '' : String(v);
    if (e.getAttribute(k) !== sv) e.setAttribute(k, sv);
  }
  function cls(e, name, on) { if (e && e.classList.contains(name) !== !!on) e.classList.toggle(name, !!on); }
  // Replay a one-shot class (a pop / flash): off, next frame on, off after ms.
  function pop(e, name, ms) {
    if (!e) return;
    name = name || 'pg-pop';
    e.classList.remove(name);
    clearTimeout(e['_pgPop_' + name]);
    requestAnimationFrame(() => {
      e.classList.add(name);
      e['_pgPop_' + name] = setTimeout(() => e.classList.remove(name), ms || 700);
    });
  }
  const artShown = (page) => !!(page && page.querySelector(':scope > .feature-art:not([hidden])'));

  // ======================================================================
  // Scheduler: one rAF loop + timers, only for the page that shows
  // ======================================================================
  const loops = new Set();   // { id, fn, reduced }
  const timers = new Set();  // { id, ms, fn, paused, h }
  let raf = 0;
  let lastT = 0;
  let active = null;         // id of the page that shows
  const runs = (e) => e.id === '*' || e.id === active;
  function frame(t) {
    raf = 0;
    if (paused()) return;
    const dt = lastT ? Math.min(100, t - lastT) : 16;
    lastT = t;
    let any = false;
    for (const e of [...loops]) {
      if (!runs(e) || (reduced() && !e.reduced)) continue;
      any = true;
      try { if (e.fn(t, dt) === false) loops.delete(e); } catch (err) { loops.delete(e); report(e.id, 'loop', err); }
    }
    if (any) raf = requestAnimationFrame(frame);
    else lastT = 0;
  }
  function kick() {
    if (raf || paused()) return;
    for (const e of loops) if (runs(e) && (!reduced() || e.reduced)) { lastT = 0; raf = requestAnimationFrame(frame); return; }
  }
  function syncTimers() {
    for (const e of timers) {
      const want = runs(e) && !document.hidden && (e.paused || !html.classList.contains('au-paused'));
      if (want && !e.h) e.h = setInterval(() => { try { e.fn(); } catch (err) { report(e.id, 'every', err); } }, e.ms);
      else if (!want && e.h) { clearInterval(e.h); e.h = 0; }
    }
  }
  function addLoop(id, fn, opts) {
    const e = { id, fn, reduced: !!(opts && opts.reduced) };
    loops.add(e);
    kick();
    return () => loops.delete(e);
  }
  function addTimer(id, ms, fn, opts) {
    const e = { id, ms: Math.max(16, ms | 0), fn, paused: !!(opts && opts.paused), h: 0 };
    timers.add(e);
    syncTimers();
    return () => { if (e.h) clearInterval(e.h); timers.delete(e); };
  }
  const EASE = {
    linear: (k) => k,
    out: (k) => 1 - Math.pow(1 - k, 3),
    inOut: (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2),
    back: (k) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2); },
  };
  // tween(from, to, ms, (v, k) => …, { ease: 'out'|'inOut'|'back'|'linear'|fn, done }) → cancel.
  // Jumps to the end under reduced motion, while paused, or when the page isn't the one showing.
  function tween(id, from, to, ms, onFrame, opts) {
    const o = opts || {};
    const ease = typeof o.ease === 'function' ? o.ease : EASE[o.ease || 'out'];
    const end = () => { try { onFrame(to, 1); } catch (e) { report(id, 'tween', e); } if (o.done) o.done(); };
    if (reduced() || paused() || (id !== '*' && id !== active) || !(ms > 0) || from === to) { end(); return () => {}; }
    let t0 = 0;
    let stop = null;
    stop = addLoop(id, (t) => {
      if (!t0) t0 = t;
      const k = Math.min(1, (t - t0) / ms);
      onFrame(from + (to - from) * ease(k), k);
      if (k >= 1) { if (o.done) o.done(); return false; }
      return true;
    });
    return () => { if (stop) stop(); };
  }
  // count(el, value, { ms, fmt(v), digits }): number text that rolls to its new value.
  function count(id, e, value, opts) {
    if (!e) return;
    const o = opts || {};
    const digits = o.digits || 0;
    const fmt = o.fmt || ((v) => (v == null ? '–' : v.toFixed(digits)));
    const v = num(value);
    if (e._pgCancel) { e._pgCancel(); e._pgCancel = null; }
    const from = num(e._pgVal);
    e._pgVal = v;
    if (v == null || from == null) { text(e, fmt(v)); return; }
    e._pgCancel = tween(id, from, v, o.ms || 500, (x) => text(e, fmt(Number(x.toFixed(digits)))), { ease: 'out' });
  }

  // ======================================================================
  // Pages, accents, registry
  // ======================================================================
  const fxs = new Map();     // id → { fx, ctx, mountedOn: Element|null }
  const ctxs = new Map();
  let last = null;           // the last state
  const idOf = (pageEl) => (pageEl && pageEl.id ? pageEl.id.replace(/^page-/, '') : '');
  const pageOf = (id) => document.getElementById('page-' + id);
  const defOf = (id) => safe(() => (UI.tabs || []).find((d) => d && d.id === id), null);
  const stops = (color) => (String(color || '').match(/#[0-9a-f]{3,8}\b/gi) || []);
  const accents = new Map(); // id → [a, b] override

  function paintAccent(id, page) {
    page = page || pageOf(id);
    if (!page) return;
    let ab = accents.get(id);
    if (!ab) { const st = stops((defOf(id) || {}).color); ab = st.length ? [st[0], st[1] || st[0]] : null; }
    if (ab) { css(page, '--pg-a', ab[0]); css(page, '--pg-b', ab[1]); }
    else { css(page, '--pg-a', null); css(page, '--pg-b', null); }
    if (id === active) {
      css(document.body, '--pg-a', ab ? ab[0] : null);
      css(document.body, '--pg-b', ab ? ab[1] : null);
    }
  }

  // The header insert: div.pg-hdr[data-pg-hdr=<id>][aria-hidden=true].
  //   place 'body' (default): first child of .page-body — hides with the body (FeatureArt, master off).
  //   place 'before-body': between .page-head / .feature-art and .page-body.
  //   place 'after-head': right after .page-head (above the wifi note and .feature-art).
  //   interactive: true → no aria-hidden (it holds real buttons); cls: extra classes ('pg-radar');
  //   label: aria-label when interactive.
  function hdr(id, page, opts) {
    if (page && !(page instanceof Element)) { opts = page; page = null; }
    page = page || pageOf(id);
    if (!page) return null;
    const o = opts || {};
    let h = page.querySelector(':scope > .pg-hdr, :scope > .page-body > .pg-hdr');
    if (!h) {
      h = el('div', 'pg-hdr', null, { 'data-pg-hdr': id });
      const body = page.querySelector(':scope > .page-body');
      const head = page.querySelector(':scope > .page-head');
      const place = o.place || 'body';
      if (place === 'body' && body) body.prepend(h);
      else if (place === 'after-head' && head) head.after(h);
      else if (body) page.insertBefore(h, body);
      else page.append(h);
      h.dataset.place = place;
    }
    if (o.cls) for (const c of String(o.cls).split(/\s+/)) if (c) h.classList.add(c);
    if (o.interactive) { h.removeAttribute('aria-hidden'); if (o.label) h.setAttribute('aria-label', o.label); if (!h.getAttribute('role')) h.setAttribute('role', 'group'); }
    else h.setAttribute('aria-hidden', 'true');
    return h;
  }

  function makeCtx(id) {
    if (ctxs.has(id)) return ctxs.get(id);
    const owned = new Set(); // one-shot timeouts, cleared on leave
    const observers = [];
    const keys = new Map();
    const ctx = Object.assign({}, getters, {
      id,
      get page() { return pageOf(id); },
      get body() { const p = pageOf(id); return p && p.querySelector(':scope > .page-body'); },
      get def() { return defOf(id); },
      get reduced() { return reduced(); },
      s: () => last || UI.state || null,
      active: () => active === id,
      paused,
      el, svg, svgRoot, icon, osIcon, OS_NAME, css, text, attr, cls, pop, artShown,
      hdr: (page, opts) => hdr(id, page, opts),
      // changed('rtt', v): true when v differs from the last call with this key (JSON compare).
      changed(key, value) {
        const v = JSON.stringify(value === undefined ? null : value);
        if (keys.get(key) === v) return false;
        keys.set(key, v);
        return true;
      },
      forget(key) { if (key == null) keys.clear(); else keys.delete(key); },
      loop: (fn, opts) => addLoop(id, fn, opts),
      every: (ms, fn, opts) => addTimer(id, ms, fn, opts),
      after(ms, fn) {
        const h = setTimeout(() => { owned.delete(h); try { fn(); } catch (e) { report(id, 'after', e); } }, ms);
        owned.add(h);
        return () => { clearTimeout(h); owned.delete(h); };
      },
      tween: (from, to, ms, onFrame, opts) => tween(id, from, to, ms, onFrame, opts),
      count: (e, value, opts) => count(id, e, value, opts),
      observe(target, opts, fn) {
        if (!target) return () => {};
        const mo = new MutationObserver((recs) => { try { fn(recs); } catch (e) { report(id, 'observe', e); } });
        mo.observe(target, opts);
        observers.push(mo);
        return () => mo.disconnect();
      },
      // accent('#a', '#b') overrides the def colour (overview follows the device); accent(null) resets.
      accent(a, b) {
        if (a) accents.set(id, [a, b || a]); else accents.delete(id);
        paintAccent(id);
      },
      // stagger(list, '--i', start): index custom property on each element.
      stagger(list, prop, start) { let i = start || 0; for (const e of list || []) css(e, prop || '--i', i++); },
      refresh: () => { if (active === id) runUpdate(id); },
      _clearOwned() { for (const h of owned) clearTimeout(h); owned.clear(); },
    });
    ctxs.set(id, ctx);
    return ctx;
  }

  function ensureMounted(id) {
    const r = fxs.get(id);
    if (!r) return null;
    const page = pageOf(id);
    if (!page) return null;
    if (r.mountedOn !== page) {
      r.mountedOn = page;
      paintAccent(id, page);
      if (typeof r.fx.mount === 'function') { try { r.fx.mount(page, r.ctx); } catch (e) { report(id, 'mount', e); } }
    }
    return page;
  }
  function runUpdate(id) {
    const r = fxs.get(id);
    const s = last || UI.state;
    if (!r || !s || typeof r.fx.update !== 'function') return;
    const page = ensureMounted(id);
    if (!page) return;
    try { r.fx.update(s, page, r.ctx); } catch (e) { report(id, 'update', e); }
  }

  // register('overview', fx) or register(['mac-pc', 'receive'], fx).
  // fx = { mount(page, ctx) once, update(state, page, ctx) on each push while showing + once on enter,
  //        enter(page, ctx) when it starts showing, leave(page, ctx) when it stops }.
  function register(ids, fx) {
    for (const id of [].concat(ids)) {
      if (!id || !fx) continue;
      const ctx = makeCtx(id);
      fxs.set(id, { fx, ctx, mountedOn: null });
      ensureMounted(id);
      if (id === active) { enterFx(id); runUpdate(id); }
    }
  }

  // ======================================================================
  // Active page
  // ======================================================================
  let inT = 0;
  let inPage = null;
  function enterFx(id) {
    const r = fxs.get(id);
    if (!r || typeof r.fx.enter !== 'function') return;
    const page = ensureMounted(id);
    if (page) { try { r.fx.enter(page, r.ctx); } catch (e) { report(id, 'enter', e); } }
  }
  function currentPage() {
    if (!pagesEl || pagesEl.hidden) return null;
    const vis = pagesEl.querySelector(':scope > .page:not([hidden])');
    if (vis) return vis;
    const btn = navEl && navEl.querySelector('.nav-item[aria-selected="true"]');
    const p = btn && document.getElementById(btn.getAttribute('aria-controls') || '');
    return p && !p.hidden ? p : null;
  }
  function setActive() {
    const page = currentPage();
    const id = page ? idOf(page) : null;
    const setupOn = !!safe(() => UI.setup && UI.setup.page && !UI.setup.page.hidden, false);
    const want = id || (setupOn ? 'setup' : '');
    if (document.body.dataset.page !== want) { if (want) document.body.dataset.page = want; else delete document.body.dataset.page; }
    if (id === active) return;
    const prev = active;
    active = id;
    if (prev) {
      const r = fxs.get(prev);
      const pp = pageOf(prev);
      if (pp) pp.classList.remove('pg-in');
      const c = ctxs.get(prev);
      if (c) c._clearOwned();
      if (r && typeof r.fx.leave === 'function' && pp) { try { r.fx.leave(pp, r.ctx); } catch (e) { report(prev, 'leave', e); } }
    }
    syncTimers();
    if (!page) { css(document.body, '--pg-a', null); css(document.body, '--pg-b', null); return; }
    paintAccent(id, page);
    // switch-in: stagger index on the body's children, .pg-in for 900 ms
    const body = page.querySelector(':scope > .page-body');
    if (body) { let i = 0; for (const c of body.children) css(c, '--i', i++); }
    clearTimeout(inT);
    if (inPage && inPage !== page) inPage.classList.remove('pg-in');
    page.classList.add('pg-in');
    inPage = page;
    inT = setTimeout(() => { page.classList.remove('pg-in'); if (inPage === page) inPage = null; }, IN_MS);
    enterFx(id);
    runUpdate(id);
    kick();
  }
  let pendingActive = false;
  const queueActive = () => { if (pendingActive) return; pendingActive = true; queueMicrotask(() => { pendingActive = false; setActive(); }); };

  if (pagesEl) {
    const watchPage = (p) => { if (p.classList && p.classList.contains('page') && !p._pgWatched) { p._pgWatched = true; pageMo.observe(p, { attributes: true, attributeFilter: ['hidden'] }); } };
    const pageMo = new MutationObserver(queueActive);
    for (const p of pagesEl.children) watchPage(p);
    new MutationObserver((recs) => {
      for (const r of recs) for (const n of r.addedNodes) if (n.nodeType === 1) { watchPage(n); const id = idOf(n); if (fxs.has(id)) ensureMounted(id); paintAccent(id, n); }
      queueActive();
    }).observe(pagesEl, { childList: true, attributes: true, attributeFilter: ['hidden'] });
  }
  if (navEl) new MutationObserver(queueActive).observe(navEl, { subtree: true, attributes: true, attributeFilter: ['aria-selected'] });

  // ======================================================================
  // State: pushes coalesced (one update per ~16 ms) for the page that shows; nothing while hidden.
  // A timeout, not rAF: an occluded or throttled window still gets its data, just no animation.
  // ======================================================================
  let stateRaf = 0;
  let dirty = false;
  const later = () => setTimeout(flush, 16);
  function flush() {
    stateRaf = 0;
    if (!dirty || document.hidden) return;
    dirty = false;
    if (active) runUpdate(active);
  }
  function onState(s) {
    if (!s) return;
    last = s;
    dirty = true;
    if (!stateRaf && !document.hidden) stateRaf = later();
  }
  if (typeof api.onState === 'function') api.onState(onState);
  if (UI.state) onState(UI.state);
  else if (typeof api.getState === 'function') Promise.resolve(api.getState()).then((s) => { if (!last) onState(UI.state || s); }, () => {});

  // ======================================================================
  // Pause / resume
  // ======================================================================
  const resume = () => { syncTimers(); kick(); if (dirty && !document.hidden && !stateRaf) stateRaf = later(); };
  document.addEventListener('visibilitychange', resume);
  new MutationObserver(resume).observe(html, { attributes: true, attributeFilter: ['class'] });
  if (mqReduce && mqReduce.addEventListener) mqReduce.addEventListener('change', () => { syncReduced(); kick(); });

  // Every page gets its accent now (cheap: two custom properties each).
  if (pagesEl) for (const p of pagesEl.children) if (p.classList.contains('page')) paintAccent(idOf(p), p);

  window.PageFX = {
    version: 1,
    register,
    ctx: makeCtx,
    get: getters,
    el, svg, svgRoot, icon, osIcon, css, text, attr, cls, pop,
    active: () => active,
    state: () => last || UI.state || null,
    reduced,
    paused,
    refresh: () => { if (active) runUpdate(active); },
    accent: (id, a, b) => makeCtx(id).accent(a, b),
    _debug: () => ({ active, registered: [...fxs.keys()], loops: loops.size, timers: [...timers].map((t) => ({ id: t.id, on: !!t.h })), raf: !!raf }),
  };
  setActive();
})();
