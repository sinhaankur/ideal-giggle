// Trait evaluation — durable, descriptive patterns inferred from how a person
// engages over time, distinct from the transient emotion read.
//
// Hard design rules (this is ethically delicate; treat it that way):
//   1. DESCRIPTIVE, never diagnostic. We say "you seem to process by talking
//      it out", never "you are an extrovert" or any clinical/typological label
//      (no Big Five scores, no MBTI, no disorder language).
//   2. EVIDENCE-GATED. Each observation only fires once there's enough signal,
//      and every observation carries the `why` (the signal that produced it)
//      so it's transparent and the person can judge/correct it.
//   3. TENTATIVE. Phrasing hedges ("seem", "lately", "tend to") — these are
//      reflections offered back, not verdicts.
//   4. CORRECTABLE downstream. The UI lets the person reject any of these.
//
// Input is the same data the rest of the app already has: the accumulated
// empathy map (says/thinks/does/feels) and the meta-history of depth/sentiment
// readings. No new tracking, no profiling beyond what the person can see.

export interface TraitObservation {
  id: string
  // The reflection, in plain second-person language.
  text: string
  // Why we think this — the signal behind it, shown to keep it honest.
  why: string
}

export interface TraitEvaluationInput {
  empathyData: {
    says: string[]
    thinks: string[]
    does: string[]
    feels: string[]
  }
  // Recent depth/sentiment readings (oldest→newest). Optional.
  metaHistory?: Array<{ depth: number; primaryQuadrant: "SAYS" | "THINKS" | "DOES" | "FEELS"; sentimentPolarity: number }>
}

const QUADRANT_WORDS = (entries: string[]) =>
  entries.reduce((sum, e) => sum + e.trim().split(/\s+/).filter(Boolean).length, 0)

// Minimum total empathy-map entries before we'll say anything durable. Below
// this, any "pattern" is noise.
const MIN_EVIDENCE_ENTRIES = 8

export function evaluateTraits(input: TraitEvaluationInput): TraitObservation[] {
  const { says, thinks, does, feels } = input.empathyData
  const counts = { says: says.length, thinks: thinks.length, does: does.length, feels: feels.length }
  const total = counts.says + counts.thinks + counts.does + counts.feels
  if (total < MIN_EVIDENCE_ENTRIES) return []

  const observations: TraitObservation[] = []

  // --- Processing style: which quadrant dominates how they share. ---
  const dominant = (Object.keys(counts) as Array<keyof typeof counts>).reduce((a, b) =>
    counts[a] >= counts[b] ? a : b
  )
  const dominantShare = counts[dominant] / total
  if (dominantShare >= 0.4) {
    const byQuadrant: Record<keyof typeof counts, { text: string; why: string }> = {
      says: {
        text: "You seem to process things by talking them out — putting them into words is how you work them through.",
        why: "Most of what you share lands as things you'd say out loud.",
      },
      thinks: {
        text: "You tend to lead with thinking — analyzing and interpreting before settling on what you feel.",
        why: "Your reflections cluster around thoughts and interpretations.",
      },
      does: {
        text: "You seem action-oriented — you relate to things through what you do, or what you're avoiding doing.",
        why: "A lot of what you share is about behavior and action.",
      },
      feels: {
        text: "You stay close to your feelings — you tend to name the emotion directly rather than route around it.",
        why: "You name feelings often and directly.",
      },
    }
    observations.push({ id: `style-${dominant}`, ...byQuadrant[dominant] })
  }

  // --- Thinking-vs-feeling distance: do they reach feeling slowly? ---
  if (counts.thinks >= 3 && counts.feels >= 1 && counts.thinks >= counts.feels * 2.5) {
    observations.push({
      id: "head-before-heart",
      text: "You seem to reach your feelings through your thoughts — the analysis comes first, the feeling a step behind.",
      why: "You share far more thoughts than feelings.",
    })
  }

  // --- Somatic awareness: do they notice the body? ---
  const bodyRe = /\b(chest|throat|jaw|stomach|gut|shoulders?|breath|breathing|tight|tense|heavy|knot|ache|aching)\b/i
  const bodyMentions = [...says, ...thinks, ...does, ...feels].filter((e) => bodyRe.test(e)).length
  if (bodyMentions >= 2) {
    observations.push({
      id: "somatic-aware",
      text: "You notice where things land in your body, not just your head — that's a real kind of self-awareness.",
      why: "You've referenced physical/body sensations more than once.",
    })
  }

  // --- Self-criticism: a recurring inward-harsh note. ---
  const selfCritRe = /\b(my fault|i should(?:n't| not)?|i'?m (?:stupid|useless|a failure|not good enough|terrible|bad at)|i hate myself|i always mess|i can'?t do anything)\b/i
  const selfCrit = [...thinks, ...says, ...feels].filter((e) => selfCritRe.test(e)).length
  if (selfCrit >= 2) {
    observations.push({
      id: "self-critical",
      text: "There's a self-critical voice that shows up for you — you turn a hard lens on yourself more than you might on someone else.",
      why: "Self-blaming language has come up several times.",
    })
  }

  // --- Trajectory: do they open up over time, or stay guarded? ---
  const meta = input.metaHistory ?? []
  if (meta.length >= 5) {
    const firstHalf = meta.slice(0, Math.floor(meta.length / 2))
    const secondHalf = meta.slice(Math.floor(meta.length / 2))
    const avg = (arr: typeof meta) => (arr.length ? arr.reduce((s, m) => s + m.depth, 0) / arr.length : 0)
    const rise = avg(secondHalf) - avg(firstHalf)
    if (rise >= 1.5) {
      observations.push({
        id: "opens-with-trust",
        text: "You open up as trust builds — you start guarded and go deeper once it feels safe, rather than leading with everything.",
        why: "Your depth has risen noticeably as conversations go on.",
      })
    }
  }

  // --- Verbosity / expressiveness. ---
  const totalWords = QUADRANT_WORDS(says) + QUADRANT_WORDS(thinks) + QUADRANT_WORDS(does) + QUADRANT_WORDS(feels)
  const avgWordsPerEntry = totalWords / Math.max(1, total)
  if (avgWordsPerEntry >= 14) {
    observations.push({
      id: "expansive",
      text: "You tend to express yourself fully — you give things room and detail rather than keeping them clipped.",
      why: "Your entries tend to be long and detailed.",
    })
  } else if (avgWordsPerEntry > 0 && avgWordsPerEntry <= 4) {
    observations.push({
      id: "spare",
      text: "You tend to keep things spare — you say what matters in few words. (That's not a flaw; it's a style.)",
      why: "Your entries tend to be short.",
    })
  }

  return observations
}
