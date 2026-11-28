// Kampung Quest: vehicles on the ground, solid, and worth taking (AC-P11..P14,
// features/kampung-quest-playability/requirements.md).
//   AC-P11 every car, bicycle and scooter rests its wheels within 3 cm of the ground, parked and while driven,
//          in the kampung and in Makkah / Madinah;
//   AC-P12 the hero cannot walk into or through a parked vehicle (not even its middle, where the old two
//          square colliders left a gap), NPC / crowd tests see the whole body, a driven car stops at a parked one;
//   AC-P13 top speeds against the hero's run (car >= 2.5x, scooter >= 2x, bicycle >= 1.5x) reached smoothly,
//          and the camera keeps up behind the vehicle;
//   AC-P14 the models stay inside the draw budget (asserted in tests/kampung-quest-vehicles-all.spec.mjs).
// The page runs `?still=1` (time moves only through Loop.frame). Pure rules: tests/kampung-quest/vehicle.test.mjs.
// Run: PW_PORT=5601 npx playwright test tests/kampung-quest-vehicles-ground.spec.mjs --project=kampung-quest
import { test, expect } from "@playwright/test";

const BASE = "/games/kampung-quest/index.html?still=1&autoq=0&q=low";
const kq = (page, fn, arg) => page.evaluate(fn, arg);

async function boot(page, region) {
  await page.goto(BASE + (region === "haramain" ? "&region=haramain" : ""));
  await expect.poll(() => kq(page, () => window.__kq?.loaded), { timeout: 90_000 }).toBe(true);
  await page.locator("#kq button.primary").first().click();
  await expect.poll(() => kq(page, () => window.__kq.ready), { timeout: 30_000 }).toBe(true);
  await kq(page, () => window.__kq.step(300));
  await kq(page, installHelpers);
}

/** Browser-side: helpers shared by the browser-side functions (window.__vg). */
function installHelpers() {
  const G = window.KQ.Game;
  const frames = (n, each) => {
    for (let i = 0; i < n; i += 1) {
      G.Loop.frame(1 / 30, true);
      if (each) each(i);
    }
  };
  /** Where a point sits in a vehicle's frame: fwd along it, lat across it. */
  const local = (v, x, z) => {
    const dx = x - v.x;
    const dz = z - v.z;
    return {
      fwd: dx * Math.sin(v.heading) + dz * Math.cos(v.heading),
      lat: dx * Math.cos(v.heading) - dz * Math.sin(v.heading),
    };
  };
  /** Nobody on foot nearby (so a test drive is not held back by someone crossing): crowd and cast hidden. */
  const clearStreets = () => {
    G.Crowd.showAll(G.S.crowd, false);
    G.S.crowd.members.forEach((m) => (m.show = 0));
    G.S.npcs.agents.forEach((A) => (A.group.visible = false));
  };
  window.__vg = { frames, local, clearStreets };
}

/** Browser-side: the worst wheel-to-ground gap of every vehicle, parked. */
function parkedGaps() {
  window.KQ.Game.Vehicles.returnAll();
  return window.KQ.Game.Vehicles.groundGaps();
}

/** Browser-side: mount a vehicle and drive it with the stick held forward (and a little steer), sampling the gaps. */
function drivenGaps([kind, secs]) {
  const G = window.KQ.Game;
  const T = window.__vg;
  G.Vehicles.returnAll();
  const v = G.Vehicles.debug().list.filter((x) => x.kind === kind)[0];
  G.Vehicles.press("vehicle:" + v.id);
  T.frames(3);
  window.__kq.input("up", true);
  let worst = 0;
  T.frames(Math.round(secs * 30), function (i) {
    if (i === 40) window.__kq.input("left", true);
    if (i === 70) window.__kq.input("left", false);
    if (i % 5) return;
    const g = G.Vehicles.groundGaps().find((x) => x.id === v.id).gap;
    if (Math.abs(g) > Math.abs(worst)) worst = g;
  });
  window.__kq.input("up", false);
  G.Vehicles.press("vehicle:exit");
  T.frames(90);
  return { id: v.id, worst };
}

