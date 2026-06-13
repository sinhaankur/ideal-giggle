# EMPATHEIA

An empathetic AI companion built with Next.js, React, and AI SDK. Runs fully offline once installed — local face detection, in-browser LLM, and an installable PWA on any OS.

## Core Features

- Camera-based facial expression detection (face-api.js, weights bundled locally)
- Mood-aware tone adaptation in responses
- Two clean provider paths: **Ollama** (a PC LLM running locally on your machine) or a **cloud API** (OpenAI, Anthropic, Google, OpenRouter)
- Hybrid intelligence fallback: if model runtime fails, empathy-map quadrants still update using sentiment + keyword heuristics
- Offline mode: Service Worker caches the app shell + face-detection weights; chat continues via Ollama called directly from the browser, or via the deterministic empathy fallback engine if no LLM is reachable
- Installable PWA on macOS, Windows, Linux, iOS, and Android

## Empathy Engine Docs

- Full conceptual model and tree of understanding: [docs/empathy-engine.md](docs/empathy-engine.md)

## Run Locally

1. Install dependencies:

```bash
pnpm install
```

2. Configure environment variables in `.env.local`:

```bash
OPENAI_API_KEY=your_openai_key
ANTHROPIC_API_KEY=your_anthropic_key
GOOGLE_GENERATIVE_AI_API_KEY=your_google_key
OPENROUTER_API_KEY=your_openrouter_key
```

You can also copy `.env.example` to `.env.local` and only fill the keys you need.

You can provide one or more keys depending on which provider you want to use.

### API Rate Limiting (Middleware)

The app now includes middleware-level per-IP throttling for all `POST /api/*` calls, with tighter defaults for chat endpoints.

Environment knobs (optional):

```bash
API_RATE_LIMIT_WINDOW_MS=60000
API_RATE_LIMIT_MAX=90
API_RATE_LIMIT_CHAT_MAX=60
API_RATE_LIMIT_FALLBACK_MAX=40
# Optional distributed limiter backend (multi-instance safe)
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```

Notes:

- Middleware throttling runs before route logic.
- Route-level guards still exist as a second layer.
- If `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are set, middleware uses a distributed sliding-window limiter via Upstash.
- Without Upstash env vars, middleware falls back to in-memory limits (good for single-instance deployments).

Diagnostics endpoint:

- `GET /api/limiter-status` returns active limiter mode and route thresholds.
- If `LIMITER_STATUS_TOKEN` is set, include request header `x-admin-token: <LIMITER_STATUS_TOKEN>`.

### Optional for the local-only provider (Ollama)

```bash
# install Ollama from https://ollama.com (macOS / Linux / Windows)
ollama run llama3.2
```

The browser cannot install Ollama binaries automatically — install it once and the app probes `http://127.0.0.1:11434` on startup.

3. Start the development server:

```bash
pnpm dev
```

4. Open:

```text
http://localhost:3000
```

## Provider Setup — PC LLM or API

There are exactly two paths:

### 1. PC LLM — Ollama (recommended)

Runs the model on your own machine. Free, private, fully offline once installed.

```bash
# install Ollama (macOS / Linux / Windows): https://ollama.com
brew install ollama          # macOS
# or: curl -fsSL https://ollama.com/install.sh | sh   (Linux)

ollama pull llama3.2
OLLAMA_ORIGINS="http://localhost:3000,https://yourname.github.io" ollama serve
```

Open EMPATHEIA. The app probes `http://127.0.0.1:11434` on startup and auto-switches to Ollama when reachable. From then on every conversation runs locally — nothing leaves your machine.

### 2. API — OpenRouter / OpenAI / Anthropic / Google

For users who can't or don't want to run a local LLM. OpenRouter has a free tier with open-source models (qwen, llama, mistral, gemma, deepseek).

- **Local dev:** add the API key in Settings, or set `OPENROUTER_API_KEY` / `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` / `GOOGLE_GENERATIVE_AI_API_KEY` in `.env.local`.
- **Production:** set the key on the server. The chat endpoint reads it from the env so keys never reach the browser.

### Quick Start Presets

Open Settings → Quick Start Presets:

