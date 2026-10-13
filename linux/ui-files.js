// TwinDesk — Copyright (C) 2026 inukaasith. GPL-3.0, see LICENSE.
// Files tab (windows/ui-files.js without the shared folder, the copy/paste shortcuts and
// drags across the edge, which aren't on Linux yet): Send files (drop zone + Choose…), the two
// direction cards, then what was sent and received. Files dropped on the other
// computer's screen window (Monitor 2) go the same way.
'use strict';

UI.tab({
  id: 'files',
  order: 50,
  title: 'Files',
  color: 'linear-gradient(#64d2ff, #0a84ff)',
  desc: 'Send files between your computers.',
  badge: (s) => (s.files.dropToMac || s.files.acceptFromMac ? 'on' : ''),
  build(body) {
    const { el, api } = UI;
    const takeRow = UI.row('Where they go', 'Downloads, shown in the file manager');
    const dropRow = UI.row('Drop on {name}’s screen', 'Drop files on {name}’s screen window here to send them there');
    const pair = UI.dirCards(
      { on: { get: (s) => s.files.acceptFromMac, set: (v) => api.setFiles({ acceptFromMac: v }) }, label: 'Take files from {name} on {me}', rows: [takeRow] },
      { on: { get: (s) => s.files.dropToMac, set: (v) => api.setFiles({ dropToMac: v }) }, label: 'Send files from {me} to {name}', rows: [dropRow] },
    );
    // Send files: drop zone + Choose…
    const zoneText = el('div', { class: 'big', text: 'Drop files or folders here' });
    const zoneHint = el('div', { class: 'hint', text: '' });
    const zone = el('div', { class: 'dropzone' }, [el('div', {}, [zoneText, zoneHint])]);
    const sendBtn = UI.button('Choose…', () => api.chooseSendFiles(), 'small');
    const sendRow = UI.row('Send files', '', [sendBtn]);
    const sendBar = el('div', { class: 'bar' }, [el('span')]);
    sendBar.hidden = true;
    sendRow.querySelector('.text').append(sendBar);
    let canSend = false;
    zone.ondragover = (e) => { e.preventDefault(); if (canSend) zone.classList.add('over'); };
    zone.ondragleave = () => zone.classList.remove('over');
    zone.ondrop = (e) => {
      e.preventDefault();
      zone.classList.remove('over');
      if (canSend) api.sendFiles(api.pathsOf(e.dataTransfer.files));
    };
    // Dropping anywhere else in the window must not open the file.
    window.addEventListener('dragover', (e) => e.preventDefault());
    window.addEventListener('drop', (e) => e.preventDefault());

    const cancelBtn = UI.button('Cancel', () => api.cancelDrop(), 'small');
    const outRow = UI.row('', '', [cancelBtn]);
    const inRow = UI.row('', '');
    const later = UI.note('info', 'Not on Linux yet: a shared folder, copy and paste with shortcuts, and dragging files across the screen edge.');
    body.append(
      UI.card('', [sendRow, zone], { cls: 'keep-on' }),
      pair.el,
      UI.card('Recent', [outRow, inRow]),
      later,
    );
    const mb = (n) => (n / 1048576).toFixed(1) + ' MB';
    return (s) => {
      const f = s.files;
      const p = UI.peer(s);
      pair.update(s);
      canSend = s.link.state === 'connected' && f.dropToMac;
      zone.classList.toggle('off', !canSend);
      zoneText.textContent = canSend ? 'Drop files or folders here' : s.link.state === 'connected' ? 'Sending is off' : 'Connect to send files';
      zoneHint.textContent = canSend ? 'They go to ' + p.the + '’s Downloads' : '';
      sendBtn.disabled = !canSend;
      const b = f.batch;
      sendBar.hidden = !b;
      if (b) sendBar.firstChild.style.width = Math.floor((100 * b.sent) / Math.max(1, b.bytes)) + '%';
      sendRow.setHint(b ? 'Sending ' + b.name + ' to ' + p.the + (b.files > 1 ? ' · ' + (b.index + 1) + ' of ' + b.files : '') : canSend ? 'To ' + p.the : '');

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
      inRow.label.textContent = inc.receiving ? 'Receiving ' + inc.receiving + ' file' + (inc.receiving > 1 ? 's' : '') + ' from {name}'
        : inc.last ? (inc.last.ok ? 'Received ' : 'Not received: ') + inc.last.name : 'Nothing received';
      inRow.setHint(inc.receiving ? '' : inc.last ? inc.last.text + ' · ' + UI.ago(inc.last.at) : '');
    };
  },
});
