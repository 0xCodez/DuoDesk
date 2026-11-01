// TwinDesk — Copyright (C) 2026 inukaasith. GPL-3.0, see LICENSE.
// Files tab (copy of windows/ui-files.js): Send files (drop zone + Choose…) and copy/paste files
// with shortcuts, then two direction cards — files and the other computer's folder coming here,
// files and this computer's folder going there — then transfers. Drags across the edge, Monitor 2
// drops, network folders in one switch each.
'use strict';

UI.tab({
  id: 'files',
  order: 50,
  title: 'File Sharing',
  icon: 'globe',
  heading: 'File Sharing',
  color: 'linear-gradient(#64d2ff, #0a84ff)',
  desc: 'Send files and folders between your devices, or share a folder.',
  badge: (s) => (s.files.dropToMac || s.files.acceptFromMac ? 'on' : ''),
  build(body) {
    const { el, api } = UI;
    const t = (k, p, d) => (typeof window.t === 'function' ? window.t(k, p, d) : d !== undefined ? d : k);
    const sw = (label, set) => UI.switch(set, { label });
    const mount = sw(t('files.peer_folder_here', null, '{Name}’s folder here'), (v) => api.setFiles({ mountMac: v }));
    const openBtn = UI.button(t('files.open', null, 'Open'), () => api.openMacDrive(), 'small');
    const macDrive = UI.row(t('files.open_peer_shared', null, 'Open {name}’s shared folder'), '', [openBtn, mount]);
    const share = sw(t('files.my_folder_on_peer', null, '{me}’s folder on {name}'), (v) => api.setShareOn(v));
    const chooseBtn = UI.button(t('files.choose', null, 'Choose…'), () => api.chooseShareFolder(), 'small');
    const sharePill = el('span', { class: 'pill' });
    const pcShare = UI.row(t('files.share_folder_with', null, 'Share a folder with {name}'), '', [sharePill, chooseBtn, share]);
    const pair = UI.dirCards(
      { on: { get: (s) => s.files.acceptFromMac, set: (v) => api.setFiles({ acceptFromMac: v }) }, label: t('files.take_files_from', null, 'Take files from {name} on {me}'), rows: [
        macDrive,
      ] },
      { on: { get: (s) => s.files.dropToMac, set: (v) => api.setFiles({ dropToMac: v }) }, label: t('files.send_files_to', null, 'Send files from {me} to {name}'), rows: [
        pcShare,
      ] },
    );
    // Send files: drop zone + Choose…
    const zoneText = el('div', { class: 'big', text: t('files.drop_here', null, 'Drop files or folders here') });
    const zoneHint = el('div', { class: 'hint', text: '' });
    const zone = el('div', { class: 'dropzone' }, [el('div', {}, [zoneText, zoneHint])]);
    const sendBtn = UI.button(t('files.choose', null, 'Choose…'), () => api.chooseSendFiles(), 'small');
    const sendRow = UI.row(t('files.send_files', null, 'Send files'), '', [sendBtn]);
    const sendBar = el('div', { class: 'bar' }, [el('span')]);
    sendBar.hidden = true;
    sendRow.querySelector('.text').append(sendBar);
    let canSend = false;
    zone.ondragover = (e) => { e.preventDefault(); if (canSend) zone.classList.add('over'); };
    zone.ondragleave = () => zone.classList.remove('over');
    zone.ondrop = (e) => {
      e.preventDefault();
      zone.classList.remove('over');
      // As an array: a FileList reaches the preload as a plain object, which can't be iterated.
      if (canSend) api.sendFiles(api.pathsOf([...e.dataTransfer.files]));
    };
    // Dropping anywhere else in the window must not open the file.
    window.addEventListener('dragover', (e) => e.preventDefault());
    window.addEventListener('drop', (e) => e.preventDefault());

    // Copy and paste files with shortcuts
    const keysSw = sw(t('files.shortcuts_sw', null, 'Copy and paste files with shortcuts'), (v) => api.setFiles({ shortcuts: v }));
    const copyRec = UI.keyRecorder((v) => api.setFiles({ copyKeys: v }));
    const pasteRec = UI.keyRecorder((v) => api.setFiles({ pasteKeys: v }));
    const keysRow = UI.row(t('files.shortcuts_title', null, 'Copy and paste files'), '', [keysSw]);
    const copyRow = UI.row(t('files.copy', null, 'Copy'), t('files.select_file_manager_first', null, 'Select files in the file manager first'), [copyRec]);
    const pasteRow = UI.row(t('files.paste', null, 'Paste'), '', [pasteRec]);

    const edgeDrag = sw(t('files.edge_drag_sw', null, 'Drag files across the screen edge'), (v) => api.setFiles({ edgeDrag: v }));
    const edgeRow = UI.row(t('files.drag_between_computers', null, 'Drag files between computers'), '', [edgeDrag]);
    const cancelBtn = UI.button(t('files.cancel', null, 'Cancel'), () => api.cancelDrop(), 'small');
    const outRow = UI.row('', '', [cancelBtn]);
    const inRow = UI.row('', '');
    body.append(
      UI.card('', [sendRow, zone], { cls: 'keep-on' }),
      UI.card('', [keysRow, copyRow, pasteRow], { cls: 'keep-on' }),
      pair.el,
      UI.card('', [edgeRow]),
      UI.card(t('files.recent', null, 'Recent'), [outRow, inRow]),
    );
    const mb = (n) => (n / 1048576).toFixed(1) + ' MB';
    return (s) => {
      const f = s.files;
      const m = f.smb;
      const p = UI.peer(s);
      pair.update(s);
      // Send files
      canSend = s.link.state === 'connected';
      zone.classList.toggle('off', !canSend);
      zoneText.textContent = canSend ? t('files.drop_here', null, 'Drop files or folders here') : t('files.connect_to_send', null, 'Connect to send files');
      zoneHint.textContent = !canSend ? '' : p.phone ? t('files.hint_downloads_phone', { the: p.the }, 'They go to ' + p.the + '’s Downloads')
        : t('files.hint_downloads_pc', { the: p.the }, 'They go to ' + p.the + '’s Downloads, or the folder chosen there for received files');
      sendBtn.disabled = !canSend;
      const b = f.batch;
      sendBar.hidden = !b;
      if (b) sendBar.firstChild.style.width = Math.floor((100 * b.sent) / Math.max(1, b.bytes)) + '%';
      sendRow.setHint(b ? (b.kind === 'paste' ? t('files.pasting_to', { name: b.name, the: p.the }, 'Pasting ' + b.name + ' to ' + p.the) : t('files.sending_to', { name: b.name, the: p.the }, 'Sending ' + b.name + ' to ' + p.the)) + (b.files > 1 ? t('files.idx_of_total', { idx: b.index + 1, total: b.files }, ' · ' + (b.index + 1) + ' of ' + b.files) : '') : canSend ? t('files.to_the_or_right_click', { the: p.the }, 'To ' + p.the + ', or right-click files › Send to in the file manager') : '');
      // Shortcuts
      const ck = f.clip;
      keysSw.set(f.shortcuts);
      copyRec.set(f.copyKeys);
      pasteRec.set(f.pasteKeys);
      keysRow.setHint(ck.error || t('files.select_files_press', { copy: UI.keysLabel(f.copyKeys), paste: UI.keysLabel(f.pasteKeys), the: p.the }, 'Select files, press ' + UI.keysLabel(f.copyKeys) + ', then ' + UI.keysLabel(f.pasteKeys) + ' on ' + p.the));
      keysRow.hint.classList.toggle('bad', !!ck.error);
      copyRow.hidden = pasteRow.hidden = !f.shortcuts;
      pasteRow.setHint(ck.pasting ? t('files.pasting', null, 'Pasting…')
        : ck.incoming ? t('files.peer_copied_press', { them: p.them, what: ck.incoming.name || t('files.n_items', { count: ck.incoming.items }, ck.incoming.items + ' items'), keys: UI.keysLabel(f.pasteKeys) }, p.them + ' copied ' + (ck.incoming.name || ck.incoming.items + ' items') + ' · press ' + UI.keysLabel(f.pasteKeys))
          : t('files.paste_into_app_front', { folder: UI.receivedName(s) }, 'Into the app in front (a chat, a mail…), or the file manager folder in front, else ' + UI.receivedName(s)));
      edgeDrag.set(f.edgeDrag);
      edgeRow.setHint(f.edgeDrag && f.macDrags === false ? t('files.turned_off_on', null, 'Turned off on {name}')
        : !f.edgeDrag ? '' : f.session === 'wayland' ? t('files.from_the_wayland_hint', { the: p.the }, 'From ' + p.the + ': drop on a folder or the desktop. From here: needs an Xorg session')
          : t('files.drag_edge_drop_folder', null, 'Drag through the screen edge. Here, drop on a folder or the desktop'));
      mount.set(f.mountMac);
      openBtn.hidden = !m.drive && !m.wifi;
      macDrive.setHint(m.mountMessage || (!f.mountMac ? '' : m.drive ? t('files.in_file_manager_sidebar', null, 'In the file manager’s sidebar') : m.busy === 'mount' ? t('files.connecting', null, 'Connecting…')
        : m.wifi ? t('files.over_ble_open_wifi', null, 'Over Bluetooth: Open connects it with Wi-Fi Direct') : t('files.waiting_peer_share', null, 'Waiting for {name} to share one')));
      share.set(f.shareOn);
      const busy = m.busy === 'setup' ? t('files.setting_up_samba', null, 'Setting up Samba…') : m.busy === 'remove' ? t('files.removing', null, 'Removing…') : '';
      sharePill.hidden = !f.shareOn && !busy;
      sharePill.textContent = busy || (m.peer && m.peer.mounted ? t('files.on_peer', null, 'On {name}') : m.peer && m.peer.error ? t('files.problem', null, 'Problem') : t('files.shared', null, 'Shared'));
      sharePill.className = 'pill ' + (busy ? 'muted' : m.peer && m.peer.mounted ? 'good' : m.peer && m.peer.error ? 'bad' : 'muted');
      chooseBtn.disabled = !!m.busy;
      pcShare.setHint(m.message || (m.peer && m.peer.error) || (f.shareOn ? m.folder : t('files.folder_shares_samba', { folder: m.folder }, m.folder + ' · Shares it with Samba (asks for your password once)')));

      cancelBtn.hidden = !f.current;
      if (f.current) {
        const c = f.current;
        outRow.label.textContent = c.count > 1 ? t('files.sending_name_idx', { name: c.name, idx: c.index + 1, count: c.count }, 'Sending ' + c.name + ' (' + (c.index + 1) + ' of ' + c.count + ')') : t('files.sending_name', { name: c.name }, 'Sending ' + c.name);
        outRow.setHint(f.queued ? t('files.sent_of_size_queued', { sent: mb(c.sent), size: mb(c.size), queued: f.queued }, mb(c.sent) + ' of ' + mb(c.size) + ' · ' + f.queued + ' more waiting') : t('files.sent_of_size', { sent: mb(c.sent), size: mb(c.size) }, mb(c.sent) + ' of ' + mb(c.size)));
      } else {
        outRow.label.textContent = f.last ? (f.last.ok ? t('files.sent_file', { file: f.last.name || '' }, 'Sent ' + (f.last.name || '')) : t('files.not_sent_file', { file: f.last.name || '' }, 'Not sent: ' + (f.last.name || ''))) : t('files.nothing_sent', null, 'Nothing sent');
        outRow.setHint(f.last ? f.last.text + ' · ' + UI.ago(f.last.at) : '');
      }
      const inc = f.incoming;
      const dr = f.drag;
      if (dr.state) {
        inRow.label.textContent = dr.state === 'copying' ? t('files.copying_name', { name: dr.name }, 'Copying ' + dr.name) : t('files.dragging_name', { name: dr.name }, 'Dragging ' + dr.name);
        inRow.setHint(dr.state === 'copying' ? '' : t('files.esc_cancels', null, 'Esc cancels'));
        return;
      }
      if (dr.last && (!inc.last || dr.last.at > inc.last.at)) {
        inRow.label.textContent = dr.last.ok ? t('files.received_from_peer', null, 'Received from {name}') : t('files.not_received', null, 'Not received');
        inRow.setHint(dr.last.text + ' · ' + UI.ago(dr.last.at));
        return;
      }
      inRow.label.textContent = inc.receiving ? (inc.receiving === 1 ? t('files.receiving_files_from_one', { count: inc.receiving }, 'Receiving ' + inc.receiving + ' file from {name}') : t('files.receiving_files_from_other', { count: inc.receiving }, 'Receiving ' + inc.receiving + ' files from {name}'))
        : inc.last ? (inc.last.ok ? t('files.received_file', { file: inc.last.name }, 'Received ' + inc.last.name) : t('files.not_received_file', { file: inc.last.name }, 'Not received: ' + inc.last.name)) : t('files.nothing_received', null, 'Nothing received');
      inRow.setHint(inc.receiving ? '' : inc.last ? inc.last.text + ' · ' + UI.ago(inc.last.at) : '');
    };
  },
});
