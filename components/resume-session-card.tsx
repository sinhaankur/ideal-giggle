"use client"

import { Clock, Play, RotateCcw } from "lucide-react"
import type { SessionMemoryRecord } from "@/lib/vault/encrypted-profile"

interface ResumeSessionCardProps {
  memory: SessionMemoryRecord
  onResume: () => void
  onStartFresh: () => void
}

function relativeTimeFrom(isoTimestamp: string): string {
  const then = new Date(isoTimestamp).getTime()
  if (!Number.isFinite(then)) return "previously"
  const diffMs = Date.now() - then
  if (diffMs < 0) return "just now"
  const minutes = Math.round(diffMs / 60_000)
  if (minutes < 1) return "moments ago"
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`
  const days = Math.round(hours / 24)
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`
  const weeks = Math.round(days / 7)
  return `${weeks} week${weeks === 1 ? "" : "s"} ago`
}

export function ResumeSessionCard({ memory, onResume, onStartFresh }: ResumeSessionCardProps) {
  const when = relativeTimeFrom(memory.savedAt)
  const lead = memory.summaryParagraphs[0]?.trim() || ""
  const turnCount = memory.turns.length

  return (
    <div className="border-b border-violet-500/30 bg-violet-500/5 px-4 py-3">
      <div className="flex items-start gap-2 text-violet-200">
        <Clock className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
        <div className="flex flex-col gap-1">
          <span className="text-[11px] uppercase tracking-wide">
            Welcome back · last session {when}
          </span>
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] leading-relaxed text-foreground">
            <span className="rounded border border-violet-500/40 bg-background/50 px-1.5 py-0.5 text-violet-100">
              {memory.headline}
            </span>
            <span className="text-muted-foreground/80">
              · {turnCount} turn{turnCount === 1 ? "" : "s"} kept
            </span>
          </div>
          {lead && (
            <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
              {lead}
            </p>
          )}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          onClick={onResume}
          className="inline-flex items-center gap-1 rounded border border-violet-400/40 bg-violet-500/15 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-violet-100 transition-colors hover:bg-violet-500/25"
        >
          <Play className="h-3 w-3" />
          Pick up where we left off
        </button>
        <button
          onClick={onStartFresh}
          className="inline-flex items-center gap-1 rounded border border-border bg-card px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <RotateCcw className="h-3 w-3" />
          Start fresh
        </button>
      </div>
    </div>
  )
}
