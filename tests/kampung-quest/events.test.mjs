// World events (pure director, js/sim/events.js): one at a time, a calm gap between them, never
// during a prayer / the azan / a rite / a menu / a pause, and repeatable with a seeded rng.
import test from "node:test";
import assert from "node:assert/strict";
import { loadSim, plain } from "./load-sim.mjs";

const { Events } = loadSim().Sim;
const CLEAR = {};

/** A small seeded random source (mulberry32). */
function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Run the director for `secs` seconds in 1 s steps; the list of transitions with their time. */
function run(director, secs, ctx) {
  const out = [];
  for (let t = 0; t < secs; t += 1) {
    const r = director.update(1, ctx);
    if (r) out.push({ at: t, ...plain(r) });
  }
  return out;
}

const KAMPUNG_NOON = { region: "kampung", minute: 12 * 60, flags: CLEAR };

test("the first event waits for the first delay, then events come every few minutes", () => {
  const d = Events.create(seeded(1));
  const log = run(d, 1800, KAMPUNG_NOON);
  const starts = log.filter((e) => e.type === "start");
  assert.ok(starts[0].at >= Events.CONFIG.firstDelay - 1, "not before the first delay");
  assert.ok(starts.length >= 4 && starts.length <= 12, "a handful in 30 minutes: " + starts.length);
  for (let i = 1; i < starts.length; i += 1) {
    const gap = starts[i].at - starts[i - 1].at;
    assert.ok(gap >= Events.CONFIG.gapMin, "a calm gap between events: " + gap);
  }
});

test("at most one event at a time: a start always follows an end", () => {
  const d = Events.create(seeded(7), { firstDelay: 1, gapMin: 1, gapMax: 2 });
  const log = run(d, 3000, KAMPUNG_NOON);
  let open = false;
  for (const e of log) {
    if (e.type === "start") {
      assert.equal(open, false, "no start while one is running");
      open = true;
    } else open = false;
  }
  assert.ok(log.filter((e) => e.type === "start").length > 10);
});

test("no event ever starts, and a running one ends, while anything blocks", () => {
  for (const reason of Events.REASONS) {
    const d = Events.create(seeded(3), { firstDelay: 1, gapMin: 1, gapMax: 2 });
    const blocked = { ...KAMPUNG_NOON, flags: { [reason]: true } };
    assert.deepEqual(run(d, 600, blocked), [], reason + " holds everything back");
    // an event running when the block begins is ended at once, with that reason
    const e = Events.create(seeded(3), { firstDelay: 1, gapMin: 1, gapMax: 2 });
    run(e, 5, KAMPUNG_NOON);
    assert.ok(e.active(), "an event is running");
    const end = e.update(1, blocked);
    assert.equal(end.type, "end");
    assert.equal(end.reason, reason);
    assert.equal(e.active(), null);
  }
});

test("blocked time does not count towards the next event (the play clock only runs when free)", () => {
  const d = Events.create(seeded(2), { firstDelay: 100 });
  run(d, 500, { ...KAMPUNG_NOON, flags: { azan: true } });
  assert.equal(d.debug().wait, 100);
  assert.deepEqual(run(d, 90, KAMPUNG_NOON), [], "still 10 s to go");
});

test("blockedReason names the first reason, null when clear", () => {
  assert.equal(Events.blockedReason({}), null);
  assert.equal(Events.blockedReason(null), null);
  assert.equal(Events.blockedReason({ azan: true, ritual: true }), "azan");
  assert.equal(Events.blockedReason({ ritual: true }), "ritual");
});

test("the region and the time of day decide what can happen", () => {
  const kampung = new Set();
  const holy = new Set();
  const r = seeded(11);
  for (let i = 0; i < 300; i += 1) {
    kampung.add(Events.choose(r, "kampung", 12 * 60, [], []).id);
    holy.add(Events.choose(r, "haramain", 12 * 60, [], []).id);
  }
  assert.deepEqual([...kampung].sort(), [
    "balloon",
    "catchase",
    "football",
    "icecream",
    "kompang",
    "rain",
  ]);
  assert.deepEqual([...holy].sort(), ["dates", "photo", "pigeons"]);
  const night = new Set();
  for (let i = 0; i < 100; i += 1) night.add(Events.choose(r, "kampung", 22 * 60, [], []).id);
  assert.deepEqual([...night], ["rain"], "only a rain shower fits the night");
  assert.equal(Events.choose(r, "nowhere", 600, [], []), null);
});

test("the same event does not repeat straight away, and `exclude` is honoured", () => {
  const d = Events.create(seeded(5), { firstDelay: 1, gapMin: 1, gapMax: 1, avoidLast: 2 });
  const starts = run(d, 4000, KAMPUNG_NOON).filter((e) => e.type === "start");
  for (let i = 2; i < starts.length; i += 1) {
    assert.notEqual(starts[i].id, starts[i - 1].id);
    assert.notEqual(starts[i].id, starts[i - 2].id);
  }
  const ex = Events.create(seeded(5), { firstDelay: 1, gapMin: 1, gapMax: 1 });
  const ids = run(ex, 2000, { ...KAMPUNG_NOON, exclude: ["football", "rain"] })
    .filter((e) => e.type === "start")
    .map((e) => e.id);
  assert.ok(ids.length > 5);
  assert.ok(!ids.includes("football") && !ids.includes("rain"));
});

test("a seeded rng gives the same schedule every time", () => {
  const a = run(Events.create(seeded(42)), 3000, KAMPUNG_NOON);
  const b = run(Events.create(seeded(42)), 3000, KAMPUNG_NOON);
  assert.deepEqual(a, b);
  const c = run(Events.create(seeded(43)), 3000, KAMPUNG_NOON);
  assert.notDeepEqual(a, c);
});

test("force starts a named event (not while one runs or blocked) and stop ends it", () => {
  const d = Events.create(seeded(1));
  assert.equal(d.force("nope"), null);
  assert.equal(d.force("football", { azan: true }), null);
  const s = plain(d.force("football"));
  assert.equal(s.type, "start");
  assert.equal(s.id, "football");
  assert.equal(d.force("rain"), null, "one at a time");
  assert.equal(plain(d.stop("done")).type, "end");
  assert.equal(d.active(), null);
  assert.ok(d.debug().wait >= Events.CONFIG.gapMin, "a calm gap follows a stopped event");
});

test("every event lasts a sensible time and has a radar name", () => {
  for (const ev of Events.CATALOGUE) {
    assert.ok(ev.secs >= 20 && ev.secs <= 120, ev.id);
    assert.ok(ev.label.length >= 3, ev.id);
    assert.ok(["kampung", "haramain"].includes(ev.region), ev.id);
  }
  assert.equal(new Set(Events.CATALOGUE.map((e) => e.id)).size, Events.CATALOGUE.length);
});

test("an event ends by itself when its time is up", () => {
  const d = Events.create(seeded(9));
  d.force("pigeons");
  const log = run(d, 40, { region: "haramain", minute: 600, flags: CLEAR });
  assert.equal(log.length, 1);
  assert.equal(log[0].type, "end");
  assert.equal(log[0].reason, "time");
});
