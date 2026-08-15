#!/usr/bin/env bash
set -euo pipefail

IPA="${1:-build/ScooterCast-unsigned.ipa}"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

unzip -q "$IPA" -d "$TMP"

APP="$(find "$TMP/Payload" -maxdepth 1 -name '*.app' | head -1)"
if [ -z "$APP" ]; then
  echo "ERROR: No .app inside Payload/"
  exit 1
fi

EXE=$(/usr/libexec/PlistBuddy -c "Print :CFBundleExecutable" "$APP/Info.plist")
if [ -z "$EXE" ]; then
  echo "ERROR: CFBundleExecutable missing"
  exit 1
fi

if [ ! -f "$APP/$EXE" ]; then
  echo "ERROR: $APP/$EXE does not exist"
  exit 1
fi

echo "IPA OK"
echo "App: $APP"
echo "Executable: $EXE"
ls -lh "$APP/$EXE"
