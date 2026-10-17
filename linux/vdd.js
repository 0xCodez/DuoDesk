// TwinDesk — Copyright (C) 2026 inukaasith. GPL-3.0, see LICENSE.
// Extend: a virtual monitor for this computer that only the other one shows (windows/vdd.js's
// interface for pcscreen.js). Nothing to install; this desktop either can or can't:
//   GNOME on Wayland — Mutter's own virtual monitors (org.gnome.Mutter.ScreenCast RecordVirtual,
//     what GNOME Remote Desktop uses). A small Python process (Gio + GStreamer's pipewiresrc) asks
//     for one and keeps its PipeWire stream open: the monitor lives as long as that stream, at the
//     stream's size. Sharing it goes through the portal like any screen (pick "Virtual remote monitor").
//   X11 — a spare (disconnected) output of the graphics driver gets a mode of the size wanted and
//     is placed beside the main monitor (xrandr --newmode / --addmode / --output). Drivers with no
//     spare output (NVIDIA's) can't.
// It is on only while Extend is on, like the Mac's TwinDesk display.
const { spawn, execFile } = require('child_process');

const WAYLAND = process.env.XDG_SESSION_TYPE === 'wayland';

const CHECK = String.raw`
import json, gi
r = {'mutter': False, 'pipewiresrc': False}
try:
    from gi.repository import Gio
    bus = Gio.bus_get_sync(Gio.BusType.SESSION, None)
    r['mutter'] = bus.call_sync('org.freedesktop.DBus', '/org/freedesktop/DBus', 'org.freedesktop.DBus', 'NameHasOwner',
        gi.repository.GLib.Variant('(s)', ('org.gnome.Mutter.ScreenCast',)), None, 0, 3000, None).unpack()[0]
    gi.require_version('Gst', '1.0')
    from gi.repository import Gst
    Gst.init(None)
    r['pipewiresrc'] = Gst.ElementFactory.find('pipewiresrc') is not None
except Exception:
    pass
print(json.dumps(r))
`;

// Asks Mutter for a virtual monitor of argv[1] × argv[2] and keeps it until stdin closes.
// Prints JSON lines: {"monitor": {name, x, y, scale}} once it's on the desktop, {"error"}, {"closed"}.
const VIRTUAL = String.raw`
import json, sys
import gi
gi.require_version('Gst', '1.0')
from gi.repository import Gio, GLib, Gst
Gst.init(None)
w, h = int(sys.argv[1]), int(sys.argv[2])
bus = Gio.bus_get_sync(Gio.BusType.SESSION, None)
def out(**k):
    print(json.dumps(k), flush=True)
def call(path, iface, method, args, ret=None):
    return bus.call_sync('org.gnome.Mutter.ScreenCast', path, iface, method, args, GLib.VariantType(ret) if ret else None, 0, 10000, None)
def virtual_connectors():
    r = bus.call_sync('org.gnome.Mutter.DisplayConfig', '/org/gnome/Mutter/DisplayConfig', 'org.gnome.Mutter.DisplayConfig', 'GetCurrentState', None, None, 0, 5000, None).unpack()
    found = {}
    for (x, y, scale, transform, primary, mons, props) in r[2]:
        for (conn, vendor, product, serial) in mons:
            if vendor == 'MetaVendor' or conn.startswith('Meta-'):
                found[conn] = {'name': conn, 'x': x, 'y': y, 'scale': scale}
    return found
try:
    before = set(virtual_connectors())
    sess = call('/org/gnome/Mutter/ScreenCast', 'org.gnome.Mutter.ScreenCast', 'CreateSession', GLib.Variant('(a{sv})', ({},)), '(o)')[0]
    stream = call(sess, 'org.gnome.Mutter.ScreenCast.Session', 'RecordVirtual',
                  GLib.Variant('(a{sv})', ({'cursor-mode': GLib.Variant('u', 1), 'is-platform': GLib.Variant('b', True)},)), '(o)')[0]
except GLib.Error as e:
    out(error=e.message.split(': ')[-1])
    sys.exit(1)
loop = GLib.MainLoop()
state = {'pipe': None, 'tries': 0}
def fail(text):
    out(error=text)
    loop.quit()
def find():
    try:
        new = [m for c, m in virtual_connectors().items() if c not in before]
    except GLib.Error:
        new = []
    if new:
        out(monitor=new[0])
        return False
    state['tries'] += 1
    if state['tries'] > 40:
        fail('The virtual monitor didn’t appear')
        return False
    return True
def added(conn, sender, path, iface, sig, params):
    pipe = Gst.parse_launch('pipewiresrc path=%d always-copy=false ! video/x-raw,width=%d,height=%d,max-framerate=60/1 ! fakesink sync=false' % (params[0], w, h))
    b = pipe.get_bus()
    b.add_signal_watch()
    b.connect('message::error', lambda b, m: fail(m.parse_error()[0].message))
    pipe.set_state(Gst.State.PLAYING)
    state['pipe'] = pipe
    GLib.timeout_add(250, find)
bus.signal_subscribe('org.gnome.Mutter.ScreenCast', 'org.gnome.Mutter.ScreenCast.Stream', 'PipeWireStreamAdded', stream, None, 0, added)
bus.signal_subscribe('org.gnome.Mutter.ScreenCast', 'org.gnome.Mutter.ScreenCast.Session', 'Closed', sess, None, 0, lambda *a: (out(closed=True), loop.quit()))
GLib.io_add_watch(GLib.IOChannel.unix_new(0), GLib.PRIORITY_DEFAULT, GLib.IO_HUP | GLib.IO_ERR, lambda *a: loop.quit() or False)
call(sess, 'org.gnome.Mutter.ScreenCast.Session', 'Start', None)
loop.run()
if state['pipe']:
    state['pipe'].set_state(Gst.State.NULL)
try:
    call(sess, 'org.gnome.Mutter.ScreenCast.Session', 'Stop', None)
except GLib.Error:
    pass
`;

