// PM-01: the gentle first-meal nudge and the food / energy "low" notes (pure logic): when they come,
// that each shows once, that the marker clears on eating, and that the saved section is safe.
import test from "node:test";
import assert from "node:assert/strict";
import { loadSim, plain, memoryStorage } from "./load-sim.mjs";

const KQ = loadSim();
const { Hints, Save, Needs, Economy, Clock, Missions, Prayer } = { ...KQ.Sim };

/** The facts the game layer passes in; override what a test cares about. */
function facts(over = {}) {
  return {
    minute: 420,
    day: 1,
    completed: 0,
    hungry: false,
    tired: false,
    canEat: true,
    canAfford: true,
    ...over,
  };
}

test("a brand-new player at 07:00 with no mission done gets no nudge yet", () => {
  assert.equal(Hints.create().next(facts()), null);
});

test("the first-meal nudge comes right after the first mission is completed", () => {
  const hints = Hints.create();
  assert.equal(hints.next(facts({ completed: 1 })), Hints.FIRST_MEAL);
});

test("with no mission done, the first-meal nudge comes at 10:00 and not a minute before", () => {
  const hints = Hints.create();
  assert.equal(hints.next(facts({ minute: 599 })), null);
  assert.equal(hints.next(facts({ minute: 600 })), Hints.FIRST_MEAL);
});

test("the first-meal nudge shows once: marking it shown stops it, and the marker is wanted", () => {
  const hints = Hints.create();
  const ctx = facts({ completed: 1 });
  assert.equal(hints.markerWanted(), false);
  hints.markShown(Hints.FIRST_MEAL, ctx);
  assert.equal(hints.next(ctx), null);
  assert.equal(hints.nudged, true);
  assert.equal(hints.markerWanted(), true);
});

test("eating clears the marker and the nudge never comes back", () => {
  const hints = Hints.create();
  hints.markShown(Hints.FIRST_MEAL, facts({ completed: 1 }));
  hints.noteAte();
  assert.equal(hints.markerWanted(), false);
  assert.equal(hints.ate, true);
  assert.equal(hints.next(facts({ completed: 3, minute: 900 })), null);
});

test("a player who already ate is never nudged, even with no nudge shown", () => {
  const hints = Hints.create();
  hints.noteAte();
  assert.equal(hints.next(facts({ completed: 1 })), null);
});

test("no nudge while the hero is too full to eat or cannot afford a bite", () => {
  const hints = Hints.create();
  assert.equal(hints.next(facts({ completed: 1, canEat: false })), null);
  assert.equal(hints.next(facts({ completed: 1, canAfford: false })), null);
});

test("a very hungry first-time player is nudged straight away", () => {
  assert.equal(Hints.create().next(facts({ hungry: true })), Hints.FIRST_MEAL);
});

test("food low is shown once per game day, again on the next day", () => {
  const hints = Hints.create();
  hints.markShown(Hints.FIRST_MEAL, facts({ completed: 1 }));
  hints.noteAte();
  const day1 = facts({ hungry: true, day: 1 });
  assert.equal(hints.next(day1), Hints.FOOD_LOW);
  hints.markShown(Hints.FOOD_LOW, day1);
  assert.equal(hints.next(day1), null);
  assert.equal(hints.next(facts({ hungry: true, day: 2 })), Hints.FOOD_LOW);
});

test("energy low is its own note, once per day, and independent of food", () => {
  const hints = Hints.create();
  hints.noteAte();
  const ctx = facts({ tired: true, hungry: true, day: 4 });
  assert.equal(hints.next(ctx), Hints.FOOD_LOW);
  hints.markShown(Hints.FOOD_LOW, ctx);
  assert.equal(hints.next(ctx), Hints.ENERGY_LOW);
  hints.markShown(Hints.ENERGY_LOW, ctx);
  assert.equal(hints.next(ctx), null);
});

test("a first-meal nudge shown while hungry also counts as today's food-low note", () => {
  const hints = Hints.create();
  const ctx = facts({ hungry: true, day: 2 });
  hints.markShown(Hints.FIRST_MEAL, ctx);
  assert.equal(hints.next(ctx), null);
});

test("snapshot / restore round-trips and snapshot is a copy", () => {
  const hints = Hints.create();
  hints.markShown(Hints.FIRST_MEAL, facts({ hungry: true, day: 3 }));
  hints.noteAte();
  const snap = hints.snapshot();
  assert.deepEqual(plain(snap), { nudged: true, ate: true, foodDay: 3, energyDay: 0 });
  snap.ate = false;
  assert.equal(hints.ate, true);
  const other = Hints.create();
  other.restore(snap);
  assert.equal(other.nudged, true);
});

