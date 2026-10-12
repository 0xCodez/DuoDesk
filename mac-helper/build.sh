#!/bin/sh
# MacShare — Copyright (C) 2026 MacShare contributors. GPL-3.0, see LICENSE.
# Builds mac-helper with swiftc directly (SwiftPM's manifest API is broken in the installed
# Command Line Tools). Output: .build/release/macshare-helper and macshare-dockstub (phase 13)
set -e
cd "$(dirname "$0")"
mkdir -p .build/release
swiftc -O -swift-version 5 -target "$(uname -m)-apple-macos13.0" \
  -I Sources/VirtualDisplayBridge/include \
  -framework CoreGraphics -framework AppKit -framework ApplicationServices -framework IOKit -framework ScreenCaptureKit -framework CoreMedia -framework NetFS \
  Sources/macshare-helper/*.swift -o .build/release/macshare-helper
echo "built .build/release/macshare-helper"
swiftc -O -swift-version 5 -target "$(uname -m)-apple-macos13.0" -framework AppKit \
  Sources/macshare-dockstub/main.swift -o .build/release/macshare-dockstub
echo "built .build/release/macshare-dockstub"
