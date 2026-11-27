// AC-7, AC-8, AC-9: prayer times, wudu order, raka'at plans, states, qada, edge cases.
import test from "node:test";
import assert from "node:assert/strict";
import { loadSim, loadPrayerText, FIXTURE_TIMES, plain, mins } from "./load-sim.mjs";

const KQ = loadSim();
const Prayer = KQ.Sim.Prayer;
const POSES = [
  "idle",
  "walk",
  "run",
  "sit",
  "eat",
  "wave",
  "talk",
  "carry",
  "wudu_hands",
  "wudu_face",
  "wudu_feet",
  "wudu_mouth",
  "wudu_nose",
  "wudu_head",
  "wudu_ears",
  "qiyam",
  "takbir",
  "ruku",
  "itidal",
  "sujud",
  "julus",
  "salam_r",
  "salam_l",
  "doa",
];

/** A tracker started (new game) at 07:00 on day 1. */
function started() {
  const prayer = Prayer.create(FIXTURE_TIMES);
  prayer.update(mins("07:00"), 1);
  return prayer;
}

/** Advance to HH:MM on a day, returning the events. */
function goTo(prayer, hhmm, day = 1) {
  return plain(prayer.update(mins(hhmm), day));
}

function statusOf(prayer, name) {
  return prayer.state().prayers.find((p) => p.name === name).status;
}

function doWudu(prayer) {
  for (const step of Prayer.WUDU_STEPS) assert.equal(prayer.wuduStep(step.id).ok, true, step.id);
}

function doPrayer(prayer, name) {
  let last = null;
  for (const step of Prayer.rakaatPlan(name)) {
    if (!step.optional) last = prayer.prayStep(step.id);
    assert.equal(last.ok, true, step.id);
  }
  return last;
}

test("ACC3-01: every plan step carries a raka'at, non-decreasing, ending at the prayer's count", () => {
  for (const name of Object.keys(Prayer.RAKAAT)) {
    const plan = Prayer.rakaatPlan(name);
    let previous = 1;
    for (const step of plan) {
      assert.ok(Number.isInteger(step.rakaat), name + " " + step.id + " has no raka'at");
      assert.ok(step.rakaat >= previous, name + " " + step.id + " goes backwards");
      previous = step.rakaat;
    }
    assert.equal(plan[plan.length - 1].rakaat, Prayer.RAKAAT[name], name + " ends at its count");
    const awal = plan.filter((s) => s.type === "tasyahud_awal");
    const akhir = plan.filter((s) => s.type === "tasyahud_akhir");
    awal.forEach((s) => assert.equal(s.rakaat, 2, name + " first tasyahud ends raka'at 2"));
    akhir.forEach((s) => assert.equal(s.rakaat, Prayer.RAKAAT[name], name + " final tasyahud"));
  }
});

test("raka'at counts: Subuh 2, Zohor 4, Asar 4, Maghrib 3, Isyak 4", () => {
  const expected = { subuh: 2, zohor: 4, asar: 4, maghrib: 3, isyak: 4 };
  for (const [name, count] of Object.entries(expected)) {
    const plan = Prayer.rakaatPlan(name);
    assert.equal(plan.filter((s) => s.type === "qiyam").length, count, name);
    assert.equal(plan.filter((s) => s.type === "ruku").length, count, name);
    assert.equal(plan.filter((s) => s.type === "sujud").length, count * 2, name);
    assert.equal(Prayer.RAKAAT[name], count);
  }
});

test("step plan sizes include takbir, tasyahud and both salams", () => {
  const sizes = { subuh: 17, zohor: 29, asar: 29, maghrib: 23, isyak: 29 };
  for (const [name, size] of Object.entries(sizes))
    assert.equal(Prayer.rakaatPlan(name).length, size, name);
});

test("plans open with takbir and close with salam right then left", () => {
  for (const name of Prayer.NAMES) {
    const ids = plain(Prayer.rakaatPlan(name).map((s) => s.id));
    assert.equal(ids[0], "takbir");
    assert.deepEqual(ids.slice(-2), ["salam_r", "salam_l"]);
    assert.equal(ids.filter((id) => id === "takbir").length, 1, "takbir only in the first raka'at");
  }
});

