// TwinDesk — Copyright (C) 2026 inukaasith. GPL-3.0, see LICENSE.
// DOM KeyboardEvent.code <-> Linux evdev key codes (linux/input-event-codes.h). X keycode =
// evdev + 8 with the evdev/libinput drivers. Same keys as windows-helper/src/Keys.cs.
#include "helper.h"
#include <string.h>
#include <X11/XKBlib.h>

typedef struct { const char *code; int ev; } Key;

static const Key KEYS[] = {
  { "Escape", 1 },
  { "Digit1", 2 }, { "Digit2", 3 }, { "Digit3", 4 }, { "Digit4", 5 }, { "Digit5", 6 },
  { "Digit6", 7 }, { "Digit7", 8 }, { "Digit8", 9 }, { "Digit9", 10 }, { "Digit0", 11 },
  { "Minus", 12 }, { "Equal", 13 }, { "Backspace", 14 }, { "Tab", 15 },
  { "KeyQ", 16 }, { "KeyW", 17 }, { "KeyE", 18 }, { "KeyR", 19 }, { "KeyT", 20 },
  { "KeyY", 21 }, { "KeyU", 22 }, { "KeyI", 23 }, { "KeyO", 24 }, { "KeyP", 25 },
  { "BracketLeft", 26 }, { "BracketRight", 27 }, { "Enter", 28 }, { "ControlLeft", 29 },
  { "KeyA", 30 }, { "KeyS", 31 }, { "KeyD", 32 }, { "KeyF", 33 }, { "KeyG", 34 },
  { "KeyH", 35 }, { "KeyJ", 36 }, { "KeyK", 37 }, { "KeyL", 38 },
  { "Semicolon", 39 }, { "Quote", 40 }, { "Backquote", 41 }, { "ShiftLeft", 42 }, { "Backslash", 43 },
  { "KeyZ", 44 }, { "KeyX", 45 }, { "KeyC", 46 }, { "KeyV", 47 }, { "KeyB", 48 },
  { "KeyN", 49 }, { "KeyM", 50 },
  { "Comma", 51 }, { "Period", 52 }, { "Slash", 53 }, { "ShiftRight", 54 },
  { "NumpadMultiply", 55 }, { "AltLeft", 56 }, { "Space", 57 }, { "CapsLock", 58 },
  { "F1", 59 }, { "F2", 60 }, { "F3", 61 }, { "F4", 62 }, { "F5", 63 },
  { "F6", 64 }, { "F7", 65 }, { "F8", 66 }, { "F9", 67 }, { "F10", 68 },
  { "NumLock", 69 }, { "ScrollLock", 70 },
  { "Numpad7", 71 }, { "Numpad8", 72 }, { "Numpad9", 73 }, { "NumpadSubtract", 74 },
  { "Numpad4", 75 }, { "Numpad5", 76 }, { "Numpad6", 77 }, { "NumpadAdd", 78 },
  { "Numpad1", 79 }, { "Numpad2", 80 }, { "Numpad3", 81 }, { "Numpad0", 82 }, { "NumpadDecimal", 83 },
  { "IntlBackslash", 86 }, { "F11", 87 }, { "F12", 88 }, { "IntlRo", 89 },
  { "Convert", 92 }, { "KanaMode", 93 }, { "NonConvert", 94 },
  { "NumpadEnter", 96 }, { "ControlRight", 97 }, { "NumpadDivide", 98 }, { "PrintScreen", 99 },
  { "AltRight", 100 }, { "Home", 102 }, { "ArrowUp", 103 }, { "PageUp", 104 },
  { "ArrowLeft", 105 }, { "ArrowRight", 106 }, { "End", 107 }, { "ArrowDown", 108 },
  { "PageDown", 109 }, { "Insert", 110 }, { "Delete", 111 },
  { "AudioVolumeMute", 113 }, { "AudioVolumeDown", 114 }, { "AudioVolumeUp", 115 },
  { "NumpadEqual", 117 }, { "Pause", 119 }, { "NumpadComma", 121 },
  { "Lang1", 122 }, { "Lang2", 123 }, { "IntlYen", 124 },
  { "MetaLeft", 125 }, { "MetaRight", 126 }, { "ContextMenu", 127 },
  { "MediaTrackNext", 163 }, { "MediaPlayPause", 164 }, { "MediaTrackPrevious", 165 }, { "MediaStop", 166 },
  { "F13", 183 }, { "F14", 184 }, { "F15", 185 }, { "F16", 186 }, { "F17", 187 }, { "F18", 188 },
  { "F19", 189 }, { "F20", 190 }, { "F21", 191 }, { "F22", 192 }, { "F23", 193 }, { "F24", 194 },
};

