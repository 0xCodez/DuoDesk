// MacShare — Copyright (C) 2026 MacShare contributors. GPL-3.0, see LICENSE.
// Files tab (revision 2): drag and drop and network drives, both directions in equal places.
'use strict';

UI.tab({
  id: 'files',
  order: 50,
  title: 'Files',
  desc: 'Drag files between your computers, or share a folder.',
  color: 'linear-gradient(#64d2ff, #0a84ff)',
  badge: (s) => (s.files && s.files.acceptDrops ? 'on' : ''),
  build(body) {
    const { el, api } = UI;
    const tilde = (p) => String(p || '').replace(/^\/Users\/[^/]+/, '~');

    // Mac -> PC
        const shareSw = UI.switch((v) => api.setShareMac(v), { label: 'This Mac’s folder as a drive on the PC' });
    const chooseBtn = UI.button('Choose…', () => api.chooseShareFolder(), 'small');
    const shareRow = UI.row('Share a folder with the PC', '', [chooseBtn, shareSw]);
    // PC -> Mac
    const acceptSw = UI.switch((v) => api.setFiles({ acceptDrops: v }), { label: 'Accept files from the PC' });
    const acceptRow = UI.row('Accept files from the PC', '', [acceptSw]);
    const pcSw = UI.switch((v) => api.setSmb({ connectPc: v }), { label: 'The PC’s folder as a drive here' });
    const openBtn = UI.button('Open', () => api.openPcShare(), 'small');
    const pcRow = UI.row('Open the PC’s shared folder', '', [openBtn, pcSw]);
    // shared
    const dragSw = UI.switch((v) => api.setFiles({ dragEdge: v }), { label: 'Drag files across the screen edge' });
    const dragRow = UI.row('Drag files between computers', 'Drag through the screen edge and drop anywhere', [dragSw]);
    const reveal = UI.switch((v) => api.setFiles({ reveal: v }), { label: 'Show in Finder' });
    const folderRow = UI.row('Save to', '', [UI.button('Choose…', () => api.pickDropFolder(), 'small'), UI.button('Downloads', () => api.resetDropFolder(), 'small')]);
    const progress = el('div');
    const list = el('div', { class: 'history' });

    body.append(
      UI.pair(
        UI.dir('m2w', [shareRow]),
        UI.dir('w2m', [acceptRow, pcRow]),
      ),
      UI.card('', [dragRow], { cls: 'keep-on' }),
      progress,
      UI.card('Arriving files', [
        folderRow,
        UI.row('Show in Finder', '', [reveal]),
      ]),
      UI.card('Recent', [list]),
    );

    let key = '';
    return (s) => {
      const f = s.files;
      const m = s.smb;
      if (!f || !m) return;
      const pc = s.client ? s.client.name : 'the PC';
      dragSw.set(f.dragEdge !== false);
      dragRow.setHint(f.dragEdge !== false && !f.peerDrag ? `Turned off on ${pc}` : 'Drag through the screen edge and drop anywhere');
      shareSw.set(m.sharing);
      shareSw.disable(m.shareBusy);
      chooseBtn.disabled = m.shareBusy;
      shareRow.setHint(m.shareBusy ? 'Waiting for your password…'
        : m.shareError ? `Couldn’t share: ${m.shareError}`
          : tilde(m.folder || m.defaultFolder));
      acceptSw.set(f.acceptDrops);
      pcSw.set(m.connectPc);
      openBtn.hidden = !m.mounted;
      pcRow.setHint(!m.connectPc ? ''
        : m.mounted ? 'In Finder’s sidebar'
          : m.mounting ? 'Connecting…'
            : m.mountError ? `Couldn’t connect: ${m.mountError}`
              : `Waiting for ${pc} to share a folder`);
      reveal.set(f.reveal);
      folderRow.setHint(tilde(f.folder || f.defaultFolder));
      progress.replaceChildren(
        ...f.receiving.map((r) => UI.note('info', `Receiving ${r.name}  ${Math.floor((100 * r.got) / Math.max(1, r.size))}%`)),
        ...f.sending.map((r) => UI.note('info', `Sending ${r.name}  ${Math.floor((100 * r.sent) / Math.max(1, r.size))}%`)),
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
            el('div', { class: 'hint', text: `${r.ok ? (r.dir === 'in' ? tilde(r.path) : r.where || pc) : `Failed: ${r.error}`} · ${UI.ago(r.at)}` }),
          ]),
          r.dir === 'in' && r.ok ? UI.button('Show', () => api.revealDrop(f.recent.indexOf(f.recent.find((x) => x.at === r.at))), 'small') : null,
        ]))
        : [UI.row('Nothing yet', '')]));
    };
  },
});
