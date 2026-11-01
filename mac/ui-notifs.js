// TwinDesk — Copyright (C) 2026 inukaasith. GPL-3.0, see LICENSE.
// Notifications tab: this Mac's notifications on the other computer, and theirs here
// as native notifications. Sending needs Full Disk Access (there is no API for it on macOS).
'use strict';

UI.tab({
  id: 'notifications',
  group: 'Share',
  order: 45,
  title: 'Notifications',
  icon: 'bell',
  desc: 'See one computer’s notifications on the other.',
  color: 'linear-gradient(#ff6961, #ff3b30)',
  // One switch for the whole tab (both directions); each direction is shared with the
  // other computer per pair (pairsync.js), so flipping it there flips it here.
  master: { get: (s) => !!(s.notifs && (s.notifs.send || s.notifs.receive)), set: (v) => UI.api.setNotifs({ send: v, receive: v }) },
  badge: (s) => (s.notifs && (s.notifs.send || s.notifs.receive) ? 'on' : ''),
  build(body) {
    const { el, api } = UI;
    const t = (k, p, d) => (typeof window.t === 'function' ? window.t(k, p, d) : d !== undefined ? d : k);
    const sendSw = UI.switch((v) => api.setNotifs({ send: v }), { label: t('notifs.send_notifications', null, 'Send notifications') });
    const sendRow = UI.row(t('notifs.show_mes_notifications_on', null, 'Show {me}’s notifications on {name}'), '', [sendSw]);
    const hideSw = UI.switch((v) => api.setNotifs({ hideText: v }), { label: t('notifs.hide_message_text', null, 'Hide message text') });
    const hideRow = UI.row(t('notifs.hide_message_text', null, 'Hide message text'), t('notifs.only_the_app_and_the', null, 'Only the app and the title'), [hideSw]);
    const fdaBtn = UI.button(t('pair.allow', null, 'Allow'), () => api.allowFullDisk(), 'small primary');
    const fdaRow = UI.row(t('notifs.allow_full_disk_access', null, 'Allow Full Disk Access'), t('notifs.click_or_drag_duodesk_into', null, 'Click +, or drag DuoDesk into the list'), [fdaBtn]);
    const recvSw = UI.switch((v) => api.setNotifs({ receive: v }), { label: t('notifs.show_notifications_here', null, 'Show notifications here') });
    const recvRow = UI.row(t('notifs.show_names_notifications_on', null, 'Show {name}’s notifications on {me}'), '', [recvSw]);
    const apps = el('div');

    body.append(
      UI.pair(UI.dir('m2w', [sendRow, fdaRow, hideRow]), UI.dir('w2m', [recvRow])),
      UI.card(t('nav.apps', null, 'Apps'), [apps]),
    );

    let key = '';
    return (s) => {
      const n = s.notifs;
      if (!n) return;
      const p = UI.peer(s);
      sendSw.set(n.send);
      hideSw.set(n.hideText);
      recvSw.set(n.receive);
      fdaRow.hidden = n.access !== 'noAccess';
      sendRow.setHint(!n.send ? '' : n.access === 'noAccess' ? t('notifs.needs_full_disk_access', null, 'Needs Full Disk Access')
        : !s.client ? t('notifs.also_switches_it_on_the', null, 'Also switches it on the other computer') : n.sent ? t('notifs.count_sent', { count: n.sent }, '{count} sent') : t('notifs.as_native_notifications_there', null, 'As native notifications there'));
      recvRow.setHint(n.receive && n.shown ? t('notifs.count_shown', { count: n.shown }, '{count} shown') : t('notifs.as_native_notifications_from_duodesk', null, 'As native notifications, from DuoDesk'));
      void p;

      const k = JSON.stringify([n.apps.map((a) => a.app), n.muted]);
      if (k === key) return;
      key = k;
      apps.replaceChildren(...(n.apps.length
        ? n.apps.map((a) => {
          const sw = UI.switch((v) => api.muteNotifApp({ app: a.app, muted: !v }), { label: t('notifs.send_app', { app: a.appName }, 'Send {app}') });
          sw.set(!(n.muted || []).includes(a.app));
          return UI.row(a.appName, '', [sw]);
        })
        : [UI.row(t('notifs.no_notifications_yet', null, 'No notifications yet'), t('notifs.apps_show_up_here_after_mac', null, 'Apps show up here after their first notification'))]));
    };
  },
});
