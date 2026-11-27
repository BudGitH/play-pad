// AC-13: the save persists under kampung-quest:v1, is schema-checked, clamped and never throws.
import test from "node:test";
import assert from "node:assert/strict";
import { loadSim, FIXTURE_TIMES, plain, memoryStorage, mins } from "./load-sim.mjs";

const KQ = loadSim();
const { Save, Clock, Needs, Economy, Missions, Prayer } = { ...KQ.Sim };
const KEY = "kampung-quest:v1";

function stored(obj) {
  return memoryStorage({ [KEY]: typeof obj === "string" ? obj : JSON.stringify(obj) });
}

test("the storage key is kampung-quest:v1", () => {
  assert.equal(Save.KEY, KEY);
  const storage = memoryStorage();
  Save.save(storage, Save.defaultState());
  assert.ok(KEY in storage.data);
});

test("a missing save is a new game (07:00, day 1)", () => {
  const result = Save.load(memoryStorage());
  assert.equal(result.status, "new");
  assert.equal(result.state.clock.minute, 420);
  assert.equal(result.state.clock.day, 1);
  assert.equal(result.state.coins, 10);
  assert.equal(result.state.prayers, null);
});

test("save then load round-trips every field", () => {
  const storage = memoryStorage();
  const state = Save.defaultState();
  state.clock = { minute: 800.5, day: 3 };
  state.coins = 42;
  state.needs = { hunger: 33, energy: 66 };
  state.missions = {
    active: { id: "lost_cat", step: 1, count: 0 },
    completed: ["prata_for_nenek"],
    stickers: ["sticker_prata"],
  };
  state.outfit = { hair: "curly", hat: "songkok" };
  state.pos = { x: 12.5, z: -3 };
  state.settings = { muted: true, quality: "low" };
  assert.equal(Save.save(storage, state).ok, true);
  const loaded = Save.load(storage);
  assert.equal(loaded.status, "loaded");
  assert.deepEqual(plain(loaded.state), plain({ ...state, rev: loaded.state.rev }));
});

test("corrupt JSON falls back to a new game without throwing", () => {
  for (const text of [
    "{not json",
    "",
    "undefined",
    "{",
    "\u0000\u0001",
    "null",
    "123",
    "true",
    "[]",
    '"str"',
  ]) {
    const result = Save.load(stored(text));
    assert.ok(
      ["corrupt", "new"].includes(result.status),
      JSON.stringify(text) + " -> " + result.status,
    );
    assert.deepEqual(plain(result.state), plain(Save.defaultState()));
  }
  assert.equal(Save.load(stored("{not json")).status, "corrupt");
});

test("wrong version or wrong top-level shape is rejected as corrupt", () => {
  for (const bad of [{}, { v: 2 }, { v: "1" }, { v: 0, coins: 99 }, [], { coins: 5 }]) {
    assert.equal(Save.load(stored(bad)).status, "corrupt", JSON.stringify(bad));
  }
});

test("wrong field types fall back per field, other good fields survive", () => {
  const result = Save.load(
    stored({
      v: 1,
      coins: "lots",
      needs: "no",
      clock: 5,
      missions: 7,
      outfit: [],
      settings: "x",
      pos: "here",
      prayers: "amen",
    }),
  );
  assert.equal(result.status, "loaded");
  assert.deepEqual(plain(result.state), plain(Save.defaultState()));
  const mixed = Save.load(stored({ v: 1, coins: 77, needs: { hunger: "x", energy: 12 } })).state;
  assert.equal(mixed.coins, 77);
  assert.equal(mixed.needs.energy, 12);
  assert.equal(mixed.needs.hunger, 85);
});

test("numbers are clamped: coins, meters, clock, day, position", () => {
  const state = Save.load(
    stored({
      v: 1,
      coins: 1e12,
      needs: { hunger: 500, energy: -20 },
      clock: { minute: 99999, day: 0 },
      pos: { x: 1e9, z: -1e9 },
    }),
  ).state;
  assert.equal(state.coins, 99999);
  assert.deepEqual(plain(state.needs), { hunger: 100, energy: 0 });
  assert.equal(state.clock.minute, 1439.99);
  assert.equal(state.clock.day, 1);
  assert.equal(state.pos, null);
  assert.equal(Save.load(stored({ v: 1, coins: -5 })).state.coins, 0);
  assert.equal(Save.load(stored({ v: 1, coins: 7.9 })).state.coins, 7);
});

