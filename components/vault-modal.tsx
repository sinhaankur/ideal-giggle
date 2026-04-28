"use client"

import { useEffect, useRef, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Eye, EyeOff, Lock, ShieldAlert } from "lucide-react"

export type VaultModalMode = "create" | "unlock" | "confirm-clear" | "confirm-lock"

export interface VaultModalProps {
  open: boolean
  mode: VaultModalMode
  errorMessage?: string
  busy?: boolean
  onCancel: () => void
  onSubmit: (passphrase: string) => void
  onConfirm?: () => void
}

const COPY: Record<VaultModalMode, { title: string; helper: string; cta: string }> = {
  create: {
    title: "Create vault passphrase",
    helper:
      "Set a passphrase (8+ characters) to encrypt your profile and empathy map. This is the only way to unlock the vault later — there is no recovery.",
    cta: "Encrypt and save",
  },
  unlock: {
    title: "Unlock vault",
    helper: "Enter the passphrase you set when this vault was created.",
    cta: "Unlock",
  },
  "confirm-clear": {
    title: "Clear vault from this device?",
    helper: "This deletes the encrypted vault from local storage. Your downloaded backup file (if any) is unaffected.",
    cta: "Delete vault",
  },
  "confirm-lock": {
    title: "Lock vault now?",
    helper: "This wipes the unlock key from memory. You will be asked for your passphrase next time you visit.",
    cta: "Lock vault",
  },
}

export function VaultModal({ open, mode, errorMessage, busy, onCancel, onSubmit, onConfirm }: VaultModalProps) {
  const [passphrase, setPassphrase] = useState("")
  const [confirm, setConfirm] = useState("")
  const [reveal, setReveal] = useState(false)
  const [localError, setLocalError] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    setPassphrase("")
    setConfirm("")
    setReveal(false)
    setLocalError("")
    const id = window.setTimeout(() => inputRef.current?.focus(), 50)
    return () => window.clearTimeout(id)
  }, [open, mode])

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault()
        onCancel()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onCancel])

  const isConfirmMode = mode === "confirm-clear" || mode === "confirm-lock"
  const copy = COPY[mode]

  const handleSubmit = () => {
    if (busy) return
    if (isConfirmMode) {
      onConfirm?.()
      return
    }

    if (!passphrase) {
      setLocalError("Passphrase is required.")
      return
    }
    if (mode === "create") {
      if (passphrase.length < 8) {
        setLocalError("Passphrase must be at least 8 characters.")
        return
      }
      if (passphrase !== confirm) {
        setLocalError("Passphrases do not match.")
        return
      }
    }
    setLocalError("")
    onSubmit(passphrase)
  }

  const displayedError = errorMessage || localError

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget && !busy) onCancel()
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="vault-modal-title"
        >
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 260, damping: 24 }}
            className="w-full max-w-sm rounded-lg border border-border bg-card p-5 shadow-xl"
          >
            <div className="mb-3 flex items-center gap-2">
              {isConfirmMode ? (
                <ShieldAlert className="h-4 w-4 text-amber-400" />
              ) : (
                <Lock className="h-4 w-4 text-emerald-400" />
              )}
              <h2 id="vault-modal-title" className="text-sm font-semibold text-foreground">
                {copy.title}
              </h2>
            </div>
            <p className="mb-4 text-[12px] leading-relaxed text-muted-foreground">{copy.helper}</p>

            {!isConfirmMode && (
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-[10px] uppercase tracking-wide text-muted-foreground">
                    {mode === "create" ? "Passphrase" : "Passphrase"}
                  </label>
                  <div className="relative">
                    <input
                      ref={inputRef}
                      type={reveal ? "text" : "password"}
                      value={passphrase}
                      onChange={(e) => setPassphrase(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault()
                          handleSubmit()
                        }
                      }}
                      autoComplete="new-password"
                      className="w-full rounded border border-border bg-background px-2.5 py-1.5 pr-9 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                    <button
                      type="button"
                      onClick={() => setReveal((r) => !r)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                      aria-label={reveal ? "Hide passphrase" : "Show passphrase"}
                    >
                      {reveal ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>

                {mode === "create" && (
                  <div>
                    <label className="mb-1 block text-[10px] uppercase tracking-wide text-muted-foreground">
                      Confirm passphrase
                    </label>
                    <input
                      type={reveal ? "text" : "password"}
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault()
                          handleSubmit()
                        }
                      }}
                      autoComplete="new-password"
                      className="w-full rounded border border-border bg-background px-2.5 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                )}
              </div>
            )}

            {displayedError && (
              <div className="mt-3 rounded border border-rose-500/40 bg-rose-500/10 px-2 py-1.5 text-[11px] text-rose-300">
                {displayedError}
              </div>
            )}

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={onCancel}
                disabled={busy}
                className="rounded border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-accent disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={busy}
                className={`rounded px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50 ${
                  isConfirmMode
                    ? "border border-amber-500/50 bg-amber-500/20 text-amber-100 hover:bg-amber-500/30"
                    : "border border-emerald-500/50 bg-emerald-500/20 text-emerald-100 hover:bg-emerald-500/30"
                }`}
              >
                {busy ? "Working..." : copy.cta}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
