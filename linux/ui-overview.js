// TwinDesk — Copyright (C) 2026 inukaasith. GPL-3.0, see LICENSE.
// Overview tab (copied from windows/ui-overview.js): this computer's address and Connect by address on top, the
// computers found nearby (always visible), the two computers, one switch per feature and
// direction, and what is paired.
'use strict';

UI.tab({
  id: 'overview',
  order: 0,
  title: 'Overview',
  heading: 'TwinDesk',
  desc: '',
  color: 'linear-gradient(#8e8e93, #636366)',
  badge: (s) => (s.link.state === 'identity_changed' || (s.discovery && !s.discovery.on) || s.found.some((d) => d.invited) ? 'warn' : ''),
  build(body) {
    const { el, api } = UI;

    const linkLine = el('div', { class: 'hero-link' }, [el('span', { class: 'hero-pulse' })]);
    const linkText = el('div', { class: 'hero-link-text' });
    const pcName = el('div', { class: 'hero-name' });
    const macName = el('div', { class: 'hero-name' });
    const status = el('div', { class: 'hero-status' });
    const hero = el('div', { class: 'card hero' }, [
      el('div', { class: 'hero-devices' }, [
        el('div', { class: 'hero-device' }, [el('div', { class: 'device pc' }), pcName]),
        el('div', { class: 'hero-mid' }, [linkLine, linkText]),
        el('div', { class: 'hero-device' }, [el('div', { class: 'device mac' }), macName]),
      ]),
      status,
    ]);

    // One switch per feature and direction, labels only; the row opens the tab. Features that
    // aren't on Linux yet show the row disabled with one line.
    const row = (label, tab, get, set) => {
      const sw = UI.switch(set || (() => {}), { label, disabled: !set });
      const r = UI.row(label, get ? '' : 'Not on Linux yet', [sw, el('span', { class: 'chev', text: '›' })], { onClick: () => UI.go(tab) });
      r.update = (s) => sw.set(get ? get(s) : false);
      return r;
    };
    const m2p = [
      row('Screen', 'mac-pc', (s) => s.stream.state === 'on'),
      row('Sound', 'audio'),
      row('Mouse and keyboard', 'cursor'),
      row('Clipboard', 'clipboard', (s) => s.clipboard.receive, (v) => api.setClipboard({ receive: v })),
      row('Shared folder', 'files'),
      row('Terminal', 'terminal'),
      row('Apps', 'apps'),
    ];
    const p2m = [
      row('Screen', 'pc-mac'),
      row('Sound', 'audio'),
      row('Mouse and keyboard', 'cursor'),
      row('Clipboard', 'clipboard', (s) => s.clipboard.send, (v) => api.setClipboard({ send: v })),
      row('Shared folder', 'files'),
      row('Terminal', 'terminal'),
      row('Apps', 'apps'),
    ];
    const pair = UI.dirCards({ rows: m2p }, { rows: p2m });

    // ---- this computer + connect by address (always visible) ----
    const addrVal = el('span', { class: 'value addr' });
    const copyBtn = UI.button('Copy', () => UI.state && api.copyText(UI.state.addresses[0] || ''), 'small');
    const addrRow = UI.row('This computer', '', [addrVal, copyBtn]);
    const ipInput = el('input', { type: 'text', placeholder: '192.168.1.20', autocomplete: 'off', spellcheck: false, attrs: { 'aria-label': 'Address' } });
    let asking = '';
    const ipBtn = UI.button('Connect', async () => {
      const v = ipInput.value.trim();
      if (!v || asking) return;
      asking = v;
      render();
      try { await api.connectAddress(v); } finally { asking = ''; render(); }
    }, 'small primary');
    ipInput.onkeydown = (e) => { if (e.key === 'Enter') ipBtn.click(); };
    const ipRow = UI.row('Connect by address', '', [ipInput, ipBtn]);

    // ---- found nearby (always visible) ----
    const discRow = UI.row('Can’t look for computers on this network.', '', [UI.button('Fix firewall', () => api.fixFirewall(), 'small')]);
    const foundList = el('div');
    const refresh = UI.button('Refresh', () => api.refreshFound(), 'small');

    const pairedList = el('div');
    body.append(
      UI.card('', [addrRow, ipRow]),
      UI.card('Found nearby', [discRow, foundList], { actions: [refresh] }),
      hero,
      pair.el,
      UI.card('Paired', [pairedList]),
    );

    let last = null;
    let foundKey = '';
    let pairedKey = '';
    const render = () => last && update(last);
    const update = (s) => {
      last = s;
      const l = s.link;
      const connected = l.state === 'connected';
      pcName.textContent = s.device.name;
      macName.textContent = s.paired ? s.paired.macName : 'Your Mac';
      linkLine.className = 'hero-link' + (connected ? ' up' : '');
      linkText.textContent = connected ? (l.rtt != null ? l.rtt + ' ms' : 'Connected')
        : s.pairing ? 'Pairing…' : s.paired ? 'Connecting…' : 'Not connected';
      const bad = l.state === 'identity_changed';
      status.textContent = bad ? 'This Mac looks different now. Forget it and pair again.'
        : connected ? 'Connected'
          : s.paired ? 'Open TwinDesk on your Mac.'
            : 'Pick a computer below, or connect by address.';
      status.classList.toggle('bad', bad);

      for (const r of m2p.concat(p2m)) r.update(s);

      // this computer
      addrVal.textContent = s.addresses.length ? s.addresses.join(', ') : 'No network';
      copyBtn.hidden = !s.addresses.length;
      const busy = !!s.pairing && s.pairing.phase !== 'failed';
      ipBtn.disabled = busy || !!asking;
      const failed = s.pairing && s.pairing.phase === 'failed';
      ipRow.setHint(asking ? 'Looking for TwinDesk at ' + asking + '…' : failed ? s.pairing.error : '');
      ipRow.hint.classList.toggle('bad', !asking && !!failed);

      // found nearby
      const d = s.discovery || { on: true, error: '' };
      const fwBad = s.firewall && s.firewall.ok === false && !s.firewall.checking;
      const blocked = !d.on || fwBad;
      discRow.hidden = !blocked;
      discRow.setHint(!d.on ? d.error + '. Connect by address still works.' : 'The firewall blocks it. Connect by address may still work.');
      const pairedId = s.paired ? s.paired.macId : '';
      const fk = JSON.stringify([s.found, pairedId, connected, busy, blocked]);
      if (fk !== foundKey) {
        foundKey = fk;
        let focus = null;
        const rows = s.found.map((dev) => {
          const known = dev.id === pairedId;
          const online = known && connected;
          const mac = dev.os === 'mac';
          const btn = online || known ? null : UI.button('Pair', () => api.pair(dev.id), 'small' + (dev.invited ? ' primary' : ''));
          if (btn) btn.disabled = busy || !mac; // Linux ↔ Linux and Linux ↔ PC come later
          if (btn && dev.invited && !busy) focus = btn;
          const hint = dev.address + (dev.invited ? ' · wants to connect' : !mac ? ' · only a Mac for now' : '');
          const r = UI.row(dev.name, hint, [
            online ? el('span', { class: 'pill good', text: 'Connected' }) : known ? el('span', { class: 'pill muted', text: 'Paired' }) : null, btn]);
          r.querySelector('.text').prepend(UI.osIcon(dev.os));
          r.classList.add('with-ico');
          return r;
        });
        if (!rows.length && !blocked) rows.push(UI.row('Looking for computers…', 'Open TwinDesk on the other computer.'));
        foundList.replaceChildren(...rows);
        if (focus) focus.focus();
      }

      // paired
      const pk = JSON.stringify([s.paired, connected]);
      if (pk === pairedKey) return;
      pairedKey = pk;
      if (!s.paired) {
        pairedList.replaceChildren(UI.row('Nothing paired yet', 'Pair with a computer in Found nearby.'));
        return;
      }
      const r = UI.row(s.paired.macName, connected ? 'Connected' : s.paired.address, [
        connected ? el('span', { class: 'pill good', text: 'Online' }) : null,
        UI.button('Forget', () => api.forget(), 'small'),
      ]);
      r.querySelector('.text').prepend(UI.osIcon('mac'));
      r.classList.add('with-ico');
      pairedList.replaceChildren(r);
    };
    return update;
  },
});
