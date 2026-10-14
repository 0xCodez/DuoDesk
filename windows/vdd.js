// TwinDesk — Copyright (C) 2026 inukaasith. GPL-3.0, see LICENSE.
// Extend: a virtual monitor for this PC that only the Mac shows, from the Virtual Display
// Driver (https://github.com/VirtualDrivers/Virtual-Display-Driver — MIT, signed by SignPath
// Foundation; an IddCx driver). Installed once, elevated (scripts\vdd-install.ps1); after that the
// monitor is switched on/off without a prompt through two SYSTEM scheduled tasks the user may run.
// It is on only while Extend is on, like the Mac's TwinDesk display.
const { app } = require('electron');
const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');
const { run, runElevated, q } = require('./ps');
const Helper = require('./helper');

// Pinned release (driver package only, x64 despite the asset's name — see the project's silent-install.ps1).
const URL = 'https://github.com/VirtualDrivers/Virtual-Display-Driver/releases/download/25.7.23/VirtualDisplayDriver-x86.Driver.Only.zip';
const SHA256 = 'E24210692B442B39AF763536330CE78B423F19342B7A7792C26DE3944E418B3A';
const SETTINGS_XML = 'C:\\VirtualDisplayDriver\\vdd_settings.xml';
const ADAPTER = /virtual display driver/i; // the device name in MttVDD.inf
const SCHTASKS = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'schtasks.exe');

const STATUS_PS = `
$d = Get-PnpDevice -Class Display -ErrorAction SilentlyContinue | Where-Object { $_.HardwareID -contains 'Root\\MttVDD' } | Select-Object -First 1
$t = Get-ScheduledTask -TaskPath '\\MacShare\\' -TaskName 'Extend on' -ErrorAction SilentlyContinue
@{ device = [bool]$d; status = [string]$d.Status; tasks = [bool]$t } | ConvertTo-Json -Compress`;

class Vdd {
  // opts: helper, onChange()
  constructor(opts) {
    Object.assign(this, opts);
    this.state = { checked: false, installed: false, on: false, busy: '', message: '' };
  }

  view() {
    return { ...this.state };
  }

  _set(p) {
    Object.assign(this.state, p);
    this.onChange();
  }

  // Is the driver there and are our tasks there? At start (switching a leftover monitor off).
  async check() {
    try {
      const r = JSON.parse((await run(STATUS_PS, 30000)).trim() || '{}');
      this._set({ checked: true, installed: !!(r.device && r.tasks), on: r.status === 'OK' });
      if (this.state.installed && this.state.on && !this.wanted) await this.setOn(false);
    } catch (e) {
      this._set({ checked: true, message: 'Couldn’t check the display driver: ' + e.message });
    }
  }

  async install() {
    if (this.state.busy) return;
    this._set({ busy: 'install', message: '' });
    const log = path.join(app.getPath('userData'), 'vdd-result.txt');
    try {
      try { fs.unlinkSync(log); } catch (_) { /* none */ }
      const sid = (await run('[Security.Principal.WindowsIdentity]::GetCurrent().User.Value')).trim();
      if (!/^S-1-[\d-]+$/.test(sid)) throw new Error('couldn’t read this account’s id');
      const script = '& ' + q(path.join(__dirname, 'scripts', 'vdd-install.ps1')) + ' -Helper ' + q(Helper.EXE) + ' -UserSid ' + q(sid)
        + ' -Log ' + q(log) + ' -Url ' + q(URL) + ' -Sha256 ' + q(SHA256);
      await runElevated(script, 300000);
      const r = fs.existsSync(log) ? fs.readFileSync(log, 'utf8').trim() : 'error: the setup didn’t finish';
      if (r !== 'ok') throw new Error(r.replace(/^error: /, ''));
      this.state.message = '';
    } catch (e) {
      this.state.message = /cancel/i.test(e.message) ? 'The administrator prompt was declined' : 'Installing the display driver failed: ' + e.message;
    } finally {
      try { fs.unlinkSync(log); } catch (_) { /* none */ }
      this.state.busy = '';
      await this.check();
    }
  }

  async remove() {
    if (this.state.busy) return;
    this._set({ busy: 'remove', message: '' });
    const log = path.join(app.getPath('userData'), 'vdd-result.txt');
    try {
      if (this.state.on) await this.setOn(false);
      await runElevated('& ' + q(path.join(__dirname, 'scripts', 'vdd-remove.ps1')) + ' -Log ' + q(log), 120000);
      const r = fs.existsSync(log) ? fs.readFileSync(log, 'utf8').trim() : 'error: it didn’t finish';
      if (r !== 'ok') throw new Error(r.replace(/^error: /, ''));
    } catch (e) {
      this.state.message = /cancel/i.test(e.message) ? 'The administrator prompt was declined' : 'Removing the display driver failed: ' + e.message;
    } finally {
      try { fs.unlinkSync(log); } catch (_) { /* none */ }
      this.state.busy = '';
      await this.check();
    }
  }

  // Switch the virtual monitor on/off (scheduled task, no prompt). Resolves when the monitor is
  // there / gone (or after a timeout).
  async setOn(on) {
    this.wanted = on;
    if (!this.state.installed) return false;
    await new Promise((resolve) => execFile(SCHTASKS, ['/run', '/tn', on ? '\\MacShare\\Extend on' : '\\MacShare\\Extend off'],
      { windowsHide: true, timeout: 15000 }, (err) => {
        if (err) this.state.message = 'Couldn’t switch the virtual monitor: ' + String(err.message).split('\n')[0];
        resolve();
      }));
    const until = Date.now() + 20000;
    for (;;) {
      const mon = await this.find().catch(() => null);
      if (!!mon === on) {
        this._set({ on });
        return mon || true;
      }
      if (Date.now() > until) {
        this._set({ message: on ? 'The virtual monitor didn’t appear' : 'The virtual monitor didn’t go away' });
        return false;
      }
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  // The virtual monitor on the desktop: {name, x, y, width, height} in physical px, or null.
  async find() {
    const r = await this.helper.request('displays');
    this.mon = (r.displays || []).find((d) => ADAPTER.test(d.adapter || '')) || null;
    return this.mon;
  }

  // Before switching on: make sure the Mac's preferred size is one of the driver's modes (it reads
  // its settings when the device starts). Then, once on, set that size.
  addMode(width, height) {
    try {
      let xml = fs.readFileSync(SETTINGS_XML, 'utf8');
      const has = new RegExp('<width>\\s*' + width + '\\s*</width>\\s*<height>\\s*' + height + '\\s*</height>');
      if (has.test(xml) || !/<\/resolutions>/.test(xml)) return false;
      xml = xml.replace(/<\/resolutions>/, '    <resolution>\n            <width>' + width + '</width>\n            <height>' + height
        + '</height>\n            <refresh_rate>60</refresh_rate>\n        </resolution>\n    </resolutions>');
      fs.writeFileSync(SETTINGS_XML, xml);
      return true; // read when the device starts
    } catch (_) { return false; /* not writable: the driver's own sizes */ }
  }

  async setMode(mon, width, height) {
    try {
      await this.helper.request('displayMode', { name: mon.name, width, height });
    } catch (_) { /* keeps its size */ }
    return this.find();
  }
}

module.exports = Vdd;
