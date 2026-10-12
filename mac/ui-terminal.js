// MacShare — Copyright (C) 2026 MacShare contributors. GPL-3.0, see LICENSE.
// Terminal tab (revision 2): shells both ways, no passwords — keys travel over the paired link.
'use strict';

UI.tab({
  id: 'terminal',
  order: 60,
  title: 'Terminal',
  desc: 'A shell on the other computer, either way. No passwords: keys travel over the paired, encrypted link.',
  color: 'linear-gradient(#3a3a3c, #1c1c1e)',
  badge: (s) => (s.terminal && (s.terminal.allowPc || s.terminal.connectPc) ? 'on' : ''),
  build(body) {
    const { el, api } = UI;
    const outSw = UI.switch((v) => api.setTerminal({ connectPc: v }), { label: 'Open shells on the PC from here' });
    const shellBtn = UI.button('Open a Shell on the PC', () => api.openPcShell(), 'small');
    const outRow = UI.row('Open shells on the PC from here', '', [outSw]);
    const cmdRow = UI.row('In Terminal on this Mac', '', [el('code', { class: 'mono', text: 'ssh macshare-pc' }), shellBtn]);
    const inSw = UI.switch((v) => api.setTerminal({ allowPc: v }), { label: 'Let the PC open shells here' });
    const inRow = UI.row('Let the PC open shells here', '', [inSw]);
    const rl = UI.row('Remote Login', '', [UI.button('Open Sharing Settings', () => api.openSharingSettings(), 'small')]);
    const how = UI.row('On the PC', 'In Command Prompt, PowerShell or Windows Terminal', [el('code', { class: 'mono', text: 'macshare' })]);
    body.append(
      UI.pair(
        UI.dir('m2w', [outRow, cmdRow], { role: 'this Mac connects' }),
        UI.dir('w2m', [inRow, rl, how], { role: 'the PC connects' }),
      ),
      UI.card('Security', [
        UI.row('Only the paired computer’s key is accepted', 'Keys are labelled “macshare”, without agent or X11 forwarding, and removed when you switch off or forget the computer. Host keys are pinned, so ssh never asks “trust this host?”. Your own ~/.ssh/config is only touched inside a marked block (backup: config.before-macshare).'),
      ], { cls: 'keep-on' }),
    );
    return (s) => {
      const t = s.terminal;
      if (!t) return;
      const pc = s.client ? s.client.name : 'the PC';
      const o = t.toPc || {};
      outSw.set(t.connectPc);
      shellBtn.hidden = !o.ready;
      const WHY = { waiting: `Sent this Mac’s key — waiting for ${pc}…`, not_allowed: `${pc} doesn’t allow it — turn it on in the PC app’s Terminal tab`,
        remote_login_off: `${pc}’s OpenSSH Server is off — turn it on in the PC app` };
      outRow.setHint(!t.connectPc ? 'Off — uses the PC’s OpenSSH Server'
        : o.ready ? `Ready — you log in to ${pc} as “${o.user}”` : WHY[o.why] || (o.why ? `Not ready: ${o.why}` : 'Waiting for your PC to connect'));
      cmdRow.setHint(o.ready ? 'Or click the button' : 'Works once the PC accepted this Mac’s key');
      inSw.set(t.allowPc);
      inRow.setHint(!t.allowPc ? 'Off — the PC can’t open a shell here'
        : t.installed ? `Ready — ${t.installed} key${t.installed > 1 ? 's' : ''} from the PC installed` : 'On — turn on Terminal in the PC app to send its key');
      rl.setHint(t.remoteLogin ? `On — the PC logs in as “${t.user}”` : t.remoteLogin === false ? 'Off — System Settings › General › Sharing › Remote Login' : 'Checking…');
    };
  },
});
