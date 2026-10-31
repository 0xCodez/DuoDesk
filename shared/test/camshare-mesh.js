// TwinDesk — Copyright (C) 2026 inukaasith. GPL-3.0, see LICENSE.
// shared/camshare-mesh.js: Camera with Multi-device on — one CamShare per connected computer on the
// hub's bus, each hearing and sending only its own device's cam.* (the one-to-one protocol), the
// selected one's camera started here, one at a time, the share switch for every device.
'use strict';

const assert = require('assert');
const Module = require('module');
const { EventEmitter } = require('events');

// No Electron here: windows are stand-ins that record what they're sent.
const ipcMain = new EventEmitter();
ipcMain.setMaxListeners(50);
const app = new EventEmitter();
app.setMaxListeners(50);
const wins = [];
class BrowserWindow extends EventEmitter {
  constructor(opts) {
    super();
    this.opts = opts;
    this.sent = [];
    this.destroyed = false;
    this.visible = false;
    this.webContents = { send: (ch, m) => this.sent.push(m) };
    wins.push(this);
  }
  loadFile(file, o) { this.file = file; this.query = o && o.query; }
  isDestroyed() { return this.destroyed; }
  isVisible() { return this.visible; }
  show() { this.visible = true; }
  hide() { this.visible = false; }
  focus() {}
  close() {
    const e = { defaultPrevented: false, preventDefault() { this.defaultPrevented = true; } };
    this.emit('close', e);
    if (e.defaultPrevented) return;
    this.destroyed = true;
    this.emit('closed');
  }
}
const load = Module._load;
Module._load = function (req, ...rest) {
  return req === 'electron' ? { ipcMain, app, BrowserWindow } : load.call(this, req, ...rest);
};
const P = require('../protocol.js');
const { MeshCamShare } = require('../camshare-mesh.js');
const T = P.T;

// The hub's bus with devices A, B (computers) and Ph (a phone).
function makeBus(devices) {
  const bus = {
    handlers: new Map(), peerHandlers: new Map(), sent: [], selected: 'A', devices,
    on(type, fn) { (bus.handlers.get(type) || bus.handlers.set(type, []).get(type)).push(fn); },
    onPeer(ev, fn) { (bus.peerHandlers.get(ev) || bus.peerHandlers.set(ev, []).get(ev)).push(fn); },
    send(id, msg) { bus.sent.push({ id, msg }); return !!devices[id]; },
    selectedId: () => bus.selected,
    connectedIds: () => Object.keys(devices),
    from(id, msg) { for (const fn of bus.handlers.get(msg.t) || []) fn(msg, id); },
    peer(ev, id, info) { for (const fn of bus.peerHandlers.get(ev) || []) fn(id, info); },
    to(id, t) { return bus.sent.filter((x) => x.id === id && (!t || x.msg.t === t)).map((x) => x.msg); },
  };
  return bus;
}

function setup(cfgInit = {}) {
  const devices = { A: { name: 'Alpha', os: P.OS.WIN }, B: { name: 'Beta', os: P.OS.MAC }, Ph: { name: 'Pixel', os: P.OS.ANDROID } };
  const bus = makeBus(devices);
  const cfg = { on: true, share: false, device: '', ...cfgInit };
  const popups = [];
  let changes = 0;
  const cam = new MeshCamShare({
    bus,
    peer: (id) => devices[id] || null,
    cfg: () => cfg,
    save: () => {},
    popup: (kind, text) => popups.push(text),
    onChange: () => { changes++; },
  });
  return { bus, cam, cfg, popups, devices, changes: () => changes };
}

// Loaded with devices connected: each computer gets our policy with ask; the phone gets nothing.
{
  const { bus } = setup();
  assert.deepStrictEqual(bus.to('A', T.CAM_POLICY), [{ t: T.CAM_POLICY, share: false, ask: true }]);
  assert.deepStrictEqual(bus.to('B', T.CAM_POLICY), [{ t: T.CAM_POLICY, share: false, ask: true }]);
  assert.deepStrictEqual(bus.to('Ph'), []);
}

// Policies are per device; the tab shows the selected one's.
{
  const { bus, cam } = setup();
  bus.from('B', { t: T.CAM_POLICY, share: true });
  assert.strictEqual(cam.state.peerShares, false, 'A (selected) did not share');
  assert.strictEqual(cam.state.peerId, 'A');
  assert.strictEqual(cam.state.mesh, true);
  bus.selected = 'B';
  assert.strictEqual(cam.state.peerShares, true);
  assert.strictEqual(cam.state.peerName, 'Beta');
  // A policy asking for ours is answered to that device only.
  bus.sent.length = 0;
  bus.from('A', { t: T.CAM_POLICY, share: false, ask: true });
  assert.deepStrictEqual(bus.to('A', T.CAM_POLICY), [{ t: T.CAM_POLICY, share: false }]);
  assert.deepStrictEqual(bus.to('B'), []);
}

