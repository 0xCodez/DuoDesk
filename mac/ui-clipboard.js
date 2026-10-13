// MacShare — Copyright (C) 2026 MacShare contributors. GPL-3.0, see LICENSE.
// Clipboard tab: directions, when to sync, privacy and limits, Recent list (docs/KVM.md).
'use strict';

UI.tab({
  id: 'clipboard',
  group: 'Share',
  order: 40,
  title: 'Clipboard',
  desc: 'Copy on one computer, paste on the other.',
  color: 'linear-gradient(#64d2ff, #30b0c7)',
  master: { get: (s) => s.clipboard && s.clipboard.enabled, set: (v) => UI.api.setClipboard({ enabled: v }) },
  badge: (s) => (s.clipboard && s.clipboard.enabled ? 'on' : ''),
  build(body) {
    const { el, api } = UI;
    const set = (partial) => api.setClipboard(partial);

    const peerNote = UI.note('warn', '');
    const skipNote = UI.note('info', '');
    const send = UI.switch((v) => set({ send: v }), { label: 'This Mac to PC' });
    const receive = UI.switch((v) => set({ receive: v }), { label: 'PC to this Mac' });
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

    const list = el('div', { class: 'history' });
    const clearBtn = UI.button('Clear', () => api.clearHistory(), 'small');

    body.append(
      peerNote,
      UI.pair(
        UI.dir('m2w', [UI.row('Send what you copy here', '', [send])]),
        UI.dir('w2m', [UI.row('Paste what you copy on the PC', '', [receive])]),
      ),
      UI.card('Options', [
        modeRow,
        UI.row('Skip passwords', 'From password managers', [concealed]),
        UI.row('Largest item', '', [maxKB]),
        UI.row('Recent items', 'Never saved to disk', [historySize]),
      ]),
      skipNote,
      UI.card('Recent', [list], { actions: [clearBtn] }),
    );

    let lastKey = '';
    return (s) => {
      const c = s.clipboard;
      if (!c) return;
      send.set(c.send);
      receive.set(c.receive);
      mode.set(c.mode);
      modeRow.setHint(c.mode === 'instant' ? 'As soon as you copy' : 'When you move to the other computer');
      concealed.set(c.skipConcealed);
      maxKB.set(c.maxKB);
      historySize.set(c.historySize);
      peerNote.set(s.client && !c.peerAccepts ? `Turned off on ${s.client.name}.` : '');
      skipNote.set(c.enabled && c.lastSkip ? `Last copy not sent: ${c.lastSkip}.` : '');
      clearBtn.disabled = !c.history.length;

      // Rebuild the list only when it changed (or every 15 s for the relative times).
      const key = JSON.stringify(c.history.map((h) => [h.at, h.dir])) + Math.floor(Date.now() / 15000);
      if (key === lastKey) return;
      lastKey = key;
      list.replaceChildren(...(c.history.length
        ? c.history.map((h, i) => el('div', { class: 'hist-item' }, [
          el('span', { class: `hist-dir ${h.dir}`, title: h.dir === 'out' ? 'Sent to the PC' : 'From the PC' }, [UI.icon(h.dir === 'out' ? 'up' : 'down')]),
          el('div', { class: 'hist-text' }, [
            el('div', { class: 'hist-preview selectable', text: h.text.replace(/\s+/g, ' ').trim() || '(whitespace)' }),
            el('div', { class: 'hint', text: `${h.dir === 'out' ? 'To the PC' : 'From the PC'} · ${UI.ago(h.at)} · ${UI.bytes(h.size)}` }),
          ]),
          UI.button('Copy', () => api.copyHistory(i), 'small'),
        ]))
        : [UI.row(c.historySize ? 'Nothing yet' : 'Recent items are off', '')]));
    };
  },
});
