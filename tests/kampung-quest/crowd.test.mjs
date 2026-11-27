// The pure rules of the neighbourhood crowd (js/sim/crowd.js) and the extra poses (js/figures/crowd-poses.js).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { loadSim, SIM_FILES, plain } from "./load-sim.mjs";

const KQ = loadSim([...SIM_FILES, "crowd"]);
const C = KQ.Sim.Crowd;
const hours = (h) => h * 60;

test("every kind of crowd activity is empty in the dead of night", () => {
  for (const kind of C.KINDS) {
    assert.equal(C.occupancy(kind, hours(2)), 0, kind + " at 02:00");
    assert.ok(C.occupancy(kind, hours(23.9)) < 0.05, kind + " is nearly empty at 23:54");
  }
});

test("occupancy stays between 0 and 1 all day, and wraps around midnight", () => {
  for (const kind of C.KINDS) {
    for (let m = 0; m < 1440; m += 7) {
      const v = C.occupancy(kind, m);
      assert.ok(v >= 0 && v <= 1, kind + " " + m + " = " + v);
    }
    assert.equal(C.occupancy(kind, 735), C.occupancy(kind, 735 + 1440));
  }
  assert.equal(C.occupancy("nonsense", 700), 0);
  assert.equal(C.occupancy("diner", NaN), 0);
});

test("the hawker is busiest at lunch, the bus stop at the rush hours, tai chi at dawn", () => {
  assert.ok(C.occupancy("diner", hours(12.7)) > 0.7);
  assert.ok(C.occupancy("diner", hours(12.7)) > C.occupancy("diner", hours(10)));
  assert.ok(C.occupancy("bus", hours(7.4)) > 0.8);
  assert.ok(C.occupancy("bus", hours(7.4)) > C.occupancy("bus", hours(15)));
  assert.ok(C.occupancy("exercise", hours(6.4)) > 0.8);
  assert.equal(C.occupancy("exercise", hours(13)), 0);
  assert.ok(C.occupancy("play", hours(16.8)) > C.occupancy("play", hours(11)));
});

test("a spot's state is stable inside a block and its share follows the occupancy", () => {
  const key = "diner:s12";
  const first = C.slotActive(key, 0.5, hours(12) + 1);
  for (let m = hours(12); m < hours(12) + C.BLOCK_MIN; m += 1) {
    assert.equal(C.slotActive(key, 0.5, m), first, "same block, same answer");
  }
  let taken = 0;
  for (let i = 0; i < 400; i += 1) if (C.slotActive("s" + i, 0.3, hours(9))) taken += 1;
  assert.ok(taken > 90 && taken < 150, "about 30% taken, got " + taken);
  assert.equal(C.slotActive("x", 0, hours(9)), false);
  assert.equal(C.slotActive("x", 1, hours(9)), true);
});

test("caps grow with the quality tier and the stroller target stays inside them", () => {
  assert.ok(C.capFor("low") < C.capFor("med"));
  assert.ok(C.capFor("med") < C.capFor("high"));
  assert.equal(C.capFor("weird"), C.capFor("med"));
  for (const tier of ["low", "med", "high"]) {
    for (let m = 0; m < 1440; m += 15) {
      const n = C.walkerTarget(m, tier);
      assert.ok(Number.isInteger(n) && n >= 0 && n < C.capFor(tier), tier + " " + m + " = " + n);
    }
    assert.equal(C.walkerTarget(hours(3), tier), 0);
    assert.ok(C.walkerTarget(hours(7.7), tier) > C.walkerTarget(hours(15), tier));
  }
});

test("stroller types: every weight is positive somewhere, joggers only at dawn and dusk", () => {
  for (const type of C.WALKER_TYPES) {
    let any = false;
    for (let m = 0; m < 1440; m += 30) if (C.walkerWeights(m)[type] > 0) any = true;
    assert.ok(any, type);
  }
  assert.equal(C.walkerWeights(hours(13))["jogger"], 0);
  assert.ok(C.walkerWeights(hours(6.3))["jogger"] > 1);
  const seen = new Set();
  for (let i = 0; i < 300; i += 1) seen.add(C.walkerType(hours(8), (i + 0.5) / 300));
  assert.ok(seen.size >= 4, "a morning mixes several types");
  for (const t of seen) assert.ok(C.WALKERS[t], t);
});

