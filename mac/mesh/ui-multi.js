// TwinDesk — Copyright (C) 2026 inukaasith, Erdoğan Yeşil. GPL-3.0, see LICENSE.
// Multi-device tab with it on (docs/multi-device.md): what only several devices need, in one place.
// Turn off (DuoDesk restarts one to one), where the devices sit (the shared layout's grid, docs/mesh.md
// "Shared layout"), and Join every device automatically (docs/mesh.md "Joining everyone").
'use strict';
(() => { // own scope: every mesh/ui-*.js declares `tr`, and top-level consts of classic scripts collide
var tr = (k, p, d) => (typeof t === 'function' ? t(k, p, d) : (d || k));

UI.tab({
  id: 'multi',
  order: 95,
  title: 'Multi-device',
  heading: 'Multi-device · Mesh mode',
  desc: tr('mesh_multi.desc', null, 'Several computers and phones connected at once'),
  color: 'linear-gradient(#5e5ce6, #3634a3)',
  bottom: true,
  build(body) {
    const { el, api } = UI;
    const turnOff = UI.button(tr('general.turn_off', null, 'Turn off'), () => {
      turnOff.disabled = true;
      turnOff.textContent = tr('general.restarting', null, 'Restarting…');
      api.setMulti(false);
    }, 'small');

    // ---- the layout: a grid of tiles (docs/mesh.md, "Shared layout") ----
    // Every device is a tile; its edges lead to the nearest tile on its row or column. Click a tile and
    // then an empty place to move it there, or then another tile to swap the two. Each change goes through
    // setLayoutCell, so every computer shows the same grid.
    // Tiles sit side by side, with no empty space between them: a tile goes only next to another one by a
    // side (not a corner), the places it may go are lit (layout.targets), and the rest close up behind it.
    let picked = null; // the device id picked, waiting for a place or another tile
    let last = null; // the last state, to draw the grid again
    const layoutHint = UI.note('info', '');
    const reachNote = UI.note('warn', ''); // the devices the pointer can't get to from here, and why
    const gridEl = el('div', { class: 'layout-map' });

    const cellOf = (id) => (last && last.layout && last.layout.cells[id]) || null;

    // An empty place the picked tile may go to: next to another tile by a side (layout.targets, from
    // shared/layout.js). A tile on its own may go anywhere.
    function canGo(id, x, y) {
      const lay = last && last.layout;
      const tg = lay && lay.targets && lay.targets[id];
      if (!Array.isArray(tg) || Object.keys(lay.cells).length < 2) return true;
      return tg.includes(x + ',' + y);
    }

    function move(id, x, y) {
      api.setLayoutCell({ id, x, y });
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
      if (!picked || !canGo(picked, x, y)) return;
      const id = picked;
      pick(null);
      move(id, x, y);
    }

    // reach (L.reach, from layout-sync): 'blocked', the pointer stops before it, shown red when the device
    // is in the mesh but not connected to this Mac (one that is off is just off); 'behind', only past such a
    // device, greyed: the mouse and keyboard here get to neither (docs/mesh.md, "Chains").
    function tile(id, info, reach) {
      const red = reach === 'blocked' && info.via;
      const state = info.self ? tr('meshm_multi.this_mac', null, 'This Mac') : red ? tr('meshm_multi.not_paired_here', null, 'Not paired here') : reach === 'behind' ? tr('meshm_multi.out_of_reach', null, 'Out of reach')
        : info.connected ? tr('sidebar.connected', null, 'Connected') : tr('sidebar.not_connected', null, 'Not connected');
      const tip = { name: info.name, state };
      const title = red ? tr('meshm_multi.name_state_not_connected_to', tip, '{name} — {state}: not connected to this Mac, so the pointer stops before it')
        : reach === 'behind' ? tr('meshm_multi.name_state_the_pointer_gets', tip, '{name} — {state}: the pointer gets there only past a device it can\'t reach from here')
          : tr('meshm_multi.name_state', tip, '{name} — {state}');
      return el('button', {
        class: 'lay-tile' + (info.self ? ' here' : '') + (info.connected || info.self || red ? '' : ' off') + (red ? ' blocked' : '')
          + (reach === 'behind' ? ' behind' : '') + (picked === id ? ' picked' : ''),
        attrs: { type: 'button', title },
        onclick: () => onTile(id),
      }, [
        UI.osIcon(info.os),
        el('span', { class: 'lay-name', text: info.name }),
        el('span', { class: 'lay-state', text: state }),
      ]);
    }

    function place(x, y) {
      const ok = !!picked && canGo(picked, x, y);
      return el('button', {
        class: 'lay-place' + (ok ? ' target' : ''),
        disabled: !!picked && !ok,
        attrs: { type: 'button', 'aria-label': ok ? tr('mesh_multi.move_here', null, 'Move here') : tr('mesh_multi.empty_place', null, 'Empty place') },
        onclick: () => onPlace(x, y),
      });
    }

    function drawLayout(s) {
      const lay = s && s.layout;
      if (!lay || !lay.grid) return;
      if (picked && !lay.cells[picked]) picked = null; // a device that is gone cannot be moved
      const people = new Map([[s.macId, { name: s.macName || tr('meshm_multi.this_mac', null, 'This Mac'), os: 'mac', connected: true, self: true }]]);
      for (const d of s.peers || []) {
        if (d && d.id) people.set(d.id, { name: d.name || d.id.slice(0, 8), os: d.os, connected: !!d.connected, self: false, via: d.state === 'via' });
      }
      const at = new Map();
      for (const id of Object.keys(lay.cells)) at.set(`${lay.cells[id].x},${lay.cells[id].y}`, id);
      const g = lay.grid;
      gridEl.style.gridTemplateColumns = `repeat(${g.maxX - g.minX + 1}, minmax(96px, 1fr))`;
      const cells = [];
      for (let y = g.minY; y <= g.maxY; y++) {
        for (let x = g.minX; x <= g.maxX; x++) {
          const id = at.get(`${x},${y}`);
          cells.push(id ? tile(id, people.get(id) || { name: id.slice(0, 8), os: '', connected: false, self: false }, lay.reach && lay.reach[id]) : place(x, y));
        }
      }
      gridEl.replaceChildren(...cells);
      const reach = lay.reach || {};
      const red = Object.keys(reach).filter((id) => reach[id] === 'blocked' && (people.get(id) || {}).via);
      const many = red.length > 1;
      const behind = Object.values(reach).includes('behind');
      const joined = (s.mesh || {}).autoJoin === true;
      const names = { names: red.map((id) => people.get(id).name).join(', ') };
      // Two sentences: why the pointer stops, then what to do (each a whole template: the pronouns follow the count).
      reachNote.set(red.length ? [
        many ? (behind ? tr('meshm_multi.names_arent_connected_to_this_behind', names, '{names} aren\'t connected to this Mac, so the pointer stops before them and doesn\'t get to the devices past them.') : tr('meshm_multi.names_arent_connected_to_this', names, '{names} aren\'t connected to this Mac, so the pointer stops before them.'))
          : (behind ? tr('meshm_multi.names_isnt_connected_to_this_behind', names, '{names} isn\'t connected to this Mac, so the pointer stops before it and doesn\'t get to the devices past it.') : tr('meshm_multi.names_isnt_connected_to_this', names, '{names} isn\'t connected to this Mac, so the pointer stops before it.')),
        many ? (joined ? tr('meshm_multi.pair_them_with_this_mac', null, 'Pair them with this Mac.') : tr('meshm_multi.pair_them_with_this_mac_join', null, 'Pair them with this Mac, or turn on Join every device automatically.'))
          : (joined ? tr('meshm_multi.pair_it_with_this_mac', null, 'Pair it with this Mac.') : tr('meshm_multi.pair_it_with_this_mac_join', null, 'Pair it with this Mac, or turn on Join every device automatically.')),
      ].join(' ') : '');
      layoutHint.set(picked
        ? tr('meshm_multi.now_click_a_lit_place', null, 'Now click a lit place next to another device to move it there, or another device to swap places.')
        : tr('meshm_multi.click_a_device_then_a', null, 'Click a device, then a place next to another device to move it there, or another device to swap places. Devices sit side by side, with no empty space between them.'));
    }


    const joinSw = UI.switch((v) => api.setMesh({ autoJoin: v }), { label: tr('mesh_multi.join_auto', null, 'Join every device automatically') });
    const joinRow = UI.row(tr('mesh_multi.join_auto', null, 'Join every device automatically'), '', [joinSw]);

    body.append(
      UI.card(tr('mesh_multi.mesh_mode', null, 'Mesh mode'), [
        UI.row(tr('mesh_multi.use_several_devices', null, 'Use several devices at once'), tr('mesh_multi.restart_hint', null, 'On. DuoDesk restarts when you turn it on or off'), [turnOff]),
      ]),
      UI.card(tr('mesh_multi.layout', null, 'Layout'), [gridEl, reachNote, layoutHint], { cls: 'keep-on' }),
      UI.card(tr('mesh_multi.joining', null, 'Joining'), [joinRow]),
    );

    return (s) => {
      last = s;
      drawLayout(s);
      const jn = !!(s.mesh && s.mesh.autoJoin === true);
      joinSw.set(jn);
      joinRow.setHint(jn ? tr('meshm_multi.pair_with_one_device_and', null, 'Pair with one device and the rest connect to this Mac by themselves. Devices you pair with can introduce others, without a pairing code')
        : tr('meshm_multi.off_this_mac_neither_introduces', null, 'Off: this Mac neither introduces devices to each other nor accepts an introduction. Pair each device yourself'));
    };
  },
});
})();
