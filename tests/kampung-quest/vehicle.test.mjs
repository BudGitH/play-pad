// The pure driving rules (js/sim/vehicle.js): speed follows the stick, turning, reversing, braking for
// people (a vehicle never reaches anyone), and the no-drive zones (mosque, mataf) in every shape the
// world code may give them. AC-H6 (features/kampung-quest-haramain/requirements.md).
import test from "node:test";
import assert from "node:assert/strict";
import { loadSim, plain } from "./load-sim.mjs";

const { Vehicle: Veh } = loadSim(["vehicle"]).Sim;
const DT = 1 / 30;

/** Drive for `secs` with a constant stick; people are given as a list or a function of the vehicle. */
function drive(v, move, secs, people) {
  for (let i = 0; i < Math.round(secs / DT); i += 1) {
    Veh.stepSpeed(v, Veh.throttleOf(move), DT);
    Veh.stepHeading(v, Veh.steerOf(move), DT);
    const list = typeof people === "function" ? people(v) : people || [];
    Veh.brakeFor(v, Veh.speedCap(v, list), DT);
    Veh.advance(v, DT);
  }
  return v;
}

test("a car accelerates gently to its top speed and never beyond", () => {
  const v = Veh.create("car", 0, 0, 0);
  drive(v, { x: 0, y: 1 }, 0.5);
  assert.ok(v.speed > 1 && v.speed < v.spec.maxFwd, "still speeding up after half a second");
  drive(v, { x: 0, y: 1 }, 6);
  assert.equal(v.speed, v.spec.maxFwd);
});

test("the bicycle is faster than the hero can run, the car faster still", () => {
  const RUN = 4.4;
  assert.ok(Veh.SPECS.bike.maxFwd > RUN);
  assert.ok(Veh.SPECS.car.maxFwd > Veh.SPECS.bike.maxFwd);
});

test("heading 0 faces +z and a push to the right turns right (the heading shrinks)", () => {
  const v = Veh.create("car", 0, 0, 0);
  drive(v, { x: 0, y: 1 }, 1);
  assert.ok(v.z > 0 && Math.abs(v.x) < 1e-9, "went +z");
  const h0 = v.heading;
  drive(v, { x: 1, y: 1 }, 1);
  assert.ok(v.heading < h0, "turned right");
  const w = Veh.create("car", 0, 0, 0);
  drive(w, { x: 0, y: 1 }, 1);
  drive(w, { x: -1, y: 1 }, 1);
  assert.ok(w.heading > 0, "turned left");
});

test("a standing car cannot spin on the spot; a bicycle can wobble round slowly", () => {
  const car = Veh.create("car", 0, 0, 0);
  drive(car, { x: 1, y: 0 }, 1);
  assert.equal(car.heading, 0);
  const bike = Veh.create("bike", 0, 0, 0);
  drive(bike, { x: 1, y: 0 }, 1);
  assert.ok(bike.heading < 0 && bike.heading > -1.2);
});

test("pushing back brakes first, then reverses slowly; reversing flips the steering", () => {
  const v = Veh.create("car", 0, 0, 0);
  drive(v, { x: 0, y: 1 }, 3);
  const before = v.speed;
  drive(v, { x: 0, y: -1 }, 0.3);
  assert.ok(v.speed < before, "braking");
  drive(v, { x: 0, y: -1 }, 3);
  assert.equal(v.speed, -v.spec.maxRev);
  const h = v.heading;
  drive(v, { x: 1, y: -1 }, 1);
  assert.ok(v.heading > h, "reversing with the wheel right swings the heading the other way");
});

test("letting go rolls to a halt; a resting thumb does not creep", () => {
  const v = Veh.create("car", 0, 0, 0);
  drive(v, { x: 0, y: 1 }, 3);
  drive(v, { x: 0, y: 0 }, 6);
  assert.equal(v.speed, 0);
  drive(v, { x: 0.05, y: 0.08 }, 1);
  assert.equal(v.speed, 0);
});

test("stopGently brings a moving vehicle to a standstill without reversing", () => {
  const v = Veh.create("car", 0, 0, 0);
  v.speed = 7;
  for (let i = 0; i < 200 && v.speed !== 0; i += 1) Veh.stopGently(v, DT);
  assert.equal(v.speed, 0);
});

