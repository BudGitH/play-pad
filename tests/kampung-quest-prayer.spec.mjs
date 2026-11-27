// Kampung Quest: owner requests 4 and 5 (features/kampung-quest-improvements/prayer.md).
//   4. A Pray action is always available inside the mosque: the due / owed prayer when there is one,
//      otherwise a voluntary "Sunat prayer (2 raka'at)" through the same wudu + posture flow that
//      never touches the prayer tracker.
//   5. The azan follows the GAME clock: it goes live on the step that crosses a prayer's start time,
//      through time skips, rest, save / load and setMinute, and the HUD countdown is game minutes,
//      whatever the wall clock (Date.now) says.
//
// Run: npx playwright test tests/kampung-quest-prayer.spec.mjs
// Opened with `?still=1` (time moves only through __kq.step) like the acceptance spec.
import { test, expect } from "@playwright/test";

const GAME = "/games/kampung-quest/index.html";
const kq = (page, fn, arg) => page.evaluate(fn, arg);
const state = (page) => kq(page, () => window.__kq.state());
const step = (page, ms) => kq(page, (t) => window.__kq.step(t), ms);

function watchProblems(page) {
  const problems = [];
  page.on("pageerror", (e) => problems.push("pageerror: " + e.message));
  page.on("console", (m) => m.type() === "error" && problems.push("console: " + m.text()));
  return problems;
}

async function load(page) {
  await page.goto(GAME + "?still=1&autoq=0&q=low");
  await expect.poll(() => kq(page, () => window.__kq?.loaded), { timeout: 90_000 }).toBe(true);
}

async function start(page) {
  await page.locator("#kq button.primary").first().click();
  await expect.poll(() => kq(page, () => window.__kq.ready), { timeout: 30_000 }).toBe(true);
  await step(page, 300);
}

async function open(page) {
  await load(page);
  await start(page);
}

/**
 * Record every azan start with the GAME minute it happened at and the prayer it was for, and make
 * the wall clock useless (Date.now returns nonsense), so a pass proves the game clock drives it.
 */
function instrument() {
  const G = window.KQ.Game;
  window.__azan = { starts: [] };
  if (!G.Audio.__wrapped) {
    const real = G.Audio.startAzan;
    G.Audio.startAzan = function () {
      window.__azan.starts.push({
        name: G.PrayerFlow.state.name,
        minute: G.S.sim.clock.minute,
      });
      return real.apply(this, arguments);
    };
    G.Audio.__wrapped = true;
  }
  Date.now = () => 4102444800000 + Math.floor(Math.random() * 1e9);
}

const azans = (page) => kq(page, () => window.__azan.starts);
const nextNote = (page) => page.locator(".kq-nextp").textContent();

/** Take wudu with real clicks until the flow reaches the prayer phase. */
async function doWudu(page) {
  await expect(page.getByRole("dialog", { name: "Wudu steps" })).toBeVisible();
  for (let i = 0; i < 60 && (await state(page)).prayer.flow?.phase === "wudu"; i += 1) {
    await page.locator(".kq-wudu-act").click();
  }
  expect((await state(page)).prayer.flow.phase).toBe("pray");
}

/** Tap every posture the sim asks for until the flow finishes; returns how many taps it took. */
async function prayAllSteps(page) {
  let taps = 0;
  while (taps < 60 && (await state(page)).prayer.flow?.phase === "pray") {
    const type = await kq(page, () => window.KQ.Game.S.sim.prayer.nextPrayStep().type);
    await page.locator(`.kq-ptile[data-type="${type}"]`).click();
    taps += 1;
  }
  return taps;
}

/** The five-prayer strip as "name:status" so a sunat prayer can be shown to leave it untouched. */
const strip = (st) => st.prayer.prayers.map((p) => p.name + ":" + p.status).join(",");

/* ---------- 4. Pray is always available in the mosque ---------- */

/** Inside the hall but far from the prayer spot the prompt is still there; outside it is not. */
async function checkPromptZone(page) {
  await kq(page, () => window.__kq.place(-36, -40, -Math.PI / 2));
  await step(page, 400);
  const far = (await state(page)).target;
  expect(far, "a prompt inside the hall").toMatchObject({ id: "prayer_spot", enabled: true });
  expect(far.label).toBe("Sunat prayer");
  await expect(page.locator(".kq-talk")).toHaveAttribute("aria-label", "Sunat prayer (2 raka'at)");
  await kq(page, () => window.__kq.place(-20, -15, 0));
  await step(page, 400);
  expect((await state(page)).target?.id ?? null).not.toBe("prayer_spot");
}

