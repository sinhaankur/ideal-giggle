"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Check, ChevronDown, Cloud, Cpu, Download, Feather, Globe, Monitor, Sparkles, X } from "lucide-react"

// Latest GitHub Release page — desktop installer downloads are attached there
// by .github/workflows/release-electron.yml when a v* tag is pushed.
const DESKTOP_RELEASES_URL =
  "https://github.com/sinhaankur/ideal-giggle/releases/latest"

export type OnboardingPreset =
  | "browser-private"
  | "fast-local"
  | "lite-empathy"
  | "balanced-cloud"
  | "deep-empathy"
  | "default"

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
  // Advanced runtimes (local Ollama, cloud APIs, desktop app) are tucked away
  // so a first-time visitor sees one obvious "just start" path, not a wall of
  // choices and an install pitch.
  const [showMoreRuntimes, setShowMoreRuntimes] = useState(false)

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
              A gentle place to think out loud
            </h2>
            <p className={`mt-2 leading-relaxed text-muted-foreground ${embedMode ? "text-[12px]" : "text-sm"}`}>
              EMPATHEIA is here to help you reflect and feel a little more understood. It listens and
              responds with care — but it&apos;s a companion, not a therapist.
            </p>
            <ul className={`mt-2 list-disc space-y-1 pl-5 text-muted-foreground ${embedMode ? "text-[12px]" : "text-sm"}`}>
              <li>It offers supportive reflection, not medical advice or diagnosis.</li>
              <li>For anything urgent, please reach out to a professional or a crisis line.</li>
              <li>
                <span className="text-foreground">Private by design:</span> no account, no login.
                It runs on your device and the conversation stays in this session — it&apos;s gone
                when you close the tab, unless you choose to save it (encrypted, only yours).
              </li>
            </ul>
            <p className={`mt-2 leading-relaxed text-muted-foreground/80 ${embedMode ? "text-[11px]" : "text-xs"}`}>
              In crisis? You&apos;re not alone — call or text <span className="font-semibold text-foreground">988</span> (US Suicide &amp; Crisis Lifeline), or your local emergency number.
            </p>

            <label className={`mt-3 flex items-start gap-2 text-foreground ${embedMode ? "text-[12px]" : "text-sm"}`}>
              <input
                type="checkbox"
                checked={agreementChecked}
                onChange={(e) => onAgreementCheckedChange(e.target.checked)}
                className="mt-1"
              />
              <span>I understand, and I&apos;d like to begin.</span>
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
              You&apos;re all set — let&apos;s talk
            </h2>
            <p className={`mt-2 text-muted-foreground ${embedMode ? "text-[12px]" : "text-sm"}`}>
              Nothing to install, no account. It replies instantly on your device, and a smarter
              private model loads quietly in the background. You can switch to your own local LLM
              (Ollama) anytime in Settings.
            </p>

            {/* Primary path: zero-install, private, in-browser. One obvious
                button so a first-time visitor just starts. */}
            <button
              onClick={() => onChoosePreset("browser-private")}
              className="mt-3 flex w-full items-start gap-2 rounded border border-emerald-500/50 bg-emerald-500/10 p-3 text-left transition-colors hover:border-emerald-400/80 hover:bg-emerald-500/15"
            >
              <Globe className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-400" />
              <div className="flex-1">
                <div className={`flex flex-wrap items-center gap-1.5 font-semibold text-foreground ${embedMode ? "text-[13px]" : "text-sm"}`}>
                  Start now — in your browser
                  <span className="rounded border border-emerald-500/40 bg-emerald-500/10 px-1 py-0.5 text-[9px] font-medium uppercase tracking-wide text-emerald-300">
                    Recommended · Free · Private
                  </span>
                </div>
                <div className={`text-muted-foreground ${embedMode ? "text-[11px]" : "text-xs"}`}>
                  No sign-up, no install. Replies are instant from the start and work offline; a
                  smarter in-browser model loads in the background (Chrome, Edge, or Arc).
                </div>
              </div>
            </button>

            {/* Everything else is an opt-in upgrade, hidden by default. */}
            <button
              onClick={() => setShowMoreRuntimes((v) => !v)}
              className="mt-3 flex w-full items-center justify-between gap-2 text-left"
              aria-expanded={showMoreRuntimes}
            >
              <span className="text-[12px] font-medium text-muted-foreground">
                More ways to run it (local LLM, cloud, desktop app)
              </span>
              <ChevronDown
                className={`h-4 w-4 text-muted-foreground transition-transform ${showMoreRuntimes ? "rotate-180" : ""}`}
              />
            </button>

            {showMoreRuntimes && (
              <div className="mt-3 border-t border-border/60 pt-3">
                {/* Live local-runtime status, only relevant once the user is
                    exploring local options. */}
                {ollamaReachable !== null && (
                  <div
                    className={`inline-flex items-center gap-1.5 rounded border px-2 py-1 text-[11px] uppercase tracking-wide ${
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

                <div className="mt-3 flex flex-wrap gap-2">
                  <Link
                    href="/ollama-install"
                    className={`inline-flex items-center gap-2 rounded border border-border bg-card text-foreground transition-colors hover:bg-accent ${
                      embedMode ? "px-2.5 py-1 text-[11px]" : "px-3 py-1.5 text-xs"
                    }`}
                  >
                    <Download className="h-3.5 w-3.5" />
                    Install + Run Guide
                  </Link>

                  {process.env.NEXT_PUBLIC_ELECTRON_BUILD !== "true" && (
                    <a
                      href={DESKTOP_RELEASES_URL}
                      target="_blank"
                      rel="noreferrer noopener"
                      className={`inline-flex items-center gap-2 rounded border border-border bg-card text-foreground transition-colors hover:bg-accent ${
                        embedMode ? "px-2.5 py-1 text-[11px]" : "px-3 py-1.5 text-xs"
                      }`}
                      title="Download the installable desktop app (mac / windows / linux)"
                    >
                      <Monitor className="h-3.5 w-3.5" />
                      Get the desktop app
                    </a>
                  )}
                </div>

                <div className="mt-3 grid gap-2">
                  <button
                    onClick={() => onChoosePreset("lite-empathy")}
                    className="flex items-start gap-2 rounded border border-border bg-background p-3 text-left transition-colors hover:border-muted-foreground/50"
                  >
                    <Feather className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-400" />
                    <div className="flex-1">
                      <div className={`flex items-center gap-1.5 font-semibold text-foreground ${embedMode ? "text-[13px]" : "text-sm"}`}>
                        Lite Empathy (TinyLlama)
                        <span className="rounded border border-emerald-500/40 bg-emerald-500/10 px-1 py-0.5 text-[9px] font-medium uppercase tracking-wide text-emerald-300">
                          Private
                        </span>
                      </div>
                      <div className={`text-muted-foreground ${embedMode ? "text-[11px]" : "text-xs"}`}>
                        A small Ollama model (~600 MB) tuned for warm replies, on your machine. Needs Ollama installed.
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
                        A larger local model via Ollama for more depth. On-device privacy; one-time install, bigger download.
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
                        Smooth quality via OpenRouter free tier. Messages travel to a third-party AI provider.
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
                        Stronger reflective depth for long chats. Same cloud caveat: messages go to a third-party AI.
                      </div>
                    </div>
                  </button>
                </div>
              </div>
            )}

            <button
              onClick={() => onChoosePreset("default")}
              className={`mt-3 inline-flex w-full items-center justify-center gap-1 rounded border border-border bg-card text-muted-foreground transition-colors hover:text-foreground ${
                embedMode ? "px-3 py-1.5 text-[11px]" : "px-4 py-2 text-sm"
              }`}
            >
              <Check className="h-3.5 w-3.5" />
              Just use the default
            </button>
          </>
        )}
      </div>
    </div>
  )
}
