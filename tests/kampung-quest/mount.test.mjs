// The pure riding rules (js/sim/mount.js): every animal is faster than the hero's run, it turns
// toward where the stick points (camera-relative, like walking), it picks a gait by speed and its
// legs move through a stride, it never reaches a person ahead, and it offers places to step down.
// AC-P5..P7 (features/kampung-quest-playability/requirements.md).
import test from "node:test";
import assert from "node:assert/strict";
import { loadSim } from "./load-sim.mjs";

const { Mount: M } = loadSim(["vehicle", "mount"]).Sim;
const DT = 1 / 30;

/** Ride for `secs` with a constant stick and camera yaw; people block the way when given. */
function ride(m, move, secs, people, yaw) {
  for (let i = 0; i < Math.round(secs / DT); i += 1) {
    M.steer(m, M.wishOf(move, yaw || 0), DT);
    M.yieldTo(m, people || [], DT);
    M.advance(m, DT);
    M.stepGait(m, DT);
  }
  return m;
}

test("top speeds: camel ~1.8x, horse ~2.2x, pony ~2x the hero's run", () => {
  assert.ok(M.SPECS.camel.top >= M.HERO_RUN * 1.75);
  assert.ok(M.SPECS.horse.top >= M.HERO_RUN * 2.15);
  assert.ok(M.SPECS.pony.top >= M.HERO_RUN * 1.9);
  ["camel", "horse", "pony"].forEach((k) => {
    const m = ride(M.create(k, 0, 0, 0), { x: 0, y: 1 }, 6);
    assert.ok(Math.abs(m.speed - m.spec.top) < 1e-6, k + " reaches its top speed, never beyond");
    assert.ok(m.speed > M.HERO_RUN, k + " is faster than running");
  });
});

test("an unknown kind gives null and a resting stick does not creep", () => {
  assert.equal(M.create("dragon", 0, 0, 0), null);
  const m = ride(M.create("horse", 0, 0, 0), { x: 0.05, y: 0.05 }, 2);
  assert.equal(m.speed, 0);
  assert.equal(m.x, 0);
});

test("the animal turns toward the pushed direction (camera-relative) and keeps going", () => {
  const m = M.create("camel", 0, 0, 0);
  ride(m, { x: 1, y: 0 }, 4, [], 0); // camera faces +z, stick right -> toward -x
  assert.ok(Math.abs(M.angleTo(m.heading, -Math.PI / 2)) < 0.05, "faces -x");
  assert.ok(m.x < -3, "walked toward -x");
  const w = M.wishOf({ x: 0, y: 1 }, Math.PI / 2);
  assert.ok(Math.abs(w.heading - Math.PI / 2) < 1e-9, "forward follows the camera yaw");
});

test("gaits: walk when slow, trot / canter (horse) and pace (camel) when fast", () => {
  const h = M.SPECS.horse;
  assert.equal(M.gaitFor(h, 0), null);
  assert.equal(M.gaitFor(h, 1.5).name, "walk");
  assert.equal(M.gaitFor(h, 4).name, "trot");
  assert.equal(M.gaitFor(h, 9).name, "canter");
  assert.equal(M.gaitFor(M.SPECS.camel, 7).name, "pace");
});

test("the legs move through a stride: hips swing both ways and the lifted leg folds its knee", () => {
  ["walk", "trot", "canter"].forEach((name) => {
    const g = M.SPECS.horse.gaits.find((x) => x.name === name);
    const hips = [];
    let folded = 0;
    for (let p = 0; p < 1; p += 0.05) {
      const l = M.legPose(g, p, 0);
      hips.push(l.hip);
      folded = Math.max(folded, l.knee);
    }
    assert.ok(Math.max(...hips) > 0.3 && Math.min(...hips) < -0.3, name + " swings");
    assert.ok(folded > 0.5, name + " folds the knee in the air");
  });
  const trot = M.SPECS.horse.gaits[1];
  const fl = M.legPose(trot, 0.1, 0).hip;
  assert.ok(Math.abs(fl - M.legPose(trot, 0.1, 3).hip) < 1e-9, "trot: diagonal pair together");
  assert.ok(Math.abs(fl - M.legPose(trot, 0.1, 1).hip) > 0.2, "trot: the other pair differs");
});

test("riding advances the stride phase and the stance has moving legs", () => {
  const m = ride(M.create("horse", 0, 0, 0), { x: 0, y: 1 }, 1);
  const a = M.stance(m).legs.map((l) => l.hip);
  ride(m, { x: 0, y: 1 }, 0.1);
  const b = M.stance(m).legs.map((l) => l.hip);
  assert.ok(
    a.some((v, i) => Math.abs(v - b[i]) > 0.01),
    "legs moved",
  );
  const still = M.stance(M.create("horse", 0, 0, 0));
  assert.ok(still.legs.every((l) => l.hip === 0 && l.knee === 0));
});

test("an animal never reaches a person standing ahead: it slows and stops", () => {
  const person = { x: 0, z: 14 };
  const m = M.create("horse", 0, 0, 0);
  let closest = Infinity;
  for (let i = 0; i < 300; i += 1) {
    ride(m, { x: 0, y: 1 }, DT, [person]);
    closest = Math.min(closest, person.z - m.z);
  }
  assert.ok(closest > m.spec.halfLen + 0.3, "kept a gap of " + closest.toFixed(2));
  assert.ok(m.speed < 0.2, "stood still");
});

test("getting down: stopGently halts it and exit spots sit beside the body", () => {
  const m = ride(M.create("camel", 5, 5, 0), { x: 0, y: 1 }, 3);
  for (let i = 0; i < 60; i += 1) M.stopGently(m, DT);
  assert.equal(m.speed, 0);
  const spots = M.exitSpots(m);
  assert.ok(spots.length >= 4);
  spots.forEach((p) => {
    const d = Math.hypot(p.x - m.x, p.z - m.z);
    assert.ok(d > m.spec.halfWid + 0.5, "clear of the body");
  });
});
