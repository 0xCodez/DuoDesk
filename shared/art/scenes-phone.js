// DuoDesk — Aurora feature pictures: the phone's features, minimal. Based on TwinDesk — Copyright (C) 2026 inukaasith. GPL-3.0, see LICENSE.
// One scene each for notifications, calls, messages and media, drawn with the Aurora art kit (shared/art/kit.js,
// passed in as K): AuroraArt.<scene> = (id, K) => the inner markup of a 400 x 240 picture, K.defs(id) already in
// its <defs>. This computer is K.os().me (a Windows PC, a Mac or a Linux laptop, each as it looks); the phone is
// an Android phone. Apple-grade restraint: hairline monochrome devices, two or three objects, ONE accent (the
// feature's colour, through the ka-f1 / ka-st1 / ka-s1 classes) on the one thing that matters, one slow gesture
// per round, long rests. CSP-safe: presentation attributes and classes only (no style=""), SMIL for every
// motion, no scripts; every loop is seamless, and the still frame of prefers-reduced-motion (1.6 s in) already
// shows the story.
//   notifications  the phone small on the left, the computer on the right: a notification wakes the phone and
//                  a moment later slides in as one quiet toast where this OS puts them (its dot the accent)
//   calls          the computer alone in the middle, the phone tucked in front of its corner: the phone rings
//                  (two hairline rings), then the call is on the computer — a contact ring over a voice line
//                  in the accent that breathes slowly while they talk
//   messages       the same thread on both, the phone tall beside the computer: a reply is typed here, rises
//                  into the thread (outlined in the accent) and appears on the phone a beat later
//   media          the phone held up at a slight angle: one photo lifts out of its grid, drifts across and
//                  grows into the viewer on this computer's screen
(function () {
  'use strict';
  const A = (window.AuroraArt = window.AuroraArt || {});

  const f = (v) => Math.round(v * 100) / 100;
  const t4 = (v) => Math.round(Math.max(0, Math.min(1, v)) * 10000) / 10000;
  const REP = 'repeatCount="indefinite"';
  const INK = '#f1f1f3';
  const GLASS = '#111114';

  // ---- shapes ----
  const rect = (x, y, w, h, rx, attrs = '', inner = '') => `<rect x="${f(x)}" y="${f(y)}" width="${f(Math.max(0, w))}" height="${f(Math.max(0, h))}"${rx ? ` rx="${f(rx)}"` : ''} ${attrs}${inner ? `>${inner}</rect>` : '/>'}`;
  const circ = (cx, cy, r, attrs = '', inner = '') => `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(r)}" ${attrs}${inner ? `>${inner}</circle>` : '/>'}`;
  const ell = (cx, cy, rx, ry, attrs = '', inner = '') => `<ellipse cx="${f(cx)}" cy="${f(cy)}" rx="${f(rx)}" ry="${f(ry)}" ${attrs}${inner ? `>${inner}</ellipse>` : '/>'}`;
  // A line of text, abstract: a rounded bar, white at that opacity.
  const bar = (x, y, w, t, op_ = 0.2) => rect(x, y, w, t, t / 2, `fill="${INK}" fill-opacity="${op_}"`);
  const hair = (op_, w = 0.6) => `fill="none" stroke="#fff" stroke-opacity="${op_}" stroke-width="${w}"`;

  // ---- timing: key frames [[t 0..1, value], …] over a round of D seconds ----
  function frames(list) {
    const l = list.map(([t, v]) => [t4(t), v]);
    if (l[0][0] > 0) l.unshift([0, l[0][1]]);
    if (l[l.length - 1][0] < 1) l.push([1, l[l.length - 1][1]]);
    for (let i = 1; i < l.length; i++) if (l[i][0] < l[i - 1][0]) l[i][0] = l[i - 1][0];
    return { v: l.map((p) => p[1]).join(';'), t: l.map((p) => p[0]).join(';'), n: l.length };
  }
  const EASE = '0.45 0 0.2 1'; // eased in, settling slowly
  const calc = (n) => ` calcMode="spline" keySplines="${Array(n - 1).fill(EASE).join(';')}"`;
  const anim = (D, attr, list) => {
    const k = frames(list);
    return `<animate attributeName="${attr}" dur="${D}s" ${REP} values="${k.v}" keyTimes="${k.t}"${calc(k.n)}/>`;
  };
  const op = (D, list) => anim(D, 'opacity', list);
  // Seen from a to b, fading in over e and out over e2.
  const during = (D, a, b, e = 0.05, e2 = e) => op(D, [[a, 0], [a + e, 1], [b, 1], [b + e2, 0]]);
  const tf = (D, type, list) => {
    const k = frames(list);
    return `<animateTransform attributeName="transform" type="${type}" dur="${D}s" ${REP} values="${k.v}" keyTimes="${k.t}"${calc(k.n)}/>`;
  };
  const along = (D, d, list) => {
    const k = frames(list);
    return `<animateMotion dur="${D}s" ${REP} path="${d}" keyPoints="${k.v}" keyTimes="${k.t}"${calc(k.n)}/>`;
  };

  // ---- placing the kit's devices ----
  const KIND = { win: 'winPc', mac: 'macBook', linux: 'linuxPc', android: 'phone' };
  const ASPECT = { win: 1.27, mac: 1.57, linux: 1.48, android: 0.5 };
  const WOS = (me) => (me === 'win' || me === 'mac' || me === 'linux' ? me : 'win');
  // A device of that OS, w wide (its height from its shape), its bottom at `bottom`: its box, the screen's content
  // area (below / above its bars) and a drawer.
  function place(K, os, x, bottom, w) {
    const h = os === 'android' ? w * 2 : w / ASPECT[os];
    const y = bottom - h;
    const kind = KIND[os];
    return {
      os, x, y, w, h,
      scr: K.screen(kind, x, y, w, h),
      draw: (o = {}) => (os === 'android' ? K.phone(x, y, w, h, o) : K.computer(os, x, y, w, h, o)),
    };
  }
  // The floor: one hairline under the devices, clear at both ends.
  const floor = (K, x, y, w) => `<rect x="${f(x)}" y="${f(y + 0.2)}" width="${f(w)}" height="0.6" fill="${K.ref('edge')}" opacity="0.28"/>`;
  // A window's outline style for this OS.
  const winOs = (os) => (os === 'win' || os === 'mac' || os === 'linux' ? os : 'plain');

  // =====================================================================================================
  // Notifications: the phone small on the left, the computer on the right, on one floor. The phone wakes with a
  // notification; a moment later the same one slides in on the computer as one quiet glass toast where this OS
  // puts them (top right on a Mac, bottom right on Windows, top middle on Linux), its dot in the accent. It rests,
  // slides away, the phone sleeps again.
  A.notifications = (id, K) => {
    const D = 8;
    const me = WOS(K.os().me);
    const FL = 192;
    const cw = { win: 186, mac: 214, linux: 204 }[me];
    const pw = 48;
    const gap = 42;
    const x0 = 200 - (pw + gap + cw) / 2;
    const P = place(K, 'android', x0, FL, pw);
    const C = place(K, me, x0 + pw + gap, FL, cw);

    // The phone: a quiet lock screen (the time as one bar); the notification card wakes it.
    const pa = P.scr;
    const pCard = [pa.x + pa.w * 0.09, pa.y + pa.h * 0.3, pa.w * 0.82, pa.h * 0.14];
    const pContent = bar(pa.x + pa.w * 0.32, pa.y + pa.h * 0.13, pa.w * 0.36, Math.max(1, pa.w * 0.045), 0.32)
      + bar(pa.x + pa.w * 0.4, pa.y + pa.h * 0.19, pa.w * 0.2, 0.8, 0.12)
      + `<g opacity="0">${during(D, 0.06, 0.8, 0.04, 0.06)}<g>${tf(D, 'translate', [[0.06, '0 -3'], [0.12, '0 0']])}`
      + rect(...pCard, pCard[3] * 0.32, `fill="#fff" fill-opacity="0.07" ${hair(0.14, 0.5)}`)
      + circ(pCard[0] + pCard[3] * 0.5, pCard[1] + pCard[3] / 2, pCard[3] * 0.17, 'fill="#fff" fill-opacity="0.55"')
      + bar(pCard[0] + pCard[3], pCard[1] + pCard[3] * 0.3, pCard[2] * 0.5, 1, 0.42)
      + bar(pCard[0] + pCard[3], pCard[1] + pCard[3] * 0.58, pCard[2] * 0.32, 1, 0.18) + '</g></g>'
      // The screen wakes a little while the notification is there.
      + rect(pa.x, pa.y - pa.h * 0.1, pa.w, pa.h * 1.2, 0, 'fill="#fff" fill-opacity="0.035" opacity="0"', during(D, 0.06, 0.8, 0.04, 0.06));

    // The computer: one window, out of the toast's way.
    const ca = C.scr;
    const right = me !== 'linux';
    const win = me === 'linux'
      ? [ca.x + ca.w * 0.2, ca.y + ca.h * 0.34, ca.w * 0.6, ca.h * 0.54]
      : [ca.x + ca.w * 0.08, ca.y + ca.h * 0.14, ca.w * 0.5, ca.h * 0.68];
    const cContent = K.window(...win, { os: winOs(me), body: 'lines' });

    // The toast: where this OS puts it.
    const tw = ca.w * 0.34;
    const th = ca.h * 0.15;
    const m = ca.w * 0.04;
    const tx = right ? ca.x + ca.w - tw - m : ca.x + (ca.w - tw) / 2;
    const ty = me === 'win' ? ca.y + ca.h - th - m : ca.y + m * 0.9;
    const from = right ? `${f(tw * 0.25)} 0` : `0 ${f(-th * 0.7)}`;
    const T_IN = 0.13;
    const T_OUT = 0.8;
    const t = Math.max(0.9, th * 0.1);
    const toast = `<g opacity="0">${during(D, T_IN, T_OUT, 0.06, 0.06)}<g>${tf(D, 'translate', [[T_IN, from], [T_IN + 0.09, '0 0'], [T_OUT, '0 0'], [T_OUT + 0.07, from]])}`
      + ell(tx + tw / 2, ty + th * 0.6, tw * 0.62, th * 0.9, `fill="${K.ref('r-f1')}" opacity="0.45"`)
      + rect(tx, ty, tw, th, th * 0.3, `fill="${GLASS}" fill-opacity="0.96" ${hair(0.22, 0.6)}`)
      + rect(tx + th * 0.3, ty - 0.3, tw - th * 0.6, 0.6, 0, `fill="${K.ref('edge')}" opacity="0.6"`)
      + circ(tx + th * 0.5, ty + th / 2, th * 0.17, 'class="ka-f1" opacity="0.9"')
      + bar(tx + th * 0.95, ty + th * 0.32, tw * 0.46, t, 0.5)
      + bar(tx + th * 0.95, ty + th * 0.58, tw * 0.3, t, 0.2) + '</g></g>';

    return floor(K, 30, FL, 340) + P.draw({ content: pContent }) + C.draw({ content: cContent + toast });
  };

  // =====================================================================================================
  // Calls: the computer alone in the middle, the phone tucked in front of its corner. The phone rings — two
  // hairline rings go out from its contact — then the call is on the computer: the contact's ring over a voice
  // line in the accent, which breathes slowly while they talk. The call ends, the phone's screen goes back.
  A.calls = (id, K) => {
    const D = 8;
    const me = WOS(K.os().me);
    const FL = 194;
    const cw = { win: 184, mac: 214, linux: 204 }[me];
    const pw = 40;
    const C = place(K, me, 200 - (cw + pw * 0.7) / 2, FL, cw);
    const P = place(K, 'android', C.x + cw - pw * 0.3, FL + 8, pw);

    // When: rings at R1 and R2, the call on the computer from T_ON, the voice drawn on, the end at T_END.
    const R1 = 0.01;
    const R2 = 0.08;
    const T_ON = 0.13;
    const T_END = 0.84;

    // The computer's screen: the call, centred (left of the phone that stands in front of its corner).
    const ca = C.scr;
    const cx = ca.x + ca.w * 0.44;
    const ar = ca.h * 0.115;
    const ay = ca.y + ca.h * 0.3;
    const wy = ay + ar + ca.h * 0.25;
    const ww = ca.w * 0.42;
    const wave = (amp) => {
      // A smooth voice line: five swells of amplitude amp (0..1), the middle ones tallest.
      const n = 10;
      const env = [0.15, 0.35, 0.6, 0.85, 1, 0.9, 0.7, 0.45, 0.25, 0.1];
      const h = ca.h * 0.075;
      let d = `M${f(cx - ww / 2)} ${f(wy)}`;
      for (let i = 0; i < n; i++) {
        const x1 = cx - ww / 2 + (ww * (i + 0.5)) / n;
        const x2 = cx - ww / 2 + (ww * (i + 1)) / n;
        const y1 = wy + (i % 2 ? 1 : -1) * h * env[i] * amp * 2;
        d += `Q${f(x1)} ${f(y1)} ${f(x2)} ${f(wy)}`;
      }
      return d;
    };
    const dVals = [[T_ON, wave(0.1)], [0.21, wave(0.75)], [0.33, wave(0.4)], [0.46, wave(0.95)], [0.58, wave(0.45)], [0.7, wave(0.85)], [0.8, wave(0.35)], [T_END + 0.04, wave(0.1)]];
    const person = (x, y, r, op_) => circ(x, y - r * 0.18, r * 0.3, hair(op_, 0.6))
      + `<path d="M${f(x - r * 0.55)} ${f(y + r * 0.62)}Q${f(x)} ${f(y + r * 0.02)} ${f(x + r * 0.55)} ${f(y + r * 0.62)}" ${hair(op_, 0.6)}/>`;
    const call = `<g opacity="0">${during(D, T_ON, T_END, 0.06, 0.05)}`
      + ell(cx, wy, ww * 0.62, ca.h * 0.16, `fill="${K.ref('r-f1')}" opacity="0.4"`)
      + circ(cx, ay, ar, `fill="#fff" fill-opacity="0.03" ${hair(0.34, 0.6)}`) + person(cx, ay, ar, 0.3)
      + bar(cx - ca.w * 0.07, ay + ar + ca.h * 0.08, ca.w * 0.14, Math.max(0.9, ca.h * 0.022), 0.34)
      + `<path d="${wave(0.05)}" pathLength="1" class="ka-st1" fill="none" stroke-width="0.9" stroke-linecap="round" stroke-dasharray="1 1" stroke-dashoffset="1" opacity="0.85">`
      + anim(D, 'stroke-dashoffset', [[T_ON + 0.01, 1], [T_ON + 0.075, 0], [0.99, 0], [1, 1]])
      + anim(D, 'd', dVals.map(([tt, d]) => [tt, d])) + '</path>'
      // The end-call mark: one small hairline pill under it.
      + rect(cx - ca.w * 0.035, wy + ca.h * 0.13, ca.w * 0.07, ca.h * 0.045, ca.h * 0.0225, hair(0.24, 0.55))
      + '</g>';

    // The phone: the incoming call (its contact and two quiet buttons), dimmed once the computer has it.
    const pa = P.scr;
    const px = pa.x + pa.w / 2;
    const py = pa.y + pa.h * 0.3;
    const pr = pa.w * 0.17;
    const pContent = `<g>${op(D, [[T_ON, 1], [T_ON + 0.06, 0.35], [T_END, 0.35], [T_END + 0.06, 1]])}`
      + circ(px, py, pr, `fill="#fff" fill-opacity="0.04" ${hair(0.32, 0.5)}`) + person(px, py, pr, 0.28)
      + bar(px - pa.w * 0.18, py + pr + pa.h * 0.06, pa.w * 0.36, 1, 0.3)
      + circ(pa.x + pa.w * 0.27, pa.y + pa.h * 0.82, pa.w * 0.075, hair(0.3, 0.5))
      + circ(pa.x + pa.w * 0.73, pa.y + pa.h * 0.82, pa.w * 0.075, 'fill="#fff" fill-opacity="0.42"') + '</g>';
    // The rings: two hairlines opening out from the phone's contact, over the glass (not clipped to it).
    const ring = (t0) => circ(px, py, pr, `${hair(0.7, 0.6)} opacity="0"`,
      anim(D, 'r', [[t0, pr], [t0 + 0.16, pr * 4]]) + op(D, [[t0, 0], [t0 + 0.015, 0.8], [t0 + 0.07, 0.55], [t0 + 0.16, 0]]));

    // A soft shadow where the phone stands in front.
    const shadow = ell(P.x + pw / 2, FL + 8.5, pw * 0.7, 2.2, 'fill="#000" opacity="0.7"');
    return floor(K, 40, FL, 320) + C.draw({ content: call }) + shadow + P.draw({ content: pContent }) + ring(R1) + ring(R2);
  };

  // =====================================================================================================
  // Messages: the same thread on both, the phone standing tall beside the computer. A reply is typed in the
  // computer's message field, rises into the thread outlined in the accent, and a beat later appears in the
  // phone's thread too. It rests; the new message clears and the round starts again.
  A.messages = (id, K) => {
    const D = 8;
    const me = WOS(K.os().me);
    const FL = 196;
    const cw = { win: 172, mac: 196, linux: 186 }[me];
    const pw = 64;
    const gap = 44;
    const x0 = 200 - (cw + gap + pw) / 2;
    const C = place(K, me, x0, FL, cw);
    const P = place(K, 'android', x0 + cw + gap, FL, pw);

    const T_TYPE = 0.03;
    const T_SEND = 0.12;
    const T_PHONE = 0.16;
    const T_CLEAR = 0.84;

    // A thread in box b: [mine, width part] rows, h the bubble height; the new reply is the last row.
    function thread(b, h, rows, newRow) {
      let out = '';
      const gapY = h * 0.55;
      rows.forEach(([mine, wp], i) => {
        const w = b.w * wp;
        out += rect(mine ? b.x + b.w - w : b.x, b.y + i * (h + gapY), w, h, h / 2, `fill="#fff" fill-opacity="${mine ? 0.11 : 0.055}"`);
      });
      const w = b.w * newRow;
      return { out, at: [b.x + b.w - w, b.y + rows.length * (h + gapY), w, h] };
    }
    const reply = (r, h) => rect(...r, h / 2, `fill="#fff" fill-opacity="0.06" class="ka-st1" stroke-width="0.7" stroke-opacity="0.9"`)
      + bar(r[0] + h * 0.55, r[1] + h / 2 - Math.max(0.5, h * 0.09), r[2] - h * 1.1, Math.max(1, h * 0.18), 0.5);

    // The computer: a Messages window, its field at the bottom.
    const ca = C.scr;
    const W = [ca.x + ca.w * 0.12, ca.y + ca.h * 0.1, ca.w * 0.76, ca.h * 0.78];
    let cNew = '';
    const cContent = K.window(...W, {
      os: winOs(me),
      body: (b) => {
        const h = b.h * 0.13;
        const th = thread({ x: b.x, y: b.y + h * 0.2, w: b.w, h: b.h }, h, [[false, 0.52], [true, 0.4]], 0.5);
        // The field: a hairline pill; the reply is typed into it (a bar growing), then sent.
        const fy = b.y + b.h - h * 1.05;
        const fh = h * 0.95;
        const fieldBar = `<rect x="${f(b.x + fh * 0.5)}" y="${f(fy + fh / 2 - 0.6)}" width="0" height="1.2" rx="0.6" fill="#fff" fill-opacity="0.45">`
          + anim(D, 'width', [[T_TYPE, 0], [T_SEND - 0.02, b.w * 0.42], [T_SEND, b.w * 0.42], [T_SEND + 0.001, 0]]) + '</rect>';
        // The reply: from the field up into the thread.
        const dy = fy - th.at[1];
        cNew = `<g opacity="0">${op(D, [[T_SEND, 0], [T_SEND + 0.03, 1], [T_CLEAR, 1], [T_CLEAR + 0.05, 0]])}`
          + `<g>${tf(D, 'translate', [[T_SEND, `0 ${f(dy)}`], [T_SEND + 0.08, '0 0']])}${reply(th.at, h)}</g></g>`;
        return th.out + rect(b.x, fy, b.w, fh, fh / 2, hair(0.14, 0.5)) + fieldBar;
      },
    });

    // The phone: the same thread, the reply appearing a beat later.
    const pa = P.scr;
    const pb = { x: pa.x + pa.w * 0.1, y: pa.y + pa.h * 0.12, w: pa.w * 0.8, h: pa.h };
    const ph = pa.h * 0.07;
    const pth = thread(pb, ph, [[false, 0.66], [true, 0.52]], 0.62);
    const pContent = bar(pa.x + pa.w * 0.1, pa.y + pa.h * 0.03, pa.w * 0.3, 1, 0.3) // the contact's name
      + rect(pa.x, pa.y + pa.h * 0.075, pa.w, 0.4, 0, 'fill="#fff" fill-opacity="0.07"')
      + pth.out
      + `<g opacity="0">${op(D, [[T_PHONE, 0], [T_PHONE + 0.04, 1], [T_CLEAR, 1], [T_CLEAR + 0.05, 0]])}`
      + `<g>${tf(D, 'translate', [[T_PHONE, `0 ${f(ph * 0.8)}`], [T_PHONE + 0.07, '0 0']])}${reply(pth.at, ph)}</g></g>`
      + rect(pa.x + pa.w * 0.1, pa.y + pa.h * 0.85, pa.w * 0.8, ph, ph / 2, hair(0.14, 0.5));

    return floor(K, 30, FL, 340) + C.draw({ content: cContent + cNew }) + P.draw({ content: pContent });
  };

  // =====================================================================================================
  // Media: the phone held up at a slight angle beside the computer, its photos a quiet grid. One photo — its
  // outline in the accent — lifts out of the grid, drifts across in an arc and grows into the viewer on the
  // computer's screen, where it stays a while; then it clears.
  A.media = (id, K) => {
    const D = 8;
    const me = WOS(K.os().me);
    const FL = 194;
    const cw = { win: 186, mac: 214, linux: 204 }[me];
    const pw = 52;
    const gap = 56;
    const x0 = 200 - (cw + gap + pw) / 2;
    const C = place(K, me, x0, FL, cw);
    // The phone: drawn upright at the origin, then turned a little and lifted.
    const P = place(K, 'android', 0, pw * 2, pw);
    const PX = x0 + cw + gap;
    const PY = FL - pw * 2 - 14;
    const TILT = 8;

    const T_LIFT = 0.05;
    const T_LAND = 0.24;
    const T_CLEAR = 0.84;

    // A photo: a frame with a hairline horizon of hills and a small sun, in a w x h box at x, y.
    const photo = (x, y, w, h, o = {}) => {
      const r = Math.min(w, h) * 0.08;
      const s = o.op == null ? 1 : o.op;
      return rect(x, y, w, h, r, o.accent ? `fill="#fff" fill-opacity="0.045" class="ka-st1" stroke-width="${o.sw || 0.7}" stroke-opacity="0.9"` + (o.nss ? ' vector-effect="non-scaling-stroke"' : '')
        : `fill="#fff" fill-opacity="${f(0.05 * s)}" ${hair(0.1 * s, 0.5)}`)
        + `<path d="M${f(x + w * 0.08)} ${f(y + h * 0.78)}L${f(x + w * 0.36)} ${f(y + h * 0.46)}L${f(x + w * 0.52)} ${f(y + h * 0.62)}L${f(x + w * 0.66)} ${f(y + h * 0.5)}L${f(x + w * 0.92)} ${f(y + h * 0.78)}" fill="none" stroke="#fff" stroke-opacity="${f(0.32 * s)}" stroke-width="${o.sw || 0.6}" stroke-linejoin="round"${o.nss ? ' vector-effect="non-scaling-stroke"' : ''}/>`
        + circ(x + w * 0.72, y + h * 0.28, Math.min(w, h) * 0.08, `fill="#fff" fill-opacity="${f(0.4 * s)}"`);
    };

    // The phone's grid: 2 x 3 photos; the one that goes is the first of the second row, a gap while it's away.
    const pa = P.scr;
    const g = pa.w * 0.07;
    const tw = (pa.w - g * 3) / 2;
    const grid = [];
    for (let i = 0; i < 6; i++) grid.push([pa.x + g + (i % 2) * (tw + g), pa.y + pa.h * 0.12 + Math.floor(i / 2) * (tw + g), tw, tw]);
    const GO = 2;
    let pContent = bar(pa.x + g, pa.y + pa.h * 0.045, pa.w * 0.32, 1.1, 0.32);
    grid.forEach((r, i) => {
      // Plain tiles, a little lighter or darker each; only the one in flight shows its picture.
      const tileEl = rect(...r, r[2] * 0.1, `fill="#fff" fill-opacity="${[0.07, 0.045, 0.09, 0.05, 0.04, 0.065][i]}"`);
      if (i !== GO) pContent += tileEl;
      else pContent += `<g>${op(D, [[T_LIFT, 1], [T_LIFT + 0.02, 0], [T_CLEAR + 0.04, 0], [T_CLEAR + 0.09, 1]])}${tileEl}</g>`;
    });
    const phone = `<g transform="translate(${f(PX)} ${f(PY)}) rotate(${TILT} ${f(pw / 2)} ${f(pw)})">${P.draw({ content: pContent })}</g>`;
    // Where the photo starts, in the picture's units (the phone turned and lifted).
    const rad = (TILT * Math.PI) / 180;
    const tile = grid[GO];
    const lx = tile[0] + tile[2] / 2 - pw / 2;
    const ly = tile[1] + tile[3] / 2 - pw;
    const sx = PX + pw / 2 + lx * Math.cos(rad) - ly * Math.sin(rad);
    const sy = PY + pw + lx * Math.sin(rad) + ly * Math.cos(rad);

    // The computer: a viewer window; the photo lands in it, large.
    const ca = C.scr;
    const W = [ca.x + ca.w * 0.1, ca.y + ca.h * 0.1, ca.w * 0.8, ca.h * 0.78];
    let dst = null;
    const cContent = K.window(...W, {
      os: winOs(me),
      body: (b) => {
        const h = b.h * 0.86;
        const w = Math.min(b.w * 0.8, h * 1.45);
        dst = [b.x + (b.w - w) / 2, b.y + (b.h - h) / 2, w, h];
        return '';
      },
    });
    const landed = `<g opacity="0">${op(D, [[T_LAND - 0.005, 0], [T_LAND, 1], [T_CLEAR, 1], [T_CLEAR + 0.05, 0]])}${photo(...dst, { accent: true, sw: 0.7 })}</g>`;

    // In flight: the photo, drawn at its landed size about its centre, from the tile's size up to that, on an arc.
    const dx = dst[0] + dst[2] / 2;
    const dy = dst[1] + dst[3] / 2;
    const s0 = tile[2] / dst[2];
    const path = `M${f(sx)} ${f(sy)}Q${f((sx + dx) / 2)} ${f(Math.min(sy, dy) - 46)} ${f(dx)} ${f(dy)}`;
    const flying = `<g opacity="0">${op(D, [[T_LIFT, 0], [T_LIFT + 0.02, 1], [T_LAND - 0.005, 1], [T_LAND, 0]])}${along(D, path, [[T_LIFT, 0], [T_LAND, 1]])}`
      + ell(0, dst[3] * 0.18, dst[2] * 0.35, dst[3] * 0.4, `fill="${K.ref('r-f1')}" opacity="0.35"`)
      + `<g>${tf(D, 'rotate', [[T_LIFT, TILT], [T_LAND, 0]])}<g>${tf(D, 'scale', [[T_LIFT, f(s0 * 1.08)], [T_LAND, 1]])}`
      + rect(-dst[2] / 2, -dst[3] / 2, dst[2], dst[3], Math.min(dst[2], dst[3]) * 0.08, `fill="${GLASS}"`)
      + photo(-dst[2] / 2, -dst[3] / 2, dst[2], dst[3], { accent: true, nss: true, sw: 0.7 }) + '</g></g></g>';

    const shadow = ell(PX + pw / 2 + 4, FL - 1, pw * 0.5, 1.8, 'fill="#000" opacity="0.6"');
    return floor(K, 30, FL, 340) + C.draw({ content: cContent + landed }) + shadow + phone + flying;
  };
})();
