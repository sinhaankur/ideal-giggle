// The communication engine's emotion analyzer. Given free-text input
// (and optionally a coarse camera-detected emotion), produce a rich
// EmotionalReading rooted in Plutchik's wheel.
//
// Algorithm:
//   1. Lowercase + tokenize the text.
//   2. Greedily match multi-token lexicon phrases first, then single
//      tokens, accumulating Plutchik-keyed weights with intensity.
//   3. Walk modifiers (intensifiers, negators) within a small window
//      and apply their multipliers / valence flips to nearby tokens.
//   4. Optionally fold in the camera-detected emotion as a soft signal.
//   5. Pick the top primary by weight; pick the second-highest as
//      secondary if it's not the polar opposite of the first.
//   6. If primary + secondary form a Plutchik dyad, look it up (love,
//      despair, awe, etc.) and emit it as the dominant label.
//   7. Compute valence and arousal from primary/secondary blends.
//   8. Pull body anchors via regex.
//
// The reading is deterministic and runs in microseconds — no model
// inference required, which is the point: the engine still works
// completely offline and is the floor when an LLM isn't loaded.

import {
  PLUTCHIK_AROUSAL,
  PLUTCHIK_INTENSITY_LABELS,
  PLUTCHIK_OPPOSITES,
  PLUTCHIK_VALENCE,
  findDyad,
  type PlutchikDyad,
  type PlutchikIntensity,
  type PlutchikPrimary,
} from "./plutchik"
import { MULTI_TOKEN_PHRASES, lookupLexicon } from "./lexicon"
import { MODIFIER_WINDOW, getModifierEffect } from "./modifiers"
import { findBodyAnchors } from "./body"

export interface EmotionalReading {
  primary: { name: PlutchikPrimary; intensity: PlutchikIntensity; weight: number }
  secondary: { name: PlutchikPrimary; intensity: PlutchikIntensity; weight: number } | null
  dyad: PlutchikDyad | null
  // The single most precise label the engine produces — either the dyad
  // name, or the intensity label of the primary if there's no dyad.
  label: string
  valence: number // -1..1
  arousal: number // 0..1
  bodyAnchors: string[]
  matchedTokens: Array<{ token: string; primary: PlutchikPrimary; intensity: PlutchikIntensity }>
  confidence: "low" | "medium" | "high"
}

const INTENSITY_WEIGHT: Record<PlutchikIntensity, number> = {
  low: 0.5,
  mid: 1,
  high: 1.6,
}

const INTENSITY_ORDER: PlutchikIntensity[] = ["low", "mid", "high"]

