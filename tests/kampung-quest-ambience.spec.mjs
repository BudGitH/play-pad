// Kampung Quest ambience probe (features/kampung-quest-improvements/ambience.md): the synthesised
// neighbourhood atmosphere starts after Start, follows the clock and the hero's place, stops when
// muted / paused / hidden, and is silent under the azan and during a prayer flow (business rule 1:
// no music, nothing under the azan). Reads the counters of `Audio.debug()` (`ambience` block:
// `level` = the model, `gain` = the real AudioParam, `events` = scheduled one-offs, `quiet` = why
// it is ducked) and the pure `Ambience.mix(minute, x, z)`.
//
// Run: npx playwright test tests/kampung-quest-ambience.spec.mjs --project=kampung-quest
// The page opens with `?still=1` (time moves only through __kq.step); one-off events are spaced in
// real audio time, so the tests alternate a game step with `expect.poll` rounds (no fixed sleeps).
import { test, expect } from "@playwright/test";

const GAME = "/games/kampung-quest/index.html?still=1&autoq=0&q=low";
const kq = (page, fn, arg) => page.evaluate(fn, arg);
const audio = (page) => kq(page, () => window.KQ.Game.Audio.debug());
const step = (page, ms) => kq(page, (t) => window.__kq.step(t), ms);
const mix = (page, args) => kq(page, ([m, x, z]) => window.KQ.Game.Ambience.mix(m, x, z), args);

/**
 * Step the game until `done(audio)` holds. One-off events are spaced in real audio time, so each
 * poll round is one game step; expect.poll supplies the retries (no fixed sleeps). Returns false
 * when it never held, so callers state what was expected.
 */
async function stepUntil(page, done, timeout = 20_000) {
  try {
    await expect
      .poll(
        async () => {
          await step(page, 6000);
          return done(await audio(page));
        },
        { timeout, intervals: [250] },
      )
      .toBe(true);
    return true;
  } catch {
    return false;
  }
}

/** Let `ms` of real time pass (events are spaced in real time), as a poll on the page clock. */
async function elapse(page, ms) {
  const t0 = await kq(page, () => performance.now());
  await expect
    .poll(() => kq(page, () => performance.now()), { intervals: [50] })
    .toBeGreaterThan(t0 + ms);
}

/** Fake the tab being hidden or shown, as AC-16 does. */
const setHidden = (page, v) =>
  kq(
    page,
    (hidden) => {
      Object.defineProperty(document, "hidden", { configurable: true, get: () => hidden });
      document.dispatchEvent(new Event("visibilitychange"));
    },
    v,
  );

test.describe.configure({ mode: "serial" });

let page;
test.beforeAll(async ({ browser }) => {
  test.setTimeout(150_000);
  page = await browser.newPage();
  await page.goto(GAME);
  await expect.poll(() => kq(page, () => window.__kq?.loaded), { timeout: 90_000 }).toBe(true);
  await page.locator("#kq button.primary").first().click();
  await expect.poll(() => kq(page, () => window.__kq.ready), { timeout: 30_000 }).toBe(true);
});
test.afterAll(async () => page?.close());

test("AMB-1 ambience starts after Start: beds wired, bus fades up, birds sing by day", async () => {
  await step(page, 6000);
  await expect.poll(async () => (await audio(page)).ambience.on).toBe(true);
  const ok = await stepUntil(page, (a) => a.ambience.birds > 0);
  expect(ok, "a bird phrase was scheduled").toBe(true);
  const a = await audio(page);
  expect(a.ctx).toBe("running");
  expect(a.ambience.quiet).toBe("");
  expect(a.ambience.level, "faded up").toBeGreaterThan(0.5);
  expect(a.ambience.beds).toEqual(expect.arrayContaining(["traffic", "wind"]));
  expect(a.ambient, "events are counted apart from the UI sounds").toBe(a.ambience.events);
  await expect.poll(async () => (await audio(page)).ambience.gain).toBeGreaterThan(0.4);
});

