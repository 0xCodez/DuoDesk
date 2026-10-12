// MacShare — Copyright (C) 2026 MacShare contributors. GPL-3.0, see LICENSE.
// Terminal tab: a shell on the Mac (phase 8), from the button or the `macshare` command.
'use strict';

UI.tab({
  id: 'terminal',
  order: 60,
  title: 'Terminal',
  color: 'linear-gradient(#3a3a3c, #1c1c1e)',
  desc: 'A shell on the Mac, one click or one command away — no passwords.',
  master: { get: (s) => s.terminal.enabled, set: (v) => UI.api.setTerminal({ enabled: v }) },
  badge: (s) => (!s.terminal.enabled ? '' : s.terminal.status === 'ready' ? 'on' : s.terminal.status === 'unavailable' || s.terminal.status === 'error' ? 'warn' : ''),
  build(body) {
    const { el, api } = UI;
    const pill = el('span', { class: 'pill' });
    const openBtn = UI.button('Open Terminal', () => api.openTerminal(), 'primary');
    const status = UI.row('Shell on the Mac', '', [pill, openBtn]);
    const pathBtn = UI.button('Add to PATH', () => api.addToPath(), 'small');
    const cmdRow = UI.row('macshare command', '', [pathBtn]);
    body.append(
      UI.card('This PC → Mac', [status, cmdRow]),
      UI.card('How it works', [
        UI.row('Keys, not passwords', 'MacShare makes an SSH key for this PC and hands it to the Mac over the paired, encrypted link; the Mac’s identity comes back the same way. The Mac needs Remote Login on (System Settings → General → Sharing).'),
      ], { cls: 'keep-on' }),
      UI.card('Coming later', [
        UI.row('Mac → this PC', 'Needs Windows’ OpenSSH Server (asks for administrator rights once)', [UI.switch(() => {}, { disabled: true, label: 'Mac to PC' })]),
      ], { cls: 'keep-on' }),
    );
    const TEXT = { off: 'Off', no_mac: 'Waiting for the Mac', waiting: 'Asking the Mac…', ready: 'Ready', unavailable: 'Not available', error: 'Problem' };
    return (s) => {
      const t = s.terminal;
      pill.textContent = TEXT[t.status] || t.status;
      pill.className = 'pill ' + (t.status === 'ready' ? 'good' : t.status === 'unavailable' || t.status === 'error' ? 'bad' : 'muted');
      openBtn.disabled = t.status !== 'ready';
      status.setHint(t.message || (t.status === 'ready' ? 'Signed in as ' + t.user + ' on the Mac.' : t.status === 'off' ? 'Turn it on to send this PC’s key to the Mac.' : ''));
      cmdRow.setHint(t.onPath ? 'Type “macshare” in any new terminal to open a shell on the Mac.' : 'Add MacShare’s folder to your PATH so “macshare” works in new terminals.');
      pathBtn.hidden = t.onPath;
    };
  },
});
