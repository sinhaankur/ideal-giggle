import {
  consumeStream,
  convertToModelMessages,
  streamText,
  type UIMessage,
} from "ai"
import { createOpenAI, openai } from "@ai-sdk/openai"
import { anthropic } from "@ai-sdk/anthropic"
import { google } from "@ai-sdk/google"
import { createOpenRouter } from "@openrouter/ai-sdk-provider"
import { PROVIDER_DEFAULT_MODELS } from "@/lib/companion-types"
import {
  buildEmpathySystemPrompt,
  buildUserUnderstandingGuidance,
  planFromContext,
} from "@/lib/conversation/communication-engine"
import {
  badRequestFromZod,
  chatRequestSchema,
  checkRateLimit,
  getClientIp,
  rateLimitJsonResponse,
} from "@/lib/api/request-guards"
import { z } from "zod"
import type { EmpathyProfile } from "@/lib/companion-types"

export const maxDuration = 60

function getLatestUserMessageText(messages: UIMessage[]) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index]
    if (message.role !== "user") continue

    const text = (message.parts || [])
      .filter((part): part is { type: "text"; text: string } => part.type === "text")
      .map((part) => part.text)
      .join(" ")
      .trim()

    if (text) return text
  }

  return ""
}

function getLowestQuadrant(currentSummary: { says: number; thinks: number; does: number; feels: number }) {
  return (Object.keys(currentSummary) as Array<keyof typeof currentSummary>).reduce((a, b) =>
    currentSummary[a] <= currentSummary[b] ? a : b
  )
}

function getDeepPrompt(
  userData: { says: number; thinks: number; does: number; feels: number },
  sessionDepth: number
) {
  const intensity = sessionDepth > 10 ? "Provocative" : sessionDepth > 5 ? "Reflective" : "Inquisitive"
  const lowestQuadrant = getLowestQuadrant(userData)

  return `User current intensity is ${intensity}. Samantha, do not provide solutions. Use vertical probing: take the user's last statement and ask 'And what does that tell you about ${lowestQuadrant.toUpperCase()}?'. Current goal: fill the ${lowestQuadrant.toUpperCase()} quadrant.`
}

