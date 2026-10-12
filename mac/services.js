// MacShare — Copyright (C) 2026 MacShare contributors. GPL-3.0, see LICENSE.
// Creates the helper-backed services and wires them together: display, stream, Monitor 2 input,
// clipboard, shared cursor/keyboard. Restarts the helper if it dies (phase 6) and keeps the display
// awake while a PC is connected.
'use strict';

const { powerSaveBlocker } = require('electron');
const { Helper } = require('./helper');
const { Displays } = require('./displays');
const { Stream } = require('./stream');
const { Input } = require('./input');
const { Clipboard } = require('./clipboard');
const { Kvm } = require('./kvm');
const { Terminal } = require('./terminal');
const { Drop } = require('./drop');
const { Smb } = require('./smb');
const { Apps } = require('./apps');
const { SshClient } = require('./ssh-client');
const { AudioHub } = require('./audiohub');
const { Audio } = require('./audio');
const { FileSend } = require('./filesend');
const { PcView } = require('./pcview');
const { PcApps } = require('./pcapps');
const store = require('./store');

function startServices({ server, getSettings, pushState, onHelperReady }) {
  const s = getSettings;
  server.setMaxListeners(50); // one 'client'/'closed' listener per feature
  const helper = new Helper();
  const displays = new Displays(helper, s);
  const hub = new AudioHub(helper, s);
  const stream = new Stream(server, displays, s, hub);
  let kvm = null;
  // Stream input only when "Receive input" is on and shared input is home (docs/KVM.md).
  const input = new Input(server, helper, displays, {
    enabled: () => s().streamInput !== false && (!kvm || kvm.mode === 'home'),
    swapKeys: () => s().keys.swapCtrlCmd !== false,
  });
  const clipboard = new Clipboard(server, helper, s);
  const drop = new Drop({ server, helper, displays, getSettings: s });
  const fileSend = new FileSend(server);
  kvm = new Kvm({ server, helper, getSettings: s, clipboard, input, drop, fileSend });
  const terminal = new Terminal(server, s);
  const smb = new Smb({ server, helper, getSettings: s, saveSettings: () => store.saveSettings(s()) });

  const apps = new Apps({ server, helper, displays, stream, getSettings: s });
  const sshClient = new SshClient(server, s);
  const audio = new Audio({ server, hub, stream, getSettings: s });
  const pcView = new PcView({ server, getSettings: s, saveSettings: () => store.saveSettings(s()) });
  const pcApps = new PcApps({ server, getSettings: s });
  kvm.blockEdge = () => pcView.focused || pcApps.focused; // moving inside the PC window never crosses to the PC

  for (const x of [stream, clipboard, kvm, terminal, drop, fileSend, smb, apps, sshClient, audio, pcView, pcApps]) x.on('change', pushState);
  displays.on('change', () => {
    input.releaseAll(); // the shared display moved or changed size mid-press
    pushState();
  });

  // Helper lifecycle: (re)create the virtual display and restart the stream after every start.
  helper.on('ready', () => {
    displays.applyVirtual().then(() => stream.restart('helper started'));
    onHelperReady();
    pushState();
  });
  const exits = [];
  helper.on('exit', () => {
    pushState();
    if (helper.stopping) return;
    const now = Date.now();
    exits.push(now);
    while (exits.length && now - exits[0] > 30000) exits.shift();
    const delay = exits.length <= 2 ? 1000 : exits.length <= 5 ? 3000 : 10000;
    console.log(`[services] helper exited — restarting in ${delay / 1000} s`);
    setTimeout(() => helper.start(), delay);
  });

  // Keep the display awake while a PC is connected.
  let blocker = null;
  function updateAwake() {
    const want = s().app.keepAwake !== false && !!server.current;
    if (want && blocker === null) blocker = powerSaveBlocker.start('prevent-display-sleep');
    if (!want && blocker !== null) {
      powerSaveBlocker.stop(blocker);
      blocker = null;
    }
  }
  server.on('client', updateAwake);
  server.on('closed', updateAwake);

  helper.start();

  return {
    helper, displays, stream, input, clipboard, kvm, terminal, drop, smb, apps, sshClient, audio, pcView, pcApps, hub, fileSend, updateAwake,
    shutdown() {
      pcView.shutdown();
      pcApps.shutdown();
      kvm.shutdown();
      hub.shutdown(); // unmute this Mac if we muted it while sending
      stream.stop('off');
      helper.stop(); // closes stdin: the helper exits and the virtual display goes away
    },
  };
}

module.exports = { startServices };
