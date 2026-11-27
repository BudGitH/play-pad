// Umrah / Hajj / Ziarah steps, counters, save shape; word-by-word recitation; tawaf and sa'i counting;
// and the ritual texts (every Arabic word has its transliteration token).
import test from "node:test";
import assert from "node:assert/strict";
import { loadSimWithData, plain } from "./load-sim.mjs";

const KQ = loadSimWithData();
const U = KQ.Sim.Umrah;
const W = KQ.Sim.RitualWalk;
const R = KQ.Sim.Recite;

/** Press Next until the rite is done; returns the ids of the steps passed and the number of presses. */
function runToDone(tracker, rite) {
  const seen = [];
  let presses = 0;
  tracker.start(rite);
  while (!tracker.view(rite).done && presses < 200) {
    const v = tracker.view(rite);
    if (seen[seen.length - 1] !== v.step.id) seen.push(v.step.id);
    tracker.next(rite);
    presses += 1;
  }
  return { seen, presses };
}

test("Umrah runs in the right order: ihram, talbiyah, enter, tawaf, maqam, zamzam, sa'i, tahallul, done", () => {
  const t = U.create();
  const { seen } = runToDone(t, "umrah");
  assert.deepEqual(seen, [
    "ihram",
    "talbiyah",
    "enter",
    "tawaf",
    "maqam",
    "zamzam",
    "sai",
    "tahallul",
    "done",
  ]);
});

test("Next alone reaches done; tawaf and sa'i each need 7, the two raka'at need 2", () => {
  const t = U.create();
  t.start("umrah");
  const counts = {};
  let guard = 0;
  while (!t.view("umrah").done && guard++ < 200) {
    const v = t.view("umrah");
    if (v.target) counts[v.step.id] = v.target;
    t.next("umrah");
  }
  assert.deepEqual(counts, { tawaf: 7, maqam: 2, sai: 7 });
  assert.equal(t.view("umrah").done, true);
  // 9 cards + 7 rounds + 2 raka'at + 7 legs, each counter step spends `target` presses before moving on
  const presses = runToDone(U.create(), "umrah").presses;
  assert.equal(presses, 9 + 7 + 2 + 7);
});

test("the tawaf counter counts one per press and holds at 7 until the step moves on", () => {
  const t = U.create();
  t.start("umrah");
  for (let i = 0; i < 3; i += 1) t.next("umrah"); // ihram, talbiyah, enter
  assert.equal(t.view("umrah").step.id, "tawaf");
  for (let n = 1; n <= 7; n += 1) {
    const r = t.next("umrah");
    assert.equal(r.counted, true);
    assert.equal(r.view.count, n);
  }
  assert.equal(t.view("umrah").full, true);
  assert.equal(t.bump("umrah").ok, false, "bump never passes the target");
  assert.equal(t.next("umrah").moved, true);
  assert.equal(t.view("umrah").step.id, "maqam");
});

test("setAtLeast raises the counter for a walked round and never lowers it", () => {
  const t = U.create();
  t.start("umrah");
  for (let i = 0; i < 3; i += 1) t.next("umrah");
  assert.equal(t.setAtLeast("umrah", 4), 4);
  assert.equal(t.setAtLeast("umrah", 2), 4);
  assert.equal(t.setAtLeast("umrah", 50), 7, "capped at the target");
});

test("sa'i starts at Safa and ends at Marwa: leg 1 Safa to Marwa, leg 7 ends at Marwa", () => {
  assert.deepEqual(plain(W.saiLeg(1)), { from: "safa", to: "marwa" });
  assert.deepEqual(plain(W.saiLeg(2)), { from: "marwa", to: "safa" });
  assert.deepEqual(plain(W.saiLeg(7)), { from: "safa", to: "marwa" });
  const step = U.STEPS.umrah.find((s) => s.id === "sai");
  assert.equal(step.site, "safa");
  assert.equal(step.counter.n, 7);
});