export async function POST(req: Request) {
  const ip = getClientIp(req)
  const limit = checkRateLimit({
    key: `chat:${ip}`,
    limit: 45,
    windowMs: 60_000,
  })
  if (!limit.allowed) {
    return rateLimitJsonResponse(limit.retryAfterSec)
  }

  let body: z.infer<typeof chatRequestSchema>
  try {
    const rawBody = await req.json()
    body = chatRequestSchema.parse(rawBody)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return badRequestFromZod(error)
    }
    return Response.json({ error: "Invalid JSON body" }, { status: 400 })
  }
  
  // Extract messages and custom data from the request
  const messages = body.messages as UIMessage[]
  const emotion: string = body.emotion || "neutral"
  const personality: string = body.personality || "warm"
  const toneMode: string = body.toneMode || "balanced"
  const provider: string = body.provider || "openai"
  const temperature: number = body.temperature ?? 0.7
  const topP: number = body.topP ?? 0.95
  const maxOutputTokens: number = body.maxOutputTokens ?? 300
  const contextMessages: number = body.contextMessages ?? 12
  const empathySummary = body.empathySummary || { says: 0, thinks: 0, does: 0, feels: 0 }
  const sessionDepth = Array.isArray(messages) ? messages.length : 0
  const samanthaGuidance: string =
    body.samanthaGuidance || getDeepPrompt(empathySummary, sessionDepth)
  const nextDeepQuestion: string = body.nextDeepQuestion || ""
  const companionName: string = body.companionName || "EMPATHEIA"
  const empathyProfile = (body.empathyProfile as EmpathyProfile | null | undefined) || null
  const empathyCode: string = body.empathyCode || ""
  const ollamaBaseUrl: string =
    body.ollamaBaseUrl || process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434"
  const ollamaModel: string = body.ollamaModel || process.env.OLLAMA_MODEL || "llama3.2"
  const envOpenRouterApiKey = process.env.OPENROUTER_API_KEY || ""
  const bodyOpenRouterApiKey: string = body.openRouterApiKey || ""
  const openRouterApiKey: string = process.env.NODE_ENV === "production"
    ? envOpenRouterApiKey
    : bodyOpenRouterApiKey || envOpenRouterApiKey
  const openRouterModel: string = body.openRouterModel || "meta-llama/llama-3.3-70b-instruct:free"

  // Ollama exposes an OpenAI-compatible endpoint at /v1, which returns
  // AI SDK v6 spec-v2 models. The legacy /api endpoint via ollama-ai-provider
  // only emits spec-v1 models and crashes streamText on AI SDK >= 5.
  const trimmedOllamaBase = ollamaBaseUrl.replace(/\/(api\/?|v1\/?)?$/, "").replace(/\/$/, "")
  const ollamaCompat = createOpenAI({
    apiKey: "ollama-local",
    baseURL: `${trimmedOllamaBase}/v1`,
  })

  // Dedicated OpenRouter provider — knows OpenRouter's quirks
  // (model naming, response shape, tool-call format) better than
  // pointing the generic OpenAI provider at OpenRouter's base URL.
  const openRouter = createOpenRouter({
    apiKey: openRouterApiKey,
  })

  // Per-turn therapy-engine plan: regulation state, arc phase, modality,
  // intent stack, dose, pacing, forbidden moves. The plan rides into the
  // system prompt as concrete directives so the model knows what THIS
  // turn is supposed to do, not just general empathy advice.
  const latestUserText = getLatestUserMessageText(messages)
  const userTurnCount = messages.filter((m) => m.role === "user").length
  const responsePlan = planFromContext({
    text: latestUserText,
    cameraEmotion: emotion,
    userTurnCount,
    sessionMinutes: 0, // route is stateless; client passes its own context
    preferredName: empathyProfile?.preferredName,
  })

  const systemPrompt = buildEmpathySystemPrompt({
    companionName,
    personality,
    toneMode,
    emotion,
    empathyProfile,
    empathyCode,
    empathySummary,
    samanthaGuidance,
    nextDeepQuestion: nextDeepQuestion || "Use your best tier-appropriate follow-up.",
    userUnderstandingGuidance: buildUserUnderstandingGuidance(latestUserText),
    responsePlan,
  })

  // Use direct model providers.
  let model
  try {
    switch (provider) {
      case "anthropic":
        model = anthropic(PROVIDER_DEFAULT_MODELS.anthropic)
        break
      case "google":
        model = google(PROVIDER_DEFAULT_MODELS.google)
        break
      case "ollama":
        model = ollamaCompat.chat(ollamaModel)
        break
      case "openrouter":
        if (!openRouterApiKey) {
          throw new Error(
            process.env.NODE_ENV === "production"
              ? "OpenRouter API key is missing on server. Set OPENROUTER_API_KEY in deployment environment."
              : "OpenRouter API key is missing. Add it in Settings or set OPENROUTER_API_KEY."
          )
        }
        model = openRouter(openRouterModel)
        break
      case "openai":
      default:
        model = openai(PROVIDER_DEFAULT_MODELS.openai)
        break
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create model"
    return Response.json(
      { error: "Provider configuration error", detail: message, provider },
      { status: 400 }
    )
  }

  let result
  try {
    result = streamText({
      model: model as any,
      system: systemPrompt,
      messages: await convertToModelMessages(messages.slice(-contextMessages)),
      temperature,
      topP,
      maxOutputTokens,
      abortSignal: req.signal,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "streamText failed"
    return Response.json(
      { error: "Model invocation failed", detail: message, provider },
      { status: 502 }
    )
  }

  return result.toUIMessageStreamResponse({
    originalMessages: messages,
    consumeSseStream: consumeStream,
  })
}
