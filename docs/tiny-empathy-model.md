# Tiny Empathy Model — A Lightweight LLM Tier for Empatheia

> **Status:** Proposal / design doc. No app code changes yet.
> **Author intent:** add a small, fast, empathy-focused local LLM as a new rung
> in the provider ladder — heavier and more fluent than the deterministic engine,
> lighter and friendlier-to-install than a full Ollama model.

## 1. Why this exists

Empatheia's runtime currently degrades down a clear ladder
([docs/architecture-plan.md](architecture-plan.md) §3):

```
Ollama (PC LLM, 1.3–4 GB)  →  Cloud API  →  MCP fallback  →  Deterministic empathy engine
```

There is a **capability cliff** between the last two rungs:

| Tier | Fluency | Footprint | Install friction |
|---|---|---|---|
| Full Ollama (`llama3.2`, `mistral:7b`) | High | 1.3–4.4 GB | Must install Ollama + pull model |
| **— nothing here —** | | | |
| Deterministic engine (`lib/conversation/emotion-engine` + `therapy-engine`) | Template-grounded, no real generation | ~0 | None (always present) |

The deterministic engine is genuinely good — Plutchik-grounded emotion analysis
plus a therapy-compose path — but it **cannot generate novel language**. It
reflects and routes; it doesn't *talk*. When no big model is reachable, the
companion gets noticeably more rigid.

A **~1.1B parameter empathy model** fills that gap: small enough to feel like a
"software update," fluent enough to hold a warm, reflective conversation.

## 2. The idea: TinyLlama as an empathy-tuned tier

