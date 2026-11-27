// Kampung Quest: EVERY car, bicycle and scooter is a vehicle the hero can drive or ride, in both regions
// (the kampung, and Makkah + Madinah). Nothing is decoration: each one lists in __kq.vehicles(), stands in a
// free spot outside every no-drive zone, shows "Drive" / "Ride" beside it and can be mounted and left again.
// The models: five car styles + bicycle + scooter. Rules: tests/kampung-quest/vehicle.test.mjs; behaviour of
// one vehicle in depth: tests/kampung-quest-vehicles.spec.mjs. The page runs `?still=1` (time moves only
// through __kq.step / Loop.frame). Set KQ_SHOTS=1 to write screenshots into features/kampung-quest-haramain/shots/.
// Run: npx playwright test tests/kampung-quest-vehicles-all.spec.mjs
import { test, expect } from "@playwright/test";

const BASE = "/games/kampung-quest/index.html?still=1&autoq=0&q=low";
const SHOTS = process.env.KQ_SHOTS ? "features/kampung-quest-haramain/shots/" : null;
const kq = (page, fn, arg) => page.evaluate(fn, arg);
const POSE = { car: "drive", bike: "pedal", moto: "drive" };
const WORD = { car: "Honk", bike: "Ring", moto: "Beep" };
/** What the prompt button says, by kind. */
const LABEL = { car: "Drive", bike: "Ride", moto: "Ride" };

async function boot(page, region) {
  await page.goto(BASE + (region === "haramain" ? "&region=haramain" : ""));
  await expect.poll(() => kq(page, () => window.__kq?.loaded), { timeout: 90_000 }).toBe(true);
  await page.locator("#kq button.primary").first().click();
  await expect.poll(() => kq(page, () => window.__kq.ready), { timeout: 30_000 }).toBe(true);
  await kq(page, () => window.__kq.step(300));
}

/**
 * Browser-side: for every vehicle, stand beside it, read the prompt, press it, check the seat, press Exit.
 * Returns one row per vehicle ({id, kind, prompt, label, mounted, pose, jump, out}).
 */
function mountEveryVehicle() {
  const G = window.KQ.Game;
  const frames = (n) => {
    for (let i = 0; i < n; i += 1) G.Loop.frame(1 / 30, true);
  };
  const standBeside = (v) => {
    const half = v.kind === "car" ? 1.9 : 0.96;
    const wide = v.kind === "car" ? 1.25 : 0.85;
    const f = [Math.sin(v.heading), Math.cos(v.heading)];
    const side = [Math.cos(v.heading), -Math.sin(v.heading)];
    const spots = [
      [wide, 0],
      [-wide, 0],
      [0, half + 0.6],
      [0, -half - 0.6],
      [wide + 0.3, 0],
      [-wide - 0.3, 0],
    ].map(([lat, fwd]) => [v.x + side[0] * lat + f[0] * fwd, v.z + side[1] * lat + f[1] * fwd]);
    const cols = G.S.world.colliders;
    return spots.find((p) => !G.Collide.blockedAt(cols, p[0], p[1], 0.36)) || spots[0];
  };
  const rows = [];
  G.Vehicles.debug().list.forEach((v) => {
    G.Vehicles.returnAll();
    const at = standBeside(v);
    window.__kq.place(at[0], at[1], 0);
    frames(3);
    const t = window.__kq.state().target;
    const row = { id: v.id, kind: v.kind, prompt: t && t.id, label: t && t.label };
    G.Vehicles.press("vehicle:" + v.id);
    frames(3);
    const d = G.Vehicles.debug();
    row.mounted = d.mounted;
    row.pose = window.__kq.state().pose;
    row.jump = document.querySelector("#kqJump").getAttribute("aria-label");
    row.exit = (window.__kq.state().target || {}).id;
    G.Vehicles.press("vehicle:exit");
    frames(40);
    row.out = G.Vehicles.debug().mounted === null;
    rows.push(row);
  });
  return rows;
}

/** Browser-side: mount the nth vehicle of a kind, push the stick forward for 3 s, then get out. */
function driveAway([kind, nth]) {
  const G = window.KQ.Game;
  const frames = (n) => {
    for (let i = 0; i < n; i += 1) G.Loop.frame(1 / 30, true);
  };
  G.Vehicles.returnAll();
  const v = G.Vehicles.debug().list.filter((x) => x.kind === kind)[nth];
  const h = v.heading;
  window.__kq.place(v.x + Math.cos(h) * 1.3, v.z - Math.sin(h) * 1.3, 0);
  frames(3);
  G.Vehicles.press("vehicle:" + v.id);
  window.__kq.input("up", true);
  frames(90);
  const now = G.Vehicles.debug().list.find((x) => x.id === v.id);
  const hero = window.__kq.state().pos;
  window.__kq.input("up", false);
  G.Vehicles.press("vehicle:exit");
  frames(90);
  return {
    speed: now.speed,
    moved: Math.hypot(now.x - v.x, now.z - v.z),
    apart: Math.hypot(hero.x - now.x, hero.z - now.z),
    mountedAfter: window.__kq.vehicles().mounted,
  };
}

