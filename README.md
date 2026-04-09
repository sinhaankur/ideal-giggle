# EMPATHEIA

An empathetic AI companion built with Next.js, React, and Vercel AI SDK.

## Core Features

- Camera-based facial expression detection (face-api.js)
- Mood-aware tone adaptation in responses
- Multiple providers: OpenAI, Anthropic, Google, WebLLM (browser local), Ollama (local runtime)

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
```

You can provide one or more keys depending on which provider you want to use.

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

- WebLLM:
	- Set provider to WebLLM
	- Optionally set WebLLM model id
	- First chat may take time while model downloads in browser

- Ollama:
	- Set provider to Ollama
	- Keep default base URL `http://127.0.0.1:11434` or change it
	- Set model id (for example `llama3.2`)
	- Ensure Ollama daemon/model is running locally

## Setup Checklist Panel

The left panel now includes a Setup Checklist section.

- Verifies camera API support
- Shows selected provider status
- For WebLLM: checks WebGPU availability
- For Ollama: click Verify Ollama to test endpoint and model availability

## Camera Mood Analysis

- Start camera from the left panel
- The app detects dominant facial expression and maps it to mood (happy, sad, angry, fear, surprise, neutral)
- Text emotion and camera emotion are combined; that mood is sent to the model so responses adapt accordingly

## Build

```bash
pnpm build
pnpm start
```

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
- Server deployment/full app: run on a Node host (for example Vercel, Azure App Service, or your own server)
- GitHub Pages/static UI: workflow in `.github/workflows/deploy-pages.yml`
