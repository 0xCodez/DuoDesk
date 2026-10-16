// TwinDesk — Copyright (C) 2026 inukaasith. GPL-3.0, see LICENSE.
// Builds the Windows installer (npm run dist): the helper, a staging folder with the same layout
// as the repo (windows/, shared/protocol.js, windows-helper/bin/), then electron-builder → NSIS.
// The layout is kept so '../shared/protocol.js' and the helper path work unchanged; no asar, so
// the helper .exe and the .ps1 scripts are real files Windows can run.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const builder = require('electron-builder');

const WIN = path.join(__dirname, '..');
const ROOT = path.join(WIN, '..');
const STAGE = path.join(WIN, 'dist', 'stage');
const pkg = require(path.join(WIN, 'package.json'));
const electronVersion = require(path.join(WIN, 'node_modules', 'electron', 'package.json')).version;

const SKIP = new Set(['node_modules', 'dist', 'installer', 'package-lock.json']);

function copy(from, to, filter = () => true) {
  const st = fs.statSync(from);
  if (st.isDirectory()) {
    fs.mkdirSync(to, { recursive: true });
    for (const name of fs.readdirSync(from)) if (filter(name)) copy(path.join(from, name), path.join(to, name));
  } else {
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(from, to);
  }
}

// Runtime dependencies (and theirs) from windows/node_modules.
function copyDeps(names, seen = new Set()) {
  for (const name of names) {
    if (seen.has(name)) continue;
    seen.add(name);
    const dir = path.join(WIN, 'node_modules', name);
    copy(dir, path.join(STAGE, 'node_modules', name));
    copyDeps(Object.keys(require(path.join(dir, 'package.json')).dependencies || {}), seen);
  }
}

async function main() {
  console.log('Building the helper…');
  execFileSync('cmd.exe', ['/c', path.join(ROOT, 'windows-helper', 'build.cmd')], { stdio: 'inherit' });

  console.log('Staging…');
  fs.rmSync(STAGE, { recursive: true, force: true });
  copy(WIN, path.join(STAGE, 'windows'), (name) => !SKIP.has(name));
  copy(path.join(ROOT, 'shared', 'protocol.js'), path.join(STAGE, 'shared', 'protocol.js'));
  copy(path.join(ROOT, 'shared', 'sshconfig.js'), path.join(STAGE, 'shared', 'sshconfig.js'));
  copy(path.join(ROOT, 'shared', 'updates.js'), path.join(STAGE, 'shared', 'updates.js'));
  copy(path.join(ROOT, 'shared', 'about.js'), path.join(STAGE, 'shared', 'about.js'));
  copy(path.join(ROOT, 'shared', 'framegen.js'), path.join(STAGE, 'shared', 'framegen.js')); // Monitor 2
  copy(path.join(ROOT, 'windows-helper', 'bin', 'macshare-winhelper.exe'),
    path.join(STAGE, 'windows-helper', 'bin', 'macshare-winhelper.exe'));
  for (const f of ['LICENSE', 'THIRD_PARTY_NOTICES', 'README.md']) {
    if (fs.existsSync(path.join(ROOT, f))) copy(path.join(ROOT, f), path.join(STAGE, f));
  }
  copyDeps(Object.keys(pkg.dependencies || {}));
  fs.writeFileSync(path.join(STAGE, 'package.json'), JSON.stringify({
    name: pkg.name, productName: pkg.productName, version: pkg.version, description: pkg.description,
    license: pkg.license, author: 'inukaasith', main: 'windows/main.js', dependencies: pkg.dependencies,
  }, null, 2));

  console.log('Packaging…');
  await builder.build({
    targets: builder.Platform.WINDOWS.createTarget('nsis', builder.Arch.x64),
    projectDir: WIN,
    config: {
      appId: 'org.macshare.windows',
      productName: 'TwinDesk',
      copyright: 'Copyright (C) 2026 inukaasith',
      electronVersion,
      directories: { app: STAGE, output: path.join(WIN, 'dist') },
      asar: false,
      npmRebuild: false,
      win: { icon: path.join(__dirname, 'icon.ico'), executableName: 'TwinDesk' },
      nsis: {
        oneClick: false,
        perMachine: true,
        allowElevation: true,
        allowToChangeInstallationDirectory: true,
        installerIcon: path.join(__dirname, 'icon.ico'),
        uninstallerIcon: path.join(__dirname, 'icon.ico'),
        license: path.join(ROOT, 'LICENSE'),
        include: path.join(__dirname, 'installer.nsh'),
        shortcutName: 'TwinDesk',
        createDesktopShortcut: true,
        createStartMenuShortcut: true,
        runAfterFinish: true,
        artifactName: 'TwinDesk-Setup-${version}.exe',
      },
    },
  });
  console.log('Done: ' + path.join(WIN, 'dist', 'TwinDesk-Setup-' + pkg.version + '.exe'));
}

main().catch((e) => { console.error(e); process.exit(1); });
