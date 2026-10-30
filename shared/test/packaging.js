// TwinDesk — Copyright (C) 2026 inukaasith, Erdoğan Yeşil. GPL-3.0, see LICENSE.
'use strict';

// Every shared module an app requires has to be in its installer. A list kept by hand once left the
// Windows installer without shared/mesh.js: the installed app died at start ("Cannot find module").
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const shared = fs.readdirSync(path.join(ROOT, 'shared')).filter((f) => f.endsWith('.js'));

// 1. what the apps require from shared/ exists there (the app folders and their multi-device mesh/ folders)
const required = new Set();
for (const dir of ['windows', 'mac', 'linux', 'windows/mesh', 'mac/mesh', 'linux/mesh']) {
  if (!fs.existsSync(path.join(ROOT, dir))) continue;
  for (const f of fs.readdirSync(path.join(ROOT, dir)).filter((n) => n.endsWith('.js'))) {
    for (const m of read(`${dir}/${f}`).matchAll(/require\('(?:\.\.\/)+shared\/([a-z0-9-]+(?:\.js)?)'\)/g)) {
      required.add(m[1].endsWith('.js') ? m[1] : `${m[1]}.js`);
    }
  }
}
for (const f of required) assert.ok(shared.includes(f), `shared/${f} is required but missing`);

// 2. the installers stage the WHOLE shared folder, not a list
for (const f of ['windows/installer/build.js', 'linux/installer/build.js']) {
  const s = read(f);
  const perFile = /readdirSync\(path\.join\(ROOT, 'shared'\)\)/.test(s) && /\.\(js\|css\|html\)/.test(s);
  const wholeDir = /copy\(path\.join\(ROOT, 'shared'\), path\.join\(STAGE, 'shared'\)/.test(s) && /\.\(js\|css\|html\)/.test(s);
  assert.ok(perFile || wholeDir, `${f} copies every shared/*.js`);
  assert.ok(!/copy\(path\.join\(ROOT, 'shared', '(?!protocol)[a-z-]+\.js'\)/.test(s), `${f} has no hand-kept list of shared files`);
}
assert.ok(/cp "\$ROOT"\/shared\/\*\.js/.test(read('mac/build-app.sh')), 'mac/build-app.sh copies every shared/*.js');
assert.ok(/cp -r shared\/\*\.js shared\/\*\.css shared\/\*\.html/.test(read('flake.nix')), 'flake.nix copies every shared/*.js, *.css, *.html');

// 3. and every run-time subfolder of shared/ (the pages' fonts, the art kit and scenes, the per-page
//    effects): the top-level filters skip folders, so each one is named. Only tests and the icon
//    sources (the builds take the icons themselves) stay out.
const NOT_SHIPPED = new Set(['test', 'icon']);
const dirs = fs.readdirSync(path.join(ROOT, 'shared'), { withFileTypes: true })
  .filter((d) => d.isDirectory() && !d.name.startsWith('.') && !NOT_SHIPPED.has(d.name)).map((d) => d.name);
for (const d of ['fonts', 'art', 'pagefx']) assert.ok(dirs.includes(d), `shared/${d}/ exists`);
for (const f of ['windows/installer/build.js', 'linux/installer/build.js']) {
  const s = read(f);
  const m = s.match(/const SHARED_DIRS = \[([^\]]*)\]/);
  assert.ok(m, `${f} has SHARED_DIRS`);
  const listed = [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]);
  for (const d of dirs) assert.ok(listed.includes(d), `${f} stages shared/${d}/`);
  assert.ok(/for \(const dir of SHARED_DIRS\) copy\(path\.join\(ROOT, 'shared', dir\), path\.join\(STAGE, 'shared', dir\)/.test(s), `${f} copies SHARED_DIRS`);
}
{
  const m = read('mac/build-app.sh').match(/for d in ([a-z0-9 -]+); do rsync -a [^\n]*"\$ROOT\/shared\/\$d" "\$STAGE\/shared\/"/);
  assert.ok(m, 'mac/build-app.sh copies the shared/ subfolders');
  for (const d of dirs) assert.ok(m[1].split(' ').includes(d), `mac/build-app.sh stages shared/${d}/`);
}
{
  const m = read('flake.nix').match(/cp -r ((?:shared\/[a-z0-9-]+ ?)+) "\$share\/shared\/"/);
  assert.ok(m, 'flake.nix copies the shared/ subfolders');
  const listed = m[1].trim().split(/\s+/).map((x) => x.replace('shared/', ''));
  for (const d of dirs) assert.ok(listed.includes(d), `flake.nix stages shared/${d}/`);
}

console.log(`packaging: passed (${required.size} shared modules required, all staged; shared/ folders staged: ${dirs.join(', ')})`);
