"use client"

import { useState } from "react"
import { BookOpen, Download, Lock, X } from "lucide-react"
import {
  summaryToMarkdown,
  type ConversationSummary,
} from "@/lib/conversation/communication-engine"

interface SummaryCardProps {
  summary: ConversationSummary
  onDismiss: () => void
  onSaveToVault?: () => void | Promise<void>
  vaultUnlocked?: boolean
}

export function SummaryCard({
  summary,
  onDismiss,
  onSaveToVault,
  vaultUnlocked,
}: SummaryCardProps) {
  const [savedAt, setSavedAt] = useState<number | null>(null)

  const exportMarkdown = () => {
    const blob = new Blob([summaryToMarkdown(summary)], { type: "text/markdown" })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = `empatheia-summary-${new Date().toISOString().slice(0, 10)}.md`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const handleSaveToVault = async () => {
    if (!onSaveToVault) return
    await onSaveToVault()
    setSavedAt(Date.now())
  }

  return (
    <div className="border-b border-sky-500/30 bg-sky-500/5 px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2 text-sky-200">
          <BookOpen className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
          <div className="flex flex-col gap-1">
            <span className="text-[11px] uppercase tracking-wide">
              Reflection so far · {summary.headline}
            </span>
            <div className="space-y-1.5 text-[12px] leading-relaxed text-foreground">
              {summary.paragraphs.map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>
          </div>
        </div>
        <button
          onClick={onDismiss}
          className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border border-border bg-card text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          aria-label="Dismiss summary"
        >
          <X className="h-3 w-3" />
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          onClick={exportMarkdown}
          className="inline-flex items-center gap-1 rounded border border-sky-500/40 bg-background/40 px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-sky-200 transition-colors hover:bg-sky-500/20"
        >
          <Download className="h-3 w-3" />
          Export markdown
        </button>
        {onSaveToVault && (
          <button
            onClick={handleSaveToVault}
            disabled={!vaultUnlocked || savedAt !== null}
            className="inline-flex items-center gap-1 rounded border border-border bg-card px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50 disabled:hover:bg-card disabled:hover:text-muted-foreground"
            title={!vaultUnlocked ? "Unlock the vault to save reflections" : "Save this reflection into your vault"}
          >
            <Lock className="h-3 w-3" />
            {savedAt
              ? "Saved"
              : vaultUnlocked
                ? "Save to vault"
                : "Vault locked"}
          </button>
        )}
      </div>
    </div>
  )
}
