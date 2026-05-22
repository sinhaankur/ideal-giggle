"use client"

import { useEffect, useRef, useMemo, useState } from "react"
import { motion, AnimatePresence, useReducedMotion } from "framer-motion"

type OrbPhase = "idle" | "composing" | "engaged" | "thinking" | "listening" | "speaking"

interface AIOrbProps {
  isListening: boolean
  isSpeaking: boolean
  emotion: string
  intensity?: number
  phase?: OrbPhase
  activityLevel?: number
  reducedMotionEnabled?: boolean
  // Mirror's confidence in its current read of the user. Drives a soft
  // ring around the orb so the empathic *certainty* is visible at a glance.
  confidence?: "low" | "medium" | "high" | null
}

export function AIOrb({
  isListening,
  isSpeaking,
  emotion,
  intensity = 0.5,
  phase,
  activityLevel,
  reducedMotionEnabled = false,
  confidence = null,
}: AIOrbProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number>(0)
  const timeRef = useRef(0)
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)
  const systemReducedMotion = useReducedMotion()

  const resolvedPhase: OrbPhase =
    phase || (isSpeaking ? "speaking" : isListening ? "listening" : "idle")
  const normalizedActivity = Math.max(0.15, Math.min(1, activityLevel ?? intensity))

  const emotionConfig = useMemo(() => {
    // rgb tuple is the orb's hue for this emotion. Picked so the colour
    // reads at a glance without needing the label below: warm = happy/
    // angry, cool = sad/thinking, violet = fear, cyan = surprise.
    type Config = {
      rings: number
      speed: number
      spread: number
      rgb: [number, number, number]
    }
    const configs: Record<string, Config> = {
      neutral:   { rings: 3, speed: 0.8, spread: 1,   rgb: [232, 234, 240] }, // soft white
      happy:     { rings: 5, speed: 1.4, spread: 1.3, rgb: [251, 191,  36] }, // warm amber
      sad:       { rings: 2, speed: 0.4, spread: 0.7, rgb: [ 96, 165, 250] }, // cool blue
      angry:     { rings: 6, speed: 2.0, spread: 1.5, rgb: [251, 113, 133] }, // coral
      fear:      { rings: 4, speed: 1.8, spread: 0.9, rgb: [167, 139, 250] }, // violet
      surprise:  { rings: 5, speed: 1.6, spread: 1.4, rgb: [ 34, 211, 238] }, // cyan
      thinking:  { rings: 3, speed: 1.0, spread: 1.1, rgb: [148, 163, 184] }, // slate
    }
    return configs[emotion] || configs.neutral
  }, [emotion])

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return

    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)")
    setPrefersReducedMotion(mediaQuery.matches)

    const onChange = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches)
    }

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", onChange)
      return () => mediaQuery.removeEventListener("change", onChange)
    }

    mediaQuery.addListener(onChange)
    return () => mediaQuery.removeListener(onChange)
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const resize = () => {
      const dpr = window.devicePixelRatio || 1
      const rect = canvas.getBoundingClientRect()
      canvas.width = rect.width * dpr
      canvas.height = rect.height * dpr
      ctx.scale(dpr, dpr)
    }
    resize()
    window.addEventListener("resize", resize)

    let tabVisible =
      typeof document === "undefined" ? true : document.visibilityState !== "hidden"
    const onVisibility = () => {
      tabVisible = document.visibilityState !== "hidden"
      // Resume the loop the moment the tab comes back so the orb doesn't
      // sit frozen for the first frame after focus.
      if (tabVisible && !(reducedMotionEnabled && prefersReducedMotion)) {
        cancelAnimationFrame(animationRef.current)
        animationRef.current = requestAnimationFrame(draw)
      }
    }
    document.addEventListener("visibilitychange", onVisibility)

    const draw = () => {
      // Free perf: skip the draw when the tab is hidden. The wrapper rAF
      // re-schedules so we resume cheaply when the tab returns (above).
      if (!tabVisible) {
        animationRef.current = requestAnimationFrame(draw)
        return
      }
      if (!(reducedMotionEnabled && prefersReducedMotion)) {
        timeRef.current += 0.016
      }
      const t = timeRef.current
      const rect = canvas.getBoundingClientRect()
      const w = rect.width
      const h = rect.height
      const cx = w / 2
      const cy = h / 2

      ctx.clearRect(0, 0, w, h)

      const [er, eg, eb] = emotionConfig.rgb
      const rgba = (a: number) => `rgba(${er}, ${eg}, ${eb}, ${a})`

      // Outer ambient glow — tinted by emotion so the orb's vibe reads
      // at a glance without users having to parse the label.
      const ambientRadius = Math.min(w, h) * 0.45
      const ambientGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, ambientRadius)
      ambientGrad.addColorStop(0, rgba(0.04 + normalizedActivity * 0.06))
      ambientGrad.addColorStop(0.5, rgba(0.02 + normalizedActivity * 0.03))
      ambientGrad.addColorStop(1, "rgba(0, 0, 0, 0)")
      ctx.beginPath()
      ctx.arc(cx, cy, ambientRadius, 0, Math.PI * 2)
      ctx.fillStyle = ambientGrad
      ctx.fill()

      // Pulsating core
      const phaseBeatSpeed =
        resolvedPhase === "speaking"
          ? 2.2
          : resolvedPhase === "thinking"
            ? 1.6
            : resolvedPhase === "engaged"
              ? 1.25
              : resolvedPhase === "composing"
                ? 1.1
                : resolvedPhase === "listening"
                  ? 1.4
                  : 0.8
      const coreSize = 24 + Math.sin(t * emotionConfig.speed * phaseBeatSpeed) * 6 * normalizedActivity
      const coreGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreSize)
      // Inner hot spot stays bright white so the orb reads as luminous;
      // outer falloff blends into the emotion's tint.
      coreGrad.addColorStop(0, `rgba(255, 255, 255, ${0.9 + normalizedActivity * 0.1})`)
      coreGrad.addColorStop(0.35, rgba(0.7))
      coreGrad.addColorStop(0.8, rgba(0.2))
      coreGrad.addColorStop(1, rgba(0))
      ctx.beginPath()
      ctx.arc(cx, cy, coreSize, 0, Math.PI * 2)
      ctx.fillStyle = coreGrad
      ctx.fill()

      // Orbital rings — phase decides the *direction* of travel so the
      // user can read state directionally (listening = inward, speaking
      // = outward, thinking = rotational).
      const { rings, speed, spread } = emotionConfig
      const phaseSign =
        resolvedPhase === "listening"
          ? -1                         // rings collapse inward (intake)
          : resolvedPhase === "speaking"
            ? 1                        // rings expand outward (emit)
            : 0                        // ambient
      const ringDrift = phaseSign * (Math.sin(t * 1.4) * 0.5 + 0.5) * 6 * normalizedActivity

      for (let i = 0; i < rings; i++) {
        const ringRadius = 35 + i * 18 * spread + ringDrift
        const ringPhase = t * speed + (i * Math.PI * 2) / rings
        const wobble = Math.sin(ringPhase) * 4 * normalizedActivity
        const phaseBoost =
          resolvedPhase === "listening" ? 0.25
          : resolvedPhase === "speaking" ? 0.22
          : resolvedPhase === "thinking" ? 0.16
          : resolvedPhase === "engaged"  ? 0.1
          : resolvedPhase === "composing" ? 0.08
          : 0
        const ringOpacity = Math.max(0.04, 0.18 + phaseBoost - i * 0.03)

        ctx.beginPath()
        ctx.strokeStyle = rgba(ringOpacity)
        ctx.lineWidth =
          1 +
          (resolvedPhase === "speaking"
            ? Math.sin(t * 8 + i) * 1
            : resolvedPhase === "thinking"
              ? Math.sin(t * 4 + i * 0.3) * 0.4
              : 0)

        for (let a = 0; a < Math.PI * 2; a += 0.02) {
          const deform = Math.sin(a * 3 + ringPhase) * wobble + Math.cos(a * 2 - ringPhase * 0.7) * wobble * 0.5
          const r = ringRadius + deform
          const x = cx + Math.cos(a) * r
          const y = cy + Math.sin(a) * r
          if (a === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        }
        ctx.closePath()
        ctx.stroke()
      }

      // Particle system
      const particleCount =
        resolvedPhase === "listening"
          ? 22
          : resolvedPhase === "speaking"
            ? 18
            : resolvedPhase === "thinking"
              ? 14
              : resolvedPhase === "engaged"
                ? 12
                : resolvedPhase === "composing"
                  ? 10
                  : 8
      for (let i = 0; i < particleCount; i++) {
        const angle = (i / particleCount) * Math.PI * 2 + t * 0.3
        const dist = 50 + Math.sin(t * 0.5 + i * 1.7) * 30 * spread
        const px = cx + Math.cos(angle) * dist
        const py = cy + Math.sin(angle) * dist
        const size = 1 + Math.sin(t + i) * (0.35 + normalizedActivity * 0.2)
        const alpha = 0.18 + Math.sin(t * 2 + i) * (0.08 + normalizedActivity * 0.1)

        ctx.beginPath()
        ctx.arc(px, py, size, 0, Math.PI * 2)
        ctx.fillStyle = rgba(alpha)
        ctx.fill()
      }

      // Voice waveform overlay when speaking
      if (resolvedPhase === "speaking") {
        ctx.beginPath()
        ctx.strokeStyle = rgba(0.35)
        ctx.lineWidth = 1.5
        for (let x = cx - 60; x <= cx + 60; x++) {
          const norm = (x - (cx - 60)) / 120
          const wave = Math.sin(norm * Math.PI * 6 + t * 12) * 8 * normalizedActivity
          const envelope = Math.sin(norm * Math.PI) // taper edges
          if (x === cx - 60) ctx.moveTo(x, cy + wave * envelope)
          else ctx.lineTo(x, cy + wave * envelope)
        }
        ctx.stroke()
      }

      // Listening indicator - subtle mic visualization
      if (resolvedPhase === "listening") {
        const listenPulse = Math.sin(t * 4) * 0.5 + 0.5
        ctx.beginPath()
        ctx.arc(cx, cy, 90 + listenPulse * 10, 0, Math.PI * 2)
        ctx.strokeStyle = rgba(0.1 + listenPulse * 0.1)
        ctx.lineWidth = 1
        ctx.setLineDash([4, 8])
        ctx.stroke()
        ctx.setLineDash([])
      }

      if (resolvedPhase === "thinking") {
        ctx.beginPath()
        ctx.strokeStyle = rgba(0.18)
        ctx.lineWidth = 1
        ctx.setLineDash([2, 7])
        // Rotate the dash phase so the dashed ring looks like it's
        // spinning — distinctive thinking motion that reads at a glance.
        ctx.lineDashOffset = -t * 24
        ctx.arc(cx, cy, 74 + Math.sin(t * 1.8) * 3, 0, Math.PI * 2)
        ctx.stroke()
        ctx.setLineDash([])
        ctx.lineDashOffset = 0
      }

      if (!(reducedMotionEnabled && prefersReducedMotion)) {
        animationRef.current = requestAnimationFrame(draw)
      }
    }

    draw()

    return () => {
      window.removeEventListener("resize", resize)
      document.removeEventListener("visibilitychange", onVisibility)
      cancelAnimationFrame(animationRef.current)
    }
  }, [emotion, emotionConfig, normalizedActivity, prefersReducedMotion, reducedMotionEnabled, resolvedPhase])

  const motionDisabled = (reducedMotionEnabled && prefersReducedMotion) || systemReducedMotion === true

  const wrapperPulse = motionDisabled
    ? { scale: 1 }
    : {
        scale:
          resolvedPhase === "speaking"
            ? [1, 1.035, 1]
            : resolvedPhase === "listening"
              ? [1, 1.025, 1]
              : resolvedPhase === "thinking"
                ? [1, 1.018, 1]
                : resolvedPhase === "engaged"
                  ? [1, 1.012, 1]
                  : 1,
      }

  const pulseDuration =
    resolvedPhase === "speaking"
      ? 1.6
      : resolvedPhase === "listening"
        ? 2.2
        : resolvedPhase === "thinking"
          ? 2.6
          : 3.4

  return (
    <motion.div
      className="relative flex flex-col items-center justify-center"
      initial={motionDisabled ? false : { opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.6, ease: [0.22, 0.9, 0.32, 1] }}
    >
      <motion.div
        className="w-full max-w-[280px]"
        animate={wrapperPulse}
        transition={{
          duration: pulseDuration,
          repeat: motionDisabled ? 0 : Infinity,
          ease: "easeInOut",
        }}
      >
        <div className="relative">
          <canvas
            ref={canvasRef}
            className="w-full aspect-square"
            style={{ imageRendering: "auto" }}
            aria-label={`AI companion visualization showing ${emotion} emotion`}
          />
          {confidence && (
            <div
              className={`pointer-events-none absolute inset-2 rounded-full transition-opacity duration-500 ${
                confidence === "high"
                  ? "ring-2 ring-emerald-400/40 shadow-[0_0_28px_rgba(52,211,153,0.18)]"
                  : confidence === "medium"
                    ? "ring-2 ring-amber-300/30 shadow-[0_0_20px_rgba(252,211,77,0.12)]"
                    : "ring ring-muted-foreground/20"
              }`}
              aria-hidden
              title={`Mirror confidence: ${confidence}`}
            />
          )}
        </div>
      </motion.div>
      <div className="absolute bottom-4 flex flex-col items-center gap-1">
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={resolvedPhase}
            className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground"
            initial={motionDisabled ? false : { opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={motionDisabled ? { opacity: 0 } : { opacity: 0, y: -4 }}
            transition={{ duration: 0.25 }}
          >
            {resolvedPhase.toUpperCase()}
          </motion.span>
        </AnimatePresence>
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={emotion}
            className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground/60"
            initial={motionDisabled ? false : { opacity: 0, y: 3 }}
            animate={{ opacity: 1, y: 0 }}
            exit={motionDisabled ? { opacity: 0 } : { opacity: 0, y: -3 }}
            transition={{ duration: 0.25, delay: 0.05 }}
          >
            {emotion}
          </motion.span>
        </AnimatePresence>
      </div>
    </motion.div>
  )
}
