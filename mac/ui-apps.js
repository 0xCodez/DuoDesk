// MacShare — Copyright (C) 2026 MacShare contributors. GPL-3.0, see LICENSE.
// Apps tab (revision 2): Mac apps on the PC and PC apps on this Mac, in equal places.
'use strict';

UI.tab({
  id: 'apps',
  order: 80,
  title: 'Apps',
  desc: 'Open an app of one computer from the other. Each app window shows up as its own window there, with its own taskbar or Dock icon.',
  color: 'linear-gradient(#bf5af2, #5e5ce6)',
  badge: (s) => (s.apps && s.apps.offer ? 'on' : ''),
  build(body) {
    const { api } = UI;
    const offerSw = UI.switch((v) => api.setApps({ offer: v }), { label: 'Show this Mac’s apps on the PC' });
    const offerRow = UI.row('Show this Mac’s apps on the PC', '', [offerSw]);
    const usage = UI.row('Opened from the PC', '');
    body.append(
      UI.pair(
        UI.dir('m2w', [
          offerRow,
          usage,
          UI.row('How it works', 'The app opens here on the screen you share (Display › Mac → PC) and its windows move onto it; the PC cuts each window out of the stream at 1:1 size. Extend with the MacShare virtual display keeps them off this Mac’s own screen.'),
        ], { role: 'this Mac’s apps' }),
        UI.dir('w2m', [
          UI.row('Show the PC’s apps here', 'Each PC app in its own Mac window with a Dock icon', [UI.switch(() => {}, { disabled: true, label: 'PC apps here' })]),
          UI.row('Open PC apps from this Mac', 'A list of the PC’s apps with their icons'),
        ], { role: 'the PC’s apps', soon: '13' }),
      ),
    );
    return (s) => {
      const a = s.apps;
      if (!a) return;
      offerSw.set(a.offer);
      offerRow.setHint(!a.offer ? 'Off — the PC can’t see or open this Mac’s apps'
        : !s.sharing || !s.sharing.on ? 'App windows come from the shared screen — turn on Display › Mac → PC'
          : !s.permissions.accessibility ? 'Grant Accessibility (General) so app windows can be moved onto the shared screen'
            : s.client ? `Ready — open the Apps tab in ${s.client.name}’s MacShare app` : 'Ready — waiting for your PC to connect');
      usage.setHint(a.launched.length ? `${a.launched.length} app${a.launched.length > 1 ? 's' : ''} · ${a.windows} window${a.windows === 1 ? '' : 's'} on the PC` : 'Nothing yet');
    };
  },
});
