// Kampung Quest: toy cars and bicycles (AC-H6, features/kampung-quest-haramain/requirements.md).
// Park, prompt, get in, steer, brake for people, stop at no-drive zones (mosque, mataf), walls, get out,
// sound gates, camera, touch layout. The pure rules are unit-tested in tests/kampung-quest/vehicle.test.mjs.
// The page runs with `?still=1` (time moves only through __kq.step). Set KQ_SHOTS=1 to write the
// screenshots into features/kampung-quest-haramain/shots/.
// Run: npx playwright test tests/kampung-quest-vehicles.spec.mjs
import { test, expect } from "@playwright/test";

const GAME = "/games/kampung-quest/index.html?still=1&autoq=0&q=low";
const SHOTS = process.env.KQ_SHOTS ? "features/kampung-quest-haramain/shots/" : null;
const kq = (page, fn, arg) => page.evaluate(fn, arg);
const step = (page, ms) => kq(page, (t) => window.__kq.step(t), ms);
const veh = (page) => kq(page, () => window.__kq.vehicles());
const state = (page) => kq(page, () => window.__kq.state());
const input = (page, a, on) => kq(page, ([x, y]) => window.__kq.input(x, y), [a, on]);
const shot = (page, name) => SHOTS && page.screenshot({ path: SHOTS + name + ".png" });

async function boot(page) {
  await page.goto(GAME);
  await expect.poll(() => kq(page, () => window.__kq?.loaded), { timeout: 90_000 }).toBe(true);
  await page.locator("#kq button.primary").first().click();
  await expect.poll(() => kq(page, () => window.__kq.ready), { timeout: 30_000 }).toBe(true);
  await step(page, 300);
}

/** Stand at x, z facing yaw, let the prompt settle, and return the Talk-button target. */
async function standAt(page, x, z, yaw) {
  await kq(page, ([a, b, c]) => window.__kq.place(a, b, c), [x, z, yaw]);
  await step(page, 200);
  return (await state(page)).target;
}

/** Turn the camera round the hero (side views for the screenshots); the camera then stays put. */
async function orbit(page, yaw) {
  await kq(
    page,
    (y) => {
      window.KQ.Game.Camera.state.yaw = y;
      window.KQ.Game.Camera.state.idle = -999;
      window.__kq.step(300);
    },
    yaw,
  );
}

/** Get out and put everything back so the next test starts from a known place. */
async function reset(page) {
  await input(page, "up", false);
  await input(page, "left", false);
  await input(page, "right", false);
  await input(page, "down", false);
  if ((await veh(page)).mounted) {
    await kq(page, () => window.__kq.interact());
    await step(page, 2500);
  }
  await kq(page, () => window.__kq.freeze(false));
}

test.use({ viewport: { width: 1100, height: 700 } });
test.describe.configure({ mode: "serial", timeout: 240_000 });

let page;
test.beforeAll(async ({ browser }) => {
  page = await browser.newPage({ viewport: { width: 1100, height: 700 } });
  page.on("pageerror", (e) => console.log("PAGEERROR", e.message));
  await boot(page);
});
test.afterAll(async () => page && (await page.close()));
test.afterEach(async () => reset(page));

test("the kampung has two parked cars and two bicycles, each in a free spot", async () => {
  const d = await veh(page);
  expect(d.region).toBe("kampung");
  expect(d.list.map((v) => v.kind).sort()).toEqual(["bike", "bike", "car", "car"]);
  const stuck = await kq(page, () => {
    const G = window.KQ.Game;
    return G.Vehicles.debug().list.filter((v) => {
      const others = G.S.world.colliders.filter((c) => c.vehicle !== v.id);
      const r = v.kind === "car" ? 0.7 : 0.3;
      return G.Collide.blockedAt(others, v.x, v.z, r) !== null;
    });
  });
  expect(stuck, "no parked vehicle inside a wall, prop or another vehicle").toEqual([]);
  // each parked vehicle is solid: a collider the hero cannot walk through
  const solid = await kq(
    page,
    () => window.KQ.Game.S.world.colliders.filter((c) => c.vehicle).length,
  );
  expect(solid).toBe(8);
});

test("beside a car the prompt says Drive, beside a bicycle Ride, and far away there is none", async () => {
  expect(await standAt(page, -22, 4.1, Math.PI)).toMatchObject({
    id: "vehicle:car1",
    label: "Drive",
  });
  expect(await standAt(page, -33, 7.2, Math.PI)).toMatchObject({
    id: "vehicle:bike3",
    label: "Ride",
  });
  const far = await standAt(page, -22, 12, Math.PI);
  expect(far === null || !/^vehicle:/.test(far.id)).toBe(true);
  await standAt(page, -22, 4.1, Math.PI);
  await shot(page, "veh-prompt-drive");
});

