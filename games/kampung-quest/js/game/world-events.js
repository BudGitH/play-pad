/* ============================================================================
 * FILE: world-events.js
 * PURPOSE: Runs the town's little scripted moments: asks the pure director (js/sim/events.js) when
 *          one may start, finds a free spot near (not on top of) the hero, builds it from the
 *          scripts in world-events-kampung.js / world-events-holy.js, steps it, offers its prompt
 *          (an ice cream, a balloon to catch, a photo), shows a hint chip and a radar blip while
 *          it lasts, and tidies everything away afterwards.
 * BUSINESS CONTEXT: AC-P18. At most one event at a time; never during a prayer, the azan, a rite,
 *   a menu or a pause (the director's flags, built here from the game's real state); child-safe,
 *   optional, tiny capped rewards. People are full toy figures borrowed from a small pool
 *   (event-actors.js), props are a few plain meshes freed at the end, so the idle town costs nothing.
 * DEPENDENCIES: KQ.Sim.Events, event-actors.js, greetings.js (bubbles), life-chip.js, crowd-zones.js
 *   (clear ground), pathing.js, ui-core.js, prayer-flow.js, ritual-flow.js, vehicles.js, audio.js.
 * ========================================================================== */
(function (KQ) {
  "use strict";
  const G = (KQ.Game = KQ.Game || {});
  const U = G.U;
  const S = () => G.S;
  /** Seconds between looks at the game's state for the director's flags. */
  const FLAG_EVERY = 0.25;
  /** An event ends if the hero wanders this far from it (or teleports away). */
  const TOO_FAR = 70;
  /** The most coins events may give in one sitting (they are small treats, not a wage). */
  const COIN_CAP = 12;
  const W = {
    dir: null,
    inst: null,
    id: null,
    actors: [],
    meshes: [],
    flags: {},
    flagsT: 0,
    now: 0,
    t0: 0,
    coins: 0,
    started: [],
    last: null,
  };
  /** The scripts by event id, filled in by world-events-kampung.js and world-events-holy.js. */
  const SCRIPTS = {};

  /** The director, created on first use with a seeded random source. */
  function ensure() {
    if (!W.dir) W.dir = KQ.Sim.Events.create(U.rng(U.hash("kq-world-events")));
    return W.dir;
  }

  /** What stops an event right now (the director's flags), read from the real game state. */
  function readFlags() {
    const s = S();
    const pf = G.PrayerFlow;
    return {
      paused: Boolean(s.paused),
      modal: G.UI.modalOpen(),
      azan: Boolean(pf.state.azanLive || G.Audio.azanPlaying()),
      prayerDue: Boolean(s.sim.prayer.isBlockingMissions()),
      prayerScreen: pf.screenOpen(),
      ritual: Boolean(G.RitualFlow.debug().rite),
      eating: G.EatFlow.open(),
      mounted: G.Vehicles.mounted(),
    };
  }

  /** Is there somewhere clear to stand at (x, z)? A ring of points round it must be free too. */
  function open(x, z, r) {
    const world = S().world;
    if (!G.CrowdZones.clear(world, x, z, 0.45)) return false;
    for (let i = 0; i < 8; i += 1) {
      const a = (i / 8) * Math.PI * 2;
      if (!G.CrowdZones.clear(world, x + Math.cos(a) * r, z + Math.sin(a) * r, 0.3)) return false;
    }
    return true;
  }

  /** Is (x, z) on or beside a walkway (a node of the walk graph is near)? */
  function onWalkway(x, z) {
    return G.Path.nodesNear(S().npcs.pathP, x, z, 7).length > 0;
  }

  /** Candidate points `dists` away at angles `offs` from the camera's heading (angle-major: straight ahead first). */
  function candidates(dists, offs) {
    const P = S().player;
    const yaw = G.Camera.state.yaw;
    const out = [];
    offs.forEach((o) =>
      dists.forEach((d) =>
        out.push({
          o: Math.abs(o),
          x: P.pos.x + Math.sin(yaw + o) * d,
          z: P.pos.z + Math.cos(yaw + o) * d,
        }),
      ),
    );
    return out;
  }

  /**
   * A clear spot `minD..maxD` metres from the hero, in the half the camera looks at (straight ahead
   * first, ground beside a walkway preferred), with `patch` metres of free ground round it; with
   * `anyGround` it may settle for a spot behind the hero. Null when the town offers none.
   */
  function spotAhead(minD, maxD, patch, anyGround) {
    const ds = [minD, (minD + maxD) / 2, maxD];
    const free = (c) => open(c.x, c.z, patch);
    const fwd = candidates(ds, [0, 0.5, -0.5, 1, -1, 1.5, -1.5]).filter(free);
    const front = fwd.filter((c) => c.o <= 0.5);
    const behind = anyGround ? candidates(ds, [2.2, -2.2, 3]).filter(free) : [];
    const pick = front.find((c) => onWalkway(c.x, c.z)) || front[0] || fwd[0] || behind[0];
    return pick || null;
  }

  /** Grant a small reward once: coins (within the cap), a sticker, and a toast. */
  function reward(r) {
    const sim = S().sim;
    const coins = Math.max(0, Math.min(r.coins || 0, COIN_CAP - W.coins));
    if (coins > 0) {
      W.coins += coins;
      sim.economy.add(coins);
      G.Audio.play("coin");
    }
    if (r.sticker && sim.missions.grantSticker(r.sticker)) G.UI.toast("New sticker!", "gold", 3600);
    if (r.text)
      G.UI.toast(
        r.text + (coins ? " +" + coins + (coins > 1 ? " coins" : " coin") : ""),
        "gold",
        3200,
      );
    S().hudDirty = true;
  }

  /** The helpers a script is given: the hero, a free spot, actors, props, bubbles, sounds, rewards. */
  function makeEnv() {
    return {
      hero: () => S().player.pos,
      heading: () => S().player.heading,
      world: () => S().world,
      spot: spotAhead,
      open,
      now: () => W.now - W.t0,
      actor(key, x, z, heading) {
        const a = G.Actors.get(key);
        G.Actors.place(a, x, z, heading);
        if (W.actors.indexOf(a) === -1) W.actors.push(a);
        return a;
      },
      mesh(obj) {
        S().scene.add(obj);
        W.meshes.push(obj);
        return obj;
      },
      say: (who, text, delay, secs) => G.Greetings.say(who, text, delay, secs),
      sound: (name) => G.Audio.play(name),
      reward,
      chip: (text) => G.LifeChip.set("event", text),
    };
  }

  /** Free every prop mesh of the finished event (geometry and materials too). */
  function freeMeshes() {
    W.meshes.forEach(function (o) {
      if (o.parent) o.parent.remove(o);
      o.traverse(function (n) {
        if (n.geometry) n.geometry.dispose();
        if (n.material)
          (Array.isArray(n.material) ? n.material : [n.material]).forEach((m) => m.dispose());
      });
    });
    W.meshes = [];
  }

  /** Tidy the event away: its script's end(), every actor (they shrink and hide), every prop. */
  function teardown() {
    if (W.inst && W.inst.end) W.inst.end();
    W.actors.forEach((a) => G.Actors.leave(a));
    freeMeshes();
    G.LifeChip.clear("event");
    W.inst = null;
    W.id = null;
  }

  /** Begin an event the director chose: build its script; if the town has no room, drop it quietly. */
  function begin(id) {
    const make = SCRIPTS[id];
    W.t0 = W.now;
    W.id = id;
    W.inst = make ? make(makeEnv()) : null;
    const ok = Boolean(W.inst) && W.inst.start() !== false;
    if (!ok) {
      teardown();
      ensure().stop("nospot", 25);
      return false;
    }
    W.started.push(id);
    W.last = { id, at: W.now, ended: null };
    return true;
  }

  /** Handle what the director reported. */
  function apply(tr) {
    if (!tr) return;
    if (tr.type === "start") begin(tr.id);
    else {
      teardown();
      if (W.last) W.last.ended = tr.reason;
    }
  }

  /** The events the director must not pick right now (a script that needs something else to be quiet). */
  function exclusions() {
    const p = S().sim.missions.progress();
    return p && p.id === "lost_cat" && p.stepIndex >= 2 ? ["catchase"] : [];
  }

  /** Step the running script and its actors; stop the event if it finished or the hero is far. */
  function stepRunning(dt) {
    const hero = S().player.pos;
    if (W.inst.update(dt) === "done") return apply(ensure().stop("done"));
    W.actors.forEach((a) => G.Actors.step(a, dt));
    const at = W.inst.anchor ? W.inst.anchor() : null;
    if (at && U.dist(at.x, at.z, hero.x, hero.z) > TOO_FAR) apply(ensure().stop("far"));
  }

  /**
   * Per-step update (from Loop.stepActors): read the flags a few times a second, let the director
   * start or end an event, and step the one that is running.
   */
  function update(dt) {
    const dir = ensure();
    W.now += dt;
    W.flagsT += dt;
    if (W.flagsT >= FLAG_EVERY) {
      W.flagsT = 0;
      W.flags = readFlags();
    }
    const region = KQ.region === "haramain" ? "haramain" : "kampung";
    apply(
      dir.update(dt, {
        region,
        minute: S().sim.clock.minute,
        flags: W.flags,
        exclude: exclusions(),
      }),
    );
    if (W.inst) stepRunning(dt);
    else W.actors.forEach((a) => G.Actors.step(a, dt)); // actors still shrinking away
    if (!W.inst) W.actors = W.actors.filter((a) => a.busy);
  }

  /** The prompt the running event offers the hero (an Interact target of kind "event"), or null. */
  function target(hero) {
    if (!W.inst || !W.inst.target || W.flags.modal) return null;
    const t = W.inst.target(hero);
    return t ? Object.assign({ kind: "event", enabled: true, h: 1.5 }, t) : null;
  }

  /** The hero pressed the event's prompt. */
  function press(t) {
    if (W.inst && W.inst.press) W.inst.press(t);
  }

  /** The radar blip for the running event ({x, z, label}) or null. */
  function blip() {
    if (!W.inst || !W.inst.anchor) return null;
    const at = W.inst.anchor();
    const info = KQ.Sim.Events.byId(W.id);
    return at && info ? { x: at.x, z: at.z, label: info.label } : null;
  }

  /** Start a named event now (tests); false when one is running, something blocks, or there is no room. */
  function force(id) {
    ensure();
    if (!SCRIPTS[id] || W.inst) return false;
    W.flags = readFlags();
    const tr = W.dir.force(id, W.flags);
    return Boolean(tr) && begin(id);
  }

  /** End the running event now (tests, or the hero asks). */
  function stop() {
    apply(ensure().stop("stopped"));
  }

  /** The director's state and the running event, for tests. */
  function debug() {
    const d = ensure().debug();
    return Object.assign(d, {
      id: W.id,
      running: Boolean(W.inst),
      actors: G.Actors.count(),
      built: G.Actors.built(),
      meshes: W.meshes.length,
      coins: W.coins,
      started: W.started.slice(),
      last: W.last,
      info: W.inst && W.inst.info ? W.inst.info() : null,
      flags: W.flags,
    });
  }

  G.WorldEvents = { update, target, press, blip, force, stop, debug, SCRIPTS, spotAhead };
})((window.KQ = window.KQ || {}));
