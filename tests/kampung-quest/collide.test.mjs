// Character collision maths (js/game/collide.js): body-radius push-out, the settle fallback,
// separation between characters (including exactly stacked ones), turning away from a wall,
// and the camera arm length. Root causes of the "NPC sunk into the lift wall" report.
import test from "node:test";
import assert from "node:assert/strict";
import { loadCollide } from "./load-sim.mjs";

const C = loadCollide();
const R = 0.3;
const wall = { minX: -3, maxX: 3, minZ: 0, maxZ: 4, kind: "core" };
const hedge = { minX: 0, maxX: 10, minZ: 5, maxZ: 5.4, kind: "hedge" };

/** Distance from a point to the box (0 when inside). */
function gap(p, c) {
  const cx = Math.max(c.minX, Math.min(p.x, c.maxX));
  const cz = Math.max(c.minZ, Math.min(p.z, c.maxZ));
  return Math.hypot(p.x - cx, p.z - cz);
}

test("resolve leaves a circle one body radius from a wall it was pressed into", () => {
  const p = { x: 0, z: -0.1 };
  assert.equal(C.resolve([wall], p, R), true);
  assert.ok(Math.abs(gap(p, wall) - R) < 1e-6);
  assert.ok(p.z <= -R + 1e-6, "pushed out on the side it came from");
});

test("resolve does nothing for a circle that already clears the wall", () => {
  const p = { x: 0, z: -R - 0.01 };
  assert.equal(C.resolve([wall], p, R), false);
  assert.equal(p.z, -R - 0.01);
});

test("a centre exactly inside the box is pushed out the nearest side", () => {
  const p = { x: 2.9, z: 2 };
  C.resolve([wall], p, R);
  assert.ok(p.x >= wall.maxX + R - 1e-6);
});

test("settle moves a character out of a thin hedge it was shoved into", () => {
  const p = { x: 4, z: 5.2 };
  assert.equal(C.settle([hedge], p, R), true);
  assert.ok(gap(p, hedge) >= R - 0.03, "gap " + gap(p, hedge));
});

test("settle falls back to a free spot when two colliders pinch the circle", () => {
  const a = { minX: -1, maxX: 1, minZ: -1, maxZ: 0.1, kind: "bench" };
  const b = { minX: -1, maxX: 1, minZ: 0.5, maxZ: 2, kind: "bench" };
  const p = { x: 0, z: 0.3 };
  C.settle([a, b], p, R);
  assert.equal(C.blockedAt([a, b], p.x, p.z, R - 0.03), null);
});

test("separate pushes two characters apart and splits the push by share", () => {
  const a = { x: 0, z: 0 };
  const b = { x: 0.2, z: 0 };
  assert.equal(C.separate(a, b, 0.8, 0.5, 0.5, 0), true);
  assert.ok(a.x < 0 && b.x > 0.2);
  assert.ok(Math.abs(-a.x - (b.x - 0.2)) < 1e-9, "equal shares move equally");
});

test("separate with share 0 for one side moves only the other", () => {
  const a = { x: 0, z: 0 };
  const hero = { x: 0.3, z: 0 };
  C.separate(a, hero, 0.9, 1, 0, 0);
  assert.equal(hero.x, 0.3);
  assert.ok(a.x < 0);
});

test("exactly stacked characters are split along the given angle (they used to stay stacked)", () => {
  const a = { x: 5, z: 5 };
  const b = { x: 5, z: 5 };
  assert.equal(C.separate(a, b, 0.8, 0.5, 0.5, Math.PI / 2), true);
  assert.ok(a.x > b.x, "split along +x / -x");
  assert.ok(Math.abs(a.z - b.z) < 1e-9);
  // repeated steps always end up at least `space` apart
  for (let i = 0; i < 40; i += 1) C.separate(a, b, 0.8, 0.5, 0.5, 0);
  assert.ok(Math.hypot(a.x - b.x, a.z - b.z) > 0.75);
});

test("separate ignores characters that are already far enough apart", () => {
  const a = { x: 0, z: 0 };
  const b = { x: 2, z: 0 };
  assert.equal(C.separate(a, b, 0.8, 0.5, 0.5, 0), false);
  assert.deepEqual({ ...a, ...{} }, { x: 0, z: 0 });
});

test("openHeading keeps a heading that already looks at open space", () => {
  assert.equal(C.openHeading([wall], 0, -3, 0, 0.9), 0);
});

test("openHeading turns a character who stands nose to a wall around", () => {
  // standing 0.6 m from the wall face (z = 0), looking at it (+z)
  const h = C.openHeading([wall], 0, -0.6, 0, 0.9);
  assert.ok(Math.abs(Math.abs(h) - Math.PI) < 1e-9, "turned right around, got " + h);
  assert.ok(Math.cos(h) < 0, "now faces -z, away from the wall");
});

test("openHeading tries other turns in a corner and returns the wanted heading if boxed in", () => {
  const north = { minX: -5, maxX: 5, minZ: 0.5, maxZ: 3, kind: "wall" };
  const south = { minX: -5, maxX: 5, minZ: -3, maxZ: -0.5, kind: "wall" };
  const h = C.openHeading([north, south], 0, 0, 0, 0.9);
  assert.ok(Math.abs(Math.sin(h)) > 0.9, "looks along the corridor, got " + h);
  const pen = { minX: -9, maxX: 9, minZ: -9, maxZ: 9, kind: "wall" };
  assert.equal(C.openHeading([pen], 0, 0, 1.2, 0.9), 1.2);
});

test("armLength is the full length in open space", () => {
  assert.equal(C.armLength([], 0, 0, 0, -1, 3, 0.28, 0.35), 3);
  assert.equal(C.armLength([hedge], 0, -3, 0, -1, 3, 0.28, 0.35), 3, "low props are ignored");
});

test("armLength stops short of a tall wall behind the hero, but not inside it", () => {
  // hero at z = -2 with the wall face at z = 0 ... the arm points +z (toward the wall)
  const tall = { minX: -3, maxX: 3, minZ: 0, maxZ: 4, kind: "core" };
  const len = C.armLength([tall], 0, -2, 0, 1, 4, 0.28, 0.35);
  assert.ok(len < 2 && len > 1.5, "stops before the wall face, got " + len);
  assert.ok(-2 + len + 0.28 <= 0.2, "the camera body clears the wall");
});

test("armLength never goes below the minimum, even with the hero pressed to the wall", () => {
  const tall = { minX: -3, maxX: 3, minZ: 0, maxZ: 4, kind: "core" };
  const len = C.armLength([tall], 0, -0.2, 0, 1, 4, 0.28, 0.35);
  assert.equal(len, 0.35);
});
