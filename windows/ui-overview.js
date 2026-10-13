// TwinDesk — Copyright (C) 2026 inukaasith. GPL-3.0, see LICENSE.
// Overview tab (docs/UI.md "Revision 4"): this PC's address and Connect by address on top, the
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
    const WHERE = { driving: 'You’re using {there}', driven: '{There} is using {me}' };

    const linkLine = el('div', { class: 'hero-link' }, [el('span', { class: 'hero-pulse' })]);
    const linkText = el('div', { class: 'hero-link-text' });
    const pcName = el('div', { class: 'hero-name' });
    const macName = el('div', { class: 'hero-name' });
    const status = el('div', { class: 'hero-status' });
    const peerDev = el('div', { class: 'device mac' });
    const hero = el('div', { class: 'card hero' }, [
      el('div', { class: 'hero-devices' }, [
        el('div', { class: 'hero-device' }, [el('div', { class: 'device pc' }), pcName]),
        el('div', { class: 'hero-mid' }, [linkLine, linkText]),
        el('div', { class: 'hero-device' }, [peerDev, macName]),
      ]),
      status,
    ]);

    // One switch per feature and direction, labels only; the row opens the tab.
    // macOnly: Terminal, off with a PC or Linux peer for now (docs/UI.md "Revision 4");
    // 'linux': off only with a Linux peer (Notifications, revision 5; Apps, revision 9).
    const row = (label, tab, get, set, macOnly) => {
      const sw = UI.switch(set || (() => {}), { label, disabled: !set });
      const r = UI.row(label, '', [sw, el('span', { class: 'chev', text: '›' })], { onClick: () => UI.go(tab) });
      r.update = (s) => {
        const limited = !macOnly || !s.peer ? '' : macOnly === 'linux' ? (s.peer.os === 'linux' ? 'Not on Linux yet' : '') : UI.peer(s).limited;
        sw.set(!limited && get(s));
        sw.disable(!set || !!limited);
        r.setHint(limited);
      };
      return r;
    };
    const m2p = [
      row('Screen', 'mac-pc', (s) => s.stream.state === 'on'),
      row('Sound', 'audio', (s) => s.audio.receive, (v) => api.setAudio({ receive: v })),
      row('Mouse and keyboard', 'cursor', (s) => s.kvm.beDriven, (v) => api.setKvm({ beDriven: v })),
      row('Clipboard', 'clipboard', (s) => s.clipboard.receive, (v) => api.setClipboard({ receive: v })),
      row('Notifications', 'notifications', (s) => s.notifs.receive, (v) => api.setNotifs({ receive: v }), 'linux'),
      row('Shared folder', 'files', (s) => s.files.mountMac, (v) => api.setFiles({ mountMac: v })),
      row('Terminal', 'terminal', (s) => s.terminal.allowMac, (v) => api.setTerminal({ allowMac: v }), true),
      row('Apps', 'apps', (s) => s.apps.open > 0, null, 'linux'),
    ];
    const p2m = [
      row('Screen', 'pc-mac', (s) => s.pcScreen.mode !== 'off', (v) => api.setPcScreenMode(v ? 'mirror' : 'off')),
      row('Sound', 'audio', (s) => s.audio.send, (v) => api.setAudio({ send: v })),
      row('Mouse and keyboard', 'cursor', (s) => s.kvm.driveOther, (v) => api.setKvm({ driveOther: v })),
      row('Clipboard', 'clipboard', (s) => s.clipboard.send, (v) => api.setClipboard({ send: v })),
      row('Notifications', 'notifications', (s) => s.notifs.send, (v) => api.setNotifs({ send: v }), 'linux'),
      row('Shared folder', 'files', (s) => s.files.shareOn, (v) => api.setShareOn(v)),
      row('Terminal', 'terminal', (s) => s.terminal.enabled, (v) => api.setTerminal({ enabled: v }), true),
      row('Apps', 'apps', (s) => s.pcApps.allow, (v) => api.setPcApps({ allow: v }), 'linux'),
    ];
    const pair = UI.dirCards({ rows: m2p }, { rows: p2m });

    // ---- this PC + connect by address (always visible) ----
    const addrVal = el('span', { class: 'value addr' });
    const copyBtn = UI.button('Copy', () => UI.state && api.copyText(UI.state.addresses[0] || ''), 'small');
    const addrRow = UI.row('{me}', '', [addrVal, copyBtn]);
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
      const p = UI.peer(s);
      macName.textContent = s.peer ? s.peer.name : 'The other computer';
      peerDev.className = 'device ' + (p.os === 'mac' ? 'mac' : 'pc');
      linkLine.className = 'hero-link' + (connected ? ' up' : '');
      linkText.textContent = connected ? (l.rtt != null ? l.rtt + ' ms' : 'Connected')
        : s.pairing ? 'Pairing…' : s.paired ? 'Connecting…' : 'Not connected';
      const bad = l.state === 'identity_changed';
      status.textContent = bad ? 'This ' + p.kind + ' looks different now. Forget it and pair again.'
        : connected ? s.kvmState.message || (WHERE[s.input] || 'Connected').replace('{there}', p.the).replace('{There}', p.the.charAt(0).toUpperCase() + p.the.slice(1))
          : s.peer ? 'Open TwinDesk on ' + s.peer.name + '.'
            : 'Pick a computer below, or connect by address.';
      status.classList.toggle('bad', bad);

      for (const r of m2p.concat(p2m)) r.update(s);

      // this PC
      addrVal.textContent = s.addresses.length ? s.addresses[0] : 'No network'; // revision 7b: the one the other computer can reach
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
      // Paired both ways: the computer we connect to (s.paired) and the ones that connect to us (s.guests).
      const known = new Set([...(s.paired ? [s.paired.macId] : []), ...s.guests.map((g) => g.id)]);
      const live = s.peer && connected ? s.peer.id : '';
      const fk = JSON.stringify([s.found, [...known], live, busy, blocked]);
      if (fk !== foundKey) {
        foundKey = fk;
        let focus = null;
        const rows = s.found.map((dev) => {
          const isKnown = known.has(dev.id);
          const online = dev.id === live;
          // A Mac hosts; with a PC or Linux the one who clicks is the guest (revision 4).
          const btn = online || isKnown ? null : UI.button(dev.os === 'mac' ? 'Pair' : 'Connect', () => api.pair(dev.id), 'small' + (dev.invited ? ' primary' : ''));
          if (btn) btn.disabled = busy || connected;
          if (btn && dev.invited && !busy) focus = btn;
          const r = UI.row(dev.name, dev.address + (dev.invited ? ' · wants to connect' : ''), [
            online ? el('span', { class: 'pill good', text: 'Connected' }) : isKnown ? el('span', { class: 'pill muted', text: 'Paired' }) : null, btn]);
          r.querySelector('.text').prepend(UI.osIcon(dev.os));
          r.classList.add('with-ico');
          return r;
        });
        if (!rows.length && !blocked) rows.push(UI.row('Looking for computers…', 'Open TwinDesk on the other computer.'));
        foundList.replaceChildren(...rows);
        if (focus) focus.focus();
      }

      // paired
      const wk = s.wake || { peers: {} };
      const pk = JSON.stringify([s.paired, s.guests, live, Object.keys(wk.peers), wk.waking]);
      if (pk === pairedKey) return;
      pairedKey = pk;
      const all = [
        ...(s.paired ? [{ id: s.paired.macId, name: s.paired.macName, os: s.paired.os, hint: s.paired.address, forget: () => api.forget() }] : []),
        ...s.guests.map((g) => ({ id: g.id, name: g.name, os: g.os, hint: g.lastSeen ? 'Last seen ' + UI.ago(g.lastSeen) : '', forget: () => api.forgetGuest(g.id) })),
      ];
      pairedList.replaceChildren(...(all.length ? all.map((x) => {
        const online = x.id === live;
        const waking = !online && wk.waking === x.id;
        // Revision 7: an offline computer that told us how to wake it gets Wake.
        const wakeBtn = !online && wk.peers[x.id] ? UI.button(waking ? 'Waking…' : 'Wake', () => api.wakePeer(x.id), 'small') : null;
        if (wakeBtn) wakeBtn.disabled = waking;
        const r = UI.row(x.name, online ? 'Connected' : waking ? 'Waking ' + x.name + '…' : x.hint, [
          online ? el('span', { class: 'pill good', text: 'Online' }) : null,
          wakeBtn,
          UI.button('Forget', x.forget, 'small'),
        ]);
        r.querySelector('.text').prepend(UI.osIcon(x.os));
        r.classList.add('with-ico');
        return r;
      }) : [UI.row('Nothing paired yet', 'Pair with a computer in Found nearby.')]));
    };
    return update;
  },
});
