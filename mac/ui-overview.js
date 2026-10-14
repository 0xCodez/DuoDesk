// TwinDesk — Copyright (C) 2026 inukaasith. GPL-3.0, see LICENSE.
// Overview tab: this Mac's address and Connect by address on top, the
// computers nearby (always visible), the two computers, one switch per feature and direction,
// and everything paired.
'use strict';

UI.tab({
  id: 'overview',
  order: 0,
  title: 'Overview',
  heading: 'TwinDesk',
  desc: '',
  color: 'linear-gradient(#8e8e93, #636366)',
  badge: (s) => (s.discovery && (!s.discovery.on || !s.discovery.localNetwork) ? '!' : ''),
  build(body) {
    const { el, api } = UI;

    // ---- this Mac + connect by address ----
    const addrVal = el('span', { class: 'value addr' });
    const copyBtn = UI.button('Copy', () => UI.state && api.copyText(UI.state.addresses[0] || ''), 'small');
    const addrRow = UI.row('{me}', 'Its address', [addrVal, copyBtn]);
    const ipInput = el('input', { type: 'text', placeholder: '192.168.1.20', autocomplete: 'off', spellcheck: false, attrs: { 'aria-label': 'Address' } });
    const ipBtn = UI.button('Connect', () => api.connectAddress(ipInput.value), 'small primary');
    ipInput.onkeydown = (e) => { if (e.key === 'Enter') ipBtn.click(); };
    const ipRow = UI.row('Connect by address', '', [ipInput, ipBtn]);

    // ---- nearby ----
    const discRow = UI.row('', '', []);
    const discFix = UI.button('Allow', () => api.allowPermission('localNetwork'), 'small');
    discRow.querySelector('.controls').append(discFix);
    const foundList = el('div');
    const refresh = UI.button('Refresh', () => api.refreshDiscovery(), 'small');

    // ---- hero ----
    const WHERE = { driving: 'You’re using {name}', driven: '{name} is using {me}' };
    const linkLine = el('div', { class: 'hero-link' }, [el('span', { class: 'hero-pulse' })]);
    const linkText = el('div', { class: 'hero-link-text' });
    const peerName = el('div', { class: 'hero-name' });
    const macName = el('div', { class: 'hero-name' });
    const peerDev = el('div', { class: 'device pc' });
    const status = el('div', { class: 'hero-status' });
    const hero = el('div', { class: 'card hero' }, [
      el('div', { class: 'hero-devices' }, [
        el('div', { class: 'hero-device' }, [el('div', { class: 'device mac' }), macName]),
        el('div', { class: 'hero-mid' }, [linkLine, linkText]),
        el('div', { class: 'hero-device' }, [peerDev, peerName]),
      ]),
      status,
    ]);

    // ---- feature switches ----
    const sw = (label, tab, get, set) => {
      const c = UI.switch(set, { label });
      const row = UI.row(label, '', [c, el('span', { class: 'chev', text: '›' })], { onClick: () => UI.go(tab) });
      return { c, row, get };
    };
    const m2w = [
      sw('Screen', 'share', (s) => s.sharing && s.sharing.on, (v) => api.setSharing(v)),
      sw('Sound', 'audio', (s) => s.audio && s.audio.send, (v) => api.setAudio({ send: v })),
      sw('Mouse and keyboard', 'cursor', (s) => s.kvm && s.kvm.driveOther, (v) => api.setKvm({ driveOther: v })),
      sw('Clipboard', 'clipboard', (s) => s.clipboard && s.clipboard.send, (v) => api.setClipboard({ send: v })),
      sw('Notifications', 'notifications', (s) => s.notifs && s.notifs.send, (v) => api.setNotifs({ send: v })),
      sw('Shared folder', 'files', (s) => s.smb && s.smb.sharing, (v) => api.setShareMac(v)),
      sw('Terminal', 'terminal', (s) => s.terminal && s.terminal.connectPc, (v) => api.setTerminal({ connectPc: v })),
      sw('Apps', 'apps', (s) => s.apps && s.apps.offer, (v) => api.setApps({ offer: v })),
    ];
    const w2m = [
      sw('Screen', 'receive', (s) => s.receive && s.receive.open, (v) => (v ? api.showPcView() : api.closePcView())),
      sw('Sound', 'audio', (s) => s.audio && s.audio.receive, (v) => api.setAudio({ receive: v })),
      sw('Mouse and keyboard', 'cursor', (s) => s.kvm && s.kvm.beDriven, (v) => api.setKvm({ beDriven: v })),
      sw('Clipboard', 'clipboard', (s) => s.clipboard && s.clipboard.receive, (v) => api.setClipboard({ receive: v })),
      sw('Notifications', 'notifications', (s) => s.notifs && s.notifs.receive, (v) => api.setNotifs({ receive: v })),
      sw('Shared folder', 'files', (s) => s.smb && s.smb.connectPc, (v) => api.setSmb({ connectPc: v })),
      sw('Terminal', 'terminal', (s) => s.terminal && s.terminal.allowPc, (v) => api.setTerminal({ allowPc: v })),
      sw('Apps', 'apps', (s) => s.papps && s.papps.on, (v) => api.setPcApps({ on: v })),
    ];
    const quick = [...m2w, ...w2m];
    const pairedList = el('div');

    body.append(
      UI.card('', [addrRow, ipRow]),
      UI.card('Nearby', [discRow, foundList], { actions: [refresh] }),
      hero,
      UI.pair(UI.dir('m2w', m2w.map((x) => x.row)), UI.dir('w2m', w2m.map((x) => x.row))),
      UI.card('Paired', [pairedList]),
    );

    let foundKey = '';
    let pairedKey = '';
    return (s) => {
      const p = UI.names(s);
      const c = s.client;
      const g = s.guest || { status: {}, hosts: [] };

      // this Mac
      addrVal.textContent = s.addresses.length ? s.addresses[0] : 'No network';
      copyBtn.hidden = !s.addresses.length;
      const cn = s.connect || {};
      const gp = g.pairing;
      ipBtn.disabled = !!cn.busy || !!(gp && gp.phase !== 'failed');
      ipRow.setHint(gp && gp.phase === 'failed' ? gp.error : cn.message);
      ipRow.hint.classList.toggle('bad', !!(cn.error || (gp && gp.phase === 'failed')));

      // nearby
      const d = s.discovery || { on: true, localNetwork: true };
      const blocked = !d.on || !d.localNetwork;
      discRow.hidden = !blocked;
      discRow.label.textContent = 'Can’t look for computers on this network.';
      discRow.setHint(!d.localNetwork ? 'Allow Local Network for TwinDesk, or connect by address.' : d.error);
      discFix.hidden = d.localNetwork;
      const pairedIds = new Set([...s.paired.map((x) => x.id), ...g.hosts.map((x) => x.id)]);
      const fk = JSON.stringify([s.found, [...pairedIds], c && c.id, blocked]);
      if (fk !== foundKey) {
        foundKey = fk;
        const rows = s.found.map((dev) => {
          const online = c && c.id === dev.id;
          const known = pairedIds.has(dev.id);
          const label = online ? null : known ? 'Connect' : dev.os === 'mac' ? 'Pair' : 'Connect';
          const btn = label && UI.button(label, () => api.pairWith(dev.id), `small${dev.invited ? ' primary' : ''}`);
          const r = UI.row(dev.name, `${dev.address}${dev.invited ? ' · wants to connect' : ''}`,
            [online ? el('span', { class: 'pill good', text: 'Connected' }) : known ? el('span', { class: 'pill muted', text: 'Paired' }) : null, btn]);
          r.querySelector('.text').prepend(UI.osIcon(dev.os));
          r.classList.add('with-ico');
          return r;
        });
        if (!rows.length && !blocked) rows.push(UI.row('Looking for computers…', 'Open TwinDesk on the other computer.'));
        foundList.replaceChildren(...rows);
      }

      // hero
      macName.textContent = s.macName;
      peerName.textContent = c ? c.name : p.Name;
      peerDev.className = `device ${p.os === 'mac' ? 'mac' : 'pc'}`;
      linkLine.className = `hero-link ${c ? 'up' : ''}`;
      const connecting = ['connecting', 'reconnecting'].includes(g.status.state);
      linkText.textContent = c ? (c.rttMs != null ? `${c.rttMs} ms` : 'Connected')
        : s.pairing || gp ? 'Pairing…' : connecting ? 'Connecting…' : 'Not connected';
      const inp = s.input || { where: 'home' };
      const bad = s.serverError || (g.status.state === 'identity_changed' && g.status.message);
      status.textContent = bad
        || (c ? UI.fill(WHERE[inp.where] || 'Connected')
          : pairedIds.size ? 'Open TwinDesk on the other computer to connect.'
            : 'Pick a computer above, or connect by address.');
      status.classList.toggle('bad', !!bad);

      for (const x of quick) {
        x.c.set(x.get(s));
      }

      // paired: guests (they connect to us) and hosts (we connect to them)
      const wk = (s.wake && s.wake.peers) || {};
      const pk = JSON.stringify([s.paired, g.hosts, c && c.id, Object.keys(wk), s.wake && s.wake.last]);
      if (pk === pairedKey) return;
      pairedKey = pk;
      const all = [...s.paired, ...g.hosts.map((h) => ({ ...h, host: true }))];
      pairedList.replaceChildren(...(all.length
        ? all.map((x) => {
          const online = c && c.id === x.id;
          const r = UI.row(x.name, online ? 'Connected' : `Last seen ${UI.ago(x.lastSeen)}`,
            [online ? el('span', { class: 'pill good', text: 'Online' }) : null,
              // Wake it over the network (it told us how while connected).
              !online && wk[x.id] ? UI.button(s.wake.last && s.wake.last.id === x.id && Date.now() - s.wake.last.at < 20000 ? 'Waking…' : 'Wake', () => api.wakePeer(x.id), 'small') : null,
              UI.button('Forget', () => api.forget(x.id), 'small')]);
          r.querySelector('.text').prepend(UI.osIcon(x.os));
          r.classList.add('with-ico');
          return r;
        })
        : [UI.row('Nothing paired yet', 'Pair with a computer in Nearby.')]));
    };
  },
});
