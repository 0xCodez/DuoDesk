// MacShare — Copyright (C) 2026 MacShare contributors. GPL-3.0, see LICENSE.
// Hidden window, phase 11: captures one monitor of this PC (and optionally its sound) and sends it
// to the Mac as an `rtc2` session (we offer, the Mac answers recvonly). Mirrors mac/capture.js.
'use strict';

const T = window.MacShareProtocol.T;
const api = window.pcscreen;

let cur = null; // {session, pc, stream, pending}

function report(status, error) {
  api.state({ session: cur ? cur.session : 0, status, error: error || '' });
}

// Bitrate hints in the video fmtp lines (start high, keep a floor). Values in kbps.
function withBitrate(sdp, mbps) {
  const max = Math.round(mbps * 1000);
  const extra = `x-google-start-bitrate=${Math.round(max * 0.6)};x-google-min-bitrate=${Math.round(max * 0.2)};x-google-max-bitrate=${max}`;
  const pts = new Set();
  const lines = sdp.split('\r\n');
  let inVideo = false;
  for (const l of lines) {
    if (l.startsWith('m=')) inVideo = l.startsWith('m=video');
    const m = inVideo && /^a=rtpmap:(\d+) (H264|VP8|VP9|AV1)\//i.exec(l);
    if (m) pts.add(m[1]);
  }
  return lines.map((l) => {
    const m = /^a=fmtp:(\d+) (.*)$/.exec(l);
    if (!m || !pts.has(m[1])) return l;
    return `a=fmtp:${m[1]} ${[...m[2].split(';').filter((x) => x && !x.startsWith('x-google-')), extra].join(';')}`;
  }).join('\r\n');
}

// Opus stereo at 128 kbps for the screen's sound.
function withOpus(sdp) {
  const m = /a=rtpmap:(\d+) opus\/48000\/2/i.exec(sdp);
  if (!m) return sdp;
  const re = new RegExp('a=fmtp:' + m[1] + ' ([^\\r\\n]*)');
  const extra = 'stereo=1;sprop-stereo=1;maxaveragebitrate=128000';
  return re.test(sdp) ? sdp.replace(re, (all, p) => 'a=fmtp:' + m[1] + ' ' + p.split(';').filter((x) => !/^(stereo|sprop-stereo|maxaveragebitrate)=/.test(x)).concat(extra).join(';'))
    : sdp.replace(m[0], m[0] + '\r\na=fmtp:' + m[1] + ' ' + extra);
}

// m: {session, sourceId, width, height, mbps, audio}
async function start(m) {
  stop();
  const me = (cur = { session: m.session, pending: [], mbps: m.mbps });
  try {
    const desktop = { chromeMediaSource: 'desktop', chromeMediaSourceId: m.sourceId };
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: m.audio ? { mandatory: { chromeMediaSource: 'desktop' } } : false,
      video: { mandatory: { ...desktop, maxWidth: m.width, maxHeight: m.height, maxFrameRate: 60 } },
    });
    if (cur !== me) return stream.getTracks().forEach((t) => t.stop());
    me.stream = stream;
    const video = stream.getVideoTracks()[0];
    video.contentHint = 'detail';
    video.onended = () => cur === me && report('ended', 'The captured monitor went away');
    const pc = (me.pc = new RTCPeerConnection({ iceServers: [] }));
    const tr = pc.addTransceiver(video, { direction: 'sendonly', streams: [stream] });
    const audio = stream.getAudioTracks()[0];
    if (audio) pc.addTransceiver(audio, { direction: 'sendonly', streams: [stream] });
    // H.264 first (hardware encode here, VideoToolbox decode on the Mac), High before Main before Baseline.
    const rank = (c) => {
      if (!/h264/i.test(c.mimeType)) return 9;
      const p = /profile-level-id=(..)/i.exec(c.sdpFmtpLine || '');
      return { 64: 0, '4d': 1, '42': 2 }[p ? p[1].toLowerCase() : ''] ?? 3;
    };
    tr.setCodecPreferences(RTCRtpSender.getCapabilities('video').codecs.slice().sort((a, b) => rank(a) - rank(b)));
    pc.onicecandidate = (e) => e.candidate && cur === me && api.send({ t: T.RTC2_ICE, session: me.session, candidate: e.candidate.toJSON() });
    pc.onconnectionstatechange = () => cur === me && report(pc.connectionState === 'connected' ? 'live' : pc.connectionState);

    const offer = await pc.createOffer();
    await pc.setLocalDescription({ type: 'offer', sdp: withOpus(withBitrate(offer.sdp, m.mbps)) });
    const p = tr.sender.getParameters();
    if (!p.encodings || !p.encodings.length) p.encodings = [{}];
    p.encodings[0].maxBitrate = m.mbps * 1e6;
    p.encodings[0].maxFramerate = 60;
    p.degradationPreference = 'maintain-resolution';
    await tr.sender.setParameters(p);
    if (cur !== me) return;
    api.send({ t: T.RTC2_OFFER, session: me.session, sdp: pc.localDescription.sdp, kind: audio ? 'screen+audio' : 'screen' });
    report('connecting');
    me.statsTimer = setInterval(() => stats(me), 1000);
  } catch (e) {
    if (cur === me) report('failed', 'Capturing this PC’s screen: ' + e.message);
  }
}

