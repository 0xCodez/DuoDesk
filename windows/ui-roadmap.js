// MacShare — Copyright (C) 2026 MacShare contributors. GPL-3.0, see LICENSE.
// Tabs for features still on the roadmap (BUILD_PLAN "Roadmap"): Apps. Same page as the Mac, PC wording.
'use strict';

(() => {
  const ROADMAP = [
    {
      id: 'apps', order: 80, title: 'Apps', phase: '12–13', color: 'linear-gradient(#bf5af2, #5e5ce6)',
      desc: 'Mac apps as their own windows on this PC, with their own taskbar button.',
      what: [
        ['Mac apps here', 'This tab lists the Mac’s apps with their icons.'],
        ['One click to open', 'The app opens on the Mac, and only its window appears here, with its own taskbar button.'],
        ['The other way', 'Later: PC apps in their own windows on the Mac.'],
      ],
      how: 'Apps open on the MacShare display; this PC cuts each app window out of the stream into its own window and maps your input to it.',
      settings: ['Show the Mac’s apps here', 'Pin Mac apps to the taskbar'],
    },
  ];

  for (const r of ROADMAP) UI.comingTab(r);
})();