test("each raka'at runs qiyam, ruku, i'tidal, sujud, julus, sujud in order", () => {
  const types = plain(Prayer.rakaatPlan("zohor").map((s) => s.type));
  const oneRakaat = ["qiyam", "ruku", "itidal", "sujud", "julus", "sujud"];
  assert.deepEqual(types.slice(1, 7), oneRakaat);
  assert.deepEqual(types.slice(7, 13), oneRakaat);
});

test("tasyahud awal only after raka'at 2 of 3/4-raka'at prayers; akhir once, last", () => {
  for (const name of ["zohor", "asar", "maghrib", "isyak"]) {
    const plan = Prayer.rakaatPlan(name);
    const awal = plan.findIndex((s) => s.type === "tasyahud_awal");
    assert.equal(plan[awal - 1].id, "sujud_2b", name);
    assert.equal(plan[awal + 1].id, "qiyam_3", name);
    assert.equal(plan.filter((s) => s.type === "tasyahud_akhir").length, 1);
    assert.equal(plan[plan.length - 3].type, "tasyahud_akhir");
  }
  const subuh = Prayer.rakaatPlan("subuh").map((s) => s.type);
  assert.ok(!subuh.includes("tasyahud_awal"));
  assert.equal(subuh[subuh.length - 3], "tasyahud_akhir");
});

test("Subuh has an optional qunut flagged `qunut` after i'tidal of raka'at 2 only", () => {
  const subuh = Prayer.rakaatPlan("subuh");
  const qunut = subuh.filter((s) => s.qunut);
  assert.equal(qunut.length, 1);
  assert.equal(qunut[0].optional, true);
  assert.equal(subuh[subuh.indexOf(qunut[0]) - 1].id, "itidal_2");
  for (const name of ["zohor", "asar", "maghrib", "isyak"]) {
    assert.equal(Prayer.rakaatPlan(name).filter((s) => s.qunut).length, 0, name);
  }
});

test("plan steps have unique ids, labels in English and Malay, and known poses", () => {
  for (const name of Prayer.NAMES) {
    const plan = Prayer.rakaatPlan(name);
    assert.equal(new Set(plan.map((s) => s.id)).size, plan.length, name);
    for (const step of plan) {
      assert.ok(step.label && step.labelMs && step.cue, step.id);
      assert.ok(POSES.includes(step.pose), step.id + " pose " + step.pose);
    }
  }
  assert.deepEqual(plain(Prayer.rakaatPlan("nope")), []);
  assert.equal(Prayer.rakaatPlan("ZOHOR").length, 29);
});

test("rakaatPlan returns fresh copies (callers cannot corrupt the data)", () => {
  const plan = Prayer.rakaatPlan("asar");
  plan[0].id = "hacked";
  assert.equal(Prayer.rakaatPlan("asar")[0].id, "takbir");
});

test("wudu follows the Shafi'i order with counts and fard flags", () => {
  const ids = plain(Prayer.WUDU_STEPS.map((s) => s.id));
  assert.deepEqual(ids, [
    "niat",
    "hands",
    "mouth",
    "nose",
    "face",
    "arm_r",
    "arm_l",
    "head",
    "ears",
    "foot_r",
    "foot_l",
    "doa",
  ]);
  const byId = Object.fromEntries(Prayer.WUDU_STEPS.map((s) => [s.id, s]));
  for (const id of ["hands", "mouth", "nose", "face", "arm_r", "arm_l", "foot_r", "foot_l"])
    assert.equal(byId[id].count, 3, id);
  for (const id of ["niat", "face", "arm_r", "arm_l", "head", "foot_r", "foot_l"])
    assert.equal(byId[id].fard, true, id);
  for (const id of ["hands", "mouth", "nose", "ears", "doa"])
    assert.equal(byId[id].fard, false, id);
  for (const step of Prayer.WUDU_STEPS) {
    assert.ok(step.label && step.labelMs && POSES.includes(step.pose), step.id);
  }
});

test("WUDU_STEPS is frozen", () => {
  assert.throws(() => {
    Prayer.WUDU_STEPS[0].id = "x";
  });
  assert.throws(() => {
    Prayer.WUDU_STEPS.push({});
  });
});