- **Local LLM (Ollama)** — recommended. Auto-detects Ollama on your machine. Zero API setup.
- **Balanced Cloud** — OpenRouter free tier (`openai/gpt-oss-20b:free`). Smooth quality with low latency.
- **Deep Empathy** — `meta-llama/llama-3.3-70b-instruct:free`. Stronger reflective depth for longer conversations.

## Setup Checklist Panel

The left panel includes a Setup Checklist section.

- Verifies camera API support
- Shows the selected provider status
- For Ollama: click **Verify Ollama** to test the endpoint and model availability

## Recommended Ollama Models

A short list of models that work well with the empathy stack:

- `empathia-tiny` (lightweight) — ~600–700MB, empathy-tuned TinyLlama-1.1B preset; built locally from a Modelfile (see below)
- `llama3.2` (default) — 2GB, strong instruction-following and emotional nuance
- `llama3.2:1b` — 1.3GB, faster on lower-end CPUs
- `gemma2:2b` — 1.6GB, warmer / more creative tone
- `mistral:7b-instruct` — 4.4GB, deeper analytical conversations

Pull whichever you want:

```bash
ollama pull llama3.2
```

Then set the model id in Settings → Ollama, or stick with `llama3.2` (the default).
You can also pick **Lite Empathy (TinyLlama)** from the Quick Start presets.

### Lite Empathy preset (TinyLlama)

`empathia-tiny` is a small, fast, empathy-focused model — a fluency upgrade over
the deterministic engine without the footprint of a full local model. It is
built locally from [scripts/empathia-tiny.Modelfile](scripts/empathia-tiny.Modelfile),
whose system prompt mirrors the Runtime Interpretation Rules in
[docs/empathy-engine.md](docs/empathy-engine.md):

```bash
ollama create empathia-tiny -f scripts/empathia-tiny.Modelfile
```

In Docker/compose, set `OLLAMA_MODEL=empathia-tiny` and startup builds it for you.
See [docs/tiny-empathy-model.md](docs/tiny-empathy-model.md) for the full design.

## Camera Mood Analysis

- Start camera from the left panel
- The app detects dominant facial expression and maps it to mood (happy, sad, angry, fear, surprise, neutral)
- Text emotion and camera emotion are combined; that mood is sent to the model so responses adapt accordingly

## Build

```bash
pnpm build
pnpm start
```

## End-to-End Testing

Run Playwright setup once:

```bash
pnpm exec playwright install chromium
```

Run the fallback-status regression flow:

```bash
pnpm playwright test tests/e2e/chat-fallback-status.spec.ts --project=chromium
```

Or run all E2E tests:

```bash
pnpm test:e2e
```

## Docker

This repo includes container support for EMpathia with three modes:

- App only: connect to an existing/local Ollama or cloud provider.
- App + Ollama: run Ollama in Docker and auto-pull/update a model (for example `llama3.2`).
- All-in-one image: Ollama is preinstalled inside the EMpathia container.

### One-command launcher (recommended)

Use the auto launcher to start the right mode with zero compose flags:

```bash
./scripts/launch-empathia.sh
```

Auto behavior:

- If host Ollama is reachable, it starts `empathia` (host mode).
- If host Ollama is not reachable, it starts `allinone` mode automatically.

Optional mode override:

```bash
EMPATHIA_MODE=host ./scripts/launch-empathia.sh
EMPATHIA_MODE=allinone ./scripts/launch-empathia.sh
EMPATHIA_MODE=sidecar ./scripts/launch-empathia.sh
```

Optional host endpoint override:

```bash
EMPATHIA_HOST_OLLAMA_URL=http://host.docker.internal:11434 ./scripts/launch-empathia.sh
```

### 1) Build and run app only

```bash
docker compose up --build empathia
```

Open `http://localhost:3000`.

In this mode, EMpathia connects to host Ollama by default using:

- `http://host.docker.internal:11434` (Docker Desktop on macOS/Windows)
- Linux users are covered via `extra_hosts: host.docker.internal:host-gateway` in compose

If you want a custom host endpoint, set:

```bash
OLLAMA_BASE_URL=http://host.docker.internal:11434
NEXT_PUBLIC_OLLAMA_BASE_URL=http://host.docker.internal:11434
```

### 2) Run app with bundled Ollama and model preinstall/update

```bash
OLLAMA_MODEL=llama3.2 \
OLLAMA_BASE_URL=http://ollama:11434 \
NEXT_PUBLIC_OLLAMA_BASE_URL=http://ollama:11434 \
docker compose --profile ollama up --build
```

