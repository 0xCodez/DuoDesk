// TwinDesk — Copyright (C) 2026 inukaasith. GPL-3.0, see LICENSE.
// Cursor lock: the pointer stays on the device it is on now, whichever computer the mouse is plugged
// into. At home the edges don't cross; while driven the way back isn't watched; while driving the
// driven device is told (kvm.lock) and stops watching its edges. The lock key switches it: at home the
// helper (Linux) or a global shortcut (Mac, Windows) sees it, while driving it passes through
// LockKey.intercept() on its way to the other computer and is used up there. Going home or away by
// any other means (the hotkey, the tray, a disconnect) ends the lock.
'use strict';

// Scroll Lock, as Synergy and Input Leap use it. A Mac has none: a PC keyboard's Scroll Lock is F14 there.
const DEFAULT_KEYS = { mac: 'F14', win: 'Scrolllock', linux: 'Scrolllock' };

// Keys that may be a shortcut on their own: nobody types with them (and Electron's global shortcuts take them).
const BARE = /^(?:Scrolllock|F(?:1[3-9]|2[0-4]))$/;
const MOD = /^(?:Control|Alt|Shift|Super|Command)$/;
const KEY = /^(?:[A-Z0-9]|F(?:[1-9]|1[0-9]|2[0-4])|Space|Tab|Backspace|Delete|Enter|Up|Down|Left|Right|Scrolllock)$/;

// An Electron accelerator for the lock: a bare key from BARE, or Control/Alt/Super/Command (Shift
// alone isn't enough) plus one key. '' = no lock key. Anything else: dflt.
function validKeys(v, dflt) {
  if (v === '') return '';
  if (typeof v !== 'string' || v.length > 60) return dflt;
  const parts = v.split('+');
  const key = parts.pop();
  if (!KEY.test(key) || !parts.every((p) => MOD.test(p)) || new Set(parts).size !== parts.length) return dflt;
  if (!parts.length) return BARE.test(key) ? v : dflt;
  return parts.some((p) => p !== 'Shift') ? v : dflt;
}

// A DOM key code ("KeyL", "ScrollLock") as the key of an accelerator ("L", "Scrolllock").
function keyName(code) {
  if (/^Key[A-Z]$/.test(code)) return code.slice(3);
  if (/^Digit\d$/.test(code)) return code.slice(5);
  return { ScrollLock: 'Scrolllock', ArrowUp: 'Up', ArrowDown: 'Down', ArrowLeft: 'Left', ArrowRight: 'Right' }[code] || code;
}

const MODS = { ControlLeft: 'Control', ControlRight: 'Control', AltLeft: 'Alt', AltRight: 'Alt', ShiftLeft: 'Shift', ShiftRight: 'Shift', MetaLeft: 'Super', MetaRight: 'Super' };
const SAME = { Command: 'Super', Meta: 'Super', Cmd: 'Super', Option: 'Alt', Ctrl: 'Control' };

// The key events of this computer's keyboard while it drives another one (kvm.js): the lock key and its
// release are used up there, so they never reach the other computer.
class LockKey {
  constructor(getKeys) {
    this.getKeys = getKeys; // () => the accelerator (settings.keys.lockKeys)
    this.held = new Set();
    this.eaten = new Set();
  }

  // True when the event was the lock key (or its release): don't send it.
  intercept(e) {
    if (!e || (e.t !== 'k.kd' && e.t !== 'k.ku') || typeof e.code !== 'string') return false;
    if (MODS[e.code]) {
      if (e.t === 'k.kd') this.held.add(e.code);
      else this.held.delete(e.code);
      return false;
    }
    if (e.t === 'k.ku') return this.eaten.delete(e.code);
    const acc = this.getKeys();
    if (!acc) return false;
    const parts = acc.split('+');
    if (parts.pop() !== keyName(e.code)) return false;
    const want = [...new Set(parts.map((p) => SAME[p] || p))].sort().join('+');
    const have = [...new Set([...this.held].map((c) => MODS[c]))].sort().join('+');
    if (want !== have) return false;
    this.eaten.add(e.code);
    return true;
  }

  reset() {
    this.held.clear();
    this.eaten.clear();
  }
}

// Mac and Windows: the lock key at home is one of Electron's global shortcuts. It takes the key from
// every other app, so main holds it only while a device is connected: sync(accelerator or '').
class GlobalLockKey {
  constructor(globalShortcut, onPress) {
    this.gs = globalShortcut;
    this.onPress = onPress;
    this.want = '';
    this.held = '';
    this.error = '';
  }

  sync(acc) {
    acc = acc || '';
    if (acc === this.want) return;
    this.want = acc;
    if (this.held) {
      try { this.gs.unregister(this.held); } catch (_) { /* already gone */ }
    }
    this.held = '';
    this.error = '';
    if (!acc) return;
    let ok = false;
    try { ok = this.gs.register(acc, this.onPress); } catch (_) { /* not an accelerator here */ }
    if (ok) this.held = acc;
    else this.error = 'Couldn’t use ' + keysLabel(acc, process.platform === 'darwin' ? 'mac' : 'win') + '. Another app may have it.';
  }
}

// "Scrolllock" → "Scroll Lock", "Control+Alt+L" → "Ctrl+Alt+L" (mac: ⌃⌥⌘ names).
function keysLabel(acc, os) {
  if (!acc) return 'None';
  const mac = os === 'mac';
  const NAMES = { Scrolllock: 'Scroll Lock', Control: mac ? '⌃' : 'Ctrl', Alt: mac ? '⌥' : 'Alt', Shift: mac ? '⇧' : 'Shift', Command: '⌘', Super: mac ? '⌘' : os === 'win' ? 'Win' : 'Super' };
  return acc.split('+').map((p) => NAMES[p] || p).join(mac ? '' : '+');
}

module.exports = { DEFAULT_KEYS, validKeys, keyName, keysLabel, LockKey, GlobalLockKey, TOGGLE_GAP_MS: 300 };
