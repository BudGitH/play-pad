// "Say hi" (pure, js/sim/hi.js): the words by age and faith, a kid who greets first, and the tally
// that pays a tiny, capped reward for friendly hellos.
import test from "node:test";
import assert from "node:assert/strict";
import { loadSim, plain } from "./load-sim.mjs";

const { Hi } = loadSim().Sim;
const first = () => 0;

test("a Muslim person gets the salaam and answers with the reply; others get a plain hello", () => {
  const m = Hi.say({ muslim: true, age: "adult" }, first);
  assert.equal(m.hero, "Assalamualaikum!");
  assert.match(m.reply, /^Waalaikumsalam!/);
  const o = Hi.say({ muslim: false, age: "adult" }, first);
  assert.equal(o.hero, "Hello!");
  assert.doesNotMatch(o.reply, /salam/i);
});

test("replies vary by age: kids ask to play, grown-ups are friendly", () => {
  const seen = { kid: new Set(), adult: new Set(), elder: new Set(), teen: new Set() };
  for (let i = 0; i < 50; i += 1) {
    const r = () => (i % 10) / 10;
    for (const age of Object.keys(seen)) {
      seen[age].add(Hi.say({ muslim: i % 2 === 0, kid: age === "kid", age }, r).reply);
    }
  }
  for (const age of Object.keys(seen)) assert.ok(seen[age].size >= 3, age + " has variety");
  const kid = [...seen.kid].join("|");
  assert.match(kid, /Wanna play\?/);
  assert.match(kid, /Nice cap!/);
  assert.equal(Hi.say({ kid: true, muslim: false }, first).band, "kid");
  assert.equal(Hi.say(null, first).band, "adult");
});

test("a non-Muslim person is never made to say a salaam, whatever the roll", () => {
  for (let i = 0; i < 40; i += 1) {
    const r = () => i / 40;
    for (const age of ["kid", "teen", "adult", "elder"]) {
      const s = Hi.say({ muslim: false, age, kid: age === "kid" }, r);
      assert.doesNotMatch(s.hero + s.reply, /salam|Waalaikum|Terima/i, age);
      const k = Hi.kidFirst({ muslim: false }, r);
      assert.doesNotMatch(k.kid + k.hero, /salam|Waalaikum/i);
    }
  }
});

test("a kid who greets first: Muslim kids say the salaam and the hero's bubble is the reply", () => {
  const k = plain(Hi.kidFirst({ muslim: true }, first));
  assert.deepEqual(k, { kid: "Assalamualaikum!", hero: "Waalaikumsalam!" });
  const o = plain(Hi.kidFirst({ muslim: false }, first));
  assert.equal(o.hero, "Hi!");
  assert.ok(o.kid.length > 3);
});

test("every line is short enough for a bubble and child-friendly", () => {
  for (let i = 0; i < 100; i += 1) {
    const r = () => (i % 10) / 10 + 0.01;
    for (const age of ["kid", "teen", "adult", "elder"]) {
      for (const muslim of [true, false]) {
        const s = Hi.say({ muslim, age, kid: age === "kid" }, r);
        assert.ok(s.reply.length <= 48, s.reply);
        assert.doesNotMatch(s.reply, /\b(go away|shut|stupid|idiot|hate)\b/i);
      }
    }
  }
});

test("the tally pays a coin every 5 hellos, at most 6 times, and a sticker once at 10", () => {
  const t = Hi.createTally();
  let coins = 0;
  const stickers = [];
  for (let i = 1; i <= 60; i += 1) {
    const r = t.note();
    coins += r.coins;
    if (r.sticker) stickers.push([i, r.sticker]);
    if (i < 5) assert.equal(r.coins, 0);
  }
  assert.equal(coins, 6, "capped");
  assert.deepEqual(stickers, [[10, "sticker_friendly"]]);
  assert.equal(t.count(), 60);
  t.reset();
  assert.equal(t.count(), 0);
  assert.equal(t.note().count, 1);
});
