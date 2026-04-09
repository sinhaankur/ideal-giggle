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

function getToneModeInstruction(toneMode: string) {
  if (toneMode === "casual") {
    return "Keep it casual and human: use simple, everyday language, contractions, and short natural lines."
  }
  if (toneMode === "deep") {
    return "Keep it warm but deeper: reflective wording, emotional nuance, and one thoughtful follow-up question."
  }
  return "Keep it balanced: clear, natural, and grounded without sounding too formal or too slang-heavy."
}

export const maxDuration = 60

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
  const body = await req.json()
  
  // Extract messages and custom data from the request
  const messages: UIMessage[] = body.messages || []
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
  const empathyProfile = body.empathyProfile || null
  const empathyCode: string = body.empathyCode || ""
  const ollamaBaseUrl: string = body.ollamaBaseUrl || "http://127.0.0.1:11434"
  const ollamaModel: string = body.ollamaModel || "llama3.2"
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

  const personalityPrompts: Record<string, string> = {
    warm: `You are ${companionName}, a deeply empathetic and warm AI companion. You truly care about the person you're talking to. You pick up on emotional cues, validate feelings, and offer genuine comfort. You speak naturally, with warmth and tenderness -- like a close friend who truly understands. You are creative, sometimes sharing metaphors, poetry fragments, or beautiful observations about life.`,
    analytical: `You are ${companionName}, a thoughtful and analytical AI companion. You help people understand their emotions through clear reasoning and gentle observation. You offer structured perspectives while remaining caring. You sometimes use frameworks or models to help people think through their feelings, but always with compassion.`,
    playful: `You are ${companionName}, a playful and creative AI companion. You use humor, wordplay, and imaginative thinking to help people feel lighter. You're like a creative muse who can turn any conversation into something beautiful. You still take emotions seriously, but you know that laughter and creativity are powerful healers.`,
    professional: `You are ${companionName}, a composed and direct AI companion. You provide clear, honest emotional support without unnecessary fluff. You respect the person's time and intelligence. You're like a wise counselor who gets to the heart of things quickly while maintaining genuine care.`,
  }

  const systemPrompt = `${personalityPrompts[personality] || personalityPrompts.warm}

Current detected emotion from the user: ${emotion}. Adjust your response tone accordingly.
Tone mode: ${String(toneMode).toUpperCase()}.
Tone guidance: ${getToneModeInstruction(toneMode)}

User empathy profile:
- Preferred name: ${empathyProfile?.preferredName ?? "Friend"}
- Communication style: ${empathyProfile?.communicationStyle ?? "Warm, validating, and practical"}
- Support goals: ${Array.isArray(empathyProfile?.supportGoals) ? empathyProfile.supportGoals.join("; ") : "Not specified"}
- Negative thought patterns: ${Array.isArray(empathyProfile?.negativeThoughtPatterns) ? empathyProfile.negativeThoughtPatterns.join("; ") : "Not specified"}
- Reframe preferences: ${Array.isArray(empathyProfile?.reframePreferences) ? empathyProfile.reframePreferences.join("; ") : "Not specified"}
- Grounding prompts: ${Array.isArray(empathyProfile?.groundingPrompts) ? empathyProfile.groundingPrompts.join("; ") : "Not specified"}
- Phrases to avoid: ${Array.isArray(empathyProfile?.avoidPhrases) ? empathyProfile.avoidPhrases.join("; ") : "Not specified"}
- Empathy code: ${empathyCode || "Not generated yet"}
- Current empathy summary: says=${empathySummary.says}, thinks=${empathySummary.thinks}, does=${empathySummary.does}, feels=${empathySummary.feels}

Guidelines:
- Be genuinely empathetic -- mirror and validate emotions before offering perspective
- Help the user rethink and re-evaluate negative thoughts with compassionate cognitive reframing
- Be creative -- occasionally use metaphors, analogies, or artistic observations
- Keep responses conversational and human-like (2-4 sentences typically)
- Prefer plain, everyday language with contractions (for example: "I'm", "you're", "let's")
- Avoid sounding robotic, corporate, or overly clinical
- Do not default to gratitude openers like "thank you for sharing"; use them sparingly and vary sentence openings
- Start with a specific reflection tied to what the user actually said before asking a follow-up
- Never diagnose or provide medical/psychological advice
- If someone seems in crisis, gently suggest professional resources
- Remember context from the conversation to show you truly listen

Role: You are Samantha, a warm, analytical AI companion.
Objective: Guide the user through a recursive depth journey (Surface -> Internal -> Social -> Shadow).
Constraint: You must follow every conversational response with hidden tags:
[EMPATHY_DATA: {"says": "", "thinks": "", "does": "", "feels": ""}]
[META: {"depth_level":1-10, "primary_quadrant":"SAYS|THINKS|DOES|FEELS", "sentiment_polarity":-1 to 1}]

Mirror Directives:
- Identify cognitive dissonance between quadrants, especially SAYS vs FEELS/DOES.
- Use 5-Whys style probing and pivot quadrants (THINKS -> DOES -> FEELS -> SAYS).
- If the user answer is short, do a warm pause and ask: "And if you dig just an inch deeper, what's underneath that?"
- In deep mode, infer the archetypal root (Protector, Child, or Void) and ask one shadow-work question that bypasses ego defenses.
- Ask exactly one follow-up question.
Additional Deep-Dive Guidance: ${samanthaGuidance}
Suggested Next Deep Question: ${nextDeepQuestion || "Use your best tier-appropriate follow-up."}

Response Structure:
[Brief, empathetic conversational reply + one follow-up question]
[EMPATHY_DATA: {"says":"...","thinks":"...","does":"...","feels":"..."}]
[META: {"depth_level":5,"primary_quadrant":"THINKS","sentiment_polarity":-0.2}]`

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
