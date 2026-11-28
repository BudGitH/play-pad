// The pure driving rules (js/sim/vehicle.js): speed follows the stick, turning, reversing, braking for
// people (a vehicle never reaches anyone), and the no-drive zones (mosque, mataf) in every shape the
// world code may give them. AC-H6 (features/kampung-quest-haramain/requirements.md).
import test from "node:test";
import assert from "node:assert/strict";
import { loadSim, loadCollide, plain } from "./load-sim.mjs";

const { Vehicle: Veh } = loadSim(["vehicle"]).Sim;
const Col = loadCollide();
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

test("the bicycle is faster than the hero can run, the scooter faster still, the car fastest", () => {
  const RUN = 4.4;
  assert.ok(Veh.SPECS.bike.maxFwd > RUN);
  assert.ok(Veh.SPECS.moto.maxFwd > Veh.SPECS.bike.maxFwd);
  assert.ok(Veh.SPECS.car.maxFwd > Veh.SPECS.moto.maxFwd);
});

test("every kind of vehicle is known, labelled Drive / Ride and has a body that fits its two rings", () => {
  assert.deepEqual(Object.keys(Veh.SPECS).sort(), ["bike", "bus", "car", "lorry", "moto"]);
  const LABEL = { car: "Drive", lorry: "Drive", bike: "Ride", moto: "Ride", bus: "" }; // the bus is never driven
  Object.entries(Veh.SPECS).forEach(([kind, spec]) => {
    assert.equal(spec.label, LABEL[kind]);
    assert.ok(spec.ring.off + spec.ring.r >= spec.halfLen - 0.1, kind + ": rings cover the length");
    assert.ok(spec.ring.r >= spec.halfWid - 0.05, kind + ": rings cover the width");
  });
});

test("a scooter accelerates, turns even when slow, reverses gently and is never faster than the car", () => {
  const v = Veh.create("moto", 0, 0, 0);
  drive(v, { x: 0, y: 1 }, 8);
  assert.equal(v.speed, v.spec.maxFwd);
  const h = v.heading;
  drive(v, { x: 1, y: 1 }, 1);
  assert.ok(v.heading < h, "pushing right turns right");
  const w = Veh.create("moto", 0, 0, 0);
  drive(w, { x: 0, y: -1 }, 4);
  assert.equal(w.speed, -w.spec.maxRev);
});

