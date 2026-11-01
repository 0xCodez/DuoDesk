// TwinDesk — Copyright (C) 2026 inukaasith. GPL-3.0, see LICENSE.
// Keyboard tab: typing follows the pointer. The Hotkey card (double-tap = mouse and keyboard back
// here; keyboard-only switching), then two direction cards; the directions are the
// same switches as on the Cursor tab. Behaviour: kvm.js and windows-helper.
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
    const t = (k, p, d) => (typeof window.t === 'function' ? window.t(k, p, d) : d !== undefined ? d : k);
    const hotkey = UI.select(Object.entries(UI.HOTKEYS).map(([value, label]) => ({ value, label })), (v) => api.setKeys({ hotkey: v }));
    const hotkeyRow = UI.row(t('keyboard.hotkey', null, 'Hotkey'), t('keyboard.double_tap_to_turn_cursor', null, 'Double-tap to turn cursor sharing on or off'), [hotkey]);
    const switchSw = UI.switch((v) => api.setKvm({ hotkeySwitch: v }), { label: t('keyboard.switch_the_keyboard_with_the', null, 'Switch the keyboard with the hotkey') });
    const switchRow = UI.row(t('keyboard.switch_the_keyboard_with_the', null, 'Switch the keyboard with the hotkey'), '', [switchSw]);
    const swap = UI.switch((v) => api.setKeys({ swapCtrlCmd: v }), { label: t('keyboard.swap_ctrl_and_command', null, 'Swap Ctrl and Command') });
    const otherHotkey = UI.row(t('keyboard.hotkey_on_name', null, 'Hotkey on {name}'), '');
    const swapRow = UI.row(t('keyboard.works_as_ctrl', null, '⌘ works as Ctrl'), t('keyboard.so_c_copies_here', null, 'So ⌘C copies here'), [swap]);
    const shortcutsRow = UI.row(t('keyboard.shortcuts_on_name', null, 'Shortcuts on {name}'), t('keyboard.ctrl_works_as_so_ctrl', null, 'Ctrl works as ⌘, so Ctrl+C copies there'));
    const status = UI.inputStatus();
    const pair = UI.dirCards(
      { on: { get: (s) => s.kvm.beDriven, set: (v) => api.setKvm({ beDriven: v }) }, label: t('keyboard.type_on_me_with_name', null, 'Type on {me} with {name}’s keyboard'), rows: [otherHotkey, swapRow] },
      { on: { get: (s) => s.kvm.driveOther, set: (v) => api.setKvm({ driveOther: v }) }, label: t('keyboard.type_on_name_with_me', null, 'Type on {name} with {me}’s keyboard'), rows: [shortcutsRow] },
    );

    body.append(
      UI.card(t('keyboard.hotkey', null, 'Hotkey'), [hotkeyRow, switchRow], { cls: 'keep-on' }),
      pair.el,
      UI.card(t('cursor.right_now', null, 'Right now'), [status], { cls: 'keep-on' }),
    );

    return (s) => {
      const p = UI.peer(s);
      pair.update(s);
      status.update(s);
      hotkey.set(s.keys.hotkey);
      // Keyboard-only switching exists only while the pointer isn't shared (Cursor off).
      switchSw.set(s.kvm.hotkeySwitch);
      switchSw.disable(!!s.kvm.mouse);
      switchRow.setHint(s.kvm.mouse ? t('keyboard.only_when_cursor_is_off', null, 'Only when Cursor is off') : t('keyboard.double_tap_to_type_on', { name: p.the }, 'Double-tap to type on {name} and back'));
      otherHotkey.label.textContent = t('keyboard.hotkey_on_name', { name: p.the }, 'Hotkey on {name}');
      otherHotkey.setHint(t('keyboard.set_in_duodesk_on_name', { name: p.the }, 'Set in DuoDesk on {name}'));
      // Ctrl/Cmd swapping only between a Mac and a PC.
      swapRow.hidden = p.os !== 'mac';
      shortcutsRow.hidden = p.os !== 'mac';
      swap.set(s.keys.swapCtrlCmd);
    };
  },
});
