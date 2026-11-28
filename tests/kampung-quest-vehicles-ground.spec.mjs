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

const BASE = "/games/kampung-quest/index.html?still=1&autoq=0&q=low&enter=0";
const kq = (page, fn, arg) => page.evaluate(fn, arg);

/** How many vehicles were already placed when the loading screen finished (before Start), per region. */
const placedAtLoad = {};

async function boot(page, region) {
  await page.goto(BASE + (region === "haramain" ? "&region=haramain" : ""));
  await expect.poll(() => kq(page, () => window.__kq?.loaded), { timeout: 90_000 }).toBe(true);
  placedAtLoad[region] = await kq(page, () => window.__kq.vehicles().list.length);
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
  window.__kq.place(v.x + side[0] * 2.4, v.z + side[1] * 2.4, 0, true);
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
  window.__kq.place(v.x + Math.cos(v.heading) * 1.6, v.z - Math.sin(v.heading) * 1.6, 0, true);
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

/**
 * Browser-side: every parked car's roof is drawn, solid and as long as the cabin top; mounting one car fades only
 * that car's roof, getting out makes it solid again. Returns the counts.
 */
function roofCheck() {
  const G = window.KQ.Game;
  const roofs = () => {
    const out = [];
    G.S.scene.traverse((m) => m.name === "roof" && out.push(m));
    return out;
  };
  const solid = (m) => m.visible && m.material.opacity === 1 && !m.material.transparent;
  const length = (m) => {
    m.geometry.computeBoundingBox();
    return m.geometry.boundingBox.max.z - m.geometry.boundingBox.min.z;
  };
  G.Vehicles.returnAll();
  const all = roofs();
  const parked = { roofs: all.length, solid: all.filter(solid).length };
  parked.shortest = Math.min(...all.map(length));
  const car = G.Vehicles.debug().list.find((v) => v.kind === "car");
  G.Vehicles.press("vehicle:" + car.id);
  window.__vg.frames(3);
  const driving = { faded: roofs().filter((m) => !solid(m)).length };
  G.Vehicles.press("vehicle:exit");
  window.__vg.frames(60);
  const after = { solid: roofs().filter(solid).length };
  return { parked, driving, after };
}

/** AC-P11 in the kampung: parked and driven vehicles stand on the ground. */
function groundTests(getPage) {
  test("vehicles are placed while loading (before Start), and every parked car has a solid roof", async () => {
    expect(placedAtLoad.kampung, "placed behind the loading bar").toBeGreaterThan(20);
    const r = await kq(getPage(), roofCheck);
    const why = JSON.stringify(r);
    expect(r.parked.roofs, why).toBeGreaterThanOrEqual(10);
    expect(r.parked.solid, "every parked roof is solid: " + why).toBe(r.parked.roofs);
    expect(r.parked.shortest, "each roof covers the cabin top: " + why).toBeGreaterThan(0.9);
    expect(r.driving.faded, "only the driven car's roof fades: " + why).toBe(1);
    expect(r.after.solid, "solid again once parked: " + why).toBe(r.parked.roofs);
  });

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
    const want = { car: 2.5, moto: 2, bike: 1.5, lorry: 2 };
    for (const kind of ["car", "moto", "bike", "lorry"]) {
      const r = await kq(getPage(), topSpeed, [kind, tryOne.toString(), camCheck.toString()]);
      const why = kind + " " + JSON.stringify(r);
      expect(r.maxFwd / r.run, why).toBeGreaterThanOrEqual(want[kind]);
      expect(r.top / r.run, why).toBeGreaterThanOrEqual(want[kind]);
      expect(r.at05, "no instant jump to top speed: " + why).toBeLessThan(r.maxFwd * 0.5);
      expect(r.jump, "smooth acceleration: " + why).toBeLessThan(0.5);
      expect(r.camBehind, "the camera stays behind: " + why).toBeGreaterThan(0.6);
      expect(r.camDist, "and keeps up: " + why).toBeLessThan(kind === "lorry" ? 11.5 : 9);
    }
  });
}

/** Browser-side: run the town (up to `secs`) until the bus test `until(bus)` holds; returns the bus state. */
function runBus([secs, untilSource]) {
  const G = window.KQ.Game;
  const until = new Function("b", "return (" + untilSource + ")")();
  for (let i = 0; i < secs * 30; i += 1) {
    G.Loop.frame(1 / 30, true);
    if (until(G.Vehicles.debug().bus)) break;
  }
  return G.Vehicles.debug().bus;
}

