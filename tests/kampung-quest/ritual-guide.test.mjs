// Tawaf / sa'i pacing, forgiving counting, the dotted ground guide and the gentle hints
// (js/sim/ritual-walk.js). Owner feedback: "the tawaf is too fast ... show the user guidance".
import test from "node:test";
import assert from "node:assert/strict";
import { loadSim } from "./load-sim.mjs";

const KQ = loadSim();
const W = KQ.Sim.RitualWalk;
const KAABA = { x: 0, z: 0, w: 10, d: 12, blackStoneCorner: "SE" };
const START = W.blackStoneAngle(KAABA);
const RING = { cx: 0, cz: 0, startAngle: START, rMin: 7, rMax: 32, rounds: 7 };
const route = (radius) => W.tawafRoute({ cx: 0, cz: 0, startAngle: START, radius });

/** Feed an anticlockwise walk of `turns` laps at `radius` into a tracker. */
function walk(t, radius, turns, from = 0) {
  const r = route(radius);
  for (let u = from; u <= turns; u += 0.01) {
    const p = r.at(u);
    t.feed(p.x, p.z);
  }
}

/* ------------------------------ pace ------------------------------ */

test("the auto tawaf is calm: a round takes about half a minute, all seven over three minutes", () => {
  const round = (Math.PI * 2 * W.TAWAF_RADIUS) / W.TAWAF_SPEED;
  assert.ok(round >= 25 && round <= 60, "a round takes " + round.toFixed(1) + " s");
  assert.ok(round * 7 >= 180, "seven rounds are not over in a flash");
  assert.ok(W.TAWAF_SPEED <= 3.2, "no faster than a stroll (the hero walks at 2.3 m/s)");
});

test("the sa'i auto-walk is a stroll, a touch quicker between the green lights, never a run", () => {
  assert.ok(W.WALK_SPEED <= 3.5);
  assert.ok(W.BRISK_SPEED > W.WALK_SPEED && W.BRISK_SPEED <= 5);
  const lane = W.saiRoute({ a: { x: 42, z: -40 }, b: { x: 42, z: 40 }, lights: { z0: -8, z1: 8 } });
  const secs = 16 / W.BRISK_SPEED + 64 / W.WALK_SPEED;
  assert.ok(lane.length / 1 === 80 && secs >= 20, "a leg takes " + secs.toFixed(1) + " s");
});

/* ------------------------------ forgiving counting ------------------------------ */

test("a round counts anywhere in the wide band and a bit before the line", () => {
  for (const radius of [8, 14, 30]) {
    const t = W.createTawaf(RING);
    walk(t, radius, 1.0);
    assert.equal(t.rounds, 1, "one round at radius " + radius);
  }
  const t = W.createTawaf(RING);
  walk(t, 14, 0.94); // stops a little short of the line
  assert.equal(t.rounds, 1, "walking a touch short still counts");
  const short = W.createTawaf(RING);
  walk(short, 14, 0.8);
  assert.equal(short.rounds, 0, "but a part round does not");
});

test("starting a little way from the Black Stone line still begins the count", () => {
  const t = W.createTawaf(RING);
  const r = route(14).at(-0.07); // about 25 degrees before the line
  t.feed(r.x, r.z);
  assert.equal(t.armed, true);
});

test("stepping off the ring for a moment keeps the progress", () => {
  const t = W.createTawaf(RING);
  walk(t, 14, 0.5);
  const away = route(60).at(0.5);
  t.feed(away.x, away.z);
  assert.equal(t.onRing, false);
  assert.ok(t.progress > 0.45, "progress kept: " + t.progress);
  walk(t, 14, 1.0, 0.5);
  assert.equal(t.rounds, 1);
});

test("walking clockwise is flagged (for a gentle hint) and never counts", () => {
  const t = W.createTawaf(RING);
  walk(t, 14, 0.2); // armed and going the right way
  assert.equal(t.back, false);
  const r = route(14);
  for (let u = 0.2; u >= -1.5; u -= 0.01) t.feed(r.at(u).x, r.at(u).z);
  assert.equal(t.back, true);
  assert.equal(t.rounds, 0);
});

test("the sa'i counter says which hill is next", () => {
  const a = { x: 42, z: -40 };
  const b = { x: 42, z: 40 };
  const t = W.createSai({ a, b, r: 7, legs: 7 });
  assert.equal(t.want, "b");
  t.feed(42, -38);
  t.feed(42, 36); // within 7 m of Marwa
  assert.equal(t.legs, 1);
  assert.equal(t.want, "a");
});

/* ------------------------------ the dotted guide ------------------------------ */

test("the tawaf guide is a closed ring of evenly spaced dots, anticlockwise, with a start line", () => {
  const g = W.tawafGuide({ cx: 0, cz: 0, startAngle: START, radius: 14 });
  assert.equal(g.closed, true);
  assert.ok(g.dots.length >= 30 && g.dots.length <= 80, "few dots: " + g.dots.length);
  for (const d of g.dots) assert.ok(Math.abs(Math.hypot(d.x, d.z) - 14) < 1e-6);
  const gap = Math.hypot(g.dots[1].x - g.dots[0].x, g.dots[1].z - g.dots[0].z);
  assert.ok(Math.abs(gap - W.DOT_GAP) < 0.3, "gap " + gap);
  for (let i = 0; i < g.dots.length; i += 1) {
    const a = g.dots[i];
    const b = g.dots[(i + 1) % g.dots.length];
    const turn = W.wrap(W.angleOf(0, 0, b.x, b.z) - W.angleOf(0, 0, a.x, a.z));
    assert.ok(turn > 0, "anticlockwise at dot " + i);
  }
  assert.ok(Math.abs(W.wrap(W.angleOf(0, 0, g.dots[0].x, g.dots[0].z) - START)) < 1e-9);
  assert.equal(g.lines.length, 1);
  const l = g.lines[0];
  const mid = { x: (l.x1 + l.x2) / 2, z: (l.z1 + l.z2) / 2 };
  assert.ok(
    Math.abs(W.wrap(W.angleOf(0, 0, mid.x, mid.z) - START)) < 1e-6,
    "on the Black Stone line",
  );
  assert.ok(Math.hypot(l.x2 - l.x1, l.z2 - l.z1) >= 8, "long enough to see");
});

