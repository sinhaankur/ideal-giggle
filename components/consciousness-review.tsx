"use client"

import { useEffect, useMemo, useState } from "react"
import { MessageSquare, Brain, HandMetal, Heart, X, Check, Trash2, Plus, Sparkles } from "lucide-react"
import type { EmpathyData } from "@/lib/companion-types"
import { evaluateTraits } from "@/lib/conversation/trait-evaluation"

// "See & correct your consciousness."
//
// Everything the companion has come to understand about the person lives in
// EmpathyData (says / thinks / does / feels) — and it reasons FROM that every
// turn. If the read is wrong, that wrongness compounds silently. This modal
// closes the loop: it shows what's been understood, in plain language, and
// lets the person edit or remove anything that isn't true of them. Their
// correction IS the source of truth — we just hand the cleaned map back.

interface ConsciousnessReviewProps {
  open: boolean
  data: EmpathyData
  preferredName?: string
  depthLabel: string
  // Heavy when the relationship has carried a lot of pain; lighter otherwise.
  weightHint: "heavy" | "mixed" | "lighter"
  onClose: () => void
  // Called with the corrected map when the person saves. Parent makes it real.
  onSave: (next: EmpathyData) => void
}

type Quadrant = keyof EmpathyData

const QUADRANTS: Array<{
  key: Quadrant
  label: string
  lead: string
  icon: typeof Heart
  accent: string
}> = [
  { key: "feels", label: "What you feel", lead: "You've let yourself feel", icon: Heart, accent: "text-rose-300" },
  { key: "thinks", label: "What you believe", lead: "Stories you tell yourself", icon: Brain, accent: "text-violet-300" },
  { key: "does", label: "What you do", lead: "Patterns in how you act", icon: HandMetal, accent: "text-amber-300" },
  { key: "says", label: "What you say", lead: "How you put things into words", icon: MessageSquare, accent: "text-sky-300" },
]

const WEIGHT_COPY: Record<ConsciousnessReviewProps["weightHint"], string> = {
  heavy: "There's been real weight here — I'm holding it gently.",
  mixed: "Some heavy moments, some lighter ones.",
  lighter: "The ground has felt a little lighter lately.",
}

