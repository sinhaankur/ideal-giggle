// Break a companion reply into natural "beats" so a thoughtful, multi-sentence
// response reads like someone speaking in turns rather than one wall of text.
// This mirrors the conversation model's "reflect → give → ask" rhythm visually.
//
// Rules, in order:
//   1. If the model already used blank lines (paragraphs), honor them as-is.
//   2. Otherwise, peel a trailing question onto its own line — the "ask" beat —
//      since reflection-then-question is the most common shape and the seam
//      between them is exactly where a breath belongs.
//   3. Never fragment further than that; over-splitting reads choppy.
export function splitIntoBeats(text: string): string[] {
  const trimmed = (text || "").trim()
  if (!trimmed) return [""]

  const paragraphs = trimmed
    .split(/\n{2,}/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter(Boolean)
  if (paragraphs.length > 1) return paragraphs

  const single = paragraphs[0] ?? trimmed
  // Only split when the reply *ends* with a question (ignoring trailing space).
  if (single.endsWith("?")) {
    // Walk back from the closing "?" to the previous sentence terminator; the
    // text after it is the closing question beat.
    const priorEnd = Math.max(
      single.lastIndexOf(". "),
      single.lastIndexOf("! "),
      single.lastIndexOf("? ", single.length - 2)
    )
    if (priorEnd > 0) {
      const reflection = single.slice(0, priorEnd + 1).trim()
      const question = single.slice(priorEnd + 1).trim()
      // Guard against splitting off a trivially short fragment.
      if (reflection.length > 8 && question.length > 4) {
        return [reflection, question]
      }
    }
  }

  return [single]
}
