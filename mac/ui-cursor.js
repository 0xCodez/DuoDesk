// TwinDesk — Copyright (C) 2026 inukaasith. GPL-3.0, see LICENSE.
// Cursor tab: where the other computer is (the crossing map, shared/kvm-map-ui.js), directions,
// edge resistance, speed, scrolling.
'use strict';

UI.tab({
  id: 'cursor',
  group: 'Input',
  order: 20,
  title: 'Mouse',
  desc: 'Move the pointer off the edge of the screen to go to the other computer.',
  color: 'linear-gradient(#ffb340, #ff9500)',
  // One switch: cursor sharing, the same one the hotkey's double-tap and the other
  // computer flip (kvm.link keeps both in step). Through Bluetooth it is Over Bluetooth (kvm.setShared).
  master: { get: (s) => !!(s.kvm && s.kvm.mouse && s.kvm.linked !== false && !(s.input && s.input.paused)), set: (v) => UI.api.setKvm(v ? { mouse: true, shared: true } : { shared: false }) },
  badge: (s) => (s.kvm && s.kvm.mouse && s.kvm.linked !== false && !(s.input && s.input.paused) ? 'on' : ''),
  build(body) {
    const { el, api } = UI;
    const t = (k, p, d) => (typeof window.t === 'function' ? window.t(k, p, d) : d !== undefined ? d : k);
    const status = UI.note('info', '');
    const lock = UI.cursorLock();

    // The crossing map: both computers' monitors; drag the other one where it is on the desk.
    const map = KvmMapUI.create({ onMove: (side, along) => api.moveKvm({ side, along }), onIdentify: () => api.identifyDisplays() });

    const drive = UI.switch((v) => api.setKvm({ driveOther: v }), { label: t('cursor.use_here_control_there', null, 'Use here, control there') });
    const driven = UI.switch((v) => api.setKvm({ beDriven: v }), { label: t('cursor.let_it_control_this', null, 'Let it control this computer') });
    const resistance = UI.slider({ min: 0, max: 400, step: 10, format: (v) => `${v} px` }, (v) => api.setKvm({ resistancePx: v }));
    const speed = UI.slider({ min: 0.25, max: 4, step: 0.25, format: (v) => `${v.toFixed(2)}×` }, (v) => api.setKvm({ speed: v }));
    const reverse = UI.switch((v) => api.setKvm({ reverseScroll: v }), { label: t('cursor.reverse_scrolling', null, 'Reverse scrolling') });
    const gestures = UI.switch((v) => api.setKvm({ gestures: v }), { label: t('cursor.trackpad_gestures', null, 'Trackpad gestures') });
    const gestureRow = UI.row(t('cursor.trackpad_gestures', null, 'Trackpad gestures'), t('cursor.pinch_to_zoom_swipe_between', null, 'Pinch to zoom, swipe between desktops, Mission Control / Task View, back and forward — done the native way on {name}. The same on both'), [gestures]);
    const ble = UI.switch((v) => api.setKvm({ ble: v }), { label: t('cursor.over_bluetooth', null, 'Over Bluetooth') });
    const bleRow = UI.row(t('cursor.over_bluetooth', null, 'Over Bluetooth'), t('cursor.bluetooth_hint', null, 'When {name} isn’t on this network and you’re connected through Bluetooth (slower). Off: nothing crosses until you’re on Wi-Fi again. The same on both'), [ble]);

    // A phone as the peer: how the pointer and keys reach it (settings.phone.input, the phone's own toggle too).
    const via = UI.segmented([{ value: 'adb', label: 'ADB' }, { value: 'phone', label: t('cursor.accessibility', null, 'Accessibility') }], (v) => api.setPhone({ input: v, inputPicked: true }));
    // With a phone: its own card on top, with the way to its wireless debugging (Connection).
    const adbBtn = UI.button(t('cursor.wireless_debugging', null, 'Wireless Debugging'), () => UI.go('connection'), 'small');
    const viaRow = UI.row(t('cursor.control_phone_with', null, 'Control the phone with'), '', [via.el, adbBtn]);
    const viaCard = UI.card(t('cursor.phone_card', null, 'Phone'), [viaRow]);
    // A row whose label follows the other computer's name (UI.names fills it on render).
    const peerRow = (label, hint, controls) => {
      const r = UI.row(label, hint, controls);
      r.label.dataset.peer = label;
      return r;
    };
    let driven2 = null;
    let speedRow = null;
    body.append(
      status,
      viaCard,
      UI.pair(
        UI.dir('m2w', [peerRow(t('cursor.use_me_on_peer', null, 'Use {me}’s mouse and keyboard on {name}'), t('cursor.push_edge', null, 'Push the pointer past the edge'), [drive])]),
        UI.dir('w2m', [driven2 = peerRow(t('cursor.use_peer_on_me', null, 'Use {name}’s mouse and keyboard on {me}'), '', [driven])]),
      ),
      lock.el,
      UI.card(t('cursor.where_other_pc', null, 'Where the other computer is'), [map.el]),
      UI.card(t('cursor.feel', null, 'Feel'), [
        UI.row(t('cursor.edge_resistance', null, 'Edge resistance'), t('cursor.resistance_hint', null, 'Push a little further to cross'), [resistance]),
        speedRow = peerRow(t('cursor.pointer_speed', null, 'Pointer speed here'), '', [speed]),
        peerRow(t('cursor.reverse_scrolling_from_name', null, 'Reverse scrolling from {name}'), '', [reverse]),
        gestureRow,
      ]),
      UI.card(t('cursor.not_same_network', null, 'Not on the same network'), [bleRow]),
    );

    return (s) => {
      const k = s.kvm;
      if (!k) return;
      const p = UI.peer(s);
      const [kind, text] = UI.kvmStatus(s);
      status.className = `note ${kind}`;
      status.set(text);
      lock.update(s);
      const m = (s.input && s.input.map) || { mine: [], theirs: [], along: null };
      map.update({ mine: m.mine, theirs: m.theirs, side: k.pcSide, along: m.along, me: p.me, them: p.Name });
      driven2.setHint(t('cursor.double_tap_the_hotkey', null, 'Double-tap the hotkey to take everything back'));
      drive.set(k.driveOther);
      driven.set(k.beDriven);
      resistance.set(k.resistancePx);
      speed.set(k.speed);
      // A computer's mouse here is sped up by it; with a phone, it's this Mac's pointer there (phone-bridge.js).
      speedRow.label.dataset.peer = UI.isPhone(s) ? t('cursor.pointer_speed_on_name', null, 'Pointer speed on {name}') : t('cursor.pointer_speed', null, 'Pointer speed here');
      speedRow.label.textContent = UI.fill(speedRow.label.dataset.peer);
      reverse.set(k.reverseScroll);
      gestures.set(k.gestures !== false);
      ble.set(k.ble !== false);
      viaCard.hidden = !p.phone;
      const br = (s.phone || {}).bridge || {};
      via.set(br.input || (((s.phone || {}).settings || {}).input === 'phone' ? 'phone' : 'adb'));
      adbBtn.hidden = br.state === 'ready';
      viaRow.setHint(br.inputMode === 'auto' ? (br.state === 'ready' ? t('cursor.auto_adb_ready', null, 'Automatic: ADB, wireless debugging is ready') : t('cursor.auto_acc_fallback', null, 'Automatic: Accessibility until wireless debugging is set up'))
        : br.input === 'phone' ? t('cursor.acc_hint', null, 'Accessibility: DuoDesk on the phone taps and types. Works over Wi-Fi, Wi-Fi Direct and Bluetooth, no developer options')
          : (br.state === 'ready' ? t('cursor.adb_full_control', null, 'ADB: full control through wireless debugging') : t('cursor.adb_not_setup_yet', null, 'ADB: full control through wireless debugging (not set up yet)')));
    };
  },
});
