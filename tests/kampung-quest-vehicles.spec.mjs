// Kampung Quest: toy cars and bicycles (AC-H6, features/kampung-quest-haramain/requirements.md).
// Park, prompt, get in, steer, brake for people, stop at no-drive zones (mosque, mataf), walls, get out,
// sound gates, camera, touch layout. The pure rules are unit-tested in tests/kampung-quest/vehicle.test.mjs.
// The page runs with `?still=1` (time moves only through __kq.step). Set KQ_SHOTS=1 to write the
// screenshots into features/kampung-quest-haramain/shots/.
// Run: npx playwright test tests/kampung-quest-vehicles.spec.mjs
import { test, expect, devices } from "@playwright/test";

const GAME = "/games/kampung-quest/index.html?still=1&autoq=0&q=low";
const SHOTS = process.env.KQ_SHOTS ? "features/kampung-quest-haramain/shots/" : null;
/** A device descriptor without `defaultBrowserType` (only Chromium is installed; the engine is the same). */
function device(name) {
  const rest = { ...devices[name] };
  delete rest.defaultBrowserType;
  return rest;
}

/** One raw touch event over CDP (page.touchscreen can only tap). */
const touchEvent = (cdp, type, pts) =>
  cdp.send("Input.dispatchTouchEvent", {
    type,
    touchPoints: pts.map((p, i) => ({ x: p.x, y: p.y, id: i })),
  });

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
  await kq(page, () => window.KQ.Game.Vehicles.returnAll());
}

/** Let go of the stick and press Exit while still rolling: it brakes first, then he gets out on free ground. */
async function exitAndCheck(page, camBefore) {
  await input(page, "up", false);
  await kq(page, () => window.__kq.interact());
  await step(page, 1500);
  const d = await veh(page);
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
}

test.use({ viewport: { width: 1100, height: 700 } });
test.describe.configure({ mode: "serial", timeout: 240_000 });

let page;
test.beforeAll(async ({ browser }) => {
  test.setTimeout(150_000); // booting the 3D world in software GL
  page = await browser.newPage({ viewport: { width: 1100, height: 700 } });
  page.on("pageerror", (e) => console.log("PAGEERROR", e.message));
  await boot(page);
});
test.afterAll(async () => page && (await page.close()));
test.afterEach(async () => reset(page));

test("the kampung's cars, bicycles and scooters are all vehicles, each in a free spot", async () => {
  const d = await veh(page);
  expect(d.region).toBe("kampung");
  const count = (k) => d.list.filter((v) => v.kind === k).length;
  expect([count("car"), count("bike"), count("moto")]).toEqual([10, 10, 6]);
  const stuck = await kq(page, () => {
    const G = window.KQ.Game;
    return G.Vehicles.debug().list.filter((v) => {
      const others = G.S.world.colliders.filter((c) => c.vehicle !== v.id);
      const r = v.kind === "car" ? 0.7 : 0.3;
      return G.Collide.blockedAt(others, v.x, v.z, r) !== null;
    });
  });
  expect(stuck, "no parked vehicle inside a wall, prop or another vehicle").toEqual([]);
  // each parked vehicle is solid: ONE oriented-box collider the size of its body (AC-P12)
  const solid = await kq(
    page,
    () => window.KQ.Game.S.world.colliders.filter((c) => c.vehicle).length,
  );
  expect(solid).toBe(28); // 26 cars, bikes and scooters + the lorry + the moving bus (bus.js)
});

