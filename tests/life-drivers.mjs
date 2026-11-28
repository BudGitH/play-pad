// Browser-side drivers for the "life" specs (say hi, world events, the new missions).
// Every function here runs INSIDE the game page (page.evaluate); they call each other as page
// globals, which installHelpers() puts there. Keep each one short: the lint rules apply to tests.
import { expect } from "@playwright/test";

const GAME = "/games/kampung-quest/index.html";

/** Boot the game (optionally with a query), press Start, and install the helpers. */
export async function boot(page, query = "?still=1&autoq=0&q=low") {
  await page.goto(GAME + query);
  await expect.poll(() => page.evaluate(() => window.__kq?.loaded), { timeout: 90_000 }).toBe(true);
  await page.locator("#kq button.primary").first().click();
  await expect.poll(() => page.evaluate(() => window.__kq.ready), { timeout: 30_000 }).toBe(true);
  await installHelpers(page);
}

/** Run `secs` of game time in 0.1 s frames without drawing (fast). */
export function run(secs) {
  const G = window.KQ.Game;
  for (let t = 0; t < secs; t += 0.1) G.Loop.frame(0.1, true);
}

/** The crowd extras that can be greeted and are away from the cast, nearest to the hero first. */
export function greetable() {
  const G = window.KQ.Game;
  const hero = G.S.player.pos;
  const far = (m) => G.S.npcs.agents.every((a) => a.hidden || Math.hypot(a.x - m.x, a.z - m.z) > 6);
  const dist = (m) => Math.hypot(m.x - hero.x, m.z - hero.z);
  return G.S.crowd.members
    .filter((m) => !m.leaving && !m.slot.sit && m.show > 0.9 && (m.walker || m.mode === "rest"))
    .filter(far)
    .sort((a, b) => dist(a) - dist(b));
}

/** Stand 1.4 m from a crowd member (by id) facing them and press interact. */
export function sayHiTo(id) {
  const G = window.KQ.Game;
  const k = window.__kq;
  const m = G.S.crowd.byId.get(id);
  const spot = G.Collide.freeSpot(G.S.world.colliders, m.x + 1.4, m.z, 0.4);
  k.place(spot.x, spot.z, Math.atan2(m.x - spot.x, m.z - spot.z));
  window.run(0.3);
  const target = k.state().target;
  // only press when the prompt really is "Say hi": a shop counter in reach would open its menu instead
  const ok = Boolean(target && target.kind === "hi") && k.interact();
  return { target, ok, hi: k.hi() };
}

/** Make `run`, `greetable` and `sayHiTo` available to the scenarios as page globals. */
export async function installHelpers(page) {
  const defs = [run, greetable, sayHiTo].map((f) => String(f).replace("export ", ""));
  await page.addScriptTag({ content: defs.join("\n") });
}

/* ------------------------------ say hi ------------------------------ */

/** Say hi to a kid at the playground: the prompt, the two bubbles, the wave and its end. */
export function sayHiScenario() {
  const k = window.__kq;
  const G = window.KQ.Game;
  k.setMinute(600);
  k.teleport("playground");
  run(2);
  const list = greetable();
  const out = sayHiTo((list.find((x) => x.kid) || list[0]).id);
  const greeted = G.S.crowd.byId.get(out.hi.last.id); // the nearest person in reach is greeted
  out.muslim = greeted.outfit.group === "malay";
  run(1.5);
  out.showing = k.greetings().showing;
  const live = [...document.querySelectorAll(".kq-greet")].filter((e) => !e.hidden);
  out.dom = live.map((e) => e.textContent);
  out.waving = G.S.crowd.members.filter((x) => x.waveT > 0).map((x) => [x.id, x.pose]);
  out.id = out.hi.last.id;
  run(6);
  out.after = G.S.crowd.members.filter((x) => x.waveT > 0).length;
  return out;
}

/** The hero's wave lock must not free a hold that a prayer or rite took meanwhile; a wave never starts on top of a hold. */
export function waveLockScenario() {
  const k = window.__kq;
  const G = window.KQ.Game;
  const P = G.S.player;
  k.setMinute(600);
  k.teleport("playground");
  run(2);
  const out = {};
  sayHiTo(greetable()[0].id);
  out.waving = P.locked && P.forcedPose === "wave";
  G.Player.lock(P, null, "sit"); // a rite takes the hero during the wave
  run(2); // the 1.3 s wave timer runs out
  out.heldAfter = P.locked && P.forcedPose === "sit";
  G.Player.release(P); // the rite ends
  out.freed = !P.locked;
  G.Player.lock(P, null, "sit");
  run(2.5);
  sayHiTo(greetable()[0].id);
  out.noWaveOnHold = P.forcedPose === "sit";
  G.Player.release(P);
  return out;
}

