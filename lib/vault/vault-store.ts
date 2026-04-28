import { isEncryptedEnvelope, type VaultEnvelope } from "./encrypted-profile"

export const VAULT_STORAGE_KEY = "empatheia_vault_v1"

export function loadStoredVault(): VaultEnvelope | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(VAULT_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return isEncryptedEnvelope(parsed) ? parsed : null
  } catch {
    return null
  }
}

export function saveStoredVault(envelopeJson: string): void {
  if (typeof window === "undefined") return
  window.localStorage.setItem(VAULT_STORAGE_KEY, envelopeJson)
}

export function clearStoredVault(): void {
  if (typeof window === "undefined") return
  window.localStorage.removeItem(VAULT_STORAGE_KEY)
}

export function hasStoredVault(): boolean {
  return loadStoredVault() !== null
}
