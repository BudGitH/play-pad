// Kampung Quest, Haramain region: the world (Makkah + Madinah scenery), the pilgrim crowd, the region
// picker, the per-region save slot, the travel helpers and the kampung default staying as it was.
// Pure rules: tests/kampung-quest/crowd-pilgrim.test.mjs. The page runs with `?still` (time moves only
// through __kq.step) and `?q=low`. Run: npx playwright test tests/kampung-quest-haramain-world.spec.mjs
import { test, expect } from "@playwright/test";
import { pathToFileURL } from "node:url";
import path from "node:path";

const GAME = "/games/kampung-quest/index.html";
const HOLY = GAME + "?region=haramain&still=1&autoq=0&q=low";
const kq = (page, fn, arg) => page.evaluate(fn, arg);

/** Collect console errors and uncaught exceptions (GL driver chatter is a warning, not an error). */
function watch(page) {
  const errors = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  return errors;
}

async function load(page, url) {
  await page.goto(url);
  await expect.poll(() => kq(page, () => window.__kq?.loaded), { timeout: 90_000 }).toBe(true);
}

async function start(page) {
  await page.locator("#kqStart").click();
  await expect.poll(() => kq(page, () => window.__kq.ready), { timeout: 30_000 }).toBe(true);
}

/** Browser-side: put the hero somewhere at a minute and run frames without drawing. */
function visit(spot) {
  const G = window.KQ.Game;
  window.__kq.setMinute(spot.minute);
  window.__kq.place(spot.x, spot.z, spot.yaw || 0);
  for (let i = 0; i < 300; i += 1) G.Loop.frame(1 / 30, true);
  return window.__kq.crowd();
}