function tokenize(text: string): string[] {
  // Keep apostrophes inside words ("don't"), split on whitespace + punctuation.
  return text
    .toLowerCase()
    .replace(/[.,!?;:()"\[\]{}]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
}

interface PrimaryAccumulator {
  weight: number
  // Track which intensity tier(s) contributed so we can pick the right
  // intensity label for the final reading.
  intensityHits: Record<PlutchikIntensity, number>
}

function emptyAccumulator(): PrimaryAccumulator {
  return { weight: 0, intensityHits: { low: 0, mid: 0, high: 0 } }
}

function topIntensity(acc: PrimaryAccumulator): PlutchikIntensity {
  let best: PlutchikIntensity = "mid"
  let bestVal = -1
  for (const tier of INTENSITY_ORDER) {
    if (acc.intensityHits[tier] > bestVal) {
      best = tier
      bestVal = acc.intensityHits[tier]
    }
  }
  return best
}

// Camera emotion → Plutchik nudge. The face-api emotions are coarse but
// they're a real signal — we add a small weight so a happy face nudges
// the read toward joy without overriding clear textual evidence.
const CAMERA_TO_PLUTCHIK: Record<string, PlutchikPrimary | null> = {
  happy: "joy",
  sad: "sadness",
  angry: "anger",
  fear: "fear",
  surprise: "surprise",
  thinking: "anticipation",
  neutral: null,
}

const CAMERA_NUDGE_WEIGHT = 0.4

interface MatchedRange {
  token: string
  start: number // index in the tokens array
  end: number // exclusive
  primary: PlutchikPrimary
  intensity: PlutchikIntensity
}

function greedyMatchPhrases(tokens: string[]): MatchedRange[] {
  const matches: MatchedRange[] = []
  const consumed = new Array(tokens.length).fill(false)

  // First pass: multi-token phrases, longest first (already sorted).
  for (const phrase of MULTI_TOKEN_PHRASES) {
    const phraseTokens = phrase.split(" ")
    if (phraseTokens.length < 2) continue
    for (let i = 0; i + phraseTokens.length <= tokens.length; i += 1) {
      let matched = true
      for (let j = 0; j < phraseTokens.length; j += 1) {
        if (consumed[i + j] || tokens[i + j] !== phraseTokens[j]) {
          matched = false
          break
        }
      }
      if (matched) {
        const entry = lookupLexicon(phrase)
        if (entry) {
          matches.push({
            token: phrase,
            start: i,
            end: i + phraseTokens.length,
            primary: entry.primary,
            intensity: entry.intensity,
          })
          for (let j = 0; j < phraseTokens.length; j += 1) consumed[i + j] = true
        }
      }
    }
  }

  // Second pass: single tokens.
  for (let i = 0; i < tokens.length; i += 1) {
    if (consumed[i]) continue
    const entry = lookupLexicon(tokens[i])
    if (entry) {
      matches.push({
        token: tokens[i],
        start: i,
        end: i + 1,
        primary: entry.primary,
        intensity: entry.intensity,
      })
    }
  }

  matches.sort((a, b) => a.start - b.start)
  return matches
}

// Walk the tokens once, find modifiers, and for each modifier accumulate
// a multiplier/negation that applies to the next emotion-bearing match
// within MODIFIER_WINDOW tokens. Returns a per-match adjustment.
function computeModifierAdjustments(
  tokens: string[],
  matches: MatchedRange[]
): Array<{ multiplier: number; negate: boolean }> {
  const result = matches.map(() => ({ multiplier: 1, negate: false }))

  // Multi-token modifiers ("kind of", "sort of") are checked first as
  // 2-grams, then we fall through to single-token. We track which token
  // positions have already been "consumed" by a 2-gram modifier so we
  // don't double-count.
  const consumedByModifier = new Array(tokens.length).fill(false)

  for (let i = 0; i < tokens.length - 1; i += 1) {
    const bigram = `${tokens[i]} ${tokens[i + 1]}`
    const effect = getModifierEffect(bigram)
    if (!effect) continue
    consumedByModifier[i] = true
    consumedByModifier[i + 1] = true
    for (let m = 0; m < matches.length; m += 1) {
      if (matches[m].start <= i + 1) continue
      if (matches[m].start - (i + 1) > MODIFIER_WINDOW) break
      result[m].multiplier *= effect.multiplier === 0 ? 1 : effect.multiplier
      if (effect.negates) result[m].negate = true
      break
    }
  }

  for (let i = 0; i < tokens.length; i += 1) {
    if (consumedByModifier[i]) continue
    const effect = getModifierEffect(tokens[i])
    if (!effect) continue

    for (let m = 0; m < matches.length; m += 1) {
      if (matches[m].start <= i) continue
      if (matches[m].start - i > MODIFIER_WINDOW) break
      result[m].multiplier *= effect.multiplier === 0 ? 1 : effect.multiplier
      if (effect.negates) result[m].negate = true
      break
    }
  }
  return result
}

export function analyzeEmotion(text: string, cameraEmotion?: string | null): EmotionalReading {
  const tokens = tokenize(text || "")
  const matches = greedyMatchPhrases(tokens)
  const adjustments = computeModifierAdjustments(tokens, matches)

  const accumulators: Record<PlutchikPrimary, PrimaryAccumulator> = {
    joy: emptyAccumulator(),
    trust: emptyAccumulator(),
    fear: emptyAccumulator(),
    surprise: emptyAccumulator(),
    sadness: emptyAccumulator(),
    disgust: emptyAccumulator(),
    anger: emptyAccumulator(),
    anticipation: emptyAccumulator(),
  }

  const matchedTokens: EmotionalReading["matchedTokens"] = []

  matches.forEach((match, idx) => {
    const adjustment = adjustments[idx]
    let baseWeight = INTENSITY_WEIGHT[match.intensity] * adjustment.multiplier
    let primary: PlutchikPrimary = match.primary
    if (adjustment.negate) {
      // Negated emotions land on the polar opposite at half strength.
      primary = PLUTCHIK_OPPOSITES[primary]
      baseWeight *= 0.5
    }
    if (baseWeight <= 0) return
    accumulators[primary].weight += baseWeight
    accumulators[primary].intensityHits[match.intensity] += baseWeight
    matchedTokens.push({ token: match.token, primary, intensity: match.intensity })
  })

  // Soft camera nudge. Doesn't dominate text signal but breaks ties.
  if (cameraEmotion) {
    const camPrim = CAMERA_TO_PLUTCHIK[cameraEmotion.toLowerCase()] ?? null
    if (camPrim) {
      accumulators[camPrim].weight += CAMERA_NUDGE_WEIGHT
      accumulators[camPrim].intensityHits.mid += CAMERA_NUDGE_WEIGHT
    }
  }

  // Pick top primary + secondary by weight.
  const ranked = (Object.keys(accumulators) as PlutchikPrimary[])
    .map((name) => ({ name, ...accumulators[name] }))
    .filter((entry) => entry.weight > 0)
    .sort((a, b) => b.weight - a.weight)

  if (ranked.length === 0) {
    return {
      primary: { name: "anticipation", intensity: "low", weight: 0 },
      secondary: null,
      dyad: null,
      label: PLUTCHIK_INTENSITY_LABELS.anticipation.low,
      valence: 0,
      arousal: 0.2,
      bodyAnchors: findBodyAnchors(text),
      matchedTokens,
      confidence: "low",
    }
  }

  const topPrimary = ranked[0]
  const candidateSecondary =
    ranked.find((r) => r.name !== topPrimary.name && r.name !== PLUTCHIK_OPPOSITES[topPrimary.name]) ??
    null
  // Threshold tuning: 0.3 lets a clearly-intended secondary surface as a
  // dyad without over-triggering on incidental mentions. Polar opposites
  // are already filtered above.
  const secondary =
    candidateSecondary && candidateSecondary.weight >= topPrimary.weight * 0.3
      ? candidateSecondary
      : null

  const dyad = secondary ? findDyad(topPrimary.name, secondary.name) : null

  const primaryIntensity = topIntensity(topPrimary)
  const label = dyad
    ? dyad.name
    : PLUTCHIK_INTENSITY_LABELS[topPrimary.name][primaryIntensity]

  // Valence/arousal: weighted blend of primary + secondary.
  const totalWeight = topPrimary.weight + (secondary?.weight ?? 0)
  const valence =
    totalWeight === 0
      ? 0
      : (PLUTCHIK_VALENCE[topPrimary.name] * topPrimary.weight +
          (secondary ? PLUTCHIK_VALENCE[secondary.name] * secondary.weight : 0)) /
        totalWeight
  const arousal =
    totalWeight === 0
      ? 0.2
      : (PLUTCHIK_AROUSAL[topPrimary.name] * topPrimary.weight +
          (secondary ? PLUTCHIK_AROUSAL[secondary.name] * secondary.weight : 0)) /
        totalWeight

  // Confidence: more lexicon hits = higher confidence; a body anchor adds
  // weight because somatic detail strongly grounds the read.
  const bodyAnchorBonus = findBodyAnchors(text).length > 0 ? 1 : 0
  const signalCount = matchedTokens.length + bodyAnchorBonus
  const confidence: EmotionalReading["confidence"] =
    signalCount >= 3 ? "high" : signalCount === 2 ? "high" : signalCount === 1 ? "medium" : "low"

  return {
    primary: { name: topPrimary.name, intensity: primaryIntensity, weight: topPrimary.weight },
    secondary: secondary
      ? {
          name: secondary.name,
          intensity: topIntensity(secondary),
          weight: secondary.weight,
        }
      : null,
    dyad,
    label,
    valence,
    arousal,
    bodyAnchors: findBodyAnchors(text),
    matchedTokens,
    confidence,
  }
}
