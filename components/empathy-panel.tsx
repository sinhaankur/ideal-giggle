"use client"

import { useRef, useState } from "react"
import { MessageSquare, Brain, HandMetal, Heart, Upload, Download, Copy, Link2 } from "lucide-react"
import type { EmpathyData, EmpathyProfile } from "@/lib/companion-types"
import type { UserUnderstanding } from "@/lib/conversation/communication-engine"

interface EmpathyPanelProps {
  data: EmpathyData
  profile: EmpathyProfile
  onProfileImport: (profile: EmpathyProfile) => void
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
}

const quadrants = [
  {
    key: "says" as const,
    label: "Says",
    icon: MessageSquare,
    emptyText: "Listening for direct expressions...",
  },
  {
    key: "thinks" as const,
    label: "Thinks",
    icon: Brain,
    emptyText: "Inferring beliefs and thoughts...",
  },
  {
    key: "does" as const,
    label: "Does",
    icon: HandMetal,
    emptyText: "Observing actions and behaviors...",
  },
  {
    key: "feels" as const,
    label: "Feels",
    icon: Heart,
    emptyText: "Recognizing emotional signals...",
  },
]

const NOTE_ROTATIONS = ["-rotate-2", "rotate-1", "-rotate-1", "rotate-2", "-rotate-1"]

function trimNotes(items: string[]) {
  return items
    .filter((item) => item.trim().length > 0)
    .slice(-8)
}

function stickRotation(index: number) {
  return NOTE_ROTATIONS[index % NOTE_ROTATIONS.length]
}

function loadTone(load: UserUnderstanding["emotionalLoad"]) {
  if (load === "high") return "border-amber-400/60 bg-amber-100/70 text-amber-900"
  if (load === "moderate") return "border-sky-300/60 bg-sky-100/70 text-sky-900"
  return "border-emerald-300/60 bg-emerald-100/70 text-emerald-900"
}

function opennessTone(openness: UserUnderstanding["openness"]) {
  if (openness === "low") return "border-zinc-400/60 bg-zinc-200/70 text-zinc-900"
  if (openness === "medium") return "border-indigo-300/60 bg-indigo-100/70 text-indigo-900"
  return "border-violet-300/60 bg-violet-100/70 text-violet-900"
}

function intentTone(intent: UserUnderstanding["primaryIntent"]) {
  if (intent === "problem-solving") return "border-cyan-300/60 bg-cyan-100/70 text-cyan-900"
  if (intent === "venting") return "border-orange-300/60 bg-orange-100/70 text-orange-900"
  if (intent === "reflection") return "border-blue-300/60 bg-blue-100/70 text-blue-900"
  if (intent === "check-in") return "border-green-300/60 bg-green-100/70 text-green-900"
  return "border-slate-300/60 bg-slate-100/70 text-slate-900"
}

