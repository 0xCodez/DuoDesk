// MacShare — Copyright (C) 2026 MacShare contributors. GPL-3.0, see LICENSE.
// Terminal tab: shells both ways as two direction cards (docs/UI.md). Mac → PC: the Mac opens a
// shell here (Windows' OpenSSH Server, sshd.js). PC → Mac: a shell on the Mac (terminal.js).
'use strict';

UI.tab({
  id: 'terminal',
  order: 60,
  title: 'Terminal',
  color: 'linear-gradient(#3a3a3c, #1c1c1e)',
  desc: 'A shell on the other computer, one click or one command away — no passwords.',
  badge: (s) => (s.terminal.status === 'unavailable' || s.terminal.status === 'error' ? 'warn' : s.terminal.status === 'ready' || (s.terminal.server.info && s.terminal.server.info.enabled) ? 'on' : ''),
  build(body) {
    const { el, api } = UI;
    // Mac → PC (server here)
    const srvPill = el('span', { class: 'pill' });
    const setupBtn = UI.button('Set up OpenSSH Server', () => api.setupSshd(), 'small primary');
    const srvRow = UI.row('OpenSSH Server', '', [srvPill, setupBtn]);
    const macRow = UI.row('', '');
    // PC → Mac (client here)
    const pill = el('span', { class: 'pill' });
    const openBtn = UI.button('Open Terminal', () => api.openTerminal(), 'small primary');
    const status = UI.row('Shell on the Mac', '', [pill, openBtn]);
    const pathBtn = UI.button('Add to PATH', () => api.addToPath(), 'small');
    const cmdRow = UI.row('macshare command', '', [pathBtn]);
    const pair = UI.dirCards(
      { on: { get: (s) => s.terminal.allowMac, set: (v) => api.setTerminal({ allowMac: v }) }, rows: [
        UI.row('Let the Mac open a shell here', 'The Mac types “ssh macshare-pc”, or uses its Terminal tab'),
        srvRow,
        macRow,
      ] },
      { on: { get: (s) => s.terminal.enabled, set: (v) => api.setTerminal({ enabled: v }) }, rows: [
        UI.row('Open shells on the Mac from here', 'The Mac needs Remote Login on (System Settings → General → Sharing)'),
        status,
        cmdRow,
      ] },
    );
    body.append(
      pair.el,
      UI.card('Security', [
        UI.row('Keys, not passwords', 'Each side makes an SSH key and hands it over the paired, encrypted link; each side’s host identity comes back the same way, so nothing asks “trust this host?”. Turning a direction off removes the key.'),
      ], { cls: 'keep-on' }),
    );
    const TEXT = { off: 'Off', no_mac: 'Waiting for the Mac', waiting: 'Asking the Mac…', ready: 'Ready', unavailable: 'Not available', error: 'Problem' };
    const SRV = { running: 'Running', stopped: 'Stopped', missing: 'Not installed', unknown: '—' };
    return (s) => {
      const t = s.terminal;
      const v = t.server;
      pair.update(s);
      srvPill.textContent = v.busy ? 'Setting up…' : SRV[v.service] || v.service;
      srvPill.className = 'pill ' + (v.service === 'running' ? 'good' : v.busy ? 'muted' : 'bad');
      setupBtn.hidden = v.service === 'running' || v.busy || !t.allowMac;
      srvRow.setHint(v.message || (v.service === 'running' ? 'Starts with Windows.' : 'One administrator prompt installs (if needed), starts it and keeps it on.'));
      macRow.label.textContent = !t.allowMac ? 'Off' : v.info && v.info.enabled ? 'The Mac can open a shell here' : v.macAsked ? 'Not ready yet' : 'Waiting for the Mac';
      macRow.setHint(!t.allowMac ? '' : v.info && v.info.enabled ? (v.admin ? 'Its key is in administrators_authorized_keys.' : 'Its key is in your authorized_keys.')
        : v.macAsked ? (v.service !== 'running' ? 'Start OpenSSH Server first.' : '') : 'Turn on “Open shells on the PC” on the Mac.');

      pill.textContent = TEXT[t.status] || t.status;
      pill.className = 'pill ' + (t.status === 'ready' ? 'good' : t.status === 'unavailable' || t.status === 'error' ? 'bad' : 'muted');
      openBtn.disabled = t.status !== 'ready';
      status.setHint(t.message || (t.status === 'ready' ? 'Signed in as ' + t.user + ' on the Mac.' : t.status === 'off' ? 'Turn it on to send this PC’s key to the Mac.' : ''));
      cmdRow.setHint(t.onPath ? 'Type “macshare” in any new terminal to open a shell on the Mac.' : 'Add MacShare’s folder to your PATH so “macshare” works in new terminals.');
      pathBtn.hidden = t.onPath;
    };
  },
});
