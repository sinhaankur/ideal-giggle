// Browser-side direct calls to any OpenAI-compatible local LLM runtime.
// "ollama-direct" is the historical name, but the same code path works
// with any local server that speaks the OpenAI Chat Completions spec at
// /v1/chat/completions — Ollama, LM Studio, Jan, llamafile, vLLM,
// text-generation-webui (with the openai extension), GPT4All-server, etc.
//
// Each runtime ships requests from the same origin policy. To call from
// a browser tab you generally need to allow your dev/Pages origin via
// the runtime's CORS / origin setting:
//   - Ollama:   OLLAMA_ORIGINS="*" or specific origins
//   - LM Studio: Server > Settings > Cross-Origin Resource Sharing
//   - Jan:      Settings > Local API Server > CORS toggle
//   - llamafile: --host 0.0.0.0 + --api-key (CORS open by default)

export interface OllamaDirectMessage {
  role: "system" | "user" | "assistant"
  content: string
}

export interface OllamaDirectRequest {
  baseUrl: string
  model: string
  system: string
  messages: OllamaDirectMessage[]
  temperature: number
  topP: number
  maxTokens: number
  signal?: AbortSignal
}

export interface OllamaDirectResult {
  text: string
}

function normalizeBaseUrl(baseUrl: string) {
  const trimmed = baseUrl.replace(/\/(api\/?|v1\/?)?$/, "").replace(/\/$/, "")
  return `${trimmed}/v1/chat/completions`
}

function trimBase(baseUrl: string) {
  return baseUrl.replace(/\/$/, "")
}

export interface OllamaReachability {
  reachable: boolean
  modelAvailable: boolean
  pickedModel: string | null
}

// Well-known local LLM runtimes that speak the OpenAI-compatible Chat
// Completions API at /v1/*. The browser probes each in turn and uses
// whichever responds first.
export interface KnownLocalRuntime {
  name: "Ollama" | "LM Studio" | "Jan" | "llamafile" | "Generic OpenAI"
  baseUrl: string
}

export const KNOWN_LOCAL_RUNTIMES: KnownLocalRuntime[] = [
  { name: "Ollama", baseUrl: "http://127.0.0.1:11434" },
  { name: "LM Studio", baseUrl: "http://127.0.0.1:1234" },
  { name: "Jan", baseUrl: "http://127.0.0.1:1337" },
  { name: "llamafile", baseUrl: "http://127.0.0.1:8080" },
]

export interface LocalRuntimeReading {
  reachable: boolean
  runtimeName: KnownLocalRuntime["name"] | null
  baseUrl: string | null
  pickedModel: string | null
  modelCount: number
}

// Map a known base URL back to its runtime name. Falls back to "Generic
// OpenAI" when the URL doesn't match a known port.
export function runtimeNameFromBaseUrl(url: string): KnownLocalRuntime["name"] {
  const lower = url.toLowerCase()
  if (lower.includes(":11434")) return "Ollama"
  if (lower.includes(":1234")) return "LM Studio"
  if (lower.includes(":1337")) return "Jan"
  if (lower.includes(":8080")) return "llamafile"
  return "Generic OpenAI"
}

// Probe a single OpenAI-compatible runtime via its /v1/models endpoint.
// Returns reachability + the first available model id.
async function probeOpenAICompatible(
  baseUrl: string,
  preferredModel: string,
  signal?: AbortSignal
): Promise<{ reachable: boolean; modelAvailable: boolean; pickedModel: string | null; modelCount: number }> {
  try {
    const base = trimBase(baseUrl)
    const modelsUrl = base.endsWith("/v1") ? `${base}/models` : `${base}/v1/models`
    const response = await fetch(modelsUrl, { signal, cache: "no-store" })
    if (!response.ok) {
      return { reachable: false, modelAvailable: false, pickedModel: null, modelCount: 0 }
    }
    const data = await response.json()
    const models: Array<{ id?: string; name?: string }> = Array.isArray(data?.data)
      ? data.data
      : Array.isArray(data?.models)
        ? data.models
        : []
    if (models.length === 0) {
      return { reachable: true, modelAvailable: false, pickedModel: null, modelCount: 0 }
    }
    const exact = models.find((entry) =>
      (entry.id || entry.name || "").toLowerCase().includes(preferredModel.toLowerCase())
    )
    const picked = exact?.id || exact?.name || models[0].id || models[0].name || null
    return {
      reachable: true,
      modelAvailable: Boolean(exact),
      pickedModel: picked ?? null,
      modelCount: models.length,
    }
  } catch {
    return { reachable: false, modelAvailable: false, pickedModel: null, modelCount: 0 }
  }
}

