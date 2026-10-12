// MacShare — Copyright (C) 2026 MacShare contributors. GPL-3.0, see LICENSE.
// Terminal tab: shells both ways as two direction cards (docs/UI.md). Mac → PC: the Mac opens a
// shell here (Windows' OpenSSH Server, sshd.js). PC → Mac: a shell on the Mac (terminal.js).
'use strict';

UI.tab({
  id: 'terminal',
  order: 60,
  title: 'Terminal',
  color: 'linear-gradient(#3a3a3c, #1c1c1e)',
  desc: 'Open a terminal on the other computer.',
  badge: (s) => (s.terminal.status === 'unavailable' || s.terminal.status === 'error' ? 'warn' : s.terminal.status === 'ready' || (s.terminal.server.info && s.terminal.server.info.enabled) ? 'on' : ''),
  build(body) {
    const { el, api } = UI;
    // Mac → PC (server here)
    const srvPill = el('span', { class: 'pill' });
    const setupBtn = UI.button('Set up', () => api.setupSshd(), 'small primary');
    const srvRow = UI.row('SSH server', '', [srvPill, setupBtn]);
    const macRow = UI.row('', '');
    // PC → Mac (client here)
    const pill = el('span', { class: 'pill' });
    const openBtn = UI.button('Open Terminal', () => api.openTerminal(), 'small primary');
    const status = UI.row('Shell on the Mac', '', [pill, openBtn]);
    const pathBtn = UI.button('Add to PATH', () => api.addToPath(), 'small');
    const cmdRow = UI.row('Command', '', [pathBtn]);
    const pair = UI.dirCards(
      { on: { get: (s) => s.terminal.allowMac, set: (v) => api.setTerminal({ allowMac: v }) }, rows: [
        UI.row('Let the Mac open a terminal here', ''),
        srvRow,
        macRow,
      ] },
      { on: { get: (s) => s.terminal.enabled, set: (v) => api.setTerminal({ enabled: v }) }, rows: [
        UI.row('Open a terminal on the Mac', ''),
        status,
        cmdRow,
      ] },
    );
    body.append(pair.el);
    const TEXT = { off: 'Off', no_mac: 'Waiting for the Mac', waiting: 'Asking the Mac…', ready: 'Ready', unavailable: 'Not available', error: 'Problem' };
    const SRV = { running: 'Running', stopped: 'Stopped', missing: 'Not installed', unknown: '' };
    return (s) => {
      const t = s.terminal;
      const v = t.server;
      pair.update(s);
      srvPill.textContent = v.busy ? 'Setting up…' : SRV[v.service] || v.service;
      srvPill.className = 'pill ' + (v.service === 'running' ? 'good' : v.busy ? 'muted' : 'bad');
      setupBtn.hidden = v.service === 'running' || v.busy || !t.allowMac;
      srvRow.setHint(v.message || (v.service === 'running' ? '' : 'Asks for administrator rights once'));
      macRow.hidden = !t.allowMac;
      macRow.label.textContent = v.info && v.info.enabled ? 'Ready' : v.macAsked ? 'Not ready yet' : 'Waiting for your Mac';
      macRow.setHint(v.macAsked && !(v.info && v.info.enabled) && v.service !== 'running' ? 'Set up the SSH server first' : '');

      pill.textContent = TEXT[t.status] || t.status;
      pill.className = 'pill ' + (t.status === 'ready' ? 'good' : t.status === 'unavailable' || t.status === 'error' ? 'bad' : 'muted');
      openBtn.disabled = t.status !== 'ready';
      status.setHint(t.message || (t.status === 'ready' ? 'As ' + t.user : t.status === 'unavailable' ? 'Turn on Remote Login on the Mac' : ''));
      cmdRow.setHint(t.onPath ? 'Type macshare in a new terminal' : 'So macshare works in any terminal');
      pathBtn.hidden = t.onPath;
    };
  },
});