test("a new game at 07:00 has nothing due: earlier prayers count as prayed at home", () => {
  const prayer = started();
  assert.equal(prayer.due(), null);
  assert.equal(prayer.isBlockingMissions(), false);
  const state = prayer.state();
  assert.equal(state.prayers.length, 5);
  assert.equal(statusOf(prayer, "subuh"), "done");
  assert.equal(state.prayers[0].prefilled, true);
  for (const name of ["zohor", "asar", "maghrib", "isyak"])
    assert.equal(statusOf(prayer, name), "upcoming");
});

test("a prayer becomes due exactly at its time and blocks missions", () => {
  const prayer = started();
  assert.deepEqual(goTo(prayer, "12:59"), []);
  assert.equal(prayer.isBlockingMissions(), false);
  const events = goTo(prayer, "13:00");
  assert.equal(events.length, 1);
  assert.equal(events[0].type, "due");
  assert.equal(events[0].name, "zohor");
  assert.equal(prayer.due(), "zohor");
  assert.equal(prayer.isBlockingMissions(), true);
  assert.deepEqual(goTo(prayer, "13:05"), [], "due fires once");
});

test("state() reports current / next prayer, times and labels", () => {
  const prayer = started();
  goTo(prayer, "13:10");
  const state = prayer.state();
  assert.equal(state.current.name, "zohor");
  assert.ok(Math.abs(state.current.sinceMin - 10) < 1e-9);
  assert.equal(state.next.name, "asar");
  assert.ok(Math.abs(state.next.inMin - (mins("16:30") - mins("13:10"))) < 1e-9);
  const zohor = state.prayers.find((p) => p.name === "zohor");
  assert.equal(zohor.time, "13:00");
  assert.equal(zohor.label, "Zohor");
  assert.equal(zohor.rakaat, 4);
});

test("full flow: due -> in-progress -> done, wrong steps never penalise", () => {
  const prayer = started();
  goTo(prayer, "13:00");
  const begin = prayer.startFlow("zohor");
  assert.equal(begin.ok, true);
  assert.equal(begin.phase, "wudu");
  assert.equal(statusOf(prayer, "zohor"), "in-progress");
  assert.equal(prayer.isBlockingMissions(), true);
  assert.equal(prayer.nextWuduStep().id, "niat");
  assert.equal(prayer.nextPrayStep(), null);
  doWudu(prayer);
  assert.equal(prayer.nextWuduStep(), null);
  assert.equal(prayer.nextPrayStep().id, "takbir");
  const result = doPrayer(prayer, "zohor");
  assert.equal(result.done, true);
  assert.equal(result.result.late, false);
  assert.match(result.result.praise, /Alhamdulillah/);
  assert.equal(statusOf(prayer, "zohor"), "done");
  assert.equal(prayer.isBlockingMissions(), false);
  assert.equal(prayer.state().flow, null);
});

test("wrong wudu step: ok:false, gentle hint, no progress lost, never a penalty", () => {
  const prayer = started();
  goTo(prayer, "13:00");
  prayer.startFlow("zohor");
  for (const wrong of ["face", "foot_l", "banana", "", undefined, null, 42]) {
    const reply = prayer.wuduStep(wrong);
    assert.equal(reply.ok, false);
    assert.match(reply.hint, /Good try/);
    assert.match(reply.hint, /Make your intention/, "the hint names the real next step");
    assert.doesNotMatch(reply.hint, /wrong|fail|bad|penalt|lose|lost|stupid/i);
  }
  assert.equal(prayer.nextWuduStep().id, "niat");
  assert.equal(prayer.wuduStep("niat").ok, true);
  assert.equal(prayer.wuduStep("niat").ok, false, "repeating a finished step just hints");
  assert.equal(prayer.nextWuduStep().id, "hands");
});

test("wudu steps cannot be skipped and finish with done:true", () => {
  const prayer = started();
  goTo(prayer, "13:00");
  prayer.startFlow("zohor");
  const ids = plain(Prayer.WUDU_STEPS.map((s) => s.id));
  for (let i = 0; i < ids.length - 1; i += 1) assert.equal(prayer.wuduStep(ids[i]).done, false);
  assert.equal(prayer.wuduStep(ids[ids.length - 1]).done, true);
  assert.equal(prayer.state().flow.phase, "pray");
  const again = prayer.wuduStep("niat");
  assert.equal(again.ok, false);
  assert.match(again.hint, /prayer hall/);
});

