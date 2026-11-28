// Small public members of the sim layer that no feature test happened to call by name. They are covered
// here so tools/check-sim-tested.mjs (ENFORCEMENT.md row 25) has nothing to baseline for them.
import test from "node:test";
import assert from "node:assert/strict";
import { loadSim } from "./load-sim.mjs";

// These three are not in SIM_FILES (the game loads them in its own order), so they get their own sandbox.
const Sim = { ...loadSim().Sim, ...loadSim(["map-view", "vehicle", "vehicle-life"]).Sim };
const KAABA = { x: 0, z: 0, w: 10, d: 12, blackStoneCorner: "SE" };

test("isPoi / isNpc accept only known ids (and only strings)", () => {
  assert.equal(Sim.isPoi(Sim.POI_IDS[0]), true);
  assert.equal(Sim.isPoi("nowhere"), false);
  assert.equal(Sim.isPoi(42), false);
  assert.equal(Sim.isNpc(Sim.NPC_IDS[0]), true);
  assert.equal(Sim.isNpc("toString"), false, "inherited keys are not neighbours");
  assert.equal(Sim.isNpc(null), false);
});

test("Economy.canAfford agrees with spend: finite, non-negative and not more than the coins held", () => {
  const e = Sim.Economy.create();
  e.setCoins(10);
  assert.equal(e.canAfford(10), true);
  assert.equal(e.canAfford(11), false);
  assert.equal(e.canAfford(-1), false);
  assert.equal(e.canAfford(NaN), false);
});

test("Needs.isHungry is true only below the low level", () => {
  assert.equal(Sim.Needs.create({ hunger: 100 }).isHungry(), false);
  assert.equal(Sim.Needs.create({ hunger: 5 }).isHungry(), true);
});

test("the Say-hi tally reports the coins it has paid and forgets them on reset", () => {
  const t = Sim.Hi.createTally();
  for (let i = 0; i < Sim.Hi.TALLY.every; i += 1) t.note();
  assert.equal(t.paid(), 1);
  t.reset();
  assert.equal(t.paid(), 0);
});

test("the recite cursor reports its total and resets to the first word", () => {
  const c = Sim.Recite.create(4);
  assert.equal(c.total, 4);
  c.next();
  c.next();
  assert.equal(c.reset(), 0);
  assert.equal(c.index, 0);
});

test("a tawaf tracker is armed only once the hero has passed the Black Stone line", () => {
  const W = Sim.RitualWalk;
  const start = W.blackStoneAngle(KAABA);
  const t = W.createTawaf({ cx: 0, cz: 0, startAngle: start, rMin: 7, rMax: 32, rounds: 7 });
  assert.equal(t.armed, false);
  const p = W.tawafRoute({ cx: 0, cz: 0, startAngle: start, radius: 15 }).at(0.001);
  t.feed(p.x, p.z);
  assert.equal(t.armed, true);
});

test("an Umrah tracker names the rite step in progress and remembers the ihram flag", () => {
  const t = Sim.Umrah.create();
  assert.equal(t.active, null);
  t.next("umrah");
  assert.equal(typeof t.active, "string");
  t.setIhram(true);
  assert.equal(t.ihram, true);
  t.setIhram(0);
  assert.equal(t.ihram, false);
});

test("MapView.inside is true for a point in the window, padding widens it", () => {
  const v = { w: 100, h: 50 };
  assert.equal(Sim.MapView.inside(v, { x: 10, y: 10 }), true);
  assert.equal(Sim.MapView.inside(v, { x: 105, y: 10 }), false);
  assert.equal(Sim.MapView.inside(v, { x: 105, y: 10 }, 10), true);
});

test("VehicleLife.pathLength adds up the segments of a path", () => {
  const len = Sim.VehicleLife.pathLength([
    { fwd: 0, lat: 0 },
    { fwd: 3, lat: 4 },
    { fwd: 3, lat: 6 },
  ]);
  assert.equal(len, 7);
  assert.equal(Sim.VehicleLife.pathLength([{ fwd: 0, lat: 0 }]), 0);
});

test("Vehicle.zoneAt returns the first zone a circle touches, or null", () => {
  const zones = Sim.Vehicle.normalizeZones([
    { x: 0, z: 0, r: 5, say: "near" },
    { x0: 50, x1: 60, z0: 50, z1: 60, say: "far" },
  ]);
  assert.equal(Sim.Vehicle.zoneAt(zones, 1, 1, 0.5).say, "near");
  assert.equal(Sim.Vehicle.zoneAt(zones, 55, 55, 0.5).say, "far");
  assert.equal(Sim.Vehicle.zoneAt(zones, 200, 200, 0.5), null);
});

test("Wardrobe.outfitOf / swatchOf fall back to the default look for an unknown choice", () => {
  const W = Sim.Wardrobe;
  const d = W.DEFAULT;
  assert.equal(W.outfitOf({ wear: "no-such-outfit", tone: "x" }).id, d.wear);
  assert.equal(W.outfitOf({ wear: d.wear, tone: d.tone }).id, d.wear);
  assert.equal(W.swatchOf({ wear: d.wear, tone: d.tone }).id, d.tone);
  assert.equal(typeof W.swatchOf({ wear: "no-such-outfit", tone: "x" }).id, "string");
});

test("a sa'i tracker is armed only once the hero stands at Safa", () => {
  const s = Sim.RitualWalk.createSai({ a: { x: 0, z: -40 }, b: { x: 0, z: 40 }, r: 3, legs: 7 });
  assert.equal(s.armed, false);
  s.feed(0, 0);
  assert.equal(s.armed, false, "mid-lane does not arm it");
  s.feed(0, -40);
  assert.equal(s.armed, true);
});

test("a girl's outfit has no head of its own: the head comes from her hair / hijab choice", () => {
  for (const o of Sim.Hero.GIRL_OUTFITS) assert.equal(o.head(), null, o.id);
});
