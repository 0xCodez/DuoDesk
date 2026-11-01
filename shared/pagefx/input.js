// DuoDesk — PageFX: the Input group's personalities. Based on TwinDesk — Copyright (C) 2026 inukaasith. GPL-3.0, see LICENSE.
// Minimal (specs/MINIMAL.md): each page gets one quiet glass strip (.pg-hdr.pd-hdr) — light Geist type, a
// Geist Mono caption, one hairline monochrome motif — with the page's accent on ONE moving/live element:
//   cursor   — the real monitor layout in hairlines (s.kvmState.map, placed with KvmGeom like the crossing
//              map); the contact edge in amber; a white pointer that glides across it now and then
//   keyboard — flat hairline keycaps (the real hotkey, ⌘ ⇄ Ctrl with a Mac) → a hairline → where keys go
//   remote   — a phone and a monitor in hairlines; the finger (orchid) on the phone, its pointer on the
//              monitor; or a D-pad face while a real gamepad is live (s.remote)
//   terminal — a two-lane shell window, typographic: here → there and there → here (s.terminal)
//   rezume   — two devices and a hairline arc; what the other one offers rides it as a glass chip (s.rezume)
// Motion is CSS (offset-path, keyframes): slow, one gesture per loop, only on the page that shows (hidden
// pages are display:none), paused with html.au-paused (everything moving is in .pg-hdr or .pg-fx), off
// under prefers-reduced-motion. Nothing is placed with `transform` (core's reduced-motion rule clears it,
// SVG transform attributes included): SVG coordinates, left/top and offset-distance only.
// Loaded after shared/pagefx/core.js on Windows, Linux and the Mac (same page ids; Mac state is
// s.input / s.client …; mesh s.peers[]): every state read is guarded.
'use strict';

