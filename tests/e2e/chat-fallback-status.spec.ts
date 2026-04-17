import { expect, test } from "@playwright/test"

test.describe("chat fallback runtime status", () => {
  test("shows concrete status message when endpoint is bad and user asks 'Is AI running?'", async ({ page }) => {
    await page.route("**/api/chat", async (route) => {
      await route.abort("failed")
    })

    await page.goto("/")

    const agreementCheckbox = page.locator('label:has-text("I have read and agree to use this empathy tool responsibly.") input[type="checkbox"]')
    if (await agreementCheckbox.isVisible()) {
      await agreementCheckbox.check()
      await page.getByRole("button", { name: "I Agree and Continue" }).click()
    }

    const keepDefaultsButton = page.getByRole("button", { name: "Keep default settings for now" })
    if (await keepDefaultsButton.isVisible()) {
      await keepDefaultsButton.click()
    }

    const chatInput = page.getByPlaceholder("Share your thoughts...")
    await chatInput.fill("Is AI running?")
    await page.getByRole("button", { name: "Send message" }).click()

    await expect(page.getByText(/local fallback/i).first()).toBeVisible()
    await expect(
      page.getByText(/full AI model connection is down|fallback mode|Error:/i).first()
    ).toBeVisible()
  })

  test("shows concrete status message when Ollama endpoint is invalid via Settings", async ({ page }) => {
    await page.goto("/")

    const agreementCheckbox = page.locator('label:has-text("I have read and agree to use this empathy tool responsibly.") input[type="checkbox"]')
    if (await agreementCheckbox.isVisible()) {
      await agreementCheckbox.check()
      await page.getByRole("button", { name: "I Agree and Continue" }).click()
    }

    const keepDefaultsButton = page.getByRole("button", { name: "Keep default settings for now" })
    if (await keepDefaultsButton.isVisible()) {
      await keepDefaultsButton.click()
    }

    await page.getByRole("button", { name: /open settings|settings/i }).click()

    const settingsDialog = page.locator('div.fixed.inset-0.z-50').first()
    await expect(settingsDialog).toBeVisible()

    const scrollable = settingsDialog.locator('div.flex-1.overflow-y-auto.px-6.py-4').first()
    await scrollable.evaluate((el) => {
      el.scrollTo({ top: 500 })
    })

    await settingsDialog.getByRole("button", { name: /Uses your local Ollama runtime/i }).click()

    const baseUrlInput = settingsDialog.locator('label:has-text("Ollama Base URL") + input').first()
    await expect(baseUrlInput).toBeVisible()
    await baseUrlInput.fill("http://127.0.0.1:1")

    await settingsDialog.getByRole("button", { name: "Save & Close" }).click()

    const chatInput = page.getByPlaceholder("Share your thoughts...")
    const send = page.getByRole("button", { name: "Send message" })

    // Complete intro onboarding prompts first so the next turn uses provider-backed flow.
    const onboardingAnswers = [
      "I feel tense today because I am overloaded with deadlines and context switching.",
      "The trigger was a failed deployment and then a cascade of urgent pings.",
      "My body got tight in my chest and shoulders, and my breathing became shallow.",
    ]

    for (const answer of onboardingAnswers) {
      await chatInput.fill(answer)
      await send.click()
      await expect(page.locator("p", { hasText: answer }).first()).toBeVisible()
    }

    await chatInput.fill("Is AI running?")
    await send.click()

    await expect(page.getByText(/local fallback/i).first()).toBeVisible()
    await expect(
      page.getByText(/full AI model connection is down|fallback mode|Ollama mode is active|Error:/i).first()
    ).toBeVisible()
  })
})