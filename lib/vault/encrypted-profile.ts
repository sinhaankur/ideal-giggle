import type { EmpathyProfile, EmpathyData } from "@/lib/companion-types"

// v2 added the optional `consciousness` block (relationship trajectory).
// The field is optional, so v1 envelopes still decrypt cleanly — we accept
// any version in SUPPORTED_VAULT_VERSIONS for reads and write the latest.
export const VAULT_VERSION = 2
const SUPPORTED_VAULT_VERSIONS = new Set([1, 2])
const KDF = "pbkdf2-sha256"
const ITERATIONS = 600_000
const MIN_ACCEPTED_ITERATIONS = 1_000
const MAX_ACCEPTED_ITERATIONS = 10_000_000
const SALT_BYTES = 16
const IV_BYTES = 12
const KEY_BITS = 256

export interface SessionMemoryTurn {
  role: "user" | "assistant"
  text: string
  at: string
}

export interface SessionMemoryRecord {
  savedAt: string
  headline: string
  summaryParagraphs: string[]
  turns: SessionMemoryTurn[]
}

// One depth/sentiment reading the model emitted via its hidden [META] tag,
// timestamped so a reloaded soul file can replay the trajectory rather than
// starting cold at tier 1. Mirrors EmpathyMetaRecord in companion-types with
// an added `at` so the timeline survives serialization.
export interface ConsciousnessMetaPoint {
  depth: number
  primaryQuadrant: "SAYS" | "THINKS" | "DOES" | "FEELS"
  sentimentPolarity: number
  at: string
}

// The "consciousness" of the soul file: the lived trajectory of the
// relationship, not just its current snapshot. EmpathyData/profile say *who*
// the person is; this says *how far they've travelled* — the depth they've
// reached, the emotional momentum, and the reading history. Reloading a soul
// file with this block lets the companion resume the person where they left
// off instead of re-climbing from the surface.
export interface ConsciousnessState {
  // Deepest tier reached (1-10), so the companion doesn't reset to small talk.
  sessionDepthLevel: number
  // Running sentiment polarity total across the relationship.
  conversationSentimentScore: number
  // Rolling window of the most recent [META] readings (capped on write).
  metaHistory: ConsciousnessMetaPoint[]
  // When this trajectory was last advanced.
  updatedAt: string
}

export interface VaultPayload {
  profile: EmpathyProfile
  empathyData: EmpathyData
  exportedAt: string
  // Optional. Present only when the user has opted in to remembering
  // conversations across sessions ("Remember conversations" toggle in
  // Settings). Capped to a small rolling window — see RECENT_TURN_CAP in
  // app/page.tsx — so the encrypted envelope stays small.
  sessionMemory?: SessionMemoryRecord
  // Optional. The relationship trajectory (depth, momentum, reading history).
  // Absent in v1 soul files written before this field existed — readers must
  // treat it as "start fresh trajectory" when missing.
  consciousness?: ConsciousnessState
}

export interface VaultEnvelope {
  v: number
  kdf: typeof KDF
  iter: number
  salt: string
  iv: string
  ct: string
}

function bufferToBase64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
  let binary = ""
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i])
  }
  if (typeof btoa === "function") return btoa(binary)
  return Buffer.from(bytes).toString("base64")
}

function base64ToBytes(b64: string): Uint8Array {
  if (typeof atob === "function") {
    const binary = atob(b64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
    return bytes
  }
  return new Uint8Array(Buffer.from(b64, "base64"))
}

function getSubtle(): SubtleCrypto {
  const subtle = (globalThis.crypto as Crypto | undefined)?.subtle
  if (!subtle) {
    throw new Error("Web Crypto subtle is not available in this environment")
  }
  return subtle
}

export interface VaultKeyHandle {
  key: CryptoKey
  salt: Uint8Array
  iter: number
}

async function deriveKey(passphrase: string, salt: Uint8Array, iterations: number): Promise<CryptoKey> {
  const subtle = getSubtle()
  const keyMaterial = await subtle.importKey(
    "raw",
    new TextEncoder().encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"]
  )
  return subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt as BufferSource,
      iterations,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: KEY_BITS },
    false,
    ["encrypt", "decrypt"]
  )
}

