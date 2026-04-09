# EMPATHEIA Architecture Plan

## 0) Claude MCP Status On This PC
- Claude Code CLI is installed (`claude 2.1.97`).
- Project-scoped MCP config was added at [.mcp.json](.mcp.json) with a filesystem MCP server.
- Claude MCP architecture run is currently blocked by authentication on this machine (`Not logged in · Please run /login`).

### Command to run once logged in
```bash
claude -p --mcp-config .mcp.json --strict-mcp-config "You are a principal architect. Analyze this Next.js TypeScript app and produce a practical architecture plan to make the build reliable, scalable, and smart. Include: 1) current architecture snapshot, 2) top risks/anti-patterns, 3) target architecture (components, data flow, AI provider strategy, fallback strategy), 4) concrete refactor roadmap in 3 phases with file-level actions, 5) CI/CD and quality gates, 6) observability and runtime health checks, 7) performance and UX safeguards, 8) security checklist. Keep recommendations specific to this repository layout and dependencies. Output in Markdown with concise sections."
```

## 1) Current Architecture Snapshot
- UI runtime: Next.js App Router + React 19 + TypeScript.
- Main orchestration is centralized in [app/page.tsx](app/page.tsx) (state, prompts, provider routing, fallbacks, session depth, UX logic).
- Providers:
  - Remote: OpenAI / Anthropic / Google / OpenRouter via [app/api/chat/route.ts](app/api/chat/route.ts).
  - Local: WebLLM in browser, Ollama local runtime.
- Fallback chain:
  - Primary provider response.
  - MCP fallback via [app/api/mcp-fallback/route.ts](app/api/mcp-fallback/route.ts).
  - Local heuristic fallback in [app/page.tsx](app/page.tsx).
- UI modules:
  - Chat: [components/chat-panel.tsx](components/chat-panel.tsx)
  - Settings: [components/settings-panel.tsx](components/settings-panel.tsx)
  - Camera: [components/camera-panel.tsx](components/camera-panel.tsx)
  - Empathy map: [components/empathy-panel.tsx](components/empathy-panel.tsx)
- Shared model/types: [lib/companion-types.ts](lib/companion-types.ts).

## 2) Top Risks / Anti-Patterns
1. Build safety is weakened:
- [next.config.mjs](next.config.mjs) has `typescript.ignoreBuildErrors: true`.
- [package.json](package.json) maps `lint` to `next build` instead of real lint/type gates.

2. Large god-component risk:
- [app/page.tsx](app/page.tsx) mixes orchestration, prompting, provider/runtime adapters, fallback policy, and UI wiring.

3. Prompt duplication/drift:
- Similar tone and system-prompt rules exist in multiple places (page, API, MCP fallback calls), creating inconsistency risk.

4. Runtime observability is UI-only:
- Little structured server-side telemetry for provider errors, fallback activations, latency, and model reliability.

5. Config validation gaps:
- Environment/provider config lacks central runtime schema validation (keys, URLs, model IDs).

## 3) Target Architecture (Smart + Build-Reliable)
### Layers
1. Presentation layer (pure UI):
- Keep components in [components](components) mostly stateless.
- Move decision logic to hooks/services.

2. Conversation domain layer:
- Create `lib/conversation/` for:
  - depth progression policy
  - fallback policy
  - prompt composition
  - tone mode strategy

3. Provider adapter layer:
- Create `lib/providers/` for normalized provider contracts:
  - `chat(input, context, settings) -> { text, meta, mode }`
- Adapters:
  - remote provider adapter
  - webllm adapter
  - mcp adapter
  - local heuristic adapter

4. Observability layer:
- Create `lib/telemetry/` for structured event emitters.
- Track event categories: provider_latency, provider_error, fallback_mode, webgpu_diagnostic, audio_state.

### Data Flow
1. UI sends user message -> conversation orchestrator.
2. Orchestrator asks provider strategy for best route.
3. Provider strategy executes chain:
- selected provider -> MCP fallback (if enabled) -> local fallback.
4. Response normalized and returned to UI with `mode` and metadata.
5. Telemetry events emitted per hop.

### AI/Fallback Strategy
- Default route matrix:
  - WebLLM ready: WebLLM first.
  - WebLLM unavailable: configured remote provider.
  - Remote fail and MCP enabled: MCP fallback.
  - Any fail: local fallback.
- Add circuit-breaker counters:
  - short-term provider failure threshold -> temporary provider backoff.

## 4) Refactor Roadmap (3 Phases)
### Phase 1: Build Hardening (Immediate)
1. In [next.config.mjs](next.config.mjs):
- remove `ignoreBuildErrors: true`.

2. In [package.json](package.json):
- add real scripts:
  - `lint`: `next lint`
  - `typecheck`: `tsc --noEmit`
  - `check`: `pnpm lint && pnpm typecheck && pnpm build`

3. Add CI workflow in [.github/workflows/ci.yml](.github/workflows/ci.yml):
- run `pnpm install --frozen-lockfile`
- run `pnpm check`

### Phase 2: Domain Separation (Stability)
1. Extract from [app/page.tsx](app/page.tsx):
- `buildSystemPrompt`, tone policy, depth question selection -> `lib/conversation/prompting.ts`
- fallback decision flow -> `lib/conversation/fallback-policy.ts`
- provider execution -> `lib/providers/index.ts`

2. Keep [app/page.tsx](app/page.tsx) as composition root only.

3. Add unit tests for extracted logic:
- `lib/conversation/*.test.ts`.

### Phase 3: Smart Runtime + Reliability
1. Add server/client telemetry hooks:
- API route logging for provider choice, latency, failures.
- UI health panel sourced from structured counters, not only ad-hoc strings.

2. Add resilience policies:
- Provider backoff + retry caps.
- Per-provider timeout defaults.
- Guardrails for repetitive responses.

3. Add E2E tests (Playwright):
- onboarding flow
- provider switch
- WebLLM fail -> fallback chain
- audio mute panic behavior

## 5) CI/CD and Quality Gates
- Required PR checks:
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm build`
  - unit tests
- Optional nightly:
  - Playwright smoke E2E.
- Deployment split:
  - static export for Pages remains UI-only.
  - full server deployment for API-backed providers.

## 6) Observability and Runtime Health
Track at minimum:
- Provider selected, route latency, error count.
- Fallback activations by mode (`fallback`, `mcp-fallback`).
- WebLLM init failures and GPU diagnostic reasons.
- Audio state transitions (speaking, stopped, emergency mute).

Expose via:
- lightweight in-app diagnostics panel and structured console logs.
- optional POST to a log endpoint in production.

## 7) Performance and UX Safeguards
- Keep context window bounded (`settings.contextMessages`) and enforce max length server-side.
- Use deterministic anti-repeat response strategy in fallback mode.
- Preserve fast startup by lazy-loading heavy runtime paths (WebLLM init only when needed).
- Keep emergency mute and ESC panic mute as mandatory UX safety features.

## 8) Security Checklist
- Never leak API keys to client logs.
- Validate all provider inputs (base URLs, model IDs, token bounds).
- Apply request timeout and output token limits on all providers.
- Sanitize and cap user payload length before prompt construction.
- Restrict MCP endpoint defaults to local/private addresses unless explicitly allowed.

## 9) Definition of Done (for “build is good and smart”)
- TypeScript errors fail CI.
- Lint errors fail CI.
- Build passes on clean runner.
- Fallback chain validated by tests.
- Prompting/tone behavior centralized (single source of truth).
- Runtime metrics visible for provider/fallback reliability.