test("AMB-2 the mix follows the clock: birds by day, crickets from Maghrib to Subuh", async () => {
  const home = [-40, 22];
  const noon = await mix(page, [10 * 60, ...home]);
  expect(noon.birds).toBeGreaterThan(0.6);
  expect(noon.crickets).toBe(0);
  const dusk = await mix(page, [19 * 60 + 30, ...home]); // Maghrib is 18:54
  expect(dusk.crickets).toBeGreaterThan(0.6);
  expect(dusk.birds).toBe(0);
  const late = await mix(page, [2 * 60, ...home]);
  expect(late.crickets).toBeGreaterThan(0.6);
  expect(late.birds).toBe(0);
  expect(late.traffic, "quieter road at night").toBeLessThan(noon.traffic);
  const dawn = await mix(page, [6 * 60 + 30, ...home]); // after Subuh (05:29), before Syuruk
  expect(dawn.crickets).toBe(0);
  expect(dawn.birds).toBeGreaterThan(0);
});

test("AMB-3 the mix follows the hero: hawker murmur near it, a muffled mosque hall", async () => {
  const noon = 12 * 60;
  const hawker = await mix(page, [noon, 26, -19]);
  const far = await mix(page, [noon, -40, 22]);
  expect(hawker.murmur).toBeGreaterThan(0.8);
  expect(far.murmur).toBe(0);
  expect((await mix(page, [23.5 * 60, 26, -19])).murmur, "hawker is shut late").toBeLessThan(0.2);
  const hall = await mix(page, [noon, -45, -33]);
  expect(hall.indoor).toBe(1);
  expect(hall.master).toBeLessThan(0.6);
  expect(hall.surface).toBe("carpet");
  expect((await mix(page, [noon, 50, 20])).surface).toBe("grass");
  // live: the murmur bed is wired and clinks sound when standing at the hawker centre
  await kq(page, () => window.__kq.teleport("hawker"));
  expect(await stepUntil(page, (a) => a.ambience.clinks > 0)).toBe(true);
  expect((await audio(page)).ambience.beds).toContain("murmur");
  await kq(page, () => window.__kq.teleport("mosque_hall"));
  await step(page, 1000);
  expect((await audio(page)).surface).toBe("carpet");
  await kq(page, () => window.__kq.teleport("home"));
  await step(page, 1000);
  expect((await audio(page)).surface).toBe("paving");
});

test("AMB-4 muted, paused and hidden each stop it, and it comes back", async () => {
  test.setTimeout(150_000);
  const ambient = async () => (await audio(page)).ambient;
  const frozen = async (why) => {
    const n = await ambient();
    await step(page, 12_000);
    await elapse(page, 400);
    await step(page, 12_000);
    expect(await ambient(), why + ": no event scheduled").toBe(n);
  };
  const resumes = async (why) => {
    const n = await ambient();
    expect(await stepUntil(page, (a) => a.ambient > n), why + ": events resume").toBe(true);
  };
  await kq(page, () => window.KQ.Game.Audio.setMuted(true));
  await expect.poll(async () => (await audio(page)).ctx).toBe("suspended");
  await frozen("muted");
  await kq(page, () => window.KQ.Game.Audio.setMuted(false));
  await resumes("unmuted");
  await kq(page, () => window.KQ.Game.Loop.setPaused(true));
  await expect.poll(async () => (await audio(page)).ctx).toBe("suspended");
  await frozen("paused");
  await kq(page, () => window.KQ.Game.Loop.setPaused(false));
  await resumes("resumed");
  await setHidden(page, true);
  await expect.poll(async () => (await audio(page)).ctx).toBe("suspended");
  await frozen("hidden");
  await setHidden(page, false);
  await resumes("shown");
  // the pause-menu switch silences the whole bed without touching the UI sounds
  await kq(page, () => (window.KQ.Game.Settings.prefs.ambience = false));
  await step(page, 3000);
  expect((await audio(page)).ambience.quiet).toBe("off");
  await expect.poll(async () => (await audio(page)).ambience.gain).toBeLessThan(0.01);
  await kq(page, () => (window.KQ.Game.Settings.prefs.ambience = true));
});

