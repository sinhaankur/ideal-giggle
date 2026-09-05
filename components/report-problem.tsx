"use client"

/**
 * ReportProblem — a quiet "something's not working / I have an idea" button.
 *
 * Empatheia is keyless and backend-free, so this doesn't POST anywhere: it opens
 * a prefilled email (or GitHub issue) with a little safe, non-personal diagnostic
 * context (browser, whether camera/mic/WebGPU are available) so a report is
 * actually actionable. NOTHING from the conversation or the person's
 * "consciousness" is ever included — only environment capabilities.
 *
 * © Ankur Sinha.
 */

import { useState } from "react"
import { Bug, X, Mail, Github } from "lucide-react"

const REPORT_EMAIL = "empatheia@sinhaankur.com"
const ISSUES_URL = "https://github.com/sinhaankur/ideal-giggle/issues/new"

function diagnostics(): string {
  if (typeof navigator === "undefined") return ""
  const has = (b: boolean) => (b ? "yes" : "no")
  const lines = [
    `App: EMPATHEIA`,
    `URL: ${typeof location !== "undefined" ? location.href.split("?")[0] : "-"}`,
    `Browser: ${navigator.userAgent}`,
    `Camera API: ${has(!!navigator.mediaDevices?.getUserMedia)}`,
    `Microphone / Speech: ${has(typeof window !== "undefined" && (!!(window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition || !!(window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition))}`,
    `WebGPU (on-device AI): ${has(typeof navigator !== "undefined" && "gpu" in navigator)}`,
    `Screen: ${typeof window !== "undefined" ? `${window.innerWidth}x${window.innerHeight}` : "-"}`,
  ]
  return lines.join("\n")
}

export function ReportProblem() {
  const [open, setOpen] = useState(false)
  const [kind, setKind] = useState<"problem" | "idea">("problem")
  const [text, setText] = useState("")

  const subject =
    kind === "problem" ? "EMPATHEIA — something isn't working" : "EMPATHEIA — an idea / request"

  function buildBody() {
    const preamble =
      kind === "problem"
        ? "What went wrong (e.g. 'camera never turns on', 'voice cuts off'):"
        : "What would make EMPATHEIA better for you:"
    return `${preamble}\n\n${text || "(describe here)"}\n\n— — —\nEnvironment (no personal data — helps me fix it):\n${diagnostics()}`
  }

  function openEmail() {
    const href = `mailto:${REPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(buildBody())}`
    window.location.href = href
    setOpen(false)
  }

  function openGithub() {
    const href = `${ISSUES_URL}?title=${encodeURIComponent(subject)}&body=${encodeURIComponent(buildBody())}`
    window.open(href, "_blank", "noopener")
    setOpen(false)
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded border border-border bg-card px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        aria-label="Report a problem or request a fix"
        title="Something not working? Have an idea? Tell me."
      >
        <Bug className="h-4 w-4" />
        <span className="hidden md:inline">Report / Request</span>
      </button>

      {open && (
        <div
          className="absolute inset-0 z-[70] flex items-center justify-center bg-background/95 px-4"
          role="dialog"
          aria-modal="true"
          aria-label="Report a problem or request a fix"
        >
          <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">Tell me what&apos;s up</h2>
              <button
                onClick={() => setOpen(false)}
                className="flex h-6 w-6 items-center justify-center rounded border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* problem vs idea */}
            <div className="mt-4 flex gap-2">
              {(["problem", "idea"] as const).map((k) => (
                <button
                  key={k}
                  onClick={() => setKind(k)}
                  className={`flex-1 rounded border px-3 py-2 text-sm font-medium transition-colors ${
                    kind === k
                      ? "border-foreground bg-foreground text-background"
                      : "border-border bg-background text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {k === "problem" ? "Something's not working" : "I have an idea"}
                </button>
              ))}
            </div>

            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={4}
              placeholder={
                kind === "problem"
                  ? "e.g. the camera never turns on, or voice stops after one sentence…"
                  : "e.g. I wish it could…"
              }
              className="mt-3 w-full resize-none rounded border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring"
            />

            <p className="mt-2 text-[11px] text-muted-foreground">
              This opens your email (or GitHub) with a little technical context attached —
              never anything you&apos;ve said or your saved consciousness. Only what&apos;s needed to fix it.
            </p>

            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <button
                onClick={openEmail}
                className="flex flex-1 items-center justify-center gap-2 rounded border border-foreground bg-foreground px-4 py-2 text-sm font-semibold text-background transition-colors hover:bg-foreground/90"
              >
                <Mail className="h-4 w-4" /> Send by email
              </button>
              <button
                onClick={openGithub}
                className="flex flex-1 items-center justify-center gap-2 rounded border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
              >
                <Github className="h-4 w-4" /> Open a GitHub issue
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
