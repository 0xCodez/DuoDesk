// TwinDesk — Copyright (C) 2026 inukaasith. GPL-3.0, see LICENSE.
// Main window UI kit (window.UI): same API as the Mac's mac/control.js so the tab scripts match;
// app.js boots the shell. Controls are built once per tab; render(state) only updates values,
// so a state push never interrupts a drag, an open menu or keyboard focus.
'use strict';

const SVG_NS = 'http://www.w3.org/2000/svg';
const ICONS = {
  overview: 'M3 9.5 10 4l7 5.5V17H3z M8 17v-4h4v4',
  display: 'M3 4h14v9H3z M7 17h6 M10 13v4',
  receive: 'M3 4h14v9H3z M7 17h6 M10 13v4 M10 6v4.5 M7.8 8.5 10 10.7l2.2-2.2',
  cursor: 'M5 3l10 6-4.5 1.2L8.5 15z',
  keyboard: 'M2.5 6h15v8h-15z M5.5 9h1 M8.5 9h1 M11.5 9h1 M14.5 9h0 M6.5 11.5h7',
  clipboard: 'M6 4h8v13H6z M8 3h4v2.5H8z M8 9h4 M8 12h4',
  files: 'M3 5h5l1.5 2H17v9H3z',
  terminal: 'M3 4h14v12H3z M6 8l2.5 2L6 12 M10 12h4',
  audio: 'M4 8h3l4-3v10l-4-3H4z M14 7.5c1 .8 1 4.2 0 5 M16 5.5c2.2 1.8 2.2 7.2 0 9',
  apps: 'M4 4h5v5H4z M11 4h5v5h-5z M4 11h5v5H4z M11 11h5v5h-5z',
  general: 'M10 7a3 3 0 1 0 0 6 3 3 0 0 0 0-6z M10 2.5v2 M10 15.5v2 M2.5 10h2 M15.5 10h2 M4.7 4.7l1.4 1.4 M13.9 13.9l1.4 1.4 M4.7 15.3l1.4-1.4 M13.9 6.1l1.4-1.4',
  up: 'M10 16V4 M5 9l5-5 5 5',
  down: 'M10 4v12 M5 11l5 5 5-5',
};

