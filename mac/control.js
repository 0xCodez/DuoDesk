// MacShare — Copyright (C) 2026 MacShare contributors. GPL-3.0, see LICENSE.
// Control window: renders the state object from main (see main.js) and sends actions.
'use strict';

const api = window.macshare;
const $ = (id) => document.getElementById(id);

function el(tag, props = {}, children = []) {
  const e = document.createElement(tag);
  Object.assign(e, props);
  for (const c of children) e.append(c);
  return e;
}

function ago(ts) {
  if (!ts) return 'never';
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return new Date(ts).toLocaleDateString();
}

const INPUT_TEXT = { home: 'Home', driving: 'Driving the PC', driven: 'Driven by the PC' };

const PERMS = [
  { kind: 'screen', label: 'Screen Recording', note: 'needed for screen sharing' },
  { kind: 'accessibility', label: 'Accessibility', note: 'needed to control this Mac from the PC' },
  { kind: 'inputMonitoring', label: 'Input Monitoring', note: 'needed to drive the PC from this Mac' },
];

function permText(kind, value) {
  if (value === null || value === undefined) return ['not checked yet', 'muted'];
  if (kind === 'screen') return value === 'granted' ? ['Granted', 'good'] : [`Not granted (${value})`, 'bad'];
  return value ? ['Granted', 'good'] : ['Not granted', 'bad'];
}

function render(s) {
  $('mac-name').textContent = s.macName;

  // Pairing request
  const p = s.pairing;
  $('pair-request').hidden = !p;
  if (p) {
    $('pair-name').textContent = p.name;
    $('pair-code').textContent = p.code ? `${p.code.slice(0, 3)} ${p.code.slice(3)}` : '…';
    $('pair-allow').disabled = !p.code || p.allowed;
    let hint = 'Check that the PC shows the same code.';
    if (!p.code) hint = 'Waiting for the code…';
    else if (p.allowed && !p.confirmed) hint = 'Allowed. Waiting for "Codes match" on the PC…';
    else if (p.confirmed && !p.allowed) hint = 'The PC confirmed the code. Click Allow if it matches.';
    $('pair-hint').textContent = hint;
  }

  // Status
  $('server-error').hidden = !s.serverError;
  $('server-error').textContent = s.serverError || '';
  $('addresses').textContent = s.addresses.length ? s.addresses.join(', ') : 'no network';
  if (s.client) {
    const rtt = s.client.rttMs == null ? '' : ` — ${s.client.rttMs} ms round trip`;
    $('client').replaceChildren(el('span', { className: 'good', textContent: 'Connected: ' }),
      `${s.client.name} (${s.client.address})${rtt}`);
  } else {
    $('client').textContent = 'No PC connected';
  }
  const inp = s.input || { where: 'home' };
  $('input').textContent = (INPUT_TEXT[inp.where] || inp.where) + (inp.message ? ` — ${inp.message}` : '');

  renderSharing(s);

  // Paired PCs
  $('paired-empty').hidden = s.paired.length > 0;
  $('paired').replaceChildren(...s.paired.map((d) => {
    const online = s.client && s.client.id === d.id;
    const forget = el('button', { textContent: 'Forget' });
    forget.onclick = () => api.forget(d.id);
    return el('li', {}, [
      el('span', { className: 'grow' }, [
        el('strong', { textContent: d.name }),
        el('span', { className: online ? 'good' : 'muted', textContent: online ? '  connected' : `  last seen ${ago(d.lastSeen)}` }),
      ]),
      forget,
    ]);
  }));

  // Permissions
  $('permissions').replaceChildren(...PERMS.map(({ kind, label, note }) => {
    const [text, cls] = permText(kind, s.permissions[kind]);
    const open = el('button', { textContent: 'Open Settings' });
    open.onclick = () => api.openSettings(kind);
    return el('li', {}, [
      el('span', { className: 'grow' }, [el('strong', { textContent: label }), el('span', { className: 'muted', textContent: `  ${note}` })]),
      el('span', { className: cls, textContent: text }),
      open,
    ]);
  }));
}

const PRESETS = [
  { label: '1280×720', width: 1280, height: 720, hiDPI: false },
  { label: '1920×1080', width: 1920, height: 1080, hiDPI: false },
  { label: '2560×1440', width: 2560, height: 1440, hiDPI: false },
  { label: '1920×1080 HiDPI (3840×2160 px)', width: 1920, height: 1080, hiDPI: true },
  { label: '2560×1440 HiDPI (5120×2880 px)', width: 2560, height: 1440, hiDPI: true },
];
$('virt-preset').replaceChildren(...PRESETS.map((p, i) => el('option', { value: String(i), textContent: p.label })));