test("sanitize: junk, wrong types and absurd numbers fall back to safe values", () => {
  assert.deepEqual(plain(Hints.sanitize(undefined)), plain(Hints.defaults()));
  assert.deepEqual(plain(Hints.sanitize("x")), plain(Hints.defaults()));
  assert.deepEqual(plain(Hints.sanitize([true])), plain(Hints.defaults()));
  const clean = Hints.sanitize({
    nudged: "yes",
    ate: 1,
    foodDay: "1e999",
    energyDay: -5,
    __proto__: { evil: 1 },
  });
  assert.deepEqual(plain(clean), { nudged: false, ate: false, foodDay: 0, energyDay: 0 });
  assert.equal(Hints.sanitize({ foodDay: "7.9", energyDay: 1e9 }).foodDay, 7);
  assert.equal(Hints.sanitize({ energyDay: 1e9 }).energyDay, 99999);
  assert.equal(Hints.sanitize({ nudged: true, ate: true }).ate, true);
});

test("the save carries hints: a new game has the defaults and the section round-trips", () => {
  assert.deepEqual(plain(Save.defaultState().hints), plain(Hints.defaults()));
  const storage = memoryStorage();
  const state = Save.defaultState();
  state.hints = { nudged: true, ate: false, foodDay: 2, energyDay: 5 };
  assert.equal(Save.save(storage, state).ok, true);
  assert.deepEqual(plain(Save.load(storage).state.hints), plain(state.hints));
});

test("an older save without a hints section still loads, with the defaults", () => {
  const old = plain(Save.defaultState());
  delete old.hints;
  const storage = memoryStorage({ [Save.KEY]: JSON.stringify(old) });
  const loaded = Save.load(storage);
  assert.equal(loaded.status, "loaded");
  assert.deepEqual(plain(loaded.state.hints), plain(Hints.defaults()));
});

test("a hostile hints section in a save is cleaned, not trusted", () => {
  const bad = plain(Save.defaultState());
  bad.hints = { nudged: "true", ate: {}, foodDay: "abc", energyDay: 1e300, extra: "x" };
  const loaded = Save.load(memoryStorage({ [Save.KEY]: JSON.stringify(bad) }));
  assert.equal(loaded.status, "loaded");
  assert.deepEqual(plain(loaded.state.hints), {
    nudged: false,
    ate: false,
    foodDay: 0,
    energyDay: 99999,
  });
});

test("capture / apply carries the hints through a save and reload", () => {
  const sim = {
    clock: Clock.create(),
    economy: Economy.create(),
    needs: Needs.create(),
    missions: Missions.create(),
    hints: Hints.create(),
  };
  sim.hints.markShown(Hints.FIRST_MEAL, facts({ completed: 1 }));
  const storage = memoryStorage();
  assert.equal(Save.save(storage, Save.capture(sim)).ok, true);
  const again = { ...sim, hints: Hints.create() };
  Save.apply(Save.load(storage).state, again);
  assert.equal(again.hints.nudged, true);
  assert.equal(again.hints.markerWanted(), true);
});

test("a nudged player can really buy and eat with the first mission's coins (no dead end)", () => {
  const economy = Economy.create();
  const needs = Needs.create();
  needs.tick(60); // an hour of play after the start
  economy.spend(2); // the mission's prata
  economy.add(5); // the reward
  const hunger = needs.hunger;
  const cheapest = Math.min(...KQ.Sim.MENU.filter((d) => d.hunger > 0).map((d) => d.price));
  assert.ok(economy.coins >= cheapest);
  const res = economy.buy("nasi_lemak", { needs });
  assert.equal(res.ok, true);
  assert.ok(needs.hunger > hunger);
});

test("prayers already past at the start are 'home' (prayed at home), later ones are not", () => {
  const prayer = Prayer.create({
    date: "x",
    subuh: "05:00",
    syuruk: "06:30",
    zohor: "13:00",
    asar: "16:30",
    maghrib: "19:00",
    isyak: "20:15",
  });
  prayer.update(420, 1);
  const [subuh, zohor] = prayer.state().prayers;
  assert.equal(subuh.status, "done");
  assert.equal(subuh.home, true);
  assert.equal(zohor.home, false);
  prayer.update(13 * 60 + 5, 1);
  prayer.startFlow("zohor");
  assert.equal(prayer.state().prayers[0].home, true, "still true later in the day");
});

test("a saved 'prayed at home' prayer stays home after a reload", () => {
  const times = {
    date: "x",
    subuh: "05:00",
    syuruk: "06:30",
    zohor: "13:00",
    asar: "16:30",
    maghrib: "19:00",
    isyak: "20:15",
  };
  const a = Prayer.create(times);
  a.update(420, 1);
  const b = Prayer.create(times);
  assert.equal(b.restore(a.snapshot()), true);
  assert.equal(b.state().prayers[0].home, true);
});
