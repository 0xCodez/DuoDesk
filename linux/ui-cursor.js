// MacShare — Copyright (C) 2026 MacShare contributors. GPL-3.0, see LICENSE.
// Cursor tab: share the pointer across the screen edge. Two direction cards (docs/UI.md), the
// layout (pick where the Mac is; either side can change it) and the live state below. Copy of
// windows/ui-cursor.js. Behaviour: docs/KVM.md (kvm.js + linux-helper).
'use strict';

UI.tab({
  id: 'cursor',
  order: 20,
  title: 'Cursor',
  color: 'linear-gradient(#ffb340, #ff9500)',
  desc: 'Move the pointer off the edge of the screen to go to the other computer.',
  // One switch (revision 7): cursor sharing, the same one the hotkey's double-tap and the Mac flip
  // (kvm.link keeps both in step); on also turns the mouse on.
  master: { get: (s) => s.kvm.mouse && s.kvm.linked, set: (v) => UI.api.setKvm(v ? { mouse: true, linked: true } : { linked: false }) },
  badge: (s) => (s.kvm.mouse && s.kvm.linked ? 'on' : ''),
  build(body) {
    const { el, api } = UI;
    const set = (partial) => api.setKvm(partial);
    // kvm.layout says where this computer is seen from the Mac; the Mac is on the opposite side.
    const MAC_SIDE = { left: 'right', right: 'left', top: 'bottom', bottom: 'top' };
    const CELL = { top: 1, left: 3, right: 5, bottom: 7 };

    const speed = UI.slider({ min: 0.25, max: 3, step: 0.05, format: (v) => v.toFixed(2) + '×' }, (v) => set({ speed: v }));
    const reverse = UI.switch((v) => set({ reverseScroll: v }), { label: 'Reverse scrolling' });
    const gestures = UI.switch((v) => set({ gestures: v }), { label: 'Trackpad gestures' }); // revision 8
    const gestureRow = UI.row('Trackpad gestures from the Mac', 'Pinch to zoom, swipe between workspaces, the overview, back and forward — done with this desktop’s shortcuts', [gestures]);
    const resistance = UI.slider({ min: 0, max: 400, step: 10, format: (v) => (v ? v + ' px' : 'None') }, (v) => set({ resistancePx: v }));
    const pair = UI.dirCards(
      { on: { get: (s) => s.kvm.beDriven, set: (v) => set({ beDriven: v }) }, rows: [
        UI.row('Use the Mac’s mouse on this computer', 'Push the pointer past the edge there'),
        UI.row('Pointer speed here', '', [speed]),
        UI.row('Reverse scrolling from the Mac', '', [reverse]),
      ] },
      { on: { get: (s) => s.kvm.driveOther, set: (v) => set({ driveOther: v }) }, rows: [
        UI.row('Use this computer’s mouse on the Mac', 'Push the pointer past the edge'),
        UI.row('Edge resistance', 'Push a little further to cross', [resistance]),
      ] },
    );

    const cells = [];
    const grid = el('div', { class: 'layout-grid' });
    const SIDE_OF = { 1: 'top', 3: 'left', 5: 'right', 7: 'bottom' };
    for (let i = 0; i < 9; i++) {
      const c = el('div', { class: i === 4 ? 'screen pc-screen' : '', text: i === 4 ? 'This computer' : '' });
      if (SIDE_OF[i]) c.onclick = () => api.setLayout(SIDE_OF[i]); // revision 4: kvm.layout from either side
      cells.push(c);
      grid.append(c);
    }
    const layoutHint = el('div', { class: 'layout-hint' });
    const status = UI.inputStatus();

    body.append(
      pair.el,
      UI.card('Feel', [gestureRow]),
      UI.card('Right now', [status], { cls: 'keep-on' }),
      el('div', { class: 'card-title', text: 'Where the other computer is' }),
      el('div', { class: 'card layout' }, [grid, layoutHint]),
    );

    return (s) => {
      const k = s.kvm;
      pair.update(s);
      status.update(s);
      speed.set(k.speed);
      reverse.set(k.reverseScroll);
      gestures.set(k.gestures !== false);
      resistance.set(k.resistancePx);
      const side = k.pcSide ? MAC_SIDE[k.pcSide] : null;
      cells.forEach((c, i) => {
        if (i === 4) return;
        const here = side && CELL[side] === i;
        c.className = Object.values(CELL).includes(i) ? 'cell' + (here ? ' mac-here' : '') : '';
        c.textContent = here ? 'Mac' : '';
        c.title = here ? '' : 'Put the Mac here';
      });
      layoutHint.textContent = (side ? 'Your Mac is ' + { left: 'to the left of', right: 'to the right of', top: 'above', bottom: 'below' }[side] + ' this computer. ' : '')
        + 'Click a side to move it.';
    };
  },
});
