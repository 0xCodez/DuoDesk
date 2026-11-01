// TwinDesk — Copyright (C) 2026 inukaasith. GPL-3.0, see LICENSE.
// The menu bar / tray menu, laid out the same on every platform (each main.js gives the model).
// Connected: the status, the way home, Cursor Sharing, then the switches by kind (Mouse and
// Keyboard, Screen, Clipboard and Sound, Files, Connection) and the app. Not connected: only
// connecting, the window, Quit.
//   template(m) -> an Electron menu template
//   m: {status, connected, home?(), shared: {checked, set(on)}, lock?: {label, checked, set},
//       keyboard: {checked, set}, drive: {label, checked, set}, driven?: {label, checked, set},
//       popup: {checked, set}, screen: [{label, checked, set}], clipboard: {checked, set},
//       sound: {checked, set}, drag: {checked, set}, shortcuts: {label, checked, set},
//       found: [{label, click}], byAddress(), lookAgain(), again?: {label, click},
//       disconnect?: {label, click}, update?: {label, click}, open(), log(), quit(),
//       rezume?: [{label, click}] (Continue …, Send … to: shared/rezume.js)}
'use strict';

const { t } = require('./i18n.js'); // the main process sets the language (settings.app.lang)

const check = (label, o) => ({ label, type: 'checkbox', checked: !!o.checked, click: (i) => o.set(i.checked) });
const sep = { type: 'separator' };

function connectTo(m) {
  return {
    label: t('tray.connect_to', null, 'Connect To'),
    submenu: [
      ...(m.found.length ? m.found : [{ label: t('tray.nobody_nearby', null, 'Nobody nearby'), enabled: false }]),
      sep,
      { label: t('tray.connect_by_address', null, 'Connect by Address…'), click: m.byAddress },
      { label: t('tray.look_again', null, 'Look Again'), click: m.lookAgain },
    ],
  };
}

function template(m) {
  const status = { label: m.status, enabled: false };
  if (!m.connected) {
    return [status, ...(m.again ? [m.again] : []), connectTo(m), sep, { label: t('tray.open_duodesk', null, 'Open DuoDesk…'), click: m.open }, { label: t('tray.quit', null, 'Quit DuoDesk'), click: m.quit }];
  }
  return [
    status,
    ...(m.home ? [{ label: t('tray.bring_back', null, 'Bring Mouse and Keyboard Back'), click: m.home }] : []),
    ...(m.rezume && m.rezume.length ? [...m.rezume, sep] : []),
    check(t('tray.cursor_sharing', null, 'Cursor Sharing'), m.shared),
    sep,
    {
      label: t('tray.mouse_keyboard', null, 'Mouse and Keyboard'),
      submenu: [
        check(t('tray.share_keyboard', null, 'Share Keyboard'), m.keyboard),
        ...(m.lock ? [check(m.lock.label, m.lock)] : []),
        sep,
        check(m.drive.label, m.drive),
        ...(m.driven ? [check(m.driven.label, m.driven)] : []),
        sep,
        check(t('tray.popup_switching', null, 'Show a Popup When Switching'), m.popup),
      ],
    },
    { label: t('tray.screen', null, 'Screen'), submenu: m.screen.map((x) => check(x.label, x)) },
    { label: t('tray.clipboard_sound', null, 'Clipboard and Sound'), submenu: [check(t('tray.share_clipboard', null, 'Share Clipboard'), m.clipboard), check(t('tray.send_sound', null, 'Send Sound'), m.sound)] },
    { label: t('tray.files', null, 'Files'), submenu: [check(t('tray.drag_files', null, 'Drag Files Across the Screen Edge'), m.drag), check(m.shortcuts.label, m.shortcuts)] },
    { label: t('tray.connection', null, 'Connection'), submenu: [...(m.disconnect ? [m.disconnect, sep] : []), connectTo(m)] },
    sep,
    ...(m.update ? [m.update] : []),
    { label: t('tray.open_duodesk', null, 'Open DuoDesk…'), click: m.open },
    { label: t('tray.open_log', null, 'Open Log Folder'), click: m.log },
    { label: t('tray.quit', null, 'Quit DuoDesk'), click: m.quit },
  ];
}

module.exports = { template };
