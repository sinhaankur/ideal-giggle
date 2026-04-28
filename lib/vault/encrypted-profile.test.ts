import { describe, expect, it } from "vitest"
import { encryptVault, decryptVault, isEncryptedEnvelope, type VaultPayload } from "./encrypted-profile"
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
    expect(envelope.v).toBe(1)
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
