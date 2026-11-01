// TwinDesk — Copyright (C) 2026 inukaasith. GPL-3.0, see LICENSE.
// Connection › Pair a phone with a QR code (Mac, PC and Linux): an extra way next to Found nearby
// and the code, which stay as they are. Show QR Code draws this computer's pairing link
// (twindesk://pair, main's qrPair: its addresses, port and a nonce that asks only for Allow here),
// scanned with the phone's camera or TwinDesk's Scan QR code (QrActivity.kt). Only where the app
// has it (api.qrPair) and Qr (shared/qr.js) is loaded. UI.qrPairCard() → {el, update(state)}
'use strict';

UI.qrPairCard = () => {
  const { el, api } = UI;
  const tr = (k, p, d) => (typeof t === 'function' ? t(k, p, d) : (d || k));
  if (!api.qrPair || !window.Qr) return null;
  let open = false;
  let url = '';
  let until = 0;
  const showBtn = UI.button(tr('qrpair.show', null, 'Show QR Code'), () => { open = !open; refresh(); }, 'small');
  const row = UI.row(tr('qrpair.title', null, 'Pair a phone with a QR code'), tr('qrpair.hint', null, 'Scan it with the phone’s camera, or with Scan QR code in DuoDesk on the phone'), [showBtn]);
  const img = el('div', { class: 'qr-img', attrs: { role: 'img', 'aria-label': tr('qrpair.aria_code', null, 'Pairing QR code') } });
  const note = el('div', { class: 'hint' });
  const box = el('div', { class: 'qr-box' }, [img, el('div', { class: 'qr-text' }, [
    el('strong', { text: tr('qrpair.scan_heading', null, 'Scan with your phone') }),
    el('ol', {}, [
      tr('qrpair.step1', null, 'Open the camera, or DuoDesk › Scan QR code.'),
      tr('qrpair.step2', null, 'Point it at this code and open the link.'),
      tr('qrpair.step3', null, 'Click Allow here when it asks.')
    ].map((t) => el('li', { text: t }))),
    note,
  ])]);
  box.hidden = true;
  const card = UI.card('', [row, box]);

  async function refresh() {
    showBtn.textContent = open ? tr('qrpair.hide', null, 'Hide') : tr('qrpair.show', null, 'Show QR Code');
    box.hidden = !open;
    if (!open) return;
    const v = await api.qrPair();
    if (!v || !v.url) {
      img.replaceChildren();
      note.textContent = (v && v.why) || tr('qrpair.not_ready', null, 'Not ready yet');
      return;
    }
    if (v.url !== url) {
      url = v.url;
      const c = window.Qr.canvas(url, 4);
      c.className = 'qr-canvas';
      img.replaceChildren(c);
    }
    until = v.until || 0;
    note.textContent = tr('qrpair.note', null, 'A new code comes every 10 minutes. Only someone who sees this screen can use it.');
  }
  // A code that ran out is drawn again while it's shown.
  setInterval(() => { if (open && until && Date.now() > until) refresh(); }, 15000);

  return {
    el: card,
    update(s) {
      // Hidden while a phone is connected (nothing to pair); Nearby's own rows stay either way.
      card.hidden = !!(s.phone && s.phone.connected);
      if (card.hidden && open) { open = false; refresh(); }
    },
  };
};
