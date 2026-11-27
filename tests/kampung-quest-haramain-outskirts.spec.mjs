// Kampung Quest, Haramain region: the outskirts (photo textures, the city around the Haram, the
// mountains, the date palms) and the camels (yard, caravan, oasis). The page runs with `?still`
// (time moves only through __kq.step) and `?q=low`.
// Run: npx playwright test tests/kampung-quest-haramain-outskirts.spec.mjs --project=kampung-quest
import { test, expect } from "@playwright/test";

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

let sharedPage = null;
let errors = [];
async function shared(browser) {
  if (sharedPage) return sharedPage;
  test.setTimeout(150_000);
  sharedPage = await browser.newPage({ viewport: { width: 960, height: 540 } });
  errors = watch(sharedPage);
  await sharedPage.goto(HOLY);
  await expect
    .poll(() => kq(sharedPage, () => window.__kq?.loaded), { timeout: 90_000 })
    .toBe(true);
  await sharedPage.locator("#kqStart").click();
  await expect.poll(() => kq(sharedPage, () => window.__kq.ready), { timeout: 30_000 }).toBe(true);
  return sharedPage;
}

test.afterAll(async () => {
  if (sharedPage) await sharedPage.close();
});

test.describe.configure({ mode: "serial" });

test("outskirts: the photo textures are loaded and the facades, mountains and palms exist", async ({
  browser,
}) => {
  const page = await shared(browser);
  const r = await kq(page, () => {
    const Tex = window.KQ.WorldParts.Tex;
    const scene = window.KQ.Game.S.scene;
    const names = [];
    scene.traverse((o) => o.isMesh && names.push(o.name));
    const sizes = ["sand", "dirt", "rock", "limestone", "sandstone"].map((n) => {
      const img = Tex.set(n).map.image;
      return img && img.width ? img.width : 0;
    });
    return {
      photo: Tex.set("sand").photo,
      sizes,
      hills: names.filter((n) => n.startsWith("holyHills")).length,
      palms: names.filter((n) => n.startsWith("holyPalm")).length,
      dust: names.includes("holyDust"),
      scrub: names.includes("holyScrub"),
      boulders: names.includes("holyBoulders"),
      blocks: window.KQ.WorldParts.HolyCity.stats,
    };
  });
  expect(r.photo).toBe(true);
  r.sizes.forEach((w) => expect(w).toBeGreaterThanOrEqual(256));
  expect(r.hills).toBeGreaterThanOrEqual(3);
  expect(r.palms).toBe(2);
  expect(r.dust && r.scrub && r.boulders).toBe(true);
  expect(r.blocks.inner).toBeGreaterThan(8);
  expect(r.blocks.back).toBeGreaterThan(3);
  expect(errors).toEqual([]);
});

test("camels: a herd with handlers is in Makkah as six instanced meshes, and none sit on a street", async ({
  browser,
}) => {
  const page = await shared(browser);
  const r = await kq(page, () => {
    const w = window.KQ.Game.S.world;
    const d = w.camels();
    const meshes = [];
    window.KQ.Game.S.scene.traverse(
      (o) => o.isInstancedMesh && o.name.startsWith("camel:") && meshes.push(o.name),
    );
    const onStreet = d.animals.filter((a) => a.mode !== "walk" && Math.abs(a.z + 106) < 16);
    return { d, meshes, onStreet: onStreet.length };
  });
  expect(r.d.camels).toBeGreaterThanOrEqual(8);
  expect(r.d.handlers).toBeGreaterThanOrEqual(2);
  expect(r.meshes.length).toBe(6);
  const modes = new Set(r.d.animals.map((a) => a.mode));
  ["stand", "rest", "graze", "walk"].forEach((m) => expect(modes.has(m)).toBe(true));
  expect(r.onStreet).toBe(0);
});

test("camels: the hero is pushed out of a standing camel and a walking camel moves", async ({
  browser,
}) => {
  const page = await shared(browser);
  const r = await kq(page, () => {
    const G = window.KQ.Game;
    const w = G.S.world;
    const stand = w.camels().animals.find((a) => a.mode === "stand");
    window.__kq.place(stand.x, stand.z, 0);
    G.Loop.frame(1 / 30, true);
    const p = G.S.player.pos;
    const inside = G.Collide.blockedAt(w.colliders, p.x, p.z, G.Player.RADIUS - 0.03);
    const before = w.camels().animals.find((a) => a.mode === "walk");
    for (let i = 0; i < 20; i += 1) G.Loop.frame(0.1, false); // the world (and the herd) updates on drawn frames
    const after = w.camels().animals.find((a) => a.mode === "walk");
    return { inside: Boolean(inside), moved: Math.hypot(after.x - before.x, after.z - before.z) };
  });
  expect(r.inside).toBe(false);
  expect(r.moved).toBeGreaterThan(0.5);
});

test("camels and outskirts keep the draw-call budget on the low tier", async ({ browser }) => {
  test.setTimeout(150_000); // four full renders in software GL on a 2-core CI runner
  const page = await shared(browser);
  const worst = await kq(page, () => {
    const G = window.KQ.Game;
    let max = 0;
    [
      [-225, -118, Math.PI],
      [-250, -55, 0],
      [-172, 80, Math.PI],
      [0, -100, Math.PI],
    ].forEach(([x, z, yaw]) => {
      window.__kq.place(x, z, yaw);
      G.Loop.frame(1 / 30, false);
      max = Math.max(max, window.__kq.stats().calls);
    });
    return max;
  });
  expect(worst).toBeLessThan(400);
});

test("outskirts: the Haramain world still has no console errors after all of that", async () => {
  expect(errors).toEqual([]);
});