/**
 * Browser-side: while the bus stands at the stop, walk the hero from the pavement straight at its middle for
 * 1.5 s. Returns how close his centre got to the bus's side (its centre line + half width), and whether the
 * bus's collider is one oriented box at the bus.
 */
function walkIntoBus() {
  const G = window.KQ.Game;
  const b = G.Vehicles.debug().bus;
  const col = G.S.world.colliders.find((c) => c.vehicle === "bus");
  window.__kq.place(b.x, b.z + 2.6, Math.PI, true);
  G.Camera.state.yaw = Math.PI;
  G.Camera.state.idle = -999;
  window.__kq.input("up", true);
  let nearest = Infinity;
  for (let i = 0; i < 45; i += 1) {
    G.Camera.state.yaw = Math.PI;
    G.Loop.frame(1 / 30, true);
    nearest = Math.min(nearest, window.__kq.state().pos.z - b.z);
  }
  window.__kq.input("up", false);
  return { nearest, hw: col.obb.hx, onBus: Math.abs(col.obb.x - b.x) < 0.1 };
}

/**
 * Browser-side: once the bus is driving out of the stop, stand the hero in its lane 14 m ahead; the bus must
 * slow and stop short of him (the gap between its nose and him stays positive) and never touch him.
 */
function busBrakesForHero() {
  const G = window.KQ.Game;
  const b = G.Vehicles.debug().bus;
  const ahead = b.x + b.dir * 14;
  window.__kq.place(ahead, b.z, 0, true);
  let gap = Infinity;
  for (let i = 0; i < 240; i += 1) {
    window.__kq.place(ahead, b.z, 0, true);
    G.Loop.frame(1 / 30, true);
    const now = G.Vehicles.debug().bus;
    gap = Math.min(gap, (ahead - now.x) * now.dir - 5.05);
  }
  const end = G.Vehicles.debug().bus;
  window.__kq.place(30, 8, 0, true);
  return { gap, speed: end.speed, braked: end.braked };
}

/** The bus: it loops, stops at the stop with its doors open, is solid, and brakes for the hero. */
function busTests(getPage) {
  test("the bus pulls in at the stop, opens its left doors, waits, then drives on", async () => {
    await kq(getPage(), () => window.__kq.place(30, 8, 0, true));
    const at = await kq(getPage(), runBus, [80, '(b) => b.state === "stop" && b.doors > 0.95']);
    const why = JSON.stringify(at);
    expect(at.state, why).toBe("stop");
    expect(Math.abs(at.x - at.stopX), "front door at the shelter: " + why).toBeLessThan(0.3);
    expect(at.z, "pulled in to the kerb (left-hand traffic): " + why).toBeGreaterThan(1.5);
    const solid = await kq(getPage(), walkIntoBus);
    expect(solid.onBus, JSON.stringify(solid)).toBe(true);
    expect(solid.nearest, "nobody walks into the bus: " + JSON.stringify(solid)).toBeGreaterThan(
      solid.hw + 0.33 - 0.04,
    );
    const away = await kq(getPage(), runBus, [12, '(b) => b.state === "drive" && b.speed > 2']);
    expect(away.state, JSON.stringify(away)).toBe("drive");
    expect(away.stops).toBeGreaterThanOrEqual(1);
  });

  test("the bus brakes for the hero standing in its lane and never touches him", async () => {
    const r = await kq(getPage(), busBrakesForHero);
    expect(r.gap, JSON.stringify(r)).toBeGreaterThan(0.3);
    expect(r.speed, JSON.stringify(r)).toBeLessThan(0.2);
    expect(r.braked).toBeGreaterThan(0);
  });

  test("the bus leaves town at the end of the road and comes back the other way", async () => {
    const before = await kq(getPage(), () => window.KQ.Game.Vehicles.debug().bus);
    const back = "(b) => b.runs > " + before.runs + " && b.state === 'drive'";
    const r = await kq(getPage(), runBus, [70, back]);
    const why = JSON.stringify({ before, r });
    expect(r.runs, why).toBe(before.runs + 1);
    expect(r.dir, "it comes back the other way: " + why).toBe(-before.dir);
    expect(Math.sign(r.z), "on its own left-hand lane: " + why).toBe(r.dir > 0 ? -1 : 1);
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
  busTests(() => page);
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