test("ihram goes on when the ihram step is left and off after tahallul, with a haircut chosen", () => {
  const t = U.create();
  t.start("umrah");
  assert.equal(t.ihram, false);
  t.next("umrah"); // leave "ihram"
  assert.equal(t.ihram, true);
  assert.equal(t.cut, "none");
  runToDone(t, "umrah");
  assert.equal(t.ihram, false, "ihram ends at tahallul");
  assert.equal(t.cut, "trim", "the default haircut is a trim");
  const chosen = U.create();
  chosen.setCut("shave");
  runToDone(chosen, "umrah");
  assert.equal(chosen.cut, "shave", "a choice made at the salon is kept");
});

test("Back always works, shows the earlier step as complete, and the first card stays put", () => {
  const t = U.create();
  t.start("umrah");
  assert.equal(t.back("umrah").moved, false);
  for (let i = 0; i < 4; i += 1) t.next("umrah"); // now on tawaf with 1 round
  t.back("umrah");
  assert.equal(t.view("umrah").step.id, "enter");
  t.next("umrah");
  t.back("umrah");
  t.back("umrah");
  assert.equal(t.view("umrah").step.id, "talbiyah");
});

test("Hajj highlights: Mina, Arafah, Muzdalifah pebbles, Aqabah 7, qurban, hair, ifadah, sa'i, tashriq, wada'", () => {
  const { seen } = runToDone(U.create(), "hajj");
  assert.deepEqual(seen, [
    "h_ihram",
    "h_mina",
    "h_arafah",
    "h_muzdalifah",
    "h_aqabah",
    "h_qurban",
    "h_hair",
    "h_ifadah",
    "h_sai",
    "h_tashriq",
    "h_wada",
    "h_done",
  ]);
  const by = (id) => U.STEPS.hajj.find((s) => s.id === id);
  assert.equal(by("h_aqabah").counter.n, 7);
  assert.equal(by("h_muzdalifah").counter.n, 7);
  assert.equal(by("h_tashriq").counter.n, 3, "three pillars");
  assert.equal(by("h_wada").counter.n, 7);
});

test("Ziarah: Nabawi salam, Rawdah 2 raka'at, Quba 2 raka'at, Uhud, Baqi'", () => {
  const { seen } = runToDone(U.create(), "ziarah");
  assert.deepEqual(seen, ["z_salam", "z_rawdah", "z_quba", "z_uhud", "z_baqi", "z_done"]);
  const by = (id) => U.STEPS.ziarah.find((s) => s.id === id);
  assert.equal(by("z_rawdah").counter.n, 2);
  assert.equal(by("z_quba").counter.n, 2);
});

test("a finished rite can be started again from its first card", () => {
  const t = U.create();
  runToDone(t, "ziarah");
  assert.equal(t.view("ziarah").done, true);
  t.start("ziarah");
  assert.equal(t.view("ziarah").done, false);
  assert.equal(t.view("ziarah").index, 0);
});

test("summary names the current step for the mission card", () => {
  const t = U.create();
  assert.equal(t.summary(), null);
  t.start("umrah");
  assert.match(t.summary(), /^Umrah: Ihram and niyyah/);
  for (let i = 0; i < 5; i += 1) t.next("umrah");
  assert.match(t.summary(), /^Umrah: Tawaf: 7 rounds \(2 of 7\)$/);
});

test("snapshot and restore round-trip, and old saves without rituals stay valid", () => {
  const t = U.create();
  t.start("umrah");
  for (let i = 0; i < 6; i += 1) t.next("umrah");
  const snap = plain(t.snapshot());
  const again = U.create();
  assert.equal(again.restore(snap), true);
  assert.deepEqual(plain(again.view("umrah").step.id), "tawaf");
  assert.equal(again.view("umrah").count, 3);
  assert.equal(again.ihram, true);
  const Save = KQ.Sim.Save;
  const oldSave = Save.defaultState();
  delete oldSave.rituals;
  assert.equal(Save.sanitize(oldSave).rituals, null);
});