export function ConsciousnessReview({
  open,
  data,
  preferredName,
  depthLabel,
  weightHint,
  onClose,
  onSave,
}: ConsciousnessReviewProps) {
  // Local working copy so edits are cancelable — nothing changes upstream
  // until the person explicitly saves.
  const [draft, setDraft] = useState<EmpathyData>(data)

  // Re-seed whenever the modal (re)opens with fresh data.
  useEffect(() => {
    if (open) setDraft(data)
  }, [open, data])

  const totalEntries = useMemo(
    () => draft.says.length + draft.thinks.length + draft.does.length + draft.feels.length,
    [draft]
  )

  // Durable patterns inferred from the (live, editable) map. Derived, not
  // stored — so editing the map above updates these in real time.
  const traits = useMemo(() => evaluateTraits({ empathyData: draft }), [draft])
  // Observations the person rejected ("that's not me") — hidden locally.
  const [rejectedTraits, setRejectedTraits] = useState<Set<string>>(new Set())
  const visibleTraits = traits.filter((t) => !rejectedTraits.has(t.id))

  if (!open) return null

  const updateEntry = (q: Quadrant, index: number, value: string) => {
    setDraft((prev) => {
      const next = [...prev[q]]
      next[index] = value
      return { ...prev, [q]: next }
    })
  }

  const removeEntry = (q: Quadrant, index: number) => {
    setDraft((prev) => ({ ...prev, [q]: prev[q].filter((_, i) => i !== index) }))
  }

  const addEntry = (q: Quadrant) => {
    setDraft((prev) => ({ ...prev, [q]: [...prev[q], ""] }))
  }

  const handleSave = () => {
    // Drop blank lines the person cleared out before handing the map back.
    const cleaned: EmpathyData = {
      says: draft.says.map((s) => s.trim()).filter(Boolean),
      thinks: draft.thinks.map((s) => s.trim()).filter(Boolean),
      does: draft.does.map((s) => s.trim()).filter(Boolean),
      feels: draft.feels.map((s) => s.trim()).filter(Boolean),
    }
    onSave(cleaned)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="consciousness-review-title"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-lg border border-border bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div>
            <h2 id="consciousness-review-title" className="text-sm font-semibold text-foreground">
              What I&apos;ve come to understand about {preferredName || "you"}
            </h2>
            <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
              This is the consciousness I&apos;m carrying for you. If I got something wrong, change or remove it —
              your correction is what&apos;s true.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {totalEntries === 0 ? (
            <p className="py-8 text-center text-[12px] italic text-muted-foreground/60">
              I haven&apos;t come to understand much yet — we&apos;re still early. Talk with me a while and this fills in.
            </p>
          ) : (
            <div className="flex flex-col gap-5">
              {QUADRANTS.map(({ key, label, lead, icon: Icon, accent }) => (
                <div key={key}>
                  <div className="mb-2 flex items-center gap-1.5">
                    <Icon className={`h-3.5 w-3.5 ${accent}`} />
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-foreground">{label}</span>
                    <span className="text-[10px] text-muted-foreground/60">— {lead}</span>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {draft[key].length === 0 && (
                      <div className="text-[11px] italic text-muted-foreground/40">Nothing here yet.</div>
                    )}
                    {draft[key].map((entry, index) => (
                      <div key={index} className="flex items-center gap-1.5">
                        <input
                          value={entry}
                          onChange={(e) => updateEntry(key, index, e.target.value)}
                          className="flex-1 rounded border border-border bg-background px-2 py-1 text-[12px] text-foreground focus:border-foreground/40 focus:outline-none"
                          placeholder="Say it in your own words..."
                        />
                        <button
                          onClick={() => removeEntry(key, index)}
                          className="rounded border border-border bg-background p-1 text-muted-foreground transition-colors hover:border-rose-500/40 hover:text-rose-300"
                          aria-label="Remove this — it's not true of me"
                          title="That's not true of me"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={() => addEntry(key)}
                      className="mt-0.5 inline-flex w-fit items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground transition-colors hover:text-foreground"
                    >
                      <Plus className="h-3 w-3" /> Add something I missed
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Durable patterns — descriptive reflections, each rejectable.
              Only shown once there's enough evidence to say anything. */}
          {visibleTraits.length > 0 && (
            <div className="mt-5 border-t border-border pt-4">
              <div className="mb-2 flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-violet-300" />
                <span className="text-[11px] font-semibold uppercase tracking-wide text-foreground">
                  Patterns I&apos;ve come to notice
                </span>
              </div>
              <p className="mb-2 text-[10px] leading-snug text-muted-foreground/80">
                Tentative reflections from how you&apos;ve shown up over time — not labels. If one isn&apos;t you, wave it off.
              </p>
              <div className="flex flex-col gap-2">
                {visibleTraits.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-start gap-2 rounded border border-violet-500/20 bg-violet-500/5 px-2.5 py-1.5"
                  >
                    <div className="flex-1">
                      <div className="text-[12px] leading-snug text-foreground">{t.text}</div>
                      <div className="mt-0.5 text-[10px] italic text-muted-foreground/70">{t.why}</div>
                    </div>
                    <button
                      onClick={() => setRejectedTraits((prev) => new Set(prev).add(t.id))}
                      className="rounded border border-border bg-background px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-muted-foreground transition-colors hover:border-rose-500/40 hover:text-rose-300"
                      aria-label="That's not me"
                      title="That's not me"
                    >
                      not me
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Read-only context the person can't edit but should see. */}
          <div className="mt-5 flex flex-wrap gap-2 border-t border-border pt-4 text-[10px]">
            <span className="rounded border border-border bg-background px-2 py-1 text-muted-foreground">
              Depth reached: <span className="text-foreground">{depthLabel}</span>
            </span>
            <span className="rounded border border-border bg-background px-2 py-1 text-muted-foreground">
              {WEIGHT_COPY[weightHint]}
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 border-t border-border px-5 py-3">
          <span className="text-[10px] text-muted-foreground/70">Did I get this right?</span>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="rounded border border-border bg-background px-3 py-1.5 text-[11px] font-medium text-foreground transition-colors hover:bg-accent"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="inline-flex items-center gap-1.5 rounded border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-[11px] font-semibold text-emerald-300 transition-colors hover:bg-emerald-500/20"
            >
              <Check className="h-3.5 w-3.5" /> This is me
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
