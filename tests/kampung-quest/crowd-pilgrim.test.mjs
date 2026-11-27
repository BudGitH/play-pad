// The pure rules of the Haramain pilgrim crowd (js/sim/crowd-pilgrim.js), the Makkah prayer times
// (js/data/prayer-times-makkah.js), the region ids (js/data/region.js) and the per-region save slot.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { SIM_FILES } from "./load-sim.mjs";

const JS_DIR = path.resolve(import.meta.dirname, "../../games/kampung-quest/js");

/** A sandbox with KQ.region preset (as region.js would set it), the named sim / data files run in order. */
function load(region, files) {
  const sandbox = {
    KQ: { region },
    location: { search: "", protocol: "http:" },
    localStorage: { getItem: () => null, setItem: () => {} },
    URLSearchParams,
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  for (const f of files) {
    const source = fs.readFileSync(path.join(JS_DIR, f), "utf8");
    vm.runInContext(source, sandbox, { filename: f });
  }
  return sandbox.KQ;
}

const KQ = load("haramain", ["sim/crowd.js", "sim/crowd-pilgrim.js"]);
const C = KQ.Sim.Crowd;
const P = C.Pilgrim;
const angle = (x, z) => Math.atan2(-z, x);
const norm = (d) => ((d + Math.PI * 3) % (Math.PI * 2)) - Math.PI;

test("tawaf walkers circle the Kaaba anticlockwise as seen from above, with the Kaaba on their left", () => {
  const ring = { r: 16, th0: 0.7, v: 0.9 };
  let prev = P.tawafAt(ring, 0);
  for (let t = 5; t <= 120; t += 5) {
    const p = P.tawafAt(ring, t);
    assert.ok(
      norm(angle(p.x, p.z) - angle(prev.x, prev.z)) > 0,
      "angle grows (anticlockwise) at t=" + t,
    );
    assert.ok(Math.abs(Math.hypot(p.x, p.z) - 16) < 1e-9, "stays on its lane");
    const dx = Math.sin(p.heading);
    const dz = Math.cos(p.heading);
    const left = { x: dz, z: -dx };
    assert.ok(left.x * -p.x + left.z * -p.z > 0, "the Kaaba is on the walker's left");
    assert.ok(Math.abs(dx * p.x + dz * p.z) < 1e-9, "heading is tangent to the ring");
    prev = p;
  }
});

test("sa'i goes from Safa (north end, z -37) to Marwa (z +37) and back, never leaving the lane", () => {
  const lane = { x: 43, v: 1, phase: 0 };
  const start = P.saiAt(lane, 0);
  assert.equal(start.z, P.SAI.zMin);
  assert.equal(start.heading, 0, "first leg faces Marwa (south, +z)");
  const mid = P.saiAt(lane, 74);
  assert.ok(
    Math.abs(mid.z - 37) < 1e-9 && mid.heading === Math.PI,
    "turns at Marwa and heads back to Safa",
  );
  for (let t = 0; t < 400; t += 3) {
    const p = P.saiAt(lane, t);
    assert.ok(p.z >= P.SAI.zMin - 1e-9 && p.z <= P.SAI.zMax + 1e-9 && p.x === 43);
  }
});

test("the congregation moves through the postures in order, in unison, with a small ripple per row", () => {
  const seen = new Set();
  for (let t = 0; t < P.CYCLE_LEN; t += 0.5) seen.add(P.prayerPose(t, 0));
  ["qiyam", "ruku", "itidal", "sujud", "julus"].forEach((p) => assert.ok(seen.has(p), p));
  assert.equal(P.prayerPose(0, 0), "qiyam");
  assert.equal(P.prayerPose(1, 0), P.prayerPose(1 + P.CYCLE_LEN, 0), "periodic");
  assert.equal(P.prayerPose(9, 0), "ruku");
  assert.equal(P.prayerPose(9, 2), "qiyam", "a row 2 s behind is still standing");
});

test("qibla: the Kaaba in Makkah, south in Madinah", () => {
  assert.ok(Math.abs(P.qiblaHeading(0, -30)) < 1e-9, "north of the Kaaba faces south");
  assert.ok(Math.abs(P.qiblaHeading(-30, 0) - Math.PI / 2) < 1e-9, "west of it faces east");
  assert.equal(P.qiblaHeading(601, 12), 0);
  assert.equal(P.qiblaHeading(0, 0), 0);
});

test("the Haram never sleeps: tawaf, sa'i, prayer rows, readers and dua are busy at 03:00", () => {
  for (const k of P.KINDS) {
    for (let m = 0; m < 1440; m += 20) {
      const v = C.occupancy(k, m);
      assert.ok(v >= 0 && v <= 1, k + " at " + m);
    }
    assert.ok(C.occupancy(k, 180) > 0.2, k + " at 03:00 = " + C.occupancy(k, 180));
  }
  assert.ok(C.occupancy("chat", 180) >= 0.45, "chat circles stay at night in this region");
  assert.ok(C.walkerTarget(180, "med") > 0, "strollers at night too");
  assert.ok(
    P.KINDS.every((k) => C.KINDS.includes(k)),
    "kinds are registered",
  );
});

test("men at the tawaf wear ihram (two white cloths, arms bare), women a modest abaya and scarf", () => {
  let men = 0;
  let women = 0;
  for (let i = 0; i < 120; i += 1) {
    const o = C.outfit("tawaf:0:" + i, "adult");
    if (o.kid) continue;
    if (o.female) {
      women += 1;
      assert.ok(o.long && o.skirt && o.head === "tudung", "woman " + i + " is covered");
    } else {
      men += 1;
      assert.equal(o.top, "#f6f4ee");
      assert.equal(o.legs, "#f6f4ee");
      assert.equal(o.long, false, "arms bare in ihram");
      assert.notEqual(o.head, "tudung");
    }
  }
  assert.ok(men > 15 && women > 15, "both genders appear: " + men + "/" + women);
});

test("Madinah people wear thobes; outfits are deterministic", () => {
  const a = C.outfit("pray:nabawi:3:120@5", "adult", false);
  const b = C.outfit("pray:nabawi:3:120@5", "adult", false);
  assert.deepEqual(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(b)));
  assert.ok(a.long && a.skirt, "a long thobe");
  assert.equal(P.codeOf("read:nabawi:4"), "thobe");
  assert.equal(P.codeOf("sai:1:2"), "ihram");
  assert.equal(P.codeOf("walker:7"), "mix");
});

