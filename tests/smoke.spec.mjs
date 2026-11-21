// Smoke test: the hub and every live game load without errors.
// Catches a broken game before it reaches the live site (merging to main deploys).
// Run locally: npm run smoke
import { test, expect } from "@playwright/test";

/** Start recording page errors, console errors and failed same-origin requests. */
function watchForProblems(page) {
  const problems = [];
  page.on("pageerror", (err) => problems.push(`page error: ${err.message}`));
  page.on("console", (msg) => {
    if (msg.type() === "error") problems.push(`console error: ${msg.text()}`);
  });
  page.on("response", (res) => {
    const sameOrigin = res.url().startsWith(new URL(page.url() || "http://localhost").origin);
    if (sameOrigin && res.status() >= 400) problems.push(`HTTP ${res.status()}: ${res.url()}`);
  });
  return problems;
}

/** Read the game registry (window.GAMES) the hub renders from. */
async function loadLiveGames(page) {
  await page.goto("/");
  const games = await page.evaluate(() => window.GAMES);
  return games.filter((g) => g.status === "live");
}

test("hub loads and shows a card for every live game", async ({ page }) => {
  const problems = watchForProblems(page);
  const live = await loadLiveGames(page);

  expect(live.length).toBeGreaterThan(0);
  for (const game of live) {
    await expect(page.getByRole("heading", { name: game.title })).toBeVisible();
  }
  expect(problems).toEqual([]);
});

test("every live game opens without errors", async ({ page }) => {
  const live = await loadLiveGames(page);

  for (const game of live) {
    await test.step(game.title, async () => {
      const problems = watchForProblems(page);
      const res = await page.goto(`/${game.path}`);
      expect(res.status()).toBe(200);
      await page.waitForLoadState("networkidle");
      await expect(page).toHaveTitle(new RegExp(game.title));
      expect(problems).toEqual([]);
      page.removeAllListeners();
    });
  }
});
