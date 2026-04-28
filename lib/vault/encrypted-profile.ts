import type { EmpathyProfile, EmpathyData } from "@/lib/companion-types"

export const VAULT_VERSION = 1
const KDF = "pbkdf2-sha256"
const ITERATIONS = 250_000
const SALT_BYTES = 16
const IV_BYTES = 12
const KEY_BITS = 256

export interface VaultPayload {
  profile: EmpathyProfile
  empathyData: EmpathyData
  exportedAt: string
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
  if (envelope.v !== VAULT_VERSION) {
    throw new Error(`Unsupported vault version: ${envelope.v}`)
  }
  if (envelope.kdf !== KDF) {
    throw new Error(`Unsupported key derivation: ${envelope.kdf}`)
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
