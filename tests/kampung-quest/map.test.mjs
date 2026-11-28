// The full map's pure maths (js/sim/map-view.js): zoom about a point, pan, clamp to the world, resize,
// world <-> screen, the icon / label layout, vehicle-park clustering and the arrival test.
import test from "node:test";
import assert from "node:assert/strict";
import { loadSim, plain } from "./load-sim.mjs";

const { MapView: M } = loadSim(["map-view"]).Sim;
const WORLD = { x0: -75, z0: -75, x1: 75, z1: 75 };
const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps, `${a} ~ ${b}`);

test("a new view fits the whole world, centred, fully zoomed out", () => {
  const v = M.create(WORLD, 800, 600);
  near(v.scale, 4); // 600 px / 150 m: the height is the tight side
  assert.equal(M.level(v), 1);
  near(v.cx, 0);
  near(v.cz, 0);
});

test("toScreen and toWorld are inverses, at any zoom", () => {
  let v = M.zoomAt(M.create(WORLD, 800, 600), 3, 200, 150);
  v = M.panBy(v, -37, 21);
  const p = M.toScreen(v, 12.5, -8);
  const w = M.toWorld(v, p.x, p.y);
  near(w.x, 12.5, 1e-9);
  near(w.z, -8, 1e-9);
});

test("zooming keeps the point under the finger where it is", () => {
  let v = M.zoomAt(M.create(WORLD, 800, 600), 2, 400, 300);
  const before = M.toWorld(v, 650, 120);
  v = M.zoomAt(v, 1.5, 650, 120);
  const after = M.toWorld(v, 650, 120);
  near(after.x, before.x, 1e-9);
  near(after.z, before.z, 1e-9);
});

test("the zoom is limited to the whole world and ZOOM_MAX", () => {
  let v = M.create(WORLD, 800, 600);
  v = M.zoomAt(v, 0.1, 100, 100);
  assert.equal(M.level(v), 1, "cannot zoom out past the whole world");
  for (let i = 0; i < 30; i += 1) v = M.zoomAt(v, M.ZOOM_STEP, 400, 300);
  near(M.level(v), M.ZOOM_MAX);
});

test("zoom steps in and out are symmetric about the centre", () => {
  const v = M.create(WORLD, 800, 600);
  const out = M.zoomAt(M.zoomAt(v, M.ZOOM_STEP, 400, 300), 1 / M.ZOOM_STEP, 400, 300);
  near(out.scale, v.scale, 1e-9);
});

test("panning is clamped: the window never leaves the world", () => {
  let v = M.zoomAt(M.create(WORLD, 800, 600), 4, 400, 300); // 4x: 200 x 150 px... 50 x 37.5 m
  v = M.panBy(v, 1e6, 1e6); // drag far right and down: the view slides to the north-west corner
  const topLeft = M.toWorld(v, 0, 0);
  near(topLeft.x, -75, 1e-9);
  near(topLeft.z, -75, 1e-9);
  v = M.panBy(v, -1e7, -1e7);
  const bottomRight = M.toWorld(v, v.w, v.h);
  near(bottomRight.x, 75, 1e-9);
  near(bottomRight.z, 75, 1e-9);
});

test("a world narrower than the window stays centred on that axis", () => {
  const wide = M.create(WORLD, 1000, 400); // fit by height: 150 m is 400 px, so 1000 px shows more than the world
  const v = M.panBy(wide, 300, 0);
  near(v.cx, 0);
});

test("centreOn moves the window to the hero, clamped at the edge", () => {
  let v = M.zoomAt(M.create(WORLD, 800, 600), 4, 400, 300);
  v = M.centreOn(v, 20, -10);
  near(v.cx, 20);
  near(v.cz, -10);
  v = M.centreOn(v, 74, 74); // near the corner: the window stops at the edge
  assert.ok(v.cx < 74 && v.cz < 74);
  near(M.toWorld(v, v.w, v.h).x, 75, 1e-9);
});

test("resize keeps the zoom level and the centre (a rotated iPad)", () => {
  let v = M.zoomAt(M.create(WORLD, 800, 600), 3, 400, 300);
  v = M.centreOn(v, 10, 5);
  const r = M.resize(v, 600, 800);
  near(M.level(r), M.level(v), 1e-9);
  near(r.cx, 10, 1e-9);
  near(r.cz, 5, 1e-9);
  assert.equal(r.w, 600);
});