test("praying before wudu, or with no flow, only gives a gentle hint", () => {
  const prayer = started();
  assert.equal(prayer.prayStep("takbir").ok, false);
  assert.equal(prayer.wuduStep("niat").ok, false);
  goTo(prayer, "13:00");
  prayer.startFlow("zohor");
  const early = prayer.prayStep("takbir");
  assert.equal(early.ok, false);
  assert.equal(early.done, false);
  assert.match(early.hint, /wudu/);
});

test("wrong prayer step hints at the right one; the type name is accepted too", () => {
  const prayer = started();
  goTo(prayer, "13:00");
  prayer.startFlow("zohor");
  doWudu(prayer);
  const wrong = prayer.prayStep("sujud_1a");
  assert.equal(wrong.ok, false);
  assert.match(wrong.hint, /Takbiratul ihram/);
  assert.equal(prayer.prayStep("takbir").ok, true);
  assert.equal(prayer.prayStep("ruku_1").ok, false, "qiyam comes before ruku");
  assert.equal(prayer.prayStep("qiyam").ok, true, "generic type name matches the next step");
  assert.equal(prayer.nextPrayStep().id, "ruku_1");
});

test("Subuh qunut can be skipped or performed", () => {
  for (const withQunut of [true, false]) {
    const prayer = Prayer.create(FIXTURE_TIMES);
    prayer.update(mins("04:00"), 1);
    goTo(prayer, "05:00");
    prayer.startFlow("subuh");
    doWudu(prayer);
    for (const step of Prayer.rakaatPlan("subuh")) {
      if (step.qunut && !withQunut) continue;
      assert.equal(prayer.prayStep(step.id).ok, true, step.id);
    }
    assert.equal(statusOf(prayer, "subuh"), "done");
  }
});

test("Subuh ends at Syuruk: due 05:00, qada at 06:30", () => {
  const prayer = Prayer.create(FIXTURE_TIMES);
  prayer.update(mins("04:00"), 1);
  assert.equal(goTo(prayer, "05:00")[0].name, "subuh");
  assert.equal(goTo(prayer, "06:29").length, 0);
  const events = goTo(prayer, "06:30");
  assert.deepEqual(
    events.map((e) => e.type + ":" + e.name),
    ["qada:subuh"],
  );
  assert.equal(prayer.isBlockingMissions(), false);
  assert.equal(prayer.state().qada.length, 1);
});

test("idle through two prayers: Zohor -> Asar makes Zohor qada, Asar due (tracked separately)", () => {
  const prayer = started();
  goTo(prayer, "13:00");
  const events = goTo(prayer, "16:30");
  assert.deepEqual(
    events.map((e) => e.type + ":" + e.name),
    ["qada:zohor", "due:asar"],
  );
  assert.equal(statusOf(prayer, "zohor"), "qada");
  assert.equal(statusOf(prayer, "asar"), "due");
  assert.equal(prayer.due(), "asar");
  assert.equal(prayer.isBlockingMissions(), true);
});

test("idle through Maghrib -> Isyak: earlier becomes qada, later is due", () => {
  const prayer = started();
  goTo(prayer, "19:00");
  assert.equal(prayer.due(), "maghrib");
  const events = goTo(prayer, "20:15");
  assert.deepEqual(
    events.map((e) => e.type + ":" + e.name),
    ["qada:maghrib", "due:isyak"],
  );
  assert.equal(statusOf(prayer, "maghrib"), "qada");
  assert.equal(statusOf(prayer, "isyak"), "due");
});

test("a big time jump emits every due and qada in chronological order", () => {
  const prayer = started();
  const events = goTo(prayer, "20:30");
  assert.deepEqual(
    events.map((e) => e.type + ":" + e.name),
    [
      "due:zohor",
      "qada:zohor",
      "due:asar",
      "qada:asar",
      "due:maghrib",
      "qada:maghrib",
      "due:isyak",
    ],
  );
  const times = events.map((e) => e.at);
  assert.deepEqual(
    times,
    [...times].sort((a, b) => a - b),
  );
  assert.equal(prayer.due(), "isyak");
});