test("the sa'i guide is a straight dotted lane Safa to Marwa with a line at each hill", () => {
  const a = { x: 42, z: -40 };
  const b = { x: 42, z: 40 };
  const g = W.saiGuide({ a, b, w: 10 });
  assert.equal(g.closed, false);
  assert.deepEqual([g.dots[0].x, g.dots[0].z], [42, -40]);
  const last = g.dots[g.dots.length - 1];
  assert.ok(Math.hypot(last.x - b.x, last.z - b.z) < 1e-6);
  assert.equal(g.lines.length, 2);
  assert.ok(g.dots.length <= 60);
});

test("the dots ahead of the hero glow, going anticlockwise, and an arrow stands on the first", () => {
  const g = W.tawafGuide({ cx: 0, cz: 0, startAngle: START, radius: 14 });
  const n = g.dots.length;
  const hero = g.dots[10];
  const st = W.guideState(g, { x: hero.x, z: hero.z, armed: true, want: "b" });
  assert.deepEqual(Array.from(st.lit), [11, 12, 13, 14].slice(0, W.LIT_AHEAD));
  assert.equal(st.arrow.x, g.dots[11].x);
  const dx = g.dots[11].x - hero.x;
  const dz = g.dots[11].z - hero.z;
  assert.ok(
    Math.abs(W.wrap(st.arrow.heading - Math.atan2(dx, dz))) < 1e-9,
    "points along the path",
  );
  const wrap = W.guideState(g, { x: g.dots[n - 1].x, z: g.dots[n - 1].z, armed: true, want: "b" });
  assert.equal(wrap.lit[0], 0, "wraps round the circle");
});

test("before counting begins the first dots (the start line) glow", () => {
  const g = W.tawafGuide({ cx: 0, cz: 0, startAngle: START, radius: 14 });
  const st = W.guideState(g, { x: 30, z: 30, armed: false, want: "b" });
  assert.equal(st.lit[0], 0);
});

test("on the sa'i lane the glow points to the hill being walked to and flips on the way back", () => {
  const g = W.saiGuide({ a: { x: 42, z: -40 }, b: { x: 42, z: 40 }, w: 10 });
  const mid = g.dots[Math.floor(g.dots.length / 2)];
  const out = W.guideState(g, { x: mid.x, z: mid.z, armed: true, want: "b" });
  const back = W.guideState(g, { x: mid.x, z: mid.z, armed: true, want: "a" });
  assert.ok(out.lit[0] > out.from && back.lit[0] < back.from);
  assert.ok(Math.abs(W.wrap(out.arrow.heading)) < 0.1, "south (+z) toward Marwa");
  assert.ok(Math.abs(Math.abs(back.arrow.heading) - Math.PI) < 0.1, "north toward Safa");
  const end = W.guideState(g, { x: 42, z: 40, armed: true, want: "b" });
  assert.equal(end.arrow, null, "nothing ahead at the end of the lane");
});

/* ------------------------------ gentle hints ------------------------------ */

test("tawaf hints say what to do next and never scold", () => {
  const base = { rounds: 0, target: 7, armed: true, onRing: true, back: false, progress: 0.4 };
  assert.match(W.tawafHint(Object.assign({}, base, { armed: false })), /gold line.*Black Stone/);
  assert.match(W.tawafHint(Object.assign({}, base, { onRing: false })), /Come back/);
  assert.match(W.tawafHint(Object.assign({}, base, { back: true })), /Other way, please.*LEFT/);
  assert.match(W.tawafHint(Object.assign({}, base, { progress: 0.9 })), /Nearly round 1/);
  assert.match(W.tawafHint(Object.assign({}, base, { rounds: 2 })), /Round 3 of 7/);
  assert.match(W.tawafHint(Object.assign({}, base, { rounds: 7 })), /All 7 rounds done/);
  for (const o of [{}, { back: true }, { armed: false }, { onRing: false }])
    assert.doesNotMatch(W.tawafHint(Object.assign({}, base, o)), /wrong|fail|error|mistake/i);
});

test("sa'i hints name the hill and cheer when near", () => {
  const s = { legs: 0, target: 7, armed: true, want: "b", toGoal: 50 };
  assert.match(W.saiHint(Object.assign({}, s, { armed: false })), /Walk to Safa/);
  assert.match(W.saiHint(s), /Follow the dots to Marwa/);
  assert.match(W.saiHint(Object.assign({}, s, { want: "a" })), /Follow the dots to Safa/);
  assert.match(W.saiHint(Object.assign({}, s, { toGoal: 5 })), /Nearly at Marwa/);
  assert.match(W.saiHint(Object.assign({}, s, { legs: 7 })), /All 7 legs done/);
});
