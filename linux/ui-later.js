// MacShare — Copyright (C) 2026 MacShare contributors. GPL-3.0, see LICENSE.
// Tabs that aren't on Linux yet (docs/LINUX.md "Phases"): same places, names and colours as the
// other apps, each a short page saying what is coming and when.
'use strict';

(() => {
  const later = (def, what, when) => UI.tab({
    ...def,
    master: { get: () => false, set: () => {}, disabled: true },
    badge: () => '',
    build(body) {
      body.append(UI.el('div', { class: 'card soon keep-on' }, [
        UI.el('div', { class: 'soon-head' }, [UI.el('span', { class: 'pill muted', text: 'Not on Linux yet' })]),
        UI.el('div', { class: 'soon-item' }, [UI.el('strong', { text: what }), UI.el('div', { class: 'hint', text: when })]),
      ]));
    },
  });

  later({ id: 'pc-mac', group: 'Display', order: 11, title: 'Linux → Mac', heading: 'This screen on the Mac', icon: 'display',
    color: 'linear-gradient(#5ac8fa, #0a84ff)', desc: 'Show this computer’s screen on your Mac.' },
  'This screen in a window on the Mac.', 'Coming with sound in a later Linux version.');
  later({ id: 'cursor', order: 20, title: 'Cursor', color: 'linear-gradient(#ffb340, #ff9500)', desc: 'One mouse for both computers.' },
    'Move the pointer across the screen edge to the Mac and back.', 'Coming next. Needs an X11 session (Log in with Xorg).');
  later({ id: 'keyboard', order: 30, title: 'Keyboard', color: 'linear-gradient(#d1d1d6, #8e8e93)', desc: 'One keyboard for both computers.' },
    'Type on the Mac with this keyboard, Ctrl acting as Command.', 'Coming next, with the cursor.');
  later({ id: 'files', order: 50, title: 'Files', color: 'linear-gradient(#64d2ff, #0a84ff)', desc: 'Move files between the two computers.' },
    'Drag files across the edge and drop them on the Mac’s screen.', 'Not on Linux yet.');
  later({ id: 'terminal', order: 60, title: 'Terminal', color: 'linear-gradient(#3a3a3c, #1c1c1e)', desc: 'A shell on the other computer.' },
    'Open a shell on the Mac without a password.', 'Not on Linux yet.');
  later({ id: 'audio', order: 70, title: 'Audio', color: 'linear-gradient(#ff6482, #ff2d55)', desc: 'Hear one computer on the other.' },
    'The Mac’s sound here, and this computer’s sound on the Mac.', 'Coming with Linux → Mac.');
  later({ id: 'apps', order: 80, title: 'Apps', color: 'linear-gradient(#bf5af2, #5e5ce6)', desc: 'Mac apps in their own windows here.' },
    'Open a Mac app and use its window on this computer.', 'Not on Linux yet.');
})();
