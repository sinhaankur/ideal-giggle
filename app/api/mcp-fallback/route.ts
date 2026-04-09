import { generateText } from "ai"
import { createOpenAI } from "@ai-sdk/openai"

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
    const body = await req.json()
    const messages: FallbackMessage[] = Array.isArray(body.messages) ? body.messages : []
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
