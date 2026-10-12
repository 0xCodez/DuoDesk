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
    const swap = UI.switch((v) => api.setKeys({ swapCtrlCmd: v }), { label: 'Swap Ctrl and Cmd' });
    const modeRow = UI.row('How you switch', '');
    const status = UI.inputStatus();
    const pair = UI.dirCards(
      { on: { get: (s) => s.kvm.beDriven, set: (v) => api.setKvm({ beDriven: v }) }, rows: [
        UI.row('The Mac’s keyboard can type here', 'While the Mac drives this PC'),
        UI.row('Swap Ctrl and Cmd', 'Cmd+C on the Mac acts as Ctrl+C here; Control as the Windows key; Option as Alt', [swap]),
      ] },
      { on: { get: (s) => s.kvm.driveOther, set: (v) => api.setKvm({ driveOther: v }) }, rows: [
        UI.row('This PC’s keyboard can type on the Mac', 'Ctrl+C here acts as Cmd+C there (the Mac swaps)'),
        modeRow,
      ] },
    );

    body.append(
      pair.el,
      UI.card('Right now', [status], { cls: 'keep-on' }),
      UI.card('For both directions', [
        UI.row('Hotkey', 'Double-tap Right Ctrl to send keyboard and mouse to the Mac, and again to bring them back (the Mac uses Right Option)', [
          el('span', { class: 'keys' }, [el('kbd', { text: 'Right Ctrl' }), el('kbd', { text: 'Right Ctrl' })]),
        ]),
      ]),
      UI.card('Good to know', [
        UI.row('Keys Windows keeps', 'The Windows key, Alt+Tab, Ctrl+Alt+Del and Alt+F4 always act on this PC.'),
        UI.row('Admin windows', 'Windows doesn’t let MacShare type into administrator windows or UAC prompts.'),
      ], { cls: 'keep-on' }),
    );

    return (s) => {
      pair.update(s);
      status.update(s);
      swap.set(s.keys.swapCtrlCmd);
      modeRow.setHint(s.kvm.mouse ? 'Push the pointer through the edge, or use the hotkey.'
        : 'Cursor sharing is off, so only the hotkey switches (the pointer stays here).');
    };
  },
});
