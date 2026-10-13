// MacShare — Copyright (C) 2026 MacShare contributors. GPL-3.0, see LICENSE.
// Cursor tab: where the PC is (layout picker), directions, edge resistance, speed, scrolling.
// Settings are saved now; the behaviour arrives in phases 4–5 (docs/KVM.md).
'use strict';

UI.tab({
  id: 'cursor',
  group: 'Input',
  order: 20,
  title: 'Cursor',
  desc: 'Move the pointer off the edge of the screen to go to the other computer.',
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

    const linkSw = UI.switch((v) => api.setKvm({ linked: v }), { label: 'Cursor sharing' });
    const linkRow = UI.row('Cursor sharing', '', [linkSw]);
    const drive = UI.switch((v) => api.setKvm({ driveOther: v }), { label: 'Mac to PC' });
    const driven = UI.switch((v) => api.setKvm({ beDriven: v }), { label: 'PC to Mac' });
    const resistance = UI.slider({ min: 0, max: 400, step: 10, format: (v) => `${v} px` }, (v) => api.setKvm({ resistancePx: v }));
    const speed = UI.slider({ min: 0.25, max: 4, step: 0.25, format: (v) => `${v.toFixed(2)}×` }, (v) => api.setKvm({ speed: v }));
    const reverse = UI.switch((v) => api.setKvm({ reverseScroll: v }), { label: 'Reverse scrolling' });

    // A row whose label follows the other computer's name (UI.names fills it on render).
    const peerRow = (label, hint, controls) => {
      const r = UI.row(label, hint, controls);
      r.label.dataset.peer = label;
      return r;
    };
    let driven2 = null;
    body.append(
      status,
      UI.card('', [linkRow], { cls: 'keep-on' }),
      UI.pair(
        UI.dir('m2w', [peerRow('Use this Mac’s mouse on {there}', 'Push the pointer past the edge', [drive])]),
        UI.dir('w2m', [driven2 = peerRow('Use {there}’s mouse on this Mac', '', [driven])]),
      ),
      UI.card('Where the other computer is', [el('div', { class: 'layout' }, [grid, layoutHint])]),
      UI.card('Feel', [
        UI.row('Edge resistance', 'Push a little further to cross', [resistance]),
        peerRow('Pointer speed on {there}', '', [speed]),
        peerRow('Reverse scrolling from {there}', '', [reverse]),
      ]),
    );

    return (s) => {
      const k = s.kvm;
      if (!k) return;
      const p = UI.peer(s);
      linkSw.set(k.linked !== false);
      linkRow.setHint(`Double-tap ${UI.hotkeyName(s)} to turn it ${k.linked !== false ? 'off' : 'on'} from anywhere`);
      const [kind, text] = UI.kvmStatus(s);
      status.className = `note ${kind}`;
      status.set(text);
      for (const [side, b] of Object.entries(slots)) {
        b.classList.toggle('on', k.pcSide === side);
        b.textContent = k.pcSide === side ? p.there : '';
      }
      const where = { left: 'to the left of', right: 'to the right of', top: 'above', bottom: 'below' }[k.pcSide];
      layoutHint.textContent = `${p.same ? p.there : 'Your PC'} is ${where} this Mac. Click a side to move it.`;
      driven2.setHint('Double-tap the hotkey to take everything back');
      drive.set(k.driveOther);
      driven.set(k.beDriven);
      resistance.set(k.resistancePx);
      speed.set(k.speed);
      reverse.set(k.reverseScroll);
    };
  },
});