test("qada is not blocking; it can be prayed any time and is praised, no penalty", () => {
  const prayer = started();
  goTo(prayer, "13:00");
  goTo(prayer, "16:30");
  prayer.startFlow("asar");
  doWudu(prayer);
  doPrayer(prayer, "asar");
  assert.equal(prayer.isBlockingMissions(), false, "only the qada Zohor remains");
  assert.equal(prayer.due(), null);
  const begin = prayer.startFlow("zohor");
  assert.equal(begin.ok, true);
  assert.equal(begin.kind, "qada");
  assert.equal(begin.phase, "pray", "wudu is still fresh");
  assert.equal(prayer.isBlockingMissions(), false, "praying a qada never blocks");
  const result = doPrayer(prayer, "zohor");
  assert.equal(result.result.kind, "qada");
  assert.match(result.result.praise, /made up/);
  assert.equal(statusOf(prayer, "zohor"), "qada-done");
  assert.equal(prayer.state().qada.length, 0);
});

test("a prayer finished after its time is accepted and praised, never scolded", () => {
  const prayer = started();
  goTo(prayer, "13:00");
  prayer.startFlow("zohor");
  doWudu(prayer);
  goTo(prayer, "16:45");
  assert.equal(statusOf(prayer, "zohor"), "in-progress", "an in-progress prayer is not taken away");
  const result = doPrayer(prayer, "zohor");
  assert.equal(result.result.late, true);
  assert.match(result.result.praise, /better late than never/);
  assert.doesNotMatch(result.result.praise, /miss|fail|sorry|bad|penalt/i);
  assert.equal(statusOf(prayer, "zohor"), "done");
});

test("startFlow before the time (or for junk) gives a friendly refusal", () => {
  const prayer = started();
  const early = prayer.startFlow("asar");
  assert.equal(early.ok, false);
  assert.match(early.hint, /not ready yet/);
  assert.equal(prayer.startFlow("lunch").ok, false);
  assert.equal(prayer.startFlow(undefined).ok, false);
  assert.equal(prayer.state().flow, null);
});

test("startFlow is case-insensitive and resuming the same prayer keeps progress", () => {
  const prayer = started();
  goTo(prayer, "13:00");
  prayer.startFlow("ZOHOR");
  prayer.wuduStep("niat");
  prayer.wuduStep("hands");
  const resume = prayer.startFlow("zohor");
  assert.equal(resume.wuduIndex, 2);
  assert.equal(prayer.nextWuduStep().id, "mouth");
});

test("cancelFlow returns the prayer to due but keeps a finished wudu", () => {
  const prayer = started();
  goTo(prayer, "13:00");
  prayer.startFlow("zohor");
  doWudu(prayer);
  prayer.cancelFlow();
  assert.equal(statusOf(prayer, "zohor"), "due");
  assert.equal(prayer.isBlockingMissions(), true);
  assert.equal(prayer.state().wuduClean, true);
  assert.equal(prayer.startFlow("zohor").phase, "pray");
});

test("wudu freshness resets when a new prayer time arrives", () => {
  const prayer = started();
  goTo(prayer, "13:00");
  prayer.startFlow("zohor");
  doWudu(prayer);
  doPrayer(prayer, "zohor");
  assert.equal(prayer.state().wuduClean, true);
  goTo(prayer, "16:30");
  assert.equal(prayer.state().wuduClean, false);
  assert.equal(prayer.startFlow("asar").phase, "wudu");
});

test("midnight: Isyak stays due after rollover until Subuh, then becomes qada", () => {
  const prayer = started();
  goTo(prayer, "20:15");
  const rollover = goTo(prayer, "00:30", 2);
  assert.deepEqual(
    rollover.map((e) => e.type),
    ["newday"],
  );
  assert.equal(prayer.due(), "isyak");
  assert.equal(prayer.isBlockingMissions(), true);
  assert.equal(prayer.state().day, 2);
  const dawn = goTo(prayer, "05:00", 2);
  assert.deepEqual(
    dawn.map((e) => e.type + ":" + e.name),
    ["qada:isyak", "due:subuh"],
  );
  const isyak = prayer.state().qada.filter((p) => p.name === "isyak");
  assert.equal(isyak.length, 1);
  assert.equal(isyak[0].day, 1);
});

test("the next day's prayers start fresh (upcoming) and loop", () => {
  const prayer = started();
  goTo(prayer, "21:00");
  goTo(prayer, "01:00", 2);
  const names = plain(prayer.state().prayers.map((p) => p.name));
  assert.deepEqual(names, ["subuh", "zohor", "asar", "maghrib", "isyak"]);
  assert.equal(statusOf(prayer, "zohor"), "upcoming");
  goTo(prayer, "13:00", 2);
  assert.equal(prayer.due(), "zohor");
});

