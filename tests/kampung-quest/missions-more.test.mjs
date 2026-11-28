// The playability round's missions (AC-P19): at least 8 new ones with varied verbs across both
// regions, every one completable from its own data (giver and targets exist), no fail state, a
// bubble bonus that only ever adds, and Makkah / Madinah missions that never show in the kampung.
import test from "node:test";
import assert from "node:assert/strict";
import { loadSim, plain } from "./load-sim.mjs";

const KQ = loadSim();
const { Missions, MISSIONS, STICKERS, NPC_IDS, POI_IDS, GUIDES, HOLY_POI_IDS } = KQ.Sim;
const OLD = 12;
const NEW = MISSIONS.slice(OLD);
const NPC_STEPS = ["talk", "deliver"];
const POI_STEPS = ["goto", "buy", "collect", "photo", "ride", "escort"];

/** The events that complete one mission, in order. */
function eventsFor(mission) {
  const out = [];
  for (const step of mission.steps)
    for (let i = 0; i < (step.count || 1); i += 1)
      out.push({ type: step.type, target: step.target, item: step.item });
  return out;
}

test("there are at least 8 new missions, in both regions, with unique ids", () => {
  assert.ok(NEW.length >= 8, "new missions: " + NEW.length);
  assert.equal(new Set(MISSIONS.map((m) => m.id)).size, MISSIONS.length);
  assert.ok(NEW.filter((m) => !m.region).length >= 5, "kampung");
  assert.ok(NEW.filter((m) => m.region === "haramain").length >= 3, "Makkah and Madinah");
});

test("the new missions use many different verbs", () => {
  const verbs = new Set(NEW.flatMap((m) => m.steps.map((s) => s.type)));
  for (const v of ["goto", "talk", "deliver", "collect", "buy", "greet", "photo", "ride", "escort"])
    assert.ok(verbs.has(v), v);
  assert.ok(verbs.size >= 6);
});

/** One step of a new mission points at something that exists. */
function checkStep(m, s, haram, placeIds) {
  if (NPC_STEPS.includes(s.type)) {
    const ok = haram ? Boolean(GUIDES[s.target]) : NPC_IDS.includes(s.target);
    assert.ok(ok, m.id + " npc target " + s.target);
  } else if (POI_STEPS.includes(s.type)) {
    assert.ok(placeIds.includes(s.target), m.id + " place " + s.target);
    if (!haram && s.target !== "pony_ride")
      assert.ok(POI_IDS.includes(s.target), m.id + " kampung place " + s.target);
  } else assert.equal(s.type, "greet", m.id + " step " + s.type);
  if (s.type === "escort") assert.ok(NPC_IDS.includes(s.who), m.id + " escortee");
  assert.ok(s.label.length > 5, m.id);
}

test("every new mission's giver and targets exist", () => {
  const placeIds = POI_IDS.concat(HOLY_POI_IDS);
  for (const m of NEW) {
    const haram = m.region === "haramain";
    if (haram) assert.ok(GUIDES[m.giver], m.id + " giver is a guide");
    else assert.ok(NPC_IDS.includes(m.giver), m.id + " giver");
    for (const s of m.steps) checkStep(m, s, haram, placeIds);
    for (const id of m.needs || []) assert.ok(placeIds.includes(id), m.id + " needs " + id);
  }
});

test("a Makkah guide never gives a kampung mission and vice versa", () => {
  const kampung = Missions.create({ region: "kampung" });
  const holy = Missions.create({ region: "haramain" });
  const ids = (t) => t.offered().map((m) => m.id);
  assert.ok(ids(kampung).every((id) => !id.startsWith("h_")));
  assert.ok(ids(holy).every((id) => id.startsWith("h_")));
  assert.equal(holy.accept("prata_for_nenek").ok, false);
  assert.equal(kampung.accept("h_new_friends").ok, false);
  assert.equal(holy.wantsTalk("guide_makkah"), true);
  assert.equal(kampung.wantsTalk("guide_makkah"), false);
  assert.equal(holy.wantsTalk("nenek"), false);
});

