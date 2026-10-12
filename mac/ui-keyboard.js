// MacShare — Copyright (C) 2026 MacShare contributors. GPL-3.0, see LICENSE.
// Keyboard tab: keyboard sharing switch, hotkey, Ctrl <-> Cmd mapping (works now for Monitor 2).
'use strict';

UI.tab({
  id: 'keyboard',
  order: 30,
  title: 'Keyboard',
  desc: 'Type on whichever computer the pointer is on.',
  color: 'linear-gradient(#d1d1d6, #8e8e93)',
  master: { get: (s) => s.kvm && s.kvm.keyboard, set: (v) => UI.api.setKvm({ keyboard: v }) },
  badge: (s) => (s.kvm && s.kvm.keyboard ? 'on' : ''),
  build(body) {
    const { el, api } = UI;
    const status = UI.note('info', '');
    const swap = UI.switch((v) => api.setKeys({ swapCtrlCmd: v }), { label: 'Swap Ctrl and Command' });
    const kbd = (t) => el('kbd', { class: 'key', text: t });
    const hotkeyRow = UI.row('Switch computers', '', [kbd('Right ⌥'), el('span', { class: 'value', text: 'double-tap' })]);

    body.append(
      status,
      UI.pair(
        UI.dir('m2w', [
          hotkeyRow,
          UI.row('Shortcuts on the PC', '⌘ works as Ctrl, so ⌘C copies there'),
        ]),
        UI.dir('w2m', [
          UI.row('Switch computers', 'Double-tap Right Ctrl on the PC'),
          UI.row('Ctrl works as ⌘', 'So Ctrl+C copies here', [swap]),
        ]),
      ),
    );

    return (s) => {
      if (!s.kvm) return;
      const [kind, text] = UI.kvmStatus(s);
      status.className = `note ${kind}`;
      status.set(text);
      swap.set(s.keys && s.keys.swapCtrlCmd);
      hotkeyRow.setHint('Double-tap to go to the PC and back');
    };
  },
});
