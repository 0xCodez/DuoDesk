// MacShare — Copyright (C) 2026 MacShare contributors. GPL-3.0, see LICENSE.
// Tabs for features on the roadmap (BUILD_PLAN "Roadmap"): what they will do, how, which phase,
// and the switches they will have (disabled until then). Same pages as the Mac, PC wording.
'use strict';

(() => {
  const ROADMAP = [
    {
      id: 'files', order: 50, title: 'Files', phase: '7, 9', color: 'linear-gradient(#64d2ff, #0a84ff)',
      desc: 'Each computer’s folders as a drive on the other, and drag and drop between them.',
      what: [
        ['Network drives, both ways', 'Pick a folder on each computer; it appears as a drive on the other and reconnects by itself.'],
        ['Drag and drop into Monitor 2', 'Drop files from this PC onto Monitor 2 and they land on the Mac where you dropped them.'],
        ['Drag across the edge', 'Later: drag a file from one screen to the other while sharing the cursor.'],
      ],
      how: 'A one-time setup on each side (asks for administrator rights once): an SMB share for the chosen folder, with credentials exchanged over the paired, encrypted link.',
      settings: ['Share a folder of this PC with the Mac', 'Connect the Mac’s shared folder as a drive', 'Send files dropped onto Monitor 2'],
    },
    {
      id: 'terminal', order: 60, title: 'Terminal', phase: '8', color: 'linear-gradient(#3a3a3c, #1c1c1e)',
      desc: 'A shell on the other computer, one click or one command away.',
      what: [
        ['PC → Mac', 'Type “macshare” in a terminal here to get a shell on the Mac.'],
        ['Mac → PC', 'The Mac types “macshare-pc” to reach this PC (needs Windows’ OpenSSH Server).'],
        ['Open from here', 'A button in this tab opens Windows Terminal already connected.'],
      ],
      how: 'SSH keys are created on each side and exchanged over the paired link — no passwords to type. Mac → PC turns on the OpenSSH Server optional feature (asks once).',
      settings: ['Add the macshare command', 'Allow the Mac to open a shell here'],
    },
    {
      id: 'audio', order: 70, title: 'Audio', phase: '10', color: 'linear-gradient(#ff6482, #ff2d55)',
      desc: 'Hear one computer’s sound on the other.',
      what: [
        ['Mac → PC', 'Sound from the Mac plays through this PC’s speakers, in sync with Monitor 2.'],
        ['PC → Mac', 'This PC’s sound plays on the Mac.'],
        ['Mute here', 'Optionally silence the computer whose sound is being sent.'],
      ],
      how: 'System audio is captured (WASAPI loopback here, ScreenCaptureKit on the Mac) and sent as an audio track on the same encrypted connection as the screen.',
      settings: ['Play the Mac’s sound here', 'Send this PC’s sound to the Mac', 'Mute this PC while sending'],
    },
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
