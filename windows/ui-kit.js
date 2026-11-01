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
  about: 'M10 2.5a7.5 7.5 0 1 0 0 15 7.5 7.5 0 0 0 0-15z M10 9v5 M10 6.2v.1',
  drive: 'M3 12h14v4H3z M14 14h.5 M10 3v6 M7 6l3 3 3-3',
  bell: 'M5.5 13.5V9a4.5 4.5 0 0 1 9 0v4.5l1.5 1.5h-12z M8.5 16.5a1.5 1.5 0 0 0 3 0',
  pin: 'M10 4v9 M5.5 8.5 10 13l4.5-4.5 M5 16h10',
  up: 'M10 16V4 M5 9l5-5 5 5',
  down: 'M10 4v12 M5 11l5 5 5-5',
  phone: 'M6.5 2.5h7a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-7a1 1 0 0 1-1-1v-13a1 1 0 0 1 1-1z M9 15h2',
  call: 'M6 3h2.5l1.2 3.2-1.7 1.3a9 9 0 0 0 4.5 4.5l1.3-1.7 3.2 1.2V16a1 1 0 0 1-1 1A13 13 0 0 1 3 4a1 1 0 0 1 1-1z',
  message: 'M3 4.5h14v9H8.5L5 16.5v-3H3z',
  photo: 'M3 4.5h14v11H3z M3 13l4-4 3.5 3.5 2-2L17 14.5 M12.5 7.5h.1',
  doc: 'M5 2.5h6.5L15 6v11.5H5z M11.5 2.5V6H15',
  folder: 'M2.5 5h5.5l1.5 2h8v9.5h-15z',
  camera: 'M2.5 6h10v8h-10z M12.5 8.5l5-2.5v8l-5-2.5', // a video camera: Camera
  rezume: 'M2 4.5h8v6H2z M1 12.5h10 M13.5 6.5h4.5v10h-4.5z M15.2 14.5h1.1 M3.5 16h6 M8 14.4l1.6 1.6L8 17.6', // a computer and a phone, something going across: ReZume
  remote: 'M7 2.5h6v15H7z M10 5.2v.1 M8.6 8.5h2.8 M8.6 11h2.8 M8.6 13.5h2.8', // a remote control: Remote
  globe: 'M10 2.5a7.5 7.5 0 1 0 0 15 7.5 7.5 0 0 0 0-15z M2.5 10h15 M10 2.5c-2.2 2.3-2.2 12.7 0 15 M10 2.5c2.2 2.3 2.2 12.7 0 15', // Sharing
  link: 'M8.5 11.5a3.2 3.2 0 0 0 4.5 0l2.5-2.5a3.2 3.2 0 0 0-4.5-4.5l-.8.8 M11.5 8.5a3.2 3.2 0 0 0-4.5 0L4.5 11a3.2 3.2 0 0 0 4.5 4.5l.8-.8', // two chain links: Connection
  multi: 'M2 5h9v6.5H2z M5 14h3 M6.5 11.5V14 M13 4h5v12h-5z M15 13.5h1', // a computer and a phone: Multi-device
  tip: 'M10 16.2C6.2 13.8 3.5 11.2 3.5 8.3a3.1 3.1 0 0 1 6.5-1.9 3.1 3.1 0 0 1 6.5 1.9c0 2.9-2.7 5.5-6.5 7.9z', // a heart: Tip (shared/ui-support.js)
  feedback: 'M3.5 4.5h13v9h-7l-3.5 3v-3H3.5z M7 8h6 M7 10.5h3.5', // a speech bubble with two lines: Feedback
};

// The Details rows are asked for by these English ids; the card shows them translated.
const DETAIL_LABELS = {
  Status: () => UI.t('kit.status', null, 'Status'),
  Display: () => UI.t('kit.display', null, 'Display'),
  Picture: () => UI.t('kit.picture', null, 'Picture'),
  Speed: () => UI.t('kit.speed', null, 'Speed'),
  'Round trip': () => UI.t('kit.round_trip', null, 'Round trip'),
  Codec: () => UI.t('kit.codec', null, 'Codec'),
  Decoder: () => UI.t('kit.decoder', null, 'Decoder'),
  Encoder: () => UI.t('kit.encoder', null, 'Encoder'),
  Delay: () => UI.t('kit.delay', null, 'Delay'),
  'Frames dropped': () => UI.t('kit.frames_dropped', null, 'Frames dropped'),
  Freezes: () => UI.t('kit.freezes', null, 'Freezes'),
};