test("whatever the kind, a person in the road is never reached (car, scooter, bicycle)", () => {
  ["car", "moto", "bike"].forEach((kind) => {
    const v = Veh.create(kind, 0, 0, 0);
    let closest = Infinity;
    drive(v, { x: 0, y: 1 }, 12, (m) => {
      closest = Math.min(closest, 25 - (m.z + m.spec.halfLen));
      return [{ x: 0.1, z: 25 }];
    });
    assert.ok(closest > 0.3, kind + ": bumper stayed clear: " + closest.toFixed(2) + " m");
    assert.ok(v.speed < 0.05, kind + ": came to a stop");
  });
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

/* ------------- playability round: AC-P11 (ground), AC-P12 (solid bodies), AC-P13 (speeds) ------------- */

test("AC-P13: each vehicle is clearly worth taking over running (car 2.5x, scooter 2x, bicycle 1.5x)", () => {
  assert.equal(Veh.RUN, 4.4, "the yardstick is the hero's run (Player RUN)");
  assert.ok(Veh.SPECS.car.maxFwd >= 2.5 * Veh.RUN, "car");
  assert.ok(Veh.SPECS.moto.maxFwd >= 2 * Veh.RUN, "scooter");
  assert.ok(Veh.SPECS.bike.maxFwd >= 1.5 * Veh.RUN, "bicycle");
  const lorry = Veh.SPECS.lorry.maxFwd;
  assert.ok(
    lorry < Veh.SPECS.car.maxFwd && lorry > Veh.SPECS.bike.maxFwd,
    "the lorry: slower than a car, faster than a bike",
  );
});

test("AC-P13: top speed comes smoothly (no frame adds more than half a metre per second)", () => {
  ["car", "moto", "bike"].forEach((kind) => {
    const v = Veh.create(kind, 0, 0, 0);
    let last = 0;
    let jump = 0;
    for (let i = 0; i < 300; i += 1) {
      Veh.stepSpeed(v, 1, DT);
      jump = Math.max(jump, v.speed - last);
      last = v.speed;
    }
    assert.equal(v.speed, v.spec.maxFwd, kind + " reaches its top speed");
    assert.ok(jump < 0.5, kind + ": " + jump);
  });
});

test("AC-P13: a fast vehicle looks far enough ahead to ease down for anyone at the comfortable rate", () => {
  ["car", "moto", "bike"].forEach((kind) => {
    const s = Veh.SPECS[kind];
    assert.ok(Veh.lookAhead(s) >= (s.maxFwd * s.maxFwd) / (2 * 6.5) + s.halfLen, kind);
  });
  const v = Veh.create("car", 0, 0, 0);
  v.speed = v.spec.maxFwd;
  assert.ok(
    Veh.speedCap(v, [{ x: 0, z: 14 }]) < v.spec.maxFwd,
    "someone 14 m ahead already slows it",
  );
});

test("AC-P13: an animal's spec (it has `top`, not `maxFwd`) gives a finite look-ahead, so a ridden animal yields in time", () => {
  const { Mount } = loadSim(["vehicle", "mount"]).Sim;
  Object.keys(Mount.SPECS).forEach((kind) => {
    const s = Mount.SPECS[kind];
    const look = Veh.lookAhead(s);
    assert.ok(Number.isFinite(look), kind + " is not NaN");
    assert.ok(look >= (s.top * s.top) / (2 * 6.5) + s.halfLen, kind + " eases down in time");
  });
});

test("AC-P12: a parked vehicle's box is its body, turned with it", () => {
  const v = Veh.create("car", 10, 5, Math.PI / 2);
  const b = Veh.box(v, 0.1);
  assert.equal(b.hz, v.spec.halfLen + 0.1);
  assert.equal(b.hx, v.spec.halfWid + 0.1);
  assert.ok(Math.abs(b.s - 1) < 1e-9 && Math.abs(b.c) < 1e-9);
});

test("AC-P12: a person cannot stand anywhere inside a turned car's body, its middle included", () => {
  const h = 0.6;
  const col = Col.orientedBox(Veh.box(Veh.create("car", 0, 0, h), 0), "car");
  const f = [Math.sin(h), Math.cos(h)];
  const l = [Math.cos(h), -Math.sin(h)];
  for (let fwd = -1.8; fwd <= 1.8; fwd += 0.3) {
    for (let lat = -0.8; lat <= 0.8; lat += 0.2) {
      const p = { x: f[0] * fwd + l[0] * lat, z: f[1] * fwd + l[1] * lat };
      assert.ok(Col.blockedAt([col], p.x, p.z, 0.31), "blocked at " + fwd + ", " + lat);
      Col.settle([col], p, 0.31);
      const at = { fwd: p.x * f[0] + p.z * f[1], lat: p.x * l[0] + p.z * l[1] };
      const out = Math.abs(at.lat) >= 0.82 + 0.3 || Math.abs(at.fwd) >= 1.9 + 0.3;
      assert.ok(out, "pushed out of the body from " + fwd + ", " + lat + ": " + JSON.stringify(at));
    }
  }
});

test("AC-P12: the oriented box is exact (the old two square boxes let people into the middle)", () => {
  const o = { x: 0, z: 0, hx: 0.8, hz: 1.9, c: Math.cos(0.7), s: Math.sin(0.7) };
  const col = Col.orientedBox(o, "car");
  assert.ok(col.maxX - col.minX > 1.6 && col.maxZ - col.minZ > 1.6, "bounds cover the turned box");
  assert.equal(
    Col.hits(col, col.maxX - 0.05, col.maxZ - 0.05, 0.2),
    false,
    "an empty corner is free",
  );
  assert.equal(Col.hits(col, 0, 0, 0.01), true);
  const p = { x: 0.2, z: 0.1 };
  assert.equal(Col.pushOut(p, 0.3, col), true);
  assert.equal(Col.hits(col, p.x, p.z, 0.299), false, "pushOut leaves it touching, not inside");
});

/** Four car tyres (left is +lat), 1.1 m ahead / behind and 0.62 m to each side. */
const CAR_CONTACTS = [-1, 1].flatMap((f) => [-1, 1].map((l) => ({ fwd: f * 1.1, lat: l * 0.62 })));

test("AC-P11: on flat ground the body sits flat at the ground's height", () => {
  const p = Veh.groundPose(Veh.create("car", 3, 4, 1.1), CAR_CONTACTS, () => 0.12);
  assert.ok(Math.abs(p.y - 0.12) < 1e-9 && Math.abs(p.pitch) < 1e-9 && Math.abs(p.roll) < 1e-9);
  p.off.forEach((o) => assert.ok(Math.abs(o) < 1e-9));
});

test("AC-P11: front wheels up a kerb pitch the nose up, left wheels roll it, one wheel up is taken by the suspension", () => {
  const v = Veh.create("car", 0, 0, 0); // faces +z, left is +x
  const nose = Veh.groundPose(v, CAR_CONTACTS, (x, z) => (z > 0 ? 0.12 : 0));
  assert.ok(nose.pitch > 0.05 && Math.abs(nose.roll) < 1e-9 && Math.abs(nose.y - 0.06) < 1e-9);
  const side = Veh.groundPose(v, CAR_CONTACTS, (x) => (x > 0 ? 0.12 : 0));
  assert.ok(side.roll > 0.05 && Math.abs(side.pitch) < 1e-9);
  const ground = (x, z) => (x > 0 && z > 0 ? 0.12 : 0);
  const one = Veh.groundPose(v, CAR_CONTACTS, ground);
  CAR_CONTACTS.forEach((c, i) => {
    const plane = one.y + Math.tan(one.pitch) * c.fwd + Math.tan(one.roll) * c.lat;
    const under = c.lat > 0 && c.fwd > 0 ? 0.12 : 0;
    assert.ok(Math.abs(plane + one.off[i] - under) < 1e-9, "wheel " + i);
  });
});

test("AC-P11: a two-wheeler never rolls from the ground fit, and a tyre on a kerb edge stands on the kerb", () => {
  const v = Veh.create("bike", 0, 0, 0);
  const two = [
    { fwd: 0.5, lat: 0.03 },
    { fwd: -0.5, lat: 0 },
  ];
  const p = Veh.groundPose(v, two, (x, z) => (z > 0 ? 0.12 : 0));
  assert.equal(p.roll, 0);
  assert.ok(p.pitch > 0.1);
  assert.equal(
    Veh.groundUnder((x) => (x > 0.05 ? 0.12 : 0), 0, 0),
    0.12,
    "the kerb holds it up",
  );
  assert.ok(Number.isFinite(Veh.groundPose(v, [{ fwd: 0.5, lat: 0 }], () => NaN).y));
});