const STREAM_TEXT = {
  off: 'Sharing is off', starting: 'Starting…', 'waiting for answer': 'Waiting for the PC…',
  new: 'Connecting…', connecting: 'Connecting…', live: 'Live', disconnected: 'Interrupted…',
  failed: 'Failed — retrying', closed: 'Closed',
};

let presetDirty = false;
$('virt-preset').onchange = () => { presetDirty = true; };

function renderSharing(s) {
  const sh = s.sharing;
  $('helper-missing').hidden = !!(s.helper && s.helper.running);
  if (!sh) return;
  $('share-on').checked = sh.on;
  $('stream-input').checked = s.streamInput;
  $('input-latency').textContent = !s.streamInput ? 'off — input from the PC is ignored'
    : s.client && s.client.rttMs != null ? `input delay ≈ ${Math.max(1, Math.round(s.client.rttMs / 2))} ms (network, one way)` : '';
  if (document.activeElement !== $('stream-size')) $('stream-size').value = String(sh.streamMaxHeight || 0);
  if (document.activeElement !== $('bitrate')) {
    const b = String(sh.bitrateMbps);
    if (![...$('bitrate').options].some((o) => o.value === b)) $('bitrate').append(el('option', { value: b, textContent: `${b} Mbps` }));
    $('bitrate').value = b;
  }

  const opts = [el('option', { value: 'virtual', textContent: 'MacShare virtual display' + (sh.virtual.active ? '' : ' (off — uses main display)') })];
  for (const d of sh.displays) {
    if (d.virtual) continue;
    opts.push(el('option', { value: String(d.id), textContent: `${d.label} — ${d.width}×${d.height}${d.primary ? ' (main)' : ''}` }));
  }
  const sel = $('share-display');
  if (document.activeElement !== sel) {
    sel.replaceChildren(...opts);
    sel.value = sh.displayId == null || !sh.displays.some((d) => d.id === sh.displayId && !d.virtual) ? 'virtual' : String(sh.displayId);
  }

  const v = sh.virtual;
  $('virt-on').checked = v.enabled;
  if (!presetDirty) {
    const i = PRESETS.findIndex((p) => p.width === v.width && p.height === v.height && p.hiDPI === !!v.hiDPI);
    $('virt-preset').value = String(i < 0 ? 1 : i);
  }
  $('virt-status').textContent = v.error ? `Error: ${v.error}` : v.enabled ? (v.active ? 'on' : 'starting…') : 'off';
  $('virt-status').className = v.error ? 'bad' : 'muted';

  const st = s.stream || { status: 'off' };
  let status = STREAM_TEXT[st.status] || st.status;
  if (sh.on && !s.client) status = 'Waiting for a PC to connect';
  $('stream-status').textContent = st.display && sh.on && s.client ? `${status} — ${st.display}` : status;
  $('stream-stats').textContent = st.status === 'live'
    ? `${st.width}×${st.height}, ${st.fps} fps, ${st.mbps} of ${st.targetMbps || '?'} Mbps, QP ${st.qp || '–'} (lower = sharper), `
      + `${st.codec || '?'} ${st.encoder || ''}${st.limit && st.limit !== 'none' ? ` — limited by ${st.limit}` : ''}`
    : '—';
}

$('share-on').onchange = (e) => api.setSharing(e.target.checked);
$('share-display').onchange = (e) => api.selectDisplay(e.target.value === 'virtual' ? null : Number(e.target.value));
$('stream-input').onchange = (e) => api.setStreamInput(e.target.checked);
$('stream-size').onchange = (e) => api.setStreamMaxHeight(Number(e.target.value));
$('bitrate').onchange = (e) => api.setBitrate(Number(e.target.value));
$('virt-on').onchange = (e) => api.setVirtual({ enabled: e.target.checked });
$('virt-apply').onclick = () => {
  const p = PRESETS[Number($('virt-preset').value)];
  presetDirty = false;
  api.setVirtual({ enabled: true, width: p.width, height: p.height, hiDPI: p.hiDPI });
};

$('pair-allow').onclick = () => api.pairRespond(true);
$('pair-deny').onclick = () => api.pairRespond(false);
$('relaunch').onclick = () => api.relaunch();

api.onState(render);
api.getState().then(render);
