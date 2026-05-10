// Somatic anchors — phrases that signal *where* the emotion is being
// felt in the body. Used by the engine to enrich the reading with a
// body-hint (e.g., "tight chest", "racing heart") which downstream
// surfaces in the Mirror strip and influences the breath-coach trigger.

export interface BodyAnchorPattern {
  hint: string
  pattern: RegExp
}

export const BODY_ANCHORS: BodyAnchorPattern[] = [
  {
    hint: "tight chest",
    pattern:
      /\bchest\b[^.?!]{0,20}\b(tight|tightness|heavy|heaviness|pressure|pain|constricted|squeezing)\b|\btight chest\b/i,
  },
  {
    hint: "shallow breath",
    pattern:
      /\b(can'?t breathe|short of breath|shallow breath|breathing fast|gasping|hyperventilating|holding (?:my )?breath)\b/i,
  },
  {
    hint: "stomach knot",
    pattern:
      /\b(stomach (?:knot|tight|sick|churn|clench)|knot in (?:my )?stomach|gut (?:tight|sick|churn)|nauseous|sick to (?:my )?stomach|butterflies)\b/i,
  },
  {
    hint: "tight jaw",
    pattern: /\b(jaw (?:tight|clench|sore)|grinding (?:my )?teeth|clenching (?:my )?teeth)\b/i,
  },
  {
    hint: "racing heart",
    pattern:
      /\bheart\b[^.?!]{0,15}\b(racing|pounding|hammering|skipping|raced|pounded)\b|\bfast heartbeat|\bpalpitation|\bchest fluttering\b/i,
  },
  {
    hint: "heavy limbs",
    pattern:
      /\b(heavy (?:limbs|legs|arms)|cant move|can'?t move|cant get up|can'?t get up|leaden)\b/i,
  },
  {
    hint: "tight shoulders",
    pattern: /\b(shoulders? (?:tight|tense|hunched|up to my ears|raised))\b/i,
  },
  {
    hint: "throat lump",
    pattern: /\b(lump in (?:my )?throat|throat (?:tight|closed|choking))\b/i,
  },
  {
    hint: "burning eyes",
    pattern: /\b(eyes (?:burning|tearing|stinging|hot)|tears (?:welling|coming))\b/i,
  },
  {
    hint: "shaking",
    pattern: /\b(shaking|trembling|hands (?:shaking|trembling)|shivering)\b/i,
  },
]

export function findBodyAnchors(text: string): string[] {
  if (!text) return []
  const found = new Set<string>()
  for (const anchor of BODY_ANCHORS) {
    if (anchor.pattern.test(text)) found.add(anchor.hint)
  }
  return Array.from(found)
}
