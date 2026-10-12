// MacShare — Copyright (C) 2026 MacShare contributors. GPL-3.0, see LICENSE.
// Cursor tab: where the PC is (layout picker), directions, edge resistance, speed, scrolling.
// Settings are saved now; the behaviour arrives in phases 4–5 (docs/KVM.md).
'use strict';

UI.tab({
  id: 'cursor',
  order: 20,
  title: 'Cursor',
  desc: 'Push the pointer through the screen edge and it moves onto the other computer.',
  color: 'linear-gradient(#ffb340, #ff9500)',
  master: { get: (s) => s.kvm && s.kvm.mouse, set: (v) => UI.api.setKvm({ mouse: v }) },
  badge: (s) => (s.kvm && s.kvm.mouse ? 'on' : ''),
  build(body) {
    const { el, api } = UI;
    const status = UI.note('info', '');

    // Layout picker: the Mac in the middle, a slot on each side for the PC.
    const slots = {};
    const grid = el('div', { class: 'layout-grid' });
    const cell = (side) => {
      const b = el('button', { class: 'slot', title: `PC ${side === 'top' ? 'above' : side === 'bottom' ? 'below' : `on the ${side}`}`, attrs: { 'aria-label': `PC is ${side}` } });
      b.onclick = () => api.setKvm({ pcSide: side });
      slots[side] = b;
      return b;
    };
    grid.append(
      el('span'), cell('top'), el('span'),
      cell('left'), el('div', { class: 'screen mac-screen' }, [el('span', { text: 'This Mac' })]), cell('right'),
      el('span'), cell('bottom'), el('span'),
    );
    const layoutHint = el('div', { class: 'layout-hint' });

    const drive = UI.switch((v) => api.setKvm({ driveOther: v }), { label: 'Mac to PC' });
    const driven = UI.switch((v) => api.setKvm({ beDriven: v }), { label: 'PC to Mac' });
    const resistance = UI.slider({ min: 0, max: 400, step: 10, format: (v) => `${v} px` }, (v) => api.setKvm({ resistancePx: v }));
    const speed = UI.slider({ min: 0.25, max: 4, step: 0.25, format: (v) => `${v.toFixed(2)}×` }, (v) => api.setKvm({ speed: v }));
    const reverse = UI.switch((v) => api.setKvm({ reverseScroll: v }), { label: 'Reverse scrolling' });

    body.append(
      status,
      UI.card('Arrangement', [el('div', { class: 'layout' }, [grid, layoutHint])]),
      UI.card('Directions', [
        UI.row('Use this Mac’s trackpad and mouse on the PC', 'Push through the edge facing the PC', [drive]),
        UI.row('Let the PC’s mouse control this Mac', 'The PC pushes through its edge facing this Mac', [driven]),
      ]),
      UI.card('Feel', [
        UI.row('Edge resistance', 'How far you push past the edge before the pointer crosses — stops accidental crossings', [resistance]),
        UI.row('Pointer speed on the other computer', '', [speed]),
        UI.row('Reverse scrolling', 'Flip the scroll direction of input arriving from the PC', [reverse]),
      ]),
    );

    return (s) => {
      const k = s.kvm;
      if (!k) return;
      const [kind, text] = UI.kvmStatus(s);
      status.className = `note ${kind}`;
      status.set(text);
      for (const [side, b] of Object.entries(slots)) {
        b.classList.toggle('on', k.pcSide === side);
        b.textContent = k.pcSide === side ? 'PC' : '';
      }
      const where = { left: 'to the left of', right: 'to the right of', top: 'above', bottom: 'below' }[k.pcSide];
      layoutHint.textContent = `The PC is ${where} this Mac. Click another side to move it. The PC app shows this layout too.`;
      drive.set(k.driveOther);
      driven.set(k.beDriven);
      resistance.set(k.resistancePx);
      speed.set(k.speed);
      reverse.set(k.reverseScroll);
    };
  },
});
