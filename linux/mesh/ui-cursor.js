// TwinDesk — Copyright (C) 2026 inukaasith, Erdoğan Yeşil. GPL-3.0, see LICENSE.
// Cursor tab: share the pointer across the screen edge. The two direction cards and the live state.
// Which device each edge leads to is the layout in the Multi-device tab (ui-multi.js, docs/mesh.md).
// Behaviour: kvm.js and windows-helper.
'use strict';

UI.tab({
  id: 'cursor',
  order: 20,
  title: 'Mouse',
  color: 'linear-gradient(#ffb340, #ff9500)',
  desc: 'Move the pointer off the edge of the screen to go to the other computer.',
  // One switch: cursor sharing, the same one the hotkey's double-tap and the other
  // computer flip (kvm.link keeps both in step); on also turns the mouse on. Through Bluetooth
  // it is Over Bluetooth (kvm.setShared).
  master: { get: (s) => s.kvm.mouse && s.kvm.linked && !s.kvmState.paused, set: (v) => UI.api.setKvm(v ? { mouse: true, shared: true } : { shared: false }) },
  badge: (s) => (s.kvm.mouse && s.kvm.linked && !s.kvmState.paused ? 'on' : ''),
  build(body) {
    const { el, api } = UI;
    const tr = (k, p, d) => (typeof window.t === 'function' ? window.t(k, p, d) : d !== undefined ? d : k); // local: classic scripts share one global scope
    const set = (partial) => api.setKvm(partial);

    const speed = UI.slider({ min: 0.25, max: 3, step: 0.05, format: (v) => v.toFixed(2) + '×' }, (v) => set({ speed: v }));
    const reverse = UI.switch((v) => set({ reverseScroll: v }), { label: tr('cursor.reverse_scrolling', null, 'Reverse scrolling') });
    const gestures = UI.switch((v) => set({ gestures: v }), { label: tr('cursor.trackpad_gestures', null, 'Trackpad gestures') });
    const gestureRow = UI.row(tr('cursor.trackpad_gestures', null, 'Trackpad gestures'), tr('cursor.gestures_hint', null, 'Pinch to zoom, swipe between desktops, Task View / Mission Control, back and forward — done the native way on {name}. The same on both'), [gestures]);
    const ble = UI.switch((v) => set({ ble: v }), { label: tr('cursor.over_bluetooth', null, 'Over Bluetooth') });
    const bleRow = UI.row(tr('cursor.over_bluetooth', null, 'Over Bluetooth'), tr('cursor.bluetooth_hint', null, 'When {name} isn’t on this network and you’re connected through Bluetooth (slower). Off: nothing crosses until you’re on Wi-Fi again. The same on both'), [ble]);
    const resistance = UI.slider({ min: 0, max: 400, step: 10, format: (v) => (v ? v + ' px' : tr('cursor.none', null, 'None')) }, (v) => set({ resistancePx: v }));
    // A phone as the peer: how the pointer and keys reach it (settings.phone.input, the phone's own toggle too).
    const via = UI.segmented([{ value: 'adb', label: 'ADB' }, { value: 'phone', label: tr('cursor.accessibility', null, 'Accessibility') }], (v) => api.setPhone({ input: v, inputPicked: true }));
    const viaRow = UI.row(tr('cursor.through', null, 'Through'), tr('cursor.through_hint', null, 'ADB: full control. Accessibility: DuoDesk on the phone taps and types itself, over Wi-Fi, Wi-Fi Direct or Bluetooth, no developer options'), [via.el]);
    const pair = UI.dirCards(
      { on: { get: (s) => s.kvm.beDriven, set: (v) => set({ beDriven: v }) }, label: tr('cursor.use_peer_on_me', null, 'Use {name}’s mouse and keyboard on {me}'), hint: tr('cursor.push_edge_there', null, 'Push the pointer past the edge there'), rows: [
        UI.row(tr('cursor.pointer_speed', null, 'Pointer speed here'), '', [speed]),
        UI.row(tr('cursor.reverse_scrolling', null, 'Reverse scrolling'), '', [reverse]),
      ] },
      { on: { get: (s) => s.kvm.driveOther, set: (v) => set({ driveOther: v }) }, label: tr('cursor.use_me_on_peer', null, 'Use {me}’s mouse and keyboard on {name}'), hint: tr('cursor.push_edge', null, 'Push the pointer past the edge'), rows: [
        UI.row(tr('cursor.edge_resistance', null, 'Edge resistance'), tr('cursor.resistance_hint', null, 'Push a little further to cross'), [resistance]),
        viaRow,
      ] },
    );

    const status = UI.inputStatus();
    const lock = UI.cursorLock();

    body.append(
      pair.el,
      lock.el,
      UI.card(tr('cursor.feel', null, 'Feel'), [gestureRow]),
      UI.card(tr('cursor.not_same_network', null, 'Not on the same network'), [bleRow]),
      UI.card(tr('cursor.right_now', null, 'Right now'), [status], { cls: 'keep-on' }),
      UI.note('info', tr('cursor.which_edge_hint', null, 'Which device each edge of the screen leads to: Multi-device › Layout.')),
    );

    function render(s) {
      pair.update(s);
      viaRow.hidden = !UI.peer(s).phone;
      via.set(((s.phone || {}).bridge || {}).input || (((s.phone || {}).settings || {}).input === 'phone' ? 'phone' : 'adb'));
      status.update(s);
      lock.update(s);
      speed.set(s.kvm.speed);
      reverse.set(s.kvm.reverseScroll);
      gestures.set(s.kvm.gestures !== false);
      ble.set(s.kvm.ble !== false);
      resistance.set(s.kvm.resistancePx);
    }
    return render;
  },
});
