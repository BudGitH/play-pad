// AC-5 (data side): NPC routines are valid, prayer-aware, and respectful of who prays.
import test from "node:test";
import assert from "node:assert/strict";
import { loadSim, FIXTURE_TIMES, plain, mins } from "./load-sim.mjs";

const KQ = loadSim();
const { Schedule, NPC_IDS, NPC_PROFILE, POI_IDS, Prayer } = { ...KQ.Sim };
const ADULT_MUSLIMS = [
  "nenek",
  "atuk",
  "imam_hakim",
  "makcik_siti",
  "pakcik_rahman",
  "dr_nurul",
  "librarian_farah",
];
const NON_MUSLIMS = ["uncle_lim", "aunty_mei", "kid_wei"];
const during = (name, sinceMin = 5) => ({ current: { name, sinceMin }, next: null });

test("every contract NPC id has a routine table", () => {
  for (const id of NPC_IDS) assert.ok(Schedule.ROUTINES[id], id);
  assert.equal(NPC_IDS.length, 16);
});

test("routine tables are sorted, start at midnight and only use valid ids", () => {
  for (const id of NPC_IDS) {
    const blocks = Schedule.ROUTINES[id];
    assert.equal(blocks[0][0], 0, id + " starts at 00:00");
    for (let i = 0; i < blocks.length; i += 1) {
      if (i > 0) assert.ok(blocks[i][0] > blocks[i - 1][0], id + " sorted");
      assert.ok(POI_IDS.includes(blocks[i][1]), id + " poi " + blocks[i][1]);
      assert.ok(Schedule.ACTIVITIES.includes(blocks[i][2]), id + " activity " + blocks[i][2]);
    }
  }
});

test("routineFor always returns a valid POI and activity, for every NPC, minute and prayer state", () => {
  const states = [
    null,
    undefined,
    {},
    "zohor",
    { due: "asar" },
    during("maghrib", 0),
    during("isyak", 24.9),
    { current: null, next: { name: "subuh", inMin: 3 } },
  ];
  for (const id of NPC_IDS) {
    for (let minute = 0; minute < 1440; minute += 5) {
      for (const state of states) {
        const routine = Schedule.routineFor(id, minute, state);
        assert.ok(POI_IDS.includes(routine.poi), id + "@" + minute + " " + routine.poi);
        assert.ok(Schedule.ACTIVITIES.includes(routine.activity), id + "@" + minute);
        assert.equal(typeof routine.indoors, "boolean");
      }
    }
  }
});

test("unknown NPCs and junk minutes get a harmless valid fallback, never a throw", () => {
  for (const id of ["ghost", "", null, undefined, 7, "__proto__", "constructor", "toString"]) {
    const routine = Schedule.routineFor(id, 600, null);
    assert.ok(POI_IDS.includes(routine.poi));
  }
  for (const minute of [NaN, undefined, null, "x", Infinity, -30, 1440, 99999]) {
    assert.ok(POI_IDS.includes(Schedule.routineFor("nenek", minute, null).poi), String(minute));
  }
});

test("routines are deterministic", () => {
  const a = plain(Schedule.routineFor("kid_irfan", 735.4, during("zohor", 3)));
  const b = plain(Schedule.routineFor("kid_irfan", 735.4, during("zohor", 3)));
  assert.deepEqual(a, b);
});

test("at Zohor, Muslim adults and the imam walk to mosque_hall and pray", () => {
  for (const id of ADULT_MUSLIMS) {
    const routine = Schedule.routineFor(id, mins("13:05"), during("zohor"));
    assert.deepEqual(plain(routine), { poi: "mosque_hall", activity: "pray", indoors: false }, id);
  }
});

test("every prayer pulls adult Muslims to the mosque, including Subuh and Isyak", () => {
  for (const name of Prayer.NAMES) {
    for (const id of ["imam_hakim", "nenek", "dr_nurul"]) {
      const routine = Schedule.routineFor(id, mins("05:10"), during(name));
      assert.equal(routine.activity, "pray", id + " " + name);
      assert.equal(routine.poi, "mosque_hall");
    }
  }
});

test("the imam prays all five prayers and starts walking over just before", () => {
  const lead = Schedule.routineFor("imam_hakim", mins("12:55"), {
    current: null,
    next: { name: "zohor", inMin: 5 },
  });
  assert.deepEqual(plain(lead), { poi: "mosque_gate", activity: "walk", indoors: false });
  const far = Schedule.routineFor("imam_hakim", mins("12:00"), {
    current: null,
    next: { name: "zohor", inMin: 60 },
  });
  assert.notEqual(far.activity, "pray");
});

test("NPCs return to their routine once the prayer window is over", () => {
  const routine = Schedule.routineFor(
    "nenek",
    mins("14:00"),
    during("zohor", Schedule.PRAY_WINDOW_MIN + 5),
  );
  assert.notEqual(routine.activity, "pray");
  assert.equal(routine.poi, "library");
});

