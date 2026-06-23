"use client"

import { useState } from "react"
import { Heart, Phone, Wind, Anchor, X, ExternalLink } from "lucide-react"
import { CRISIS_RESOURCES } from "@/lib/safety/crisis-safety"
import { BreathCoach } from "@/components/breath-coach"

interface SupportPanelProps {
  onClose: () => void
  reducedMotion?: boolean
}

// An always-available calm "Support" surface. Unlike the in-conversation
// breath prompt (which only appears when the engine reads high load), this is
// something the user can open ANY time from the header — proactively, before
// things get heavy. It offers two grounding tools and the same vetted crisis
// resources the safety layer uses. Nothing here depends on the AI.
export function SupportPanel({ onClose, reducedMotion = false }: SupportPanelProps) {
  const [tool, setTool] = useState<"menu" | "breath" | "grounding">("menu")

  return (
    <div
      className="absolute inset-0 z-50 flex items-center justify-center bg-background/95 px-4"
      role="dialog"
      aria-modal="true"
      aria-label="Support and grounding"
    >
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-5">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Heart className="h-4 w-4 text-rose-300" />
            A moment of support
          </div>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded border border-border bg-background text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            aria-label="Close support"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {tool === "breath" ? (
          <div>
            <BreathCoach onClose={() => setTool("menu")} reducedMotion={reducedMotion} />
            <button
              onClick={() => setTool("menu")}
              className="mt-3 w-full rounded border border-border bg-background px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Back to support
            </button>
          </div>
        ) : tool === "grounding" ? (
          <GroundingExercise onBack={() => setTool("menu")} />
        ) : (
          <>
            <p className="text-[13px] leading-relaxed text-muted-foreground">
              Whatever&apos;s going on, you don&apos;t have to push through it alone right now.
              Pick something gentle, or reach a real person any time.
            </p>

            <div className="mt-4 grid gap-2">
              <button
                onClick={() => setTool("breath")}
                className="flex items-start gap-3 rounded border border-border bg-background p-3 text-left transition-colors hover:border-sky-500/50"
              >
                <Wind className="mt-0.5 h-4 w-4 flex-shrink-0 text-sky-300" />
                <div>
                  <div className="text-sm font-semibold text-foreground">Take a breath</div>
                  <div className="text-xs text-muted-foreground">
                    A slow, guided breathing pace to settle your nervous system.
                  </div>
                </div>
              </button>

              <button
                onClick={() => setTool("grounding")}
                className="flex items-start gap-3 rounded border border-border bg-background p-3 text-left transition-colors hover:border-emerald-500/50"
              >
                <Anchor className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-300" />
                <div>
                  <div className="text-sm font-semibold text-foreground">Ground yourself (5-4-3-2-1)</div>
                  <div className="text-xs text-muted-foreground">
                    A short sensory exercise to come back to the present moment.
                  </div>
                </div>
              </button>
            </div>

            <div className="mt-4 rounded border border-rose-500/30 bg-rose-500/5 p-3">
              <div className="mb-2 flex items-center gap-2 text-[12px] font-semibold text-rose-200">
                <Phone className="h-3.5 w-3.5" />
                If you need a real person now
              </div>
              <ul className="space-y-1.5">
                {CRISIS_RESOURCES.map((r) => (
                  <li key={r.region} className="text-[12px] leading-relaxed text-muted-foreground">
                    <span className="font-medium text-foreground">{r.region}:</span>{" "}
                    {r.href ? (
                      <a
                        href={r.href}
                        target={r.href.startsWith("http") ? "_blank" : undefined}
                        rel={r.href.startsWith("http") ? "noreferrer noopener" : undefined}
                        className="inline-flex items-center gap-0.5 text-foreground underline decoration-rose-400/40 underline-offset-2 hover:decoration-rose-400"
                      >
                        {r.text}
                        {r.href.startsWith("http") && <ExternalLink className="h-3 w-3" />}
                      </a>
                    ) : (
                      r.text
                    )}
                  </li>
                ))}
              </ul>
            </div>

            <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground/70">
              EMPATHEIA is a companion, not a crisis service. These lines are free, confidential, and staffed by trained people.
            </p>
          </>
        )}
      </div>
    </div>
  )
}

// A self-contained 5-4-3-2-1 grounding walkthrough. Each step asks the user to
// notice something through a sense; advancing is the whole interaction — no AI,
// no input required, works offline.
const GROUNDING_STEPS = [
  { count: 5, sense: "things you can SEE", hint: "Look around slowly. Name them to yourself." },
  { count: 4, sense: "things you can FEEL", hint: "The chair, your feet, fabric, temperature." },
  { count: 3, sense: "things you can HEAR", hint: "Near and far. Let the sounds just be there." },
  { count: 2, sense: "things you can SMELL", hint: "Or two scents you like, from memory." },
  { count: 1, sense: "thing you can TASTE", hint: "Or one slow, kind breath." },
]

function GroundingExercise({ onBack }: { onBack: () => void }) {
  const [step, setStep] = useState(0)
  const done = step >= GROUNDING_STEPS.length
  const current = GROUNDING_STEPS[Math.min(step, GROUNDING_STEPS.length - 1)]

  return (
    <div role="group" aria-label="5-4-3-2-1 grounding exercise">
      {done ? (
        <div className="py-4 text-center">
          <div className="text-sm font-semibold text-foreground">You&apos;re here. You did that.</div>
          <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
            Notice if anything feels even a little steadier than a minute ago. That&apos;s enough.
          </p>
          <button
            onClick={onBack}
            className="mt-4 w-full rounded border border-border bg-background px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-accent"
          >
            Back to support
          </button>
        </div>
      ) : (
        <div className="py-2 text-center" aria-live="polite">
          <div className="text-4xl font-bold text-emerald-300">{current.count}</div>
          <div className="mt-1 text-sm font-semibold text-foreground">{current.sense}</div>
          <p className="mx-auto mt-2 max-w-xs text-[13px] leading-relaxed text-muted-foreground">
            {current.hint}
          </p>
          <div className="mt-4 flex items-center justify-center gap-1.5">
            {GROUNDING_STEPS.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 w-1.5 rounded-full ${i <= step ? "bg-emerald-400" : "bg-muted-foreground/30"}`}
              />
            ))}
          </div>
          <button
            onClick={() => setStep((s) => s + 1)}
            className="mt-4 w-full rounded border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm font-semibold text-emerald-200 transition-colors hover:bg-emerald-500/20"
          >
            {step === GROUNDING_STEPS.length - 1 ? "Finish" : "Next"}
          </button>
        </div>
      )}
    </div>
  )
}
