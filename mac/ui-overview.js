// MacShare — Copyright (C) 2026 MacShare contributors. GPL-3.0, see LICENSE.
// Overview tab: connection hero, quick switches for every feature, paired PCs, this Mac.
'use strict';

UI.tab({
  id: 'overview',
  order: 0,
  title: 'Overview',
  desc: 'Your Mac and PC working as one. Turn each feature on or off here, or open its tab for details.',
  color: 'linear-gradient(#8e8e93, #636366)',
  build(body) {
    const { el, api } = UI;
    const WHERE = { home: 'Home — this Mac uses its own keyboard and mouse', driving: 'Driving the PC', driven: 'Driven by the PC' };

    // Hero: Mac ─── link ─── PC
    const linkLine = el('div', { class: 'hero-link' });
    const linkText = el('div', { class: 'hero-link-text' });
    const peerName = el('div', { class: 'hero-name' });
    const peerSub = el('div', { class: 'hero-sub' });
    const macName = el('div', { class: 'hero-name' });
    const status = el('div', { class: 'hero-status' });
    const hero = el('div', { class: 'card hero' }, [
      el('div', { class: 'hero-devices' }, [
        el('div', { class: 'hero-device' }, [el('div', { class: 'device mac' }), macName, el('div', { class: 'hero-sub', text: 'This Mac' })]),
        el('div', { class: 'hero-mid' }, [linkLine, linkText]),
        el('div', { class: 'hero-device' }, [el('div', { class: 'device pc' }), peerName, peerSub]),
      ]),
      status,
    ]);

    // Quick switches, one card per direction (docs/UI.md "equal places").
    const sw = (label, hint, tab, get, set, soon) => {
      const c = UI.switch(set || (() => {}), { label, disabled: !!soon });
      const row = UI.row(label, soon ? `Coming in phase ${soon}` : hint, [c, el('span', { class: 'chev', text: '›' })], { onClick: () => UI.go(tab) });
      return { c, row, get: get || (() => false) };
    };
    const m2w = [
      sw('Share this Mac’s screen', 'Monitor 2 on the PC', 'share', (s) => s.sharing && s.sharing.on, (v) => api.setSharing(v)),
      sw('Send this Mac’s sound', 'Plays on the PC', 'audio', (s) => s.audio && s.audio.send, (v) => api.setAudio({ send: v })),
      sw('Use this Mac’s mouse on the PC', 'Push through the edge', 'cursor', (s) => s.kvm && s.kvm.driveOther, (v) => api.setKvm({ driveOther: v })),
      sw('Send clipboard to the PC', '', 'clipboard', (s) => s.clipboard && s.clipboard.send, (v) => api.setClipboard({ send: v })),
      sw('This Mac’s folder as a PC drive', '~/MacShare', 'files', (s) => s.smb && s.smb.sharing, (v) => api.setShareMac(v)),
      sw('Open shells on the PC', 'ssh macshare-pc', 'terminal', (s) => s.terminal && s.terminal.connectPc, (v) => api.setTerminal({ connectPc: v })),
      sw('Mac apps on the PC', 'Each in its own PC window', 'apps', (s) => s.apps && s.apps.offer, (v) => api.setApps({ offer: v })),
    ];
    const w2m = [
      sw('Show the PC’s screen here', '', 'receive', null, null, '11'),
      sw('Play the PC’s sound here', '', 'audio', (s) => s.audio && s.audio.receive, (v) => api.setAudio({ receive: v })),
      sw('Let the PC’s mouse control this Mac', 'The PC pushes through its edge', 'cursor', (s) => s.kvm && s.kvm.beDriven, (v) => api.setKvm({ beDriven: v })),
      sw('Accept clipboard from the PC', '', 'clipboard', (s) => s.clipboard && s.clipboard.receive, (v) => api.setClipboard({ receive: v })),
      sw('The PC’s folder as a Mac drive', 'In Finder’s sidebar', 'files', (s) => s.smb && s.smb.connectPc, (v) => api.setSmb({ connectPc: v })),
      sw('Let the PC open shells here', 'macshare on the PC', 'terminal', (s) => s.terminal && s.terminal.allowPc, (v) => api.setTerminal({ allowPc: v })),
      sw('PC apps on this Mac', '', 'apps', null, null, '13'),
    ];
    const quick = [...m2w, ...w2m];

    const pairedList = el('div');
    const pairedCard = UI.card('Paired PCs', [pairedList]);
    const macRows = {
      addresses: UI.row('Listening on', ''),
      fp: UI.row('Identity', ''),
    };

    body.append(
      hero,
      UI.pair(UI.dir('m2w', m2w.map((x) => x.row), { role: 'this Mac sends' }), UI.dir('w2m', w2m.map((x) => x.row), { role: 'this Mac receives' })),
      pairedCard,
      UI.card('This Mac', Object.values(macRows)),
    );

    return (s) => {
      const c = s.client;
      macName.textContent = s.macName;
      peerName.textContent = c ? c.name : s.paired.length ? s.paired[0].name : 'Your PC';
      peerSub.textContent = c ? c.address : s.paired.length ? `last seen ${UI.ago(s.paired[0].lastSeen)}` : 'not paired yet';
      linkLine.className = `hero-link ${c ? 'up' : ''}`;
      linkText.textContent = c ? (c.rttMs != null ? `${c.rttMs} ms` : 'connected') : s.pairing ? 'pairing…' : 'not connected';
      const inp = s.input || { where: 'home' };
      status.textContent = s.serverError
        ? s.serverError
        : c
          ? `${WHERE[inp.where] || inp.where}${inp.message ? ` — ${inp.message}` : ''}`
          : s.paired.length
            ? 'Waiting for your PC — open MacShare on it.'
            : 'Open MacShare on your PC and click Pair next to this Mac.';
      status.classList.toggle('bad', !!s.serverError);

      for (const x of quick) x.c.set(x.get(s));

      pairedList.replaceChildren(
        ...(s.paired.length
          ? s.paired.map((d) => {
            const online = c && c.id === d.id;
            return UI.row(d.name, online ? 'Connected now' : `Paired ${new Date(d.pairedAt).toLocaleDateString()} · last seen ${UI.ago(d.lastSeen)}`,
              [online ? el('span', { class: 'pill good', text: 'Online' }) : null, UI.button('Forget', () => api.forget(d.id), 'small')]);
          })
          : [UI.row('No paired PCs yet', 'Click Pair next to this Mac in the PC app. Both screens show the same 6-digit code.')]),
      );

      macRows.addresses.setHint(s.addresses.length ? s.addresses.join('   ') : 'No network');
      macRows.fp.setHint(`${s.fp.slice(0, 16)}… (certificate fingerprint the PC pins)`);
    };
  },
});
