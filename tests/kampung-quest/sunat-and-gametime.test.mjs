// Owner requests 4 and 5 (features/kampung-quest-improvements/prayer.md):
//   4. a voluntary sunat prayer (2 raka'at) is always available at the mosque, with the same
//      guided wudu + posture flow, and it never touches the five-prayer tracker;
//   5. the azan (the sim's `due` event) follows the GAME clock only: it fires exactly when the
//      injected clock reading reaches a prayer's start, however the clock got there.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { loadSim, loadSimWithData, FIXTURE_TIMES, plain, mins } from "./load-sim.mjs";

const KQ = loadSim();
const Prayer = KQ.Sim.Prayer;
const JS = path.resolve(import.meta.dirname, "../../games/kampung-quest/js");

/** A tracker started (new game) at 07:00 on day 1, so Subuh is prayed-at-home and nothing is due. */
function started(at = "07:00") {
  const prayer = Prayer.create(FIXTURE_TIMES);
  prayer.update(mins(at), 1);
  return prayer;
}

function doWudu(prayer) {
  for (const step of Prayer.WUDU_STEPS) assert.equal(prayer.wuduStep(step.id).ok, true, step.id);
}

function doPrayer(prayer) {
  let last = null;
  for (const step of prayer.nextPrayStep() ? Prayer.rakaatPlan("sunat") : []) {
    if (!step.optional) last = prayer.prayStep(step.id);
    assert.equal(last.ok, true, step.id);
  }
  return last;
}

/* ------------------------------ 4. sunat prayer ------------------------------ */

test("sunat plan: 2 raka'at, takbir first, one tasyahud (the final one), both salams, no qunut", () => {
  const plan = Prayer.rakaatPlan("sunat");
  const types = plan.map((s) => s.type);
  assert.equal(plan.length, 16);
  assert.equal(types[0], "takbir");
  assert.deepEqual(plain(types.slice(-2)), ["salam_r", "salam_l"]);
  assert.equal(types.filter((t) => t === "qiyam").length, 2);
  assert.equal(types.filter((t) => t === "ruku").length, 2);
  assert.equal(types.filter((t) => t === "sujud").length, 4);
  assert.equal(types.filter((t) => t === "tasyahud_akhir").length, 1);
  assert.equal(types.filter((t) => t === "tasyahud_awal").length, 0);
  assert.equal(types.filter((t) => t === "qunut").length, 0);
  assert.equal(plan[plan.length - 1].rakaat, 2);
  assert.equal(Prayer.rakaatOf("sunat"), 2);
  assert.deepEqual(
    plain(Prayer.rakaatPlan("SUNAT")),
    plain(plan),
    "case-insensitive like the fard names",
  );
});

test("the five fard prayers are unchanged by the sunat addition", () => {
  assert.deepEqual(plain(Prayer.NAMES), ["subuh", "zohor", "asar", "maghrib", "isyak"]);
  assert.deepEqual(plain(Prayer.RAKAAT), { subuh: 2, zohor: 4, asar: 4, maghrib: 3, isyak: 4 });
  assert.equal(Prayer.rakaatPlan("subuh").length, 17);
});

test("sunat can start with no prayer due: wudu first, then the 2-raka'at steps, then it clears", () => {
  const prayer = started();
  assert.equal(prayer.state().due, null);
  const res = prayer.startFlow("sunat");
  assert.equal(res.ok, true);
  assert.equal(res.kind, "sunat");
  assert.equal(res.phase, "wudu");
  assert.equal(res.rakaat, 2);
  assert.equal(prayer.prayStep("takbir").ok, false, "no prayer steps before wudu");
  doWudu(prayer);
  assert.equal(prayer.state().flow.phase, "pray");
  const done = doPrayer(prayer);
  assert.equal(done.done, true);
  assert.equal(done.result.kind, "sunat");
  assert.equal(done.result.name, "sunat");
  assert.equal(done.result.late, false);
  assert.match(done.result.praise, /sunat/i);
  assert.equal(prayer.state().flow, null);
});

test("sunat never marks a fard prayer done, never adds qada, never blocks missions", () => {
  const prayer = started();
  const before = plain(prayer.state().prayers);
  prayer.startFlow("sunat");
  assert.equal(prayer.isBlockingMissions(), false, "a voluntary flow does not pause missions");
  assert.equal(prayer.due(), null);
  doWudu(prayer);
  doPrayer(prayer);
  const after = prayer.state();
  assert.deepEqual(plain(after.prayers), before, "the five-prayer strip is exactly as it was");
  assert.deepEqual(plain(after.qada), []);
  assert.equal(after.due, null);
  assert.equal(
    after.wuduClean,
    true,
    "wudu stays clean, so a second sunat skips straight to prayer",
  );
  assert.equal(prayer.startFlow("sunat").phase, "pray");
});

