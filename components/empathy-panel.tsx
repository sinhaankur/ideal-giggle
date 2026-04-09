"use client"

import { useRef, useState } from "react"
import { MessageSquare, Brain, HandMetal, Heart, Upload, Download, Copy, Link2 } from "lucide-react"
import type { EmpathyData, EmpathyProfile } from "@/lib/companion-types"

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
}: EmpathyPanelProps) {
  const [jsonStatus, setJsonStatus] = useState<string>("No profile JSON imported yet.")
  const [copyStatus, setCopyStatus] = useState<string>("")
  const fileInputRef = useRef<HTMLInputElement>(null)

  const triggerUpload = () => {
    fileInputRef.current?.click()
  }

  const canGenerateCode = messageCount >= 6
  const depthVisualTone =
    fallbackPhase >= 3
      ? "border-slate-600 bg-slate-950 text-slate-100"
      : depthTierLabel.startsWith("IV")
        ? "border-foreground bg-foreground/5"
        : depthTierLabel.startsWith("III")
          ? "border-foreground/60 bg-card"
          : depthTierLabel.startsWith("II")
            ? "border-border/80 bg-card backdrop-blur-[1px]"
            : "border-border bg-card"

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
        <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Empathy Map</span>
      </div>

      <div className="border border-border bg-card p-3">
        <div className="mb-2 text-[9px] uppercase tracking-[0.2em] text-muted-foreground">Profile JSON</div>
        <div className="mb-2 text-[10px] text-muted-foreground">
          Profile: <span className="text-foreground">{profile.preferredName}</span>
        </div>
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

      <div className={`border p-3 transition-all duration-500 ${depthVisualTone}`}>
        <div className="mb-2 text-[9px] uppercase tracking-[0.2em] text-muted-foreground">Session Depth</div>
        <div className="mb-2 text-[9px] text-muted-foreground/90">Trigger Mode: {depthTierLabel}</div>
        <div className="mb-2 grid grid-cols-2 gap-2">
          <div className="rounded border border-border bg-background px-2 py-1 text-[9px] text-muted-foreground">
            Emotional Velocity: <span className="text-foreground">{(emotionalVelocity * 100).toFixed(0)}%</span>
          </div>
          <div className="rounded border border-border bg-background px-2 py-1 text-[9px] text-muted-foreground">
            Density: <span className="text-foreground">{densityWords} words</span>
          </div>
        </div>
        <div className="mb-3 h-1.5 w-full overflow-hidden rounded bg-border/60">
          <div className="h-full bg-foreground transition-all duration-500" style={{ width: `${Math.max(8, Math.min(100, densitySentiment * 100))}%` }} />
        </div>

        {suggestedQuestion && (
          <div className="mt-2 rounded border border-border bg-background px-2 py-1.5 text-[9px] text-muted-foreground">
            Next recursive prompt: {suggestedQuestion}
          </div>
        )}

        {fallbackPhase >= 3 && (
          <div className="mt-2 rounded border border-slate-600 bg-slate-900 px-2 py-1.5 text-[9px] text-slate-200">
            Shadow-Work Layer is active. Questions are now archetypal and intentionally uncomfortable.
          </div>
        )}

        <div className="mt-3 border-t border-border pt-2">
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
      </div>

      <div className="grid flex-1 grid-cols-2 gap-3">
        {quadrants.map(({ key, label, icon: Icon, emptyText }) => (
          <div key={key} className="flex flex-col border border-border bg-card p-3">
            <div className="mb-2 flex items-center gap-1.5 border-b border-border pb-1.5">
              <Icon className="h-2.5 w-2.5 text-muted-foreground" />
              <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-foreground">{label}</span>
              {data[key].length > 0 && <span className="ml-auto text-[8px] text-muted-foreground">{data[key].length}</span>}
            </div>

            <div className="flex-1 overflow-y-auto">
              {data[key].length === 0 ? (
                <p className="text-center text-[9px] italic leading-relaxed text-muted-foreground/40">{emptyText}</p>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {data[key].map((item, i) => (
                    <div key={i} className="border-l-2 border-muted-foreground/20 bg-background px-2 py-1 text-[10px] leading-relaxed text-muted-foreground">
                      {item}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="border border-border bg-card p-3">
        <div className="mb-2 text-[9px] uppercase tracking-[0.2em] text-muted-foreground">Analysis Summary</div>
        <div className="grid grid-cols-4 gap-2">
          {quadrants.map(({ key, label }) => (
            <div
              key={key}
              className="rounded border border-border bg-background p-2 text-center transition-all duration-500"
              style={{
                opacity: data[key].length > 0 ? 1 : 0.3,
                transform: `scale(${1 + data[key].length * 0.08})`,
              }}
            >
              <div className="text-sm font-bold text-foreground">{data[key].length}</div>
              <div className="text-[8px] uppercase tracking-[0.1em] text-muted-foreground">{label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