// Once a second, as on the Mac: picture, fps, bitrate (and what the network allows), encoder.
async function stats(me) {
  if (cur !== me || !me.pc) return;
  const report = await me.pc.getStats();
  let out = null, pair = null;
  const byId = new Map();
  report.forEach((r) => {
    byId.set(r.id, r);
    if (r.type === 'outbound-rtp' && r.kind === 'video') out = r;
    if (r.type === 'candidate-pair' && r.nominated && r.state === 'succeeded') pair = r;
  });
  if (!out || cur !== me) return;
  const now = performance.now();
  let mbps = 0, qp = 0, encodeMs = 0;
  if (me.last) {
    mbps = ((out.bytesSent - me.last.bytes) * 8) / ((now - me.last.at) * 1000);
    const frames = out.framesEncoded - me.last.frames;
    if (frames > 0) {
      qp = Math.round(((out.qpSum || 0) - me.last.qpSum) / frames);
      encodeMs = Math.round((((out.totalEncodeTime || 0) - me.last.encodeTime) * 1000 * 10) / frames) / 10;
    }
  }
  me.last = { bytes: out.bytesSent, at: now, frames: out.framesEncoded, qpSum: out.qpSum || 0, encodeTime: out.totalEncodeTime || 0 };
  const codec = byId.get(out.codecId);
  api.stats({
    session: me.session,
    fps: Math.round(out.framesPerSecond || 0),
    width: out.frameWidth || 0,
    height: out.frameHeight || 0,
    mbps: Math.round(mbps * 10) / 10,
    targetMbps: pair && pair.availableOutgoingBitrate ? Math.round(pair.availableOutgoingBitrate / 1e5) / 10 : 0,
    encoder: out.encoderImplementation || '',
    codec: codec ? codec.mimeType.replace(/^video\//, '') : '',
    qp,
    encodeMs,
    limit: out.qualityLimitationReason || 'none',
    rttMs: pair && pair.currentRoundTripTime != null ? Math.round(pair.currentRoundTripTime * 1000) : null,
  });
}

async function onAnswer(m) {
  const me = cur;
  if (!me || !me.pc || m.session !== me.session) return;
  try {
    await me.pc.setRemoteDescription({ type: 'answer', sdp: withOpus(withBitrate(m.sdp, me.mbps)) });
    for (const c of me.pending.splice(0)) await me.pc.addIceCandidate(c).catch(() => {});
    me.pending = null;
  } catch (e) {
    report('failed', 'The Mac’s answer: ' + e.message);
  }
}

function onIce(m) {
  if (!cur || m.session !== cur.session || !m.candidate) return;
  if (cur.pending) cur.pending.push(m.candidate);
  else if (cur.pc) cur.pc.addIceCandidate(m.candidate).catch(() => {});
}

function stop() {
  if (cur) {
    clearInterval(cur.statsTimer);
    if (cur.pc) cur.pc.close();
    if (cur.stream) cur.stream.getTracks().forEach((t) => t.stop());
  }
  cur = null;
}

api.on((m) => {
  switch (m.t) {
    case 'start': start(m); break;
    case 'stop': stop(); report('off'); break;
    case T.RTC2_ANSWER: onAnswer(m); break;
    case T.RTC2_ICE: onIce(m); break;
  }
});
api.ready();