test("AMB-5 nothing under the azan: the bed ducks to zero, no events, back afterwards", async () => {
  test.setTimeout(150_000);
  await step(page, 15_000); // fully faded in after AMB-4
  expect((await audio(page)).ambience.level).toBeGreaterThan(0.5);
  await kq(page, () => window.__kq.forcePrayer("zohor")); // starts the azan
  await step(page, 1500);
  let a = await audio(page);
  expect(a.azanActive || a.azanFailed, "the azan is live (or chimed)").toBe(true);
  expect(a.ambience.quiet).toBe("azan");
  expect(a.ambience.level).toBeLessThan(0.001);
  await expect.poll(async () => (await audio(page)).ambience.gain).toBeLessThan(0.005);
  const events = a.ambience.events;
  for (let i = 0; i < 4; i += 1) {
    await step(page, 4000);
    await elapse(page, 300);
    a = await audio(page);
    if (a.ambience.quiet !== "azan") break;
    expect(a.ambience.events, "no ambient event while the azan is live").toBe(events);
    expect(a.ambience.gain).toBeLessThan(0.005);
  }
});

test("AMB-6 nothing during a prayer flow, and it fades back in after", async () => {
  test.setTimeout(150_000);
  await kq(page, () => {
    window.__kq.setMinute(10 * 60); // a rewind rebuilds the tracker: no prayer pending
    window.KQ.Game.Audio.stopAzan(); // the recording would take real minutes to end
  });
  await step(page, 6000);
  await expect.poll(async () => (await audio(page)).ambience.quiet).toBe("");
  await kq(page, () => {
    window.__kq.forcePrayer("zohor");
    window.KQ.Game.PrayerFlow.atTaps(); // starts the flow and ends the azan
  });
  expect(await kq(page, () => Boolean(window.KQ.Game.S.sim.prayer.state().flow))).toBe(true);
  await step(page, 2000);
  const a = await audio(page);
  expect(a.ambience.quiet).toBe("prayer");
  expect(a.ambience.level).toBeLessThan(0.001);
  await step(page, 12_000);
  expect((await audio(page)).ambience.events, "no event during the flow").toBe(a.ambience.events);
  await expect.poll(async () => (await audio(page)).ambience.gain).toBeLessThan(0.005);
  // "Not now": closes the wudu screen and the flow is put back; the screen alone kept it quiet
  await kq(page, () => window.KQ.Game.UI.closeSheet("button"));
  await kq(page, () => window.KQ.Game.S.sim.prayer.cancelFlow());
  await step(page, 2000);
  expect((await audio(page)).ambience.level, "held for a moment after the flow").toBe(0);
  await step(page, 20_000);
  const back = await audio(page);
  expect(back.ambience.quiet).toBe("");
  expect(back.ambience.level, "faded back in").toBeGreaterThan(0.5);
});

test("AMB-7 footsteps: walk, run, land and jump all sound, and are gated like every sound", async () => {
  await kq(page, () => window.KQ.Game.Audio.setMuted(false));
  const tryStep = (kind) =>
    kq(
      page,
      (k) => new Promise((r) => setTimeout(() => r(window.KQ.Game.Audio.footstep(k)), 150)),
      kind,
    );
  for (const kind of ["walk", "run", true, false, "land", "jump"]) {
    expect(await tryStep(kind), "footstep " + kind).toBe(true);
  }
  expect(
    await kq(
      page,
      () => window.KQ.Game.Audio.footstep("walk") || window.KQ.Game.Audio.footstep("walk"),
    ),
    "a double call is one step",
  ).toBe(true);
  await kq(page, () => window.KQ.Game.Audio.setMuted(true));
  expect(await tryStep("walk")).toBe(false);
  await kq(page, () => window.KQ.Game.Audio.setMuted(false));
});
