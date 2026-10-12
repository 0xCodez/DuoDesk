// MacShare — Copyright (C) 2026 MacShare contributors. GPL-3.0, see LICENSE.
// Main window: renders the state pushed by the main process; buttons call the preload API.
const api = window.macshare;
const $ = (id) => document.getElementById(id);

function show(id, on) {
  $(id).classList.toggle('hidden', !on);
}

function renderStatus(s) {
  const l = s.link;
  const dot = $('status-dot');
  dot.className = 'dot';
  let text = 'Not paired';
  switch (l.state) {
    case 'connected':
      text = 'Connected to ' + l.macName + (l.rtt != null ? ' (RTT ' + l.rtt + ' ms)' : '');
      dot.classList.add('ok');
      break;
    case 'connecting':
      text = 'Connecting to ' + l.macName + '…';
      dot.classList.add('warn');
      break;
    case 'reconnecting':
      text = 'Reconnecting…';
      dot.classList.add('warn');
      break;
    case 'identity_changed':
      text = "This Mac's identity changed";
      dot.classList.add('bad');
      break;
  }
  $('status-text').textContent = text;
  $('status-detail').textContent = l.state === 'identity_changed' ? 'Forget it and pair again.' : l.message || '';
  const where = { home: 'Home', driving: 'Driving the Mac', driven: 'Driven by the Mac' };
  $('input-line').textContent = 'Input: ' + (where[s.input] || 'Home');
}

function renderPairing(p) {
  show('pairing-card', !!p);
  if (!p) return;
  const code = $('pairing-code');
  const text = $('pairing-text');
  text.classList.remove('error');
  $('pairing-title').textContent = 'Pairing with ' + p.macName;
  code.textContent = p.code ? p.code.slice(0, 3) + ' ' + p.code.slice(3) : '';
  show('pairing-code', !!p.code);
  show('btn-match', p.phase === 'code');
  $('btn-cancel').textContent = p.phase === 'failed' ? 'Close' : 'Cancel';
  switch (p.phase) {
    case 'connecting': text.textContent = 'Connecting to ' + p.address + '…'; break;
    case 'starting': text.textContent = 'Waiting for the Mac…'; break;
    case 'code': text.textContent = 'Check the Mac shows the same code, then click Codes match.'; break;
    case 'waiting': text.textContent = 'Waiting for Allow on the Mac…'; break;
    case 'failed':
      text.textContent = p.error;
      text.classList.add('error');
      break;
  }
}

function renderPaired(p) {
  show('paired-card', !!p);
  if (!p) return;
  $('paired-name').textContent = p.macName;
  $('paired-address').textContent = p.address + ':' + p.port;
}

function renderMacs(s) {
  const list = $('mac-list');
  list.replaceChildren();
  const busy = !!s.pairing && s.pairing.phase !== 'failed';
  for (const mac of s.macs) {
    const li = document.createElement('li');
    const info = document.createElement('div');
    const name = document.createElement('div');
    name.className = 'name';
    name.textContent = mac.name;
    const addr = document.createElement('div');
    addr.className = 'sub';
    addr.textContent = mac.address;
    info.append(name, addr);
    const btn = document.createElement('button');
    const isPaired = s.paired && s.paired.macId === mac.id;
    btn.textContent = isPaired ? 'Pair again' : 'Pair';
    btn.disabled = busy;
    btn.onclick = () => api.pair(mac.id);
    li.append(info, btn);
    list.append(li);
  }
  show('mac-list', s.macs.length > 0);
  show('mac-empty', s.macs.length === 0);
  $('mac-empty').textContent = s.discoveryError || 'Looking for Macs… (start MacShare on the Mac)';
  $('add-ip').querySelector('button').disabled = busy;
}

function renderStream(s) {
  $('stream-state').textContent = s.stream.state === 'on'
    ? s.stream.name + ' (' + s.stream.width + '×' + s.stream.height + ')' +
      (s.macInput ? '' : ' — view only (input is off on the Mac)')
    : 'Mac is not sharing';
  $('btn-monitor').disabled = s.link.state !== 'connected';
}

function render(s) {
  renderStatus(s);
  renderPairing(s.pairing);
  renderPaired(s.paired);
  renderMacs(s);
  renderStream(s);
}

$('btn-match').onclick = () => api.confirmCode();
$('btn-cancel').onclick = () => api.cancelPair();
$('btn-forget').onclick = () => api.forget();
$('btn-monitor').onclick = () => api.openMonitor();
$('add-ip').onsubmit = (e) => {
  e.preventDefault();
  const v = $('ip').value.trim();
  if (v) api.pair(v);
};

api.onState(render);
api.getState().then(render);