export async function deriveVaultKey(
  passphrase: string,
  salt?: Uint8Array,
  iter?: number
): Promise<VaultKeyHandle> {
  const finalSalt = salt ?? globalThis.crypto.getRandomValues(new Uint8Array(SALT_BYTES))
  const finalIter = iter ?? ITERATIONS
  const key = await deriveKey(passphrase, finalSalt, finalIter)
  return { key, salt: finalSalt, iter: finalIter }
}

export async function encryptWithKey(payload: VaultPayload, handle: VaultKeyHandle): Promise<string> {
  const subtle = getSubtle()
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(IV_BYTES))
  const plaintext = new TextEncoder().encode(JSON.stringify(payload))
  const ciphertext = await subtle.encrypt({ name: "AES-GCM", iv: iv as BufferSource }, handle.key, plaintext)

  const envelope: VaultEnvelope = {
    v: VAULT_VERSION,
    kdf: KDF,
    iter: handle.iter,
    salt: bufferToBase64(handle.salt),
    iv: bufferToBase64(iv),
    ct: bufferToBase64(ciphertext),
  }

  return JSON.stringify(envelope, null, 2)
}

export async function encryptVault(payload: VaultPayload, passphrase: string): Promise<string> {
  if (!passphrase || passphrase.length < 8) {
    throw new Error("Passphrase must be at least 8 characters")
  }
  const handle = await deriveVaultKey(passphrase)
  return encryptWithKey(payload, handle)
}

export function isEncryptedEnvelope(parsed: unknown): parsed is VaultEnvelope {
  if (!parsed || typeof parsed !== "object") return false
  const candidate = parsed as Record<string, unknown>
  return (
    typeof candidate.v === "number" &&
    typeof candidate.kdf === "string" &&
    typeof candidate.iter === "number" &&
    typeof candidate.salt === "string" &&
    typeof candidate.iv === "string" &&
    typeof candidate.ct === "string"
  )
}

export async function unlockVault(
  envelope: VaultEnvelope,
  passphrase: string
): Promise<{ payload: VaultPayload; handle: VaultKeyHandle }> {
  if (!SUPPORTED_VAULT_VERSIONS.has(envelope.v)) {
    throw new Error(`Unsupported vault version: ${envelope.v}`)
  }
  if (envelope.kdf !== KDF) {
    throw new Error(`Unsupported key derivation: ${envelope.kdf}`)
  }
  if (
    typeof envelope.iter !== "number" ||
    !Number.isFinite(envelope.iter) ||
    envelope.iter < MIN_ACCEPTED_ITERATIONS ||
    envelope.iter > MAX_ACCEPTED_ITERATIONS
  ) {
    throw new Error("Vault iteration count is out of accepted range")
  }

  const subtle = getSubtle()
  const salt = base64ToBytes(envelope.salt)
  const iv = base64ToBytes(envelope.iv)
  const ciphertext = base64ToBytes(envelope.ct)
  const key = await deriveKey(passphrase, salt, envelope.iter)

  let plaintextBuffer: ArrayBuffer
  try {
    plaintextBuffer = await subtle.decrypt(
      { name: "AES-GCM", iv: iv as BufferSource },
      key,
      ciphertext as BufferSource
    )
  } catch {
    throw new Error("Wrong passphrase or corrupted vault")
  }

  const plaintext = new TextDecoder().decode(plaintextBuffer)
  let parsed: VaultPayload
  try {
    parsed = JSON.parse(plaintext) as VaultPayload
  } catch {
    throw new Error("Decrypted vault is not valid JSON")
  }

  if (!parsed || typeof parsed !== "object" || !parsed.profile || !parsed.empathyData) {
    throw new Error("Decrypted vault is missing expected fields")
  }

  return { payload: parsed, handle: { key, salt, iter: envelope.iter } }
}

export async function decryptVault(envelope: VaultEnvelope, passphrase: string): Promise<VaultPayload> {
  const { payload } = await unlockVault(envelope, passphrase)
  return payload
}
