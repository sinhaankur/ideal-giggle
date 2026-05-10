"use client"

import { useEffect, useRef, useState } from "react"
import { motion } from "framer-motion"
import { Wind, X } from "lucide-react"

type Phase = "inhale" | "hold" | "exhale"

const PHASE_DURATIONS: Record<Phase, number> = {
  inhale: 4_000,
  hold: 7_000,
  exhale: 8_000,
}

const PHASE_LABEL: Record<Phase, string> = {
  inhale: "Breathe in",
  hold: "Hold",
  exhale: "Breathe out",
}

const PHASE_ORDER: Phase[] = ["inhale", "hold", "exhale"]
const TOTAL_CYCLES = 3

interface BreathCoachProps {
  onClose: () => void
  reducedMotion?: boolean
}

export function BreathCoach({ onClose, reducedMotion }: BreathCoachProps) {
  const [phase, setPhase] = useState<Phase>("inhale")
  const [cycle, setCycle] = useState(1)
  const phaseTimerRef = useRef<number | null>(null)

  useEffect(() => {
    phaseTimerRef.current = window.setTimeout(() => {
      const currentIndex = PHASE_ORDER.indexOf(phase)
      const isLastPhase = currentIndex === PHASE_ORDER.length - 1
      if (isLastPhase) {
        if (cycle >= TOTAL_CYCLES) {
          onClose()
          return
        }
        setCycle((c) => c + 1)
        setPhase("inhale")
      } else {
        setPhase(PHASE_ORDER[currentIndex + 1])
      }
    }, PHASE_DURATIONS[phase])

    return () => {
      if (phaseTimerRef.current !== null) {
        window.clearTimeout(phaseTimerRef.current)
      }
    }
  }, [phase, cycle, onClose])

  const scale = phase === "inhale" ? 1.4 : phase === "hold" ? 1.4 : 0.85

  return (
    <div
      className="flex flex-col items-center gap-3 border-b border-emerald-500/30 bg-emerald-500/5 px-4 py-4 text-center"
      role="region"
      aria-label="Breath coach"
    >
      <div className="flex w-full items-center justify-between text-[11px] uppercase tracking-wide text-emerald-300">
        <span className="flex items-center gap-1.5">
          <Wind className="h-3 w-3" />
          4-7-8 Breath · cycle {cycle} / {TOTAL_CYCLES}
        </span>
        <button
          onClick={onClose}
          className="flex h-5 w-5 items-center justify-center rounded border border-emerald-500/40 bg-background text-emerald-300 transition-colors hover:bg-emerald-500/20"
          aria-label="End breathing exercise"
        >
          <X className="h-3 w-3" />
        </button>
      </div>

      <motion.div
        className="flex h-16 w-16 items-center justify-center rounded-full border border-emerald-400/40 bg-emerald-500/10"
        animate={
          reducedMotion
            ? { opacity: phase === "exhale" ? 0.5 : 1 }
            : { scale }
        }
        transition={
          reducedMotion
            ? { duration: 0.2 }
            : {
                duration: PHASE_DURATIONS[phase] / 1000,
                ease: phase === "exhale" ? "easeInOut" : "easeOut",
              }
        }
      >
        <span className="text-[10px] uppercase tracking-wide text-emerald-200">
          {phase === "inhale" ? "in" : phase === "hold" ? "hold" : "out"}
        </span>
      </motion.div>

      <div className="text-sm font-medium text-foreground">{PHASE_LABEL[phase]}</div>
      <div className="text-[11px] text-muted-foreground">
        {phase === "inhale"
          ? "through your nose, 4 counts"
          : phase === "hold"
            ? "let your chest stay open, 7 counts"
            : "through pursed lips, 8 counts"}
      </div>
    </div>
  )
}
