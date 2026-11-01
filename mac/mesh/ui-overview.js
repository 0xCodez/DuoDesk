// TwinDesk — Copyright (C) 2026 inukaasith, Erdoğan Yeşil. GPL-3.0, see LICENSE.
// Overview tab: this Mac's address and Connect by address on top, the
// computers nearby (always visible), the two computers, one switch per feature and direction,
// and everything paired.
'use strict';
(() => { // own scope: every mesh/ui-*.js declares `tr`, and top-level consts of classic scripts collide
var tr = (k, p, d) => (typeof t === 'function' ? t(k, p, d) : (d || k));

UI.tab({
  id: 'connection', // was Overview: the device's own Overview is shared/ui-device.js
  order: 1,
  title: 'Connection',
  heading: 'Connection',
  icon: 'link',
  desc: '',
  color: 'linear-gradient(#5ac8fa, #007aff)',
  badge: (s) => (s.discovery && (!s.discovery.on || !s.discovery.localNetwork) ? '!' : ''),
  build(body) {
    const { el, api } = UI;

    // ---- this Mac + connect by address ----
    const addrVal = el('span', { class: 'value addr' });
    const copyBtn = UI.button(tr('general.copy', null, 'Copy'), () => UI.state && api.copyText(UI.state.addresses[0] || ''), 'small');
    const addrRow = UI.row('{me}', tr('overview.its_address', null, 'Its address'), [addrVal, copyBtn]);
    const ipInput = el('input', { type: 'text', placeholder: '192.168.1.20', autocomplete: 'off', spellcheck: false, attrs: { 'aria-label': tr('overview.address_aria', null, 'Address') } });
    const ipBtn = UI.button(tr('overview.connect', null, 'Connect'), () => api.connectAddress(ipInput.value), 'small primary');
    ipInput.onkeydown = (e) => { if (e.key === 'Enter') ipBtn.click(); };
    const ipRow = UI.row(tr('mesh_overview.connect_by_address', null, 'Connect by address'), '', [ipInput, ipBtn]);

    // ---- nearby ----
    const discRow = UI.row('', '', []);
    const discFix = UI.button(tr('pair.allow', null, 'Allow'), () => api.allowPermission('localNetwork'), 'small');
    discRow.querySelector('.controls').append(discFix);
    const foundList = el('div');
    // General's two Bluetooth switches, here too: who can turn up through Bluetooth.
    const bleSw = UI.switch((v) => api.setNet({ ble: v }), { label: tr('mesh_overview.bt_phones', null, 'Bluetooth with phones') });
    const blePcSw = UI.switch((v) => api.setNet({ blePc: v }), { label: tr('mesh_overview.bt_computers', null, 'Bluetooth with computers') });
    const bleRows = [UI.row(tr('mesh_overview.bt_phones', null, 'Bluetooth with phones'), '', [bleSw]), UI.row(tr('mesh_overview.bt_computers', null, 'Bluetooth with computers'), '', [blePcSw])];
    const refresh = UI.button(tr('general.refresh', null, 'Refresh'), () => { // the list empties and fills again with whoever answers
      api.refreshDiscovery();
      refresh.disabled = true;
      refresh.textContent = tr('mesh_overview.looking', null, 'Looking…');
      setTimeout(() => { refresh.disabled = false; refresh.textContent = tr('general.refresh', null, 'Refresh'); }, 1500);
    }, 'small');

    // ---- hero ----
    const WHERE = { driving: tr('overview.youre_using_name', null, 'You’re using {name}'), driven: tr('overview.name_is_using_me', null, '{name} is using {me}') };
    const linkLine = el('div', { class: 'hero-link' }, [el('span', { class: 'hero-pulse' })]);
    const linkText = el('div', { class: 'hero-link-text' });
    const peerName = el('div', { class: 'hero-name' });
    const macName = el('div', { class: 'hero-name' });
    const peerDev = el('div', { class: 'device pc' });
    const status = el('div', { class: 'hero-status' });
    // The session: Disconnect it (a phone or a computer); Connect again to the Mac we're a guest of
    // after one, or Take over while another device has it.
    const discBtn = UI.button(tr('mesh_overview.disconnect', null, 'Disconnect'), () => api.disconnect(), 'small');
    const againBtn = UI.button(tr('mesh_overview.connect', null, 'Connect'), () => api.connectAgain(), 'small primary');
    const sessionBtns = el('div', { class: 'hero-actions' }, [againBtn, discBtn]);
    // A session on Bluetooth: onto a direct Wi-Fi link on request, until Back to Bluetooth.
    const wifiBtn = UI.button(tr('mesh_overview.connect_wifi_direct', null, 'Connect with Wi-Fi Direct'), () => api.netWifi(!wifiOn), 'small');
    let wifiOn = false;
    wifiBtn.hidden = true;
    const hotspotBtn = UI.button(tr('mesh_overview.connect_hotspot', null, 'Connect with hotspot'), () => api.netWifi('hotspot'), 'small'); // a phone's, this Mac joins
    hotspotBtn.hidden = true;
    const hero = el('div', { class: 'card hero' }, [
      el('div', { class: 'hero-devices' }, [
        el('div', { class: 'hero-device' }, [el('div', { class: 'device mac' }), macName]),
        el('div', { class: 'hero-mid' }, [linkLine, linkText]),
        el('div', { class: 'hero-device' }, [peerDev, peerName]),
      ]),
      status,
      sessionBtns,
      el('div', { class: 'hero-actions' }, [wifiBtn, hotspotBtn]),
    ]);

    // ---- feature switches ----
    const sw = (label, tab, get, set, { phone = true } = {}) => {
      const c = UI.switch(set, { label });
      const row = UI.row(label, '', [c, el('span', { class: 'chev', text: '›' })], { onClick: () => UI.go(tab) });
      return { c, row, get, phone }; // phone: false = hidden while a phone is the peer
    };
    const notPhone = { phone: false };
    const LBL = {
      screen: tr('display.screen', null, 'Screen'), sound: tr('receive.sound', null, 'Sound'), mouse: tr('phone.mouse_and_keyboard', null, 'Mouse and keyboard'), clipboard: tr('nav.clipboard', null, 'Clipboard'),
      notifs: tr('nav.notifications', null, 'Notifications'), folder: tr('mesh_overview.shared_folder', null, 'Shared folder'), terminal: tr('nav.terminal', null, 'Terminal'), apps: tr('nav.apps', null, 'Apps'),
    };
    const m2w = [
      sw(LBL.screen, 'share', (s) => s.sharing && s.sharing.on, (v) => api.setSharing(v)),
      sw(LBL.sound, 'audio', (s) => s.audio && s.audio.send, (v) => api.setAudio({ send: v })),
      sw(LBL.mouse, 'cursor', (s) => s.kvm && s.kvm.driveOther, (v) => api.setKvm({ driveOther: v })),
      sw(LBL.clipboard, 'clipboard', (s) => s.clipboard && s.clipboard.send, (v) => api.setClipboard({ send: v })),
      sw(LBL.notifs, 'notifications', (s) => s.notifs && s.notifs.send, (v) => api.setNotifs({ send: v })),
      sw(LBL.folder, 'files', (s) => s.smb && s.smb.sharing, (v) => api.setShareMac(v)),
      sw(LBL.terminal, 'terminal', (s) => s.terminal && s.terminal.connectPc, (v) => api.setTerminal({ connectPc: v }), notPhone),
      sw(LBL.apps, 'apps', (s) => s.apps && s.apps.offer, (v) => api.setApps({ offer: v }), notPhone),
    ];
    const w2m = [
      sw(LBL.screen, 'receive', (s) => s.receive && s.receive.open, (v) => (v ? api.showPcView() : api.closePcView()), notPhone),
      sw(LBL.sound, 'audio', (s) => s.audio && s.audio.receive, (v) => api.setAudio({ receive: v })),
      sw(LBL.mouse, 'cursor', (s) => s.kvm && s.kvm.beDriven, (v) => api.setKvm({ beDriven: v })),
      sw(LBL.clipboard, 'clipboard', (s) => s.clipboard && s.clipboard.receive, (v) => api.setClipboard({ receive: v })),
      sw(LBL.notifs, 'notifications', (s) => s.notifs && s.notifs.receive, (v) => api.setNotifs({ receive: v })),
      sw(LBL.folder, 'files', (s) => s.smb && s.smb.connectPc, (v) => api.setSmb({ connectPc: v })),
      sw(LBL.terminal, 'terminal', (s) => s.terminal && s.terminal.allowPc, (v) => api.setTerminal({ allowPc: v }), notPhone),
      sw(LBL.apps, 'apps', (s) => s.papps && s.papps.on, (v) => api.setPcApps({ on: v }), notPhone),
    ];
    const quick = [...m2w, ...w2m];

    // ---- permissions missing after Setup (it shows only once): a row here, the switches in General ----
    const PERMS = [['screen', tr('overview.screen_recording', null, 'Screen Recording'), (p) => p.screen !== 'granted'], ['accessibility', tr('cursor.accessibility', null, 'Accessibility'), (p) => !p.accessibility], ['inputMonitoring', tr('overview.input_monitoring', null, 'Input Monitoring'), (p) => p.inputMonitoring === false]];
    const permRow = UI.row('', '', [UI.button(tr('overview.open_general', null, 'Open General'), () => UI.go('general'), 'small primary')]);
    const permCard = UI.card('', [permRow]);

    // ---- a connected phone's wireless debugging, until it works (the Phone page has it too) ----
    const ADB = { needsPair: ['bad', tr('mesh_overview.pair_once', null, 'Pair once')], waitingWifi: ['bad', tr('adb.off', null, 'Off')], connecting: ['muted', tr('mesh_overview.looking', null, 'Looking…')], missing: ['bad', tr('adb.missing', null, 'Missing')], error: ['bad', tr('adb.problem', null, 'Problem')] };
    const adbPill = el('span', { class: 'pill bad' });
    const adbRow = UI.row(tr('adb.title', null, 'Wireless debugging'), '', [adbPill, UI.button(tr('adb.try_again', null, 'Try Again'), () => api.phoneRetry(), 'small')]);
    const adbCode = el('input', { type: 'text', placeholder: '123456', maxLength: 6, inputMode: 'numeric', autocomplete: 'off', spellcheck: false, attrs: { 'aria-label': tr('adb.pairing_code_aria', null, 'Pairing code') } });
    const adbWhere = el('input', { type: 'text', placeholder: tr('adb.address_placeholder', null, 'Address:port (optional)'), autocomplete: 'off', spellcheck: false, attrs: { 'aria-label': tr('adb.address_aria', null, 'Pairing address') } });
    const adbPair = UI.button(tr('adb.pair_btn', null, 'Pair'), () => api.phonePair({ code: adbCode.value, where: adbWhere.value }), 'small primary');
    adbCode.onkeydown = adbWhere.onkeydown = (e) => { if (e.key === 'Enter') adbPair.click(); };
    const adbPairRow = UI.row(tr('adb.pairing_code_row', null, 'Pairing code'), tr('mesh_overview.or_type_on_phone', null, 'Or type it on the phone, in DuoDesk’s notification'), [adbCode, adbWhere, adbPair]);
    const adbCard = UI.card(tr('mesh_overview.phone_screen_mouse_kb', null, 'Phone screen, mouse and keyboard'), [adbRow, adbPairRow]);
    const pairedList = el('div');
    // Devices: every computer and phone of the mesh. Use makes it the one the features talk to.
    const devicesList = el('div');

    body.append(
      permCard,
      UI.card('', [addrRow, ipRow]),
      UI.card(tr('sidebar.nearby', null, 'Nearby'), [discRow, foundList, ...bleRows], { actions: [refresh] }),
      hero,
      adbCard,
      UI.pair(UI.dir('m2w', m2w.map((x) => x.row)), UI.dir('w2m', w2m.map((x) => x.row))),
      UI.card(tr('meshm_overview.devices', null, 'Devices'), [devicesList]),
      UI.card(tr('mesh_overview.paired', null, 'Paired'), [pairedList]),
    );

    let foundKey = '';
    let pairedKey = '';
    let devicesKey = '';
    return (s) => {
      const p = UI.names(s);
      bleSw.set(!s.net || s.net.ble !== false);
      blePcSw.set(!!s.net && s.net.blePc === true);
      const c = s.client;
      const g = s.guest || { status: {}, hosts: [] };

      // devices of the mesh
      const devKey = JSON.stringify(s.peers || []);
      if (devKey !== devicesKey) {
        devicesKey = devKey;
        const devs = s.peers || [];
        devicesList.replaceChildren(...(devs.length
          ? devs.map((dv) => {
            const direct = Array.isArray(dv.direct) ? dv.direct.length : 0;
            const state = dv.state === 'via' ? tr('sidebar.via', { name: (dv.via || []).join(', ') || tr('meshm_overview.another_device', null, 'another device') }, 'via {name}') : dv.connected ? (dv.rtt != null ? `${dv.rtt} ms` : tr('sidebar.connected', null, 'Connected'))
              : dv.state === 'waiting' ? tr('sidebar.waiting', null, 'Waiting for it to connect') : dv.state === 'connecting' || dv.state === 'reconnecting' ? tr('sidebar.connecting', null, 'Connecting…') : tr('sidebar.not_connected', null, 'Not connected');
            const links = direct === 1 ? tr('meshm_overview.count_direct_link_one', { count: direct }, '{count} direct link') : tr('meshm_overview.count_direct_link_other', { count: direct }, '{count} direct links');
            const hint = [state, dv.connected && direct ? links : ''].filter(Boolean).join(' · ');
            const r = UI.row(dv.name || tr('meshm_overview.device', null, 'Device'), hint, [
              dv.selected ? el('span', { class: 'pill good', text: tr('meshm_overview.in_use', null, 'In use') }) : null,
              dv.connected && !dv.selected ? UI.button(tr('meshm_overview.use', null, 'Use'), () => api.selectPeer(dv.id), 'small') : null,
              dv.state === 'via' ? el('span', { class: 'pill muted', text: tr('sidebar.via', { name: (dv.via || [])[0] || tr('meshm_overview.device_lower', null, 'device') }, 'via {name}') }) : UI.button(tr('overview.forget', null, 'Forget'), () => api.forgetPeer(dv.id), 'small'),
            ]);
            r.querySelector('.text').prepend(UI.osIcon(dv.os));
            r.classList.add('with-ico');
            return r;
          })
          : [UI.row(tr('meshm_overview.no_devices_yet', null, 'No devices yet'), tr('overview.pair_with_a_computer_in', null, 'Pair with a computer in Nearby.'))]));
      }

      // this Mac
      addrVal.textContent = s.addresses.length ? s.addresses[0] : tr('overview.no_network', null, 'No network');
      copyBtn.hidden = !s.addresses.length;
      const cn = s.connect || {};
      const gp = g.pairing;
      ipBtn.disabled = !!cn.busy || !!(gp && gp.phase !== 'failed');
      ipRow.setHint(gp && gp.phase === 'failed' ? gp.error : cn.message);
      ipRow.hint.classList.toggle('bad', !!(cn.error || (gp && gp.phase === 'failed')));

      // permissions
      const lost = s.permissions && s.ui && s.ui.setupDone ? PERMS.filter(([, , miss]) => miss(s.permissions)).map(([, label]) => label) : [];
      permCard.hidden = !lost.length;
      permRow.label.textContent = lost.length > 1 ? tr('overview.perms_arent_allowed', { list: lost.join(', ') }, '{list} aren’t allowed') : tr('overview.perm_isnt_allowed', { list: lost.join(', ') }, '{list} isn’t allowed');
      permRow.setHint(tr('overview.duodesk_needs_it_to_share', null, 'DuoDesk needs it to share this Mac with the other computer. After an update, allow it again.'));

      // nearby
      const d = s.discovery || { on: true, localNetwork: true };
      const blocked = !d.on || !d.localNetwork;
      discRow.hidden = !blocked;
      discRow.label.textContent = tr('mesh_overview.cant_look_network', null, 'Can’t look for computers on this network.');
      discRow.setHint(!d.localNetwork ? tr('overview.allow_local_network_for_duodesk', null, 'Allow Local Network for DuoDesk, or connect by address.') : d.error);
      discFix.hidden = d.localNetwork;
      const pairedIds = new Set([...s.paired.map((x) => x.id), ...g.hosts.map((x) => x.id)]);
      const fk = JSON.stringify([s.found, [...pairedIds], c && c.id, blocked]);
      if (fk !== foundKey) {
        foundKey = fk;
        const rows = s.found.map((dev) => {
          const online = c && c.id === dev.id;
          const known = pairedIds.has(dev.id);
          const label = online ? null : known ? tr('overview.take_over', null, 'Take over') : dev.os === 'mac' ? tr('overview.pair_btn', null, 'Pair') : tr('overview.connect', null, 'Connect');
          const btn = label && UI.button(label, () => api.pairWith(dev.id), `small${dev.invited ? ' primary' : ''}`);
          const r = UI.row(dev.name, `${dev.address}${dev.invited ? ` · ${tr('overview.wants_to_connect', null, 'wants to connect')}` : ''}`,
            [online ? el('span', { class: 'pill good', text: tr('overview.connected', null, 'Connected') }) : known ? el('span', { class: 'pill muted', text: tr('overview.paired', null, 'Paired') }) : null, btn]);
          r.querySelector('.text').prepend(UI.osIcon(dev.os));
          r.classList.add('with-ico');
          return r;
        });
        if (!rows.length && !blocked) rows.push(UI.row(tr('overview.looking_for_computers', null, 'Looking for computers…'), tr('overview.open_other_pc', null, 'Open DuoDesk on the other computer.')));
        foundList.replaceChildren(...rows);
      }

      // hero
      macName.textContent = s.macName;
      peerName.textContent = c ? c.name : p.Name;
      peerDev.className = `device ${UI.osClass(p.os)}`;
      if (UI.phoneWall && p.phone) peerDev.style.setProperty('--phone-wall', UI.phoneWall);
      else peerDev.style.removeProperty('--phone-wall');
      linkLine.className = `hero-link ${c ? 'up' : ''}`;
      const connecting = ['connecting', 'reconnecting'].includes(g.status.state);
      linkText.textContent = c ? `${c.rttMs != null ? `${c.rttMs} ms · ` : ''}${UI.via(s)}`
        : s.pairing || gp ? tr('overview.pairing', null, 'Pairing…') : connecting ? tr('overview.connecting', null, 'Connecting…') : tr('overview.not_connected', null, 'Not connected');
      const inp = s.input || { where: 'home' };
      const bad = s.serverError || (g.status.state === 'identity_changed' && g.status.message);
      status.textContent = bad
        || (c ? UI.fill(WHERE[inp.where] || tr('overview.connected', null, 'Connected'))
          : pairedIds.size ? tr('overview.open_other_to_connect', null, 'Open DuoDesk on the other computer to connect.')
            : tr('overview.pick_above', null, 'Pick a computer above, or connect by address.'));
      // Disconnected (here or by the other side), taken over, or the Mac we connect to is in use.
      const gStopped = !c && g.hosts.length && g.status.state === 'stopped';
      const gBusy = !c && g.hosts.length && !gStopped && g.status.busy;
      if (!bad && (gStopped || gBusy)) status.textContent = `${gStopped ? g.status.message || tr('overview.disconnected', null, 'Disconnected') : gBusy}.`;
      discBtn.hidden = !c;
      againBtn.hidden = !(gStopped || gBusy);
      againBtn.textContent = gBusy || (gStopped && g.status.message) ? tr('overview.take_over', null, 'Take over') : tr('overview.connect', null, 'Connect');
      sessionBtns.hidden = discBtn.hidden && againBtn.hidden;
      status.classList.toggle('bad', !!bad);
      const n = s.net || {};
      wifiOn = (n.why || []).includes('user') || !!n.linked; // made for the screen or files too
      wifiBtn.textContent = wifiOn ? tr('overview.back_to_bluetooth', null, 'Back to Bluetooth') : tr('mesh_overview.connect_wifi_direct', null, 'Connect with Wi-Fi Direct');
      wifiBtn.hidden = !c || !(wifiOn || c.transport === 'ble');
      hotspotBtn.hidden = !c || wifiOn || n.state === 'hotspot' || c.transport !== 'ble' || !UI.isPhone(s);

      // the phone's wireless debugging: only while it needs something
      const ph = s.phone || {};
      const br = (ph.connected && ph.bridge) || { state: 'off' };
      const pairable = br.state === 'needsPair' || !!br.canPair;
      adbCard.hidden = !ph.connected || !(pairable || ['waitingWifi', 'missing', 'error'].includes(br.state));
      if (!adbCard.hidden) {
        const [cls, label] = ADB[br.state] || ADB.error;
        adbPill.className = `pill ${cls}`;
        adbPill.textContent = label;
        adbRow.setHint(br.message || '');
        adbPairRow.hidden = !pairable;
        if (UI.adbBle(s, adbCard, adbRow, adbPill)) adbPairRow.hidden = true;
      }

      for (const x of quick) {
        x.c.set(x.get(s));
        x.row.hidden = !!(x.phone === false && p.phone);
      }

      // paired: guests (they connect to us) and hosts (we connect to them)
      const wk = (s.wake && s.wake.peers) || {};
      const near = new Set(s.found.map((dev) => dev.id));
      const pk = JSON.stringify([s.paired, g.hosts, c && c.id, Object.keys(wk), s.wake && s.wake.last, [...near]]);
      if (pk === pairedKey) return;
      pairedKey = pk;
      const all = [...s.paired, ...g.hosts.map((h) => ({ ...h, host: true }))];
      pairedList.replaceChildren(...(all.length
        ? all.map((x) => {
          const online = c && c.id === x.id;
          const r = UI.row(x.name, online ? tr('overview.connected', null, 'Connected') : tr('overview.last_seen', { time: UI.ago(x.lastSeen) }, 'Last seen {time}'),
            [online ? el('span', { class: 'pill good', text: tr('overview.online', null, 'Online') }) : null,
              // Wake it over the network (it told us how while connected).
              !online && wk[x.id] ? UI.button(s.wake.last && s.wake.last.id === x.id && Date.now() - s.wake.last.at < 20000 ? tr('overview.waking', null, 'Waking…') : tr('overview.wake', null, 'Wake'), () => api.wakePeer(x.id), 'small') : null,
              // Switch to it (nearby): whatever the session is now, it ends.
              !online && near.has(x.id) ? UI.button(c ? tr('overview.switch', null, 'Switch') : tr('overview.connect', null, 'Connect'), () => api.pairWith(x.id), 'small') : null,
              UI.button(tr('overview.forget', null, 'Forget'), () => api.forget(x.id), 'small')]);
          r.querySelector('.text').prepend(UI.osIcon(x.os));
          r.classList.add('with-ico');
          return r;
        })
        : [UI.row(tr('overview.nothing_paired', null, 'Nothing paired yet'), tr('overview.pair_with_a_computer_in', null, 'Pair with a computer in Nearby.'))]));
    };
  },
});
})();
