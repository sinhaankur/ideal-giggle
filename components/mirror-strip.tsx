"use client"

import { useState } from "react"
import { Eye, Pencil, Check, X } from "lucide-react"
import type { FeltState } from "@/lib/conversation/communication-engine"

interface MirrorStripProps {
  state: FeltState
  onCorrect?: (correction: string) => void
  reducedMotion?: boolean
}

const INTENT_LABEL: Record<FeltState["intent"], string> = {
  "check-in": "checking in",
  venting: "venting",
  reflection: "thinking out loud",
  "problem-solving": "looking for a step",
  connection: "wanting connection",
}

const LOAD_LABEL: Record<FeltState["load"], string> = {
  low: "calm load",
  moderate: "warm load",
  high: "heavy load",
}

const CONFIDENCE_DOT: Record<FeltState["confidence"], string> = {
  low: "bg-muted-foreground/40",
  medium: "bg-amber-400/70",
  high: "bg-emerald-400/80",
}

export function MirrorStrip({ state, onCorrect, reducedMotion }: MirrorStripProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState("")

  const submit = () => {
    const trimmed = draft.trim()
    if (!trimmed) {
      setEditing(false)
      return
    }
    onCorrect?.(trimmed)
    setDraft("")
    setEditing(false)
  }

  return (
    <div
      className={`flex flex-col gap-2 border-b border-border bg-card/60 px-4 py-2 text-[11px] ${
        reducedMotion ? "" : "transition-colors"
      }`}
      aria-label="What I'm hearing"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Eye className="h-3 w-3" />
          <span className="uppercase tracking-wide">What I am hearing</span>
          <span
            className={`h-1.5 w-1.5 rounded-full ${CONFIDENCE_DOT[state.confidence]}`}
            title={`Confidence: ${state.confidence}`}
            aria-label={`Confidence: ${state.confidence}`}
          />
        </div>
        {!editing && onCorrect && (
          <button
            onClick={() => setEditing(true)}
            className="inline-flex items-center gap-1 rounded border border-border bg-background px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            aria-label="Correct the mirror"
          >
            <Pencil className="h-3 w-3" />
            Not quite
          </button>
        )}
      </div>

      {!editing ? (
        <div className="flex flex-wrap items-center gap-1.5 leading-relaxed">
          <span className="rounded border border-border bg-background px-1.5 py-0.5 text-foreground">
            {state.primary}
          </span>
          {state.secondary && (
            <span className="rounded border border-border bg-background px-1.5 py-0.5 text-foreground">
              {state.secondary}
            </span>
          )}
          {state.bodyHint && (
            <span className="rounded border border-rose-500/30 bg-rose-500/10 px-1.5 py-0.5 text-rose-200">
              body: {state.bodyHint}
            </span>
          )}
          <span className="text-muted-foreground/80">·</span>
          <span className="text-muted-foreground/90">{INTENT_LABEL[state.intent]}</span>
          <span className="text-muted-foreground/80">·</span>
          <span className="text-muted-foreground/90">{LOAD_LABEL[state.load]}</span>
          <span className="text-muted-foreground/80">·</span>
          <span className="text-muted-foreground/90">need: {state.need}</span>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                submit()
              } else if (e.key === "Escape") {
                e.preventDefault()
                setEditing(false)
                setDraft("")
              }
            }}
            placeholder="Tell me what I missed... e.g. 'more grief than anger'"
            className="flex-1 rounded border border-border bg-background px-2 py-1 text-[11px] text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <button
            onClick={submit}
            className="flex h-6 w-6 items-center justify-center rounded border border-emerald-500/40 bg-emerald-500/10 text-emerald-300 transition-colors hover:bg-emerald-500/20"
            aria-label="Send correction"
          >
            <Check className="h-3 w-3" />
          </button>
          <button
            onClick={() => {
              setEditing(false)
              setDraft("")
            }}
            className="flex h-6 w-6 items-center justify-center rounded border border-border bg-card text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            aria-label="Cancel correction"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}
    </div>
  )
}