test("a hostile rituals section is clamped, whitelisted and never throws", () => {
  const bad = {
    last: "__proto__",
    idx: { umrah: 9999, hajj: -5, ziarah: "x", __proto__: { evil: 1 } },
    count: { umrah: 1e9, hajj: NaN, ziarah: -3 },
    done: { umrah: "yes" },
    ihram: "true",
    cut: "bald-eagle",
  };
  const clean = U.sanitize(bad);
  assert.equal(clean.last, null);
  assert.equal(clean.idx.umrah, U.STEPS.umrah.length - 1);
  assert.equal(clean.idx.hajj, 0);
  assert.equal(clean.count.umrah, 0, "the last card has no counter");
  assert.equal(clean.done.umrah, false);
  assert.equal(clean.ihram, false);
  assert.equal(clean.cut, "none");
  assert.equal(U.sanitize("nope"), null);
  assert.equal(U.sanitize([1, 2]), null);
  const t = U.create();
  t.start("umrah");
  assert.equal(t.restore(null), false);
  const saved = KQ.Sim.Save.sanitize({ ...KQ.Sim.Save.defaultState(), rituals: bad });
  assert.equal(saved.rituals.cut, "none");
});

/* ------------------------------ word by word ------------------------------ */

test("the reading cursor moves, jumps, clamps and auto-advances", () => {
  const c = R.create(3);
  assert.equal(c.index, 0);
  assert.equal(c.next(), 1);
  assert.equal(c.set(99), 2);
  assert.equal(c.atEnd, true);
  assert.equal(c.next(), 2, "stays on the last word");
  assert.equal(c.prev(), 1);
  assert.equal(c.set(-4), 0);
  assert.equal(c.tick(0.5), false);
  assert.equal(c.tick(R.AUTO_SECONDS), true);
  assert.equal(c.index, 1);
  assert.equal(R.create(0).tick(5), false);
});

test("Al-Fatihah has 29 words and each word carries its line's meaning", () => {
  const words = R.wordsOf(KQ.RITUAL_TEXT.fatihah);
  assert.equal(words.length, 4 + 4 + 2 + 3 + 4 + 3 + 9);
  assert.equal(words[0].ar, "بِسْمِ");
  assert.equal(words[0].tr, "Bismi");
  assert.match(words[0].en, /In the name of Allah/);
  assert.equal(words.at(-1).line, 6);
});

/* ------------------------------ the texts ------------------------------ */

test("every ritual text has its Arabic and transliteration words lined up one to one", () => {
  Object.entries(KQ.RITUAL_TEXT).forEach(([id, item]) => {
    assert.ok(item.title && item.ref, id + " has a title and a source");
    item.lines.forEach((ln, i) => {
      const ar = R.split(ln.ar);
      const tr = R.split(ln.tr);
      assert.equal(
        ar.length,
        tr.length,
        `${id} line ${i + 1}: ${ar.length} Arabic vs ${tr.length} transliteration`,
      );
      assert.ok(ln.en && ln.en.length > 3, `${id} line ${i + 1} has a meaning`);
      assert.match(ln.ar, /[؀-ۿ]/, id + " is Arabic");
    });
  });
});

test("the surahs have their standard verse counts", () => {
  const counts = { fatihah: 7, ikhlas: 4, kafirun: 6, falaq: 5, nas: 6, kawthar: 3 };
  Object.entries(counts).forEach(([id, n]) => assert.equal(KQ.RITUAL_TEXT[id].lines.length, n, id));
});

test("every text a step names exists", () => {
  Object.values(U.STEPS)
    .flat()
    .forEach((st) =>
      st.texts.forEach((id) => assert.ok(KQ.RITUAL_TEXT[id], st.id + " names missing text " + id)),
    );
});