/** Bring cast neighbour `id` next to the hero, standing free in daylight, and report the chooser. */
export function castStage(id) {
  const k = window.__kq;
  const G = window.KQ.Game;
  k.greetChance(0); // only the hello under test shows a bubble
  G.UI.closeSheet("test");
  k.setMinute(600);
  k.teleport("playground");
  run(2);
  const A = G.S.npcs.byId[id];
  const hero = G.S.player.pos;
  A.hidden = false;
  A.show = 1;
  A.group.visible = true;
  A.path = [];
  A.idleT = 999; // a free neighbour who stays put
  A.goal = { kind: "wander", x: hero.x + 1.3, z: hero.z };
  A.x = A.goal.x;
  A.z = A.goal.z;
  k.place(hero.x, hero.z, Math.PI / 2);
  run(0.3);
  return {
    labels: k.state().targets.map((t) => t.label),
    kinds: k.state().targets.map((t) => t.kind),
  };
}

/** What a cast hello left behind after `secs` of game time: bubbles, the pose, the dialogue, the tally. */
export function castAfter([id, secs]) {
  const k = window.__kq;
  const G = window.KQ.Game;
  run(0.5);
  const heroPose = G.S.player.forcedPose; // the hero's own wave is short (1.3 s)
  run(secs - 0.5);
  return {
    showing: k.greetings().showing,
    pose: k.npc(id).pose,
    talking: G.S.npcs.byId[id].talking,
    modal: G.UI.modalOpen(),
    dialogue: document.querySelectorAll(".kq-bubble").length,
    hi: k.hi(),
    heroPose,
  };
}

/** The playground's happy pose and the dates pose are timed holds: neither frees a later hold, and neither starts on one. */
export function happyLockScenario() {
  const k = window.__kq;
  const G = window.KQ.Game;
  const P = G.S.player;
  k.setMinute(600);
  k.teleport("playground");
  run(2);
  const out = {};
  G.Services.play(); // a wave for 2 s
  out.waving = P.locked && P.forcedPose === "wave";
  G.Player.lock(P, null, "sit"); // a rite takes the hero during the wave
  run(3); // the 2 s timer runs out
  out.heldAfter = P.locked && P.forcedPose === "sit";
  out.noStart = G.Player.lockFor(P, 1, "eat") === false && P.forcedPose === "sit";
  G.Player.release(P);
  out.freed = !P.locked;
  out.started = G.Player.lockFor(P, 1, "eat") === true && P.forcedPose === "eat";
  run(2);
  out.ended = !P.locked && P.forcedPose === null;
  return out;
}

/** Greet one person of each kind at the hawker centre and report what the hero said and heard. */
export function salaamRuleScenario() {
  const k = window.__kq;
  const G = window.KQ.Game;
  k.setMinute(600);
  k.teleport("hawker");
  run(4);
  const seen = [];
  const groups = new Set();
  for (const m of greetable().slice(0, 14)) {
    const key = m.outfit.group + m.kid;
    if (groups.has(key) || !G.S.crowd.byId.get(m.id)) continue;
    groups.add(key);
    run(2); // the gap between hellos
    const before = k.hi().count;
    sayHiTo(m.id);
    const said = k.hi().last;
    // judge the rule by the person actually greeted (a nearer neighbour may answer instead), and only new hellos
    const who = said && k.hi().count > before && G.S.crowd.byId.get(said.id);
    if (who) seen.push({ group: who.outfit.group, muslim: who.outfit.group === "malay", said });
  }
  return seen;
}

/** Force the kids' chance to 1 near the playground and wait for one to call out first. */
export function kidFirstScenario() {
  const k = window.__kq;
  k.setMinute(600);
  k.teleport("playground");
  run(2);
  const before = k.hi().count;
  k.kidChance(1);
  let called = null;
  for (let i = 0; i < 60 && !called; i += 1) {
    run(1);
    if (k.hi().last && k.hi().last.first) called = k.hi().last;
  }
  k.kidChance(0);
  return { before, called, count: k.hi().count, shown: k.greetings().showing };
}

/* ------------------------------ events ------------------------------ */