/** Browser-side: walk the hero straight at the middle of a parked car's side for 3 s; how deep did he get? */
function walkIntoCar(nth) {
  const G = window.KQ.Game;
  const T = window.__vg;
  G.Vehicles.returnAll();
  const v = G.Vehicles.debug().list.filter((x) => x.kind === "car")[nth];
  const col = G.S.world.colliders.find((c) => c.vehicle === v.id);
  const side = [Math.cos(v.heading), -Math.sin(v.heading)];
  window.__kq.place(v.x + side[0] * 2.4, v.z + side[1] * 2.4, 0);
  G.Camera.state.yaw = Math.atan2(-side[0], -side[1]);
  G.Camera.state.idle = -999;
  window.__kq.input("up", true);
  let deepest = Infinity;
  T.frames(90, function () {
    G.Camera.state.yaw = Math.atan2(-side[0], -side[1]);
    const p = window.__kq.state().pos;
    deepest = Math.min(deepest, Math.abs(T.local(v, p.x, p.z).lat));
  });
  window.__kq.input("up", false);
  return {
    id: v.id,
    deepest,
    hw: col.obb.hx,
    oriented: Boolean(col.obb),
    cols: G.S.world.colliders.filter((c) => c.vehicle === v.id).length,
  };
}

/** Browser-side: does a person-sized circle at the middle of each car (and at its side, mid-length) hit it? */
function bodyChecks() {
  const G = window.KQ.Game;
  G.Vehicles.returnAll();
  const cols = G.S.world.colliders;
  return G.Vehicles.debug()
    .list.filter((v) => v.kind === "car")
    .map(function (v) {
      const side = [Math.cos(v.heading), -Math.sin(v.heading)];
      const at = (k) => G.Collide.blockedAt(cols, v.x + side[0] * k, v.z + side[1] * k, 0.31);
      const mid = at(0);
      const flank = at(0.9);
      return {
        id: v.id,
        middle: Boolean(mid && mid.vehicle),
        flank: Boolean(flank && flank.vehicle),
      };
    });
}

/**
 * Browser-side: park a second car 8 m in front of car A (same lane, same way), drive A at it at full throttle.
 * A must stop (the bump counter rises, its speed drops to 0) and its nose never gets into B's body: `clear` is
 * the smallest distance from the centre of A's front ring (1.08 m ahead of its middle) to B's rear face.
 */
function driveIntoParked() {
  const G = window.KQ.Game;
  const T = window.__vg;
  G.Vehicles.returnAll();
  T.clearStreets();
  const a = G.Vehicles.debug().list.filter((x) => x.kind === "car")[0];
  const f = [Math.sin(a.heading), Math.cos(a.heading)];
  const spot = { kind: "car", x: a.x + f[0] * 8, z: a.z + f[1] * 8, heading: a.heading };
  const id = G.Vehicles.spawn(Object.assign(spot, { color: 0x3366cc }));
  const b = G.S.world.colliders.find((c) => c.vehicle === id).obb;
  const before = G.Vehicles.debug().bumped;
  G.Vehicles.press("vehicle:" + a.id);
  T.frames(3);
  window.__kq.input("up", true);
  const out = { id, clear: Infinity, top: 0, stopped: null };
  T.frames(150, function () {
    const now = G.Vehicles.debug();
    const me = now.list.find((x) => x.id === a.id);
    out.top = Math.max(out.top, me.speed);
    if (now.bumped > before && out.stopped === null) out.stopped = me.speed;
    const dx = me.x + Math.sin(me.heading) * 1.08 - b.x;
    const dz = me.z + Math.cos(me.heading) * 1.08 - b.z;
    out.clear = Math.min(out.clear, -(dx * b.s + dz * b.c) - b.hz);
  });
  window.__kq.input("up", false);
  out.bumped = G.Vehicles.debug().bumped - before;
  G.Vehicles.press("vehicle:exit");
  T.frames(90);
  return out;
}

