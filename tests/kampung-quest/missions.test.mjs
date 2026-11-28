// AC-11, AC-12: missions are data-driven, child-friendly, completable, and pause during prayer.
import test from "node:test";
import assert from "node:assert/strict";
import { loadSim, FIXTURE_TIMES, plain, mins } from "./load-sim.mjs";

const KQ = loadSim();
const NEW_IDS = [
  "walk_wei_home",
  "prata_dash",
  "friendly_five",
  "kampung_photos",
  "bike_to_library",
  "visit_the_ponies",
];
const { Missions, STICKERS, CHAT, POI_IDS, NPC_IDS, Prayer, SALAM } = { ...KQ.Sim };
/** The original kampung missions; the playability round's batch is tested in missions-more.test.mjs. */
const MISSIONS = KQ.Sim.MISSIONS.filter(
  (m) =>
    !m.region &&
    !m.needs &&
    !m.beat &&
    m.id !== "push_the_car" &&
    m.id !== "rambutan_basket" &&
    !NEW_IDS.includes(m.id),
);
const POI_STEPS = ["goto", "buy", "collect"];
const NPC_STEPS = ["talk", "deliver"];

/** Build the world events that complete one mission, in order. */
function eventsFor(mission) {
  const events = [];
  for (const step of mission.steps) {
    const count = step.count || 1;
    for (let i = 0; i < count; i += 1)
      events.push({ type: step.type, target: step.target, item: step.item });
  }
  return events;
}

function runAll(missions, mission) {
  let last = null;
  for (const event of eventsFor(mission)) last = missions.notify(event);
  return last;
}

test("there are at least 10 missions with unique ids", () => {
  assert.ok(MISSIONS.length >= 10);
  assert.equal(new Set(MISSIONS.map((m) => m.id)).size, MISSIONS.length);
});

test("missions only use contract POI / NPC ids and valid step types", () => {
  for (const mission of MISSIONS) {
    assert.ok(NPC_IDS.includes(mission.giver), mission.id + " giver");
    assert.ok(mission.steps.length >= 2, mission.id);
    for (const step of mission.steps) {
      if (POI_STEPS.includes(step.type))
        assert.ok(POI_IDS.includes(step.target), mission.id + ":" + step.target);
      else if (NPC_STEPS.includes(step.type))
        assert.ok(NPC_IDS.includes(step.target), mission.id + ":" + step.target);
      else assert.fail(mission.id + " unknown step type " + step.type);
      assert.ok(step.label.length > 3, mission.id);
      assert.ok(
        step.count === undefined ||
          (Number.isInteger(step.count) && step.count >= 1 && step.count <= 10),
        mission.id,
      );
    }
  }
});

test("missions carry titles, Malay titles, dialogue lines and a reward", () => {
  const stickerIds = STICKERS.map((s) => s.id);
  for (const m of MISSIONS) {
    assert.ok(m.title && m.titleMs, m.id);
    for (const key of ["intro", "reminder", "thanks"]) {
      assert.ok(Array.isArray(m[key]) && m[key].length >= 1, m.id + " " + key);
      assert.ok(
        m[key].every((line) => typeof line === "string" && line.length > 5),
        m.id + " " + key,
      );
    }
    assert.ok(Number.isInteger(m.reward.coins) && m.reward.coins >= 1, m.id);
    assert.ok(
      m.reward.stickers.length >= 1 && m.reward.stickers.every((id) => stickerIds.includes(id)),
      m.id,
    );
  }
});

test("AC-11 themes exist: errand, elder's groceries, lost cat, recycling, kuih, playground, salam to imam", () => {
  const ids = MISSIONS.map((m) => m.id);
  for (const id of [
    "prata_for_nenek",
    "groceries_for_atuk",
    "lost_cat",
    "recycling_hero",
    "kuih_delivery",
    "clean_playground",
    "salam_to_imam",
  ]) {
    assert.ok(ids.includes(id), id);
  }
  const imam = MISSIONS.find((m) => m.id === "salam_to_imam");
  assert.ok(imam.steps.some((s) => s.target === "imam_hakim"));
});

test("all text is child-friendly: no violence, crime, gambling, alcohol or pork", () => {
  const text = JSON.stringify([MISSIONS, CHAT, STICKERS]);
  assert.doesNotMatch(
    text,
    /\b(kill|fight|weapon|gun|knife|steal|stole|theft|crime|police|gambl|bet\b|casino|beer|wine|alcohol|pork|bacon|blood|die\b|dead)/i,
  );
});

