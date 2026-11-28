// Kampung Quest: camels, horses and ponies you can greet and ride (AC-P5..P7,
// features/kampung-quest-playability/requirements.md). Say hi (reaction + sound), mount a camel in Makkah,
// it moves faster than running with moving legs and stays on the ground, Exit sets the hero down on free
// ground, it will not enter the Haram, horses at the Makkah stable and ponies at the kampung pony ride can be
// ridden, the POIs are on the map, the low-tier draw calls stay under 400, and the models fit: hooves / pads
// touch the ground (3 cm) standing and moving, the rider sits on the saddle (no gap over 5 cm). The pure rules are unit-tested
// in tests/kampung-quest/mount.test.mjs. Pages run with `?still=1` (time moves only through __kq.step).
// Run: npx playwright test tests/kampung-quest-mounts.spec.mjs --project=kampung-quest
import { test, expect } from "@playwright/test";

const GAME = "/games/kampung-quest/index.html?still=1&autoq=0&q=low";
const HOLY = GAME + "&region=haramain";
const RUN = 4.4;

const kq = (page, fn, arg) => page.evaluate(fn, arg);
const step = (page, ms) => kq(page, (t) => window.__kq.step(t), ms);
const mounts = (page) => kq(page, () => window.__kq.mounts());
const animal = async (page, id) => (await mounts(page)).list.find((a) => a.id === id);

/** Collect console errors and uncaught exceptions. */
function watch(page) {
  const errors = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  return errors;
}

async function boot(page, url) {
  await page.goto(url);
  await expect.poll(() => kq(page, () => window.__kq?.loaded), { timeout: 90_000 }).toBe(true);
  await page.locator("#kqStart").click();
  await expect.poll(() => kq(page, () => window.__kq.ready), { timeout: 30_000 }).toBe(true);
  await kq(page, () => window.__kq.setMinute(600));
  await step(page, 300);
}

/**
 * Ride the current animal from (x, z) facing `heading` with the stick held forward for `ms`; returns the
 * speed over the last second and what the legs did.
 */
async function rideFrom(page, id, [x, z, heading], ms) {
  return kq(
    page,
    ([who, px, pz, h, t]) => {
      const K = window.__kq;
      const G = window.KQ.Game;
      const a = G.Mounts.byId(who);
      Object.assign(a.sim, { x: px, z: pz, heading: h, speed: 0 });
      K.step(100);
      G.Camera.state.yaw = h;
      K.input("up", true);
      K.step(t - 1000);
      const p0 = { x: a.sim.x, z: a.sim.z, phase: a.sim.phase };
      const legs = [];
      for (let i = 0; i < 10; i += 1) {
        K.step(100);
        legs.push(a.rig.bones.hipFL.rotation.x);
      }
      K.input("up", false);
      const P = G.S.player;
      return {
        speed: Math.hypot(a.sim.x - p0.x, a.sim.z - p0.z),
        gait: a.sim.gait,
        legSpread: Math.max(...legs) - Math.min(...legs),
        groundGap: Math.abs(a.y - G.S.world.heightAt(a.sim.x, a.sim.z)),
        heroUp: P.pos.y - G.S.world.heightAt(P.pos.x, P.pos.z),
        x: a.sim.x,
        z: a.sim.z,
      };
    },
    [id, x, z, heading, ms],
  );
}

/**
 * Install two in-page measures on an animal `a` (window.__fit): `feet(a)` = the lowest skinned vertex
 * of its mesh above its ground (hooves / pads), `gap(a)` = the rider's pelvis bottom above the saddle top
 * straight under it (a ray down onto the animal's mesh).
 */
function installFit(page) {
  return kq(page, () => {
    const v = new THREE.Vector3();
    const feet = (a) => {
      const m = a.rig.mesh;
      const pos = m.geometry.attributes.position;
      m.updateMatrixWorld(true);
      let low = Infinity;
      for (let i = 0; i < pos.count; i += 1) {
        m.boneTransform(i, v.fromBufferAttribute(pos, i));
        low = Math.min(low, v.applyMatrix4(m.matrixWorld).y);
      }
      return low - a.y;
    };
    const gap = (a) => {
      const P = window.KQ.Game.S.player;
      P.group.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromBufferAttribute(P.rig.hips.geometry.attributes.position);
      box.applyMatrix4(P.rig.hips.matrixWorld);
      const c = P.rig.hips.getWorldPosition(new THREE.Vector3());
      const ray = new THREE.Raycaster(c.clone().setY(c.y + 2), new THREE.Vector3(0, -1, 0));
      const hit = ray.intersectObject(a.rig.mesh, false)[0];
      return hit ? box.min.y - hit.point.y : 99;
    };
    window.__fit = { feet, gap };
  });
}

