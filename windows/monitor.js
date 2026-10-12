// MacShare — Copyright (C) 2026 MacShare contributors. GPL-3.0, see LICENSE.
// Monitor 2 renderer: answers the Mac's WebRTC offer and plays the video at the lowest latency.
// With ?test=1 it plays a local moving test pattern instead (dev only, no Mac needed).
const P = window.MacShareProtocol;
const T = P.T;
const api = window.monitor;
const video = document.getElementById('video');
const overlay = document.getElementById('overlay');
const statsBox = document.getElementById('stats');
const audio = document.getElementById('audio');
let audioCfg = { on: true, volume: 1 };
let streamAudio = false; // stream.info.audio: the Mac shares sound with the screen

let pc = null;
let session = null;
let pending = null; // remote candidates queued until the remote description is set
let streamName = '';

function setOverlay(text) {
  overlay.textContent = text || '';
  overlay.classList.toggle('hidden', !text);
}

function closePc() {
  if (pc) pc.close();
  pc = null;
  session = null;
  pending = null;
  video.srcObject = null;
  audio.srcObject = null;
}

function applyAudio() {
  audio.muted = !audioCfg.on || !streamAudio;
  audio.volume = audioCfg.volume;
  if (audio.srcObject && audioCfg.on) audio.play().catch(() => {});
}
api.onAudio((a) => { audioCfg = a; applyAudio(); });

async function onOffer(msg) {
  closePc();
  const my = (pc = new RTCPeerConnection({ iceServers: [] }));
  session = msg.session;
  const queue = (pending = []);
  setOverlay('Connecting to ' + (streamName || 'the Mac') + '…');

  my.ontrack = (e) => {
    if ('jitterBufferTarget' in e.receiver) e.receiver.jitterBufferTarget = 0;
    else e.receiver.playoutDelayHint = 0; // lowest latency
    if (e.track.kind === 'audio') { // the Mac's sound (phase 10), played next to the muted video
      audio.srcObject = new MediaStream([e.track]);
      applyAudio();
      return;
    }
    video.srcObject = new MediaStream([e.track]);
    video.play().catch(() => {});
  };
  my.onicecandidate = (e) => {
    if (e.candidate && my === pc) api.send({ t: T.RTC_ICE, session: msg.session, candidate: e.candidate.toJSON() });
  };
  my.onconnectionstatechange = () => {
    if (my !== pc) return;
    if (my.connectionState === 'failed') setOverlay('The video connection failed — waiting for the Mac to retry…');
    else if (my.connectionState === 'disconnected') setOverlay('The video connection was interrupted…');
    else if (my.connectionState === 'connected' && video.readyState >= 2) setOverlay('');
  };

  try {
    await my.setRemoteDescription({ type: 'offer', sdp: msg.sdp });
    for (const c of queue) await my.addIceCandidate(c).catch((err) => console.warn('ice', err.message));
    if (my !== pc) return;
    pending = null;
    await my.setLocalDescription(await my.createAnswer());
    if (my !== pc) return;
    api.send({ t: T.RTC_ANSWER, session: msg.session, sdp: my.localDescription.sdp });
  } catch (err) {
    console.error('[monitor] offer failed', err);
    if (my === pc) setOverlay('Could not start the video: ' + err.message);
  }
}

function onIce(msg) {
  if (!pc || msg.session !== session || !msg.candidate) return;
  if (pending) pending.push(msg.candidate);
  else pc.addIceCandidate(msg.candidate).catch((err) => console.warn('ice', err.message));
}

video.addEventListener('playing', () => setOverlay(''));

// ---- stats overlay (F9) ----

let statsTimer = null;
let lastIn = null;

