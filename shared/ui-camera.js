// TwinDesk — Copyright (C) 2026 inukaasith. GPL-3.0, see LICENSE.
// Camera tab (Mac, PC and Linux): its switch at the top turns Camera on (off: nothing of it is
// loaded or runs, and nothing is shared); Start runs the other device's camera here. A
// phone's, back or front, through wireless debugging (phoneview.js openCamera, Android 12 or later;
// the phone's own Camera page starts it too); the other computer's, which it shares only with
// "Let … see this camera" on there (camshare.js). Its picture shows on the page (turned with
// Rotate), in a window with Window (or a click on the picture), and with Virtual camera on, in a
// camera every app here can pick ("DuoDesk Camera", shared/vcam.js), installed the first time
// it's turned on. This computer's own camera goes to the other one the same way.
// With Multi-device on (state.camera.mesh, shared/camshare-mesh.js): Start runs the selected
// device's camera; one runs at a time, and while it runs the tab is about that device
// (state.camera.peerName) whichever is selected. "Let your other devices see this camera" is one
// switch for all of them.
'use strict';

(() => {
  const tr = (k, p, d) => (typeof t === 'function' ? t(k, p, d) : (d || k));
  let cur = null; // the last state, for the switch at the top
  let facing = 'back'; // a phone's camera to start with

  const phoneCam = (s) => ((s.phone && s.phone.bridge && s.phone.bridge.windows) || []).find((w) => w.kind === 'camera') || null;
  // Multi-device: a computer's camera running here while another device is selected is the tab's.
  // The selected device: s.session (Windows), s.peerSession (Linux: its s.session is the desktop's),
  // s.client (the Mac).
  const selected = (s) => s.peerSession || s.client || s.session || null;
  const other = (s) => {
    const c = s.camera || {};
    const sel = selected(s);
    return !!(c.mesh && c.viewing && c.peerId && !(sel && sel.id === c.peerId));
  };
  const isPhone = (s) => UI.isPhone(s) && !other(s);
  const running = (s) => (isPhone(s) ? !!phoneCam(s) : !!(s.camera && s.camera.viewing));
  // {name}: the device the tab is about (Multi-device: the one whose camera runs here).
  const fill = (s, t) => UI.fill(other(s) ? String(t).replace(/\{name\}/g, s.camera.peerName) : t);

  // Why it can't start now ('' when it can).
  function blocked(s) {
    const c = s.camera || {};
    if (isPhone(s)) {
      const ph = s.phone || {};
      if (!ph.connected) return tr('camera.not_connected', null, 'Not connected');
      if (!ph.bridge || ph.bridge.state !== 'ready') return tr('camera.needs_adb', null, 'Needs wireless debugging: set it up on the Phone page');
      return '';
    }
    if (!c.connected) return tr('camera.not_connected', null, 'Not connected');
    if (c.ble) return tr('camera.bt_blocked', null, 'Through Bluetooth a camera can’t go across: connect over Wi-Fi or a cable');
    if (!c.peerShares && !c.viewing) return c.mesh ? tr('camera.mesh_turn_on', null, 'Turn on sharing in {name}’s Camera tab first') : tr('camera.peer_turn_on', null, 'Turn on “Let {me} see this camera” on {name} first'); // Multi-device: either app may be there
    return '';
  }

  function start(on, show = false) {
    const s = cur;
    if (!s) return;
    if (isPhone(s)) UI.api.phoneCamera(on, on ? { facing, show } : undefined);
    else UI.api.camera({ do: on ? 'view' : 'close', show });
  }

  UI.tab({
    id: 'camera',
    group: 'More',
    order: 75,
    title: 'Camera',
    icon: 'camera',
    color: 'linear-gradient(#bf5af2, #8944ab)',
    desc: tr('camera.tab_desc', null, 'The other device’s camera here, and as a camera other apps can pick.'),
    badge: (s) => (s.camera && s.camera.sending ? 'warn' : running(s) ? 'on' : ''),
    devName: (s) => (other(s) ? s.camera.peerName : ''), // Multi-device: the page's device tag
    master: {
      get: (s) => !!(s.camera && s.camera.on),
      set: (v) => UI.api.camera({ do: 'on', on: v }),
    },
    build(body) {
      const { api, el } = UI;
      const cam = (m) => api.camera(m);

      // The picture: what the camera's window sends (a JPEG, about 12 a second). A click opens the window.
      const img = el('img', { alt: '' });
      Object.assign(img.style, { width: '100%', height: '100%', objectFit: 'contain', display: 'block' });
      const said = el('div');
      Object.assign(said.style, { position: 'absolute', inset: '0', display: 'grid', placeItems: 'center', textAlign: 'center', padding: '0 24px', color: '#a1a1a6' });
      const box = el('div', { title: tr('camera.open_in_window', null, 'Open it in a window') }, [img, said]);
      Object.assign(box.style, { position: 'relative', aspectRatio: '16 / 9', background: '#000', borderRadius: '8px', overflow: 'hidden', cursor: 'pointer', margin: '12px' });
      box.onclick = () => cur && running(cur) && start(true, true);
      let url = '';
      if (api.onCamPreview) {
        api.onCamPreview((buf) => {
          if (!cur || !running(cur)) return;
          const next = URL.createObjectURL(new Blob([buf], { type: 'image/jpeg' }));
          img.onload = () => { if (url && url !== next) URL.revokeObjectURL(url); url = next; };
          img.src = next;
        });
      }

      const facingSeg = UI.segmented([{ value: 'back', label: tr('camera.back', null, 'Back') }, { value: 'front', label: tr('camera.front', null, 'Front') }], (v) => {
        facing = v;
        facingSeg.set(v);
        if (cur && running(cur)) api.phoneCamera(true, { facing: v }); // switches in the same window
      });
      facingSeg.set(facing);
      const rotate = UI.button(tr('camera.rotate', null, 'Rotate'), () => cam({ do: 'rotate' }));
      rotate.title = tr('camera.rotate_title', null, 'A quarter turn clockwise: here, in its window and in the virtual camera');
      const windowBtn = UI.button(tr('camera.window', null, 'Window'), () => start(true, true));
      windowBtn.title = tr('camera.open_in_window', null, 'Open it in a window');
      const startBtn = UI.button(tr('camera.start', null, 'Start'), () => cur && start(!running(cur)));
      const controls = UI.row(tr('camera.peer_camera', null, '{name}’s camera'), '', [startBtn, facingSeg, rotate, windowBtn]);
      const picCard = UI.card('', [box, controls]);

      // Virtual camera: the picture also goes to a camera other apps can pick.
      const virtual = UI.switch((v) => cam({ do: 'virtual', on: v }), { label: tr('camera.virtual_title', null, 'Virtual camera') });
      const vRemove = UI.button(tr('camera.remove', null, 'Remove'), () => cam({ do: 'vcamRemove' }));
      const vRow = UI.row(tr('camera.virtual_title', null, 'Virtual camera'), '', [vRemove, virtual]);
      // Which camera it feeds, where there's a choice (the Mac: DuoDesk Camera or OBS Virtual Camera).
      const vTarget = UI.select([], (t) => cam({ do: 'vcamTarget', target: t }));
      const vTargetRow = UI.row(tr('camera.send_to', null, 'Send to'), tr('camera.camera_apps_pick', null, 'The camera other apps pick'), [vTarget]);
      const vCard = UI.card(tr('camera.virtual_title', null, 'Virtual camera'), [vTargetRow, vRow]);

      // This computer's camera there.
      const share = UI.switch((v) => cam({ do: 'share', on: v }), { label: tr('camera.share_sw_label', null, 'Share this camera') });
      const shareRow = UI.row(tr('camera.share_row_title', null, 'Let {name} see this camera'), '', [share]);
      const device = UI.select([{ value: '', label: tr('camera.default_camera', null, 'The default camera') }], (v) => cam({ do: 'device', id: v }));
      const deviceRow = UI.row(tr('nav.camera', null, 'Camera'), tr('camera.device_row_hint', null, 'Which of {me}’s cameras it shows'), [device]);
      const stop = UI.button(tr('camera.stop', null, 'Stop'), () => cam({ do: 'stop' }), 'danger');
      const liveRow = UI.row(tr('camera.viewing_now', null, '{name} is viewing it now'), tr('camera.camera_on_while_running', null, 'The camera is on while it’s running there'), [stop]);
      const ourCard = UI.card(tr('camera.our_camera', null, '{me}’s camera'), [shareRow, deviceRow, liveRow]);

      const note = UI.note('info', '');
      body.append(picCard, vCard, ourCard, note);

      let listed = false;
      return (s) => {
        cur = s;
        const c = s.camera || {};
        const v = s.vcam || {};
        const phone = isPhone(s);
        const mesh = !!c.mesh;
        const on = running(s);
        const vName = `“${v.name || 'DuoDesk Camera'}”`;
        const w = phone ? phoneCam(s) : null;
        if (w && w.facing && w.facing !== facing) {
          facing = w.facing; // started or switched elsewhere (the phone's Camera page)
          facingSeg.set(facing);
        }

        // The picture, or what it's waiting for.
        const why = blocked(s);
        let text = '';
        if (!c.on) text = tr('camera.off_top', null, 'Off: turn on Camera at the top');
        else if (!on) text = fill(s, why || tr('camera.press_start', null, 'Press Start to run {name}’s camera here'));
        else if (phone && w && w.error) text = tr('camera.it_stopped', { error: w.error }, `It stopped: ${w.error}`);
        else if (!phone && c.viewStatus === 'refused') text = fill(s, mesh ? tr('camera.mesh_turn_on', null, 'Turn on sharing in {name}’s Camera tab first') : tr('camera.peer_turn_on', null, 'Turn on “Let {me} see this camera” on {name} first'));
        else if (!phone && c.viewStatus === 'failed') text = tr('camera.it_didnt_start', { error: c.viewError || tr('camera.error_unknown', null, 'unknown') }, `It didn’t start: ${c.viewError || 'unknown'}`);
        else if (!phone && c.viewStatus === 'ended') text = fill(s, tr('camera.peer_stopped', null, '{name} stopped its camera'));
        else if (!v.picture) text = phone ? tr('camera.starting_phone', null, 'Starting the phone’s camera…') : fill(s, tr('camera.asking_peer', null, 'Asking {name} for its camera…'));
        said.textContent = text;
        said.hidden = !text;
        img.hidden = !on || !!text;
        if (!on && url) {
          URL.revokeObjectURL(url);
          url = '';
          img.removeAttribute('src');
        }
        startBtn.textContent = on ? tr('camera.stop', null, 'Stop') : tr('camera.start', null, 'Start');
        startBtn.disabled = !c.on || (!on && !!why);
        startBtn.title = !on && why ? fill(s, why) : '';
        controls.label.textContent = fill(s, tr('camera.peer_camera', null, '{name}’s camera')); // Multi-device: whose runs here
        facingSeg.el.hidden = !phone;
        rotate.disabled = !on;
        windowBtn.disabled = !on;
        windowBtn.textContent = (phone ? w && w.shown : c.viewShown) ? tr('camera.window_checked', null, 'Window ✓') : tr('camera.window', null, 'Window');
        controls.setHint(on ? tr('camera.turned_hint', { rotate: v.rotate || 0 }, `Turned ${v.rotate || 0}°. Click the picture or Window for a window of its own`) : '');

        // Virtual camera.
        virtual.set(!!v.on);
        virtual.disable(v.supported === false || !!v.busy);
        vRemove.hidden = !v.installed || !!v.on || !!v.busy || v.removable === false;
        vTargetRow.hidden = !(v.targets && v.targets.length > 1);
        if (!vTargetRow.hidden) {
          vTarget.options(v.targets);
          vTarget.set(v.target || v.targets[0].value);
          vTarget.el.disabled = !!v.busy;
        }
        vRow.setHint(!v.checked ? tr('general.checking', null, 'Checking…')
          : v.supported === false ? v.message
            : v.busy === 'install' ? (v.message || tr('general.installing', null, 'Installing…'))
              : v.busy === 'remove' ? tr('files.removing', null, 'Removing…')
                : v.ready && v.live ? tr('camera.sharing_now', { name: vName }, `Sharing now: in Zoom, Teams, the browser…, choose only ${vName} as the camera`)
                  : v.ready ? tr('camera.ready_hint', { name: vName }, `Ready: the camera running here goes to ${vName}. Choose only that one in the app you call from`)
                    : v.on ? (v.message || tr('general.not_installed', null, 'Not installed'))
                      : v.message || tr('camera.off_hint', { name: vName }, `Off: the picture stays in DuoDesk. On: it’s also ${vName}, a camera other apps can pick`));

        // This computer's own camera (not with a phone).
        ourCard.hidden = phone;
        if (!phone) {
          share.set(!!c.share);
          shareRow.label.textContent = mesh ? tr('camera.mesh_share_all', null, 'Let your other devices see this camera') : UI.fill(tr('camera.share_row_title', null, 'Let {name} see this camera'));
          shareRow.setHint(c.shareError || (c.share ? (mesh ? tr('camera.mesh_share_hint', null, 'Your other computers can run it there. A popup says so here when one does') : tr('camera.peer_share_hint', null, '{name} can run it there. A popup says so here when it does')) : tr('camera.nobody_sees_it', null, 'Off: nobody sees it')));
          device.options([{ value: '', label: tr('camera.default_camera', null, 'The default camera') }, ...(c.devices || []).map((d) => ({ value: d.id, label: d.label }))]);
          device.set(c.device || '');
          deviceRow.hidden = !c.share;
          liveRow.hidden = !c.sending;
          liveRow.label.textContent = mesh && c.sendingTo ? tr(c.sendingTo.includes(',') ? 'camera.sending_to_other' : 'camera.sending_to_one', { names: c.sendingTo }, `${c.sendingTo} ${c.sendingTo.includes(',') ? 'are' : 'is'} viewing it now`) : UI.fill(tr('camera.viewing_now', null, '{name} is viewing it now'));
          if (c.share && !listed) {
            listed = true;
            cam({ do: 'devices' });
          }
        }

        note.set(v.ready
          ? tr('camera.apps_see_it', { name: vName, extra: phone ? '' : tr('camera.straight_hint', null, ' The picture goes straight between the two computers.') }, `Apps here see it as ${vName}: pick that one, not {me}’s own camera.` + (phone ? '' : ' The picture goes straight between the two computers.'))
          : tr('camera.turn_on_vcam_hint', { extra: phone ? '' : tr('camera.straight_hint', null, ' The picture goes straight between the two computers.') }, 'Turn on Virtual camera to use it as a real camera in other apps (Zoom, Teams, the browser…).' + (phone ? '' : ' The picture goes straight between the two computers.')));
      };
    },
  });
})();
