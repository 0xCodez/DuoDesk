// TwinDesk — Copyright (C) 2026 inukaasith. GPL-3.0, see LICENSE.
// General tab, in sections: Startup (start with Windows, received files), Appearance (the switching
// popup, the phone's wallpaper, media controls), Overview (what it shows), Network and Bluetooth,
// Permissions (firewall self-check + Fix, Bluetooth, Location) and This computer (its name, the
// helper, the virtual display driver for Extend).
'use strict';

UI.tab({
  id: 'general',
  order: 100,
  title: 'General',
  color: 'linear-gradient(#aeaeb2, #636366)',
  desc: '',
  bottom: true,
  badge: (s) => (s.firewall && s.firewall.ok === false && !s.firewall.checking ? 'warn' : ''),
  build(body) {
    const { el, api } = UI;
    const t = (k, p, d) => (typeof window.t === 'function' ? window.t(k, p, d) : d !== undefined ? d : k);

    const store = {
      get: (k) => {
        try { return localStorage.getItem('duodesk.' + k) || localStorage.getItem(k); } catch (_) { return null; }
      },
      set: (k, v) => {
        try {
          localStorage.setItem('duodesk.' + k, v);
          localStorage.setItem(k, v);
        } catch (_) {}
      }
    };

    const savedLang = store.get('general.language') || store.get('lang') || 'auto';
    const initialTarget = savedLang === 'auto' ? (navigator.language || 'en') : savedLang;
    if (typeof DuoDeskI18n !== 'undefined' && DuoDeskI18n.setLanguage) {
      DuoDeskI18n.setLanguage(initialTarget);
    }

    const langSelect = UI.select([
      { value: 'auto', label: typeof t === 'function' ? t('general.lang_auto', null, 'Automatic (System)') : 'Automatic (System)' },
      // one option per registered locale (shared/locales), so a new language shows up here by itself
      ...(typeof DuoDeskI18n !== 'undefined' ? DuoDeskI18n.getAvailableLanguages().map((l) => ({ value: l.code, label: l.label })) : [{ value: 'en', label: 'English' }])
    ], (val) => {
      store.set('general.language', val);
      store.set('lang', val);
      api.setApp({ lang: val }); // the main process follows it (tray menu)
      const target = val === 'auto' ? (navigator.language || 'en') : val;
      if (typeof DuoDeskI18n !== 'undefined' && DuoDeskI18n.setLanguage) {
        DuoDeskI18n.setLanguage(target);
      }
      if (typeof location !== 'undefined' && location.reload) {
        location.reload();
      }
    });
    langSelect.set(savedLang);

    const langRow = UI.row(
      typeof t === 'function' ? t('general.language', null, 'Language') : 'Language',
      '',
      [langSelect.el]
    );

    const startup = UI.switch((v) => api.setStartup(v), { label: t('general.start_with_windows', null, 'Start with Windows') });
    // Received files (shared/received.js): where files sent here and saved from a phone go.
    const recvChange = UI.button(t('general.change', null, 'Change…'), () => api.chooseReceivedFolder(), 'small');
    const recvReset = UI.button(t('general.downloads', null, 'Downloads'), () => api.resetReceivedFolder(), 'small');
    const recvOpen = UI.button(t('files.open', null, 'Open'), () => api.openReceivedFolder(), 'small');
    const recvRow = UI.row(t('general.received_files', null, 'Received files'), '', [recvOpen, recvReset, recvChange]);
    const hudSw = UI.switch((v) => api.setApp({ hud: v }), { label: t('general.show_a_popup_when_switching', null, 'Show a popup when switching') });
    const fwPill = el('span', { class: 'pill' });
    const fwCheck = UI.button(t('general.check_again', null, 'Check again'), () => api.checkFirewall(), 'small');
    const fwFix = UI.button(t('general.fix', null, 'Fix'), () => api.fixFirewall(), 'small primary');
    const fwRow = UI.row(t('general.firewall', null, 'Firewall'), '', [fwPill, fwCheck, fwFix]);
    // (as the Mac): wake is a switch; Send to sends files from Explorer.
    const wakeSw = UI.switch((v) => api.setWake(v), { label: t('general.wake_from_the_network', null, 'Wake from the network') });
    const wakeRow = UI.row(t('general.let_the_other_computer_wake', null, 'Let the other computer wake {me}'), '', [wakeSw]);
    const sendToRow = UI.row(t('general.duodesk_in_send_to', null, 'DuoDesk in Send to'), '');
    const helperPill = el('span', { class: 'pill' });
    const helperRow = UI.row(t('general.mouse_and_keyboard_helper', null, 'Mouse and keyboard helper'), '', [helperPill]);
    const vddPill = el('span', { class: 'pill' });
    const vddInstall = UI.button(t('general.install', null, 'Install'), () => api.installVdd(), 'small primary');
    const vddRow = UI.row(t('general.virtual_display_driver', null, 'Virtual display driver'), '', [vddPill, vddInstall]); // Share screen › Extend (vdd.js)
    // Bluetooth when not on the same network: with phones (on unless switched off), with computers (off unless switched on).
    const bleSw = UI.switch((v) => api.setNet({ ble: v }), { label: t('overview.ble_phones', null, 'Bluetooth with phones') });
    const bleRow = UI.row(t('overview.ble_phones', null, 'Bluetooth with phones'), '', [bleSw]);
    const blePcSw = UI.switch((v) => api.setNet({ blePc: v }), { label: t('overview.ble_computers', null, 'Bluetooth with computers') });
    const blePcRow = UI.row(t('overview.ble_computers', null, 'Bluetooth with computers'), '', [blePcSw]);
    // Bluetooth off altogether while the session is on the same Wi-Fi (blepolicy.js wifiQuiet).
    const bleWifiSw = UI.switch((v) => api.setNet({ bleWifiOff: v }), { label: t('general.turn_off_bluetooth_on_wi', null, 'Turn off Bluetooth on Wi-Fi connections') });
    const bleWifiRow = UI.row(t('general.turn_off_bluetooth_on_wi', null, 'Turn off Bluetooth on Wi-Fi connections'), '', [bleWifiSw]);
    // What Windows has to allow, in one place (each is also asked for where a feature needs it).
    const btPill = el('span', { class: 'pill' });
    const btRow = UI.row('Bluetooth', t('general.for_a_phone_or_computer', null, 'For a phone or computer that isn’t on this network'), [btPill, UI.button(t('files.open', null, 'Open'), () => api.openBluetoothSettings(), 'small')]);
    const locRow = UI.row(t('general.location', null, 'Location'), t('general.to_join_a_phone_s', null, 'To join a phone’s or computer’s Wi-Fi Direct (Windows shows Wi-Fi networks only with it)'), [UI.button(t('files.open', null, 'Open'), () => api.netLocation(), 'small')]);
    const media = UI.mediaControlsRow(); // a phone's media controls on the Phone page (shared/ui-nowplaying.js)
    const deviceName = el('span', { class: 'value' });
    const deviceRow = UI.row(t('general.computer_name', null, 'Computer name'), t('general.how_other_computers_see_this', null, 'How other computers see this one'), [deviceName]);

    // Appearance: the phone's wallpaper behind it here (settings.phone.wallpaper, was on the Phone page).
    const wallSw = UI.switch((v) => api.setPhone({ wallpaper: v }), { label: t('general.show_the_phone_s_wallpaper', null, 'Show the phone’s wallpaper') });
    const wallRow = UI.row(t('general.show_the_phone_s_wallpaper', null, 'Show the phone’s wallpaper'), t('general.on_its_tile_and_overview', null, 'On its tile and Overview. DuoDesk on the phone reads it once wireless debugging is set up'), [wallSw]);
    // Overview: what it shows (settings.ui.overview).
    const parts = [['media', t('general.now_playing', null, 'Now playing'), t('general.what_plays_on_the_phone', null, 'What plays on the phone, with its controls')], ['qs', t('general.quick_actions', null, 'Quick actions'), t('general.wi_fi_bluetooth_torch_do', null, 'Wi-Fi, Bluetooth, torch, Do not disturb and more, with volume and ringer')],
      ['notifs', t('general.latest_notifications', null, 'Latest notifications'), t('general.the_newest_few_with_copy', null, 'The newest few, with Copy for one-time codes')], ['apps', t('general.most_used_apps', null, 'Most used apps'), t('general.the_phone_s_most_used', null, 'The phone’s most used apps this week')],
      ['clipboard', t('nav.clipboard', null, 'Clipboard'), t('general.its_recent_items_while_clipboard', null, 'Its recent items, while Clipboard is on')], ['files', t('files.send_files', null, 'Send files'), t('general.a_drop_zone_that_sends', null, 'A drop zone that sends files to the device')]];
    const partSw = {};
    const partRows = parts.map(([k, label, hint]) => {
      partSw[k] = UI.switch((v) => api.setOverview && api.setOverview({ [k]: v }), { label });
      return UI.row(label, hint, [partSw[k]]);
    });

    body.append(
      UI.card(typeof t === 'function' ? t('general.language', null, 'Language') : 'Language', [langRow]),
      UI.card(t('general.startup', null, 'Startup'), [
        UI.row(t('general.start_with_windows', null, 'Start with Windows'), t('general.duodesk_waits_in_the_tray', null, 'DuoDesk waits in the tray'), [startup]),
        recvRow,
      ]),
      UI.card(t('general.appearance', null, 'Appearance'), [
        UI.row(t('general.show_a_popup_when_switching', null, 'Show a popup when switching'), t('general.when_the_mouse_and_keyboard', null, 'When the mouse and keyboard move between devices'), [hudSw]),
        wallRow,
        media.el,
      ]),
      UI.card(t('nav.overview', null, 'Overview'), partRows),
      UI.card(t('general.network_and_bluetooth', null, 'Network and Bluetooth'), [bleRow, blePcRow, bleWifiRow, wakeRow, sendToRow]),
      UI.card(t('general.permissions', null, 'Permissions'), [fwRow, btRow, locRow]),
      UI.card(t('general.this_computer', null, 'This computer'), [deviceRow, helperRow, vddRow]),
    );

    // A choice made before the main process kept the language (settings.app.lang) is handed over once.
    let handedOver = false;
    return (s) => {
      if (!handedOver && s.app && s.app.lang === 'auto' && savedLang !== 'auto') { handedOver = true; api.setApp({ lang: savedLang }); }
      media.update(s);
      wallSw.set(!s.phone || !s.phone.settings || s.phone.settings.wallpaper !== false);
      const ov = (s.ui && s.ui.overview) || {};
      for (const k of Object.keys(partSw)) partSw[k].set(ov[k] !== false);
      startup.set(s.startup);
      hudSw.set(s.app.hud);
      const f = s.files || {};
      recvReset.hidden = !f.receivedFolder;
      recvRow.setHint(f.receivedFolder && f.received !== f.receivedFolder
        ? t('general.folder_missing_downloads_meanwhile', { folder: f.receivedFolder }, '{folder} isn’t there now: Downloads meanwhile. Files sent to {me} from another computer or a phone, and what’s saved from a phone’s Files and Photos')
        : t('general.folder_files_sent_to', { folder: f.received || t('general.downloads', null, 'Downloads') }, '{folder} · Files sent to {me} from another computer or a phone, and what’s saved from a phone’s Files and Photos'));
      const fw = s.firewall || {};
      fwPill.textContent = fw.checking ? t('general.checking', null, 'Checking…') : fw.ok ? t('general.ok', null, 'OK') : fw.ok === false ? t('general.needs_a_fix', null, 'Needs a fix') : '';
      fwPill.className = 'pill ' + (fw.checking ? 'muted' : fw.ok ? 'good' : 'bad');
      fwRow.setHint(fw.ok === false ? fw.message || '' : '');
      fwCheck.disabled = !!fw.checking;
      fwFix.hidden = fw.checking || fw.ok !== false || !!fw.error;
      const w = s.wake || {};
      wakeSw.set(w.on === true);
      wakeSw.disable(!w.checked || w.on == null || !!w.busy);
      wakeRow.setHint(w.error ? w.error : w.busy ? t('general.changing', null, 'Changing…') : !w.checked ? t('general.checking', null, 'Checking…')
        : w.on == null ? t('general.no_network_adapter_here_can', null, 'No network adapter here can wake {me}')
          : t('general.its_network_adapter_wakes_me', null, 'Its network adapter wakes {me} on a magic packet. Asks for administrator rights to change it'));
      sendToRow.setHint(s.peer ? t('general.right_click_files_send_to', { name: s.peer.name }, 'Right-click files › Send to › {name} (DuoDesk)') : t('general.shows_up_once_a_computer', null, 'Shows up once a computer is paired'));
      const h = s.kvmState.helper;
      helperPill.textContent = h ? (h === 'starting' ? t('general.starting', null, 'Starting…') : t('general.not_running', null, 'Not running')) : t('general.running', null, 'Running');
      helperPill.className = 'pill ' + (h ? (h === 'starting' ? 'muted' : 'bad') : 'good');
      helperRow.setHint(h && h !== 'starting' ? h : '');
      const v = s.pcScreen.vdd;
      vddPill.textContent = !v.checked ? t('general.checking', null, 'Checking…') : v.busy === 'install' ? t('general.installing', null, 'Installing…') : v.busy === 'remove' ? t('files.removing', null, 'Removing…') : v.installed ? t('general.installed', null, 'Installed') : t('general.not_installed', null, 'Not installed');
      vddPill.className = 'pill ' + (!v.checked || v.busy ? 'muted' : v.installed ? 'good' : 'bad');
      vddInstall.hidden = !v.checked || v.installed;
      vddInstall.disabled = !!v.busy;
      vddRow.setHint(v.message ? v.message : v.installed ? t('general.adds_the_extra_screen_for', null, 'Adds the extra screen for Share screen › Extend')
        : t('general.needed_for_share_screen_extend', null, 'Needed for Share screen › Extend. Asks for administrator rights once'));
      const n = s.net || {};
      const radio = n.radio === 'off' ? t('general.bluetooth_is_off_in_windows', null, 'Bluetooth is off in Windows settings')
        : n.radio === 'unsupported' ? t('general.this_pc_s_bluetooth_can', null, 'This PC’s Bluetooth can’t do it (needs Bluetooth LE)') : '';
      bleSw.set(n.ble !== false);
      bleRow.setHint(n.ble === false ? t('general.only_phones_on_this_network', null, 'Only phones on this network or a USB cable connect')
        : radio || t('general.a_phone_nearby_connects_through', null, 'A phone nearby connects through Bluetooth; files and screens switch to Wi-Fi Direct for a moment'));
      blePcSw.set(n.blePc === true);
      bleWifiSw.set(n.bleWifiOff !== false);
      bleWifiRow.setHint(n.bleWifiOff === false ? t('general.bluetooth_stays_on_beside_the', null, 'Bluetooth stays on beside the Wi-Fi, the way back if it drops')
        : n.bleOff ? t('general.off_now_the_session_is', null, 'Off now: the session is on the same Wi-Fi. Bluetooth comes back when it ends')
          : t('general.on_the_same_wi_fi', null, 'On the same Wi-Fi network (not Wi-Fi Direct), Bluetooth goes off until the session ends. With a computer, phones can’t find this one meanwhile'));
      blePcRow.setHint(n.blePc !== true ? t('general.only_computers_on_this_network', null, 'Only computers on this network connect')
        : radio || t('general.a_computer_nearby_connects_through', null, 'A computer nearby connects through Bluetooth; files and screens switch to Wi-Fi Direct for a moment'));
      btPill.textContent = n.radio === 'off' ? t('clipboard.off', null, 'Off') : n.radio === 'unsupported' ? t('general.not_supported', null, 'Not supported') : n.radio ? t('general.on', null, 'On') : t('general.unknown', null, 'Unknown');
      btPill.className = 'pill ' + (n.radio === 'off' || n.radio === 'unsupported' ? 'bad' : n.radio ? 'good' : 'muted');
      deviceName.textContent = s.device.name;
    };
  },
});
