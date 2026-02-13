"use client"

import { useEffect, useRef, useMemo } from "react"

interface AIOrbProps {
  isListening: boolean
  isSpeaking: boolean
  emotion: string
  intensity?: number
}

export function AIOrb({ isListening, isSpeaking, emotion, intensity = 0.5 }: AIOrbProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number>(0)
  const timeRef = useRef(0)

  const emotionConfig = useMemo(() => {
    const configs: Record<string, { rings: number; speed: number; spread: number }> = {
      neutral: { rings: 3, speed: 0.8, spread: 1 },
      happy: { rings: 5, speed: 1.4, spread: 1.3 },
      sad: { rings: 2, speed: 0.4, spread: 0.7 },
      angry: { rings: 6, speed: 2.0, spread: 1.5 },
      fear: { rings: 4, speed: 1.8, spread: 0.9 },
      surprise: { rings: 5, speed: 1.6, spread: 1.4 },
      thinking: { rings: 3, speed: 1.0, spread: 1.1 },
    }
    return configs[emotion] || configs.neutral
  }, [emotion])

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

    const draw = () => {
      timeRef.current += 0.016
      const t = timeRef.current
      const rect = canvas.getBoundingClientRect()
      const w = rect.width
      const h = rect.height
      const cx = w / 2
      const cy = h / 2

      ctx.clearRect(0, 0, w, h)

      // Outer ambient glow
      const ambientRadius = Math.min(w, h) * 0.45
      const ambientGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, ambientRadius)
      ambientGrad.addColorStop(0, `rgba(255, 255, 255, ${0.03 + intensity * 0.04})`)
      ambientGrad.addColorStop(0.5, `rgba(200, 200, 200, ${0.02 + intensity * 0.02})`)
      ambientGrad.addColorStop(1, "rgba(0, 0, 0, 0)")
      ctx.beginPath()
      ctx.arc(cx, cy, ambientRadius, 0, Math.PI * 2)
      ctx.fillStyle = ambientGrad
      ctx.fill()

      // Pulsating core
      const coreSize = 24 + Math.sin(t * emotionConfig.speed) * 6 * intensity
      const coreGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreSize)
      coreGrad.addColorStop(0, `rgba(255, 255, 255, ${0.9 + intensity * 0.1})`)
      coreGrad.addColorStop(0.4, `rgba(220, 220, 220, ${0.6})`)
      coreGrad.addColorStop(0.8, `rgba(180, 180, 180, ${0.2})`)
      coreGrad.addColorStop(1, "rgba(150, 150, 150, 0)")
      ctx.beginPath()
      ctx.arc(cx, cy, coreSize, 0, Math.PI * 2)
      ctx.fillStyle = coreGrad
      ctx.fill()

      // Orbital rings
      const { rings, speed, spread } = emotionConfig
      for (let i = 0; i < rings; i++) {
        const ringRadius = 35 + i * 18 * spread
        const phase = t * speed + (i * Math.PI * 2) / rings
        const wobble = Math.sin(phase) * 4 * intensity
        const ringOpacity = 0.15 + (isListening ? 0.25 : 0) + (isSpeaking ? 0.2 : 0)

        ctx.beginPath()
        ctx.strokeStyle = `rgba(255, 255, 255, ${ringOpacity - i * 0.03})`
        ctx.lineWidth = 1 + (isSpeaking ? Math.sin(t * 8 + i) * 1 : 0)

        for (let a = 0; a < Math.PI * 2; a += 0.02) {
          const deform = Math.sin(a * 3 + phase) * wobble + Math.cos(a * 2 - phase * 0.7) * wobble * 0.5
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
      const particleCount = isListening ? 20 : isSpeaking ? 15 : 8
      for (let i = 0; i < particleCount; i++) {
        const angle = (i / particleCount) * Math.PI * 2 + t * 0.3
        const dist = 50 + Math.sin(t * 0.5 + i * 1.7) * 30 * spread
        const px = cx + Math.cos(angle) * dist
        const py = cy + Math.sin(angle) * dist
        const size = 1 + Math.sin(t + i) * 0.5
        const alpha = 0.2 + Math.sin(t * 2 + i) * 0.15

        ctx.beginPath()
        ctx.arc(px, py, size, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`
        ctx.fill()
      }

      // Voice waveform overlay when speaking
      if (isSpeaking) {
        ctx.beginPath()
        ctx.strokeStyle = `rgba(255, 255, 255, 0.3)`
        ctx.lineWidth = 1.5
        for (let x = cx - 60; x <= cx + 60; x++) {
          const norm = (x - (cx - 60)) / 120
          const wave = Math.sin(norm * Math.PI * 6 + t * 12) * 8 * intensity
          const envelope = Math.sin(norm * Math.PI) // taper edges
          if (x === cx - 60) ctx.moveTo(x, cy + wave * envelope)
          else ctx.lineTo(x, cy + wave * envelope)
        }
        ctx.stroke()
      }

      // Listening indicator - subtle mic visualization
      if (isListening) {
        const listenPulse = Math.sin(t * 4) * 0.5 + 0.5
        ctx.beginPath()
        ctx.arc(cx, cy, 90 + listenPulse * 10, 0, Math.PI * 2)
        ctx.strokeStyle = `rgba(255, 255, 255, ${0.08 + listenPulse * 0.08})`
        ctx.lineWidth = 1
        ctx.setLineDash([4, 8])
        ctx.stroke()
        ctx.setLineDash([])
      }

      animationRef.current = requestAnimationFrame(draw)
    }

    draw()

    return () => {
      window.removeEventListener("resize", resize)
      cancelAnimationFrame(animationRef.current)
    }
  }, [isListening, isSpeaking, emotion, intensity, emotionConfig])

  return (
    <div className="relative flex flex-col items-center justify-center">
      <canvas
        ref={canvasRef}
        className="w-full aspect-square max-w-[280px]"
        style={{ imageRendering: "auto" }}
        aria-label={`AI companion visualization showing ${emotion} emotion`}
      />
      <div className="absolute bottom-4 flex flex-col items-center gap-1">
        <span className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
          {isListening ? "LISTENING" : isSpeaking ? "SPEAKING" : "IDLE"}
        </span>
        <span className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground/60">
          {emotion}
        </span>
      </div>
    </div>
  )
}