test("pending qada is capped so a very idle player cannot grow it without bound", () => {
  const prayer = started();
  for (let day = 1; day <= 6; day += 1) goTo(prayer, "23:00", day);
  goTo(prayer, "23:30", 7);
  assert.ok(prayer.state().qada.length <= 10);
});

test("snapshot/restore mid-flow resumes at the same step (wudu kept)", () => {
  const prayer = started();
  goTo(prayer, "13:00");
  prayer.startFlow("zohor");
  for (const id of ["niat", "hands", "mouth"]) prayer.wuduStep(id);
  const saved = plain(prayer.snapshot());
  const reloaded = Prayer.create(FIXTURE_TIMES);
  assert.equal(reloaded.restore(saved), true);
  assert.equal(reloaded.update(mins("13:02"), 1).length, 0, "no duplicate due after reload");
  assert.equal(reloaded.due(), "zohor");
  assert.equal(reloaded.nextWuduStep().id, "nose");
  assert.equal(reloaded.isBlockingMissions(), true);
  assert.equal(reloaded.startFlow("zohor").ok, true);
});

test("snapshot/restore keeps a finished wudu and the pray position", () => {
  const prayer = started();
  goTo(prayer, "13:00");
  prayer.startFlow("zohor");
  doWudu(prayer);
  prayer.prayStep("takbir");
  prayer.prayStep("qiyam_1");
  const reloaded = Prayer.create(FIXTURE_TIMES);
  reloaded.restore(plain(prayer.snapshot()));
  assert.equal(reloaded.nextPrayStep().id, "ruku_1");
  assert.equal(reloaded.state().wuduClean, true);
});

test("restore() rejects junk without throwing and never leaves a ghost flow", () => {
  const prayer = Prayer.create(FIXTURE_TIMES);
  for (const junk of [null, undefined, 5, "x", [], {}, { entries: "no" }])
    assert.equal(prayer.restore(junk), false);
  const hostile = {
    entries: [
      { name: "zohor", day: -4, status: "in-progress" },
      { name: "lunch", status: "due" },
      { name: "asar", status: "pwned" },
    ],
    lastAbs: "1e999",
    flow: { name: "zohor", day: 1, kind: "due", phase: "pray", wuduIdx: 99, prayIdx: -7 },
  };
  assert.equal(prayer.restore(hostile), true);
  const state = prayer.state();
  assert.ok(state.flow === null || state.flow.prayIndex >= 0);
  assert.equal(prayer.due() === null || typeof prayer.due() === "string", true);
});

test("sanitizeSnapshot clamps indices and drops unknown names/statuses", () => {
  const clean = plain(
    Prayer.sanitizeSnapshot({
      entries: [
        { name: "isyak", day: 3, status: "qada" },
        { name: "x", status: "due" },
        { name: "zohor", status: "bogus" },
      ],
      lastAbs: 5000,
      lastDay: 3,
      flow: { name: "isyak", day: 3, kind: "qada", phase: "pray", wuduIdx: 99, prayIdx: 9999 },
    }),
  );
  assert.equal(clean.entries.length, 1);
  assert.equal(clean.flow.wuduIdx, Prayer.WUDU_STEPS.length, "pray phase: every wudu step done");
  assert.equal(clean.flow.prayIdx, Prayer.rakaatPlan("isyak").length - 1);
  assert.equal(Prayer.sanitizeSnapshot("nope"), null);
});

/** A snapshot holding one flow, for the wuduIdx clamp tests. */
function snapWithFlow(flow) {
  const base = { entries: [{ name: "zohor", day: 1, status: "in-progress" }], lastAbs: 800 };
  return Prayer.sanitizeSnapshot(Object.assign({ lastDay: 1 }, base, { flow }));
}

test("ACC2-04: a flow saved in the pray phase reloads with wuduIdx = the wudu step count", () => {
  const prayer = started();
  goTo(prayer, "13:00");
  prayer.startFlow("zohor");
  doWudu(prayer);
  const saved = plain(prayer.snapshot());
  assert.equal(saved.flow.wuduIdx, Prayer.WUDU_STEPS.length);
  const reloaded = Prayer.create(FIXTURE_TIMES);
  reloaded.restore(saved);
  assert.equal(reloaded.state().flow.wuduIndex, Prayer.WUDU_STEPS.length, "no step lost on reload");
  assert.equal(reloaded.state().flow.wuduTotal, Prayer.WUDU_STEPS.length);
});