test("prayer-row spots in one stretch of a row fill together", () => {
  assert.equal(P.rowGroup("pray:nabawi:5:1250"), P.rowGroup("pray:nabawi:5:1300"));
  assert.notEqual(P.rowGroup("pray:nabawi:5:1250"), P.rowGroup("pray:nabawi:6:1250"));
  assert.equal(P.rowGroup("pray:haram:330:3"), P.rowGroup("pray:haram:330:10"));
  assert.notEqual(P.rowGroup("pray:haram:330:3"), P.rowGroup("pray:haram:330:13"));
});

test("without the Haramain region the kampung crowd is untouched", () => {
  const plain = load("kampung", ["sim/crowd.js", "sim/crowd-pilgrim.js"]).Sim.Crowd;
  assert.equal(plain.occupancy("tawaf", 700), 0, "the holy kinds are not registered");
  assert.equal(plain.KINDS.includes("tawaf"), false);
  assert.equal(plain.occupancy("diner", 180), 0, "the kampung still sleeps at 03:00");
  assert.ok(plain.outfit("x", "adult").top !== undefined);
});

test("Makkah prayer times are labelled approximate and in the right order", () => {
  const T = load("haramain", ["data/prayer-times.js", "data/prayer-times-makkah.js"]);
  assert.equal(T.PRAYER_TIMES, T.PRAYER_TIMES_MAKKAH, "the haramain region uses them");
  const t = T.PRAYER_TIMES_MAKKAH;
  assert.equal(t.approximate, true);
  assert.match(t.source, /Approximate/);
  const m = (s) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3));
  const order = [t.subuh, t.syuruk, t.zohor, t.asar, t.maghrib, t.isyak].map(m);
  assert.deepEqual(
    order,
    [...order].sort((a, b) => a - b),
  );
  assert.equal(m(t.isyak) - m(t.maghrib), 90, "Umm al-Qura: Isha 90 minutes after Maghrib");
  const K = load("kampung", ["data/prayer-times.js", "data/prayer-times-makkah.js"]);
  assert.equal(K.PRAYER_TIMES.zohor, "12:54", "the kampung keeps the MUIS times");
});

test("every region has its own save slot and the kampung keeps the original key", () => {
  const files = SIM_FILES.filter((f) => !["recite", "ritual-walk", "umrah"].includes(f)).map(
    (f) => "sim/" + f + ".js",
  );
  const kampung = load("kampung", files);
  const holy = load("haramain", files);
  assert.equal(kampung.Sim.Save.KEY, "kampung-quest:v1");
  assert.equal(holy.Sim.Save.KEY, "kampung-quest:v1:haramain");
  assert.equal(holy.Sim.Save.WORLD_HALF, 1000, "the holy world is bigger than the town");
  assert.equal(kampung.Sim.Save.WORLD_HALF, 70);
});

test("region.js: the list is data, ids are valid and the default is the kampung", () => {
  const R = load("", ["data/region.js"]);
  assert.ok(R.Region.LIST.length >= 2);
  R.Region.LIST.forEach((r) => {
    assert.ok(r.id && r.name && r.tagline && r.art, r.id);
  });
  assert.deepEqual([...R.Region.IDS.slice(0, 2)], ["kampung", "haramain"]);
  assert.equal(R.region, "kampung");
});