/** Browser-side (sources of tryOne and camCheck passed in as text): top speed and smoothness of a kind on a clear street, and the camera behind it. */
function topSpeed([kind, tryOneSource, camCheckSource]) {
  const G = window.KQ.Game;
  const T = window.__vg;
  window.camCheck = new Function("return (" + camCheckSource + ")")();
  const tryOne = new Function("return (" + tryOneSource + ")")();
  G.Vehicles.returnAll();
  T.clearStreets();
  const list = G.Vehicles.debug().list.filter((x) => x.kind === kind);
  let best = { top: 0 };
  for (let i = 0; i < list.length && best.top < G.Player.RUN * 3; i += 1) {
    const run = tryOne(G, T, list[i]);
    if (run.top > best.top) best = run;
  }
  return Object.assign(best, {
    run: G.Player.RUN,
    maxFwd: window.KQ.Sim.Vehicle.SPECS[kind].maxFwd,
  });
}

/** One full-throttle run of 5 s: the top speed, the largest one-frame jump in speed, the camera's place. */
function tryOne(G, T, v) {
  G.Vehicles.returnAll();
  window.__kq.place(v.x + Math.cos(v.heading) * 1.6, v.z - Math.sin(v.heading) * 1.6, 0);
  T.frames(2);
  G.Vehicles.press("vehicle:" + v.id);
  T.frames(3);
  window.__kq.input("up", true);
  const out = { id: v.id, top: 0, jump: 0, at05: null, camBehind: 1, camDist: 0 };
  let last = 0;
  T.frames(150, function (i) {
    const me = G.Vehicles.debug().list.find((x) => x.id === v.id);
    out.top = Math.max(out.top, me.speed);
    out.jump = Math.max(out.jump, me.speed - last); // speeding up only (a wall may slow it at once)
    last = me.speed;
    if (i === 14) out.at05 = me.speed;
    if (i > 90 && me.speed > 3) window.camCheck(G, me, out);
  });
  window.__kq.input("up", false);
  G.Vehicles.press("vehicle:exit");
  T.frames(90);
  return out;
}

/** How far behind the vehicle the camera is (dot of its offset with the heading: -1 = right behind). */
function camCheck(G, me, out) {
  const cam = G.S.camera.position;
  const dx = cam.x - me.x;
  const dz = cam.z - me.z;
  const d = Math.hypot(dx, dz);
  const dot = (dx * Math.sin(me.heading) + dz * Math.cos(me.heading)) / Math.max(d, 1e-6);
  out.camBehind = Math.min(out.camBehind, -dot);
  out.camDist = Math.max(out.camDist, d);
}

/** AC-P11 in the kampung: parked and driven vehicles stand on the ground. */
function groundTests(getPage) {
  test("AC-P11: every parked vehicle rests its wheels on the ground (within 3 cm)", async () => {
    const rows = await kq(getPage(), parkedGaps);
    expect(rows.length).toBeGreaterThan(20);
    const bad = rows.filter((r) => Math.abs(r.gap) > 0.03);
    expect(bad, JSON.stringify(bad)).toEqual([]);
  });

  test("AC-P11: a car, a bicycle and a scooter stay on the ground while driven", async () => {
    for (const kind of ["car", "bike", "moto"]) {
      const r = await kq(getPage(), drivenGaps, [kind, 4]);
      expect(Math.abs(r.worst), kind + " " + JSON.stringify(r)).toBeLessThanOrEqual(0.03);
    }
  });
}