test("ACC2-04: wuduIdx is clamped into range for both phases, whatever the save says", () => {
  const flow = (phase, wuduIdx) => ({ name: "zohor", day: 1, phase, wuduIdx, prayIdx: 0 });
  const len = Prayer.WUDU_STEPS.length;
  assert.equal(snapWithFlow(flow("pray", 0)).flow.wuduIdx, len, "pray forces the full count");
  assert.equal(snapWithFlow(flow("wudu", 99)).flow.wuduIdx, len - 1, "wudu keeps one step to do");
  assert.equal(snapWithFlow(flow("wudu", -5)).flow.wuduIdx, 0);
  assert.equal(snapWithFlow(flow("wudu", "x")).flow.wuduIdx, 0);
  assert.equal(snapWithFlow(flow("wudu", 4.7)).flow.wuduIdx, 4);
});

test("ACC2-01: rebuilds() counts a rewind past the slack, and nothing else", () => {
  const prayer = started();
  assert.equal(prayer.rebuilds(), 0);
  goTo(prayer, "13:00");
  assert.equal(prayer.rebuilds(), 0, "moving forward is not a rebuild");
  prayer.update(mins("13:00") - 0.4, 1);
  assert.equal(prayer.rebuilds(), 0, "a few seconds back is rounding noise (REWIND_SLACK)");
  goTo(prayer, "07:10");
  assert.equal(prayer.rebuilds(), 1);
  assert.equal(prayer.due(), null);
});

test("ACC2-02: going back to just before a prayer and stepping across makes it due", () => {
  const prayer = started();
  goTo(prayer, "20:30");
  goTo(prayer, "12:59");
  assert.equal(prayer.rebuilds(), 1);
  assert.equal(statusOf(prayer, "zohor"), "upcoming");
  const events = goTo(prayer, "13:00");
  assert.deepEqual(
    events.map((e) => [e.type, e.name]),
    [["due", "zohor"]],
  );
  assert.equal(prayer.due(), "zohor");
  assert.equal(prayer.state().blocking, true);
});

test("create() with missing or out-of-order times throws a clear RangeError", () => {
  assert.throws(() => Prayer.create(undefined), { name: "RangeError" });
  assert.throws(() => Prayer.create({ ...FIXTURE_TIMES, asar: "99:99" }), /asar/);
  assert.throws(() => Prayer.create({ ...FIXTURE_TIMES, zohor: "17:00" }), { name: "RangeError" });
});

test("an update with NaN or a rounding-sized step back changes nothing", () => {
  const prayer = started();
  goTo(prayer, "13:30");
  assert.deepEqual(plain(prayer.update(mins("13:30") - 0.5, 1)), []);
  assert.deepEqual(plain(prayer.update(NaN, 1)), []);
  assert.equal(prayer.due(), "zohor");
});

test("ACC-2: setting the clock well back rebuilds the tracker like a fresh game at that minute", () => {
  const prayer = started();
  goTo(prayer, "20:30");
  assert.equal(prayer.due(), "isyak");
  assert.deepEqual(goTo(prayer, "07:10"), []);
  const state = plain(prayer.state());
  assert.equal(state.due, null);
  assert.equal(state.blocking, false);
  assert.equal(state.qada.length, 0);
  assert.equal(state.next.name, "zohor");
  const fresh = started();
  goTo(fresh, "07:10");
  assert.deepEqual(state.prayers, plain(fresh.state().prayers));
  goTo(prayer, "13:30");
  assert.equal(prayer.due(), "zohor");
});

test("ACC-2: rewinding drops an active flow too", () => {
  const prayer = started();
  goTo(prayer, "13:30");
  prayer.startFlow("zohor");
  goTo(prayer, "08:00");
  assert.equal(prayer.state().flow, null);
  assert.equal(prayer.due(), null);
});

