// TwinDesk — Copyright (C) 2026 inukaasith. GPL-3.0, see LICENSE.
// Keyboard tab: typing follows the pointer. The Hotkey card (double-tap = cursor sharing on/off;
// keyboard-only switching), then two direction cards; the directions are the same
// switches as on the Cursor tab. Copy of windows/ui-keyboard.js.
'use strict';

UI.tab({
  id: 'keyboard',
  order: 30,
  title: 'Keyboard',
  color: 'linear-gradient(#d1d1d6, #8e8e93)',
  desc: 'Type on whichever computer the pointer is on.',
  master: { get: (s) => s.kvm.keyboard, set: (v) => UI.api.setKvm({ keyboard: v }) },
  badge: (s) => (s.kvm.keyboard ? 'on' : ''),
  build(body) {
    const { api } = UI;
    const hotkey = UI.select(Object.entries(UI.HOTKEYS).map(([value, label]) => ({ value, label })), (v) => api.setKeys({ hotkey: v }));
    const hotkeyRow = UI.row('Hotkey', 'Double-tap to turn cursor sharing on or off', [hotkey]);
    const switchSw = UI.switch((v) => api.setKvm({ hotkeySwitch: v }), { label: 'Switch the keyboard with the hotkey' });
    const switchRow = UI.row('Switch the keyboard with the hotkey', '', [switchSw]);
    const swap = UI.switch((v) => api.setKeys({ swapCtrlCmd: v }), { label: 'Swap Ctrl and Command' });
    const status = UI.inputStatus();
    const pair = UI.dirCards(
      { on: { get: (s) => s.kvm.beDriven, set: (v) => api.setKvm({ beDriven: v }) }, rows: [
        UI.row('Hotkey on the Mac', 'Set in TwinDesk on the Mac'),
        UI.row('⌘ works as Ctrl', 'So ⌘C copies here', [swap]),
      ] },
      { on: { get: (s) => s.kvm.driveOther, set: (v) => api.setKvm({ driveOther: v }) }, rows: [
        UI.row('Shortcuts on the Mac', 'Ctrl works as ⌘, so Ctrl+C copies there'),
      ] },
    );

    body.append(
      UI.card('Hotkey', [hotkeyRow, switchRow], { cls: 'keep-on' }),
      pair.el,
      UI.card('Right now', [status], { cls: 'keep-on' }),
    );

    return (s) => {
      pair.update(s);
      status.update(s);
      hotkey.set(s.keys.hotkey);
      // Keyboard-only switching exists only while the pointer isn't shared (Cursor off).
      switchSw.set(s.kvm.hotkeySwitch);
      switchSw.disable(!!s.kvm.mouse);
      switchRow.setHint(s.kvm.mouse ? 'Only when Cursor is off' : 'Double-tap to type on the Mac and back');
      swap.set(s.keys.swapCtrlCmd);
    };
  },
});