async function updateStats() {
  if (!pc) { statsBox.textContent = 'no video session'; return; }
  const rep = await pc.getStats();
  let inb = null, pair = null;
  const byId = new Map();
  rep.forEach((r) => {
    byId.set(r.id, r);
    if (r.type === 'inbound-rtp' && r.kind === 'video') inb = r;
    if (r.type === 'candidate-pair' && r.nominated && r.state === 'succeeded') pair = r;
  });
  if (!inb) { statsBox.textContent = 'waiting for video…'; return; }
  const now = performance.now();
  const d = (k) => (lastIn ? inb[k] - (lastIn[k] || 0) : 0);
  const mbps = lastIn ? (d('bytesReceived') * 8) / ((now - lastIn.at) * 1000) : 0;
  const per = (num, den) => { const n = d(num), dn = d(den); return dn > 0 ? (n / dn) * 1000 : 0; };
  const codec = byId.get(inb.codecId);
  const lines = [
    (inb.frameWidth || 0) + '×' + (inb.frameHeight || 0) + '  ' + Math.round(inb.framesPerSecond || 0) + ' fps  ' + mbps.toFixed(1) + ' Mbps',
    (codec ? codec.mimeType.replace('video/', '') : '?') + '  decoder ' + (inb.decoderImplementation || '?') + (inb.powerEfficientDecoder ? ' (hw)' : ''),
    'jitter buffer ' + per('jitterBufferDelay', 'jitterBufferEmittedCount').toFixed(0) + ' ms' +
      '  decode ' + per('totalDecodeTime', 'framesDecoded').toFixed(1) + ' ms' +
      '  rx→decoded ' + per('totalProcessingDelay', 'framesDecoded').toFixed(0) + ' ms',
    'network RTT ' + (pair && pair.currentRoundTripTime != null ? (pair.currentRoundTripTime * 1000).toFixed(0) : '?') + ' ms' +
      '  lost ' + (inb.packetsLost || 0) + '  nack ' + (inb.nackCount || 0) + '  pli ' + (inb.pliCount || 0),
    'dropped ' + (inb.framesDropped || 0) + '  freezes ' + (inb.freezeCount || 0) + '  keyframes ' + (inb.keyFramesDecoded || 0),
  ];
  lastIn = Object.assign({ at: now }, inb);
  statsBox.textContent = lines.join('\n');
}

function toggleStats() {
  const on = statsBox.classList.toggle('hidden') === false;
  clearInterval(statsTimer);
  statsTimer = null;
  lastIn = null;
  if (on) { updateStats(); statsTimer = setInterval(() => updateStats().catch(() => {}), 1000); }
}
api.onToggleStats(toggleStats);

// ---- dev test source ----

function startTestPattern() {
  const canvas = document.createElement('canvas');
  canvas.width = 1920;
  canvas.height = 1080;
  const g = canvas.getContext('2d');
  let frame = 0;
  function draw() {
    const w = canvas.width, h = canvas.height;
    g.fillStyle = '#202830';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = '#3a4654';
    for (let x = 0; x <= w; x += 120) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
    for (let y = 0; y <= h; y += 120) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    g.strokeStyle = '#e04848';
    g.lineWidth = 6;
    g.strokeRect(3, 3, w - 6, h - 6); // the full frame edge must be visible
    g.lineWidth = 1;
    const x = (frame * 8) % (w + 200) - 200;
    g.fillStyle = '#2f6fe4';
    g.fillRect(x, h / 2 - 100, 200, 200);
    g.fillStyle = '#ffffff';
    g.font = '48px Segoe UI, sans-serif';
    g.fillText('MacShare test pattern — 1920×1080 — frame ' + frame, 60, 100);
    g.font = '20px Consolas, monospace';
    g.fillText('The quick brown fox jumps over the lazy dog 0123456789', 60, 150);
    frame++;
    requestAnimationFrame(draw);
  }
  draw();
  video.srcObject = canvas.captureStream(30);
  video.play().catch(() => {});
}

if (new URLSearchParams(location.search).get('test') === '1') {
  startTestPattern();
} else {
  api.onRtc((msg) => {
    switch (msg.t) {
      case T.STREAM_INFO:
        streamName = msg.name;
        streamAudio = msg.audio === true;
        applyAudio();
        if (!pc) setOverlay('Waiting for ' + (streamName || 'the Mac') + '…');
        break;
      case T.RTC_OFFER: onOffer(msg); break;
      case T.RTC_ICE: onIce(msg); break;
      case T.STREAM_STOP:
        closePc();
        setOverlay('Mac is not sharing');
        break;
    }
  });
  api.ready();
}
