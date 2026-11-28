// Ambient traffic rules (js/sim/traffic.js): cars brake for people, the hero, the bus and each other, stop short
// of a zebra crossing while someone is on it, never stay held up for good, and the bus's boarding counts.
import test from "node:test";
import assert from "node:assert/strict";
import { loadSim, plain } from "./load-sim.mjs";

const T = loadSim(["traffic"]).Sim.Traffic;
const car = (o) =>
  Object.assign({ x: 0, z: 0, heading: 0, speed: 8, halfLen: 1.9, halfWid: 0.82 }, o);

test("nobody on the road: nothing slows the car", () => {
  assert.equal(T.capFor(car(), [], [], []), Infinity);
});

test("a person ahead in the lane caps the speed so the car stops short of them", () => {
  const c = car();
  const cap = T.personCap(c, { x: 0.2, z: 8 });
  assert.ok(cap > 0 && cap < 8, "cap " + cap);
  // from that speed, braking at the comfort rate stops before the person's near edge
  const stopDist = (cap * cap) / (2 * 5);
  assert.ok(stopDist < 8 - 1.9 - 0.4, "stops " + stopDist);
});

test("a person right beside the bumper or alongside holds the car still; one behind or far off does not", () => {
  const c = car();
  assert.equal(T.personCap(c, { x: 0.1, z: 2.0 }), 0);
  assert.equal(T.personCap(c, { x: 0.1, z: 0.5 }), 0);
  assert.equal(T.personCap(c, { x: 0.1, z: -6 }), Infinity);
  assert.equal(T.personCap(c, { x: 6, z: 8 }), Infinity, "on the pavement beside the road");
  assert.equal(T.personCap(c, { x: 0, z: 90 }), Infinity, "far ahead");
});

test("a car behind another slows to its speed; a stopped car ahead stops it", () => {
  const lead = { x: 0, z: 14, heading: 0, speed: 5, halfLen: 1.9, halfWid: 0.82 };
  const cap = T.vehicleCap(car(), lead);
  assert.ok(cap > 5 && cap < 12, "follows: " + cap);
  const parked = Object.assign({}, lead, { speed: 0 });
  const stopCap = T.vehicleCap(car(), parked);
  assert.ok(stopCap < cap && stopCap > 0);
  const touching = Object.assign({}, lead, { z: 3.5 });
  assert.equal(T.vehicleCap(car(), touching), 0);
});

test("a car in the other lane (2 m across) or driving away is not in the way", () => {
  const oncoming = { x: -1.9, z: 12, heading: Math.PI, speed: 8, halfLen: 1.9, halfWid: 0.82 };
  assert.equal(T.vehicleCap(car({ x: 0 }), oncoming), Infinity);
  const behind = { x: 0, z: -9, heading: 0, speed: 8, halfLen: 1.9, halfWid: 0.82 };
  assert.equal(T.vehicleCap(car(), behind), Infinity);
});

test("the bus crossing in front of a car at a junction holds the car back, and its lead point counts", () => {
  const c = car({ x: 1, z: -14, speed: 6 });
  const bus = { x: 12, z: 0.3, heading: -Math.PI / 2, speed: 7, halfLen: 5.05, halfWid: 1.2 };
  assert.ok(T.vehicleCap(c, bus) > 6, "still far from the junction line: no need to brake");
  const nearBus = Object.assign({}, bus, { x: 3 });
  const c2 = car({ x: 1, z: -3.5, speed: 6 });
  assert.ok(T.vehicleCap(c2, nearBus) < 6);
});

const CR = { axis: "z", at: 10, half: 3.5, margin: 0.6 };

test("a car stops short of a zebra crossing while someone is on it, and goes when they are off", () => {
  const c = car({ x: 1, z: 2, speed: 7 });
  const on = [{ x: -0.4, z: 10.2 }];
  const cap = T.crossingCap(c, CR, on);
  assert.ok(cap < 7, "slows: " + cap);
  const near = car({ x: 1, z: 5.5, speed: 2 });
  assert.equal(T.crossingCap(near, CR, on), 0, "held at the stripes");
  assert.equal(T.crossingCap(c, CR, [{ x: -0.4, z: 20 }]), Infinity, "nobody on it");
});

