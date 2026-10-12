// MacShare — Copyright (C) 2026 MacShare contributors. GPL-3.0, see LICENSE.
// Files tab: drop files onto Monitor 2 (phase 9) now; network drives (phase 7) later.
'use strict';

UI.tab({
  id: 'files',
  order: 50,
  title: 'Files',
  color: 'linear-gradient(#64d2ff, #0a84ff)',
  desc: 'Send files to the Mac by dropping them onto Monitor 2. Network drives come later.',
  master: { get: (s) => s.files.dropToMac, set: (v) => UI.api.setFiles({ dropToMac: v }) },
  badge: (s) => (s.files.dropToMac ? 'on' : ''),
  build(body) {
    const { api } = UI;
    const cancelBtn = UI.button('Cancel', () => api.cancelDrop(), 'small');
    const now = UI.row('Transfer', '', [cancelBtn]);
    body.append(
      UI.card('Drop onto Monitor 2', [
        UI.row('How', 'Drag files from Explorer onto the Mac’s screen in Monitor 2. They land in the Finder window you drop them on, on the Desktop, or in Downloads, and the Mac shows them.'),
        now,
      ]),
      UI.card('Coming in phase 7', [
        UI.row('Share a folder of this PC with the Mac', '', [UI.switch(() => {}, { disabled: true, label: 'Share a folder' })]),
        UI.row('Connect the Mac’s shared folder as a drive', '', [UI.switch(() => {}, { disabled: true, label: 'Mac drive' })]),
      ], { cls: 'keep-on' }),
    );
    const mb = (n) => (n / 1048576).toFixed(1) + ' MB';
    return (s) => {
      const f = s.files;
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
