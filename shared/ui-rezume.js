// TwinDesk — Copyright (C) 2026 inukaasith. GPL-3.0, see LICENSE.
// ReZume tab (Mac, PC and Linux; with a computer or a phone, shared/rezume.js): go on here with
// the tab, document or phone app in use on the other device, and the other way round. Its switch at
// the top turns it on (off until then: nothing is looked at, no permission asked). What goes
// (pages, documents, phone apps, opened here in a window with Mirror apps), which ways, and where
// the other side's shows: a notification, the taskbar (the Dock on the Mac), the tray (menu bar),
// this tab and the Apps tab / Phone page (UI.rezumeCard, the card they show too).
'use strict';

(function () {
  const tr = (k, p, d) => (typeof t === 'function' ? t(k, p, d) : (d || k));
  const mac = /Mac/.test(navigator.platform);
  const linux = /Linux/.test(navigator.platform);
  const kindWord = (o) => (o.kind === 'web' ? tr('rezume.page', null, 'Page') : o.kind === 'doc' ? tr('rezume.document', null, 'Document') : tr('rezume.app', null, 'App'));
  const hostOf = (u) => { try { return new URL(u).host; } catch (_) { return ''; } };
  const size = (n) => (n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB');

  // The other device's offer: its icon, what it is, Open and Dismiss. update(s, always): shown while
  // there is one (always: on the ReZume tab; elsewhere only with "On the Apps and Phone pages").
  UI.rezumeCard = function () {
    const { el, api } = UI;
    const icon = el('span', { class: 'rezume-icon' });
    const open = UI.button(tr('pfiles.open', null, 'Open'), () => api.rezumeDo({ a: 'take' }), 'small primary');
    const dismiss = UI.button(tr('rezume.dismiss', null, 'Dismiss'), () => api.rezumeDo({ a: 'dismiss' }), 'small');
    const row = UI.row('', '', [open, dismiss]);
    row.prepend(icon);
    const wrap = UI.card(tr('rezume.continue_from', null, 'Continue from {name}'), [row]);
    wrap.hidden = true;
    let key = '';
    return {
      el: wrap,
      update(s, always) {
        const h = s.rezume;
        const i = h && h.on && h.receive && h.incoming;
        wrap.hidden = !i || (!always && !h.tab);
        if (!i) return;
        const k = JSON.stringify([i.id, i.icon ? i.icon.length : 0]);
        if (k !== key) {
          key = k;
          icon.replaceChildren(UI.appIcon(i.icon));
        }
        row.label.textContent = i.title || i.name || i.appName;
        row.setHint(kindWord(i) + ' · ' + (i.kind === 'web' ? hostOf(i.url) : i.kind === 'doc' ? i.name + (i.size ? ', ' + size(i.size) : '') : (i.appName || i.app) + (h.mirrorReady ? tr('rezume.in_window_here', null, ', in a window here') : ''))
          + (i.appName && i.kind !== 'app' ? ' · ' + i.appName : ''));
      },
    };
  };

  UI.tab({
    id: 'rezume',
    order: 85,
    title: 'ReZume',
    icon: 'rezume',
    color: 'linear-gradient(#64d2ff, #0a84ff)',
    desc: tr('rezume.desc', null, 'Like Handoff on Apple devices: go on here with what you were doing on the other device, and the other way round.'),
    badge: (s) => (s.rezume && s.rezume.on && s.rezume.incoming ? '1' : ''),
    master: {
      get: (s) => !!(s.rezume && s.rezume.on),
      set: (v) => UI.api.setReZume({ on: v }),
      disabled: (s) => !s.rezume,
    },
    build(body) {
      const { api } = UI;
      const NAME = {
        web: tr('rezume.aria_web', null, 'Web pages'),
        video: tr('rezume.aria_video', null, 'Videos'),
        docs: tr('rezume.aria_docs', null, 'Documents'),
        apps: tr('rezume.aria_apps', null, 'Apps'),
        mirror: tr('rezume.aria_mirror', null, 'Screen mirroring'),
        send: tr('rezume.aria_send', null, 'Send'),
        receive: tr('rezume.aria_receive', null, 'Receive'),
        push: tr('rezume.aria_push', null, 'Push'),
        notify: tr('rezume.aria_notify', null, 'Notify'),
        taskbar: tr('rezume.aria_taskbar', null, 'Taskbar'),
        tray: tr('rezume.aria_tray', null, 'Tray'),
        tab: tr('rezume.aria_tab', null, 'Tab'),
      };
      const set = (k) => UI.switch((v) => api.setReZume({ [k]: v }), { label: NAME[k] || k });
      const note = UI.note('warn', '');
      const info = UI.note('info', '');
      const offer = UI.rezumeCard();

      const status = UI.row('{name}', '');
      const out = UI.row(tr('rezume.offered_to', null, 'Offered to {name}'), '');
      const push = UI.button(tr('rezume.send_to_name', null, 'Send to {name}'), () => api.rezumeDo({ a: 'push' }), 'small');
      const outRow = UI.row(tr('rezume.send_to_name', null, 'Send to {name}'), tr('rezume.send_to_hint', null, 'Opens there now what was last in front here'), [push]);
      const now = UI.card(tr('calls.card_now', null, 'Now'), [status, out, outRow]);

      const sw = {};
      for (const k of ['web', 'video', 'docs', 'apps', 'mirror', 'send', 'receive', 'push', 'notify', 'taskbar', 'tray', 'tab']) sw[k] = set(k);
      const webRow = UI.row(tr('rezume.web_pages', null, 'Web pages'), tr('rezume.web_hint', null, 'The tab in front in Chrome, Edge, Firefox, Safari, Brave, Vivaldi, Opera or Arc'), [sw.web.el]);
      const videoRow = UI.row(tr('rezume.videos', null, 'Videos'), tr('rezume.videos_hint', null, 'A YouTube video playing here opens there at the same second'), [sw.video.el]);
      const docRow = UI.row(tr('rezume.documents', null, 'Documents'), tr('rezume.doc_here_hint', null, 'The file open in front (Word, Pages, Preview, a text editor…): it comes across and opens here'), [sw.docs.el]);
      const appRow = UI.row(tr('rezume.phone_apps', null, 'Phone apps'), tr('rezume.phone_apps_hint', null, 'The app in front on the phone'), [sw.apps.el]);
      const mirrorRow = UI.row(tr('rezume.mirror_apps', null, 'Mirror apps'), tr('rezume.mirror_here_hint', null, 'A phone app opens here in a window of its own, as it was (wireless debugging)'), [sw.mirror.el]);
      const what = UI.card(tr('rezume.what_goes', null, 'What goes'), [webRow, videoRow, docRow, appRow, mirrorRow]);

      const sendRow = UI.row(tr('rezume.offer_me', null, 'Offer what’s in use on {me}'), tr('rezume.offer_me_hint', null, '{name} can go on with it'), [sw.send.el]);
      const recvRow = UI.row(tr('rezume.take_peer', null, 'Take {name}’s'), tr('rezume.take_peer_hint', null, 'What’s in use there shows here'), [sw.receive.el]);
      const pushRow = UI.row(tr('rezume.push_row', null, 'Open what’s sent at once'), tr('rezume.push_hint', null, 'Send to on {name} (its tray, the share sheet’s Open on computer) opens it here without asking'), [sw.push.el]);
      const ways = UI.card(tr('rezume.which_ways', null, 'Which ways'), [sendRow, recvRow, pushRow]);

      const notifyRow = UI.row(tr('rezume.notification', null, 'Notification'), tr('rezume.notify_hint', null, 'A quiet one, replaced by the next'), [sw.notify.el]);
      const barRow = UI.row(mac ? tr('rezume.dock_bar', null, 'Dock') : linux ? tr('rezume.taskbar_dock', null, 'Taskbar or dock') : tr('rezume.taskbar', null, 'Taskbar'), tr('rezume.bar_hint', null, 'A button with the app’s icon: click it to go on'), [sw.taskbar.el]);
      const trayRow = UI.row(mac ? tr('rezume.menu_bar', null, 'Menu bar') : tr('rezume.tray', null, 'Tray'), tr('rezume.tray_hint', null, 'Continue and Send to in its menu'), [sw.tray.el]);
      const tabRow = UI.row(tr('rezume.tab_row', null, 'Apps tab and Phone page'), tr('rezume.tab_hint', null, 'The card above, there too'), [sw.tab.el]);
      const where = UI.card(tr('rezume.where_shows', null, 'Where {name}’s shows'), [notifyRow, barRow, trayRow, tabRow]);

      body.append(note, offer.el, now, info, what, ways, where);

      return (s) => {
        const h = s.rezume || {};
        for (const k of Object.keys(sw)) {
          sw[k].set(h[k]);
          sw[k].disable(!h.on);
        }
        sw.mirror.disable(!h.on || !h.apps);
        offer.update(s, true);
        const phone = !!h.phone;
        appRow.hidden = mirrorRow.hidden = !phone;
        docRow.setHint(phone ? tr('rezume.doc_phone_hint', null, 'The file open in front here goes to the phone and opens there; the phone has none to send')
          : tr('rezume.doc_peer_hint', null, 'The file open in front (Word, Pages, Preview, a text editor…): it comes across and opens on the other side'));
        mirrorRow.setHint(!h.mirrorReady ? tr('rezume.mirror_need_adb', null, 'Needs wireless debugging (Phone page): until then phone apps aren’t offered here')
          : tr('rezume.mirror_ready', null, 'A phone app opens here in a window of its own, as it was'));
        status.setHint(!h.connected ? tr('rezume.not_connected', null, 'Not connected')
          : !h.on ? tr('rezume.off_here', null, 'Off here')
            : !h.peerKnows ? tr('rezume.peer_update', null, 'No ReZume there yet: update DuoDesk on {name}')
              : !h.peerOn ? tr('rezume.peer_off', null, 'Off on {name}: turn it on there too')
                : phone && !h.peerDetects ? (h.mirrorReady ? tr('rezume.phone_ready_adb', null, 'Ready: the phone’s apps through wireless debugging (its pages need DuoDesk’s Accessibility there)') : tr('rezume.phone_ready_acc', null, 'Ready for pages and documents. For what’s in use on the phone, turn on DuoDesk’s Accessibility there, or wireless debugging'))
                  : h.incoming ? tr('rezume.ready_incoming', null, 'Ready: something to go on with, above') : tr('rezume.ready', null, 'Ready'));
        out.hidden = !h.out;
        if (h.out) {
          out.setHint(h.out.title + (h.out.kind === 'web' ? ' · ' + hostOf(h.out.url) : h.out.kind === 'doc' ? ' · ' + h.out.name : ''));
        }
        outRow.hidden = !h.on || !h.connected;
        push.disabled = !h.last;
        outRow.setHint(h.last ? tr('rezume.opens_there_now', { title: h.last.title }, 'Opens there now: ' + h.last.title) : tr('rezume.nothing_in_front', null, 'Nothing in front here to send yet'));
        note.set(h.on ? h.why : '');
        info.set(h.on ? (h.waiting ? tr('rezume.getting_waiting', { item: h.waiting }, 'Getting ' + h.waiting + '…') : h.message) : '');
      };
    },
  });
})();
