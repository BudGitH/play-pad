// Citizens say salaam when their paths cross (pure logic, js/sim/greet.js): who greets, when, how
// often. The game layer only draws the bubbles; every rule that keeps the screen calm is here.
import test from "node:test";
import assert from "node:assert/strict";
import { loadSim, plain } from "./load-sim.mjs";

const { Greet } = loadSim().Sim;
const HERO_AT = { x: 0, z: 0, moving: false };

/** A walking Muslim citizen at x,z heading h (radians; 0 = +z, PI = -z). */
function walker(id, x, z, h, over = {}) {
  return { id, x, z, heading: h, state: "walk", muslim: true, group: id, ...over };
}

/** Two Muslim walkers 2 m apart walking towards each other. */
function meeting(over = {}) {
  return [walker("a", 5, 5, 0, over), walker("b", 7, 5, Math.PI, over)];
}

/** A greeter whose every roll succeeds (chance 1) unless told otherwise. */
function sure(config) {
  const g = Greet.create(() => 0, config);
  return g;
}

test("two Muslim walkers passing within 2.5 m exchange salaam and the reply", () => {
  const g = sure();
  const out = plain(g.update(0, meeting(), HERO_AT));
  assert.equal(out.length, 1);
  assert.equal(out[0].kind, "pair");
  assert.equal(out[0].text, "Assalamualaikum!");
  assert.equal(out[0].replyText, "Waalaikumsalam!");
  assert.ok(out[0].replyAt > out[0].at, "the reply comes a moment after the greeting");
  assert.ok(out[0].until > out[0].replyAt, "the reply shows for a while");
  assert.notEqual(out[0].from, out[0].to);
});

test("walkers further apart than 2.5 m do not greet", () => {
  const g = sure();
  const far = [walker("a", 5, 5, 0), walker("b", 8, 5, Math.PI)];
  assert.equal(g.update(0, far, HERO_AT).length, 0);
});

test("friends walking together (same group) and people walking the same way do not greet", () => {
  const g = sure();
  const friends = [
    walker("a", 5, 5, 0, { group: "p1" }),
    walker("b", 6, 5, Math.PI, { group: "p1" }),
  ];
  assert.equal(g.update(0, friends, HERO_AT).length, 0);
  const sameWay = [walker("c", 5, 5, 0), walker("d", 6.5, 5, 0.2)];
  assert.equal(g.update(1, sameWay, HERO_AT).length, 0);
});

test("a path that crosses at a right angle counts", () => {
  const g = sure();
  const cross = [walker("a", 5, 5, 0), walker("b", 6.5, 5, Math.PI / 2)];
  assert.equal(g.update(0, cross, HERO_AT).length, 1);
});

test("a pair is quiet after greeting: the pair cooldown holds, then lifts", () => {
  const g = sure({ globalGap: 0 });
  assert.equal(g.update(0, meeting(), HERO_AT).length, 1);
  assert.equal(g.update(30, meeting(), HERO_AT).length, 0, "30 s later is too soon");
  assert.equal(g.update(70, meeting(), HERO_AT).length, 1, "after the cooldown they may again");
});

test("a quiet pass (the roll failed) is not re-rolled every poll", () => {
  let draws = 0;
  const g = Greet.create(() => (draws++, 0.99));
  for (let t = 0; t < 5; t += 0.2) g.update(t, meeting(), HERO_AT);
  assert.equal(g.count(), 0);
  assert.equal(draws, 1, "one roll for the whole pass, not one per poll");
});

test("the chance is honoured and can be forced", () => {
  const never = Greet.create(() => 0.6);
  assert.equal(never.update(0, meeting(), HERO_AT).length, 0, "0.6 is above the 0.5 chance");
  const forced = Greet.create(() => 0.6);
  forced.setChance(1);
  assert.equal(forced.update(0, meeting(), HERO_AT).length, 1);
  forced.setChance(null);
  assert.equal(forced.debug().force, null);
});

test("only people within 25 m of the hero greet", () => {
  const g = sure();
  const farAway = [walker("a", 40, 5, 0), walker("b", 42, 5, Math.PI)];
  assert.equal(g.update(0, farAway, HERO_AT).length, 0);
  const closer = [walker("a", 20, 5, 0), walker("b", 22, 5, Math.PI)];
  assert.equal(g.update(1, closer, HERO_AT).length, 1);
});

test("a person who just greeted does not greet the next person at once", () => {
  const g = sure({ globalGap: 0 });
  g.update(0, meeting(), HERO_AT);
  const third = [walker("a", 5, 5, 0), walker("c", 6, 5, Math.PI)];
  assert.equal(g.update(2, third, HERO_AT).length, 0, "a is still busy (12 s)");
  assert.equal(g.update(14, third, HERO_AT).length, 1, "later it is free again");
});

