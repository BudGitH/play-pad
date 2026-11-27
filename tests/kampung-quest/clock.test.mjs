// AC-6: the 48-minute day, rollover, day count, day/night phase and sun factor.
import test from "node:test";
import assert from "node:assert/strict";
import { loadSim, FIXTURE_TIMES, mins } from "./load-sim.mjs";

const KQ = loadSim();
const Clock = KQ.Sim.Clock;

test("a new clock starts at 07:00 on day 1", () => {
  const clock = Clock.create();
  assert.equal(clock.hhmm(), "07:00");
  assert.equal(clock.day, 1);
});

test("1 game minute = 2 real seconds, so 48 real minutes = 1 game day", () => {
  const clock = Clock.create({ startMin: 0 });
  clock.tick(2);
  assert.equal(clock.minute, 1);
  clock.tick(48 * 60 - 2);
  assert.equal(clock.day, 2);
  assert.ok(clock.minute < 1e-9);
});

test("rollover at midnight increments the day and keeps the remainder", () => {
  const clock = Clock.create({ startMin: 1439 });
  clock.tick(3);
  assert.equal(clock.day, 2);
  assert.equal(clock.hhmm(), "00:00");
  assert.ok(Math.abs(clock.minute - 0.5) < 1e-9);
});

test("a huge tick rolls over several days", () => {
  const clock = Clock.create({ startMin: 420 });
  clock.tick(3 * 48 * 60);
  assert.equal(clock.day, 4);
  assert.equal(clock.hhmm(), "07:00");
});

test("custom realSecPerGameMin and ignored bad dt values", () => {
  const clock = Clock.create({ startMin: 0, realSecPerGameMin: 1 });
  clock.tick(10);
  assert.equal(clock.minute, 10);
  for (const bad of [-5, NaN, Infinity, undefined, "3"]) clock.tick(bad);
  assert.equal(clock.minute, 10);
});

test("set() wraps and rejects non-finite values; absMinute spans days", () => {
  const clock = Clock.create();
  clock.set(1500);
  assert.equal(clock.minute, 60);
  clock.set(NaN);
  assert.equal(clock.minute, 60);
  clock.set(-60);
  assert.equal(clock.hhmm(), "23:00");
  clock.day = 3;
  assert.equal(clock.absMinute(), 2 * 1440 + 1380);
});

test("hhmm() pads and floors", () => {
  const clock = Clock.create({ startMin: 5 * 60 + 9.9 });
  assert.equal(clock.hhmm(), "05:09");
});

test("phase() follows syuruk / maghrib from the prayer times", () => {
  const clock = Clock.create({ times: FIXTURE_TIMES });
  const at = (hhmm) => {
    clock.set(mins(hhmm));
    return clock.phase();
  };
  assert.equal(at("03:00"), "night");
  assert.equal(at("06:30"), "dawn");
  assert.equal(at("12:00"), "day");
  assert.equal(at("19:00"), "dusk");
  assert.equal(at("22:00"), "night");
});

test("sunFactor() is ~0 at night, 1 at midday, 0.5 at syuruk and maghrib", () => {
  const clock = Clock.create({ times: FIXTURE_TIMES });
  const at = (hhmm) => {
    clock.set(mins(hhmm));
    return clock.sunFactor();
  };
  assert.equal(at("02:00"), 0);
  assert.equal(at("12:00"), 1);
  assert.ok(Math.abs(at("06:30") - 0.5) < 1e-9);
  assert.ok(Math.abs(at("19:00") - 0.5) < 1e-9);
  assert.equal(at("23:59"), 0);
});

test("sunFactor() stays within 0..1 and is continuous across the whole day", () => {
  const clock = Clock.create({ times: FIXTURE_TIMES });
  let previous = null;
  for (let minute = 0; minute < 1440; minute += 1) {
    clock.set(minute);
    const value = clock.sunFactor();
    assert.ok(value >= 0 && value <= 1);
    if (previous !== null) assert.ok(Math.abs(value - previous) < 0.1);
    previous = value;
  }
});

test("without times the clock falls back to 07:00 sunrise / 19:00 sunset; setTimes() updates", () => {
  const clock = Clock.create();
  clock.set(mins("07:00"));
  assert.ok(Math.abs(clock.sunFactor() - 0.5) < 1e-9);
  clock.setTimes(FIXTURE_TIMES);
  assert.ok(clock.sunFactor() > 0.99);
  clock.setTimes({ syuruk: "bad", maghrib: null });
  assert.ok(Math.abs(clock.sunFactor() - 0.5) < 1e-9);
});

test("parseHHMM accepts valid times and rejects junk", () => {
  assert.equal(Clock.parseHHMM("05:41"), 341);
  assert.equal(Clock.parseHHMM("0:00"), 0);
  for (const bad of ["24:00", "12:60", "abc", "", null, undefined, "1:2", 530]) {
    assert.ok(Number.isNaN(Clock.parseHHMM(bad)), String(bad));
  }
});

test("the clock is deterministic: same ticks, same time", () => {
  const a = Clock.create();
  const b = Clock.create();
  for (let i = 0; i < 500; i += 1) {
    a.tick(0.37);
    b.tick(0.37);
  }
  assert.equal(a.minute, b.minute);
  assert.equal(a.day, b.day);
});

test("dayTimeLabel gives the title's Continue text and clamps a hostile saved day or minute", () => {
  assert.equal(Clock.dayTimeLabel(1, 13 * 60 + 23.7), "day 1, 13:23");
  assert.equal(Clock.dayTimeLabel(3, 0), "day 3, 00:00");
  assert.equal(Clock.dayTimeLabel(2, 1439), "day 2, 23:59");
  assert.equal(Clock.dayTimeLabel(0, -5), "day 1, 00:00");
  assert.equal(Clock.dayTimeLabel("x", 1e9), "day 1, 23:59");
  assert.equal(Clock.dayTimeLabel(NaN, NaN), "day 1, 00:00");
});