test("a mission that needs a place the world lacks is not offered (graceful degradation)", () => {
  const without = Missions.create({ hasPoi: () => false });
  const withAll = Missions.create({ hasPoi: () => true });
  assert.equal(
    without.offered().some((m) => m.id === "visit_the_ponies"),
    false,
  );
  assert.equal(
    withAll.offered().some((m) => m.id === "visit_the_ponies"),
    true,
  );
  assert.equal(without.accept("visit_the_ponies").ok, false);
  const camels = Missions.create({ region: "haramain", hasPoi: (id) => id !== "camel_yard" });
  assert.equal(
    camels.offered().some((m) => m.id === "h_visit_camels"),
    false,
  );
});

test("every new mission completes from its own steps, in both regions", () => {
  for (const m of NEW) {
    const t = Missions.create({ region: m.region || "kampung" });
    assert.equal(t.accept(m.id).ok, true, m.id);
    let last = null;
    for (const e of eventsFor(m)) last = t.notify(e);
    assert.equal(last.completed, true, m.id);
    assert.ok(last.reward.coins >= 4 && last.reward.coins <= 12, m.id + " reward is balanced");
    assert.ok(last.reward.stickers.length >= 1, m.id);
  }
});

test("all new missions finish in one playthrough per region, stickers without duplicates", () => {
  for (const region of ["kampung", "haramain"]) {
    const t = Missions.create({ region });
    for (const m of t.offered()) {
      assert.equal(t.accept(m.id).ok, true, m.id);
      eventsFor(m).forEach((e) => t.notify(e));
    }
    assert.equal(t.available().length, 0, region);
    assert.equal(new Set(t.stickers()).size, t.stickers().length);
  }
});

test("rewards stay near the existing economy (4-7 coins), stickers exist", () => {
  const ids = STICKERS.map((s) => s.id);
  for (const m of MISSIONS) {
    assert.ok(m.reward.coins >= 4 && m.reward.coins <= 7, m.id);
    assert.ok(
      m.reward.stickers.every((s) => ids.includes(s)),
      m.id,
    );
  }
  for (const id of ["sticker_friendly", "sticker_wedding", "sticker_gift"])
    assert.ok(ids.includes(id));
});

test("wording is child-friendly and gender-neutral toward the hero", () => {
  const text = JSON.stringify(NEW.map((m) => [m.title, m.intro, m.reminder, m.thanks, m.steps]));
  assert.doesNotMatch(
    text,
    /\b(good (boy|girl)|young (man|lady)|little (boy|girl)|my (boy|girl))\b/i,
  );
  assert.doesNotMatch(text, /\b(kill|fight|weapon|steal|crime|beer|wine|pork|blood|dead)\b/i);
  for (const m of NEW.filter((x) => x.region === "haramain")) {
    assert.match(m.intro[0], /^Assalamualaikum/, m.id + " the guides greet with the salaam");
  }
  for (const m of NEW.filter((x) =>
    ["uncle_lim", "aunty_mei", "postman_dan", "kid_wei"].includes(x.giver),
  ))
    assert.doesNotMatch(JSON.stringify(m.intro), /salam/i, m.id);
});

