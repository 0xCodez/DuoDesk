// TwinDesk — Copyright (C) 2026 inukaasith. GPL-3.0, see LICENSE.
// Notifications tab: the other computer's notifications here as Windows
// toasts from TwinDesk, and this PC's on the other computer (read from Windows' notification
// database by the helper). Two direction cards, then the apps seen sending.
'use strict';

UI.tab({
  id: 'notifications',
  order: 45,
  title: 'Notifications',
  icon: 'bell',
  color: 'linear-gradient(#ff6961, #ff3b30)',
  desc: 'See one computer’s notifications on the other.',
  // One switch for the whole tab (both directions); each direction is shared with the
  // other computer per pair (pair.sync), so flipping it there flips it here.
  master: { get: (s) => s.notifs.send || s.notifs.receive, set: (v) => UI.api.setNotifs({ send: v, receive: v }) },
  badge: (s) => (s.notifs.send || s.notifs.receive ? 'on' : ''),
  build(body) {
    const { el, api } = UI;
    const t = (k, p, d) => (typeof window.t === 'function' ? window.t(k, p, d) : d !== undefined ? d : k);
    const hideSw = UI.switch((v) => api.setNotifs({ hideText: v }), { label: t('notifs.hide_message_text', null, 'Hide message text') });
    const hideRow = UI.row(t('notifs.hide_message_text', null, 'Hide message text'), t('notifs.only_the_app_and_the', null, 'Only the app and the title'), [hideSw]);
    const note = UI.note('info', '');
    const pair = UI.dirCards(
      { on: { get: (s) => s.notifs.receive, set: (v) => api.setNotifs({ receive: v }) }, label: t('notifs.show_name_s_notifications_on', null, 'Show {name}’s notifications on {me}'), rows: [] },
      { on: { get: (s) => s.notifs.send, set: (v) => api.setNotifs({ send: v }) }, label: t('notifs.show_me_s_notifications_on', null, 'Show {me}’s notifications on {name}'), rows: [hideRow] },
    );
    const recvRow = pair.a.main, sendRow = pair.b.main;
    const histList = el('div');
    const clearBtn = UI.button(t('clipboard.clear', null, 'Clear'), () => api.clearNotifHistory(), 'small');
    const histCard = UI.card(t('notifs.recent_notifications', null, 'Recent Notifications'), [histList], clearBtn);
    const apps = el('div');

    body.append(note, pair.el, histCard, UI.card(t('nav.apps', null, 'Apps'), [apps]));

    let key = '';
    let histKey = '';
    return (s) => {
      const n = s.notifs;
      const p = UI.peer(s);
      const connected = s.link.state === 'connected';
      pair.update(s);
      note.set('');
      hideSw.set(n.hideText);
      recvRow.setHint(n.receive && n.shown ? (n.shown === 1 ? t('notifs.shown_one', { count: n.shown }, '{count} shown') : t('notifs.shown_other', { count: n.shown }, '{count} shown')) : t('notifs.as_windows_notifications_from_duodesk', null, 'As Windows notifications, from DuoDesk'));
      sendRow.setHint(n.readable === false ? t('notifs.windows_notification_list_can_t', null, 'Windows’ notification list can’t be read')
        : !n.send ? '' : !connected ? t('notifs.also_switches_it_on_the', null, 'Also switches it on the other computer') : n.sent ? (n.sent === 1 ? t('notifs.sent_one', { count: n.sent }, '{count} sent') : t('notifs.sent_other', { count: n.sent }, '{count} sent')) : t('notifs.as_native_notifications_there', null, 'As native notifications there'));

      // Recent notifications
      const history = n.history || [];
      const icons = n.historyIcons || {};
      const hk = JSON.stringify([history.map((h) => [h.id, h.at]), Object.keys(icons)]);
      if (hk !== histKey) {
        histKey = hk;
        if (history.length) {
          histList.replaceChildren(...history.map((item) => {
            const appName = item.appName || item.app;
            const isPhone = UI.isPhone(s);
            const openBtn = isPhone && item.app ? UI.button(t('files.open', null, 'Open'), () => api.openNotifiedApp({ app: item.app, appName }), 'small') : null;
            const time = UI.ago(item.at);
            const topText = [appName, item.title].filter(Boolean).join(' · ');
            const subText = [item.subtitle, item.body].filter(Boolean).join(' — ') || t('notifs.notification', null, 'Notification');
            const r = UI.row(topText, `${subText} · ${time}`, [openBtn]);
            if (icons[item.app]) {
              const img = el('img', { src: icons[item.app], style: 'width: 20px; height: 20px; border-radius: 4px; margin-right: 8px; vertical-align: middle; flex-shrink: 0;' });
              r.querySelector('.text').prepend(img);
              r.classList.add('with-ico');
            }
            return r;
          }));
        } else {
          histList.replaceChildren(UI.row(t('notifs.no_notifications_yet', null, 'No notifications yet'), t('notifs.incoming_notifications_from_whatsapp_instagram', null, 'Incoming notifications from WhatsApp, Instagram, and other apps will appear here in real-time.')));
        }
      }

      const k = JSON.stringify([n.apps.map((a) => a.app), n.muted]);
      if (k === key) return;
      key = k;
      apps.replaceChildren(...(n.apps.length
        ? n.apps.map((a) => {
          const sw = UI.switch((v) => api.muteNotifApp({ app: a.app, muted: !v }), { label: t('notifs.send_app', { app: a.appName }, 'Send {app}') });
          sw.set(!n.muted.includes(a.app));
          return UI.row(a.appName, '', [sw]);
        })
        : [UI.row(t('notifs.no_notifications_yet', null, 'No notifications yet'), t('notifs.apps_show_up_here_after', null, 'Apps show up here after their first notification while sending is on'))]));
    };
  },
});
