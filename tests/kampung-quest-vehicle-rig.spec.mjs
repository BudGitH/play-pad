// Kampung Quest: every built vehicle carries the rig the game layer drives it through (js/figures/vehicle-rig.js):
// doors that open and close (a car door is cut out of the body only while open), seats inside the body, lights as
// emissive uniforms (brake, head, indicators, reverse), an exhaust set by fuel, a visible interior; bicycles pedal,
// scooters fold their stand, riders can wear a helmet. Owner's realism pass, features/kampung-quest-playability/
// notes-vehicles.md ("Realism pass"). The page runs `?still=1&q=low`.
// Run: npx playwright test tests/kampung-quest-vehicle-rig.spec.mjs --project=kampung-quest
import { test, expect } from "@playwright/test";

const BASE = "/games/kampung-quest/index.html?still=1&autoq=0&q=low";
const kq = (page, fn, arg) => page.evaluate(fn, arg);

async function boot(page) {
  await page.goto(BASE);
  await expect.poll(() => kq(page, () => window.__kq?.loaded), { timeout: 90_000 }).toBe(true);
  await page.locator("#kq button.primary").first().click();
  await expect.poll(() => kq(page, () => window.__kq.ready), { timeout: 30_000 }).toBe(true);
  await kq(page, () => window.__kq.step(300));
}

/** Browser-side: is every seat inside the vehicle's body box (footprint, ground to the body's top)? */
function seatsInside(v) {
  const box = new window.THREE.Box3().setFromObject(
    v.group.getObjectByName("body") || v.group.getObjectByName("frame"),
  );
  box.applyMatrix4(v.group.matrixWorld.clone().invert());
  const f = v.foot;
  const inside = (p) =>
    Math.abs(p.x) < f.hw && Math.abs(p.z - f.mid) < f.hl && p.y > 0 && p.y < box.max.y;
  return (v.rig.seats || []).every((s) => inside(s.pos));
}

/** Browser-side: is every door record complete (side, a seat it serves, a pivot, open())? */
function doorsComplete(r) {
  const seat = (d) => Number.isInteger(d.seat) && d.seat >= 0 && d.seat < r.seats.length;
  const side = (d) => d.side === "L" || d.side === "R";
  const ok = (d) => side(d) && d.pivot && d.pivot.isObject3D && typeof d.open === "function";
  return (r.doors || []).every((d) => ok(d) && seat(d));
}

/** Browser-side: install window.__rig = { all() } plus the two checks above (passed as source text). */
function installHelpers(src) {
  const all = () => {
    const out = [];
    const S = window.KQ.Game.S;
    S.scene.traverse((o) => o.userData && o.userData.vehicle && out.push(o.userData.vehicle));
    return out;
  };
  const load = (code) => new Function("return (" + code + ")")();
  window.__rig = { all, seatsInside: load(src[0]), doorsComplete: load(src[1]) };
}

/** Browser-side: the rig's shape for every vehicle (one row each). */
function rigShapes() {
  const fn = (x) => typeof x === "function";
  const T = window.__rig;
  return T.all().map(function (v) {
    const r = v.rig || {};
    const L = r.lights || {};
    const seats = r.seats || [];
    return {
      kind: v.kind,
      style: v.style,
      doors: (r.doors || []).length,
      doorsOk: T.doorsComplete(r),
      seats: seats.length,
      seatKinds: [...new Set(seats.map((s) => s.kind))],
      seatsVec: seats.every((s) => s.pos && s.pos.isVector3 && Number.isFinite(s.heading)),
      seatsIn: T.seatsInside(v),
      lights: ["setBrake", "setHead", "setIndicator", "setReverse"].every((k) => fn(L[k])),
      fuel: r.exhaust ? r.exhaust.fuel : null,
      pipe: r.exhaust && r.exhaust.pos ? [r.exhaust.pos.z, v.foot.mid - v.foot.hl] : null,
      interior: Boolean(r.interior),
      twoWheel: fn(r.wheels) && fn(r.steer),
      pedals: fn(r.pedals),
      stand: fn(r.kickstand),
      helmet: Boolean(r.helmet && fn(r.helmet.wear)),
    };
  });
}

