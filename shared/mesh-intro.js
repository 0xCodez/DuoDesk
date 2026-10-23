// TwinDesk — Copyright (C) 2026 inukaasith. GPL-3.0, see LICENSE.
// Multi-device (Mesh mode, beta) in the one-to-one app: the picture of a mesh on its tab, and the popup
// before it's turned on, which says what is still rough in it (docs/multi-device.md).
//   MeshIntro.art()                 -> an element: devices, each one linked to every other
//   MeshIntro.confirm(os, onTurnOn) -> the popup (styled as pairpop.js's .pair-pop); Turn on calls onTurnOn
(function () {
  // Each device: [kind, x, y]. Lines join every pair, as the mesh does.
  const NODES = [['monitor', 110, 78], ['laptop', 320, 46], ['monitor', 530, 84], ['phone', 214, 196], ['laptop', 430, 200]];

  function device(kind, x, y) {
    if (kind === 'phone') {
      return `<rect class="mi-body" x="${x - 16}" y="${y - 30}" width="32" height="60" rx="7"/>`
        + `<rect class="mi-screen" x="${x - 11}" y="${y - 23}" width="22" height="42" rx="3"/>`;
    }
    if (kind === 'laptop') {
      return `<rect class="mi-body" x="${x - 38}" y="${y - 28}" width="76" height="48" rx="6"/>`
        + `<rect class="mi-screen" x="${x - 31}" y="${y - 21}" width="62" height="34" rx="3"/>`
        + `<path class="mi-body" d="M${x - 48} ${y + 22}h96l-6 9h-84z"/>`;
    }
    return `<rect class="mi-body" x="${x - 42}" y="${y - 30}" width="84" height="54" rx="6"/>`
      + `<rect class="mi-screen" x="${x - 35}" y="${y - 23}" width="70" height="40" rx="3"/>`
      + `<path class="mi-body" d="M${x - 6} ${y + 24}h12v10h-12z M${x - 20} ${y + 34}h40v5h-40z"/>`;
  }

  function art() {
    const lines = [];
    const dots = [];
    for (let i = 0; i < NODES.length; i++) {
      for (let j = i + 1; j < NODES.length; j++) {
        const [, x1, y1] = NODES[i];
        const [, x2, y2] = NODES[j];
        lines.push(`<line class="mi-link" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`);
        // A copy or a pointer on its way: a dot running along some of the links.
        if ((i + j) % 2) {
          const dur = 2.4 + ((i * 3 + j) % 4) * 0.5;
          dots.push(`<circle class="mi-dot" r="3.5"><animateMotion dur="${dur}s" repeatCount="indefinite" path="M${x1} ${y1}L${x2} ${y2}"/></circle>`);
        }
      }
    }
    const wrap = document.createElement('div');
    wrap.className = 'mesh-art';
    wrap.setAttribute('aria-hidden', 'true');
    wrap.innerHTML = `<svg viewBox="0 0 640 250" role="img">${lines.join('')}${dots.join('')}${NODES.map((n) => device(...n)).join('')}</svg>`
      + '<p>Every device linked to every other: one clipboard and one set of notifications for all, and the mouse and keyboard across all of them.</p>';
    return wrap;
  }

  // What's rough so far, said before it's turned on. os: 'mac' | 'win' | 'linux'.
  function confirm(os, onTurnOn) {
    const el = (tag, cls, text) => {
      const e = document.createElement(tag);
      if (cls) e.className = cls;
      if (text) e.textContent = text;
      return e;
    };
    const here = os === 'mac' ? 'this Mac' : os === 'win' ? 'this PC' : 'this computer';
    const rough = [
      `Dragging files across a screen edge goes one device only: from ${here} to the device next to it${os === 'mac' ? '' : ', and across one edge of the screen'}. Send files to the others from the Files page.`,
      `The mouse gets only to devices ${here} is connected to. Join every device automatically (on) connects them by itself; the layout shows in red what it can't reach.`,
      'Settings both modes have (cursor, clipboard, keys…) are the same in both: what you change in Mesh mode stays when you turn it off. Your pairings come back as they were.',
      'The phone app connects to one computer at a time.',
    ];
    if (os === 'linux') rough.push('Other computers connect to this one over the same network only, not Bluetooth.');

    const pop = el('div', 'pair-pop mesh-pop');
    pop.setAttribute('role', 'dialog');
    pop.setAttribute('aria-modal', 'true');
    const body = el('div', 'pop-body');
    const title = el('strong', '', 'Turn on Multi-device? ');
    title.append(el('span', 'pill beta', 'Mesh · Beta'));
    const list = el('ul', 'mesh-rough');
    for (const t of rough) list.append(el('li', '', t));
    body.append(
      title,
      el('p', '', 'Mesh mode is new. It works, but some parts are still rough, and they get proper fixes along the way:'),
      list,
      el('div', 'hint', 'You may run into problems with TwinDesk Mesh. If you do, turn it off on this page (TwinDesk restarts as it was) and tell us on GitHub.'),
    );
    const cancel = el('button', 'btn', 'Cancel');
    const ok = el('button', 'btn primary', 'Turn on');
    const actions = el('div', 'banner-actions');
    actions.append(cancel, ok);
    pop.append(body, actions);

    const close = () => {
      document.removeEventListener('keydown', onKey, true);
      pop.remove();
    };
    function onKey(e) {
      if (e.key === 'Escape') close();
    }
    cancel.onclick = close;
    ok.onclick = () => {
      close();
      onTurnOn();
    };
    document.addEventListener('keydown', onKey, true);
    document.body.append(pop);
    ok.focus();
  }

  window.MeshIntro = { art, confirm };
})();
