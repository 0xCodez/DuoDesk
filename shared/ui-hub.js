// TwinDesk — Copyright (C) 2026 inukaasith. GPL-3.0, see LICENSE.
// What the Calls, Messages, Photos and Files pages share, on the Mac, PC and Linux alike (they use only
// the UI kit's common API): the line at the top of each saying what's missing — the phone, its
// permission (Allow asks on the phone, only now), the right TwinDesk on it — and the phone's
// answers (phonehub.js passes them on as 'hub' messages) by type.
'use strict';

(() => {
  const handlers = new Map(); // type -> [fn]
  let listening = false;
  const tr = (k, p, d) => (typeof t === 'function' ? t(k, p, d) : (d || k));

  // fn(msg) for each answer of this type from the phone.
  UI.hubOn = (t, fn) => {
    if (!handlers.has(t)) handlers.set(t, []);
    handlers.get(t).push(fn);
    if (listening || !UI.api.onHub) return;
    listening = true;
    UI.api.onHub((m) => {
      for (const f of handlers.get(m && m.t) || []) {
        try { f(m); } catch (e) { console.error(`hub ${m.t}:`, e); }
      }
    });
  };

  // Ask the phone (only while that page's switch is on: phonehub.js checks).
  UI.hubAsk = (msg) => UI.api.hub({ do: 'send', msg });

  // The folder saved files go to here, by its name: General › Received files on Windows and Linux
  // (files.received, the one in use), Files › Save to on the Mac (files.folder, '' = Downloads).
  UI.receivedName = (s) => {
    const f = (s && s.files) || {};
    const dir = f.received || f.folder || '';
    return dir ? dir.split(/[\\/]/).filter(Boolean).pop() || dir : tr('general.downloads', null, 'Downloads');
  };

  // That page can show the phone's things now.
  UI.hubReady = (s, what) => {
    const h = s && s.hub;
    return !!(h && h[what] && h.connected && h.perm && h.perm[what] && ['ok', 'partial'].includes(h.perm[what].perm));
  };

  // The session runs through Bluetooth (Mac: s.client; PC and Linux: s.net). USB, Wi-Fi and Wi-Fi
  // Direct aren't: Photos and Phone Files work on those, and load nothing over Bluetooth.
  // Wireless debugging reaches the phone over Wi-Fi only: over Bluetooth its card is greyed out and
  // says so (the Phone page, the Overview). True while it is.
  UI.adbBle = (s, card, row, pill) => {
    const ble = UI.onBle(s);
    card.classList.toggle('wifi-only', ble);
    if (!ble) return false;
    pill.className = 'pill muted';
    pill.textContent = tr('hub.wifi_only', null, 'Wi-Fi only');
    row.setHint(tr('hub.adb_ble_hint', null, 'Only available over Wi-Fi: you’re connected over Bluetooth. Connect with Wi-Fi Direct, or join the same Wi-Fi network.'));
    return true;
  };
  UI.onBle = (s) => !!(s && ((s.client && s.client.transport === 'ble') || (s.net && s.net.transport === 'ble')));
  // How the session runs, for the status lines: Bluetooth; a Wi-Fi Direct link (or a phone's
  // hotspot) made for a file or a screen, which goes again by itself ("Temporary"), or asked for
  // with Connect with Wi-Fi Direct on either side; else the same network.
  UI.via = (s) => {
    if (UI.onBle(s)) return tr('connections.bt', null, 'Bluetooth');
    const n = (s && s.net) || {};
    if (!['hosting', 'joined'].includes(n.state) || n.onGroup === false) return tr('connections.wifi', null, 'Wi-Fi'); // a group up beside a session on the real network is still Wi-Fi
    const name = n.kind === 'hotspot' ? tr('hub.hotspot', null, 'Hotspot') : tr('hub.wifi_direct', null, 'Wi-Fi Direct');
    const asked = ['user', 'hotspot'].some((w) => (n.why || []).includes(w) || (n.peerWhy || []).includes(w));
    return asked ? name : tr('hub.temp_prefix', { name }, 'Temporary ' + name);
  };

  UI.phoneName = (s) => (s && s.hub && s.hub.name) || tr('hub.your_phone', null, 'your phone');
  // How a connected phone's sound gets here (phone-bridge.js _sound), for the Audio page; null: no phone.
  UI.phoneSound = (s) => {
    const b = s && s.phone && s.phone.connected && s.phone.bridge;
    if (!b) return null;
    const ph = s.phone.connected.name;
    const n = b.sound || {};
    if (n.on) return tr('hub.sound_playing', { phone: ph }, `Playing. ${ph} captures it, so it plays there too (wireless debugging moves it off the phone)`);
    if (n.error) return n.error;
    if (n.waiting) return tr('hub.sound_tap_start', { phone: ph }, `Tap Start on ${ph} (its notification, or Sound in DuoDesk there)`);
    if (n.net) return tr('hub.sound_asking', { phone: ph }, `Asking ${ph}…`);
    if (b.state === 'ready') return tr('hub.sound_through_adb', null, 'Through wireless debugging');
    return tr('hub.sound_over_wifi', { phone: ph }, `Over Wi-Fi: through wireless debugging, or captured by ${ph}`);
  };

  // The selected device changed (the sidebar's device list): a page that loaded data of the previous
  // device drops it and loads the new one's (fn runs after UI.state is the new device's).
  UI.onDeviceChange = (fn) => window.addEventListener('twindesk-device', fn);

  // page shown / hidden (the shells toggle `hidden`).
  UI.onShown = (page, fn) => {
    new MutationObserver(() => fn(!page.hidden)).observe(page, { attributes: true, attributeFilter: ['hidden'] });
  };

  const NEEDS = {
    calls: ['state', 'numbers', 'dial', 'answer', 'contacts'],
    messages: ['read', 'send', 'contacts'],
  };
  const getNeeds = (what, key) => {
    const dict = {
      calls: {
        state: tr('hub.need_calls_state', null, 'its calls'),
        numbers: tr('hub.need_calls_numbers', null, 'who is calling and the call history'),
        dial: tr('hub.need_calls_dial', null, 'making calls'),
        answer: tr('hub.need_calls_answer', null, 'answering and ending calls'),
        contacts: tr('hub.need_contacts', null, 'contact names'),
      },
      messages: {
        read: tr('hub.need_msg_read', null, 'reading texts'),
        send: tr('hub.need_msg_send', null, 'sending texts'),
        contacts: tr('hub.need_contacts', null, 'contact names'),
      },
    };
    return (dict[what] && dict[what][key]) || key;
  };
  const getLabel = (what) => {
    const dict = {
      calls: tr('nav.calls', null, 'Calls'),
      messages: tr('nav.messages', null, 'Messages'),
      media: tr('hub.photos_and_videos', null, 'Photos and videos'),
      files: tr('hub.files', null, 'Files'),
    };
    return dict[what] || what;
  };

  // The top of a page: { el, render(s) }.
  UI.hubTop = (what) => {
    const { el, api } = UI;
    const text = el('div', { class: 'hub-top-text' });
    const asked = el('div', { class: 'hint' });
    const allow = UI.button(tr('hub.allow_on_phone', null, 'Allow on the phone'), () => {
      api.hub({ do: 'ask', what });
      allow.dataset.at = String(Date.now());
    }, 'primary');
    const install = UI.button(tr('hub.install', null, 'Install'), () => UI.api.phoneInstallFull && UI.api.phoneInstallFull());
    const box = el('div', { class: 'note hub-top' }, [el('div', { class: 'hub-top-body' }, [text, asked]), el('div', { class: 'hub-top-actions' }, [install, allow])]);
    box.hidden = true;
    const render = (s) => {
      const h = s.hub || {};
      const phone = UI.phoneName(s);
      const st = h.perm && h.perm[what];
      const lbl = getLabel(what);
      let msg = '', kind = 'info', canAllow = false, canInstall = false;
      if (!h[what]) msg = tr('hub.off_msg', { phone }, `Off. When you switch it on, ${phone} asks for what it needs.`);
      else if (!h.connected) msg = tr('hub.connect_msg', { phone, label: lbl }, `Connect ${phone} to use ${lbl}: click it at the top of the sidebar.`);
      else if (!h.supported) msg = tr('hub.waiting_msg', { phone, label: lbl }, `Waiting for ${phone}… DuoDesk on it needs to be up to date for ${lbl}.`);
      else if (st.perm === 'none' && what === 'files') { msg = tr('hub.files_need_a11', { phone }, `Files needs Android 11 or later on ${phone}. Mount works through ADB instead.`); kind = 'warn'; }
      else if (st.perm === 'none') {
        const adbPart = s.phone && s.phone.adb && s.phone.adb.address
          ? tr('hub.install_puts_adb', null, 'Install puts it on the phone through wireless debugging; your settings stay.')
          : tr('hub.setup_adb_phone', null, 'Set up wireless debugging on the Phone page, then Install.');
        msg = tr('hub.need_notifs_apk', { label: lbl, phone, adb: adbPart }, `${lbl} need DuoDesk with notifications on ${phone} (Android doesn’t let downloaded apps read texts). ${adbPart}`);
        kind = 'warn';
        canInstall = !!UI.api.phoneInstallFull;
      } else if (st.perm === 'ask') {
        msg = what === 'media' ? tr('hub.allow_media', { phone }, `Allow ${phone} to share its photos and videos with DuoDesk.`)
          : what === 'files' ? tr('hub.allow_files', { phone }, `Allow All files access for DuoDesk on ${phone}: it reads and writes the phone’s storage itself, no ADB. Android opens the setting there.`)
            : tr('hub.allow_general', { label: lbl, phone, needs: (NEEDS[what] || []).map((k) => getNeeds(what, k)).join(', ') }, `Allow ${lbl} on ${phone}: DuoDesk asks for ${(NEEDS[what] || []).map((k) => getNeeds(what, k)).join(', ')}.`);
        kind = 'warn';
        canAllow = true;
      } else if (st.perm === 'partial') {
        msg = what === 'media' ? tr('hub.partial_media', { phone }, `Only the photos you chose on ${phone} show here.`)
          : tr('hub.partial_general', { label: lbl, phone, missing: (st.missing || []).map((m) => getNeeds(what, m)).filter(Boolean).join(', ') }, `Some of ${lbl} needs more on ${phone}: ${(st.missing || []).map((m) => getNeeds(what, m)).filter(Boolean).join(', ')}.`);
        canAllow = true;
      }
      box.hidden = !msg;
      box.className = `note hub-top ${kind}`;
      text.textContent = msg;
      allow.hidden = !canAllow;
      install.hidden = !canInstall;
      const recently = Number(allow.dataset.at || 0) > Date.now() - 60000;
      asked.textContent = canAllow && recently ? (h.perm && h.perm.opens ? tr('hub.check_phone_android', { phone }, `Check ${phone}: Android asks there.`) : tr('hub.tap_notif_phone', { phone }, `Tap the notification on ${phone}.`)) : '';
      asked.hidden = !asked.textContent;
    };
    return { el: box, render };
  };

  // Over Bluetooth, a page that needs Wi-Fi (the shells' wifiOnly) is shown as it is, with this on
  // top: only over Wi-Fi Direct (or the same network), and the button that moves the session
  // there (netlink.js; Linux has none: join the same network). { el, render(s, off) }.
  UI.wifiGate = () => {
    const { el, api } = UI;
    const text = el('div', { class: 'hub-top-text' });
    const go = UI.button(tr('hub.connect_wifi_direct', null, 'Connect with Wi-Fi Direct'), () => api.netWifi(true), 'primary');
    const box = el('div', { class: 'note warn hub-top wifi-note' }, [el('div', { class: 'hub-top-body' }, [text]), el('div', { class: 'hub-top-actions' }, [go])]);
    box.hidden = true;
    const render = (s, off) => {
      box.hidden = !off;
      if (!off) return;
      const n = s.net || {};
      const moving = ['asking', 'hosting', 'joining'].includes(n.state);
      const can = !!api.netWifi;
      text.textContent = moving ? tr('hub.wifi_gate_moving', null, 'Only available over Wi-Fi Direct. Connecting…')
        : n.state === 'failed' ? tr('hub.wifi_gate_failed', { error: n.error || tr('hub.wifi_direct_failed', null, 'Wi-Fi Direct didn’t come up') }, `Only available over Wi-Fi Direct. ${n.error || 'Wi-Fi Direct didn’t come up'}.`)
          : can
            ? tr('hub.wifi_gate_ble_can', null, 'Only available over Wi-Fi Direct: you’re connected over Bluetooth. Or join the same Wi-Fi network.')
            : tr('hub.wifi_gate_ble_cannot', null, 'Only available over Wi-Fi Direct or the same Wi-Fi network: you’re connected over Bluetooth.');
      go.hidden = !can;
      go.disabled = moving;
      go.textContent = moving ? tr('hub.connecting_dots', null, 'Connecting…') : n.state === 'failed' ? tr('hub.try_again', null, 'Try again') : tr('hub.connect_wifi_direct', null, 'Connect with Wi-Fi Direct');
    };
    return { el: box, render };
  };

  UI.initial = (name) => {
    const t = String(name || '').trim();
    return /^[+\d]/.test(t) || !t ? '#' : t.charAt(0).toUpperCase();
  };

  UI.avatar = (name, photo) => {
    const a = UI.el('span', { class: 'hub-avatar', text: photo ? '' : UI.initial(name) });
    if (photo) a.style.backgroundImage = `url("${photo}")`;
    return a;
  };

  UI.clock = (ts) => {
    const d = new Date(ts);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    if (now - d < 6 * 86400000) return d.toLocaleDateString([], { weekday: 'short' });
    return d.toLocaleDateString([], { day: 'numeric', month: 'short', year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric' });
  };

  UI.duration = (s) => {
    s = Math.max(0, Math.round(s));
    return s >= 3600 ? `${Math.floor(s / 3600)}:${String(Math.floor(s / 60) % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}` : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  };
})();