/** Start the football, try a second event, kick the ball, and read the state. */
export function footballStartScenario() {
  const k = window.__kq;
  const G = window.KQ.Game;
  const out = {};
  k.setMinute(600);
  k.teleport("playground");
  run(1);
  window.__scene0 = G.S.scene.children.length;
  out.forced = k.forceEvent("football");
  out.second = k.forceEvent("rain"); // one at a time
  run(3);
  const d = k.events();
  Object.assign(out, { running: d.running, id: d.id, actors: d.actors, chip: k.lifeChip() });
  out.blip = G.MapMarkers.build(G.S).some((m) => m.kind === "event");
  const b = d.info.ball; // kick it: walk the hero into the ball
  k.place(b.x - 0.5, b.z, Math.PI / 2);
  for (let i = 0; i < 12; i += 1) G.Loop.frame(0.05, true);
  out.kicks = k.events().info.kicks;
  return out;
}

/** Let the football end, then run it again, and compare what is left in the scene. */
export function footballTidyScenario() {
  const k = window.__kq;
  const G = window.KQ.Game;
  const out = {};
  for (let s = 0; s < 90 && k.events().running; s += 1) run(1);
  run(4);
  const e = k.events();
  out.ended = { running: e.running, actors: e.actors, meshes: e.meshes, id: e.id };
  out.chipAfter = k.lifeChip();
  out.leak = G.S.scene.children.length - window.__scene0;
  k.forceEvent("football");
  run(80);
  run(4);
  out.leak2 = G.S.scene.children.length - window.__scene0 - out.leak;
  return out;
}

/** Wait for the ice-cream cart to arrive, stand by it, and press the prompt. */
export function iceCreamScenario() {
  const k = window.__kq;
  const out = {};
  k.setMinute(660);
  k.teleport("playground");
  run(1);
  k.stopEvent();
  k.forceEvent("icecream");
  for (let s = 0; s < 40 && !(k.events().info && k.events().info.phase === "serve"); s += 1) run(1);
  out.phase = k.events().info.phase;
  const cart = k.events().info.cart; // the event reports where its cart stands
  // stand on a side of the cart where its own prompt shows (a neighbour beside it can win the Talk button)
  for (const [dx, dz] of [
    [0, -2],
    [0, 2],
    [-2, 0],
    [2, 0],
  ]) {
    k.place(cart.x + dx, cart.z + dz, Math.atan2(-dx, -dz));
    run(0.4);
    out.target = k.state().target;
    if (out.target && out.target.kind === "event") break;
  }
  const coins = k.state().coins;
  k.interact();
  run(0.5);
  out.coins = [coins, k.state().coins];
  k.stopEvent();
  return out;
}

/** A wedding procession is running; then a prayer falls due. */
export function prayerScenario() {
  const k = window.__kq;
  const out = {};
  k.setMinute(600);
  k.teleport("playground");
  run(1);
  k.stopEvent();
  out.running = k.forceEvent("kompang");
  run(1);
  out.beforePrayer = k.events().running;
  k.forcePrayer("zohor");
  run(1);
  out.afterPrayer = { running: k.events().running, last: k.events().last };
  out.forceDuring = k.forceEvent("football");
  out.flags = k.events().flags;
  return out;
}

/* ------------------------------ missions ------------------------------ */

/** Take the two photos of "Kampung photo album" with the real Photo prompt. */
export function photoScenario() {
  const k = window.__kq;
  const sim = window.KQ.Game.S.sim;
  const out = {};
  k.setMinute(420);
  run(3); // any pose from an earlier test ends
  sim.missions.abandon();
  out.accepted = sim.missions.accept("kampung_photos").ok;
  k.teleport("mosque_gate");
  run(0.5);
  out.photoTarget = k.state().target;
  k.interact();
  run(0.3);
  out.afterPhoto = sim.missions.progress();
  k.teleport("playground");
  run(0.5);
  out.photoTarget2 = k.state().target;
  k.interact();
  run(0.3);
  out.afterPhoto2 = sim.missions.progress();
  sim.missions.abandon();
  return out;
}

/** Push Uncle Lim's car with three presses of the quick "Push" prompt. */
export function pushScenario() {
  const k = window.__kq;
  const sim = window.KQ.Game.S.sim;
  const out = {};
  sim.missions.accept("push_the_car");
  k.setMinute(420);
  for (let i = 0; i < 8 && !k.npc("uncle_lim"); i += 1) run(0.2);
  const n = k.npc("uncle_lim");
  out.lim = Boolean(n) && !n.hidden;
  if (!out.lim) return out;
  k.place(n.x + 1.5, n.z, -Math.PI / 2);
  run(0.4);
  out.pushTarget = k.state().target;
  for (let i = 0; i < 3; i += 1) {
    k.interact();
    run(0.4);
  }
  out.afterPush = sim.missions.progress();
  sim.missions.abandon();
  return out;
}