test("a person standing in the road: the car stops short and never reaches them", () => {
  const v = Veh.create("car", 0, 0, 0);
  const person = { x: 0.1, z: 30 };
  let closest = Infinity;
  drive(v, { x: 0, y: 1 }, 12, (car) => {
    closest = Math.min(closest, person.z - (car.z + car.spec.halfLen));
    return [person];
  });
  assert.ok(closest > 0.3, "bumper stayed clear: " + closest.toFixed(2) + " m");
  assert.ok(v.speed < 0.05, "came to a stop");
});

test("a bicycle also stops for a person, and a person at the side does not stop it", () => {
  const v = Veh.create("bike", 0, 0, 0);
  drive(v, { x: 0, y: 1 }, 10, [{ x: 0, z: 20 }]);
  assert.ok(v.speed < 0.05 && v.z < 20 - v.spec.halfLen);
  const w = Veh.create("bike", 0, 0, 0);
  drive(w, { x: 0, y: 1 }, 5, [{ x: 4, z: 10 }]);
  assert.equal(w.speed, w.spec.maxFwd, "someone 4 m to the side never slows it");
});

test("reversing stops for someone behind, driving forward ignores them", () => {
  const v = Veh.create("car", 0, 0, 0);
  drive(v, { x: 0, y: 1 }, 1, [{ x: 0, z: -5 }]);
  assert.ok(v.speed > 3, "a person behind does not slow a forward car");
  const r = Veh.create("car", 0, 0, 0);
  r.speed = -2;
  drive(r, { x: 0, y: -1 }, 8, [{ x: 0, z: -6 }]);
  assert.ok(Math.abs(r.speed) < 0.05 && r.z > -6 + r.spec.halfLen);
});

test("a person alongside holds the vehicle still (nothing is ever pushed or hit)", () => {
  const v = Veh.create("car", 0, 0, 0);
  const cap = Veh.speedCap(v, [{ x: 0.9, z: 0.2 }]);
  assert.equal(cap, 0);
  assert.equal(Veh.speedCap(v, []), Infinity);
});

test("braking is firm, not instant: a car at full speed stops over a few metres", () => {
  const v = Veh.create("car", 0, 0, 0);
  v.speed = 7.5;
  const cap = Veh.speedCap(v, [{ x: 0, z: 5 }]);
  assert.ok(cap > 0 && cap < 7.5);
  assert.equal(Veh.brakeFor(v, cap, DT), true);
  assert.ok(v.speed < 7.5 && v.speed > 5, "one frame of braking is small");
});

test("no-drive zones accept every shape the world code uses; junk is dropped", () => {
  const zones = Veh.normalizeZones([
    { x: 0, z: 0, r: 30, say: "circle" },
    { x0: 10, x1: 20, z0: 10, z1: 20 },
    { minX: 30, maxX: 40, minZ: 30, maxZ: 40 },
    { x: 100, z: 100, w: 20, d: 10 },
    { x: NaN, z: 0, r: 5 },
    null,
    "nope",
    { x: 1, z: 2 },
  ]);
  assert.equal(zones.length, 4);
  assert.equal(zones[0].say, "circle");
  assert.equal(zones[3].minX, 90);
  assert.equal(zones[3].maxZ, 105);
  assert.deepEqual(plain(Veh.normalizeZones(undefined)), []);
});

test("a vehicle may not drive into a zone, but may always drive back out of one", () => {
  const zones = Veh.normalizeZones([{ x: 0, z: 0, r: 26, say: "Let's walk inside the masjid" }]);
  const hit = Veh.blockedMove(zones, 40, 0, 20, 0, 0.7);
  assert.ok(hit && hit.say === "Let's walk inside the masjid");
  assert.equal(Veh.blockedMove(zones, 40, 0, 30, 0, 0.7), null, "outside the circle plus the body");
  assert.equal(Veh.blockedMove(zones, 5, 0, 20, 0, 0.7), null, "already inside: free to leave");
});

test("rectangular zones count the body radius too", () => {
  const zones = Veh.normalizeZones([{ x0: 0, x1: 10, z0: 0, z1: 10 }]);
  assert.ok(Veh.blockedMove(zones, -2, 5, -0.5, 5, 0.78));
  assert.equal(Veh.blockedMove(zones, -3, 5, -1, 5, 0.78), null);
});

test("the numbers stay finite under odd input", () => {
  const v = Veh.create("car", 0, 0, 0);
  drive(v, { x: NaN, y: Infinity }, 1);
  drive(v, null, 1);
  assert.ok([v.x, v.z, v.heading, v.speed].every(Number.isFinite));
  assert.equal(Veh.create("tank", 0, 0, 0), null);
});