for (const region of ["kampung", "haramain"]) {
  test.describe(region, () => {
    test.describe.configure({ mode: "serial", timeout: 300_000 });
    let page;
    test.beforeAll(async ({ browser }) => {
      test.setTimeout(150_000);
      page = await browser.newPage({ viewport: { width: 1100, height: 700 } });
      page.on("pageerror", (e) => console.log("PAGEERROR", e.message));
      await boot(page, region);
    });
    test.afterAll(async () => page && (await page.close()));

    test("lots of vehicles of every kind and several car styles, none of them decoration", async () => {
      const d = await kq(page, () => window.__kq.vehicles());
      expect(d.region).toBe(region);
      const n = (k) => d.list.filter((v) => v.kind === k).length;
      const styles = new Set(d.list.filter((v) => v.kind === "car").map((v) => v.style));
      if (region === "kampung") {
        expect([n("car"), n("bike"), n("moto")]).toEqual([10, 10, 6]);
        expect(styles.size).toBeGreaterThanOrEqual(5);
      } else {
        expect(n("car")).toBeGreaterThanOrEqual(50);
        expect(n("bike")).toBeGreaterThanOrEqual(25);
        expect(n("moto")).toBeGreaterThanOrEqual(8);
        expect([...styles].sort()).toEqual(["hatch", "mpv", "sedan", "suv", "taxi"]);
      }
      const decor = await kq(page, () => {
        const names = [
          "carBodies",
          "carGlass",
          "carWheels",
          "bikes",
          "bikeWheels",
          "motos",
          "motoWheels",
        ];
        return names.filter((nm) => window.KQ.Game.S.scene.getObjectByName(nm));
      });
      expect(decor, "no static, undrivable cars or bikes are left in the world").toEqual([]);
    });

    test("every spot is free ground, outside every no-drive zone, and ids are unique", async () => {
      const bad = await kq(page, () => {
        const G = window.KQ.Game;
        const zones = G.VehicleSpots.zones();
        const list = G.Vehicles.debug().list;
        const out = [];
        list.forEach((v) => {
          const r = v.kind === "car" ? 0.8 : 0.4;
          const others = G.S.world.colliders.filter((c) => c.vehicle !== v.id);
          if (window.KQ.Sim.Vehicle.zoneAt(zones, v.x, v.z, r))
            out.push(v.id + " in a no-drive zone");
          if (G.Collide.blockedAt(others, v.x, v.z, r * 0.8))
            out.push(v.id + " inside a wall or prop");
        });
        if (new Set(list.map((v) => v.id)).size !== list.length) out.push("duplicate ids");
        return out;
      });
      expect(bad).toEqual([]);
    });

    test("every single vehicle shows Drive / Ride, can be mounted, seats the hero and can be left", async () => {
      const rows = await kq(page, mountEveryVehicle);
      const total = await kq(page, () => window.__kq.vehicles().list.length);
      expect(rows.length).toBe(total);
      rows.forEach((r) => {
        const why = JSON.stringify(r);
        expect(r.prompt, "its own prompt shows beside it: " + why).toBe("vehicle:" + r.id);
        expect(r.label, why).toBe(LABEL[r.kind]);
        expect(r.mounted, "pressing it mounts exactly it: " + why).toBe(r.id);
        expect(r.pose, why).toBe(POSE[r.kind]);
        expect(r.jump, "the Jump button becomes its horn: " + why).toBe(WORD[r.kind]);
        expect(r.exit, "Exit is offered: " + why).toBe("vehicle:exit");
        expect(r.out, "and he can get out again: " + why).toBe(true);
      });
    });

    test("a car, a bicycle and a scooter each drive away and the hero rides with them", async () => {
      // a person standing beside a vehicle holds it still (by design), so try the first few of each kind
      for (const kind of ["car", "bike", "moto"]) {
        let best = { speed: 0 };
        for (let i = 0; i < 8 && best.speed < 2.5; i += 1) {
          best = await kq(page, driveAway, [kind, i]);
        }
        expect(best.speed, kind + " is moving").toBeGreaterThan(2.5);
        expect(best.moved, kind + " went somewhere").toBeGreaterThan(2);
        expect(best.apart, "the hero rides with the " + kind).toBeLessThan(0.7);
        expect(best.mountedAfter).toBeNull();
      }
      await kq(page, () => window.KQ.Game.Vehicles.returnAll());
    });

    test("a street full of vehicles stays inside the draw-call budget", async () => {
      const calls = await kq(page, () => {
        const G = window.KQ.Game;
        const list = G.Vehicles.debug().list;
        const mid = list[Math.floor(list.length / 2)];
        window.__kq.place(mid.x, mid.z + 3, 0);
        window.__kq.step(700);
        return window.__kq.stats().calls;
      });
      expect(calls).toBeLessThan(420);
      if (SHOTS) await page.screenshot({ path: SHOTS + "vehicles-all-" + region + ".png" });
    });
  });
}
