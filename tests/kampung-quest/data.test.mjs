// Q-07: the SHIPPED data files (js/data/prayer-times.js, azan.js) load and are sane. The other tests
// use a labelled fixture; this one proves the real MUIS values pass Prayer.create (which throws on
// out-of-order times and would white-screen the game at boot) and that the azan cues are well formed.
import test from "node:test";
import assert from "node:assert/strict";
import { loadSimWithData, plain, mins } from "./load-sim.mjs";

const KQ = loadSimWithData();
const ORDER = ["subuh", "syuruk", "zohor", "asar", "maghrib", "isyak"];
const times = plain(KQ.PRAYER_TIMES);
const cues = plain(KQ.AZAN_TEXT);

test("the real prayer times are HH:MM strings in strictly increasing order", () => {
  for (const name of ORDER) assert.match(times[name], /^\d{2}:\d{2}$/, name);
  for (let i = 1; i < ORDER.length; i += 1) {
    assert.ok(
      mins(times[ORDER[i]]) > mins(times[ORDER[i - 1]]),
      `${ORDER[i]} after ${ORDER[i - 1]}`,
    );
  }
  assert.ok(times.source && times.date, "the source and date are cited");
});

test("the real prayer times pass Prayer.create and Clock.create without throwing", () => {
  assert.doesNotThrow(() => KQ.Sim.Prayer.create(KQ.PRAYER_TIMES));
  assert.doesNotThrow(() => KQ.Sim.Clock.create({ times: KQ.PRAYER_TIMES }));
});

test("with the real times, a whole day yields each prayer once, in order, with sane windows", () => {
  const prayer = KQ.Sim.Prayer.create(KQ.PRAYER_TIMES);
  prayer.update(mins(times.subuh) - 30, 1);
  const due = [];
  for (let m = mins(times.subuh) - 29; m <= 1439; m += 1) {
    prayer
      .update(m, 1)
      .filter((e) => e.type === "due")
      .forEach((e) => due.push(e.name));
  }
  assert.deepEqual(due, ["subuh", "zohor", "asar", "maghrib", "isyak"]);
  const state = plain(prayer.state());
  assert.equal(state.prayers.length, 5);
  assert.deepEqual(
    state.prayers.map((p) => p.time),
    ["subuh", "zohor", "asar", "maghrib", "isyak"].map((n) => times[n]),
  );
});

test("the real times drive the sun: sunrise = Syuruk, sunset = Maghrib", () => {
  const clock = KQ.Sim.Clock.create({ times: KQ.PRAYER_TIMES });
  clock.set(mins(times.zohor));
  assert.equal(clock.phase(), "day");
  clock.set(mins(times.maghrib) + 90);
  assert.equal(clock.phase(), "night");
});

test("azan caption cues are non-empty, [start, end]-ordered and monotonic", () => {
  assert.ok(cues.length >= 8, "a full azan has at least eight cue lines");
  let last = -Infinity;
  for (const cue of cues) {
    for (const key of ["ar", "translit", "en"]) {
      assert.equal(typeof cue[key], "string", key);
      assert.ok(cue[key].trim().length > 2, `${key} is non-empty`);
    }
    if (cue.subuhOnly) {
      assert.equal(cue.start, null);
      assert.equal(cue.end, null);
      continue;
    }
    assert.ok(Number.isFinite(cue.start) && Number.isFinite(cue.end));
    assert.ok(cue.start >= 0 && cue.end > cue.start, "end after start");
    assert.ok(cue.start >= last, "cues do not overlap or go back in time");
    last = cue.end;
  }
});

test("exactly one Subuh-only caption exists and it has no audio times", () => {
  assert.equal(cues.filter((c) => c.subuhOnly).length, 1);
});