function run(cmd, args, timeout = 10000) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout }, (err, stdout, stderr) => (err ? reject(new Error(String(stderr || err.message).trim().split('\n').pop())) : resolve(String(stdout))));
  });
}

// VESA CVT reduced-blanking timings (what `cvt -r` prints) for an X mode of w × h at 60 Hz.
function cvtRB(w, h) {
  const hDisp = Math.floor(w / 8) * 8;
  const r = hDisp / h;
  const near = (a) => Math.abs(r - a) < 0.02;
  const vSync = near(4 / 3) ? 4 : near(16 / 9) ? 5 : near(16 / 10) ? 6 : near(5 / 4) || near(15 / 9) ? 7 : 10;
  const hPeriod = (1e6 / 60 - 460) / h; // µs, 460 µs minimum vertical blank
  const vTotal = h + Math.max(Math.floor(460 / hPeriod) + 1, 3 + vSync + 6);
  const hTotal = hDisp + 160;
  const clock = Math.floor((60 * hTotal * vTotal) / 1e6 / 0.25) * 0.25;
  return { width: hDisp, args: [clock.toFixed(2), hDisp, hDisp + 48, hDisp + 80, hTotal, h, h + 3, h + 3 + vSync, vTotal, '+hsync', '-vsync'].map(String) };
}

// `xrandr --query`: outputs with their state and geometry (physical px).
async function outputs() {
  const text = await run('xrandr', ['--query']);
  const list = [];
  for (const line of text.split('\n')) {
    const m = /^(\S+) (connected|disconnected)( primary)?(?: (\d+)x(\d+)\+(-?\d+)\+(-?\d+))?/.exec(line);
    if (m) list.push({ name: m[1], connected: m[2] === 'connected', primary: !!m[3], active: !!m[4], width: +m[4] || 0, height: +m[5] || 0, x: +m[6] || 0, y: +m[7] || 0 });
  }
  return list;
}

class Vdd {
  // opts: onChange(), popup?(kind, text)
  constructor(opts) {
    Object.assign(this, opts);
    this.state = { checked: false, installed: false, on: false, busy: '', message: '', kind: '' };
    this.mon = null;
    this.size = [1920, 1080];
    this.proc = null; // the Python process keeping Mutter's virtual monitor (Wayland)
    this.output = ''; // the X output we drive (X11)
    this.mode = ''; // its mode name
  }

  view() {
    return { ...this.state };
  }

  _set(p) {
    Object.assign(this.state, p);
    this.onChange();
  }

  // Can this desktop make a virtual monitor? Checked at start (and switches a leftover X mode off).
  async check() {
    try {
      if (WAYLAND) {
        const r = JSON.parse(await run('python3', ['-c', CHECK]));
        this._set({ checked: true, kind: 'mutter', installed: !!(r.mutter && r.pipewiresrc),
          message: !r.mutter ? 'Extend on Wayland needs GNOME (its virtual monitors)' : !r.pipewiresrc ? 'Extend needs GStreamer’s PipeWire plugin (gstreamer1.0-pipewire)' : '' });
      } else {
        const outs = await outputs();
        for (const o of outs) if (o.active && !o.connected) await this._off(o.name).catch(() => {}); // left on by a crash
        const spare = outs.find((o) => !o.connected);
        this._set({ checked: true, kind: 'xrandr', installed: !!spare, message: spare ? '' : 'Your graphics driver has no spare output for a virtual monitor' });
      }
    } catch (e) {
      this._set({ checked: true, installed: false, message: WAYLAND ? 'Extend needs Python 3 with GObject (python3-gi)' : 'Couldn’t check the monitors: ' + e.message });
    }
  }

  // The size the next virtual monitor gets. Returns true when the one that's on must be made again.
  addMode(width, height) {
    const changed = this.size[0] !== width || this.size[1] !== height;
    this.size = [width, height];
    return changed && this.state.on && this.state.kind === 'mutter';
  }

