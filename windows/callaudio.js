// TwinDesk — Copyright (C) 2026 inukaasith. GPL-3.0, see LICENSE.
// The calls' sound on this PC over Bluetooth (shared/phonehub.js makes this only while Calls and
// its Bluetooth option are on with a phone connected). Windows has one way to be a phone's
// hands-free, PhoneLineTransportDevice, and keeps it for apps it lets (Phone Link): this asks, through
// PowerShell, once per run of the app. Where Windows says no, calls still ring, answer, end and dial
// from here; their sound stays on the phone. stop() ends it: nothing of it keeps running.
//
// view: as mac/callaudio.js. Events: 'change', 'address' (this PC's).
'use strict';

const { EventEmitter } = require('events');
const { run, q } = require('./ps');

const RETRY_MS = [5000, 15000, 30000, 60000, 120000];
const SYSTEM_ONLY = 'Windows lets only Phone Link play calls over Bluetooth. Calls still ring, answer and dial here; their sound stays on the phone';
let refused = ''; // Windows said no: not asked again until the app restarts

const PRELUDE = `
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$asTask = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation\`1' })[0]
function Await($op, [Type]$t) { $task = $asTask.MakeGenericMethod($t).Invoke($null, @($op)); [void]$task.Wait(30000); $task.Result }
$null = [Windows.Devices.Bluetooth.BluetoothAdapter, Windows.Devices.Bluetooth, ContentType = WindowsRuntime]
$null = [Windows.Devices.Radios.Radio, Windows.Devices.Radios, ContentType = WindowsRuntime]
$null = [Windows.Devices.Enumeration.DeviceInformation, Windows.Devices.Enumeration, ContentType = WindowsRuntime]
$null = [Windows.ApplicationModel.Calls.PhoneLineTransportDevice, Windows.ApplicationModel.Calls, ContentType = WindowsRuntime]
$out = @{}
`;

// This PC's adapter and the phones Windows offers as hands-free gateways.
const INFO = `${PRELUDE}
$out.address = ''; $out.power = $false; $out.devices = @()
try {
  $ad = Await ([Windows.Devices.Bluetooth.BluetoothAdapter]::GetDefaultAsync()) ([Windows.Devices.Bluetooth.BluetoothAdapter])
  if ($ad) {
    $out.address = (($ad.BluetoothAddress.ToString('X12')) -split '(..)' -ne '') -join ':'
    $radio = Await ($ad.GetRadioAsync()) ([Windows.Devices.Radios.Radio])
    $out.power = [bool]($radio -and "$($radio.State)" -eq 'On')
  }
} catch { $out.error = $_.Exception.Message }
try {
  $sel = [Windows.ApplicationModel.Calls.PhoneLineTransportDevice]::GetDeviceSelector([Windows.ApplicationModel.Calls.PhoneLineTransport]::Bluetooth)
  $all = Await ([Windows.Devices.Enumeration.DeviceInformation]::FindAllAsync($sel)) ([Windows.Devices.Enumeration.DeviceInformationCollection])
  $out.devices = @($all | ForEach-Object { @{ id = $_.Id; name = $_.Name } })
} catch { $out.error = $_.Exception.Message }
ConvertTo-Json $out -Compress -Depth 4
`;

const CONNECT = (id) => `${PRELUDE}
try {
  $d = [Windows.ApplicationModel.Calls.PhoneLineTransportDevice]::FromId(${q(id)})
  $acc = Await ($d.RequestAccessAsync()) ([Windows.Devices.Enumeration.DeviceAccessStatus])
  $out.access = "$acc"
  if ($out.access -eq 'Allowed') {
    if (-not $d.IsRegistered()) { $d.RegisterApp() }
    $out.connected = [bool](Await ($d.ConnectAsync()) ([bool]))
  }
} catch { $out.error = $_.Exception.Message }
ConvertTo-Json $out -Compress
`;

const parse = (s) => { try { return JSON.parse(String(s).trim().split('\n').pop()) || {}; } catch { return {}; } };

class CallAudio extends EventEmitter {
  constructor({ device, save }) {
    super();
    this.saved = device;
    this.save = save;
    this.phoneName = '';
    this.devices = [];
    this.address = '';
    this.power = true;
    this.id = '';
    this.state = refused ? 'unavailable' : 'starting';
    this.error = refused;
    this.canMute = false; // the call never plays here (or only through Phone Link): the phone mutes
    this.tries = 0;
    this.timer = null;
    this.gen = 0;
    this.stopped = false;
  }

