// TwinDesk — Copyright (C) 2026 inukaasith. GPL-3.0, see LICENSE.
// The connected phone's wireless debugging (Mac, PC and Linux), on the Connection page: its state,
// the steps to turn it on, pairing with the phone's code (typed here or in TwinDesk's notification
// there) or its QR code, and the full app over the standard one. Was on the Phone page.
// UI.adbCard() → {el, update(state)}; the card hides itself without a connected phone.
'use strict';
var tr = (k, p, d) => (typeof t === 'function' ? t(k, p, d) : (d || k));

UI.adbCard = () => {
  const { el, api } = UI;
  const STATES = {
    ready: ['good', tr('adb.ready', null, 'Ready')], connecting: ['muted', tr('adb.connecting', null, 'Connecting…')], needsPair: ['bad', tr('adb.needs_pair', null, 'Not paired')],
    waitingWifi: ['bad', tr('adb.off', null, 'Off')], missing: ['bad', tr('adb.missing', null, 'Missing')], error: ['bad', tr('adb.problem', null, 'Problem')], off: ['muted', '—'],
  };
  const pill = el('span', { class: 'pill muted' });
  const retry = UI.button(tr('phone.try_again', null, 'Try Again'), () => api.phoneRetry(), 'small');
  const row = UI.row(tr('adb.title', null, 'Wireless debugging'), '', [pill, retry]);
  let howOpen = false;
  const howBtn = UI.button(tr('adb.show_steps', null, 'Show steps'), () => { howOpen = !howOpen; UI.state && update(UI.state); }, 'small');
  row.querySelector('.controls').prepend(howBtn);
  const how = el('ol', { class: 'how-steps' }, [
    tr('adb.step1', null, 'On the phone, open Settings › About phone and tap Build number seven times.'),
    tr('adb.step2', null, 'Open Settings › Developer options and turn on USB debugging.'),
    tr('adb.step3', null, 'Turn on Wireless debugging on the same page. The phone needs a Wi-Fi network.'),
    tr('adb.step4', null, 'Tap Pair device with pairing code and enter the code below, or tap Pair device with QR code and scan the QR code here.'),
    tr('adb.step5', null, 'After the first pairing, DuoDesk turns wireless debugging on by itself.'),
  ].map((t) => el('li', { text: t })));

  const code = el('input', { type: 'text', placeholder: tr('adb.pairing_code_placeholder', null, '123456'), maxLength: 7, inputMode: 'numeric', autocomplete: 'off', spellcheck: false, attrs: { 'aria-label': tr('adb.pairing_code_aria', null, 'Pairing code') } });
  const where = el('input', { type: 'text', placeholder: tr('adb.address_placeholder', null, 'Address:port (optional)'), autocomplete: 'off', spellcheck: false, attrs: { 'aria-label': tr('adb.address_aria', null, 'Pairing address') } });
  const pairBtn = UI.button(tr('adb.pair_btn', null, 'Pair'), () => api.phonePair({ code: code.value.replace(/\D/g, ''), where: where.value }), 'small primary'); // "123 456", "123-456" too
  code.onkeydown = where.onkeydown = (e) => { if (e.key === 'Enter') pairBtn.click(); };
  const pairRow = UI.row(tr('adb.pairing_code_row', null, 'Pairing code'), tr('adb.pairing_code_hint', null, 'From the phone’s Pair device with pairing code, or type it in DuoDesk’s notification there'), [code, where, pairBtn]);

  // Android's own Pair device with QR code (shared/adbqr.js): only where this computer can do it.
  const qr = UI.adbQr ? UI.adbQr() : null;

  const fullBtn = UI.button(tr('hub.install', null, 'Install'), () => api.phoneInstallFull(), 'small primary');
  const fullRow = UI.row(tr('adb.notifs_row', null, 'Notifications from the phone'), '', [fullBtn]);
  const steps = UI.note('info', '');
  const card = UI.card(tr('adb.title', null, 'Wireless debugging'), [row, how, pairRow].concat(qr ? [qr.el] : [], [steps, fullRow]));

  function update(s) {
    const ph = s.phone || {};
    const c = ph.connected;
    card.hidden = !c;
    if (!c) return;
    const br = ph.bridge || { state: 'off' };
    const ready = br.state === 'ready';
    const off = br.state === 'waitingWifi';
    const [cls, label] = STATES[br.state] || STATES.off;
    pill.className = 'pill ' + (ready && br.inputBlocked ? 'bad' : cls);
    pill.textContent = ready && br.inputBlocked ? tr('adb.touch_blocked', null, 'Touch blocked') : label;
    retry.hidden = ready;
    row.setHint(off ? (/direct Wi-Fi/.test(br.message) ? br.message : tr('adb.hint_off_phone', null, 'Off on the phone. Mirroring and ADB control need it; Accessibility control doesn’t.'))
      : ready && br.inputBlocked ? tr('adb.hint_blocked_xiaomi', null, 'The screen works, but this Xiaomi blocks input. On the phone: Developer options › USB debugging (Security settings).')
        : ready ? tr('adb.hint_ready', null, 'Screen, apps, touch and keyboard, and the clipboard in the background') : br.message || '');
    const pairable = br.state === 'needsPair' || !!br.canPair;
    howBtn.hidden = ready;
    howBtn.textContent = howOpen ? tr('adb.hide_steps', null, 'Hide steps') : tr('adb.show_steps', null, 'Show steps');
    how.hidden = ready || !howOpen;
    pairRow.hidden = !pairable;
    steps.set(br.state === 'needsPair' ? tr('adb.steps_info', null, 'DuoDesk pairs with the phone’s wireless debugging once. After that, mirroring, phone apps and ADB control work without this step.') : '');
    if (qr) qr.update(s, pairable);
    if (UI.adbBle && UI.adbBle(s, card, row, pill)) {
      steps.set('');
      pairRow.hidden = how.hidden = howBtn.hidden = true;
      if (qr) qr.el.hidden = true;
    }

    // The standard build can't read notifications (Play Protect blocks downloaded apps that do).
    const full = !ph.adb || ph.adb.full !== false;
    const inst = br.install;
    fullRow.hidden = full && !(inst && inst.state === 'done');
    fullBtn.hidden = full;
    fullBtn.disabled = !ready || !br.fullApk || (inst && inst.state === 'installing');
    fullRow.setHint(inst && inst.state !== 'failed' && inst.message ? inst.message
      : !br.fullApk ? tr('adb.no_android_apk', null, 'This build of DuoDesk doesn’t include the Android app.')
        : tr('adb.full_apk_hint', { error: inst && inst.state === 'failed' ? `${inst.message} ` : '', wireless: ready ? '' : tr('adb.needs_wireless_suffix', null, ' Needs wireless debugging.') }, `${inst && inst.state === 'failed' ? `${inst.message} ` : ''}The downloaded app can’t read notifications. Install the full app over it; settings and pairing stay.${ready ? '' : ' Needs wireless debugging.'}`));
  }
  return { el: card, update };
};
