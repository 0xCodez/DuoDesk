// MacShare — a Mac and a Windows PC that work as one.
// Copyright (C) 2026 MacShare contributors. Licensed under the GNU GPL v3 (see LICENSE).
//
// Protocol v1 — single source of truth for both apps (see BUILD_PLAN.md and docs/KVM.md).
// Works as a CommonJS module in main processes (require('../shared/protocol.js'))
// and as a plain <script> in renderers (window.MacShareProtocol).
// The crypto helpers exist only where Node's crypto is available (main processes).
(function (root) {
  const P = {
    PROTOCOL_VERSION: 1,
    PORT: 47800, // WSS control channel; the Mac listens
    DISCOVERY_PORT: 47801, // UDP beacons; the Mac broadcasts, Windows listens
    BEACON_MS: 2000,
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
    HOTKEY_MAC: 'AltRight', // Right Option
    HOTKEY_WIN: 'ControlRight', // Right Ctrl
    CLIP_MAX_BYTES: 256 * 1024, // clipboard text limit (UTF-8)
    FILE_CHUNK_BYTES: 64 * 1024, // raw bytes per file.chunk (base64 on the wire)
    FILE_MAX_BYTES: 4 * 1024 * 1024 * 1024, // largest dropped file
    SIDES: ['left', 'right', 'top', 'bottom'],

    // Control message types (field `t`)
    T: {
      BEACON: 'beacon',
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
      K_MOVE: 'k.mm',
      K_DOWN: 'k.md',
      K_UP: 'k.mu',
      K_WHEEL: 'k.wh',
      K_KEY_DOWN: 'k.kd',
      K_KEY_UP: 'k.ku',
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
      // roadmap, docs/ROADMAP.md (phases 7, 11, 12; PC -> Mac media)
      RTC2_OFFER: 'rtc2.offer', // W->M {session, sdp, kind}
      RTC2_ANSWER: 'rtc2.answer', // M->W {session, sdp}
      RTC2_ICE: 'rtc2.ice', // either {session, candidate}
      RTC2_STOP: 'rtc2.stop', // W->M {session}
      AUDIO_OFFER: 'audio.offer', // sender->receiver {dir:'m2w'|'w2m', session, sdp} (revision 2)
      AUDIO_ANSWER: 'audio.answer', // receiver->sender {dir, session, sdp}
      AUDIO_ICE: 'audio.ice', // either {dir, session, candidate}
      AUDIO_STOP: 'audio.stop', // sender->receiver {dir}
      SCREEN_POLICY: 'screen.policy', // M->W {accept, width?, height?}: the Mac shows the PC's screen (phase 11)
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

    // Keys travel as physical DOM KeyboardEvent.code names; "Meta" is Command on the Mac and
    // the Windows key on the PC. The RECEIVER applies this swap to every key that came from
    // the other platform, so Cmd+C on the Mac arrives as Ctrl+C on the PC and the reverse
    // (Beamer's "semantic" mapping). Alt stays Alt (= Option).
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
