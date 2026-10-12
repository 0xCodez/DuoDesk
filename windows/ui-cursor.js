// MacShare — Copyright (C) 2026 MacShare contributors. GPL-3.0, see LICENSE.
// Cursor tab: where the Mac is (set on the Mac), directions, resistance, speed, scrolling.
// Behaviour: docs/KVM.md (kvm.js + windows-helper).
'use strict';

UI.tab({
  id: 'cursor',
  order: 20,
  title: 'Cursor',
  color: 'linear-gradient(#ffb340, #ff9500)',
  desc: 'Push the pointer through the screen edge to move it onto the Mac, and back.',
  master: { get: (s) => s.kvm.mouse, set: (v) => UI.api.setKvm({ mouse: v }) },
  badge: (s) => (s.kvm.mouse ? 'on' : ''),
  build(body) {
    const { el, api } = UI;
    const set = (partial) => api.setKvm(partial);
    // kvm.layout says where the PC is seen from the Mac; the Mac is on the opposite side of the PC.
    const MAC_SIDE = { left: 'right', right: 'left', top: 'bottom', bottom: 'top' };

    // 3×3 grid like the Mac's layout picker, read-only: this PC in the middle, the Mac on its side.
    const CELL = { top: 1, left: 3, right: 5, bottom: 7 };
    const cells = [];
    const grid = el('div', { class: 'layout-grid' });
    for (let i = 0; i < 9; i++) {
      const c = el('div', { class: i === 4 ? 'screen pc-screen' : '', text: i === 4 ? 'This PC' : '' });
      cells.push(c);
      grid.append(c);
    }
    const layoutHint = el('div', { class: 'layout-hint' });
    const layout = el('div', { class: 'card layout' }, [grid, layoutHint]);
    const drive = UI.switch((v) => set({ driveOther: v }), { label: 'This PC to Mac' });
    const driven = UI.switch((v) => set({ beDriven: v }), { label: 'Mac to this PC' });
    const resistance = UI.slider({ min: 0, max: 400, step: 10, format: (v) => (v ? v + ' px' : 'None') }, (v) => set({ resistancePx: v }));
    const speed = UI.slider({ min: 0.25, max: 3, step: 0.05, format: (v) => v.toFixed(2) + '×' }, (v) => set({ speed: v }));
    const reverse = UI.switch((v) => set({ reverseScroll: v }), { label: 'Reverse scrolling' });
    const status = UI.inputStatus();

    body.append(
      UI.card('Right now', [status], { cls: 'keep-on' }),
      el('div', { class: 'card-title', text: 'Layout' }),
      layout,
      UI.card('Directions', [
        UI.row('This PC → Mac', 'This PC’s mouse can move onto the Mac', [drive]),
        UI.row('Mac → this PC', 'The Mac’s trackpad or mouse can move onto this PC', [driven]),
      ]),
      UI.card('Feel', [
        UI.row('Edge resistance', 'How far to keep pushing at the edge before the pointer crosses', [resistance]),
        UI.row('Pointer speed on this PC', 'When the Mac drives this PC', [speed]),
        UI.row('Reverse scrolling', 'When the Mac drives this PC', [reverse]),
      ]),
    );

    return (s) => {
      const k = s.kvm;
      const side = k.pcSide ? MAC_SIDE[k.pcSide] : null;
      cells.forEach((c, i) => {
        if (i === 4) return;
        const here = side && CELL[side] === i;
        c.className = Object.values(CELL).includes(i) ? 'cell' + (here ? ' mac-here' : '') : '';
        c.textContent = here ? 'Mac' : '';
      });
      layoutHint.textContent = side ? 'The Mac is to the ' + side + ' of this PC. Change it on the Mac (Cursor tab).'
        : 'Shown once connected. Set it on the Mac (Cursor tab).';
      status.update(s);
      drive.set(k.driveOther);
      driven.set(k.beDriven);
      resistance.set(k.resistancePx);
      speed.set(k.speed);
      reverse.set(k.reverseScroll);
    };
  },
});
