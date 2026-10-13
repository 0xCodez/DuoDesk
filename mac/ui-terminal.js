// TwinDesk — Copyright (C) 2026 inukaasith. GPL-3.0, see LICENSE.
// Terminal tab (revision 2): shells both ways, no passwords — keys travel over the paired link.
'use strict';

UI.tab({
  id: 'terminal',
  group: 'More',
  order: 60,
  title: 'Terminal',
  mixedOnly: true,
  desc: 'Open a shell on the other computer. No passwords needed.',
  color: 'linear-gradient(#3a3a3c, #1c1c1e)',
  badge: (s) => (s.terminal && (s.terminal.allowPc || s.terminal.connectPc) ? 'on' : ''),
  build(body) {
    const { el, api } = UI;
    const outSw = UI.switch((v) => api.setTerminal({ connectPc: v }), { label: 'Open shells there' });
    const shellBtn = UI.button('Open', () => api.openPcShell(), 'small');
    const outRow = UI.row('Open shells on {name} from {me}', '', [outSw]);
    const cmdRow = UI.row('In Terminal', '', [el('code', { class: 'mono', text: 'ssh macshare-pc' }), shellBtn]);
    const inSw = UI.switch((v) => api.setTerminal({ allowPc: v }), { label: 'Allow shells here' });
    const inRow = UI.row('Let {name} open shells on {me}', '', [inSw]);
    const rl = UI.row('Remote Login', '', [UI.button('Settings', () => api.openSharingSettings(), 'small')]);
    const how = UI.row('On {name}', '', [el('code', { class: 'mono', text: 'macshare' })]);
    body.append(
      UI.pair(
        UI.dir('m2w', [outRow, cmdRow]),
        UI.dir('w2m', [inRow, rl, how]),
      ),
    );
    return (s) => {
      const t = s.terminal;
      if (!t) return;
      const pc = UI.peer(s).name;
      const o = t.toPc || {};
      outSw.set(t.connectPc);
      shellBtn.hidden = !o.ready;
      const WHY = { waiting: `Waiting for ${pc}…`, not_allowed: `Turned off on ${pc}`, remote_login_off: `Turn on SSH in TwinDesk on ${pc}` };
      outRow.setHint(!t.connectPc ? '' : o.ready ? `Ready, signed in as ${o.user}` : WHY[o.why] || (o.why ? `Not ready: ${o.why}` : `Waiting for ${pc}`));
      cmdRow.setHint('');
      inSw.set(t.allowPc);
      inRow.setHint(!t.allowPc ? '' : t.installed ? 'Ready' : `Turn on Terminal in TwinDesk on ${pc}`);
      rl.setHint(t.remoteLogin ? 'On' : t.remoteLogin === false ? 'Off. Turn it on in Sharing settings.' : '');
    };
  },
});