What happens:

- `ollama` service starts the runtime on port `11434`.
- `ollama-init` waits for Ollama, then runs `ollama pull $OLLAMA_MODEL`.
- `empathia` uses `http://ollama:11434` internally by default in compose.

This gives you repeatable local LLM startup and easy model updates by changing `OLLAMA_MODEL`.

### 3) One-container mode with preinstalled Ollama (product-like)

```bash
OLLAMA_MODEL=llama3.2 OLLAMA_AUTO_PULL=true docker compose --profile allinone up --build
```

What happens:

- The Docker image installs Ollama during build.
- Container startup launches Ollama and EMpathia together.
- If `OLLAMA_AUTO_PULL=true`, startup runs `ollama pull $OLLAMA_MODEL` so model updates feel like software updates.
- Models persist in a Docker volume (`ollama-data-allinone`) so users do not re-download every run.

Set `OLLAMA_AUTO_PULL=false` if you want faster startup without update checks.

Compatibility note:

- Docker images are multi-architecture and should run on both `amd64` and `arm64` hosts.
- GPU acceleration availability depends on host drivers/runtime; CPU mode still works.

## Offline Mode

Once you've loaded the app at least once, EMPATHEIA continues to work without an internet connection. The pieces that make this real:

- **Service Worker** ([public/sw.js](public/sw.js)) pre-caches the app shell, JS/CSS bundles, and face-detection weights on install.
- **Face detection** loads from [public/face-models/](public/face-models/) (~860KB total). No CDN dependency, no first-launch downloads.
- **Ollama (browser-direct)** — when the Next.js `/api/chat` proxy is unavailable (static export builds, or you're offline), the app calls `http://127.0.0.1:11434/v1/chat/completions` directly from the browser. Start Ollama with the appropriate origin:

  ```bash
  OLLAMA_ORIGINS="https://yourname.github.io,http://localhost:3000" ollama serve
  ```

  Use `OLLAMA_ORIGINS=*` for unrestricted local development.

- **Offline indicator** appears in the chat panel header when `navigator.onLine === false` and surfaces a one-click switch to Ollama if you were on a cloud provider.
- **Empathy fallback ladder**: when no LLM is reachable, the deterministic empathy engine (Plutchik-grounded emotion analysis + therapy-engine compose path) takes over so the conversation never hits a dead end, even with no network and no model.

## Download the Desktop App (Electron)

In addition to the PWA, EMPATHEIA ships a fully installable Electron desktop build for macOS, Windows, and Linux. The installer bundles the offline app shell (including the face-api weights) so the first launch works without a network round-trip.

| OS | Installer | Notes |
| --- | --- | --- |
| macOS (Intel + Apple Silicon) | `EMPATHEIA-<version>-mac-x64.dmg` / `-arm64.dmg` | Unsigned — on first launch, right-click → Open to bypass Gatekeeper, or run `xattr -dr com.apple.quarantine /Applications/EMPATHEIA.app` |
| Windows 10/11 (x64) | `EMPATHEIA-<version>-win-x64.exe` (NSIS installer) or the `portable.exe` | Unsigned — SmartScreen may prompt; click **More info → Run anyway** |
| Linux (x64) | `.AppImage` (no install) or `.deb` (`sudo apt install ./EMPATHEIA-*.deb`) | AppImage needs `chmod +x` once |

Grab the latest binaries from the [GitHub Releases page](https://github.com/h99311/ideal-giggle/releases/latest). Tag a new version locally to trigger the build:

```bash
git tag v0.1.0
git push origin v0.1.0
```

The [`release-electron.yml`](.github/workflows/release-electron.yml) workflow then runs the matrix on GitHub-hosted macOS / Windows / Linux runners and attaches the installers to the release.

### Build it yourself

```bash
pnpm install
pnpm build:electron              # static export tuned for file:// loading
pnpm electron:dist               # produces installers for the current OS
# or target a specific OS:
pnpm electron:dist:mac
pnpm electron:dist:win
pnpm electron:dist:linux
```

Run the desktop app in dev mode against the hot-reloading Next.js server:

```bash
pnpm dev              # terminal 1 — Next.js dev server on :3000
pnpm electron:dev     # terminal 2 — Electron window pointed at localhost
```

## Install as a Native App (PWA)

EMPATHEIA is also a Progressive Web App and installs on every major OS without an app store. Once installed, it launches in its own window with the app icon, runs offline, and is indistinguishable from a native app.

| OS | How to install |
| --- | --- |
| macOS (Chrome / Edge / Brave) | Open the site → click the install icon in the address bar → **Install** |
| macOS (Safari 17+) | File menu → **Add to Dock…** |
| Windows / Linux (Chrome / Edge) | Address bar install icon, or menu → **Install EMPATHEIA…** |
| Android (Chrome) | Menu → **Install app** (or auto "Add to Home screen" prompt) |
| iOS / iPadOS (Safari) | Share sheet → **Add to Home Screen** |

### Sideloadable .apk / .ipa builds (no App Store)

For exploration / private distribution there is also tooling to produce
real installable mobile files in [`mobile/`](mobile/README.md):

- **Android** — [`scripts/build-android.sh`](scripts/build-android.sh)
  uses Bubblewrap to wrap the deployed PWA in a Trusted Web Activity and
  produce a signed `.apk` you can `adb install`.
- **iOS** — [`scripts/build-ios.sh`](scripts/build-ios.sh) uses Capacitor
  to wrap the static export in a WKWebView shell and produce an Xcode
  project. Build to `.ipa` from Xcode and sideload via Xcode direct,
  AltStore, or Sideloadly. Requires macOS + an Apple ID (free for
  7-day signing, paid for stable signing).

See [mobile/README.md](mobile/README.md) for full step-by-step instructions, signing notes, and known limitations.

After install:

- App opens in a standalone window with the EMPATHEIA icon (see [public/icon.svg](public/icon.svg)).
- The Service Worker stays active across launches — no re-download of bundles or face-models on subsequent runs.
- Pick **Settings → Quick Start Presets → Local LLM (Ollama)** for a fully offline-capable runtime.

## GitHub Pages — Download & Usage

This repository deploys to GitHub Pages on every push to `main` via [.github/workflows/deploy-pages.yml](.github/workflows/deploy-pages.yml). The Pages build defaults to **Ollama** — visitors who have Ollama running locally get a real PC LLM immediately; visitors without Ollama get the deterministic empathy fallback engine until they either install Ollama or add a cloud API key in Settings.

### Use the hosted build

1. Open the deployed Pages URL on any modern browser.
2. Accept the user agreement.
3. If Ollama is running locally on `127.0.0.1:11434`, the app auto-detects it and switches over. Otherwise pick **Settings → API key** to use OpenRouter / OpenAI / Anthropic / Google, or install Ollama for a private PC LLM.
4. Click the install icon (see table above) to install as a desktop / mobile app.

### Run your own copy

```bash
git clone https://github.com/<your-fork>/ideal-giggle
cd ideal-giggle
pnpm install
pnpm dev   # http://localhost:3000
```

### What the Pages workflow does

- Installs dependencies with pnpm
- Removes server API routes (`app/api`) because GitHub Pages is static-only
- Runs a static export build (`STATIC_EXPORT=true pnpm build`)
- Deploys the generated `out` folder to GitHub Pages

### Provider behaviour on Pages (no server)

| Provider | Works on Pages? | How |
| --- | --- | --- |
| Ollama (PC LLM) | ✅ if running locally | the app calls `http://127.0.0.1:11434/v1` directly; set `OLLAMA_ORIGINS` to your Pages origin |
| OpenAI / Anthropic / Google / OpenRouter | ✅ if you provide a proxy | set `NEXT_PUBLIC_CHAT_API_URL` repo variable to a hosted Next.js or compatible chat API |
| No LLM at all | ✅ degraded | the deterministic empathy engine (Plutchik + therapy compose) still replies — meaningful and calibrated, just without a real model |

The app reads `NEXT_PUBLIC_CHAT_API_URL` and falls back to `/api/chat` for local development.

## Deploy Targets

- Local dev/full app: `pnpm dev`
- Server deployment/full app: run on a Node host (for example Azure App Service or your own server)
- GitHub Pages/static UI: workflow in `.github/workflows/deploy-pages.yml`

## License

This project is distributed under a custom proprietary license.
See the [LICENSE](LICENSE) file for full terms.
