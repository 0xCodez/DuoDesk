// MacShare — Copyright (C) 2026 MacShare contributors. GPL-3.0, see LICENSE.
// Apps tab (phase 12): let the PC list and open this Mac's apps, each in its own PC window.
'use strict';

UI.tab({
  id: 'apps',
  order: 80,
  title: 'Apps',
  desc: 'Open Mac apps from the PC. Each app window shows up on the PC as its own window, with its own taskbar button.',
  color: 'linear-gradient(#bf5af2, #5e5ce6)',
  master: { get: (s) => s.apps && s.apps.offer, set: (v) => UI.api.setApps({ offer: v }) },
  badge: (s) => (s.apps && s.apps.offer ? 'on' : ''),
  build(body) {
    const status = UI.note('info', '');
    const open = UI.row('Open from the PC', '');
    body.append(
      status,
      UI.card('Apps on the PC', [
        open,
        UI.row('How it works', 'The app opens here on the screen you share (Display › Share). Its windows are moved onto that screen, and the PC cuts each one out of the stream into its own window.'),
        UI.row('Tip', 'Use Extend with the MacShare virtual display: app windows then live there and don’t clutter this Mac’s own screen.'),
      ]),
      UI.card('Later', [
        UI.row('PC apps on this Mac', 'Windows apps in their own Mac windows with a Dock icon — a later phase', [UI.switch(() => {}, { disabled: true, label: 'PC apps here' })]),
      ], { cls: 'keep-on' }),
    );
    return (s) => {
      const a = s.apps;
      if (!a) return;
      open.setHint(a.launched.length ? `${a.launched.length} app${a.launched.length > 1 ? 's' : ''} opened from the PC · ${a.windows} window${a.windows === 1 ? '' : 's'} on the PC` : 'Nothing opened from the PC yet');
      let kind = 'info';
      let text;
      if (!a.offer) text = 'Off — the PC can’t see or open this Mac’s apps.';
      else if (!s.sharing || !s.sharing.on) { kind = 'warn'; text = 'App windows come from the shared screen — turn on Display › Share.'; }
      else if (!s.permissions.accessibility) { kind = 'warn'; text = 'Grant Accessibility (General) so app windows can be moved onto the shared screen.'; }
      else text = s.client ? `Ready — open the Apps tab in ${s.client.name}’s MacShare app.` : 'Ready — waiting for your PC to connect.';
      status.className = `note ${kind}`;
      status.set(text);
    };
  },
});
