// The vehicle sound mix (js/sim/vehicle-mix.js): subtle levels, petrol / diesel / electric voices, scooter
// putter, bicycle ticks and whirr, distance, and the one-shot recipes. No audio here, just the numbers.
import test from "node:test";
import assert from "node:assert/strict";
import { loadSim } from "./load-sim.mjs";

const M = loadSim(["vehicle-mix"]).Sim.VehicleMix;

test("every engine stays under the ceiling at any speed", () => {
  for (const [kind, fuel] of [
    ["car", "petrol"],
    ["car", "diesel"],
    ["car", "electric"],
    ["lorry", "diesel"],
    ["bus", "diesel"],
    ["moto", "petrol"],
  ]) {
    for (const v of [0, 3, 8, 12.5, 40]) {
      const e = M.engine(kind, fuel, v, 12.5);
      assert.ok(e.gain >= 0 && e.gain <= M.CEILING, kind + fuel + v + " " + e.gain);
    }
  }
  assert.ok(M.CEILING <= 0.04, "quieter than the footsteps (0.05+)");
});

test("the hum rises with speed in pitch and loudness", () => {
  const a = M.engine("car", "petrol", 0, 12.5);
  const b = M.engine("car", "petrol", 12, 12.5);
  assert.ok(b.hz > a.hz && b.gain > a.gain);
});

test("an electric car is silent at rest and only whines when moving, high and quiet", () => {
  const rest = M.engine("car", "electric", 0, 12.5);
  const run = M.engine("car", "electric", 10, 12.5);
  const petrol = M.engine("car", "petrol", 10, 12.5);
  assert.equal(rest.gain, 0);
  assert.ok(run.gain > 0 && run.gain < petrol.gain);
  assert.ok(run.hz > petrol.hz * 3, "a whine, not a rumble");
});

test("diesel idles lower and louder than petrol", () => {
  const p = M.engine("car", "petrol", 0, 12.5);
  const d = M.engine("car", "diesel", 0, 12.5);
  assert.ok(d.hz < p.hz && d.gain > p.gain);
});

test("a scooter putters: a higher hum with a putter rate that speeds up", () => {
  const a = M.engine("moto", "petrol", 0, 10);
  const b = M.engine("moto", "petrol", 9, 10);
  assert.ok(a.putter > 0 && b.putter > a.putter);
  assert.ok(a.hz > M.engine("car", "petrol", 0, 12.5).hz);
  assert.equal(M.engine("car", "petrol", 5, 12.5).putter, 0);
});

test("a bicycle ticks while coasting and whirrs while pedalling, both with speed; silent when still", () => {
  const still = M.bicycle(0, false);
  assert.equal(still.tickHz, 0);
  assert.equal(still.whirGain, 0);
  const coast = M.bicycle(5, false);
  const fast = M.bicycle(7, false);
  assert.ok(coast.tickHz > 0 && fast.tickHz > coast.tickHz);
  assert.equal(coast.whirGain, 0);
  const pedal = M.bicycle(5, true);
  assert.equal(pedal.tickHz, 0);
  assert.ok(pedal.whirGain > 0 && pedal.whirGain <= 0.016);
  assert.ok(M.bicycle(7, true).whirGain > pedal.whirGain);
});

test("distance: full close by, fading smoothly, nothing far away, junk is silent", () => {
  assert.equal(M.distanceGain(0), 1);
  assert.equal(M.distanceGain(M.NEAR), 1);
  const mid = M.distanceGain(20);
  assert.ok(mid > 0 && mid < 0.5);
  assert.ok(M.distanceGain(10) > M.distanceGain(20));
  assert.equal(M.distanceGain(M.FAR), 0);
  assert.equal(M.distanceGain(500), 0);
  assert.equal(M.distanceGain(NaN), 0);
  assert.equal(M.distanceGain(-3), 0);
});

test("nearest: the closest moving car is heard, far ones are not, an empty street is silent", () => {
  assert.equal(M.nearest([]), null);
  const near = { d: 8, speed: 6, top: 12.5, kind: "car", fuel: "petrol" };
  const far = { d: 60, speed: 6, top: 12.5, kind: "car", fuel: "petrol" };
  assert.equal(M.nearest([far]), null);
  const n = M.nearest([far, near]);
  assert.equal(n.d, 8);
  assert.ok(n.gain < M.engine("car", "petrol", 6, 12.5).gain, "quieter than at the wheel");
});

test("one-shots have recipes, and the door sounds are short and soft", () => {
  for (const k of ["doorOpen", "doorClose", "start", "hiss", "kneel"]) {
    const o = M.ONE_SHOTS[k];
    assert.ok(o, k);
    for (const t of o.tones) assert.ok(t.g <= 0.08 && t.d <= 0.6, k);
    if (o.noise) assert.ok(o.noise.g <= 0.05);
  }
  assert.ok(M.ONE_SHOTS.doorClose.tones[0].d < 0.25);
});
