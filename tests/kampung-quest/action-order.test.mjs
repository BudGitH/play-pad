// The chooser's order (pure, js/sim/actions.js): mission business first, then an owed prayer, then
// the nearest; Say hi and the "tired" Rest last; duplicates collapse; at most three tiles.
import test from "node:test";
import assert from "node:assert/strict";
import { loadSim } from "./load-sim.mjs";

const { Actions, Needs } = loadSim().Sim;
const t = (id, kind, dist, extra) =>
  Object.assign({ id, kind, label: id, dist, enabled: true }, extra);
const ids = (list) => list.map((x) => x.id);

test("the nearest action is first; ties keep the order they were given", () => {
  const out = Actions.arrange([t("far", "obj", 2), t("near", "obj", 0.5), t("tie", "obj", 0.5)]);
  assert.deepEqual(ids(out), ["near", "tie", "far"]);
});

test("mission business (a step, or a neighbour who wants to talk) beats a nearer counter", () => {
  const counter = t("counter", "obj", 0.4);
  const talk = t("nenek", "npc", 2, { rank: Actions.RANK.business });
  const photo = t("photo", "step", 2.2);
  assert.deepEqual(ids(Actions.arrange([counter, talk, photo])), ["nenek", "photo", "counter"]);
});

test("an owed prayer comes after mission business but before everything else", () => {
  const pray = t("prayer_spot", "obj", 1.5, { rank: Actions.RANK.prayer });
  const out = Actions.arrange([t("cart", "event", 0.3), pray, t("nenek", "npc", 1, { rank: 0 })]);
  assert.deepEqual(ids(out), ["nenek", "prayer_spot", "cart"]);
});

test("a neighbour with no business does not silently beat the ice-cream cart or a counter", () => {
  const out = Actions.arrange([
    t("neighbour", "npc", 1.9),
    t("cart", "event", 1.2),
    t("counter", "obj", 1.6),
  ]);
  assert.deepEqual(
    ids(out),
    ["cart", "counter", "neighbour"],
    "all three are offered, nearest first",
  );
});

test("the mosque hall's Pray fallback never outranks a neighbour with mission business, nor hides one who can be talked to", () => {
  const pray = t("prayer_spot", "obj", 0.5, { fallback: true });
  const business = t("nenek", "npc", 6, { rank: Actions.RANK.business });
  assert.deepEqual(ids(Actions.arrange([pray, business])), ["nenek", "prayer_spot"]);
  const chat = t("uncle", "npc", 2);
  assert.deepEqual(
    ids(Actions.arrange([pray, chat])).sort(),
    ["prayer_spot", "uncle"],
    "both are offered",
  );
  assert.deepEqual(ids(Actions.arrange([pray, t("far", "npc", 4, { enabled: false })])), [
    "prayer_spot",
  ]);
  assert.deepEqual(ids(Actions.arrange([null, pray])), ["prayer_spot"]);
  assert.deepEqual(Actions.arrange([]), [], "nothing in reach: no action");
});

test("Say hi and the tired Rest come last, even when they are nearest", () => {
  const out = Actions.arrange([
    t("hi", "hi", 0.2),
    t("rest", "rest", 0, { rank: Actions.RANK.tired }),
    t("counter", "obj", 2.3),
  ]);
  assert.deepEqual(ids(out), ["counter", "hi", "rest"]);
});

test("duplicates of the same action collapse to the nearest one", () => {
  const out = Actions.arrange([
    t("kidB", "hi", 2, { label: "Say hi", key: "say-hi" }),
    t("kidA", "hi", 1, { label: "Say hi", key: "say-hi" }),
    t("can1", "item", 1.5, { label: "Pick up", key: "pickup" }),
    t("can2", "item", 1.4, { label: "Pick up", key: "pickup" }),
  ]);
  assert.deepEqual(ids(out), ["can2", "kidA"]);
});

test("at most three tiles; disabled and empty candidates are dropped", () => {
  const list = [t("a", "obj", 1), t("b", "obj", 2), t("c", "obj", 3), t("d", "obj", 4)];
  assert.equal(Actions.arrange(list).length, 3);
  assert.equal(Actions.arrange(list, 2).length, 2);
  assert.equal(Actions.arrange(list, 0).length, 3, "a bad cap falls back to three");
  assert.deepEqual(
    ids(Actions.arrange([null, t("x", "npc", 1, { enabled: false }), t("y", "obj", 1)])),
    ["y"],
  );
  assert.equal(Actions.arrange(null).length, 0);
});

test("Needs.canRest is false only at (nearly) full energy", () => {
  const n = Needs.create({ energy: 100 });
  assert.equal(n.canRest(), false);
  const tired = Needs.create({ energy: 20 });
  assert.equal(tired.canRest(), true);
  assert.equal(tired.isTired(), true);
  assert.equal(Needs.create({ energy: 94 }).canRest(), true);
});
