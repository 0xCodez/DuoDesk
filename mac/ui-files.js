// MacShare — Copyright (C) 2026 MacShare contributors. GPL-3.0, see LICENSE.
// Files tab: files dropped onto Monitor 2 on the PC land here (phase 9). Network drives (phase 7)
// are listed as coming.
'use strict';

UI.tab({
  id: 'files',
  order: 50,
  title: 'Files',
  desc: 'Drag files onto Monitor 2 on the PC and they land on this Mac, right where you drop them.',
  color: 'linear-gradient(#64d2ff, #0a84ff)',
  master: { get: (s) => s.files && s.files.acceptDrops, set: (v) => UI.api.setFiles({ acceptDrops: v }) },
  badge: (s) => (s.files && s.files.acceptDrops ? 'on' : ''),
  build(body) {
    const { el, api } = UI;
    const reveal = UI.switch((v) => api.setFiles({ reveal: v }), { label: 'Show in Finder' });
    const folderRow = UI.row('Otherwise save to', '', [UI.button('Choose…', () => api.pickDropFolder(), 'small'), UI.button('Downloads', () => api.resetDropFolder(), 'small')]);
    const progress = el('div');
    const pcSw = UI.switch((v) => api.setSmb({ connectPc: v }), { label: 'Connect the PC’s shared folder' });
    const openBtn = UI.button('Open', () => api.openPcShare(), 'small');
    const pcRow = UI.row('The PC’s shared folder here', '', [openBtn, pcSw]);
    const shareBtn = UI.button('Share a Folder…', () => api.shareMacFolder(), 'small');
    const stopBtn = UI.button('Stop Sharing', () => api.stopSharingFolder(), 'small');
    const macRow = UI.row('A folder of this Mac on the PC', '', [shareBtn, stopBtn]);
    const list = el('div', { class: 'history' });
    body.append(
      UI.card('Dropped onto Monitor 2', [
        UI.row('Where files go', 'On a Finder window: that folder (macOS asks once to let MacShare see Finder windows). On the desktop: Desktop. Anywhere else: the folder below.'),
        folderRow,
        UI.row('Show in Finder', 'Select each file in Finder when it arrives', [reveal]),
      ]),
      progress,
      UI.card('Received', [list]),
      UI.card('Network drives', [pcRow, macRow], { cls: 'keep-on' }),
      UI.card('Later', [
        UI.row('Drag files across the screen edge', 'Coming with a later phase', [UI.switch(() => {}, { disabled: true, label: 'Drag across the edge' })]),
      ], { cls: 'keep-on' }),
    );
    let key = '';
    return (s) => {
      const f = s.files;
      if (!f) return;
      reveal.set(f.reveal);
      const m = s.smb;
      if (m) {
        pcSw.set(m.connectPc);
        openBtn.hidden = !m.mounted;
        pcRow.setHint(!m.connectPc ? 'Off' : m.mounted ? `Connected — ${m.mounted} (in Finder’s sidebar)` : m.mounting ? `Connecting to ${m.pcShare}…`
          : m.mountError ? `Couldn’t connect: ${m.mountError}` : m.pcOffered ? 'Waiting…' : 'The PC isn’t sharing a folder — choose one in the PC app’s Files tab');
        shareBtn.hidden = m.sharing;
        stopBtn.hidden = !m.sharing;
        shareBtn.disabled = stopBtn.disabled = m.shareBusy;
        macRow.setHint(m.shareBusy ? 'Waiting for the administrator password…' : m.shareError ? `Couldn’t set up sharing: ${m.shareError}`
          : !m.sharing ? 'Not sharing. Setup asks for an administrator password once: a hidden sharing-only account, SMB on, this folder shared as “MacShare”.'
            : `Sharing ${m.folder.replace(/^\/Users\/[^/]+/, '~')}${m.peer ? (m.peer.mounted ? ' — the PC has it as a drive' : ` — the PC couldn’t connect: ${m.peer.error || 'unknown'}`) : ''}`);
      }
      folderRow.setHint((f.folder || f.defaultFolder).replace(/^\/Users\/[^/]+/, '~'));
      progress.replaceChildren(...f.receiving.map((r) => UI.note('info', `Receiving ${r.name} — ${Math.floor((100 * r.got) / Math.max(1, r.size))}% of ${UI.bytes(r.size)}`)));
      const k = JSON.stringify(f.recent.map((r) => r.at)) + Math.floor(Date.now() / 15000);
      if (k === key) return;
      key = k;
      list.replaceChildren(...(f.recent.length
        ? f.recent.map((r, i) => UI.row(r.name, r.ok ? `${UI.bytes(r.size)} · ${UI.ago(r.at)} · ${r.path.replace(/^\/Users\/[^/]+/, '~')}` : `Failed: ${r.error} · ${UI.ago(r.at)}`,
          r.ok ? [UI.button('Show', () => api.revealDrop(i), 'small')] : [el('span', { class: 'pill bad', text: 'Failed' })]))
        : [UI.row('Nothing yet', 'Drag a file from the PC onto the Monitor 2 window.')]));
    };
  },
});
