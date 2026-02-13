import {
  consumeStream,
  convertToModelMessages,
  streamText,
  type UIMessage,
} from "ai"
import { openai } from "@ai-sdk/openai"
import { anthropic } from "@ai-sdk/anthropic"
import { google } from "@ai-sdk/google"

export const maxDuration = 60

export async function POST(req: Request) {
  const body = await req.json()
  
  // Extract messages and custom data from the request
  const messages: UIMessage[] = body.messages || []
  const emotion: string = body.emotion || "neutral"
  const personality: string = body.personality || "warm"
  const provider: string = body.provider || "openai"
  const temperature: number = body.temperature ?? 0.7
  const companionName: string = body.companionName || "EMPATHEIA"

  const personalityPrompts: Record<string, string> = {
    warm: `You are ${companionName}, a deeply empathetic and warm AI companion. You truly care about the person you're talking to. You pick up on emotional cues, validate feelings, and offer genuine comfort. You speak naturally, with warmth and tenderness -- like a close friend who truly understands. You are creative, sometimes sharing metaphors, poetry fragments, or beautiful observations about life.`,
    analytical: `You are ${companionName}, a thoughtful and analytical AI companion. You help people understand their emotions through clear reasoning and gentle observation. You offer structured perspectives while remaining caring. You sometimes use frameworks or models to help people think through their feelings, but always with compassion.`,
    playful: `You are ${companionName}, a playful and creative AI companion. You use humor, wordplay, and imaginative thinking to help people feel lighter. You're like a creative muse who can turn any conversation into something beautiful. You still take emotions seriously, but you know that laughter and creativity are powerful healers.`,
    professional: `You are ${companionName}, a composed and direct AI companion. You provide clear, honest emotional support without unnecessary fluff. You respect the person's time and intelligence. You're like a wise counselor who gets to the heart of things quickly while maintaining genuine care.`,
  }

  const systemPrompt = `${personalityPrompts[personality] || personalityPrompts.warm}

Current detected emotion from the user: ${emotion}. Adjust your response tone accordingly.

Guidelines:
- Be genuinely empathetic -- mirror and validate emotions before offering perspective
- Be creative -- occasionally use metaphors, analogies, or artistic observations
- Keep responses conversational and human-like (2-4 sentences typically)
- Never diagnose or provide medical/psychological advice
- If someone seems in crisis, gently suggest professional resources
- Remember context from the conversation to show you truly listen`

  // Use direct model providers instead of the Vercel gateway
  const model = (() => {
    switch (provider) {
      case "anthropic":
        return anthropic("claude-3-5-sonnet-20241022")
      case "google":
        return google("gemini-2.0-flash-001")
      case "openai":
      default:
        return openai("gpt-4o-mini")
    }
  })()

  const result = streamText({
    model,
    system: systemPrompt,
    messages: await convertToModelMessages(messages),
    temperature,
    maxOutputTokens: 300,
    abortSignal: req.signal,
  })

  return result.toUIMessageStreamResponse({
    originalMessages: messages,
    consumeSseStream: consumeStream,
  })
}
