// The prayer / wudu camera shots (js/game/shots.js): three views per step, the right opening view for
// each posture, and frames that sit where they say (behind, in front of, beside the hero).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const sandbox = {};
sandbox.window = sandbox;
vm.createContext(sandbox);
const file = path.resolve(import.meta.dirname, "../../games/kampung-quest/js/game/shots.js");
vm.runInContext(fs.readFileSync(file, "utf8"), sandbox, { filename: "shots.js" });
const Shots = sandbox.KQ.Game.Shots;

test("each step offers three different views, the opening one first", () => {
  for (const kind of [
    "takbir",
    "qiyam",
    "ruku",
    "sujud",
    "julus",
    "tasyahud_akhir",
    "salam_r",
    "wudu_hands",
    "wudu_idle",
  ]) {
    const v = Array.from(Shots.views(kind));
    assert.equal(v.length, 3, kind);
    assert.equal(new Set(v).size, 3, kind + " views are distinct");
  }
});

test("front for the standing postures and tashahhud, side for ruku and sujud, a close-up for wudu", () => {
  const first = (kind) => Shots.views(kind)[0];
  assert.equal(first("qiyam"), "front");
  assert.equal(first("takbir"), "front");
  assert.equal(first("tasyahud_awal"), "front");
  assert.equal(first("tasyahud_akhir"), "front");
  assert.equal(first("ruku"), "side");
  assert.equal(first("sujud"), "side");
  assert.equal(first("wudu_hands"), "close");
  assert.equal(first("wudu_feet"), "close");
  assert.deepEqual(Array.from(Shots.views("wudu_face")), ["close", "side", "behind"]);
});

test("frames: behind looks along the hero's heading, front looks back at the hero, side is a quarter turn", () => {
  const spot = { x: 3, y: 0, z: -4, heading: 1 };
  const behind = Shots.frame("behind", spot, "qiyam");
  const front = Shots.frame("front", spot, "qiyam");
  const side = Shots.frame("side", spot, "ruku");
  const close = Shots.frame("close", spot, "wudu_hands");
  assert.ok(Math.abs(behind.yaw - spot.heading) < 0.8, "from behind (a little to one side)");
  assert.ok(Math.abs(front.yaw - (spot.heading + Math.PI)) < 0.3, "from the front");
  assert.ok(Math.abs(side.yaw - (spot.heading + Math.PI / 2)) < 1e-9, "from the side");
  assert.ok(close.dist < front.dist && close.dist < side.dist, "the close-up is the nearest shot");
  for (const f of [behind, front, side, close]) {
    assert.deepEqual({ ...f.target }, { x: 3, y: 0, z: -4 });
    assert.ok(f.rate > 0 && f.dist > 1 && f.pitch >= 0);
  }
});

test("low postures look at the middle of the hero, not their head", () => {
  const spot = { x: 0, y: 0, z: 0, heading: 0 };
  assert.ok(Shots.frame("side", spot, "sujud").lift < Shots.frame("front", spot, "qiyam").lift);
});
