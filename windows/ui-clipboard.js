// MacShare — Copyright (C) 2026 MacShare contributors. GPL-3.0, see LICENSE.
// Clipboard tab: accept (Mac → PC) and send (PC → Mac) as two direction cards (docs/UI.md), then
// timing, privacy and the Recent list for both (docs/KVM.md "Clipboard").
'use strict';

UI.tab({
  id: 'clipboard',
  order: 40,
  title: 'Clipboard',
  color: 'linear-gradient(#64d2ff, #30b0c7)',
  desc: 'Copy on one computer, paste on the other. Text only for now; images and files come later.',
  master: { get: (s) => s.clipboard.enabled, set: (v) => UI.api.setClipboard({ enabled: v }) },
  badge: (s) => (!s.clipboard.enabled ? '' : s.link.state === 'connected' && !s.clipboard.peerAccepts ? 'warn' : 'on'),
  build(body) {
    const { el, api } = UI;
    const set = (partial) => api.setClipboard(partial);

    const peerRow = UI.row('', '');
    const skipNote = UI.note('info', '');
    const mode = UI.segmented([
      { value: 'switch', label: 'When you switch' },
      { value: 'instant', label: 'Instantly' },
    ], (v) => set({ mode: v }));
    const modeRow = UI.row('Sync', '', [mode]);
    const concealed = UI.switch((v) => set({ skipConcealed: v }), { label: 'Skip passwords' });
    const maxKB = UI.select([
      { value: 16, label: '16 KB' }, { value: 64, label: '64 KB' }, { value: 256, label: '256 KB' },
    ], (v) => set({ maxKB: Number(v) }));
    const historySize = UI.select([
      { value: 0, label: 'Off' }, { value: 10, label: '10 items' }, { value: 20, label: '20 items' },
      { value: 50, label: '50 items' }, { value: 100, label: '100 items' },
    ], (v) => set({ historySize: Number(v) }));
    const pair = UI.dirCards(
      { on: { get: (s) => s.clipboard.receive, set: (v) => set({ receive: v }) }, rows: [
        UI.row('Accept the Mac’s clipboard', 'Text copied on the Mac can be pasted here'),
      ] },
      { on: { get: (s) => s.clipboard.send, set: (v) => set({ send: v }) }, rows: [
        UI.row('Send this PC’s clipboard', 'Text you copy here can be pasted on the Mac'),
        peerRow,
      ] },
    );

    const list = el('div', { class: 'history' });
    const clearBtn = UI.button('Clear', () => api.clearHistory(), 'small');

    body.append(
      pair.el,
      UI.card('Timing', [modeRow]),
      UI.card('Privacy and limits', [
        UI.row('Skip passwords', 'Never send items that password managers mark as private (1Password, Bitwarden, KeePass…)', [concealed]),
        UI.row('Largest item', 'Bigger copies stay on this computer', [maxKB]),
        UI.row('Remember recent items', 'Kept in memory only, never saved to disk', [historySize]),
      ]),
      skipNote,
      UI.card('Recent', [list], { actions: [clearBtn] }),
    );

    let lastKey = '';
    return (s) => {
      const c = s.clipboard;
      pair.update(s);
      mode.set(c.mode);
      modeRow.setHint(c.mode === 'instant'
        ? 'Everything you copy here goes to the Mac right away (while connected).'
        : 'Sent when you move into or out of Monitor 2, or cross the screen edge. Nothing leaves while you stay put.');
      concealed.set(c.skipConcealed);
      maxKB.set(c.maxKB);
      historySize.set(c.historySize);
      const refused = s.link.state === 'connected' && !c.peerAccepts;
      peerRow.hidden = !refused;
      peerRow.label.textContent = 'The Mac doesn’t accept it';
      peerRow.setHint('Turned off in the Mac app (its Clipboard tab).');
      skipNote.set(c.enabled && c.lastSkip ? 'Last item not sent: ' + c.lastSkip + '.' : '');
      clearBtn.disabled = !c.history.length;

      const key = JSON.stringify(c.history.map((h) => [h.at, h.dir])) + c.historySize + Math.floor(Date.now() / 15000);
      if (key === lastKey) return;
      lastKey = key;
      list.replaceChildren(...(c.history.length
        ? c.history.map((h, i) => el('div', { class: 'hist-item' }, [
          el('span', { class: 'hist-dir ' + h.dir, title: h.dir === 'out' ? 'Sent to the Mac' : 'From the Mac' }, [UI.icon(h.dir === 'out' ? 'up' : 'down')]),
          el('div', { class: 'hist-text' }, [
            el('div', { class: 'hist-preview selectable', text: h.text.replace(/\s+/g, ' ').trim() || '(whitespace)' }),
            el('div', { class: 'hint', text: (h.dir === 'out' ? 'To the Mac' : 'From the Mac') + ' · ' + UI.ago(h.at) + ' · ' + UI.bytes(h.size) }),
          ]),
          UI.button('Copy', () => api.copyHistory(i), 'small'),
        ]))
        : [UI.row(c.historySize ? 'Nothing yet' : 'History is off', c.historySize ? 'Copied text that goes between the computers shows up here.' : 'Turn on “Remember recent items” to see what was shared.')]));
    };
  },
});
