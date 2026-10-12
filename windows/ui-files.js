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
  desc: 'Drag files between the computers, and use a folder of each as a drive on the other.',
  badge: (s) => (s.files.dropToMac || s.files.acceptFromMac ? 'on' : ''),
  build(body) {
    const { el, api } = UI;
    const sw = (label, set) => UI.switch(set, { label });
    const mount = sw('The Mac’s folder here', (v) => api.setFiles({ mountMac: v }));
    const openBtn = UI.button('Open', () => api.openMacDrive(), 'small');
    const macDrive = UI.row('The Mac’s folder as a drive', '', [openBtn, mount]);
    const share = sw('This PC’s folder on the Mac', (v) => api.setShareOn(v));
    const chooseBtn = UI.button('Choose…', () => api.chooseShareFolder(), 'small');
    const sharePill = el('span', { class: 'pill' });
    const pcShare = UI.row('This PC’s folder on the Mac', '', [sharePill, chooseBtn, share]);
    const pair = UI.dirCards(
      { on: { get: (s) => s.files.acceptFromMac, set: (v) => api.setFiles({ acceptFromMac: v }) }, rows: [
        UI.row('Accept files and folders from the Mac', 'Drag them across the screen edge: here they become a normal Windows drag under the pointer — drop them in Explorer, on the Desktop or into an app. Esc cancels.'),
        macDrive,
      ] },
      { on: { get: (s) => s.files.dropToMac, set: (v) => api.setFiles({ dropToMac: v }) }, rows: [
        UI.row('Send files and folders to the Mac', 'Drag them across the edge facing the Mac (they keep dragging there — drop them in Finder, on the Desktop or into an app), or drop files onto Monitor 2'),
        pcShare,
      ] },
    );
    const edgeDrag = sw('Drag files across the screen edge', (v) => api.setFiles({ edgeDrag: v }));
    const edgeRow = UI.row('Drag files across the screen edge', '', [edgeDrag]);
    const cancelBtn = UI.button('Cancel', () => api.cancelDrop(), 'small');
    const outRow = UI.row('', '', [cancelBtn]);
    const inRow = UI.row('', '');
    body.append(
      pair.el,
      UI.card('For both directions', [edgeRow]),
      UI.card('Transfers', [outRow, inRow]),
      UI.card('Network drives', [
        UI.row('How they work', 'This PC’s folder: the first time, Windows asks for administrator rights once to create a hidden network-only account and the share; switching it off just disconnects the Mac. The Mac’s folder shows in This PC as “MacShare on <Mac>”.'),
      ], { cls: 'keep-on' }),
    );
    const mb = (n) => (n / 1048576).toFixed(1) + ' MB';
    return (s) => {
      const f = s.files;
      const m = f.smb;
      pair.update(s);
      edgeDrag.set(f.edgeDrag);
      edgeRow.setHint(!f.edgeDrag ? 'Off — a file drag stays on this PC at the edge, and the Mac doesn’t carry its drags here. Monitor 2 drops and the drives still work.'
        : f.macDrags === false ? 'On here, but off on the Mac — drags don’t cross until it’s on there too.'
          : 'Files and folders you drag to the edge keep dragging on the other computer. Off on either side stops it both ways.');
      mount.set(f.mountMac);
      openBtn.hidden = !m.drive;
      macDrive.label.textContent = m.drive ? 'The Mac’s folder is drive ' + m.drive : 'The Mac’s folder as a drive';
      macDrive.setHint(m.mountMessage || (m.drive ? 'Shown in This PC as “MacShare on ' + (s.link.macName || 'Mac') + '”.' : m.busy === 'mount' ? 'Connecting…' : 'Connects by itself when the Mac shares a folder (Mac: Files tab).'));
      share.set(f.shareOn);
      const busy = m.busy === 'setup' ? 'Setting up…' : m.busy === 'remove' ? 'Removing…' : '';
      sharePill.hidden = !f.shareOn && !busy;
      sharePill.textContent = busy || (m.peer && m.peer.mounted ? 'On the Mac' : m.peer && m.peer.error ? 'Mac: problem' : 'Shared');
      sharePill.className = 'pill ' + (busy ? 'muted' : m.peer && m.peer.mounted ? 'good' : m.peer && m.peer.error ? 'bad' : 'muted');
      chooseBtn.disabled = !!m.busy;
      pcShare.setHint(m.message || (m.folder + (m.peer && m.peer.error ? ' — the Mac says: ' + m.peer.error : f.shareOn ? ' — shown on the Mac in Finder’s sidebar.' : ' (created if missing).')));

      cancelBtn.hidden = !f.current;
      if (f.current) {
        const c = f.current;
        outRow.label.textContent = 'Sending ' + c.name + (c.count > 1 ? ' (' + (c.index + 1) + ' of ' + c.count + ')' : '');
        outRow.setHint(mb(c.sent) + ' of ' + mb(c.size) + (f.queued ? ' · ' + f.queued + ' more waiting' : ''));
      } else {
        outRow.label.textContent = f.last ? (f.last.ok ? 'Sent ' : 'Not sent: ') + (f.last.name || '') : 'Nothing sent yet';
        outRow.setHint(f.last ? f.last.text + ' · ' + UI.ago(f.last.at) : '');
      }
      const inc = f.incoming;
      const dr = f.drag;
      if (dr.state) {
        inRow.label.textContent = (dr.state === 'copying' ? 'Copying ' : 'Dragging ') + dr.name + ' from the Mac';
        inRow.setHint(dr.state === 'copying' ? 'Windows is copying it where you dropped it.' : 'Release the button where it should go; Esc cancels.');
        return;
      }
      if (dr.last && (!inc.last || dr.last.at > inc.last.at)) {
        inRow.label.textContent = dr.last.ok ? 'Received from the Mac' : 'Not received';
        inRow.setHint(dr.last.text + ' · ' + UI.ago(dr.last.at));
        return;
      }
      inRow.label.textContent = inc.receiving ? 'Receiving ' + inc.receiving + ' file' + (inc.receiving > 1 ? 's' : '') + ' from the Mac'
        : inc.last ? (inc.last.ok ? 'Received ' : 'Not received: ') + inc.last.name : 'Nothing received yet';
      inRow.setHint(inc.receiving ? 'They land where you release the mouse button.' : inc.last ? inc.last.text + ' · ' + UI.ago(inc.last.at) : '');
    };
  },
});
