// TwinDesk — Copyright (C) 2026 inukaasith. GPL-3.0, see LICENSE.
// Phone Files page (Mac, PC and Linux): the phone's storage, folder by folder, through TwinDesk on
// the phone with All files access (Hub.kt, FsBrowse.kt there), so no ADB: Mount is the drive in the
// file manager, through ADB. Open a folder, Save files and folders here (into Downloads, as Send
// does), Upload into the folder that's open (or drop files on it), New folder, Rename, Delete.
// On USB, Wi-Fi or Wi-Fi Direct; over Bluetooth it says so, with Connect with Wi-Fi Direct.
// Shared folders (shared/foldershare.js), both ways: the folder the phone shares opens here in the
// file manager, and a folder here shows in the phone's Files app.
'use strict';
{ // block scope: a top-level const tr would clash with the other scripts' own
  const tr = (k, p, d) => (typeof t === 'function' ? t(k, p, d) : (d || k));

UI.tab({
  id: 'pfiles',
  group: 'Phone',
  order: 8,
  title: 'Phone Files',
  icon: 'folder',
  color: 'linear-gradient(#64d2ff, #0a84ff)',
  desc: tr('pfiles.desc', null, 'Browse the phone’s storage and copy files both ways. No wireless debugging needed.'),
  hidden: (s) => !UI.isPhone(s), // only while a phone is connected
  wifiOnly: true, // files are too big for Bluetooth: Connect with Wi-Fi Direct on top, nothing loads
  master: { get: (s) => !!(s.hub && s.hub.files), set: (v) => UI.api.hub({ do: 'set', what: 'files', on: v }) },
  badge: (s) => (s.hub && s.hub.files ? 'on' : ''),
  build(body, page) {
    const { el, api } = UI;
    const top = UI.hubTop('files');

    let cwd = '';
    let items = []; // {name, dir, size, at, n}
    let hidden = false;
    let asking = '';
    const chosen = new Set(); // names in cwd
    let confirmDelete = false;
    let renaming = ''; // the name being renamed
    let refs = 0;

    const crumbs = el('div', { class: 'hub-crumbs' });
    const upBtn = UI.button('‹', () => cwd && open(cwd.split('/').slice(0, -1).join('/')), 'small');
    upBtn.title = tr('pfiles.up', null, 'Up');
    const refreshBtn = UI.button(tr('general.refresh', null, 'Refresh'), () => open(cwd), 'small');
    const hiddenBtn = UI.button(tr('pfiles.hidden', null, 'Hidden'), () => { hidden = !hidden; hiddenBtn.classList.toggle('on', hidden); open(cwd); }, 'small');
    hiddenBtn.title = tr('pfiles.hidden_hint', null, 'Show files whose names start with a dot');
    const mkdirBtn = UI.button(tr('pfiles.new_folder', null, 'New Folder'), () => { newRow.hidden = false; newName.value = tr('pfiles.new_folder', null, 'New Folder'); newName.select(); newName.focus(); }, 'small');
    const uploadBtn = UI.button(tr('pfiles.upload', null, 'Upload…'), () => api.hub({ do: 'upload', path: cwd }), 'small primary');
    const bar = el('div', { class: 'hub-media-bar' }, [upBtn, crumbs, el('span', { class: 'hub-grow' }), hiddenBtn, refreshBtn, mkdirBtn, uploadBtn]);

    // What's chosen: Save, Rename (one), Delete (asks once more).
    const selText = el('span', { class: 'hint' });
    const saveBtn = UI.button(tr('general.save', null, 'Save'), () => save([...chosen]), 'small primary');
    const renameBtn = UI.button(tr('general.rename', null, 'Rename'), () => { renaming = [...chosen][0]; paint(); }, 'small');
    const deleteBtn = UI.button(tr('general.delete', null, 'Delete'), () => {
      if (!confirmDelete) { confirmDelete = true; return paint(); }
      act({ a: 'delete', path: cwd, paths: [...chosen].map(join) });
      chosen.clear();
      confirmDelete = false;
      paint();
    }, 'small');
    const clearBtn = UI.button(tr('pfiles.done', null, 'Done'), () => { chosen.clear(); confirmDelete = false; paint(); }, 'small');
    const selBar = el('div', { class: 'hub-media-bar hub-fs-sel' }, [selText, el('span', { class: 'hub-grow' }), saveBtn, renameBtn, deleteBtn, clearBtn]);

    // A new folder, named here.
    const newName = el('input', { class: 'hub-input hub-grow', type: 'text', attrs: { 'aria-label': tr('pfiles.folder_name_aria', null, 'Folder name'), maxlength: '255' } });
    const newRow = el('div', { class: 'hub-media-bar hub-fs-new', hidden: true }, [UI.icon('folder', 'hub-fs-ico'), newName,
      UI.button(tr('general.create', null, 'Create'), () => mkdir(), 'small primary'), UI.button(tr('general.cancel', null, 'Cancel'), () => { newRow.hidden = true; }, 'small')]);
    newName.addEventListener('keydown', (e) => { if (e.key === 'Enter') mkdir(); else if (e.key === 'Escape') newRow.hidden = true; });

    const list = el('div', { class: 'hub-list hub-fs-list' });
    const status = el('div', { class: 'hint hub-fs-status' });
    const listCard = UI.card('', [list]);
    const wrap = el('div', { class: 'hub-fs' }, [bar, selBar, newRow, listCard, status]);
    // Shared folders, both ways (not behind the switch above: they need no All files access here).
    const isFm = !navigator.platform.startsWith('Mac') && !navigator.platform.startsWith('Win'); // Finder and Explorer are names; Linux has no single one
    const fmName = () => (navigator.platform.startsWith('Mac') ? 'Finder' : navigator.platform.startsWith('Win') ? 'Explorer' : tr('pfiles.the_file_manager', null, 'the file manager'));
    const openBtn = UI.button(tr('pfiles.open', null, 'Open'), () => api.hub({ do: 'share', a: 'open' }), 'small primary');
    const ejectBtn = UI.button(tr('pfiles.eject', null, 'Eject'), () => api.hub({ do: 'share', a: 'unmount' }), 'small');
    const autoSw = UI.switch((v) => api.hub({ do: 'share', a: 'auto', on: v }), { label: tr('pfiles.auto_sw_label', null, 'Open the phone’s shared folder when it shares one') });
    const phoneRow = UI.row(tr('pfiles.phone_row_title', null, 'The phone’s shared folder'), '', [openBtn, ejectBtn, autoSw]);
    const chooseBtn = UI.button(tr('general.choose', null, 'Choose…'), () => api.hub({ do: 'share', a: 'choose' }), 'small');
    const defaultBtn = UI.button(tr('general.default', null, 'Default'), () => api.hub({ do: 'share', a: 'default' }), 'small');
    const serveSw = UI.switch((v) => api.hub({ do: 'share', a: 'serve', on: v }), { label: tr('pfiles.serve_sw_label', null, 'Share a folder with the phone') });
    const mineRow = UI.row(tr('pfiles.mine_row_title', null, 'Share a folder with the phone'), '', [chooseBtn, defaultBtn, serveSw]);
    const shareCard = UI.card(tr('pfiles.shared_folders', null, 'Shared folders'), [phoneRow, mineRow]);
    // Explorer's Import from phone (Windows: right-click a folder › TwinDesk): Save goes there.
    const importRow = UI.row('', tr('pfiles.import_row_hint', null, 'Choose files on the phone, then Import. They go into this folder.'), [UI.button(tr('general.cancel', null, 'Cancel'), () => api.importCancel && api.importCancel(), 'small')]);
    const importCard = UI.card('', [importRow], { cls: 'import-card' });
    importCard.hidden = true;
    let importTo = null;
    body.append(top.el, importCard, shareCard, wrap);
    const tilde = (p) => String(p || '').replace(/^(\/Users\/[^/]+|\/home\/[^/]+|[A-Z]:\\Users\\[^\\]+)/, '~');
    function renderShare(s) {
      const sh = s.hub && s.hub.share;
      const fm = fmName();
      shareCard.hidden = !sh; // over Bluetooth too: Open moves the session onto Wi-Fi Direct first
      if (shareCard.hidden) return;
      const ph = UI.phoneName(s);
      const p = sh.phone;
      phoneRow.label.textContent = tr('pfiles.phone_shared_folder', { phone: ph }, `${ph}’s shared folder`);
      autoSw.set(p.auto);
      openBtn.hidden = !p.offered;
      openBtn.disabled = !!p.busy;
      openBtn.textContent = p.mounted ? tr('pfiles.show_in_fm', { fm: isFm ? tr('pfiles.files_app', null, 'Files') : fm }, `Show in ${isFm ? 'Files' : fm}`) : tr('pfiles.open', null, 'Open');
      ejectBtn.hidden = !p.mounted;
      phoneRow.setHint(p.message || (p.busy === 'mounting' ? tr('pfiles.busy_opening', null, 'Opening…') : p.busy === 'wifi' ? tr('pfiles.busy_wifi', null, 'Connecting with Wi-Fi Direct…')
        : p.wifi ? tr('pfiles.hint_wifi_open', { name: p.name, fm }, `“${p.name}”: Open connects with Wi-Fi Direct and shows it in ${fm}`)
        : !p.offered ? tr('pfiles.hint_none_shared', { phone: ph }, `None shared: on ${ph}, DuoDesk › File access › Share a folder`)
          : p.mounted ? (fm === 'Finder' ? tr('pfiles.hint_mounted_finder', { name: p.name }, `“${p.name}”, in Finder under Locations`) : tr('pfiles.hint_mounted', { name: p.name, fm }, `“${p.name}”, in ${fm}`)) : tr('pfiles.hint_open_shows', { name: p.name, fm }, `“${p.name}”: Open shows it in ${fm}`)));
      phoneRow.hint.classList.toggle('bad', !!p.message);
      const m = sh.mine;
      mineRow.label.textContent = tr('pfiles.share_folder_with', { phone: ph }, `Share a folder with ${ph}`);
      serveSw.set(m.on);
      mineRow.setHint(m.error ? tr('pfiles.share_failed', { error: m.error }, `Couldn’t share: ${m.error}`) : !m.on ? tilde(m.folder) : tr(UI.onBle(s) ? 'pfiles.mine_on_ble' : 'pfiles.mine_on', { folder: tilde(m.folder), phone: ph }, `${tilde(m.folder)}: in ${ph}’s Files app and file pickers${UI.onBle(s) ? ', over Wi-Fi Direct (Open on the phone connects it)' : ''}`));
      mineRow.hint.classList.toggle('bad', !!m.error);
    }

    const join = (name) => (cwd ? `${cwd}/${name}` : name);
    const ref = () => `fs${++refs}`;
    const act = (m) => UI.hubAsk({ t: 'fs.do', ref: ref(), ...m });

    function open(path) {
      cwd = path;
      asking = path;
      chosen.clear();
      confirmDelete = false;
      renaming = '';
      newRow.hidden = true;
      UI.hubAsk({ t: 'fs.list', path, hidden });
      paint();
    }

    function mkdir() {
      const name = newName.value.trim();
      if (!name || /[/\\]/.test(name)) return newName.focus();
      act({ a: 'mkdir', path: cwd, name });
      newRow.hidden = true;
    }

    function save(names) {
      if (!names.length) return;
      UI.hubAsk({ t: 'fs.save', paths: names.map(join) });
      status.textContent = tr('pfiles.saving_status', { count: names.length === 1 ? names[0] : tr('pfiles.n_items', { count: names.length }, `${names.length} items`), me: UI.fill('{me}'), folder: UI.receivedName(UI.state) }, `Saving ${names.length === 1 ? names[0] : `${names.length} items`} to ${UI.fill('{me}')}’s ${UI.receivedName(UI.state)}…`);
      chosen.clear();
      paint();
    }

    function row(it) {
      const check = el('input', { type: 'checkbox', class: 'hub-fs-check', attrs: { 'aria-label': tr('pfiles.choose_aria', { name: it.name }, `Choose ${it.name}`) } });
      check.checked = chosen.has(it.name);
      check.onchange = () => { if (check.checked) chosen.add(it.name); else chosen.delete(it.name); confirmDelete = false; paint(); };
      const when = it.at ? UI.clock(it.at) : '';
      const hint = it.dir ? [it.n != null ? (it.n === 1 ? tr('pfiles.dir_items_one', { count: it.n }, `${it.n} item`) : tr('pfiles.n_items', { count: it.n }, `${it.n} items`)) : tr('pfiles.folder', null, 'Folder'), when] : [UI.bytes(it.size || 0), when];
      let r;
      if (renaming === it.name) {
        const input = el('input', { class: 'hub-input hub-grow', type: 'text', value: it.name, attrs: { 'aria-label': tr('pfiles.new_name_aria', null, 'New name'), maxlength: '255' } });
        const done = (ok) => {
          const name = input.value.trim();
          renaming = '';
          if (ok && name && name !== it.name && !/[/\\]/.test(name)) { act({ a: 'rename', path: join(it.name), name }); chosen.clear(); }
          paint();
        };
        input.addEventListener('keydown', (e) => { if (e.key === 'Enter') done(true); else if (e.key === 'Escape') done(false); });
        r = UI.row('', '', [UI.button(tr('general.rename', null, 'Rename'), () => done(true), 'small primary'), UI.button(tr('general.cancel', null, 'Cancel'), () => done(false), 'small')]);
        r.querySelector('.text').replaceChildren(input);
        setTimeout(() => { input.focus(); input.setSelectionRange(0, it.dir ? it.name.length : it.name.replace(/\.[^.]*$/, '').length || it.name.length); });
      } else {
        r = UI.row(it.name, hint.filter(Boolean).join(' · '), it.dir ? [el('span', { class: 'chev', text: '›' })] : [UI.button(tr('general.save', null, 'Save'), () => save([it.name]), 'small')], {
          onClick: () => (it.dir ? open(join(it.name)) : (check.checked = !check.checked, check.onchange())),
        });
      }
      if (renaming !== it.name) { r.label.textContent = it.name; delete r.label.dataset.peer; } // a name as it is, braces too
      r.classList.add('hub-fs-row');
      r.classList.toggle('chosen', chosen.has(it.name));
      r.prepend(check, UI.icon(it.dir ? 'folder' : 'doc', `hub-fs-ico${it.dir ? ' dir' : ''}`));
      return r;
    }

    function paint() {
      const parts = cwd ? cwd.split('/') : [];
      crumbs.replaceChildren(...[{ label: tr('pfiles.storage', null, 'Storage'), path: '' }].concat(parts.map((p, i) => ({ label: p, path: parts.slice(0, i + 1).join('/') })))
        .flatMap((c, i, all) => {
          const b = el('button', { class: 'hub-crumb', text: c.label });
          b.disabled = i === all.length - 1;
          b.onclick = () => open(c.path);
          return i ? [el('span', { class: 'hub-crumb-sep', text: '›' }), b] : [b];
        }));
      upBtn.disabled = !cwd;
      list.replaceChildren(...items.map(row));
      if (!items.length) list.append(el('div', { class: 'hub-empty', text: asking === cwd ? tr('general.loading', null, 'Loading…') : tr('pfiles.folder_empty', null, 'This folder is empty') }));
      selBar.hidden = !chosen.size;
      selText.textContent = chosen.size === 1 ? tr('pfiles.chosen_count_one', { count: 1 }, '{count} chosen') : tr('pfiles.chosen_count_other', { count: chosen.size }, `${chosen.size} chosen`);
      saveBtn.textContent = importTo ? tr('pfiles.import_to', { name: importTo.name }, `Import to ${importTo.name}`) : tr('pfiles.save_to_me', { me: UI.fill('{me}') }, `Save to ${UI.fill('{me}')}`);
      renameBtn.hidden = chosen.size !== 1;
      deleteBtn.textContent = confirmDelete ? tr('pfiles.delete_confirm', { item: chosen.size === 1 ? [...chosen][0] : tr('pfiles.n_items', { count: chosen.size }, `${chosen.size} items`) }, `Delete ${chosen.size === 1 ? [...chosen][0] : `${chosen.size} items`}?`) : tr('general.delete', null, 'Delete');
      deleteBtn.classList.toggle('danger', confirmDelete);
    }

    UI.hubOn('fs.list', (m) => {
      if ((m.path || '') !== cwd) return; // an answer for a folder left since
      asking = '';
      if (m.error) {
        items = [];
        status.textContent = m.error;
      } else {
        items = (m.items || []).filter((x) => x && typeof x.name === 'string' && x.name)
          .sort((a, b) => (b.dir - a.dir) || a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
        for (const n of [...chosen]) if (!items.some((x) => x.name === n)) chosen.delete(n);
        const gb = (n) => `${(n / 1e9).toFixed(n >= 1e11 ? 0 : 1)} GB`;
        status.textContent = m.total ? tr('pfiles.storage_free_of_total', { free: gb(m.free || 0), total: gb(m.total) }, `${gb(m.free || 0)} free of ${gb(m.total)}`) : '';
      }
      paint();
    });
    UI.hubOn('fs.done', (m) => {
      if (!m.ok) status.textContent = m.error || tr('pfiles.didnt_work', null, 'That didn’t work');
      if ((m.path || '') === cwd) UI.hubAsk({ t: 'fs.list', path: cwd, hidden });
    });

    // Files dropped on the page go into the folder that's open.
    wrap.addEventListener('dragover', (e) => {
      if (!UI.hubReady(UI.state, 'files') || !e.dataTransfer.types.includes('Files')) return;
      e.preventDefault();
      wrap.classList.add('over');
    });
    wrap.addEventListener('dragleave', (e) => { if (!wrap.contains(e.relatedTarget)) wrap.classList.remove('over'); });
    wrap.addEventListener('drop', (e) => {
      wrap.classList.remove('over');
      if (!UI.hubReady(UI.state, 'files')) return;
      e.preventDefault();
      // As an array: a FileList reaches the preload as a plain object, which can't be iterated.
      const paths = api.pathsOf ? api.pathsOf([...e.dataTransfer.files]) : [];
      if (paths.length) {
        api.hub({ do: 'upload', path: cwd, paths });
        status.textContent = tr('pfiles.sending_items_to', { count: paths.length === 1 ? tr('pfiles.a_file', null, 'a file') : tr('pfiles.n_items', { count: paths.length }, `${paths.length} items`), dest: cwd || tr('pfiles.storage', null, 'Storage') }, `Sending ${paths.length === 1 ? 'a file' : `${paths.length} items`} to ${cwd || 'Storage'}…`);
      }
    });

    let loaded = false;
    UI.onShown(page, (shown) => {
      if (shown && UI.hubReady(UI.state, 'files') && !UI.onBle(UI.state) && !loaded) { loaded = true; open(cwd); }
    });
    paint();
    UI.onDeviceChange(() => { // another device: its folders, from the top
      cwd = '';
      items = [];
      chosen.clear();
      loaded = false;
      paint();
      if (!page.hidden && UI.hubReady(UI.state, 'files') && !UI.onBle(UI.state)) { loaded = true; open(cwd); }
    });

    return (s) => {
      top.render(s);
      renderShare(s);
      const imp = (s.files && s.files.importTo) || null;
      importCard.hidden = !imp;
      if (imp) {
        importRow.label.textContent = (imp.why === 'capture' ? tr('pfiles.capturing_into', { name: imp.name }, `Capturing into ${imp.name}`) : tr('pfiles.importing_into', { name: imp.name }, `Importing into ${imp.name}`));
        importRow.setHint(imp.why === 'capture' ? tr('pfiles.capture_hint', null, 'Take photos with the phone’s camera. Each one comes into this folder.') : tr('pfiles.import_row_hint', null, 'Choose files on the phone, then Import. They go into this folder.'));
      }
      if (JSON.stringify(imp) !== JSON.stringify(importTo)) { importTo = imp; if (loaded) paint(); }
      const ready = UI.hubReady(s, 'files') && !UI.onBle(s); // over Bluetooth: the Wi-Fi Direct note only
      wrap.hidden = !ready;
      if (!ready) { loaded = false; return; }
      uploadBtn.textContent = tr('pfiles.upload_from_me', { me: UI.fill('{me}') }, `Upload from ${UI.fill('{me}')}…`);
      if (!loaded && !page.hidden) { loaded = true; open(cwd); }
    };
  },
});
}
