"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Copy, HeartHandshake, Sparkles, TerminalSquare } from "lucide-react"

type Platform = "linux" | "macos" | "windows"

const installCommands: Record<Platform, string> = {
  linux: "curl -fsSL https://ollama.com/install.sh | sh",
  macos: "brew install ollama",
  windows: "winget install Ollama.Ollama",
}

const runCommands: Record<Platform, string[]> = {
  linux: [
    "ollama pull llama3.2",
    "ollama run llama3.2",
    "ollama list",
  ],
  macos: [
    "ollama pull llama3.2",
    "ollama run llama3.2",
    "ollama list",
  ],
  windows: [
    "ollama pull llama3.2",
    "ollama run llama3.2",
    "ollama list",
  ],
}

const platformLabel: Record<Platform, string> = {
  linux: "Linux",
  macos: "macOS",
  windows: "Windows",
}

export default function OllamaInstallPage() {
  const [platform, setPlatform] = useState<Platform>("linux")
  const [copied, setCopied] = useState("")

  const installCommand = useMemo(() => installCommands[platform], [platform])
  const steps = useMemo(() => runCommands[platform], [platform])

  const copy = async (value: string, key: string) => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(key)
      setTimeout(() => setCopied(""), 1200)
    } catch {
      setCopied("")
    }
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_10%_20%,#eef2ff_0%,transparent_40%),radial-gradient(circle_at_80%_0%,#ecfeff_0%,transparent_38%),linear-gradient(180deg,#f8fafc_0%,#ffffff_100%)] px-4 py-10 text-slate-900">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white/80 px-4 py-2 text-sm font-semibold shadow-sm transition hover:bg-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to EMpathia
          </Link>
          <a
            href="https://ollama.com/download"
            target="_blank"
            rel="noreferrer"
            className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-black"
          >
            Official Download
          </a>
        </div>

        <section className="rounded-3xl border border-slate-200 bg-white/85 p-6 shadow-xl backdrop-blur">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700">Install + Run</p>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950">Set up Ollama for EMpathia</h1>
          <p className="mt-2 text-sm text-slate-600">
            Install Ollama, run a local model, then continue meaningful emotional conversations that help users reflect,
            heal, and act with impact.
          </p>

          <div className="mt-6 grid grid-cols-3 gap-2">
            {(["macos", "linux", "windows"] as Platform[]).map((item) => (
              <button
                key={item}
                onClick={() => setPlatform(item)}
                className={`rounded-xl border px-3 py-3 text-sm font-semibold transition ${
                  platform === item
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-300 bg-white text-slate-700 hover:border-slate-500"
                }`}
              >
                {platformLabel[item]}
              </button>
            ))}
          </div>

          <div className="mt-6 space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700">
                <TerminalSquare className="h-4 w-4" />
                Install Ollama on {platformLabel[platform]}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <code className="rounded bg-white px-3 py-2 text-xs text-slate-800 shadow-sm">{installCommand}</code>
                <button
                  onClick={() => copy(installCommand, "install")}
                  className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:border-slate-500"
                >
                  <Copy className="h-3.5 w-3.5" />
                  {copied === "install" ? "Copied" : "Copy"}
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="mb-2 text-sm font-semibold text-slate-700">Run a model for EMpathia</div>
              <div className="space-y-2">
                {steps.map((step, index) => (
                  <div key={step} className="flex items-center gap-2">
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-cyan-100 text-[11px] font-bold text-cyan-800">
                      {index + 1}
                    </span>
                    <code className="rounded bg-white px-3 py-1.5 text-xs text-slate-800 shadow-sm">{step}</code>
                    <button
                      onClick={() => copy(step, `run-${index}`)}
                      className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:border-slate-500"
                    >
                      <Copy className="h-3.5 w-3.5" />
                      {copied === `run-${index}` ? "Copied" : "Copy"}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="rounded-3xl border border-rose-200 bg-rose-50 p-5">
            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-bold text-rose-700">
              <HeartHandshake className="h-3.5 w-3.5" />
              Prerequisites for Emotional Support
            </div>
            <ul className="space-y-2 text-sm text-slate-700">
              <li>Use empathetic language that validates feelings before suggesting actions.</li>
              <li>Encourage meaning-making: ask what today can teach and what value the user wants to express.</li>
              <li>Keep momentum with tiny steps so life feels active, not stuck.</li>
              <li>If user is in immediate danger, direct them to local emergency help right away.</li>
              <li>Position EMpathia as support for reflection, not a replacement for professional care.</li>
            </ul>
          </div>

          <div className="rounded-3xl border border-cyan-200 bg-cyan-50 p-5">
            <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-bold text-cyan-700">
              <Sparkles className="h-3.5 w-3.5" />
              Keep Communicating Emotions
            </div>
            <ol className="space-y-2 text-sm text-slate-700">
              <li>Start each chat with: &quot;I feel... because...&quot;</li>
              <li>Name one need: safety, rest, connection, clarity, or hope.</li>
              <li>Ask for one action with impact today, even if it is only 5 minutes.</li>
              <li>Close each session with a commitment statement for tomorrow.</li>
            </ol>
            <p className="mt-3 text-xs text-slate-600">
              In Settings, choose provider <strong>&quot;Ollama&quot;</strong>, base URL <strong>http://127.0.0.1:11434</strong>, and model <strong>&quot;llama3.2&quot;</strong>.
            </p>
          </div>
        </section>
      </div>
    </main>
  )
}