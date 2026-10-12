// MacShare — Copyright (C) 2026 MacShare contributors. GPL-3.0, see LICENSE.
// Files tab (revision 2): drag and drop and network drives, both directions in equal places.
'use strict';

UI.tab({
  id: 'files',
  order: 50,
  title: 'Files',
  desc: 'Drag files across the screen edge or onto Monitor 2, and use each computer’s folder as a drive on the other.',
  color: 'linear-gradient(#64d2ff, #0a84ff)',
  badge: (s) => (s.files && s.files.acceptDrops ? 'on' : ''),
  build(body) {
    const { el, api } = UI;
    const tilde = (p) => String(p || '').replace(/^\/Users\/[^/]+/, '~');

    // Mac -> PC
    const dragOut = UI.row('Drag files to the PC', '');
    const shareSw = UI.switch((v) => api.setShareMac(v), { label: 'This Mac’s folder as a drive on the PC' });
    const chooseBtn = UI.button('Choose…', () => api.chooseShareFolder(), 'small');
    const shareRow = UI.row('This Mac’s folder as a drive on the PC', '', [chooseBtn, shareSw]);
    // PC -> Mac
    const acceptSw = UI.switch((v) => api.setFiles({ acceptDrops: v }), { label: 'Accept files from the PC' });
    const acceptRow = UI.row('Accept files from the PC', '', [acceptSw]);
    const pcSw = UI.switch((v) => api.setSmb({ connectPc: v }), { label: 'The PC’s folder as a drive here' });
    const openBtn = UI.button('Open', () => api.openPcShare(), 'small');
    const pcRow = UI.row('The PC’s folder as a drive here', '', [openBtn, pcSw]);
    // shared
    const reveal = UI.switch((v) => api.setFiles({ reveal: v }), { label: 'Show in Finder' });
    const folderRow = UI.row('Otherwise save to', '', [UI.button('Choose…', () => api.pickDropFolder(), 'small'), UI.button('Downloads', () => api.resetDropFolder(), 'small')]);
    const progress = el('div');
    const list = el('div', { class: 'history' });

    body.append(
      UI.pair(
        UI.dir('m2w', [dragOut, shareRow], { role: 'this Mac sends' }),
        UI.dir('w2m', [acceptRow, pcRow], { role: 'this Mac receives' }),
      ),
      progress,
      UI.card('Files arriving here', [
        UI.row('Where they go', 'Dropped on a Finder window: that folder (macOS asks once to let MacShare see Finder windows). On the desktop: Desktop. Anywhere else: the folder below.'),
        folderRow,
        UI.row('Show in Finder', 'Select each file in Finder when it arrives', [reveal]),
      ]),
      UI.card('Recent', [list]),
    );

    let key = '';
    return (s) => {
      const f = s.files;
      const m = s.smb;
      if (!f || !m) return;
      const pc = s.client ? s.client.name : 'the PC';
      dragOut.setHint(s.kvm && s.kvm.mouse && s.kvm.driveOther
        ? 'Drag files in Finder through the edge facing the PC and let go where you want them. Uses Cursor sharing.'
        : 'Turn on Cursor sharing (this Mac’s mouse on the PC) to drag files across the edge.');
      shareSw.set(m.sharing);
      shareSw.disable(m.shareBusy);
      chooseBtn.disabled = m.shareBusy;
      shareRow.setHint(m.shareBusy ? 'Waiting for the administrator password…'
        : m.shareError ? `Couldn’t set up sharing: ${m.shareError}`
          : !m.sharing ? `Shares ${tilde(m.folder || m.defaultFolder)}. The first time asks for an administrator password.`
            : `Sharing ${tilde(m.folder)}${m.peer ? (m.peer.mounted ? ` — a drive on ${pc}` : ` — ${pc} couldn’t connect: ${m.peer.error || 'unknown'}`) : ''}`);
      acceptSw.set(f.acceptDrops);
      acceptRow.setHint(f.acceptDrops ? 'Dropped onto Monitor 2 or dragged across the edge from the PC' : 'Off — the PC can’t send files');
      pcSw.set(m.connectPc);
      openBtn.hidden = !m.mounted;
      pcRow.setHint(!m.connectPc ? 'Off'
        : m.mounted ? `Connected — ${m.mounted} (Finder sidebar › Locations)`
          : m.mounting ? 'Connecting…'
            : m.mountError ? `Couldn’t connect: ${m.mountError}`
              : `Connects when ${pc} shares a folder (Files tab in the PC app)`);
      reveal.set(f.reveal);
      folderRow.setHint(tilde(f.folder || f.defaultFolder));
      progress.replaceChildren(
        ...f.receiving.map((r) => UI.note('info', `Receiving ${r.name} — ${Math.floor((100 * r.got) / Math.max(1, r.size))}% of ${UI.bytes(r.size)}`)),
        ...f.sending.map((r) => UI.note('info', `Sending ${r.name} to ${pc} — ${Math.floor((100 * r.sent) / Math.max(1, r.size))}% of ${UI.bytes(r.size)}`)),
      );
      const items = [...f.recent.map((r) => ({ ...r, dir: 'in' })), ...f.sent.map((r) => ({ ...r, dir: 'out' }))].sort((a, b) => b.at - a.at).slice(0, 30);
      const k = JSON.stringify(items.map((r) => r.at)) + Math.floor(Date.now() / 15000);
      if (k === key) return;
      key = k;
      list.replaceChildren(...(items.length
        ? items.map((r) => el('div', { class: 'hist-item' }, [
          el('span', { class: `hist-dir ${r.dir}`, title: r.dir === 'out' ? 'Sent to the PC' : 'From the PC' }, [UI.icon(r.dir === 'out' ? 'up' : 'down')]),
          el('div', { class: 'hist-text' }, [
            el('div', { class: 'hist-preview', text: r.name }),
            el('div', { class: 'hint', text: `${r.ok ? '' : 'Failed: '}${r.ok ? (r.dir === 'in' ? tilde(r.path) : `on ${pc}${r.where ? `: ${r.where}` : ''}`) : r.error} · ${UI.bytes(r.size)} · ${UI.ago(r.at)}` }),
          ]),
          r.dir === 'in' && r.ok ? UI.button('Show', () => api.revealDrop(f.recent.indexOf(f.recent.find((x) => x.at === r.at))), 'small') : null,
        ]))
        : [UI.row('Nothing yet', 'Files sent either way show up here.')]));
    };
  },
});
