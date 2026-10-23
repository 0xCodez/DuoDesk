// TwinDesk — Copyright (C) 2026 inukaasith, Erdoğan Yeşil. GPL-3.0, see LICENSE.
// Multi-device tab with it on (docs/multi-device.md): what only several devices need, in one place.
// Turn off (TwinDesk restarts one to one), where the devices sit (the shared layout's grid, docs/mesh.md
// "Shared layout"), and Join every device automatically (docs/mesh.md "Joining everyone").
'use strict';

UI.tab({
  id: 'multi',
  order: 95,
  title: 'Multi-device',
  color: 'linear-gradient(#5e5ce6, #3634a3)',
  desc: 'Several computers and phones connected at once',
  bottom: true,
  build(body) {
    const { api } = UI;
    const turnOff = UI.button('Turn off', () => {
      turnOff.disabled = true;
      turnOff.textContent = 'Restarting…';
      api.setMulti(false);
    }, 'small');

    // ---- the layout: a grid of tiles ----
    // Every paired device is a tile; its edges lead to the nearest tile on its row or column. Click a tile
    // and then an empty place to move it there, or then another tile to swap the two. Each change goes
    // through setLayoutCell, so every computer shows the same grid.
    let picked = null; // the device id picked, waiting for a place or another tile
    let last = null; // the last state, to draw the grid again
    const layoutHint = UI.note('info', '');
    const gridEl = UI.el('div', { class: 'layout-grid' });

    const cellOf = (id) => (last && last.layout && last.layout.cells[id]) || null;

    function move(id, x, y) {
      api.setLayoutCell(id, x, y).then((ok) => {
        if (ok === false) layoutHint.set('That did not move.');
      });
    }

    function pick(id) {
      picked = id;
      if (last) drawLayout(last);
    }

    // A tile was clicked: it is picked; a picked tile clicked again is put down; with a tile already picked,
    // the two swap places.
    function onTile(id) {
      if (picked === id) return pick(null);
      if (!picked) return pick(id);
      const from = picked;
      const to = cellOf(id);
      pick(null);
      if (to) move(from, to.x, to.y);
    }

    // An empty place was clicked: the picked device moves there.
    function onPlace(x, y) {
      if (!picked) return;
      const id = picked;
      pick(null);
      move(id, x, y);
    }

    function tile(id, info) {
      const state = info.self ? 'This computer' : info.connected ? 'Connected' : 'Not connected';
      return UI.el('button', {
        class: 'lay-tile' + (info.self ? ' here' : '') + (info.connected || info.self ? '' : ' off') + (picked === id ? ' picked' : ''),
        attrs: { type: 'button', title: info.name + ' — ' + state },
        onclick: () => onTile(id),
      }, [
        UI.osIcon(info.os),
        UI.el('span', { class: 'lay-name', text: info.name }),
        UI.el('span', { class: 'lay-state', text: state }),
      ]);
    }

    function place(x, y) {
      return UI.el('button', {
        class: 'lay-place' + (picked ? ' target' : ''),
        attrs: { type: 'button', 'aria-label': 'Empty place' },
        onclick: () => onPlace(x, y),
      });
    }

    function drawLayout(s) {
      const lay = s && s.layout;
      if (!lay || !lay.grid || !s.device) return;
      if (picked && !lay.cells[picked]) picked = null; // a device that is gone cannot be moved
      const people = new Map([[s.device.id, { name: s.device.name || 'This computer', os: 'linux', connected: true, self: true }]]);
      for (const d of s.peers || []) {
        if (d && d.id) people.set(d.id, { name: d.name || d.id.slice(0, 8), os: d.os, connected: !!d.connected, self: false });
      }
      const at = new Map();
      for (const id of Object.keys(lay.cells)) at.set(lay.cells[id].x + ',' + lay.cells[id].y, id);
      const g = lay.grid;
      gridEl.style.gridTemplateColumns = `repeat(${g.maxX - g.minX + 1}, minmax(96px, 1fr))`;
      const cells = [];
      for (let y = g.minY; y <= g.maxY; y++) {
        for (let x = g.minX; x <= g.maxX; x++) {
          const id = at.get(x + ',' + y);
          cells.push(id ? tile(id, people.get(id) || { name: id.slice(0, 8), os: '', connected: false, self: false }) : place(x, y));
        }
      }
      gridEl.replaceChildren(...cells);
      layoutHint.set(picked
        ? 'Now click an empty place to move it there, or another device to swap places.'
        : 'Click a device, then an empty place to move it there, or another device to swap places.');
    }

    const joinSw = UI.switch((v) => api.setMesh({ autoJoin: v }), { label: 'Join every device automatically' });
    const joinRow = UI.row('Join every device automatically', '', [joinSw]);

    body.append(
      UI.card('Multi-device', [
        UI.row('Use several devices at once', 'On. Turned off, TwinDesk restarts and connects one to one, as it was before', [turnOff]),
        UI.row('Computers', 'Connect to this one over the same network only, not Bluetooth. Phones over Wi-Fi, a USB cable or Bluetooth, as before', []),
      ]),
      UI.card('Layout', [gridEl, layoutHint], { cls: 'keep-on' }),
      UI.card('Joining', [joinRow]),
    );

    return (s) => {
      last = s;
      drawLayout(s);
      const jn = (s.mesh || {}).autoJoin === true;
      joinSw.set(jn);
      joinRow.setHint(jn ? 'Pair with one device and the rest connect to this one by themselves. Devices you pair with can introduce others, without a pairing code'
        : 'Off: this computer neither introduces devices to each other nor accepts an introduction. Pair each device yourself');
    };
  },
});
