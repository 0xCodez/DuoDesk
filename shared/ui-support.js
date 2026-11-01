// DuoDesk — Tip and Feedback pages. Based on TwinDesk — Copyright (C) 2026 inukaasith. GPL-3.0, see LICENSE.
// Two pages in the sidebar's bottom group, after General and About (def.order 112 / 114, bottom: true;
// no shell's ORDER map names them, so the defs' own order places them), the same on all six main pages
// (windows/linux app.html, mac/control.html and their mesh/ variants; loaded after ui-about.js):
//   Tip       the Beyond Apps tip jar (beyond-media.ai): who it's for, preset or own amount, one time or
//             monthly, an optional name and note for the supporters list, the supporters. "Leave a tip"
//             asks the main process to make a Stripe Checkout page and open it in the browser.
//   Feedback  Bug / Idea / Love it, a message, an optional reply address, and a box for the version and
//             system info that shows exactly what goes out; Send opens the mail app (contact@beyond-media.ai),
//             or Report on GitHub opens a pre-filled issue, or Copy puts it on the clipboard.
// The page never talks to the network or opens a link itself: everything goes through the main process
// (shared/support.js) as UI.api.supportInfo / supportProfile / supportTip / supportFeedback / supportPreview.
// Their personality headers are shared/pagefx/support.js, fed by the 'duodesk-support' window event.
// CSP: no innerHTML, no style attributes (classes and the CSSOM only).
'use strict';
var tr = (k, p, d) => (typeof t === 'function' ? t(k, p, d) : (d || k));

