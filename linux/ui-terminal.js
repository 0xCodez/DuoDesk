// TwinDesk — Copyright (C) 2026 inukaasith. GPL-3.0, see LICENSE.
// Terminal tab (copy of windows/ui-terminal.js): shells both ways as two direction cards, with any
// computer. The other computer → here: it opens a shell here (the OpenSSH server, sshd.js).
// Here → the other computer: a shell there (terminal.js), also as `ssh duodesk` in any terminal.
'use strict';

UI.tab({
  id: 'terminal',
  wifiOnly: true, // over Bluetooth it can't work and doesn't move the session onto Wi-Fi: says so, with Connect with Wi-Fi Direct
  hidden: (s) => UI.isPhone(s), // the Phone page has the phone's screen, sound and apps
  order: 60,
  title: 'Terminal',
  color: 'linear-gradient(#3a3a3c, #1c1c1e)',
  desc: 'Open a terminal on the other computer.',
  badge: (s) => (s.terminal.status === 'unavailable' || s.terminal.status === 'error' ? 'warn' : s.terminal.status === 'ready' || (s.terminal.server.info && s.terminal.server.info.enabled) ? 'on' : ''),
  build(body) {
    const { el, api } = UI;
    const t = (k, p, d) => (typeof window.t === 'function' ? window.t(k, p, d) : d !== undefined ? d : k);
    // Mac → PC (server here)
    const srvPill = el('span', { class: 'pill' });
    const setupBtn = UI.button(t('terminal.set_up', null, 'Set up'), () => api.setupSshd(), 'small primary');
    const srvRow = UI.row(t('terminal.ssh_server', null, 'SSH server'), '', [srvPill, setupBtn]);
    const macRow = UI.row('', '');
    // PC → Mac (client here)
    const pill = el('span', { class: 'pill' });
    const openBtn = UI.button(t('terminal.open_terminal', null, 'Open Terminal'), () => api.openTerminal(), 'small primary');
    const status = UI.row(t('terminal.shell_on_name', null, 'Shell on {name}'), '', [pill, openBtn]);
    const cmdRow = UI.row(t('terminal.in_any_terminal', null, 'In any terminal'), '', [el('code', { class: 'mono', text: 'ssh duodesk' })]);
    const pair = UI.dirCards(
      { on: { get: (s) => s.terminal.allowMac, set: (v) => api.setTerminal({ allowMac: v }) }, label: t('terminal.let_name_open_a_terminal', null, 'Let {name} open a terminal on {me}'), rows: [
        srvRow,
        macRow,
      ] },
      { on: { get: (s) => s.terminal.enabled, set: (v) => api.setTerminal({ enabled: v }) }, label: t('terminal.open_a_terminal_on_name', null, 'Open a terminal on {name} from {me}'), rows: [
        status,
        cmdRow,
      ] },
    );
    body.append(pair.el);
    const TEXT = { off: t('clipboard.off', null, 'Off'), no_mac: t('terminal.waiting_for_name', null, 'Waiting for {name}'), waiting: t('terminal.asking_name', null, 'Asking {name}…'), ready: t('terminal.ready', null, 'Ready'), unavailable: t('terminal.not_available', null, 'Not available'), error: t('files.problem', null, 'Problem') };
    const SRV = { running: t('terminal.running', null, 'Running'), stopped: t('terminal.stopped', null, 'Stopped'), missing: t('terminal.not_installed', null, 'Not installed'), unknown: '' };
    return (s) => {
      const tm = s.terminal;
      const v = tm.server;
      pair.update(s);
      srvPill.textContent = v.busy ? t('files.setting_up', null, 'Setting up…') : SRV[v.service] || v.service;
      srvPill.className = 'pill ' + (v.service === 'running' ? 'good' : v.busy ? 'muted' : 'bad');
      setupBtn.hidden = v.service === 'running' || v.busy || !tm.allowMac;
      srvRow.setHint(v.message || (v.service === 'running' ? '' : t('terminal.installs_and_starts_openssh_asks', null, 'Installs and starts OpenSSH. Asks for your password once')));
      macRow.hidden = !tm.allowMac;
      macRow.label.textContent = v.info && v.info.enabled ? t('terminal.ready', null, 'Ready') : v.macAsked ? t('terminal.not_ready_yet', null, 'Not ready yet') : t('terminal.waiting_for_name', null, 'Waiting for {name}');
      macRow.setHint(v.macAsked && !(v.info && v.info.enabled) && v.service !== 'running' ? t('terminal.set_up_ssh_first', null, 'Set up the SSH server first') : '');

      pill.textContent = TEXT[tm.status] || tm.status;
      pill.className = 'pill ' + (tm.status === 'ready' ? 'good' : tm.status === 'unavailable' || tm.status === 'error' ? 'bad' : 'muted');
      openBtn.disabled = tm.status !== 'ready';
      status.setHint(tm.message || (tm.status === 'ready' ? t('terminal.as_user', { user: tm.user }, 'As {user}') : tm.status === 'unavailable' ? (UI.peer(s).os === 'mac' ? t('terminal.turn_on_remote_login_on', null, 'Turn on Remote Login on {name}') : t('terminal.set_up_the_ssh_server', null, 'Set up the SSH server on {name}')) : ''));
      cmdRow.hidden = tm.status !== 'ready';
    };
  },
});