test("global gap: no two greetings within a few seconds, anywhere", () => {
  const g = sure();
  const crowd = [
    walker("a", 5, 5, 0),
    walker("b", 6, 5, Math.PI),
    walker("c", 15, 5, 0),
    walker("d", 16, 5, Math.PI),
  ];
  assert.equal(g.update(0, crowd, HERO_AT).length, 1);
  assert.equal(g.update(1, crowd, HERO_AT).length, 0, "1 s later: still inside the gap");
  assert.equal(g.update(3.2, crowd, HERO_AT).length, 1, "the other pair may go now");
});

test("global cap: at most three greetings are on screen at once", () => {
  const g = sure({ globalGap: 0, personCooldown: 0 });
  let started = 0;
  for (let i = 0; i < 6; i += 1) {
    const pair = [walker("a" + i, 3 * i, 5, 0), walker("b" + i, 3 * i + 1.5, 5, Math.PI)];
    started += g.update(i * 0.2, pair, HERO_AT).length;
  }
  assert.equal(started, 3);
  assert.equal(g.active(1).length, 3);
  assert.equal(g.active(100).length, 0, "they all finish");
  const later = [walker("x", 4, 9, 0), walker("y", 5, 9, Math.PI)];
  assert.equal(g.update(100, later, HERO_AT).length, 1, "and room opens up again");
});

test("non-Muslim walkers say a plain hello, and a mixed pair does too (no salaam)", () => {
  const g = sure({ globalGap: 0 });
  const both = plain(g.update(0, meeting({ muslim: false }), HERO_AT));
  assert.deepEqual([both[0].text, both[0].replyText], ["Hello!", "Hi!"]);
  const mixed = [walker("a", 5, 5, 0), walker("b", 7, 5, Math.PI, { muslim: false })];
  const out = plain(g.update(100, mixed, HERO_AT));
  assert.deepEqual([out[0].text, out[0].replyText], ["Hello!", "Hi!"]);
});

test("a citizen who passes the hero greets the hero, who replies", () => {
  const g = sure();
  const one = [walker("nenek", 2, 0, Math.PI / 2)];
  const out = plain(g.update(0, one, { x: 0, z: 0, moving: true }));
  assert.equal(out.length, 1);
  assert.equal(out[0].kind, "hero");
  assert.equal(out[0].from, "nenek");
  assert.equal(out[0].to, Greet.HERO);
  assert.equal(out[0].text, "Assalamualaikum!");
  assert.equal(out[0].replyText, "Waalaikumsalam!");
});

test("a standing citizen greets a hero who walks past, but not a hero who stands still", () => {
  const g = sure();
  const stander = [walker("atuk", 2, 0, 0, { state: "stand" })];
  assert.equal(g.update(0, stander, { x: 0, z: 0, moving: false }).length, 0);
  assert.equal(g.update(1, stander, { x: 0, z: 0, moving: true }).length, 1);
});

test("a citizen too far from the hero (over 3 m) does not greet the hero", () => {
  const g = sure();
  const out = g.update(0, [walker("nenek", 4, 0, 0)], { x: 0, z: 0, moving: true });
  assert.equal(out.length, 0);
});

test("the same citizen does not greet the hero again for a while", () => {
  const g = sure({ globalGap: 0 });
  const one = [walker("nenek", 2, 0, 0)];
  const hero = { x: 0, z: 0, moving: true };
  assert.equal(g.update(0, one, hero).length, 1);
  assert.equal(g.update(30, one, hero).length, 0);
  assert.equal(g.update(80, one, hero).length, 1);
});

test("a non-Muslim citizen greets the hero with hello, not salaam", () => {
  const g = sure();
  const out = plain(
    g.update(0, [walker("uncle_lim", 2, 0, 0, { muslim: false })], { x: 0, z: 0, moving: true }),
  );
  assert.deepEqual([out[0].text, out[0].replyText], ["Hello!", "Hi!"]);
});

test("reset forgets cooldowns and live greetings", () => {
  const g = sure();
  g.update(0, meeting(), HERO_AT);
  g.reset();
  assert.equal(g.active(0.1).length, 0);
  assert.equal(g.update(0.1, meeting(), HERO_AT).length, 1);
});

test("an empty or lone crowd is safe", () => {
  const g = sure();
  assert.deepEqual(plain(g.update(0, [], HERO_AT)), []);
  assert.deepEqual(plain(g.update(1, [walker("a", 10, 10, 0)], HERO_AT)), []);
});
