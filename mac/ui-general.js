// TwinDesk — Copyright (C) 2026 inukaasith. GPL-3.0, see LICENSE.
// General tab: permissions, app behaviour.
'use strict';

UI.tab({
  id: 'general',
  order: 100,
  title: 'General',
  desc: '',
  color: 'linear-gradient(#aeaeb2, #636366)',
  bottom: true,
  badge: (s) => {
    const p = s.permissions;
    if (p && (p.screen !== 'granted' || !p.accessibility || p.inputMonitoring === false)) return '!';
    return '';
  },
  build(body) {
    const { el, api } = UI;
    const t = (k, p, d) => (typeof window.t === 'function' ? window.t(k, p, d) : d !== undefined ? d : k);
    const PERMS = [
      { kind: 'screen', label: t('overview.screen_recording', null, 'Screen Recording'), note: t('general.to_share_your_screen', null, 'To share your screen') },
      { kind: 'accessibility', label: t('cursor.accessibility', null, 'Accessibility'), note: t('general.so_the_other_computer_can', null, 'So the other computer can control this one') },
      { kind: 'inputMonitoring', label: t('overview.input_monitoring', null, 'Input Monitoring'), note: t('general.to_use_this_keyboard_on', null, 'To use this keyboard on the other computer') },
      // Every other permission a feature uses, in one place (each is asked for when the feature is used).
      { kind: 'localNetwork', label: t('general.local_network', null, 'Local Network'), note: t('general.to_find_your_other_computers', null, 'To find your other computers and phones'), state: (s) => (s.discovery ? s.discovery.localNetwork !== false : null) },
      { kind: 'bluetooth', label: 'Bluetooth', note: t('general.for_a_phone_or_computer', null, 'For a phone or computer that isn’t on this network'), state: (s) => (s.net && s.net.radio ? s.net.radio !== 'denied' && s.net.radio !== 'unauthorized' : null) },
      { kind: 'location', label: t('general.location', null, 'Location'), note: t('general.to_join_a_phones_or', null, 'To join a phone’s or PC’s Wi-Fi Direct (macOS shows Wi-Fi networks only with it)'), state: () => null },
      { kind: 'fullDisk', label: t('general.full_disk_access', null, 'Full Disk Access'), note: t('general.optional_to_share_any_folder', null, 'Optional: to share any folder with the other computer'), state: () => null },
    ];
    const perms = PERMS.map((p) => {
      const pill = el('span', { class: 'pill' });
      const row = UI.row(p.label, p.note, [pill, UI.button(t('files.open', null, 'Open'), () => api.openSettings(p.kind), 'small')]);
      return { p, pill, row };
    });
    const helperRow = UI.row(t('general.background_helper', null, 'Background helper'), '');
    const helperVal = el('span', { class: 'value' });
    helperRow.querySelector('.controls').append(helperVal);
    const deviceName = el('span', { class: 'value' });
    const deviceRow = UI.row(t('general.computer_name', null, 'Computer name'), t('general.how_other_computers_see_this', null, 'How other computers see this one'), [deviceName]);
    const loginSw = UI.switch((v) => api.setApp({ openAtLogin: v }), { label: t('general.open_at_login', null, 'Open at login') });
    const awakeSw = UI.switch((v) => api.setApp({ keepAwake: v }), { label: t('general.keep_the_display_awake', null, 'Keep the display awake') });
    const hudSw = UI.switch((v) => api.setApp({ hud: v }), { label: t('general.show_a_popup_when_switching', null, 'Show a popup when switching') });
    // Wake this Mac from the other computer; the Share menu entry.
    const wakeSw = UI.switch((v) => api.setWakeOnLan(v), { label: t('general.wake_from_the_network', null, 'Wake from the network') });
    const wakeRow = UI.row(t('general.let_name_wake_me', null, 'Let {name} wake {me}'), '', [wakeSw]);
    // Bluetooth when not on the same network: with phones (on unless switched off), with computers (off unless switched on).
    const bleSw = UI.switch((v) => api.setNet({ ble: v }), { label: t('overview.ble_phones', null, 'Bluetooth with phones') });
    const bleRow = UI.row(t('overview.ble_phones', null, 'Bluetooth with phones'), '', [bleSw]);
    const blePcSw = UI.switch((v) => api.setNet({ blePc: v }), { label: t('overview.ble_computers', null, 'Bluetooth with computers') });
    const blePcRow = UI.row(t('overview.ble_computers', null, 'Bluetooth with computers'), '', [blePcSw]);
    // Bluetooth off altogether while the session is on the same Wi-Fi (blepolicy.js wifiQuiet).
    const bleWifiSw = UI.switch((v) => api.setNet({ bleWifiOff: v }), { label: t('general.turn_off_bluetooth_on_wifi', null, 'Turn off Bluetooth on Wi-Fi connections') });
    const bleWifiRow = UI.row(t('general.turn_off_bluetooth_on_wifi', null, 'Turn off Bluetooth on Wi-Fi connections'), '', [bleWifiSw]);
    const shareRow = UI.row(t('general.duodesk_in_the_share_menu', null, 'DuoDesk in the Share menu'), t('general.share_duodesk_sends_files_to', null, 'Share › DuoDesk sends files to the other computer'),
      [UI.button(t('general.extensions', null, 'Extensions…'), () => api.openSettings('extensions'), 'small')]);

    const media = UI.mediaControlsRow(); // a phone's media controls on the Phone page (shared/ui-nowplaying.js)
    // Appearance: the phone's wallpaper (settings.phone.wallpaper, was on the Phone page).
    const wallSw = UI.switch((v) => api.setPhone({ wallpaper: v }), { label: t('general.show_the_phones_wallpaper', null, 'Show the phone’s wallpaper') });
    const wallRow = UI.row(t('general.show_the_phones_wallpaper', null, 'Show the phone’s wallpaper'), t('general.on_its_tile_and_overview', null, 'On its tile and Overview. DuoDesk on the phone reads it once wireless debugging is set up'), [wallSw]);
    // Overview: what it shows (settings.ui.overview).
    const parts = [['media', t('general.now_playing', null, 'Now playing'), t('general.what_plays_on_the_phone', null, 'What plays on the phone, with its controls')], ['qs', t('general.quick_actions', null, 'Quick actions'), t('general.wifi_bluetooth_torch_do_not', null, 'Wi-Fi, Bluetooth, torch, Do not disturb and more, with volume and ringer')],
      ['notifs', t('general.latest_notifications', null, 'Latest notifications'), t('general.the_newest_few_with_copy', null, 'The newest few, with Copy for one-time codes')], ['apps', t('general.most_used_apps', null, 'Most used apps'), t('general.the_phones_most_used_apps', null, 'The phone’s most used apps this week')],
      ['clipboard', t('clipboard.title', null, 'Clipboard'), t('general.its_recent_items_while_clipboard', null, 'Its recent items, while Clipboard is on')], ['files', t('files.send_files', null, 'Send files'), t('general.a_drop_zone_that_sends', null, 'A drop zone that sends files to the device')]];
    const partSw = {};
    const partRows = parts.map(([k, label, hint]) => {
      partSw[k] = UI.switch((v) => api.setOverview({ [k]: v }), { label });
      return UI.row(label, hint, [partSw[k]]);
    });

    const tFn = (typeof window !== 'undefined' && window.t) || ((k, p, d) => d || k);
    const langSelect = UI.select([
      { value: 'auto', label: tFn('general.lang_auto', null, 'Automatic (System)') },
      // one option per registered locale (shared/locales), so a new language shows up here by itself
      ...(typeof DuoDeskI18n !== 'undefined' ? DuoDeskI18n.getAvailableLanguages().map((l) => ({ value: l.code, label: l.label })) : [{ value: 'en', label: 'English' }])
    ], (val) => {
      try {
        localStorage.setItem('duodesk.general.language', val);
        localStorage.setItem('duodesk.lang', val);
      } catch (_) {}
      api.setApp({ lang: val }); // the main process follows it (tray menu)
      const target = val === 'auto' ? (navigator.language || 'en') : val;
      if (typeof DuoDeskI18n !== 'undefined' && DuoDeskI18n.setLanguage) {
        DuoDeskI18n.setLanguage(target);
      }
      location.reload();
    });
    const curLang = (typeof localStorage !== 'undefined' && (localStorage.getItem('duodesk.general.language') || localStorage.getItem('duodesk.lang'))) || 'auto';
    langSelect.set(curLang);
    const langRow = UI.row(tFn('general.language', null, 'Language'), '', [langSelect.el]);

    body.append(
      UI.card(tFn('general.language', null, 'Language'), [langRow]),
      UI.card(t('general.startup', null, 'Startup'), [
        UI.row(t('general.open_at_login', null, 'Open at login'), '', [loginSw]),
        UI.row(t('general.keep_the_display_awake', null, 'Keep the display awake'), t('general.while_connected', null, 'While connected'), [awakeSw]),
      ]),
      UI.card(t('general.appearance', null, 'Appearance'), [
        UI.row(t('general.show_a_popup_when_switching', null, 'Show a popup when switching'), t('general.when_the_mouse_and_keyboard', null, 'When the mouse and keyboard move between devices'), [hudSw]),
        wallRow,
        media.el,
      ]),
      UI.card(t('nav.overview', null, 'Overview'), partRows),
      UI.card(t('general.network_and_bluetooth', null, 'Network and Bluetooth'), [bleRow, blePcRow, bleWifiRow, wakeRow, shareRow]),
      UI.card(t('general.permissions', null, 'Permissions'), [
        ...perms.map((x) => x.row),
        UI.row(t('general.changed_a_permission', null, 'Changed a permission?'), t('general.restart_to_apply_it', null, 'Restart to apply it'), [UI.button(t('general.restart', null, 'Restart'), () => api.relaunch(), 'small')]),
      ]),
      UI.card(t('general.this_computer', null, 'This computer'), [deviceRow, helperRow]),
    );

    // A choice made before the main process kept the language (settings.app.lang) is handed over once.
    let handedOver = false;
    return (s) => {
      if (!handedOver && s.app && s.app.lang === 'auto' && curLang !== 'auto') { handedOver = true; api.setApp({ lang: curLang }); }
      media.update(s);
      wallSw.set(!s.phone || !s.phone.settings || s.phone.settings.wallpaper !== false);
      const ov = (s.ui && s.ui.overview) || {};
      for (const k of Object.keys(partSw)) partSw[k].set(ov[k] !== false);
      for (const { p, pill } of perms) {
        const v = p.state ? p.state(s) : s.permissions[p.kind];
        const ok = p.kind === 'screen' ? v === 'granted' : v === true;
        const unknown = v === null || v === undefined || v === 'unknown';
        pill.className = `pill ${unknown ? 'muted' : ok ? 'good' : 'bad'}`;
        // macOS counts Accessibility as enough for TwinDesk's keyboard tap: Input Monitoring reads
        // as allowed then, with its own switch in System Settings still off (that's fine).
        const viaAx = p.kind === 'inputMonitoring' && ok && s.permissions.accessibility === true;
        pill.hidden = unknown && !!p.state; // macOS doesn't tell: Open shows it
        pill.textContent = unknown ? t('general.unknown', null, 'Unknown') : viaAx ? t('general.allowed_by_accessibility', null, 'Allowed by Accessibility') : ok ? t('general.allowed', null, 'Allowed') : t('general.not_allowed', null, 'Not allowed');
      }
      if (s.app) {
        loginSw.set(s.app.openAtLogin);
        awakeSw.set(s.app.keepAwake);
        hudSw.set(s.app.hud !== false);
      }
      const w = s.wake || {};
      wakeSw.set(w.womp === true);
      wakeSw.disable(w.womp == null);
      wakeRow.setHint(w.womp == null ? t('general.checking', null, 'Checking…') : t('general.wake_for_network_access_asks', null, 'Wake for network access. Asks for your password to change it'));
      if (s.net) {
        bleSw.set(s.net.ble);
        blePcSw.set(s.net.blePc === true);
        bleWifiSw.set(s.net.bleWifiOff !== false);
        bleWifiRow.setHint(s.net.bleWifiOff === false ? t('general.bluetooth_stays_on_beside_the', null, 'Bluetooth stays on beside the Wi-Fi, the way back if it drops')
          : s.net.bleOff ? t('general.off_now_the_session_is', null, 'Off now: the session is on the same Wi-Fi. Bluetooth comes back when it ends')
            : t('general.on_the_same_wifi_network_not', null, 'On the same Wi-Fi network (not Wi-Fi Direct), Bluetooth goes off until the session ends. With a computer, phones can’t find this one meanwhile'));
        const RADIO = { off: t('general.bluetooth_is_off', null, 'Bluetooth is off'), unauthorized: t('general.allow_duodesk_in_system_settings', null, 'Allow DuoDesk in System Settings › Privacy & Security › Bluetooth'), unsupported: t('general.this_mac_cant_advertise_over', null, 'This Mac can’t advertise over Bluetooth') };
        bleRow.setHint(!s.net.ble ? t('general.only_phones_on_this_network', null, 'Only phones on this network or a USB cable connect')
          : RADIO[s.net.radio] || t('general.phones_nearby_connect_over_bluetooth', null, 'Phones nearby connect over Bluetooth. Files and screens move to a direct Wi-Fi link for a while'));
        blePcRow.setHint(s.net.blePc !== true ? t('general.only_computers_on_this_network', null, 'Only computers on this network connect')
          : RADIO[s.net.radio] || t('general.pcs_nearby_connect_over_bluetooth', null, 'PCs nearby connect over Bluetooth. Files and screens move to a direct Wi-Fi link for a while'));
      }
      helperVal.textContent = s.helper && s.helper.running ? t('general.running', null, 'Running') : t('general.not_running', null, 'Not running');
      deviceName.textContent = s.macName || '';
    };
  },
});