const UI = {
  api: window.macshare,
  P: window.MacShareProtocol,
  tabs: [],
  state: null,
  // Translate: the same lookup the tab scripts use (shared/i18n.js), English when it isn't loaded.
  t: (k, p, d) => (typeof window.t === 'function' ? window.t(k, p, d) : d !== undefined ? d : k),

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
  // Labels and hints may name the computers: {me} (this PC's name), {name} / {Name} (the other
  // one's, or "the other computer"); app.js fills them in again whenever a name changes.
  row(label, hint, controls = [], { onClick } = {}) {
    const lab = UI.el('span', { class: 'label', text: UI.fill(label) });
    if (String(label).includes('{')) lab.dataset.peer = label;
    const hintEl = UI.el('span', { class: 'hint', text: UI.fill(hint || '') });
    if (String(hint || '').includes('{')) hintEl.dataset.peer = hint;
    if (!hint) hintEl.hidden = true;
    const row = UI.el('div', { class: 'row' }, [
      UI.el('div', { class: 'text' }, [lab, hintEl]),
      UI.el('div', { class: 'controls' }, [].concat(controls).map((c) => (c && c.el) || c)),
    ]);
    row.label = lab;
    row.hint = hintEl;
    row.setHint = (t) => {
      if (String(t || '').includes('{')) hintEl.dataset.peer = t;
      else delete hintEl.dataset.peer;
      hintEl.textContent = UI.fill(t || '');
      hintEl.hidden = !t;
    };
    if (onClick) {
      row.classList.add('clickable');
      row.onclick = (e) => { if (!e.target.closest('input,button,select')) onClick(); };
    }
    return row;
  },

  card(title, rows, { actions, cls = '' } = {}) {
    const wrap = UI.el('div', { class: 'card-wrap' });
    const tEl = title ? UI.el('span', { text: UI.fill(title) }) : null;
    if (title && title.includes('{')) tEl.dataset.peer = title;
    if (title) wrap.append(UI.el('div', { class: 'card-title' }, [tEl, actions ? UI.el('span', { class: 'actions' }, actions) : null]));
    const card = UI.el('div', { class: `card ${cls}`.trim() }, rows);
    wrap.append(card);
    wrap.card = card;
    return wrap;
  },

  note(kind, text) {
    const n = UI.el('div', { class: `note ${kind}`, text: UI.fill(text) });
    n.set = (t) => { n.textContent = UI.fill(t || ''); n.hidden = !t; };
    return n;
  },

  ago(ts) {
    if (!ts) return UI.t('kit.never', null, 'never');
    const s = Math.round((Date.now() - ts) / 1000);
    if (s < 10) return UI.t('kit.just_now', null, 'just now');
    if (s < 60) return UI.t('kit.seconds_ago', { seconds: s }, '{seconds} s ago');
    if (s < 3600) return UI.t('kit.minutes_ago', { minutes: Math.round(s / 60) }, '{minutes} min ago');
    if (s < 86400) return UI.t('kit.hours_ago', { hours: Math.round(s / 3600) }, '{hours} h ago');
    return new Date(ts).toLocaleDateString();
  },

  bytes(n) {
    return n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(1)} MB`;
  },

  // Register a tab: { id, title, desc, color, phase?, bottom?, master?: {get(s), set(v), disabled?: bool | (s) => bool},
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
            el('div', { class: 'soon-head' }, [el('span', { class: 'pill', text: UI.t('kit.coming_in_phase', { phase: r.phase }, 'Coming in phase {phase}') })]),
            ...r.what.map(([t, d]) => el('div', { class: 'soon-item' }, [el('strong', { text: t }), el('div', { class: 'hint', text: d })])),
          ]),
          UI.card(UI.t('kit.how_it_will_work', null, 'How it will work'), [UI.row(r.how, '')], { cls: 'keep-on' }),
          UI.card(UI.t('kit.settings_it_will_have', null, 'Settings it will have'), r.settings.map((label) => UI.row(label, '', [UI.switch(() => {}, { disabled: true, label })]))),
        );
      },
    });
  },

  // Live Details card: labels → value cells. set({label: text}) fills
  // them; rows without a value are hidden.
  details(labels) {
    const vals = {};
    const rows = labels.map((label) => {
      const r = UI.row(DETAIL_LABELS[label] ? DETAIL_LABELS[label]() : label, '');
      vals[label] = UI.el('span', { class: 'value' });
      r.querySelector('.controls').append(vals[label]);
      return r;
    });
    const card = UI.card(UI.t('kit.details', null, 'Details'), rows);
    card.set = (map) => labels.forEach((label, i) => {
      const t = map[label];
      vals[label].textContent = t == null ? '' : String(t);
      rows[i].hidden = t == null || t === '';
    });
    return card;
  },

  // "Hardware" / "Software" from getStats' powerEfficient flag, with the implementation name.
  codecImpl(name, hw) {
    if (!name) return hw ? UI.t('kit.hardware', null, 'Hardware') : UI.t('kit.software', null, 'Software');
    return hw ? UI.t('kit.hardware_name', { name }, 'Hardware ({name})') : UI.t('kit.software_name', { name }, 'Software ({name})');
  },

  // Who the other computer is: titles name what is connected. With a
  // Mac (or Linux): "Mac → PC" / "PC → Mac". With another PC, or nothing paired yet, this PC is
  // "PC1" and the other "PC2"; real names show in the
  // overview and the paired list. toMe = the peer's things here, fromMe = this PC's things there.
  peer(s) {
    const p = s && s.peer;
    const os = p ? p.os : 'win';
    const KIND = { mac: 'Mac', win: 'PC', linux: 'Linux', android: UI.t('sidebar.phone', null, 'Phone') };
    const same = os === 'win';
    // Device names everywhere: this PC by its own name,
    // the other computer by its name (or "the other computer" before anything was paired).
    const me = (s && s.device && s.device.name) || UI.t('kit.this_pc', null, 'This PC');
    const name = (p && p.name) || UI.t('kit.the_other_computer', null, 'the other computer');
    const Name = name.charAt(0).toUpperCase() + name.slice(1);
    return {
      os, same, me, name, Name, phone: os === 'android',
      kind: KIND[os],
      them: name, us: me, the: name, there: name, There: Name, // older templates
      toMe: name + ' → ' + me,
      fromMe: me + ' → ' + name,
      limited: '', // every tab works with every computer now
    };
  },

  // After a render: any {me} / {name} / … still in text or a title under root gets filled. A text
  // node that is its element's only child keeps its template (data-peer), so a new name refills it.
  fillTree(root) {
    if (!root) return;
    const re = /\{(me|name|Name|there|There)\}/;
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    for (let n = w.nextNode(); n; n = w.nextNode()) if (re.test(n.nodeValue)) nodes.push(n);
    for (const n of nodes) {
      const el = n.parentElement;
      if (el && el.childNodes.length === 1 && !el.dataset.peer) el.dataset.peer = n.nodeValue;
      n.nodeValue = UI.fill(n.nodeValue);
    }
    for (const el of root.querySelectorAll('[title*="{"], [aria-label*="{"]')) {
      for (const a of ['title', 'aria-label']) if (el.hasAttribute(a)) el.setAttribute(a, UI.fill(el.getAttribute(a)));
    }
  },

  // Playback of shared screens (both directions, the same on both computers via
  // pair.sync): one row used by Share and Receive. Returns the row with .render(state).
  paceRow() {
    const seg = UI.segmented([
      { value: 'fast', label: UI.t('kit.fastest', null, 'Fastest') },
      { value: 'smooth', label: UI.t('kit.smooth', null, 'Smooth') },
    ], (v) => UI.api.setMonitor({ pacing: v }));
    const row = UI.row(UI.t('kit.playback', null, 'Playback'), '', [seg]);
    row.render = (s) => {
      const pace = (s.monitor && s.monitor.pacing) || 'fast';
      seg.set(pace);
      row.setHint(pace === 'smooth' ? UI.t('kit.even_motion_about_one_frame', null, 'Even motion, about one frame later. The same on {name}')
        : UI.t('kit.each_frame_the_moment_it', null, 'Each frame the moment it arrives. The same on {name}'));
    };
    return row;
  },

  // A template with {me}, {name}, {Name}, … filled from the current state.
  fill(t) {
    if (!t || !String(t).includes('{')) return t || '';
    const p = UI.peer(UI.state);
    return String(t).replace(/\{(\w+)\}/g, (m, k) => (k in p ? p[k] : m));
  },

  isPhone: (s) => !!(s && s.session && s.session.os === 'android'),

  // Small device glyph by OS: 'mac' | 'win' | 'linux' | 'android'.
  osClass: (os) => (os === 'mac' ? 'mac' : os === 'android' ? 'phone' : 'pc'),
  // An app's icon in a grid: its own, else (none, or it doesn't load) TwinDesk's.
  appIcon(src) {
    const fallback = 'assets/sidebar-icon@2x.png';
    const img = UI.el('img', { src: src || fallback, alt: '' });
    img.onerror = () => { img.onerror = null; img.src = fallback; };
    return img;
  },
  osIcon(os) {
    return UI.el('span', { class: `os-ico ${UI.osClass(os)}`, attrs: { 'aria-label': os === 'mac' ? 'Mac' : os === 'linux' ? 'Linux' : os === 'android' ? UI.t('sidebar.phone', null, 'Phone') : 'PC' } });
  },

  // Two equal direction cards, always Mac → PC then PC → Mac.
  // Each def: { on?: {get(s), set(v), disabled?}, label?, hint?, rows: [], soon?: 'phase N' }.
  // (as the Mac): the head is a route — device icon + real name, a line with an
  // arrowhead, the other device; this PC's side tinted. The switch sits in the first row, whose
  // label is a sentence with real names ({name} = the other computer, filled in by app.js).
  // Returns { el, update(s) }; each card has .main (that first row, when there is a switch).
  dirCards(m2p, p2m) {
    const node = (me) => {
      const ico = UI.el('span', { class: 'os-ico ' + (me ? 'pc' : 'mac') });
      if (!me) ico.dataset.os = 'peer';
      const nm = UI.el('span', { class: 'nm', text: UI.fill(me ? '{me}' : '{name}') });
      nm.dataset.peer = me ? '{me}' : '{name}';
      return UI.el('span', { class: 'node' + (me ? ' here' : '') }, [ico, nm]);
    };
    const make = (dir, def) => {
      const toMe = dir === 'm2p';
      const route = UI.el('span', { class: 'route', attrs: { role: 'img' } }, [node(!toMe), UI.el('span', { class: 'flow' }), node(toMe)]);
      const head = UI.el('div', { class: 'dir-head' }, [route, def.soon ? UI.el('span', { class: 'pill muted', text: UI.t('kit.coming_in_phase', { phase: def.soon }, 'Coming in phase {phase}') }) : null]);
      let sw = null, main = null;
      if (def.on) {
        const label = def.label || (toMe ? '{name} on {me}' : '{me} on {name}');
        sw = UI.switch((v) => def.on.set(v), { label: UI.fill(label), disabled: !!def.on.disabled || !!def.soon });
        main = UI.row(label, def.hint || '', [sw.el]);
        main.classList.add('dir-main');
      }
      const card = UI.el('div', { class: 'dir-card' + (def.soon ? ' soon-card' : '') }, [head].concat(main ? [main] : [], def.rows || []));
      card.main = main;
      card.update = (s) => {
        if (!sw) return;
        const on = !def.soon && !!def.on.get(s);
        sw.set(on);
        card.classList.toggle('off', !on);
      };
      return card;
    };
    const a = make('m2p', m2p), b = make('p2m', p2m);
    return { el: UI.el('div', { class: 'dir-pair' }, [a, b]), a, b, update: (s) => { a.update(s); b.update(s); } };
  },

  // "Control+Alt+C" → "Ctrl+Alt+C" (Electron accelerator → how Windows writes it).
  keysLabel(acc) {
    return String(acc || '').split('+').map((p) => ({ Control: 'Ctrl', Super: 'Win', Scrolllock: 'Scroll Lock' }[p] || p)).join('+');
  },

  // A shortcut recorder: click, press the keys (with Ctrl, Alt or Win), Esc cancels.
  // onChange(accelerator). opts.bare: Scroll Lock and F13–F24 also count on their own.
  keyRecorder(onChange, opts = {}) {
    const b = UI.el('button', { class: 'btn small keyrec' });
    let value = '', recording = false;
    const show = () => { b.textContent = recording ? UI.t('kit.press_keys', null, 'Press keys…') : UI.keysLabel(value) || UI.t('cursor.none', null, 'None'); b.classList.toggle('on', recording); };
    const keyOf = (e) => {
      if (/^Key[A-Z]$/.test(e.code)) return e.code.slice(3);
      if (/^Digit\d$/.test(e.code)) return e.code.slice(5);
      if (/^F\d{1,2}$/.test(e.code)) return e.code;
      if (opts.bare && e.code === 'ScrollLock') return 'Scrolllock';
      return { Space: 'Space', Tab: 'Tab', Backspace: 'Backspace', Delete: 'Delete', Enter: 'Enter', ArrowUp: 'Up', ArrowDown: 'Down', ArrowLeft: 'Left', ArrowRight: 'Right' }[e.code] || '';
    };
    const bare = (key) => opts.bare && /^(?:Scrolllock|F(?:1[3-9]|2[0-4]))$/.test(key);
    const onKey = (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === 'Escape') return stop();
      const key = keyOf(e);
      if (!key || !(e.ctrlKey || e.altKey || e.metaKey || bare(key))) return; // wait for a real combination
      value = [e.ctrlKey && 'Control', e.altKey && 'Alt', e.shiftKey && 'Shift', e.metaKey && 'Super', key].filter(Boolean).join('+');
      stop();
      onChange(value);
    };
    const stop = () => { recording = false; window.removeEventListener('keydown', onKey, true); show(); };
    b.onclick = () => {
      if (recording) return stop();
      recording = true;
      window.addEventListener('keydown', onKey, true);
      show();
    };
    b.onblur = stop;
    show();
    return { el: b, set(v) { if (!recording) { value = v || ''; show(); } } };
  },

  // The hotkey choices (P.HOTKEYS) as this PC names them.
  // Right, left or either side (P.HOTKEYS), in this PC's words ("Left Ctrl", "Alt (either side)").
  HOTKEYS: Object.fromEntries(window.MacShareProtocol.HOTKEYS.map((c) => [c, window.MacShareProtocol.hotkeyName(c, 'win')])),
  hotkeyName(s) {
    return UI.P.hotkeyName((s && s.keys && s.keys.hotkey) || 'AltRight', 'win');
  },

  // Cursor tab › Cursor lock (shared/cursorlock.js): the switch is not a setting, it lasts until the
  // pointer is moved some other way; the lock key is (settings.keys.lockKeys).
  cursorLock() {
    const lock = UI.switch((v) => UI.api.setKvm({ locked: v }), { label: UI.t('kit.lock_the_cursor', null, 'Lock the cursor') });
    const lockRow = UI.row(UI.t('kit.lock_the_cursor', null, 'Lock the cursor'), '', [lock]);
    const key = UI.keyRecorder((v) => UI.api.setKeys({ lockKeys: v }), { bare: true });
    const keyRow = UI.row(UI.t('kit.lock_key', null, 'Lock key'), UI.t('kit.scroll_lock_or_f13_f24', null, 'Scroll Lock or F13–F24 on its own, or a combination with Ctrl, Alt or Win'), [key.el]);
    return {
      el: UI.card(UI.t('kit.cursor_lock', null, 'Cursor lock'), [lockRow, keyRow]),
      update(s) {
        const k = s.kvmState;
        const connected = s.link.state === 'connected';
        const p = UI.peer(s);
        lock.set(k.locked);
        lock.disable(!connected);
        key.set(s.keys.lockKeys);
        const where = k.mode === 'driving' ? p.name : p.me;
        const keys = s.keys.lockKeys ? UI.keysLabel(s.keys.lockKeys) : '';
        const q = { me: p.me, keys, where };
        lockRow.setHint(k.lockError ? k.lockError : !connected
          ? (keys ? UI.t('kit.keeps_pointer_one_computer_keys', q, 'Keeps the pointer on one computer, even when the mouse is plugged into another. While the pointer is on {me}, {keys} on either keyboard locks or unlocks it (each computer has its own key).')
            : UI.t('kit.keeps_pointer_one_computer', null, 'Keeps the pointer on one computer, even when the mouse is plugged into another.'))
          : k.locked
            ? (keys ? UI.t('kit.pointer_stays_on_where_keys', q, 'The pointer stays on {where}: the screen edges don’t cross. While the pointer is on {me}, {keys} on either keyboard locks or unlocks it (each computer has its own key).')
              : UI.t('kit.pointer_stays_on_where', q, 'The pointer stays on {where}: the screen edges don’t cross.'))
            : (keys ? UI.t('kit.keeps_pointer_on_where_keys', q, 'Keeps the pointer on {where}, where it is now, even when the mouse is plugged into another computer. While the pointer is on {me}, {keys} on either keyboard locks or unlocks it (each computer has its own key).')
              : UI.t('kit.keeps_pointer_on_where', q, 'Keeps the pointer on {where}, where it is now, even when the mouse is plugged into another computer.')));
      },
    };
  },

  // "Right now" row for the Cursor/Keyboard tabs: where input is + the last KVM event.
  inputStatus() {
    const pill = UI.el('span', { class: 'pill' });
    const row = UI.row(UI.t('kit.keyboard_and_mouse', null, 'Keyboard and mouse'), '', [pill]);
    row.update = (s) => {
      const k = s.kvmState;
      const p = UI.peer(s);
      const WHERE = { home: UI.t('kit.on_me', { me: p.me }, 'On {me}'), driving: UI.t('kit.on_name', { name: p.name }, 'On {name}'), driven: UI.t('kit.name_is_using_me', { Name: p.Name, me: p.me }, '{Name} is using {me}') };
      const off = k.linked === false || k.paused;
      pill.textContent = off ? UI.t('kit.sharing_off', null, 'Sharing off') : k.locked ? UI.t('kit.locked_where', { where: WHERE[k.mode] || WHERE.home }, 'Locked · {where}') : (WHERE[k.mode] || WHERE.home);
      pill.className = 'pill ' + (off ? 'bad' : k.mode === 'home' ? 'muted' : 'good');
      const hk = { hotkey: UI.hotkeyName(s) };
      row.setHint(k.helper && k.helper !== 'starting' ? k.helper
        : k.linked === false ? UI.t('kit.cursor_sharing_is_off_double_tap', hk, 'Cursor sharing is off. Double-tap {hotkey} to turn it on.')
        : k.paused ? UI.t('kit.cursor_sharing_is_off_over_bluetooth', hk, 'Cursor sharing is off over Bluetooth. It comes back on Wi-Fi, or double-tap {hotkey} to turn it on.')
        : s.link.state !== 'connected' ? UI.t('kit.waiting_for_name', { name: p.the }, 'Waiting for {name}')
          : k.mode === 'home' && !k.message ? UI.t('kit.connected_to_name_double_tap', { name: p.name, hotkey: hk.hotkey }, 'Connected to {name}. Double-tap {hotkey} to turn cursor sharing off.')
          : k.message || (k.mode === 'home' ? UI.t('kit.double_tap_to_turn_cursor_off', hk, 'Double-tap {hotkey} to turn cursor sharing off')
            : k.mode === 'driving' ? UI.t('kit.double_tap_to_come_back', hk, 'Double-tap {hotkey} to come back and turn cursor sharing off')
              : k.mode === 'driven' ? UI.t('kit.double_tap_to_take_it_back', hk, 'Double-tap {hotkey} to take it back')
                : UI.t('kit.double_tap_hotkey', hk, 'Double-tap {hotkey}')));
    };
    return row;
  },

  go(id) {
    window.dispatchEvent(new CustomEvent('macshare-go', { detail: id }));
  },
};

window.UI = UI;