test("a stroller's speed range is sensible for its pose", () => {
  for (const type of C.WALKER_TYPES) {
    const w = C.WALKERS[type];
    assert.ok(w.speed[0] > 0.5 && w.speed[1] >= w.speed[0] && w.speed[1] < 5, type);
  }
  assert.ok(C.WALKERS.jogger.speed[0] > C.WALKERS.commuter.speed[1]);
  assert.ok(C.WALKERS.elder.speed[1] < C.WALKERS.commuter.speed[0]);
});

test("outfits are deterministic, modest and respect the role", () => {
  assert.deepEqual(plain(C.outfit("seed-a", "adult")), plain(C.outfit("seed-a", "adult")));
  const kinds = new Set();
  for (let i = 0; i < 300; i += 1) {
    const o = C.outfit("p" + i, "any");
    kinds.add(o.age);
    assert.match(o.skin, /^#[0-9a-f]{6}$/);
    assert.match(o.top, /^#[0-9a-f]{6}$/);
    assert.ok(o.scale >= 0.84 && o.scale <= 1.1, "height varies but stays sensible: " + o.scale);
    assert.ok(o.girth >= 0.88 && o.girth <= 1.22, "body size varies: " + o.girth);
    if (!o.kid) assert.ok(o.long || o.skirt || o.top, "adults are covered");
    if (o.female && !o.kid) assert.ok(o.long, "women wear long sleeves");
    if (o.head === "tudung") assert.ok(o.female);
  }
  assert.ok(kinds.has("kid") && kinds.has("elder") && kinds.has("adult") && kinds.has("teen"));
  for (let i = 0; i < 40; i += 1) {
    assert.equal(C.outfit("k" + i, "kid").kid, true);
    assert.equal(C.outfit("e" + i, "elder").kid, false);
    assert.equal(C.outfit("f" + i, "adult", true).female, true);
    assert.equal(C.outfit("m" + i, "adult", false).female, false);
  }
});

test("caps are about 2x the first crowd and the draw-call cost does not depend on them", () => {
  assert.deepEqual({ ...C.TIER_CAPS }, { low: 120, med: 195, high: 280 });
  assert.ok(C.TIER_CAPS.low >= 2 * 56 && C.TIER_CAPS.med >= 2 * 84 && C.TIER_CAPS.high >= 2 * 120);
});

test("the new activity kinds follow the clock: shops by day, picnics after school, loners on the pavements", () => {
  for (const kind of ["shop", "picnic", "loiter"]) assert.ok(C.KINDS.includes(kind), kind);
  assert.ok(C.occupancy("shop", hours(18.4)) > 0.6);
  assert.ok(C.occupancy("shop", hours(18.4)) > C.occupancy("shop", hours(15)));
  assert.ok(C.occupancy("picnic", hours(17.2)) > 0.7);
  assert.equal(C.occupancy("picnic", hours(12)), 0);
  assert.ok(C.occupancy("loiter", hours(12.8)) > C.occupancy("loiter", hours(15)));
});

test("strollers come in groups: families, pupils and friends; singles stay single", () => {
  assert.equal(C.walkerGroup("jogger", 0.5), 1);
  assert.equal(C.walkerGroup("cyclist", 0.99), 1);
  assert.ok(C.walkerGroup("family", 0.1) >= 2, "a parent and at least one child");
  const sizes = new Set();
  for (let i = 0; i < 100; i += 1) sizes.add(C.walkerGroup("student", (i + 0.5) / 100));
  assert.deepEqual([...sizes].sort(), [1, 2, 3]);
  assert.ok(C.WALKERS.student.speed[1] < C.WALKERS.jogger.speed[0]);
  assert.ok(C.walkerWeights(hours(7)).student > C.walkerWeights(hours(11)).student);
  assert.equal(C.walkerWeights(hours(3)).student, C.walkerWeights(hours(3)).student);
});

test("pupils wear a school uniform: white top, dark bottoms, girls modest", () => {
  const ages = new Set();
  for (let i = 0; i < 120; i += 1) {
    const o = C.outfit("pupil" + i, "student");
    ages.add(o.age);
    assert.ok(o.age === "kid" || o.age === "teen", o.age);
    assert.equal(o.kid, o.age === "kid");
    assert.ok(Math.min(...parseHex(o.top)) > 200, "a white-ish top: " + o.top);
    assert.ok(Math.max(...parseHex(o.legs)) < 140, "dark bottoms: " + o.legs);
    if (o.female && o.group === "malay") assert.ok(o.head.startsWith("tudung"));
    if (o.age === "teen") assert.ok(o.scale < 0.95, "teens are shorter than adults");
  }
  assert.deepEqual([...ages].sort(), ["kid", "teen"]);
});

const parseHex = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

test("variety: skin tones, hair, headwear, body sizes and colours spread widely across a crowd", () => {
  const skins = new Set();
  const tops = new Set();
  const heads = new Set();
  const hairs = new Set();
  const girths = [];
  for (let i = 0; i < 600; i += 1) {
    const o = C.outfit("v" + i, "any");
    skins.add(o.skin);
    tops.add(o.top);
    heads.add(o.head);
    if (o.head === "hair") hairs.add(o.headColour);
    girths.push(o.girth);
  }
  assert.ok(skins.size > 100, "per-person skin shade: " + skins.size);
  assert.ok(tops.size > 200, "per-person clothing shade: " + tops.size);
  for (const h of ["hair", "bun", "tudung", "tudung_kid", "songkok", "kopiah", "cap", "turban"])
    assert.ok(heads.has(h), "headwear " + h);
  assert.ok(hairs.size > 6, "hair colours " + hairs.size);
  assert.ok(Math.max(...girths) - Math.min(...girths) > 0.25, "slight to stocky");
});

test("shade lightens and darkens a colour and always returns a valid hex", () => {
  assert.equal(C.shade("#808080", 0), "#808080");
  assert.ok(parseHex(C.shade("#808080", 0.5))[0] > 128);
  assert.ok(parseHex(C.shade("#808080", -0.5))[0] < 128);
  assert.equal(C.shade("#ffffff", 0.9), "#ffffff");
  assert.equal(C.shade("#000000", -0.9), "#000000");
  for (const k of [-3, -0.2, 0.2, 3]) assert.match(C.shade("#d27aa6", k), /^#[0-9a-f]{6}$/);
});

test("a chat circle faces the middle, a queue lines up and a grid is centred", () => {
  const ring = C.circleSlots(10, -4, 3, 0.7, 0.4);
  assert.equal(ring.length, 3);
  for (const s of ring) {
    assert.ok(Math.abs(Math.hypot(s.x - 10, s.z + 4) - 0.7) < 1e-9);
    const toMiddle = Math.atan2(10 - s.x, -4 - s.z);
    assert.ok(Math.abs(Math.sin(s.heading - toMiddle)) < 1e-9, "faces the centre");
  }
  const q = C.queueSlots(5, -27, 3, 0.7, 1, Math.PI);
  assert.deepEqual(plain(q.map((s) => s.x.toFixed(2))), ["5.00", "5.70", "6.40"]);
  assert.ok(q.every((s) => s.z === -27 && s.heading === Math.PI));
  const grid = C.gridSlots(0, 0, 3, 2, 1.5, 1);
  assert.equal(grid.length, 6);
  assert.ok(Math.abs(grid.reduce((a, s) => a + s.x, 0)) < 1e-9);
  assert.ok(Math.abs(grid.reduce((a, s) => a + s.z, 0)) < 1e-9);
});

test("exactly one person speaks at a time and the turn moves on", () => {
  for (const size of [2, 3, 4]) {
    const seen = new Set();
    for (let t = 0; t < 60; t += 1) {
      const speaker = C.speakerAt("g1", size, t, 5);
      assert.ok(speaker >= 0 && speaker < size);
      seen.add(speaker);
    }
    assert.equal(seen.size, size, "everyone gets a turn");
  }
  assert.equal(C.speakerAt("g1", 3, 1, 5), C.speakerAt("g1", 3, 4, 5));
});

test("headingTo points a figure (0 = facing +z) at a target", () => {
  assert.ok(Math.abs(C.headingTo(0, 0, 0, 5)) < 1e-9);
  assert.ok(Math.abs(C.headingTo(0, 0, 5, 0) - Math.PI / 2) < 1e-9);
  assert.ok(Math.abs(Math.abs(C.headingTo(0, 0, 0, -5)) - Math.PI) < 1e-9);
});

// ---------- the extra poses ----------
const FIGURES = path.resolve(import.meta.dirname, "../../games/kampung-quest/js/figures");

/** poses.js + crowd-poses.js in a sandbox (they are pure maths; geometry.js gives the part sizes). */
function loadPoses() {
  const sandbox = {};
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  for (const name of ["poses", "prayer-poses", "crowd-poses"]) {
    vm.runInContext(fs.readFileSync(path.join(FIGURES, name + ".js"), "utf8"), sandbox, {
      filename: name,
    });
  }
  return sandbox.KQ.Figures;
}

const JOINTS = [
  "hips",
  "torso",
  "head",
  "armL",
  "armR",
  "foreL",
  "foreR",
  "handL",
  "handR",
  "legL",
  "legR",
  "kneeL",
  "kneeR",
];
const ADULT = { thigh: 0.13, shin: 0.175, hipH: 0.305, legD: 0.12, scale: 1.1 };
const KID = { thigh: 0.08, shin: 0.125, hipH: 0.205, legD: 0.12, scale: 1 };

/** Assert every joint of one pose result is a finite triple (and root offsets are finite numbers). */
function checkPose(name, p, pose) {
  for (const key of Object.keys(pose)) {
    const v = pose[key];
    assert.ok([].concat(v).every(Number.isFinite), name + "." + key + " at " + p);
    if (JOINTS.includes(key)) assert.equal(v.length, 3, name + "." + key);
    else assert.ok(key === "rootY" || key === "rootZ", name + " unexpected key " + key);
  }
}

test("every crowd pose is registered, has a loop speed, and gives finite joint angles at every phase", () => {
  const F = loadPoses();
  const names = Object.keys(F.CROWD_POSES);
  assert.ok(names.length >= 12);
  for (const name of names) {
    assert.equal(typeof F.POSES[name], "function", name + " registered");
    assert.ok(F.CROWD_RATES[name] > 0, name + " has a rate");
    for (const dims of [ADULT, KID]) {
      for (let p = 0; p < 1; p += 0.05) checkPose(name, p, F.POSES[name](p, dims));
    }
  }
});

test("poses loop: the end of a cycle meets its start", () => {
  const F = loadPoses();
  for (const name of Object.keys(F.CROWD_POSES)) {
    const a = F.POSES[name](0, ADULT);
    const b = F.POSES[name](1 - 1e-9, ADULT);
    for (const key of Object.keys(a)) {
      const x = [].concat(a[key]);
      const y = [].concat(b[key]);
      x.forEach((v, i) => assert.ok(Math.abs(v - y[i]) < 1e-3, name + "." + key + " seam"));
    }
  }
});

test("seated crowd poses keep the thighs level; tai chi lowers the hips without sinking into the floor", () => {
  const F = loadPoses();
  for (const name of ["sittalk", "sitphone"]) {
    const p = F.POSES[name](0.3, ADULT);
    assert.ok(Math.abs(p.legL[0] + Math.PI / 2) < 1e-9, name);
    assert.ok(Math.abs(p.kneeL[0] - Math.PI / 2) < 1e-9, name);
  }
  for (let p = 0; p < 1; p += 0.1) {
    const t = F.POSES.taiji(p, ADULT);
    const drop = -t.rootY;
    assert.ok(drop > 0 && drop < 0.05, "a small crouch, got " + drop);
    // the legs, bent as posed, reach the floor from the lowered hips
    const reach =
      ADULT.thigh * Math.cos(-t.legL[0]) + ADULT.shin * Math.cos(t.kneeL[0] + t.legL[0]);
    assert.ok(Math.abs(ADULT.thigh + ADULT.shin - drop - reach) < 0.012, "feet stay on the floor");
  }
});