/** Browser-side: angular progress of every tawaf walker over two seconds, seen from above (x east, z south). */
function tawafSense() {
  const before = window.__kq.crowdPeople().filter((p) => p.kind === "tawaf");
  window.KQ.Game.Loop.frame(2, true);
  const after = window.__kq.crowdPeople();
  let anticlockwise = 0;
  let clockwise = 0;
  before.forEach((p) => {
    const q = after.find((o) => o.id === p.id);
    if (!q) return;
    let d = Math.atan2(-q.z, q.x) - Math.atan2(-p.z, p.x);
    d = ((d + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    if (d > 0) anticlockwise += 1;
    else if (d < 0) clockwise += 1;
  });
  return { anticlockwise, clockwise };
}

/** One shared page for the world tests (booting the game takes a while): created on first use. */
let sharedPage = null;
let errors = [];
async function shared(browser) {
  if (sharedPage) return sharedPage;
  test.setTimeout(150_000);
  sharedPage = await browser.newPage({ viewport: { width: 960, height: 540 } });
  errors = watch(sharedPage);
  await load(sharedPage, HOLY);
  await start(sharedPage);
  return sharedPage;
}

test.afterAll(async () => {
  if (sharedPage) await sharedPage.close();
});

// The crowd survey runs 8 x 240 sim frames in one go (about 9 s here, over 30 s on a shared 2-core runner).
test.describe.configure({ mode: "serial", timeout: 120_000 });

test("AC-H1: loads with no console errors; Makkah, the Haram and the Prophet's Mosque all exist", async ({
  browser,
}) => {
  const page = await shared(browser);
  const h = await kq(page, () => window.__kq.holy());
  expect(h.region).toBe("haramain");
  expect(h.city).toBe("makkah");
  for (const site of ["haram", "makkah", "nabawi", "nabawiInside", "madinah"])
    expect(h.sites).toContain(site);
  expect(
    h.meshes.holyPalmTrunk &&
      h.meshes.holyPalmCrown &&
      h.meshes.holyUmbrellaTop &&
      h.meshes.holyHills1,
  ).toBe(true);
  expect(h.colliders).toBeGreaterThan(300);
  expect(h.batches).toBeGreaterThan(5);
  expect(h.prayerTimes).toBe("2026-11-27");
  const kaaba = await kq(
    page,
    () =>
      window.__kq.state &&
      window.KQ.Game.S.world.colliders.some(
        (c) => c.kind === "tower" && c.minX < -5 && c.maxX > 5 && c.minZ < -6 && c.maxZ > 6,
      ),
  );
  expect(kaaba).toBe(true);
  expect(errors).toEqual([]);
});

test("every stand spot, point of interest and walk-graph path is clear of colliders (nobody stands in a wall)", async ({
  browser,
}) => {
  const page = await shared(browser);
  const bad = await kq(page, () => {
    const G = window.KQ.Game;
    const w = G.S.world;
    const out = [];
    const blocked = (x, z, r) => G.Collide.blockedAt(w.colliders, x, z, r);
    Object.entries(window.KQ.Holy.STAND).forEach(
      ([k, s]) => blocked(s.x, s.z, 0.33) && out.push("stand " + k),
    );
    w.walkGraph.nodes.forEach((n) => blocked(n.x, n.z, 0.33) && out.push("node " + n.id));
    w.walkGraph.edges.forEach(([a, b]) => {
      const A = w.walkGraph.nodes[a];
      const B = w.walkGraph.nodes[b];
      const n = Math.ceil(Math.hypot(B.x - A.x, B.z - A.z) / 0.5);
      for (let i = 1; i < n; i += 1) {
        const t = i / n;
        if (blocked(A.x + (B.x - A.x) * t, A.z + (B.z - A.z) * t, 0.3))
          return out.push("edge " + a + "-" + b);
      }
    });
    return out;
  });
  expect(bad).toEqual([]);
});

test("AC-H2: tawaf walkers in ihram circle the Kaaba anticlockwise", async ({ browser }) => {
  const page = await shared(browser);
  const crowd = await kq(page, visit, { x: 0, z: -20, minute: 660 });
  expect(crowd.byKind.tawaf).toBeGreaterThan(10);
  const sense = await kq(page, tawafSense);
  expect(sense.anticlockwise).toBeGreaterThan(10);
  expect(sense.clockwise).toBe(0);
  const dress = await kq(page, () => {
    const members = window.KQ.Game.S.crowd.members.filter((m) => m.kind === "tawaf");
    const men = members.filter((m) => !m.outfit.female && !m.outfit.kid);
    return {
      men: men.length,
      ihram: men.filter(
        (m) => m.outfit.top === "#f6f4ee" && m.outfit.legs === "#f6f4ee" && !m.outfit.long,
      ).length,
      covered: members
        .filter((m) => m.outfit.female && !m.outfit.kid)
        .every((m) => m.outfit.long && ["tudung", "wrap"].includes(m.outfit.head)),
    };
  });
  expect(dress.men).toBeGreaterThan(3);
  expect(dress.ihram).toBe(dress.men);
  expect(dress.covered).toBe(true);
});

test("AC-H2: prayer rows face the qibla (the Kaaba in Makkah, south in Madinah) and move together", async ({
  browser,
}) => {
  const page = await shared(browser);
  await kq(page, visit, { x: -30, z: -36, minute: 735 });
  const haram = await kq(page, () => {
    const rows = window.KQ.Game.S.crowd.members.filter((m) => m.kind === "prayer");
    return {
      n: rows.length,
      facing: rows.every((m) => {
        const d = Math.hypot(m.x, m.z) || 1;
        return Math.sin(m.heading) * (-m.x / d) + Math.cos(m.heading) * (-m.z / d) > 0.98;
      }),
      poses: [...new Set(rows.map((m) => m.pose))],
    };
  });
  expect(haram.n).toBeGreaterThan(5);
  expect(haram.facing).toBe(true);
  expect(haram.poses.length).toBeLessThanOrEqual(2); // one posture, or two while the ripple passes a row
  await kq(page, visit, { x: 601, z: -8, minute: 735 });
  const nab = await kq(page, () => {
    const rows = window.KQ.Game.S.crowd.members.filter((m) => m.kind === "prayer");
    return {
      n: rows.length,
      south: rows.every((m) => Math.abs(m.heading) < 1e-6),
      city: window.__kq.holy().city,
    };
  });
  expect(nab.city).toBe("madinah");
  expect(nab.n).toBeGreaterThan(5);
  expect(nab.south).toBe(true);
});

test("AC-H2: Quran readers sit in Nabawi; the crowd stays inside its cap, out of walls, with few draw calls", async ({
  browser,
}) => {
  const page = await shared(browser);
  let crowd = null;
  for (const minute of [380, 1170]) {
    crowd = await kq(page, visit, { x: 601, z: -6, minute });
    if (crowd.byKind.read) break;
  }
  expect(crowd.byKind.read).toBeGreaterThan(0);
  const reading = await kq(page, () =>
    window.KQ.Game.S.crowd.members
      .filter((m) => m.kind === "read")
      .every((m) => m.pose === "quran"),
  );
  expect(reading).toBe(true);
  expect(crowd.active).toBeLessThanOrEqual(crowd.cap);
  const inWalls = await kq(page, () => {
    const G = window.KQ.Game;
    return window.__kq
      .crowdPeople()
      .filter((p) => G.Collide.blockedAt(G.S.world.colliders, p.x, p.z, 0.2))
      .map((p) => p.id + " " + p.kind + " " + p.x.toFixed(1) + "," + p.z.toFixed(1));
  });
  expect(inWalls).toEqual([]);
  const calls = await kq(page, () => {
    window.KQ.Game.Loop.frame(1 / 30, false);
    return window.__kq.stats().calls;
  });
  expect(calls).toBeLessThan(450);
});

/** Browser-side: visit several busy places and return everyone seen (by person id). */
function collectCrowd() {
  const G = window.KQ.Game;
  const seen = new Map();
  const spots = [
    [0, -20, 660],
    [42, -30, 660],
    [0, -85, 660],
    [-22, -14, 660],
    [-30, -40, 700],
    [600, -60, 660],
    [601, -8, 700],
    [20, -22, 900],
  ];
  spots.forEach(function (s) {
    window.__kq.setMinute(s[2]);
    window.__kq.place(s[0], s[1], 0);
    for (let i = 0; i < 240; i += 1) {
      G.Loop.frame(1 / 30, true);
      if (i % 40 !== 0) continue;
      G.S.crowd.members.forEach((m) =>
        seen.set(m.id, { kind: m.kind, prop: m.prop, pose: m.pose, o: m.outfit, h: m.heading }),
      );
    }
  });
  return [...seen.values()];
}

/** Browser-side: what the crowd is made of (counts by age, prop, pose, headwear, skin, body size). */
function surveyCrowd() {
  const all = window.__collect();
  const count = (f) => all.filter(f).length;
  const sai = all.filter((p) => p.kind === "sai");
  return {
    people: all.length,
    skins: new Set(all.map((p) => p.o.skin)).size,
    kids: count((p) => p.o.kid),
    teens: count((p) => p.o.age === "teen"),
    elders: count((p) => p.o.age === "elder"),
    adults: count((p) => !p.o.kid && p.o.age !== "teen" && p.o.age !== "elder"),
    wheelchairs: count((p) => p.prop === "wheelchair"),
    sticks: count((p) => p.prop === "stick"),
    babies: count((p) => p.prop === "baby"),
    guides: count((p) => p.prop === "flag" || p.prop === "umbrella"),
    holdingHands: count((p) => p.pose === "walk_hold_kid"),
    heads: [...new Set(all.map((p) => p.o.head))],
    girths: [Math.min(...all.map((p) => p.o.girth)), Math.max(...all.map((p) => p.o.girth))],
    kinds: [...new Set(all.map((p) => p.kind))],
    drinking: count((p) => p.pose === "drink"),
    sitting: count((p) => p.pose === "sit_legs" || p.pose === "julus"),
    saiSouth: sai.filter((p) => Math.abs(p.h) < 1).length,
    saiNorth: sai.filter((p) => Math.abs(p.h) > 2).length,
  };
}

/** Survey the crowd once per test run (it takes a few seconds): the page keeps the collection. */
async function survey(page) {
  await page.evaluate(
    `window.__collect = (${collectCrowd.toString()}); window.__collected = window.__collect();`,
  );
  return page.evaluate(
    `(function(){ const all = window.__collected; window.__collect = () => all; return (${surveyCrowd.toString()})(); })()`,
  );
}

test("owner follow-up: a varied crowd (skin tones, ages, body sizes, wheelchairs, sticks, babies, tour guides)", async ({
  browser,
}) => {
  const page = await shared(browser);
  const c = await survey(page);
  expect(c.people).toBeGreaterThan(150);
  expect(c.skins).toBeGreaterThanOrEqual(5);
  expect(c.kids).toBeGreaterThan(3);
  expect(c.teens).toBeGreaterThan(0);
  expect(c.elders).toBeGreaterThan(3);
  expect(c.adults).toBeGreaterThan(20);
  expect(c.wheelchairs).toBeGreaterThan(0);
  expect(c.sticks).toBeGreaterThan(0);
  expect(c.babies).toBeGreaterThan(0);
  expect(c.guides).toBeGreaterThan(0);
  expect(c.holdingHands).toBeGreaterThan(0);
  expect(c.girths[1] - c.girths[0]).toBeGreaterThan(0.2);
  for (const h of ["tudung", "ghutra", "songkok", "kopiah", "wrap", "doppi"])
    expect(c.heads).toContain(h);
});

test("owner follow-up: more happening: sa'i both ways, Zamzam drinkers, rests, photo groups, vendors, guards, cleaners, pigeons", async ({
  browser,
}) => {
  const page = await shared(browser);
  const c = await survey(page);
  for (const k of [
    "tawaf",
    "sai",
    "prayer",
    "read",
    "dua",
    "rest",
    "clean",
    "guard",
    "photo",
    "vendor",
    "queue",
  ]) {
    expect(c.kinds, k).toContain(k);
  }
  expect(c.saiSouth).toBeGreaterThan(0);
  expect(c.saiNorth).toBeGreaterThan(0);
  expect(c.drinking).toBeGreaterThan(0);
  expect(c.sitting).toBeGreaterThan(0);
  const h = await kq(page, () => window.__kq.holy());
  expect(h.meshes.holyPigeons).toBe(true);
  expect(h.pigeons).toBeGreaterThan(40);
});

test("owner follow-up: the holy cities keep a bigger crowd than the kampung, inside the cap and the draw-call budget", async ({
  browser,
}) => {
  const page = await shared(browser);
  const crowd = await kq(page, visit, { x: 0, z: -20, minute: 660 });
  expect(crowd.cap).toBeGreaterThan(56);
  expect(crowd.active).toBeGreaterThan(70);
  expect(crowd.active).toBeLessThanOrEqual(crowd.cap);
  expect(crowd.byKind.tawaf).toBeGreaterThan(40);
  const calls = await kq(page, () => {
    window.KQ.Game.Loop.frame(1 / 30, false);
    return window.__kq.stats().calls;
  });
  expect(calls).toBeLessThan(450);
});

test("owner follow-up: the welcome line names the city the hero is in (Makkah, then Madinah, then Makkah)", async ({
  browser,
}) => {
  const page = await shared(browser);
  const toasts = () => kq(page, () => document.getElementById("kqToasts").textContent);
  await kq(page, () => window.KQ.Holy.goTo("kaaba", { instant: true }));
  expect(await kq(page, () => window.KQ.Game.Region.welcome("makkah"))).toContain("Makkah");
  await kq(page, () => window.KQ.Holy.goTo("rawdah", { instant: true }));
  const inMadinah = await toasts();
  expect(inMadinah).toContain("Welcome to Madinah");
  expect(inMadinah).not.toContain("Welcome to Makkah");
  await kq(page, () => window.KQ.Holy.travel("makkah", { instant: true }));
  const back = await toasts();
  expect(back).not.toContain("Welcome to Madinah");
  expect(back).toContain("Makkah");
});

test("the Sa'i lane has walkers between Safa and Marwa; Arafah has people in dua", async ({
  browser,
}) => {
  const page = await shared(browser);
  const lane = await kq(page, visit, { x: 42, z: -30, minute: 660 });
  expect(lane.byKind.sai).toBeGreaterThan(3);
  const dua = await kq(page, visit, { x: -252, z: 24, minute: 660 });
  expect(dua.byKind.dua).toBeGreaterThan(5);
});

test("KQ.Holy: qibla, goTo (Safa, Rawdah), travel (Madinah and back) and the POI aliases", async ({
  browser,
}) => {
  const page = await shared(browser);
  const q = await kq(page, () => ({
    a: window.KQ.Holy.qiblaAt(0, -30),
    b: window.KQ.Holy.qiblaAt(601, 12),
    c: window.KQ.Holy.qiblaAt(-30, 0),
  }));
  expect(q.a.z).toBeCloseTo(1, 5);
  expect(q.a.yaw).toBeCloseTo(0, 5);
  expect(q.b).toEqual({ x: 0, z: 1, yaw: 0 });
  expect(q.c.x).toBeCloseTo(1, 5);
  expect(await kq(page, () => window.KQ.Holy.goTo("nowhere", { instant: true }))).toBe(false);
  expect(await kq(page, () => window.KQ.Holy.goTo("safa", { instant: true }))).toBe(true);
  let s = await kq(page, () => window.__kq.state());
  expect(Math.hypot(s.pos.x - 42, s.pos.z + 39.2)).toBeLessThan(1);
  expect(await kq(page, () => window.__kq.holy().city)).toBe("makkah");
  await kq(page, () => window.KQ.Holy.goTo("rawdah", { instant: true }));
  s = await kq(page, () => window.__kq.state());
  expect(s.pos.x).toBeGreaterThan(600);
  expect(await kq(page, () => window.__kq.holy().city)).toBe("madinah");
  const hall = await kq(page, () => window.KQ.Game.S.world.pois.mosque_hall.pos.x);
  expect(hall).toBeGreaterThan(590);
  await kq(page, () => window.KQ.Holy.travel("makkah", { instant: true }));
  s = await kq(page, () => window.__kq.state());
  expect(Math.abs(s.pos.x)).toBeLessThan(5);
  expect(await kq(page, () => window.KQ.Game.S.world.pois.mosque_hall.pos.x)).toBeLessThan(10);
});

test("vehicle hooks: vehicleSpots lie on streets and noDrive covers the mosques, mataf and mas'a", async ({
  browser,
}) => {
  const page = await shared(browser);
  const r = await kq(page, () => {
    const H = window.KQ.Holy;
    return {
      n: H.vehicleSpots.length,
      kinds: [...new Set(H.vehicleSpots.map((v) => v.kind))].sort(),
      carsInZones: H.vehicleSpots.filter((v) => v.kind === "car" && H.inNoDrive(v.x, v.z)).length,
      zones: H.noDrive.map((z) => z.name),
      mataf: H.inNoDrive(5, 5),
      masa: H.inNoDrive(42, 0),
      nabawi: H.inNoDrive(601, -60),
      street: H.inNoDrive(-150, -103),
    };
  });
  expect(r.kinds).toEqual(["bike", "car", "moto"]);
  expect(r.n).toBeGreaterThan(10);
  expect(r.carsInZones).toBe(0);
  expect(r.mataf && r.masa && r.nabawi).toBe(true);
  expect(r.street).toBe(false);
});

test("the haramain world still has the game's contract: time of day, hall prayer prompt and prayer spot", async ({
  browser,
}) => {
  const page = await shared(browser);
  await kq(page, () => window.KQ.Holy.goTo("kaaba", { instant: true }));
  for (const minute of [360, 720, 1100, 1250]) {
    await kq(
      page,
      (m) => (window.__kq.setMinute(m), window.KQ.Game.Loop.frame(1 / 30, true)),
      minute,
    );
    expect(await kq(page, () => window.__kq.state().minute)).toBeGreaterThan(0);
  }
  const t = await kq(page, () => ({
    a: window.KQ.PRAYER_TIMES.approximate,
    z: window.KQ.PRAYER_TIMES.zohor,
    n: window.KQ.Game.S.world.night(),
  }));
  expect(t.a).toBe(true);
  expect(t.z).toBe("12:08");
  expect(t.n).toBeGreaterThan(0.5);
  expect(errors).toEqual([]);
});

test("the title offers one picture card per region; picking the other region reloads into it", async ({
  page,
}) => {
  test.setTimeout(150_000);
  const errors = watch(page);
  await load(page, GAME + "?still=1&q=low");
  expect(await kq(page, () => window.KQ.region)).toBe("kampung");
  const cards = page.locator(".kq-region-card");
  await expect(cards).toHaveCount(await kq(page, () => window.KQ.Region.LIST.length));
  await expect(page.locator('.kq-region-card[data-region="kampung"]')).toContainText(
    "You are here",
  );
  await page.locator('.kq-region-card[data-region="haramain"]').click();
  await expect
    .poll(() => kq(page, () => window.__kq?.loaded && window.KQ.region), { timeout: 90_000 })
    .toBe("haramain");
  expect(await kq(page, () => localStorage.getItem("kampung-quest:region"))).toBe("haramain");
  await expect(page.locator("#kqLead")).toContainText("Makkah");
  expect(errors).toEqual([]);
});

test("each region keeps its own save slot, and the pause menu changes region", async ({ page }) => {
  test.setTimeout(180_000);
  await load(page, HOLY);
  await start(page);
  await kq(page, () => window.__kq.step(2000));
  expect(await kq(page, () => window.KQ.Game.Loop.save())).toBe(true);
  const keys = await kq(page, () => Object.keys(localStorage));
  expect(keys).toContain("kampung-quest:v1:haramain");
  expect(keys).not.toContain("kampung-quest:v1");
  await kq(page, () => window.__kq.action("pause"));
  await page.getByRole("button", { name: "Change region" }).click();
  await page.locator('#kqSheetLayer .kq-region-card[data-region="kampung"]').click();
  await expect
    .poll(() => kq(page, () => window.__kq?.loaded && window.KQ.region), { timeout: 90_000 })
    .toBe("kampung");
  await page.locator("#kqStart").waitFor();
  expect(await kq(page, () => localStorage.getItem("kampung-quest:v1:haramain") !== null)).toBe(
    true,
  );
  expect(await kq(page, () => localStorage.getItem("kampung-quest:v1"))).toBeNull();
});

test("the kampung default still loads and plays: its own prayer times, cast and world", async ({
  page,
}) => {
  test.setTimeout(150_000);
  const errors = watch(page);
  await load(page, GAME + "?region=kampung&still=1&autoq=0&q=low");
  await start(page);
  const r = await kq(page, () => ({
    region: window.KQ.region,
    zohor: window.KQ.PRAYER_TIMES.zohor,
    cast: window.KQ.Game.S.npcs.agents.length,
    holy: window.KQ.Game.S.world.region || null,
    hawker: Boolean(window.KQ.Game.S.world.pois.hawker),
    pos: window.__kq.state().pos,
  }));
  expect(r.region).toBe("kampung");
  expect(r.zohor).toBe("12:54");
  expect(r.cast).toBe(16);
  expect(r.holy).toBeNull();
  expect(r.hawker).toBe(true);
  expect(r.pos.x).toBeLessThan(0);
  expect(errors).toEqual([]);
});

test("AC-H1: the haramain world also loads from file:// with no console errors", async ({
  page,
}) => {
  test.setTimeout(150_000);
  const errors = watch(page);
  const file = pathToFileURL(
    path.resolve(import.meta.dirname, "../games/kampung-quest/index.html"),
  ).href;
  await load(page, file + "?region=haramain&still=1&q=low");
  await start(page);
  expect(await kq(page, () => window.__kq.holy().sites.length)).toBeGreaterThanOrEqual(5);
  expect(errors).toEqual([]);
});