/** Pressing Pray before wudu gives a kind hint, starts no flow and leads to the taps. */
async function checkNeedsWuduFirst(page) {
  await kq(page, () => window.__kq.place(-36, -40, -Math.PI / 2));
  await step(page, 400);
  await page.keyboard.press("e");
  await step(page, 300);
  const st = await state(page);
  expect(st.prayer.flow, "no flow until wudu begins").toBeNull();
  expect(st.ui.guideDest).toBe("mosque_wudu");
}

/** Praise card of a finished sunat prayer: no coins; closing it releases the hero. */
async function closeSunatCard(page) {
  const card = page.getByRole("dialog", { name: /You prayed a sunat prayer/ });
  await expect(card).toBeVisible();
  await expect(card).not.toContainText(/coin/i);
  await card.getByRole("button", { name: "Alhamdulillah" }).click();
}

/** The first sunat prayer, end to end through the UI: wudu at the taps, then 2 raka'at in the hall. */
async function prayFirstSunat(page) {
  await kq(page, () => window.__kq.teleport("mosque_wudu"));
  await page.keyboard.press("e");
  await doWudu(page);
  expect((await state(page)).prayer.flow).toMatchObject({ name: "sunat", kind: "sunat" });
  await kq(page, () => window.__kq.teleport("mosque_hall"));
  await step(page, 300);
  expect((await state(page)).target.label).toBe("Sunat prayer");
  await page.keyboard.press("e");
  const panel = page.getByRole("dialog", { name: "Prayer steps" });
  await expect(panel).toBeVisible();
  await expect(panel).toContainText("Sunat prayer · raka'at 1 of 2");
  expect(await prayAllSteps(page)).toBe(16); // takbir + 2 x (6 postures) + tasyahud + 2 salam
  await closeSunatCard(page);
}

/** A second sunat from the middle of the hall: the wudu is still clean, so the steps open at once. */
async function praySecondSunat(page) {
  await kq(page, () => window.__kq.place(-36, -40, -Math.PI / 2));
  await step(page, 400);
  await page.keyboard.press("e");
  await expect(page.getByRole("dialog", { name: "Prayer steps" })).toBeVisible();
  expect(await prayAllSteps(page)).toBe(16);
  await closeSunatCard(page);
}

async function checkSunatEndToEnd(page) {
  await open(page);
  const before = await state(page);
  expect(before.hhmm).toBe("07:00");
  expect(before.prayer.due, "nothing is due at 07:00").toBeNull();
  await checkPromptZone(page);
  await checkNeedsWuduFirst(page);
  await prayFirstSunat(page);
  const after = await state(page);
  expect(after.prayer.flow).toBeNull();
  expect(strip(after), "no fard prayer was marked").toBe(strip(before));
  expect(after.prayer.qada).toEqual([]);
  expect(after.stickers, "no prayer star for a sunat prayer").toEqual(before.stickers);
  expect(after.coins).toBe(before.coins);
  await praySecondSunat(page);
  expect(strip(await state(page))).toBe(strip(before));
}

async function checkFardWins(page) {
  await open(page);
  await kq(page, () => window.__kq.forcePrayer("zohor"));
  await kq(page, () => window.__kq.place(-36, -40, -Math.PI / 2));
  await step(page, 400);
  expect((await state(page)).target).toMatchObject({ id: "prayer_spot", label: "Pray" });
  await kq(page, () => window.__kq.teleport("mosque_wudu"));
  await page.keyboard.press("e");
  await doWudu(page);
  expect((await state(page)).prayer.flow).toMatchObject({ name: "zohor", kind: "due" });
  const sunat = await kq(page, () => window.KQ.Game.S.sim.prayer.startFlow("sunat").ok);
  expect(sunat, "the sim refuses a sunat flow over a running Zohor").toBe(false);
}

/** Wudu done for a sunat prayer, the hero left standing at the taps: a flow with no screen open. */
async function startIdleSunat(page) {
  await kq(page, () => window.__kq.teleport("mosque_wudu"));
  await page.keyboard.press("e");
  await doWudu(page);
  await expect(page.getByRole("dialog", { name: "Wudu steps" })).toBeHidden();
  const st = await state(page);
  expect(st.prayer.flow).toMatchObject({ name: "sunat", phase: "pray" });
  await step(page, 300); // the HUD refreshes every 120 ms of frames
  expect(await nextNote(page), "calm wording, not 'Praying'").toBe("Sunat prayer");
  return st;
}

async function checkStrayDropped(page) {
  await open(page);
  await startIdleSunat(page);
  await kq(page, () => window.__kq.place(30, 30, 0));
  await step(page, 2500);
  const st = await state(page);
  expect(st.prayer.flow, "the optional prayer was dropped").toBeNull();
  expect(st.prayer.wuduClean, "and the wudu is still clean").toBe(true);
}

