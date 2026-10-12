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
    {
      id: 'files', order: 50, title: 'Files', phase: '7, 9', color: 'linear-gradient(#64d2ff, #0a84ff)',
      desc: 'Each computer’s folders as a drive on the other, and drag and drop between them.',
      what: [
        ['Network drives, both ways', 'Pick a folder on each computer; it appears as a drive on the other and reconnects by itself.'],
        ['Drag and drop into Monitor 2', 'Drop files from the PC onto Monitor 2 and they land on the Mac where you dropped them.'],
        ['Drag across the edge', 'Later: drag a file from one screen to the other while sharing the cursor.'],
      ],
      how: 'A one-time setup on each side (asks for an administrator password once): SMB sharing for the chosen folder, with credentials exchanged over the paired, encrypted link.',
      settings: ['Share a folder of this Mac with the PC', 'Connect the PC’s shared folder here', 'Accept files dropped onto Monitor 2'],
    },
    {
      id: 'terminal', order: 60, title: 'Terminal', phase: '8', color: 'linear-gradient(#3a3a3c, #1c1c1e)',
      desc: 'A shell on the other computer, one click or one command away.',
      what: [
        ['PC → Mac', 'Type “macshare” in a PC terminal to get a shell on this Mac.'],
        ['Mac → PC', 'Type “macshare-pc” in Terminal to reach the PC (needs Windows’ OpenSSH Server).'],
        ['Open from here', 'A button in this tab opens Terminal already connected.'],
      ],
      how: 'SSH keys are created on each side and exchanged over the paired link — no passwords to type. Turning it on enables Remote Login on the Mac (asks once).',
      settings: ['Allow the PC to open a shell here', 'Add the macshare-pc command'],
    },
    {
      id: 'audio', order: 70, title: 'Audio', phase: '10', color: 'linear-gradient(#ff6482, #ff2d55)',
      desc: 'Hear one computer’s sound on the other.',
      what: [
        ['Mac → PC', 'Sound from the Mac plays through the PC’s speakers, in sync with Monitor 2.'],
        ['PC → Mac', 'The PC’s sound plays on the Mac.'],
        ['Mute here', 'Optionally silence the computer whose sound is being sent.'],
      ],
      how: 'System audio is captured (ScreenCaptureKit on the Mac, WASAPI loopback on the PC) and sent as an audio track on the same encrypted connection as the screen.',
      settings: ['Send this Mac’s sound to the PC', 'Play the PC’s sound here', 'Mute this Mac while sending'],
    },
    {
      id: 'apps', order: 80, title: 'Apps', phase: '12–13', color: 'linear-gradient(#bf5af2, #5e5ce6)',
      desc: 'Mac apps as their own windows on the PC, with their own taskbar icon.',
      what: [
        ['App list on the PC', 'The PC shows this Mac’s apps with their icons.'],
        ['One click to open', 'The app opens here, and only its window appears on the PC, with its own taskbar button.'],
        ['The other way', 'Later: PC apps in their own windows on the Mac.'],
      ],
      how: 'Apps open on the MacShare display; the PC cuts each app window out of the stream into its own window and maps your input to it.',
      settings: ['Show this Mac’s apps on the PC', 'Open apps on the MacShare display'],
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