test("press Drive: the hero sits in the car, the stick drives it, the camera drops back, Exit gets out", async () => {
  await standAt(page, -22, 4.1, Math.PI);
  const camBefore = (await state(page)).cam.dist;
  await kq(page, () => window.__kq.interact());
  await step(page, 400);
  let d = await veh(page);
  expect(d.mounted).toBe("car1");
  const mounted = await state(page);
  expect(mounted.target).toMatchObject({ id: "vehicle:exit", label: "Exit" });
  expect(mounted.pose).toBe("drive");
  await expect(page.locator("#kqJump")).toHaveAttribute("aria-label", "Honk");
  const start = (await veh(page)).list.find((v) => v.id === "car1");
  await input(page, "up", true);
  await step(page, 2000);
  d = await veh(page);
  const car = d.list.find((v) => v.id === "car1");
  const hero = await state(page);
  console.log("DBG", JSON.stringify([hero.pos, hero.locked, car, start, d.mounted]));
  expect(car.speed).toBeGreaterThan(5);
  expect(Math.hypot(car.x - start.x, car.z - start.z)).toBeGreaterThan(6);
  expect(
    Math.hypot(hero.pos.x - car.x, hero.pos.z - car.z),
    "the hero rides with the car",
  ).toBeLessThan(0.6);
  expect(hero.cam.dist, "the camera follows further back").toBeGreaterThan(camBefore + 1.5);
  await shot(page, "hero-driving");
  await input(page, "up", false);
  await kq(page, () => window.__kq.interact()); // Exit while rolling: it brakes first, then he gets out
  await step(page, 1500);
  d = await veh(page);
  expect(d.mounted).toBeNull();
  const out = await state(page);
  expect(out.pose).not.toBe("drive");
  expect(out.cam.dist).toBeCloseTo(camBefore, 0);
  await expect(page.locator("#kqJump")).toHaveAttribute("aria-label", "Jump");
  const clear = await kq(page, () => {
    const G = window.KQ.Game;
    const p = G.S.player.pos;
    return G.Collide.blockedAt(G.S.world.colliders, p.x, p.z, 0.3);
  });
  expect(clear, "the hero stepped out onto free ground").toBeNull();
  const parked = d.list.find((v) => v.id === "car1");
  expect(Math.hypot(out.pos.x - parked.x, out.pos.z - parked.z)).toBeGreaterThan(1.0);
});

test("a bicycle: pedal pose, faster than running, bell on the Jump button", async () => {
  await standAt(page, -33, 7.2, Math.PI);
  await kq(page, () => window.__kq.interact());
  await step(page, 300);
  expect((await state(page)).pose).toBe("pedal");
  await expect(page.locator("#kqJump")).toHaveAttribute("aria-label", "Ring");
  await input(page, "up", true);
  await step(page, 2500);
  const bike = (await veh(page)).list.find((v) => v.id === "bike3");
  expect(bike.speed).toBeGreaterThan(4.6); // the hero runs at 4.4
  await orbit(page, Math.PI + 0.1);
  await shot(page, "hero-riding");
});

test("a car stops gently at a wall: it never ends inside a collider", async () => {
  // drive south into block A (z 16..25) from the road
  await kq(page, () => {
    const G = window.KQ.Game;
    G.Vehicles.spawn({ kind: "car", x: -45, z: 7, heading: 0, color: 0x2f6fb0 });
  });
  const id = (await veh(page)).list.at(-1).id;
  await standAt(page, -45, 9.4, 0);
  await kq(page, () => window.__kq.interact());
  expect((await veh(page)).mounted).toBe(id);
  await input(page, "up", true);
  let worst = 0;
  for (let i = 0; i < 40; i += 1) {
    await step(page, 100);
    worst = Math.max(
      worst,
      await kq(page, () => {
        const G = window.KQ.Game;
        const v = G.Vehicles.debug().list.find((x) => x.parked === false);
        const hit = G.Collide.blockedAt(G.S.world.colliders, v.x, v.z, 0.5);
        return hit ? 1 : 0;
      }),
    );
  }
  expect(worst, "the car centre never entered a collider").toBe(0);
  const car = (await veh(page)).list.find((v) => v.id === id);
  expect(car.z).toBeLessThan(16);
  expect(car.speed).toBeLessThan(2.5);
});

test("a no-drive zone stops the car (and the bicycle) with a friendly line", async () => {
  await kq(page, () => {
    window.KQ.Holy = { noDrive: [{ x: 10, z: 2, r: 5, say: "Let's walk inside the masjid" }] };
  });
  await standAt(page, -22, 4.1, Math.PI);
  await kq(page, () => window.__kq.interact());
  await input(page, "up", true);
  await step(page, 6000);
  const d = await veh(page);
  const car = d.list.find((v) => v.id === "car1");
  expect(d.blocked).toBeGreaterThan(0);
  expect(car.x, "stopped before the zone (x 5 .. 15 plus the body)").toBeLessThan(4.5);
  expect(Math.abs(car.speed)).toBeLessThan(0.5);
  await expect(page.locator("#kqToasts")).toContainText("Let's walk inside the masjid");
  // and it can reverse out
  await input(page, "up", false);
  await input(page, "down", true);
  await step(page, 1500);
  expect((await veh(page)).list.find((v) => v.id === "car1").x).toBeLessThan(car.x);
  await kq(page, () => delete window.KQ.Holy);
});

