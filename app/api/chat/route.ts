import {
  consumeStream,
  convertToModelMessages,
  streamText,
  type UIMessage,
} from "ai"
import { createOpenAI, openai } from "@ai-sdk/openai"
import { anthropic } from "@ai-sdk/anthropic"
import { google } from "@ai-sdk/google"
import { createOllama } from "ollama-ai-provider"
import { PROVIDER_DEFAULT_MODELS } from "@/lib/companion-types"
import { buildEmpathySystemPrompt, buildUserUnderstandingGuidance } from "@/lib/conversation/communication-engine"
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

  const normalizedOllamaBaseUrl =
    ollamaBaseUrl.endsWith("/api") || ollamaBaseUrl.endsWith("/api/")
      ? ollamaBaseUrl.replace(/\/$/, "")
      : `${ollamaBaseUrl.replace(/\/$/, "")}/api`

  const ollama = createOllama({
    baseURL: normalizedOllamaBaseUrl,
  })

  const openRouter = createOpenAI({
    apiKey: openRouterApiKey,
    baseURL: "https://openrouter.ai/api/v1",
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
    userUnderstandingGuidance: buildUserUnderstandingGuidance(getLatestUserMessageText(messages)),
  })

  // Use direct model providers.
  const model = (() => {
    switch (provider) {
      case "anthropic":
        return anthropic(PROVIDER_DEFAULT_MODELS.anthropic)
      case "google":
        return google(PROVIDER_DEFAULT_MODELS.google)
      case "ollama":
        return ollama(ollamaModel)
      case "openrouter":
        if (!openRouterApiKey) {
          throw new Error(
            process.env.NODE_ENV === "production"
              ? "OpenRouter API key is missing on server. Set OPENROUTER_API_KEY in deployment environment."
              : "OpenRouter API key is missing. Add it in Settings or set OPENROUTER_API_KEY."
          )
        }
        return openRouter.chat(openRouterModel)
      case "openai":
      default:
        return openai(PROVIDER_DEFAULT_MODELS.openai)
    }
  })()

  const result = streamText({
    model: model as any,
    system: systemPrompt,
    messages: await convertToModelMessages(messages.slice(-contextMessages)),
    temperature,
    topP,
    maxOutputTokens,
    abortSignal: req.signal,
  })

  return result.toUIMessageStreamResponse({
    originalMessages: messages,
    consumeSseStream: consumeStream,
  })
}
