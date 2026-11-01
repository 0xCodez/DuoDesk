// TwinDesk — Copyright (C) 2026 inukaasith. GPL-3.0, see LICENSE.
// Files tab: drag and drop and network drives, both directions in equal places.
'use strict';

UI.tab({
  id: 'files',
  group: 'Share',
  order: 50,
  title: 'File Sharing',
  icon: 'globe',
  desc: 'Drag files between your computers, or share a folder.',
  color: 'linear-gradient(#64d2ff, #0a84ff)',
  badge: (s) => (s.files && s.files.acceptDrops ? 'on' : ''),
  build(body) {
    const { el, api } = UI;
    const t = (k, p, d) => (typeof window.t === 'function' ? window.t(k, p, d) : d !== undefined ? d : k);
    const tilde = (p) => String(p || '').replace(/^\/Users\/[^/]+/, '~');

    // Mac -> PC
        const shareSw = UI.switch((v) => api.setShareMac(v), { label: t('files.share_a_folder', null, 'Share a folder') });
    const chooseBtn = UI.button(t('files.choose', null, 'Choose…'), () => api.chooseShareFolder(), 'small');
    const shareRow = UI.row(t('files.share_folder_with', null, 'Share a folder with {name}'), '', [chooseBtn, shareSw]);
    // PC -> Mac
    const acceptSw = UI.switch((v) => api.setFiles({ acceptDrops: v }), { label: t('files.accept_files', null, 'Accept files') });
    const acceptRow = UI.row(t('files.accept_files_from', null, 'Accept files from {name}'), '', [acceptSw]);
    const pcSw = UI.switch((v) => api.setSmb({ connectPc: v }), { label: t('files.connect_the_shared_folder', null, 'Connect the shared folder') });
    const openBtn = UI.button(t('files.open', null, 'Open'), () => api.openPcShare(), 'small');
    const pcRow = UI.row(t('files.open_peer_shared', null, 'Open {name}’s shared folder'), '', [openBtn, pcSw]);
    // shared
    const dragSw = UI.switch((v) => api.setFiles({ dragEdge: v }), { label: t('files.edge_drag_sw', null, 'Drag files across the screen edge') });
    const dragRow = UI.row(t('files.drag_between_computers', null, 'Drag files between computers'), t('files.drag_hint', null, 'Drag through the screen edge and drop anywhere'), [dragSw]);
    const reveal = UI.switch((v) => api.setFiles({ reveal: v }), { label: t('files.show_in_finder', null, 'Show in Finder') });
    const folderRow = UI.row(t('files.save_to', null, 'Save to'), '', [UI.button(t('files.choose', null, 'Choose…'), () => api.pickDropFolder(), 'small'), UI.button(t('files.downloads', null, 'Downloads'), () => api.resetDropFolder(), 'small')]);
    const progress = el('div');
    const list = el('div', { class: 'history' });

    // Send files: drop zone + Choose…
    const zoneText = el('div', { class: 'big', text: t('files.drop_here', null, 'Drop files or folders here') });
    const zone = el('div', { class: 'dropzone' }, [el('div', {}, [zoneText, el('div', { class: 'hint', text: t('files.they_go_to_the_other', null, 'They go to the other computer’s Downloads') })])]);
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
    const keysSw = UI.switch((v) => api.setFiles({ shortcuts: v }), { label: t('files.shortcuts_sw', null, 'Copy and paste files with shortcuts') });
    const copyRec = UI.keyRecorder((v) => api.setFiles({ copyKeys: v }));
    const pasteRec = UI.keyRecorder((v) => api.setFiles({ pasteKeys: v }));
    const keysRow = UI.row(t('files.shortcuts_title', null, 'Copy and paste files'), '', [keysSw]);
    const copyRow = UI.row(t('files.copy', null, 'Copy'), t('files.select_files_in_finder_first', null, 'Select files in Finder first'), [copyRec]);
    const pasteRow = UI.row(t('files.paste', null, 'Paste'), '', [pasteRec]);

    body.append(
      UI.card('', [sendRow, zone], { cls: 'keep-on' }),
      UI.card('', [keysRow, copyRow, pasteRow], { cls: 'keep-on' }),
      UI.pair(
        UI.dir('m2w', [shareRow]),
        UI.dir('w2m', [acceptRow, pcRow]),
      ),
      UI.card('', [dragRow], { cls: 'keep-on' }),
      progress,
      UI.card(t('files.arriving_files', null, 'Arriving files'), [
        folderRow,
        UI.row(t('files.show_in_finder', null, 'Show in Finder'), '', [reveal]),
      ]),
      UI.card(t('files.recent', null, 'Recent'), [list]),
    );

    let key = '';
    return (s) => {
      const f = s.files;
      const m = s.smb;
      if (!f || !m) return;
      const pc = UI.peer(s).name;
      // Send files
      canSend = !!s.client;
      zone.classList.toggle('off', !canSend);
      zoneText.textContent = canSend ? t('files.drop_here', null, 'Drop files or folders here') : t('files.connect_to_send', null, 'Connect to send files');
      sendBtn.disabled = !canSend;
      const out = f.sending.reduce((a, r) => [a[0] + r.sent, a[1] + r.size], [0, 0]);
      sendBar.hidden = !f.sending.length;
      sendBar.firstChild.style.width = `${Math.floor((100 * out[0]) / Math.max(1, out[1]))}%`;
      sendRow.setHint(f.sending.length ? t(f.sending.length === 1 ? 'files.sending_files_to_one' : 'files.sending_files_to_other', { count: f.sending.length, name: pc }, f.sending.length === 1 ? 'Sending {count} file to {name}' : 'Sending {count} files to {name}') : canSend ? t('files.to_peer', { the: pc }, 'To {the}') : '');
      // Shortcuts
      const ck = f.clip || {};
      keysSw.set(f.shortcuts !== false);
      copyRec.set(f.copyKeys);
      pasteRec.set(f.pasteKeys);
      keysRow.setHint(ck.error || t('files.select_files_press_copy_then', { copy: UI.keysLabel(f.copyKeys), paste: UI.keysLabel(f.pasteKeys), name: pc }, 'Select files, press {copy}, then {paste} on {name}'));
      keysRow.hint.classList.toggle('bad', !!ck.error);
      pasteRow.setHint(ck.pasting ? t('files.pasting', null, 'Pasting…')
        : ck.incoming ? (ck.incoming.name ? t('files.name_copied_file_press_keys', { name: pc, file: ck.incoming.name, keys: UI.keysLabel(f.pasteKeys) }, '{name} copied {file} · press {keys}')
          : t('files.name_copied_count_items_press', { name: pc, count: ck.incoming.items, keys: UI.keysLabel(f.pasteKeys) }, '{name} copied {count} items · press {keys}'))
          : t('files.into_the_app_in_front', null, 'Into the app in front (a chat, a mail…), or the Finder folder in front, else the Desktop'));
      dragSw.set(f.dragEdge !== false);
      dragRow.setHint(f.dragEdge !== false && !f.peerDrag ? t('files.turned_off_on', null, 'Turned off on {name}') : t('files.drag_hint', null, 'Drag through the screen edge and drop anywhere'));
      shareSw.set(m.sharing);
      shareSw.disable(m.shareBusy);
      chooseBtn.disabled = m.shareBusy;
      shareRow.setHint(m.shareBusy ? t('files.waiting_for_your_password', null, 'Waiting for your password…')
        : m.shareError ? t('files.couldnt_share_error', { error: m.shareError }, 'Couldn’t share: {error}')
          : tilde(m.folder || m.defaultFolder));
      acceptSw.set(f.acceptDrops);
      pcSw.set(m.connectPc);
      openBtn.hidden = !m.mounted && !m.wifi;
      pcRow.setHint(!m.connectPc ? ''
        : m.mounted ? t('files.in_finders_sidebar', null, 'In Finder’s sidebar')
          : m.mounting ? t('files.connecting', null, 'Connecting…')
            : m.wifi ? t('files.over_ble_open_wifi', null, 'Over Bluetooth: Open connects it with Wi-Fi Direct')
            : m.mountError ? t('files.couldnt_connect_error', { error: m.mountError }, 'Couldn’t connect: {error}')
              : t('files.waiting_for_name_share_folder', { name: pc }, 'Waiting for {name} to share a folder'));
      reveal.set(f.reveal);
      folderRow.setHint(tilde(f.folder || f.defaultFolder));
      progress.replaceChildren(
        ...f.receiving.map((r) => UI.note('info', t('files.receiving_name_percent', { name: r.name, percent: Math.floor((100 * r.got) / Math.max(1, r.size)) }, 'Receiving {name}  {percent}%'))),
        ...f.sending.map((r) => UI.note('info', t('files.sending_name_percent', { name: r.name, percent: Math.floor((100 * r.sent) / Math.max(1, r.size)) }, 'Sending {name}  {percent}%'))),
      );
      const items = [...f.recent.map((r) => ({ ...r, dir: 'in' })), ...f.sent.map((r) => ({ ...r, dir: 'out' }))].sort((a, b) => b.at - a.at).slice(0, 30);
      const k = JSON.stringify(items.map((r) => r.at)) + Math.floor(Date.now() / 15000);
      if (k === key) return;
      key = k;
      list.replaceChildren(...(items.length
        ? items.map((r) => el('div', { class: 'hist-item' }, [
          el('span', { class: `hist-dir ${r.dir}`, title: UI.fill(r.dir === 'out' ? t('clipboard.sent_to', null, 'Sent to {name}') : t('clipboard.from_peer', null, 'From {name}')) }, [UI.icon(r.dir === 'out' ? 'up' : 'down')]),
          el('div', { class: 'hist-text' }, [
            el('div', { class: 'hist-preview', text: r.name }),
            el('div', { class: 'hint', text: `${r.ok ? (r.dir === 'in' ? tilde(r.path) : r.where || pc) : t('files.failed_error', { error: r.error }, 'Failed: {error}')} · ${UI.ago(r.at)}` }),
          ]),
          r.dir === 'in' && r.ok ? UI.button(t('files.show', null, 'Show'), () => api.revealDrop(f.recent.indexOf(f.recent.find((x) => x.at === r.at))), 'small') : null,
        ]))
        : [UI.row(t('clipboard.nothing_yet', null, 'Nothing yet'), '')]));
    };
  },
});
