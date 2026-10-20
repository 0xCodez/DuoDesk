// TwinDesk — Copyright (C) 2026 inukaasith. GPL-3.0, see LICENSE.
// Mount tab: the phone's storage as a drive in Explorer (phonedrive.js). Off, TwinDesk doesn't look
// for the phone or touch its files at all; on, only Mount does, and only while it's mounted.
// Port of mac/ui-mount.js.
'use strict';

UI.tab({
  id: 'mount',
  wifiOnly: true, // over Bluetooth it can't work and doesn't move the session onto Wi-Fi: greyed out
  order: 55,
  title: 'Mount',
  icon: 'drive',
  color: 'linear-gradient(#ffd60a, #ff9f0a)',
  desc: 'The phone’s storage as a drive in Explorer, through the cable or wireless debugging.',
  master: { get: (s) => !!(s.mount && s.mount.on), set: (v) => UI.api.setMount({ on: v }) },
  badge: (s) => (s.mount && s.mount.mounted ? 'on' : ''),
  build(body) {
    const { api } = UI;
    const mountBtn = UI.button('Mount', () => api.phoneMount(), 'small primary');
    const showBtn = UI.button('Show', () => api.phoneMount(), 'small');
    const unmountBtn = UI.button('Unmount', () => api.phoneUnmount(), 'small');
    const driveRow = UI.row('Show the phone in Explorer', '', [mountBtn, showBtn, unmountBtn]);
    const offRow = UI.row('Off', 'TwinDesk never looks at the phone’s files');
    body.append(UI.card('Drive', [offRow, driveRow]));

    return (s) => {
      const d = s.mount || {};
      offRow.hidden = !!d.on;
      driveRow.hidden = !d.on;
      mountBtn.hidden = !!d.mounted;
      mountBtn.textContent = d.busy === 'mounting' ? 'Mounting…' : 'Mount';
      mountBtn.disabled = !!d.busy;
      showBtn.hidden = unmountBtn.hidden = !d.mounted;
      unmountBtn.disabled = !!d.busy;
      driveRow.setHint(d.message || (d.mounted ? `As a drive in This PC${/^[A-Z]:$/.test(d.mounted) ? ' (' + d.mounted + ')' : ''}, ${d.via === 'usb' ? 'through the cable' : 'over wireless debugging'}.`
        : 'Plug the phone in with USB debugging on, or connect it with wireless debugging, then Mount.'));
    };
  },
});
