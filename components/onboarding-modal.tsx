"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Check, Cloud, Cpu, Download, Feather, Monitor, Sparkles, X } from "lucide-react"

// Latest GitHub Release page — desktop installer downloads are attached there
// by .github/workflows/release-electron.yml when a v* tag is pushed.
const DESKTOP_RELEASES_URL =
  "https://github.com/sinhaankur/ideal-giggle/releases/latest"

export type OnboardingPreset = "fast-local" | "lite-empathy" | "balanced-cloud" | "deep-empathy" | "default"

interface OnboardingModalProps {
  hasAgreed: boolean
  showQuickStartModal: boolean
  agreementChecked: boolean
  onAgreementCheckedChange: (checked: boolean) => void
  onAcceptAgreement: () => void
  onChoosePreset: (preset: OnboardingPreset) => void
  // Inline embed mode renders as a top sticky panel instead of a full-screen
  // backdrop. Used when EMPATHEIA is iframed into another site or invoked
  // with ?embed=1 — modals on third-party origins tend to feel hostile.
  embedMode?: boolean
  ollamaReachable?: boolean | null
}

type Step = "agreement" | "mode" | null

export function OnboardingModal({
  hasAgreed,
  showQuickStartModal,
  agreementChecked,
  onAgreementCheckedChange,
  onAcceptAgreement,
  onChoosePreset,
  embedMode = false,
  ollamaReachable = null,
}: OnboardingModalProps) {
  const [embedDismissed, setEmbedDismissed] = useState(false)

  const currentStep: Step = !hasAgreed
    ? "agreement"
    : showQuickStartModal
      ? "mode"
      : null

  // Reset the per-session dismiss when we transition steps so users who
  // close the agreement banner still see the mode picker afterwards.
  useEffect(() => {
    setEmbedDismissed(false)
  }, [currentStep])

  if (currentStep === null) return null
  if (embedMode && embedDismissed) return null

  const containerClass = embedMode
    ? "absolute left-0 right-0 top-0 z-40 flex justify-center px-4 pt-3"
    : "absolute inset-0 z-50 flex items-center justify-center bg-background/95 px-4"

  const cardClass = embedMode
    ? "w-full max-w-xl rounded-lg border border-foreground/20 bg-card p-4 shadow-xl"
    : "w-full max-w-xl rounded-lg border border-border bg-card p-6"

  return (
    <div className={containerClass} data-step={currentStep}>
      <div className={cardClass}>
        {/* Step indicator + dismiss for embed mode */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-muted-foreground">
            <Sparkles className="h-3 w-3" />
            Welcome to EMPATHEIA
            <span className="text-muted-foreground/50">·</span>
            <span>Step {currentStep === "agreement" ? "1" : "2"} of 2</span>
          </div>
          {embedMode && (
            <button
              onClick={() => setEmbedDismissed(true)}
              className="flex h-5 w-5 items-center justify-center rounded border border-border bg-background text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              aria-label="Hide onboarding banner"
              title="Hide for now (chat is gated until accepted)"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        {currentStep === "agreement" ? (
          <>
            <h2 className={`mt-2 font-semibold text-foreground ${embedMode ? "text-base" : "text-lg"}`}>
              Empathy Tool Agreement
            </h2>
            <p className={`mt-2 leading-relaxed text-muted-foreground ${embedMode ? "text-[12px]" : "text-sm"}`}>
              This tool is designed to help you reflect, rethink, and re-evaluate negative thoughts with empathetic support.
              It is not a substitute for clinical care, diagnosis, or emergency support.
            </p>
            <ul className={`mt-2 list-disc space-y-1 pl-5 text-muted-foreground ${embedMode ? "text-[12px]" : "text-sm"}`}>
              <li>I understand this is supportive guidance, not medical advice.</li>
              <li>I will seek professional help for urgent mental health concerns.</li>
              <li>I consent to using my conversation context and uploaded profile JSON for personalized responses.</li>
            </ul>

            <label className={`mt-3 flex items-start gap-2 text-foreground ${embedMode ? "text-[12px]" : "text-sm"}`}>
              <input
                type="checkbox"
                checked={agreementChecked}
                onChange={(e) => onAgreementCheckedChange(e.target.checked)}
                className="mt-1"
              />
              <span>I have read and agree to use this empathy tool responsibly.</span>
            </label>

            <button
              onClick={onAcceptAgreement}
              disabled={!agreementChecked}
              className={`mt-3 w-full rounded border border-foreground bg-foreground font-semibold text-background transition-colors hover:bg-foreground/90 disabled:cursor-not-allowed disabled:opacity-40 ${
                embedMode ? "px-3 py-1.5 text-[12px]" : "px-4 py-2 text-sm"
              }`}
            >
              I Agree and Continue
            </button>
          </>
        ) : (
          <>
            <h2 className={`mt-2 font-semibold text-foreground ${embedMode ? "text-base" : "text-lg"}`}>
              Choose how private you want this to be
            </h2>
            <p className={`mt-2 text-muted-foreground ${embedMode ? "text-[12px]" : "text-sm"}`}>
              Your conversations build a consciousness of you. The local options keep it entirely on
              this device — nothing leaves. Pick one and start chatting; you can change it later in Settings.
            </p>

            {/* Live local-runtime status, only shown on step 2 so the user
                does not have to interpret it before they have committed. */}
            {ollamaReachable !== null && (
              <div
                className={`mt-3 inline-flex items-center gap-1.5 rounded border px-2 py-1 text-[11px] uppercase tracking-wide ${
                  ollamaReachable
                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                    : "border-border bg-card text-muted-foreground"
                }`}
              >
                <Cpu className="h-3 w-3" />
                {ollamaReachable
                  ? "Ollama detected on this device"
                  : "No local Ollama detected — install it for a fully private PC LLM, or pick a cloud API below"}
              </div>
            )}

            <Link
              href="/ollama-install"
              className={`mt-3 inline-flex items-center gap-2 rounded border border-foreground bg-foreground font-semibold text-background transition-colors hover:bg-foreground/90 ${
                embedMode ? "px-2.5 py-1 text-[11px]" : "px-3 py-1.5 text-xs"
              }`}
            >
              <Download className="h-3.5 w-3.5" />
              First time here? Install + Run Guide
            </Link>

            {/* Hidden inside the Electron build — the desktop installer is for
                visitors on github.io, not for users already running it. */}
            {process.env.NEXT_PUBLIC_ELECTRON_BUILD !== "true" && (
              <a
                href={DESKTOP_RELEASES_URL}
                target="_blank"
                rel="noreferrer noopener"
                className={`ml-2 mt-3 inline-flex items-center gap-2 rounded border border-border bg-card text-foreground transition-colors hover:bg-accent ${
                  embedMode ? "px-2.5 py-1 text-[11px]" : "px-3 py-1.5 text-xs"
                }`}
                title="Download the installable desktop app (mac / windows / linux)"
              >
                <Monitor className="h-3.5 w-3.5" />
                Get the desktop app
              </a>
            )}

            <div className="mt-3 grid gap-2">
              <button
                onClick={() => onChoosePreset("lite-empathy")}
                className="flex items-start gap-2 rounded border border-emerald-500/40 bg-emerald-500/5 p-3 text-left transition-colors hover:border-emerald-500/70"
              >
                <Feather className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-400" />
                <div className="flex-1">
                  <div className={`flex items-center gap-1.5 font-semibold text-foreground ${embedMode ? "text-[13px]" : "text-sm"}`}>
                    Lite Empathy (TinyLlama)
                    <span className="rounded border border-emerald-500/40 bg-emerald-500/10 px-1 py-0.5 text-[9px] font-medium uppercase tracking-wide text-emerald-300">
                      Recommended · Private
                    </span>
                  </div>
                  <div className={`text-muted-foreground ${embedMode ? "text-[11px]" : "text-xs"}`}>
                    A small model (~600 MB) tuned for warm, reflective replies, running entirely on this device.
                    Your consciousness never leaves your machine — no API key, no cloud, no logging.
                  </div>
                </div>
              </button>

              <button
                onClick={() => onChoosePreset("fast-local")}
                className="flex items-start gap-2 rounded border border-border bg-background p-3 text-left transition-colors hover:border-muted-foreground/50"
              >
                <Cpu className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-400" />
                <div className="flex-1">
                  <div className={`flex items-center gap-1.5 font-semibold text-foreground ${embedMode ? "text-[13px]" : "text-sm"}`}>
                    Full Local LLM
                    <span className="rounded border border-emerald-500/40 bg-emerald-500/10 px-1 py-0.5 text-[9px] font-medium uppercase tracking-wide text-emerald-300">
                      Private
                    </span>
                  </div>
                  <div className={`text-muted-foreground ${embedMode ? "text-[11px]" : "text-xs"}`}>
                    A larger local model via Ollama for more depth. Same on-device privacy, but needs a
                    one-time install and a bigger download.
                  </div>
                </div>
              </button>

              <button
                onClick={() => onChoosePreset("balanced-cloud")}
                className="flex items-start gap-2 rounded border border-border bg-background p-3 text-left transition-colors hover:border-muted-foreground/50"
              >
                <Cloud className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-400" />
                <div className="flex-1">
                  <div className={`flex items-center gap-1.5 font-semibold text-foreground ${embedMode ? "text-[13px]" : "text-sm"}`}>
                    Balanced Cloud
                    <span className="rounded border border-amber-500/40 bg-amber-500/10 px-1 py-0.5 text-[9px] font-medium uppercase tracking-wide text-amber-300">
                      Not Private
                    </span>
                  </div>
                  <div className={`text-muted-foreground ${embedMode ? "text-[11px]" : "text-xs"}`}>
                    Smooth quality via OpenRouter free tier. Your messages travel over the internet to a third-party AI provider.
                  </div>
                </div>
              </button>

              <button
                onClick={() => onChoosePreset("deep-empathy")}
                className="flex items-start gap-2 rounded border border-border bg-background p-3 text-left transition-colors hover:border-muted-foreground/50"
              >
                <Sparkles className="mt-0.5 h-4 w-4 flex-shrink-0 text-violet-400" />
                <div className="flex-1">
                  <div className={`flex items-center gap-1.5 font-semibold text-foreground ${embedMode ? "text-[13px]" : "text-sm"}`}>
                    Deep Empathy
                    <span className="rounded border border-amber-500/40 bg-amber-500/10 px-1 py-0.5 text-[9px] font-medium uppercase tracking-wide text-amber-300">
                      Not Private
                    </span>
                  </div>
                  <div className={`text-muted-foreground ${embedMode ? "text-[11px]" : "text-xs"}`}>
                    Stronger reflective depth for long-form chats. Same cloud round-trip caveat: messages go to a third-party AI.
                  </div>
                </div>
              </button>
            </div>

            <button
              onClick={() => onChoosePreset("default")}
              className={`mt-3 inline-flex w-full items-center justify-center gap-1 rounded border border-border bg-card text-muted-foreground transition-colors hover:text-foreground ${
                embedMode ? "px-3 py-1.5 text-[11px]" : "px-4 py-2 text-sm"
              }`}
            >
              <Check className="h-3.5 w-3.5" />
              Keep default settings for now
            </button>
          </>
        )}
      </div>
    </div>
  )
}
