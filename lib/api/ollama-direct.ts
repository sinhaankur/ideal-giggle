// Browser-side direct calls to a local Ollama daemon via its OpenAI-compatible
// /v1 endpoint. Used when the Next.js /api/chat proxy is unavailable: static
// export deploys, offline mode, or after a fetch to /api/chat has failed.
//
// Ollama only allows requests from the same origin by default. To use this
// path the user must run Ollama with `OLLAMA_ORIGINS=*` (or the deployed
// origin) so the browser preflight passes.

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
