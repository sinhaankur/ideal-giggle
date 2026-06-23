import { describe, expect, it } from "vitest"
import {
  encryptVault,
  decryptVault,
  isEncryptedEnvelope,
  mergeSessionHistory,
  unlockVault,
  SESSION_HISTORY_CAP,
  VAULT_VERSION,
  type SessionMemoryRecord,
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

  it("still decrypts legacy v1 and v2 envelopes under the current version", async () => {
    // Backward-compat guarantee: bumping VAULT_VERSION (now 3, sessionHistory)
    // must never lock out older files. Encrypt, then forge the stored version
    // back to simulate older files.
    const passphrase = "correct horse battery staple"
    for (const legacyVersion of [1, 2]) {
      const envelopeJson = await encryptVault(samplePayload, passphrase)
      const envelope = JSON.parse(envelopeJson)
      envelope.v = legacyVersion
      const decrypted = await decryptVault(envelope, passphrase)
      expect(decrypted).toEqual(samplePayload)
    }
  })

  it("round-trips a v3 payload carrying sessionHistory", async () => {
    const passphrase = "correct horse battery staple"
    const withHistory: VaultPayload = {
      ...samplePayload,
      sessionHistory: [
        { id: "s1", savedAt: "2026-04-01T10:00:00.000Z", headline: "anxious + tired", summaryParagraphs: ["a"], turns: [] },
        { id: "s2", savedAt: "2026-04-02T10:00:00.000Z", headline: "lighter", summaryParagraphs: ["b"], turns: [] },
      ],
    }
    const envelopeJson = await encryptVault(withHistory, passphrase)
    const decrypted = await decryptVault(JSON.parse(envelopeJson), passphrase)
    expect(decrypted.sessionHistory).toHaveLength(2)
    expect(decrypted.sessionHistory?.[1].headline).toBe("lighter")
  })
})

describe("mergeSessionHistory", () => {
  const rec = (id: string, headline = id): SessionMemoryRecord => ({
    id,
    savedAt: new Date().toISOString(),
    headline,
    summaryParagraphs: [],
    turns: [],
  })

  it("appends a new session", () => {
    const out = mergeSessionHistory([rec("a")], rec("b"))
    expect(out.map((s) => s.id)).toEqual(["a", "b"])
  })

  it("replaces a same-id session in place (debounced re-save grows one entry)", () => {
    const out = mergeSessionHistory([rec("a"), rec("b", "old")], rec("b", "updated"))
    expect(out).toHaveLength(2)
    expect(out.find((s) => s.id === "b")?.headline).toBe("updated")
  })

  it("handles undefined existing and undefined incoming", () => {
    expect(mergeSessionHistory(undefined, undefined)).toEqual([])
    expect(mergeSessionHistory(undefined, rec("a")).map((s) => s.id)).toEqual(["a"])
  })

  it("caps the list to SESSION_HISTORY_CAP, dropping the oldest", () => {
    const many = Array.from({ length: SESSION_HISTORY_CAP + 5 }, (_, i) => rec(`s${i}`))
    const out = mergeSessionHistory(many, rec("newest"))
    expect(out).toHaveLength(SESSION_HISTORY_CAP)
    expect(out[out.length - 1].id).toBe("newest")
    // The oldest few rolled off.
    expect(out.some((s) => s.id === "s0")).toBe(false)
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
