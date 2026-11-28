// The pure vehicle-life rules (js/sim/vehicle-life.js): the get-in / get-out timeline, lights, indicators and
// exhaust. Owner request: people get into and out of cars with the door opening, brake lights, exhaust.
import test from "node:test";
import assert from "node:assert/strict";
import { loadSim, plain } from "./load-sim.mjs";

const VL = loadSim(["vehicle-life"]).Sim.VehicleLife;

test("a car's get-in runs 1.2 to 1.8 s: walk, open, climb, close in that order", () => {
  const p = VL.plan("car", "in");
  assert.deepEqual(plain(p.phases.map((x) => x.name)), ["walk", "open", "climb", "close"]);
  assert.ok(p.total >= 1.2 && p.total <= 1.8, "total " + p.total);
  assert.ok(VL.total("lorry", "in") <= 1.8 && VL.total("lorry", "in") > VL.total("car", "in"));
});

test("the door is shut while walking, opens, stays open while climbing, shuts at the end", () => {
  const T = VL.total("car", "in");
  const d = (t) => VL.at("car", "in", t).door;
  assert.equal(d(0), 0);
  assert.equal(VL.at("car", "in", 0.2).phase, "walk");
  assert.equal(VL.at("car", "in", 0.2).door, 0);
  assert.ok(d(0.65) > 0 && d(0.65) < 1, "mid-open");
  assert.equal(VL.at("car", "in", 1.1).phase, "climb");
  assert.equal(d(1.1), 1);
  assert.ok(d(T - 0.1) > 0 && d(T - 0.1) < 1, "closing");
  assert.equal(d(T), 0);
  assert.equal(VL.at("car", "in", T).done, true);
  assert.equal(VL.at("car", "in", T + 5).phase, "done");
});

test("walking brings him to the door, climbing takes him from the door to the seat", () => {
  const a = VL.at("car", "in", 0.25);
  assert.ok(a.approach > 0 && a.approach < 1);
  assert.equal(a.seat, 0);
  const b = VL.at("car", "in", 1.1);
  assert.equal(b.approach, 1);
  assert.ok(b.seat > 0 && b.seat < 1);
  assert.equal(VL.at("car", "in", 99).seat, 1);
});

test("getting out is the get-in turned round: seat 1 to 0, the door opens and then shuts", () => {
  const p = VL.plan("car", "out");
  assert.deepEqual(plain(p.phases.map((x) => x.name)), ["open", "climb", "close"]);
  assert.equal(VL.at("car", "out", 0).seat, 1);
  assert.equal(VL.at("car", "out", 0).door, 0);
  assert.equal(VL.at("car", "out", 0.5).door, 1);
  const end = VL.at("car", "out", 99);
  assert.deepEqual(plain({ s: end.seat, d: end.door, a: end.away }), { s: 0, d: 0, a: 1 });
  assert.ok(VL.total("car", "out") <= 1.8);
});

test("two-wheelers have no door and a short swing", () => {
  ["bike", "moto"].forEach((k) => {
    assert.equal(VL.hasDoor(k), false);
    assert.ok(VL.total(k, "in") < 1);
    for (let t = 0; t <= 1; t += 0.1) assert.equal(VL.at(k, "in", t).door, 0);
    assert.equal(VL.at(k, "in", 99).seat, 1);
    assert.equal(VL.at(k, "out", 99).away, 1);
  });
});

test("the progress numbers never leave 0..1 (any time, even junk)", () => {
  const cases = [];
  for (const kind of ["car", "lorry", "moto", "bike", "nope"])
    for (const dir of ["in", "out"])
      for (const t of [-3, 0, 0.3, 0.9, 1.4, 2, 50]) cases.push([kind, dir, t]);
  for (const [kind, dir, t] of cases) {
    const s = VL.at(kind, dir, t);
    for (const k of ["door", "seat", "approach", "away", "k"]) {
      assert.ok(s[k] >= 0 && s[k] <= 1, kind + dir + t + k + " " + s[k]);
    }
  }
});

test("the driver's door is on the right when the driver sits right of the middle", () => {
  assert.equal(VL.driverSide(-0.34), "R");
  assert.equal(VL.driverSide(0.34), "L");
});

test("climbing hops over the sill and ends at the seat height", () => {
  assert.equal(VL.climbHeight(0, 0.4, "car"), 0);
  assert.ok(Math.abs(VL.climbHeight(1, 0.4, "car") - 0.4) < 1e-9);
  assert.ok(VL.climbHeight(0.5, 0.4, "car") > 0.2);
});

test("brake lights: on when stopped with the engine on, when slowing, never with the engine off", () => {
  const L = (o) => VL.lightsFor(Object.assign({ speed: 8, accel: 0, engine: true, night: 0 }, o));
  assert.equal(L({}).brake, false, "cruising");
  assert.equal(L({ accel: 2 }).brake, false, "speeding up");
  assert.equal(L({ accel: -3 }).brake, true, "slowing");
  assert.equal(L({ speed: 0, accel: 0 }).brake, true, "stopped, engine on");
  assert.equal(L({ speed: 0, engine: false }).brake, false, "engine off");
  assert.equal(L({ braking: true }).brake, true, "held back for a person");
});

