import { expect, test } from "@playwright/test"

// Smoke test for the "Lite Empathy (TinyLlama)" Quick-Start preset.
//
// A true non-fallback reply needs a live Ollama serving the `empathia-tiny`
// model, which is not available in CI. So this test verifies the wiring that
// IS deterministic: applying the preset pins the Ollama provider to the
// `empathia-tiny` model. The model-backed reply path is covered separately
// when an Ollama daemon is present.
//
// We drive the preset through Settings (Start tab) rather than the onboarding
// modal, because onboarding only appears for first-time/unagreed sessions and
// can be auto-skipped; the Settings preset is always reachable.
test.describe("lite empathy (TinyLlama) preset", () => {
  test("applying the preset pins Ollama to the empathia-tiny model", async ({ page }) => {
    await page.goto("/")

    // Dismiss onboarding if it happens to be showing this run.
    const agreementCheckbox = page.locator(
      'label:has-text("I understand, and I\'d like to begin.") input[type="checkbox"]'
    )
    if (await agreementCheckbox.isVisible()) {
      await agreementCheckbox.check()
      await page.getByRole("button", { name: "I Agree and Continue" }).click()
    }
    const keepDefaultsButton = page.getByRole("button", { name: "Just use the default" })
    if (await keepDefaultsButton.isVisible()) {
      await keepDefaultsButton.click()
    }

    // Open Settings → Start tab and apply the Lite Empathy preset.
    await page.getByRole("button", { name: /open settings|settings/i }).click()

    const settingsDialog = page.locator("div.fixed.inset-0.z-50").first()
    await expect(settingsDialog).toBeVisible()

    await settingsDialog.getByRole("button", { name: /^start$/i }).click()

    const litePreset = settingsDialog.getByRole("button", {
      name: /Lite Empathy \(TinyLlama\)/i,
    })
    await expect(litePreset).toBeVisible()
    await litePreset.click()

    // Switch to the Provider tab; the Ollama model field should now be pinned.
    await settingsDialog.getByRole("button", { name: /^provider$/i }).click()

    const modelInput = settingsDialog
      .locator('label:has-text("Ollama Model") + input')
      .first()
    await expect(modelInput).toBeVisible()
    await expect(modelInput).toHaveValue("empathia-tiny")
  })
})
