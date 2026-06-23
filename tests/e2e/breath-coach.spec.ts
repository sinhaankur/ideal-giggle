import { expect, test } from "@playwright/test"

// Smoke test for the somatic breath-coach affordance: when the Mirror reads
// a high-load felt state, a "Take a breath" CTA should surface above the
// chat. Clicking it opens the BreathCoach panel; closing it dismisses.
test.describe("breath coach", () => {
  test("offers a breath CTA on high-load text and opens the coach when clicked", async ({ page }) => {
    await page.route("**/api/chat", async (route) => {
      await route.abort("failed")
    })

    await page.goto("/")

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

    const chatInput = page.getByPlaceholder("Share your thoughts...")
    const send = page.getByRole("button", { name: "Send message" })

    // High-load utterance should land "panicking"/"overwhelmed" tags and
    // a body hint, which together flag emotional load as "high".
    await chatInput.fill(
      "I am panicking and overwhelmed, my chest is so tight I cant breathe right now"
    )
    await send.click()

    const breathCta = page.getByRole("button", { name: /Take a breath/i })
    await expect(breathCta).toBeVisible()

    await breathCta.click()

    await expect(page.getByText(/4-7-8 Breath/i)).toBeVisible()
    await expect(page.getByText(/Breathe in|Breathe out|Hold/i).first()).toBeVisible()

    await page.getByRole("button", { name: /End breathing exercise/i }).click()
    await expect(page.getByText(/4-7-8 Breath/i)).not.toBeVisible()
  })
})