test("the real mosque compound is a no-drive zone", async () => {
  await kq(page, () => {
    window.KQ.Game.Vehicles.spawn({
      kind: "car",
      x: -5,
      z: -31,
      heading: -Math.PI / 2,
      color: 0x2f6fb0,
    });
  });
  const id = (await veh(page)).list.at(-1).id;
  const at = (await veh(page)).list.at(-1);
  await standAt(page, at.x + 0.2, at.z + 2.0, Math.PI);
  await kq(page, () => window.__kq.interact());
  expect((await veh(page)).mounted).toBe(id);
  await input(page, "up", true);
  await step(page, 5000);
  const car = (await veh(page)).list.find((v) => v.id === id);
  expect(car.x, "never past the compound's east wall (x -12) plus the body").toBeGreaterThan(-12.2);
  expect((await veh(page)).blocked).toBeGreaterThan(0);
});

test("a person in the way: the car brakes and stops short, and nobody is touched", async () => {
  await standAt(page, -22, 4.1, Math.PI);
  await kq(page, () => window.__kq.interact());
  await input(page, "up", true);
  let closest = Infinity;
  for (let i = 0; i < 50; i += 1) {
    const gap = await kq(page, () => {
      const G = window.KQ.Game;
      const A = G.S.npcs.byId.uncle_lim;
      A.hidden = false;
      A.group.visible = true;
      A.path = [];
      A.x = 0;
      A.z = 2.1;
      const c = G.Vehicles.debug().list.find((v) => v.id === "car1");
      return A.x - (c.x + 1.4);
    });
    closest = Math.min(closest, gap);
    await step(page, 100);
  }
  const d = await veh(page);
  expect(d.braked, "it braked for him").toBeGreaterThan(0);
  expect(closest, "the bumper never reached him").toBeGreaterThan(0.2);
  expect(Math.abs(d.list.find((v) => v.id === "car1").speed)).toBeLessThan(0.5);
});

test("the horn and the engine obey mute, pause and the azan", async () => {
  await standAt(page, -22, 4.1, Math.PI);
  await kq(page, () => window.__kq.interact());
  await input(page, "up", true);
  await step(page, 800);
  expect((await veh(page)).sound.engine, "the hum plays while driving").toBe(true);
  const before = (await veh(page)).sound.honks;
  await kq(page, () => window.__kq.action("jump"));
  expect((await veh(page)).sound.honks, "Space / the Jump button honks").toBe(before + 1);
  await kq(page, () => window.__kq.action("mute"));
  await kq(page, () => window.__kq.action("jump"));
  expect((await veh(page)).sound.honks, "not while muted").toBe(before + 1);
  await kq(page, () => window.__kq.action("mute"));
  await kq(page, () => window.__kq.forcePrayer("zohor"));
  await step(page, 600);
  const d = await veh(page);
  expect(d.sound.quietBy).toMatch(/azan|prayer/);
  expect(d.sound.engine, "no engine under the azan").toBe(false);
  await kq(page, () => window.__kq.action("jump"));
  expect((await veh(page)).sound.honks, "no horn under the azan").toBe(before + 1);
});

test("moving the hero any other way (a teleport) puts him out of the seat", async () => {
  await standAt(page, -22, 4.1, Math.PI);
  await kq(page, () => window.__kq.interact());
  expect((await veh(page)).mounted).toBe("car1");
  await kq(page, () => window.__kq.place(-40, 8, 0));
  await step(page, 200);
  expect((await veh(page)).mounted).toBeNull();
  await expect(page.locator("#kqJump")).toHaveAttribute("aria-label", "Jump");
});

test("a vehicle left far away goes back to its parking spot", async () => {
  await standAt(page, -22, 4.1, Math.PI);
  await kq(page, () => window.__kq.interact());
  await input(page, "up", true);
  await step(page, 1500);
  await input(page, "up", false);
  await kq(page, () => window.__kq.interact());
  await step(page, 1500);
  const moved = (await veh(page)).list.find((v) => v.id === "car1");
  expect(moved.x).toBeGreaterThan(-20);
  await kq(page, () => window.__kq.place(60, -50, 0));
  await step(page, 2500);
  const home = (await veh(page)).list.find((v) => v.id === "car1");
  expect(home.x).toBeCloseTo(-22, 0);
  expect(home.z).toBeCloseTo(2.1, 0);
});

test("a vehicle adds only a few draw calls", async () => {
  const base = await kq(page, () => window.__kq.stats().calls);
  await standAt(page, -22, 4.1, Math.PI);
  const near = await kq(page, () => window.__kq.stats().calls);
  expect(near - base).toBeLessThan(40);
  expect(near).toBeLessThan(400);
});