/** "Not now" on either sunat screen ends the optional prayer: no prayer mode left behind. */
async function checkNotNowEndsSunat(page) {
  await open(page);
  await kq(page, () => window.__kq.teleport("mosque_wudu"));
  await page.keyboard.press("e");
  await expect(page.getByRole("dialog", { name: "Wudu steps" })).toBeVisible();
  expect((await state(page)).prayer.flow?.name).toBe("sunat");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Wudu steps" })).toBeHidden();
  expect((await state(page)).prayer.flow, "Escape on the wudu screen ends it").toBeNull();
  await step(page, 300);
  expect(await nextNote(page)).not.toMatch(/Sunat|Praying/);
  await startIdleSunat(page);
  await kq(page, () => window.__kq.teleport("mosque_hall"));
  await step(page, 300);
  await page.keyboard.press("e");
  const panel = page.getByRole("dialog", { name: "Prayer steps" });
  await expect(panel).toBeVisible();
  await panel.getByRole("button", { name: "Not now" }).click();
  await expect(panel).toBeHidden();
  const st = await state(page);
  expect(st.prayer.flow, "Not now on the prayer screen ends it").toBeNull();
  expect(st.prayer.wuduClean).toBe(true);
  await step(page, 300);
  await expect(page.locator(".kq-dock-btn.is-due")).toHaveCount(0);
}

/** HIGH-1: a fard prayer falling due always takes over an idle sunat flow (azan, HUD, Pray). */
async function checkFardTakesOverIdleSunat(page) {
  await open(page);
  await kq(page, instrument);
  await startIdleSunat(page);
  await kq(page, () => window.__kq.forcePrayer("zohor"));
  await step(page, 300);
  const st = await state(page);
  expect(st.prayer.due).toBe("zohor");
  expect(st.prayer.flow, "the idle sunat flow was dropped").toBeNull();
  expect(st.prayer.wuduClean, "the wudu carries across").toBe(true);
  expect(st.ui.azanCard, "the azan card is showing").toBe(true);
  expect((await azans(page)).map((x) => x.name)).toEqual(["zohor"]);
  await step(page, 300);
  expect(await nextNote(page)).toBe("Zohor time!");
  await kq(page, () => window.__kq.teleport("mosque_hall"));
  await step(page, 300);
  expect((await state(page)).target).toMatchObject({ id: "prayer_spot", label: "Pray" });
  await page.keyboard.press("e");
  await expect(page.getByRole("dialog", { name: "Prayer steps" })).toBeVisible();
  expect((await state(page)).prayer.flow).toMatchObject({ name: "zohor", kind: "due" });
  await step(page, 300);
  expect(await nextNote(page)).toBe("Praying Zohor");
}

/** Defence in depth: even if a sunat flow is still open when a prayer is due, Pray starts the fard one. */
async function checkHallStartsFardOverSunat(page) {
  await open(page);
  await startIdleSunat(page);
  await kq(page, () => {
    const pf = window.KQ.Game.PrayerFlow;
    const real = pf.onEvents;
    pf.onEvents = () => {}; // as if the due event had been missed: the sim says due, the flow is still sunat
    window.__kq.setMinute(775);
    pf.onEvents = real;
  });
  const st = await state(page);
  expect(st.prayer).toMatchObject({ due: "zohor", flow: { name: "sunat" } });
  await step(page, 300);
  expect(await nextNote(page), "the HUD names the due prayer, not Sunat").toBe("Zohor time!");
  await kq(page, () => window.__kq.teleport("mosque_hall"));
  await step(page, 300);
  expect((await state(page)).target.label).toBe("Pray");
  await page.keyboard.press("e");
  await expect(page.getByRole("dialog", { name: "Prayer steps" })).toBeVisible();
  expect((await state(page)).prayer.flow).toMatchObject({ name: "zohor", kind: "due" });
}

test.describe("4. Pray is always available in the mosque", () => {
  test.describe.configure({ timeout: 180_000 });
  test("at a non-prayer minute the hall offers a 2-raka'at sunat prayer; the tracker is untouched", async ({
    page,
  }) => {
    const problems = watchProblems(page);
    await checkSunatEndToEnd(page);
    expect(problems).toEqual([]);
  });
  test("when a prayer is due the same prompt is the fard prayer, and sunat never replaces it", async ({
    page,
  }) => {
    const problems = watchProblems(page);
    await checkFardWins(page);
    expect(problems).toEqual([]);
  });
  test("a sunat prayer the hero walks away from is let go, and the wudu stays clean", async ({
    page,
  }) => checkStrayDropped(page));
  test("Not now on a sunat screen ends the optional prayer", async ({ page }) =>
    checkNotNowEndsSunat(page));
  test("a fard prayer falling due takes over an idle sunat flow: azan, HUD and Pray", async ({
    page,
  }) => checkFardTakesOverIdleSunat(page));
  test("the hall's Pray starts the due fard prayer even over a still-open sunat flow", async ({
    page,
  }) => checkHallStartsFardOverSunat(page));
});

