// The hero's jump arc (js/sim/jump.js): rises then returns to the ground, one jump at a time,
// never below the ground, and the same result however the frames are sliced.
import test from "node:test";
import assert from "node:assert/strict";
import { loadSim } from "./load-sim.mjs";

const { Jump } = loadSim(["jump"]).Sim;

/** Run the arc in dt steps until it lands; returns { peak, time, landEvents }. */
function fly(J, dt) {
  let peak = 0;
  let time = 0;
  let landEvents = 0;
  for (let i = 0; i < 1000 && !J.grounded; i += 1) {
    if (Jump.step(J, dt) === "land") landEvents += 1;
    peak = Math.max(peak, J.h);
    time += dt;
  }
  return { peak, time, landEvents };
}

test("a new state is standing on the ground", () => {
  const J = Jump.create();
  assert.deepEqual({ ...J }, { h: 0, vy: 0, grounded: true });
});

test("pressing on the ground starts a jump; stepping a grounded state does nothing", () => {
  const J = Jump.create();
  assert.equal(Jump.step(J, 0.1), null);
  assert.equal(J.h, 0);
  assert.equal(Jump.press(J), true);
  assert.equal(J.grounded, false);
  Jump.step(J, 0.05);
  assert.ok(J.h > 0.1, "rises at once");
});

test("the arc peaks at a small hop and lands after about 0.7 s", () => {
  const J = Jump.create();
  Jump.press(J);
  const r = fly(J, 1 / 60);
  assert.ok(r.peak > 0.6 && r.peak < 1.0, "peak " + r.peak);
  assert.ok(r.time > 0.55 && r.time < 0.85, "air time " + r.time);
  assert.ok(Math.abs(r.peak - Jump.PEAK) < 0.03);
  assert.equal(r.landEvents, 1);
  assert.equal(J.h, 0);
  assert.equal(J.vy, 0);
  assert.equal(J.grounded, true);
});

test("no double jump: a press in the air is refused and does not change the arc", () => {
  const A = Jump.create();
  const B = Jump.create();
  Jump.press(A);
  Jump.press(B);
  Jump.step(A, 0.2);
  Jump.step(B, 0.2);
  assert.equal(Jump.press(A), false);
  assert.equal(A.vy, B.vy);
  assert.equal(A.h, B.h);
});

test("the hero can jump again once landed", () => {
  const J = Jump.create();
  Jump.press(J);
  fly(J, 1 / 30);
  assert.equal(Jump.press(J), true);
});

test("the height never goes below the ground, even on one very long frame", () => {
  const J = Jump.create();
  Jump.press(J);
  assert.equal(Jump.step(J, 5), "land");
  assert.equal(J.h, 0);
  assert.equal(J.grounded, true);
});

test("the arc does not depend on the frame rate", () => {
  const peaks = [1 / 30, 1 / 60, 1 / 144].map((dt) => {
    const J = Jump.create();
    Jump.press(J);
    return fly(J, dt).peak;
  });
  assert.ok(Math.max(...peaks) - Math.min(...peaks) < 0.06, peaks.join(", "));
});

test("reset puts the hero straight back on the ground", () => {
  const J = Jump.create();
  Jump.press(J);
  Jump.step(J, 0.2);
  Jump.reset(J);
  assert.deepEqual({ ...J }, { h: 0, vy: 0, grounded: true });
});