/** AC-P12 and AC-P13 in the kampung: solid bodies, a driven car stops at a parked one, speeds, camera. */
function solidAndFastTests(getPage) {
  test("AC-P12: every car is one solid body: its middle and its flank block a person", async () => {
    const rows = await kq(getPage(), bodyChecks);
    expect(rows.length).toBeGreaterThan(5);
    rows.forEach((r) =>
      expect(r, JSON.stringify(r)).toEqual({ id: r.id, middle: true, flank: true }),
    );
  });

  test("AC-P12: the hero walking at the middle of a parked car stops at its side", async () => {
    for (const nth of [0, 3]) {
      const r = await kq(getPage(), walkIntoCar, nth);
      expect(r.oriented, JSON.stringify(r)).toBe(true);
      expect(r.cols, "one collider per vehicle").toBe(1);
      expect(r.deepest, JSON.stringify(r)).toBeGreaterThan(r.hw + 0.33 - 0.03);
    }
  });

  test("AC-P12: a driven car stops at a parked one and never drives into it", async () => {
    const r = await kq(getPage(), driveIntoParked);
    const why = JSON.stringify(r);
    expect(r.id, "the second car was parked: " + why).toBeTruthy();
    expect(r.top, "it got going first: " + why).toBeGreaterThan(3);
    expect(r.bumped, "it touched the parked car: " + why).toBeGreaterThan(0);
    expect(r.stopped, "and stopped dead: " + why).toBe(0);
    expect(r.clear, "without its body getting into the other: " + why).toBeGreaterThan(0.6);
  });

  test("AC-P13: top speeds beat the hero's run (car 2.5x, scooter 2x, bicycle 1.5x), smoothly, camera behind", async () => {
    const want = { car: 2.5, moto: 2, bike: 1.5 };
    for (const kind of ["car", "moto", "bike"]) {
      const r = await kq(getPage(), topSpeed, [kind, tryOne.toString(), camCheck.toString()]);
      const why = kind + " " + JSON.stringify(r);
      expect(r.maxFwd / r.run, why).toBeGreaterThanOrEqual(want[kind]);
      expect(r.top / r.run, why).toBeGreaterThanOrEqual(want[kind]);
      expect(r.at05, "no instant jump to top speed: " + why).toBeLessThan(r.maxFwd * 0.5);
      expect(r.jump, "smooth acceleration: " + why).toBeLessThan(0.5);
      expect(r.camBehind, "the camera stays behind: " + why).toBeGreaterThan(0.6);
      expect(r.camDist, "and keeps up: " + why).toBeLessThan(9);
    }
  });
}

test.describe("kampung", () => {
  test.describe.configure({ mode: "serial", timeout: 240_000 });
  let page;
  test.beforeAll(async ({ browser }) => {
    test.setTimeout(150_000);
    page = await browser.newPage({ viewport: { width: 1000, height: 640 } });
    page.on("pageerror", (e) => console.log("PAGEERROR", e.message));
    await boot(page, "kampung");
  });
  test.afterAll(async () => page && (await page.close()));

  groundTests(() => page);
  solidAndFastTests(() => page);
});

test.describe("haramain", () => {
  test.describe.configure({ mode: "serial", timeout: 240_000 });
  let page;
  test.beforeAll(async ({ browser }) => {
    test.setTimeout(150_000);
    page = await browser.newPage({ viewport: { width: 1000, height: 640 } });
    page.on("pageerror", (e) => console.log("PAGEERROR", e.message));
    await boot(page, "haramain");
  });
  test.afterAll(async () => page && (await page.close()));

  test("AC-P11: every parked vehicle in Makkah and Madinah rests on the ground (within 3 cm)", async () => {
    const rows = await kq(page, parkedGaps);
    expect(rows.length).toBeGreaterThan(80);
    const bad = rows.filter((r) => Math.abs(r.gap) > 0.03);
    expect(bad, JSON.stringify(bad)).toEqual([]);
  });

  test("AC-P11: a car and a scooter stay on the ground while driven in Makkah", async () => {
    for (const kind of ["car", "moto"]) {
      const r = await kq(page, drivenGaps, [kind, 3]);
      expect(Math.abs(r.worst), kind + " " + JSON.stringify(r)).toBeLessThanOrEqual(0.03);
    }
  });
});
