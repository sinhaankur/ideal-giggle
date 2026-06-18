import { describe, expect, it } from "vitest"
import {
  encryptVault,
  decryptVault,
  isEncryptedEnvelope,
  unlockVault,
  VAULT_VERSION,
  type VaultPayload,
} from "./encrypted-profile"
import { DEFAULT_EMPATHY_PROFILE } from "../companion-types"

const samplePayload: VaultPayload = {
  profile: {
    ...DEFAULT_EMPATHY_PROFILE,
    preferredName: "TestUser",
  },
  empathyData: {
    says: ["I told them I needed space."],
    thinks: ["Belief: I am behind."],
    does: ["Action: walked away."],
    feels: ["Anxiety lingering."],
  },
  exportedAt: "2026-04-27T12:00:00.000Z",
}

describe("vault round-trip", () => {
  it("encrypts and decrypts back to the original payload with the right passphrase", async () => {
    const passphrase = "correct horse battery staple"
    const envelopeJson = await encryptVault(samplePayload, passphrase)
    const envelope = JSON.parse(envelopeJson)

    expect(isEncryptedEnvelope(envelope)).toBe(true)
    // Newly written envelopes carry the current version (now 2 with the
    // consciousness block). Assert against the constant so future bumps don't
    // re-break this test.
    expect(envelope.v).toBe(VAULT_VERSION)
    expect(envelope.kdf).toBe("pbkdf2-sha256")
    expect(envelope.salt).toBeTruthy()
    expect(envelope.iv).toBeTruthy()
    expect(envelope.ct).toBeTruthy()
    // Plaintext must NOT appear in the envelope.
    expect(envelopeJson).not.toContain("TestUser")
    expect(envelopeJson).not.toContain("walked away")

    const decrypted = await decryptVault(envelope, passphrase)
    expect(decrypted).toEqual(samplePayload)
  })

  it("fails on the wrong passphrase", async () => {
    const envelopeJson = await encryptVault(samplePayload, "rightPassphrase123")
    const envelope = JSON.parse(envelopeJson)

    await expect(decryptVault(envelope, "wrongPassphrase!!")).rejects.toThrow(/wrong passphrase|corrupted/i)
  })

  it("rejects passphrases shorter than 8 characters at encrypt time", async () => {
    await expect(encryptVault(samplePayload, "short")).rejects.toThrow(/at least 8/i)
  })

  it("still decrypts a legacy v1 envelope under the current version", async () => {
    // Backward-compat guarantee: bumping VAULT_VERSION to 2 (consciousness
    // block) must never lock out files written at v1. Encrypt, then forge the
    // stored version back to 1 to simulate an older file.
    const passphrase = "correct horse battery staple"
    const envelopeJson = await encryptVault(samplePayload, passphrase)
    const envelope = JSON.parse(envelopeJson)
    envelope.v = 1

    const decrypted = await decryptVault(envelope, passphrase)
    expect(decrypted).toEqual(samplePayload)
  })
})

describe("unlockVault iteration bounds", () => {
  it("rejects an envelope with iter above the maximum without running PBKDF2", async () => {
    const envelopeJson = await encryptVault(samplePayload, "valid-passphrase-1")
    const envelope = JSON.parse(envelopeJson)
    envelope.iter = 100_000_000_000

    await expect(unlockVault(envelope, "valid-passphrase-1")).rejects.toThrow(/iteration count|out of accepted range/i)
  })

  it("rejects an envelope with iter below the minimum", async () => {
    const envelopeJson = await encryptVault(samplePayload, "valid-passphrase-1")
    const envelope = JSON.parse(envelopeJson)
    envelope.iter = 100

    await expect(unlockVault(envelope, "valid-passphrase-1")).rejects.toThrow(/iteration count|out of accepted range/i)
  })

  it("rejects an envelope with non-numeric iter", async () => {
    const envelopeJson = await encryptVault(samplePayload, "valid-passphrase-1")
    const envelope = JSON.parse(envelopeJson)
    envelope.iter = "lots"

    await expect(unlockVault(envelope, "valid-passphrase-1")).rejects.toThrow(/iteration count|out of accepted range/i)
  })
})

describe("isEncryptedEnvelope", () => {
  it("returns true for a real envelope shape", () => {
    expect(
      isEncryptedEnvelope({
        v: 1,
        kdf: "pbkdf2-sha256",
        iter: 250000,
        salt: "abc",
        iv: "def",
        ct: "ghi",
      })
    ).toBe(true)
  })

  it("returns false for a plain bundle", () => {
    expect(
      isEncryptedEnvelope({
        profile: { preferredName: "x" },
        empathyData: { says: [], thinks: [], does: [], feels: [] },
        exportedAt: "2026-01-01T00:00:00.000Z",
      })
    ).toBe(false)
  })

  it("returns false for null/undefined/non-objects", () => {
    expect(isEncryptedEnvelope(null)).toBe(false)
    expect(isEncryptedEnvelope(undefined)).toBe(false)
    expect(isEncryptedEnvelope("string")).toBe(false)
    expect(isEncryptedEnvelope(42)).toBe(false)
  })
})