test("non-finite numbers (1e999 -> Infinity, null, strings) never survive", () => {
  const state = Save.load(
    stored(
      '{"v":1,"coins":1e999,"needs":{"hunger":1e999,"energy":-1e999},"clock":{"minute":1e999,"day":1e999}}',
    ),
  ).state;
  assert.equal(state.coins, 10);
  assert.equal(state.needs.hunger, 85);
  assert.equal(state.needs.energy, 90);
  assert.equal(state.clock.minute, 420);
  assert.equal(state.clock.day, 1);
  const nulls = Save.load(
    stored({ v: 1, coins: null, needs: { hunger: null }, clock: { minute: "abc" } }),
  ).state;
  assert.equal(nulls.coins, 10);
  assert.equal(nulls.clock.minute, 420);
});

test("unknown mission / sticker / outfit ids are dropped", () => {
  const state = Save.load(
    stored({
      v: 1,
      missions: {
        active: { id: "hax", step: 0 },
        completed: ["lost_cat", "evil", 5],
        stickers: ["sticker_cat", "sticker_x"],
      },
      outfit: { hair: "mohawk-of-doom", hat: "songkok" },
      settings: { quality: "ultra", muted: "yes" },
    }),
  ).state;
  assert.deepEqual(plain(state.missions), {
    active: null,
    completed: ["lost_cat"],
    stickers: ["sticker_cat"],
  });
  assert.deepEqual(plain(state.outfit), { hair: "classic", hat: "songkok" });
  assert.deepEqual(plain(state.settings), { muted: false, quality: "med" });
});

test("a __proto__ / constructor payload cannot pollute anything", () => {
  const text =
    '{"v":1,"coins":5,"__proto__":{"polluted":true},"constructor":{"prototype":{"polluted":true}}}';
  const result = Save.load(stored(text));
  assert.equal(result.state.coins, 5);
  assert.equal({}.polluted, undefined);
  assert.equal(Object.prototype.polluted, undefined);
  assert.equal(result.state.polluted, undefined);
});

test("storage that throws never throws out of load / save / clear", () => {
  const hostile = {
    getItem() {
      throw new Error("SecurityError");
    },
    setItem() {
      throw new Error("QuotaExceededError");
    },
    removeItem() {
      throw new Error("nope");
    },
  };
  const loaded = Save.load(hostile);
  assert.equal(loaded.status, "unavailable");
  assert.deepEqual(plain(loaded.state), plain(Save.defaultState()));
  assert.deepEqual(plain(Save.save(hostile, Save.defaultState())), {
    ok: false,
    reason: "unavailable",
  });
  assert.equal(Save.clear(hostile), false);
});

test("missing / odd storage objects are 'unavailable', never an exception", () => {
  for (const bad of [null, undefined, {}, 5, "str"]) {
    assert.equal(Save.load(bad).status, "unavailable");
    assert.equal(Save.save(bad, Save.defaultState()).ok, false);
  }
});

test("getItem returning a non-string or an absurdly large blob is corrupt, not a crash", () => {
  assert.equal(Save.load({ getItem: () => ({ v: 1 }) }).status, "corrupt");
  assert.equal(Save.load({ getItem: () => "x".repeat(5e5) }).status, "corrupt");
  assert.equal(Save.load({ getItem: () => undefined }).status, "new");
});

test("save() sanitises first so junk is never written, and rejects non-objects", () => {
  const storage = memoryStorage();
  const dirty = {
    coins: -9,
    needs: { hunger: 9999, energy: NaN },
    missions: { completed: ["zzz"] },
    outfit: { hair: "x" },
  };
  assert.equal(Save.save(storage, dirty).ok, true);
  const written = JSON.parse(storage.data[KEY]);
  assert.equal(written.v, 1);
  assert.equal(written.coins, 0);
  assert.equal(written.needs.hunger, 100);
  assert.deepEqual(written.missions.completed, []);
  for (const bad of [null, undefined, 5, "x", []])
    assert.deepEqual(plain(Save.save(storage, bad)), { ok: false, reason: "invalid" });
});