/**
 * Ride `id` from (x, z, heading) with the stick forward for 3 s, then let go, sampling feet and gap
 * every 100 ms; `stand` = the feet before mounting. Model checks for "touches the ground" and "sits
 * on the saddle, not floating or sunk in".
 */
async function fitWhileRiding(page, id, [x, z, heading]) {
  await installFit(page);
  return kq(
    page,
    ([who, px, pz, h]) => {
      const K = window.__kq;
      const G = window.KQ.Game;
      const a = G.Mounts.byId(who);
      const out = { stand: window.__fit.feet(a), feet: [], gap: [], gaits: [] };
      K.mountAct("mount:ride:" + who);
      K.step(200);
      Object.assign(a.sim, { x: px, z: pz, heading: h, speed: 0 });
      K.step(100);
      G.Camera.state.yaw = h;
      for (let i = 0; i < 40; i += 1) {
        K.input("up", i < 30);
        K.step(100);
        out.feet.push(window.__fit.feet(a));
        out.gap.push(window.__fit.gap(a));
        out.gaits.push(a.sim.gait);
      }
      K.input("up", false);
      return out;
    },
    [id, x, z, heading],
  );
}

/** Expect the feet within 3 cm of the ground and the rider seated (no gap over 5 cm, not sunk in). */
function expectFit(r) {
  expect(Math.abs(r.stand)).toBeLessThan(0.03);
  expect(Math.max(...r.feet.map(Math.abs))).toBeLessThan(0.03);
  expect(Math.max(...r.gap)).toBeLessThan(0.05);
  expect(Math.min(...r.gap)).toBeGreaterThan(-0.03);
}

/** Press Exit and let the animal stop; returns where the hero stands and whether that ground is free. */
async function getDown(page) {
  await kq(page, () => window.__kq.interact());
  await step(page, 3000); // it slows to a stop first (about 1.6 s from a camel's top speed)
  return kq(page, () => {
    const G = window.KQ.Game;
    const p = G.S.player.pos;
    return {
      riding: window.__kq.mounts().riding,
      free: !G.Collide.blockedAt(G.S.world.colliders, p.x, p.z, G.Player.RADIUS - 0.03),
      zone: window.KQ.Holy ? window.KQ.Holy.inNoDrive(p.x, p.z, 0) : false,
      x: p.x,
      z: p.z,
      label: window.__kq.state().target ? window.__kq.state().target.label : null,
    };
  });
}

let holyPage = null;
let kampungPage = null;
const errors = { holy: [], kampung: [] };

/** One shared page per region (booting takes ~15 s in software GL). */
async function shared(browser, which) {
  const ready = which === "holy" ? holyPage : kampungPage;
  if (ready) return ready;
  test.setTimeout(150_000);
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  errors[which] = watch(page);
  await boot(page, which === "holy" ? HOLY : GAME);
  if (which === "holy") holyPage = page;
  else kampungPage = page;
  return page;
}
const holy = (browser) => shared(browser, "holy");
const kampung = (browser) => shared(browser, "kampung");

test.describe.configure({ mode: "serial" });
test.afterAll(async () => {
  if (holyPage) await holyPage.close();
  if (kampungPage) await kampungPage.close();
});

test("camels and horses stand at the yard, oasis and stable, with map POIs", async ({
  browser,
}) => {
  const page = await holy(browser);
  const d = await mounts(page);
  expect(d.region).toBe("haramain");
  expect(d.list.filter((a) => a.kind === "camel").length).toBeGreaterThanOrEqual(3);
  expect(d.list.filter((a) => a.kind === "horse").length).toBeGreaterThanOrEqual(3);
  const pois = await kq(page, () => Object.keys(window.KQ.Game.S.world.pois));
  ["camel_yard", "horse_stable", "camel_oasis"].forEach((id) => expect(pois).toContain(id));
  const meshes = await kq(page, () => {
    const out = [];
    window.KQ.Game.S.scene.traverse(
      (o) => o.isSkinnedMesh && o.name.startsWith("mount:") && out.push(o.name),
    );
    return out;
  });
  expect(meshes.length).toBe(d.list.length); // one skinned mesh (one draw call) per animal
});