  start(phoneName) {
    this.stopped = false;
    if (phoneName) this.phoneName = phoneName;
    if (refused) { this.error = refused; return this._set('unavailable'); }
    this.tries = 0;
    clearTimeout(this.timer);
    this._info(++this.gen);
  }

  phone(name) {
    if (name) this.phoneName = name;
    if (!this.stopped && !refused && ['needs-pair', 'choose'].includes(this.state)) this._info(this.gen);
  }

  pair() {}
  transfer() {} // Windows plays it where it likes
  mute() {}
  idle() {}

  stop() {
    this.stopped = true;
    this.gen++;
    clearTimeout(this.timer);
    this._set('off');
  }

  async _info(gen) {
    let r;
    try { r = parse(await run(INFO, 60000)); } catch (e) { r = { error: e.message }; }
    if (gen !== this.gen || this.stopped) return;
    this.power = r.power !== false;
    if (typeof r.address === 'string' && r.address && r.address !== this.address) {
      this.address = r.address;
      this.emit('address', r.address);
    }
    this.devices = (Array.isArray(r.devices) ? r.devices : [r.devices]).filter((d) => d && typeof d.id === 'string' && d.id)
      .slice(0, 20).map((d) => ({ id: d.id, name: String(d.name || 'Phone') }));
    if (!this.devices.length && r.error && !r.address) { this.error = String(r.error).slice(0, 160); return this._set('unavailable'); }
    this._pick(gen);
  }

  _pick(gen) {
    if (!this.power) { this.error = ''; return this._set('unavailable'); }
    const saved = this.saved();
    const name = this.phoneName.trim().toLowerCase();
    const d = this.devices.find((x) => x.id === saved)
      || (name && this.devices.find((x) => x.name.trim().toLowerCase() === name))
      || (this.devices.length === 1 ? this.devices[0] : null);
    if (!d) return this._set(this.devices.length ? 'choose' : 'needs-pair');
    this.id = d.id;
    if (d.id !== saved) this.save(d.id);
    this._connect(d, gen);
  }

  async _connect(d, gen) {
    this._set('connecting');
    let r;
    try { r = parse(await run(CONNECT(d.id), 60000)); } catch (e) { r = { error: e.message }; }
    if (gen !== this.gen || this.stopped) return;
    if (r.connected) { this.tries = 0; this.error = ''; return this._set('ready'); }
    // Not for this app (no package with Windows' phone line capability): say so, once.
    if ((r.access && r.access !== 'Allowed') || /denied|0x80070005|capability|not registered/i.test(r.error || '')) {
      refused = SYSTEM_ONLY;
      this.error = refused;
      return this._set('unavailable');
    }
    this.error = String(r.error || '').slice(0, 120);
    this._retry();
  }

  _retry() {
    if (this.stopped) return;
    const wait = RETRY_MS[this.tries++];
    this._set('failed');
    clearTimeout(this.timer);
    const gen = this.gen;
    if (wait) this.timer = setTimeout(() => !this.stopped && gen === this.gen && this._info(gen), wait);
  }

  _set(state) {
    this.state = state;
    this.emit('change');
  }

  get view() {
    const dev = this.devices.find((d) => d.id === this.id);
    const name = (dev && dev.name) || this.phoneName || 'the phone';
    const MESSAGES = {
      starting: 'Starting…',
      unavailable: this.error ? (this.error === SYSTEM_ONLY ? this.error : `Not available: ${this.error}`) : 'Bluetooth is off on this PC',
      'needs-pair': `Pair ${this.phoneName || 'the phone'} with this PC over Bluetooth once: Pair asks the phone, or use Settings › Bluetooth & devices`,
      choose: 'Choose the phone below',
      connecting: `Connecting to ${name}…`,
      ready: `Connected to ${name} over Bluetooth: calls play on this PC`,
      failed: `Couldn’t reach ${name} over Bluetooth${this.error ? ` (${this.error})` : ''}. ${this.tries > RETRY_MS.length ? 'Click Connect to try again' : 'Trying again soon'}`,
      off: 'Off',
    };
    return {
      state: this.state, message: MESSAGES[this.state] || '', device: this.id,
      devices: this.devices, here: this.state === 'ready', address: this.address, canMute: this.canMute, canMove: false,
    };
  }
}

module.exports = { create: (opts) => new CallAudio(opts) };
