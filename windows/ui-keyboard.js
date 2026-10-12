// MacShare — Copyright (C) 2026 MacShare contributors. GPL-3.0, see LICENSE.
// Keyboard tab: share the keyboard, hotkey, Ctrl ↔ Cmd swap for keys arriving from the Mac.
// Settings are saved now; the behaviour arrives in phases 4–5 (docs/KVM.md).
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
    const { el, api } = UI;
    const swap = UI.switch((v) => api.setKeys({ swapCtrlCmd: v }), { label: 'Swap Ctrl and Cmd' });
    const modeRow = UI.row('How you switch', '');

    body.append(
      UI.note('info', 'Sharing the keyboard comes in phases 4–5. Your settings are saved now.'),
      UI.card('Switching', [
        UI.row('Hotkey', 'Double-tap Right Ctrl to send keyboard and mouse to the Mac, and again to bring them back', [
          el('span', { class: 'keys' }, [el('kbd', { text: 'Right Ctrl' }), el('kbd', { text: 'Right Ctrl' })]),
        ]),
        modeRow,
      ]),
      UI.card('Keys from the Mac', [
        UI.row('Swap Ctrl and Cmd', 'Cmd+C on the Mac acts as Ctrl+C here; Control acts as the Windows key; Option as Alt', [swap]),
      ]),
      UI.card('Good to know', [
        UI.row('Keys Windows keeps', 'The Windows key, Alt+Tab, Ctrl+Alt+Del and Alt+F4 always act on this PC.'),
        UI.row('Admin windows', 'Windows doesn’t let MacShare type into administrator windows or UAC prompts.'),
      ], { cls: 'keep-on' }),
    );

    return (s) => {
      swap.set(s.keys.swapCtrlCmd);
      modeRow.setHint(s.kvm.mouse ? 'Push the pointer through the edge, or use the hotkey.'
        : 'Cursor sharing is off, so only the hotkey switches (the pointer stays here).');
    };
  },
});