test("reverse light only when rolling backwards; speeding up backwards is not braking", () => {
  const r = VL.lightsFor({ speed: -1.5, accel: -1, engine: true, night: 0 });
  assert.equal(r.reverse, true);
  assert.equal(r.brake, false);
  assert.equal(VL.lightsFor({ speed: 3, accel: 0, engine: true, night: 0 }).reverse, false);
});

test("headlights come on at dusk and do not flicker around the threshold", () => {
  assert.equal(VL.lightsFor({ speed: 0, accel: 0, engine: true, night: 0.35 }).head, true);
  assert.equal(VL.lightsFor({ speed: 0, accel: 0, engine: true, night: 0.1 }).head, false);
  const mid = { speed: 0, accel: 0, engine: true, night: 0.24 };
  assert.equal(VL.lightsFor(Object.assign({ headWas: false }, mid)).head, false);
  assert.equal(VL.lightsFor(Object.assign({ headWas: true }, mid)).head, true);
});

test("indicators blink 1.5 times a second and name the side of a lateral move", () => {
  const samples = [0, 0.1, 0.4, 0.5, 0.7, 0.8].map((t) => VL.blinkOn(t));
  assert.deepEqual(samples, [true, true, false, false, true, true]);
  assert.equal(VL.indicatorFor(1.7), "L");
  assert.equal(VL.indicatorFor(-1.7), "R");
  assert.equal(VL.indicatorFor(0.1), null);
});

test("exhaust: petrol and diesel puff, electric never, an engine that is off never", () => {
  assert.ok(VL.puffRate("petrol", 0, 0, true) > 0);
  assert.ok(VL.puffRate("diesel", 0, 0, true) > 0);
  assert.equal(VL.puffRate("electric", 0, 3, true), 0);
  assert.equal(VL.puffRate("none", 0, 3, true), 0);
  assert.equal(VL.puffRate("petrol", 0, 3, false), 0);
  assert.equal(VL.puffLook("electric"), null);
});

test("diesel puffs more at pull-away and is greyer than petrol; cruising puffs less", () => {
  const pull = (f) => VL.puffRate(f, 1, 3, true);
  assert.ok(pull("diesel") > pull("petrol") * 1.4);
  assert.ok(VL.puffLook("diesel").pale < VL.puffLook("petrol").pale);
  assert.ok(VL.puffRate("petrol", 12, 0, true) < VL.puffRate("petrol", 0, 0, true));
  assert.ok(VL.puffRate("diesel", 0, 99, true) <= VL.MAX_PUFF_RATE);
});

test("a puff grows, fades and dies", () => {
  const a = VL.puffAt(0.05, 0.1);
  const b = VL.puffAt(0.6, 0.1);
  const c = VL.puffAt(VL.PUFF_LIFE + 0.1, 0.1);
  assert.ok(b.size > a.size);
  assert.ok(b.rise > a.rise);
  assert.ok(a.alpha > 0 && b.alpha < 0.6);
  assert.equal(c.alive, false);
  assert.equal(c.alpha, 0);
});

test("fuel when the rig does not say: diesel lorry, bus and taxi, petrol cars and scooters, none for bikes", () => {
  assert.equal(VL.fuelOf("car", "sedan"), "petrol");
  assert.equal(VL.fuelOf("car", "taxi"), "diesel");
  assert.equal(VL.fuelOf("lorry"), "diesel");
  assert.equal(VL.fuelOf("bus"), "diesel");
  assert.equal(VL.fuelOf("moto"), "petrol");
  assert.equal(VL.fuelOf("bike"), "none");
});

test("the way to the door goes straight on the door's side and round the nearer end from the far side", () => {
  const door = { fwd: 0, lat: -1.4 };
  const same = VL.approachPath({ fwd: 0.5, lat: -2.2 }, door, 1.9, 0.82);
  assert.equal(same.length, 2);
  const far = VL.approachPath({ fwd: 0.8, lat: 1.1 }, door, 1.9, 0.82);
  assert.equal(far.length, 4);
  assert.ok(Math.abs(far[1].fwd) > 1.9, "past the nose");
  assert.ok(Math.abs(far[1].lat) > 0.82, "clear of the body");
  const mid = VL.alongPath(far, 0.5);
  assert.ok(Math.abs(mid.lat) > 0.82 || Math.abs(mid.fwd) > 1.9, "never through the body");
  assert.deepEqual(plain(VL.alongPath(far, 0)), plain(far[0]));
  assert.deepEqual(plain(VL.alongPath(far, 1)), plain(door));
});

test("a long way round gets a longer, but bounded, walk", () => {
  assert.equal(VL.walkSecs(0.5), 0.3);
  assert.ok(VL.walkSecs(2) > 0.3 && VL.walkSecs(2) < 1);
  assert.equal(VL.walkSecs(50), 1);
  assert.ok(VL.total("car", "in", 1.0) > VL.total("car", "in"));
});

test("the sound cues fire once each: the door opening, then the clunk of it shutting", () => {
  const fired = { open: false, close: false };
  const got = [];
  for (let t = 0; t <= VL.total("car", "in") + 0.05; t += 0.02) {
    const c = VL.cue(VL.at("car", "in", t), fired);
    if (c) got.push(c);
  }
  assert.deepEqual(plain(got), ["open", "close"]);
  const bike = { open: false, close: false };
  for (let t = 0; t <= 1; t += 0.02) assert.equal(VL.cue(VL.at("bike", "in", t), bike), null);
});