test("Say hi: the prompt opens a menu; the camel turns its head and calls", async ({ browser }) => {
  const page = await holy(browser);
  await kq(page, () => window.__kq.place(-193.3, -146, -Math.PI / 2));
  await step(page, 200);
  const target = await kq(page, () => window.__kq.state().target);
  expect(target.label).toBe("Camel");
  await kq(page, () => window.__kq.interact());
  const buttons = await page.locator(".kq-sheet .kq-btn").allTextContents();
  expect(buttons.join("|")).toContain("Say hi");
  expect(buttons.join("|")).toContain("Ride");
  const head0 = await kq(
    page,
    () => window.KQ.Game.Mounts.byId("camel_sandy").rig.bones.neck.rotation.y,
  );
  await page.locator(".kq-sheet .kq-btn", { hasText: "Say hi" }).click();
  await step(page, 500);
  const d = await mounts(page);
  expect(d.hi).toBe(1);
  expect((await animal(page, "camel_sandy")).greeting).toBe(true);
  const head1 = await kq(
    page,
    () => window.KQ.Game.Mounts.byId("camel_sandy").rig.bones.neck.rotation.y,
  );
  expect(Math.abs(head1 - head0)).toBeGreaterThan(0.05);
  // The call goes through the shared audio gate: either it sounded or it was refused (no context headless).
  expect(d.sound.calls + d.sound.refused).toBeGreaterThan(0);
  await expect(page.locator(".kq-sheet")).toHaveCount(0);
});

test("the animal's call obeys mute (and the same gate as every sound)", async ({ browser }) => {
  const page = await holy(browser);
  await kq(page, () => window.__kq.action("mute"));
  const before = (await mounts(page)).sound;
  await kq(page, () => window.__kq.mounts && window.KQ.Game.Mounts.sayHi("camel_dune"));
  const after = (await mounts(page)).sound;
  await kq(page, () => window.__kq.action("mute"));
  expect(after.calls).toBe(before.calls);
  expect(after.refused).toBe(before.refused + 1);
});

test("ride a camel: seated high on the hump, faster than running, legs moving, on the ground", async ({
  browser,
}) => {
  const page = await holy(browser);
  await kq(page, () => window.__kq.mountAct("mount:ride:camel_sandy"));
  await step(page, 200);
  expect((await mounts(page)).riding).toBe("camel_sandy");
  expect((await kq(page, () => window.__kq.state().target)).label).toBe("Exit");
  const r = await rideFrom(page, "camel_sandy", [-276, -118, 0], 4000);
  expect(r.speed).toBeGreaterThan(RUN * 1.5);
  expect(r.gait).not.toBe("stand");
  expect(r.legSpread).toBeGreaterThan(0.3);
  expect(r.groundGap).toBeLessThan(0.05);
  expect(r.heroUp).toBeGreaterThan(1.5);
});

test("Exit: the hero is set down on free ground and the camel stands solid again", async ({
  browser,
}) => {
  const page = await holy(browser);
  const r = await getDown(page);
  expect(r.riding).toBe(null);
  expect(r.free).toBe(true);
  const solid = await kq(page, () =>
    window.KQ.Game.S.world.colliders.some((c) => c.mount === "camel_sandy"),
  );
  expect(solid).toBe(true);
});

test("no riding into the Haram: the camel stops at the plaza edge with a friendly line", async ({
  browser,
}) => {
  const page = await holy(browser);
  await kq(page, () => window.__kq.mountAct("mount:ride:camel_sandy"));
  await step(page, 200);
  const before = (await mounts(page)).blocked;
  const r = await rideFrom(page, "camel_sandy", [-72, 0, Math.PI / 2], 4000);
  const d = await mounts(page);
  expect(d.blocked).toBeGreaterThan(before);
  const inZone = await kq(page, ([x, z]) => window.KQ.Holy.inNoDrive(x, z, 0), [r.x, r.z]);
  expect(inZone).toBe(false);
  expect(d.note).toMatch(/walk/i); // the friendly line shown as a toast
  const down = await getDown(page);
  expect(down.free && !down.zone).toBe(true);
});

