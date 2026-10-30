// DuoDesk — Aurora scenes: clipboard, files, pfiles, mount. Based on TwinDesk — Copyright (C) 2026 inukaasith.
// GPL-3.0, see LICENSE.
// The introduction pictures of the copy-and-files features, drawn with the Aurora kit (shared/art/kit.js). Each sets
// window.AuroraArt[<scene>] = (id, K) => the inner markup of a 400 x 240 picture (shared/feature-art.js puts
// K.defs(id) in its <defs> first). CSP-safe: SVG strings only, no style="" attributes, no scripts in the SVG; every
// motion is SMIL, so a reduced-motion picture (feature-art.js pauses it) holds one still frame. All minimal: hairline
// monochrome, one accent (the thing that moves), one slow gesture per round.
//   clipboard  two lines selected here lift off as one small card outlined in the feature's colour, float over the
//              gap and settle into the other device as new lines (a new message on a phone)
//   files      the two screens close up, the seam between them: a picture dragged out of a window here, over the
//              edge, into a folder there
//   pfiles     the phone and its storage in a window here, side by side: one file glides across, level, and comes
//              in as a new row
//   mount      this computer's file manager close up, the phone beside it: the phone's switch goes on and a second
//              drive, Phone, draws itself in next to the computer's own
(function () {
  'use strict';
  if (typeof window === 'undefined') return;
  const ART = (window.AuroraArt = window.AuroraArt || {});

  const UI = 'Geist, system-ui, Segoe UI, sans-serif';
  const MONO = 'Geist Mono, ui-monospace, Consolas, monospace';
  const INK = '#f1f1f3';
  const REP = 'repeatCount="indefinite"';
  const f = (v) => Math.round(v * 100) / 100;
  const t4 = (v) => Math.round(Math.max(0, Math.min(1, v)) * 10000) / 10000;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

  const rect = (x, y, w, h, rx, attrs = '', inner = '') => `<rect x="${f(x)}" y="${f(y)}" width="${f(Math.max(0, w))}" height="${f(Math.max(0, h))}"${rx ? ` rx="${f(rx)}"` : ''} ${attrs}${inner ? `>${inner}</rect>` : '/>'}`;
  const circ = (cx, cy, r, attrs = '') => `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(r)}" ${attrs}/>`;
  const ell = (cx, cy, rx, ry, attrs = '', inner = '') => `<ellipse cx="${f(cx)}" cy="${f(cy)}" rx="${f(rx)}" ry="${f(ry)}" ${attrs}${inner ? `>${inner}</ellipse>` : '/>'}`;
  const bar = (x, y, w, t, c = INK, op = 0.4) => rect(x, y, w, t, t / 2, `fill="${c}" fill-opacity="${op}"`);
  function text(x, y, s, size, o = {}) {
    return `<text x="${f(x)}" y="${f(y)}" font-family="${o.mono ? MONO : UI}" font-size="${f(size)}"${o.weight ? ` font-weight="${o.weight}"` : ''}`
      + ` fill="${o.fill || INK}"${o.op != null ? ` fill-opacity="${o.op}"` : ''}${o.anchor ? ` text-anchor="${o.anchor}"` : ''}`
      + `${o.ls ? ` letter-spacing="${o.ls}"` : ''}>${esc(s)}</text>`;
  }

  // ---- timing: key frames [[t 0..1, value], …] over a round of D seconds ----
  function frames(list) {
    const l = list.map(([t, v]) => [t4(t), v]);
    if (l[0][0] > 0) l.unshift([0, l[0][1]]);
    if (l[l.length - 1][0] < 1) l.push([1, l[l.length - 1][1]]);
    for (let i = 1; i < l.length; i++) if (l[i][0] < l[i - 1][0]) l[i][0] = l[i - 1][0];
    return { v: l.map((p) => p[1]).join(';'), t: l.map((p) => p[0]).join(';'), n: l.length };
  }
  const EASE = '0.45 0 0.2 1';
  const calc = (smooth, n) => (smooth ? ` calcMode="spline" keySplines="${Array(n - 1).fill(EASE).join(';')}"` : ' calcMode="linear"');
  const beginAt = (b) => (b ? ` begin="${f(b)}s"` : '');
  // An attribute through key frames (smooth: eased between them).
  const anim = (D, attr, list, smooth = true, begin = 0) => {
    const k = frames(list);
    return `<animate attributeName="${attr}" dur="${D}s" ${REP}${beginAt(begin)} values="${k.v}" keyTimes="${k.t}"${calc(smooth, k.n)}/>`;
  };
  const op = (D, list, smooth = false, begin = 0) => anim(D, 'opacity', list, smooth, begin);
  // Shown from a until b (parts of the round), fading over e.
  const during = (D, a, b, e = 0.025, begin = 0) => op(D, [[0, 0], [a, 0], [a + e, 1], [b - e, 1], [b, 0], [1, 0]], false, begin);
  const tf = (D, type, list, smooth = true, begin = 0) => {
    const k = frames(list);
    return `<animateTransform attributeName="transform" type="${type}" dur="${D}s" ${REP}${beginAt(begin)} values="${k.v}" keyTimes="${k.t}"${calc(smooth, k.n)}/>`;
  };
  // Along a path, [[t, 0..1 of the path], …].
  const along = (D, d, list, smooth = true, begin = 0) => {
    const k = frames(list);
    return `<animateMotion dur="${D}s" ${REP}${beginAt(begin)} path="${d}" keyPoints="${k.v}" keyTimes="${k.t}"${calc(smooth, k.n)}/>`;
  };
  const kindOf = (os) => ({ win: 'winPc', mac: 'macBook', linux: 'linuxPc', android: 'phone', tablet: 'tablet' }[os] || 'laptop');

  // ======================================================================================================
  // Clipboard: the two devices on one floor line, a wide gap between them. Two lines of a note are selected
  // here; what was copied lifts off as one small card outlined in the feature's colour (the one accent), floats
  // over the gap and settles into the other device as a new line (a new message on a phone). A long rest, then
  // it all clears. One faint light travels under the card.
  ART.clipboard = (id, K) => {
    const D = 7.5;
    const { me, peer } = K.os();
    const big = (os) => os === 'win' || os === 'mac' || os === 'linux';
    const meOs = big(me) ? me : 'win';
    const AS = { win: 1.27, mac: 1.57, linux: 1.48, tablet: 1.45, android: 0.5 };
    const WD = { win: 136, mac: 154, linux: 146 };
    const winOs = (os) => (os === 'win' || os === 'linux' || os === 'mac' ? os : 'plain');
    let rOs = peer;
    let rw;
    if (big(peer)) rw = WD[peer];
    else if (peer === 'tablet') rw = 146;
    else { rOs = 'android'; rw = 56; }
    const floor = 186;
    const gap = big(rOs) ? 64 : 84;
    const lw = WD[meOs];
    const lh = lw / AS[meOs];
    const rh = rw / AS[rOs];
    const x0 = 200 - (lw + gap + rw) / 2;
    const Lb = [x0, floor - lh, lw, lh];
    const Rb = [x0 + lw + gap, floor - rh, rw, rh];
    const tOf = (h) => Math.max(0.6, Math.min(2.6, h * 0.07));

    // This screen: a note, its 2nd and 3rd lines selected (a quiet white sweep).
    const la = K.screen(kindOf(meOs), ...Lb);
    const lwin = [la.x + la.w * 0.15, la.y + la.h * 0.14, la.w * 0.7, la.h * 0.72];
    let sel = { x: 0, y: 0 };
    const lContent = K.window(...lwin, {
      os: winOs(meOs),
      body: (b) => {
        const t = tOf(b.h);
        const y = (i) => b.y + t * (0.4 + i * 2.6);
        let s = bar(b.x, y(0), b.w * 0.42, t, INK, 0.22) + bar(b.x, y(1), b.w * 0.86, t, INK, 0.12)
          + bar(b.x, y(2), b.w * 0.7, t, INK, 0.12) + bar(b.x, y(3), b.w * 0.5, t, INK, 0.1);
        const sx = b.x - 1;
        const sy = y(1) - t * 0.8;
        const sw = b.w * 0.86 + 2;
        const sh = y(2) - y(1) + t * 2.6;
        s += `<rect x="${f(sx)}" y="${f(sy)}" width="0" height="${f(sh)}" rx="1" fill="#fff" fill-opacity="0.1" opacity="0">`
          + anim(D, 'width', [[0.08, 0], [0.2, sw]]) + during(D, 0.08, 0.9, 0.02) + '</rect>';
        sel = { x: sx + sw * 0.5, y: sy + sh / 2 };
        return s;
      },
    });

    // The other screen: a note with an empty line where it lands (a chat on a phone, a new message there).
    const ra = K.screen(kindOf(rOs), ...Rb);
    let dst = { x: 0, y: 0 };
    let landed = '';
    let rContent;
    if (rOs === 'android') {
      const x = ra.x + ra.w * 0.1;
      const w = ra.w * 0.8;
      const bh = Math.max(4, ra.h * 0.075);
      rContent = rect(x, ra.y + ra.h * 0.1, w * 0.62, bh, bh / 2, 'fill="#fff" fill-opacity="0.06"')
        + rect(x + w * 0.3, ra.y + ra.h * 0.1 + bh * 1.6, w * 0.7, bh, bh / 2, 'fill="#fff" fill-opacity="0.12"')
        + rect(x, ra.y + ra.h * 0.88, w, bh, bh / 2, 'fill="none" stroke="#fff" stroke-opacity="0.12" stroke-width="0.55"');
      const by = ra.y + ra.h * 0.1 + bh * 3.4;
      const bw = w * 0.78;
      landed = `<g opacity="0">${during(D, 0.63, 0.94, 0.03)}<g>${tf(D, 'translate', [[0.63, '0 3'], [0.7, '0 0']])}`
        + rect(x + w - bw, by, bw, bh * 1.8, bh * 0.6, `fill="${K.C.glass}" class="ka-st1" stroke-width="0.7" stroke-opacity="0.85"`)
        + bar(x + w - bw + bh * 0.5, by + bh * 0.45, bw * 0.6, Math.max(0.6, bh * 0.22), INK, 0.5)
        + bar(x + w - bw + bh * 0.5, by + bh * 1.05, bw * 0.38, Math.max(0.6, bh * 0.22), INK, 0.25) + '</g></g>';
      dst = { x: x + w - bw / 2, y: by + bh * 0.9 };
    } else {
      const rwin = [ra.x + ra.w * 0.15, ra.y + ra.h * 0.14, ra.w * 0.7, ra.h * 0.72];
      rContent = K.window(...rwin, {
        os: winOs(rOs),
        body: (b) => {
          const t = tOf(b.h);
          const y = (i) => b.y + t * (0.4 + i * 2.6);
          const s = bar(b.x, y(0), b.w * 0.42, t, INK, 0.22) + bar(b.x, y(1), b.w * 0.6, t, INK, 0.1);
          // The pasted lines: drawn on from the left as the card settles.
          landed = [[2, 0.86, 0.3], [3, 0.7, 0.3]].map(([i, w, o], j) => `<rect x="${f(b.x)}" y="${f(y(i))}" width="0" height="${f(t)}" rx="${f(t / 2)}" fill="#fff" fill-opacity="${o}" opacity="0">`
            + anim(D, 'width', [[0.63 + j * 0.03, 0], [0.72 + j * 0.03, b.w * w]]) + during(D, 0.63, 0.95, 0.03) + '</rect>').join('');
          dst = { x: b.x + b.w * 0.42, y: y(2.5) };
          return s;
        },
      });
    }

    let out = `<rect x="24" y="${floor + 0.2}" width="352" height="0.6" fill="${K.ref('edge')}" opacity="0.3"/>`;
    out += K.computer(meOs, ...Lb, { content: lContent }) + K.computer(rOs, ...Rb, { content: rContent }) + landed;

    // The copied card: lifts off the selection, floats over the gap on a high arc, settles into the line there.
    const qd = `M${f(sel.x)} ${f(sel.y)}Q${f((sel.x + dst.x) / 2)} ${f(Math.min(sel.y, dst.y) - 92)} ${f(dst.x)} ${f(dst.y)}`;
    const route = along(D, qd, [[0, 0], [0.26, 0], [0.62, 1], [1, 1]]);
    out += `<g opacity="0">${op(D, [[0.24, 0], [0.32, 1], [0.56, 1], [0.66, 0]], true)}${route}`
      + `<circle r="28" fill="${K.ref('r-f1')}" opacity="0.6"/></g>`;
    out += `<g opacity="0">${op(D, [[0.21, 0], [0.25, 1], [0.6, 1], [0.66, 0]], true)}${route}`
      + `<g>${tf(D, 'translate', [[0.21, '0 0'], [0.26, '0 -5'], [0.6, '0 -2'], [0.66, '0 0']])}`
      + `<g>${tf(D, 'scale', [[0.21, '0.9'], [0.26, '1'], [0.58, '1'], [0.66, '0.55']])}`
      + rect(-16, -8, 32, 16, 4.5, `fill="${K.C.glass}" class="ka-st1" stroke-width="0.8" stroke-opacity="0.9"`)
      + rect(-12, -8.3, 24, 0.6, 0, `fill="${K.ref('edge')}" opacity="0.5"`)
      + bar(-10.5, -3.6, 18, 1.5, INK, 0.6) + bar(-10.5, 1.2, 12, 1.5, INK, 0.28)
      + '</g></g></g>';
    return out;
  };

  // ---- shared bits of files / pfiles / mount ----
  const BIG = (os) => os === 'win' || os === 'mac' || os === 'linux';
  const winOsOf = (os) => (BIG(os) ? os : 'plain');
  const HAIR = (o, w = 0.75) => `fill="none" stroke="#fff" stroke-opacity="${o}" stroke-width="${w}"`;
  // The eased part of a move (keySplines EASE) at which the path's part p is reached, from 0..1 of the move.
  function easedAt(p) {
    const bz = (u, a, b) => 3 * (1 - u) * (1 - u) * u * a + 3 * (1 - u) * u * u * b + u * u * u;
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 30; i++) {
      const m = (lo + hi) / 2;
      if (bz(m, 0, 1) < p) lo = m; else hi = m;
    }
    return bz(lo, 0.45, 0.2);
  }
  // A small folder glyph (a list's icon), its top left at x, y, s wide.
  const folderGlyph = (x, y, s, o = 0.34) => `<path d="M${f(x)} ${f(y + s * 0.08)}h${f(s * 0.36)}l${f(s * 0.1)} ${f(s * 0.12)}H${f(x + s)}V${f(y + s * 0.78)}H${f(x)}z" ${HAIR(o, 0.6)} stroke-linejoin="round"/>`;
  // A small page glyph, its top left at x, y, s wide (s * 1.24 high).
  const pageGlyph = (x, y, s, o = 0.34) => `<path d="M${f(x)} ${f(y)}h${f(s * 0.62)}l${f(s * 0.38)} ${f(s * 0.38)}V${f(y + s * 1.24)}H${f(x)}z" ${HAIR(o, 0.6)} stroke-linejoin="round"/>`;
  // A screen seen close up: its bezel (near-black glass, hairline rim, key edge at the top) and the dark glass.
  function panel(K, x, y, w, h, rx, inset) {
    const s = { x: x + inset, y: y + inset, w: w - inset * 2, h: h - inset * 2, rx: Math.max(2, rx - inset) };
    const draw = rect(x, y, w, h, rx, `fill="${K.ref('body')}" stroke="${K.ref('rim')}" stroke-width="${K.SW.hair}"`)
      + rect(s.x, s.y, s.w, s.h, s.rx, `fill="${K.ref('scr')}"`)
      + rect(x + rx, y - 0.35, w - rx * 2, 0.7, 0, `fill="${K.ref('edge')}" opacity="0.8"`);
    return { s, draw };
  }

  // ======================================================================================================
  // Files: a close-up of the two screens side by side, the seam between them; their lower halves fade out. A
  // picture is picked up in a window here and dragged over the edge — the one accent, its outline in the
  // feature's colour — into a folder there, which takes it in. Both inner edges catch the light as it crosses.
  ART.files = (id, K) => {
    const D = 7;
    const { me, peer } = K.os();
    const meOs = BIG(me) ? me : 'win';
    const onPhone = peer === 'android';
    const rOs = winOsOf(peer === 'tablet' ? 'plain' : peer);
    const gid = K.uid('fg');
    const mid = K.uid('fm');
    let out = `<linearGradient id="${gid}" gradientUnits="userSpaceOnUse" x1="0" y1="166" x2="0" y2="232"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>`
      + `<mask id="${mid}" maskUnits="userSpaceOnUse" x="0" y="0" width="400" height="240">${rect(0, 0, 400, 240, 0, `fill="url(#${gid})"`)}</mask>`;

    // This screen: one window, three files in it.
    const L = panel(K, 14, 32, 178, 214, 12, 5);
    let left = L.draw;
    const ls = L.s;
    if (meOs === 'mac') {
      left += rect(ls.x, ls.y + 8, ls.w, 0.45, 0, 'fill="#fff" fill-opacity="0.06"')
        + rect(ls.x + ls.w / 2 - 12, ls.y - 0.2, 24, 5, 2.4, 'fill="#000"')
        + bar(ls.x + 8, ls.y + 3.4, 10, 1.2, '#fff', 0.16) + bar(ls.x + 22, ls.y + 3.4, 7, 1.2, '#fff', 0.1);
    } else if (meOs === 'linux') {
      left += rect(ls.x, ls.y + 7, ls.w, 0.45, 0, 'fill="#fff" fill-opacity="0.06"') + bar(ls.x + ls.w / 2 - 6, ls.y + 3, 12, 1.2, '#fff', 0.14);
    }
    const lw = [ls.x + 16, ls.y + 32, 134, 90];
    const lb = K.windowBody(...lw);
    const fy = lb.y + 19;
    const fx = (i) => lb.x + 18 + i * 36;
    left += K.window(...lw, {
      os: meOs,
      body: (b) => ['doc', 'pdf', 'img'].map((k, i) => K.file(fx(i), fy, k, { s: 0.6 })).join('')
        + bar(b.x + 6, fy + 22, b.w * 0.5, 1.4, '#fff', 0.1) + bar(b.x + 6, fy + 27, b.w * 0.3, 1.4, '#fff', 0.06),
    });
    const src = [fx(2), fy];

    // The other screen: a folder in a window (a folder on a phone's screen).
    let right;
    let tgt;
    let ts;
    let edgeR;
    if (onPhone) {
      const R = panel(K, 244, 24, 98, 226, 22, 4);
      const rs = R.s;
      edgeR = R;
      right = R.draw + circ(rs.x + rs.w / 2, rs.y + 7, 1.6, 'fill="#000" stroke="#fff" stroke-opacity="0.16" stroke-width="0.55"')
        + bar(rs.x + 12, rs.y + 26, 30, 2, '#fff', 0.2) + bar(rs.x + 12, rs.y + 32, 18, 1.4, '#fff', 0.08);
      tgt = [rs.x + rs.w * 0.3, rs.y + 70];
      ts = 0.72;
      right += K.file(rs.x + rs.w * 0.7, tgt[1], 'folder', { s: ts }) + bar(rs.x + 12, tgt[1] + 18, rs.w - 24, 1.4, '#fff', 0.07);
    } else {
      const R = panel(K, 208, 32, 178, 214, 12, 5);
      const rs = R.s;
      edgeR = R;
      right = R.draw;
      if (rOs === 'mac') {
        right += rect(rs.x, rs.y + 8, rs.w, 0.45, 0, 'fill="#fff" fill-opacity="0.06"') + rect(rs.x + rs.w / 2 - 12, rs.y - 0.2, 24, 5, 2.4, 'fill="#000"');
      } else if (rOs === 'linux') {
        right += rect(rs.x, rs.y + 7, rs.w, 0.45, 0, 'fill="#fff" fill-opacity="0.06"');
      }
      const rw = [rs.x + 28, rs.y + 32, 134, 90];
      const rb = K.windowBody(...rw);
      tgt = [rb.x + 20, rb.y + 19];
      ts = 0.82;
      right += K.window(...rw, {
        os: rOs,
        body: (b) => K.file(tgt[0], tgt[1], 'folder', { s: ts }) + bar(b.x + 40, tgt[1] - 4, b.w * 0.42, 1.6, '#fff', 0.18)
          + bar(b.x + 40, tgt[1] + 2, b.w * 0.26, 1.4, '#fff', 0.08),
      });
    }
    out += `<g mask="url(#${mid})">${left}${right}</g>`;

    // The round: rest, pick up (0.1), drag over the seam (T0..T1), drop into the folder, rest, fade, again.
    const T0 = 0.16;
    const T1 = 0.52;
    const d = `M${f(src[0])} ${f(src[1])}Q${f((src[0] + tgt[0]) / 2)} ${f(Math.min(src[1], tgt[1]) - 30)} ${f(tgt[0])} ${f(tgt[1])}`;
    const seam = (192 + edgeR.s.x - (onPhone ? 4 : 5)) / 2;
    const tx = T0 + (T1 - T0) * easedAt((seam - src[0]) / (tgt[0] - src[0]));
    // The two inner edges catch the light as the file goes over.
    [[192 - 0.5, 32], [edgeR.s.x - (onPhone ? 4 : 5) + 0.1, onPhone ? 24 : 32]].forEach(([x, y]) => {
      out += `<rect x="${f(x)}" y="${f(y + 14)}" width="0.6" height="110" fill="#fff" opacity="0">`
        + op(D, [[tx - 0.05, 0], [tx, 0.8], [tx + 0.1, 0]], true) + '</rect>';
    });
    // The folder there takes it in: its outline brightens a moment.
    out += `<g opacity="0">${op(D, [[0.53, 0], [0.57, 1], [0.7, 0.4], [0.84, 0.4], [0.9, 0]], true)}${K.file(tgt[0], tgt[1], 'folder', { s: ts })}</g>`;

    const motion = along(D, d, [[0, 0], [T0, 0], [T1, 1], [0.92, 1], [0.93, 0], [1, 0]]);
    // The one faint light, under the file in flight.
    out += `<g>${motion}<circle r="22" fill="${K.ref('r-f1')}" opacity="0">${op(D, [[T0, 0], [T0 + 0.08, 0.6], [T1 - 0.02, 0.6], [T1 + 0.08, 0]], true)}</circle></g>`;
    // The copy of the picture: lifts as it's picked up, goes over, shrinks into the folder.
    out += `<g>${motion}<g opacity="0">${op(D, [[0.1, 0], [0.13, 1], [0.54, 1], [0.6, 0]], true)}`
      + `<g>${tf(D, 'translate', [[0.1, '0 0'], [0.15, '0 -6'], [0.5, '0 -6'], [0.56, '0 0']])}`
      + `<g>${tf(D, 'scale', [[0.1, '1'], [0.14, '1.1'], [0.52, '1.1'], [0.6, '0.4']])}`
      + K.file(0, 0, 'img', { s: 0.6, accent: true }) + '</g></g></g></g>';
    // The pointer: holds it from the pick-up to the drop, rests there, fades, and starts again.
    out += `<g>${motion}<g opacity="1">${op(D, [[0, 1], [0.84, 1], [0.89, 0], [0.95, 0], [1, 1]], true)}`
      + `<g transform="translate(3 5)"><g>${tf(D, 'scale', [[0.09, '1'], [0.11, '0.9'], [0.54, '0.9'], [0.56, '1']])}${K.cursor(0, 0, { s: 0.92 })}</g></g></g></g>`;
    return out;
  };

  // ======================================================================================================
  // Phone files: the phone and, beside it, its storage open in a window here — the same files, side by side.
  // One file on the phone is picked and glides across, level, into the list here, where it comes in as a new row.
  // No pointer, no arc: a calm sideways glide. The file's outline is the one accent.
  ART.pfiles = (id, K) => {
    const D = 7.5;
    const { me } = K.os();
    const meOs = BIG(me) ? me : 'win';
    const P = [66, 42, 78, 156];
    const W = [184, 64, 152, 112];
    let src = [0, 0];
    const rowsY = [];

    // The phone: its storage as a list, four files.
    const phone = K.phone(...P, {
      content: (ar) => {
        const x = ar.x + ar.w * 0.12;
        const w = ar.w * 0.76;
        let s = bar(x, ar.y + ar.h * 0.1, w * 0.4, 2, '#fff', 0.22);
        const step = ar.h * 0.12;
        [0.62, 0.48, 0.56, 0.4].forEach((bw, i) => {
          const y = ar.y + ar.h * 0.22 + i * step;
          if (i === 1) {
            s += rect(ar.x + ar.w * 0.06, y - step * 0.32, ar.w * 0.88, step * 0.64, 3, 'fill="#fff" fill-opacity="0.08" opacity="0"',
              op(D, [[0.06, 0], [0.1, 1], [0.6, 1], [0.66, 0]], true));
            src = [x + 3.5, y];
          }
          s += pageGlyph(x, y - 4.3, 7, 0.32) + bar(x + 12, y - 1.6, w * bw, 1.5, '#fff', i === 1 ? 0.2 : 0.12)
            + bar(x + 12, y + 1.6, w * bw * 0.5, 1.1, '#fff', 0.06);
        });
        return s;
      },
    });

    // This computer: a window showing the phone's storage — folders, and a new row at the end.
    let tgt = [0, 0];
    let landed = '';
    const win = K.window(...W, {
      os: meOs,
      title: 'Phone',
      body: (b) => {
        const step = b.h / 4.6;
        let s = '';
        for (let i = 0; i < 4; i++) {
          const y = b.y + step * (i + 0.55);
          rowsY.push(y);
          if (i) s += rect(b.x + 2, y - step * 0.5, b.w - 4, 0.45, 0, 'fill="#fff" fill-opacity="0.045"');
          if (i < 3) {
            s += folderGlyph(b.x + 4, y - 3.4, 9, 0.32) + bar(b.x + 18, y - 0.8, b.w * [0.34, 0.26, 0.3][i], 1.6, '#fff', 0.14)
              + bar(b.x + b.w - 26, y - 0.8, 20, 1.4, '#fff', 0.06);
          } else {
            tgt = [b.x + 7.5, y];
            // The new row: its icon settles, its name and size draw on.
            landed = `<g opacity="0">${op(D, [[0.55, 0], [0.6, 1], [0.86, 1], [0.92, 0]], true)}`
              + pageGlyph(b.x + 4, y - 4.3, 7, 0.4)
              + `<rect x="${f(b.x + 18)}" y="${f(y - 0.8)}" width="0" height="1.6" rx="0.8" fill="#fff" fill-opacity="0.3">${anim(D, 'width', [[0.57, 0], [0.66, b.w * 0.36]])}</rect>`
              + `<rect x="${f(b.x + b.w - 26)}" y="${f(y - 0.8)}" width="0" height="1.4" rx="0.7" fill="#fff" fill-opacity="0.1">${anim(D, 'width', [[0.6, 0], [0.68, 20]])}</rect>`
              + '</g>';
          }
        }
        return s;
      },
    });
    let out = phone + win + landed;

    // The glide: level, eased, from the phone's row into the empty row here.
    const T0 = 0.18;
    const T1 = 0.56;
    const dx = tgt[0] - src[0];
    const d = `M${f(src[0])} ${f(src[1])}C${f(src[0] + dx * 0.45)} ${f(src[1] - 10)} ${f(tgt[0] - dx * 0.45)} ${f(tgt[1] - 10)} ${f(tgt[0])} ${f(tgt[1])}`;
    const motion = along(D, d, [[0, 0], [T0, 0], [T1, 1], [0.93, 1], [0.94, 0], [1, 0]]);
    out += `<g>${motion}<circle r="22" fill="${K.ref('r-f1')}" opacity="0">${op(D, [[T0 - 0.02, 0], [T0 + 0.08, 0.55], [T1 - 0.04, 0.55], [T1 + 0.06, 0]], true)}</circle></g>`;
    out += `<g>${motion}<g opacity="0">${op(D, [[0.12, 0], [0.16, 1], [T1, 1], [T1 + 0.04, 0]], true)}`
      + `<g>${tf(D, 'translate', [[0.12, '0 2'], [0.17, '0 -2'], [T1 - 0.04, '0 -2'], [T1, '0 0']])}`
      + `<g>${tf(D, 'scale', [[0.12, '0.7'], [0.17, '1'], [T1 - 0.04, '1'], [T1 + 0.03, '0.5']])}`
      + K.file(0, 0, 'doc', { s: 0.56, accent: true }) + '</g></g></g></g>';
    return out;
  };

  // ======================================================================================================
  // Phone drive: this computer's file manager, close up, and the phone beside it. The phone's switch goes on;
  // a second drive comes up next to the computer's own — its outline drawn on in the feature's colour (the one
  // accent), then its icon, name and space. It stays a while, then goes as the switch goes off.
  ART.mount = (id, K) => {
    const D = 7;
    const { me } = K.os();
    const meOs = BIG(me) ? me : 'win';
    const W = [40, 56, 252, 128];
    const ON = 0.07;
    const T0 = 0.1;
    const T1 = 0.22;
    const OFF = 0.84;
    let out = '';
    let tile2 = '';

    out += K.window(...W, {
      os: meOs,
      body: (b) => {
        // The side list: four places, a fifth (the phone) comes in.
        let s = '';
        const sx = b.x + 4;
        [0.62, 0.5, 0.56, 0.44].forEach((w, i) => { s += bar(sx, b.y + 7 + i * 10, 40 * w, 1.6, '#fff', i ? 0.1 : 0.18); });
        s += `<g opacity="0">${op(D, [[T1 - 0.04, 0], [T1 + 0.02, 1], [OFF, 1], [OFF + 0.05, 0]], true)}${bar(sx, b.y + 47, 40 * 0.4, 1.6, '#fff', 0.2)}</g>`;
        s += rect(b.x + 52, b.y - 2, 0.45, b.h + 4, 0, 'fill="#fff" fill-opacity="0.06"');
        // The drives.
        const mx = b.x + 64;
        s += bar(mx, b.y + 7, 34, 1.6, '#fff', 0.18);
        const ty = b.y + 20;
        const tw = 80;
        const th = 40;
        const cap = (x, part, o) => rect(x + 26, ty + 28, 44, 1.4, 0.7, 'fill="#fff" fill-opacity="0.08"')
          + (part ? rect(x + 26, ty + 28, 44 * part, 1.4, 0.7, `fill="#fff" fill-opacity="${o}"`) : '');
        // This computer's disk.
        s += rect(mx, ty, tw, th, 7, `fill="#fff" fill-opacity="0.02" ${HAIR(0.1)}`)
          + rect(mx + 8, ty + 14, 12, 9, 2, HAIR(0.36, 0.6)) + circ(mx + 17, ty + 20.3, 0.8, 'fill="#fff" fill-opacity="0.4"')
          + bar(mx + 26, ty + 13, 30, 1.8, '#fff', 0.22) + bar(mx + 26, ty + 19, 20, 1.3, '#fff', 0.08) + cap(mx, 0.64, 0.26);
        // The phone, as a drive: the outline drawn on, then what's in it.
        const x2 = mx + tw + 12;
        tile2 = `<ellipse cx="${f(x2 + tw / 2)}" cy="${f(ty + th + 2)}" rx="${f(tw * 0.6)}" ry="${f(th * 0.36)}" fill="${K.ref('r-f1')}" opacity="0">`
          + op(D, [[T0, 0], [T1, 0.32], [OFF, 0.32], [OFF + 0.06, 0]], true) + '</ellipse>'
          + `<rect x="${f(x2)}" y="${f(ty)}" width="${tw}" height="${th}" rx="7" class="ka-st1" fill="none" stroke-width="0.75" pathLength="1" stroke-dasharray="1 1" stroke-dashoffset="1" opacity="0">`
          + anim(D, 'stroke-dashoffset', [[T0, 1], [T1, 0]]) + op(D, [[T0 - 0.01, 0], [T0, 0.56], [OFF, 0.56], [OFF + 0.05, 0]], true) + '</rect>'
          + `<g opacity="0">${op(D, [[T1 - 0.05, 0], [T1 + 0.02, 1], [OFF, 1], [OFF + 0.05, 0]], true)}`
          + `<g>${tf(D, 'translate', [[T1 - 0.05, '0 2'], [T1 + 0.03, '0 0']])}`
          + rect(x2 + 10, ty + 12, 7.5, 13, 1.8, HAIR(0.4, 0.6)) + rect(x2 + 12.4, ty + 22.6, 2.7, 0.5, 0.25, 'fill="#fff" fill-opacity="0.4"')
          + text(x2 + 26, ty + 16.2, 'Phone', 5.6, { op: 0.42 })
          + bar(x2 + 26, ty + 20, 16, 1.3, '#fff', 0.08)
          + rect(x2 + 26, ty + 28, 44, 1.4, 0.7, 'fill="#fff" fill-opacity="0.08"')
          + `<rect x="${f(x2 + 26)}" y="${f(ty + 28)}" width="0" height="1.4" rx="0.7" fill="#fff" fill-opacity="0.3">${anim(D, 'width', [[T1, 0], [T1 + 0.1, 44 * 0.38]])}</rect>`
          + '</g></g>';
        return s + tile2;
      },
    });

    // The phone, beside: one switch on its screen, which goes on (white, no colour).
    const P = [316, 70, 50, 100];
    out += K.phone(...P, {
      content: (ar) => {
        const cx = ar.x + ar.w / 2;
        const cy = ar.y + ar.h * 0.46;
        const w = 16;
        const h = 9;
        return bar(cx - 11, cy - 15, 22, 1.6, '#fff', 0.18) + bar(cx - 7, cy - 10.5, 14, 1.2, '#fff', 0.07)
          + rect(cx - w / 2, cy - h / 2, w, h, h / 2, `fill="#fff" fill-opacity="0.04" ${HAIR(0.22, 0.6)}`)
          + `<rect x="${f(cx - w / 2)}" y="${f(cy - h / 2)}" width="${w}" height="${h}" rx="${h / 2}" fill="#fff" fill-opacity="0.2" opacity="0">`
          + op(D, [[ON, 0], [ON + 0.03, 1], [OFF, 1], [OFF + 0.03, 0]], true) + '</rect>'
          + `<circle cx="${f(cx - w / 2 + h / 2)}" cy="${f(cy)}" r="${f(h / 2 - 1.3)}" fill="#fff" fill-opacity="0.75">`
          + tf(D, 'translate', [[ON, '0 0'], [ON + 0.035, `${w - h} 0`], [OFF, `${w - h} 0`], [OFF + 0.035, '0 0']]) + '</circle>';
      },
    });
    return out;
  };
})();
