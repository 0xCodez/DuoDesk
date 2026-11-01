// TwinDesk — Copyright (C) 2026 inukaasith. GPL-3.0, see LICENSE.
// Connection › Wireless debugging › Pair with a QR code (Mac, PC and Linux): next to the 6-digit
// code, which stays. Show QR Code starts it here (api.adbQr, shared/adbqr.js) and draws the code for
// the phone's Developer options › Wireless debugging › Pair device with QR code.
// Only where the app has it. UI.adbQr() → {el, update(state, pairable)}; used by shared/ui-adb.js.
'use strict';
var tr = (k, p, d) => (typeof t === 'function' ? t(k, p, d) : (d || k));

UI.adbQr = () => {
  const { el, api } = UI;
  if (!api.adbQr || !window.Qr) return null;
  let open = false;
  let drawn = '';
  const btn = UI.button(tr('adbqr.btn_show', null, 'Show QR Code'), () => { open = !open; api.adbQr(open); paint(UI.state); }, 'small');
  const row = UI.row(tr('adbqr.row_title', null, 'Pair with a QR code'), tr('adbqr.row_hint', null, 'On the phone: Wireless debugging › Pair device with QR code'), [btn]);
  const img = el('div', { class: 'qr-img', attrs: { role: 'img', 'aria-label': tr('adbqr.img_aria', null, 'Wireless debugging QR code') } });
  const note = el('div', { class: 'hint' });
  const box = el('div', { class: 'qr-box' }, [img, el('div', { class: 'qr-text' }, [
    el('strong', { text: tr('adbqr.scan_with_phone', null, 'Scan with the phone') }),
    el('ol', {}, [tr('adbqr.step1', null, 'Settings › Developer options › Wireless debugging.'), tr('adbqr.step2', null, 'Tap Pair device with QR code.'), tr('adbqr.step3', null, 'Scan this code. DuoDesk connects by itself.')].map((t) => el('li', { text: t }))),
    note,
  ])]);
  box.hidden = true;
  const wrap = el('div', {}, [row, box]);

  function paint(s) {
    const q = s && s.adbQr;
    btn.textContent = open ? tr('adbqr.btn_hide', null, 'Hide') : tr('adbqr.btn_show', null, 'Show QR Code');
    box.hidden = !open;
    if (!open) return;
    if (q && q.text && q.text !== drawn) {
      drawn = q.text;
      img.replaceChildren(window.Qr.canvas(q.text, 4));
    }
    if (q && q.done) {
      open = false;
      drawn = '';
      box.hidden = true;
      btn.textContent = tr('adbqr.btn_show', null, 'Show QR Code');
      row.setHint(q.done === 'paired' ? tr('adbqr.paired_connecting', null, 'Paired. Connecting…') : q.done === 'timeout' ? tr('adbqr.timeout', null, 'The QR code timed out. Show it again to retry.') : q.done.replace(/^failed: /, tr('adbqr.didnt_pair', null, 'Didn’t pair: ')));
      return;
    }
    note.textContent = q && q.text ? tr('adbqr.waiting_phone', null, 'Waiting for the phone…') : tr('adbqr.not_available', null, 'Wireless debugging isn’t available here.');
  }

  return {
    el: wrap,
    update(s, pairable) {
      wrap.hidden = !pairable;
      if (!pairable && open) { open = false; api.adbQr(false); }
      paint(s);
    },
  };
};