test("beat the bubble: fast adds a bonus, slow loses nothing, paused time never counts", () => {
  const dash = MISSIONS.find((m) => m.id === "prata_dash");
  assert.ok(dash.beat.secs >= 60 && dash.beat.coins >= 1);
  const play = (secs) => {
    const t = Missions.create();
    t.accept("prata_dash");
    t.tick(secs);
    t.notify({ type: "buy", target: "stall_prata", item: "roti_prata" });
    return t.notify({ type: "deliver", target: "dr_nurul", item: "roti_prata" });
  };
  const fast = play(30);
  const slow = play(500);
  assert.equal(fast.completed && slow.completed, true, "slow still completes");
  assert.equal(fast.reward.coins, dash.reward.coins + dash.beat.coins);
  assert.equal(fast.reward.bonus, dash.beat.coins);
  assert.equal(slow.reward.coins, dash.reward.coins);
  assert.equal(slow.reward.bonus, 0);
  const t = Missions.create();
  t.accept("prata_dash");
  assert.equal(t.bubbleLeft(), dash.beat.secs);
  t.tick(40);
  assert.equal(t.bubbleLeft(), dash.beat.secs - 40);
  t.tick(-5);
  t.tick(NaN);
  assert.equal(t.bubbleLeft(), dash.beat.secs - 40);
  t.setPaused(true);
  t.tick(30);
  assert.equal(t.bubbleLeft(), dash.beat.secs - 40, "waiting while we pray costs nothing");
  t.abandon();
  assert.equal(t.bubbleLeft(), null);
  const other = Missions.create();
  other.accept("prata_for_nenek");
  assert.equal(other.bubbleLeft(), null);
});

test("the save round trip keeps working with the new missions (the bubble clock is not saved)", () => {
  const t = Missions.create();
  t.accept("friendly_five");
  t.notify({ type: "greet", target: "people" });
  const snap = plain(t.snapshot());
  assert.deepEqual(snap.active, { id: "friendly_five", step: 0, count: 1 });
  const copy = Missions.create();
  copy.restore(snap);
  assert.deepEqual(plain(copy.snapshot()), snap);
  assert.equal(copy.progress().count, 1);
  assert.equal(copy.progress().verb, "Say hi");
});

test("AC-P19: Say hi to N people counts distinct people, not repeat hellos to one person", () => {
  const t = Missions.create();
  t.accept("friendly_five");
  const hi = (who) => t.notify({ type: "greet", target: "people", who });
  for (let i = 0; i < 6; i += 1) hi("m1"); // the same extra, again and again
  assert.equal(t.progress().count, 1, "one person is one hello");
  ["m2", "m3", "m4"].forEach(hi);
  assert.equal(t.progress().count, 4);
  assert.equal(hi("m3").changed, false, "a repeat changes nothing");
  hi("m5");
  assert.equal(
    t.progress().label,
    "Tell Irfan how it went",
    "the fifth different person finishes it",
  );
  const pilgrims = Missions.create({ region: "haramain" });
  const g = MISSIONS.find((m) => m.steps[0].type === "greet" && m.region === "haramain");
  pilgrims.accept(g.id);
  for (let i = 0; i < 8; i += 1) pilgrims.notify({ type: "greet", target: "people", who: "p1" });
  assert.equal(
    pilgrims.progress().count,
    1,
    "Makkah: the same pilgrim again and again is still one",
  );
  pilgrims.notify({ type: "greet", target: "people" });
  assert.equal(pilgrims.progress().count, 2);
});

test("progress carries the verb, the quick flag, the item and who to escort", () => {
  const t = Missions.create();
  t.accept("push_the_car");
  const p = plain(t.progress());
  assert.equal(p.verb, "Push");
  assert.equal(p.quick, true);
  assert.equal(p.need, 3);
  const e = Missions.create();
  e.accept("walk_wei_home");
  e.notify({ type: "talk", target: "kid_wei" });
  assert.equal(e.progress().who, "kid_wei");
  assert.equal(e.progress().markerKind, "poi");
});

test("a wrong verb or place does not advance the new steps", () => {
  const t = Missions.create();
  t.accept("kampung_photos");
  assert.equal(t.notify({ type: "goto", target: "mosque_gate" }).changed, false);
  assert.equal(t.notify({ type: "photo", target: "playground" }).changed, false, "wrong order");
  assert.equal(t.notify({ type: "photo", target: "mosque_gate" }).stepDone, true);
});
