# Mobile sideload builds — exploration only, no app store

EMPATHEIA is a PWA first. It already installs cleanly via "Add to Home
Screen" on iOS Safari and "Install app" on Android Chrome with no extra
tooling. This directory exists for the next layer: producing a real
**.apk** and **.ipa** that you can sideload onto a device for distribution
to a small group, demos, or experimentation — **without going through the
App Store / Play Store**.

The two paths are very different. Read both quickly before picking one.

| Platform | Wrapper | Output | Cost | Sideload mechanism |
| --- | --- | --- | --- | --- |
| Android | Bubblewrap (TWA) | `.apk` and `.aab` | Free | `adb install`, file transfer, or share via link |
| iOS | Capacitor (WKWebView) | Xcode project → `.ipa` | $0 with free Apple ID (7-day expiry) or $99/yr Developer | Xcode direct, AltStore, Sideloadly |

Neither approach needs you to rewrite the app. Both wrap the same code
that already runs on the web — same `face-api.js` weights from
`public/face-models/`, same WebLLM engine, same Mirror, same vault.

---

## Android — Bubblewrap (Trusted Web Activity)

**What it is**: Bubblewrap takes your deployed PWA URL and produces a
native Android shell that opens the PWA inside a Chrome Custom Tab. Users
see a normal Android app on their home screen with the EMPATHEIA icon. If
you publish a Digital Asset Links file, Chrome's URL bar disappears and
the app feels fully native.

**Constraints**:
- The PWA must be served over HTTPS (GitHub Pages already qualifies).
- The user's Android device must have Chrome installed (it ships preloaded
  on most devices; otherwise the TWA falls back to a Custom Tab with a
  thin URL bar).

### One-time setup

```bash
# Make sure your PWA is deployed and reachable. For this repo the GH Pages
# workflow already does this — push to main and wait for the workflow.

cd mobile/android
# Bubblewrap will install Java + Android SDK on first run (~500MB, one time).
```

### Build

```bash
PWA_HOST=yourname.github.io PWA_PATH=ideal-giggle ./scripts/build-android.sh
```

What the script does:
1. Materializes `mobile/android/twa-manifest.json` from the template, with
   your host and base path substituted in.
2. Runs `bubblewrap update` (pulls the latest TWA shell template).
3. Runs `bubblewrap build` (compiles to APK + AAB and signs with a
   keystore — the first run prompts you to create one).

Outputs:
- `mobile/android/app-release-signed.apk` — sideload to a device.
- `mobile/android/app-release-bundle.aab` — keep in case you ever do want
  Play Store later.
- `mobile/android/android.keystore` — **back this up**. Losing it means
  losing the ability to push updates that recognize as the same app.

### Install on a device

```bash
# USB cable + USB debugging enabled on the phone (Settings → Developer
# Options). Confirm the device shows up:
adb devices

# Install the signed APK:
adb install -r mobile/android/app-release-signed.apk
```

You can also email or AirDrop the `.apk` to the device, then tap to
install (the user has to enable "Install unknown apps" for the source
once).

### Optional: Digital Asset Links (removes Chrome URL bar)

After the first build, Bubblewrap prints the SHA-256 fingerprint of the
signing key. Publish this file at `https://yourname.github.io/.well-known/assetlinks.json`:

```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "app.empatheia.twa",
      "sha256_cert_fingerprints": ["YOUR_SHA_256_FINGERPRINT_HERE"]
    }
  }
]
```

Without this, the app still works but shows a thin Chrome address bar at
the top — fine for exploration, less polished for distribution.

### Updating

When you ship a new version of the PWA:
1. Bump `appVersionName` and `appVersionCode` in `mobile/android/twa-manifest.json`.
2. Re-run `./scripts/build-android.sh`.
3. Re-install. Because the TWA loads the live PWA, **most user-facing
   updates do not require a rebuild** — they just need a fresh PWA
   deploy. The APK only needs rebuilding when you change the wrapper
   itself (icons, manifest fields, package id).

---

## iOS — Capacitor (WKWebView)

**What it is**: Capacitor copies your static export (the `out/` folder
produced by `STATIC_EXPORT=true pnpm build`) into a native iOS shell
based on `WKWebView`. Apple does not allow remote-loaded web apps on the
App Store, but Capacitor's bundled approach is fine for sideload.