test("clear() removes the save so the next load is a new game", () => {
  const storage = memoryStorage();
  Save.save(storage, Save.defaultState());
  assert.equal(Save.clear(storage), true);
  assert.equal(Save.load(storage).status, "new");
});

test("capture/apply: live modules survive a save and reload, incl. mid-prayer", () => {
  const sim = {
    clock: Clock.create({ times: FIXTURE_TIMES }),
    economy: Economy.create({ coins: 23 }),
    needs: Needs.create({ hunger: 41, energy: 59 }),
    missions: Missions.create(),
    prayer: Prayer.create(FIXTURE_TIMES),
  };
  sim.clock.set(mins("13:10"));
  sim.prayer.update(mins("07:00"), 1);
  sim.prayer.update(mins("13:10"), 1);
  sim.prayer.startFlow("zohor");
  sim.prayer.wuduStep("niat");
  sim.missions.accept("lost_cat");
  sim.missions.notify({ type: "goto", target: "park" });
  const storage = memoryStorage();
  assert.equal(Save.save(storage, Save.capture(sim)).ok, true);

  const reloaded = {
    clock: Clock.create({ times: FIXTURE_TIMES }),
    economy: Economy.create(),
    needs: Needs.create(),
    missions: Missions.create(),
    prayer: Prayer.create(FIXTURE_TIMES),
  };
  const loaded = Save.load(storage);
  assert.equal(loaded.status, "loaded");
  Save.apply(loaded.state, reloaded);
  assert.equal(reloaded.clock.hhmm(), "13:10");
  assert.equal(reloaded.economy.coins, 23);
  assert.deepEqual(plain(reloaded.needs.snapshot()), { hunger: 41, energy: 59 });
  assert.equal(reloaded.missions.progress().stepIndex, 1);
  assert.equal(
    reloaded.prayer.nextWuduStep().id,
    "hands",
    "resumes at the start of the next wudu step",
  );
  assert.equal(reloaded.prayer.isBlockingMissions(), true);
});

/** A fresh Save module (its tab-local revision starts at 0) - one per "browser tab". */
function newTab() {
  return loadSim().Sim.Save;
}

test("RISK-01: every save bumps the revision and load reads it back", () => {
  const tab = newTab();
  const storage = memoryStorage();
  assert.deepEqual(plain(tab.save(storage, tab.defaultState())), { ok: true, rev: 1 });
  assert.equal(tab.save(storage, tab.defaultState()).rev, 2);
  assert.equal(JSON.parse(storage.data[KEY]).rev, 2);
  assert.equal(newTab().load(storage).state.rev, 2);
});

test("RISK-01: a stale tab cannot overwrite newer progress from another tab", () => {
  const storage = memoryStorage();
  const a = newTab();
  a.save(storage, a.defaultState());
  const b = newTab();
  b.load(storage); // tab B continues the same game
  const newer = a.defaultState();
  newer.coins = 90;
  assert.equal(a.save(storage, newer).ok, true); // tab A got ahead
  const stale = b.defaultState();
  stale.coins = 10;
  assert.deepEqual(plain(b.save(storage, stale)), { ok: false, reason: "stale" });
  assert.equal(JSON.parse(storage.data[KEY]).coins, 90);
  assert.equal(b.save(storage, stale).ok, false, "stays refused until the tab reloads");
});

test("RISK-01: after a reload the second tab may save again; New game keeps the revision rising", () => {
  const storage = memoryStorage();
  const a = newTab();
  a.save(storage, a.defaultState());
  a.save(storage, a.defaultState());
  const reloaded = newTab();
  reloaded.load(storage);
  assert.equal(reloaded.save(storage, reloaded.defaultState()).rev, 3);
  reloaded.clear(storage);
  assert.equal(reloaded.save(storage, reloaded.defaultState()).rev, 5, "clear took rev 4");
});