test("beside a car the prompt says Drive, beside a bicycle Ride, and far away there is none", async () => {
  expect(await standAt(page, -22, 4.1, Math.PI)).toMatchObject({
    id: "vehicle:car1",
    label: "Drive",
  });
  expect(await standAt(page, -33, 7.2, Math.PI)).toMatchObject({
    id: "vehicle:bike11",
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
  expect(car.speed).toBeGreaterThan(5);
  expect(Math.hypot(car.x - start.x, car.z - start.z)).toBeGreaterThan(6);
  expect(
    Math.hypot(hero.pos.x - car.x, hero.pos.z - car.z),
    "the hero rides with the car",
  ).toBeLessThan(0.6);
  expect(hero.cam.dist, "the camera follows further back").toBeGreaterThan(camBefore + 1.5);
  await shot(page, "hero-driving");
  await exitAndCheck(page, camBefore);
});

test("a bicycle: pedal pose, faster than running, bell on the Jump button", async () => {
  await standAt(page, -33, 7.2, Math.PI);
  await kq(page, () => window.__kq.interact());
  await step(page, 300);
  expect((await state(page)).pose).toBe("pedal");
  await expect(page.locator("#kqJump")).toHaveAttribute("aria-label", "Ring");
  await input(page, "up", true);
  await step(page, 2500);
  const bike = (await veh(page)).list.find((v) => v.id === "bike11");
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
  const worst = await kq(page, () => {
    const G = window.KQ.Game;
    let hits = 0;
    for (let i = 0; i < 120; i += 1) {
      G.Loop.frame(1 / 30, true);
      const v = G.Vehicles.debug().list.find((x) => x.parked === false);
      if (G.Collide.blockedAt(G.S.world.colliders, v.x, v.z, 0.5)) hits += 1;
    }
    return hits;
  });
  expect(worst, "the car centre never entered a collider").toBe(0);
  const car = (await veh(page)).list.find((v) => v.id === id);
  expect(car.z).toBeLessThan(16);
  expect(car.speed).toBeLessThan(2.5);
});

test("a no-drive zone stops the car (and the bicycle) with a friendly line", async () => {
  await kq(page, () => {
    window.__removeZone = window.KQ.Game.VehicleSpots.addZone({
      x: 10,
      z: 2,
      r: 5,
      say: "Let's walk inside the masjid",
    });
  });
  await standAt(page, -22, 4.1, Math.PI);
  await kq(page, () => window.__kq.interact());
  await input(page, "up", true);
  await step(page, 4500); // the car is faster now (AC-P13): its "let's walk" toast (2.8 s) must still be up
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
  await kq(page, () => window.__removeZone());
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
  const closest = await kq(page, () => {
    const G = window.KQ.Game;
    const A = G.S.npcs.byId.uncle_lim;
    let least = Infinity;
    for (let i = 0; i < 150; i += 1) {
      A.hidden = false;
      A.group.visible = true;
      A.path = [];
      A.x = 0;
      A.z = 2.1;
      const c = G.Vehicles.debug().list.find((v) => v.id === "car1");
      least = Math.min(least, A.x - (c.x + 1.4));
      G.Loop.frame(1 / 30, true);
    }
    return least;
  });
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
  expect(home.z).toBeCloseTo(2.6, 1);
});

test("one vehicle adds only a few draw calls, and the whole street stays inside the budget", async () => {
  await standAt(page, -22, 4.1, Math.PI);
  const calls = (only) =>
    kq(
      page,
      (keep) => {
        const G = window.KQ.Game;
        G.S.scene.traverse((o) => {
          if (o.name && o.name.indexOf("vehicle-") === 0) o.visible = keep === "all";
        });
        const car = G.S.scene.children.find(
          (o) => o.name === "vehicle-car" && Math.abs(o.position.x + 22) < 0.1,
        );
        if (keep === "one" && car) car.visible = true;
        window.__kq.step(100);
        return window.__kq.stats().calls;
      },
      only,
    );
  const without = await calls("none");
  const oneCar = await calls("one");
  expect(oneCar - without, "one car, shadows included").toBeLessThanOrEqual(24);
  const all = await calls("all");
  expect(all, "every vehicle in view").toBeLessThan(420);
  await kq(page, () => window.__kq.step(600)); // the distance culling puts the far ones back
});

test("phone landscape (touch): Drive, Exit and Honk fit, and the joystick drives the car", async ({
  browser,
}) => {
  const ctx = await browser.newContext(device("iPhone 13 landscape"));
  const ph = await ctx.newPage();
  const errors = [];
  ph.on("pageerror", (e) => errors.push(e.message));
  await ph.goto("/games/kampung-quest/index.html?still=1&autoq=0");
  await expect.poll(() => kq(ph, () => window.__kq?.loaded), { timeout: 90_000 }).toBe(true);
  await ph.getByRole("button", { name: "Start", exact: true }).tap();
  await expect.poll(() => kq(ph, () => window.__kq.ready), { timeout: 30_000 }).toBe(true);
  await standAt(ph, -22, 4.1, Math.PI);
  const talk = ph.locator("#kqTalk");
  await expect(talk).toContainText("Drive");
  await expect(talk).toBeInViewport({ ratio: 1 });
  expect((await talk.boundingBox()).height).toBeGreaterThanOrEqual(48);
  await talk.tap();
  expect((await veh(ph)).mounted).toBe("car1");
  await step(ph, 300);
  await expect(talk).toContainText("Exit");
  await expect(talk).toBeInViewport({ ratio: 1 });
  const jump = ph.locator("#kqJump");
  await expect(jump).toContainText("Honk");
  const box = await jump.boundingBox();
  expect(Math.min(box.width, box.height)).toBeGreaterThanOrEqual(48);
  const before = (await veh(ph)).sound.honks;
  await jump.tap();
  expect((await veh(ph)).sound.honks, "the Honk button honks").toBe(before + 1);
  const joy = await ph.locator("#kqJoy").boundingBox();
  const at = { x: joy.x + joy.width / 2, y: joy.y + joy.height / 2 };
  const cdp = await ctx.newCDPSession(ph);
  await touchEvent(cdp, "touchStart", [at]);
  await touchEvent(cdp, "touchMove", [{ x: at.x, y: at.y - 30 }]);
  await step(ph, 1500);
  expect((await veh(ph)).list.find((v) => v.id === "car1").speed).toBeGreaterThan(2);
  await shot(ph, "veh-phone-landscape");
  await touchEvent(cdp, "touchEnd", []);
  expect(errors).toEqual([]);
  await ctx.close();
});