/** Browser-side: open and shut every door of one vehicle of a kind; the door moves, the body is cut and restored. */
function doorCycle(kind) {
  const v = window.__rig.all().find((x) => x.kind === kind);
  const body = v.group.getObjectByName("body");
  const tris = () => body.geometry.index.count / 3;
  const meshes = () => {
    let n = 0;
    v.group.traverse((o) => o.isMesh && o.visible && (n += 1));
    return n;
  };
  const shut = { tris: tris(), meshes: meshes() };
  const moved = v.rig.doors.map(function (d) {
    const r0 = d.pivot.rotation.y;
    const p0 = d.pivot.position.clone();
    const l0 = d.pivot.children.map((c) => [c.rotation.y, c.position.x, c.position.z].join());
    d.open(1);
    const l1 = d.pivot.children.map((c) => [c.rotation.y, c.position.x, c.position.z].join());
    const out = {
      turned: Math.abs(d.pivot.rotation.y - r0),
      slid: d.pivot.position.distanceTo(p0),
      leaves: l0.some((s, i) => s !== l1[i]),
      parts: d.pivot.children.length,
    };
    out.cut = tris();
    d.open(0);
    out.back = Math.abs(d.pivot.rotation.y - r0) < 1e-6 && d.pivot.position.distanceTo(p0) < 1e-6;
    return out;
  });
  return { shut, moved, after: { tris: tris(), meshes: meshes() } };
}

/** Browser-side: toggle the lights of one vehicle of a kind and read the lamp levels (emissive uniforms). */
function lightCycle(kind) {
  const v = window.__rig.all().find((x) => x.kind === kind);
  const L = v.rig.lights;
  const lv = () => v.rig.lights.state().levels;
  const u = () => v.trimMat.userData.uLampA.value.w;
  const out = { off: lv(), uOff: u() };
  L.setBrake(true);
  out.brake = lv();
  out.uBrake = u();
  L.setBrake(false);
  L.setHead(true);
  out.head = lv();
  L.setHead(false);
  L.setIndicator("L", 0.1);
  out.indOn = lv();
  L.setIndicator("L", 0.5);
  out.indOff = lv();
  L.setIndicator(null);
  L.setReverse(true);
  out.reverse = lv();
  L.setReverse(false);
  out.end = lv();
  return out;
}

/** Browser-side: brake lamps follow the speed handed to animate (slowing down, then stopped with a driver). */
function autoBrake() {
  const F = window.KQ.Figures.Vehicles;
  const v = window.__rig.all().find((x) => x.kind === "car");
  F.setOccupied(v, true);
  F.animate(v, 0.1, 5, 0);
  F.animate(v, 0.1, 5, 0);
  const cruising = v.rig.lights.state().levels[3];
  F.animate(v, 0.1, 3, 0);
  const slowing = v.rig.lights.state().levels[3];
  for (let i = 0; i < 10; i += 1) F.animate(v, 0.1, 0, 0);
  const stopped = v.rig.lights.state().levels[3];
  F.animate(v, 0.1, -1, 0);
  const reverse = v.rig.lights.state().levels[6];
  F.setOccupied(v, false);
  return { cruising, slowing, stopped, reverse, parked: v.rig.lights.state().levels[3] };
}

/** Browser-side: pedal a bicycle, fold a scooter's stand, steer and spin; put a helmet on the hero and take it off. */
function twoWheelers() {
  const all = window.__rig.all();
  const bike = all.find((x) => x.kind === "bike");
  const moto = all.find((x) => x.kind === "moto");
  bike.rig.pedals(1.2);
  bike.rig.wheels(0.7);
  bike.rig.steer(0.2);
  const crank = bike.group.getObjectByName("crank");
  const trim0 = moto.group.getObjectByName("trim").geometry;
  moto.rig.kickstand(false);
  const up = {
    stand: moto.rig.stand,
    changed: moto.group.getObjectByName("trim").geometry !== trim0,
  };
  moto.rig.kickstand(true);
  const hero = window.KQ.Game.S.player.group;
  const acc = hero.userData.rig.accessory;
  const worn = moto.rig.helmet.wear(hero);
  const wearing = {
    worn,
    hidden: !acc.visible,
    on: Boolean(moto.rig.helmet.mesh() && moto.rig.helmet.mesh().parent),
  };
  moto.rig.helmet.remove(hero);
  return {
    crank: crank ? crank.rotation.x : null,
    wheel: bike.wheels[0].rotation.x,
    fork: bike.pivots[0].rotation.y,
    up,
    down: moto.rig.stand,
    wearing,
    off: acc.visible && !moto.rig.helmet.mesh().parent,
  };
}

let page;
test.describe.configure({ mode: "serial" });
test.beforeAll(async ({ browser }) => {
  page = await browser.newPage();
  page.on("pageerror", (e) => console.log("pageerror", e.message));
  await boot(page);
  await kq(page, installHelpers, [seatsInside.toString(), doorsComplete.toString()]);
});
test.afterAll(async () => page && page.close());

