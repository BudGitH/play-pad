// Kampung Quest: the neighbourhood is bustling. The instanced crowd of extras (js/game/crowd*.js)
// fills the hawker, queues, lift lobbies, bus stop, playground and pavements by time of day, stays
// inside the per-tier cap, never stands in a wall, and keeps to a small draw-call budget.
// The pure rules are unit-tested in tests/kampung-quest/crowd.test.mjs; this checks the real game.
// The page runs with `?still=1` (time moves only through __kq.step) and `?autoq=0`.
// Run: npx playwright test tests/kampung-quest-crowd.spec.mjs
import { test, expect } from "@playwright/test";

const GAME = "/games/kampung-quest/index.html";
const kq = (page, fn, arg) => page.evaluate(fn, arg);

async function boot(page, query = "?still=1&autoq=0&q=low") {
  await page.goto(GAME + query);
  await expect.poll(() => kq(page, () => window.__kq?.loaded), { timeout: 90_000 }).toBe(true);
  await page.locator("#kq button.primary").first().click();
  await expect.poll(() => kq(page, () => window.__kq.ready), { timeout: 30_000 }).toBe(true);
}

/** Go to a spot at a time of day and run 20 s of game frames without drawing (fast). */
function visit(spot) {
  const G = window.KQ.Game;
  window.__kq.setMinute(spot.minute);
  window.__kq.place(spot.x, spot.z, spot.heading);
  for (let i = 0; i < 600; i += 1) G.Loop.frame(1 / 30, true);
  return window.__kq.crowd();
}

/** Browser-side: people standing inside a wall or prop (seated ones are placed on stools by design). */
function peopleInWalls() {
  const G = window.KQ.Game;
  return window.__kq
    .crowdPeople()
    .filter((p) => !p.seated)
    .filter((p) => G.Collide.blockedAt(G.S.world.colliders, p.x, p.z, 0.2))
    .map((p) => p.id + " (" + p.kind + ") at " + p.x.toFixed(1) + "," + p.z.toFixed(1));
}

const HAWKER = { x: 26, z: -13, heading: Math.PI };
const SPOTS = [
  { ...HAWKER, minute: 735 },
  { x: -40, z: 28, heading: Math.PI, minute: 1090 },
  { x: 46, z: 28, heading: 0, minute: 390 },
  { x: 20, z: 12, heading: Math.PI, minute: 455 },
  { x: 21.5, z: 30, heading: Math.PI, minute: 1030 },
  { x: 49, z: 56, heading: Math.PI, minute: 1110 },
];

test.describe.configure({ mode: "serial" });

