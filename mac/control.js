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

$('pair-allow').onclick = () => api.pairRespond(true);
$('pair-deny').onclick = () => api.pairRespond(false);
$('relaunch').onclick = () => api.relaunch();

api.onState(render);
api.getState().then(render);
