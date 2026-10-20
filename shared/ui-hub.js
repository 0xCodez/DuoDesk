// TwinDesk — Copyright (C) 2026 inukaasith. GPL-3.0, see LICENSE.
// What the Calls, Messages and Photos pages share, on the Mac, PC and Linux alike (they use only
// the UI kit's common API): the line at the top of each saying what's missing — the phone, its
// permission (Allow asks on the phone, only now), the right TwinDesk on it — and the phone's
// answers (phonehub.js passes them on as 'hub' messages) by type.
'use strict';

(() => {
  const handlers = new Map(); // type -> [fn]
  let listening = false;

  // fn(msg) for each answer of this type from the phone.
  UI.hubOn = (t, fn) => {
    if (!handlers.has(t)) handlers.set(t, []);
    handlers.get(t).push(fn);
    if (listening || !UI.api.onHub) return;
    listening = true;
    UI.api.onHub((m) => {
      for (const f of handlers.get(m && m.t) || []) {
        try { f(m); } catch (e) { console.error(`hub ${m.t}:`, e); }
      }
    });
  };

  // Ask the phone (only while that page's switch is on: phonehub.js checks).
  UI.hubAsk = (msg) => UI.api.hub({ do: 'send', msg });

  // That page can show the phone's things now.
  UI.hubReady = (s, what) => {
    const h = s && s.hub;
    return !!(h && h[what] && h.connected && h.perm && h.perm[what] && ['ok', 'partial'].includes(h.perm[what].perm));
  };

  UI.phoneName = (s) => (s && s.hub && s.hub.name) || 'your phone';

  // page shown / hidden (the shells toggle `hidden`).
  UI.onShown = (page, fn) => {
    new MutationObserver(() => fn(!page.hidden)).observe(page, { attributes: true, attributeFilter: ['hidden'] });
  };

  const NEEDS = {
    calls: { state: 'its calls', numbers: 'who is calling and the call history', dial: 'making calls', answer: 'answering and ending calls', contacts: 'contact names' },
    messages: { read: 'reading texts', send: 'sending texts', contacts: 'contact names' },
  };
  const LABEL = { calls: 'Calls', messages: 'Messages', media: 'Photos and videos' };

  // The top of a page: { el, render(s) }.
  UI.hubTop = (what) => {
    const { el, api } = UI;
    const text = el('div', { class: 'hub-top-text' });
    const asked = el('div', { class: 'hint' });
    const allow = UI.button('Allow on the phone', () => {
      api.hub({ do: 'ask', what });
      allow.dataset.at = String(Date.now());
    }, 'primary');
    const install = UI.button('Install', () => UI.api.phoneInstallFull && UI.api.phoneInstallFull());
    const box = el('div', { class: 'note hub-top' }, [el('div', { class: 'hub-top-body' }, [text, asked]), el('div', { class: 'hub-top-actions' }, [install, allow])]);
    box.hidden = true;
    const render = (s) => {
      const h = s.hub || {};
      const phone = UI.phoneName(s);
      const st = h.perm && h.perm[what];
      let msg = '', kind = 'info', canAllow = false, canInstall = false;
      if (!h[what]) msg = `Off: nothing of it runs here or on ${phone}. When you switch it on, ${phone} asks for what it needs.`;
      else if (!h.connected) msg = `Connect ${phone} to use ${LABEL[what]}: click it at the top of the sidebar.`;
      else if (!h.supported) msg = `Waiting for ${phone}… TwinDesk on it needs to be up to date for ${LABEL[what]}.`;
      else if (st.perm === 'none') {
        msg = `${LABEL[what]} need TwinDesk with notifications on ${phone} (Android doesn’t let downloaded apps read texts). ${s.phone && s.phone.adb && s.phone.adb.address ? 'Install puts it on the phone through wireless debugging; your settings stay.' : 'Set up wireless debugging on the Phone page, then Install.'}`;
        kind = 'warn';
        canInstall = !!UI.api.phoneInstallFull;
      } else if (st.perm === 'ask') {
        msg = what === 'media' ? `Allow ${phone} to share its photos and videos with TwinDesk.` : `Allow ${LABEL[what]} on ${phone}: TwinDesk asks for ${Object.values(NEEDS[what]).join(', ')}.`;
        kind = 'warn';
        canAllow = true;
      } else if (st.perm === 'partial') {
        msg = what === 'media' ? `Only the photos you chose on ${phone} show here.`
          : `Some of ${LABEL[what]} needs more on ${phone}: ${(st.missing || []).map((m) => NEEDS[what][m]).filter(Boolean).join(', ')}.`;
        canAllow = true;
      }
      box.hidden = !msg;
      box.className = `note hub-top ${kind}`;
      text.textContent = msg;
      allow.hidden = !canAllow;
      install.hidden = !canInstall;
      const recently = Number(allow.dataset.at || 0) > Date.now() - 60000;
      asked.textContent = canAllow && recently ? (h.perm && h.perm.opens ? `Check ${phone}: Android asks there.` : `Tap the notification on ${phone}.`) : '';
      asked.hidden = !asked.textContent;
    };
    return { el: box, render };
  };

  UI.initial = (name) => {
    const t = String(name || '').trim();
    return /^[+\d]/.test(t) || !t ? '#' : t.charAt(0).toUpperCase();
  };

  UI.avatar = (name, photo) => {
    const a = UI.el('span', { class: 'hub-avatar', text: photo ? '' : UI.initial(name) });
    if (photo) a.style.backgroundImage = `url("${photo}")`;
    return a;
  };

  UI.clock = (ts) => {
    const d = new Date(ts);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    if (now - d < 6 * 86400000) return d.toLocaleDateString([], { weekday: 'short' });
    return d.toLocaleDateString([], { day: 'numeric', month: 'short', year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric' });
  };

  UI.duration = (s) => {
    s = Math.max(0, Math.round(s));
    return s >= 3600 ? `${Math.floor(s / 3600)}:${String(Math.floor(s / 60) % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}` : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  };
})();