[TinyLlama-1.1B-Chat](https://huggingface.co/TinyLlama/TinyLlama-1.1B-Chat-v1.0)
is a strong fit because it:

- uses the **same modern architecture as production chat models** (RoPE,
  RMSNorm, SwiGLU, grouped-query attention) — so behavior generalizes;
- is **instruction-tuned**, so it follows the empathy system prompt in
  [lib/conversation/communication-engine.ts](../lib/conversation/communication-engine.ts);
- quantizes to **~600–700 MB (Q4)**, roughly half of `llama3.2:1b`;
- runs at usable speed on a mid-range CPU — no GPU required.

### Recommended placement (decided): a new preset on the existing Ollama path

Rather than a brand-new provider, ship TinyLlama as a **first-class Ollama
preset** tuned for empathy. This reuses all existing infrastructure
([lib/api/ollama-direct.ts](../lib/api/ollama-direct.ts), the Docker
auto-pull flow, offline browser-direct calls) with near-zero new surface area.

```
Ollama (full)  →  Ollama (TinyLlama empathy preset)  →  Cloud API  →  MCP  →  Deterministic engine
                  ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
                  new lightweight rung
```

Concretely:

1. Add a `tinyllama` Quick-Start preset in Settings
   (alongside the existing "Local LLM / Balanced Cloud / Deep Empathy" presets
   referenced in the README).
2. Ship a tuned **Modelfile** (system prompt + sampling params) so the raw
   TinyLlama weights behave like an empathy companion out of the box.
3. Default `OLLAMA_MODEL` stays `llama3.2`; TinyLlama is the *lighter* option
   surfaced to users on constrained machines.

### Example Ollama Modelfile (empathy preset)

```dockerfile
# empathia-tiny.Modelfile  —  ollama create empathia-tiny -f empathia-tiny.Modelfile
FROM tinyllama:1.1b-chat-v1.0-q4_K_M

# Warmer, less repetitive, short reflective turns
PARAMETER temperature 0.7
PARAMETER top_p 0.9
PARAMETER repeat_penalty 1.15
PARAMETER num_ctx 2048

SYSTEM """
You are Empatheia, a calm, empathetic companion. Follow these rules every turn:
- Start with accurate reflection tied to the user's own words.
- Name one emotional signal and one cognitive frame.
- Offer one small reframe that preserves the user's agency.
- Ask exactly one grounded follow-up question.
- Never diagnose, never give clinical claims, keep agency with the user.
- For crisis content, gently suggest professional or emergency help.
Keep replies short (2–5 sentences). Warmth over cleverness.
"""
```

This maps 1:1 to the **Runtime Interpretation Rules** in
[docs/empathy-engine.md](empathy-engine.md) §"Runtime Interpretation Rules", so
the small model and the deterministic engine speak with one voice.

## 2b. Zero-install option: run the tiny model *in the browser*

The Ollama preset (section 2) still asks the user to install Ollama once. For
users who want **nothing to install at all**, the same tiny models can run
**fully in the browser via WebGPU** — the model downloads once, is cached by the
Service Worker that already exists ([public/sw.js](../public/sw.js)), and every
subsequent launch is instant and offline.

This adds an even lighter rung *below* the Ollama tier:

```
Ollama (full)
  → Ollama (TinyLlama preset)
    → In-browser WebGPU (TinyLlama / NanoGPT)   ← new, zero-install, opt-in
      → Cloud API → MCP → Deterministic engine
```

### Two browser runtimes, two size/quality tiers

| Runtime | Models it fits | First-load download | Notes |
|---|---|---|---|
| **WebLLM (MLC)** | TinyLlama-1.1B-Chat (prebuilt) | ~600–700 MB | Best fluency; WebGPU only; cached after first load |
| **transformers.js (ONNX)** | NanoGPT / GPT-2 / distilGPT-2, small Llama | ~100–250 MB | Lighter + faster to load; rougher language; widest device support |

This gives a natural **NanoGPT = tiny/instant/rough → TinyLlama = bigger/fluent**
choice, both with **no install**, mirroring the existing Quick-Start preset
philosophy.

### Honest constraints (make it opt-in, not default)

- **WebGPU is required.** Works in Chrome/Edge today, Safari 17+ partially,
  Firefox behind a flag. The UI must feature-detect `navigator.gpu` and, when
  absent, fall through to the next ladder rung with a clear message.
- **First load is a real download** (600 MB for TinyLlama). Show a one-time
  progress bar; never block the deterministic engine while it downloads.
- **History note:** an earlier in-browser WebLLM path was deliberately removed
  (`lib/companion-types.ts` comments *"no in-browser WebLLM"*, though
  `.env.example` still references `NEXT_PUBLIC_DEFAULT_PROVIDER=webllm`). This
  proposal **re-introduces it as an explicit, opt-in tier** — not the default —
  so the "two clean paths" simplicity is preserved for users who don't want it.

### How it plugs in

- New provider adapter `lib/providers/browser-llm.ts` (or reuse the removed
  WebLLM path) exposing the same `chat(input, context, settings)` contract as
  the other adapters in the architecture plan (§3 "Provider adapter layer").
- New Quick-Start presets: **"In-browser Tiny (NanoGPT)"** and
  **"In-browser Empathy (TinyLlama)"**, gated behind a WebGPU check.
- Service Worker already caches the app shell + face weights; extend its cache
  policy to persist the model shards so subsequent launches are offline.

## 3. How it plugs into the existing code (no rewrite needed)

| Touch point | Change |
|---|---|
| [lib/companion-types.ts](../lib/companion-types.ts) | add a recommended-models entry + optional preset id; `ollamaModel` already exists (line ~232) |
| Settings panel | add "Lite Empathy (TinyLlama)" to Quick-Start Presets |
| Docker (`scripts/ollama-init.sh`, compose) | allow `OLLAMA_MODEL=empathia-tiny` and `ollama create` from the Modelfile |
| `.env.example` | document `OLLAMA_MODEL=empathia-tiny` as the lightweight option |
| README "Recommended Ollama Models" | add the TinyLlama empathy preset row |
| `lib/providers/browser-llm.ts` *(new, for §2b)* | WebGPU adapter exposing the shared `chat()` contract; feature-detects `navigator.gpu` |
| `public/sw.js` *(for §2b)* | extend cache policy to persist downloaded model shards for offline reuse |

The Ollama preset needs **no orchestrator or fallback changes** — it's just
another model id on an existing path. The browser tier (§2b) adds one new
provider adapter behind a WebGPU check, but no change to the fallback *policy*:
it's a new rung the ladder can step through, nothing more.

## 4. The bigger payoff (future): a *fine-tuned* empathy model

Generic TinyLlama is a fluency upgrade over templates, but it isn't
*specialized*. The natural next step is to **distill / fine-tune TinyLlama on
empathetic-response data**, using Empatheia's own structures as the schema:

- **Labels from the engine you already have:** the Plutchik primaries, dyads,
  intensity tiers, and body-anchors exported from
  [lib/conversation/emotion-engine/index.ts](../lib/conversation/emotion-engine/index.ts)
  are a ready-made labeling scheme for training data.
- **Targets from the rules:** the SAYS/THINKS/DOES/FEELS quadrants and the
  one-reflection-one-reframe-one-question response shape become the output
  format the model is trained to produce.
- **Teacher model:** use a strong model (the cloud tier) to generate
  high-quality empathetic responses, then distill them into TinyLlama — classic
  knowledge distillation, GPU needed only at train time, not at inference.

The result: a **600 MB model that is better at *this one job*** (calibrated,
non-clinical, Plutchik-aware empathy) than a generic 7B model, while running on
a laptop CPU. That's a defensible product differentiator, not just a size win.

## 5. Related ideas worth considering

These came out of reading the codebase; each is small and complementary.

1. **On-device emotion classifier (tiny encoder, not a chat LLM).**
   A ~20–60 MB DistilBERT/MiniLM fine-tuned to output Plutchik primary +
   intensity directly. Faster and more reliable than asking a generative model
   to self-report emotion, and a perfect input signal to fuse with the existing
   **camera mood** (`components/camera-panel.tsx`) — text-emotion + face-emotion
   → one mood vector, exactly the fusion the README already describes.

2. **Two-model split: "feel" vs "speak."**
   Use the tiny encoder (idea 1) for *understanding* and TinyLlama for
   *responding*. The encoder updates the empathy map quadrants deterministically
   and cheaply; the LLM only handles language. Cleaner, faster, and each piece
   is independently testable.

3. **Logit-lens / confidence surfacing for trust.**
   Because a small local model is inspectable, you can show a lightweight
   "confidence" signal in the Mirror strip (`components/mirror-strip.tsx`) when
   the model is unsure — reinforcing the doc's principle that *"confidence is
   provisional, never absolute"* (empathy-engine §5).

4. **Streaming-first tiny model for perceived warmth.**
   A 1.1B model streams tokens fast on CPU; token-by-token streaming makes the
   companion feel like it's "thinking with you," which matters more for empathy
   UX than raw quality.

5. **Quantization presets as accessibility tiers.**
   Ship Q4 (fast/small) and Q8 (slower/warmer) presets so users on a phone-class
   device vs a laptop both get a good experience — mirrors the existing
   Quick-Start preset philosophy.

6. **Crisis-safety guardrail as a separate tiny classifier.**
   A small dedicated classifier that flags crisis/self-harm content *before*
   generation, so the safety constraint in empathy-engine §7 is enforced by a
   model whose only job is detection — not left to the chat model's discretion.

## 6. Suggested first slice (smallest shippable)

1. Add `empathia-tiny.Modelfile` (section 2) to the repo.
2. Add a "Lite Empathy (TinyLlama)" Quick-Start preset in Settings.
3. Document it in the README "Recommended Ollama Models" table.
4. One Playwright smoke test: select the preset, send a message, assert a
   non-fallback reply (`mode !== "fallback"`).

That's an end-to-end vertical slice — model + UI + test — with no orchestrator
changes and no GPU.

**Follow-on slices, in order of effort:**

1. **Browser tier (§2b)** — add `lib/providers/browser-llm.ts` (WebGPU-gated),
   the two in-browser presets, and a Service-Worker cache rule. Bigger than the
   Ollama slice but unlocks the true zero-install experience.
2. **Fine-tuning (§4)** — train an empathy-specialized TinyLlama checkpoint.
3. **Tiny emotion encoder (idea 1)** — fuse text-emotion with camera mood.

---

*Cross-reference: a standalone TinyLlama internals/visualization lab
(`models/llm-lab`) exists in the `unhosted-core` repo and can serve as the
inspection front-end when evaluating fine-tuned empathy checkpoints.*
