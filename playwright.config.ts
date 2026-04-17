import { defineConfig, devices } from "@playwright/test"

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  retries: 1,
  workers: 1,
  timeout: 90_000,
  expect: {
    timeout: 20_000,
  },
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "pnpm dev",
    url: "http://127.0.0.1:3000",
    timeout: 120_000,
    reuseExistingServer: true,
  },
})