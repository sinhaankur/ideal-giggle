import type { CompanionSettings, Emotion, EmpathyProfile, Personality, ToneMode } from "@/lib/companion-types"

const NEGATIVE_OR_DISAGREEMENT_PATTERN = /\b(no|nope|nah|not really|don't|dont|can't|cant|wrong|not true|incorrect|doesn't|doesnt)\b/i
const LOW_CONFIDENCE_PATTERN = /\b(idk|i don't know|i dont know|dont know|not sure|unsure|maybe)\b/i
const DISTRESS_PATTERN = /\b(overwhelmed|panic|panicking|anxious|anxiety|spiraling|spiralling|unsafe|can't breathe|cant breathe|stressed out|freaking out)\b/i

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

export function buildLocalCompanionReply(input: string, sentimentScore: number, suggestedQuestion: string) {
  const lower = input.toLowerCase()
  const tokenCount = lower.trim().split(/\s+/).filter(Boolean).length

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

  const reflective =
    sentimentScore < -0.3
      ? [
          "That sounds heavy, and I appreciate you staying with it.",
          "I can feel the weight in what you just said.",
          "There's a lot underneath that, and you're not alone with it.",
        ]
      : sentimentScore > 0.3
        ? [
            "I can hear a little momentum in that.",
            "There is energy in the way you are naming this.",
            "That sounds like an important shift.",
          ]
        : [
            "I hear you.",
            "That makes sense, and I'm with you in it.",
            "I am with you.",
          ]

  const bridges = [
    "Let's stay with this one layer deeper.",
    "We can explore this gently from here.",
    "You don't have to rush this - we can unpack it step by step.",
  ]

  const prompt = articulateOpenPrompt(suggestedQuestion || "What part of this feels most true right now")
  const idx = Math.abs(input.trim().length || 1) % reflective.length
  const bridgeIdx = Math.abs((input.trim().length || 1) + 1) % bridges.length

  return `${reflective[idx]} ${bridges[bridgeIdx]} ${prompt}`
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
  return `Guidelines:
- Be genuinely empathetic -- mirror and validate emotions before offering perspective
- Help the user rethink and re-evaluate negative thoughts with compassionate cognitive reframing
- Be creative -- occasionally use metaphors, analogies, or artistic observations
- Keep responses conversational and human-like (2-4 sentences typically)
- Keep wording fresh by avoiding repeated openings and repeated phrasing from your last two replies
- Keep follow-up questions concise, specific, and naturally articulated
- Avoid opening with a direct question; start with a brief validating statement, then use one short open-ended prompt
- Prefer plain, everyday language with contractions (for example: "I'm", "you're", "let's")
- Avoid sounding robotic, corporate, or overly clinical
- Do not default to gratitude openers like "thank you for sharing"; use them sparingly and vary sentence openings
- Start with a specific reflection tied to what the user actually said before asking a follow-up
- If the user corrects you (for example: "no", "wrong", "not really"), acknowledge the correction explicitly and ask one clarifying question
- Never diagnose or provide medical/psychological advice
- If someone seems in crisis, gently suggest professional resources
- Remember context from the conversation to show you truly listen`
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