test("sunat does not tick a Zohor that is merely upcoming", () => {
  const prayer = started("12:00");
  prayer.startFlow("sunat");
  doWudu(prayer);
  doPrayer(prayer);
  const zohor = prayer.state().prayers.find((p) => p.name === "zohor");
  assert.equal(zohor.status, "upcoming");
  const events = plain(prayer.update(mins("13:00"), 1));
  assert.deepEqual(
    events.map((e) => e.type + ":" + e.name),
    ["due:zohor"],
    "Zohor still falls due on time, with its own azan",
  );
});

test("sunat is refused while a fard prayer is due or being prayed (it never replaces one)", () => {
  const prayer = started("12:59");
  prayer.update(mins("13:00"), 1);
  assert.equal(prayer.state().due, "zohor");
  const refused = prayer.startFlow("sunat");
  assert.equal(refused.ok, false);
  assert.match(refused.hint, /Zohor comes first/);
  assert.equal(prayer.state().flow, null);
  prayer.startFlow("zohor");
  assert.equal(prayer.startFlow("sunat").ok, false, "not while Zohor is in progress");
  assert.equal(prayer.state().flow.name, "zohor", "the Zohor flow was left alone");
});

test("a fard prayer falling due during a sunat flow takes over without losing the wudu", () => {
  const prayer = started("12:30");
  prayer.startFlow("sunat");
  doWudu(prayer);
  const events = plain(prayer.update(mins("13:00"), 1));
  assert.deepEqual(
    events.map((e) => e.type),
    ["due"],
  );
  assert.equal(prayer.state().due, "zohor");
  assert.equal(
    prayer.state().flow.name,
    "sunat",
    "the voluntary flow is not yanked from under the child",
  );
  const fard = prayer.startFlow("zohor");
  assert.equal(fard.ok, true);
  assert.equal(fard.kind, "due");
  assert.equal(fard.phase, "pray", "wudu done for the sunat counts for Zohor");
});

test("a sunat flow survives a save / load round trip, and a hostile snapshot cannot forge one", () => {
  const prayer = started();
  prayer.startFlow("sunat");
  doWudu(prayer);
  prayer.prayStep("takbir");
  const snap = plain(prayer.snapshot());
  const clone = Prayer.create(FIXTURE_TIMES);
  assert.equal(clone.restore(snap), true);
  const flow = clone.state().flow;
  assert.equal(flow.name, "sunat");
  assert.equal(flow.kind, "sunat");
  assert.equal(flow.phase, "pray");
  assert.equal(clone.nextPrayStep().type, "qiyam");
  const forged = Prayer.sanitizeSnapshot({
    entries: [],
    lastAbs: 10,
    flow: { name: "sunat", kind: "qada", phase: "pray", prayIdx: 999 },
  });
  assert.equal(forged.flow.kind, "sunat");
  assert.ok(forged.flow.prayIdx < 16, "index clamped into the 16-step plan");
  const fardForged = Prayer.sanitizeSnapshot({
    entries: [],
    lastAbs: 10,
    flow: { name: "zohor", kind: "sunat", phase: "pray" },
  });
  assert.equal(fardForged.flow.kind, "due", "a fard flow can never carry the sunat kind");
});

/* ------------------------------ 5. azan follows game time ------------------------------ */

/** The `due` events as "name@HH:MM" from a list of sim events. */
function dues(events) {
  return events.filter((e) => e.type === "due").map((e) => e.name);
}

test("the due event fires at exactly the prayer's start minute of the game clock, not a moment before", () => {
  for (const name of ["subuh", "zohor", "asar", "maghrib", "isyak"]) {
    const start = mins(FIXTURE_TIMES[name]);
    const prayer = started(name === "subuh" ? "01:00" : "07:00");
    prayer.update(start - 1, 1); // may carry earlier prayers; clear them from consideration
    assert.deepEqual(dues(plain(prayer.update(start - 0.001, 1))), [], name + " not yet");
    const events = plain(prayer.update(start, 1));
    assert.deepEqual(dues(events), [name], name + " due at its start minute");
    assert.equal(events[0].at, start, "stamped with the game-clock minute it was due");
  }
});

test("the real MUIS times (js/data) fire from the game clock: 12:54, 16:17, 18:54, 20:08, 05:29", () => {
  const real = loadSimWithData();
  const times = real.PRAYER_TIMES;
  const prayer = real.Sim.Prayer.create(times);
  prayer.update(mins("00:10"), 1);
  const seen = [];
  for (let minute = 10; minute <= 1439; minute += 1) {
    for (const e of plain(prayer.update(minute + 0.5, 1))) {
      if (e.type === "due") seen.push(e.name + "@" + Math.floor(e.at));
    }
  }
  assert.deepEqual(seen, [
    "subuh@" + mins(times.subuh),
    "zohor@" + mins(times.zohor),
    "asar@" + mins(times.asar),
    "maghrib@" + mins(times.maghrib),
    "isyak@" + mins(times.isyak),
  ]);
});

