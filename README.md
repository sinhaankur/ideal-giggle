# EMPATHEIA

An empathetic AI companion built with Next.js, React, and AI SDK.

## Core Features

- Camera-based facial expression detection (face-api.js)
- Mood-aware tone adaptation in responses
- Multiple providers: OpenAI, Anthropic, Google, OpenRouter (open-source hosted models), WebLLM (browser local), Ollama (local runtime)
- Hybrid intelligence fallback: if model runtime fails, empathy-map quadrants still update using sentiment + keyword heuristics

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

### Optional for local-only providers

- WebLLM: no API key needed, model downloads in browser on first use
- Ollama: install locally and run a model first

```bash
# install and run model on your machine (outside browser)
ollama run llama3.2
```

The browser cannot install Ollama binaries automatically due OS security boundaries. The app includes a direct download link to Ollama in settings.

3. Start the development server:

```bash
pnpm dev
```

4. Open:

```text
http://localhost:3000
```

## Local AI Provider Setup

Open settings in the app and choose provider:

- OpenRouter (hosted open-source models):
	- Set provider to OpenRouter
	- In local dev: add your OpenRouter API key in settings, or set `OPENROUTER_API_KEY` in `.env.local`
	- In production: set `OPENROUTER_API_KEY` on the server and avoid browser key entry
	- Pick a preset open-source model or paste a custom OpenRouter model id

- WebLLM:
	- Set provider to WebLLM
	- Optionally set WebLLM model id
	- First chat may take time while model downloads in browser

- Ollama:
	- Set provider to Ollama
	- Keep default base URL `http://127.0.0.1:11434` or change it
	- Set model id (for example `llama3.2`)
	- Ensure Ollama daemon/model is running locally

## Fastest User Onboarding (Recommended)

Use Settings -> Quick Start Presets:

- Fast & Local: zero API setup, stable first-run experience.
- Balanced Cloud: recommended for most users, smoother quality with low latency.
- Deep Empathy: stronger reflective depth for longer conversations.

For least user friction in production:

1. Keep default provider as WebLLM.
2. Set `OPENROUTER_API_KEY` on the server for automatic cloud path when needed.
3. Let users switch presets instead of manual provider/model tuning.

## Setup Checklist Panel

The left panel now includes a Setup Checklist section.

- Verifies camera API support
- Shows selected provider status
- For WebLLM: checks WebGPU availability
- For Ollama: click Verify Ollama to test endpoint and model availability

## WebLLM WebGPU Setup

WebLLM runs in-browser and needs WebGPU to use your local GPU for fast inference.

1. Enable WebGPU and acceleration:
	- Chrome/Edge: open `chrome://settings/system` and enable graphics acceleration.
	- Chrome/Edge flags: enable `chrome://flags/#enable-unsafe-webgpu`.
	- Linux/Windows: also enable `chrome://flags/#enable-vulkan`.
	- Firefox: use a recent version and set `dom.webgpu.enabled=true` in `about:config`.

2. Verify hardware support:
	- Check `webgpureport.org` to confirm browser GPU detection.
	- Update GPU drivers (NVIDIA/AMD/Intel) if WebGPU is unavailable.

3. Understand first-run behavior:
	- Model shards are downloaded and cached in browser storage.
	- WebAssembly runs model runtime logic.
	- WebGPU performs matrix math on GPU for usable speed.

4. Fix slow/crashy sessions:
	- Use smaller models (1B/2B) for lower VRAM use.
	- Close heavy tabs/applications to free GPU memory.
	- 3B class models often need around 4GB of available VRAM.
	- Keep laptop plugged in and avoid thermal throttling.
	- Prefer secure contexts (`https://` or `localhost`) instead of plain local-network `http://192.168...` URLs.
	- Re-check `chrome://flags/#enable-unsafe-webgpu` after browser updates because it can reset.
	- For production deployments, apply for a Google WebGPU Origin Trial token so WebGPU remains available outside localhost.

If browser WebGPU remains unstable, switch provider to OpenRouter API or Ollama for more consistent runtime behavior.

## Recommended No-Install Websites

These websites run models directly in-browser and cache weights in IndexedDB:

- WebLLM Chat: https://chat.webllm.ai
- Hugging Face Chat: https://huggingface.co/chat
- WebLLM Agents Playground: https://huggingface.co/spaces/webllm/web-llm-agent

## Official WebLLM Model Repositories

WebLLM uses pre-compiled MLC model formats. Recommended stable repositories:

- Llama 3.2 3B (Instruct): https://huggingface.co/mlc-ai/Llama-3.2-3B-Instruct-q4f16_1-MLC
	- Best for deep conversational logic and shadow-work flows.
- Llama 3.2 1B (Instruct): https://huggingface.co/mlc-ai/Llama-3.2-1B-Instruct-q4f16_1-MLC
	- Best for lower-end hardware or faster onboarding interactions.
- Gemma 2 2B: https://huggingface.co/mlc-ai/gemma-2-2b-it-q4f16_1-MLC
	- Best for warm and creative persona responses.
- Mistral 7B v0.3: https://huggingface.co/mlc-ai/Mistral-7B-Instruct-v0.3-q4f16_1-MLC
	- Best for complex analysis and deeper empathy-code generation.

## Seamless Browser Requirements

| Requirement | How to Verify / Fix |
| --- | --- |
| WebGPU Support | Check `webgpureport.org`. If unsupported, enable browser acceleration and WebGPU flags. |
| Storage Space | Keep roughly 2GB to 5GB free for model downloads (3B class models are larger). |
| Persistence | Avoid Incognito/Private mode because cached model weights are removed when session ends. |

## Gemini Nano Note

Some Chrome Dev/Canary environments may expose built-in local LLM capabilities (Gemini Nano) via experimental browser APIs. This can reduce download time, but availability depends on browser channel, OS, and device support.

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

## GitHub Pages

This repository includes a workflow to deploy a static build to GitHub Pages.

The Pages build defaults provider to WebLLM so users can chat immediately in browser without server keys.

### What the workflow does

- Installs dependencies with pnpm
- Removes server API routes (`app/api`) because GitHub Pages is static-only
- Runs a static export build (`STATIC_EXPORT=true pnpm build`)
- Deploys the generated `out` folder to GitHub Pages

### Important Note

The chat endpoint (`/api/chat`) is server-side and will not run on GitHub Pages.

If you want chat to work on your GitHub Page, provide an external API URL as a repository variable or secret and map it to:

- `NEXT_PUBLIC_CHAT_API_URL`

The app already supports this environment variable and falls back to `/api/chat` for local development.

## Deploy Targets

- Local dev/full app: `pnpm dev`
- Server deployment/full app: run on a Node host (for example Azure App Service or your own server)
- GitHub Pages/static UI: workflow in `.github/workflows/deploy-pages.yml`

## License

This project is distributed under a custom proprietary license.
See the [LICENSE](LICENSE) file for full terms.
