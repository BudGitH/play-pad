// The ambient soundscape's pure mix maths (js/sim/ambience-mix.js): given prayer times and town
// rectangles, how loud is each layer at a clock minute and a hero position. No audio involved.
import test from "node:test";
import assert from "node:assert/strict";
import { loadSim, plain, mins } from "./load-sim.mjs";

const Mix = loadSim().Sim.AmbienceMix;

/** Fixture times (not the real MUIS ones): Subuh 05:00, sunrise 06:30, Maghrib 19:00. */
const TIMES = { subuh: "05:00", syuruk: "06:30", maghrib: "19:00" };
/** Fixture town: hawker and park far apart; the mosque hall inside the mosque compound. */
const RECTS = {
  hawker: { x0: 100, x1: 120, z0: 100, z1: 120 },
  park: { x0: -120, x1: -100, z0: 100, z1: 120 },
  mosque: { x0: 100, x1: 140, z0: -140, z1: -100, hall: { x0: 105, x1: 125, z0: -135, z1: -110 } },
};
const NOON = 12 * 60;
const mixAt = (minute, x, z) => Mix.mixFor(minute, x, z, TIMES, RECTS);

test("toMin parses HH:MM and treats junk as 0", () => {
  assert.equal(Mix.toMin("05:29"), 329);
  assert.equal(Mix.toMin("9:05"), 545);
  assert.equal(Mix.toMin("nope"), 0);
  assert.equal(Mix.toMin(undefined), 0);
});

test("ramp, prox, bump and rectDist behave", () => {
  assert.equal(Mix.ramp(0, 1, 2), 0);
  assert.equal(Mix.ramp(3, 1, 2), 1);
  assert.equal(Mix.ramp(1.5, 1, 2), 0.5);
  assert.equal(Mix.prox(0, 2, 10), 1);
  assert.equal(Mix.prox(20, 2, 10), 0);
  assert.equal(Mix.bump(480, 480, 70), 1);
  assert.equal(Mix.bump(700, 480, 70), 0);
  const r = { x0: 0, x1: 10, z0: 0, z1: 10 };
  assert.equal(Mix.rectDist(r, 5, 5), 0);
  assert.equal(Mix.rectDist(r, 13, 14), 5);
});

test("birds by day, crickets from just before Maghrib to Subuh", () => {
  const home = [0, 0];
  const noon = mixAt(NOON, ...home);
  assert.ok(noon.birds > 0.6);
  assert.equal(noon.crickets, 0);
  const dusk = mixAt(mins("19:30"), ...home);
  assert.ok(dusk.crickets > 0.6);
  assert.equal(dusk.birds, 0);
  const late = mixAt(120, ...home);
  assert.ok(late.crickets > 0.6);
  assert.equal(late.birds, 0);
  assert.ok(late.traffic < noon.traffic, "quieter road at night");
  const dawn = mixAt(mins("06:45"), ...home); // after Subuh, around Syuruk
  assert.equal(dawn.crickets, 0);
  assert.ok(dawn.birds > 0);
});

test("the day follows the times it is given, not built-in ones", () => {
  const late = { subuh: "07:00", syuruk: "08:30", maghrib: "21:00" };
  const m = mins("06:00");
  assert.equal(Mix.mixFor(m, 0, 0, late, RECTS).birds, 0, "before this Subuh: no birds");
  assert.ok(Mix.mixFor(m, 0, 0, TIMES, RECTS).birds > 0.3, "after the fixture Subuh: birds");
});

test("the minute wraps (negative and over 24 h read as the same clock time)", () => {
  assert.deepEqual(plain(mixAt(-1440 + NOON, 0, 0)), plain(mixAt(NOON, 0, 0)));
  assert.deepEqual(plain(mixAt(1440 + NOON, 0, 0)), plain(mixAt(NOON, 0, 0)));
});

test("hawker murmur near the hawker centre while it is open, none when far or shut", () => {
  assert.ok(mixAt(NOON, 110, 110).murmur > 0.8);
  assert.equal(mixAt(NOON, 0, 0).murmur, 0);
  assert.ok(mixAt(23.5 * 60, 110, 110).murmur < 0.2);
});

test("the mosque hall is muffled, carpeted and quieter than outside", () => {
  const hall = mixAt(NOON, 115, -120);
  assert.equal(hall.indoor, 1);
  assert.ok(hall.master < 0.6);
  assert.equal(hall.surface, "carpet");
  assert.equal(hall.murmur, 0, "no hawker chatter inside the hall");
  const yard = mixAt(NOON, 130, -105); // inside the compound, outside the hall
  assert.equal(yard.indoor, 0);
  assert.ok(yard.traffic < mixAt(NOON, 130, 20).traffic * 1.01, "the compound is calmer");
});

test("the park is grass; everywhere else is paving", () => {
  assert.equal(mixAt(NOON, -110, 110).surface, "grass");
  assert.equal(mixAt(NOON, 0, 0).surface, "paving");
});

test("every level stays within 0..1.3 (a finite, sane mix) across the day and the town", () => {
  for (let m = 0; m < 1440; m += 37) {
    for (const [x, z] of [
      [0, 0],
      [110, 110],
      [-110, 110],
      [115, -120],
      [300, -300],
    ]) {
      const mix = mixAt(m, x, z);
      for (const k of [
        "traffic",
        "wind",
        "leaves",
        "murmur",
        "crickets",
        "birds",
        "clink",
        "indoor",
        "master",
      ]) {
        assert.ok(
          Number.isFinite(mix[k]) && mix[k] >= 0 && mix[k] <= 1.3,
          `${k} at ${m},${x},${z}`,
        );
      }
    }
  }
});
