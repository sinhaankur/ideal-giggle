// Intensifiers and negators applied during scoring. The multiplier is
// applied to the *next* emotion-bearing token within a small window (3
// tokens by default). Pattern lifted from VADER's lexicon-based approach
// (Hutto & Gilbert, 2014) which has held up well in noisy conversational
// text.

export interface ModifierEffect {
  multiplier: number
  // For negators we set this true so the analyzer can flip valence and
  // re-route to the polar opposite primary (e.g., "not happy" → sadness).
  negates?: boolean
}

const NEGATORS: Record<string, ModifierEffect> = {
  not: { multiplier: 0, negates: true },
  "n't": { multiplier: 0, negates: true },
  no: { multiplier: 0, negates: true },
  never: { multiplier: 0, negates: true },
  none: { multiplier: 0, negates: true },
  nothing: { multiplier: 0, negates: true },
  nobody: { multiplier: 0, negates: true },
  hardly: { multiplier: 0.2, negates: true },
  barely: { multiplier: 0.2, negates: true },
  rarely: { multiplier: 0.2, negates: true },
  scarcely: { multiplier: 0.2, negates: true },
  "don't": { multiplier: 0, negates: true },
  "dont": { multiplier: 0, negates: true },
  "doesn't": { multiplier: 0, negates: true },
  "doesnt": { multiplier: 0, negates: true },
  "isn't": { multiplier: 0, negates: true },
  "isnt": { multiplier: 0, negates: true },
  "wasn't": { multiplier: 0, negates: true },
  "wasnt": { multiplier: 0, negates: true },
  "aren't": { multiplier: 0, negates: true },
  "arent": { multiplier: 0, negates: true },
  "weren't": { multiplier: 0, negates: true },
  "werent": { multiplier: 0, negates: true },
  "can't": { multiplier: 0, negates: true },
  "cant": { multiplier: 0, negates: true },
  "cannot": { multiplier: 0, negates: true },
}

const AMPLIFIERS: Record<string, ModifierEffect> = {
  very: { multiplier: 1.5 },
  really: { multiplier: 1.4 },
  so: { multiplier: 1.4 },
  totally: { multiplier: 1.5 },
  completely: { multiplier: 1.6 },
  absolutely: { multiplier: 1.6 },
  utterly: { multiplier: 1.7 },
  extremely: { multiplier: 1.7 },
  incredibly: { multiplier: 1.6 },
  insanely: { multiplier: 1.7 },
  super: { multiplier: 1.4 },
  deeply: { multiplier: 1.4 },
  profoundly: { multiplier: 1.6 },
  intensely: { multiplier: 1.6 },
  unbelievably: { multiplier: 1.6 },
  desperately: { multiplier: 1.6 },
  hopelessly: { multiplier: 1.5 },
  endlessly: { multiplier: 1.4 },
  // Dampeners — multiplier < 1 reduces the emotion's weight.
  slightly: { multiplier: 0.5 },
  somewhat: { multiplier: 0.6 },
  kinda: { multiplier: 0.55 },
  sorta: { multiplier: 0.55 },
  "kind of": { multiplier: 0.55 },
  "sort of": { multiplier: 0.55 },
  little: { multiplier: 0.6 },
  bit: { multiplier: 0.6 },
  mildly: { multiplier: 0.6 },
  moderately: { multiplier: 0.7 },
  fairly: { multiplier: 0.8 },
  pretty: { multiplier: 0.9 },
}

export function getModifierEffect(token: string): ModifierEffect | null {
  const lower = token.toLowerCase()
  return NEGATORS[lower] ?? AMPLIFIERS[lower] ?? null
}

export const MODIFIER_WINDOW = 3
