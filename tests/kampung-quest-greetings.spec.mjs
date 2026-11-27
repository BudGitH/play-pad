// Kampung Quest: citizens say salaam when their paths cross. A neighbour who passes the hero greets
// them ("Assalamualaikum!") and the hero's reply shows ("Waalaikumsalam!"); strollers on the
// pavements greet each other; the screen is never spammed (global gap and cap); and the bubbles
// cost no draw calls. The pairing / cooldown rules are unit-tested in
// tests/kampung-quest/greet.test.mjs; this checks them in the real game.
// The page runs with `?still=1` (time moves only through __kq.step) and `?autoq=0`.
// Run: npx playwright test tests/kampung-quest-greetings.spec.mjs
import { test, expect } from "@playwright/test";

const GAME = "/games/kampung-quest/index.html";
const kq = (page, fn, arg) => page.evaluate(fn, arg);

async function boot(page, query = "?still=1&autoq=0&q=low") {
  await page.goto(GAME + query);
  await expect.poll(() => kq(page, () => window.__kq?.loaded), { timeout: 90_000 }).toBe(true);
  await page.locator("#kq button.primary").first().click();
  await expect.poll(() => kq(page, () => window.__kq.ready), { timeout: 30_000 }).toBe(true);
}

/** Browser-side: walk the hero at a neighbour for up to 8 s, noting every bubble text and the DOM. */
function walkAtNeighbour(id) {
  const k = window.__kq;
  k.setMinute(420);
  for (let i = 0; i < 8 && !k.npc(id); i += 1) k.step(200);
  const n = k.npc(id);
  k.greetChance(1);
  k.place(n.x + 4, n.z, -Math.PI / 2);
  k.input("up", true);
  const seen = {};
  let dom = [];
  for (let i = 0; i < 80; i += 1) {
    k.step(100);
    k.greetings().showing.forEach((b) => (seen[b.who + "|" + b.text] = true));
    const live = [...document.querySelectorAll(".kq-greet")].filter((e) => !e.hidden);
    if (live.length > dom.length) dom = live.map((e) => e.textContent);
  }
  k.input("up", false);
  return { seen: Object.keys(seen), dom, total: k.greetings().total };
}

/** Browser-side: stand on a busy pavement and run game frames, sampling the bubbles and the clock. */
function watchPavement(spot) {
  const G = window.KQ.Game;
  const k = window.__kq;
  k.setMinute(spot.minute);
  k.place(spot.x, spot.z, spot.heading);
  k.greetChance(1);
  let mostAtOnce = 0;
  const frames = 30 * 90;
  for (let i = 0; i < frames; i += 1) {
    G.Loop.frame(1 / 30, true);
    mostAtOnce = Math.max(mostAtOnce, k.greetings().showing.length);
  }
  const texts = new Set(k.greetings().showing.map((b) => b.text));
  return { total: k.greetings().total, mostAtOnce, seconds: frames / 30, texts: [...texts] };
}

test.describe.configure({ mode: "serial" });

test("a neighbour who passes the hero says salaam and the hero's reply shows", async ({ page }) => {
  test.setTimeout(240_000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await boot(page);
  const r = await kq(page, walkAtNeighbour, "nenek");
  expect(r.total, "Nenek greeted the hero").toBeGreaterThanOrEqual(1);
  expect(r.seen).toContain("nenek|Assalamualaikum!");
  expect(r.seen).toContain("hero|Waalaikumsalam!");
  expect(r.dom, "the bubbles are real elements with the text").toEqual(
    expect.arrayContaining(["Assalamualaikum!"]),
  );
  expect(errors).toEqual([]);
});

test("strollers greet each other, but never spam the screen", async ({ page }) => {
  test.setTimeout(300_000);
  await boot(page);
  const r = await kq(page, watchPavement, { x: 20, z: 12, heading: Math.PI, minute: 455 });
  expect(r.total, "someone greeted someone in 90 s on a busy pavement").toBeGreaterThanOrEqual(1);
  expect(r.mostAtOnce, "at most three greetings (six bubbles) at once").toBeLessThanOrEqual(6);
  // A global gap of 3 s between greetings, even with every roll forced to succeed.
  expect(r.total, "greetings per second stay calm").toBeLessThanOrEqual(r.seconds / 3 + 1);
});

/** Browser-side: the same 45 s on a busy pavement, drawing every 150th frame; the draw calls at each draw. */
function callsTrace(chance) {
  const G = window.KQ.Game;
  const k = window.__kq;
  k.setMinute(455);
  k.place(20, 12, Math.PI);
  k.greetChance(chance);
  const calls = [];
  for (let i = 0; i < 30 * 45; i += 1) {
    const draw = i % 150 === 149;
    G.Loop.frame(1 / 30, !draw);
    if (draw) calls.push(k.stats().calls);
  }
  return { calls, total: k.greetings().total };
}

test("bubbles cost no draw calls: the same walk with and without greetings draws the same", async ({
  browser,
}) => {
  test.setTimeout(300_000);
  const run = async (chance) => {
    const context = await browser.newContext(); // a fresh game each time (no saved progress)
    const page = await context.newPage();
    await boot(page);
    const trace = await kq(page, callsTrace, chance);
    await context.close();
    return trace;
  };
  const quiet = await run(0);
  const loud = await run(1);
  expect(quiet.total).toBe(0);
  expect(loud.total, "greetings did happen in the second run").toBeGreaterThanOrEqual(1);
  // The crowd and the clock are seeded, and bubbles are DOM nodes: every draw matches (+-2 allows
  // for a neighbour's raised hand moving a shadow caster across a culling edge).
  loud.calls.forEach((c, i) => expect(Math.abs(c - quiet.calls[i])).toBeLessThanOrEqual(2));
  expect(Math.max(...loud.calls)).toBeLessThanOrEqual(400);
});
