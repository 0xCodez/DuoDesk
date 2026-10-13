// TwinDesk — a Mac and a Windows PC that work as one.
// Copyright (C) 2026 inukaasith. Licensed under the GNU GPL v3 (see LICENSE).
//
// Protocol v1 — single source of truth for both apps (see BUILD_PLAN.md and docs/KVM.md).
// Works as a CommonJS module in main processes (require('../shared/protocol.js'))
// and as a plain <script> in renderers (window.MacShareProtocol).
// The crypto helpers exist only where Node's crypto is available (main processes).
(function (root) {
  const P = {
    PROTOCOL_VERSION: 1,
    PORT: 47800, // WSS control channel; the host listens (docs/ROADMAP.md "Revision 4")
    DISCOVERY_PORT: 47801, // UDP beacons, probes and invites; every app sends and listens
    BEACON_MS: 2000,
    PROBE_MS: 10000, // broadcast probe while not connected
    PROBE_REPLY_MS: 1500, // a unicast probe without a reply by then = nobody there
    DEVICE_STALE_MS: 10000, // found device dropped after this much silence
    OS: { MAC: 'mac', WIN: 'win', LINUX: 'linux' },
    PING_MS: 1000,
    TIMEOUT_MS: 4000, // close the session after this much silence
    PAIR_TIMEOUT_MS: 60000,
    UNAUTH_TIMEOUT_MS: 70000, // Mac closes sockets that never authenticate
    RECONNECT_MS: [1000, 2000, 3000], // Windows: then keep using the last value
    MAX_PAYLOAD: 16 * 1024 * 1024,
    SAS_LABEL: 'macshare-sas-v1',

    // Mouse & keyboard sharing (docs/KVM.md)
    KVM_TAKE_TIMEOUT_MS: 1000, // owner goes home if no kvm.accept by then
    KVM_SILENCE_MS: 2000, // while driving/driven: no message from the peer for this long = link lost
    HELPER_KEEPALIVE_MS: 500, // main -> helper keepalive while capturing
    HELPER_DEADMAN_MS: 1500, // helper stops capturing by itself after this much keepalive silence
    RESISTANCE_PX: 120, // default push through an edge before crossing
    DOUBLE_TAP_MS: 400, // hotkey double-tap window
    // The hotkey (double-tap = mouse and keyboard back home), docs/KVM.md "Hotkey (revision 4)".
    // Default Right Alt / Right Option on every OS; settings.keys.hotkey picks one of HOTKEYS.
    HOTKEY_MAC: 'AltRight', // Right Option
    HOTKEY_WIN: 'AltRight', // Right Alt (was Right Ctrl before revision 4)
    // Right, left, or either side ("Alt" = both Alt/Option keys).
    HOTKEYS: ['AltRight', 'AltLeft', 'Alt', 'ControlRight', 'ControlLeft', 'Control',
      'ShiftRight', 'ShiftLeft', 'Shift', 'MetaRight', 'MetaLeft', 'Meta'],
    CLIP_MAX_BYTES: 256 * 1024, // clipboard text limit (UTF-8)
    FILE_CHUNK_BYTES: 64 * 1024, // raw bytes per file.chunk (base64 on the wire)
    FILE_MAX_BYTES: 4 * 1024 * 1024 * 1024, // largest dropped file
    SIDES: ['left', 'right', 'top', 'bottom'],

    // Control message types (field `t`)
    T: {
      BEACON: 'beacon', // UDP {v, id, name, port, fp, os, role: 'host'}
      PROBE: 'probe', // UDP {v, id}: answer with your beacon, unicast to the sender
      INVITE: 'invite', // UDP {v, id, name, os, port, fp}: a Mac asks a PC to pair/connect to it
      // pairing
      PAIR_START: 'pair.start',
      PAIR_NONCE: 'pair.nonce',
      PAIR_REVEAL: 'pair.reveal',
      PAIR_CONFIRM: 'pair.confirm',
      PAIR_OK: 'pair.ok',
      PAIR_CANCEL: 'pair.cancel',
      // session
      HELLO: 'hello',
      WELCOME: 'welcome',
      ERROR: 'error',
      PING: 'ping',
      PONG: 'pong',
      // screen sharing
      STREAM_INFO: 'stream.info',
      STREAM_STOP: 'stream.stop',
      STREAM_INPUT: 'stream.input', // Mac -> Windows: {on} whether the Mac accepts in.* ("Receive input")
      RTC_OFFER: 'rtc.offer',
      RTC_ANSWER: 'rtc.answer',
      RTC_ICE: 'rtc.ice',
      // input inside the Monitor 2 window (absolute, normalized), Windows -> Mac
      IN_MOVE: 'in.mm',
      IN_DOWN: 'in.md',
      IN_UP: 'in.mu',
      IN_WHEEL: 'in.wh',
      IN_KEY_DOWN: 'in.kd',
      IN_KEY_UP: 'in.ku',
      // mouse & keyboard sharing across the two physical screens (relative), either way
      KVM_LAYOUT: 'kvm.layout',
      KVM_TAKE: 'kvm.take',
      KVM_ACCEPT: 'kvm.accept',
      KVM_REFUSE: 'kvm.refuse',
      KVM_RELEASE: 'kvm.release',
      KVM_HOME: 'kvm.home',
      KVM_LINK: 'kvm.link', // either {on}: mouse and keyboard sharing switched on/off (hotkey double-tap); the other side follows
      K_MOVE: 'k.mm',
      K_DOWN: 'k.md',
      K_UP: 'k.mu',
      K_WHEEL: 'k.wh',
      K_KEY_DOWN: 'k.kd',
      K_KEY_UP: 'k.ku',
      // revision 8: a trackpad gesture by what it means, done natively by the driven computer:
      // {g: 'zoom' (v = magnification step, + = in) | 'smartZoom' | 'rotate' (v degrees) | 'back' |
      //  'forward' | 'overview' (Mission Control / Task View) | 'appWindows' | 'desktop' |
      //  'spaceLeft' | 'spaceRight' (the desktop to the left / right) | 'launcher', phase?: 'begin'|'change'|'end'}
      K_GESTURE: 'k.ge',
      // clipboard text
      CLIP: 'clip',
      CLIP_REQUEST: 'clip.request',
      CLIP_POLICY: 'clip.policy', // either way: {accept} — whether this side applies clip from the other
      // roadmap, Bundle B (BUILD_PLAN "Roadmap messages")
      AUDIO_POLICY: 'audio.policy', // W->M {accept}: the PC plays the Mac's sound
      SSH_KEY: 'ssh.key', // W->M {pub}
      SSH_INFO: 'ssh.info', // M->W {enabled, user, port, hostKeys, why?}
      SSH_FORGET: 'ssh.forget', // W->M
      FILE_OFFER: 'file.offer', // W->M {id, name, size, x?, y?, index, count}
      FILE_ACCEPT: 'file.accept', // M->W {id}
      FILE_REFUSE: 'file.refuse', // M->W {id, why}
      FILE_CHUNK: 'file.chunk', // W->M {id, seq, data (base64)}
      FILE_END: 'file.end', // W->M {id, sha256}
      FILE_DONE: 'file.done', // M->W {id, ok, path?, error?}
      FILE_CANCEL: 'file.cancel', // either {id}
      // drag across the edge, revision 3 (docs/ROADMAP.md): a native drag on the receiver, files + folders
      DRAG_START: 'drag.start', // owner->receiver {drag, items: [{name, dir, size}], dirs: [rel], list: [{rel, size}], files, bytes}
      DRAG_CANCEL: 'drag.cancel', // owner->receiver {drag}
      DRAG_END: 'drag.end', // receiver->owner {drag, result: 'dropped'|'cancelled'|'failed', where?}
      DRAG_POLICY: 'drag.policy', // both {accept}: this side takes drags across the edge (assume true until told)
      // revision 5 (docs/ROADMAP.md): notifications, Send files, copy/paste files with shortcuts
      NOTIF: 'notif', // either {id, app, appName, title, subtitle, body, at}: a notification on the sender
      NOTIF_POLICY: 'notif.policy', // either {accept}: this side shows the other's notifications
      FCLIP_OFFER: 'fclip.offer', // either {id, items: [{name, dir, size}], files, bytes}: files copied with the shortcut
      FCLIP_PASTE: 'fclip.paste', // either {id}: paste them here now (the copier then sends file.offer drop:'paste')
      FCLIP_KEY: 'fclip.key', // owner->driven {action:'copy'|'paste'}: the copy/paste shortcut pressed while driving it — do it there
      FCLIP_GONE: 'fclip.gone', // either {id}: nothing to paste any more (files moved, or a newer copy)
      FILES_DONE: 'files.done', // receiver->sender {batch, ok, where?, files}: a Send/paste batch landed
      // roadmap, docs/ROADMAP.md (phases 7, 11, 12; PC -> Mac media)
      RTC2_OFFER: 'rtc2.offer', // W->M {session, sdp, kind}
      RTC2_ANSWER: 'rtc2.answer', // M->W {session, sdp}
      RTC2_ICE: 'rtc2.ice', // either {session, candidate}
      RTC2_STOP: 'rtc2.stop', // W->M {session}
      // App-window sessions (kind 'window') also carry `win`: 'send' from the window's sender
      // (offer, its ice, stop), 'view' from the viewer (answer, its ice). Two PCs both send and
      // view windows, so this says whose session a number is; swapRole leaves these alone.
      AUDIO_OFFER: 'audio.offer', // sender->receiver {dir:'m2w'|'w2m', session, sdp} (revision 2)
      AUDIO_ANSWER: 'audio.answer', // receiver->sender {dir, session, sdp}
      AUDIO_ICE: 'audio.ice', // either {dir, session, candidate}
      AUDIO_STOP: 'audio.stop', // sender->receiver {dir}
      SCREEN_POLICY: 'screen.policy', // either, viewer->sharer {accept, width?, height?}: a viewer is open and wants the picture (revision 7: senders capture only while it is true)
      SCREEN_CTL: 'screen.ctl', // either, viewer->sharer {share?, mode?: 'mirror'|'extend'}: start/stop or switch the other's sharing (revision 7)
      SCREEN_STATE: 'screen.state', // either, sharer->viewer {on, mode, remote, modes}: what this side shares; remote = it takes screen.ctl (revision 7)
      PAIR_SYNC: 'pair.sync', // either {feature, dir: 'out'|'in', on} | {key, value} (shared value, e.g. pace) | {all: {feature: {out, in}, values: {key: value}}} (host, after welcome): two-way switches shared per pair, dirs from the sender's side (revision 7b)
      WOL_INFO: 'wol.info', // either {macs: ['aa:bb:cc:dd:ee:ff'], address}: how to wake this computer over the network (revision 7)
      SMB_OFFER: 'smb.offer', // sharer->other {share, user, password, port}
      SMB_REVOKE: 'smb.revoke', // sharer->other {share}
      SMB_STATE: 'smb.state', // other->sharer {share, mounted, error?}
      APPS_LIST: 'apps.list',
      APPS_RESULT: 'apps.result',
      APP_LAUNCH: 'app.launch',
      APP_LAUNCHED: 'app.launched',
      APP_WINDOWS: 'app.windows', // M->W {windows: [{wid, id, title, x, y, w, h}]} normalized rects
      APP_FOCUS: 'app.focus', // W->M {wid}
      APP_CLOSE: 'app.close', // W->M {wid}
      // phase 13: PC apps on the Mac (docs/ROADMAP.md)
      PAPP_POLICY: 'papp.policy', // M->W {accept}
      PAPPS_LIST: 'papps.list', // M->W
      PAPPS_RESULT: 'papps.result', // W->M {apps: [{id, name, icon}]}
      PAPP_LAUNCH: 'papp.launch', // M->W {id}
      PAPP_LAUNCHED: 'papp.launched', // W->M {id, ok, why?}
      PAPP_WINDOWS: 'papp.windows', // W->M {windows: [{wid, id, title, w, h, scale, popup?, owner?, x?, y?}]}
      PAPP_FOCUS: 'papp.focus', // M->W {wid}
      PAPP_CLOSE: 'papp.close', // M->W {wid}
      PAPP_SIZE: 'papp.size', // M->W {wid, w, h} physical px
    },

    // Error codes (field `code` of an `error` message)
    E: {
      VERSION_MISMATCH: 'version_mismatch',
      BAD_TOKEN: 'bad_token',
      PAIR_REFUSED: 'pair_refused',
      PAIR_TIMEOUT: 'pair_timeout',
      BUSY: 'busy',
      REPLACED: 'replaced',
      BAD_MESSAGE: 'bad_message',
    },

    // Reasons in kvm.refuse
    REFUSE: { NOT_ALLOWED: 'not_allowed', BUSY: 'busy' },

    // Mouse buttons (field `b`)
    BUTTON: { LEFT: 0, RIGHT: 1, MIDDLE: 2, BACK: 3, FORWARD: 4 },

    // "AB:CD:..." (Node fingerprint256) -> "abcd..."
    normFingerprint(fp) {
      return String(fp || '').replace(/:/g, '').toLowerCase();
    },

    opposite(side) {
      return { left: 'right', right: 'left', top: 'bottom', bottom: 'top' }[side];
    },

    // "Right Option" / "Left Alt" / "Either Command" / "Right Windows key" — the hotkey in words.
    hotkeyName(code, os = 'mac') {
      const m = /^(Alt|Control|Shift|Meta)(Left|Right)?$/.exec(code || '') || [0, 'Alt', 'Right'];
      const key = (os === 'mac' ? { Alt: 'Option', Control: 'Control', Shift: 'Shift', Meta: 'Command' }
        : { Alt: 'Alt', Control: 'Ctrl', Shift: 'Shift', Meta: 'Windows key' })[m[1]];
      return m[2] ? `${m[2]} ${key}` : `${key} (either side)`;
    },

    // Ctrl/Cmd swapping only between different OSes (Mac <-> PC/Linux); same-OS pairs never swap.
    keySwapNeeded(myOs, peerOs) {
      return (myOs === 'mac') !== ((peerOs || (myOs === 'mac' ? 'win' : 'mac')) === 'mac');
    },

    // Role swap (docs/ROADMAP.md "Revision 4"): an app in its non-native role (a Mac as guest, a PC
    // as host) passes every message it sends AND every message it receives through swapRole, so
    // its feature code keeps speaking its native role. Returns the messages to use instead (0–2).
    // `st` is one object per session and direction: newRoleSwapState().
    ROLE_SWAP: {
      'rtc.offer': 'rtc2.offer', 'rtc2.offer': 'rtc.offer',
      'rtc.answer': 'rtc2.answer', 'rtc2.answer': 'rtc.answer',
      'rtc.ice': 'rtc2.ice', 'rtc2.ice': 'rtc.ice',
      'stream.stop': 'rtc2.stop', 'rtc2.stop': 'stream.stop',
    },
    newRoleSwapState(peerName) {
      return { audio: false, name: peerName || '', width: 0, height: 0 };
    },
    swapRole(msg, st) {
      if (!msg || typeof msg.t !== 'string') return [msg];
      if (msg.win || msg.kind === 'window') return [msg]; // app-window streams keep their rtc2 names
      if (msg.t === 'stream.info') { // folded into the rtc2.offer's kind
        st.audio = !!msg.audio;
        st.width = msg.width | 0;
        st.height = msg.height | 0;
        return [];
      }
      if (msg.t.startsWith('audio.') && (msg.dir === 'm2w' || msg.dir === 'w2m')) {
        return [{ ...msg, dir: msg.dir === 'm2w' ? 'w2m' : 'm2w' }];
      }
      const t = P.ROLE_SWAP[msg.t];
      if (!t) return [msg];
      if (msg.t === 'rtc.offer') return [{ ...msg, t, kind: st.audio ? 'screen+audio' : 'screen' }];
      if (msg.t === 'rtc2.offer') {
        const { kind, ...rest } = msg;
        const audio = kind === 'screen+audio';
        return [
          { t: 'stream.info', name: st.name, width: msg.width | 0, height: msg.height | 0, audio },
          { ...rest, t },
        ];
      }
      return [{ ...msg, t }];
    },

    // Keys travel as physical DOM KeyboardEvent.code names; "Meta" is Command on the Mac and
    // the Windows key on the PC. The RECEIVER applies this swap to every key that came from
    // the other platform, so Cmd+C on the Mac arrives as Ctrl+C on the PC and the reverse
    // (shortcuts keep their meaning). Alt stays Alt (= Option).
    mapKeyFromOtherPlatform(code) {
      const swap = {
        ControlLeft: 'MetaLeft',
        ControlRight: 'MetaRight',
        MetaLeft: 'ControlLeft',
        MetaRight: 'ControlRight',
      };
      return swap[code] || code;
    },
  };

  const nodeCrypto =
    typeof module !== 'undefined' && module.exports && typeof require === 'function'
      ? require('crypto')
      : null;

  if (nodeCrypto) {
    P.randomHex = (bytes) => nodeCrypto.randomBytes(bytes).toString('hex');

    P.sha256Hex = (data) => nodeCrypto.createHash('sha256').update(data).digest('hex');

    // Pairing commit for the Windows nonce: sha256(nonce bytes), hex.
    P.commitOf = (nonceHex) => P.sha256Hex(Buffer.from(nonceHex, 'hex'));

    // 6-digit code both sides show:
    // sha256(SAS_LABEL || fp bytes || nw bytes || nm bytes), first 4 bytes as uint32 BE, mod 1e6.
    P.sasCode = (fp, nwHex, nmHex) => {
      const h = nodeCrypto
        .createHash('sha256')
        .update(Buffer.from(P.SAS_LABEL, 'utf8'))
        .update(Buffer.from(P.normFingerprint(fp), 'hex'))
        .update(Buffer.from(nwHex, 'hex'))
        .update(Buffer.from(nmHex, 'hex'))
        .digest();
      return String(h.readUInt32BE(0) % 1000000).padStart(6, '0');
    };

    // Constant-time check of a token against a stored sha256 hex hash.
    P.tokenMatches = (token, hashHex) => {
      if (typeof token !== 'string' || typeof hashHex !== 'string') return false;
      const a = Buffer.from(P.sha256Hex(token), 'hex');
      const b = Buffer.from(hashHex, 'hex');
      return a.length === b.length && nodeCrypto.timingSafeEqual(a, b);
    };

    // Clipboard text that may be sent (UTF-8 size limit).
    P.clipAllowed = (text) =>
      typeof text === 'string' && Buffer.byteLength(text, 'utf8') <= P.CLIP_MAX_BYTES;
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = P;
  else root.MacShareProtocol = P;
})(typeof self !== 'undefined' ? self : this);
