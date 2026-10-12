// MacShare — Copyright (C) 2026 MacShare contributors. GPL-3.0, see LICENSE.
// Tabs for features on the roadmap (BUILD_PLAN "Roadmap"): what they will do, how, which phase,
// and the switches they will have (disabled until then).
'use strict';

(() => {
  const ROADMAP = [
    {
      id: 'receive', group: 'Display', order: 11, heading: 'Receive a screen', icon: 'receive',
      title: 'Receive', phase: '11', color: 'linear-gradient(#5ac8fa, #0a84ff)',
      desc: 'Show the PC’s screen in a window on this Mac and control the PC from it.',
      what: [
        ['The PC’s screen here', 'A window on this Mac shows the PC’s screen (or one of its monitors), sharp and with low latency.'],
        ['Control from the window', 'Your Mac’s trackpad and keyboard work inside that window, with ⌘ shortcuts sent as Ctrl.'],
        ['Extra PC monitor', 'Later: a virtual monitor on the PC that only shows up here (needs a signed Windows driver).'],
      ],
      how: 'The same path as sharing this Mac’s screen, the other way round: the PC captures and encodes, this Mac shows it, and input goes back over the paired link.',
      settings: ['Show the PC’s screen in a window', 'Control the PC from that window', 'Open full screen'],
    },
  ];

  for (const r of ROADMAP) {
    UI.tab({
      id: r.id,
      group: r.group,
      order: r.order,
      heading: r.heading,
      icon: r.icon,
      title: r.title,
      desc: r.desc,
      color: r.color,
      phase: r.phase,
      master: { get: () => false, set: () => {}, disabled: true },
      build(body) {
        const { el } = UI;
        body.append(
          el('div', { class: 'card soon keep-on' }, [
            el('div', { class: 'soon-head' }, [el('span', { class: 'pill', text: `Coming in phase ${r.phase}` })]),
            ...r.what.map(([t, d]) => el('div', { class: 'soon-item' }, [el('strong', { text: t }), el('div', { class: 'hint', text: d })])),
          ]),
          UI.card('How it will work', [UI.row(r.how, '')], { cls: 'keep-on' }),
          UI.card('Settings it will have', r.settings.map((label) => UI.row(label, '', [UI.switch(() => {}, { disabled: true, label })]))),
        );
      },
    });
  }
})();