test("a time skip (rest, setMinute, a long frame) emits every crossed start in order, each stamped with its own start", () => {
  const prayer = started("07:00");
  const events = plain(prayer.update(mins("19:30"), 1));
  const order = events.filter((e) => e.type === "due").map((e) => [e.name, e.at]);
  assert.deepEqual(order, [
    ["zohor", mins(FIXTURE_TIMES.zohor)],
    ["asar", mins(FIXTURE_TIMES.asar)],
    ["maghrib", mins(FIXTURE_TIMES.maghrib)],
  ]);
  for (let i = 1; i < events.length; i += 1)
    assert.ok(events[i].at >= events[i - 1].at, "chronological");
  // exactly one of them is still live; the earlier ones closed in the same batch (the game layer
  // starts a single azan for the live one only: see liveDue in prayer-flow.js)
  const live = prayer.state();
  assert.equal(live.due, "maghrib");
  assert.deepEqual(plain(live.qada.map((q) => q.name)), ["zohor", "asar"]);
});

test("stepping in rest-sized one-minute hops fires the due event on the exact hop that crosses the start, once", () => {
  const prayer = started("12:20");
  const fired = [];
  for (let minute = mins("12:20"); minute < mins("13:40"); minute += 1) {
    for (const e of plain(prayer.update(minute + 0.25, 1))) {
      if (e.type === "due") fired.push([e.name, minute + 0.25]);
    }
  }
  assert.equal(fired.length, 1);
  assert.equal(fired[0][0], "zohor");
  assert.equal(fired[0][1], mins("13:00") + 0.25, "the hop that crossed 13:00");
});

test("save / load: a save just before the start still gets its azan on time; a save after it does not repeat it", () => {
  const before = started("12:59");
  const snapBefore = plain(before.snapshot());
  const loaded = Prayer.create(FIXTURE_TIMES);
  loaded.restore(snapBefore);
  loaded.update(mins("12:59"), 1); // what launch() does with the saved clock
  assert.deepEqual(dues(plain(loaded.update(mins("13:00"), 1))), ["zohor"]);

  const after = started("12:59");
  after.update(mins("13:02"), 1);
  const snapAfter = plain(after.snapshot());
  const reloaded = Prayer.create(FIXTURE_TIMES);
  reloaded.restore(snapAfter);
  assert.deepEqual(plain(reloaded.update(mins("13:02"), 1)), [], "no second azan on reload");
  assert.deepEqual(dues(plain(reloaded.update(mins("13:03"), 1))), []);
  assert.equal(
    reloaded.state().due,
    "zohor",
    "it is still due, so the card and guidance come back",
  );
});

test("setMinute / rewind: the tracker restarts as a new game (no events), and the start fires again going forward", () => {
  const prayer = started("14:00");
  assert.deepEqual(
    plain(prayer.update(mins("12:50"), 1)),
    [],
    "a rewind is a rebuild, not an azan",
  );
  assert.equal(prayer.rebuilds(), 1);
  assert.deepEqual(dues(plain(prayer.update(mins("13:00"), 1))), ["zohor"]);
});

test("the next-prayer countdown is game minutes: inMin comes from the game clock reading", () => {
  const prayer = started("12:30");
  assert.equal(prayer.state().next.name, "zohor");
  assert.equal(prayer.state().next.inMin, 30);
  prayer.update(mins("12:45") + 0.5, 1);
  assert.equal(prayer.state().next.inMin, 14.5);
});

test("no wall clock anywhere on the prayer path: sim, data and the prayer controller", () => {
  const files = [
    ...fs.readdirSync(path.join(JS, "sim")).map((f) => path.join(JS, "sim", f)),
    ...fs.readdirSync(path.join(JS, "data")).map((f) => path.join(JS, "data", f)),
    path.join(JS, "game", "prayer-flow.js"),
    path.join(JS, "game", "hud-view.js"),
  ];
  // Date.now in prayer-ui.js only paces screen-reader announcements (a UI debounce), never a prayer time.
  const banned = /\b(Date\.now|new Date|performance\.now|setInterval)\b/;
  for (const file of files) {
    const code = fs.readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
    assert.equal(banned.test(code), false, path.basename(file) + " reads the wall clock");
  }
});

/* ------------------------------ interaction priority ------------------------------ */

test("pickTarget: the mosque-hall Pray fallback never outranks a neighbour who can be talked to", () => {
  const Missions = KQ.Sim.Missions;
  const pray = { dist: 6, fallback: true };
  assert.equal(Missions.pickTarget({ enabled: true, dist: 2 }, pray, false), "npc");
  assert.equal(Missions.pickTarget({ enabled: true, dist: 2 }, pray, true), "npc");
  assert.equal(
    Missions.pickTarget({ enabled: false, dist: 4 }, pray, true),
    "obj",
    "far NPC: Pray shows",
  );
  assert.equal(Missions.pickTarget(null, pray, false), "obj");
  // ordinary objects keep the existing rules
  assert.equal(Missions.pickTarget({ enabled: true, dist: 2.2 }, { dist: 1.7 }, false), "obj");
  assert.equal(Missions.pickTarget({ enabled: true, dist: 1.2 }, { dist: 1.7 }, false), "npc");
});
