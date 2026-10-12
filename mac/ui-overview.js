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

    // Quick switches
    const quick = [
      { id: 'share', label: 'Share this screen', hint: 'Monitor 2 on the PC', get: (s) => s.sharing && s.sharing.on, set: (v) => api.setSharing(v) },
      { id: 'share', label: 'Receive input', hint: 'The PC controls this Mac inside Monitor 2', get: (s) => s.streamInput, set: (v) => api.setStreamInput(v) },
      { id: 'cursor', label: 'Cursor sharing', hint: 'Push the pointer across the screen edge', get: (s) => s.kvm && s.kvm.mouse, set: (v) => api.setKvm({ mouse: v }) },
      { id: 'keyboard', label: 'Keyboard sharing', hint: 'Typing follows the pointer; double-tap Right Option', get: (s) => s.kvm && s.kvm.keyboard, set: (v) => api.setKvm({ keyboard: v }) },
      { id: 'clipboard', label: 'Clipboard', hint: 'Copy on one, paste on the other', get: (s) => s.clipboard && s.clipboard.enabled, set: (v) => api.setClipboard({ enabled: v }) },
    ].map((q) => {
      const sw = UI.switch(q.set, { label: q.label });
      const row = UI.row(q.label, q.hint, [sw, el('span', { class: 'chev', text: '›' })], { onClick: () => UI.go(q.id) });
      return { q, sw, row };
    });

    const pairedList = el('div');
    const pairedCard = UI.card('Paired PCs', [pairedList]);
    const macRows = {
      addresses: UI.row('Listening on', ''),
      fp: UI.row('Identity', ''),
    };

    body.append(
      hero,
      UI.card('Features', quick.map((x) => x.row)),
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

      for (const { q, sw } of quick) sw.set(q.get(s));

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
