// TwinDesk — Copyright (C) 2026 inukaasith. GPL-3.0, see LICENSE.
// Builds the Linux packages (`npm run dist`): the helper, a staging folder with the same
// layout as the repo (linux/, shared/, linux-helper/bin/), then electron-builder → AppImage and
// .deb (x64). Same approach as windows/installer/build.js: the layout is kept so
// '../shared/protocol.js' and the helper path work unchanged; no asar, so the helper is a real file.
// Run it on Linux (or in WSL) with the X11 dev packages installed.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const builder = require('electron-builder');

const LIN = path.join(__dirname, '..');
const ROOT = path.join(LIN, '..');
const STAGE = path.join(LIN, 'dist', 'stage');
const pkg = require(path.join(LIN, 'package.json'));
const electronVersion = require(path.join(LIN, 'node_modules', 'electron', 'package.json')).version;

const SKIP = new Set(['node_modules', 'dist', 'installer', 'package-lock.json']);

function copy(from, to, filter = () => true) {
  const st = fs.statSync(from);
  if (st.isDirectory()) {
    fs.mkdirSync(to, { recursive: true });
    for (const name of fs.readdirSync(from)) if (filter(name)) copy(path.join(from, name), path.join(to, name));
  } else {
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(from, to);
    fs.chmodSync(to, st.mode);
  }
}

function copyDeps(names, seen = new Set()) {
  for (const name of names) {
    if (seen.has(name)) continue;
    seen.add(name);
    const dir = path.join(LIN, 'node_modules', name);
    copy(dir, path.join(STAGE, 'node_modules', name));
    copyDeps(Object.keys(require(path.join(dir, 'package.json')).dependencies || {}), seen);
  }
}

async function main() {
  console.log('Building the helper…');
  execFileSync('sh', [path.join(ROOT, 'linux-helper', 'build.sh')], { stdio: 'inherit' });

  console.log('Staging…');
  fs.rmSync(STAGE, { recursive: true, force: true });
  copy(LIN, path.join(STAGE, 'linux'), (name) => !SKIP.has(name));
  copy(path.join(ROOT, 'shared', 'protocol.js'), path.join(STAGE, 'shared', 'protocol.js'));
  copy(path.join(ROOT, 'shared', 'sshconfig.js'), path.join(STAGE, 'shared', 'sshconfig.js'));
  copy(path.join(ROOT, 'shared', 'updates.js'), path.join(STAGE, 'shared', 'updates.js'));
  copy(path.join(ROOT, 'shared', 'framegen.js'), path.join(STAGE, 'shared', 'framegen.js'));
  copy(path.join(ROOT, 'linux-helper', 'bin', 'macshare-linuxhelper'), path.join(STAGE, 'linux-helper', 'bin', 'macshare-linuxhelper'));
  for (const f of ['LICENSE', 'THIRD_PARTY_NOTICES', 'README.md']) {
    if (fs.existsSync(path.join(ROOT, f))) copy(path.join(ROOT, f), path.join(STAGE, f));
  }
  copyDeps(Object.keys(pkg.dependencies || {}));
  fs.writeFileSync(path.join(STAGE, 'package.json'), JSON.stringify({
    name: 'twindesk', productName: pkg.productName, version: pkg.version, description: pkg.description,
    license: pkg.license, author: { name: 'inukaasith', email: 'inukaasith@users.noreply.github.com' },
    homepage: 'https://github.com/InukaAsith/TwinDesk', main: 'linux/main.js', dependencies: pkg.dependencies,
  }, null, 2));

  console.log('Packaging…');
  await builder.build({
    targets: builder.Platform.LINUX.createTarget(['AppImage', 'deb'], builder.Arch.x64),
    projectDir: LIN,
    config: {
      appId: 'org.macshare.linux',
      productName: 'TwinDesk',
      copyright: 'Copyright (C) 2026 inukaasith',
      electronVersion,
      directories: { app: STAGE, output: path.join(LIN, 'dist') },
      asar: false,
      npmRebuild: false,
      linux: {
        icon: path.join(LIN, 'assets', 'icon.png'),
        executableName: 'twindesk',
        category: 'Utility',
        synopsis: 'Share mouse, keyboard, clipboard, files and screens with your other computer',
        maintainer: 'inukaasith',
        desktop: { entry: { Name: 'TwinDesk', StartupWMClass: 'TwinDesk', Keywords: 'KVM;mouse;keyboard;clipboard;screen;share;' } },
        artifactName: 'TwinDesk-${version}-${arch}.${ext}',
      },
      deb: {
        // Electron's own needs plus what TwinDesk calls: openssl (host certificate), pactl (sound),
        // dbus-monitor (notifications), pkexec (firewall / input access fixes).
        depends: ['libgtk-3-0 | libgtk-3-0t64', 'libnotify4', 'libnss3', 'libxss1', 'libxtst6', 'xdg-utils',
          'libatspi2.0-0 | libatspi2.0-0t64', 'libuuid1', 'libsecret-1-0', 'libxi6', 'libxrandr2', 'libxfixes3',
          'openssl', 'dbus', 'pulseaudio-utils | pipewire-pulse', 'policykit-1 | pkexec'],
        priority: 'optional',
      },
    },
  });
  console.log('Done: ' + path.join(LIN, 'dist'));
}

main().catch((e) => { console.error(e); process.exit(1); });
