export interface WebLLMDirectMessage {
  role: "system" | "user" | "assistant"
  content: string
}

export interface WebLLMDirectRequest {
  model?: string
  system: string
  messages: WebLLMDirectMessage[]
  temperature: number
  topP: number
  maxTokens: number
}

export interface WebLLMDirectResult {
  text: string
  model: string
}

type ChatCompletionMessage = {
  role: "system" | "user" | "assistant"
  content: string
}

type ChatCreateReq = {
  messages: ChatCompletionMessage[]
  temperature?: number
  top_p?: number
  max_tokens?: number
  stream?: boolean
}
type NonStreamResponse = {
  choices?: Array<{ message?: { content?: string | Array<{ type?: string; text?: string }> } }>
}
// Streamed chunks: each carries an incremental delta on choices[].delta.content.
type StreamChunk = {
  choices?: Array<{ delta?: { content?: string | Array<{ type?: string; text?: string }> } }>
}
type MLCEngine = {
  chat: {
    completions: {
      create: (req: ChatCreateReq & { stream?: false }) => Promise<NonStreamResponse>
    }
  }
  // The streaming overload returns an async iterable of delta chunks.
  chatStream?: unknown
}

type WebLLMModule = {
  CreateMLCEngine: (
    model: string,
    options?: { initProgressCallback?: (report: { progress?: number; text?: string }) => void },
  ) => Promise<{
    chat: {
      completions: {
        create: (
          req: ChatCreateReq,
        ) => Promise<NonStreamResponse | AsyncIterable<StreamChunk>>
      }
    }
  }>
  prebuiltAppConfig?: {
    model_list?: Array<{ model_id?: string }>
  }
}

// Optional listener for model-download/init progress (0..1 + a human label),
// so the UI can show "preparing a warmer companion — 42%" during the one-time
// ~600 MB download instead of an opaque wait.
export type WebLLMProgress = { progress: number; text: string }
let progressListeners: Array<(p: WebLLMProgress) => void> = []
let lastProgress: WebLLMProgress = { progress: 0, text: "" }
export function onWebLLMProgress(fn: (p: WebLLMProgress) => void): () => void {
  progressListeners.push(fn)
  if (lastProgress.text) fn(lastProgress)
  return () => { progressListeners = progressListeners.filter((f) => f !== fn) }
}
function emitProgress(p: WebLLMProgress) {
  lastProgress = p
  for (const fn of progressListeners) { try { fn(p) } catch { /* listener errors are non-fatal */ } }
}

const CANDIDATE_MODELS = [
  "TinyLlama-1.1B-Chat-v1.0-q4f16_1-MLC",
  "Llama-3.2-1B-Instruct-q4f16_1-MLC",
  "Llama-3.2-1B-Instruct-q4f32_1-MLC",
]

let webllmModulePromise: Promise<WebLLMModule> | null = null
let enginePromise: Promise<Awaited<ReturnType<WebLLMModule["CreateMLCEngine"]>> | null> | null = null
let loadedModelId: string | null = null
// Tracks background warmup so the UI can show "preparing a smarter model" and
// the send path can decide whether to use WebLLM or answer instantly with the
// deterministic engine. We never block a reply on this.
let warmupState: "idle" | "loading" | "ready" | "error" = "idle"

function inBrowser(): boolean {
  return typeof window !== "undefined" && typeof navigator !== "undefined"
}

export function isWebLLMSupported(): boolean {
  return inBrowser() && typeof (navigator as Navigator & { gpu?: unknown }).gpu !== "undefined"
}

// True once the model is downloaded + initialized and ready to answer with no
// wait. The send path checks this: ready → use WebLLM; not ready → answer
// instantly with the deterministic engine (and keep warmup running).
export function isWebLLMReady(): boolean {
  return warmupState === "ready"
}

export function webLLMWarmupState(): "idle" | "loading" | "ready" | "error" {
  return warmupState
}

// Kick off (or resume) background model initialization without sending a
// message. Safe to call repeatedly — it no-ops once loading/ready. Resolves to
// true when the engine is ready, false if unsupported or it failed. Callers
// should NOT await this in the critical reply path; fire-and-forget and poll
// isWebLLMReady() instead.
export async function preloadWebLLM(preferredModel?: string): Promise<boolean> {
  if (!isWebLLMSupported()) {
    warmupState = "error"
    return false
  }
  if (warmupState === "ready") return true
  if (warmupState === "loading") {
    try {
      await enginePromise
      return isWebLLMReady()
    } catch {
      return false
    }
  }
  warmupState = "loading"
  try {
    await getEngine(preferredModel)
    warmupState = "ready"
    return true
  } catch {
    warmupState = "error"
    return false
  }
}

async function loadModule(): Promise<WebLLMModule> {
  if (!webllmModulePromise) {
    webllmModulePromise = import("@mlc-ai/web-llm") as Promise<WebLLMModule>
  }
  return webllmModulePromise
}

function normalizeContent(content: string | Array<{ type?: string; text?: string }> | undefined): string {
  if (typeof content === "string") return content
  if (Array.isArray(content)) {
    return content
      .map((part) => (typeof part?.text === "string" ? part.text : ""))
      .join("")
      .trim()
  }
  return ""
}