test("COMP-R2-03: no neighbour opens with the reply (Waalaikumsalam) and non-Muslim ones use no salam", () => {
  const opener = (lines) => String(lines[0]);
  Object.entries(CHAT).forEach(([id, lines]) =>
    assert.doesNotMatch(opener(lines), /^Waalaikum/i, id),
  );
  MISSIONS.forEach((m) => assert.doesNotMatch(opener(m.intro), /^Waalaikum/i, m.id + " intro"));
  const notMuslim = ["uncle_lim", "aunty_mei", "kid_wei", "barber_raju", "postman_dan"];
  notMuslim.forEach((id) => {
    assert.doesNotMatch(JSON.stringify(CHAT[id]), /salam/i, id + " small talk");
    MISSIONS.filter((m) => m.giver === id).forEach((m) =>
      assert.doesNotMatch(JSON.stringify(m.intro), /salam/i, m.id),
    );
  });
});

test("dialogue includes Malay greetings: Assalamualaikum / Waalaikumsalam", () => {
  const text = JSON.stringify(MISSIONS);
  assert.match(text, /Assalamualaikum/);
  assert.match(text, /Waalaikumsalam/);
  assert.equal(SALAM.greet, "Assalamualaikum!");
  assert.equal(SALAM.reply, "Waalaikumsalam!");
});

test("every NPC has chat lines; Muslim neighbours greet with salam, others are friendly", () => {
  for (const id of NPC_IDS) {
    assert.ok(CHAT[id] && CHAT[id].length >= 2, id);
    assert.ok(Missions.chatLine(id, 0).length > 3);
    assert.notEqual(Missions.chatLine(id, 0), Missions.chatLine(id, 1));
  }
  assert.match(Missions.chatLine("imam_hakim", 0), /salam/i);
  assert.equal(Missions.chatLine("nobody", 0), "Assalamualaikum!");
  assert.ok(Missions.chatLine("nenek", -7).length > 3);
  assert.ok(Missions.chatLine("nenek", NaN).length > 3);
});

test("a fresh tracker offers every mission and nothing is active", () => {
  const missions = Missions.create();
  assert.equal(missions.available().length, KQ.Sim.MISSIONS.filter((m) => !m.region).length);
  assert.equal(missions.active(), null);
  assert.equal(missions.progress(), null);
  assert.equal(missions.available()[0].id, "prata_for_nenek", "the coach-line mission comes first");
});

test("accept -> active -> step progress -> complete with reward", () => {
  const missions = Missions.create();
  const accepted = missions.accept("prata_for_nenek");
  assert.equal(accepted.ok, true);
  assert.ok(accepted.lines.length >= 1);
  assert.equal(missions.active().id, "prata_for_nenek");
  assert.equal(missions.progress().type, "buy");
  assert.equal(missions.progress().markerKind, "poi");
  const bought = missions.notify({ type: "buy", target: "stall_prata", item: "roti_prata" });
  assert.equal(bought.stepDone, true);
  assert.equal(missions.progress().stepIndex, 1);
  assert.equal(missions.progress().markerKind, "npc");
  const done = missions.notify({ type: "deliver", target: "nenek", item: "roti_prata" });
  assert.equal(done.completed, true);
  assert.equal(done.reward.coins, 5);
  assert.deepEqual(plain(done.reward.stickers), ["sticker_prata"]);
  assert.equal(missions.active(), null);
  assert.deepEqual(plain(missions.completed()), ["prata_for_nenek"]);
  assert.deepEqual(plain(missions.stickers()), ["sticker_prata"]);
});

test("every mission is completable from its own step list", () => {
  for (const mission of MISSIONS) {
    const missions = Missions.create();
    assert.equal(missions.accept(mission.id).ok, true, mission.id);
    const last = runAll(missions, mission);
    assert.equal(last.completed, true, mission.id);
    assert.equal(missions.active(), null);
  }
});

test("all missions can be completed in one playthrough; stickers collect without duplicates", () => {
  const missions = Missions.create();
  const all = missions.offered();
  for (const mission of all) {
    assert.equal(missions.accept(mission.id).ok, true, mission.id);
    runAll(missions, mission);
  }
  assert.equal(missions.completed().length, all.length);
  assert.equal(missions.available().length, 0);
  assert.equal(new Set(missions.stickers()).size, missions.stickers().length);
});

