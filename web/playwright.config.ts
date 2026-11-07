import { defineConfig, devices } from "@playwright/test"

const PORT = 3100
const CI = !!process.env.CI

/** End-to-end tests against the production build (`npm run build` first). */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: CI,
  retries: CI ? 2 : 0,
  workers: CI ? 2 : undefined,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: CI ? [["github"], ["html", { open: "never" }], ["list"]] : [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } }, grepInvert: /@responsive/ },
    { name: "laptop", use: { ...devices["Desktop Chrome"], viewport: { width: 1100, height: 800 } }, grep: /@responsive/ },
  ],
  webServer: {
    command: `npm run start -- -p ${PORT}`,
    url: `http://localhost:${PORT}/explore`,
    reuseExistingServer: !CI,
    timeout: 120_000,
  },
})
