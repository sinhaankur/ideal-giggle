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

type WebLLMModule = {
  CreateMLCEngine: (model: string, options?: { initProgressCallback?: (report: unknown) => void }) => Promise<{
    chat: {
      completions: {
        create: (req: {
          messages: ChatCompletionMessage[]
          temperature?: number
          top_p?: number
          max_tokens?: number
          stream?: boolean
        }) => Promise<{
          choices?: Array<{
            message?: {
              content?: string | Array<{ type?: string; text?: string }>
            }
          }>
        }>
      }
    }
  }>
  prebuiltAppConfig?: {
    model_list?: Array<{ model_id?: string }>
  }
}

const CANDIDATE_MODELS = [
  "TinyLlama-1.1B-Chat-v1.0-q4f16_1-MLC",
  "Llama-3.2-1B-Instruct-q4f16_1-MLC",
  "Llama-3.2-1B-Instruct-q4f32_1-MLC",
]

let webllmModulePromise: Promise<WebLLMModule> | null = null
let enginePromise: Promise<Awaited<ReturnType<WebLLMModule["CreateMLCEngine"]>> | null> | null = null
let loadedModelId: string | null = null

function inBrowser(): boolean {
  return typeof window !== "undefined" && typeof navigator !== "undefined"
}

export function isWebLLMSupported(): boolean {
  return inBrowser() && typeof (navigator as Navigator & { gpu?: unknown }).gpu !== "undefined"
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
      .CreateMLCEngine(modelId)
      .then((engine) => engine)
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

  const response = await engine.chat.completions.create({
    messages: [{ role: "system", content: request.system }, ...request.messages],
    temperature: request.temperature,
    top_p: request.topP,
    max_tokens: request.maxTokens,
    stream: false,
  })

  const content = normalizeContent(response?.choices?.[0]?.message?.content)
  if (!content) {
    throw new Error("WebLLM returned an empty response")
  }

  return {
    text: content,
    model: modelId,
  }
}
