// MacShare — Copyright (C) 2026 MacShare contributors. GPL-3.0, see LICENSE.
// Notifications tab (revision 5, docs/UI.md): the other computer's notifications here as Windows
// toasts from MacShare, and this PC's on the other computer (read from Windows' notification
// database by the helper). Two direction cards, then the apps seen sending.
'use strict';

UI.tab({
  id: 'notifications',
  order: 45,
  title: 'Notifications',
  icon: 'bell',
  color: 'linear-gradient(#ff6961, #ff3b30)',
  desc: 'See one computer’s notifications on the other.',
  badge: (s) => (s.notifs.send || s.notifs.receive ? 'on' : ''),
  build(body) {
    const { el, api } = UI;
    const recvRow = UI.row('Show them here', '');
    const hideSw = UI.switch((v) => api.setNotifs({ hideText: v }), { label: 'Hide message text' });
    const sendRow = UI.row('Send this PC’s notifications', '');
    const hideRow = UI.row('Hide message text', 'Only the app and the title', [hideSw]);
    const note = UI.note('info', '');
    const pair = UI.dirCards(
      { on: { get: (s) => s.notifs.receive, set: (v) => api.setNotifs({ receive: v }) }, rows: [recvRow] },
      { on: { get: (s) => s.notifs.send, set: (v) => api.setNotifs({ send: v }) }, rows: [sendRow, hideRow] },
    );
    const apps = el('div');

    body.append(note, pair.el, UI.card('Apps', [apps]));

    let key = '';
    return (s) => {
      const n = s.notifs;
      const p = UI.peer(s);
      const connected = s.link.state === 'connected';
      pair.update(s);
      note.set(p.os === 'linux' ? 'Not on Linux yet.' : '');
      hideSw.set(n.hideText);
      recvRow.setHint(n.receive && n.shown ? n.shown + ' shown' : 'From ' + p.the + ', as notifications from MacShare');
      sendRow.setHint(n.readable === false ? 'Windows’ notification list can’t be read'
        : !n.send || !connected ? 'To ' + p.the
          : !n.peerAccepts ? 'Turned off on ' + p.the : n.sent ? n.sent + ' sent' : 'To ' + p.the);

      const k = JSON.stringify([n.apps.map((a) => a.app), n.muted]);
      if (k === key) return;
      key = k;
      apps.replaceChildren(...(n.apps.length
        ? n.apps.map((a) => {
          const sw = UI.switch((v) => api.muteNotifApp({ app: a.app, muted: !v }), { label: 'Send ' + a.appName });
          sw.set(!n.muted.includes(a.app));
          return UI.row(a.appName, '', [sw]);
        })
        : [UI.row('No notifications yet', 'Apps show up here after their first notification while sending is on')]));
    };
  },
});
