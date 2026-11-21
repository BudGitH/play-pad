// Smoke test: the hub and every live game load without errors.
// Catches a broken game before it reaches the live site (merging to main deploys).
// Run locally: npm run smoke
import { test, expect } from "@playwright/test";

/** Phone, large phone, tablet and laptop widths the hub layout is checked at. */
const HUB_VIEWPORTS = [
  { width: 360, height: 740 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1366, height: 800 },
];

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

/** A game card is one link named exactly "Play <title>" (the hero's is "Play <title> now"). */
function cardLink(page, game) {
  return page.getByRole("link", { name: `Play ${game.title}`, exact: true });
}

test("hub loads and shows a card for every live game", async ({ page }) => {
  const problems = watchForProblems(page);
  const live = await loadLiveGames(page);

  expect(live.length).toBeGreaterThan(0);
  for (const game of live) {
    const link = cardLink(page, game);
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute("href", game.path);
  }
  expect(problems).toEqual([]);
});

for (const { width, height } of HUB_VIEWPORTS) {
  test(`hub has no errors and no sideways scroll at ${width}x${height}`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    const problems = watchForProblems(page);
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const overflow = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
    }));
    expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.innerWidth);
    expect(problems).toEqual([]);
  });
}

test("filter chips narrow the list and the choice is remembered", async ({ page }) => {
  const live = await loadLiveGames(page);
  const solo = live.filter((g) => String(g.players).trim() === "1");
  const together = live.filter((g) => String(g.players).trim() !== "1");
  const chip = (name) => page.getByRole("button", { name: new RegExp(`^${name}\\b`) });
  const cards = page.locator("#grid a.game-card");

  await expect(chip("All")).toHaveAttribute("aria-pressed", "true");
  await expect(cards).toHaveCount(live.length);

  await chip("Solo").click();
  await expect(chip("Solo")).toHaveAttribute("aria-pressed", "true");
  await expect(chip("All")).toHaveAttribute("aria-pressed", "false");
  await expect(cards).toHaveCount(solo.length);
  await expect(page.locator("#gamesStatus")).toHaveText(`Showing ${solo.length} solo games`);

  await page.reload();
  await expect(chip("Solo")).toHaveAttribute("aria-pressed", "true");
  await expect(cards).toHaveCount(solo.length);

  await chip("Play together").click();
  await expect(cards).toHaveCount(together.length);

  await chip("All").click();
  await expect(cards).toHaveCount(live.length);
});

test("the theme toggle flips the theme, and the choice survives a reload with no flash", async ({
  page,
}) => {
  // Record the theme at DOMContentLoaded: the theme script runs in <head>, so a
  // saved choice must already be applied by then (no flash of the wrong theme).
  await page.addInitScript(() => {
    document.addEventListener("DOMContentLoaded", () => {
      window.__themeAtDomReady = document.documentElement.dataset.theme || null;
    });
  });
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");

  const toggle = page.getByRole("button", { name: /^Switch to (light|dark) theme$/ });
  await expect(toggle).toHaveAttribute("aria-label", "Switch to light theme");

  await toggle.click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(toggle).toHaveAttribute("aria-label", "Switch to dark theme");
  const chromeColors = await page.evaluate(() =>
    [...document.querySelectorAll('meta[name="theme-color"]')].map((m) => m.content),
  );
  expect(chromeColors).toEqual(["#fff8f7", "#fff8f7"]);

  await page.reload();
  expect(await page.evaluate(() => window.__themeAtDomReady)).toBe("light");
  await expect(toggle).toHaveAttribute("aria-label", "Switch to dark theme");

  await toggle.click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});

test("hub plays no entrance animation when the player asks for reduced motion", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  const running = await page.evaluate(() => document.getAnimations().length);
  expect(running).toBe(0);
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
