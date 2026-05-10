// Plutchik's Wheel of Emotions — the canonical taxonomy used as the
// structural backbone of the emotion engine. The wheel arranges 8 primary
// emotions in 4 polar pairs and provides three intensity tiers per primary
// plus 24 dyadic combinations (the emotion that arises when two primaries
// co-occur). Reference:
//   Plutchik, R. (1980). Emotion: A Psychoevolutionary Synthesis.
//   Plutchik, R. (2001). The Nature of Emotions. American Scientist.
//
// Lexicon framing also draws on Saif Mohammad's NRC Emotion Lexicon
// (Mohammad & Turney, 2013) which uses the same 8-emotion Plutchik
// categorization. The actual word list in lexicon.ts is hand-curated to
// avoid NRC's research-only licensing.

export type PlutchikPrimary =
  | "joy"
  | "trust"
  | "fear"
  | "surprise"
  | "sadness"
  | "disgust"
  | "anger"
  | "anticipation"

export type PlutchikIntensity = "low" | "mid" | "high"

export const PLUTCHIK_PRIMARIES: PlutchikPrimary[] = [
  "joy",
  "trust",
  "fear",
  "surprise",
  "sadness",
  "disgust",
  "anger",
  "anticipation",
]

// Polar opposites — two emotions that cancel rather than blend.
export const PLUTCHIK_OPPOSITES: Record<PlutchikPrimary, PlutchikPrimary> = {
  joy: "sadness",
  sadness: "joy",
  trust: "disgust",
  disgust: "trust",
  fear: "anger",
  anger: "fear",
  surprise: "anticipation",
  anticipation: "surprise",
}

// Plutchik's three intensity tiers per primary. The mid-tier word is
// usually the everyday name; low and high anchor the dampened and
// heightened forms.
export const PLUTCHIK_INTENSITY_LABELS: Record<
  PlutchikPrimary,
  Record<PlutchikIntensity, string>
> = {
  joy: { low: "serenity", mid: "joy", high: "ecstasy" },
  trust: { low: "acceptance", mid: "trust", high: "admiration" },
  fear: { low: "apprehension", mid: "fear", high: "terror" },
  surprise: { low: "distraction", mid: "surprise", high: "amazement" },
  sadness: { low: "pensiveness", mid: "sadness", high: "grief" },
  disgust: { low: "boredom", mid: "disgust", high: "loathing" },
  anger: { low: "annoyance", mid: "anger", high: "rage" },
  anticipation: { low: "interest", mid: "anticipation", high: "vigilance" },
}

// Wheel ordering — used to compute dyad tier (adjacent vs one-apart vs
// two-apart). Plutchik's wheel goes clockwise:
//   joy → trust → fear → surprise → sadness → disgust → anger → anticipation
const WHEEL_ORDER: PlutchikPrimary[] = [
  "joy",
  "trust",
  "fear",
  "surprise",
  "sadness",
  "disgust",
  "anger",
  "anticipation",
]

export type DyadTier = "primary" | "secondary" | "tertiary"

export interface PlutchikDyad {
  name: string
  emotions: [PlutchikPrimary, PlutchikPrimary]
  tier: DyadTier
}

// All 24 named dyads from Plutchik (1980). Tier reflects how far apart
// the two emotions sit on the wheel — adjacent (primary) blends are the
// most stable; opposite-side (tertiary) blends carry more tension.
export const PLUTCHIK_DYADS: PlutchikDyad[] = [
  // Primary dyads — adjacent on the wheel.
  { name: "love", emotions: ["joy", "trust"], tier: "primary" },
  { name: "submission", emotions: ["trust", "fear"], tier: "primary" },
  { name: "awe", emotions: ["fear", "surprise"], tier: "primary" },
  { name: "disapproval", emotions: ["surprise", "sadness"], tier: "primary" },
  { name: "remorse", emotions: ["sadness", "disgust"], tier: "primary" },
  { name: "contempt", emotions: ["disgust", "anger"], tier: "primary" },
  { name: "aggressiveness", emotions: ["anger", "anticipation"], tier: "primary" },
  { name: "optimism", emotions: ["anticipation", "joy"], tier: "primary" },
  // Secondary dyads — one apart.
  { name: "guilt", emotions: ["joy", "fear"], tier: "secondary" },
  { name: "curiosity", emotions: ["trust", "surprise"], tier: "secondary" },
  { name: "despair", emotions: ["fear", "sadness"], tier: "secondary" },
  { name: "unbelief", emotions: ["surprise", "disgust"], tier: "secondary" },
  { name: "envy", emotions: ["sadness", "anger"], tier: "secondary" },
  { name: "cynicism", emotions: ["disgust", "anticipation"], tier: "secondary" },
  { name: "pride", emotions: ["anger", "joy"], tier: "secondary" },
  { name: "hope", emotions: ["anticipation", "trust"], tier: "secondary" },
  // Tertiary dyads — two apart.
  { name: "delight", emotions: ["joy", "surprise"], tier: "tertiary" },
  { name: "sentimentality", emotions: ["trust", "sadness"], tier: "tertiary" },
  { name: "shame", emotions: ["fear", "disgust"], tier: "tertiary" },
  { name: "outrage", emotions: ["surprise", "anger"], tier: "tertiary" },
  { name: "pessimism", emotions: ["sadness", "anticipation"], tier: "tertiary" },
  { name: "morbidness", emotions: ["disgust", "joy"], tier: "tertiary" },
  { name: "dominance", emotions: ["anger", "trust"], tier: "tertiary" },
  { name: "anxiety", emotions: ["anticipation", "fear"], tier: "tertiary" },
]

// Build a fast lookup of unordered-pair → dyad. Plutchik treats {a, b}
// and {b, a} as the same blend, so the lookup keys both directions.
const dyadLookup = new Map<string, PlutchikDyad>()
for (const dyad of PLUTCHIK_DYADS) {
  const [a, b] = dyad.emotions
  dyadLookup.set(`${a}|${b}`, dyad)
  dyadLookup.set(`${b}|${a}`, dyad)
}

export function findDyad(a: PlutchikPrimary, b: PlutchikPrimary): PlutchikDyad | null {
  if (a === b) return null
  if (PLUTCHIK_OPPOSITES[a] === b) return null // polar opposites don't blend
  return dyadLookup.get(`${a}|${b}`) ?? null
}

// Valence: each primary leans positive, neutral, or negative on the
// pleasure/displeasure axis. Used for sentiment readouts.
export const PLUTCHIK_VALENCE: Record<PlutchikPrimary, number> = {
  joy: 1,
  trust: 0.6,
  anticipation: 0.4,
  surprise: 0,
  sadness: -1,
  disgust: -0.7,
  anger: -0.7,
  fear: -0.8,
}

// Arousal: how activating the emotion typically is. Used to weight the
// "load" reading and to drive somatic interventions like breath coaching.
export const PLUTCHIK_AROUSAL: Record<PlutchikPrimary, number> = {
  joy: 0.7,
  trust: 0.3,
  anticipation: 0.5,
  surprise: 0.8,
  sadness: 0.3,
  disgust: 0.5,
  anger: 0.85,
  fear: 0.85,
}

// Re-export the wheel order for any consumer that needs to lay out the
// emotions in their canonical clockwise sequence.
export { WHEEL_ORDER }
