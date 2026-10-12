// MacShare — Copyright (C) 2026 MacShare contributors. GPL-3.0, see LICENSE.
// Cursor tab: share the pointer across the screen edge. Two direction cards (docs/UI.md), the
// layout (set on the Mac) and the live state below. Behaviour: docs/KVM.md (kvm.js + windows-helper).
'use strict';

UI.tab({
  id: 'cursor',
  order: 20,
  title: 'Cursor',
  color: 'linear-gradient(#ffb340, #ff9500)',
  desc: 'Push the pointer through the screen edge to move it onto the other computer, and back.',
  master: { get: (s) => s.kvm.mouse, set: (v) => UI.api.setKvm({ mouse: v }) },
  badge: (s) => (s.kvm.mouse ? 'on' : ''),
  build(body) {
    const { el, api } = UI;
    const set = (partial) => api.setKvm(partial);
    // kvm.layout says where the PC is seen from the Mac; the Mac is on the opposite side of the PC.
    const MAC_SIDE = { left: 'right', right: 'left', top: 'bottom', bottom: 'top' };
    const CELL = { top: 1, left: 3, right: 5, bottom: 7 };

    const speed = UI.slider({ min: 0.25, max: 3, step: 0.05, format: (v) => v.toFixed(2) + '×' }, (v) => set({ speed: v }));
    const reverse = UI.switch((v) => set({ reverseScroll: v }), { label: 'Reverse scrolling' });
    const resistance = UI.slider({ min: 0, max: 400, step: 10, format: (v) => (v ? v + ' px' : 'None') }, (v) => set({ resistancePx: v }));
    const pair = UI.dirCards(
      { on: { get: (s) => s.kvm.beDriven, set: (v) => set({ beDriven: v }) }, rows: [
        UI.row('The Mac’s mouse can move onto this PC', 'Its pointer appears here at the same height'),
        UI.row('Pointer speed here', '', [speed]),
        UI.row('Reverse scrolling', 'For the Mac’s scrolling on this PC', [reverse]),
      ] },
      { on: { get: (s) => s.kvm.driveOther, set: (v) => set({ driveOther: v }) }, rows: [
        UI.row('This PC’s mouse can move onto the Mac', 'Push through the edge facing the Mac, or double-tap Right Ctrl'),
        UI.row('Edge resistance', 'How far to keep pushing before the pointer crosses', [resistance]),
      ] },
    );

    const cells = [];
    const grid = el('div', { class: 'layout-grid' });
    for (let i = 0; i < 9; i++) {
      const c = el('div', { class: i === 4 ? 'screen pc-screen' : '', text: i === 4 ? 'This PC' : '' });
      cells.push(c);
      grid.append(c);
    }
    const layoutHint = el('div', { class: 'layout-hint' });
    const status = UI.inputStatus();

    body.append(
      pair.el,
      UI.card('Right now', [status], { cls: 'keep-on' }),
      el('div', { class: 'card-title', text: 'Layout' }),
      el('div', { class: 'card layout' }, [grid, layoutHint]),
    );

    return (s) => {
      const k = s.kvm;
      pair.update(s);
      status.update(s);
      speed.set(k.speed);
      reverse.set(k.reverseScroll);
      resistance.set(k.resistancePx);
      const side = k.pcSide ? MAC_SIDE[k.pcSide] : null;
      cells.forEach((c, i) => {
        if (i === 4) return;
        const here = side && CELL[side] === i;
        c.className = Object.values(CELL).includes(i) ? 'cell' + (here ? ' mac-here' : '') : '';
        c.textContent = here ? 'Mac' : '';
      });
      layoutHint.textContent = side ? 'The Mac is to the ' + side + ' of this PC. Change it on the Mac (Cursor tab).'
        : 'Shown once connected. Set it on the Mac (Cursor tab).';
    };
  },
});