  // Switch the virtual monitor on/off. Resolves to the monitor (on) or true (off), false on failure.
  async setOn(on) {
    this.wanted = on;
    if (!this.state.installed) return false;
    try {
      if (on) {
        const mon = this.state.kind === 'mutter' ? await this._mutterOn() : await this._xOn();
        this._set({ on: true, message: '' });
        return mon;
      }
      if (this.state.kind === 'mutter') this._mutterOff();
      else if (this.output) await this._off(this.output);
      this.mon = null;
      this._set({ on: false });
      return true;
    } catch (e) {
      this.mon = null;
      this._set({ on: false, message: (on ? 'Couldn’t add the virtual monitor: ' : 'Couldn’t remove the virtual monitor: ') + e.message });
      return false;
    }
  }

  _mutterOn() {
    this._mutterOff();
    const [w, h] = this.size;
    return new Promise((resolve, reject) => {
      const p = spawn('python3', ['-c', VIRTUAL, String(w), String(h)], { stdio: ['pipe', 'pipe', 'pipe'] });
      this.proc = p;
      let buf = '';
      let settled = false;
      const timer = setTimeout(() => done(new Error('it took too long')), 20000);
      const done = (err, mon) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (err) { this._mutterOff(); reject(err); } else resolve(mon);
      };
      p.stdout.setEncoding('utf8');
      p.stdout.on('data', (d) => {
        buf += d;
        let i;
        while ((i = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, i);
          buf = buf.slice(i + 1);
          let m;
          try { m = JSON.parse(line); } catch (_) { continue; }
          if (m.monitor) {
            const s = m.monitor.scale || 1;
            this.mon = { name: m.monitor.name, x: m.monitor.x, y: m.monitor.y, width: Math.round(w / s), height: Math.round(h / s) };
            done(null, this.mon);
          } else if (m.error) done(new Error(m.error));
        }
      });
      p.stderr.on('data', (d) => console.warn('[vdd]', String(d).trim()));
      p.stdin.on('error', () => {});
      p.on('error', (e) => done(e));
      p.on('exit', () => {
        if (this.proc !== p) return;
        this.proc = null;
        done(new Error('the virtual monitor stopped'));
        if (this.state.on) { this.mon = null; this._set({ on: false, message: 'The virtual monitor went away' }); }
      });
    });
  }

  _mutterOff() {
    const p = this.proc;
    this.proc = null;
    if (p) { p.stdin.end(); setTimeout(() => p.kill(), 3000).unref(); }
  }

  async _xOn() {
    const outs = await outputs();
    const out = outs.find((o) => o.name === this.output && !o.connected) || outs.find((o) => !o.connected);
    if (!out) throw new Error('no spare output');
    const main = outs.find((o) => o.primary && o.active) || outs.find((o) => o.connected && o.active);
    this.output = out.name;
    await this._xMode(this.size[0], this.size[1], main);
    return this.find();
  }

  // Give our output a mode of w × h (made if needed) and place it right of the main monitor.
  async _xMode(w, h, main) {
    const t = cvtRB(w, h);
    const name = 'TwinDesk_' + t.width + 'x' + h;
    await run('xrandr', ['--newmode', name, ...t.args]).catch((e) => { if (!/already exists|BadName/i.test(e.message)) throw e; });
    await run('xrandr', ['--addmode', this.output, name]).catch(() => {}); // already added
    await run('xrandr', ['--output', this.output, '--mode', name, ...(main ? ['--right-of', main.name] : [])]);
    const old = this.mode;
    this.mode = name;
    if (old && old !== name) {
      await run('xrandr', ['--delmode', this.output, old]).catch(() => {});
      await run('xrandr', ['--rmmode', old]).catch(() => {});
    }
  }

  async _off(output) {
    await run('xrandr', ['--output', output, '--off']);
    for (const m of [this.mode]) {
      if (!m) continue;
      await run('xrandr', ['--delmode', output, m]).catch(() => {});
      await run('xrandr', ['--rmmode', m]).catch(() => {});
    }
    this.mode = '';
  }

  // The virtual monitor on the desktop: {name, x, y, width, height} in the helper's pixels, or null.
  async find() {
    if (this.state.kind === 'mutter') return this.proc ? this.mon : null;
    if (!this.output) return (this.mon = null);
    const o = (await outputs()).find((x) => x.name === this.output && x.active);
    this.mon = o ? { name: o.name, x: o.x, y: o.y, width: o.width, height: o.height } : null;
    return this.mon;
  }

  // Once on, set the size (X11; Mutter's is made at that size).
  async setMode(mon, width, height) {
    if (this.state.kind === 'xrandr' && this.output) {
      const outs = await outputs().catch(() => []);
      const main = outs.find((o) => o.primary && o.active && o.name !== this.output) || outs.find((o) => o.connected && o.active);
      await this._xMode(width, height, main).catch((e) => this._set({ message: 'Couldn’t resize the virtual monitor: ' + e.message }));
    }
    return this.find();
  }
}

module.exports = Vdd;