// Probe every known local-LLM runtime in parallel and return the first
// reachable one. Priority is the order of KNOWN_LOCAL_RUNTIMES — when
// two are up at once, Ollama wins because it's listed first.
export async function probeLocalLLM(
  preferredModel: string,
  signal?: AbortSignal,
  prioritizedBaseUrl?: string
): Promise<LocalRuntimeReading> {
  // If the user has explicitly configured a base URL, try it first
  // (it might be a non-default port the user picked deliberately).
  const candidates: KnownLocalRuntime[] = [...KNOWN_LOCAL_RUNTIMES]
  if (prioritizedBaseUrl && !candidates.some((c) => c.baseUrl === prioritizedBaseUrl)) {
    candidates.unshift({
      name: runtimeNameFromBaseUrl(prioritizedBaseUrl),
      baseUrl: prioritizedBaseUrl,
    })
  } else if (prioritizedBaseUrl) {
    // Reorder so the prioritized URL is first.
    candidates.sort((a, b) =>
      a.baseUrl === prioritizedBaseUrl ? -1 : b.baseUrl === prioritizedBaseUrl ? 1 : 0
    )
  }

  const results = await Promise.all(
    candidates.map(async (runtime) => {
      const probe = await probeOpenAICompatible(runtime.baseUrl, preferredModel, signal)
      return { runtime, probe }
    })
  )

  const winner = results.find((r) => r.probe.reachable)
  if (!winner) {
    return {
      reachable: false,
      runtimeName: null,
      baseUrl: null,
      pickedModel: null,
      modelCount: 0,
    }
  }
  return {
    reachable: true,
    runtimeName: winner.runtime.name,
    baseUrl: winner.runtime.baseUrl,
    pickedModel: winner.probe.pickedModel,
    modelCount: winner.probe.modelCount,
  }
}

// Single source of truth for "is local Ollama up right now?". Tries the
// Next.js proxy route first (so a same-origin server can mediate CORS) and
// then falls back to a browser-direct call to /api/tags. Either path is
// safe to invoke from a static export.
export async function probeOllama(
  baseUrl: string,
  preferredModel: string,
  signal?: AbortSignal
): Promise<OllamaReachability> {
  const isStaticExport = process.env.NEXT_PUBLIC_STATIC_EXPORT === "true"

  if (!isStaticExport) {
    try {
      const params = new URLSearchParams({ baseUrl, model: preferredModel })
      const response = await fetch(`/api/ollama-status?${params.toString()}`, {
        signal,
        cache: "no-store",
      })
      if (response.ok) {
        const data = (await response.json()) as Partial<OllamaReachability>
        if (data && typeof data.reachable === "boolean") {
          return {
            reachable: data.reachable,
            modelAvailable: Boolean(data.modelAvailable),
            pickedModel:
              data.pickedModel ?? (data.modelAvailable ? preferredModel : null),
          }
        }
      }
    } catch {
      // fall through to direct fetch
    }
  }

  try {
    const base = trimBase(baseUrl)
    const tagsUrl = base.endsWith("/api") ? `${base}/tags` : `${base}/api/tags`
    const response = await fetch(tagsUrl, { signal, cache: "no-store" })
    if (!response.ok) {
      return { reachable: false, modelAvailable: false, pickedModel: null }
    }
    const data = await response.json()
    const models: Array<{ model?: string; name?: string }> = Array.isArray(
      data?.models
    )
      ? data.models
      : []
    if (models.length === 0) {
      return { reachable: true, modelAvailable: false, pickedModel: null }
    }
    const exact = models.find((entry) =>
      (entry.model || entry.name || "")
        .toLowerCase()
        .includes(preferredModel.toLowerCase())
    )
    const picked = exact?.model || exact?.name || models[0].model || models[0].name || null
    return {
      reachable: true,
      modelAvailable: Boolean(exact),
      pickedModel: picked ?? null,
    }
  } catch {
    return { reachable: false, modelAvailable: false, pickedModel: null }
  }
}

export async function sendOllamaDirect(
  request: OllamaDirectRequest
): Promise<OllamaDirectResult> {
  const url = normalizeBaseUrl(request.baseUrl)
  const payload = {
    model: request.model,
    messages: [
      { role: "system" as const, content: request.system },
      ...request.messages,
    ],
    temperature: request.temperature,
    top_p: request.topP,
    max_tokens: request.maxTokens,
    stream: false,
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer ollama-local",
    },
    body: JSON.stringify(payload),
    signal: request.signal,
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => "")
    throw new Error(
      `Ollama responded ${response.status}${detail ? `: ${detail.slice(0, 240)}` : ""}`
    )
  }

  const data = await response.json()
  const content = data?.choices?.[0]?.message?.content
  const text =
    typeof content === "string"
      ? content
      : Array.isArray(content)
        ? content
            .map((part: { text?: string }) =>
              typeof part?.text === "string" ? part.text : ""
            )
            .join("")
        : ""

  if (!text.trim()) {
    throw new Error("Ollama returned an empty response")
  }

  return { text: text.trim() }
}