test("every vehicle has the rig: doors, seats inside the body, lights, exhaust by fuel, interior", async () => {
  const rows = await kq(page, rigShapes);
  const kinds = new Set(rows.map((r) => r.kind));
  expect([...kinds].sort()).toEqual(["bike", "bus", "car", "lorry", "moto"]);
  for (const r of rows) {
    const why = JSON.stringify(r);
    expect(r.lights, "lights: " + why).toBe(true);
    expect(r.interior, "interior: " + why).toBe(true);
    expect(r.seatsVec, "seat records: " + why).toBe(true);
    expect(r.seatsIn, "seats inside the body box: " + why).toBe(true);
    expect(r.seats, why).toBeGreaterThan(0);
    expect(r.doorsOk, "door records: " + why).toBe(true);
    if (r.kind === "car") {
      expect(r.doors, why).toBe(4);
      expect(r.seatKinds, why).toEqual(["driver", "front", "rear"]);
      expect(["petrol", "electric"], why).toContain(r.fuel);
      if (r.fuel === "petrol")
        expect(r.pipe[0], "pipe at the tail: " + why).toBeLessThan(r.pipe[1] + 0.2);
      else expect(r.pipe, "an electric car has no pipe: " + why).toBeNull();
    }
    if (r.kind === "bus")
      expect([r.doors, r.fuel, r.seatKinds.includes("bus")], why).toEqual([2, "diesel", true]);
    if (r.kind === "lorry") expect([r.doors, r.fuel], why).toEqual([2, "diesel"]);
    if (r.kind === "moto")
      expect([r.fuel, r.stand, r.helmet, r.twoWheel], why).toEqual(["petrol", true, true, true]);
    if (r.kind === "bike") expect([r.fuel, r.pedals, r.twoWheel], why).toEqual([null, true, true]);
  }
  const fuels = rows.filter((r) => r.kind === "car").map((r) => r.fuel);
  expect(
    fuels.filter((f) => f === "electric").length,
    "a couple of electric cars",
  ).toBeGreaterThanOrEqual(2);
  expect(fuels.filter((f) => f === "petrol").length).toBeGreaterThan(4);
});

test("car doors swing open about 65 degrees and close; the body is cut only while a door is open", async () => {
  const r = await kq(page, doorCycle, "car");
  for (const d of r.moved) {
    const why = JSON.stringify(d);
    expect(d.turned > 1.0 || d.slid > 0.5, "the door moved: " + why).toBe(true);
    if (d.turned > 0) expect(d.turned, why).toBeCloseTo((65 * Math.PI) / 180, 2);
    expect(d.parts, "the door's own meshes while open: " + why).toBeGreaterThan(0);
    expect(d.cut, "the body lost the door's skin: " + why).toBeLessThan(r.shut.tris);
    expect(d.back, "shut again: " + why).toBe(true);
  }
  expect(r.after, "merged back: same triangles and meshes").toEqual(r.shut);
});

test("lorry cab doors and bus fold / slide doors open and close", async () => {
  const lorry = await kq(page, doorCycle, "lorry");
  lorry.moved.forEach((d) =>
    expect(d.turned, JSON.stringify(d)).toBeCloseTo((65 * Math.PI) / 180, 2),
  );
  expect(lorry.after).toEqual(lorry.shut);
  const bus = await kq(page, doorCycle, "bus");
  bus.moved.forEach((d) => expect(d.leaves, "the leaves moved: " + JSON.stringify(d)).toBe(true));
});

test("brake, head, indicator and reverse lamps change the trim's emissive levels", async () => {
  for (const kind of ["car", "bus", "lorry", "moto"]) {
    const r = await kq(page, lightCycle, kind);
    const why = kind + " " + JSON.stringify(r);
    expect(r.off[3], why).toBe(0);
    expect(r.brake[3], why).toBe(1);
    expect(r.uBrake, "the uniform itself: " + why).toBe(1);
    expect(r.head[0], why).toBe(1);
    expect(r.head[2], "tail lamps glow with the head lamps: " + why).toBeGreaterThan(0);
    expect(r.indOn[4], why).toBe(1);
    expect(r.indOff[4], "the indicator blinks: " + why).toBe(0);
    expect(r.reverse[6], why).toBe(1);
    expect(r.end.slice(0, 7), "all off again: " + why).toEqual([0, 0, 0, 0, 0, 0, 0]);
  }
});

test("brake lamps light while slowing and stopped with a driver, reverse lamps going back", async () => {
  const r = await kq(page, autoBrake);
  expect(r).toEqual({ cruising: 0, slowing: 1, stopped: 1, reverse: 1, parked: 0 });
});

test("bicycles pedal, steer and spin; scooters fold their stand; a rider can wear a helmet", async () => {
  const r = await kq(page, twoWheelers);
  expect(r.crank).toBeCloseTo(1.2, 5);
  expect(r.wheel).toBeCloseTo(0.7, 5);
  expect(r.fork).toBeCloseTo(0.2, 5);
  expect(r.up).toEqual({ stand: "up", changed: true });
  expect(r.down).toBe("down");
  expect(r.wearing).toEqual({ worn: true, hidden: true, on: true });
  expect(r.off).toBe(true);
});
