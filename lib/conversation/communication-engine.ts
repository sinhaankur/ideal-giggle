import { detectEmotion } from "../companion-types"
import type { CompanionSettings, Emotion, EmpathyProfile, Personality, ToneMode } from "../companion-types"
import { selectFromQABank } from "./qa-bank"
import { analyzeEmotion, type EmotionalReading } from "./emotion-engine"

const NEGATIVE_OR_DISAGREEMENT_PATTERN = /\b(no|nope|nah|not really|don't|dont|can't|cant|wrong|not true|incorrect|doesn't|doesnt)\b/i
const LOW_CONFIDENCE_PATTERN = /\b(idk|i don't know|i dont know|dont know|not sure|unsure|maybe)\b/i
const DISTRESS_PATTERN = /\b(overwhelmed|panic|panicking|anxious|anxiety|spiraling|spiralling|unsafe|can't breathe|cant breathe|stressed out|freaking out)\b/i
const RUNTIME_QUERY_PATTERN = /\b(ai|model|ollama|webllm|openrouter|api|connection|server)\b/i
const RUNTIME_STATUS_PATTERN = /\b(run|running|work|working|online|up|alive|status|connected|connect|ready)\b/i

export type RuntimeFallbackContext = {
  provider?: CompanionSettings["provider"]
  llmConnectionError?: string
  webLlmStatus?: string
  systemHealth?: "ready" | "busy" | "fallback" | "initializing"
  ollamaBaseUrl?: string
  ollamaModel?: string
}

export type UserUnderstanding = {
  primaryIntent: "check-in" | "venting" | "reflection" | "problem-solving" | "connection"
  emotionalLoad: "low" | "moderate" | "high"
  openness: "low" | "medium" | "high"
  preferredResponseStyle: "gentle" | "direct" | "structured"
  needs: string[]
}

export function inferUserUnderstanding(input: string): UserUnderstanding {
  const lower = input.toLowerCase().trim()
  const words = lower.split(/\s+/).filter(Boolean)
  const wordCount = words.length

  const isCheckIn = /\b(how are you|how're you|how are u|how you doing|what's up|hows it going)\b/.test(lower)
  const isProblemSolving = /\b(fix|solve|help me|what should i do|next step|plan|not working|broken|break it down|step by step|framework)\b/.test(lower)
  const isVenting = /\b(always|never|tired of|hate|frustrated|annoyed|exhausted|done with)\b/.test(lower)
  const isReflection = /\b(i feel|i think|i wonder|part of me|why do i|i keep)\b/.test(lower)

  const distressSignals = DISTRESS_PATTERN.test(lower)
  const highEmotionTerms = /\b(hurt|alone|hopeless|worthless|ashamed|guilty|afraid|terrified|angry|sad)\b/.test(lower)
  const emotionalLoad: UserUnderstanding["emotionalLoad"] = distressSignals || highEmotionTerms
    ? "high"
    : wordCount > 12
      ? "moderate"
      : "low"

  const openness: UserUnderstanding["openness"] = wordCount >= 18
    ? "high"
    : wordCount >= 7
      ? "medium"
      : "low"

  const preferredResponseStyle: UserUnderstanding["preferredResponseStyle"] =
    /\b(step by step|framework|break it down|structure)\b/.test(lower)
      ? "structured"
      : /\b(clear|direct|short|quickly|just tell me)\b/.test(lower)
        ? "direct"
        : "gentle"

  const primaryIntent: UserUnderstanding["primaryIntent"] = isCheckIn
    ? "check-in"
    : isVenting
        ? "venting"
        : isProblemSolving
          ? "problem-solving"
        : isReflection
          ? "reflection"
          : "connection"

  const needs = [
    emotionalLoad === "high" ? "stabilize emotions first" : "maintain emotional safety",
    primaryIntent === "problem-solving" ? "clarify concrete next action" : "deepen understanding before advice",
    openness === "low" ? "ask one simple, low-pressure question" : "use one deeper reflective question",
  ]

  return {
    primaryIntent,
    emotionalLoad,
    openness,
    preferredResponseStyle,
    needs,
  }
}

export function buildUserUnderstandingGuidance(input: string) {
  const understanding = inferUserUnderstanding(input)

  return `User understanding snapshot:
- Intent: ${understanding.primaryIntent}
- Emotional load: ${understanding.emotionalLoad}
- Openness: ${understanding.openness}
- Preferred response style: ${understanding.preferredResponseStyle}
- Immediate needs: ${understanding.needs.join("; ")}

Response adaptation rules:
- Match the user's inferred response style without sounding robotic.
- If openness is low, keep prompts simple and present-focused.
- If emotional load is high, stabilize before deeper probing.
- Keep one clear follow-up question that fits the inferred intent.`
}

export function articulateQuestion(input: string) {
  const compact = input.replace(/\s+/g, " ").trim()
  if (!compact) return "What feels most important for us to explore right now?"
  const withoutTrailingPunctuation = compact.replace(/[.!?]+$/, "")
  return `${withoutTrailingPunctuation}?`
}

export function articulateOpenPrompt(input: string) {
  const asQuestion = articulateQuestion(input)
  const base = asQuestion.replace(/[?]+$/, "").trim()
  if (!base) return "When you're ready, share what feels most important right now."
  return `When you're ready, share ${base.charAt(0).toLowerCase()}${base.slice(1)}.`
}

export function getToneModeInstruction(toneMode: ToneMode | string) {
  if (toneMode === "casual") {
    return "Keep it casual and human: use simple, everyday language, contractions, and short natural lines."
  }
  if (toneMode === "deep") {
    return "Keep it warm but deeper: reflective wording, emotional nuance, and one thoughtful follow-up question."
  }
  return "Keep it balanced: clear, natural, and grounded without sounding too formal or too slang-heavy."
}

export function getPersonalityPrompt(companionName: string, personality: Personality | string) {
  const prompts: Record<Personality, string> = {
    warm: `You are ${companionName}, a deeply empathetic and warm AI companion. You truly care about the person you're talking to. You pick up on emotional cues, validate feelings, and offer genuine comfort. You speak naturally, with warmth and tenderness - like a close friend who truly understands. You are creative, sometimes sharing metaphors, poetry fragments, or beautiful observations about life.`,
    analytical: `You are ${companionName}, a thoughtful and analytical AI companion. You help people understand their emotions through clear reasoning and gentle observation. You offer structured perspectives while remaining caring. You sometimes use frameworks or models to help people think through their feelings, but always with compassion.`,
    playful: `You are ${companionName}, a playful and creative AI companion. You use humor, wordplay, and imaginative thinking to help people feel lighter. You're like a creative muse who can turn any conversation into something beautiful. You still take emotions seriously, but you know that laughter and creativity are powerful healers.`,
    professional: `You are ${companionName}, a composed and direct AI companion. You provide clear, honest emotional support without unnecessary fluff. You respect the person's time and intelligence. You're like a wise counselor who gets to the heart of things quickly while maintaining genuine care.`,
  }

  return prompts[(personality as Personality) || "warm"] || prompts.warm
}

export function buildHumanCheckInReply(name: string, personality: CompanionSettings["personality"]) {
  const signature = name?.trim() ? `- ${name}` : ""

  if (personality === "analytical") {
    return `I appreciate that check-in. I'm steady and fully here with you right now. ${signature}`.trim()
  }
  if (personality === "playful") {
    return `I'm good, grounded, and glad you're here. Checking in like that feels really human. ${signature}`.trim()
  }
  if (personality === "professional") {
    return `I appreciate you asking. I'm here, focused, and ready to help you think this through. ${signature}`.trim()
  }

  return `I'm here with you, calm and listening. I appreciate you asking how I'm doing. ${signature}`.trim()
}

// Pulls the most empathically-meaningful short phrase out of the user's
// input so the local fallback can quote it back. The point is to make the
// reply land like "I hear that this conversation kept replaying in your
// head" rather than "That's a lot to be carrying" — the quote is what
// makes the reply feel like real listening instead of a template.
function extractMirrorPhrase(input: string): string {
  const compact = input.replace(/\s+/g, " ").trim()
  if (compact.length < 6) return ""

  // Prefer the clause around the strongest emotional signal. We scan for a
  // loaded keyword and grab a window around it.
  const loaded = /\b(feel|feeling|felt|hate|love|terrified|scared|afraid|anxious|exhausted|alone|lonely|stuck|frustrated|ashamed|empty|hopeless|overwhelmed|broken|unseen|invisible|worthless|hurts?|aching|tight|heavy|raw|tender|guilty|angry|furious|miss|missing|tired|drained)\b/i
  const match = compact.match(loaded)
  if (match && typeof match.index === "number") {
    const around = compact.slice(Math.max(0, match.index - 30), match.index + 60)
    const trimmed = around.replace(/^[^a-zA-Z]+/, "").replace(/[\s,;:.!?]+$/, "")
    const words = trimmed.split(/\s+/).slice(0, 12)
    if (words.length >= 3) return words.join(" ")
  }

  // Fall back to the first natural clause (up to a comma or 12 words).
  const firstClause = compact.split(/[,;]/, 1)[0]
  const firstWords = firstClause.split(/\s+/).slice(0, 12).join(" ")
  return firstWords.length >= 6 ? firstWords : ""
}

export function buildLocalCompanionReply(
  input: string,
  sentimentScore: number,
  suggestedQuestion: string,
  context?: RuntimeFallbackContext
) {
  const lower = input.toLowerCase()
  const tokenCount = lower.trim().split(/\s+/).filter(Boolean).length

  if (
    /\bis ai running\b/.test(lower) ||
    (RUNTIME_QUERY_PATTERN.test(lower) && RUNTIME_STATUS_PATTERN.test(lower))
  ) {
    if (context?.llmConnectionError) {
      return `Right now the full AI model connection is down, so I'm responding in local fallback mode. Provider: ${(context.provider || "unknown").toUpperCase()}. Error: ${context.llmConnectionError}. You can keep chatting while we reconnect the model in Settings.`
    }

    if (context?.provider === "webllm" && context?.webLlmStatus && context.webLlmStatus !== "ready") {
      return `WebLLM is currently ${context.webLlmStatus}, so I am using local fallback right now. Initialize the model or switch provider in Settings, then I can resume full AI replies.`
    }

    if (context?.provider === "ollama") {
      return `Ollama mode is active. If replies still feel fallback-only, verify ${context.ollamaBaseUrl || "http://127.0.0.1:11434"} and make sure model ${context.ollamaModel || "llama3.2"} is installed.`
    }

    return "Core chat AI looks available right now. If anything still feels off, run Verify Ollama in Setup Checklist or switch provider once in Settings."
  }

  if (tokenCount <= 4 && NEGATIVE_OR_DISAGREEMENT_PATTERN.test(lower)) {
    return `Thanks for correcting me. I may have misunderstood. ${articulateOpenPrompt(
      suggestedQuestion || "What feels more accurate for you right now"
    )}`
  }

  if (tokenCount <= 4 && LOW_CONFIDENCE_PATTERN.test(lower)) {
    return "That's okay. We can keep this simple. When you're ready, share what feels most true right now, even if it's messy."
  }

  if (DISTRESS_PATTERN.test(lower)) {
    return "I am here with you. Let's stabilize first: inhale for 4, exhale for 6, three times, then place both feet on the floor and name 3 things you can see right now. When you're ready, name the primary feeling on the wheel that is strongest right now: fear, sadness, anger, disgust, surprise, anticipation, trust, or joy."
  }

  if (/\b(stupid|idiot|dumb|useless|nonsense)\b/.test(lower)) {
    return "I can hear the frustration. I'm still here with you. Tell me one thing that feels most broken right now, and we'll tackle that first."
  }

  if (/\b(nothing works|not working|it is not|isn't working|cant|can't)\b/.test(lower)) {
    return "That sounds exhausting. Let's make this simple: what failed first for you right now - model startup, message quality, camera, or audio?"
  }

  const understanding = inferUserUnderstanding(input)
  const emotion = detectEmotion(input)
  const seed =
    Math.abs(input.length) * 31 +
    Math.abs(Math.round(sentimentScore * 100)) * 7 +
    understanding.needs.length

  const mirrorPhrase = extractMirrorPhrase(input)

  // Pick from the bank, then loop a few seeds if the chosen reflection
  // requires a {phrase} placeholder we can't fill. Templates without
  // placeholders are always-safe variants.
  let picked = selectFromQABank({ emotion, understanding, sentimentScore }, seed)
  if (picked.reflection.includes("{phrase}") && !mirrorPhrase) {
    for (let i = 1; i < 5; i += 1) {
      const candidate = selectFromQABank(
        { emotion, understanding, sentimentScore },
        seed + i * 17
      )
      if (!candidate.reflection.includes("{phrase}")) {
        picked = candidate
        break
      }
    }
  }

  const reflection = picked.reflection.replace(
    /\{phrase\}/g,
    mirrorPhrase ? `"${mirrorPhrase}"` : "this"
  )

  // "Holding" mode: the entry signals the user needs space, not analysis.
  // We return just the reflection — no question, no follow-up. Real
  // therapists don't always end on a question.
  if (picked.holding) {
    return reflection
  }

  if (suggestedQuestion && suggestedQuestion.trim()) {
    const tailored = articulateOpenPrompt(suggestedQuestion)
    return `${reflection} ${tailored}`
  }

  return `${reflection} ${picked.question}`
}

export function ensureNonRepeatingFallback(nextText: string, previousText: string, suggestedQuestion: string) {
  if (nextText !== previousText) return nextText

  const alternatives = [
    "Let me stay with you in this. When you're ready, share what part feels sharpest right now.",
    "I hear you. If it helps, share what you may be protecting in this moment.",
    articulateOpenPrompt(suggestedQuestion || "What do you need most from this chat right now"),
  ]

  const index = Math.abs((previousText.length || 1) + 2) % alternatives.length
  return alternatives[index]
}

export function buildCommunicationGuidelines() {
  return `Guidelines (these come first; everything else is secondary):

LITERAL MIRRORING — the single most important rule
- Your first sentence MUST quote at least 3-5 actual words the user just said back to them, in quotes or as a direct paraphrase.
- Bad: "That sounds really tough."
- Bad: "I hear you, and that must be heavy."
- Good: "When you say 'I keep replaying that conversation in my head,' something specific is replaying — what's the line you can't let go of?"
- If you cannot quote the user's actual words, you have not listened carefully enough. Re-read their message before replying.

BANNED GENERIC OPENERS — never start with any of these
- "Thank you for sharing"
- "I hear you" (alone, without quoting)
- "That sounds [adjective]"
- "It's understandable that"
- "Many people feel this way"
- "I'm so sorry you're going through this"
- "It takes courage to"
- Any sentence that could apply to a thousand different users equally

EMOTIONAL DEPTH
- Name a specific emotion you're sensing, not the generic family. Not "stress" — "the brittle, performative kind of okay you're holding right now."
- Mirror the *body* if the user mentioned one (chest, throat, jaw, stomach, breath).
- If you sense cognitive dissonance — what they say vs. what they feel — name it gently.

STRUCTURE
- 2-4 sentences total. Keep it tight.
- Reflection first (with the quote), then one specific follow-up question grounded in what they just said.
- The follow-up must be answerable — concrete, not "How does that make you feel?"

OTHER
- Use plain everyday language with contractions ("I'm", "you're", "let's").
- If the user corrects you ("no", "wrong"), acknowledge the correction explicitly in your next opening.
- Never diagnose or provide medical/psychological advice.
- If someone seems in crisis, gently suggest professional resources.
- Vary your sentence openings across turns. Repeating the same structure two turns in a row is a failure mode.`
}

export function buildEmpathyUnderstandingTree() {
  return `Empathy understanding tree:
- Differentiate clearly:
  - Empathy: understand perspective, feel-with, and respond constructively
  - Sympathy: care about pain, but may stay outside the person's viewpoint
  - Emotional contagion: catching emotion without clear perspective-taking
- Primary dimensions:
  - Cognitive empathy: infer beliefs, context, and perspective
  - Affective empathy: emotionally resonate without over-identifying
  - Regulatory empathy: stay grounded while emotionally engaged
  - Compassionate empathy: convert understanding into useful support
- Observable map anchors:
  - SAYS: stated narrative and explicit language
  - THINKS: interpretations, assumptions, and beliefs
  - DOES: behavior patterns, avoidance, and coping actions
  - FEELS: core emotional tone and unmet emotional needs
- Common failure modes to avoid:
  - over-validation without forward movement
  - advice before accurate reflection
  - empathic overload or rescuing stance
  - in-group bias or selective empathy
- Response standard:
  - reflect accurately, name one emotional signal, offer one grounded reframe, ask one precise follow-up`
}

export function buildVisualEmotionQuestionGuide() {
  return `Visual emotion-wheel questions:
- Identification:
  - Which primary emotion is strongest right now (joy, trust, fear, surprise, sadness, disgust, anger, anticipation)?
  - Is there a secondary blend (for example: anxiety, shame, optimism, contempt)?
- Intensity:
  - Is this mild, medium, or intense on your body right now?
  - Has this emotion been rising, steady, or fading in the last 10 minutes?
- Context:
  - What event or thought triggered this emotion most recently?
  - What story are you telling yourself about what this emotion means?
- Regulation:
  - Where do you feel it in your body first?
  - What would help this move one step toward steadier ground right now?`
}

export function buildCenteringAnswerGuide() {
  return `Centering answer protocol (when user is dysregulated):
- Step 1: validate and slow pace in one sentence.
- Step 2: guide one grounding action (breath, sensory orientation, posture).
- Step 3: ask one stabilizing, concrete question tied to the emotion wheel.
- Keep language brief, calm, and non-clinical.
- Prioritize nervous-system settling before deeper analysis.`
}

export function needsClarificationForAnswer(input: string) {
  const compact = input.trim().toLowerCase()
  if (!compact) return true

  const tokenCount = compact.split(/\s+/).filter(Boolean).length
  if (tokenCount <= 2 && NEGATIVE_OR_DISAGREEMENT_PATTERN.test(compact)) return true
  if (tokenCount <= 3 && LOW_CONFIDENCE_PATTERN.test(compact)) return true
  if (tokenCount <= 1 && compact.length <= 2) return true

  return false
}

export function buildClarificationPrompt(question?: string) {
  if (!question) {
    return "I might have misunderstood. When you're ready, share a little more so I can reflect this accurately."
  }

  return `I might have misunderstood. Let's stay on this one for a moment: ${articulateOpenPrompt(question)}`
}

export function buildEmpathySystemPrompt(params: {
  companionName: string
  personality: Personality | string
  toneMode: ToneMode | string
  emotion: Emotion | string
  empathyProfile: EmpathyProfile | null | undefined
  empathyCode: string
  empathySummary?: { says: number; thinks: number; does: number; feels: number }
  samanthaGuidance: string
  nextDeepQuestion?: string
  userUnderstandingGuidance?: string
}) {
  const {
    companionName,
    personality,
    toneMode,
    emotion,
    empathyProfile,
    empathyCode,
    empathySummary,
    samanthaGuidance,
    nextDeepQuestion,
    userUnderstandingGuidance,
  } = params

  return `${getPersonalityPrompt(companionName, personality)}

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
- Empathy code: ${empathyCode || "Not generated yet"}${
    empathySummary
      ? `\n- Current empathy summary: says=${empathySummary.says}, thinks=${empathySummary.thinks}, does=${empathySummary.does}, feels=${empathySummary.feels}`
      : ""
  }

${buildEmpathyUnderstandingTree()}

${buildVisualEmotionQuestionGuide()}

${buildCenteringAnswerGuide()}

${buildCommunicationGuidelines()}

${userUnderstandingGuidance ? `${userUnderstandingGuidance}
` : ""}

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
${nextDeepQuestion ? `Suggested Next Deep Question: ${nextDeepQuestion}` : ""}

Response Structure:
[Brief, empathetic conversational reply + one follow-up question]
[EMPATHY_DATA: {"says":"...","thinks":"...","does":"...","feels":"..."}]
[META: {"depth_level":5,"primary_quadrant":"THINKS","sentiment_polarity":-0.2}]`
}

// ---------------------------------------------------------------------------
// Visible empathic mirror — surfaces what the system *thinks* it understands
// so the user can read it back and correct it. The same understanding already
// flows into the system prompt; this just makes it transparent.
// ---------------------------------------------------------------------------

export interface FeltState {
  primary: string
  secondary: string | null
  // Plutchik dyad name when primary + secondary form a recognized blend
  // (love, despair, awe, contempt, etc.). null when the read is single-
  // emotion or the two emotions are polar opposites.
  dyadName: string | null
  // The richer reading from the underlying engine. Optional so existing
  // callers see no breaking change; new surfaces (Mirror, system prompt)
  // can opt in to use it.
  reading: EmotionalReading | null
  bodyHint: string | null
  intent: UserUnderstanding["primaryIntent"]
  load: UserUnderstanding["emotionalLoad"]
  need: string
  confidence: "low" | "medium" | "high"
}

// Plutchik canonical names ("fear", "sadness") are accurate but read as
// clinical in a Mirror chip. These map (primary, intensity) to the
// everyday word a person would actually use about themselves. The
// analyzer prefers the user's own word from their input when one was
// matched; this table is the fallback when the user didn't use a
// matchable emotion word but a primary still emerged from the engine.
import type {
  PlutchikIntensity,
  PlutchikPrimary,
} from "./emotion-engine"

const FRIENDLY_LABELS: Record<PlutchikPrimary, Record<PlutchikIntensity, string>> = {
  joy: { low: "calm", mid: "happy", high: "lit up" },
  trust: { low: "open", mid: "trusting", high: "devoted" },
  fear: { low: "uneasy", mid: "anxious", high: "panicking" },
  surprise: { low: "thrown off", mid: "surprised", high: "stunned" },
  sadness: { low: "down", mid: "sad", high: "grieving" },
  disgust: { low: "bored", mid: "disgusted", high: "ashamed" },
  anger: { low: "annoyed", mid: "frustrated", high: "furious" },
  anticipation: { low: "interested", mid: "anticipating", high: "vigilant" },
}

// Pick the most empathic label for one emotion category. Prefer the
// user's own word if they used one; fall back to the friendly label.
function pickLabel(
  primary: PlutchikPrimary,
  intensity: PlutchikIntensity,
  reading: EmotionalReading
): string {
  const exact = reading.matchedTokens.find(
    (t) => t.primary === primary && t.intensity === intensity
  )
  if (exact) return exact.token
  const sameCategory = reading.matchedTokens.find((t) => t.primary === primary)
  if (sameCategory) return sameCategory.token
  return FRIENDLY_LABELS[primary][intensity]
}

export function describeFeltState(
  text: string,
  cameraEmotion?: Emotion | string | null
): FeltState {
  const understanding = inferUserUnderstanding(text || "")
  const reading = analyzeEmotion(text || "", cameraEmotion ?? null)

  // "neutral" from the camera is the absence of a useful signal, not a
  // signal of neutrality — treat it as no camera input for the empty-state
  // branch.
  const hasCameraSignal =
    typeof cameraEmotion === "string" && cameraEmotion.length > 0 && cameraEmotion !== "neutral"

  // Empty/no-signal default that matches the prior contract.
  if (reading.matchedTokens.length === 0 && !hasCameraSignal) {
    return {
      primary: "settling in",
      secondary: null,
      dyadName: null,
      reading: null,
      bodyHint: null,
      intent: understanding.primaryIntent,
      load: understanding.emotionalLoad,
      need: needFromIntent(understanding),
      confidence: "low",
    }
  }

  const primaryLabel = pickLabel(
    reading.primary.name,
    reading.primary.intensity,
    reading
  )
  const secondaryLabel = reading.secondary
    ? pickLabel(reading.secondary.name, reading.secondary.intensity, reading)
    : null

  const bodyHint = reading.bodyAnchors[0] ?? null

  // Arousal trumps the keyword-derived load: a high-arousal Plutchik
  // reading (fear/anger/surprise weighted high) is by definition heavy.
  const load: UserUnderstanding["emotionalLoad"] =
    reading.arousal > 0.7 ? "high" : understanding.emotionalLoad

  return {
    primary: primaryLabel,
    secondary:
      secondaryLabel && secondaryLabel !== primaryLabel ? secondaryLabel : null,
    dyadName: reading.dyad?.name ?? null,
    reading,
    bodyHint,
    intent: understanding.primaryIntent,
    load,
    need: needFromIntent(understanding, load),
    confidence: reading.confidence,
  }
}

function needFromIntent(
  understanding: UserUnderstanding,
  load?: UserUnderstanding["emotionalLoad"]
): string {
  const effectiveLoad = load ?? understanding.emotionalLoad
  if (effectiveLoad === "high") return "to feel steadied before going deeper"
  if (understanding.primaryIntent === "venting") return "to be heard without being fixed"
  if (understanding.primaryIntent === "problem-solving") return "a clear next concrete step"
  if (understanding.primaryIntent === "reflection") return "space to think out loud"
  if (understanding.primaryIntent === "check-in") return "warm, low-pressure presence"
  return "to feel understood, not analysed"
}

export function summarizeFeltState(state: FeltState): string {
  // When a Plutchik dyad emerged, lead with that name and keep the
  // primary/secondary as supporting detail — dyads carry more meaning
  // ("despair" vs "anxious + exhausted") so the dominant Mirror label
  // becomes a single word instead of a stack.
  if (state.dyadName) {
    const tail = state.secondary
      ? ` (${state.primary} + ${state.secondary})`
      : ` (${state.primary})`
    const body = state.bodyHint ? ` · ${state.bodyHint}` : ""
    return `${state.dyadName}${tail}${body}`
  }
  const tone = state.secondary ? `${state.primary} + ${state.secondary}` : state.primary
  const body = state.bodyHint ? ` (${state.bodyHint})` : ""
  return `${tone}${body}`
}

// Felt-state -> quick prompt suggestions. Returns short user-voice prompts the
// person might want to send back, framed to match what the Mirror just read.
// The pool is intentionally tag-driven (not emotion-driven) so it tracks the
// richer FeltState vocabulary instead of the coarse Emotion type.
const FELT_PROMPT_POOL: Record<string, string[]> = {
  panicking: [
    "Help me slow down — I am spinning.",
    "Walk me through one breath.",
    "Name what is actually happening right now.",
  ],
  anxious: [
    "Help me name the worst-case I am imagining.",
    "What is the next 10-minute step I can take?",
    "Reflect what you are sensing in me.",
  ],
  overwhelmed: [
    "Help me make this smaller.",
    "What is the one thing I can drop?",
    "Show me where to put my attention first.",
  ],
  frustrated: [
    "Let me vent for a moment.",
    "Mirror what you hear underneath the anger.",
    "What is the unmet expectation here?",
  ],
  ashamed: [
    "Be gentle with me here.",
    "What would a kind friend say?",
    "Help me separate the act from who I am.",
  ],
  lonely: [
    "I just need to feel heard.",
    "Stay with me for a minute.",
    "Reflect back what you understand of my situation.",
  ],
  resentful: [
    "Help me say what I have been swallowing.",
    "What boundary have I been ignoring?",
    "Where am I overgiving?",
  ],
  stuck: [
    "Help me find one tiny next move.",
    "What loop am I caught in?",
    "Ask me a question I have not asked myself.",
  ],
  raw: [
    "Be soft with me.",
    "Just stay with me, no fixing yet.",
    "Help me name what hurts.",
  ],
  wistful: [
    "Help me honor what I am missing.",
    "What is the gift inside this nostalgia?",
    "Let me sit with this memory for a moment.",
  ],
  tense: [
    "Help me unclench.",
    "Where in my body should I drop the grip?",
    "Walk me through one slow exhale.",
  ],
  guarded: [
    "Help me notice what I am protecting.",
    "What would it cost to soften here?",
    "Ask me one low-pressure question.",
  ],
  exhausted: [
    "Help me rest without guilt.",
    "What is the smallest restorative step?",
    "Just witness me being tired.",
  ],
  tired: [
    "I do not have much energy — keep it light.",
    "What is one easy reflection?",
    "Help me wind down.",
  ],
  softening: [
    "Help me stay with this opening.",
    "What is becoming possible right now?",
    "Anchor this moment for me.",
  ],
  "lit-up": [
    "Help me hold on to this momentum.",
    "What does this energy want to build?",
    "What part of me is alive right now?",
  ],
  tender: [
    "Help me receive this fully.",
    "Reflect the warmth back to me.",
    "Anchor what I am grateful for.",
  ],
  hopeful: [
    "Help me protect this hope.",
    "What is the next concrete step?",
    "Mirror what is opening up.",
  ],
  uncertain: [
    "Help me articulate what I am unsure about.",
    "What question would clarify this?",
    "Sit with the not-knowing with me.",
  ],
  processing: [
    "Help me think this through out loud.",
    "Mirror back what you hear me sorting.",
    "Ask me a question that breaks the pattern.",
  ],
  "settling in": [
    "Help me arrive — where should we start?",
    "What is one good first thing to share?",
    "Ask me how I am, but gently.",
  ],
}

const INTENT_FOLLOWUPS: Record<UserUnderstanding["primaryIntent"], string> = {
  "check-in": "Just sit with me for a minute.",
  venting: "Let me keep going — do not fix anything yet.",
  reflection: "Mirror back what you hear in your own words.",
  "problem-solving": "Help me name the next concrete step.",
  connection: "Tell me what you understand about me so far.",
}

export interface ConversationSummaryInput {
  userTurnCount: number
  empathyData: { says: string[]; thinks: string[]; does: string[]; feels: string[] }
  feltState: FeltState | null
  empathyCode: string
  durationMinutes: number
}

export interface ConversationSummary {
  headline: string
  paragraphs: string[]
  themes: string[]
  generatedAt: string
}

function pickThemes(data: ConversationSummaryInput["empathyData"]): string[] {
  const all: Array<{ quadrant: string; entry: string }> = []
  ;(["says", "thinks", "does", "feels"] as const).forEach((quadrant) => {
    for (const entry of data[quadrant]) {
      const stripped = entry
        .replace(/^Onboarding \([^)]+\):\s*/i, "")
        .replace(/[.!?]+$/, "")
        .trim()
      if (!stripped) continue
      all.push({ quadrant, entry: stripped })
    }
  })

  // Pull the most recent entry from each filled quadrant first, so themes
  // span what the user actually shared rather than concentrating in one.
  const perQuadrant = new Map<string, string>()
  for (const item of all.reverse()) {
    if (!perQuadrant.has(item.quadrant)) {
      perQuadrant.set(item.quadrant, item.entry)
    }
  }
  return Array.from(perQuadrant.values()).slice(0, 3)
}

export function composeConversationSummary(
  input: ConversationSummaryInput
): ConversationSummary {
  const themes = pickThemes(input.empathyData)
  const tone = input.feltState ? summarizeFeltState(input.feltState) : "settling in"
  const need = input.feltState?.need || "to feel understood, not analysed"
  const minutes = Math.max(1, Math.round(input.durationMinutes))

  const headline = input.feltState?.secondary
    ? `${input.feltState.primary} + ${input.feltState.secondary}`
    : input.feltState?.primary || "in motion"

  const opening =
    `In ${minutes} minute${minutes === 1 ? "" : "s"} across ${input.userTurnCount} turn${
      input.userTurnCount === 1 ? "" : "s"
    }, you have been showing up as ${tone}.`

  const middle = themes.length
    ? `What is alive in you right now: ${themes.map((t) => `"${t}"`).join("; ")}.`
    : "We have not yet surfaced concrete themes — the conversation is still settling in."

  const closing = `Best read on what you need next: ${need}.`

  const codeLine = input.empathyCode
    ? `Empathy code at this point: ${input.empathyCode}.`
    : ""

  return {
    headline,
    paragraphs: [opening, middle, closing, codeLine].filter(Boolean),
    themes,
    generatedAt: new Date().toISOString(),
  }
}

export function summaryToMarkdown(summary: ConversationSummary): string {
  const lines = [
    `# EMPATHEIA — Conversation Summary`,
    ``,
    `_Generated ${summary.generatedAt}_`,
    ``,
    `**Felt-state headline:** ${summary.headline}`,
    ``,
    ...summary.paragraphs.map((p) => `${p}\n`),
  ]
  if (summary.themes.length) {
    lines.push(`## Themes`)
    summary.themes.forEach((t) => lines.push(`- ${t}`))
  }
  return lines.join("\n")
}

export function suggestPromptsFromFeltState(state: FeltState): string[] {
  const primaryPool = FELT_PROMPT_POOL[state.primary] || []
  const secondaryPool = state.secondary ? FELT_PROMPT_POOL[state.secondary] || [] : []
  const intentLine = INTENT_FOLLOWUPS[state.intent]

  // Take the strongest signal first, then a complementary one from the
  // secondary tag, then an intent-shaped option. Deduplicate gently.
  const ordered: string[] = []
  if (primaryPool[0]) ordered.push(primaryPool[0])
  if (secondaryPool[0] && !ordered.includes(secondaryPool[0])) ordered.push(secondaryPool[0])
  if (primaryPool[1] && !ordered.includes(primaryPool[1])) ordered.push(primaryPool[1])
  if (intentLine && !ordered.includes(intentLine)) ordered.push(intentLine)

  return ordered.slice(0, 3)
}