test("layout keeps the important icon and drops the one that would sit on it", () => {
  const a = { id: "mosque", x: 100, y: 100, r: 14, prio: 1, lw: 50, lh: 14 };
  const b = { id: "bin", x: 108, y: 104, r: 14, prio: 8, lw: 40, lh: 14 };
  const c = { id: "park", x: 300, y: 100, r: 14, prio: 4, lw: 40, lh: 14 };
  const out = M.layout([b, c, a]).map((e) => e.item.id);
  assert.deepEqual(plain(out), ["mosque", "park"]);
});

test("layout slides a headline icon (prio <= 5) aside instead of dropping it, and never onto another icon", () => {
  const camel = { id: "camel_yard", x: 100, y: 100, r: 18, prio: 2, lw: 60, lh: 16 };
  const horse = { id: "horse_stable", x: 108, y: 100, r: 18, prio: 2, lw: 60, lh: 16 };
  const bin = { id: "bin", x: 104, y: 100, r: 14, prio: 8, lw: 0, lh: 0 };
  const out = M.layout([bin, camel, horse], 3);
  assert.deepEqual(plain(out.map((e) => e.item.id)), ["camel_yard", "horse_stable"]);
  const [a, b] = out.map((e) => e.item);
  assert.ok(
    Math.hypot(a.x - b.x, a.y - b.y) >= a.r + b.r + 3,
    "the slid icon is clear of the first",
  );
  assert.equal(horse.x, 108, "the caller's item is not changed");
  assert.equal(b.id, "horse_stable");
});

test("layout always keeps forced items (the go-here target)", () => {
  const a = { id: "a", x: 50, y: 50, r: 14, prio: 1, lw: 0, lh: 0 };
  const t = { id: "target", x: 52, y: 50, r: 14, prio: 9, force: true, lw: 0, lh: 0 };
  assert.deepEqual(plain(M.layout([a, t]).map((e) => e.item.id)), ["a", "target"]);
});

test("layout places labels where they hide nothing, and skips the ones that cannot fit", () => {
  const a = { id: "a", x: 100, y: 100, r: 12, prio: 1, lw: 60, lh: 14 };
  const b = { id: "b", x: 100, y: 130, r: 12, prio: 2, lw: 60, lh: 14 }; // right under a's label
  const out = M.layout([a, b]);
  const la = out.find((e) => e.item.id === "a").label;
  assert.ok(la, "the first label is placed");
  const lb = out.find((e) => e.item.id === "b").label;
  if (lb) {
    const overlap = la.x0 < lb.x1 && la.x1 > lb.x0 && la.y0 < lb.y1 && la.y1 > lb.y0;
    assert.equal(overlap, false, "two labels never overlap");
  }
  out.forEach((e) => {
    if (!e.label) return;
    out.forEach((o) => {
      if (o === e) return;
      const dx = Math.max(e.label.x0 - o.item.x, 0, o.item.x - e.label.x1);
      const dy = Math.max(e.label.y0 - o.item.y, 0, o.item.y - e.label.y1);
      assert.ok(Math.hypot(dx, dy) >= o.item.r, "a label never covers another icon");
    });
  });
});

test("pick returns the nearest icon within the slop, else null", () => {
  const items = [
    { id: "a", x: 100, y: 100, r: 12 },
    { id: "b", x: 140, y: 100, r: 12 },
  ];
  assert.equal(M.pick(items, 104, 100, 4).id, "a");
  assert.equal(M.pick(items, 125, 100, 4).id, "b", "b's edge is 3 px away, a's is 13");
  assert.equal(M.pick(items, 120, 160, 4), null);
});

test("clusterGrid finds the car parks: cells with enough vehicles, at their centre", () => {
  const pts = [
    { x: 1, z: 1 },
    { x: 3, z: 1 },
    { x: 2, z: 3 },
    { x: 205, z: 5 },
    { x: 400, z: 400 },
  ];
  const c = M.clusterGrid(pts, 80, 3);
  assert.equal(c.length, 1);
  near(c[0].x, 2);
  near(c[0].z, 5 / 3);
  assert.equal(c[0].n, 3);
});

test("arrived: within 4 m, or the radius given", () => {
  assert.equal(M.arrived(0, 0, 3, 2), true);
  assert.equal(M.arrived(0, 0, 3, 3), false, "4.24 m is not yet there");
  assert.equal(M.arrived(0, 0, 3, 3, 5), true);
});
