// Public API of the Plutchik-grounded emotion engine.
//
// The engine combines:
//   - Plutchik's Wheel of Emotions (primaries, intensity tiers, dyads)
//   - A hand-curated lexicon (~500 entries, structurally aligned with NRC)
//   - VADER-style intensifiers and negators
//   - Somatic body-anchor detection
//
// Used by lib/conversation/communication-engine.ts to produce the
// FeltState surfaced in the Mirror strip and to route empathic
// responses, and remains the deterministic floor when no LLM is loaded.

export { analyzeEmotion, type EmotionalReading } from "./analyze"
export {
  PLUTCHIK_DYADS,
  PLUTCHIK_INTENSITY_LABELS,
  PLUTCHIK_OPPOSITES,
  PLUTCHIK_PRIMARIES,
  PLUTCHIK_VALENCE,
  PLUTCHIK_AROUSAL,
  WHEEL_ORDER,
  findDyad,
  type DyadTier,
  type PlutchikDyad,
  type PlutchikIntensity,
  type PlutchikPrimary,
} from "./plutchik"
export { lexiconSize, lookupLexicon, type LexiconEntry } from "./lexicon"
export { findBodyAnchors, BODY_ANCHORS } from "./body"
