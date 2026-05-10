#!/usr/bin/env bash
# Build a sideloadable Android APK + AAB that wraps the deployed EMPATHEIA
# PWA in a Trusted Web Activity (TWA) using Bubblewrap.
#
# Output:
#   mobile/android/app-release-signed.apk   <- adb install or sideload
#   mobile/android/app-release-bundle.aab   <- if you ever want Play Store
#
# Prerequisites (Bubblewrap will install Java + Android SDK on first run):
#   - Node 20+
#   - macOS, Linux, or Windows (bash via WSL/git-bash)
#   - Your PWA already deployed and reachable over HTTPS
#
# Usage:
#   PWA_HOST=yourname.github.io PWA_PATH=ideal-giggle ./scripts/build-android.sh
#
# After install on device, the app loads the deployed PWA in a Chrome shell.
# Digital Asset Links: for full TWA (no URL bar), publish a /.well-known/
# assetlinks.json on PWA_HOST that contains the SHA-256 of your signing key.
# Without that, the app still works but shows a brief Chrome address bar.

set -euo pipefail

PWA_HOST="${PWA_HOST:-}"
PWA_PATH="${PWA_PATH:-}"
PACKAGE_ID="${PACKAGE_ID:-app.empatheia.twa}"
APP_VERSION_NAME="${APP_VERSION_NAME:-1}"
APP_VERSION_CODE="${APP_VERSION_CODE:-1}"

if [[ -z "$PWA_HOST" ]]; then
  echo "PWA_HOST is required. Example: PWA_HOST=yourname.github.io" >&2
  exit 1
fi

if [[ -z "$PWA_PATH" ]]; then
  echo "PWA_PATH is required (without leading or trailing slash). Example: PWA_PATH=ideal-giggle" >&2
  exit 1
fi

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ANDROID_DIR="$ROOT_DIR/mobile/android"
TEMPLATE="$ANDROID_DIR/twa-manifest.template.json"
TARGET="$ANDROID_DIR/twa-manifest.json"

if [[ ! -f "$TEMPLATE" ]]; then
  echo "Template missing: $TEMPLATE" >&2
  exit 1
fi

# Materialize twa-manifest.json from the template by substituting placeholders.
# We avoid `sed -i` since macOS and GNU disagree on the inline-edit flag.
sed \
  -e "s|REPLACE_WITH_YOUR_PAGES_HOST|$PWA_HOST|g" \
  -e "s|REPLACE_WITH_BASE_PATH|$PWA_PATH|g" \
  -e "s|\"packageId\": \"app.empatheia.twa\"|\"packageId\": \"$PACKAGE_ID\"|g" \
  -e "s|\"appVersionName\": \"1\"|\"appVersionName\": \"$APP_VERSION_NAME\"|g" \
  -e "s|\"appVersionCode\": 1|\"appVersionCode\": $APP_VERSION_CODE|g" \
  "$TEMPLATE" > "$TARGET"

echo "Wrote $TARGET"
echo "PWA target: https://$PWA_HOST/$PWA_PATH/"

cd "$ANDROID_DIR"

# Bubblewrap downloads ~500MB of JDK + Android SDK on first run; this is
# normal and only happens once.
echo "Running bubblewrap update + build (first run installs JDK + SDK)..."
npx -y -p @bubblewrap/cli@latest bubblewrap update --skipVersionUpgrade
npx -y -p @bubblewrap/cli@latest bubblewrap build

echo ""
echo "Build complete."
echo "  Signed APK:    $ANDROID_DIR/app-release-signed.apk"
echo "  Signed bundle: $ANDROID_DIR/app-release-bundle.aab"
echo ""
echo "Sideload to a connected device:"
echo "  adb install -r '$ANDROID_DIR/app-release-signed.apk'"
echo ""
echo "For TWA without a URL bar, publish https://$PWA_HOST/.well-known/assetlinks.json"
echo "with the SHA-256 of the signing key Bubblewrap generated."
