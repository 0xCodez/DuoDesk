// TwinDesk — Copyright (C) 2026 inukaasith. GPL-3.0, see LICENSE.
// Clipboard tab: accept (Mac → PC) and send (PC → Mac) as two direction cards, then
// timing, privacy and the Recent list for both.
'use strict';

UI.tab({
  id: 'clipboard',
  order: 40,
  title: 'Clipboard',
  color: 'linear-gradient(#64d2ff, #30b0c7)',
  desc: 'Copy on one computer, paste on the other.',
  master: { get: (s) => s.clipboard.enabled, set: (v) => UI.api.setClipboard({ enabled: v }) },
  badge: (s) => (!s.clipboard.enabled ? '' : s.link.state === 'connected' && !s.clipboard.peerAccepts ? 'warn' : 'on'),
  build(body) {
    const { el, api } = UI;
    const t = (k, p, d) => (typeof window.t === 'function' ? window.t(k, p, d) : d !== undefined ? d : k);
    const set = (partial) => api.setClipboard(partial);

    const peerRow = UI.row('', '');
    const skipNote = UI.note('info', '');
    const mode = UI.segmented([
      { value: 'instant', label: t('clipboard.instantly', null, 'Instantly') }, // the default
      { value: 'switch', label: t('clipboard.when_switch', null, 'When you switch') },
    ], (v) => set({ mode: v }));
    const modeRow = UI.row(t('clipboard.sync', null, 'Sync'), '', [mode]);
    const concealed = UI.switch((v) => set({ skipConcealed: v }), { label: t('clipboard.skip_passwords', null, 'Skip passwords') });
    const maxKB = UI.select([
      { value: 16, label: '16 KB' }, { value: 64, label: '64 KB' }, { value: 256, label: '256 KB' },
    ], (v) => set({ maxKB: Number(v) }));
    // Pictures (clipimage.js): screenshots put on the clipboard among them. Not in Multi-device yet.
    const pictures = UI.switch((v) => set({ images: v }), { label: t('clipboard.pictures', null, 'Pictures') });
    const picturesRow = UI.row(t('clipboard.pictures', null, 'Pictures'), '', [pictures]);
    // Text only: pictures have their own limit (10 MB).
    const maxKBRow = UI.row(t('clipboard.largest_text', null, 'Largest text'), '', [maxKB]);
    const historySize = UI.select([
      { value: 0, label: t('clipboard.off', null, 'Off') }, { value: 10, label: t('clipboard.items_10', null, '10 items') }, { value: 20, label: t('clipboard.items_20', null, '20 items') },
      { value: 50, label: t('clipboard.items_50', null, '50 items') }, { value: 100, label: t('clipboard.items_100', null, '100 items') },
    ], (v) => set({ historySize: Number(v) }));
    const pair = UI.dirCards(
      { on: { get: (s) => s.clipboard.receive, set: (v) => set({ receive: v }) }, label: t('clipboard.copy_there_paste_me', null, 'Copy on {name}, paste on {me}'), rows: [] },
      { on: { get: (s) => s.clipboard.send, set: (v) => set({ send: v }) }, label: t('clipboard.copy_me_paste_there', null, 'Copy on {me}, paste on {name}'), rows: [peerRow] },
    );

    const list = el('div', { class: 'history' });
    const clearBtn = UI.button(t('clipboard.clear', null, 'Clear'), () => api.clearHistory(), 'small');

    body.append(
      pair.el,
      UI.card('', [modeRow, picturesRow]),
      UI.card(t('clipboard.privacy', null, 'Privacy'), [
        UI.row(t('clipboard.skip_passwords', null, 'Skip passwords'), t('clipboard.from_pw_managers', null, 'From password managers'), [concealed]),
        maxKBRow,
        UI.row(t('clipboard.recent_items', null, 'Recent items'), t('clipboard.never_saved_disk', null, 'Never saved to disk'), [historySize]),
      ]),
      skipNote,
      UI.card(t('clipboard.recent', null, 'Recent'), [list], { actions: [clearBtn] }),
    );

    let lastKey = '';
    return (s) => {
      const c = s.clipboard;
      pair.update(s);
      mode.set(c.mode);
      modeRow.setHint(c.mode === 'instant' ? t('clipboard.as_soon_as_copy', null, 'As soon as you copy') : t('clipboard.when_move_to_other', null, 'When you move to the other computer'));
      picturesRow.hidden = !c.imageSupport;
      pictures.set(!!c.images);
      picturesRow.setHint(!c.images ? t('clipboard.pics_both_ways', null, 'Pictures and screenshots you copy, up to 10 MB, both ways')
        : s.link.state === 'connected' && !c.peerImages ? t('clipboard.pics_turn_on_peer', { name: UI.peer(s).name }, 'Turn on Pictures on ' + UI.peer(s).name + ' too (an older version there can’t: update DuoDesk)')
          : t('clipboard.pics_no_ble', null, 'Pictures and screenshots you copy, up to 10 MB, both ways. Not over Bluetooth'));
      concealed.set(c.skipConcealed);
      maxKB.set(c.maxKB);
      maxKBRow.setHint(c.imageSupport ? t('clipboard.longer_text_pics', null, 'Longer text isn’t sent. Pictures: up to 10 MB') : t('clipboard.longer_text', null, 'Longer text isn’t sent'));
      historySize.set(c.historySize);
      const refused = s.link.state === 'connected' && !c.peerAccepts;
      peerRow.hidden = !refused;
      peerRow.label.textContent = t('clipboard.turned_off_on', { name: UI.peer(s).name }, 'Turned off on ' + UI.peer(s).name);
      peerRow.setHint('');
      skipNote.set(c.enabled && c.lastSkip ? t('clipboard.last_skip', { last: c.lastSkip }, 'Last item not sent: ' + c.lastSkip + '.') : '');
      clearBtn.disabled = !c.history.length;

      const key = JSON.stringify(c.history.map((h) => [h.at, h.dir, !!(h.image && h.image.copy)])) + c.historySize + Math.floor(Date.now() / 15000);
      if (key === lastKey) return;
      lastKey = key;
      list.replaceChildren(...(c.history.length
        ? c.history.map((h, i) => el('div', { class: 'hist-item' }, [
          el('span', { class: 'hist-dir ' + h.dir, title: h.dir === 'out' ? t('clipboard.sent_to', null, 'Sent to {name}') : t('clipboard.from_peer', null, 'From {name}') }, [UI.icon(h.dir === 'out' ? 'up' : 'down')]),
          h.image && h.image.thumb ? el('img', { class: 'hist-thumb', src: h.image.thumb, alt: '' }) : null,
          el('div', { class: 'hist-text' }, [
            h.image
              ? el('div', { class: 'hist-preview', text: (h.image.shot ? t('clipboard.screenshot', null, 'Screenshot') : t('clipboard.picture', null, 'Picture')) + ' · ' + h.image.w + ' × ' + h.image.h })
              : el('div', { class: 'hist-preview selectable', text: h.text.replace(/\s+/g, ' ').trim() || t('clipboard.whitespace', null, '(whitespace)') }),
            el('div', { class: 'hint', text: (h.dir === 'out' ? t('clipboard.to_peer', null, 'To {name}') : t('clipboard.from_peer', null, 'From {name}')) + ' · ' + UI.ago(h.at) + ' · ' + UI.bytes(h.size) }),
          ]),
          !h.image || h.image.copy ? UI.button(t('clipboard.copy_btn', null, 'Copy'), () => api.copyHistory(i), 'small') : null,
        ]))
        : [UI.row(c.historySize ? t('clipboard.nothing_yet', null, 'Nothing yet') : t('clipboard.recent_off', null, 'Recent items are off'), '')]));
    };
  },
});
