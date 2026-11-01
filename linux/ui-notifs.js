// TwinDesk — Copyright (C) 2026 inukaasith. GPL-3.0, see LICENSE.
// Notifications tab: the other computer's notifications here as Windows
// toasts from DuoDesk, and this PC's on the other computer (read from Windows' notification
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
    const apps = el('div');

    body.append(note, pair.el, UI.card(t('nav.apps', null, 'Apps'), [apps]));

    let key = '';
    return (s) => {
      const n = s.notifs;
      const p = UI.peer(s);
      const connected = s.link.state === 'connected';
      pair.update(s);
      note.set('');
      hideSw.set(n.hideText);
      recvRow.setHint(n.receive && n.shown ? t('notifs.count_shown', { count: n.shown }, '{count} shown') : t('notifs.as_desktop_notifications_from_duodesk', null, 'As desktop notifications, from DuoDesk'));
      sendRow.setHint(n.readable === false ? t('notifs.can_t_read_this_desktop', null, 'Can’t read this desktop’s notifications (dbus-monitor missing)')
        : !n.send ? '' : !connected ? t('notifs.also_switches_it_on_the', null, 'Also switches it on the other computer') : n.sent ? t('notifs.count_sent', { count: n.sent }, '{count} sent') : t('notifs.as_native_notifications_there', null, 'As native notifications there'));

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