test("a person standing in the crossing but off to the side of the lane still stops the car", () => {
  const c = car({ x: 1, z: 6, speed: 3 });
  assert.equal(T.crossingCap(c, CR, [{ x: -3.0, z: 10 }]), 0);
  assert.equal(T.personCap(c, { x: -3.0, z: 10 }), Infinity, "(the plain person rule would not)");
});

test("a car already past the stripes carries on; a crossing over the other road does not matter", () => {
  const past = car({ x: 1, z: 12, speed: 5 });
  assert.equal(T.crossingCap(past, CR, [{ x: 0, z: 10 }]), Infinity);
  const across = car({ x: 1, z: 5, speed: 5, heading: Math.PI / 2 });
  assert.equal(T.crossingCap(across, CR, [{ x: 0, z: 10 }]), Infinity);
});

test("capFor takes the smallest of person, vehicle and crossing caps", () => {
  const c = car({ x: 1, z: 6, speed: 3 });
  const cap = T.capFor(
    c,
    [{ x: -3, z: 10 }],
    [{ x: 1, z: 40, heading: 0, speed: 0, halfLen: 1.9 }],
    [CR],
  );
  assert.equal(cap, 0);
});

test("the number of traffic cars per tier: more on a faster tier, fewer in Makkah", () => {
  assert.equal(T.countFor("low", "kampung"), 2);
  assert.equal(T.countFor("high", "kampung"), 4);
  assert.ok(T.countFor("low", "haramain") < T.countFor("low", "kampung"));
  assert.ok(T.countFor("weird", "kampung") >= 2);
  for (const tier of ["low", "med", "high"]) {
    assert.ok(T.countFor(tier, "kampung") >= 2 && T.countFor(tier, "kampung") <= 4);
  }
});

test("pulling into a bay eases from the lane to the bay and no further", () => {
  assert.equal(T.bayOffset(0.95, 2.7, 99, 10), 0.95);
  assert.equal(T.bayOffset(0.95, 2.7, 0, 10), 2.7);
  const mid = T.bayOffset(0.95, 2.7, 5, 10);
  assert.ok(mid > 0.95 && mid < 2.7);
  assert.ok(T.bayOffset(0.95, 2.7, -3, 10) <= 2.7);
});

test("boarding: 1-3 get off and 1-3 get on, never more than there are, never over the seats", () => {
  let n = 0;
  const rng = () => (n += 0.37) % 1;
  for (let i = 0; i < 200; i += 1) {
    const seated = i % 7;
    const waiting = i % 5;
    const r = T.boarding(rng, seated, waiting, 6);
    assert.ok(r.off >= 0 && r.off <= Math.min(3, seated), JSON.stringify(r));
    assert.ok(r.on >= 0 && r.on <= Math.min(3, waiting), JSON.stringify(r));
    assert.ok(seated - r.off + r.on <= Math.max(6, seated), "over the seats " + JSON.stringify(r));
    if (seated > 0) assert.ok(r.off >= 1);
    if (waiting > 0 && seated - r.off < 6) assert.ok(r.on >= 1);
  }
});

test("an empty bus lets nobody off and a bus with no one waiting takes nobody on", () => {
  assert.deepEqual(plain(T.boarding(() => 0.5, 0, 3, 6)), { off: 0, on: 2 });
  assert.deepEqual(plain(T.boarding(() => 0.5, 4, 0, 6)), { off: 2, on: 0 });
});

test("a car held up by another vehicle goes away only when unseen and after a long wait; never for a person", () => {
  assert.equal(T.shouldVanish(5, false, false), false, "not long enough");
  assert.equal(T.shouldVanish(T.STUCK_SECS + 1, false, true), false, "seen");
  assert.equal(T.shouldVanish(T.STUCK_SECS + 1, true, false), false, "held by a person");
  assert.equal(T.shouldVanish(T.STUCK_SECS + 1, false, false), true);
});