// Start: the selected computer is asked (cam.open to it alone); another Start stops the first.
{
  const { bus, cam } = setup();
  bus.selected = 'A';
  bus.from('A', { t: T.CAM_POLICY, share: true });
  cam.view();
  assert.strictEqual(bus.to('A', T.CAM_OPEN).length, 1);
  assert.strictEqual(bus.to('B', T.CAM_OPEN).length, 0);
  assert.ok(cam.viewing);
  // The offer from A goes to A's viewer window; one from B (not viewing) goes nowhere.
  const viewA = wins[wins.length - 1];
  bus.from('B', { t: T.CAM_OFFER, sdp: 'b-sdp' });
  bus.from('A', { t: T.CAM_OFFER, sdp: 'a-sdp' });
  ipcMain.emit('cam:out', { sender: viewA.webContents }, { t: 'ready' });
  assert.ok(viewA.sent.some((m) => m.t === 'offer' && m.sdp === 'a-sdp'));
  assert.ok(!viewA.sent.some((m) => m.sdp === 'b-sdp'));
  // Its answer goes back to A.
  ipcMain.emit('cam:out', { sender: viewA.webContents }, { t: 'answer', sdp: 'ans' });
  assert.deepStrictEqual(bus.to('A', T.CAM_ANSWER), [{ t: T.CAM_ANSWER, sdp: 'ans' }]);
  // B selected: the tab is still about A while A's runs.
  bus.selected = 'B';
  assert.strictEqual(cam.state.peerId, 'A');
  assert.strictEqual(cam.state.viewing, true);
  // Start with B selected: A's stops (cam.close to A), B is asked.
  cam.view();
  assert.ok(viewA.isDestroyed());
  assert.strictEqual(bus.to('A', T.CAM_CLOSE).length, 1);
  assert.strictEqual(bus.to('B', T.CAM_OPEN).length, 1);
  assert.strictEqual(cam.state.peerId, 'B');
  cam.closeView();
  assert.ok(!cam.viewing);
}

// A phone selected: Start says to pick a computer (the phone's camera goes through its own stack).
{
  const { bus, cam, popups } = setup();
  bus.selected = 'Ph';
  cam.view();
  assert.strictEqual(bus.to('Ph').length, 0);
  assert.ok(popups.some((t) => /computer/.test(t)));
}

// Sharing: off, a device asking is refused; on, every device hears it, each viewer gets its own sender.
{
  const { bus, cam, popups } = setup();
  bus.from('A', { t: T.CAM_OPEN });
  assert.deepStrictEqual(bus.to('A', T.CAM_STATE), [{ t: T.CAM_STATE, status: 'refused' }]);
  bus.sent.length = 0;
  cam.setShare(true);
  assert.deepStrictEqual(bus.to('A', T.CAM_POLICY), [{ t: T.CAM_POLICY, share: true }]);
  assert.deepStrictEqual(bus.to('B', T.CAM_POLICY), [{ t: T.CAM_POLICY, share: true }]);
  const before = wins.length;
  bus.from('A', { t: T.CAM_OPEN });
  bus.from('B', { t: T.CAM_OPEN });
  assert.strictEqual(wins.length - before, 2, 'a sender window per viewer');
  assert.ok(popups.some((t) => t.startsWith('Alpha')) && popups.some((t) => t.startsWith('Beta')));
  const st = cam.state;
  assert.strictEqual(st.sending, true);
  assert.strictEqual(st.sendingTo, 'Alpha, Beta');
  // A's offer goes to A only.
  const sendA = wins[before];
  ipcMain.emit('cam:out', { sender: sendA.webContents }, { t: 'ready' });
  ipcMain.emit('cam:out', { sender: sendA.webContents }, { t: 'offer', sdp: 'mine' });
  assert.deepStrictEqual(bus.to('A', T.CAM_OFFER), [{ t: T.CAM_OFFER, sdp: 'mine' }]);
  assert.deepStrictEqual(bus.to('B', T.CAM_OFFER), []);
  // A goes away: only B still views.
  bus.peer('closed', 'A', {});
  assert.strictEqual(cam.state.sendingTo, 'Beta');
  // Off: B's stops and is told.
  bus.sent.length = 0;
  cam.setShare(false);
  assert.strictEqual(bus.to('B', T.CAM_CLOSE).length, 1);
  assert.strictEqual(cam.state.sending, false);
}

// A computer that connects later: our policy with ask on its welcome; again (no ask) when it comes back.
{
  const { bus, cam, devices } = setup();
  devices.C = { name: 'Gamma', os: P.OS.LINUX };
  bus.peer('welcome', 'C', { os: P.OS.LINUX });
  assert.deepStrictEqual(bus.to('C', T.CAM_POLICY), [{ t: T.CAM_POLICY, share: false, ask: true }]);
  bus.peer('closed', 'C', {});
  bus.sent.length = 0;
  bus.peer('welcome', 'C', { os: P.OS.LINUX });
  assert.deepStrictEqual(bus.to('C', T.CAM_POLICY), [{ t: T.CAM_POLICY, share: false }]);
  bus.peer('welcome', 'Ph2', { os: P.OS.ANDROID });
  assert.ok(!cam.units.has('Ph2'));
}

console.log('camshare-mesh: ok');