**Constraints**:
- macOS with **Xcode 15+** is required. There is no cross-platform path.
- An **Apple ID** in Xcode (free works for 7-day signing, paid works for
  stable signing).
- The app runs against the bundled static export — server routes
  (`/api/chat`) are not available. Use **WebLLM** or **Ollama-direct**
  via `OLLAMA_ORIGINS=*` (for users running Ollama on the same Wi-Fi).

### One-time setup

```bash
# Install CocoaPods if you don't have it
sudo gem install cocoapods

# Make sure Xcode is installed and you've opened it once to accept the
# license. Sign in with your Apple ID under Xcode → Settings → Accounts.
```

### Build

```bash
./scripts/build-ios.sh
```

What the script does:
1. Snapshots `app/api/` aside, builds `STATIC_EXPORT=true` (this is what
   the GH Pages workflow does), then restores the API routes so your
   server build is unaffected.
2. Materializes `mobile/ios/capacitor.config.json` from the template.
3. Bootstraps a small `mobile/ios/package.json` with pinned Capacitor
   versions, `npm install`s them.
4. Runs `npx cap add ios` (one-time scaffold) and `npx cap sync ios`
   (copies the static export into the iOS project).

Output:
- `mobile/ios/App/App.xcworkspace` — open this in Xcode.

### Sign and run on your device

1. Open the workspace: `open mobile/ios/App/App.xcworkspace`
2. In the project navigator, click **App** → **Signing & Capabilities**
   → pick your **Team** (your Apple ID).
3. Plug in your iPhone via USB, trust the Mac when prompted, select your
   iPhone as the run destination at the top of the window.
4. Press **Cmd+R**. Xcode builds, signs, and installs the app on your
   phone.

The first time you launch the app on the device, iOS will refuse to open
it. Open **Settings → General → VPN & Device Management → [Your Apple
ID] → Trust**. Then re-launch.

### Export an `.ipa` for AltStore / Sideloadly

If you want to share the app with someone else without their Mac:

1. **Product → Archive** in Xcode (this requires building for a real
   device, not Simulator).
2. In the Organizer that appears: **Distribute App → Development →
   Export**.
3. Pick a destination folder. Xcode writes `App.ipa` there.

To install the `.ipa` on someone else's iPhone without a Mac:
- **AltStore** ([altstore.io](https://altstore.io)) — free, requires
  AltServer running on a Mac/Windows on the same Wi-Fi at refresh time.
  7-day expiry with a free Apple ID; auto-refresh keeps it alive.
- **Sideloadly** ([sideloadly.io](https://sideloadly.io)) — free, runs on
  Mac and Windows. Same 7-day expiry on free Apple IDs.

With a paid Apple Developer account ($99/year), apps signed with a
distribution certificate stay valid for a year.

### Updating

iOS does not have the TWA-style "the app loads the live PWA" advantage.
Every update means re-running `./scripts/build-ios.sh` and re-installing.

---

## What lives where

```
mobile/
├── README.md                            ← you are here
├── android/
│   ├── twa-manifest.template.json       ← Bubblewrap source of truth
│   ├── twa-manifest.json                ← generated, gitignored
│   └── app-release-signed.apk           ← generated, gitignored
└── ios/
    ├── capacitor.config.template.json   ← Capacitor source of truth
    ├── capacitor.config.json            ← generated, gitignored
    ├── package.json                     ← generated on first iOS build, gitignored
    └── App/                             ← generated Xcode project, gitignored
```

The `*.template.json` files are versioned. Generated artifacts are
ignored via the repo's `.gitignore`.

## When to skip both of these

If you only need the app on **your own** iPhone or Android phone for your
own use, the PWA install path is faster and gives you 95% of the same
experience:

- iOS Safari → Share sheet → **Add to Home Screen**
- Android Chrome → menu → **Install app**

Both produce a home-screen icon, full-screen launch, offline cache, and
the same EMPATHEIA experience. The wrapper builds in this directory
exist for when you specifically need a real `.apk` / `.ipa` file to
hand to someone who isn't going to install via a browser.