/* ---------- 5. the azan and the HUD follow the game clock ---------- */

async function checkAsarOnTheStep(page) {
  await open(page);
  await kq(page, () => window.__kq.setMinute(976.5)); // Asar starts at 16:17 = minute 977
  await kq(page, instrument);
  await step(page, 400); // +0.2 game minutes: still 16:16
  expect((await state(page)).minute).toBeLessThan(977);
  expect(await azans(page), "not yet: the clock has not reached Asar").toEqual([]);
  await step(page, 2000); // +1 game minute
  const st = await state(page);
  expect(st.prayer.due).toBe("asar");
  expect(st.ui.azanCard).toBe(true);
  const starts = await azans(page);
  expect(starts.map((s) => s.name)).toEqual(["asar"]);
  expect(starts[0].minute, "the azan began on the step that crossed 977").toBeGreaterThanOrEqual(
    977,
  );
  expect(starts[0].minute).toBeLessThan(977.1);
}

async function checkSkipOneAzan(page) {
  await open(page);
  await kq(page, instrument);
  await kq(page, () => window.__kq.setMinute(1200)); // 07:00 -> 20:00 crosses Zohor, Asar, Maghrib
  await step(page, 200);
  const st = await state(page);
  expect(st.prayer.due).toBe("maghrib");
  expect(st.prayer.qada.map((q) => q.name)).toEqual(["zohor", "asar"]);
  const names = (await azans(page)).map((s) => s.name);
  expect(names, "one azan, no replays for the closed windows").toEqual(["maghrib"]);
}

async function checkRestStopsAtStart(page) {
  await open(page);
  await kq(page, () => window.__kq.setMinute(765)); // 12:45; Zohor is 12:54
  await kq(page, instrument);
  const slept = await kq(page, () => window.KQ.Game.Loop.advanceMinutes(30, true));
  const st = await state(page);
  expect(slept, "rest stopped when Zohor fell due, not 30 minutes later").toBeLessThanOrEqual(10);
  expect(st.minute).toBeGreaterThanOrEqual(774);
  expect(st.minute).toBeLessThan(775.2);
  const starts = await azans(page);
  expect(starts.map((s) => s.name)).toEqual(["zohor"]);
  expect(starts[0].minute).toBeGreaterThanOrEqual(774);
}

async function checkSaveLoadAzan(page) {
  await open(page);
  await kq(page, () => window.__kq.setMinute(773.4)); // Zohor 12:54 = 774
  await kq(page, () => window.KQ.Game.Loop.save());
  await load(page);
  await start(page);
  await kq(page, instrument);
  const before = await state(page);
  expect(Math.abs(before.minute - 773.4)).toBeLessThan(0.5);
  expect(before.minute).toBeLessThan(774);
  expect(await azans(page)).toEqual([]);
  await step(page, 1800);
  expect((await state(page)).prayer.due).toBe("zohor");
  const starts = await azans(page);
  expect(starts.map((s) => s.name)).toEqual(["zohor"]);
  expect(starts[0].minute).toBeGreaterThanOrEqual(774);
}

async function checkCountdown(page) {
  await open(page);
  await kq(page, instrument);
  await kq(page, () => window.__kq.setMinute(750)); // 12:30: Zohor (12:54) in 24 game minutes
  await step(page, 300);
  const first = await nextNote(page);
  expect(first).toMatch(/^Zohor in 2[34] min$/);
  await step(page, 2000); // 2 real seconds = 1 game minute
  const n2 = Number((await nextNote(page)).match(/\d+/)[0]);
  expect(Number(first.match(/\d+/)[0]) - n2, "one game minute passed").toBe(1);
  await kq(page, () => window.__kq.setMinute(700)); // 11:40: Zohor is over an hour away
  await step(page, 300);
  expect(await nextNote(page)).toBe("Next: Zohor 12:54");
}

test.describe("5. the azan and the HUD follow the game clock", () => {
  test.describe.configure({ timeout: 240_000 });
  test("setMinute just before Asar, then step: the azan goes live on the step that crosses 16:17", async ({
    page,
  }) => {
    const problems = watchProblems(page);
    await checkAsarOnTheStep(page);
    expect(problems).toEqual([]);
  });
  test("a skip across several prayers starts ONE azan, for the prayer that is actually due", ({
    page,
  }) => checkSkipOneAzan(page));
  test("resting (a 30 minute skip) stops at the start time and the azan sounds there", ({ page }) =>
    checkRestStopsAtStart(page));
  test("save and reload just before a start: the azan still comes on time, from the saved game clock", ({
    page,
  }) => checkSaveLoadAzan(page));
  test("the next-prayer note counts down in game minutes", ({ page }) => checkCountdown(page));
});