const UI = {
  api: window.macshare,
  P: window.MacShareProtocol,
  tabs: [],
  state: null,

  el(tag, props = {}, children = []) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (k === 'class') e.className = v;
      else if (k === 'text') e.textContent = v;
      else if (k === 'attrs') for (const [a, av] of Object.entries(v)) e.setAttribute(a, av);
      else e[k] = v;
    }
    for (const c of [].concat(children)) if (c != null && c !== false) e.append(c);
    return e;
  },

  icon(name, cls = '') {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '0 0 20 20');
    if (cls) svg.setAttribute('class', cls);
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', ICONS[name] || '');
    svg.append(path);
    return svg;
  },

  // ---- controls: each returns { el, set(value), ... } ----
  switch(onChange, { disabled = false, label = '' } = {}) {
    const el = UI.el('input', { type: 'checkbox', class: 'switch', disabled, attrs: { role: 'switch', 'aria-label': label } });
    el.onchange = () => onChange(el.checked);
    return { el, set: (v) => { el.checked = !!v; }, disable: (d) => { el.disabled = !!d; } };
  },

  segmented(options, onChange) {
    const el = UI.el('div', { class: 'seg', attrs: { role: 'radiogroup' } });
    const btns = options.map((o) => {
      const b = UI.el('button', { text: o.label, title: o.title || '', attrs: { role: 'radio' } });
      b.onclick = () => onChange(o.value);
      el.append(b);
      return [o.value, b];
    });
    return {
      el,
      set(v) {
        for (const [val, b] of btns) {
          b.classList.toggle('on', val === v);
          b.setAttribute('aria-checked', String(val === v));
        }
      },
    };
  },

  select(options, onChange) {
    const el = UI.el('select');
    let key = '';
    const fill = (opts) => {
      const k = JSON.stringify(opts);
      if (k === key || document.activeElement === el) return; // unchanged, or the user is in it
      key = k;
      const v = el.value;
      el.replaceChildren(...opts.map((o) => UI.el('option', { value: String(o.value), text: o.label })));
      if (v) el.value = v;
    };
    fill(options);
    el.onchange = () => onChange(el.value);
    return {
      el,
      options: fill,
      set(v) {
        if (document.activeElement === el) return;
        const s = String(v);
        if (![...el.options].some((o) => o.value === s)) el.append(UI.el('option', { value: s, text: s }));
        el.value = s;
      },
    };
  },

  slider({ min, max, step, format = (v) => v }, onChange) {
    const input = UI.el('input', { type: 'range', min, max, step });
    const out = UI.el('output');
    let dragging = false;
    input.onpointerdown = () => { dragging = true; };
    input.oninput = () => { out.textContent = format(Number(input.value)); };
    input.onchange = () => { dragging = false; onChange(Number(input.value)); };
    return {
      el: UI.el('div', { class: 'slider' }, [input, out]),
      set(v) {
        if (dragging) return;
        input.value = v;
        out.textContent = format(Number(v));
      },
    };
  },

  button(label, onClick, cls = '') {
    const b = UI.el('button', { class: `btn ${cls}`.trim(), text: label });
    b.onclick = onClick;
    return b;
  },

  // A row: label (+ hint) on the left, controls on the right. Returns the row with .hint/.label.
  row(label, hint, controls = [], { onClick } = {}) {
    const lab = UI.el('span', { class: 'label', text: label });
    const hintEl = UI.el('span', { class: 'hint', text: hint || '' });
    if (!hint) hintEl.hidden = true;
    const row = UI.el('div', { class: 'row' }, [
      UI.el('div', { class: 'text' }, [lab, hintEl]),
      UI.el('div', { class: 'controls' }, [].concat(controls).map((c) => (c && c.el) || c)),
    ]);
    row.label = lab;
    row.hint = hintEl;
    row.setHint = (t) => { hintEl.textContent = t || ''; hintEl.hidden = !t; };
    if (onClick) {
      row.classList.add('clickable');
      row.onclick = (e) => { if (!e.target.closest('input,button,select')) onClick(); };
    }
    return row;
  },

  card(title, rows, { actions, cls = '' } = {}) {
    const wrap = UI.el('div', { class: 'card-wrap' });
    if (title) wrap.append(UI.el('div', { class: 'card-title' }, [UI.el('span', { text: title }), actions ? UI.el('span', { class: 'actions' }, actions) : null]));
    const card = UI.el('div', { class: `card ${cls}`.trim() }, rows);
    wrap.append(card);
    wrap.card = card;
    return wrap;
  },

  note(kind, text) {
    const n = UI.el('div', { class: `note ${kind}`, text });
    n.set = (t) => { n.textContent = t || ''; n.hidden = !t; };
    return n;
  },

  ago(ts) {
    if (!ts) return 'never';
    const s = Math.round((Date.now() - ts) / 1000);
    if (s < 10) return 'just now';
    if (s < 60) return `${s} s ago`;
    if (s < 3600) return `${Math.round(s / 60)} min ago`;
    if (s < 86400) return `${Math.round(s / 3600)} h ago`;
    return new Date(ts).toLocaleDateString();
  },

  bytes(n) {
    return n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(1)} MB`;
  },

  // Register a tab: { id, title, desc, color, phase?, bottom?, master?: {get(s), set(v)},
  //   badge?(s) -> 'on' | text | '', build(body, page) -> render(state) }
  tab(def) {
    UI.tabs.push(def);
  },

  // Register a tab: { id, order, title, heading?, group?, icon?, desc, color, phase?, bottom?,
  //   master?, badge?, build } — sorted by order (both apps use the same numbers).
  // A feature that isn't built yet: what it will do, how, its phase, and
  // the switches it will have (disabled). r: { id, title, desc, color, phase, what: [[t, d]], how, settings: [label] }
  comingTab(r) {
    UI.tab({
      id: r.id,
      order: r.order,
      group: r.group,
      heading: r.heading,
      title: r.title,
      desc: r.desc,
      color: r.color,
      icon: r.icon,
      phase: r.phase,
      master: { get: () => false, set: () => {}, disabled: true },
      build(body) {
        const { el } = UI;
        body.append(
          el('div', { class: 'card soon keep-on' }, [
            el('div', { class: 'soon-head' }, [el('span', { class: 'pill', text: 'Coming in phase ' + r.phase })]),
            ...r.what.map(([t, d]) => el('div', { class: 'soon-item' }, [el('strong', { text: t }), el('div', { class: 'hint', text: d })])),
          ]),
          UI.card('How it will work', [UI.row(r.how, '')], { cls: 'keep-on' }),
          UI.card('Settings it will have', r.settings.map((label) => UI.row(label, '', [UI.switch(() => {}, { disabled: true, label })]))),
        );
      },
    });
  },

  // Small computer glyph by OS.
  osIcon(os) {
    return UI.el('span', { class: `os-ico ${os === 'mac' ? 'mac' : 'pc'}`, attrs: { 'aria-label': os === 'mac' ? 'Mac' : os === 'linux' ? 'Linux' : 'PC' } });
  },

  // Two equal direction cards, always Mac → PC then PC → Mac.
  // Each def: { on?: {get(s), set(v), disabled?}, rows: [], soon?: 'phase N' }. Returns { el, update(s) }.
  dirCards(m2p, p2m) {
    const make = (dir, def) => {
      const title = [UI.el('span', { text: dir === 'm2p' ? 'Mac → Linux' : 'Linux → Mac' })];
      const sw = def.on ? UI.switch((v) => def.on.set(v), { label: dir === 'm2p' ? 'Mac to Linux' : 'Linux to Mac', disabled: !!def.on.disabled || !!def.soon }) : null;
      const head = UI.el('div', { class: 'dir-head' }, [UI.el('div', { class: 'dir-title' }, title), def.soon ? UI.el('span', { class: 'pill muted', text: 'Coming in phase ' + def.soon }) : null, sw ? sw.el : null]);
      const card = UI.el('div', { class: 'dir-card' + (def.soon ? ' soon-card' : '') }, [head].concat(def.rows || []));
      card.update = (s) => {
        if (!sw) return;
        const on = !def.soon && !!def.on.get(s);
        sw.set(on);
        card.classList.toggle('off', !on);
      };
      return card;
    };
    const a = make('m2p', m2p), b = make('p2m', p2m);
    return { el: UI.el('div', { class: 'dir-pair' }, [a, b]), update: (s) => { a.update(s); b.update(s); } };
  },

  // The hotkey choices (P.HOTKEYS) in Linux words
  // ("Right Alt", "Ctrl (either side)", "Left Super").
  HOTKEYS: Object.fromEntries(window.MacShareProtocol.HOTKEYS.map((c) => [c, window.MacShareProtocol.hotkeyName(c, 'win').replace('Windows key', 'Super')])),
  hotkeyName(s) {
    return UI.HOTKEYS[(s && s.keys && s.keys.hotkey) || 'AltRight'] || 'Right Alt';
  },

  // "Right now" row for the Cursor/Keyboard tabs: where input is + the last KVM event.
  inputStatus() {
    const WHERE = { home: 'On this computer', driving: 'On the Mac', driven: 'The Mac is using this computer' };
    const pill = UI.el('span', { class: 'pill' });
    const row = UI.row('Keyboard and mouse', '', [pill]);
    row.update = (s) => {
      const k = s.kvmState;
      const hk = 'Double-tap ' + UI.hotkeyName(s);
      pill.textContent = k.linked === false ? 'Sharing off' : WHERE[k.mode] || WHERE.home;
      pill.className = 'pill ' + (k.linked === false ? 'bad' : k.mode === 'home' ? 'muted' : 'good');
      row.setHint(k.helper && k.helper !== 'starting' ? k.helper
        : k.linked === false ? 'Cursor sharing is off. ' + hk + ' to turn it on.'
        : s.link.state !== 'connected' ? 'Waiting for your Mac'
          : k.mode === 'home' && !k.message ? 'Connected to the Mac. ' + hk + ' to turn cursor sharing off.'
          : k.message || hk + ({ home: ' to turn cursor sharing off', driving: ' to come back and turn cursor sharing off', driven: ' to take it back' }[k.mode] || ''));
    };
    return row;
  },

  go(id) {
    window.dispatchEvent(new CustomEvent('macshare-go', { detail: id }));
  },
};

window.UI = UI;
