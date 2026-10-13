#!/bin/sh
# TwinDesk — Copyright (C) 2026 inukaasith. GPL-3.0, see LICENSE.
# Creates dist/TwinDesk.dmg from dist/TwinDesk.app (npm run dmg).
set -e
cd "$(dirname "$0")"

APP="dist/TwinDesk.app"
DMG="dist/TwinDesk.dmg"
STAGE="dist/dmg-stage"
VOLNAME="TwinDesk"

if [ ! -d "$APP" ]; then
  echo "Error: $APP not found. Run ./build-app.sh first." >&2
  exit 1
fi

echo "Staging DMG contents..."
rm -rf "$STAGE" "$DMG"
mkdir -p "$STAGE"

# Copy application bundle
cp -R "$APP" "$STAGE/"

# Create symlink to /Applications for drag-and-drop installation
ln -s /Applications "$STAGE/Applications"

# Set volume icon if TwinDesk.icns exists
if [ -f "dist/TwinDesk.icns" ]; then
  cp "dist/TwinDesk.icns" "$STAGE/.VolumeIcon.icns"
  if command -v SetFile >/dev/null 2>&1; then
    SetFile -c icnC "$STAGE/.VolumeIcon.icns" 2>/dev/null || true
    SetFile -a C "$STAGE" 2>/dev/null || true
  fi
fi

echo "Creating disk image $DMG..."
hdiutil create -volname "$VOLNAME" -srcfolder "$STAGE" -ov -format UDZO "$DMG"

# Clean up staging directory
rm -rf "$STAGE"

echo "DMG created successfully: $DMG"
ls -lh "$DMG"

