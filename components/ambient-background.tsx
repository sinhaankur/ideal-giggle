"use client"

/**
 * AmbientBackground — a living, mood-aware atmosphere behind the whole app.
 *
 * Three very soft, slowly-drifting "aurora" blobs breathe behind everything.
 * Their palette eases toward the current emotion so the room quietly changes
 * with how the person feels: calm indigo at rest, warm amber when they're in
 * pain, gentle green when they're okay. It's purely atmospheric — decorative,
 * pointer-events-none, sits at the very back — so it can never touch the
 * conversation or the safety layer.
 *
 * Deliberately understated: low opacity, heavy blur, slow motion. This is a
 * calm companion; the background should be felt, not noticed. Honours
 * prefers-reduced-motion (holds a still gradient instead of animating).
 *
 * © Ankur Sinha.
 */

import { useEffect, useMemo, useRef, useState } from "react"
import type { Emotion } from "@/lib/companion-types"

// Each emotion → a trio of soft hues (the three blobs). Muted, never loud —
// these are lit at ~0.10–0.16 opacity under heavy blur.
const PALETTES: Record<Emotion, [string, string, string]> = {
  neutral:  ["#3b3f7a", "#2a4a63", "#1f2540"], // calm indigo / slate-teal
  happy:    ["#c98a2e", "#6b8f3d", "#2f6d63"], // warm amber → soft green
  sad:      ["#3a5580", "#4a4a72", "#26364f"], // deep blue, holding space
  angry:    ["#7a3b52", "#8a5a2e", "#3a2740"], // banked ember, not alarming
  fear:     ["#4a5580", "#5a4a78", "#2a3350"], // cool violet, steadying
  surprise: ["#5a6bb0", "#7a5aa0", "#3a4a80"], // brighter, lifted
  thinking: ["#2f5a6b", "#3a4a72", "#243a4a"], // quiet contemplative teal
}

// Ease between palettes so the mood shift is a slow tide, not a cut.
function useSmoothedPalette(emotion: Emotion) {
  const target = PALETTES[emotion] ?? PALETTES.neutral
  const [current, setCurrent] = useState<[string, string, string]>(target)
  const rafRef = useRef<number | null>(null)
  const stateRef = useRef(target.map(hexToRgb))

  useEffect(() => {
    const goal = target.map(hexToRgb)
    const step = () => {
      let moved = false
      const next = stateRef.current.map((cur, i) => {
        const g = goal[i]
        const nc = cur.map((ch, k) => {
          const d = g[k] - ch
          if (Math.abs(d) > 0.5) moved = true
          return ch + d * 0.04 // slow lerp
        }) as [number, number, number]
        return nc
      })
      stateRef.current = next
      setCurrent(next.map(rgbToHex) as [string, string, string])
      if (moved) rafRef.current = requestAnimationFrame(step)
    }
    rafRef.current = requestAnimationFrame(step)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emotion])

  return current
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "")
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]
}
function rgbToHex([r, g, b]: number[]): string {
  const c = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0")
  return `#${c(r)}${c(g)}${c(b)}`
}

export function AmbientBackground({ emotion = "neutral" }: { emotion?: Emotion }) {
  const [a, b, c] = useSmoothedPalette(emotion)
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    const m = window.matchMedia("(prefers-reduced-motion: reduce)")
    setReduced(m.matches)
    const on = () => setReduced(m.matches)
    m.addEventListener?.("change", on)
    return () => m.removeEventListener?.("change", on)
  }, [])

  const blobs = useMemo(
    () => [
      { color: a, style: { top: "-12%", left: "-8%", width: "62vw", height: "62vw" }, anim: "ambientDriftA" },
      { color: b, style: { bottom: "-18%", right: "-10%", width: "58vw", height: "58vw" }, anim: "ambientDriftB" },
      { color: c, style: { top: "28%", left: "38%", width: "48vw", height: "48vw" }, anim: "ambientDriftC" },
    ],
    [a, b, c],
  )

  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden" aria-hidden>
      {blobs.map((blob, i) => (
        <div
          key={i}
          className="absolute rounded-full"
          style={{
            ...blob.style,
            background: `radial-gradient(circle at 50% 50%, ${blob.color} 0%, transparent 70%)`,
            filter: "blur(80px)",
            opacity: 0.32,
            animation: reduced ? undefined : `${blob.anim} ${34 + i * 8}s ease-in-out infinite`,
            transition: "background 1.2s linear",
            willChange: "transform",
          }}
        />
      ))}
      {/* A gentle vignette so the centre content stays grounded over the drift
          (light — the atmosphere should still read at the edges). */}
      <div
        className="absolute inset-0"
        style={{ background: "radial-gradient(ellipse at 50% 45%, transparent 55%, rgba(10,10,10,0.4) 100%)" }}
      />
      <style>{`
        @keyframes ambientDriftA {
          0%,100% { transform: translate3d(0,0,0) scale(1); }
          50%     { transform: translate3d(4vw,3vh,0) scale(1.08); }
        }
        @keyframes ambientDriftB {
          0%,100% { transform: translate3d(0,0,0) scale(1.05); }
          50%     { transform: translate3d(-5vw,-2vh,0) scale(0.96); }
        }
        @keyframes ambientDriftC {
          0%,100% { transform: translate3d(0,0,0) scale(0.98); }
          50%     { transform: translate3d(-3vw,4vh,0) scale(1.10); }
        }
      `}</style>
    </div>
  )
}
