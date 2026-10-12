// MacShare — Copyright (C) 2026 MacShare contributors. GPL-3.0, see LICENSE.
// Phase 13: one Dock icon per PC app. A tiny generated bundle (`userData/PC Apps/<name>.app`: the
// app's name, a per-app bundle id, its icon; mac-helper's macshare-dockstub as the executable,
// ad-hoc signed) runs while that app has windows here. Its events: activate / focus <i> / quit.
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn, execFile } = require('child_process');
const { app } = require('electron');

const STUB = path.join(__dirname, '..', 'mac-helper', '.build', 'release', 'macshare-dockstub');

const run = (cmd, args) => new Promise((resolve) => execFile(cmd, args, (err) => resolve(!err)));
const xml = (v) => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// Builds (or reuses) the bundle for one PC app; returns the executable path, or null.
async function bundle({ id, name, icon }) {
  if (!fs.existsSync(STUB)) return null;
  const hash = crypto.createHash('sha1').update(String(id)).digest('hex').slice(0, 10);
  const safe = String(name || 'PC app').replace(/[/:\\]/g, '-').slice(0, 60);
  const dir = path.join(app.getPath('userData'), 'PC Apps', `${safe} ${hash.slice(0, 4)}.app`);
  const exe = path.join(dir, 'Contents', 'MacOS', 'dockstub');
  const stamp = crypto.createHash('sha1').update([name, icon || '', fs.statSync(STUB).mtimeMs].join('|')).digest('hex');
  const stampFile = path.join(dir, 'Contents', 'macshare-stamp');
  try {
    if (fs.readFileSync(stampFile, 'utf8') === stamp) return exe;
  } catch {}
  fs.rmSync(dir, { recursive: true, force: true });
  const res = path.join(dir, 'Contents', 'Resources');
  fs.mkdirSync(path.dirname(exe), { recursive: true });
  fs.mkdirSync(res, { recursive: true });
  fs.copyFileSync(STUB, exe);
  fs.chmodSync(exe, 0o755);
  let iconKey = '';
  const m = /^data:image\/png;base64,(.+)$/.exec(icon || '');
  if (m) {
    const png = path.join(res, 'icon.png');
    fs.writeFileSync(png, Buffer.from(m[1], 'base64'));
    if (await run('/usr/bin/sips', ['-s', 'format', 'icns', png, '--out', path.join(res, 'icon.icns')])) iconKey = '<key>CFBundleIconFile</key><string>icon</string>';
  }
  fs.writeFileSync(path.join(dir, 'Contents', 'Info.plist'), `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>CFBundleExecutable</key><string>dockstub</string>
<key>CFBundleIdentifier</key><string>org.macshare.pcapp.${hash}</string>
<key>CFBundleName</key><string>${xml(safe)}</string>
<key>CFBundleDisplayName</key><string>${xml(safe)}</string>
<key>CFBundlePackageType</key><string>APPL</string>
<key>CFBundleVersion</key><string>1</string>
<key>LSMinimumSystemVersion</key><string>13.0</string>
<key>NSHighResolutionCapable</key><true/>
${iconKey}
</dict></plist>
`);
  await run('/usr/bin/codesign', ['--force', '--sign', '-', dir]);
  fs.writeFileSync(stampFile, stamp);
  return exe;
}

// One running Dock icon. on(event, arg): 'activate' | 'focus' (index) | 'quit'.
class DockStub {
  constructor(appInfo, on) {
    this.on = on;
    this.proc = null;
    this.gone = false;
    this.titles = [];
    bundle(appInfo).then((exe) => {
      if (!exe || this.gone) return;
      this.proc = spawn(exe, [], { stdio: ['pipe', 'pipe', 'ignore'] });
      this.proc.on('error', () => {});
      this.proc.on('exit', () => { this.proc = null; });
      let buf = '';
      this.proc.stdout.on('data', (d) => {
        buf += d;
        let i;
        while ((i = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, i).trim();
          buf = buf.slice(i + 1);
          if (line === 'activate' || line === 'quit') this.on(line);
          else if (line.startsWith('focus ')) this.on('focus', Number(line.slice(6)));
        }
      });
      this.menu(this.titles);
    }).catch((e) => console.log(`[dockstub] ${e.message}`));
  }

  menu(titles) {
    this.titles = titles;
    if (this.proc && this.proc.stdin.writable) this.proc.stdin.write(`menu ${JSON.stringify(titles)}\n`);
  }

  stop() {
    this.gone = true;
    if (this.proc && this.proc.stdin.writable) this.proc.stdin.end('exit\n');
  }
}

module.exports = { DockStub };
