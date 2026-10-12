// MacShare — Copyright (C) 2026 MacShare contributors. GPL-3.0, see LICENSE.
// Overview tab: the two computers, one switch per feature and direction, the paired Mac.
'use strict';

UI.tab({
  id: 'overview',
  order: 0,
  title: 'Overview',
  heading: 'MacShare',
  desc: '',
  color: 'linear-gradient(#8e8e93, #636366)',
  badge: (s) => (s.link.state === 'identity_changed' ? 'warn' : ''),
  build(body) {
    const { el, api } = UI;
    const WHERE = { driving: 'You’re using the Mac', driven: 'The Mac is using this PC' };

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

    // One switch per feature and direction, labels only; the row opens the tab.
    const row = (label, tab, get, set) => {
      const sw = UI.switch(set || (() => {}), { label, disabled: !set });
      const r = UI.row(label, '', [sw, el('span', { class: 'chev', text: '›' })], { onClick: () => UI.go(tab) });
      r.update = (s) => sw.set(get(s));
      return r;
    };
    const m2p = [
      row('Screen', 'mac-pc', (s) => s.stream.state === 'on'),
      row('Sound', 'audio', (s) => s.audio.receive, (v) => api.setAudio({ receive: v })),
      row('Mouse and keyboard', 'cursor', (s) => s.kvm.beDriven, (v) => api.setKvm({ beDriven: v })),
      row('Clipboard', 'clipboard', (s) => s.clipboard.receive, (v) => api.setClipboard({ receive: v })),
      row('Shared folder', 'files', (s) => s.files.mountMac, (v) => api.setFiles({ mountMac: v })),
      row('Terminal', 'terminal', (s) => s.terminal.allowMac, (v) => api.setTerminal({ allowMac: v })),
      row('Apps', 'apps', (s) => s.apps.open > 0),
    ];
    const p2m = [
      row('Screen', 'pc-mac', (s) => s.pcScreen.mode !== 'off', (v) => api.setPcScreenMode(v ? 'mirror' : 'off')),
      row('Sound', 'audio', (s) => s.audio.send, (v) => api.setAudio({ send: v })),
      row('Mouse and keyboard', 'cursor', (s) => s.kvm.driveOther, (v) => api.setKvm({ driveOther: v })),
      row('Clipboard', 'clipboard', (s) => s.clipboard.send, (v) => api.setClipboard({ send: v })),
      row('Shared folder', 'files', (s) => s.files.shareOn, (v) => api.setShareOn(v)),
      row('Terminal', 'terminal', (s) => s.terminal.enabled, (v) => api.setTerminal({ enabled: v })),
      row('Apps', 'apps', (s) => s.pcApps.allow, (v) => api.setPcApps({ allow: v })),
    ];
    const pair = UI.dirCards({ rows: m2p }, { rows: p2m });

    const pairedList = el('div');
    const ipInput = el('input', { type: 'text', placeholder: '192.168.1.20', autocomplete: 'off', spellcheck: false, attrs: { 'aria-label': 'Mac address' } });
    const ipBtn = UI.button('Pair', () => { const v = ipInput.value.trim(); if (v) api.pair(v); }, 'small');
    ipInput.onkeydown = (e) => { if (e.key === 'Enter') ipBtn.click(); };
    const ipRow = UI.row('Add by address', '', [ipInput, ipBtn]);

    body.append(hero, pair.el, UI.card('Paired', [pairedList, ipRow]));

    let listKey = '';
    return (s) => {
      const l = s.link;
      const connected = l.state === 'connected';
      pcName.textContent = s.device.name;
      macName.textContent = s.paired ? s.paired.macName : 'Your Mac';
      linkLine.className = 'hero-link' + (connected ? ' up' : '');
      linkText.textContent = connected ? (l.rtt != null ? l.rtt + ' ms' : 'Connected')
        : s.pairing ? 'Pairing…' : s.paired ? 'Connecting…' : 'Not connected';
      const bad = l.state === 'identity_changed';
      status.textContent = bad ? 'This Mac looks different now. Forget it and pair again.'
        : connected ? s.kvmState.message || WHERE[s.input] || 'Connected'
          : s.paired ? 'Open MacShare on your Mac.'
            : 'Open MacShare on your Mac and pair it here.';
      status.classList.toggle('bad', bad);

      for (const r of m2p.concat(p2m)) r.update(s);

      const busy = !!s.pairing && s.pairing.phase !== 'failed';
      ipBtn.disabled = busy;
      ipRow.hidden = !!s.paired;
      const key = JSON.stringify([s.macs, busy, s.paired, connected, s.discoveryError]);
      if (key === listKey) return;
      listKey = key;
      const rows = [];
      if (s.paired) {
        rows.push(UI.row(s.paired.macName, connected ? 'Connected' : '', [
          connected ? el('span', { class: 'pill good', text: 'Online' }) : null,
          UI.button('Forget', () => api.forget(), 'small'),
        ]));
      } else {
        for (const mac of s.macs) {
          const b = UI.button('Pair', () => api.pair(mac.id), 'small primary');
          b.disabled = busy;
          rows.push(UI.row(mac.name, '', [b]));
        }
        if (!s.macs.length) rows.push(UI.row(s.discoveryError ? 'Can’t look for Macs' : 'Looking for Macs…', s.discoveryError || ''));
      }
      pairedList.replaceChildren(...rows);
    };
  },
});
