"use client"

import { useMemo } from "react"
import { TrendingUp, TrendingDown, Minus } from "lucide-react"
import type { EmpathyMetaRecord } from "@/lib/companion-types"

interface MoodTimelineProps {
  // Per-turn meta readings captured across the session. Each carries a
  // sentiment polarity (-1..1) and depth; we visualize how the emotional
  // tone moved so the user can see the shape of where they've been.
  metaHistory: EmpathyMetaRecord[]
}

// A compact emotional-arc sparkline. Turns the per-turn sentiment readings the
// app already tracks into something the person can actually see: did this
// conversation move toward lighter or heavier ground? It's read-only insight,
// not analysis — "here's the shape of where you've been."
export function MoodTimeline({ metaHistory }: MoodTimelineProps) {
  const points = useMemo(
    () =>
      metaHistory
        .map((m) => (Number.isFinite(m.sentimentPolarity) ? m.sentimentPolarity : 0))
        .slice(-24),
    [metaHistory]
  )

  // Need at least a couple of readings for a trend to mean anything.
  if (points.length < 2) return null

  const width = 100
  const height = 32
  const pad = 2
  const stepX = (width - pad * 2) / (points.length - 1)
  // Map polarity -1..1 to y (inverted: positive = up).
  const toY = (v: number) => {
    const clamped = Math.max(-1, Math.min(1, v))
    return height - pad - ((clamped + 1) / 2) * (height - pad * 2)
  }

  const linePath = points
    .map((v, i) => `${i === 0 ? "M" : "L"} ${pad + i * stepX} ${toY(v)}`)
    .join(" ")
  const areaPath = `${linePath} L ${pad + (points.length - 1) * stepX} ${height - pad} L ${pad} ${height - pad} Z`

  const first = points[0]
  const last = points[points.length - 1]
  const delta = last - first
  const avg = points.reduce((s, v) => s + v, 0) / points.length

  const trend =
    delta > 0.15 ? "lighter" : delta < -0.15 ? "heavier" : "steady"
  const TrendIcon = trend === "lighter" ? TrendingUp : trend === "heavier" ? TrendingDown : Minus
  const trendColor =
    trend === "lighter"
      ? "text-emerald-300"
      : trend === "heavier"
        ? "text-sky-300"
        : "text-muted-foreground"

  // Stroke/fill hue tracks the average tone, gently.
  const hue = avg >= 0.1 ? "emerald" : avg <= -0.1 ? "sky" : "slate"
  const strokeMap: Record<string, string> = {
    emerald: "rgb(110, 231, 183)",
    sky: "rgb(125, 211, 252)",
    slate: "rgb(148, 163, 184)",
  }
  const stroke = strokeMap[hue]

  return (
    <div className="rounded border border-border bg-card p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Emotional arc
        </span>
        <span className={`flex items-center gap-1 text-[11px] ${trendColor}`}>
          <TrendIcon className="h-3 w-3" />
          {trend === "lighter"
            ? "moving lighter"
            : trend === "heavier"
              ? "sitting heavier"
              : "holding steady"}
        </span>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-10 w-full"
        preserveAspectRatio="none"
        role="img"
        aria-label={`Emotional arc across ${points.length} moments — currently ${trend}`}
      >
        {/* Mid line (neutral). */}
        <line
          x1={pad}
          y1={toY(0)}
          x2={width - pad}
          y2={toY(0)}
          stroke="currentColor"
          className="text-border"
          strokeWidth={0.5}
          strokeDasharray="2 2"
        />
        <path d={areaPath} fill={stroke} opacity={0.12} />
        <path d={linePath} fill="none" stroke={stroke} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
        {/* Endpoint dot. */}
        <circle cx={pad + (points.length - 1) * stepX} cy={toY(last)} r={1.8} fill={stroke} />
      </svg>
      <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
        {trend === "lighter"
          ? "Things have eased a little as we've talked."
          : trend === "heavier"
            ? "It's gotten heavier as we've gone — that's okay to sit with."
            : "The tone has stayed fairly even through this."}
      </p>
    </div>
  )
}
