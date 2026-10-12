// MacShare — Copyright (C) 2026 MacShare contributors. GPL-3.0, see LICENSE.
// Files tab: two direction cards (docs/UI.md) — files and the Mac's folder coming here, files and
// this PC's folder going to the Mac — then transfers. Drags across the edge (revision 2 R4),
// Monitor 2 drops (phase 9), network drives in one switch each (phase 7, R6).
'use strict';

UI.tab({
  id: 'files',
  order: 50,
  title: 'Files',
  color: 'linear-gradient(#64d2ff, #0a84ff)',
  desc: 'Drag files between your computers, or share a folder.',
  badge: (s) => (s.files.dropToMac || s.files.acceptFromMac ? 'on' : ''),
  build(body) {
    const { el, api } = UI;
    const sw = (label, set) => UI.switch(set, { label });
    const mount = sw('The Mac’s folder here', (v) => api.setFiles({ mountMac: v }));
    const openBtn = UI.button('Open', () => api.openMacDrive(), 'small');
    const macDrive = UI.row('Open the Mac’s shared folder', '', [openBtn, mount]);
    const share = sw('This PC’s folder on the Mac', (v) => api.setShareOn(v));
    const chooseBtn = UI.button('Choose…', () => api.chooseShareFolder(), 'small');
    const sharePill = el('span', { class: 'pill' });
    const pcShare = UI.row('Share a folder with the Mac', '', [sharePill, chooseBtn, share]);
    const pair = UI.dirCards(
      { on: { get: (s) => s.files.acceptFromMac, set: (v) => api.setFiles({ acceptFromMac: v }) }, rows: [
        UI.row('Accept files from the Mac', ''),
        macDrive,
      ] },
      { on: { get: (s) => s.files.dropToMac, set: (v) => api.setFiles({ dropToMac: v }) }, rows: [
        UI.row('Send files to the Mac', ''),
        pcShare,
      ] },
    );
    const edgeDrag = sw('Drag files across the screen edge', (v) => api.setFiles({ edgeDrag: v }));
    const edgeRow = UI.row('Drag files between computers', '', [edgeDrag]);
    const cancelBtn = UI.button('Cancel', () => api.cancelDrop(), 'small');
    const outRow = UI.row('', '', [cancelBtn]);
    const inRow = UI.row('', '');
    body.append(
      pair.el,
      UI.card('', [edgeRow]),
      UI.card('Recent', [outRow, inRow]),
    );
    const mb = (n) => (n / 1048576).toFixed(1) + ' MB';
    return (s) => {
      const f = s.files;
      const m = f.smb;
      pair.update(s);
      edgeDrag.set(f.edgeDrag);
      edgeRow.setHint(f.edgeDrag && f.macDrags === false ? 'Turned off on the Mac' : f.edgeDrag ? 'Drag through the screen edge and drop anywhere' : '');
      mount.set(f.mountMac);
      openBtn.hidden = !m.drive;
      macDrive.setHint(m.mountMessage || (!f.mountMac ? '' : m.drive ? 'Drive ' + m.drive : m.busy === 'mount' ? 'Connecting…' : 'Waiting for your Mac to share one'));
      share.set(f.shareOn);
      const busy = m.busy === 'setup' ? 'Setting up…' : m.busy === 'remove' ? 'Removing…' : '';
      sharePill.hidden = !f.shareOn && !busy;
      sharePill.textContent = busy || (m.peer && m.peer.mounted ? 'On the Mac' : m.peer && m.peer.error ? 'Problem' : 'Shared');
      sharePill.className = 'pill ' + (busy ? 'muted' : m.peer && m.peer.mounted ? 'good' : m.peer && m.peer.error ? 'bad' : 'muted');
      chooseBtn.disabled = !!m.busy;
      pcShare.setHint(m.message || (m.peer && m.peer.error) || m.folder);

      cancelBtn.hidden = !f.current;
      if (f.current) {
        const c = f.current;
        outRow.label.textContent = 'Sending ' + c.name + (c.count > 1 ? ' (' + (c.index + 1) + ' of ' + c.count + ')' : '');
        outRow.setHint(mb(c.sent) + ' of ' + mb(c.size) + (f.queued ? ' · ' + f.queued + ' more waiting' : ''));
      } else {
        outRow.label.textContent = f.last ? (f.last.ok ? 'Sent ' : 'Not sent: ') + (f.last.name || '') : 'Nothing sent';
        outRow.setHint(f.last ? f.last.text + ' · ' + UI.ago(f.last.at) : '');
      }
      const inc = f.incoming;
      const dr = f.drag;
      if (dr.state) {
        inRow.label.textContent = (dr.state === 'copying' ? 'Copying ' : 'Dragging ') + dr.name;
        inRow.setHint(dr.state === 'copying' ? '' : 'Esc cancels');
        return;
      }
      if (dr.last && (!inc.last || dr.last.at > inc.last.at)) {
        inRow.label.textContent = dr.last.ok ? 'Received from the Mac' : 'Not received';
        inRow.setHint(dr.last.text + ' · ' + UI.ago(dr.last.at));
        return;
      }
      inRow.label.textContent = inc.receiving ? 'Receiving ' + inc.receiving + ' file' + (inc.receiving > 1 ? 's' : '') + ' from the Mac'
        : inc.last ? (inc.last.ok ? 'Received ' : 'Not received: ') + inc.last.name : 'Nothing received';
      inRow.setHint(inc.receiving ? '' : inc.last ? inc.last.text + ' · ' + UI.ago(inc.last.at) : '');
    };
  },
});
