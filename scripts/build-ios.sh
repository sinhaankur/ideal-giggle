#!/usr/bin/env bash
# Build a sideloadable iOS app that wraps the EMPATHEIA static export inside
# a Capacitor (WKWebView) shell. Produces an Xcode project; the actual .ipa
# requires Xcode + an Apple ID for signing (free Apple ID gives 7-day
# sideload, paid Developer account gives stable signing).
#
# Output:
#   mobile/ios/App/                 <- generated Xcode workspace
#   mobile/ios/App/App.xcworkspace  <- open this in Xcode to build .ipa
#
# Prerequisites:
#   - macOS with Xcode 15+ and CocoaPods installed
#   - Node 20+
#   - Apple ID configured in Xcode (Xcode -> Settings -> Accounts)
#
# Usage:
#   ./scripts/build-ios.sh
#
# After this script:
#   1. Open mobile/ios/App/App.xcworkspace in Xcode.
#   2. Select your team under Signing & Capabilities.
#   3. Connect your iPhone via USB and pick it as the destination.
#   4. Press Cmd+R (run) — the app installs and launches on your device.
#   5. To export an .ipa for AltStore / Sideloadly: Product -> Archive ->
#      Distribute App -> Development -> Export.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
IOS_DIR="$ROOT_DIR/mobile/ios"
EXPORT_DIR="$ROOT_DIR/out"
TEMPLATE="$IOS_DIR/capacitor.config.template.json"
TARGET_CONFIG="$IOS_DIR/capacitor.config.json"

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "iOS builds require macOS with Xcode. Detected $(uname -s)." >&2
  exit 1
fi

if ! command -v xcodebuild >/dev/null 2>&1; then
  echo "Xcode is required (xcodebuild not on PATH). Install from the App Store." >&2
  exit 1
fi

if ! command -v pod >/dev/null 2>&1; then
  echo "CocoaPods is required: sudo gem install cocoapods" >&2
  exit 1
fi

# 1. Build the static export. Mirrors the GH Pages workflow: strip /api so
#    Next can emit a fully static bundle, since Capacitor cannot run server
#    routes (only the browser does the LLM work via WebLLM / Ollama).
echo "Building static export into $EXPORT_DIR..."
cd "$ROOT_DIR"

if [[ ! -d "node_modules" ]]; then
  echo "Installing dependencies first..."
  pnpm install
fi

# Snapshot the API routes if they exist, so a static export build can run
# without permanently deleting them. Restored at exit.
API_BACKUP=""
if [[ -d "app/api" ]]; then
  API_BACKUP="$(mktemp -d)"
  echo "Backing up app/api to $API_BACKUP..."
  cp -R app/api "$API_BACKUP/api"
  rm -rf app/api
  trap 'echo "Restoring app/api..."; rm -rf app/api; cp -R "$API_BACKUP/api" app/api; rm -rf "$API_BACKUP"' EXIT
fi

NEXT_TELEMETRY_DISABLED=1 \
STATIC_EXPORT=true \
NEXT_PUBLIC_STATIC_EXPORT=true \
NEXT_PUBLIC_DEFAULT_PROVIDER=webllm \
pnpm build

if [[ ! -d "$EXPORT_DIR" ]]; then
  echo "Static export did not produce $EXPORT_DIR" >&2
  exit 1
fi

# 2. Materialize Capacitor config from template.
cp "$TEMPLATE" "$TARGET_CONFIG"
echo "Wrote $TARGET_CONFIG"

# 3. Capacitor: init + add iOS + sync. We pin versions so subsequent runs
#    are deterministic; updating Capacitor is intentional, not surprise.
cd "$IOS_DIR"

if [[ ! -f "package.json" ]]; then
  echo "Bootstrapping mobile/ios package..."
  cat > package.json <<'JSON'
{
  "name": "empatheia-ios-shell",
  "private": true,
  "version": "1.0.0",
  "dependencies": {
    "@capacitor/cli": "^6.1.2",
    "@capacitor/core": "^6.1.2",
    "@capacitor/ios": "^6.1.2"
  }
}
JSON
fi

npm install --silent

if [[ ! -d "App" ]]; then
  echo "Adding iOS platform (one-time scaffold)..."
  npx cap add ios
fi

echo "Syncing static export into iOS project..."
npx cap copy ios
npx cap sync ios

echo ""
echo "iOS scaffold ready."
echo "  Workspace: $IOS_DIR/App/App.xcworkspace"
echo ""
echo "Next steps in Xcode:"
echo "  1. open '$IOS_DIR/App/App.xcworkspace'"
echo "  2. Pick your Team under Signing & Capabilities (free Apple ID is enough for 7-day sideload)."
echo "  3. Plug in your iPhone, select it as the run destination, press Cmd+R."
echo "  4. To export an .ipa: Product -> Archive -> Distribute App -> Development -> Export."
echo "  5. Sideload via Xcode (direct), AltStore, or Sideloadly."
