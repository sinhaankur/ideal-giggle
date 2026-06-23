"use client"

import { useRef, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { MessageSquare, Brain, HandMetal, Heart, Upload, Download, Copy, Link2, Lock, Unlock, Trash2, Activity, History, ChevronDown } from "lucide-react"
import type { EmpathyData, EmpathyProfile, EmpathyMetaRecord } from "@/lib/companion-types"
import type { UserUnderstanding } from "@/lib/conversation/communication-engine"
import { isEncryptedEnvelope, type VaultEnvelope, type SessionMemoryRecord } from "@/lib/vault/encrypted-profile"
import { ConsciousnessReview } from "@/components/consciousness-review"
import { MoodTimeline } from "@/components/mood-timeline"

export interface EmpathyTimelineEntry {
  id: string
  at: number
  quadrant: keyof EmpathyData
  entry: string
}

interface EmpathyPanelProps {
  data: EmpathyData
  profile: EmpathyProfile
  onProfileImport: (profile: EmpathyProfile, empathyData?: EmpathyData) => void
  onProfileExport: () => void
  empathyCode: string
  onGenerateEmpathyCode: () => void
  messageCount: number
  depthTierLabel: string
  emotionalVelocity: number
  densityWords: number
  densitySentiment: number
  suggestedQuestion: string
  fallbackPhase: number
  userUnderstanding: UserUnderstanding
  vaultStatus?: "no-vault" | "locked" | "unlocked"
  vaultLastSavedAt?: number | null
  onVaultEnvelopeUpload?: (envelope: VaultEnvelope) => void
  onVaultLock?: () => void
  onVaultClear?: () => void
  timeline?: EmpathyTimelineEntry[]
  // Per-turn sentiment/depth readings — powers the emotional-arc sparkline.
  metaHistory?: EmpathyMetaRecord[]
  // Past sessions restored from the soul file, to revisit earlier reflections.
  sessionHistory?: SessionMemoryRecord[]
  // Apply the person's own corrections to the empathy map (the consciousness
  // review modal). When absent, the "Did I get this right?" entry is hidden.
  onUpdateData?: (next: EmpathyData) => void
  // Signed read of how much weight the relationship has carried, for the
  // review modal's context line.
  weightHint?: "heavy" | "mixed" | "lighter"
}

const NOTE_ROTATIONS = ["-rotate-2", "rotate-1", "-rotate-1", "rotate-2", "-rotate-1"]

type IndexedNote = { text: string; sourceIndex: number }

function trimNotes(items: string[]): IndexedNote[] {
  return items
    .map((text, sourceIndex) => ({ text, sourceIndex }))
    .filter((item) => item.text.trim().length > 0)
    .slice(-8)
}

function stickRotation(index: number) {
  return NOTE_ROTATIONS[index % NOTE_ROTATIONS.length]
}

const NEUTRAL_CHIP = "border-border bg-background text-foreground"
const ATTENTION_CHIP = "border-amber-500/40 bg-amber-500/10 text-amber-300"

function loadTone(load: UserUnderstanding["emotionalLoad"]) {
  return load === "high" ? ATTENTION_CHIP : NEUTRAL_CHIP
}

export function EmpathyPanel({
  data,
  profile,
  onProfileImport,
  onProfileExport,
  empathyCode,
  onGenerateEmpathyCode,
  messageCount,
  depthTierLabel,
  emotionalVelocity,
  densityWords,
  densitySentiment,
  suggestedQuestion,
  fallbackPhase,
  userUnderstanding,
  vaultStatus = "no-vault",
  vaultLastSavedAt,
  onVaultEnvelopeUpload,
  onVaultLock,
  onVaultClear,
  timeline,
  metaHistory,
  sessionHistory,
  onUpdateData,
  weightHint = "mixed",
}: EmpathyPanelProps) {
  const [jsonStatus, setJsonStatus] = useState<string>("No profile JSON imported yet.")
  const [copyStatus, setCopyStatus] = useState<string>("")
  const [reviewOpen, setReviewOpen] = useState(false)
  // Which past session (by index) is expanded to show its full reflection.
  const [openSessionIdx, setOpenSessionIdx] = useState<number | null>(null)
  const [historyOpen, setHistoryOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const triggerUpload = () => {
    fileInputRef.current?.click()
  }

  const canGenerateCode = messageCount >= 6
  const saysNotes = trimNotes(data.says)
  const doesNotes = trimNotes(data.does)
  const thinksNotes = trimNotes(data.thinks)
  const feelsNotes = trimNotes(data.feels)

  const copyEmpathyCode = async () => {
    if (!empathyCode) return
    try {
      await navigator.clipboard.writeText(empathyCode)
      setCopyStatus("Copied")
      setTimeout(() => setCopyStatus(""), 1200)
    } catch {
      setCopyStatus("Copy failed")
    }
  }

  const shareText = `Just mapped my mental model on Empatheia. My Empathy Code is ${empathyCode || "EMP-2026"}. Explore your own at sinhaankur.com`
  const redditLink = `https://www.reddit.com/submit?title=${encodeURIComponent("My Empathy Code")}&text=${encodeURIComponent(shareText)}`
  const xLink = `https://x.com/intent/tweet?text=${encodeURIComponent(shareText)}`

  const normalizeProfile = (source: Record<string, unknown>): EmpathyProfile => ({
    version: String(source.version ?? "1.0"),
    preferredName: String(source.preferredName ?? "Friend"),
    communicationStyle: String(source.communicationStyle ?? "Warm, validating, and practical."),
    supportGoals: Array.isArray(source.supportGoals) ? source.supportGoals.map((item: unknown) => String(item)) : [],
    negativeThoughtPatterns: Array.isArray(source.negativeThoughtPatterns)
      ? source.negativeThoughtPatterns.map((item: unknown) => String(item))
      : [],
    reframePreferences: Array.isArray(source.reframePreferences)
      ? source.reframePreferences.map((item: unknown) => String(item))
      : [],
    groundingPrompts: Array.isArray(source.groundingPrompts)
      ? source.groundingPrompts.map((item: unknown) => String(item))
      : [],
    avoidPhrases: Array.isArray(source.avoidPhrases) ? source.avoidPhrases.map((item: unknown) => String(item)) : [],
  })

  const normalizeEmpathyData = (source: unknown): EmpathyData | undefined => {
    if (!source || typeof source !== "object") return undefined
    const s = source as Record<string, unknown>
    const arr = (v: unknown) => (Array.isArray(v) ? v.map((item) => String(item)) : [])
    return {
      says: arr(s.says),
      thinks: arr(s.thinks),
      does: arr(s.does),
      feels: arr(s.feels),
    }
  }

  const handleJsonUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      const text = await file.text()
      const parsed = JSON.parse(text)

      if (!parsed || typeof parsed !== "object") {
        setJsonStatus("Invalid JSON format. Expected an object.")
        return
      }

      if (isEncryptedEnvelope(parsed)) {
        if (onVaultEnvelopeUpload) {
          onVaultEnvelopeUpload(parsed)
          setJsonStatus("Consciousness file detected. Enter passphrase to unlock.")
        } else {
          setJsonStatus("Encrypted consciousness detected, but no unlock handler is wired.")
        }
        return
      }

      const profileSource = parsed.profile && typeof parsed.profile === "object" ? parsed.profile : parsed
      const profile = normalizeProfile(profileSource)
      const empathyData = normalizeEmpathyData(parsed.empathyData)
      onProfileImport(profile, empathyData)
      setJsonStatus(`Loaded profile for ${profile.preferredName}.`)
    } catch {
      setJsonStatus("Unable to parse JSON. Please upload a valid .json file.")
    } finally {
      event.target.value = ""
    }
  }

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex items-center justify-between gap-2 border-b border-border pb-2">
        <div className="flex items-center gap-2">
          <Brain className="h-3 w-3 text-muted-foreground" />
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Empathy Map Canvas</span>
        </div>
        {onUpdateData && (
          <button
            onClick={() => setReviewOpen(true)}
            className="rounded border border-border bg-background px-2 py-0.5 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            title="Review and correct what I've come to understand about you"
          >
            Did I get this right?
          </button>
        )}
      </div>

      {onUpdateData && (
        <ConsciousnessReview
          open={reviewOpen}
          data={data}
          preferredName={profile.preferredName}
          depthLabel={depthTierLabel}
          weightHint={weightHint}
          onClose={() => setReviewOpen(false)}
          onSave={onUpdateData}
        />
      )}

      <div className="border border-border bg-card p-3">
        <div className="mb-2 flex items-center justify-between">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Canvas Meta</div>
          <div className="text-[11px] text-muted-foreground">Depth: {depthTierLabel}</div>
        </div>
        <div className="mb-2 text-[10px] text-muted-foreground">
          Persona: <span className="text-foreground">{profile.preferredName}</span>
        </div>
        <div className="mb-2 grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
          <div className="rounded border border-border bg-background px-2 py-1">
            Velocity: <span className="text-foreground">{(emotionalVelocity * 100).toFixed(0)}%</span>
          </div>
          <div className="rounded border border-border bg-background px-2 py-1">
            Density: <span className="text-foreground">{densityWords}</span>
          </div>
        </div>
        <div className="mb-2 h-1.5 w-full overflow-hidden rounded bg-border/60">
          <motion.div
            className="h-full bg-foreground"
            initial={false}
            animate={{ width: `${Math.max(8, Math.min(100, densitySentiment * 100))}%` }}
            transition={{ type: "spring", stiffness: 120, damping: 22 }}
          />
        </div>
        {suggestedQuestion && <div className="text-[11px] text-muted-foreground">Prompt: {suggestedQuestion}</div>}
        <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
          <div className={`rounded border px-2 py-1 ${NEUTRAL_CHIP}`}>
            Intent: <span className="capitalize">{userUnderstanding.primaryIntent}</span>
          </div>
          <div className={`rounded border px-2 py-1 ${loadTone(userUnderstanding.emotionalLoad)}`}>
            Load: <span className="capitalize">{userUnderstanding.emotionalLoad}</span>
          </div>
          <div className={`rounded border px-2 py-1 ${NEUTRAL_CHIP}`}>
            Openness: <span className="capitalize">{userUnderstanding.openness}</span>
          </div>
          <div className={`rounded border px-2 py-1 ${NEUTRAL_CHIP}`}>
            Style: <span className="capitalize">{userUnderstanding.preferredResponseStyle}</span>
          </div>
        </div>
        <div className="mt-2 rounded border border-border bg-background px-2 py-1 text-[11px] text-muted-foreground">
          Needs: <span className="text-foreground">{userUnderstanding.needs.join("; ")}</span>
        </div>
        {fallbackPhase >= 3 && <div className="mt-2 text-[11px] text-amber-400">Shadow-work mode active</div>}
      </div>

      <div className="relative flex-1 border border-border bg-card px-3 pt-3 pb-6">
        <div className="pointer-events-none absolute inset-x-3 top-1/2 h-px bg-border" />
        <div className="pointer-events-none absolute inset-y-3 left-1/2 w-px bg-border" />

        <div className="grid h-full grid-cols-2 gap-3">
          <div className="flex min-h-0 flex-col gap-2">
            <div className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-foreground">
              <MessageSquare className="h-2.5 w-2.5" />
              Says
            </div>
            <div className="grid flex-1 auto-rows-min grid-cols-1 gap-2 overflow-y-auto pr-1">
              {saysNotes.length === 0 && <div className="text-[11px] italic text-muted-foreground/40">Observed speech snippets...</div>}
              <AnimatePresence initial={false}>
                {saysNotes.map((item, index) => (
                  <motion.div
                    key={`s-${item.sourceIndex}`}
                    layout
                    initial={{ opacity: 0, scale: 0.7, y: -10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.85, transition: { duration: 0.18 } }}
                    transition={{ type: "spring", stiffness: 280, damping: 22 }}
                    className={`min-h-14 break-words border border-amber-200/60 bg-amber-100/80 p-2 text-[10px] leading-snug text-zinc-900 shadow ${stickRotation(index)}`}
                  >
                    {item.text}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>

          <div className="flex min-h-0 flex-col gap-2">
            <div className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-foreground">
              <Brain className="h-2.5 w-2.5" />
              Thinks
            </div>
            <div className="grid flex-1 auto-rows-min grid-cols-1 gap-2 overflow-y-auto pr-1">
              {thinksNotes.length === 0 && <div className="text-[11px] italic text-muted-foreground/40">Inferred beliefs and assumptions...</div>}
              <AnimatePresence initial={false}>
                {thinksNotes.map((item, index) => (
                  <motion.div
                    key={`t-${item.sourceIndex}`}
                    layout
                    initial={{ opacity: 0, scale: 0.7, y: -10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.85, transition: { duration: 0.18 } }}
                    transition={{ type: "spring", stiffness: 280, damping: 22 }}
                    className={`min-h-14 break-words border border-amber-200/60 bg-amber-100/80 p-2 text-[10px] leading-snug text-zinc-900 shadow ${stickRotation(index + 1)}`}
                  >
                    {item.text}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>

          <div className="flex min-h-0 flex-col gap-2">
            <div className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-foreground">
              <HandMetal className="h-2.5 w-2.5" />
              Does
            </div>
            <div className="grid flex-1 auto-rows-min grid-cols-1 gap-2 overflow-y-auto pr-1">
              {doesNotes.length === 0 && <div className="text-[11px] italic text-muted-foreground/40">Observed behavior and actions...</div>}
              <AnimatePresence initial={false}>
                {doesNotes.map((item, index) => (
                  <motion.div
                    key={`d-${item.sourceIndex}`}
                    layout
                    initial={{ opacity: 0, scale: 0.7, y: -10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.85, transition: { duration: 0.18 } }}
                    transition={{ type: "spring", stiffness: 280, damping: 22 }}
                    className={`min-h-14 break-words border border-amber-200/60 bg-amber-100/80 p-2 text-[10px] leading-snug text-zinc-900 shadow ${stickRotation(index + 2)}`}
                  >
                    {item.text}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>

          <div className="flex min-h-0 flex-col gap-2">
            <div className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-foreground">
              <Heart className="h-2.5 w-2.5" />
              Feels
            </div>
            <div className="grid flex-1 auto-rows-min grid-cols-1 gap-2 overflow-y-auto pr-1">
              {feelsNotes.length === 0 && <div className="text-[11px] italic text-muted-foreground/40">Inferred emotional state...</div>}
              <AnimatePresence initial={false}>
                {feelsNotes.map((item, index) => (
                  <motion.div
                    key={`f-${item.sourceIndex}`}
                    layout
                    initial={{ opacity: 0, scale: 0.7, y: -10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.85, transition: { duration: 0.18 } }}
                    transition={{ type: "spring", stiffness: 280, damping: 22 }}
                    className={`min-h-14 break-words border border-amber-200/60 bg-amber-100/80 p-2 text-[10px] leading-snug text-zinc-900 shadow ${stickRotation(index + 3)}`}
                  >
                    {item.text}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        </div>

        <div className="pointer-events-none absolute left-3 bottom-2 text-[10px] uppercase tracking-wide text-muted-foreground/80">Observed</div>
        <div className="pointer-events-none absolute right-3 bottom-2 text-[10px] uppercase tracking-wide text-muted-foreground/80">Inferred</div>
        {/* Persona dot at the empathy-map origin. Decorative only — the
            full name lives in the CANVAS META header above ("Persona: ..."),
            so we keep this small enough to avoid clipping the THINKS/FEELS
            column headers (which the old pill-with-text was doing). */}
        <div
          className="pointer-events-none absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-border bg-background"
          title={profile.preferredName}
          aria-label={`Persona: ${profile.preferredName}`}
        />
      </div>

      {metaHistory && metaHistory.length >= 2 && (
        <div className="mt-3">
          <MoodTimeline metaHistory={metaHistory} />
        </div>
      )}

      {sessionHistory && sessionHistory.length > 0 && (
        <div className="mt-3 rounded border border-border bg-card p-3">
          <button
            onClick={() => setHistoryOpen((v) => !v)}
            className="flex w-full items-center justify-between gap-2 text-left"
            aria-expanded={historyOpen}
          >
            <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <History className="h-3 w-3" />
              Past sessions
              <span className="ml-1 rounded bg-muted-foreground/15 px-1 text-[10px] text-muted-foreground">
                {sessionHistory.length}
              </span>
            </span>
            <ChevronDown
              className={`h-4 w-4 text-muted-foreground transition-transform ${historyOpen ? "rotate-180" : ""}`}
            />
          </button>

          {historyOpen && (
            <ol className="mt-2 space-y-1.5">
              {[...sessionHistory].reverse().map((session, i) => {
                const open = openSessionIdx === i
                const when = (() => {
                  const d = new Date(session.savedAt)
                  return Number.isNaN(d.getTime())
                    ? ""
                    : d.toLocaleDateString(undefined, { month: "short", day: "numeric" })
                })()
                return (
                  <li key={session.id || session.savedAt || i} className="rounded border border-border/60 bg-background">
                    <button
                      onClick={() => setOpenSessionIdx(open ? null : i)}
                      className="flex w-full items-center justify-between gap-2 px-2.5 py-1.5 text-left"
                      aria-expanded={open}
                    >
                      <span className="truncate text-[12px] text-foreground">{session.headline}</span>
                      <span className="flex shrink-0 items-center gap-1 text-[10px] text-muted-foreground">
                        {when}
                        <ChevronDown className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} />
                      </span>
                    </button>
                    {open && session.summaryParagraphs.length > 0 && (
                      <div className="border-t border-border/60 px-2.5 py-2">
                        {session.summaryParagraphs.map((p, pi) => (
                          <p key={pi} className="mb-1.5 text-[11px] leading-relaxed text-muted-foreground last:mb-0">
                            {p}
                          </p>
                        ))}
                      </div>
                    )}
                    {open && session.summaryParagraphs.length === 0 && (
                      <div className="border-t border-border/60 px-2.5 py-2 text-[11px] text-muted-foreground/70">
                        No saved reflection for this session.
                      </div>
                    )}
                  </li>
                )
              })}
            </ol>
          )}
        </div>
      )}

      {timeline && timeline.length > 0 && (
        <div className="mt-3 border border-border bg-card p-3">
          <div className="mb-2 flex items-center gap-1.5">
            <Activity className="h-3 w-3 text-muted-foreground" />
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
              What I am tracking
            </div>
            <div className="ml-auto text-[10px] text-muted-foreground/60">
              {timeline.length} update{timeline.length === 1 ? "" : "s"}
            </div>
          </div>
          <ol className="max-h-44 space-y-1 overflow-y-auto pr-1">
            {[...timeline]
              .slice(-20)
              .reverse()
              .map((item) => (
                <li
                  key={item.id}
                  className="flex items-start gap-2 border-b border-border/40 pb-1 text-[11px] last:border-b-0"
                >
                  <span
                    className={`mt-0.5 flex-shrink-0 rounded border px-1 text-[9px] font-semibold uppercase tracking-wide ${
                      item.quadrant === "says"
                        ? "border-amber-500/40 bg-amber-500/10 text-amber-200"
                        : item.quadrant === "thinks"
                          ? "border-violet-500/40 bg-violet-500/10 text-violet-200"
                          : item.quadrant === "does"
                            ? "border-sky-500/40 bg-sky-500/10 text-sky-200"
                            : "border-rose-500/40 bg-rose-500/10 text-rose-200"
                    }`}
                  >
                    {item.quadrant}
                  </span>
                  <span className="flex-1 leading-snug text-foreground">{item.entry}</span>
                  <span className="flex-shrink-0 text-[10px] text-muted-foreground/60">
                    {new Date(item.at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </li>
              ))}
          </ol>
        </div>
      )}

      <div className="border border-border bg-card p-3">
        <div className="mb-2 flex items-center justify-between">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Consciousness</div>
          <div
            className={`flex items-center gap-1 text-[11px] uppercase tracking-wide ${
              vaultStatus === "unlocked"
                ? "text-emerald-400"
                : vaultStatus === "locked"
                  ? "text-amber-400"
                  : "text-muted-foreground"
            }`}
          >
            {vaultStatus === "unlocked" ? (
              <Unlock className="h-2.5 w-2.5" />
            ) : (
              <Lock className="h-2.5 w-2.5" />
            )}
            {vaultStatus === "unlocked"
              ? "AWAKE · AUTO-SAVE ON"
              : vaultStatus === "locked"
                ? "SEALED"
                : "NONE YET"}
          </div>
        </div>
        <div className="mb-2 text-[10px] leading-snug text-muted-foreground/80">
          {vaultStatus === "unlocked"
            ? "Who you are, your empathy map, and how far we've travelled — encrypted and auto-saved on every change. Download for an offline backup of your consciousness."
            : vaultStatus === "locked"
              ? "Your consciousness is sealed on this device. Upload your file or wait for the unlock prompt."
              : "Download to encrypt your consciousness with a passphrase, then carry it anywhere. Upload accepts consciousness files or legacy plain JSON."}
        </div>
        {vaultStatus === "unlocked" && vaultLastSavedAt && (
          <div className="mb-2 text-[11px] text-muted-foreground/70">
            Last save: {new Date(vaultLastSavedAt).toLocaleTimeString()}
          </div>
        )}
        <div className="flex gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            onChange={handleJsonUpload}
            className="hidden"
          />
          <button
            onClick={triggerUpload}
            className="inline-flex items-center gap-1 rounded border border-border bg-background px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-foreground transition-colors hover:bg-accent"
          >
            <Upload className="h-3 w-3" />
            Upload
          </button>
          <button
            onClick={onProfileExport}
            className="inline-flex items-center gap-1 rounded border border-border bg-background px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-foreground transition-colors hover:bg-accent"
          >
            <Download className="h-3 w-3" />
            Download
          </button>
          {vaultStatus === "unlocked" && onVaultLock && (
            <button
              onClick={onVaultLock}
              className="inline-flex items-center gap-1 rounded border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-amber-300 transition-colors hover:bg-amber-500/20"
              title="Wipe the unlock key from memory; passphrase will be required next time."
            >
              <Lock className="h-3 w-3" />
              Lock
            </button>
          )}
          {vaultStatus !== "no-vault" && onVaultClear && (
            <button
              onClick={onVaultClear}
              className="inline-flex items-center gap-1 rounded border border-rose-500/40 bg-rose-500/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-rose-300 transition-colors hover:bg-rose-500/20"
              title="Delete your encrypted consciousness from this device. Your downloaded backup is unaffected."
            >
              <Trash2 className="h-3 w-3" />
              Clear
            </button>
          )}
        </div>
        <div className="mt-2 text-[11px] text-muted-foreground/90">{jsonStatus}</div>
      </div>

      <div className="border border-border bg-card p-3">
        <div className="mb-1 text-[11px] uppercase tracking-wide text-muted-foreground">Empathy Code</div>
        <div className="mb-2 rounded border border-border bg-background px-2 py-1 text-[10px] text-foreground">{empathyCode || "Not generated yet"}</div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={onGenerateEmpathyCode}
            disabled={!canGenerateCode}
            className="rounded border border-border bg-background px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-foreground transition-colors hover:bg-accent disabled:opacity-40"
          >
            Generate
          </button>
          <button
            onClick={copyEmpathyCode}
            disabled={!empathyCode}
            className="inline-flex items-center gap-1 rounded border border-border bg-background px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-foreground transition-colors hover:bg-accent disabled:opacity-40"
          >
            <Copy className="h-3 w-3" />
            Copy
          </button>
          <a
            href={redditLink}
            target="_blank"
            rel="noreferrer"
            className={`inline-flex items-center gap-1 rounded border border-border bg-background px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-foreground transition-colors hover:bg-accent ${!empathyCode ? "pointer-events-none opacity-40" : ""}`}
          >
            <Link2 className="h-3 w-3" />
            Reddit
          </a>
          <a
            href={xLink}
            target="_blank"
            rel="noreferrer"
            className={`inline-flex items-center gap-1 rounded border border-border bg-background px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-foreground transition-colors hover:bg-accent ${!empathyCode ? "pointer-events-none opacity-40" : ""}`}
          >
            <Link2 className="h-3 w-3" />
            X
          </a>
        </div>
        <div className="mt-2 text-[11px] text-muted-foreground/90">{copyStatus || (canGenerateCode ? "Ready to generate code." : "Exchange at least 6 messages to unlock code generation.")}</div>
      </div>

    </div>
  )
}