test("wrong or out-of-order events change nothing", () => {
  const missions = Missions.create();
  missions.accept("prata_for_nenek");
  assert.equal(
    missions.notify({ type: "deliver", target: "nenek" }).changed,
    false,
    "deliver before buy",
  );
  assert.equal(missions.notify({ type: "buy", target: "stall_satay" }).changed, false);
  assert.equal(missions.notify({ type: "goto", target: "stall_prata" }).changed, false);
  assert.equal(
    missions.notify({ type: "buy", target: "stall_prata", item: "murtabak" }).changed,
    false,
    "wrong dish",
  );
  for (const junk of [null, undefined, {}, "buy", 5])
    assert.equal(missions.notify(junk).changed, false);
  assert.equal(missions.progress().stepIndex, 0);
  assert.equal(
    missions.notify({ type: "buy", target: "stall_prata" }).changed,
    true,
    "no item given still counts",
  );
});

test("collect steps count up and respect the event count", () => {
  const missions = Missions.create();
  missions.accept("recycling_hero");
  const first = missions.notify({ type: "collect", target: "park", item: "can" });
  assert.equal(first.changed, true);
  assert.equal(first.stepDone, false);
  assert.equal(missions.progress().count, 1);
  assert.equal(missions.progress().need, 3);
  assert.equal(
    missions.notify({ type: "collect", target: "park", count: 5 }).stepDone,
    true,
    "over-count is capped",
  );
  assert.equal(missions.progress().stepIndex, 1);
  assert.equal(missions.progress().count, 0);
});

test("only one mission at a time; completed missions cannot be re-accepted; unknown ids refused", () => {
  const missions = Missions.create();
  assert.equal(missions.accept("lost_cat").ok, true);
  const second = missions.accept("salam_to_imam");
  assert.equal(second.ok, false);
  assert.match(second.hint, /current mission/);
  assert.equal(missions.accept("nope").ok, false);
  assert.equal(missions.accept(undefined).ok, false);
  runAll(
    missions,
    MISSIONS.find((m) => m.id === "lost_cat"),
  );
  assert.match(missions.accept("lost_cat").hint, /already did/);
});

test("abandon returns the mission to the available list with fresh progress", () => {
  const missions = Missions.create();
  missions.accept("lost_cat");
  missions.notify({ type: "goto", target: "park" });
  assert.equal(missions.abandon(), true);
  assert.equal(missions.abandon(), false);
  assert.ok(missions.available().some((m) => m.id === "lost_cat"));
  missions.accept("lost_cat");
  assert.equal(missions.progress().stepIndex, 0);
});

test("paused: accepting AND progressing both stop, the active mission is kept, resume continues", () => {
  const missions = Missions.create();
  missions.accept("lost_cat");
  missions.notify({ type: "goto", target: "park" });
  missions.setPaused(true);
  assert.equal(missions.isPausedNow(), true);
  assert.equal(missions.notify({ type: "goto", target: "playground" }).changed, false);
  assert.equal(missions.progress().stepIndex, 1, "no progress while paused");
  assert.equal(missions.progress().paused, true);
  assert.equal(missions.active().id, "lost_cat", "mission kept");
  const other = Missions.create({ paused: true });
  const refused = other.accept("prata_for_nenek");
  assert.equal(refused.ok, false);
  assert.match(refused.hint, /pray/);
  missions.setPaused(false);
  assert.equal(missions.notify({ type: "goto", target: "playground" }).stepDone, true);
});

test("isPaused callback is polled live (wired to the prayer tracker)", () => {
  const prayer = Prayer.create(FIXTURE_TIMES);
  prayer.update(mins("07:00"), 1);
  const missions = Missions.create({ isPaused: () => prayer.isBlockingMissions() });
  missions.accept("lost_cat");
  assert.equal(missions.notify({ type: "goto", target: "park" }).changed, true);
  prayer.update(mins("13:00"), 1);
  assert.equal(
    missions.notify({ type: "goto", target: "playground" }).changed,
    false,
    "Zohor is due",
  );
  prayer.startFlow("zohor");
  assert.equal(missions.isPausedNow(), true, "still paused while praying");
  prayer.update(mins("16:30"), 1);
  assert.equal(missions.isPausedNow(), true, "Asar is due and Zohor is still in progress");
});