(() => {
  const { el } = UI;
  const api = () => UI.api || window.macshare || {};
  const call = (name, arg) => {
    const f = api()[name];
    if (typeof f !== 'function') return Promise.resolve({ ok: false, error: tr('support.not_available', null, 'Not available in this build of DuoDesk') });
    return Promise.resolve().then(() => f(arg)).catch(() => ({ ok: false, error: tr('support.went_wrong', null, 'Something went wrong') }));
  };
  // The headers (pagefx/support.js) read the last snapshot and listen for changes.
  UI.support = { tip: {}, feedback: {} };
  const emit = (id, patch) => {
    Object.assign(UI.support[id], patch);
    window.dispatchEvent(new CustomEvent('duodesk-support', { detail: Object.assign({ page: id }, UI.support[id]) }));
  };
  const setStatus = (e, text, kind) => {
    e.textContent = text || '';
    e.hidden = !text;
    e.className = 'sp-status' + (kind ? ' ' + kind : '');
  };
  const money = (v, cur) => {
    if (v == null) return '';
    try {
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: String(cur || 'usd').toUpperCase(), maximumFractionDigits: v % 1 ? 2 : 0, minimumFractionDigits: v % 1 ? 2 : 0 }).format(v);
    } catch { return '$' + v; }
  };
  // createdAt: ms (a number) or an ISO date; anything else shows no time (not "Invalid Date")
  const when = (at) => { const t = typeof at === 'number' ? at : Date.parse(at); return Number.isFinite(t) && t > 0 ? t : 0; };
  const field = (label, control, extra) => el('label', { class: 'sp-field' }, [el('span', { class: 'sp-field-label', text: label }), control, extra || null]);

  // ===================================================================================================
  // Tip
  // ===================================================================================================
  UI.tab({
    id: 'tip',
    order: 112,
    title: tr('tip.tab_title', null, 'Tip'),
    heading: tr('tip.heading', null, 'Leave a tip'),
    desc: tr('tip.desc', null, 'DuoDesk is free and open source. A tip keeps it that way.'),
    icon: 'tip',
    color: 'linear-gradient(#ff9ec0, #c77dff)',
    bottom: true,
    build(body) {
      let prof = null;
      let amount = 10;
      let monthly = false;
      let loading = false;
      let loaded = false;
      let busy = false;

      // Who the tip goes to
      const avatar = el('div', { class: 'sp-avatar', attrs: { 'aria-hidden': 'true' } });
      const who = el('div', { class: 'sp-who-name' });
      const tagline = el('div', { class: 'sp-who-tag' });
      const bio = el('p', { class: 'sp-who-bio' });
      const profile = el('div', { class: 'card sp-profile keep-on' }, [avatar, el('div', { class: 'sp-who' }, [who, tagline, bio])]);

      // How much
      const presets = el('div', { class: 'sp-amounts', attrs: { role: 'radiogroup', 'aria-label': tr('tip.amount_aria', null, 'Amount') } });
      const custom = el('input', { type: 'number', class: 'sp-custom', min: '1', step: '1', placeholder: tr('tip.other_placeholder', null, 'Other'), attrs: { 'aria-label': tr('tip.other_aria', null, 'Another amount'), inputmode: 'decimal' } });
      const freq = UI.segmented([{ value: false, label: tr('tip.one_time', null, 'One time') }, { value: true, label: tr('tip.monthly', null, 'Monthly') }], (v) => { monthly = v; freq.set(v); sync(); });
      freq.el.classList.add('sp-freq');
      freq.set(false);
      const nameIn = el('input', { type: 'text', class: 'sp-input', maxLength: 60, placeholder: tr('tip.anon_placeholder', null, 'Anonymous'), attrs: { autocomplete: 'off' } });
      const noteIn = el('textarea', { class: 'sp-input sp-note', maxLength: 280, rows: 2, placeholder: tr('tip.say_something', null, 'Say something nice (optional)') });
      const noteCount = el('span', { class: 'sp-count', text: '0 / 280' });
      const cta = UI.button(tr('tip.cta_button', null, 'Leave a tip'), () => go(), 'primary sp-cta');
      const status = el('div', { class: 'sp-status', hidden: true, attrs: { role: 'status', 'aria-live': 'polite' } });
      const fine = el('div', { class: 'sp-fine', text: tr('tip.fine_print', null, 'Opens Stripe Checkout in your browser. Nothing is charged until you pay there.') });
      const formWrap = UI.card(tr('tip.your_tip', null, 'Your tip'), [
        el('div', { class: 'sp-amount-row' }, [presets, custom]),
        el('div', { class: 'sp-freq-row' }, [freq.el, el('span', { class: 'sp-freq-hint', text: tr('tip.monthly_hint', null, 'Monthly can be cancelled any time from the receipt Stripe sends.') })]),
        el('div', { class: 'sp-fields' }, [
          field(tr('tip.name_field', null, 'Name on the supporters list'), nameIn),
          field(tr('tip.msg_field', null, 'Message'), noteIn, noteCount),
        ]),
        el('div', { class: 'sp-actions' }, [cta, status]),
        fine,
      ], { cls: 'sp-form keep-on' });

      // Who else did
      const supCount = el('span', { class: 'sp-sup-count' });
      const supList = el('ul', { class: 'sp-sup-list' });
      const supEmpty = el('div', { class: 'sp-sup-empty', text: tr('tip.no_tips_yet', null, 'No tips yet. Yours could be the first.') });
      const supWrap = UI.card(tr('tip.supporters', null, 'Supporters'), [supEmpty, supList], { actions: [supCount], cls: 'sp-sup keep-on' });

      // Offline / error
      const errText = el('span', { class: 'sp-err-text' });
      const retry = UI.button(tr('hub.try_again', null, 'Try again'), () => load(true), 'small');
      const err = el('div', { class: 'note warn sp-err', hidden: true }, [errText, retry]);
      const skeleton = el('div', { class: 'card sp-skeleton keep-on', attrs: { 'aria-hidden': 'true' } }, [el('i'), el('i'), el('i')]);

      body.classList.add('sp-page', 'sp-tip');
      body.append(err, skeleton, profile, formWrap, supWrap);
      profile.hidden = formWrap.hidden = supWrap.hidden = true;

      const min = () => (prof ? prof.min : 1);
      const max = () => (prof ? prof.max : 1000);
      const valid = (v) => typeof v === 'number' && isFinite(v) && v >= min() && v <= max();
      function sync() {
        const cur = prof ? prof.currency : 'usd';
        for (const b of presets.children) {
          const on = !custom.value && Number(b.dataset.v) === amount;
          b.classList.toggle('on', on);
          b.setAttribute('aria-checked', String(on));
        }
        custom.classList.toggle('on', !!custom.value);
        const ok = valid(amount);
        cta.textContent = ok ? tr('tip.cta_amount', { amount: money(amount, cur), suffix: monthly ? tr('tip.per_month', null, ' / month') : '' }, `Leave a tip · ${money(amount, cur)}${monthly ? ' / month' : ''}`) : tr('tip.enter_range', { min: money(min(), cur), max: money(max(), cur) }, `Enter ${money(min(), cur)} – ${money(max(), cur)}`);
        cta.disabled = busy || !ok || !prof;
        noteCount.textContent = `${noteIn.value.length} / 280`;
        emit('tip', { amount: ok ? amount : null, monthly, currency: cur, label: ok ? money(amount, cur) : '' });
      }
      custom.oninput = () => {
        const v = Number(custom.value);
        if (custom.value !== '' && isFinite(v)) amount = Math.round(v * 100) / 100;
        else if (custom.value === '') amount = (prof && prof.presets[1]) || (prof && prof.presets[0]) || 10;
        sync();
      };
      custom.onkeydown = (e) => { if (e.key === 'Enter') go(); };
      noteIn.oninput = sync;

      function fill(r) {
        prof = r.profile;
        // the avatar: a data: URL fetched by the main process (img-src allows data:), else the initial
        avatar.replaceChildren(prof.avatar ? el('img', { src: prof.avatar, alt: '' }) : el('span', { text: (prof.name || '?').charAt(0) }));
        who.textContent = prof.name;
        tagline.textContent = prof.tagline;
        tagline.hidden = !prof.tagline;
        bio.textContent = prof.bio;
        bio.hidden = !prof.bio;
        presets.replaceChildren(...prof.presets.map((v) => {
          const b = el('button', { class: 'sp-amt', text: money(v, prof.currency), attrs: { role: 'radio', 'data-v': String(v) } });
          b.onclick = () => { custom.value = ''; amount = v; sync(); };
          return b;
        }));
        custom.min = String(prof.min);
        custom.max = String(prof.max);
        if (!loaded) amount = prof.presets[1] || prof.presets[0] || prof.min; // the second preset, like the tips page
        // supporters
        supCount.textContent = r.count ? tr('tip.sup_count', { count: r.count, label: r.count === 1 ? tr('tip.supporter', null, 'supporter') : tr('tip.supporters_label', null, 'supporters'), monthly: r.monthly ? tr('tip.monthly_count', { count: r.monthly }, ` · ${r.monthly} monthly`) : '' }, `${r.count} ${r.count === 1 ? 'supporter' : 'supporters'}${r.monthly ? ` · ${r.monthly} monthly` : ''}`) : '';
        supEmpty.hidden = !!r.supporters.length;
        supList.replaceChildren(...r.supporters.map((s) => el('li', { class: 'sp-sup-item' }, [
          el('span', { class: 'sp-sup-av', text: (s.name || '?').trim().charAt(0).toUpperCase() || '·', attrs: { 'aria-hidden': 'true' } }),
          el('div', { class: 'sp-sup-text' }, [
            el('div', { class: 'sp-sup-line' }, [
              el('b', { text: s.name }),
              s.amount != null ? el('span', { class: 'sp-sup-amt', text: money(s.amount, s.currency) + (s.monthly ? ' / month' : '') }) : null,
              when(s.at) ? el('span', { class: 'sp-sup-when', text: UI.ago(when(s.at)) }) : null,
            ]),
            s.message ? el('div', { class: 'sp-sup-msg', text: s.message }) : null,
          ]),
        ])));
        profile.hidden = formWrap.hidden = supWrap.hidden = false;
        skeleton.hidden = true;
        loaded = true;
        emit('tip', { name: prof.name, count: r.count, monthlyCount: r.monthly, state: 'ready' });
        sync();
      }
      function load(force) {
        if (loading) return;
        loading = true;
        retry.disabled = true;
        if (!loaded) skeleton.hidden = false;
        emit('tip', { state: loaded ? 'ready' : 'loading' });
        call('supportProfile', { force: !!force }).then((r) => {
          loading = false;
          retry.disabled = false;
          if (r && r.profile) fill(r);
          const bad = !r || !r.ok;
          err.hidden = !bad;
          if (bad) {
            errText.textContent = (r && r.error) || tr('tip.err_default', null, 'The tip jar didn’t answer.');
            skeleton.hidden = true;
            emit('tip', { state: r && r.profile ? 'ready' : 'offline' });
          }
        });
      }
      function go() {
        if (busy || !prof || !valid(amount)) return;
        busy = true;
        sync();
        setStatus(status, tr('tip.opening_stripe', null, 'Opening Stripe…'), 'busy');
        call('supportTip', { amount, monthly, name: nameIn.value, message: noteIn.value }).then((r) => {
          busy = false;
          if (r && r.ok) {
            setStatus(status, tr('tip.opened_stripe', { opened: r.opened || 'Stripe' }, `Opened ${r.opened || 'Stripe'} in your browser. Thank you!`), 'good');
            emit('tip', { state: 'opened', at: Date.now() });
            setTimeout(() => load(true), 60000); // a paid tip shows up in the list a little later
          } else {
            setStatus(status, (r && r.error) || tr('tip.couldnt_start', null, 'Couldn’t start the tip'), 'bad');
          }
          sync();
        });
      }

      return () => { if (!loaded && !loading) load(false); };
    },
  });

  // ===================================================================================================
  // Feedback
  // ===================================================================================================
  const KINDS = [
    { value: 'bug', label: tr('feedback.bug', null, 'Bug'), hint: tr('feedback.bug_hint', null, 'What happened, and what did you expect? Steps to make it happen again help a lot.') },
    { value: 'idea', label: tr('feedback.idea', null, 'Idea'), hint: tr('feedback.idea_hint', null, 'What would make DuoDesk better for you?') },
    { value: 'love', label: tr('feedback.love', null, 'Love it'), hint: tr('feedback.love_hint', null, 'What do you like? (You can leave it empty.)') },
  ];
  UI.tab({
    id: 'feedback',
    order: 114,
    title: tr('feedback.tab_title', null, 'Feedback'),
    heading: tr('feedback.heading', null, 'Send feedback'),
    desc: tr('feedback.desc', null, 'A bug, an idea, or just a hello. It goes straight to the people who make DuoDesk.'),
    icon: 'feedback',
    color: 'linear-gradient(#8fd3ff, #6f8cff)',
    bottom: true,
    build(body) {
      let kind = 'bug';
      let info = null;
      let busy = false;
      let previewT = 0;

      const kindSeg = UI.segmented(KINDS.map(({ value, label }) => ({ value, label })), (v) => { kind = v; kindSeg.set(v); sync(); preview(); });
      kindSeg.el.classList.add('sp-kind');
      kindSeg.el.setAttribute('aria-label', tr('feedback.what_it_is', null, 'What it is'));
      const msg = el('textarea', { class: 'sp-input sp-msg', maxLength: 5000, rows: 7, attrs: { 'aria-label': tr('feedback.your_msg_aria', null, 'Your message') } });
      const msgCount = el('span', { class: 'sp-count', text: '0 / 5000' });
      const email = el('input', { type: 'email', class: 'sp-input sp-email', maxLength: 200, placeholder: 'you@example.com', attrs: { autocomplete: 'email', 'aria-label': tr('feedback.email_aria', null, 'Reply email (optional)') } });
      const infoSw = UI.switch((v) => { sync(); preview(); }, { label: tr('feedback.info_sw_label', null, 'Include version and system info') });
      infoSw.set(true);
      const shown = el('pre', { class: 'sp-preview selectable', attrs: { 'aria-label': tr('feedback.preview_aria', null, 'What will be sent') } });
      const send = UI.button(tr('feedback.send_email', null, 'Send email'), () => submit('mail'), 'primary');
      const gh = UI.button(tr('feedback.report_gh', null, 'Report on GitHub'), () => submit('github'));
      const copy = UI.button(tr('general.copy', null, 'Copy'), () => submit('copy'), 'small');
      const status = el('div', { class: 'sp-status', hidden: true, attrs: { role: 'status', 'aria-live': 'polite' } });

      const writeCard = UI.card(tr('feedback.your_msg_card', null, 'Your message'), [
        el('div', { class: 'sp-kind-row' }, [kindSeg.el]),
        field(tr('tip.msg_field', null, 'Message'), msg, msgCount),
        field(tr('feedback.reply_email_field', null, 'Reply email (optional)'), email, el('span', { class: 'sp-field-hint', text: tr('feedback.answer_hint', null, 'Only if you’d like an answer.') })),
      ], { cls: 'sp-form keep-on' });
      const infoRow = UI.row(tr('feedback.info_row_title', null, 'Include version and system info'), tr('feedback.info_row_desc', null, 'Helps us reproduce a bug. This is everything it adds:'), [infoSw]);
      const sendCard = UI.card(tr('feedback.send_it_card', null, 'Send it'), [
        infoRow,
        el('div', { class: 'sp-preview-wrap' }, [shown]),
        el('div', { class: 'sp-actions' }, [send, gh, copy, status]),
        el('div', { class: 'sp-fine', text: tr('feedback.fine_print', null, 'Send opens your mail app with everything filled in; nothing leaves until you press Send there. GitHub opens a new public issue in your browser.') }),
      ], { cls: 'sp-send keep-on' });
      body.classList.add('sp-page', 'sp-feedback');
      body.append(writeCard, sendCard);

      function sync() {
        const k = KINDS.find((x) => x.value === kind) || KINDS[0];
        msg.placeholder = k.hint;
        msgCount.textContent = `${msg.value.length} / 5000`;
        const empty = !msg.value.trim() && kind !== 'love';
        send.disabled = gh.disabled = copy.disabled = busy || empty;
        emit('feedback', { kind, label: k.label, length: msg.value.length, info: !!infoSw.el.checked });
      }
      function preview() {
        clearTimeout(previewT);
        previewT = setTimeout(() => {
          call('supportPreview', { kind, message: '', email: email.value, includeInfo: infoSw.el.checked }).then((r) => {
            if (!r || !r.ok) { shown.textContent = ''; return; }
            const tail = String(r.body || '').split('\n—\n')[1];
            shown.textContent = [`To: ${r.to}`, `Subject: ${r.subject}`, '', tail ? tail : email.value.trim() ? tr('sh_ui_support.nothing_about_computer_reply', null, 'Nothing about this computer: only your message and your reply address.') : tr('sh_ui_support.nothing_about_computer', null, 'Nothing about this computer: only your message.')].join('\n');
          });
        }, 120);
      }
      msg.oninput = sync;
      email.oninput = () => { setStatus(status, ''); preview(); };
      function submit(via) {
        if (busy) return;
        busy = true;
        sync();
        setStatus(status, via === 'github' ? tr('feedback.opening_gh', null, 'Opening GitHub…') : via === 'copy' ? '' : tr('feedback.opening_mail', null, 'Opening your mail app…'), 'busy');
        call('supportFeedback', { kind, message: msg.value, email: email.value, includeInfo: infoSw.el.checked, via }).then((r) => {
          busy = false;
          if (r && r.ok) {
            const text = via === 'copy' ? tr('feedback.copied', null, 'Copied. Paste it into an email to contact@beyond-media.ai.')
              : via === 'github' ? tr('feedback.opened_gh', null, 'Opened a new issue on GitHub in your browser.')
                : r.truncated ? tr('feedback.opened_mail_trunc', null, 'Opened your mail app. The message was long, so it was shortened there; the whole text is on your clipboard.')
                  : tr('feedback.opened_mail', null, 'Opened your mail app. Press Send there. Thank you!');
            setStatus(status, text, 'good');
            emit('feedback', { state: via === 'copy' ? 'copied' : 'sent', at: Date.now() });
          } else {
            setStatus(status, (r && r.error) || tr('feedback.couldnt_open', null, 'Couldn’t open it'), 'bad');
          }
          sync();
        });
      }
      kindSeg.set(kind);
      sync();

      return () => {
        if (info) return;
        info = {};
        call('supportInfo').then((r) => { info = r || {}; preview(); });
      };
    },
  });
})();
