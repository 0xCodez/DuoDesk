// MacShare — Copyright (C) 2026 MacShare contributors. GPL-3.0, see LICENSE.
// Keyboard tab: typing follows the pointer. Two direction cards (docs/UI.md); the directions are the
// same switches as on the Cursor tab. Behaviour: docs/KVM.md (kvm.js + windows-helper).
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
    const swap = UI.switch((v) => api.setKeys({ swapCtrlCmd: v }), { label: 'Swap Ctrl and Command' });
    const kbd = (t) => el('kbd', { text: t });
    const status = UI.inputStatus();
    const pair = UI.dirCards(
      { on: { get: (s) => s.kvm.beDriven, set: (v) => api.setKvm({ beDriven: v }) }, rows: [
        UI.row('Switch computers', 'Double-tap Right Option on the Mac'),
        UI.row('⌘ works as Ctrl', 'So ⌘C copies here', [swap]),
      ] },
      { on: { get: (s) => s.kvm.driveOther, set: (v) => api.setKvm({ driveOther: v }) }, rows: [
        UI.row('Switch computers', 'Double-tap', [kbd('Right Ctrl')]),
        UI.row('Shortcuts on the Mac', 'Ctrl works as ⌘, so Ctrl+C copies there'),
      ] },
    );

    body.append(
      pair.el,
      UI.card('Right now', [status], { cls: 'keep-on' }),
    );

    return (s) => {
      pair.update(s);
      status.update(s);
      swap.set(s.keys.swapCtrlCmd);
    };
  },
});