test("a qada prayer does not pause missions (only due / in-progress do)", () => {
  const prayer = Prayer.create(FIXTURE_TIMES);
  prayer.update(mins("07:00"), 1);
  prayer.update(mins("13:00"), 1);
  prayer.update(mins("16:29"), 1);
  prayer.update(mins("16:31"), 1);
  prayer.startFlow("asar");
  for (const step of prayer.state().flow ? Prayer.WUDU_STEPS : []) prayer.wuduStep(step.id);
  for (const step of Prayer.rakaatPlan("asar")) if (!step.optional) prayer.prayStep(step.id);
  const missions = Missions.create({ isPaused: () => prayer.isBlockingMissions() });
  assert.equal(prayer.state().qada.length, 1, "Zohor is qada");
  assert.equal(missions.accept("lost_cat").ok, true);
  assert.equal(missions.notify({ type: "goto", target: "park" }).changed, true);
});

test("snapshot / restore round-trips active step, count, completed and stickers", () => {
  const missions = Missions.create();
  missions.accept("prata_for_nenek");
  runAll(missions, MISSIONS[0]);
  missions.accept("recycling_hero");
  missions.notify({ type: "collect", target: "park" });
  const saved = plain(missions.snapshot());
  const copy = Missions.create();
  copy.restore(saved);
  assert.deepEqual(plain(copy.snapshot()), saved);
  assert.equal(copy.progress().count, 1);
});

test("restore() drops unknown ids, clamps steps, de-duplicates and survives junk", () => {
  const missions = Missions.create();
  missions.restore({
    active: { id: "recycling_hero", step: 99, count: 500 },
    completed: ["lost_cat", "lost_cat", "made_up", 7, null],
    stickers: ["sticker_cat", "sticker_cat", "sticker_evil", {}],
  });
  assert.deepEqual(plain(missions.completed()), ["lost_cat"]);
  assert.deepEqual(plain(missions.stickers()), ["sticker_cat"]);
  assert.equal(missions.progress().stepIndex, 2, "clamped to the last step");
  for (const junk of [
    null,
    undefined,
    3,
    "x",
    [],
    { active: "lost_cat" },
    { active: { id: "nope" } },
  ]) {
    missions.restore(junk);
    assert.equal(missions.active(), null);
    assert.deepEqual(plain(missions.completed()), []);
  }
});

test("a restored active mission that is already completed is dropped", () => {
  const missions = Missions.create();
  missions.restore({ active: { id: "lost_cat", step: 0, count: 0 }, completed: ["lost_cat"] });
  assert.equal(missions.active(), null);
});

test("grantSticker only accepts known stickers, once; prayer stars exist", () => {
  const missions = Missions.create();
  assert.equal(missions.grantSticker(Missions.prayerSticker("zohor")), true);
  assert.equal(missions.grantSticker("prayer_zohor"), false);
  assert.equal(missions.grantSticker("sticker_hax"), false);
  for (const name of Prayer.NAMES)
    assert.ok(
      STICKERS.some((s) => s.id === "prayer_" + name),
      name,
    );
});

// ---- ACC-1: which interaction target wins (a hawker stands ~0.15 m behind the stall counter) ----
const NPC_NEAR = { enabled: true, dist: 1.8 };
const NPC_FAR = { enabled: false, dist: 3.5 };
const COUNTER = { dist: 1.7 };

test("ACC-1: a neighbour with a mission offer beats the stall counter even when the counter is nearer", () => {
  assert.equal(Missions.pickTarget(NPC_NEAR, COUNTER, true), "npc");
});

test("ACC-1: with no mission business the nearer target wins, so ordering food still works", () => {
  assert.equal(Missions.pickTarget({ enabled: true, dist: 2.2 }, COUNTER, false), "obj");
  assert.equal(Missions.pickTarget({ enabled: true, dist: 1.2 }, COUNTER, false), "npc");
});

test("ACC-1: pickTarget handles every empty / disabled combination", () => {
  assert.equal(Missions.pickTarget(null, null, false), null);
  assert.equal(Missions.pickTarget(NPC_NEAR, null, false), "npc");
  assert.equal(Missions.pickTarget(null, COUNTER, true), "obj");
  assert.equal(
    Missions.pickTarget(NPC_FAR, COUNTER, true),
    "obj",
    "a far NPC never beats an object",
  );
  assert.equal(Missions.pickTarget(NPC_FAR, null, true), "npc", "the 'Walk closer' prompt remains");
});

test("ACC-1: wantsTalk is true for every giver with a mission available, and for step targets", () => {
  const m = Missions.create();
  const givers = [...new Set(m.offered().map((x) => x.giver))];
  for (const id of givers) assert.equal(m.wantsTalk(id), true, id);
  assert.equal(m.wantsTalk("nobody"), false);
  const mission = KQ.Sim.MISSIONS.find((x) => x.giver === "hawker_aminah");
  const target = mission.steps[0].target;
  assert.ok(m.accept(mission.id).ok);
  assert.equal(m.wantsTalk(target), true, "the first step's target has business");
  assert.equal(m.wantsTalk("hawker_aminah"), false, "an active mission's giver has none to offer");
});