test("RISK2-01: New game in one tab cannot be overwritten by an older tab, nor lock the new one out", () => {
  const storage = memoryStorage();
  const a = newTab(); // tab A plays on and saves three times (rev 3)
  const rich = a.defaultState();
  rich.coins = 500;
  [1, 2, 3].forEach(() => a.save(storage, rich));
  const b = newTab(); // tab B opens the same game, then chooses New game
  b.load(storage);
  assert.equal(b.clear(storage), true);
  assert.equal(b.load(storage).status, "new", "the cleared marker reads as a new game");
  const first = b.save(storage, b.defaultState());
  assert.equal(first.ok, true, "the new game saves");
  assert.ok(first.rev > 3, "its revision is above the old tab's");
  const stale = a.save(storage, rich); // tab A (still rev 3) autosaves
  assert.deepEqual(plain(stale), { ok: false, reason: "stale" });
  assert.equal(JSON.parse(storage.data[KEY]).coins, 10, "the new game was not overwritten");
  assert.equal(b.save(storage, b.defaultState()).ok, true, "tab B keeps saving");
});

test("RISK2-01: clear() with nothing stored, a hostile value or blocked storage never throws", () => {
  const tab = newTab();
  const empty = memoryStorage();
  assert.equal(tab.clear(empty), true);
  assert.equal(tab.load(empty).status, "new");
  const junk = stored("{nope");
  assert.equal(tab.clear(junk), true);
  assert.equal(JSON.parse(junk.data[KEY]).cleared, true);
  const blocked = {
    getItem: () => {
      throw new Error("blocked");
    },
    setItem: () => {
      throw new Error("blocked");
    },
  };
  assert.equal(tab.clear(blocked), false);
});

test("RISK2-01: a hostile cleared marker only ever yields a new game and a bounded revision", () => {
  const tab = newTab();
  const result = tab.load(stored({ v: 1, cleared: true, rev: 1e300, coins: 9999 }));
  assert.equal(result.status, "new");
  assert.equal(result.state.coins, 10, "nothing is read from a marker but its revision");
  assert.equal(tab.currentRev(), 1e9);
  assert.equal(tab.load(stored({ v: 1, cleared: "yes" })).status, "loaded", "only true counts");
});

test("RISK-01: revOf is total - junk, huge or negative revisions read as safe numbers", () => {
  const tab = newTab();
  assert.equal(tab.revOf(null), 0);
  assert.equal(tab.revOf("{nope"), 0);
  assert.equal(tab.revOf('{"rev":"9"}'), 0);
  assert.equal(tab.revOf('{"rev":-4}'), 0);
  assert.equal(tab.revOf('{"rev":7}'), 7);
  assert.equal(tab.revOf('{"rev":1e300}'), 1e9, "huge values clamp to the maximum");
  assert.equal(tab.sanitize({ v: 1, rev: 1e300 }).rev, 1e9);
});

test("RISK-03: a saved hero position outside the playable bounds falls back to the start spot", () => {
  const tab = newTab();
  const at = (x, z) => tab.load(stored({ v: 1, pos: { x, z } })).state.pos;
  assert.equal(at(999, 999), null);
  assert.equal(at(-71, 0), null);
  assert.equal(at(0, 500), null);
  assert.deepEqual(plain(at(-42.6, 22.4)), { x: -42.6, z: 22.4 });
  assert.deepEqual(plain(at(70, -70)), { x: 70, z: -70 });
});

test("ACC-2: Save.apply with prayers ahead of the clock recovers once the prayer tracker updates", () => {
  const ahead = Prayer.create(FIXTURE_TIMES);
  ahead.update(mins("07:00"), 1);
  ahead.update(mins("20:30"), 1);
  const state = Save.defaultState();
  state.clock = { minute: mins("07:10"), day: 1 };
  state.prayers = plain(ahead.snapshot());
  const sim = {
    clock: Clock.create({ times: FIXTURE_TIMES }),
    economy: Economy.create(),
    needs: Needs.create(),
    missions: Missions.create(),
    prayer: Prayer.create(FIXTURE_TIMES),
  };
  Save.apply(state, sim);
  sim.prayer.update(sim.clock.minute, sim.clock.day);
  assert.equal(sim.prayer.due(), null);
  assert.equal(sim.prayer.state().qada.length, 0);
});
