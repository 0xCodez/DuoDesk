#!/bin/sh
# MacShare — Copyright (C) 2026 MacShare contributors. GPL-3.0, see LICENSE.
# Builds dist/MacShare.app (npm run dist). The app code keeps its dev layout inside
# Contents/Resources/app (mac/, shared/, mac-helper/.build/release/) so every `../` path still works;
# no asar, because mac-helper and scripts/*.sh are run straight from there.
set -e
unset ELECTRON_RUN_AS_NODE
cd "$(dirname "$0")"
ROOT=..
STAGE=dist/stage
ARCH=$(uname -m)
[ "$ARCH" = x86_64 ] && ARCH=x64
EV=$(node -p "require('./node_modules/electron/package.json').version")

../mac-helper/build.sh

rm -rf "$STAGE" && mkdir -p "$STAGE/mac" "$STAGE/shared" "$STAGE/mac-helper/.build/release" "$STAGE/node_modules"
rsync -a --exclude node_modules --exclude dist --exclude dev --exclude build-app.sh ./ "$STAGE/mac/"
cp "$ROOT"/shared/*.js "$STAGE/shared/"
cp "$ROOT"/mac-helper/.build/release/macshare-helper "$ROOT"/mac-helper/.build/release/macshare-dockstub "$STAGE/mac-helper/.build/release/"
cp -R node_modules/ws "$STAGE/node_modules/"
mkdir -p "$STAGE/mac/node_modules" && cp -R node_modules/ws "$STAGE/mac/node_modules/"
cp "$ROOT/LICENSE" "$STAGE/"
[ -f "$ROOT/THIRD_PARTY_NOTICES.md" ] && cp "$ROOT/THIRD_PARTY_NOTICES.md" "$STAGE/" || [ -f "$ROOT/md/THIRD_PARTY_NOTICES.md" ] && cp "$ROOT/md/THIRD_PARTY_NOTICES.md" "$STAGE/" || true
node -e "
const p = require('./package.json');
require('fs').writeFileSync('$STAGE/package.json', JSON.stringify({
  name: p.name, productName: p.productName, version: p.version, description: p.description,
  license: p.license, main: 'mac/main.js', dependencies: p.dependencies,
}, null, 2));"

# App icon: the sidebar's app mark (control.css .app-mark), rendered by Electron.
ICONSET=dist/MacShare.iconset
rm -rf "$ICONSET" && mkdir -p "$ICONSET"
./node_modules/.bin/electron dev/icon/main.js "$ICONSET/icon_512x512@2x.png" >/dev/null 2>&1
for s in 16 32 128 256 512; do
  sips -z $s $s "$ICONSET/icon_512x512@2x.png" --out "$ICONSET/icon_${s}x${s}.png" >/dev/null
  d=$((s * 2)); [ $s = 512 ] || sips -z $d $d "$ICONSET/icon_512x512@2x.png" --out "$ICONSET/icon_${s}x${s}@2x.png" >/dev/null
done
iconutil -c icns "$ICONSET" -o dist/MacShare.icns

cat > dist/extra.plist <<'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>NSLocalNetworkUsageDescription</key><string>MacShare finds and connects to your PC on the local network.</string>
  <key>NSMicrophoneUsageDescription</key><string>MacShare sends sound between your Mac and your PC.</string>
  <key>NSAudioCaptureUsageDescription</key><string>MacShare sends your Mac's sound to your PC.</string>
  <key>NSCameraUsageDescription</key><string>MacShare does not use the camera.</string>
  <key>CFBundleURLTypes</key><array><dict><key>CFBundleURLName</key><string>MacShare</string><key>CFBundleURLSchemes</key><array><string>macshare</string></array></dict></array>
  <key>LSApplicationCategoryType</key><string>public.app-category.utilities</string>
  <key>NSHumanReadableCopyright</key><string>Copyright (C) 2026 MacShare contributors. GPL-3.0.</string>
</dict></plist>
EOF

./node_modules/.bin/electron-packager "$STAGE" MacShare \
  --platform=darwin --arch="$ARCH" --electron-version="$EV" \
  --app-bundle-id=org.macshare.mac --app-version="$(node -p "require('./package.json').version")" \
  --icon=dist/MacShare.icns --extend-info=dist/extra.plist \
  --no-prune --asar=false --out=dist --overwrite --quiet

APP="dist/MacShare-darwin-$ARCH/MacShare.app"
rm -rf dist/MacShare.app && mv "$APP" dist/ && rm -rf "dist/MacShare-darwin-$ARCH" "$STAGE" "$ICONSET" dist/extra.plist
# Revision 7: the Share menu extension (mac-helper/Sources/macshare-share), sandboxed as macOS requires.
APPEX=dist/MacShare.app/Contents/PlugIns/MacShareShare.appex
VER="$(node -p "require('./package.json').version")"
mkdir -p "$APPEX/Contents/MacOS"
cp "$ROOT/mac-helper/.build/release/macshare-share" "$APPEX/Contents/MacOS/MacShareShare"
cat > "$APPEX/Contents/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>CFBundleIdentifier</key><string>org.macshare.mac.share</string>
  <key>CFBundleName</key><string>MacShare</string>
  <key>CFBundleDisplayName</key><string>MacShare</string>
  <key>CFBundleExecutable</key><string>MacShareShare</string>
  <key>CFBundlePackageType</key><string>XPC!</string>
  <key>CFBundleShortVersionString</key><string>$VER</string>
  <key>CFBundleVersion</key><string>$VER</string>
  <key>CFBundleInfoDictionaryVersion</key><string>6.0</string>
  <key>LSMinimumSystemVersion</key><string>13.0</string>
  <key>NSExtension</key><dict>
    <key>NSExtensionPointIdentifier</key><string>com.apple.share-services</string>
    <key>NSExtensionPrincipalClass</key><string>ShareViewController</string>
    <key>NSExtensionAttributes</key><dict>
      <key>NSExtensionActivationRule</key><dict>
        <key>NSExtensionActivationSupportsFileWithMaxCount</key><integer>1000</integer>
      </dict>
    </dict>
  </dict>
</dict></plist>
PLIST
cat > dist/share.entitlements <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>com.apple.security.app-sandbox</key><true/>
  <key>com.apple.security.files.user-selected.read-only</key><true/>
</dict></plist>
PLIST

# Ad-hoc signature over the whole bundle (helpers first), so the edited Info.plist is sealed.
for b in dist/MacShare.app/Contents/Resources/app/mac-helper/.build/release/*; do codesign --force --sign - "$b"; done
codesign --force --deep --sign - dist/MacShare.app
codesign --force --sign - --entitlements dist/share.entitlements "$APPEX" # --deep dropped its sandbox
codesign --force --sign - dist/MacShare.app && rm -f dist/share.entitlements
echo "built mac/dist/MacShare.app"