test("ride a horse at the stable: about twice a run, trotting / cantering", async ({ browser }) => {
  const page = await holy(browser);
  await kq(page, () => window.__kq.mountAct("mount:ride:horse_amber"));
  await step(page, 200);
  expect((await mounts(page)).riding).toBe("horse_amber");
  const r = await rideFrom(page, "horse_amber", [-276, -118, 0], 4000);
  expect(r.speed).toBeGreaterThan(RUN * 1.9);
  expect(["trot", "canter"]).toContain(r.gait);
  expect(r.legSpread).toBeGreaterThan(0.3);
  expect((await getDown(page)).free).toBe(true);
});

test("camel and horse: hooves / pads on the ground and the rider on the saddle, standing and moving", async ({
  browser,
}) => {
  const page = await holy(browser);
  test.setTimeout(120_000);
  const camel = await fitWhileRiding(page, "camel_dune", [-276, -118, 0]);
  expect(camel.gaits).toContain("pace");
  expectFit(camel);
  expect((await getDown(page)).free).toBe(true);
  const horse = await fitWhileRiding(page, "horse_layla", [-276, -118, 0]);
  expect(horse.gaits).toContain("canter");
  expectFit(horse);
  expect((await getDown(page)).free).toBe(true);
});

test("animals near the stable keep the low-tier draw calls under 400; far ones are not drawn", async ({
  browser,
}) => {
  const page = await holy(browser);
  test.setTimeout(120_000);
  const worst = await kq(page, () => {
    const G = window.KQ.Game;
    let max = 0;
    [
      [-186, -124, Math.PI],
      [-186, -136, Math.PI],
      [-150, 96, -Math.PI / 2],
    ].forEach(([x, z, yaw]) => {
      window.__kq.place(x, z, yaw);
      window.__kq.step(600);
      G.Loop.frame(1 / 30, false);
      max = Math.max(max, window.__kq.stats().calls);
    });
    return max;
  });
  expect(worst).toBeLessThan(400);
  await kq(page, () => window.__kq.place(0, -100, 0));
  await step(page, 1200);
  const d = await mounts(page);
  expect(d.list.every((a) => !a.visible)).toBe(true);
});

test("no console errors in Makkah", async ({ browser }) => {
  await holy(browser);
  expect(errors.holy).toEqual([]);
});

test("ponies stand in the pony corner by the park, with a pony_ride POI", async ({ browser }) => {
  const page = await kampung(browser);
  const d = await mounts(page);
  expect(d.region).toBe("kampung");
  expect(d.list.filter((a) => a.kind === "pony").length).toBeGreaterThanOrEqual(2);
  const poi = await kq(page, () => window.KQ.Game.S.world.pois.pony_ride);
  expect(poi).toBeTruthy();
});

test("greet and ride a pony, faster than running, and get down on free ground", async ({
  browser,
}) => {
  const page = await kampung(browser);
  await kq(page, () => window.__kq.place(60.8, 41.2, Math.PI / 2));
  await step(page, 200);
  expect((await kq(page, () => window.__kq.state().target)).label).toBe("Pony");
  await kq(page, () => window.__kq.mountAct("mount:hi:pony_kiwi"));
  expect((await mounts(page)).hi).toBe(1);
  await kq(page, () => window.__kq.mountAct("mount:ride:pony_kiwi"));
  await step(page, 200);
  // Out through the gate (west) and along the open lawn toward the playground.
  const r = await rideFrom(page, "pony_kiwi", [54, 36, -Math.PI / 2], 3000);
  expect(r.speed).toBeGreaterThan(RUN * 1.3);
  expect(r.legSpread).toBeGreaterThan(0.3);
  expect((await getDown(page)).free).toBe(true);
});

test("pony: hooves on the ground and the rider on the saddle while riding", async ({ browser }) => {
  const page = await kampung(browser);
  await kq(page, () => window.__kq.place(60.8, 41.2, Math.PI / 2));
  await step(page, 200);
  expectFit(await fitWhileRiding(page, "pony_bintang", [54, 36, -Math.PI / 2]));
  expect((await getDown(page)).free).toBe(true);
});

test("the pony corner keeps the low-tier draw calls under 400", async ({ browser }) => {
  const page = await kampung(browser);
  const calls = await kq(page, () => {
    window.__kq.place(56, 40, Math.PI / 2);
    window.__kq.step(600);
    window.KQ.Game.Loop.frame(1 / 30, false);
    return window.__kq.stats().calls;
  });
  expect(calls).toBeLessThan(400);
});

test("no console errors in the kampung", async ({ browser }) => {
  await kampung(browser);
  expect(errors.kampung).toEqual([]);
});