function styleTone(style: UserUnderstanding["preferredResponseStyle"]) {
  if (style === "direct") return "border-rose-300/60 bg-rose-100/70 text-rose-900"
  if (style === "structured") return "border-teal-300/60 bg-teal-100/70 text-teal-900"
  return "border-lime-300/60 bg-lime-100/70 text-lime-900"
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
}: EmpathyPanelProps) {
  const [jsonStatus, setJsonStatus] = useState<string>("No profile JSON imported yet.")
  const [copyStatus, setCopyStatus] = useState<string>("")
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

      const source = parsed.profile && typeof parsed.profile === "object" ? parsed.profile : parsed

      const normalized: EmpathyProfile = {
        version: String(source.version ?? "1.0"),
        preferredName: String(source.preferredName ?? "Friend"),
        communicationStyle: String(source.communicationStyle ?? "Warm, validating, and practical."),
        supportGoals: Array.isArray(source.supportGoals)
          ? source.supportGoals.map((item: unknown) => String(item))
          : [],
        negativeThoughtPatterns: Array.isArray(source.negativeThoughtPatterns)
          ? source.negativeThoughtPatterns.map((item: unknown) => String(item))
          : [],
        reframePreferences: Array.isArray(source.reframePreferences)
          ? source.reframePreferences.map((item: unknown) => String(item))
          : [],
        groundingPrompts: Array.isArray(source.groundingPrompts)
          ? source.groundingPrompts.map((item: unknown) => String(item))
          : [],
        avoidPhrases: Array.isArray(source.avoidPhrases)
          ? source.avoidPhrases.map((item: unknown) => String(item))
          : [],
      }

      onProfileImport(normalized)
      setJsonStatus(`Loaded profile for ${normalized.preferredName}.`)
    } catch {
      setJsonStatus("Unable to parse JSON. Please upload a valid .json file.")
    } finally {
      event.target.value = ""
    }
  }

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex items-center gap-2 border-b border-border pb-2">
        <Brain className="h-3 w-3 text-muted-foreground" />
        <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Empathy Map Canvas</span>
      </div>

      <div className="border border-border bg-card p-3">
        <div className="mb-2 flex items-center justify-between">
          <div className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground">Canvas Meta</div>
          <div className="text-[9px] text-muted-foreground">Depth: {depthTierLabel}</div>
        </div>
        <div className="mb-2 text-[10px] text-muted-foreground">
          Persona: <span className="text-foreground">{profile.preferredName}</span>
        </div>
        <div className="mb-2 grid grid-cols-2 gap-2 text-[9px] text-muted-foreground">
          <div className="rounded border border-border bg-background px-2 py-1">
            Velocity: <span className="text-foreground">{(emotionalVelocity * 100).toFixed(0)}%</span>
          </div>
          <div className="rounded border border-border bg-background px-2 py-1">
            Density: <span className="text-foreground">{densityWords}</span>
          </div>
        </div>
        <div className="mb-2 h-1.5 w-full overflow-hidden rounded bg-border/60">
          <div className="h-full bg-foreground transition-all duration-500" style={{ width: `${Math.max(8, Math.min(100, densitySentiment * 100))}%` }} />
        </div>
        {suggestedQuestion && <div className="text-[9px] text-muted-foreground">Prompt: {suggestedQuestion}</div>}
        <div className="mt-2 grid grid-cols-2 gap-2 text-[9px] text-muted-foreground">
          <div className={`rounded border px-2 py-1 ${intentTone(userUnderstanding.primaryIntent)}`}>
            Intent: <span className="text-foreground capitalize">{userUnderstanding.primaryIntent}</span>
          </div>
          <div className={`rounded border px-2 py-1 ${loadTone(userUnderstanding.emotionalLoad)}`}>
            Load: <span className="text-foreground capitalize">{userUnderstanding.emotionalLoad}</span>
          </div>
          <div className={`rounded border px-2 py-1 ${opennessTone(userUnderstanding.openness)}`}>
            Openness: <span className="text-foreground capitalize">{userUnderstanding.openness}</span>
          </div>
          <div className={`rounded border px-2 py-1 ${styleTone(userUnderstanding.preferredResponseStyle)}`}>
            Style: <span className="text-foreground capitalize">{userUnderstanding.preferredResponseStyle}</span>
          </div>
        </div>
        <div className="mt-2 rounded border border-border bg-background px-2 py-1 text-[9px] text-muted-foreground">
          Needs: <span className="text-foreground">{userUnderstanding.needs.join("; ")}</span>
        </div>
        <div className="mt-2 rounded border border-border/80 bg-background/80 px-2 py-1 text-[8px] uppercase tracking-[0.12em] text-muted-foreground">
          <div className="mb-1 text-[8px] font-semibold text-foreground/80">Color legend</div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="rounded border border-amber-400/60 bg-amber-100/70 px-1.5 py-0.5 text-amber-900">high load</span>
            <span className="rounded border border-zinc-400/60 bg-zinc-200/70 px-1.5 py-0.5 text-zinc-900">low openness</span>
            <span className="rounded border border-orange-300/60 bg-orange-100/70 px-1.5 py-0.5 text-orange-900">venting</span>
            <span className="rounded border border-cyan-300/60 bg-cyan-100/70 px-1.5 py-0.5 text-cyan-900">problem-solving</span>
            <span className="rounded border border-rose-300/60 bg-rose-100/70 px-1.5 py-0.5 text-rose-900">direct style</span>
          </div>
        </div>
        {fallbackPhase >= 3 && <div className="mt-1 text-[9px] text-amber-300">Shadow-work mode active</div>}
      </div>

      <div className="relative flex-1 border border-border bg-card p-3">
        <div className="pointer-events-none absolute inset-x-3 top-1/2 h-px bg-border" />
        <div className="pointer-events-none absolute inset-y-3 left-1/2 w-px bg-border" />

        <div className="grid h-full grid-cols-2 gap-3">
          <div className="flex min-h-0 flex-col gap-2">
            <div className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-[0.16em] text-foreground">
              <MessageSquare className="h-2.5 w-2.5" />
              Says
            </div>
            <div className="grid flex-1 auto-rows-min grid-cols-2 gap-2 overflow-y-auto pr-1">
              {saysNotes.length === 0 && <div className="col-span-2 text-[9px] italic text-muted-foreground/40">Observed speech snippets...</div>}
              {saysNotes.map((item, index) => (
                <div key={`s-${index}`} className={`min-h-14 border border-amber-200/60 bg-amber-100/80 p-2 text-[10px] leading-snug text-zinc-900 shadow ${stickRotation(index)}`}>
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="flex min-h-0 flex-col gap-2">
            <div className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-[0.16em] text-foreground">
              <Brain className="h-2.5 w-2.5" />
              Thinks
            </div>
            <div className="grid flex-1 auto-rows-min grid-cols-2 gap-2 overflow-y-auto pr-1">
              {thinksNotes.length === 0 && <div className="col-span-2 text-[9px] italic text-muted-foreground/40">Inferred beliefs and assumptions...</div>}
              {thinksNotes.map((item, index) => (
                <div key={`t-${index}`} className={`min-h-14 border border-amber-200/60 bg-amber-100/80 p-2 text-[10px] leading-snug text-zinc-900 shadow ${stickRotation(index + 1)}`}>
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="flex min-h-0 flex-col gap-2">
            <div className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-[0.16em] text-foreground">
              <HandMetal className="h-2.5 w-2.5" />
              Does
            </div>
            <div className="grid flex-1 auto-rows-min grid-cols-2 gap-2 overflow-y-auto pr-1">
              {doesNotes.length === 0 && <div className="col-span-2 text-[9px] italic text-muted-foreground/40">Observed behavior and actions...</div>}
              {doesNotes.map((item, index) => (
                <div key={`d-${index}`} className={`min-h-14 border border-amber-200/60 bg-amber-100/80 p-2 text-[10px] leading-snug text-zinc-900 shadow ${stickRotation(index + 2)}`}>
                  {item}
                </div>
              ))}
            </div>
          </div>

          <div className="flex min-h-0 flex-col gap-2">
            <div className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-[0.16em] text-foreground">
              <Heart className="h-2.5 w-2.5" />
              Feels
            </div>
            <div className="grid flex-1 auto-rows-min grid-cols-2 gap-2 overflow-y-auto pr-1">
              {feelsNotes.length === 0 && <div className="col-span-2 text-[9px] italic text-muted-foreground/40">Inferred emotional state...</div>}
              {feelsNotes.map((item, index) => (
                <div key={`f-${index}`} className={`min-h-14 border border-amber-200/60 bg-amber-100/80 p-2 text-[10px] leading-snug text-zinc-900 shadow ${stickRotation(index + 3)}`}>
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="pointer-events-none absolute left-3 bottom-2 text-[8px] uppercase tracking-[0.14em] text-muted-foreground/80">Observed</div>
        <div className="pointer-events-none absolute right-3 bottom-2 text-[8px] uppercase tracking-[0.14em] text-muted-foreground/80">Inferred</div>
        <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-border bg-background px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-foreground">
          {profile.preferredName}
        </div>
      </div>

      <div className="border border-border bg-card p-3">
        <div className="mb-2 text-[9px] uppercase tracking-[0.2em] text-muted-foreground">Profile JSON</div>
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
            className="inline-flex items-center gap-1 rounded border border-border bg-background px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground transition-colors hover:bg-accent"
          >
            <Upload className="h-3 w-3" />
            Upload
          </button>
          <button
            onClick={onProfileExport}
            className="inline-flex items-center gap-1 rounded border border-border bg-background px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground transition-colors hover:bg-accent"
          >
            <Download className="h-3 w-3" />
            Download
          </button>
        </div>
        <div className="mt-2 text-[9px] text-muted-foreground/90">{jsonStatus}</div>
      </div>

      <div className="border border-border bg-card p-3">
        <div className="mb-1 text-[9px] uppercase tracking-[0.2em] text-muted-foreground">Empathy Code</div>
        <div className="mb-2 rounded border border-border bg-background px-2 py-1 text-[10px] text-foreground">{empathyCode || "Not generated yet"}</div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={onGenerateEmpathyCode}
            disabled={!canGenerateCode}
            className="rounded border border-border bg-background px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground transition-colors hover:bg-accent disabled:opacity-40"
          >
            Generate
          </button>
          <button
            onClick={copyEmpathyCode}
            disabled={!empathyCode}
            className="inline-flex items-center gap-1 rounded border border-border bg-background px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground transition-colors hover:bg-accent disabled:opacity-40"
          >
            <Copy className="h-3 w-3" />
            Copy
          </button>
          <a
            href={redditLink}
            target="_blank"
            rel="noreferrer"
            className={`inline-flex items-center gap-1 rounded border border-border bg-background px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground transition-colors hover:bg-accent ${!empathyCode ? "pointer-events-none opacity-40" : ""}`}
          >
            <Link2 className="h-3 w-3" />
            Reddit
          </a>
          <a
            href={xLink}
            target="_blank"
            rel="noreferrer"
            className={`inline-flex items-center gap-1 rounded border border-border bg-background px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-foreground transition-colors hover:bg-accent ${!empathyCode ? "pointer-events-none opacity-40" : ""}`}
          >
            <Link2 className="h-3 w-3" />
            X
          </a>
        </div>
        <div className="mt-2 text-[9px] text-muted-foreground/90">{copyStatus || (canGenerateCode ? "Ready to generate code." : "Exchange at least 6 messages to unlock code generation.")}</div>
      </div>

      <div className="border border-border bg-card p-3">
        <div className="mb-2 text-[9px] uppercase tracking-[0.2em] text-muted-foreground">Quadrant Totals</div>
        <div className="grid grid-cols-4 gap-2">
          {quadrants.map(({ key, label }) => (
            <div key={key} className="rounded border border-border bg-background p-2 text-center">
              <div className="text-sm font-bold text-foreground">{data[key].length}</div>
              <div className="text-[8px] uppercase tracking-[0.1em] text-muted-foreground">{label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
