// TwinDesk — Copyright (C) 2026 inukaasith. GPL-3.0, see LICENSE.
// Terminal tab: shells both ways, no passwords — keys travel over the paired link.
'use strict';

UI.tab({
  id: 'terminal',
  wifiOnly: true, // over Bluetooth it can't work and doesn't move the session onto Wi-Fi: says so, with Connect with Wi-Fi Direct
  hidden: (s) => UI.isPhone(s), // the Phone page has the phone's screen, sound and apps
  group: 'More',
  order: 60,
  title: 'Terminal',
  desc: 'Open a shell on the other computer. No passwords needed.',
  color: 'linear-gradient(#3a3a3c, #1c1c1e)',
  badge: (s) => (s.terminal && (s.terminal.allowPc || s.terminal.connectPc) ? 'on' : ''),
  build(body) {
    const { el, api } = UI;
    const t = (k, p, d) => (typeof window.t === 'function' ? window.t(k, p, d) : d !== undefined ? d : k);
    const outSw = UI.switch((v) => api.setTerminal({ connectPc: v }), { label: t('terminal.open_shells_there', null, 'Open shells there') });
    const shellBtn = UI.button(t('files.open', null, 'Open'), () => api.openPcShell(), 'small');
    const outRow = UI.row(t('terminal.open_shells_on_name_from', null, 'Open shells on {name} from {me}'), '', [outSw]);
    const cmdRow = UI.row(t('terminal.in_terminal', null, 'In Terminal'), '', [el('code', { class: 'mono', text: 'ssh duodesk' }), shellBtn]);
    const inSw = UI.switch((v) => api.setTerminal({ allowPc: v }), { label: t('terminal.allow_shells_here', null, 'Allow shells here') });
    const inRow = UI.row(t('terminal.let_name_open_shells_on', null, 'Let {name} open shells on {me}'), '', [inSw]);
    const rl = UI.row(t('terminal.remote_login', null, 'Remote Login'), '', [UI.button(t('phone.settings', null, 'Settings'), () => api.openSharingSettings(), 'small')]);
    const how = UI.row(t('files.on_peer', null, 'On {name}'), '', [el('code', { class: 'mono', text: 'ssh duodesk' })]);
    body.append(
      UI.pair(
        UI.dir('m2w', [outRow, cmdRow]),
        UI.dir('w2m', [inRow, rl, how]),
      ),
    );
    return (s) => {
      const tm = s.terminal;
      if (!tm) return;
      const o = tm.toPc || {};
      outSw.set(tm.connectPc);
      shellBtn.hidden = !o.ready;
      const WHY = { waiting: t('terminal.waiting_for_name_ellipsis', null, 'Waiting for {name}…'), not_allowed: t('clipboard.turned_off_on', null, 'Turned off on {name}'), remote_login_off: UI.peer(s).os === 'mac' ? t('terminal.turn_on_remote_login_on', null, 'Turn on Remote Login on {name}') : t('terminal.set_up_the_ssh_server_in', null, 'Set up the SSH server in DuoDesk on {name}'),
        bluetooth: t('terminal.the_terminal_doesnt_work_over', null, 'The terminal doesn’t work over Bluetooth. Connect with Wi-Fi Direct, or join {name}’s network.') };
      outRow.setHint(!tm.connectPc ? '' : o.ready ? t('terminal.ready_signed_in_as', { user: o.user }, 'Ready, signed in as {user}') : WHY[o.why] || (o.why ? t('terminal.not_ready', { reason: o.why }, 'Not ready: {reason}') : t('terminal.waiting_for_name', null, 'Waiting for {name}')));
      cmdRow.setHint('');
      inSw.set(tm.allowPc);
      inRow.setHint(!tm.allowPc ? '' : tm.installed ? t('terminal.ready', null, 'Ready') : t('terminal.turn_on_terminal_in_duodesk', null, 'Turn on Terminal in DuoDesk on {name}'));
      rl.setHint(tm.remoteLogin ? t('terminal.on', null, 'On') : tm.remoteLogin === false ? t('terminal.off_turn_it_on_in', null, 'Off. Turn it on in Sharing settings.') : '');
    };
  },
});
