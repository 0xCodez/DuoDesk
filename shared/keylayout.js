// TwinDesk — Copyright (C) 2026 inukaasith. GPL-3.0, see LICENSE.
// Shortcuts across keyboard layouts (one-to-one and Multi-device). Keys go as their physical place
// (`code`), which types what that place types on the other computer's layout: a German Mac's Cmd+Z
// is the key in the Y place, Ctrl+Y (redo) on an English PC. So each key also says the letter it
// types on our layout (`ch`, k.kd / k.ku: from the helper's keyLayout, what each key types alone),
// and while Ctrl or Cmd is held, the other side presses its own key for that letter instead (the
// Z place on the English PC: undo). Without Ctrl or Cmd keys stay where they are (typing follows the
// layout of the computer typed on), as do letters the other layout has no key for (a Russian one)
// and keys from an older app (no `ch`).
'use strict';

const LETTER = /^[a-z]$/;
const SHORTCUT = new Set(['ControlLeft', 'ControlRight', 'MetaLeft', 'MetaRight']);

// The helper's keyLayout reply → {code: char}, single characters only.
function clean(layout) {
  const out = {};
  if (!layout || typeof layout !== 'object') return out;
  for (const [code, ch] of Object.entries(layout)) {
    if (typeof code === 'string' && code.length <= 32 && typeof ch === 'string' && [...ch].length === 1) out[code] = ch;
  }
  return out;
}

class KeyLayout {
  // request(cmd, args) -> Promise of the helper's reply.
  constructor(request) {
    this.request = request;
    this.map = {}; // code -> what it types alone
    this.byChar = new Map(); // a–z -> our code for it
    this.mods = new Set(); // Ctrl / Cmd held (receiving)
    this.held = new Map(); // code pressed -> code injected for it (its key-up goes to the same one)
  }

  // Ask the helper again (the layout may have changed): on every crossing, either way.
  refresh() {
    return Promise.resolve()
      .then(() => this.request('keyLayout', {}))
      .then((r) => this.set(r && r.layout))
      .catch(() => {}); // an older helper: no letters, keys as they are
  }

  set(layout) {
    this.map = clean(layout);
    this.byChar = new Map();
    for (const [code, ch] of Object.entries(this.map)) {
      if (!LETTER.test(ch)) continue;
      // Two keys for one letter (rare): the one in that letter's own place.
      if (!this.byChar.has(ch) || code === `Key${ch.toUpperCase()}`) this.byChar.set(ch, code);
    }
  }

  // Sending: the key event with the letter it types here, if it types one.
  tag(ev) {
    const ch = ev && typeof ev.code === 'string' ? this.map[ev.code] : undefined;
    return ch && LETTER.test(ch) ? { ...ev, ch } : ev;
  }

  // Receiving (after the Ctrl/Cmd swap): the code to press here for this key event.
  code(down, code, ch) {
    if (SHORTCUT.has(code)) {
      if (down) this.mods.add(code);
      else this.mods.delete(code);
      return code;
    }
    if (!down) {
      const was = this.held.get(code);
      this.held.delete(code);
      return was || code;
    }
    if (this.held.has(code)) return this.held.get(code); // held down: the repeats go to the same key
    let to = code;
    if (this.mods.size && typeof ch === 'string' && LETTER.test(ch)) {
      const here = this.byChar.get(ch);
      if (here) to = here;
    }
    if (to !== code) this.held.set(code, to);
    return to;
  }

  // Driven no more (or the helper released everything): nothing held.
  reset() {
    this.mods.clear();
    this.held.clear();
  }
}

module.exports = { KeyLayout, clean };
