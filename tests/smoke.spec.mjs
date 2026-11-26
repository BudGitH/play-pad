// Smoke test: the hub and every live game load without errors, and every live game can
// start a round on a phone and on a desktop.
// Catches a broken game before it reaches the live site (merging to main deploys).
// Run locally: npm run smoke
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { runInNewContext } from "node:vm";
import { test, expect } from "@playwright/test";
import { ROUND_DRIVERS, ROUND_TIMEOUT_MS } from "./round-drivers.mjs";

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
  page.on("requestfailed", (req) => {
    const sameOrigin = req.url().startsWith(new URL(page.url() || "http://localhost").origin);
    const reason = req.failure()?.errorText ?? "unknown";
    // ERR_ABORTED is the browser cancelling a request itself (navigation, media seeking), not a failure.
    if (sameOrigin && reason !== "net::ERR_ABORTED") {
      problems.push(`request failed (${reason}): ${req.url()}`);
    }
  });
  return problems;
}

/**
 * Fail if the page scrolls sideways. Also checks the layout viewport really is the device
 * width: a page with no viewport meta renders at ~980px on a phone, which would hide overflow.
 */
async function expectNoSidewaysScroll(page, viewport) {
  const m = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  expect(m.innerWidth, "layout width equals the device width (viewport meta tag)").toBe(
    viewport.width,
  );
  expect(m.scrollWidth, "page is wider than the screen (sideways scroll)").toBeLessThanOrEqual(
    m.innerWidth,
  );
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

    await expectNoSidewaysScroll(page, { width, height });
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

// ---------------------------------------------------------------------------------------
// Start a round in every live game, on a phone and on a desktop.
// The games come straight from games.js (read at collection time so each gets its own named
// test); the per-game "how do I start it / when is it in-round" lives in round-drivers.mjs.
// ---------------------------------------------------------------------------------------

/** The two form factors a round is started on (touch → real taps; desktop → mouse clicks). */
const ROUND_VIEWPORTS = [
  { name: "phone 390x844", width: 390, height: 844, touch: true },
  { name: "desktop 1366x800", width: 1366, height: 800, touch: false },
];

/** Party games pre-select this many players, so a fresh visitor can hit Start straight away. */
const PLAYER_COUNT_CHIP = '#playerChips [aria-pressed="true"]';

/** Read the live entries of games.js (a classic script that sets window.GAMES) without a browser. */
function readLiveGamesFromRegistry() {
  const sandbox = { window: {} };
  runInNewContext(readFileSync(join(import.meta.dirname, "..", "games.js"), "utf8"), sandbox);
  const games = JSON.parse(JSON.stringify(sandbox.window.GAMES));
  return games.filter((g) => g.status === "live");
}

/** A counter the game must keep advancing while a round runs (proves the loop is alive). */
async function expectHeartbeat(page, readCounter) {
  const before = await readCounter(page);
  await expect.poll(() => readCounter(page), { timeout: ROUND_TIMEOUT_MS }).toBeGreaterThan(before);
}

/** Open a game, start a round through its real UI and wait until it is genuinely in-round. */
async function startRoundInGame(page, game, vp) {
  const problems = watchForProblems(page);
  const res = await page.goto(`/${game.path}`);
  expect(res.status()).toBe(200);
  await page.waitForLoadState("networkidle");
  await expect(page).toHaveTitle(new RegExp(game.title));
  await expectNoSidewaysScroll(page, vp); // the setup screen

  const driver = ROUND_DRIVERS[game.id];
  if (!driver) {
    // A new game nobody wrote a driver for yet: fall back to "opens without errors".
    test.info().annotations.push({
      type: "no round driver",
      description: `add "${game.id}" to tests/round-drivers.mjs to start a round in it`,
    });
    expect(problems).toEqual([]);
    return;
  }
  test.info().annotations.push({ type: "in-round signal", description: driver.signal });

  const start = page.getByRole("button", { name: driver.start, exact: true });
  if (driver.players) {
    await expect(page.locator(PLAYER_COUNT_CHIP)).toHaveText(driver.players);
  }
  if (driver.prepare) await driver.prepare(page);
  await expect(start).toBeEnabled();
  await (vp.touch ? start.tap() : start.click());

  await driver.waitForRound(page);
  if (driver.heartbeat) await expectHeartbeat(page, driver.heartbeat);
  await expectNoSidewaysScroll(page, vp); // the in-round screen
  expect(problems).toEqual([]);
}

const LIVE_GAMES = readLiveGamesFromRegistry();

test("games.js lists live games to run rounds in (a game with no driver is flagged)", async () => {
  // An empty or unreadable registry would silently generate zero round tests, so guard it.
  expect(LIVE_GAMES.length).toBeGreaterThan(0);
  // Not a hard gate (a new game falls back to the open check) — this keeps the gap visible.
  for (const game of LIVE_GAMES.filter((g) => !ROUND_DRIVERS[g.id])) {
    test.info().annotations.push({ type: "no round driver", description: game.id });
  }
});

for (const vp of ROUND_VIEWPORTS) {
  test.describe(`start a round at ${vp.name}`, () => {
    // Sunset Stride compiles its shaders in software on CI (no GPU), which is slow; leave headroom.
    test.describe.configure({ timeout: 45_000 });
    test.use({
      viewport: { width: vp.width, height: vp.height },
      isMobile: vp.touch,
      hasTouch: vp.touch,
    });

    for (const game of LIVE_GAMES) {
      test(`${game.title} reaches its in-round state`, async ({ page }) => {
        await startRoundInGame(page, game, vp);
      });
    }
  });
}