test("ACC-2: restoring a snapshot whose prayers are ahead of the clock recovers on the next update", () => {
  const ahead = started();
  goTo(ahead, "20:30");
  const snap = plain(ahead.snapshot());
  const prayer = Prayer.create(FIXTURE_TIMES);
  prayer.restore(snap);
  prayer.update(mins("07:00"), 1);
  assert.equal(prayer.due(), null);
  assert.equal(prayer.state().qada.length, 0);
  goTo(prayer, "13:30");
  assert.equal(prayer.due(), "zohor");
});

test("ACC-3: between midnight and Subuh a still-due Isyak takes the strip's Isyak slot", () => {
  const prayer = started();
  goTo(prayer, "20:30");
  assert.equal(prayer.due(), "isyak");
  prayer.update(0.5, 2);
  const state = plain(prayer.state());
  assert.equal(state.day, 2);
  assert.equal(state.prayers.length, 5);
  const isyak = state.prayers.find((p) => p.name === "isyak");
  assert.equal(isyak.status, "due");
  assert.equal(isyak.carried, true);
  assert.equal(state.due, "isyak");
  assert.equal(prayer.startFlow("isyak").ok, true);
  assert.equal(prayer.state().prayers.find((p) => p.name === "isyak").status, "in-progress");
});

test("ACC-3: once Subuh arrives the strip shows the new day's Isyak again", () => {
  const prayer = started();
  goTo(prayer, "20:30");
  prayer.update(mins("05:30"), 2);
  const isyak = plain(prayer.state().prayers.find((p) => p.name === "isyak"));
  assert.equal(isyak.carried, undefined);
  assert.equal(isyak.status, "upcoming");
});

test("all child-facing hints avoid scolding language", () => {
  const prayer = started();
  const hints = [
    prayer.startFlow("asar").hint,
    prayer.wuduStep("niat").hint,
    prayer.prayStep("takbir").hint,
  ];
  goTo(prayer, "13:00");
  prayer.startFlow("zohor");
  hints.push(prayer.wuduStep("foot_l").hint, prayer.prayStep("takbir").hint);
  for (const hint of hints) {
    assert.ok(hint.length > 5);
    assert.doesNotMatch(hint, /wrong|fail|bad|penalt|punish|stupid|sin\b/i);
  }
});

test("owner rule: finishing a prayer or a qada grants the star sticker and never any coins", () => {
  const { Economy, Missions } = KQ.Sim;
  assert.equal(Economy.PRAYER_REWARD_COINS, undefined, "no prayer coin reward is defined");
  const prayer = started();
  const wallet = Economy.create({ coins: 7 });
  const missions = Missions.create();
  goTo(prayer, "13:00");
  goTo(prayer, "16:30");
  for (const name of ["asar", "zohor"]) {
    const begin = prayer.startFlow(name);
    if (begin.phase === "wudu") doWudu(prayer);
    const done = doPrayer(prayer, name).result;
    const award = missions.awardPrayer(done.name);
    assert.equal(award.coins, 0, done.kind + " pays no coins");
    assert.equal(award.newSticker, true, done.kind + " grants the " + name + " star");
    assert.ok(missions.stickers().includes("prayer_" + name), name);
    assert.equal(wallet.coins, 7, done.kind + " leaves the purse untouched");
  }
  assert.equal(missions.awardPrayer("zohor").newSticker, false, "a star is only given once");
});

test("the wrong-tap prayer hint is short, picture-first and names the expected tile, never scolding", () => {
  const text = loadPrayerText();
  assert.equal(text.nextHint("ruku"), "Nearly! Next: Ruku (bow).");
  assert.equal(text.nextHint("qunut"), "Nearly! Next: Doa qunut (palms up).");
  assert.equal(text.nextHint("tasyahud_awal"), "Nearly! Next: Tasyahud - sit (first).");
  for (const type of Object.keys(text.TILE)) {
    const hint = text.nextHint(type);
    assert.match(hint, /^Nearly! Next: .+\.$/, type);
    assert.ok(hint.length <= 48, type + " stays one short line");
    assert.doesNotMatch(hint, /wrong|fail|bad|incorrect|mistake/i, type);
  }
  assert.equal(text.nextHint("not_a_posture"), "", "an unknown type gives no hint, not an error");
});

test("the azan card title keeps its single full stop (the spoken sentence is built on it)", () => {
  const text = loadPrayerText();
  assert.equal(text.title("zohor"), "It's Zohor time! Let's go and pray.");
});
