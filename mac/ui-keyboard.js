// MacShare — Copyright (C) 2026 MacShare contributors. GPL-3.0, see LICENSE.
// Keyboard tab: keyboard sharing switch, hotkey, Ctrl <-> Cmd mapping (works now for Monitor 2).
'use strict';

UI.tab({
  id: 'keyboard',
  order: 30,
  title: 'Keyboard',
  desc: 'Your typing goes to whichever computer the pointer is on. A hotkey switches without the mouse.',
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
      UI.card('Hotkey', [hotkeyRow]),
      UI.card('Keys from the PC', [
        UI.row('Use PC shortcuts the Mac way', 'Ctrl → ⌘ Command, Windows key → ⌃ Control, Alt → ⌥ Option. So Ctrl+C copies on the Mac. Applies to Monitor 2 too.', [swap]),
      ], { cls: 'keep-on' }),
      UI.card('Good to know', [
        UI.row('Password fields', 'macOS blocks key capture while a password field or Terminal’s Secure Keyboard Entry is active. The pointer still crosses.'),
        UI.row('Keyboard layouts', 'Use the same layout (e.g. U.S.) on both computers for now.'),
      ]),
    );

    return (s) => {
      if (!s.kvm) return;
      const [kind, text] = UI.kvmStatus(s);
      status.className = `note ${kind}`;
      status.set(text);
      swap.set(s.keys && s.keys.swapCtrlCmd);
      hotkeyRow.setHint(s.kvm.mouse
        ? 'Double-tap Right Option to send the keyboard and pointer to the PC, again to come back.'
        : 'Cursor sharing is off, so the hotkey is how the keyboard moves to the PC (the pointer stays here).');
    };
  },
});
