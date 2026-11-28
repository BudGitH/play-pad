// Playwright config for PlayPad's browser tests (dev-only; see tests/smoke.spec.mjs).
//
// Two projects so CI can run them as separate jobs with their own time budgets (R2-Q-01):
//   core          the hub, every game's smoke test and the other games' specs (fast)
//   kampung-quest the Kampung Quest acceptance and phone specs (software-GL 3D, several minutes)
// `npm run smoke` runs both (everything except @slow); see package.json for the per-project scripts.
import { defineConfig, devices } from "@playwright/test";

// PW_PORT lets parallel checkouts (git worktrees) each run their own server instead of reusing another tree's.
const PORT = Number(process.env.PW_PORT) || 5599;
const KQ_SPECS = /kampung-quest-.*\.spec\.mjs$/;

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
  projects: [
    { name: "core", testIgnore: KQ_SPECS },
    { name: "kampung-quest", testMatch: KQ_SPECS },
  ],
  webServer: {
    command: `node tools/serve.mjs ${PORT}`,
    url: `http://localhost:${PORT}/`,
    reuseExistingServer: !process.env.CI,
  },
});