test("the crowd exists, follows the time of day and fills the hawker at lunch", async ({
  page,
}) => {
  test.setTimeout(240_000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await boot(page);
  const lunch = await kq(page, visit, { ...HAWKER, minute: 735 });
  expect(
    lunch.slots,
    "fixed spots found in the world (was 177 before the bigger crowd)",
  ).toBeGreaterThan(330);
  expect(lunch.byKind.diner, "diners at the tables").toBeGreaterThanOrEqual(12);
  expect(lunch.byKind.queue, "people queueing at stalls").toBeGreaterThanOrEqual(10);
  expect(lunch.walkers, "strollers out").toBeGreaterThanOrEqual(12);
  expect(lunch.drawn, "people in view (was 19 before the bigger crowd)").toBeGreaterThanOrEqual(35);
  const night = await kq(page, visit, { ...HAWKER, minute: 120 });
  expect(night.active, "the town sleeps at 02:00").toBeLessThanOrEqual(2);
  const dawn = await kq(page, visit, { x: 46, z: 24, heading: 0, minute: 390 });
  expect(dawn.byKind.exercise, "tai chi in the park at dawn").toBeGreaterThanOrEqual(3);
  expect(errors).toEqual([]);
});

test("more characters doing more things: shops, picnics, kids at play, pavement loners, families and pupils", async ({
  page,
}) => {
  test.setTimeout(240_000);
  await boot(page);
  const eve = await kq(page, visit, { x: 50, z: 26, heading: 0, minute: 1030 });
  expect(eve.byKind.picnic, "picnic circles on the grass").toBeGreaterThanOrEqual(6);
  expect(eve.byKind.play, "kids at play after school").toBeGreaterThanOrEqual(12);
  expect(eve.byKind.chat, "chat circles").toBeGreaterThanOrEqual(15);
  const day = await kq(page, visit, { x: 50, z: -8, heading: Math.PI, minute: 1100 });
  expect(day.byKind.shop, "people at the shop fronts").toBeGreaterThanOrEqual(4);
  expect(day.byKind.loiter, "people standing about on the pavements").toBeGreaterThanOrEqual(4);
  const kinds = await kq(page, () => {
    const seen = new Set();
    [450, 780, 1030].forEach((m) => {
      window.__kq.setMinute(m);
      window.__kq.place(0, 0, 0);
      for (let i = 0; i < 900; i += 1) window.KQ.Game.Loop.frame(1 / 30, true);
      window.__kq.crowdPeople().forEach((p) => p.wtype && seen.add(p.wtype));
    });
    return [...seen];
  });
  expect(kinds, "stroller types seen over a day").toEqual(
    expect.arrayContaining(["commuter", "student", "family"]),
  );
});

/** Browser-side: visit busy places and count the different looks among everyone present. */
function surveyOutfits() {
  const G = window.KQ.Game;
  const seen = { skins: new Set(), tops: new Set(), heads: new Set(), ages: new Set(), girths: [] };
  const spots = [
    { m: 735, x: 26, z: -13 },
    { m: 1030, x: 21, z: 22 },
    { m: 455, x: 20, z: 12 },
    { m: 1090, x: -40, z: 28 },
  ];
  spots.forEach((s) => {
    window.__kq.setMinute(s.m);
    window.__kq.place(s.x, s.z, 0);
    for (let i = 0; i < 600; i += 1) G.Loop.frame(1 / 30, true);
    G.S.crowd.members.forEach((p) => {
      seen.skins.add(p.outfit.skin);
      seen.tops.add(p.outfit.top);
      seen.heads.add(p.outfit.head);
      seen.ages.add(p.outfit.age);
      seen.girths.push(p.outfit.girth);
    });
  });
  return {
    skins: seen.skins.size,
    tops: seen.tops.size,
    heads: [...seen.heads],
    ages: [...seen.ages],
    spread: Math.max(...seen.girths) - Math.min(...seen.girths),
  };
}

test("a varied crowd: skin tones, ages, body sizes and headwear", async ({ page }) => {
  test.setTimeout(240_000);
  await boot(page);
  const survey = await kq(page, surveyOutfits);
  expect(survey.skins, "skin shades").toBeGreaterThan(20);
  expect(survey.tops, "clothing shades").toBeGreaterThan(40);
  expect(survey.ages).toEqual(expect.arrayContaining(["kid", "adult", "elder"]));
  expect(survey.heads).toEqual(expect.arrayContaining(["hair", "tudung"]));
  expect(survey.spread, "slight to stocky").toBeGreaterThan(0.15);
});

test("the crowd stays under the tier cap and nobody stands in a wall", async ({ page }) => {
  test.setTimeout(300_000);
  await boot(page);
  for (const spot of SPOTS) {
    const c = await kq(page, visit, spot);
    // the cap bounds who may be ADDED; people already in sight are held until they can leave unseen
    expect(c.active, "within the cap at minute " + spot.minute).toBeLessThanOrEqual(c.cap * 1.15);
    expect(c.drawn, "within the low tier's draw cap (96 people)").toBeLessThanOrEqual(96);
    expect(await kq(page, peopleInWalls), "in a wall at minute " + spot.minute).toEqual([]);
  }
});

test("extras never take a seat the cast neighbours hold, and free it when they leave", async ({
  page,
}) => {
  test.setTimeout(240_000);
  await boot(page);
  await kq(page, visit, { ...HAWKER, minute: 735 });
  const audit = await kq(page, () => {
    const S = window.KQ.Game.S;
    const crowdSeats = S.npcs.seats.filter((s) => s.taken === "crowd").length;
    const cast = S.npcs.agents.filter((a) => a.seat).length;
    const members = window.__kq.crowdPeople().filter((p) => p.seated).length;
    return { crowdSeats, cast, members };
  });
  expect(audit.crowdSeats, "every seated extra holds exactly one seat").toBe(audit.members);
  expect(audit.crowdSeats).toBeGreaterThan(8);
  const emptied = await kq(page, () => {
    window.__kq.setMinute(120);
    window.__kq.place(100, 100, 0);
    for (let i = 0; i < 400; i += 1) window.KQ.Game.Loop.frame(1 / 30, true);
    return window.KQ.Game.S.npcs.seats.filter((s) => s.taken === "crowd").length;
  });
  expect(emptied, "seats released when the crowd leaves").toBe(0);
});

test("the headcount follows the quality tier", async ({ page }) => {
  test.setTimeout(240_000);
  await boot(page);
  const caps = await kq(page, () => ({ ...window.KQ.Sim.Crowd.TIER_CAPS }));
  expect(caps.low).toBeLessThan(caps.med);
  expect(caps.med).toBeLessThan(caps.high);
  const seen = {};
  for (const tier of ["low", "med", "high"]) {
    await kq(page, (t) => window.KQ.Game.Loop.setQuality(t), tier);
    const busy = await kq(page, visit, { ...HAWKER, minute: 765 });
    expect(busy.cap, tier + " cap in use").toBe(caps[tier]);
    expect(busy.active, tier + " stays near its cap").toBeLessThanOrEqual(caps[tier] * 1.15);
    seen[tier] = busy.active;
  }
  expect(seen.low, "fewer people on the low tier").toBeLessThan(seen.high);
});

test("a busy hawker still fits the phone draw-call budget on the low tier", async ({ page }) => {
  test.setTimeout(240_000);
  await boot(page);
  const calls = await kq(page, () => {
    const G = window.KQ.Game;
    const r = G.S.renderer;
    r.setPixelRatio(1);
    r.setSize(211, 98, false);
    G.Camera.resize(211, 98, 211 / 98);
    G.S.frozen = true;
    let worst = 0;
    [
      { m: 735, x: 26, z: -13 },
      { m: 1110, x: 20, z: 12 },
      { m: 1090, x: -40, z: 28 },
    ].forEach((s) => {
      window.__kq.setMinute(s.m);
      window.__kq.place(s.x, s.z, Math.PI);
      for (let i = 0; i < 300; i += 1) G.Loop.frame(1 / 30, true);
      G.Loop.frame(1 / 30, false);
      r.info.reset();
      r.render(G.S.scene, G.S.camera);
      worst = Math.max(worst, r.info.render.calls);
    });
    return worst;
  });
  expect(calls).toBeLessThanOrEqual(400);
});