#define NKEYS (int)(sizeof KEYS / sizeof KEYS[0])

int key_evdev(const char *code) {
  if (!code) return -1;
  for (int i = 0; i < NKEYS; i++) if (!strcmp(KEYS[i].code, code)) return KEYS[i].ev;
  return -1;
}

const char *key_code(int ev) {
  for (int i = 0; i < NKEYS; i++) if (KEYS[i].ev == ev) return KEYS[i].code;
  return NULL;
}

// Keys that type a character: letters, digits, punctuation.
static int typing(const char *code) {
  static const char *PUNCT[] = { "Minus", "Equal", "BracketLeft", "BracketRight", "Backslash", "Semicolon",
    "Quote", "Backquote", "Comma", "Period", "Slash", "IntlBackslash", NULL };
  if (!strncmp(code, "Key", 3) || !strncmp(code, "Digit", 5)) return 1;
  for (int i = 0; PUNCT[i]; i++) if (!strcmp(code, PUNCT[i])) return 1;
  return 0;
}

static void utf8(unsigned cp, char *out) {
  if (cp < 0x80) { out[0] = (char)cp; out[1] = 0; }
  else if (cp < 0x800) { out[0] = (char)(0xc0 | cp >> 6); out[1] = (char)(0x80 | (cp & 0x3f)); out[2] = 0; }
  else if (cp < 0x10000) { out[0] = (char)(0xe0 | cp >> 12); out[1] = (char)(0x80 | (cp >> 6 & 0x3f)); out[2] = (char)(0x80 | (cp & 0x3f)); out[3] = 0; }
  else { out[0] = (char)(0xf0 | cp >> 18); out[1] = (char)(0x80 | (cp >> 12 & 0x3f)); out[2] = (char)(0x80 | (cp >> 6 & 0x3f)); out[3] = (char)(0x80 | (cp & 0x3f)); out[4] = 0; }
}

// keyLayout: what each of those keys types alone in the current X layout (its active group), lower
// case: {"KeyY":"z",…} with a German layout (shared/keylayout.js). Latin-1 and Unicode keysyms; on
// Wayland (no X display here) nothing.
void keys_layout(double id, Display *dpy) {
  JOut map;
  jo_begin(&map);
  XkbStateRec st;
  int group = 0;
  if (dpy && XkbGetState(dpy, XkbUseCoreKbd, &st) == Success) group = st.group;
  for (int i = 0; dpy && i < NKEYS; i++) {
    if (!typing(KEYS[i].code)) continue;
    KeySym ks = XkbKeycodeToKeysym(dpy, (KeyCode)(KEYS[i].ev + 8), group, 0);
    unsigned cp = 0;
    if ((ks >= 0x20 && ks <= 0x7e) || (ks >= 0xa0 && ks <= 0xff)) cp = (unsigned)ks;
    else if ((ks & 0xff000000) == 0x01000000) cp = (unsigned)(ks & 0xffffff);
    if (!cp) continue;
    if ((cp >= 'A' && cp <= 'Z') || (cp >= 0xc0 && cp <= 0xde && cp != 0xd7)) cp += 32;
    char u[8];
    utf8(cp, u);
    jo_str(&map, KEYS[i].code, u);
  }
  JOut o;
  jo_begin(&o);
  jo_num(&o, "id", id);
  jo_bool(&o, "ok", 1);
  jo_raw(&o, "layout", jo_end(&map));
  emit(jo_end(&o));
}
