// TwinDesk — Copyright (C) 2026 inukaasith. GPL-3.0, see LICENSE.
// Mount tab: the phone's storage as a drive in Finder (phonedrive.js). Off, TwinDesk doesn't look
// for the phone or touch its files at all; on, only Mount does, and only while it's mounted.
'use strict';

UI.tab({
  id: 'mount',
  hidden: (s) => !UI.isPhone(s), // only while a phone is connected
  wifiOnly: true, // over Bluetooth it can't work and doesn't move the session onto Wi-Fi: says so, with Connect with Wi-Fi Direct
  group: 'Share',
  order: 55,
  title: 'Mount',
  desc: 'The phone’s storage as a drive in Finder, through ADB: the cable (USB debugging) or wireless debugging.',
  color: 'linear-gradient(#ffd60a, #ff9f0a)',
  badge: (s) => (s.mount && s.mount.mounted ? 'on' : ''),
  build(body) {
    const { api } = UI;
    const t = (k, p, d) => (typeof window.t === 'function' ? window.t(k, p, d) : d !== undefined ? d : k);
    const onSw = UI.switch((v) => api.setMount({ on: v }), { label: t('mount.phone_in_finder', null, 'Phone in Finder') });
    const onRow = UI.row(t('mount.phone_in_finder', null, 'Phone in Finder'), '', [onSw]);
    const mountBtn = UI.button(t('nav.mount', null, 'Mount'), () => api.phoneMount(), 'small primary');
    const showBtn = UI.button(t('mount.show', null, 'Show'), () => api.phoneMount(), 'small');
    const unmountBtn = UI.button(t('mount.unmount', null, 'Unmount'), () => api.phoneUnmount(), 'small');
    const driveRow = UI.row(t('mount.show_the_phone_in_finder', null, 'Show the phone in Finder'), '', [mountBtn, showBtn, unmountBtn]);
    // Mount is ADB: with the phone's debugging off it can't, and says so (Phone Files needs none).
    const adbText = UI.el('div', { class: 'hub-top-text' });
    const adbNote = UI.el('div', { class: 'note warn hub-top', hidden: true }, [UI.el('div', { class: 'hub-top-body' }, [adbText]),
      UI.el('div', { class: 'hub-top-actions' }, [UI.button(t('cursor.wireless_debugging', null, 'Wireless Debugging'), () => UI.go('connection'), 'small'), UI.button(t('mount.phone_files', null, 'Phone Files'), () => UI.go('pfiles'), 'small primary')])]);
    body.append(adbNote);
    body.append(UI.card(t('mount.finder', null, 'Finder'), [onRow, driveRow]));

    return (s) => {
      const d = s.mount || {};
      const ph = s.phone || {};
      const adb = ph.adb || {};
      const adbOff = !!ph.connected && !ph.connected.usb && !d.mounted && (adb.wifi === false || (ph.bridge && ph.bridge.state === 'waitingWifi'));
      adbNote.hidden = !d.on || !adbOff;
      adbText.textContent = adb.devOptions === false
        ? t('mount.adb_developer_options_off', null, 'Mount works through ADB, and Developer options are off on the phone. Switch on Developer options and Wireless debugging (Connection), or plug the phone in with USB debugging on. Phone Files works without it.')
        : t('mount.adb_wireless_debugging_off', null, 'Mount works through ADB, and wireless debugging is off on the phone. Switch it on (Connection), or plug the phone in with USB debugging on. Phone Files works without it.');
      onSw.set(!!d.on);
      driveRow.hidden = !d.on;
      mountBtn.hidden = !!d.mounted;
      mountBtn.textContent = d.busy === 'mounting' ? t('mount.mounting', null, 'Mounting…') : t('nav.mount', null, 'Mount');
      mountBtn.disabled = !!d.busy;
      showBtn.hidden = unmountBtn.hidden = !d.mounted;
      unmountBtn.disabled = !!d.busy;
      driveRow.setHint(d.message || (d.mounted ? (d.via === 'usb' ? t('mount.in_finder_via_cable', null, 'In Finder under Locations (through the cable).') : t('mount.in_finder_via_wireless', null, 'In Finder under Locations (over wireless debugging).'))
        : t('mount.plug_the_phone_in_with', null, 'Plug the phone in with USB debugging on, or connect it with wireless debugging, then Mount.')));
    };
  },
});
