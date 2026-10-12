// MacShare — Copyright (C) 2026 MacShare contributors. GPL-3.0, see LICENSE.
// Display › Share tab: this PC's screen on the Mac (roadmap phase 11) — not built yet.
'use strict';

UI.comingTab({
  id: 'share',
  group: 'Display',
  order: 10,
  title: 'Share',
  heading: 'Share this screen',
  icon: 'display',
  color: 'linear-gradient(#5ac8fa, #0a84ff)',
  phase: '11',
  desc: 'Show this PC’s screen in a window on the Mac, and control it from there.',
  what: [
    ['This PC on the Mac', 'Pick a monitor of this PC; it appears in a window on the Mac, like Monitor 2 the other way round.'],
    ['Control from the Mac', 'Mouse and keyboard in that window drive this PC.'],
    ['An extra monitor', 'Later: a virtual monitor for this PC, so the Mac becomes its second screen.'],
  ],
  how: 'The same encrypted video path as Receive on this PC, the other way round: this PC captures and encodes its screen, the Mac plays it; input goes back over the paired link.',
  settings: ['Share this PC’s screen with the Mac', 'Let the Mac control this PC in that window'],
});
