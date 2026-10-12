// MacShare — Copyright (C) 2026 MacShare contributors. GPL-3.0, see LICENSE.
// Terminal tab (phase 8): let the PC open a shell on this Mac with its own key (no passwords).
'use strict';

UI.tab({
  id: 'terminal',
  order: 60,
  title: 'Terminal',
  desc: 'A shell on this Mac from the PC: type “macshare” in a PC terminal. No passwords — keys travel over the paired link.',
  color: 'linear-gradient(#3a3a3c, #1c1c1e)',
  master: { get: (s) => s.terminal && s.terminal.allowPc, set: (v) => UI.api.setTerminal({ allowPc: v }) },
  badge: (s) => (s.terminal && s.terminal.allowPc ? 'on' : ''),
  build(body) {
    const { el, api } = UI;
    const status = UI.note('info', '');
    const rl = UI.row('Remote Login', '', [UI.button('Open Sharing Settings', () => api.openSharingSettings(), 'small')]);
    const keys = UI.row('Keys from the PC', '');
    const how = UI.row('On the PC', '', [el('code', { class: 'mono', text: 'macshare' })]);
    const outSw = UI.switch((v) => api.setTerminal({ connectPc: v }), { label: 'Open shells on the PC from here' });
    const shellBtn = UI.button('Open a Shell on the PC', () => api.openPcShell(), 'small');
    const outRow = UI.row('Open shells on the PC from here', '', [shellBtn, outSw]);
    const cmdRow = UI.row('In Terminal', 'Works once the PC accepted this Mac’s key', [el('code', { class: 'mono', text: 'ssh macshare-pc' })]);
    body.append(
      status,
      UI.card('PC → this Mac', [rl, keys, how]),
      UI.card('This Mac → PC', [outRow, cmdRow], { cls: 'keep-on' }),
      UI.card('Security', [
        UI.row('Only the paired PC’s key is accepted', 'It is added to ~/.ssh/authorized_keys with a “macshare” label, without agent or X11 forwarding, and removed when you turn this off or forget the PC. The PC pins this Mac’s host key, so it never asks “trust this host?”.'),
      ], { cls: 'keep-on' }),
    );
    return (s) => {
      const t = s.terminal;
      if (!t) return;
      rl.setHint(t.remoteLogin ? `On — you’ll log in as “${t.user}”` : t.remoteLogin === false ? 'Off — turn on General › Sharing › Remote Login' : 'Checking…');
      keys.setHint(t.installed ? `${t.installed} key${t.installed > 1 ? 's' : ''} installed` : 'None yet — turn on Terminal in the PC app');
      how.setHint('Type it in Command Prompt, PowerShell or Windows Terminal on the PC');
      const o = t.toPc || {};
      outSw.set(t.connectPc);
      shellBtn.hidden = !o.ready;
      const WHY = { waiting: 'Sent this Mac’s key — waiting for the PC…', not_allowed: 'The PC doesn’t allow it — turn it on in the PC app’s Terminal tab',
        remote_login_off: 'The PC’s OpenSSH Server is off — turn it on in the PC app' };
      outRow.setHint(!t.connectPc ? 'Off — uses the PC’s OpenSSH Server; this Mac’s key is sent over the paired link'
        : o.ready ? `Ready — you’ll log in to the PC as “${o.user}”` : WHY[o.why] || (o.why ? `Not ready: ${o.why}` : 'Waiting for your PC to connect'));
      let kind = 'info';
      let text;
      if (!t.allowPc) text = 'Off — the PC can’t open a shell here.';
      else if (t.remoteLogin === false) { kind = 'warn'; text = 'Turn on Remote Login (System Settings › General › Sharing) so the PC can connect.'; }
      else if (!s.client) text = 'Ready — waiting for your PC to connect.';
      else text = t.installed ? `Ready — on ${s.client.name}, type “macshare”.` : `Ready — turn on Terminal in ${s.client.name}’s MacShare app.`;
      status.className = `note ${kind}`;
      status.set(text);
    };
  },
});
