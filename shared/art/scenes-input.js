// DuoDesk — Aurora feature pictures, the Input group. Based on TwinDesk — Copyright (C) 2026 inukaasith. GPL-3.0, see LICENSE.
// Four scenes for shared/feature-art.js, drawn with the Aurora kit (shared/art/kit.js): each sets
// window.AuroraArt[<scene>] = (id, K) => the inner markup of a 400 x 240 picture (feature-art.js puts K.defs(id)
// in its <defs> first). This computer is K.os().me, the other device K.os().peer, each drawn as what it is.
//   cursor   (Mouse)    minimal: the two devices on one floor line; the pointer glides once across the gap on
//                       a thin trail of the feature's colour, clicks a window there (it takes focus), rests
//   keyboard  (minimal) a desk from the front: the other device at the back, a slim keyboard in front; keys go
//                       down one by one (white) and a short line is typed over there behind a caret in the
//                       feature's colour, word by word; a long rest, the line clears
//   remote    (minimal) this computer at the back on the left, the phone lying sideways in front on the right as a
//                       touchpad: a finger draws one slow curve (its trail the one accent), the pointer there follows
//                       it and a tap clicks a button
//   apps      (minimal) this computer close on the right, the other device small and far up on the left: its app's
//                       window lifts off, crosses on a slow arc, growing (outlined in the feature's colour), and
//                       settles here as a window of its own
// SMIL only (no scripts, no style="" attributes); loops of 7-8 s. Under reduced motion feature-art.js shows the
// frame at 1.6 s, which each scene keeps telling its story.
(function () {
  'use strict';
  const A = (window.AuroraArt = window.AuroraArt || {});

  const f = (v) => Math.round(v * 100) / 100;
  const REP = 'repeatCount="indefinite"';
  const EASE = '0.65 0 0.35 1'; // in and out
  const OUT = '0.2 0.8 0.3 1'; // fast, then settling
  const LIN = '0 0 1 1';

  // ---- placing the kit's devices ----
  const KIND = { win: 'winPc', mac: 'macBook', linux: 'linuxPc', android: 'phone', tablet: 'tablet' };
  const ASPECT = { win: 1.27, mac: 1.57, linux: 1.48, android: 0.5, tablet: 1.45 };
  const kindOf = (os) => KIND[os] || 'laptop';
  const aspect = (os) => ASPECT[os] || 1.48;
  const big = (os) => os === 'win' || os === 'mac' || os === 'linux';
  // A device of that OS, w wide (its height from its shape) at x, y: its screen's content area and whole screen.
  function place(K, os, x, y, w, o = {}) {
    const h = w / aspect(os);
    const kind = kindOf(os);
    return {
      os, kind, x, y, w, h,
      scr: K.screen(kind, x, y, w, h, o),
      full: K.screenRect(kind, x, y, w, h, o),
      draw: (more = {}) => K.computer(os, x, y, w, h, Object.assign({}, o, more)),
    };
  }
  // ---- small helpers ----
  const splines = (list) => ` calcMode="spline" keySplines="${list.join(';')}"`;
  function anim(attr, dur, values, times, o = {}) {
    return `<animate attributeName="${attr}" dur="${dur}s" ${REP} values="${values}" keyTimes="${times}"`
      + (o.ks ? splines(o.ks) : ` calcMode="${o.calc || 'linear'}"`) + (o.begin ? ` begin="${o.begin}"` : '') + '/>';
  }
  function animT(type, dur, values, times, o = {}) {
    return `<animateTransform attributeName="transform" type="${type}" dur="${dur}s" ${REP} values="${values}" keyTimes="${times}"`
      + (o.ks ? splines(o.ks) : ` calcMode="${o.calc || 'linear'}"`) + (o.add ? ' additive="sum"' : '') + (o.begin ? ` begin="${o.begin}"` : '') + '/>';
  }
  const opac = (dur, values, times, o) => anim('opacity', dur, values, times, o);
  // A quadratic curve: its point at t, its length.
  const qAt = (q, t) => {
    const u = 1 - t;
    return [u * u * q[0] + 2 * u * t * q[2] + t * t * q[4], u * u * q[1] + 2 * u * t * q[3] + t * t * q[5]];
  };
  function qLen(q) {
    let L = 0;
    let p = qAt(q, 0);
    for (let i = 1; i <= 60; i++) {
      const n = qAt(q, i / 60);
      L += Math.hypot(n[0] - p[0], n[1] - p[1]);
      p = n;
    }
    return L;
  }
  const qPath = (q) => `M${f(q[0])} ${f(q[1])}Q${f(q[2])} ${f(q[3])} ${f(q[4])} ${f(q[5])}`;
  // Where along a curve (0..1 of its length) it reaches x.
  function qPartAtX(q, x) {
    const L = qLen(q);
    let d = 0;
    let p = qAt(q, 0);
    for (let i = 1; i <= 120; i++) {
      const n = qAt(q, i / 120);
      d += Math.hypot(n[0] - p[0], n[1] - p[1]);
      if ((p[0] - x) * (n[0] - x) <= 0) return { part: d / L, pt: n };
      p = n;
    }
    return { part: 0.5, pt: qAt(q, 0.5) };
  }
  // =====================================================================================================
  // Mouse: the two devices side by side on one floor line. The pointer rests, then glides once across the gap
  // onto the other screen on a thin trail of the feature's colour (the one accent), and clicks a window there,
  // which takes focus. A long rest, it fades, and the round begins again. One faint light travels with it.
  A.cursor = (id, K) => {
    const { me, peer } = K.os();
    const D = 7;
    const floor = 184;
    const meOs = big(me) ? me : 'win';
    const WD = { win: 150, mac: 168, linux: 160 };
    const lw = WD[meOs];
    let rOs = peer;
    let rw;
    if (big(peer)) rw = WD[peer];
    else if (peer === 'tablet') rw = 156;
    else { rOs = 'android'; rw = 58; }
    const gap = big(peer) ? 26 : 40;
    const x0 = 200 - (lw + gap + rw) / 2;
    const L = place(K, meOs, x0, floor - lw / aspect(meOs), lw);
    const R = place(K, rOs, x0 + lw + gap, floor - rw / aspect(rOs), rw);
    const winOs = (os) => (os === 'win' || os === 'linux' ? os : os === 'mac' ? 'mac' : 'plain');
    const rect = (x, y, w, h, rx, attrs) => `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" rx="${f(rx)}" ${attrs}/>`;
    const rxOf = (os, w, h) => Math.max(1, Math.min(8, Math.min(w, h) * (os === 'win' ? 0.04 : 0.055)));

    // This screen: one window, the pointer resting in it.
    const la = L.scr;
    const lwin = [la.x + la.w * 0.14, la.y + la.h * 0.16, la.w * 0.58, la.h * 0.64];
    const p0 = [lwin[0] + lwin[2] * 0.66, lwin[1] + lwin[3] * 0.62];
    const lContent = K.window(...lwin, { os: winOs(meOs), body: 'lines' });
    // The other screen: the window (a widget on a phone) that the click focuses.
    const ra = R.scr;
    let target;
    let rContent;
    if (rOs === 'android') {
      target = [ra.x + ra.w * 0.1, ra.y + ra.h * 0.1, ra.w * 0.8, ra.h * 0.26, ra.w * 0.1];
      const t = Math.max(0.6, ra.w * 0.035);
      rContent = rect(target[0], target[1], target[2], target[3], target[4], 'fill="#fff" fill-opacity="0.04" stroke="#fff" stroke-opacity="0.09" stroke-width="0.55"')
        + rect(target[0], ra.y + ra.h * 0.46, target[2] * 0.7, t, t / 2, 'fill="#fff" fill-opacity="0.14"')
        + rect(target[0], ra.y + ra.h * 0.46 + t * 2.6, target[2] * 0.45, t, t / 2, 'fill="#fff" fill-opacity="0.08"');
    } else {
      const w = [ra.x + ra.w * 0.26, ra.y + ra.h * 0.18, ra.w * 0.58, ra.h * 0.64];
      target = [...w, rxOf(winOs(rOs), w[2], w[3])];
      rContent = K.window(...w, { os: winOs(rOs), body: 'lines' });
    }
    const p1 = [target[0] + target[2] * 0.4, target[1] + target[3] * 0.56];

    // The way across: a gentle arc over the gap.
    const q = [p0[0], p0[1], (p0[0] + p1[0]) / 2, Math.min(p0[1], p1[1]) - 34, p1[0], p1[1]];
    const d = qPath(q);
    // A round: rest, glide (0.14-0.5), click (0.55), rest, fade out (0.84-0.9), back unseen, fade in (0.94-1).
    const T0 = 0.14;
    const T1 = 0.5;
    const TC = 0.55;
    const MOVE = EASE;
    // When the pointer crosses the gap: the path's part at the middle of the gap, then the eased time of it.
    const gx = (L.full.x + L.full.w + R.full.x) / 2;
    const part = qPartAtX(q, gx).part;
    const bz = (u, a, b) => 3 * (1 - u) * (1 - u) * u * a + 3 * (1 - u) * u * u * b + u * u * u;
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 30; i++) { const m = (lo + hi) / 2; if (bz(m, 0, 1) < part) lo = m; else hi = m; }
    const tx = T0 + (T1 - T0) * bz(lo, 0.65, 0.35);

    let out = '';
    // One floor line under both.
    out += `<rect x="30" y="${floor + 0.2}" width="340" height="0.6" fill="${K.ref('edge')}" opacity="0.3"/>`;
    out += L.draw({ content: lContent }) + R.draw({ content: rContent });
    // The screens' inner edges catch the light as the pointer goes over the gap.
    [[L.full.x + L.full.w - 0.4, L.full], [R.full.x, R.full]].forEach(([x, s]) => {
      out += `<rect x="${f(x)}" y="${f(s.y + s.rx)}" width="0.6" height="${f(s.h - s.rx * 2)}" fill="#fff" opacity="0">`
        + opac(D, '0;0;0.55;0;0', `0;${f(tx - 0.04)};${f(tx)};${f(tx + 0.1)};1`) + '</rect>';
    });
    // The focus: the window there brightens its outline once clicked.
    out += `<rect x="${f(target[0])}" y="${f(target[1])}" width="${f(target[2])}" height="${f(target[3])}" rx="${f(target[4])}" fill="none" stroke="#fff" stroke-width="0.75" opacity="0">`
      + opac(D, '0;0;0.32;0.32;0;0', `0;${TC};${TC + 0.03};0.84;0.9;1`) + '</rect>';
    // The trail: drawn on behind the pointer in the feature's colour, clear at its start; then it fades.
    const gid = K.uid('tr');
    out += `<linearGradient id="${gid}" gradientUnits="userSpaceOnUse" x1="${f(p0[0])}" y1="0" x2="${f(p1[0])}" y2="0">`
      + '<stop offset="0" class="ka-s1" stop-opacity="0"/><stop offset="0.6" class="ka-s1" stop-opacity="0.5"/><stop offset="1" class="ka-s1" stop-opacity="0.9"/></linearGradient>'
      + `<path d="${d}" pathLength="1" fill="none" stroke="url(#${gid})" stroke-width="1.2" stroke-linecap="round" stroke-dasharray="1 1" stroke-dashoffset="1" opacity="0">`
      + anim('stroke-dashoffset', D, '1;1;0;0;1', `0;${T0};${T1};0.92;1`, { ks: [LIN, MOVE, LIN, LIN] })
      + opac(D, '0;0;1;1;0;0', `0;${T0 - 0.01};${T0};${T1 + 0.06};0.74;1`) + '</path>';
    // The click: one hairline ring.
    out += `<circle cx="${f(p1[0])}" cy="${f(p1[1])}" r="2" fill="none" stroke="#fff" stroke-width="0.7" opacity="0">`
      + anim('r', D, '2;2;12;12', `0;${TC};${TC + 0.1};1`, { ks: [LIN, OUT, LIN] })
      + opac(D, '0;0;0.6;0;0', `0;${TC};${TC + 0.01};${TC + 0.1};1`) + '</circle>';
    // The pointer, and the one faint light that goes with it while it moves.
    const motion = `<animateMotion dur="${D}s" ${REP} path="${d}" keyPoints="0;0;1;1;0;0" keyTimes="0;${T0};${T1};0.91;0.92;1"${splines([LIN, MOVE, LIN, LIN, LIN])}/>`;
    out += `<g>${motion}<circle r="26" fill="${K.ref('r-f1')}" opacity="0">${opac(D, '0;0;0.55;0.55;0;0', `0;${T0};${T0 + 0.1};${T1};${T1 + 0.14};1`)}</circle></g>`;
    out += `<g>${opac(D, '1;1;0;0;1', '0;0.84;0.9;0.94;1')}${motion}`
      + `<g>${animT('scale', D, '1;1;0.86;1;1', `0;${TC - 0.006};${TC + 0.006};${TC + 0.03};1`)}${K.cursor(0, 0, { s: 1.05 })}</g></g>`;
    return out;
  };

  // ---- key frames: [[t 0..1, value], …] over a round of D seconds ----
  const t4 = (v) => Math.round(Math.max(0, Math.min(1, v)) * 10000) / 10000;
  function frames(list) {
    const l = list.map(([t, v]) => [t4(t), v]);
    if (l[0][0] > 0) l.unshift([0, l[0][1]]);
    if (l[l.length - 1][0] < 1) l.push([1, l[l.length - 1][1]]);
    for (let i = 1; i < l.length; i++) if (l[i][0] < l[i - 1][0]) l[i][0] = l[i - 1][0];
    return { v: l.map((p) => p[1]).join(';'), t: l.map((p) => p[0]).join(';'), n: l.length };
  }
  const mode = (smooth, n) => (smooth ? splines(Array(n - 1).fill(EASE)) : ' calcMode="linear"');
  // An attribute through key frames (smooth: eased between them).
  const kf = (D, attr, list, smooth = true) => {
    const k = frames(list);
    return `<animate attributeName="${attr}" dur="${D}s" ${REP} values="${k.v}" keyTimes="${k.t}"${mode(smooth, k.n)}/>`;
  };
  const kfT = (D, type, list, smooth = true) => {
    const k = frames(list);
    return `<animateTransform attributeName="transform" type="${type}" dur="${D}s" ${REP} values="${k.v}" keyTimes="${k.t}"${mode(smooth, k.n)}/>`;
  };
  // Shown from a until b (parts of the round), fading over e.
  const during = (D, a, b, e = 0.03) => kf(D, 'opacity', [[0, 0], [a, 0], [a + e, 1], [b - e, 1], [b, 0], [1, 0]], false);
  const R = (x, y, w, h, rx, attrs = '', inner = '') => `<rect x="${f(x)}" y="${f(y)}" width="${f(Math.max(0, w))}" height="${f(Math.max(0, h))}"${rx ? ` rx="${f(rx)}"` : ''} ${attrs}${inner ? `>${inner}</rect>` : '/>'}`;
  const bar = (x, y, w, t, op) => R(x, y, w, t, t / 2, `fill="#fff" fill-opacity="${op}"`);
  const winOsOf = (os) => (os === 'win' || os === 'mac' || os === 'linux' ? os : 'plain');

  // =====================================================================================================
  // Keyboard: a desk seen from the front. The other device stands at the back, a slim keyboard lies in front of
  // it. Keys go down one after another (white, quiet) and a short line is typed over there, word by word,
  // behind a caret in the feature's colour (the one accent). A long rest, the line clears, again.
  A.keyboard = (id, K) => {
    const { peer } = K.os();
    const D = 8;
    // The other device, centred at the back.
    let P;
    const back = 134;
    if (big(peer)) {
      const w = { win: 128, mac: 148, linux: 140 }[peer];
      P = place(K, peer, 200 - w / 2, back - w / aspect(peer), w);
    } else if (peer === 'tablet') P = place(K, 'tablet', 200 - 70, back - 140 / 1.45, 140);
    else P = place(K, 'android', 200 - 26, back - 104, 52);
    const s = P.scr;

    // The keys typed: h e l l o ␣ y o u — [row, key] on the keyboard below, and when each goes down.
    const SEQ = [[2, 6], [1, 3], [2, 9], [2, 9], [1, 9], [4, 4], [1, 6], [1, 9], [1, 7]];
    const T0 = 0.14;
    const STEP = 0.034;
    const when = SEQ.map((_, i) => T0 + i * STEP + (i >= 6 ? 0.03 : 0));
    const CLEAR = [0.84, 0.9];

    // Over there: the line being typed, two words, and the caret.
    const phoneLike = P.os === 'android';
    let field;
    let content = '';
    if (phoneLike) {
      // A chat: two quiet bubbles, the message field at the bottom.
      const x = s.x + s.w * 0.1;
      const w = s.w * 0.8;
      const bh = Math.max(4, s.h * 0.07);
      content += R(x, s.y + s.h * 0.12, w * 0.6, bh, bh / 2, 'fill="#fff" fill-opacity="0.06"')
        + R(x + w * 0.34, s.y + s.h * 0.12 + bh * 1.6, w * 0.66, bh, bh / 2, 'fill="#fff" fill-opacity="0.1"');
      const fy = s.y + s.h * 0.8;
      content += R(x, fy, w, bh * 1.5, bh * 0.75, 'fill="none" stroke="#fff" stroke-opacity="0.16" stroke-width="0.55"');
      field = { x: x + bh * 0.6, y: fy + bh * 0.75, t: Math.max(0.8, bh * 0.28), cw: w * 0.075 };
    } else {
      const wx = s.x + s.w * 0.16;
      const wy = s.y + s.h * 0.14;
      const ww = s.w * 0.68;
      const wh = s.h * 0.66;
      const b = K.windowBody(wx, wy, ww, wh);
      const t = clampN(b.h * 0.075, 0.7, 2.4);
      content += K.window(wx, wy, ww, wh, { os: winOsOf(P.os), body: (bb) => bar(bb.x, bb.y + t * 0.4, bb.w * 0.38, t, 0.22)
        + bar(bb.x, bb.y + t * 3, bb.w * 0.82, t, 0.08) });
      field = { x: b.x, y: b.y + t * 6.4, t, cw: b.w * 0.055 };
    }
    // Two words, growing a letter at a time; the caret just after them.
    const { x: fx, y: fy, t, cw } = field;
    const w1 = cw * 5;
    const x2 = fx + w1 + cw * 1.1;
    const grow = (from, to, x0) => {
      const fr = [[0, 0], [when[from] - 0.001, 0]];
      for (let i = from; i <= to; i++) fr.push([when[i], (i - from) * cw + (i === from ? 0 : 0)], [when[i] + 0.012, (i - from + 1) * cw]);
      fr.push([CLEAR[1], (to - from + 1) * cw], [CLEAR[1] + 0.001, 0]);
      return R(x0, fy - t / 2, 0, t, t / 2, 'fill="#fff" fill-opacity="0.5"', kf(D, 'width', fr, false) + during(D, when[from] - 0.002, CLEAR[1]));
    };
    content += grow(0, 4, fx) + grow(6, 8, x2);
    // The caret: from the start, after each letter, after the space; back once the line clears.
    const cx = [[0, fx], [when[0], fx]];
    SEQ.forEach((_, i) => {
      const at = i < 5 ? fx + (i + 1) * cw : i === 5 ? x2 : x2 + (i - 5) * cw;
      const prev = cx[cx.length - 1][1];
      cx.push([when[i], prev], [when[i] + 0.012, at]);
    });
    cx.push([CLEAR[1], cx[cx.length - 1][1]], [CLEAR[1] + 0.001, fx]);
    const ch = t * 3.2;
    content += `<g>${kfT(D, 'translate', cx.map(([tt, x]) => [tt, `${f(x - fx)} 0`]), false)}`
      + R(fx + 0.6, fy - ch / 2, Math.max(0.7, t * 0.42), ch, 0.3, 'class="ka-f1" opacity="0.9"',
        kf(D, 'opacity', [[0, 0.9], [CLEAR[0], 0.9], [CLEAR[1] - 0.02, 0.15], [CLEAR[1] + 0.03, 0.9]], true)) + '</g>';
    // The pointer is over there: that's where the keys go.
    if (!phoneLike) content += K.cursor(s.x + s.w * 0.72, s.y + s.h * 0.62, { s: 0.62 });

    let out = P.draw({ apps: false, content });

    // The keyboard: a slim slab, seen from a little above (its depth foreshortened), five rows of keys.
    const KW = 232;
    const pad = 6;
    const u = (KW - pad * 2) / 14.5;
    const SY = 0.54; // foreshortening
    const gap = 2.3;
    const ROWS = [
      [...Array(13).fill(1), 1.5],
      [1.5, ...Array(12).fill(1), 1],
      [1.75, ...Array(11).fill(1), 1.75],
      [2.25, ...Array(10).fill(1), 2.25],
      [1, 1, 1, 1.25, 6, 1.25, 1, 1, 1],
    ];
    const kx = 200 - KW / 2;
    const ky = back + 24;
    const KH = (pad * 2 + u * 5 - gap) * SY + gap * 0.5;
    // Its front edge (thickness), then the top.
    out += R(kx + 1.5, ky + KH - 2, KW - 3, 4.2, 2, `fill="${K.ref('alu')}" stroke="#fff" stroke-opacity="0.1" stroke-width="0.55"`);
    out += R(kx, ky, KW, KH, 5, `fill="${K.ref('body')}" stroke="${K.ref('rim')}" stroke-width="0.75"`)
      + R(kx + 6, ky - 0.35, KW - 12, 0.7, 0, `fill="${K.ref('edge')}"`);
    const keyAt = (r, i) => {
      let x = 0;
      for (let j = 0; j < i; j++) x += ROWS[r][j];
      return { x: kx + pad + x * u, y: ky + pad * SY + r * u * SY, w: ROWS[r][i] * u - gap, h: (u - gap) * SY };
    };
    let keys = '';
    ROWS.forEach((row, r) => row.forEach((_, i) => {
      const k = keyAt(r, i);
      keys += R(k.x, k.y, k.w, k.h, 1.4, 'fill="#0d0d10" stroke="#fff" stroke-opacity="0.085" stroke-width="0.5"')
        + R(k.x + 1, k.y + 0.25, k.w - 2, 0.4, 0, 'fill="#fff" fill-opacity="0.05"');
    }));
    out += keys;
    // The keys going down: a key goes a touch lower and its outline brightens, white.
    const downs = {};
    SEQ.forEach(([r, i], n) => { (downs[r + ',' + i] = downs[r + ',' + i] || []).push(when[n]); });
    Object.keys(downs).forEach((key) => {
      const [r, i] = key.split(',').map(Number);
      const k = keyAt(r, i);
      const fr = [[0, 0]];
      downs[key].forEach((tt) => fr.push([tt - 0.002, 0], [tt + 0.004, 1], [tt + 0.02, 1], [tt + 0.034, 0]));
      out += `<g opacity="0">${kf(D, 'opacity', fr, false)}`
        + R(k.x, k.y + 0.5, k.w, k.h, 1.4, 'fill="#fff" fill-opacity="0.07" stroke="#fff" stroke-opacity="0.55" stroke-width="0.55"') + '</g>';
    });
    return out;
  };
  const clampN = (v, a, b) => Math.max(a, Math.min(b, v));

  // =====================================================================================================
  // Remote: this computer at the back on the left, the phone lying in front on the right, sideways — a
  // touchpad. A finger draws one slow curve on the phone (its trail in the feature's colour: the one accent) and
  // the pointer over there follows the same curve, then a tap clicks a button there. Rest, fade, again.
  A.remote = (id, K) => {
    const { me } = K.os();
    const D = 8;
    const os = big(me) ? me : 'win';
    const w = { win: 152, mac: 174, linux: 164 }[os];
    const floor = 150;
    const PC = place(K, os, 34, floor - w / aspect(os), w);
    const ar = PC.scr;

    // There: one window, a button in its corner that the click presses.
    const win = [ar.x + ar.w * 0.12, ar.y + ar.h * 0.14, ar.w * 0.7, ar.h * 0.66];
    const b = K.windowBody(...win);
    const tb = clampN(b.h * 0.075, 0.7, 2.4);
    const btn = { w: b.w * 0.26, h: Math.max(3.2, b.h * 0.15) };
    btn.x = b.x + b.w - btn.w;
    btn.y = b.y + b.h - btn.h;
    const content = K.window(...win, { os: winOsOf(os), body: (bb) => bar(bb.x, bb.y + tb * 0.4, bb.w * 0.4, tb, 0.22)
      + bar(bb.x, bb.y + tb * 3, bb.w * 0.8, tb, 0.08) + bar(bb.x, bb.y + tb * 5.4, bb.w * 0.6, tb, 0.08) })
      + R(btn.x, btn.y, btn.w, btn.h, btn.h / 2, 'fill="#fff" fill-opacity="0.04" stroke="#fff" stroke-opacity="0.16" stroke-width="0.55"');

    // The curve, as parts of the screen: from the window's lower left, up and over, down onto the button.
    const p0 = [(b.x + b.w * 0.1 - ar.x) / ar.w, (b.y + b.h * 0.62 - ar.y) / ar.h];
    const p1 = [(btn.x + btn.w * 0.5 - ar.x) / ar.w, (btn.y + btn.h * 0.5 - ar.y) / ar.h];
    const pc = [(p0[0] + p1[0]) / 2, Math.min(p0[1], p1[1]) - 0.42];
    const curve = (r) => [r.x + p0[0] * r.w, r.y + p0[1] * r.h, r.x + pc[0] * r.w, r.y + pc[1] * r.h, r.x + p1[0] * r.w, r.y + p1[1] * r.h];
    const T0 = 0.14;
    const T1 = 0.48;
    const TC = 0.54;
    const motion = (d) => `<animateMotion dur="${D}s" ${REP} path="${d}" keyPoints="0;0;1;1;0;0" keyTimes="0;${T0};${T1};0.91;0.92;1"${splines([LIN, EASE, LIN, LIN, LIN])}/>`;

    let out = `<rect x="22" y="${floor + 0.2}" width="${f(PC.x + PC.w + 14 - 22)}" height="0.6" fill="${K.ref('edge')}" opacity="0.26"/>`;
    out += PC.draw({ content });
    // The click there: the button lights up (white), the pointer presses.
    out += R(btn.x, btn.y, btn.w, btn.h, btn.h / 2, 'fill="#fff" fill-opacity="0.1" stroke="#fff" stroke-opacity="0.6" stroke-width="0.55" opacity="0"',
      kf(D, 'opacity', [[0, 0], [TC, 0], [TC + 0.01, 1], [0.84, 1], [0.9, 0]], false));
    const sq = curve(ar);
    out += `<g>${kf(D, 'opacity', [[0, 1], [0.84, 1], [0.9, 0], [0.94, 0], [1, 1]], false)}${motion(qPath(sq))}`
      + `<g>${animT('scale', D, '1;1;0.86;1;1', `0;${TC - 0.006};${TC + 0.006};${TC + 0.03};1`)}${K.cursor(0, 0, { s: 0.8 })}</g></g>`;

    // The phone, lying sideways in front, turned a little as if just put down.
    const cx = 292;
    const cy = 176;
    const LONG = 150;
    const SHORT = 74;
    const ps = K.screenRect('phone', cx - SHORT / 2, cy - LONG / 2, SHORT, LONG);
    const S = { x: cx - ps.h / 2, y: cy - ps.w / 2, w: ps.h, h: ps.w };
    let ph = `<g transform="rotate(-90 ${cx} ${cy})">${K.phone(cx - SHORT / 2, cy - LONG / 2, SHORT, LONG, { chrome: false, apps: false })}</g>`;
    // On its screen: the pad, one hairline, nothing else.
    const pad = { x: S.x + S.w * 0.07, y: S.y + S.h * 0.12, w: S.w * 0.86, h: S.h * 0.76 };
    ph += R(pad.x, pad.y, pad.w, pad.h, 6, 'fill="none" stroke="#fff" stroke-opacity="0.07" stroke-width="0.55"');
    const fq = curve(pad);
    const fd = qPath(fq);
    // The finger's trail: drawn on behind it in the feature's colour, clear at its start; then it fades.
    const gid = K.uid('ft');
    ph += `<linearGradient id="${gid}" gradientUnits="userSpaceOnUse" x1="${f(fq[0])}" y1="0" x2="${f(fq[4])}" y2="0">`
      + '<stop offset="0" class="ka-s1" stop-opacity="0"/><stop offset="0.55" class="ka-s1" stop-opacity="0.55"/><stop offset="1" class="ka-s1" stop-opacity="0.95"/></linearGradient>'
      + `<path d="${fd}" pathLength="1" fill="none" stroke="url(#${gid})" stroke-width="1.3" stroke-linecap="round" stroke-dasharray="1 1" stroke-dashoffset="1" opacity="0">`
      + anim('stroke-dashoffset', D, '1;1;0;0;1', `0;${T0};${T1};0.92;1`, { ks: [LIN, EASE, LIN, LIN] })
      + opac(D, '0;0;1;1;0;0', `0;${T0 - 0.01};${T0};${TC + 0.04};0.74;1`) + '</path>';
    // The tap: one hairline ring.
    ph += `<circle cx="${f(fq[4])}" cy="${f(fq[5])}" r="4" fill="none" stroke="#fff" stroke-width="0.6" opacity="0">`
      + anim('r', D, '4;4;13;13', `0;${TC};${TC + 0.1};1`, { ks: [LIN, OUT, LIN] })
      + opac(D, '0;0;0.55;0;0', `0;${TC};${TC + 0.01};${TC + 0.1};1`) + '</circle>';
    // The finger: a soft touch on the glass, the one faint light with it; it comes, draws, taps, lifts off.
    ph += `<g opacity="0">${opac(D, '0;0;1;1;0;0', `0;${T0 - 0.06};${T0 - 0.01};${TC + 0.05};${TC + 0.12};1`)}${motion(fd)}`
      + `<circle r="20" fill="${K.ref('r-f1')}" opacity="0.5"/>`
      + `<g>${animT('scale', D, '1;1;0.8;1;1', `0;${TC - 0.006};${TC + 0.006};${TC + 0.03};1`)}`
      + '<circle r="5" fill="#fff" fill-opacity="0.07" stroke="#fff" stroke-opacity="0.6" stroke-width="0.6"/></g></g>';
    out += `<g transform="rotate(-5 ${cx} ${cy})">${ph}</g>`;
    return out;
  };

  // =====================================================================================================
  // Apps: this computer close, on the right; the other device far off, small, up on the left, an app open on
  // it. Its window lifts off, crosses on a slow arc, growing, and settles here as a window of its own — outlined
  // in the feature's colour while it travels (the one accent), its top edge keeping it once it's here.
  A.apps = (id, K) => {
    const { me, peer } = K.os();
    const D = 8;
    const mos = big(me) ? me : 'win';
    const mw = { win: 176, mac: 214, linux: 202 }[mos];
    const Me = place(K, mos, 372 - mw, 204 - mw / aspect(mos), mw);
    let P;
    if (big(peer)) {
      const w = { win: 84, mac: 98, linux: 92 }[peer];
      P = place(K, peer, 30, 100 - w / aspect(peer), w);
    } else if (peer === 'tablet') P = place(K, 'tablet', 30, 100 - 92 / 1.45, 92);
    else P = place(K, 'android', 52, 26, 37);
    const ps = P.scr;
    const ar = Me.scr;
    const pOs = winOsOf(P.os);
    const phoneLike = P.os === 'android';

    // The app over there (a media app: a picture and two lines), and where it lands here.
    const src = phoneLike
      ? [ps.x + ps.w * 0.08, ps.y + ps.h * 0.06, ps.w * 0.84, ps.h * 0.6]
      : [ps.x + ps.w * 0.2, ps.y + ps.h * 0.16, ps.w * 0.6, ps.h * 0.66];
    let dst;
    if (phoneLike) {
      const h = ar.h * 0.78;
      const w = h * 0.62;
      dst = [ar.x + (ar.w - w) / 2, ar.y + ar.h * 0.1, w, h];
    } else dst = [ar.x + ar.w * 0.2, ar.y + ar.h * 0.12, ar.w * 0.6, ar.h * 0.7];
    const T0 = 0.14;
    const T1 = 0.5;
    const OUTT = [0.84, 0.9];

    let out = '';
    // Far off: dimmer; the app open on it, its outline lit for a moment as it's sent.
    out += `<g opacity="0.62">${P.draw({ content: K.window(...src, { os: pOs, body: 'media' }) })}</g>`;
    out += R(src[0], src[1], src[2], src[3], 2, 'fill="none" class="ka-st1" stroke-width="0.6" opacity="0"',
      kf(D, 'opacity', [[0, 0], [T0 - 0.06, 0], [T0 - 0.01, 0.7], [T0 + 0.04, 0]], true));
    // Near: this computer, its desktop empty until the app arrives.
    const landed = `<g opacity="0">${during(D, T1 - 0.02, OUTT[1], 0.05)}${K.window(...dst, { os: winOsOf(mos), body: 'media', active: true })}</g>`;
    out += Me.draw({ content: landed });

    // The flight: the window's outline, lifted off there, growing along a slow arc and settling here.
    const c0 = [src[0] + src[2] / 2, src[1] + src[3] / 2];
    const c1 = [dst[0] + dst[2] / 2, dst[1] + dst[3] / 2];
    const d = `M${f(c0[0])} ${f(c0[1])}Q${f(c0[0] + (c1[0] - c0[0]) * 0.45)} ${f(Math.min(c0[1], c1[1]) - 46)} ${f(c1[0])} ${f(c1[1])}`;
    const route = `<animateMotion dur="${D}s" ${REP} path="${d}" keyPoints="0;0;1;1" keyTimes="0;${T0};${T1};1"${splines([LIN, EASE, LIN])}/>`;
    const size = (i) => [[0, src[i]], [T0, src[i]], [T1, dst[i]], [1, dst[i]]];
    const half = (i) => size(i).map(([tt, v]) => [tt, f(-v / 2)]);
    // The window itself, scaled: a nested picture of it whose box grows from there to here (its outline in the
    // feature's colour, the same width at every size).
    const flying = `<svg viewBox="${f(dst[0] - 1)} ${f(dst[1] - 1)} ${f(dst[2] + 2)} ${f(dst[3] + 2)}" preserveAspectRatio="none" overflow="visible">`
      + kf(D, 'width', size(2)) + kf(D, 'height', size(3)) + kf(D, 'x', half(2)) + kf(D, 'y', half(3))
      + K.window(...dst, { os: winOsOf(mos), body: 'media' })
      + R(dst[0], dst[1], dst[2], dst[3], 3, 'fill="none" class="ka-st1" stroke-width="0.8" stroke-opacity="0.8" vector-effect="non-scaling-stroke"') + '</svg>';
    out += `<g opacity="0">${kf(D, 'opacity', [[0, 0], [T0 - 0.01, 0], [T0 + 0.02, 1], [T1 - 0.01, 1], [T1 + 0.05, 0]], false)}${route}`
      + `<circle r="30" fill="${K.ref('r-f1')}" opacity="0.35"/>${flying}</g>`;
    return out;
  };
})();
