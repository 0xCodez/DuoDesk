// MacShare — Copyright (C) 2026 MacShare contributors. GPL-3.0, see LICENSE.
// Overview tab: the two computers, one switch per feature and direction, paired PCs.
'use strict';

UI.tab({
  id: 'overview',
  order: 0,
  title: 'Overview',
  heading: 'MacShare',
  desc: '',
  color: 'linear-gradient(#8e8e93, #636366)',
  build(body) {
    const { el, api } = UI;
    const WHERE = { driving: 'You’re using the PC', driven: 'The PC is using this Mac' };

    const linkLine = el('div', { class: 'hero-link' }, [el('span', { class: 'hero-pulse' })]);
    const linkText = el('div', { class: 'hero-link-text' });
    const peerName = el('div', { class: 'hero-name' });
    const macName = el('div', { class: 'hero-name' });
    const status = el('div', { class: 'hero-status' });
    const hero = el('div', { class: 'card hero' }, [
      el('div', { class: 'hero-devices' }, [
        el('div', { class: 'hero-device' }, [el('div', { class: 'device mac' }), macName]),
        el('div', { class: 'hero-mid' }, [linkLine, linkText]),
        el('div', { class: 'hero-device' }, [el('div', { class: 'device pc' }), peerName]),
      ]),
      status,
    ]);

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
      sw('Shared folder', 'files', (s) => s.smb && s.smb.sharing, (v) => api.setShareMac(v)),
      sw('Terminal', 'terminal', (s) => s.terminal && s.terminal.connectPc, (v) => api.setTerminal({ connectPc: v })),
      sw('Apps', 'apps', (s) => s.apps && s.apps.offer, (v) => api.setApps({ offer: v })),
    ];
    const w2m = [
      sw('Screen', 'receive', (s) => s.receive && s.receive.on, (v) => api.setReceive({ on: v })),
      sw('Sound', 'audio', (s) => s.audio && s.audio.receive, (v) => api.setAudio({ receive: v })),
      sw('Mouse and keyboard', 'cursor', (s) => s.kvm && s.kvm.beDriven, (v) => api.setKvm({ beDriven: v })),
      sw('Clipboard', 'clipboard', (s) => s.clipboard && s.clipboard.receive, (v) => api.setClipboard({ receive: v })),
      sw('Shared folder', 'files', (s) => s.smb && s.smb.connectPc, (v) => api.setSmb({ connectPc: v })),
      sw('Terminal', 'terminal', (s) => s.terminal && s.terminal.allowPc, (v) => api.setTerminal({ allowPc: v })),
      sw('Apps', 'apps', (s) => s.papps && s.papps.on, (v) => api.setPcApps({ on: v })),
    ];
    const quick = [...m2w, ...w2m];

    const pairedList = el('div');

    body.append(
      hero,
      UI.pair(UI.dir('m2w', m2w.map((x) => x.row)), UI.dir('w2m', w2m.map((x) => x.row))),
      UI.card('Paired', [pairedList]),
    );

    return (s) => {
      const c = s.client;
      macName.textContent = s.macName;
      peerName.textContent = c ? c.name : s.paired.length ? s.paired[0].name : 'Your PC';
      linkLine.className = `hero-link ${c ? 'up' : ''}`;
      linkText.textContent = c ? (c.rttMs != null ? `${c.rttMs} ms` : 'Connected') : s.pairing ? 'Pairing…' : 'Not connected';
      const inp = s.input || { where: 'home' };
      status.textContent = s.serverError
        ? s.serverError
        : c
          ? WHERE[inp.where] || 'Connected'
          : s.paired.length
            ? 'Open MacShare on your PC to connect.'
            : 'Open MacShare on your PC and pair it with this Mac.';
      status.classList.toggle('bad', !!s.serverError);

      for (const x of quick) x.c.set(x.get(s));

      pairedList.replaceChildren(
        ...(s.paired.length
          ? s.paired.map((d) => {
            const online = c && c.id === d.id;
            return UI.row(d.name, online ? 'Connected' : `Last seen ${UI.ago(d.lastSeen)}`,
              [online ? el('span', { class: 'pill good', text: 'Online' }) : null, UI.button('Forget', () => api.forget(d.id), 'small')]);
          })
          : [UI.row('No PC yet', 'Click Pair next to this Mac in the PC app.')]),
      );
    };
  },
});
