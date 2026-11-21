// Playwright config for the PlayPad smoke test (dev-only; see tests/smoke.spec.mjs).
import { defineConfig, devices } from "@playwright/test";

const PORT = 5599;

export default defineConfig({
  testDir: "tests",
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    ...devices["Desktop Chrome"],
    // Optional: point at a pre-installed Chromium (e.g. cloud dev boxes) instead
    // of the one `npx playwright install` downloads.
    launchOptions: process.env.PW_CHROMIUM_PATH
      ? { executablePath: process.env.PW_CHROMIUM_PATH }
      : {},
  },
  webServer: {
    command: `node tools/serve.mjs ${PORT}`,
    url: `http://localhost:${PORT}/`,
    reuseExistingServer: !process.env.CI,
  },
});
