import { expect, test } from "@playwright/test"

// The chat panel should surface felt-state-tailored quick prompts above the
// input once a user message has been sent. Picking one fills the input.
test.describe("felt-state-aware prompts", () => {
  test("renders tailored prompts after a lonely-tagged user message and selecting one fills the input", async ({ page }) => {
    await page.route("**/api/chat", async (route) => {
      await route.abort("failed")
    })

    await page.goto("/")

    const agreementCheckbox = page.locator(
      'label:has-text("I have read and agree to use this empathy tool responsibly.") input[type="checkbox"]'
    )
    if (await agreementCheckbox.isVisible()) {
      await agreementCheckbox.check()
      await page.getByRole("button", { name: "I Agree and Continue" }).click()
    }

    const keepDefaultsButton = page.getByRole("button", { name: "Keep default settings for now" })
    if (await keepDefaultsButton.isVisible()) {
      await keepDefaultsButton.click()
    }

    const chatInput = page.getByPlaceholder("Share your thoughts...")
    const send = page.getByRole("button", { name: "Send message" })

    // Walk the onboarding intro turns so the felt-prompt strip (which is
    // hidden during onboarding) becomes eligible.
    const onboardingAnswers = [
      "I feel lonely tonight, like no one really sees me anymore.",
      "The trigger was a dinner where everyone was talking past me.",
      "My chest got heavy and I just wanted to disappear into my room.",
    ]
    for (const answer of onboardingAnswers) {
      await chatInput.fill(answer)
      await send.click()
      await expect(page.locator("p", { hasText: answer }).first()).toBeVisible()
    }

    // One more turn after onboarding so the strip is past the gate.
    await chatInput.fill("I am still feeling lonely and disconnected from everyone")
    await send.click()
    await expect(
      page.locator("p", { hasText: "I am still feeling lonely and disconnected from everyone" }).first()
    ).toBeVisible()

    // The felt-prompt strip should now be visible above the input.
    const strip = page.locator('[data-testid="felt-prompt-strip"]')
    await expect(strip).toBeVisible()

    // It should contain a prompt drawn from the "lonely" pool.
    const tailoredPrompt = strip.getByRole("button", {
      name: /heard|stay with me|reflect/i,
    })
    await expect(tailoredPrompt.first()).toBeVisible()

    // Clicking it should pre-fill the chat input.
    const promptText = (await tailoredPrompt.first().textContent())?.trim() || ""
    await tailoredPrompt.first().click()
    await expect(chatInput).toHaveValue(promptText)
  })
})