test("non-Muslim neighbours never pray and stay friendly and busy", () => {
  for (const id of [...NON_MUSLIMS, "barber_raju", "postman_dan"]) {
    assert.equal(NPC_PROFILE[id].muslim, false, id);
    for (const name of Prayer.NAMES) {
      for (let minute = 0; minute < 1440; minute += 10) {
        const routine = Schedule.routineFor(id, minute, during(name, 2));
        assert.notEqual(routine.activity, "pray", id);
        assert.notEqual(routine.poi, "mosque_hall", id);
      }
    }
  }
  const lim = Schedule.routineFor("uncle_lim", mins("13:05"), during("zohor"));
  assert.ok(["hawker", "block_c", "park"].includes(lim.poi));
});

test("Muslim children join the mosque for Maghrib and Isyak but not for Zohor", () => {
  for (const id of ["kid_irfan", "kid_aisyah"]) {
    assert.equal(NPC_PROFILE[id].adult, false);
    assert.equal(Schedule.routineFor(id, mins("19:05"), during("maghrib")).activity, "pray", id);
    assert.equal(Schedule.routineFor(id, mins("20:20"), during("isyak")).activity, "pray", id);
    assert.notEqual(Schedule.routineFor(id, mins("13:05"), during("zohor")).activity, "pray", id);
  }
  assert.notEqual(
    Schedule.routineFor("kid_wei", mins("19:05"), during("maghrib")).activity,
    "pray",
  );
});

test("hawkers stay at their stalls, taking turns: Ali at Zohor, Aminah at Asar", () => {
  const noon = mins("13:05");
  assert.equal(Schedule.routineFor("hawker_ali", noon, null).poi, "stall_prata");
  assert.equal(Schedule.routineFor("hawker_aminah", noon, null).poi, "stall_nasi_lemak");
  assert.equal(Schedule.routineFor("hawker_ali", noon, during("zohor")).activity, "pray");
  assert.equal(
    Schedule.routineFor("hawker_aminah", noon, during("zohor")).poi,
    "stall_nasi_lemak",
    "Aminah keeps the stalls open",
  );
  const tea = mins("16:35");
  assert.equal(Schedule.routineFor("hawker_aminah", tea, during("asar")).activity, "pray");
  assert.equal(Schedule.routineFor("hawker_ali", tea, during("asar")).poi, "stall_prata");
  assert.notEqual(Schedule.routineFor("hawker_ali", tea, during("asar")).activity, "pray");
});

test("hawkers are at their stalls through opening hours, never both away at once", () => {
  for (let minute = mins("06:00"); minute < mins("18:30"); minute += 5) {
    for (const name of Prayer.NAMES) {
      const ali = Schedule.routineFor("hawker_ali", minute, during(name, 3));
      const aminah = Schedule.routineFor("hawker_aminah", minute, during(name, 3));
      assert.ok(
        ali.poi === "stall_prata" || aminah.poi === "stall_nasi_lemak",
        minute + " " + name,
      );
    }
  }
});

test("after closing, hawkers pray Maghrib and Isyak like other adults", () => {
  assert.equal(
    Schedule.routineFor("hawker_ali", mins("19:05"), during("maghrib")).activity,
    "pray",
  );
  assert.equal(
    Schedule.routineFor("hawker_aminah", mins("20:20"), during("isyak")).activity,
    "pray",
  );
});

test("night: everyone is tucked up at home (or the mosque grounds for the imam)", () => {
  for (const id of NPC_IDS) {
    const routine = Schedule.routineFor(id, mins("03:00"), null);
    assert.ok(
      routine.poi.startsWith("block_") || routine.poi === "mosque_gate",
      id + " " + routine.poi,
    );
    assert.equal(routine.activity, "idle");
  }
  assert.equal(Schedule.routineFor("nenek", mins("03:00"), null).indoors, true);
  assert.equal(Schedule.routineFor("nenek", mins("08:30"), null).indoors, false);
});

test("daytime is lively: not every NPC is in the same place", () => {
  const places = new Set(NPC_IDS.map((id) => Schedule.routineFor(id, mins("10:00"), null).poi));
  assert.ok(places.size >= 6, "places: " + places.size);
});

test("works with the real Prayer.state() across a whole simulated day", () => {
  const prayer = Prayer.create(FIXTURE_TIMES);
  prayer.update(mins("07:00"), 1);
  let sawPrayer = 0;
  for (let minute = mins("07:00") + 1; minute < 1440; minute += 1) {
    prayer.update(minute, 1);
    const state = prayer.state();
    for (const id of NPC_IDS) {
      const routine = Schedule.routineFor(id, minute, state);
      assert.ok(POI_IDS.includes(routine.poi));
      if (id === "imam_hakim" && routine.activity === "pray") sawPrayer += 1;
    }
  }
  assert.ok(
    sawPrayer >= 3 * Schedule.PRAY_WINDOW_MIN,
    "the imam prays at Zohor, Asar, Maghrib and Isyak",
  );
  const mid = Schedule.routineFor("imam_hakim", mins("13:10"), {
    current: { name: "zohor", sinceMin: 10 },
    next: { name: "asar", inMin: 200 },
  });
  assert.equal(mid.activity, "pray");
});
