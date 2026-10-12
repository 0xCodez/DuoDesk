// MacShare — Copyright (C) 2026 MacShare contributors. GPL-3.0, see LICENSE.
// Files tab: drop files onto Monitor 2 (phase 9) and network drives both ways (phase 7).
'use strict';

UI.tab({
  id: 'files',
  order: 50,
  title: 'Files',
  color: 'linear-gradient(#64d2ff, #0a84ff)',
  desc: 'Drop files onto Monitor 2, and use a folder of each computer as a drive on the other.',
  master: { get: (s) => s.files.dropToMac, set: (v) => UI.api.setFiles({ dropToMac: v }) },
  badge: (s) => (s.files.dropToMac ? 'on' : ''),
  build(body) {
    const { el, api } = UI;
    const cancelBtn = UI.button('Cancel', () => api.cancelDrop(), 'small');
    const now = UI.row('Transfer', '', [cancelBtn]);
    const sharePill = el('span', { class: 'pill' });
    const shareBtn = UI.button('Choose folder…', () => api.shareFolder(), 'small primary');
    const unshareBtn = UI.button('Stop sharing', () => api.unshareFolder(), 'small');
    const shareRow = UI.row('Share a folder of this PC with the Mac', '', [sharePill, shareBtn, unshareBtn]);
    const mount = UI.switch((v) => api.setFiles({ mountMac: v }), { label: 'Connect the Mac’s folder' });
    const mountRow = UI.row('Connect the Mac’s shared folder as a drive', '', [mount]);
    const openBtn = UI.button('Open', () => api.openMacDrive(), 'small');
    const macRow = UI.row('The Mac’s folder', '', [openBtn]);
    body.append(
      UI.card('Drop onto Monitor 2', [
        UI.row('How', 'Drag files from Explorer onto the Mac’s screen in Monitor 2. They land in the Finder window you drop them on, on the Desktop, or in Downloads, and the Mac shows them.'),
        now,
      ]),
      UI.card('Network drives', [shareRow, mountRow, macRow], { cls: 'keep-on' }),
    );
    const mb = (n) => (n / 1048576).toFixed(1) + ' MB';
    return (s) => {
      const f = s.files;
      const m = f.smb;
      const busy = m.busy === 'setup' ? 'Setting up…' : m.busy === 'remove' ? 'Removing…' : '';
      sharePill.hidden = !m.sharing && !busy;
      sharePill.textContent = busy || (m.peer && m.peer.mounted ? 'On the Mac' : m.peer && m.peer.error ? 'Mac: problem' : 'Shared');
      sharePill.className = 'pill ' + (busy ? 'muted' : m.peer && m.peer.mounted ? 'good' : m.peer && m.peer.error ? 'bad' : 'muted');
      shareBtn.hidden = m.sharing || !!busy;
      unshareBtn.hidden = !m.sharing || !!busy;
      shareRow.setHint(m.message || (m.sharing ? f.shareFolder + (m.peer && m.peer.error ? ' — the Mac says: ' + m.peer.error : ' — the Mac connects it under ~/MacShare.') : 'Asks for administrator rights once: makes a hidden network-only account, the share and the firewall rule.'));
      mount.set(f.mountMac);
      macRow.label.textContent = m.drive ? 'The Mac’s folder is drive ' + m.drive : 'The Mac’s folder';
      macRow.setHint(m.mountMessage || (m.drive ? m.macShare : m.busy === 'mount' ? 'Connecting…' : 'The Mac isn’t sharing a folder (Mac: Files tab).'));
      openBtn.hidden = !m.drive;
      cancelBtn.hidden = !f.current;
      if (f.current) {
        const c = f.current;
        now.label.textContent = 'Sending ' + c.name + (c.count > 1 ? ' (' + (c.index + 1) + ' of ' + c.count + ')' : '');
        now.setHint(mb(c.sent) + ' of ' + mb(c.size) + (f.queued ? ' · ' + f.queued + ' more waiting' : ''));
      } else if (f.last) {
        now.label.textContent = (f.last.ok ? 'Sent ' : 'Not sent: ') + (f.last.name || '');
        now.setHint(f.last.text + ' · ' + UI.ago(f.last.at));
      } else {
        now.label.textContent = 'Nothing sent yet';
        now.setHint('');
      }
    };
  },
});
