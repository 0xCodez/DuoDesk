// TwinDesk — Copyright (C) 2026 inukaasith. GPL-3.0, see LICENSE.
// Mirroring and Apps (Mac, PC and Linux), the phone's two pages that were on the Phone page:
//   Mirroring: the phone's screen in a window, what's open here, and how phone windows look and
//   behave (sound, picture, controls, keys).
//   Apps: the phone's apps, each opened in a window of its own.
// Only while a phone is connected; both need wireless debugging (Connection).
'use strict';

(function () {
  const tr = (k, p, d) => (typeof t === 'function' ? t(k, p, d) : (d || k));
  const mac = /Mac/.test(navigator.platform);
  const linux = /Linux/.test(navigator.platform);
  const isPhone = (s) => !!(s && s.phone && s.phone.connected);

  // Wireless debugging isn't ready: one line, with the way to Connection.
  const needAdb = () => {
    const row = UI.row(tr('mirror.adb_not_setup_title', null, 'Wireless debugging isn’t set up'), tr('mirror.adb_not_setup_desc', null, 'Mirroring and phone apps need it. Set it up once on the Connection page.'), [UI.button(tr('mirror.setup_btn', null, 'Set Up'), () => UI.go('connection'), 'small primary')]);
    const card = UI.card('', [row]);
    return { el: card, update(s) { const br = (s.phone || {}).bridge || {}; card.hidden = br.state === 'ready'; row.setHint(br.state === 'connecting' ? tr('mirror.adb_connecting', null, 'Connecting to the phone’s wireless debugging…') : tr('mirror.adb_not_setup_desc', null, 'Mirroring and phone apps need it. Set it up once on the Connection page.')); } };
  };

  UI.tab({
    id: 'mirror',
    order: 9,
    title: 'Mirroring',
    icon: 'phone',
    color: 'linear-gradient(#64d2ff, #0a84ff)',
    desc: 'The phone’s screen in a window, with touch, mouse and keyboard.',
    hidden: (s) => !isPhone(s),
    build(body) {
      const { el, api } = UI;
      const adb = needAdb();
      const showBtn = UI.button(tr('mirror.show_screen_btn', null, 'Show Phone Screen'), () => api.phoneScreen(true), 'primary');
      const showRow = UI.row(tr('mirror.phone_screen', null, 'Phone screen'), tr('mirror.phone_screen_desc', null, 'Opens in its own window. Close it any time; the phone keeps running.'), [showBtn]);
      const winList = el('div');
      const winCard = UI.card(mac ? tr('mirror.open_on_this_mac', null, 'Open on this Mac') : linux ? tr('mirror.open_on_this_computer', null, 'Open on this computer') : tr('mirror.open_on_this_pc', null, 'Open on this PC'), [winList]);

      const sound = UI.switch((v) => api.setPhone({ sound: v }), { label: tr('phone.phone_sound', null, 'Phone sound') });
      const quality = UI.select([
        { value: '4', label: tr('mirror.saver_mbps', null, 'Data saver · 4 Mb/s') }, { value: '8', label: tr('mirror.balanced_mbps', null, 'Balanced · 8 Mb/s') },
        { value: '16', label: tr('mirror.sharp_mbps', null, 'Sharp · 16 Mb/s') }, { value: '24', label: tr('mirror.sharpest_mbps', null, 'Sharpest · 24 Mb/s') },
      ], (v) => api.setPhone({ bitrateMbps: Number(v) }));
      const rows = [
        UI.row(tr('mirror.sound_title', null, 'Play phone sound here'), tr('mirror.sound_hint', null, 'Android 11 or later'), [sound]),
        UI.row(tr('mirror.quality_title', null, 'Picture quality'), tr('mirror.quality_hint', null, 'For the phone screen and app windows'), [quality]),
      ];
      // Windows: where the buttons sit (settings.phone.controls); the panel itself opens and closes
      // from each window's title bar and stays as it was left (settings.phone.panel).
      let controls = null;
      if (!mac && !linux) {
        controls = UI.select([
          { value: 'top', label: tr('mirror.ctrl_top', null, 'Title bar') }, { value: 'side', label: tr('mirror.ctrl_side', null, 'Side panel') }, { value: 'bottom', label: tr('mirror.ctrl_bottom', null, 'Bottom bar') },
        ], (v) => api.setPhone({ controls: v }));
        rows.push(UI.row(tr('mirror.controls_title', null, 'Phone controls'), tr('mirror.controls_hint', null, 'Where Back, Home, Recents and the other buttons sit. The panel button in each window’s title bar shows or hides them.'), [controls]));
      }
      let enterSends = null, arrowSwipe = null;
      if (!linux) {
        enterSends = UI.switch((v) => api.setPhone({ enterSends: v }), { label: tr('mirror.enter_sends_title', { key: mac ? 'Return' : 'Enter' }, (mac ? 'Return' : 'Enter') + ' sends messages') });
        rows.push(UI.row(tr('mirror.enter_sends_title', { key: mac ? 'Return' : 'Enter' }, (mac ? 'Return' : 'Enter') + ' sends messages'), tr('mirror.enter_sends_hint', { combo: mac ? '⇧Return' : 'Shift+Enter' }, 'In WhatsApp, Instagram and Telegram. ' + (mac ? '⇧Return' : 'Shift+Enter') + ' adds a new line.'), [enterSends]));
        arrowSwipe = UI.switch((v) => api.setPhone({ arrowSwipe: v }), { label: tr('mirror.arrow_swipe_title', null, 'Arrow keys swipe') });
        rows.push(UI.row(tr('mirror.arrow_swipe_title', null, 'Arrow keys swipe'), tr('mirror.arrow_swipe_hint', null, 'Up and down through feeds and Shorts, left and right through pages. Off: arrows move the text cursor.'), [arrowSwipe]));
      }
      const optsCard = UI.card(tr('mirror.phone_windows', null, 'Phone windows'), rows);
      const kbRow = UI.row(tr('mirror.kb_title', null, 'Mouse and keyboard'), tr('mirror.kb_hint', null, 'Push the pointer past the screen edge to use the phone.'), [UI.button(tr('mirror.mouse_settings', null, 'Mouse Settings'), () => UI.go('cursor'), 'small')]);

      body.append(adb.el, UI.card('', [showRow]), winCard, optsCard, UI.card('', [kbRow]));

      let winKey = '';
      return (s) => {
        adb.update(s);
        const ph = s.phone || {};
        const br = ph.bridge || {};
        showBtn.disabled = br.state !== 'ready';
        const st = ph.settings || {};
        sound.set(!!st.sound);
        quality.set(String(st.bitrateMbps || 8));
        if (controls) controls.set(st.controls || 'top');
        if (enterSends) enterSends.set(st.enterSends !== false);
        if (arrowSwipe) arrowSwipe.set(st.arrowSwipe === true);
        const wins = br.windows || [];
        winCard.hidden = !wins.length;
        const wk = JSON.stringify(wins);
        if (wk !== winKey) {
          winKey = wk;
          winList.replaceChildren(...wins.map((w) => UI.row(w.kind === 'screen' ? tr('mirror.phone_screen', null, 'Phone screen') : w.title, w.kind === 'screen' ? tr('phone.mirror', null, 'Mirror') : w.app, [UI.button(tr('general.close', null, 'Close'), () => api.phoneCloseView(w.id), 'small')])));
        }
      };
    },
  });

  UI.tab({
    id: 'papps',
    order: 7.5,
    title: 'Apps',
    heading: tr('mirror.phone_apps_heading', null, 'Phone apps'),
    icon: 'apps',
    color: 'linear-gradient(#5ac8fa, #007aff)',
    desc: tr('mirror.phone_apps_desc', null, 'Open any phone app in its own window.'),
    hidden: (s) => !isPhone(s),
    build(body) {
      const { el, api } = UI;
      const adb = needAdb();
      const search = el('input', { type: 'search', placeholder: tr('mirror.search_apps', null, 'Search apps'), autocomplete: 'off', spellcheck: false, attrs: { 'aria-label': tr('mirror.search_apps', null, 'Search apps') } });
      const count = el('span', { class: 'hint' });
      const grid = el('div', { class: 'app-grid' });
      const note = UI.note('info', '');
      search.oninput = () => { key = ''; UI.state && render(UI.state); };
      const menuWord = mac ? tr('mirror.dock_menu', null, ' · Right-click to add it to the Dock') : linux ? '' : tr('mirror.pin_menu', null, ' · Right-click to pin it to Start');
      body.append(adb.el, el('div', { class: 'papps-bar' }, [search, count]), note, el('div', { class: 'card' }, [grid]));

      let key = '';
      function render(s) {
        adb.update(s);
        const ph = s.phone || {};
        const ready = (ph.bridge || {}).state === 'ready';
        const apps = (UI.phoneAssets && UI.phoneAssets.apps) || [];
        const term = search.value.trim().toLowerCase();
        const shown = term ? apps.filter((a) => a.name.toLowerCase().includes(term)) : apps;
        count.textContent = apps.length ? (term ? tr('mirror.n_of_total_apps', { shown: shown.length, total: apps.length }, `${shown.length} of ${apps.length}`) : tr('mirror.n_apps', { count: apps.length }, `${apps.length} apps`)) : '';
        note.set(ready && !apps.length ? tr('mirror.loading_apps', null, 'Loading the phone’s apps…') : '');
        const k = JSON.stringify([shown.length, term, ph.assets, ready]);
        if (k === key) return;
        key = k;
        grid.replaceChildren(...shown.slice(0, 400).map((a) => {
          const b = el('button', { class: 'app-tile', title: tr('mirror.tile_title', { name: a.name, menu: menuWord || '' }, `Open ${a.name}` + (menuWord || '')), disabled: !ready }, [UI.appIcon(a.icon), el('span', { text: a.name })]);
          b.onclick = () => api.phoneOpenApp({ id: a.id, name: a.name });
          if (api.phoneAppMenu && menuWord) b.oncontextmenu = (e) => { e.preventDefault(); api.phoneAppMenu({ id: a.id, name: a.name }); };
          return b;
        }));
      }
      return render;
    },
  });
})();