(() => {
  const FX = window.PageFX;
  if (!FX || FX._input) return;
  FX._input = true;
  const UI = window.UI || {};
  const G = FX.get;
  const KG = window.KvmGeom || null;
  const tr = (k, p, d) => (typeof window !== 'undefined' && typeof window.t === 'function' ? window.t(k, p, d) : d !== undefined ? d : k);

  const safe = (fn, d) => { try { const v = fn(); return v === undefined || v === null ? d : v; } catch (e) { return d; } };
  const num = (v) => (typeof v === 'number' && isFinite(v) ? v : null);
  const f1 = (v) => Math.round(v * 10) / 10;
  const clip = (str, n) => { const t = String(str || ''); return t.length > n ? t.slice(0, n - 1).trimEnd() + '…' : t; };
  const capFirst = (t) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : t);
  // Names as the pages say them (UI.peer), with the core's getters as the fallback (Mac, mesh).
  function names(s) {
    const p = safe(() => UI.peer(s), null) || {};
    const me = p.me || G.myName(s) || tr('general.this_computer', null, 'This computer');
    const name = p.name || G.peerName(s) || tr('kit.the_other_computer', null, 'the other computer');
    return { me, name, Name: p.Name || capFirst(name), os: p.os || G.peerOs(s) || 'win' };
  }
  const noPeer = (s) => document.body.classList.contains('no-peer') || !G.linked(s);
  // Where input is: Windows / Linux s.kvmState { mode }, the Mac s.input { where } (both: map, locked, paused).
  const kvmOf = (s) => s.kvmState || (s.input && typeof s.input === 'object' ? s.input : {});
  const modeOf = (ks) => { const m = ks.mode || ks.where; return m === 'driving' || m === 'driven' ? m : 'home'; };
  // The Mac page draws the PC on k.pcSide as is; Windows / Linux flip it (MAC_SIDE), as their crossing maps do.
  const macPage = (s) => G.platform === 'mac' || !!(s && !s.link && !s.kvmState && s.input && typeof s.input === 'object');
  // The computer link's round trip only: with just a phone connected, its ping isn't the one these pages use.
  const pcRtt = (s) => (G.phoneFirst(s) ? null : G.rtt(s));
  const ARROW = 'M1.5 1.5v13.2l3.6-3.3 2.5 5.6 2.2-1-2.4-5.4h5z';

  // Lead text: a large light line and a mono caption (the strip's typography).
  function lead(c, cls) {
    const big = c.el('div', 'pd-big');
    const cap = c.el('div', 'pd-cap');
    return { box: c.el('div', 'pd-lead' + (cls ? ' ' + cls : ''), [big, cap]), big, cap };
  }

  // One family of hairline devices (MINIMAL.md "Devices"): same stroke, glass fill, subtle OS cues.
  // Drawn at (cx, cy) by scale k with plain coordinates (no transform attributes).
  function device(c, kind, cx, cy, k, cls) {
    const S = (t, a) => c.svg(t, a);
    const R = (x, y, w, h, r, kl) => S('rect', { x: f1(cx + x * k), y: f1(cy + y * k), width: f1(w * k), height: f1(h * k), rx: f1(r * k), class: kl });
    const D = (d, kl) => S('path', { d, class: kl });
    const X = (v) => f1(cx + v * k), Y = (v) => f1(cy + v * k);
    let kids;
    if (kind === 'phone') {
      kids = [R(-11, -20, 22, 40, 5, 'pd-dv-body'),
        S('circle', { cx: X(0), cy: Y(-16.5), r: f1(0.9 * k), class: 'pd-dv-hint' }),
        D(`M${X(-4)} ${Y(16.5)}H${X(4)}`, 'pd-dv-hint')];
    } else if (kind === 'laptop') { // a MacBook: notch, hairline menu bar, one window with three grey dots
      kids = [R(-24, -19, 48, 30, 3.5, 'pd-dv-body'),
        D(`M${X(-3.5)} ${Y(-19)}V${Y(-17.4)}H${X(3.5)}V${Y(-19)}`, 'pd-dv-hint'),
        D(`M${X(-22)} ${Y(-15.2)}H${X(22)}`, 'pd-dv-hint'),
        R(-12, -10, 20, 12, 1.6, 'pd-dv-win'),
        D(`M${X(-29)} ${Y(13)}H${X(29)}`, 'pd-dv-body pd-dv-base')];
    } else { // a thin-bezel monitor on a slim stand; Linux: a top panel and a tiny terminal
      const lin = kind === 'linux';
      kids = [R(-26, -20, 52, 32, 3, 'pd-dv-body'),
        D(`M${X(0)} ${Y(12)}V${Y(18)}M${X(-8)} ${Y(18.5)}H${X(8)}`, 'pd-dv-body'),
        lin ? D(`M${X(-24)} ${Y(-16.5)}H${X(24)}`, 'pd-dv-hint') : null,
        lin ? R(-13, -11, 18, 11, 1.4, 'pd-dv-win') : R(-11, -12, 20, 13, 1.6, 'pd-dv-win'),
        lin ? D(`M${X(-10.5)} ${Y(-7)}h4M${X(-10.5)} ${Y(-4)}h7`, 'pd-dv-hint')
          : D([-4.5, -2.25, 0, 2.25, 4.5].map((v) => `M${X(v)} ${Y(8.5)}h.01`).join(''), 'pd-dv-dots')];
    }
    return c.svg('g', { class: 'pd-dv ' + (cls || '') }, kids.filter(Boolean));
  }
  const pcKind = (os) => (os === 'mac' ? 'laptop' : os === 'linux' ? 'linux' : os === 'android' ? 'phone' : 'monitor');
  const myKind = (s) => (macPage(s) ? 'laptop' : pcKind(G.platform));

  // ========================================================================================
  // cursor — the monitor layout in hairlines, the contact edge, a pointer that crosses it
  // ========================================================================================
  {
    const MAC_SIDE = { left: 'right', right: 'left', top: 'bottom', bottom: 'top' };
    const ME0 = [{ id: 'me', x: 0, y: 0, w: 1600, h: 1000, primary: true }];
    const PH = [{ id: '?', x: 0, y: 0, w: 1600, h: 1000 }];
    const W = 340, H = 76;
    const bounds = (list) => (KG ? KG.bounds(list) : (() => {
      const x0 = Math.min(...list.map((d) => d.x)), y0 = Math.min(...list.map((d) => d.y));
      return { x: x0, y: y0, w: Math.max(...list.map((d) => d.x + d.w)) - x0, h: Math.max(...list.map((d) => d.y + d.h)) - y0 };
    })());
    const P = (x, y) => f1(x) + ' ' + f1(y);
    const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
    const cen = (r) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });
    let v = null;
    let geo = null;

    // Monitors (ours, theirs placed against our side), the contact stretches, the pointer's anchors.
    function layout(mine, theirs, known, side, along) {
      const vert = side === 'left' || side === 'right';
      const mb = bounds(mine), tb = bounds(theirs);
      let off = safe(() => KG && KG.placement(mine, theirs, { side, along }), null);
      if (!off) off = side === 'left' ? { x: mb.x - tb.w - tb.x, y: mb.y - tb.y } : side === 'top' ? { x: mb.x - tb.x, y: mb.y - tb.h - tb.y }
        : side === 'bottom' ? { x: mb.x - tb.x, y: mb.y + mb.h - tb.y } : { x: mb.x + mb.w - tb.x, y: mb.y - tb.y };
      const placed = theirs.map((t) => Object.assign({}, t, { x: t.x + off.x, y: t.y + off.y }));
      const all = bounds(mine.concat(placed));
      // Side by side: names on one baseline under the groups; stacked: names to the right of each.
      const pad = 4, labH = vert ? 13 : 0, labW = vert ? 0 : 96;
      const aw = W - 2 * pad - labW, ah = H - 2 * pad - labH;
      const sc = Math.min(aw / Math.max(1, all.w), ah / Math.max(1, all.h));
      const ox = pad - all.x * sc; // left-aligned: the strip's empty middle is the negative space
      const oy = pad + (ah - all.h * sc) / 2 - all.y * sc;
      const X = (x) => ox + x * sc, Y = (y) => oy + y * sc;
      const R = (m) => ({ id: m.id, x: X(m.x), y: Y(m.y), w: m.w * sc, h: m.h * sc, primary: !!m.primary });
      const rm = mine.map(R), rt = placed.map(R);
      const segs = [];
      let theirsAt = null;
      if (known) {
        const list = safe(() => (KG ? KG.contact(mine, theirs, { side, along }) : []), []);
        for (const c of list) {
          const d = mine.find((m) => m.id === c.mine.display);
          if (!d) continue;
          const at = side === 'right' ? d.x + d.w : side === 'left' ? d.x : side === 'bottom' ? d.y + d.h : d.y;
          segs.push(vert ? { x1: X(at), x2: X(at), y1: Y(c.mine.from), y2: Y(c.mine.to) } : { y1: Y(at), y2: Y(at), x1: X(c.mine.from), x2: X(c.mine.to) });
          if (!theirsAt) theirsAt = rt[theirs.findIndex((t) => t.id === c.theirs.display)] || null;
        }
      }
      if (!segs.length) { // the placeholder (or nothing touches): where the two groups face each other
        const a = R(mb), b = R(bounds(placed));
        if (vert) {
          const x = side === 'right' ? a.x + a.w : a.x;
          const y1 = Math.max(a.y, b.y), y2 = Math.min(a.y + a.h, b.y + b.h);
          if (y2 > y1) segs.push({ x1: x, x2: x, y1, y2, guess: true });
        } else {
          const y = side === 'bottom' ? a.y + a.h : a.y;
          const x1 = Math.max(a.x, b.x), x2 = Math.min(a.x + a.w, b.x + b.w);
          if (x2 > x1) segs.push({ x1, x2, y1: y, y2: y, guess: true });
        }
      }
      const prim = rm.find((m) => m.primary) || rm[0];
      const tgt = theirsAt || rt[0];
      const s0 = segs[0];
      const mid = s0 ? { x: (s0.x1 + s0.x2) / 2, y: (s0.y1 + s0.y2) / 2 } : { x: (cen(prim).x + cen(tgt).x) / 2, y: (cen(prim).y + cen(tgt).y) / 2 };
      const gb = (list) => { const b = bounds(list); return { x: X(b.x), y: Y(b.y), w: b.w * sc, h: b.h * sc }; };
      return { vert, side, rm, rt, segs, myC: cen(prim), thC: cen(tgt), tgt, mid, gMine: gb(mine), gTheirs: gb(placed) };
    }

    function draw(c, g, known, nm) {
      const rect = (r, i, cls) => c.svg('rect', { x: f1(r.x + 0.5), y: f1(r.y + 0.5), width: f1(Math.max(2, r.w - 1)), height: f1(Math.max(2, r.h - 1)), rx: 2.5, pathLength: 1, class: 'pd-mon ' + cls, css: { '--i': i } });
      v.gMine.replaceChildren(...g.rm.map((r, i) => rect(r, i, 'mine' + (r.primary ? ' primary' : ''))));
      v.gTheirs.replaceChildren(...g.rt.map((r, i) => rect(r, i + g.rm.length, 'theirs')));
      c.cls(v.gTheirs, 'placeholder', !known);
      const line = (sg, cls) => c.svg('line', { x1: f1(sg.x1), y1: f1(sg.y1), x2: f1(sg.x2), y2: f1(sg.y2), class: cls + (sg.guess ? ' guess' : '') });
      v.gMembrane.replaceChildren(...g.segs.map((sg) => line(sg, 'pd-membrane')));
      v.gTouch.replaceChildren(...g.segs.map((sg) => line(sg, 'pd-touch')));
      // Labels: one tiny mono line under each group.
      // Side by side: the left group's name starts at its left edge, the right one's ends at its right
      // edge, each clipped to half the drawing so they never meet.
      const x0 = Math.min(g.gMine.x, g.gTheirs.x), x1 = Math.max(g.gMine.x + g.gMine.w, g.gTheirs.x + g.gTheirs.w);
      const half = Math.max(8, Math.floor(((x1 - x0) / 2 - 6) / 5.5));
      const lab = (b, text, cls) => {
        const left = b.x <= x0 + 0.5;
        const t = g.vert
          ? c.svg('text', { x: f1(left ? b.x : b.x + b.w), y: H - 2, 'text-anchor': left ? 'start' : 'end', class: 'pd-lab ' + cls })
          : c.svg('text', { x: f1(b.x + b.w + 8), y: f1(b.y + b.h / 2 + 3), 'text-anchor': 'start', class: 'pd-lab ' + cls });
        t.textContent = clip(text, g.vert ? half : 15);
        return t;
      };
      v.gLab.replaceChildren(lab(g.gMine, nm.me, 'mine'), lab(g.gTheirs, nm.Name, 'theirs'));
    }

    FX.register('cursor', {
      mount(page, c) {
        c.accent('#ffb340', '#ff9500');
        const h = c.hdr({ cls: 'pd-hdr pd-cursor' });
        const svg = c.svgRoot(`0 0 ${W} ${H}`, 'pd-cur-svg', null, { width: W, height: H });
        v = { h };
        v.gTheirs = c.svg('g', { class: 'pd-cur-theirs' });
        v.gMine = c.svg('g', { class: 'pd-cur-mine' });
        v.gMembrane = c.svg('g', { class: 'pd-cur-membrane' });
        v.gTouch = c.svg('g', { class: 'pd-cur-touch' });
        v.gLab = c.svg('g', { class: 'pd-cur-labels' });
        svg.append(v.gTheirs, v.gMine, v.gMembrane, v.gTouch, v.gLab);
        v.ptr = c.el('div', 'pd-cur-ptr', [c.svgRoot('0 0 13 18', 'pd-arrow', [c.svg('path', { d: ARROW })])]);
        const stage = c.el('div', 'pd-cur-stage', [svg, v.ptr]);
        v.statusDot = c.el('i', 'pd-sdot');
        v.lock = c.icon('lock', 'pd-cur-lock'); // locked: the padlock takes the dot's place (never on the drawing)
        v.status = c.el('span', 'pd-status-t');
        const L = lead(c, 'right');
        v.big = L.big; v.cap = L.cap;
        h.append(stage, c.el('div', 'pd-cur-info', [c.el('div', 'pd-status', [v.statusDot, v.lock, v.status]), L.box]));
      },
      update(s, page, c) {
        if (!v) return;
        const k = s.kvm || {};
        const ks = kvmOf(s);
        const map = ks.map || {};
        const nm = names(s);
        const nop = noPeer(s);
        const raw = k.pcSide || ks.pcSide || null;
        const side = raw ? (macPage(s) ? raw : MAC_SIDE[raw] || 'right') : 'right';
        const mine = Array.isArray(map.mine) && map.mine.length ? map.mine : ME0;
        const known = !nop && Array.isArray(map.theirs) && map.theirs.length > 0;
        const theirs = known ? map.theirs : PH;
        const along = typeof map.along === 'number' ? map.along : safe(() => KG.centred(mine, theirs, side), 0);
        if (c.changed('geo', [mine, known && theirs, side, along, nm.me, nm.Name]) || !geo) {
          geo = layout(mine, theirs, known, side, along);
          draw(c, geo, known, nm);
        }
        const g = geo;
        const master = !!(k.mouse && (k.linked !== false) && !ks.paused);
        const mode = modeOf(ks);
        const st = nop ? 'nopeer' : ks.paused ? 'paused' : !master || ks.linked === false ? 'off' : ks.locked ? 'locked' : mode;
        c.attr(v.h, 'data-st', st);
        c.attr(v.h, 'data-mode', nop ? null : mode);
        c.attr(v.h, 'data-lock', !nop && ks.locked ? '1' : null);
        // The pointer walks a path in the strip's pixels (offset-path); --pd-rest is where it sits still.
        let motion = 'park', path, rest = 0;
        if (st === 'home' || st === 'driven') {
          const [a, b] = st === 'home' ? [g.myC, g.thC] : [g.thC, g.myC];
          path = 'M' + P(a.x, a.y) + ' L' + P(g.mid.x, g.mid.y) + ' L' + P(b.x, b.y);
          rest = Math.round((dist(a, g.mid) / Math.max(1, dist(a, g.mid) + dist(g.mid, b))) * 100);
          motion = 'glide';
        } else if (st === 'driving') {
          const t = g.tgt, cx = t.x + t.w / 2, cy = t.y + t.h / 2, rx = Math.max(4, t.w * 0.24), ry = Math.max(3, t.h * 0.22);
          path = `M${P(cx - rx, cy)} A${f1(rx)} ${f1(ry)} 0 1 1 ${P(cx + rx, cy)} A${f1(rx)} ${f1(ry)} 0 1 1 ${P(cx - rx, cy)}`;
          motion = 'wander';
        } else if (st === 'paused' || st === 'locked') {
          path = 'M' + P((mode === 'driving' ? g.thC : g.myC).x, (mode === 'driving' ? g.thC : g.myC).y) + ' L' + P(g.mid.x, g.mid.y);
          rest = 92;
          motion = 'bump';
        } else {
          path = 'M' + P(g.myC.x, g.myC.y) + ' L' + P(g.myC.x + 0.01, g.myC.y);
        }
        c.css(v.ptr, { 'offset-path': `path("${path}")`, '--pd-rest': rest + '%' });
        c.attr(v.h, 'data-motion', motion);
        // Edge resistance: a faint band under the contact line, resistancePx/400 × 4 px thick.
        const res = num(k.resistancePx) || 0;
        c.css(v.h, '--pd-membrane', f1(1.5 + (res / 400) * 4) + 'px');
        c.cls(v.h, 'has-res', res > 0);
        // Status line, the big numeral (pointer speed), the mono caption.
        const where = { home: tr('pfx_input.on_name', { name: nm.me }, 'On {name}'), driving: tr('pfx_input.on_name', { name: nm.name }, 'On {name}'), driven: tr('pfx_input.is_using', { Name: nm.Name, me: nm.me }, '{Name} is using {me}') };
        c.text(v.status, nop ? tr('overview.not_connected', null, 'Not connected') : st === 'paused' ? tr('pfx_input.paused_bluetooth', null, 'Paused · over Bluetooth') : st === 'off' ? tr('pfx_input.sharing_off', null, 'Sharing off') : ks.locked ? tr('pfx_input.edges_locked', { where: where[mode] }, 'Edges locked · {where}') : where[mode]);
        c.attr(v.statusDot, 'data-on', !nop && (st === 'home' || st === 'driving' || st === 'driven' || st === 'locked') ? '1' : null);
        c.text(v.big, (num(k.speed) || 1).toFixed(2) + '×');
        const rt = pcRtt(s);
        c.text(v.cap, [tr('pfx_input.speed', null, 'speed'), res ? tr('pfx_input.edge_px', { n: res }, 'edge {n} px') : tr('pfx_input.no_edge', null, 'no edge'), rt != null ? Math.round(rt) + ' ms' : null].filter(Boolean).join(' · '));

        // In the page: the crossing map's contact line takes the page accent (class only; it re-renders).
        const mapEl = page.querySelector('.kvm-map');
        const card = mapEl && mapEl.closest('.card');
        if (card && !card.classList.contains('pd-stage')) card.classList.add('pd-stage');
      },
    });
  }

  // ========================================================================================
  // keyboard — flat keycaps → a hairline → where the keys go
  // ========================================================================================
  {
    let v = null;
    let hotCode = 'AltRight';
    const NAMES = { AltRight: 'Right Alt', AltLeft: 'Left Alt', ControlRight: 'Right Ctrl', ControlLeft: 'Left Ctrl', MetaRight: 'Right Win', MetaLeft: 'Left Win', ShiftRight: 'Right Shift', ShiftLeft: 'Left Shift' };
    FX.register('keyboard', {
      mount(page, c) {
        c.accent('#e5e5ea', '#8e8e93'); // silver: on this page the accent is white
        const h = c.hdr({ cls: 'pd-hdr pd-keyboard' });
        v = { h, caps: {} };
        const cap = (key, label, cls, i) => {
          const k = c.el('span', 'pd-key ' + (cls || ''), label, { css: { '--i': i } });
          v.caps[key] = k;
          return k;
        };
        v.hot = cap('hot', '', 'hot', 0);
        v.swap = c.el('span', 'pd-kb-swap', [cap('cmd', '⌘', 'mod', 1), c.el('span', 'pd-kb-x', '⇄'), cap('ctrl', 'Ctrl', 'mod', 2)]);
        v.hint = c.el('div', 'pd-cap pd-kb-hint');
        const keys = c.el('div', 'pd-kb-keys', [c.el('div', 'pd-kb-row', [v.hot, v.swap]), v.hint]);
        v.dot = c.el('i', 'pd-kb-dot');
        const line = c.el('div', 'pd-kb-line', [v.dot, c.svgRoot('0 0 8 10', 'pd-kb-head', [c.svg('path', { d: 'M1.5 1.5 6 5l-4.5 3.5' })])]);
        const L = lead(c, 'right');
        v.big = L.big; v.cap = L.cap;
        h.append(keys, line, L.box);
        // Real keypress echo: the matching cap brightens for 180 ms. Read only — never stored, shown or
        // prevented; the shortcut recorder stops its own keys before they get here.
        document.addEventListener('keydown', (e) => {
          if (!c.active() || c.reduced || !v) return;
          const a = document.activeElement;
          if (a && (/^(INPUT|SELECT|TEXTAREA)$/.test(a.tagName) || a.isContentEditable)) return;
          const kc = e.code === hotCode ? v.caps.hot : e.key === 'Control' ? v.caps.ctrl : e.key === 'Meta' ? v.caps.cmd : null;
          if (kc) c.pop(kc, 'pd-lit', 180);
        });
      },
      update(s, page, c) {
        if (!v) return;
        const k = s.kvm || {};
        const ks = kvmOf(s);
        const keys = s.keys || {};
        const nm = names(s);
        const nop = noPeer(s);
        hotCode = keys.hotkey || 'AltRight';
        const hk = safe(() => UI.hotkeyName(s), '') || NAMES[hotCode] || hotCode;
        c.text(v.hot, hk);
        const mac = nm.os === 'mac';
        const cut = ks.linked === false || !!ks.paused;
        const st = nop ? 'nopeer' : !k.keyboard ? 'off' : cut ? 'cut' : 'on';
        c.attr(v.h, 'data-st', st);
        v.swap.hidden = !(mac && keys.swapCtrlCmd);
        const mode = modeOf(ks);
        const toPeer = mode === 'driving';
        c.attr(v.h, 'data-dest', toPeer ? 'peer' : 'me');
        c.text(v.big, nop ? tr('overview.not_connected', null, 'Not connected') : toPeer ? nm.name : nm.me);
        c.text(v.cap, nop ? tr('pfx_input.keyboard_stays_here', null, 'keyboard stays here') : st === 'off' ? tr('pfx_input.keyboard_off', null, 'keyboard off') : st === 'cut' ? tr('pfx_input.sharing_paused', null, 'sharing paused')
          : mode === 'driven' ? tr('pfx_input.typing_from', { name: nm.name }, 'typing from {name}') : toPeer ? tr('pfx_input.keys_go_to', null, 'keys go to') : tr('pfx_input.typing_here', null, 'typing here'));
        c.text(v.hint, k.mouse ? tr('pfx_input.follows_pointer', null, 'follows the pointer') : k.hotkeySwitch ? tr('pfx_input.double_tap_switch', { key: hk }, 'double-tap {key} to switch') : tr('pfx_input.double_tap', { key: hk }, 'double-tap {key}'));

        // In the page: the hotkey select reads as a keycap (font and bevel only).
        const sel = page.querySelector('.card.keep-on select');
        if (sel && !sel.classList.contains('pd-cap-sel')) sel.classList.add('pd-cap-sel');
      },
    });
  }

  // ========================================================================================
  // remote — a phone and a monitor; the finger on one, its pointer on the other
  // ========================================================================================
  {
    let v = null;
    let lastSt = '';
    // Phone screen and monitor screen (svg px): the finger's loop and its scaled echo.
    const ph = { x: 26, y: 14, w: 26, h: 50 }, mo = { x: 134, y: 12, w: 88, h: 50 };
    const LOOP = [[31, 52], [36, 22], [47, 56], [46, 26]];
    const toMon = ([x, y]) => [mo.x + ((x - ph.x) / ph.w) * mo.w, mo.y + ((y - ph.y) / ph.h) * mo.h];
    const loopPath = (pts) => { const p = pts.map(([x, y]) => f1(x) + ' ' + f1(y)); return `M${p[0]} C${p[1]} ${p[2]} ${p[3]} S${p[1]} ${p[0]}`; };
    FX.register('remote', {
      mount(page, c) {
        c.accent('#c58af0', '#8944ab'); // orchid, softened
        const h = c.hdr({ cls: 'pd-hdr pd-remote' });
        v = { h };
        const S = (t, a, k) => c.svg(t, a, k);
        const phone = S('g', { class: 'pd-rm-phone' }, [
          S('rect', { class: 'pd-dv-body', x: 22, y: 6, width: 34, height: 66, rx: 7 }),
          S('circle', { class: 'pd-dv-hint', cx: 39, cy: 10, r: 1 }),
          S('path', { class: 'pd-dv-hint', d: 'M34 68h10' }),
          // the gamepad face: a D-pad and four buttons, one lit at a time while a real pad is live
          S('g', { class: 'pd-rm-padface' }, [
            S('path', { class: 'pd-dv-hint', d: 'M27.5 37h3v-3h3v3h3v3h-3v3h-3v-3h-3z' }),
            ...[[46, 33.5], [49.5, 37], [46, 40.5], [42.5, 37]].map(([x, y], i) => S('circle', { class: 'pd-rm-btn', cx: x, cy: y, r: 1.6, css: { '--k': i } })),
          ]),
          S('circle', { class: 'pd-rm-spin', cx: 39, cy: 39, r: 7, pathLength: 1 }),
        ]);
        const monitor = S('g', { class: 'pd-rm-mon' }, [
          S('rect', { class: 'pd-dv-body', x: 130, y: 8, width: 96, height: 58, rx: 4 }),
          S('path', { class: 'pd-dv-body', d: 'M178 66v8M168 74.5h20' }),
          S('path', { class: 'pd-dv-dots', d: [-6, -3, 0, 3, 6].map((d) => `M${178 + d} 60h.01`).join('') }),
        ]);
        v.link = S('path', { class: 'pd-rm-link', d: 'M62 39 H124' });
        v.padName = S('text', { class: 'pd-rm-padname', x: 178, y: 41, 'text-anchor': 'middle' });
        const svg = c.svgRoot('0 0 240 80', 'pd-rm-svg', [v.link, phone, monitor, v.padName], { width: 240, height: 80 });
        v.finger = c.el('i', 'pd-rm-finger');
        v.ptr = c.el('i', 'pd-rm-ptr', [c.svgRoot('0 0 13 18', 'pd-arrow', [c.svg('path', { d: ARROW })])]);
        const stage = c.el('div', 'pd-rm-stage', [svg, v.finger, v.ptr]);
        c.css(v.finger, 'offset-path', `path("${loopPath(LOOP)}")`);
        c.css(v.ptr, 'offset-path', `path("${loopPath(LOOP.map(toMon))}")`);
        const L = lead(c);
        v.big = L.big; v.cap = L.cap;
        v.pad = c.el('div', 'pd-rm-pad');
        v.warn = c.el('div', 'pd-rm-warn');
        h.append(c.el('div', 'pd-rm-text', [L.box, v.warn]), stage, v.pad);
      },
      update(s, page, c) {
        if (!v) return;
        const r = s.remote || {};
        const pad = r.pad || {};
        const nm = names(s);
        const live = !!(pad.on && pad.live);
        const st = !s.remote || !r.allow ? 'off' : r.why ? 'blocked' : r.using ? 'using' : r.opened ? 'open' : 'ready';
        c.attr(v.h, 'data-st', st);
        c.attr(v.h, 'data-face', live ? 'pad' : 'touch');
        c.attr(v.h, 'data-busy', pad.busy ? '1' : null);
        // `using` drops 3 s after the last touch: the motion fades out over 600 ms rather than snapping.
        if (lastSt === 'using' && st !== 'using') { c.attr(v.h, 'data-fade', '1'); c.after(600, () => c.attr(v.h, 'data-fade', null)); }
        else if (st === 'using') c.attr(v.h, 'data-fade', null);
        lastSt = st;
        const big = { off: tr('general.off', null, 'Off'), blocked: tr('pfx_input.unavailable', null, 'Unavailable'), using: tr('meshm_overview.in_use', null, 'In use'), open: tr('files.open', null, 'Open'), ready: tr('terminal.ready', null, 'Ready') }[st];
        c.text(v.big, pad.busy ? tr('files.setting_up', null, 'Setting up…') : live ? tr('remote.gamepad_card', null, 'Gamepad') : big);
        c.text(v.cap, !s.remote ? tr('pfx_input.not_available_here', null, 'not available here') : live ? tr('pfx_input.as_controller', { name: nm.name }, '{name} as a controller')
          : st === 'ready' ? tr('pfx_input.open_remote_on', { name: nm.name }, 'open remote on {name}') : tr('pfx_input.as_remote', { name: nm.name }, '{name} as a remote'));
        c.text(v.warn, r.allow && r.why ? clip(r.why, 60) : '');
        v.warn.hidden = !(r.allow && r.why);
        c.text(v.pad, pad.busy ? clip(pad.busy, 28) : pad.supported === false ? tr('pfx_input.gamepad_not_here', null, 'gamepad · not here') : !pad.on ? tr('pfx_input.gamepad_off', null, 'gamepad · off') : live ? tr('pfx_input.gamepad_live', null, 'gamepad · live') : tr('pfx_input.gamepad_ready', null, 'gamepad · ready'));
        c.attr(v.pad, 'data-on', live ? '1' : null);
        c.text(v.padName, clip(pad.name || tr('pfx_input.controller', null, 'Controller'), 15));

        // In the page: the Now row gets one live dot; the gamepad card dims where there's no gamepad.
        const wraps = page.querySelectorAll(':scope > .page-body > .card-wrap');
        const first = wraps[0], last = wraps[wraps.length - 1];
        const row = first && first.querySelector('.card > .row');
        if (row) {
          if (!row.classList.contains('pd-live')) row.classList.add('pd-live', 'pg-fx');
          c.attr(row, 'data-live', st === 'using' ? 'using' : st === 'open' ? 'open' : 'idle');
        }
        if (last && last !== first) {
          if (!last.classList.contains('pd-pad')) last.classList.add('pd-pad');
          c.attr(last, 'data-sup', pad.supported === false ? '0' : null);
        }
      },
    });
  }

  // ========================================================================================
  // terminal — the two-way shell window
  // ========================================================================================
  {
    let v = null;
    const span = (c, cls, t) => c.el('span', cls, t);
    // A typed line: `$ <cmd>` typed in by CSS steps (--n chars), then the reply fades in after it.
    function typed(c, cmd, reply, caret) {
      const n = Math.max(1, cmd.length);
      const t = span(c, 'pd-typed', cmd);
      const line = c.el('div', 'pd-line pd-cmdline', [span(c, 'pd-ps', '$ '), t, caret ? span(c, 'pd-caret') : null], { css: { '--n': n } });
      const out = reply ? c.el('div', 'pd-line pd-reply', reply, { css: { '--n': n } }) : null;
      return out ? [line, out] : [line];
    }
    const msgShort = (m, n) => clip(String(m || '').replace(/\s+/g, ' '), n || 46);
    // Mac terminal (t.connectPc / t.toPc / t.allowPc / t.remoteLogin) → the same words as Windows/Linux.
    function norm(t) {
      const o = t.toPc || {};
      const enabled = t.enabled != null ? !!t.enabled : !!t.connectPc;
      const status = t.status || (!enabled ? 'off' : o.ready ? 'ready' : o.why === 'waiting' ? 'waiting' : o.why ? 'unavailable' : 'no_mac');
      const srv = t.server || {};
      const allowIn = t.allowMac != null ? !!t.allowMac : !!t.allowPc;
      const service = srv.service || (t.remoteLogin ? 'running' : t.remoteLogin === false ? 'stopped' : t.installed ? 'running' : 'unknown');
      return { enabled, status, user: t.user || o.user || '', message: t.message || (o.why && o.why !== 'waiting' ? o.why : ''), command: t.command || 'ssh duodesk',
        allowIn, service, busy: !!srv.busy, srvMsg: srv.message || '', peerCan: !!(srv.info && srv.info.enabled) };
    }
    FX.register('terminal', {
      mount(page, c) {
        c.accent('#7af0be', '#1c1c1e'); // a soft phosphor mint, on the caret only
        const h = c.hdr({ cls: 'pd-hdr pd-terminal', place: 'before-body' }); // never inside the body (inert over Bluetooth)
        v = { h };
        v.title = span(c, 'pd-term-title');
        v.rtt = span(c, 'pd-term-rtt');
        const bar = c.el('div', 'pd-term-bar', [span(c, 'pd-tdot'), span(c, 'pd-tdot'), span(c, 'pd-tdot'), v.title, span(c, 'pg-spacer'), v.rtt]);
        v.outHead = span(c, 'pd-lane-h');
        v.inHead = span(c, 'pd-lane-h');
        v.out = c.el('div', 'pd-lane-body');
        v.in = c.el('div', 'pd-lane-body');
        const lanes = c.el('div', 'pd-term-lanes', [
          c.el('div', 'pd-lane pd-lane-in', [v.inHead, v.in]),
          c.el('div', 'pd-lane pd-lane-out', [v.outHead, v.out]),
        ]);
        h.append(c.el('div', 'pd-term-win', [bar, lanes]));
      },
      update(s, page, c) {
        if (!v) return;
        const raw = s.terminal || {};
        const t = norm(raw);
        const nm = names(s);
        // The lanes follow the cards below: Windows / Linux put "into here" first, the Mac "out to the PC" first.
        c.cls(v.h, 'pd-out-first', raw.connectPc !== undefined || macPage(s));
        const nop = noPeer(s);
        const ble = !!(s.net && s.net.transport === 'ble') || safe(() => UI.onBle && UI.onBle(s), false);
        const st = nop ? 'nopeer' : ble ? 'ble' : !t.enabled && !t.allowIn ? 'off' : 'on';
        c.attr(v.h, 'data-st', st);
        c.attr(v.h, 'data-out', t.status);
        c.attr(v.h, 'data-in', t.allowIn ? (t.busy ? 'busy' : t.service) : 'off');
        c.text(v.title, clip(nm.me, 24) + ' — ' + clip(nm.name, 24));
        const rt = pcRtt(s);
        c.text(v.rtt, rt != null ? Math.round(rt) + ' ms' : '');
        c.text(v.outHead, tr('pfx_input.to_name', { name: clip(nm.name, 24) }, 'to {name}'));
        c.text(v.inHead, tr('pfx_input.from_name', { name: clip(nm.name, 24) }, 'from {name}'));
        const comment = (txt, cls) => [c.el('div', 'pd-line pd-comment ' + (cls || ''), [span(c, null, txt), span(c, 'pd-caret')])];
        // Here → there: typed again only when what it says changes (not on every push).
        if (c.changed('out', [st, t.status, t.user, nm.name, t.command, t.message])) {
          let lines;
          if (st === 'nopeer') lines = comment(tr('pfx_input.hash_no_connection', null, '# no connection'));
          else if (st === 'ble') lines = comment(tr('pfx_input.hash_needs_wifi', null, '# needs Wi-Fi'), 'warn');
          else if (t.status === 'off' || !t.enabled) lines = comment(tr('pfx_input.hash_off', null, '# off'));
          else {
            const R = {
              ready: [span(c, null, tr('pfx_input.connected_as', null, 'connected as') + ' '), span(c, 'pd-strong', (t.user || tr('pfx_input.you', null, 'you')) + '@' + clip(nm.name, 20))],
              waiting: [span(c, null, tr('pfx_input.asking_name', { name: clip(nm.name, 22) }, 'asking {name}')), span(c, 'pd-ell', [c.el('i', null, '.'), c.el('i', null, '.'), c.el('i', null, '.')])],
              no_mac: [span(c, 'pd-dim', tr('pfx_input.waiting_for_name', { name: clip(nm.name, 22) }, 'waiting for {name}'))],
            };
            const reply = R[t.status] || [span(c, 'pd-bad', '✗ ' + msgShort(t.message || (t.status === 'unavailable' ? tr('pfx_input.not_available_on', { name: nm.name }, 'not available on {name}') : tr('pfx_input.problem', null, 'problem'))))];
            lines = typed(c, t.command, reply, true);
          }
          v.out.replaceChildren(...lines);
        }
        // There → here: the SSH server.
        if (c.changed('in', [st, t.allowIn, t.service, t.busy, t.peerCan, nm.name, t.srvMsg])) {
          let lines;
          if (st === 'nopeer') lines = comment(tr('pfx_input.hash_no_connection', null, '# no connection'));
          else if (st === 'ble') lines = comment(tr('pfx_input.hash_needs_wifi', null, '# needs Wi-Fi'), 'warn');
          else if (!t.allowIn) lines = comment(tr('pfx_input.hash_off', null, '# off'));
          else {
            const reply = t.busy ? [span(c, 'pd-dim', tr('pfx_input.setting_up', null, 'setting up…'))]
              : t.service === 'running' ? [span(c, 'pd-strong', tr('pfx_input.listening', null, 'listening :22'))]
                : t.service === 'missing' ? [span(c, 'pd-bad', tr('pfx_input.x_not_installed', null, '✗ not installed'))]
                  : t.service === 'stopped' ? [span(c, 'pd-bad', tr('pfx_input.x_stopped', null, '✗ stopped'))] : [span(c, 'pd-dim', msgShort(t.srvMsg, 30) || tr('pfx_input.checking', null, 'checking…'))];
            lines = typed(c, 'sshd', reply, false);
            if (t.peerCan) lines.push(c.el('div', 'pd-line pd-reply pd-late', [span(c, 'pd-dim', '↳ '), span(c, null, tr('pfx_input.can_connect', { name: clip(nm.name, 22) }, '{name} can connect'))], { css: { '--n': 4 } }));
          }
          v.in.replaceChildren(...lines);
        }

        // In the page: the command reads as a prompt.
        const code = page.querySelector('.dir-card code.mono');
        if (code && !code.classList.contains('pd-cmd')) code.classList.add('pd-cmd');
      },
    });
  }

  // ========================================================================================
  // rezume — two devices, a hairline arc, the chip that rides it
  // ========================================================================================
  {
    let v = null;
    const W = 440, H = 84;
    const ME = { x: 44, y: 52 }, PEER = { x: 396, y: 52 };
    const ARC_IN = 'M384 32 Q220 2 56 32';  // peer → me (what comes here)
    const ARC_OUT = 'M56 32 Q220 2 384 32'; // me → peer (what this one offers)
    const hostOf = (u) => { try { return new URL(u).host.replace(/^www\./, ''); } catch (_) { return ''; } };
    const kindOf = (i) => (i.kind === 'web' || i.url ? 'web' : i.kind === 'doc' ? 'doc' : 'app');
    const GLYPH = {
      web: 'M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18zM3 12h18M12 3c2.5 2.6 3.6 5.6 3.6 9s-1.1 6.4-3.6 9c-2.5-2.6-3.6-5.6-3.6-9S9.5 5.6 12 3z',
      doc: 'M7 3h7l5 5v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM14 3v5h5',
      app: 'M5 5h14v14H5zM5 9h14',
    };
    FX.register('rezume', {
      mount(page, c) {
        c.accent('#8fdcff', '#0a84ff'); // sky, softened
        const h = c.hdr({ cls: 'pd-hdr pd-rezume' });
        v = { h };
        v.devMe = c.svg('g');
        v.devPeer = c.svg('g');
        v.arc = c.svg('path', { class: 'pd-rz-arc', d: ARC_IN, pathLength: 1 });
        const head = (x, y, dx) => c.svg('path', { class: 'pd-rz-head ' + (dx > 0 ? 'in' : 'out'), d: `M${x} ${y}l${dx * 5} -3.2M${x} ${y}l${dx * 3.2} 4.6` });
        v.headIn = head(58, 32.5, 1);   // ← arrives here
        v.headOut = head(382, 32.5, -1); // → goes there
        v.gate = c.svg('path', { class: 'pd-rz-gate', d: 'M370 24v16' });
        const svg = c.svgRoot(`0 0 ${W} ${H}`, 'pd-rz-svg', [v.arc, v.headIn, v.headOut, v.gate, v.devMe, v.devPeer], { width: W, height: H });
        v.glyph = c.svg('path');
        v.ttl = c.el('span', 'pd-rz-ttl');
        v.chip = c.el('div', 'pd-rz-chip', [c.svgRoot('0 0 24 24', 'pd-rz-glyph', [v.glyph]), v.ttl]);
        v.spark = c.el('i', 'pd-rz-spark');
        v.meLab = c.el('span', 'pd-rz-lab me');
        v.peerLab = c.el('span', 'pd-rz-lab peer');
        v.badge = c.el('span', 'pd-rz-badge');
        const L = lead(c, 'center');
        v.big = L.big; v.cap = L.cap;
        const stage = c.el('div', 'pd-rz-stage', [svg, v.spark, v.chip, v.meLab, v.peerLab, v.badge, L.box]);
        c.css(v.spark, 'offset-path', `path("${ARC_IN}")`);
        h.append(stage);
      },
      update(s, page, c) {
        if (!v) return;
        const z = s.rezume || {};
        const nm = names(s);
        const conn = !!z.connected && !noPeer(s);
        const inc = z.on && z.receive !== false && z.incoming ? z.incoming : null;
        const out = z.on && z.out ? z.out : null;
        const st = !conn ? 'nopeer' : !z.on ? 'off' : z.peerKnows === false ? 'missing' : z.peerOn === false ? 'peeroff' : inc ? 'offer' : out ? 'sending' : z.waiting ? 'waiting' : 'ready';
        c.attr(v.h, 'data-st', st);
        c.attr(v.h, 'data-dir-in', z.receive === false ? '0' : '1');
        c.attr(v.h, 'data-dir-out', z.send === false ? '0' : '1');
        const peerKind = z.phone ? 'phone' : pcKind(nm.os);
        if (c.changed('devs', [peerKind, myKind(s)])) {
          v.devMe.replaceChildren(device(c, myKind(s), ME.x, ME.y, 1, 'me'));
          v.devPeer.replaceChildren(device(c, peerKind, PEER.x, PEER.y, 1, 'peer'));
        }
        c.text(v.meLab, clip(nm.me, 16));
        c.text(v.peerLab, clip(nm.name, 16));
        v.badge.hidden = st !== 'missing';
        c.text(v.badge, tr('pfx_input.badge_update', null, 'update'));
        // The chip: incoming (rides in and rests near here), going out (rides away), waiting, or the
        // last thing here (resting on this side, dim).
        const lastItem = !inc && !out && !z.waiting && (st === 'ready') ? z.last : null;
        const item = inc || out || (z.waiting ? { title: tr('pfx_input.getting_what', { what: z.waiting }, 'Getting {what}…') } : null) || lastItem;
        v.chip.hidden = !item;
        const pos = inc ? 'in' : out ? 'out' : z.waiting ? 'wait' : 'last';
        c.attr(v.chip, 'data-pos', item ? pos : null);
        c.attr(v.h, 'data-chip', item ? pos : null); // the idle spark rides only an empty arc
        c.css(v.chip, 'offset-path', `path("${pos === 'out' ? ARC_OUT : ARC_IN}")`);
        if (item) {
          const kind = kindOf(item);
          c.attr(v.chip, 'data-kind', kind);
          if (c.changed('glyph', kind)) c.attr(v.glyph, 'd', GLYPH[kind]);
          c.text(v.ttl, clip(item.title || item.name || item.appName || tr('pfx_input.untitled', null, 'Untitled'), 26));
          if (c.changed('chip', [pos, item.id || item.title]) && (pos === 'in' || pos === 'out')) c.pop(v.chip, 'pd-arrive', 1400);
        }
        const sub = inc ? (kindOf(inc) === 'web' ? hostOf(inc.url) || inc.appName || tr('pfx_input.page', null, 'page') : kindOf(inc) === 'doc' ? inc.appName || tr('pfx_input.document', null, 'document') : inc.appName || inc.app || tr('pfx_input.app', null, 'app')) : '';
        const words = {
          nopeer: [tr('overview.not_connected', null, 'Not connected'), tr('pfx_input.connect_pc_or_phone', null, 'connect a computer or phone')],
          off: [tr('pfx_input.rezume_off', null, 'ReZume is off'), tr('pfx_input.turn_on_carry_on', null, 'turn it on to carry on elsewhere')],
          missing: [tr('pfx_input.update_name', { name: clip(nm.name, 20) }, 'Update {name}'), tr('pfx_input.no_rezume_there', null, 'no rezume there yet')],
          peeroff: [tr('pfx_input.off_on_name', { name: clip(nm.name, 20) }, 'Off on {name}'), tr('pfx_input.turn_on_there_too', null, 'turn it on there too')],
          offer: [tr('pfx_input.from_name_cap', { name: clip(nm.name, 22) }, 'From {name}'), sub],
          sending: [tr('pfx_input.offered', null, 'Offered'), tr('pfx_input.to_name', { name: clip(nm.name, 30) }, 'to {name}')],
          waiting: [tr('pfx_input.getting_it', null, 'Getting it…'), tr('pfx_input.from_name', { name: clip(nm.name, 22) }, 'from {name}')],
          ready: [tr('terminal.ready', null, 'Ready'), z.last ? tr('pfx_input.ready_to_send', null, 'ready to send') : tr('pfx_input.nothing_handed_over', null, 'nothing handed over yet')],
        }[st];
        c.text(v.big, words[0]);
        c.text(v.cap, words[1]);

        // In the page (scoped: UI.rezumeCard also sits on the Apps tab and the Phone page).
        const icon = page.querySelector(':scope > .page-body .rezume-icon');
        const offer = icon && icon.closest('.card-wrap');
        if (offer) {
          const shown = !offer.hidden;
          c.cls(offer, 'pd-offer', shown);
          if (shown && c.changed('offerKey', inc && [inc.id, inc.icon ? inc.icon.length : 0])) c.pop(icon, 'pd-bounce', 700);
        }
      },
    });
  }
})();
