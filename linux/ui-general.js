// TwinDesk — Copyright (C) 2026 inukaasith. GPL-3.0, see LICENSE.
// General tab (same cards as the PC's): open at login, the switching popup, firewall self-check
// (+ Fix), wake from the network, the desktop session and input access (Wayland), the
// helper, Bluetooth for devices not on this network, this computer and Quit (some desktops have
// no tray to quit from).
'use strict';

UI.tab({
  id: 'general',
  order: 100,
  title: 'General',
  color: 'linear-gradient(#aeaeb2, #636366)',
  desc: '',
  bottom: true,
  badge: (s) => ((s.firewall && s.firewall.ok === false && !s.firewall.checking) || s.setup.missing.includes('input') ? 'warn' : ''),
  build(body) {
    const { el, api } = UI;
    const t = (k, p, d) => (typeof window.t === 'function' ? window.t(k, p, d) : d !== undefined ? d : k);
    const startup = UI.switch((v) => api.setStartup(v), { label: t('general.open_at_login', null, 'Open at login') });
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
    const wakeSw = UI.switch((v) => api.setWake(v), { label: t('general.wake_from_the_network', null, 'Wake from the network') });
    const wakeRow = UI.row(t('general.let_the_other_computer_wake', null, 'Let the other computer wake {me}'), '', [wakeSw]);
    const sessPill = el('span', { class: 'pill' });
    const sessRow = UI.row(t('general.desktop_session', null, 'Desktop session'), '', [sessPill]);
    const inPill = el('span', { class: 'pill' });
    const inFix = UI.button(t('general.fix', null, 'Fix'), () => api.fixInput(), 'small primary');
    const inRow = UI.row(t('general.input_access', null, 'Input access'), '', [inPill, inFix]);
    const helperPill = el('span', { class: 'pill' });
    const helperRow = UI.row(t('general.mouse_and_keyboard_helper', null, 'Mouse and keyboard helper'), '', [helperPill]);
    const deviceName = el('span', { class: 'value' });
    const deviceRow = UI.row(t('general.computer_name', null, 'Computer name'), t('general.how_other_computers_see_this', null, 'How other computers see this one'), [deviceName]);
    // Bluetooth when not on the same network: with phones (on unless switched off), with computers (off unless switched on).
    const bleSw = UI.switch((v) => api.setNet({ ble: v }), { label: t('overview.ble_phones', null, 'Bluetooth with phones') });
    const bleRow = UI.row(t('overview.ble_phones', null, 'Bluetooth with phones'), '', [bleSw]);
    const blePcSw = UI.switch((v) => api.setNet({ blePc: v }), { label: t('overview.ble_computers', null, 'Bluetooth with computers') });
    const blePcRow = UI.row(t('overview.ble_computers', null, 'Bluetooth with computers'), '', [blePcSw]);
    // Bluetooth off altogether while the session is on the same Wi-Fi (blepolicy.js wifiQuiet).
    const bleWifiSw = UI.switch((v) => api.setNet({ bleWifiOff: v }), { label: t('general.turn_off_bluetooth_on_wifi', null, 'Turn off Bluetooth on Wi-Fi connections') });
    const bleWifiRow = UI.row(t('general.turn_off_bluetooth_on_wifi', null, 'Turn off Bluetooth on Wi-Fi connections'), '', [bleWifiSw]);
    // Hosting Wi-Fi Direct beside this computer's own Wi-Fi network (wifi.js: a second interface, set up as root once).
    const keepSw = UI.switch((v) => api.setNet({ keepWifi: v }), { label: t('general.keep_wifi_while_hosting_wifi', null, 'Keep Wi-Fi while hosting Wi-Fi Direct') });
    const keepSetup = UI.button(t('general.set_up', null, 'Set up'), () => api.wifiSetup(), 'small');
    const keepRow = UI.row(t('general.keep_wifi_while_hosting_wifi', null, 'Keep Wi-Fi while hosting Wi-Fi Direct'), '', [keepSetup, keepSw]);
    // The same setup also keeps Bluetooth links this computer opens up through a second of silence (wifi.js bleTimeout).
    const steadySetup = UI.button(t('general.set_up', null, 'Set up'), () => api.wifiSetup(), 'small');
    const steadyRow = UI.row(t('general.steadier_bluetooth_links', null, 'Steadier Bluetooth links'), '', [steadySetup]);
    const btPill = el('span', { class: 'pill' });
    const btRow = UI.row('Bluetooth', t('general.for_a_phone_or_computer', null, 'For a phone or computer that isn’t on this network'), [btPill, UI.button(t('files.open', null, 'Open'), () => api.openBluetoothSettings(), 'small')]);

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
      partSw[k] = UI.switch((v) => api.setOverview && api.setOverview({ [k]: v }), { label });
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
        UI.row(t('general.open_at_login', null, 'Open at login'), t('general.starts_in_the_tray', null, 'Starts in the tray'), [startup]),
        recvRow,
      ]),
      UI.card(t('general.appearance', null, 'Appearance'), [
        UI.row(t('general.show_a_popup_when_switching', null, 'Show a popup when switching'), t('general.when_the_mouse_and_keyboard', null, 'When the mouse and keyboard move between devices'), [hudSw]),
        wallRow,
        media.el,
      ]),
      UI.card(t('nav.overview', null, 'Overview'), partRows),
      UI.card(t('general.network_and_bluetooth', null, 'Network and Bluetooth'), [bleRow, blePcRow, bleWifiRow, wakeRow, keepRow]),
      UI.card(t('general.permissions', null, 'Permissions'), [fwRow, btRow, steadyRow]),
      UI.card(t('general.this_computer', null, 'This computer'), [deviceRow, sessRow, inRow, helperRow]),
      UI.card(t('general.quit', null, 'Quit'), [
        UI.row(t('general.quit_duodesk', null, 'Quit DuoDesk'), t('general.stops_sharing_until_you_open', null, 'Stops sharing until you open it again'), [UI.button(t('general.quit', null, 'Quit'), () => api.quit(), 'small')]),
      ], { cls: 'keep-on' }),
    );

    // A choice made before the main process kept the language (settings.app.lang) is handed over once.
    let handedOver = false;
    return (s) => {
      if (!handedOver && s.app && s.app.lang === 'auto' && curLang !== 'auto') { handedOver = true; api.setApp({ lang: curLang }); }
      media.update(s);
      wallSw.set(!s.phone || !s.phone.settings || s.phone.settings.wallpaper !== false);
      const ov = (s.ui && s.ui.overview) || {};
      for (const k of Object.keys(partSw)) partSw[k].set(ov[k] !== false);
      startup.set(s.startup);
      hudSw.set(s.app.hud);
      const f = s.files || {};
      recvReset.hidden = !f.receivedFolder;
      recvRow.setHint(f.receivedFolder && f.received !== f.receivedFolder
        ? t('general.folder_isnt_there_now_downloads', { folder: f.receivedFolder }, f.receivedFolder + ' isn’t there now: Downloads meanwhile. Files sent to {me} from another computer or a phone, and what’s saved from a phone’s Files and Photos')
        : t('general.folder_files_sent_to_me', { folder: f.received || t('general.downloads', null, 'Downloads') }, (f.received || 'Downloads') + ' · Files sent to {me} from another computer or a phone, and what’s saved from a phone’s Files and Photos'));
      const fw = s.firewall || {};
      fwPill.textContent = fw.checking ? t('general.checking', null, 'Checking…') : fw.ok ? t('general.ok', null, 'OK') : fw.ok === false ? t('general.needs_a_fix', null, 'Needs a fix') : '';
      fwPill.className = 'pill ' + (fw.checking ? 'muted' : fw.ok ? 'good' : 'bad');
      fwRow.setHint(fw.checking ? '' : fw.message || '');
      fwCheck.disabled = !!fw.checking;
      fwFix.hidden = fw.checking || fw.ok !== false;
      const w = s.wake || {};
      wakeSw.set(w.on === true);
      wakeSw.disable(!w.checked || w.on == null || !!w.busy);
      wakeRow.setHint(w.error ? w.error : w.busy ? t('general.changing', null, 'Changing…') : !w.checked ? t('general.checking', null, 'Checking…')
        : w.on == null ? t('general.no_wired_network_adapter_here', null, 'No wired network adapter here can wake {me}')
          : t('general.its_wired_network_adapter_wakes', null, 'Its wired network adapter wakes {me} on a magic packet. Asks for your password to change it'));

      const ss = s.session || {};
      const x11 = ss.type === 'x11';
      const wl = ss.type === 'wayland';
      sessPill.textContent = x11 ? 'X11' : wl ? 'Wayland' : t('general.unknown', null, 'Unknown');
      sessPill.className = 'pill ' + (x11 || wl ? 'good' : 'muted');
      sessRow.setHint([ss.desktop, ss.wsl ? 'WSL' : '', ss.input ? t('general.input_through_method', { method: ss.input === 'uinput' ? 'uinput (Wayland)' : 'XInput2 and XTest' }, 'input through ' + (ss.input === 'uinput' ? 'uinput (Wayland)' : 'XInput2 and XTest')) : ''].filter(Boolean).join(' · '));
      inRow.hidden = !wl;
      const a = ss.access || {};
      const ok = a.uinput && a.read;
      inPill.textContent = ok ? t('general.ok', null, 'OK') : a.uinput ? t('general.partly', null, 'Partly') : t('general.needs_a_fix', null, 'Needs a fix');
      inPill.className = 'pill ' + (ok ? 'good' : 'bad');
      inFix.hidden = ok;
      inRow.setHint(ss.inputNote || (ok ? t('general.reads_the_mouse_and_keyboard', null, 'Reads the mouse and keyboard for crossing; injects through uinput')
        : a.uinput ? t('general.can_be_controlled_but_cant', null, 'Can be controlled, but can’t read the mouse and keyboard to cross over (log out and back in after Fix)')
          : t('general.needed_to_share_the_mouse', null, 'Needed to share the mouse and keyboard on Wayland. Asks for your password once')));
      const h = s.kvmState.helper;
      helperPill.textContent = h ? (h === 'starting' ? t('general.starting', null, 'Starting…') : t('general.not_running', null, 'Not running')) : t('general.running', null, 'Running');
      helperPill.className = 'pill ' + (h ? (h === 'starting' ? 'muted' : 'bad') : 'good');
      helperRow.setHint(h && h !== 'starting' ? h : '');
      const n = s.net || {};
      const radio = h && h !== 'starting' ? t('general.needs_the_helper_running', null, 'Needs the helper running')
        : n.radio === 'off' ? t('general.bluetooth_is_off_in_this', null, 'Bluetooth is off in this computer’s settings')
          : n.radio === 'unsupported' ? t('general.this_computers_bluetooth_cant_do', null, 'This computer’s Bluetooth can’t do it (needs Bluetooth LE and BlueZ)') : '';
      bleSw.set(n.ble !== false);
      bleRow.setHint(n.ble === false ? t('general.only_phones_on_this_network', null, 'Only phones on this network or a USB cable connect')
        : radio || t('general.a_phone_nearby_connects_through_linux', null, 'A phone nearby connects through Bluetooth; files and screens switch to Wi-Fi for a moment'));
      blePcSw.set(n.blePc === true);
      bleWifiSw.set(n.bleWifiOff !== false);
      bleWifiRow.setHint(n.bleWifiOff === false ? t('general.bluetooth_stays_on_beside_the', null, 'Bluetooth stays on beside the Wi-Fi, the way back if it drops')
        : n.bleOff ? t('general.off_now_the_session_is', null, 'Off now: the session is on the same Wi-Fi. Bluetooth comes back when it ends')
          : t('general.on_the_same_wifi_network_not', null, 'On the same Wi-Fi network (not Wi-Fi Direct), Bluetooth goes off until the session ends. With a computer, phones can’t find this one meanwhile'));
      blePcRow.setHint(n.blePc !== true ? t('general.only_computers_on_this_network', null, 'Only computers on this network connect')
        : radio || t('general.a_computer_nearby_connects_through_linux', null, 'A computer nearby connects through Bluetooth; files and screens switch to Wi-Fi for a moment'));
      const sd = n.side || {};
      steadyRow.hidden = !!sd.current || (n.ble === false && n.blePc !== true) || n.radio === 'unsupported';
      steadySetup.disabled = sd.setup === 'asking';
      steadyRow.setHint(sd.setup === 'asking' ? t('general.waiting_for_your_password', null, 'Waiting for your password…')
        : sd.setup && sd.setup !== 'declined' ? t('general.setup_didnt_work', { error: sd.setup }, `Setup didn’t work: ${sd.setup}`)
          : t('general.a_phone_or_mac_busy_with', null, 'A phone or Mac busy with Wi-Fi for a moment stays connected (5 s before a Bluetooth link counts as lost, not 0.4 s). Asks for your password once'));
      keepRow.hidden = !sd.possible;
      keepSw.set(sd.keep !== false);
      keepSetup.hidden = !!sd.ready || sd.keep === false;
      keepSetup.disabled = sd.setup === 'asking';
      keepRow.setHint(sd.keep === false ? t('general.hosting_wifi_direct_takes_this', null, 'Hosting Wi-Fi Direct takes this computer off its Wi-Fi network until it ends')
        : sd.setup === 'asking' ? t('general.waiting_for_your_password', null, 'Waiting for your password…')
          : sd.ready ? t('general.wifi_direct_runs_on_a_second', null, 'Wi-Fi Direct runs on a second interface beside this computer’s Wi-Fi network, which stays connected')
            : sd.setup === 'declined' ? t('general.not_set_up_the_password_prompt', null, 'Not set up: the password prompt was cancelled. Until it is, hosting takes this computer off its Wi-Fi network')
              : sd.setup ? t('general.setup_didnt_work', { error: sd.setup }, `Setup didn’t work: ${sd.setup}`)
                : t('general.this_wifi_adapter_can_host', null, 'This Wi-Fi adapter can host beside its network. Asks for your password once (the first time it’s needed, or Set up)'));
      btPill.textContent = n.radio === 'off' ? t('general.off', null, 'Off') : n.radio === 'unsupported' ? t('general.not_supported', null, 'Not supported') : n.radio === 'idle' ? t('general.idle', null, 'Idle') : n.radio ? t('general.on', null, 'On') : t('general.unknown', null, 'Unknown');
      btPill.className = 'pill ' + (n.radio === 'off' || n.radio === 'unsupported' ? 'bad' : n.radio === 'idle' ? 'muted' : n.radio ? 'good' : 'muted');
      deviceName.textContent = s.device.name;
    };
  },
});