/** Wei follows the hero, then arrives at Block C: the escort step is done. */
export function escortScenario() {
  const k = window.__kq;
  const G = window.KQ.Game;
  const sim = G.S.sim;
  const out = {};
  k.setMinute(600);
  sim.missions.abandon();
  sim.missions.accept("walk_wei_home");
  G.MissionFlow.notify({ type: "talk", target: "kid_wei" });
  out.step = sim.missions.progress().type;
  k.teleport("playground");
  run(0.5);
  const hero = G.S.player.pos;
  const wei = G.S.npcs.byId.kid_wei;
  const spot = G.Collide.freeSpot(G.S.world.colliders, hero.x - 3, hero.z, 0.4);
  Object.assign(wei, { hidden: false, show: 1, x: spot.x, z: spot.z });
  wei.group.visible = true;
  k.input("up", true);
  run(3);
  k.input("up", false);
  out.escorting = k.steps().escorting;
  out.gap = Math.hypot(wei.x - hero.x, wei.z - hero.z);
  const poi = G.S.world.pois.block_c;
  k.place(poi.pos.x, poi.pos.z - 2, 0);
  Object.assign(wei, { x: poi.pos.x, z: poi.pos.z - 1 });
  run(1);
  out.afterEscort = sim.missions.progress();
  out.released = k.steps().escorting;
  out.weiFree = !wei.escort;
  sim.missions.abandon();
  return out;
}

/** "Ride to the library" counts when the hero arrives on any ride (including a camel, horse or pony). */
export function rideScenario() {
  const k = window.__kq;
  const G = window.KQ.Game;
  const sim = G.S.sim;
  sim.missions.abandon();
  // Pretend the hero is on an animal (G.Mounts.riding) for this one arrival, then put the real check back.
  const realRiding = G.Mounts.riding;
  G.Mounts.riding = () => true;
  let afterRide;
  try {
    sim.missions.accept("bike_to_library");
    k.teleport("library");
    run(1);
    afterRide = sim.missions.progress();
  } finally {
    G.Mounts.riding = realRiding;
  }
  sim.missions.abandon();
  return { afterRide };
}

/** Say hi to people in several places until "Say hi to five people" is done (or nobody is left). */
export function fiveHellosScenario() {
  const k = window.__kq;
  const G = window.KQ.Game;
  const sim = G.S.sim;
  k.setMinute(600);
  run(3);
  sim.missions.abandon();
  sim.missions.accept("friendly_five");
  const before = k.hi().count;
  const out = { counts: [] };
  for (const where of ["bus_stop", "playground", "park", "library", "home"]) {
    k.teleport(where);
    run(4);
    for (const m of greetable().slice(0, 8)) {
      if (sim.missions.progress().stepIndex > 0 || !G.S.crowd.byId.get(m.id)) break;
      run(2);
      sayHiTo(m.id);
      out.counts.push(sim.missions.progress().count);
    }
    if (sim.missions.progress().stepIndex > 0) break;
  }
  out.hellos = k.hi().count - before;
  out.progress = sim.missions.progress();
  return out;
}

/* ------------------------------ Makkah and Madinah ------------------------------ */

/** The Makkah guide: his missions, his prompt, and a hello to a pilgrim. */
export function guideScenario() {
  const k = window.__kq;
  const G = window.KQ.Game;
  const out = {};
  k.setMinute(600);
  run(1);
  out.missions = G.S.sim.missions.offered().map((m) => m.id);
  const guide = G.S.npcs.byId.guide_makkah;
  out.guide = guide && [guide.x, guide.z, guide.hidden];
  k.place(guide.x + 1.4, guide.z, -Math.PI / 2);
  run(1);
  out.target = k.state().target;
  k.place(0, -90, 0);
  run(3);
  const pilgrim = greetable()[0];
  if (pilgrim) out.said = sayHiTo(pilgrim.id).hi.last;
  out.stars = G.MapMarkers.build(G.S).filter((m) => m.kind === "giver").length;
  k.place(guide.x + 1.4, guide.z, -Math.PI / 2);
  run(3); // the hello's wave ends
  k.interact(); // the guide offers a mission
  run(0.3);
  out.modal = k.state().ui.modal;
  return out;
}

/** Force each Haramain event in turn near the hotel forecourt and report that it ran. */
export function holyEventsScenario() {
  const k = window.__kq;
  const events = {};
  const open = window.KQ.Game.UI.current();
  if (open) open.close("test"); // the guide's offer from the last scenario
  for (const id of ["dates", "photo", "pigeons"]) {
    k.stopEvent();
    k.place(0, -90, 0);
    run(1);
    events[id] = [k.forceEvent(id), k.events().running];
    run(3);
    events[id].push(k.events().actors);
    k.stopEvent();
    run(3);
  }
  return events;
}
