// DuoDesk — PageFX: the Tip and Feedback pages' personalities. Based on TwinDesk — Copyright (C) 2026 inukaasith. GPL-3.0, see LICENSE.
// Minimal (see the MINIMAL art direction): a quiet glass strip at the top of each page's body, one hairline
// motif, the page accent on the one thing that matters.
//   Tip       a hairline heart drawn in on entry; a small coin (the accent) rests in it and swells slowly.
//             The figure is the amount picked below ("$10 / month"), the caption who it goes to; the
//             supporters count on the right. When the checkout opens, the heart fills faintly once.
//   Feedback  a hairline speech bubble; its two lines grow with the message, the caret at the end of the
//             last one is the accent. The figure is the kind (Bug / Idea / Love it), the caption where it
//             goes; the character count on the right. When the mail app opens, a tick replaces the caret.
// Data: UI.support (shared/ui-support.js) and its 'duodesk-support' window event, not the app state.
// CSP: CSSOM and classes only. Positions that carry data are SVG attributes (reduced motion clears
// transforms inside .pg-hdr).
'use strict';

(() => {
  const FX = window.PageFX;
  if (!FX || FX._support) return;
  FX._support = true;
  const UI = window.UI || {};
  const snap = (id) => (UI.support && UI.support[id]) || {};

  // ---------------------------------------------------------------------------------------------------
  // Tip: heart + coin
  // ---------------------------------------------------------------------------------------------------
  FX.register('tip', (() => {
    let r = null;
    function build(page, ctx) {
      const { el, svg } = ctx;
      const h = ctx.hdr(page, { cls: 'spx spx-tip' });
      const heart = ctx.svgRoot('0 0 40 40', 'spx-heart', [
        svg('path', { class: 'spx-heart-fill', d: 'M20 33C12.4 28.2 7 23.1 7 17.2a6.4 6.4 0 0 1 13-3.6 6.4 6.4 0 0 1 13 3.6c0 5.9-5.4 11-13 15.8z' }),
        svg('path', { class: 'spx-heart-line pg-draw', pathLength: '1', d: 'M20 33C12.4 28.2 7 23.1 7 17.2a6.4 6.4 0 0 1 13-3.6 6.4 6.4 0 0 1 13 3.6c0 5.9-5.4 11-13 15.8z' }),
        svg('circle', { class: 'spx-coin', cx: '20', cy: '21', r: '3' }),
        svg('path', { class: 'spx-coin-mark', d: 'M20 19.6v2.8' }),
      ]);
      const art = el('div', 'spx-art', [heart]);
      const fig = el('span', 'pg-fig spx-fig');
      const per = el('small', 'spx-per');
      const kick = el('span', 'pg-kick spx-kick');
      const cap = el('span', 'pg-cap spx-cap');
      const left = el('div', 'pg-col spx-text', [el('div', 'spx-figline', [fig, per]), kick, cap]);
      const n = el('span', 'pg-fig spx-n');
      const nk = el('span', 'pg-kick', 'supporters');
      const right = el('div', 'pg-col spx-side', [n, nk]);
      h.replaceChildren(art, left, el('div', 'pg-spacer'), right);
      ctx.stagger([art, left, right]);
      return { h, heart, fig, per, kick, cap, n, nk };
    }
    function paint(ctx, d) {
      if (!r) return;
      const st = d.state || 'loading';
      ctx.text(r.fig, st === 'offline' ? 'Offline' : d.label || (st === 'loading' ? '…' : '–'));
      ctx.text(r.per, d.label && d.monthly ? '/ month' : '');
      ctx.text(r.kick, st === 'offline' ? 'can’t reach the tip jar' : st === 'opened' ? 'checkout opened in your browser' : d.monthly ? 'monthly tip' : 'one-time tip');
      ctx.text(r.cap, d.name ? 'to ' + d.name + ' · through Stripe' : 'through Stripe');
      ctx.text(r.n, d.count != null ? String(d.count) : '–');
      ctx.text(r.nk, d.count === 1 ? 'supporter' : 'supporters');
      ctx.cls(r.h, 'off', st === 'offline');
      ctx.cls(r.h, 'monthly', !!d.monthly);
      if (st === 'opened' && ctx.changed('opened', d.at || 0)) ctx.pop(r.h, 'spx-thanks', 2400);
    }
    const onEvent = (e) => { if (e.detail && e.detail.page === 'tip') paint(FX.ctx('tip'), e.detail); };
    return {
      mount(page, ctx) {
        r = build(page, ctx);
        window.removeEventListener('duodesk-support', onEvent);
        window.addEventListener('duodesk-support', onEvent);
        paint(ctx, snap('tip'));
      },
      enter(page, ctx) { paint(ctx, snap('tip')); },
      update(s, page, ctx) { paint(ctx, snap('tip')); },
    };
  })());

  // ---------------------------------------------------------------------------------------------------
  // Feedback: speech bubble
  // ---------------------------------------------------------------------------------------------------
  FX.register('feedback', (() => {
    let r = null;
    const X0 = 12;
    const X1 = 30; // the lines run from X0 to at most X1
    function build(page, ctx) {
      const { el, svg } = ctx;
      const h = ctx.hdr(page, { cls: 'spx spx-fb' });
      const l1 = svg('line', { class: 'spx-ln', x1: String(X0), y1: '15', x2: String(X0 + 2), y2: '15' });
      const l2 = svg('line', { class: 'spx-ln', x1: String(X0), y1: '21', x2: String(X0), y2: '21' });
      const caret = svg('line', { class: 'spx-caret', x1: String(X0 + 1.5), y1: '18.2', x2: String(X0 + 1.5), y2: '23.8' });
      const tick = svg('path', { class: 'spx-tick', d: 'M15 18.5l3.2 3.2 6.6-6.6', pathLength: '1' });
      const bubble = ctx.svgRoot('0 0 40 40', 'spx-bubble', [
        svg('path', { class: 'spx-bubble-line pg-draw', pathLength: '1', d: 'M9 7.5h22a3 3 0 0 1 3 3v15a3 3 0 0 1-3 3H19l-6.5 5v-5H9a3 3 0 0 1-3-3v-15a3 3 0 0 1 3-3z' }),
        l1, l2, caret, tick,
      ]);
      const art = el('div', 'spx-art', [bubble]);
      const fig = el('span', 'pg-fig spx-fig');
      const kick = el('span', 'pg-kick spx-kick');
      const cap = el('span', 'pg-cap spx-cap', 'contact@beyond-media.ai · or a GitHub issue');
      const left = el('div', 'pg-col spx-text', [fig, kick, cap]);
      const n = el('span', 'pg-fig spx-n');
      const nk = el('span', 'pg-kick', 'characters');
      const right = el('div', 'pg-col spx-side', [n, nk]);
      h.replaceChildren(art, left, el('div', 'pg-spacer'), right);
      ctx.stagger([art, left, right]);
      return { h, l1, l2, caret, fig, kick, n };
    }
    function paint(ctx, d) {
      if (!r) return;
      const len = Math.max(0, d.length | 0);
      // the two lines fill with the first ~240 characters: line 1 first, then line 2
      const k = Math.min(1, len / 240);
      const w = X1 - X0;
      const a = Math.min(1, k * 2);
      const b = Math.max(0, k * 2 - 1);
      const x1 = X0 + Math.max(2, a * w);
      const x2 = X0 + b * w * 0.7;
      ctx.attr(r.l1, 'x2', x1.toFixed(1));
      ctx.attr(r.l2, 'x2', x2.toFixed(1));
      const onTwo = b > 0;
      const cx = (onTwo ? x2 : x1) + 1.6;
      ctx.attr(r.caret, 'x1', cx.toFixed(1));
      ctx.attr(r.caret, 'x2', cx.toFixed(1));
      ctx.attr(r.caret, 'y1', onTwo ? '18.2' : '12.2');
      ctx.attr(r.caret, 'y2', onTwo ? '23.8' : '17.8');
      ctx.text(r.fig, d.label || 'Bug');
      const sent = d.state === 'sent' || d.state === 'copied';
      ctx.text(r.kick, d.state === 'copied' ? 'copied to the clipboard' : d.state === 'sent' ? 'opened in your mail app' : d.info === false ? 'just your words' : 'with version and system info');
      ctx.text(r.n, String(len));
      ctx.cls(r.h, 'sent', sent);
      ctx.cls(r.h, 'love', d.kind === 'love');
      if (sent && ctx.changed('sent', d.at || 0)) ctx.pop(r.h, 'spx-thanks', 2400);
      if (!sent) ctx.forget('sent');
    }
    const onEvent = (e) => {
      if (!e.detail || e.detail.page !== 'feedback') return;
      // typing again after a send: back to writing
      if ((e.detail.state === 'sent' || e.detail.state === 'copied') && r && r.lastLen != null && e.detail.length !== r.lastLen) UI.support.feedback.state = '';
      if (r) r.lastLen = e.detail.length;
      paint(FX.ctx('feedback'), UI.support.feedback);
    };
    return {
      mount(page, ctx) {
        r = build(page, ctx);
        window.removeEventListener('duodesk-support', onEvent);
        window.addEventListener('duodesk-support', onEvent);
        paint(ctx, snap('feedback'));
      },
      enter(page, ctx) { paint(ctx, snap('feedback')); },
      update(s, page, ctx) { paint(ctx, snap('feedback')); },
    };
  })());
})();
