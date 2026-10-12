// MacShare — Copyright (C) 2026 MacShare contributors. GPL-3.0, see LICENSE.
// Overview tab: connection hero, feature quick switches, paired Mac, Macs on this network.
'use strict';

UI.tab({
  id: 'overview',
  order: 0,
  title: 'Overview',
  desc: 'Your PC and Mac working as one. Turn each feature on or off here, or open its tab for details.',
  color: 'linear-gradient(#8e8e93, #636366)',
  badge: (s) => (s.link.state === 'identity_changed' ? 'warn' : ''),
  build(body) {
    const { el, api } = UI;
    const WHERE = { home: 'Home — this PC uses its own keyboard and mouse', driving: 'Driving the Mac', driven: 'Driven by the Mac' };

    // Hero: PC ─── link ─── Mac
    const linkLine = el('div', { class: 'hero-link' });
    const linkText = el('div', { class: 'hero-link-text' });
    const pcName = el('div', { class: 'hero-name' });
    const macName = el('div', { class: 'hero-name' });
    const macSub = el('div', { class: 'hero-sub' });
    const status = el('div', { class: 'hero-status' });
    const hero = el('div', { class: 'card hero' }, [
      el('div', { class: 'hero-devices' }, [
        el('div', { class: 'hero-device' }, [el('div', { class: 'device pc' }), pcName, el('div', { class: 'hero-sub', text: 'This PC' })]),
        el('div', { class: 'hero-mid' }, [linkLine, linkText]),
        el('div', { class: 'hero-device' }, [el('div', { class: 'device mac' }), macName, macSub]),
      ]),
      status,
    ]);

    // Every feature, once per direction, in the same place as on the Mac (docs/UI.md).
    const row = (q) => {
      const sw = UI.switch(q.set || (() => {}), { label: q.label, disabled: !q.set });
      const r = UI.row(q.label, q.hint, [sw, el('span', { class: 'chev', text: '›' })], { onClick: () => UI.go(q.id) });
      r.update = (s) => sw.set(q.get(s));
      return r;
    };
    const m2p = [
      { id: 'mac-pc', label: 'The Mac’s screen', hint: 'Monitor 2 (the Mac turns sharing on)', get: (s) => s.stream.state === 'on' },
      { id: 'cursor', label: 'Mac drives this PC', hint: 'Its mouse and keyboard cross the edge', get: (s) => s.kvm.beDriven, set: (v) => api.setKvm({ beDriven: v }) },
      { id: 'clipboard', label: 'Accept the Mac’s clipboard', hint: 'Copy there, paste here', get: (s) => s.clipboard.receive, set: (v) => api.setClipboard({ receive: v }) },
      { id: 'audio', label: 'Play the Mac’s sound', hint: 'On this PC’s speakers', get: (s) => s.audio.receive, set: (v) => api.setAudio({ receive: v }) },
      { id: 'files', label: 'Files from the Mac', hint: 'Dragged across the edge; its folder as a drive', get: (s) => s.files.acceptFromMac, set: (v) => api.setFiles({ acceptFromMac: v }) },
      { id: 'terminal', label: 'Shell on this PC', hint: 'The Mac opens one here', get: (s) => s.terminal.allowMac, set: (v) => api.setTerminal({ allowMac: v }) },
    ].map(row);
    const p2m = [
      { id: 'pc-mac', label: 'This PC’s screen', hint: 'Coming in phase 11', get: () => false },
      { id: 'cursor', label: 'This PC drives the Mac', hint: 'Push through the edge or double-tap Right Ctrl', get: (s) => s.kvm.driveOther, set: (v) => api.setKvm({ driveOther: v }) },
      { id: 'clipboard', label: 'Send the clipboard', hint: 'Copy here, paste on the Mac', get: (s) => s.clipboard.send, set: (v) => api.setClipboard({ send: v }) },
      { id: 'audio', label: 'Send this PC’s sound', hint: 'To the Mac’s speakers', get: (s) => s.audio.send, set: (v) => api.setAudio({ send: v }) },
      { id: 'files', label: 'Files to the Mac', hint: 'Drag across the edge or onto Monitor 2', get: (s) => s.files.dropToMac, set: (v) => api.setFiles({ dropToMac: v }) },
      { id: 'terminal', label: 'Shell on the Mac', hint: 'Open one from here', get: (s) => s.terminal.enabled, set: (v) => api.setTerminal({ enabled: v }) },
    ].map(row);
    const pair = UI.dirCards({ rows: m2p }, { rows: p2m });
    const devices = [
      { id: 'cursor', label: 'Share the cursor', hint: 'Both directions', get: (s) => s.kvm.mouse, set: (v) => api.setKvm({ mouse: v }) },
      { id: 'keyboard', label: 'Share the keyboard', hint: 'Both directions', get: (s) => s.kvm.keyboard, set: (v) => api.setKvm({ keyboard: v }) },
      { id: 'clipboard', label: 'Clipboard', hint: 'Both directions', get: (s) => s.clipboard.enabled, set: (v) => api.setClipboard({ enabled: v }) },
    ].map(row);

    const monitorBtn = UI.button('Open Monitor 2', () => api.openMonitor(), 'small');
    const pairedRow = UI.row('', '', [monitorBtn, UI.button('Forget', () => api.forget(), 'small')]);
    const pairedCard = UI.card('Paired Mac', [pairedRow]);

    const macList = el('div');
    const ipInput = el('input', { type: 'text', placeholder: 'e.g. 192.168.1.20', autocomplete: 'off', spellcheck: false, attrs: { 'aria-label': 'Mac address' } });
    const ipBtn = UI.button('Pair', () => { const v = ipInput.value.trim(); if (v) api.pair(v); }, 'small');
    ipInput.onkeydown = (e) => { if (e.key === 'Enter') ipBtn.click(); };

    body.append(
      hero,
      pair.el,
      UI.card('For both directions', devices),
      pairedCard,
      UI.card('Macs on this network', [macList, UI.row('Add by IP', 'If your Mac isn’t listed (another subnet, or broadcasts blocked)', [ipInput, ipBtn])]),
    );

    let listKey = '';
    return (s) => {
      const l = s.link;
      const connected = l.state === 'connected';
      pcName.textContent = s.device.name;
      macName.textContent = s.paired ? s.paired.macName : 'Your Mac';
      macSub.textContent = s.paired ? s.paired.address : 'not paired yet';
      linkLine.className = 'hero-link' + (connected ? ' up' : '');
      linkText.textContent = connected ? (l.rtt != null ? l.rtt + ' ms' : 'connected')
        : s.pairing ? 'pairing…' : s.paired ? 'reconnecting…' : 'not connected';
      const bad = l.state === 'identity_changed';
      status.textContent = bad ? "This Mac's identity changed — forget it and pair again."
        : connected ? (WHERE[s.input] || WHERE.home) + (s.kvmState.message ? ' — ' + s.kvmState.message : '')
          : s.paired ? 'Waiting for your Mac — open MacShare on it.'
            : 'Open MacShare on your Mac, then click Pair next to it below.';
      status.classList.toggle('bad', bad);

      for (const r of m2p.concat(p2m, devices)) r.update(s);

      pairedCard.hidden = !s.paired;
      if (s.paired) {
        pairedRow.label.textContent = s.paired.macName;
        pairedRow.setHint(connected ? 'Connected now · ' + s.paired.address : s.paired.address + ':' + s.paired.port);
        monitorBtn.disabled = !connected;
      }

      const busy = !!s.pairing && s.pairing.phase !== 'failed';
      ipBtn.disabled = busy;
      const key = JSON.stringify([s.macs, busy, s.paired && s.paired.macId, s.discoveryError]);
      if (key === listKey) return;
      listKey = key;
      macList.replaceChildren(...(s.macs.length
        ? s.macs.map((mac) => {
          const isPaired = s.paired && s.paired.macId === mac.id;
          const b = UI.button(isPaired ? 'Pair again' : 'Pair', () => api.pair(mac.id), isPaired ? 'small' : 'small primary');
          b.disabled = busy;
          return UI.row(mac.name, mac.address, [isPaired ? el('span', { class: 'pill good', text: 'Paired' }) : null, b]);
        })
        : [UI.row(s.discoveryError ? 'Can’t listen for Macs' : 'Looking for Macs…', s.discoveryError || 'Start MacShare on the Mac; it appears here within a few seconds.')]));
    };
  },
});