test("ACC-1: the two stall hawkers' missions are offered by wantsTalk until completed", () => {
  const m = Missions.create();
  for (const id of ["hawker_ali", "hawker_aminah"]) assert.equal(m.wantsTalk(id), true, id);
  const mission = KQ.Sim.MISSIONS.find((x) => x.giver === "hawker_aminah");
  m.restore({ active: null, completed: [mission.id], stickers: [] });
  assert.equal(m.wantsTalk("hawker_aminah"), false);
});

test("ACC3-02: the target's authored final-step line is shown first, the giver's thanks follow, attributed", () => {
  for (const mission of MISSIONS) {
    const last = mission.steps[mission.steps.length - 1];
    if (!NPC_STEPS.includes(last.type)) continue;
    const pages = Missions.completionLines(mission, last.target);
    assert.ok(pages.length >= 1, mission.id);
    if (last.line) assert.equal(pages[0], last.line, mission.id + " authored line is reachable");
    if (mission.giver === last.target) {
      assert.deepEqual(
        plain(pages.slice(-mission.thanks.length)),
        plain(mission.thanks),
        mission.id,
      );
      continue;
    }
    const giverName = KQ.Sim.NPC_PROFILE[mission.giver].name;
    pages.slice(1).forEach((page) => assert.ok(page.startsWith(giverName + " says: "), mission.id));
    assert.equal(pages.length, 1 + mission.thanks.length, mission.id);
  }
});

test("ACC3-02: the real imam line is reachable through a finished salam_to_imam", () => {
  const missions = Missions.create();
  missions.accept("salam_to_imam");
  missions.notify({ type: "goto", target: "mosque_gate" });
  const res = missions.notify({ type: "talk", target: "imam_hakim" });
  assert.equal(res.completed, true);
  const pages = Missions.completionLines(res.mission, "imam_hakim");
  assert.match(pages[0], /^Waalaikumsalam wa rahmatullah/);
  assert.match(pages[1], /^Atuk says: /);
});

test("ACC3-03: the fallback reply follows the neighbour's profile (no Waalaikumsalam for everyone)", () => {
  assert.equal(Missions.stepReply("aunty_mei", null), "Thank you!");
  assert.equal(Missions.stepReply("uncle_lim", ""), "Thank you!");
  assert.equal(Missions.stepReply("makcik_siti", null), "Terima kasih!");
  assert.equal(Missions.stepReply("nobody", null), "Thank you!");
  assert.equal(Missions.stepReply("aunty_mei", "Own line"), "Own line");
  const pages = Missions.completionLines(
    { giver: "atuk", thanks: ["Thanks."], steps: [{ type: "talk", target: "aunty_mei" }] },
    "aunty_mei",
  );
  assert.equal(pages[0], "Thank you!");
  for (const mission of MISSIONS) {
    mission.steps.forEach((s) => assert.doesNotMatch(String(s.line), /^Waalaikumsalam!? Terima/));
  }
  const siti = MISSIONS.flatMap((m) => m.steps).find((s) => s.target === "makcik_siti" && s.line);
  assert.equal(siti.line, "Terima kasih, nak! Jazakallah.");
});

test("COMP-R3-03: the reply button never answers a Waalaikumsalam with Assalamualaikum", () => {
  const label = Missions.replyLabel;
  assert.equal(label("Waalaikumsalam wa rahmatullah, nak.", true), "Thank you!");
  assert.equal(label("Waalaikumsalam! Terima kasih!", false), "Thank you!");
  assert.equal(label("Assalamualaikum, nak!", true), "Waalaikumsalam!");
  assert.equal(label("Terima kasih!", true), "You're welcome!");
  assert.equal(label("Thank you!", false), "You're welcome!");
  assert.equal(label("Morning! Weather very nice today, hor?", false), "Hello!");
  assert.equal(label("Nice day for a walk.", true), "Thank you!");
  for (const line of ["Waalaikumsalam", "waalaikumsalam wa rahmatullah", "Waalaikumsalam!"]) {
    assert.notEqual(label(line, true), "Assalamualaikum!");
    assert.notEqual(label(line, false), "Assalamualaikum!");
  }
});
