// TwinDesk — Copyright (C) 2026 inukaasith, Erdoğan Yeşil. GPL-3.0, see LICENSE.
// Phone page (opened from the phone tile above Overview): the connected phone, its screen in a
// window, its apps in windows of their own, wireless debugging setup, and Disconnect. Copy of
// windows/ui-phone.js.
'use strict';

UI.tab({
  id: 'phone',
  order: -1,
  navHidden: true, // the phone tile in the sidebar opens it
  title: 'Phone',
  heading: 'Phone',
  desc: '',
  color: 'linear-gradient(#34c759, #248a3d)',
  build(body, page) {
    const { el, api } = UI;
    const tr = (k, p, d) => (typeof window.t === 'function' ? window.t(k, p, d) : d !== undefined ? d : k); // local: classic scripts share one global scope
    const h1 = page.querySelector('h1 span');
    const desc = page.querySelector('.page-head p');

    // ---- hero ----
    const dev = el('div', { class: 'device phone big' });
    const name = el('div', { class: 'hero-name' });
    const sub = el('div', { class: 'hero-status' });
    const showBtn = UI.button(tr('mirror.show_screen_btn', null, 'Show Phone Screen'), () => api.phoneScreen(true), 'primary');
    const discBtn = UI.button(tr('device.disconnect', null, 'Disconnect'), () => api.disconnectPhone());
    // On Bluetooth: onto a direct Wi-Fi link on request, until Back to Bluetooth (netlink.js 'user').
    let wifiOn = false;
    const wifiBtn = UI.button(tr('mesh_overview.connect_wifi_direct', null, 'Connect with Wi-Fi Direct'), () => api.netWifi(!wifiOn));
    const hotspotBtn = UI.button(tr('mesh_overview.connect_hotspot', null, 'Connect with hotspot'), () => { api.netWifi('hotspot'); UI.go('connection'); }); // its name and password there
    // How the mouse and keyboard reach the phone (settings.phone.input; the phone's own toggle too).
    const via = UI.segmented([
      { value: 'adb', label: 'ADB', title: tr('phone.wireless_debugging_full_control', null, 'Wireless debugging: full control') },
      { value: 'phone', label: tr('phone.accessibility', null, 'Accessibility'), title: tr('phone.accessibility_tooltip', null, 'DuoDesk on the phone taps and types itself, over Wi-Fi, Wi-Fi Direct or Bluetooth. No developer options') },
    ], (v) => api.setPhone({ input: v, inputPicked: true })); // picked: no longer automatic
    // What plays on the phone, on the card's right, while it plays (shared/ui-nowplaying.js).
    const media = UI.nowPlaying();
    const hero = el('div', { class: 'card hero phone-hero' }, [
      dev,
      el('div', { class: 'phone-hero-text' }, [
        name, sub,
        el('div', { class: 'phone-hero-actions' }, [showBtn, wifiBtn, hotspotBtn, discBtn]),
      ]),
      media.el,
    ]);

    // ---- wireless debugging ----
    const adbRow = UI.row(tr('phone.wireless_debugging', null, 'Wireless debugging'), '', []);
    const adbPill = el('span', { class: 'pill muted' });
    adbRow.querySelector('.controls').append(adbPill, UI.button(tr('phone.try_again', null, 'Try Again'), () => api.phoneRetry(), 'small'));
    const code = el('input', { type: 'text', placeholder: '123456', maxLength: 6, inputMode: 'numeric', autocomplete: 'off', spellcheck: false, attrs: { 'aria-label': tr('phone.pairing_code', null, 'Pairing code') } });
    const where = el('input', { type: 'text', placeholder: tr('phone.address_port_optional', null, 'Address:port (optional)'), autocomplete: 'off', spellcheck: false, attrs: { 'aria-label': tr('phone.pairing_address', null, 'Pairing address') } });
    const pairBtn = UI.button(tr('adb.pair_btn', null, 'Pair'), () => api.phonePair({ code: code.value, where: where.value }), 'small primary');
    code.onkeydown = where.onkeydown = (e) => { if (e.key === 'Enter') pairBtn.click(); };
    const pairRow = UI.row(tr('phone.pairing_code', null, 'Pairing code'), tr('phone.or_type_it_on_the', null, 'Or type it on the phone, in DuoDesk’s notification'), [code, where, pairBtn]);
    const steps = UI.note('info', '');
    // Wireless debugging off: one line, the steps behind Show me how.
    let howOpen = false;
    const howBtn = UI.button(tr('phone.show_me_how', null, 'Show me how'), () => { howOpen = !howOpen; render(UI.state); }, 'small');
    adbRow.querySelector('.controls').prepend(howBtn);
    const how = el('ol', { class: 'how-steps' }, [
      tr('phone.on_the_phone_settings_about', null, 'On the phone: Settings › About phone › Software information › tap Build number 7 times. Developer options appear.'),
      tr('phone.settings_developer_options_turn_on', null, 'Settings › Developer options: turn on USB debugging.'),
      tr('phone.on_the_same_page_turn', null, 'On the same page, turn on Wireless debugging. The phone has to be on a Wi-Fi network (a direct Wi-Fi link alone isn’t enough).'),
      tr('phone.tap_wireless_debugging_pair_device', null, 'Tap Wireless debugging › Pair device with pairing code, and type the code here, or in DuoDesk’s notification on the phone.'),
      tr('phone.thats_all_after_pairing_once', null, 'That’s all: after pairing once, DuoDesk turns wireless debugging on by itself.'),
    ].map((step) => el('li', { text: step })));
    // The phone runs the standard build (no notification access): install the full one over it.
    const fullBtn = UI.button(tr('phone.install', null, 'Install'), () => api.phoneInstallFull(), 'small primary');
    const fullRow = UI.row(tr('phone.notifications_from_the_phone', null, 'Notifications from the phone'), '', [fullBtn]);
    const adbCard = UI.card(tr('phone.screen_mouse_keyboard', null, 'Screen, mouse and keyboard'), [adbRow, how, pairRow, steps, fullRow]);

    // ---- apps ----
    const search = el('input', { type: 'search', placeholder: tr('phone.search_apps', null, 'Search apps'), autocomplete: 'off', spellcheck: false, attrs: { 'aria-label': tr('phone.search_apps', null, 'Search apps') } });
    const grid = el('div', { class: 'app-grid' });
    const appsNote = UI.note('info', '');
    search.oninput = () => { appsKey = ''; render(UI.state); };
    const appsCard = UI.card(tr('nav.apps', null, 'Apps'), [el('div', { class: 'row' }, [search]), appsNote, grid]);

    // ---- open windows ----
    const winList = el('div');
    const winCard = UI.card(tr('phone.open_on_this_computer', null, 'Open on this computer'), [winList]);

    // ---- settings ----
    const sound = UI.switch((v) => api.setPhone({ sound: v }), { label: tr('phone.phone_sound', null, 'Phone sound') });
    const quality = UI.select([
      { value: '4', label: tr('phone.data_saver_4_mb_s', null, 'Data saver (4 Mb/s)') }, { value: '8', label: tr('phone.balanced_8_mb_s', null, 'Balanced (8 Mb/s)') },
      { value: '16', label: tr('phone.sharp_16_mb_s', null, 'Sharp (16 Mb/s)') }, { value: '24', label: tr('phone.sharpest_24_mb_s', null, 'Sharpest (24 Mb/s)') },
    ], (v) => api.setPhone({ bitrateMbps: Number(v) }));
    const wall = UI.switch((v) => api.setPhone({ wallpaper: v }), { label: tr('phone.wallpaper', null, 'Wallpaper') });
    const optsCard = UI.card(tr('phone.settings', null, 'Settings'), [
      UI.row(tr('phone.phone_sound_in_the_screen', null, 'Phone sound in the screen window'), tr('phone.android_11_or_later', null, 'Android 11 or later'), [sound]),
      UI.row(tr('kit.picture', null, 'Picture'), tr('phone.for_the_screen_window_and', null, 'For the screen window and app windows'), [quality]),
      UI.row(tr('phone.show_the_phones_wallpaper_here', null, 'Show the phone’s wallpaper here'), tr('phone.lets_duodesk_on_the_phone', null, 'Lets DuoDesk on the phone read it (set up over wireless debugging)'), [wall]),
      UI.row(tr('phone.mouse_and_keyboard', null, 'Mouse and keyboard'), tr('phone.push_the_pointer_off_the_edge', null, 'Push the pointer off the edge of the screen to use the phone. Double-tap the hotkey to come back.'), [UI.button(tr('phone.cursor_settings', null, 'Cursor Settings'), () => UI.go('cursor'), 'small')]),
    ]);

    const notConnected = UI.note('info', '');
    // Below the phone's card: how the mouse and keyboard reach it (automatic until one is picked).
    const viaRow = UI.row(tr('phone.mouse_and_keyboard', null, 'Mouse and keyboard'), '', [via.el]);
    const viaCard = UI.card('', [viaRow]);
    body.append(notConnected, hero, viaCard, adbCard, appsCard, winCard, optsCard);

    let appsKey = '';
    let winKey = '';
    const STATES = {
      ready: ['good', tr('phone.ready', null, 'Ready')], connecting: ['muted', tr('adb.connecting', null, 'Connecting…')], needsPair: ['bad', tr('phone.pair_once', null, 'Pair once')],
      waitingWifi: ['bad', tr('adb.off', null, 'Off')], missing: ['bad', tr('phone.missing', null, 'Missing')], error: ['bad', tr('adb.problem', null, 'Problem')], off: ['muted', '—'],
    };

    function render(s) {
      media.update(s);
      const ph = s.phone || {};
      const c = ph.connected;
      const info = ph.info || {};
      const br = ph.bridge || { state: 'off' };
      for (const x of [hero, viaCard, adbCard, appsCard, winCard, optsCard]) x.hidden = !c;
      notConnected.set(c ? '' : ph.nearby && ph.nearby.length ? tr('phone.click_the_phone_above_overview', null, 'Click the phone above Overview to connect it.') : tr('phone.no_phone_connected_open_duodesk', null, 'No phone connected. Open DuoDesk on the phone and pair it from Overview › Nearby.'));
      if (!c) return;

      h1.textContent = c.name;
      desc.textContent = [info.maker && info.model ? `${info.maker} ${info.model}` : info.model, info.release && tr('phone.android_version', { version: info.release }, 'Android {version}')].filter(Boolean).join(' · ');
      name.textContent = c.name;
      sub.textContent = [c.usb ? tr('phone.usb_cable', null, 'USB cable') : '', c.rttMs != null ? `${c.rttMs} ms` : tr('sidebar.connected', null, 'Connected'),
        info.battery != null ? (info.charging ? tr('phone.battery_charging', { battery: info.battery }, 'Battery {battery}%, charging') : tr('phone.battery', { battery: info.battery }, 'Battery {battery}%')) : ''].filter(Boolean).join(' · ');
      if (UI.phoneWall) dev.style.setProperty('--phone-wall', UI.phoneWall);
      else if (info.colors && info.colors.length) dev.style.setProperty('--phone-wall', `linear-gradient(160deg, ${info.colors.join(', ')}${info.colors.length === 1 ? `, ${info.colors[0]}` : ''})`);
      else dev.style.removeProperty('--phone-wall');

      const ready = br.state === 'ready';
      showBtn.disabled = !ready;
      const n = s.net || {};
      wifiOn = (n.why || []).includes('user') || !!n.linked; // made for the screen or files too
      wifiBtn.textContent = wifiOn ? tr('overview.back_to_bluetooth', null, 'Back to Bluetooth') : tr('mesh_overview.connect_wifi_direct', null, 'Connect with Wi-Fi Direct');
      wifiBtn.hidden = !(wifiOn || !!(s.net && s.net.transport === 'ble'));
      hotspotBtn.hidden = wifiOn || n.state === 'hotspot' || !(s.net && s.net.transport === 'ble');
      const off = br.state === 'waitingWifi';
      howBtn.hidden = !off;
      howBtn.textContent = howOpen ? tr('phone.hide', null, 'Hide') : tr('phone.show_me_how', null, 'Show me how');
      how.hidden = !off || !howOpen;
      const [cls, label] = STATES[br.state] || STATES.off;
      adbPill.className = `pill ${ready && br.inputBlocked ? 'bad' : cls}`;
      adbPill.textContent = ready && br.inputBlocked ? tr('phone.touch_blocked', null, 'Touch blocked') : label;
      adbRow.setHint(off ? (/direct Wi-Fi/.test(br.message) ? br.message : tr('phone.wireless_debugging_is_off_on_the', null, 'Wireless debugging is off on the phone. The screen and ADB control need it; Accessibility doesn’t.')) : ready && br.inputBlocked ? tr('phone.the_screen_works_but_xiaomi_refuses', null, 'The screen works, but Xiaomi refuses touch, mouse and keyboard from here. On the phone: Settings › Developer options › USB debugging (Security settings): on (it asks for a Mi account).')
        : ready ? tr('phone.the_phone_s_screen_touch', null, 'The phone’s screen, touch, mouse and keyboard, and its clipboard in the background') : br.message);
      pairRow.hidden = br.state !== 'needsPair' && !br.canPair;
      steps.set(br.state === 'needsPair' ? tr('phone.duodesk_pairs_with_the_phone', null, 'DuoDesk pairs with the phone’s wireless debugging once. After that the phone’s screen, apps, mouse and keyboard work without this step.') : '');
      if (UI.adbBle(s, adbCard, adbRow, adbPill)) { pairRow.hidden = how.hidden = howBtn.hidden = true; steps.set(''); }

      // The standard build can't read notifications (Play Protect blocks downloaded apps that do).
      const full = !ph.adb || ph.adb.full !== false;
      const inst = br.install;
      fullRow.hidden = full && !(inst && inst.state === 'done');
      fullBtn.hidden = full;
      fullBtn.disabled = !ready || !br.fullApk || (inst && inst.state === 'installing');
      const prefix = inst && inst.state === 'failed' ? `${inst.message} ` : '';
      fullRow.setHint(inst && inst.state !== 'failed' && inst.message ? inst.message
        : !br.fullApk ? tr('phone.this_build_of_duodesk_doesnt', null, 'This build of DuoDesk doesn’t carry the Android app.')
          : ready ? tr('phone.downloaded_cant_read_notifications', { prefix }, '{prefix}The DuoDesk you downloaded can’t read the phone’s notifications (Play Protect blocks downloaded apps that can). Install the full app over it: its settings and pairing stay.')
            : tr('phone.downloaded_cant_read_notifications_wifi', { prefix }, '{prefix}The DuoDesk you downloaded can’t read the phone’s notifications (Play Protect blocks downloaded apps that can). Install the full app over it: its settings and pairing stay. Needs wireless debugging.'));

      const settings = ph.settings || {};
      sound.set(!!settings.sound);
      quality.set(String(settings.bitrateMbps || 8));
      wall.set(settings.wallpaper !== false);
      via.set(br.input || (settings.input === 'phone' ? 'phone' : 'adb'));
      viaRow.setHint(br.inputMode === 'auto' ? (br.state === 'ready' ? tr('cursor.auto_adb_ready', null, 'Automatic: ADB, wireless debugging is ready') : tr('phone.automatic_accessibility_until_wireless_debugging', null, 'Automatic: Accessibility until wireless debugging is ready'))
        : br.input === 'phone' ? tr('phone.duodesk_on_the_phone_taps_asks_once', null, 'DuoDesk on the phone taps and types itself. The phone asks once to allow it in Accessibility') : tr('phone.wireless_debugging_full_control', null, 'Wireless debugging: full control'));

      // apps (icons come with UI.phoneAssets)
      const apps = (UI.phoneAssets && UI.phoneAssets.apps) || [];
      const term = search.value.trim().toLowerCase();
      const shown = term ? apps.filter((a) => a.name.toLowerCase().includes(term)) : apps;
      appsNote.set(!ready ? tr('phone.apps_open_in_their_own_windows', null, 'Apps open in their own windows once wireless debugging is set up.') : !apps.length ? tr('phone.loading_the_phones_apps', null, 'Loading the phone’s apps…') : '');
      const ak = JSON.stringify([shown.length, term, ph.assets, ph.activeId, ready]);
      if (ak !== appsKey) {
        appsKey = ak;
        grid.replaceChildren(...shown.slice(0, 400).map((a) => {
          const img = UI.appIcon(a.icon);
          const b = el('button', { class: 'app-tile', title: tr('phone.open_app_in_a_window_linux', { app: a.name }, 'Open {app} in a window'), disabled: !ready }, [img, el('span', { text: a.name })]);
          b.onclick = () => api.phoneOpenApp({ id: a.id, name: a.name });
          return b;
        }));
      }

      const wins = br.windows || [];
      winCard.hidden = !wins.length;
      const wk = JSON.stringify(wins);
      if (wk !== winKey) {
        winKey = wk;
        winList.replaceChildren(...wins.map((w) => UI.row(w.kind === 'screen' ? tr('phone.phone_screen', null, 'Phone screen') : w.title, w.kind === 'screen' ? tr('phone.mirror', null, 'Mirror') : w.app, [UI.button(tr('phone.close', null, 'Close'), () => api.phoneCloseView(w.id), 'small')])));
      }
    }
    return render;
  },
});
