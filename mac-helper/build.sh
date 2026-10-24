#!/bin/sh
# TwinDesk — Copyright (C) 2026 inukaasith. GPL-3.0, see LICENSE.
# Builds mac-helper with swiftc directly (SwiftPM's manifest API is broken in the installed
# Command Line Tools). Pass x64 or arm64 to cross-build; without an argument, use the host.
# Output: .build/release/macshare-helper, macshare-dockstub and macshare-calls
set -e
cd "$(dirname "$0")"
mkdir -p .build/release
ARCH=${1:-$(uname -m)}
case "$ARCH" in
  x64|x86_64) SWIFT_ARCH=x86_64 ;;
  arm64|aarch64) SWIFT_ARCH=arm64 ;;
  *) echo "Error: unsupported macOS architecture '$ARCH' (use x64 or arm64)." >&2; exit 2 ;;
esac
TARGET="$SWIFT_ARCH-apple-macos13.0"

swiftc -O -swift-version 5 -target "$TARGET" \
  -I Sources/VirtualDisplayBridge/include \
  -framework CoreGraphics -framework AppKit -framework ApplicationServices -framework IOKit -framework ScreenCaptureKit -framework CoreMedia -framework NetFS -framework CoreBluetooth -framework CoreWLAN -framework CoreLocation -lsqlite3 \
  Sources/macshare-helper/*.swift -o .build/release/macshare-helper
echo "built .build/release/macshare-helper"
# Multi-device's helper (docs/multi-device.md): the same sources with -D MULTI, several watched edges
# (the #if MULTI parts of Capture.swift and main.swift); only mac/mesh starts it.
swiftc -O -swift-version 5 -target "$TARGET" -D MULTI \
  -I Sources/VirtualDisplayBridge/include \
  -framework CoreGraphics -framework AppKit -framework ApplicationServices -framework IOKit -framework ScreenCaptureKit -framework CoreMedia -framework NetFS -framework CoreBluetooth -framework CoreWLAN -framework CoreLocation -lsqlite3 \
  Sources/macshare-helper/*.swift -o .build/release/macshare-helper-multi
echo "built .build/release/macshare-helper-multi"
swiftc -O -swift-version 5 -target "$TARGET" -framework AppKit \
  Sources/macshare-dockstub/main.swift -o .build/release/macshare-dockstub
echo "built .build/release/macshare-dockstub"
# The calls' sound over Bluetooth (mac/callaudio.js), its own process: only it loads IOBluetooth.
swiftc -O -swift-version 5 -target "$TARGET" -framework IOBluetooth \
  Sources/macshare-calls/main.swift -o .build/release/macshare-calls
echo "built .build/release/macshare-calls"
# Share menu extension (packed into TwinDesk.app/Contents/PlugIns by mac/build-app.sh).
swiftc -O -swift-version 5 -target "$TARGET" -application-extension -parse-as-library \
  -module-name MacShareShare -framework AppKit -Xlinker -e -Xlinker _NSExtensionMain \
  Sources/macshare-share/ShareViewController.swift -o .build/release/macshare-share
echo "built .build/release/macshare-share"
