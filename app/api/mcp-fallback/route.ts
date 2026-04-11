import { generateText } from "ai"
import { createOpenAI } from "@ai-sdk/openai"
import {
  badRequestFromZod,
  checkRateLimit,
  getClientIp,
  mcpFallbackRequestSchema,
  rateLimitJsonResponse,
} from "@/lib/api/request-guards"
import { z } from "zod"

type FallbackMessage = {
  role: "user" | "assistant"
  content: string
}

function normalizeBaseUrl(baseUrl: string) {
  const trimmed = baseUrl.replace(/\/$/, "")
  return trimmed.endsWith("/v1") ? trimmed : `${trimmed}/v1`
}

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req)
    const limit = checkRateLimit({
      key: `mcp-fallback:${ip}`,
      limit: 30,
      windowMs: 60_000,
    })
    if (!limit.allowed) {
      return rateLimitJsonResponse(limit.retryAfterSec)
    }

    let body: z.infer<typeof mcpFallbackRequestSchema>
    try {
      const rawBody = await req.json()
      body = mcpFallbackRequestSchema.parse(rawBody)
    } catch (error) {
      if (error instanceof z.ZodError) {
        return badRequestFromZod(error)
      }
      return Response.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    const messages: FallbackMessage[] = body.messages
    const mcpBaseUrl: string = body.mcpBaseUrl || "http://127.0.0.1:8787"
    const mcpModel: string = body.mcpModel || "gpt-4o-mini"
    const mcpApiKey: string = body.mcpApiKey || ""
    const systemPrompt: string =
      body.systemPrompt ||
      "You are a warm, human conversational companion. Start with a specific emotional reflection, avoid repetitive thank-you openings, be concise and empathetic, and ask one useful follow-up question."

    if (!messages.length) {
      return Response.json({ error: "No messages provided" }, { status: 400 })
    }

    const client = createOpenAI({
      baseURL: normalizeBaseUrl(mcpBaseUrl),
      apiKey: mcpApiKey || "mcp-local",
    })

    const result = await generateText({
      model: client.chat(mcpModel),
      system: systemPrompt,
      messages,
      temperature: 0.7,
      maxOutputTokens: 220,
    })

    return Response.json({ text: result.text })
  } catch (error) {
    const message = error instanceof Error ? error.message : "MCP fallback request failed"
    return Response.json({ error: message }, { status: 502 })
  }
}
