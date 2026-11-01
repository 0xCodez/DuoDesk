// TwinDesk — Copyright (C) 2026 inukaasith. GPL-3.0, see LICENSE.
// Calls page (Mac, PC and Linux): the phone's calls here — the one going on, calling a name or a
// number, the sound over Bluetooth (this computer as the phone's headset) and the call history.
'use strict';
var tr = (k, p, d) => (typeof t === 'function' ? t(k, p, d) : (d || k));

UI.tab({
  id: 'calls',
  group: 'Phone',
  order: 5,
  title: 'Calls',
  icon: 'call',
  color: 'linear-gradient(#5ee07a, #30b94d)',
  desc: tr('calls.desc', null, 'Answer and make your phone’s calls here.'),
  hidden: (s) => !UI.isPhone(s), // only while a phone is connected
  master: { get: (s) => !!(s.hub && s.hub.calls), set: (v) => UI.api.hub({ do: 'set', what: 'calls', on: v }) },
  badge: (s) => (s.hub && s.hub.call ? 'warn' : s.hub && s.hub.calls ? 'on' : ''),
  build(body, page) {
    const { el, api } = UI;
    const top = UI.hubTop('calls');

    // The call going on.
    const avatarSlot = el('span');
    const who = el('span', { class: 'label' });
    const sub = el('span', { class: 'hint' });
    const act = (a, extra = {}) => api.hub({ do: 'call', a, ...extra });
    const answer = UI.button(tr('calls.answer', null, 'Answer'), () => act('answer'), 'primary');
    const decline = UI.button(tr('calls.decline', null, 'Decline'), () => act('end'), 'danger');
    const mute = UI.button(tr('calls.mute', null, 'Mute'), () => act('mute', { on: !(UI.state.hub && UI.state.hub.muted) }));
    const where = UI.button(tr('calls.sound_here', null, 'Sound here'), () => api.hub({ do: 'audio', a: UI.state.hub.audio && UI.state.hub.audio.here ? 'phone' : 'here' }));
    const end = UI.button(tr('calls.end', null, 'End'), () => act('end'), 'danger');
    const nowRow = el('div', { class: 'row hub-call' }, [avatarSlot, el('div', { class: 'text' }, [who, sub]), el('div', { class: 'controls' }, [mute, where, decline, end, answer])]);
    const nowCard = UI.card(tr('calls.card_now', null, 'Now'), [nowRow]);

    // Call a number: typed, or on the keypad; the contacts it matches show under it.
    const number = el('input', { type: 'tel', class: 'hub-input hub-number', placeholder: tr('calls.enter_number', null, 'Enter a number'), spellcheck: false, autocomplete: 'off', attrs: { 'aria-label': tr('calls.number_aria', null, 'Number') } });
    const callBtn = UI.button(tr('calls.call', null, 'Call'), () => dial(number.value), 'primary');
    const padBtn = UI.button(tr('calls.keypad', null, 'Keypad'), () => { pad.hidden = !pad.hidden; padBtn.classList.toggle('on', !pad.hidden); number.focus(); });
    const KEYS = [['1', ''], ['2', 'ABC'], ['3', 'DEF'], ['4', 'GHI'], ['5', 'JKL'], ['6', 'MNO'], ['7', 'PQRS'], ['8', 'TUV'], ['9', 'WXYZ'], ['*', ''], ['0', '+'], ['#', '']];
    const pad = el('div', { class: 'hub-keypad', hidden: true }, [
      ...KEYS.map(([k, sub]) => {
        const b = el('button', { class: 'hub-key', attrs: { 'aria-label': k } }, [el('span', { text: k }), el('small', { text: sub })]);
        b.onclick = () => key(k);
        return b;
      }),
      el('span'),
      Object.assign(el('button', { class: 'hub-key hub-key-call', title: tr('calls.call', null, 'Call'), attrs: { 'aria-label': tr('calls.call', null, 'Call') } }, [UI.icon('call')]), { onclick: () => dial(number.value) }),
      Object.assign(el('button', { class: 'hub-key hub-key-del', text: '⌫', title: tr('calls.delete', null, 'Delete'), attrs: { 'aria-label': tr('calls.delete', null, 'Delete') } }), {
        onclick: () => { number.value = number.value.slice(0, -1); typed(); number.focus(); },
      }),
    ]);
    const matches = el('div', { class: 'hub-list' });
    const dialCard = UI.card(tr('calls.card_call', null, 'Call'), [el('div', { class: 'row hub-dial' }, [number, padBtn, callBtn]), pad, matches]);
    const digits = (v) => String(v || '').replace(/[^\d+]/g, '');
    // Typed digits in a saved number, the trunk 0 aside (0771… finds +94 771…).
    const has = (n, d) => { const x = digits(n); const local = d.replace(/^0+/, ''); return x.includes(d) || (local.length >= 3 && x.includes(local)); };
    const isNumber = (v) => /^[\d\s()+*#.,;-]+$/.test(v.trim()) && /\d|[*#]/.test(v);
    const dial = (n) => {
      const v = String(n || '').trim();
      if (!isNumber(v)) return;
      act('dial', { number: v });
      number.value = '';
      typed();
    };
    const key = (k) => {
      number.value += k;
      typed();
      number.focus();
    };
    const typed = () => {
      const v = number.value.trim();
      callBtn.disabled = !isNumber(v);
      const d = digits(v).replace(/^\+/, '');
      const hits = d.length >= 3 ? contacts.filter((p) => p.numbers.some((x) => has(x.n, d))).slice(0, 4) : [];
      matches.replaceChildren(...hits.map((p) => contactRow(p, d)));
    };
    number.oninput = typed;
    number.onkeydown = (e) => { if (e.key === 'Enter') dial(number.value); };
    callBtn.disabled = true;

    // The phone's contacts: all of them, searched here.
    let contacts = []; // [{name, starred, numbers: [{n, label}]}]
    let contactsLoaded = false;
    let shownContacts = 60;
    const search = el('input', { type: 'search', class: 'hub-input hub-grow', placeholder: tr('calls.search_contacts', null, 'Search contacts'), spellcheck: false, attrs: { 'aria-label': tr('calls.search_contacts', null, 'Search contacts') } });
    const contactList = el('div', { class: 'hub-list hub-scroll' });
    const moreContacts = UI.button(tr('calls.show_more', null, 'Show more'), () => { shownContacts += 100; showContacts(); }, 'small');
    const loadContacts = () => { contactsLoaded = true; UI.hubAsk({ t: 'contacts', q: '' }); };
    const contactsCard = UI.card(tr('calls.card_contacts', null, 'Contacts'), [el('div', { class: 'row hub-dial' }, [search]), contactList, el('div', { class: 'hub-more' }, [moreContacts])],
      { actions: [UI.button(tr('general.refresh', null, 'Refresh'), loadContacts, 'small')] });
    // A contact with a Call button; with several numbers, which one (the one matching `d` first).
    const contactRow = (p, d = '') => {
      const nums = p.numbers;
      const first = (d && nums.find((x) => has(x.n, d))) || nums[0];
      const line = (x) => `${x.label ? `${x.label} · ` : ''}${x.n}`;
      let pick = null;
      if (nums.length > 1) {
        pick = UI.select(nums.map((x) => ({ value: x.n, label: line(x) })), () => {});
        pick.set(first.n);
      }
      const r = UI.row(p.name, nums.length > 1 ? tr('calls.n_numbers', { count: nums.length }, `${nums.length} numbers`) : line(first),
        [pick && pick.el, UI.button(tr('calls.call', null, 'Call'), () => dial(pick ? pick.el.value : first.n), 'small')].filter(Boolean));
      if (p.starred) r.label.classList.add('hub-starred');
      r.prepend(UI.avatar(p.name));
      return r;
    };
    const showContacts = () => {
      const q = search.value.trim().toLowerCase();
      const d = digits(q).replace(/^\+/, '');
      const list = !q ? contacts : contacts.filter((p) => p.name.toLowerCase().includes(q) || (d.length >= 2 && p.numbers.some((x) => has(x.n, d))));
      contactList.replaceChildren(...list.slice(0, shownContacts).map((p) => contactRow(p, d.length >= 2 ? d : '')));
      if (!list.length) contactList.append(el('div', { class: 'hub-empty', text: !contactsLoaded ? '' : q ? tr('calls.no_contacts_match', null, 'No contacts match') : contacts.length ? '' : tr('calls.no_contacts_phone', null, 'No contacts on the phone') }));
      moreContacts.hidden = list.length <= shownContacts;
    };
    let searchTimer = 0;
    search.oninput = () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => { shownContacts = 60; showContacts(); }, 120);
    };
    UI.hubOn('contacts', (m) => {
      if (m.q) return; // only the whole list is asked for
      contacts = (m.items || []).filter((p) => p && Array.isArray(p.numbers) && p.numbers.length)
        .map((p) => ({ name: String(p.name || p.numbers[0].n), starred: !!p.starred, numbers: p.numbers.filter((x) => x && x.n).map((x) => ({ n: String(x.n), label: String(x.label || '') })) }))
        .sort((a, b) => (b.starred - a.starred) || a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
      showContacts();
      typed();
    });

    // The sound over Bluetooth: this computer as the phone's headset.
    const audioSw = UI.switch((v) => api.hub({ do: 'opt', callAudio: v }), { label: tr('calls.talk_listen_computer', null, 'Talk and listen on this computer') });
    const audioRow = UI.row(tr('calls.talk_listen_row', null, 'Talk and listen on {me}'), '', [audioSw]);
    const retryBtn = UI.button(tr('connections.connect', null, 'Connect'), () => api.hub({ do: 'audio', a: 'connect' }));
    // Which paired Bluetooth device the phone is, when its name didn't say (or to change it).
    const which = UI.select([], (id) => id && api.hub({ do: 'opt', btDevice: id }));
    which.el.setAttribute('aria-label', tr('calls.which_phone_aria', null, 'Which phone'));
    const statusRow = UI.row(tr('connections.bt', null, 'Bluetooth'), '', [which.el, retryBtn]);
    const soundCard = UI.card(tr('calls.card_sound', null, 'Sound'), [audioRow, statusRow]);

    // Setting it up: the person pairs the two in the systems' own Bluetooth settings, over classic
    // Bluetooth (what a call goes through); TwinDesk doesn't pair them itself, only says how, and
    // connects once they are. Forget at the bottom: both forget each other, classic and LE.
    const settingsBtn = UI.button(tr('calls.open_bt_settings', null, 'Open Bluetooth settings'), () => api.hub({ do: 'audio', a: 'settings' }), 'small primary');
    const step1 = UI.row('', '');
    const step2 = UI.row('', '', [settingsBtn]);
    const step3 = UI.row(tr('calls.step3_confirm', null, '3. Confirm the code on both'), '');
    const pairedRow = UI.row('', '');
    const forgetBtn = UI.button(tr('calls.forget', null, 'Forget'), () => {
      if (forgetBtn.dataset.sure !== '1') { forgetBtn.dataset.sure = '1'; forgetBtn.textContent = tr('calls.forget_confirm', null, 'Forget?'); forgetBtn.classList.add('danger'); return; }
      unsure();
      api.hub({ do: 'audio', a: 'forget' });
    }, 'small');
    const unsure = () => { forgetBtn.dataset.sure = ''; forgetBtn.textContent = tr('calls.forget', null, 'Forget'); forgetBtn.classList.remove('danger'); };
    const forgetRow = UI.row(tr('calls.forget', null, 'Forget'), '', [forgetBtn]);
    const setupCard = UI.card(tr('calls.card_bt_setup', null, 'Bluetooth setup'), [step1, step2, step3, pairedRow, forgetRow]);
    // Back in this window from pairing (Settings, or the phone): connected at once when they are.
    window.addEventListener('focus', () => {
      const a = UI.state && UI.state.hub && UI.state.hub.audio;
      if (a && ['needs-pair', 'choose'].includes(a.state)) api.hub({ do: 'audio', a: 'check' });
    });

    // The call history.
    const recent = el('div', { class: 'hub-list hub-scroll' });
    const reload = UI.button(tr('general.refresh', null, 'Refresh'), () => UI.hubAsk({ t: 'call.log', n: 100 }), 'small');
    const recentCard = UI.card(tr('calls.card_recent', null, 'Recent'), [recent], { actions: [reload] });
    const TYPE = { in: tr('calls.type_incoming', null, 'Incoming'), out: tr('calls.type_outgoing', null, 'Outgoing'), missed: tr('calls.type_missed', null, 'Missed'), rejected: tr('calls.type_declined', null, 'Declined'), blocked: tr('calls.type_blocked', null, 'Blocked'), voicemail: tr('calls.type_voicemail', null, 'Voicemail') };
    UI.hubOn('call.log', (m) => {
      recent.replaceChildren(...(m.items || []).map((c) => {
        const r = UI.row(c.name || c.number || tr('calls.unknown_number', null, 'Unknown number'), `${TYPE[c.type] || ''}${c.dur && c.type !== 'missed' ? ` · ${UI.duration(c.dur)}` : ''} · ${UI.clock(c.at)}`,
          c.number ? [UI.button(tr('calls.call', null, 'Call'), () => dial(c.number), 'small')] : []);
        if (c.type === 'missed' || c.type === 'rejected') r.label.classList.add('hub-missed');
        r.prepend(UI.avatar(c.name || c.number));
        return r;
      }));
      if (!recent.children.length) recent.append(el('div', { class: 'hub-empty', text: m.items ? tr('calls.no_calls_yet', null, 'No calls yet') : '' }));
    });

    body.append(top.el, nowCard, dialCard, recentCard, contactsCard, soundCard, setupCard);

    let loaded = false;
    let hadCall = false;
    const canContacts = (s) => UI.hubReady(s, 'calls') && !(s.hub.perm.calls.missing || []).includes('contacts');
    let loadedAt = 0;
    const load = () => {
      loaded = true;
      if (Date.now() - loadedAt < 2000) return; // shown and rendered at once: asked once
      loadedAt = Date.now();
      UI.hubAsk({ t: 'call.log', n: 100 });
      if (!contactsLoaded && canContacts(UI.state)) loadContacts();
    };
    UI.onShown(page, (shown) => { if (shown && UI.hubReady(UI.state, 'calls')) load(); });
    UI.onDeviceChange(() => { // another device: its call log and contacts, not the previous one's
      loaded = false;
      loadedAt = 0;
      contactsLoaded = false;
      contacts = [];
      showContacts();
      typed();
      if (!page.hidden && UI.hubReady(UI.state, 'calls')) load();
    });

    return (s) => {
      const h = s.hub || {};
      top.render(s);
      const ready = UI.hubReady(s, 'calls');
      if (!ready) {
        loaded = false;
        if (contactsLoaded || contacts.length) { contactsLoaded = false; contacts = []; showContacts(); typed(); } // another phone, or none: asked again
      } else if (!loaded && !page.hidden) load();
      else if (!contactsLoaded && !page.hidden && canContacts(s)) loadContacts(); // allowed since
      const c = h.call;
      if (hadCall && !c && ready) setTimeout(() => UI.hubAsk({ t: 'call.log', n: 100 }), 1500); // the call just ended is in the log now
      hadCall = !!c;

      nowCard.hidden = !c;
      if (c) {
        avatarSlot.replaceChildren(UI.avatar(c.name || c.number, c.photo));
        who.textContent = c.name || c.number || tr('calls.unknown_number', null, 'Unknown number');
        const bt = h.audio && h.audio.state === 'ready';
        sub.textContent = c.state === 'ringing' ? tr('calls.incoming_call', { number: c.name && c.number ? ` · ${c.number}` : '' }, `Incoming call${c.name && c.number ? ` · ${c.number}` : ''}`)
          : `${c.dir === 'out' ? tr('calls.calling', null, 'Calling') : tr('calls.on_call', null, 'On a call')} · ${UI.duration((Date.now() - c.since) / 1000)}${bt ? (h.audio.here ? ` · ${tr('calls.sound_here', null, 'Sound here')}` : ` · ${tr('calls.sound_phone', null, 'Sound on the phone')}`) : ''}`;
        const ringing = c.state === 'ringing';
        answer.hidden = !ringing;
        decline.hidden = !ringing;
        end.hidden = ringing;
        mute.hidden = ringing;
        mute.textContent = h.muted ? tr('calls.unmute', null, 'Unmute') : tr('calls.mute', null, 'Mute');
        where.hidden = ringing || !bt || h.audio.canMove === false;
        where.textContent = bt && h.audio.here ? tr('calls.sound_phone', null, 'Sound on the phone') : tr('calls.sound_here', null, 'Sound here');
      }
      dialCard.hidden = !ready;
      contactsCard.hidden = !canContacts(s);
      recentCard.hidden = !ready || !(h.perm && !(h.perm.calls.missing || []).includes('numbers'));

      // Sound
      soundCard.hidden = !h.calls || !h.canAudio;
      audioSw.set(!!h.callAudio);
      audioRow.setHint(h.audioLimit || '');
      const a = h.audio;
      const bt = h.perm && h.perm.bt;
      let status = '';
      if (!h.callAudio) status = tr('calls.status_audio_off', { phone: UI.phoneName(s) }, `Off: calls sound on ${UI.phoneName(s)}`);
      else if (!h.connected) status = tr('calls.status_when_connected', { phone: UI.phoneName(s) }, `When ${UI.phoneName(s)} is connected`);
      else if (!a) status = tr('calls.status_starting', null, 'Starting…');
      else status = a.message || '';
      const phone = UI.phoneName(s);
      const needsPair = !!(a && ['needs-pair', 'choose'].includes(a.state));
      if (h.callAudio && h.connected && needsPair && bt) {
        // The phone's side of the pairing (Hub.kt): LE only can't carry a call.
        if (bt.bonding) status = tr('calls.status_bonding', { phone }, `Pairing… Confirm the code on ${phone} and on {me}`);
        else if (bt.le) status = tr('calls.status_le_only', { phone }, `${phone} and {me} are paired over Bluetooth LE only, which can’t carry a call: Forget below, then pair them again in Bluetooth settings`);
        else if (bt.forget) status = tr('calls.status_forget', { phone }, `${phone} keeps its old pairing with {me}: forget {me} in Bluetooth settings on ${phone} (they opened there), then pair them again in Bluetooth settings`);
        else if (bt.radio === false) status = tr('calls.status_radio_off', { phone }, `Bluetooth is off on ${phone}`);
        else if (a.state === 'needs-pair') status = tr('calls.status_needs_pair', { phone }, `Not paired with ${phone} over classic Bluetooth: pair them in Bluetooth settings, as below. DuoDesk connects once they are`);
      }
      statusRow.setHint(status);
      retryBtn.hidden = !(a && ['failed', 'off'].includes(a.state));
      const devices = (a && h.connected && a.devices) || [];
      which.el.hidden = !(a && (a.state === 'choose' || (devices.length > 1 && a.state !== 'ready')));
      if (!which.el.hidden) {
        which.options([{ value: '', label: tr('calls.which_one_is', { phone }, `Which one is ${phone}?`) }, ...devices.map((d) => ({ value: d.id, label: d.name }))]);
        which.set(a.device || '');
      }

      // Setup: the steps until they're paired, Forget always at the bottom.
      setupCard.hidden = soundCard.hidden || !h.callAudio || !h.connected || !a || ['off', 'starting', 'unavailable'].includes(a.state);
      const paired = !needsPair && !!(a && a.device);
      step1.hidden = paired;
      step2.hidden = paired;
      step3.hidden = paired;
      pairedRow.hidden = !paired;
      if (paired) {
        pairedRow.label.textContent = tr('calls.paired_with', { phone }, `Paired with ${phone}`);
        pairedRow.setHint(tr('calls.paired_hint', null, 'Over classic Bluetooth, which carries the calls’ sound'));
      } else {
        step1.label.textContent = tr('calls.step1_label', { phone }, `1. On ${phone}: Settings › Bluetooth › Pair new device`);
        step1.setHint(tr('calls.step1_hint', { phone }, `${phone} can be found while that screen is open`));
        step2.label.textContent = UI.fill(tr('calls.step2_label', null, '2. Pair from {me}'));
        step2.setHint((a && a.pairHow) || UI.fill(tr('calls.step2_hint_default', { phone }, `In {me}’s Bluetooth settings, add a device and pick ${phone}`)));
        settingsBtn.hidden = !h.btSettings;
        step3.setHint(bt && bt.bonding ? UI.fill(tr('calls.step3_hint_bonding', { phone }, `Pairing… Confirm it on ${phone} and on {me}`))
          : h.pairWatch ? tr('calls.step3_hint_watch', { phone }, `Looking for ${phone}… DuoDesk connects as soon as they’re paired`)
            : tr('calls.step3_hint_default', null, 'DuoDesk connects as soon as they’re paired'));
      }
      forgetRow.setHint(UI.fill(tr('calls.forget_hint', { phone }, `${phone} and {me} forget each other, over classic Bluetooth and LE, then pair again from the start`)));
      if (setupCard.hidden) unsure();
    };
  },
});