test("the eating duas are the standard ones", () => {
  assert.equal(KQ.RITUAL_TEXT.bismillah.lines[0].ar, "بِسْمِ ٱللَّٰهِ");
  assert.match(KQ.RITUAL_TEXT.eatAfter.lines[0].tr, /^Alhamdu lillahi alladhi at'amana/);
  assert.match(KQ.RITUAL_TEXT.eatForgot.lines[0].tr, /awwalahu wa-akhirah/);
});

/* ------------------------------ tawaf and sa'i counting ------------------------------ */

const KAABA = { x: 0, z: 0, w: 10, d: 12, blackStoneCorner: "SE" };

/** Feed a tracker the points of an anticlockwise (dir 1) or clockwise (-1) walk of `turns` laps. */
function lap(tracker, route, turns, dir) {
  for (let u = 0; u <= turns; u += 0.01) {
    const p = route.at(u * dir);
    tracker.feed(p.x, p.z);
  }
}

test("the Black Stone is on the south-east corner, and the route runs anticlockwise with the Kaaba on the left", () => {
  const start = W.blackStoneAngle(KAABA);
  assert.ok(start < 0 && start > -Math.PI / 2, "south-east is below east on the map");
  const route = W.tawafRoute({ cx: 0, cz: 0, startAngle: 0, radius: 12 });
  const p = route.at(0); // east of the Kaaba
  const q = route.at(0.01);
  assert.ok(q.z < p.z, "moves north from the east side (anticlockwise)");
  // the Kaaba (west of the walker) is on the left of a walker facing north
  const left = { x: Math.cos(p.heading), z: -Math.sin(p.heading) }; // a figure's own left is +x
  assert.ok(left.x < -0.9, "left-hand side points to the Kaaba");
});

test("seven anticlockwise laps from the Black Stone count 7 rounds; clockwise ones count none", () => {
  const start = W.blackStoneAngle(KAABA);
  const route = W.tawafRoute({ cx: 0, cz: 0, startAngle: start, radius: 12 });
  const make = () =>
    W.createTawaf({ cx: 0, cz: 0, startAngle: start, rMin: 8, rMax: 30, rounds: 7 });
  const ccw = make();
  lap(ccw, route, 7.1, 1);
  assert.equal(ccw.rounds, 7);
  const cw = make();
  lap(cw, route, 7.1, -1);
  assert.equal(cw.rounds, 0);
  const half = make();
  lap(half, route, 3.5, 1);
  assert.equal(half.rounds, 3);
});

test("walking far from the Kaaba, or never passing the Black Stone line, counts nothing", () => {
  const start = W.blackStoneAngle(KAABA);
  const far = W.tawafRoute({ cx: 0, cz: 0, startAngle: start, radius: 60 });
  const t = W.createTawaf({ cx: 0, cz: 0, startAngle: start, rMin: 8, rMax: 30, rounds: 7 });
  lap(t, far, 3, 1);
  assert.equal(t.rounds, 0);
  const fresh = W.createTawaf({ cx: 0, cz: 0, startAngle: start, rMin: 8, rMax: 30, rounds: 7 });
  fresh.feed(12, 0);
  assert.equal(fresh.armed, false, "east side is not the Black Stone line");
});

test("sa'i counts 7 legs from Safa and the 7th ends at Marwa; brisk only between the green lights", () => {
  const a = { x: 42, z: -40 };
  const b = { x: 42, z: 40 };
  const route = W.saiRoute({ a, b, lights: { z0: -8, z1: 8 } });
  const t = W.createSai({ a, b, r: 4, legs: 7 });
  const seen = [];
  for (let d = 0; d <= route.length * 7; d += 0.5) {
    const p = route.at(d);
    t.feed(p.x, p.z);
    if (seen[seen.length - 1] !== t.legs) seen.push(t.legs);
  }
  assert.deepEqual(seen, [0, 1, 2, 3, 4, 5, 6, 7]);
  const end = route.at(route.length * 7 - 0.1);
  assert.ok(Math.abs(end.z - 40) < 1, "leg 7 ends at Marwa");
  assert.equal(route.brisk(route.length / 2), true, "the middle of the lane is between the lights");
  assert.equal(route.brisk(5), false, "near Safa is not");
  assert.ok(route.speed(route.length / 2) > route.speed(5));
});

test("sa'i does not count until the hero is at Safa", () => {
  const a = { x: 42, z: -40 };
  const b = { x: 42, z: 40 };
  const t = W.createSai({ a, b, r: 4, legs: 7 });
  t.feed(42, 40); // starting at Marwa is not the start
  assert.equal(t.legs, 0);
  t.feed(42, -39);
  t.feed(42, 39);
  assert.equal(t.legs, 1);
});