function pickModelId(available: string[], preferredModel?: string): string {
  const envPreferred = process.env.NEXT_PUBLIC_WEBLLM_MODEL
  const prioritized = [preferredModel, envPreferred, ...CANDIDATE_MODELS].filter(
    (item): item is string => typeof item === "string" && item.trim().length > 0
  )

  for (const model of prioritized) {
    const exact = available.find((entry) => entry === model)
    if (exact) return exact
  }

  for (const model of prioritized) {
    const fuzzy = available.find((entry) => entry.toLowerCase().includes(model.toLowerCase()))
    if (fuzzy) return fuzzy
  }

  const tiny = available.find((entry) => entry.toLowerCase().includes("tinyllama"))
  if (tiny) return tiny

  const llama1b = available.find((entry) =>
    entry.toLowerCase().includes("llama-3.2") && entry.toLowerCase().includes("1b")
  )
  if (llama1b) return llama1b

  if (available.length === 0) {
    throw new Error("WebLLM has no available prebuilt models in this runtime")
  }
  return available[0]
}

async function getEngine(preferredModel?: string) {
  const webllm = await loadModule()
  const availableModels = (webllm.prebuiltAppConfig?.model_list || [])
    .map((entry) => entry.model_id)
    .filter((entry): entry is string => typeof entry === "string" && entry.length > 0)

  const modelId = pickModelId(availableModels, preferredModel)

  if (!enginePromise || loadedModelId !== modelId) {
    loadedModelId = modelId
    enginePromise = webllm
      .CreateMLCEngine(modelId, {
        // Surface download/init progress so the UI can reassure the user during
        // the one-time model fetch instead of showing a dead wait.
        initProgressCallback: (report) => {
          const progress = typeof report?.progress === "number" ? report.progress : 0
          emitProgress({ progress, text: report?.text || "Preparing a warmer companion…" })
        },
      })
      .then((engine) => {
        emitProgress({ progress: 1, text: "Ready" })
        return engine
      })
      .catch((error) => {
        enginePromise = null
        loadedModelId = null
        throw error
      })
  }

  const engine = await enginePromise
  if (!engine || !loadedModelId) {
    throw new Error("WebLLM engine did not initialize")
  }

  return { engine, modelId: loadedModelId }
}

export async function sendWebLLMDirect(request: WebLLMDirectRequest): Promise<WebLLMDirectResult> {
  if (!inBrowser()) {
    throw new Error("WebLLM direct call is only available in the browser")
  }

  if (!isWebLLMSupported()) {
    throw new Error("WebLLM requires WebGPU support in this browser")
  }

  const { engine, modelId } = await getEngine(request.model)
  // A successful getEngine means the model is initialized — reflect that so
  // background-warmup callers see "ready".
  warmupState = "ready"

  const response = (await engine.chat.completions.create({
    messages: [{ role: "system", content: request.system }, ...request.messages],
    temperature: request.temperature,
    top_p: request.topP,
    max_tokens: request.maxTokens,
    stream: false,
  })) as NonStreamResponse

  const content = normalizeContent(response?.choices?.[0]?.message?.content)
  if (!content) {
    throw new Error("WebLLM returned an empty response")
  }

  return {
    text: content,
    model: modelId,
  }
}

// Streaming variant: yields tokens as the model generates them via `onToken`,
// so the companion's reply appears word-by-word instead of after a dead wait —
// the single biggest "feels alive" upgrade for an on-device model. Returns the
// full text at the end. Falls back to a single onToken(full) if the runtime
// doesn't actually stream. Purely additive — the non-stream path is untouched.
export async function sendWebLLMDirectStream(
  request: WebLLMDirectRequest,
  onToken: (deltaText: string, fullSoFar: string) => void,
): Promise<WebLLMDirectResult> {
  if (!inBrowser()) throw new Error("WebLLM direct call is only available in the browser")
  if (!isWebLLMSupported()) throw new Error("WebLLM requires WebGPU support in this browser")

  const { engine, modelId } = await getEngine(request.model)
  warmupState = "ready"

  const create = (engine as unknown as MLCEngine).chat.completions.create as (
    req: ChatCreateReq,
  ) => Promise<NonStreamResponse | AsyncIterable<StreamChunk>>

  const result = await create({
    messages: [{ role: "system", content: request.system }, ...request.messages],
    temperature: request.temperature,
    top_p: request.topP,
    max_tokens: request.maxTokens,
    stream: true,
  })

  let full = ""
  // If the runtime honoured stream:true it's an async iterable of delta chunks.
  if (result && typeof (result as AsyncIterable<StreamChunk>)[Symbol.asyncIterator] === "function") {
    for await (const chunk of result as AsyncIterable<StreamChunk>) {
      const delta = normalizeContent(chunk?.choices?.[0]?.delta?.content)
      if (delta) {
        full += delta
        onToken(delta, full)
      }
    }
  } else {
    // Runtime ignored streaming — treat as a single block.
    full = normalizeContent((result as NonStreamResponse)?.choices?.[0]?.message?.content)
    if (full) onToken(full, full)
  }

  full = full.trim()
  if (!full) throw new Error("WebLLM returned an empty response")
  return { text: full, model: modelId }
}
