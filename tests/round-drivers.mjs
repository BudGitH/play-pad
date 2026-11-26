// Per-game "start a round" drivers for the smoke test (tests/smoke.spec.mjs).
//
// Opting a new game in is ONE entry in ROUND_DRIVERS, keyed by its `games.js` id.
// A live game with no entry still gets the generic "opens without errors" check.
//
//   start        accessible name of the button that starts a round (exact match)
//   prepare      optional async (page) => void — runs before the Start button is checked, for a game
//                whose Start stays disabled while it loads (Kampung Quest builds a 3D world first)
//   players      party games only: the player-count chip that must already be selected, so
//                Start works with no setup (a fresh visitor can just hit Start)
//   signal       one line naming what "in round" means (shown in the test annotations)
//   waitForRound async (page) => void — resolves once the round is really under way (past any
//                3-2-1), and throws (an expect timeout) if it never gets there
//   heartbeat    optional async (page) => number that must keep increasing while the round
//                runs — proves the game loop is alive, not just that a screen is showing
//
// Prefer the game's own debug hook (window.__claw / __decoder / __stride) when it has one;
// otherwise assert on visible in-round DOM state. Nothing here uses a fixed sleep.
import { expect } from "@playwright/test";

/** Longest we wait for a round to begin (covers the slowest 3-2-1 plus a slow CI runner). */
export const ROUND_TIMEOUT_MS = 15_000;

export const ROUND_DRIVERS = {
  "colour-rush": {
    start: "Start",
    players: "2",
    signal: "#game screen active, 3-2-1 overlay gone, a dot on screen",
    async waitForRound(page) {
      await expect(page.locator("#game")).toHaveClass(/\bactive\b/);
      await expect(page.locator("#countdown")).not.toHaveClass(/\bactive\b/, {
        timeout: ROUND_TIMEOUT_MS,
      });
      await expect(page.locator("#playArea .dot").first()).toBeVisible({
        timeout: ROUND_TIMEOUT_MS,
      });
    },
  },

  snap: {
    start: "Start",
    players: "2",
    signal: "#stage data-phase has left idle/countdown (cards are being revealed)",
    async waitForRound(page) {
      await expect(page.locator("#game")).toHaveClass(/\bactive\b/);
      await expect(page.locator("#stage")).toHaveAttribute(
        "data-phase",
        /^(reveal|resolved_match|resolved_timeout|inter_round|shuffle)$/,
        { timeout: ROUND_TIMEOUT_MS },
      );
    },
  },

  "claw-catch": {
    start: "Start",
    signal: "__claw.running && !__claw.countingDown, frame counter advancing",
    async waitForRound(page) {
      await expect
        .poll(
          () =>
            page.evaluate(() => ({
              running: window.__claw?.running,
              countingDown: window.__claw?.countingDown,
            })),
          { timeout: ROUND_TIMEOUT_MS },
        )
        .toEqual({ running: true, countingDown: false });
    },
    heartbeat: (page) => page.evaluate(() => window.__claw.frame),
  },

  "super-decoder": {
    start: "Start",
    signal: '__decoder.phase === "PLACING" (first guess row is open)',
    async waitForRound(page) {
      await expect
        .poll(() => page.evaluate(() => window.__decoder?.phase), { timeout: ROUND_TIMEOUT_MS })
        .toBe("PLACING");
    },
  },

  "sunset-stride": {
    start: "Start running",
    // Needs WebGL: if the browser has none the game shows its own "turn on WebGL" notice and
    // never leaves "idle", so this fails loudly rather than passing on a blank canvas.
    signal: '__stride.state.phase === "running", score advancing',
    async waitForRound(page) {
      await expect
        .poll(() => page.evaluate(() => window.__stride?.state.phase), {
          timeout: ROUND_TIMEOUT_MS,
        })
        .toBe("running");
    },
    heartbeat: (page) => page.evaluate(() => window.__stride.state.score),
  },

  "sparkle-salon": {
    start: "Start makeover",
    signal: '__salon.phase === "playing", frame counter advancing',
    async waitForRound(page) {
      await expect
        .poll(() => page.evaluate(() => window.__salon?.phase), { timeout: ROUND_TIMEOUT_MS })
        .toBe("playing");
    },
    heartbeat: (page) => page.evaluate(() => window.__salon.frame),
  },

  "brick-buddies": {
    start: "Start building",
    signal: '__buddies.phase === "playing", frame counter advancing',
    async waitForRound(page) {
      await expect
        .poll(() => page.evaluate(() => window.__buddies?.phase), { timeout: ROUND_TIMEOUT_MS })
        .toBe("playing");
    },
    heartbeat: (page) => page.evaluate(() => window.__buddies.frame),
  },

  "kampung-quest": {
    start: "Start",
    // Start is disabled until the world, the figures and the azan have loaded (design D, loading
    // state), which takes ~10-15 s in software GL, so wait for the game's `loaded` flag first.
    async prepare(page) {
      await expect
        .poll(() => page.evaluate(() => window.__kq?.loaded), { timeout: 40_000 })
        .toBe(true);
    },
    // The hook flips `ready` once the game loop is running.
    signal: "__kq.ready, frame counter advancing",
    async waitForRound(page) {
      await expect
        .poll(() => page.evaluate(() => window.__kq?.ready), { timeout: ROUND_TIMEOUT_MS })
        .toBe(true);
    },
    heartbeat: (page) => page.evaluate(() => window.__kq.stats().frames),
  },
};
