/* ============================================================================
 * FILE: npc-manager.js
 * PURPOSE: Spawns the 16 cast NPCs and drives them from KQ.Sim.Schedule.routineFor: re-plans
 *          when a routine changes, hides indoor NPCs (revealed at their door when the hero is
 *          near), keeps agents from piling onto each other or the hero, and talks to the hero.
 * BUSINESS CONTEXT: AC-5 (>= 12 NPCs follow routines, avoid the player, walk to the mosque at
 *   prayer times), AC-11 (mission givers wear a star), AC-12 (NPCs face the hero in dialogue).
 * DEPENDENCIES: npc-agent.js, npc-goals.js, pathing.js, seats.js, collide.js, KQ.Sim.Schedule.
 * ========================================================================== */
(function (KQ) {
  "use strict";
  const G = (KQ.Game = KQ.Game || {});
  const U = G.U;
  const REVEAL_RANGE = 15;
  const ACTIVE_RANGE = 70;
  const PERSONAL_SPACE = 0.78;
  const HERO_SPACE = 0.95;
  /** Closer than this and an agent that cannot step aside (wall behind it) shoves the hero out. */
  const HERO_MIN = 0.62;
  /** The near-collider list is rebuilt once an agent has moved this far from where it was built. */
  const NEAR_REBUILD = 1.2;
  const NEAR_MARGIN = 4;
  /** An agent placed this close to a wall turns to face open space instead. */
  const FACE_REACH = 0.9;
  /** Where agents stand outside a door: this many places, QUEUE_GAP apart, swaying QUEUE_SWAY aside. */
  const QUEUE_SLOTS = 5;
  const QUEUE_GAP = 0.8;
  const QUEUE_SWAY = 0.4;

  /**
   * Build the NPC manager: the shared path graph, seats and goal slots, plus one hidden agent per
   * cast member.
   * @param scene the THREE scene agents are added to; world the built neighbourhood; sim the pure
   *   sim.
   * @returns the manager object M that the other functions here take as their first argument.
   */
  function create(scene, world, sim) {
    const holy = KQ.region === "haramain"; // the kampung cast stays home: pilgrims are the crowd
    const pathP = G.Path.build(world);
    const M = {
      scene,
      world,
      sim,
      pathP,
      seats: G.Seats.build(world),
      slots: holy ? { men: [], women: [] } : G.NpcGoals.buildSlots(world),
      agents: [],
      byId: {},
      lastMinute: -1,
      dirty: true,
    };
    (holy ? [] : KQ.Sim.NPC_IDS).forEach(function (id) {
      const A = G.NpcAgent.create(scene, id, KQ.Sim.NPC_PROFILE[id].name);
      A.group.visible = false;
      M.agents.push(A);
      M.byId[id] = A;
    });
    return M;
  }

  /**
   * The world colliders within reach of an agent (its walking only tests what it could touch).
   * The list is cached on the agent and rebuilt when it has moved NEAR_REBUILD metres.
   */
  function nearColliders(M, A) {
    const c = A.nearAt;
    if (c && U.dist(A.x, A.z, c.x, c.z) < NEAR_REBUILD) return A.near;
    A.nearAt = { x: A.x, z: A.z };
    const m = NEAR_MARGIN;
    A.near = M.world.colliders.filter(
      (k) => A.x > k.minX - m && A.x < k.maxX + m && A.z > k.minZ - m && A.z < k.maxZ + m,
    );
    return A.near;
  }

  /** True for agents that hold their spot: seated, praying in the row or cooking behind a counter. */
  function fixed(A) {
    const g = A.goal;
    return Boolean(g && (g.kind === "sit" || g.kind === "pray")) || A.cook;
  }

  /**
   * Teleport an agent to x,z (standing on the ground there) facing a heading, and drop its path.
   * Unless `exact` (a seat, a cook spot, a hidden indoor spot), the spot is moved off any wall or
   * prop and the heading turned away from a wall it would face.
   */
  function placeAt(A, x, z, heading, world, exact) {
    let h = heading;
    let p = { x, z };
    if (!exact) {
      p = G.Collide.freeSpot(world.colliders, x, z, G.NpcAgent.RADIUS + 0.04);
      h = G.Collide.openHeading(world.colliders, p.x, p.z, heading, FACE_REACH);
    }
    A.x = p.x;
    A.z = p.z;
    A.y = world.heightAt(p.x, p.z);
    A.heading = h;
    A.path = [];
    A.wp = 0;
    A.nearAt = null;
    A.stuckHits = 0;
  }

  /** Switch an agent to a new routine. `instant` jumps straight to the end state. */
  function retarget(M, A, r, instant) {
    const wasHidden = A.hidden;
    if (A.cook && A.goal) {
      A.x = A.goal.x;
      A.z = A.goal.z;
      A.cook = false;
    }
    const goal = G.NpcGoals.goalFor(M, A, r);
    const home = A.goal && A.goal.kind === "hide" ? A.goal.home : null;
    A.goal = goal;
    A.dest = goal.kind === "hide" ? goal.home : goal.pathPoi || r.poi;
    A.talking = false;
    A.idleT = 0;
    if (goal.kind === "hide") return hideOrWalkHome(M, A, goal, instant);
    if (wasHidden) comeOutside(M, A, home || r.poi);
    if (instant) return snapToGoal(M, A, goal);
    const pts = G.Path.toPoi(M.pathP, A.x, A.z, goal.pathPoi || r.poi);
    if (!pts) return snapToGoal(M, A, goal);
    A.path = [];
    G.NpcAgent.setPath(A, [{ x: A.x, z: A.z }].concat(pts), goal);
  }

  /**
   * Put an agent straight at its goal (seat, cook spot or door), visible, for loads and time jumps.
   */
  function snapToGoal(M, A, goal) {
    A.hidden = false;
    A.show = 1;
    const exact = goal.kind === "sit" || goal.kind === "pray" || Boolean(goal.cookSpot);
    placeAt(A, goal.x, goal.z, goal.heading, M.world, exact);
    if (goal.kind === "sit") A.y = goal.y - KQ.Figures.seatDrop(A.rig);
    if (goal.cookSpot) placeAt(A, goal.cookSpot.x, goal.cookSpot.z, 0, M.world, true);
    if (goal.cookSpot) A.cook = true;
  }

  /**
   * Make an indoor NPC appear at its building's door (falling back to its home) ready to walk out.
   */
  function comeOutside(M, A, poiId) {
    const poi = M.world.pois[poiId] || M.world.pois.home;
    A.hidden = false;
    A.show = 0;
    stepOut(M, A, poi.pos.x, poi.pos.z, poi.facing);
  }

  /**
   * Stand an agent just outside a door at (x, z): looking at open space (never at the wall the
   * door is in), and on a spot of its own: each cast member has a fixed place in a loose queue
   * out from the door, so a crowd leaving one lobby does not stack. The first cast member (the
   * first mission giver) stands right at the door.
   */
  function stepOut(M, A, x, z, facing) {
    const h = G.Collide.openHeading(M.world.colliders, x, z, facing, FACE_REACH);
    const k = M.agents.indexOf(A) % QUEUE_SLOTS;
    const out = k * QUEUE_GAP;
    const side = (k % 2 ? -1 : 1) * (k ? QUEUE_SWAY : 0);
    const px = x + Math.sin(h) * out + Math.cos(h) * side;
    const pz = z + Math.cos(h) * out - Math.sin(h) * side;
    placeAt(A, px, pz, h, M.world);
  }

  /**
   * Send an agent indoors: hide it on the spot when instant or already hidden, else walk it home
   * first.
   */
  function hideOrWalkHome(M, A, goal, instant) {
    if (instant || A.hidden) {
      A.hidden = true;
      placeAt(A, goal.x, goal.z, goal.heading, M.world, true);
      return;
    }
    const pts = G.Path.toPoi(M.pathP, A.x, A.z, goal.home);
    if (pts) G.NpcAgent.setPath(A, [{ x: A.x, z: A.z }].concat(pts), null);
    else A.hidden = true;
  }

  /**
   * Ask the schedule what each NPC should be doing now and re-plan only the agents whose routine
   * changed.
   */
  function evaluate(M, instant) {
    const minute = M.sim.clock.minute;
    const state = M.sim.prayer.state();
    M.agents.forEach(function (A) {
      const r = KQ.Sim.Schedule.routineFor(A.id, minute, state);
      const key = r.poi + ":" + r.activity + ":" + r.indoors;
      if (key === A.routineKey && !instant) return;
      A.routineKey = key;
      retarget(M, A, r, instant);
    });
  }

  /**
   * Show a hidden indoor NPC at its door while the hero is near, and hide it again once the hero
   * leaves.
   */
  function reveal(M, A, hero) {
    const g = A.goal;
    if (!g || g.kind !== "hide" || A.path.length) return;
    const near = U.dist(hero.x, hero.z, g.x, g.z) < REVEAL_RANGE;
    if (near && A.hidden) {
      A.hidden = false;
      A.show = 0;
      stepOut(M, A, g.x, g.z, g.heading);
    } else if (!near && !A.hidden) {
      A.hidden = true;
    }
  }

  /**
   * Keep characters off each other: agents that can move step away from the hero and from each
   * other (stacked ones split along a fixed angle), are then pushed back out of walls and props,
   * and an agent that could not give way (a wall behind it) nudges the hero instead. Seated,
   * praying and cooking agents never move.
   */
  function separate(M, hero) {
    const live = M.agents.filter((A) => !A.hidden && A.group.visible);
    live.forEach(function (A, i) {
      const moves = !fixed(A);
      if (moves) G.Collide.separate(A, hero, HERO_SPACE, 1, 0, i);
      for (let j = i + 1; j < live.length; j += 1) crowd(A, live[j], moves, i + j * 0.7);
    });
    live.forEach(function (A) {
      if (fixed(A)) return;
      G.Collide.settle(nearColliders(M, A), A, G.NpcAgent.RADIUS);
      G.Collide.separate(hero, A, HERO_MIN, 1, 0, 0);
    });
  }

  /** Push two agents apart by share; a fixed one does not move and the other takes it all. */
  function crowd(A, B, aMoves, angle) {
    const bMoves = !fixed(B);
    if (!aMoves && !bMoves) return;
    const both = aMoves && bMoves;
    G.Collide.separate(
      A,
      B,
      PERSONAL_SPACE,
      aMoves ? (both ? 0.5 : 1) : 0,
      bMoves ? (both ? 0.5 : 1) : 0,
      angle,
    );
  }

  /**
   * Give a stuck agent a fresh start: out of whatever it is wedged in, then a new route to its
   * destination (a wanderer just picks another spot).
   */
  function replan(M, A) {
    A.replan = false;
    A.stuckHits = 0;
    G.Collide.settle(nearColliders(M, A), A, G.NpcAgent.RADIUS);
    A.path = [];
    A.wp = 0;
    const g = A.goal;
    if (!g || g.kind === "wander" || !A.dest) {
      A.idleT = 0;
      return;
    }
    const pts = G.Path.toPoi(M.pathP, A.x, A.z, A.dest);
    if (pts) G.NpcAgent.setPath(A, [{ x: A.x, z: A.z }].concat(pts), g.kind === "hide" ? null : g);
  }

  /**
   * Per-frame step: re-evaluate routines each game minute, reveal / cull by distance, move agents,
   * then separate them.
   */
  function update(M, dt, hero) {
    G.prayClock += dt;
    const whole = Math.floor(M.sim.clock.minute);
    if (whole !== M.lastMinute || M.dirty) {
      M.lastMinute = whole;
      evaluate(M, false);
      M.dirty = false;
    }
    const env = {
      hero,
      heightAt: M.world.heightAt,
      pickWander: (A) => G.NpcGoals.pickWander(M, A),
      revealed: false,
    };
    M.agents.forEach(function (A) {
      reveal(M, A, hero);
      const far = U.dist(A.x, A.z, hero.x, hero.z) > ACTIVE_RANGE;
      A.group.visible = !A.hidden && !far;
      if (A.hidden) return;
      env.nearColliders = far ? [] : nearColliders(M, A);
      env.revealed = A.goal && A.goal.kind === "hide";
      G.NpcAgent.update(A, dt, env);
      if (A.replan) replan(M, A);
    });
    separate(M, hero);
  }

  /** Put every NPC at the end of its current routine (load, teleport, time jump). */
  function snapAll(M) {
    M.lastMinute = Math.floor(M.sim.clock.minute);
    M.agents.forEach((A) => (A.routineKey = ""));
    evaluate(M, true);
    M.dirty = false;
  }

  /**
   * The closest visible agent within maxDist of x,z as {A, d}, or null; used to pick who to talk
   * to.
   */
  function nearest(M, x, z, maxDist) {
    let best = null;
    M.agents.forEach(function (A) {
      if (A.hidden) return;
      const d = U.dist(x, z, A.x, A.z);
      if (d <= maxDist && (!best || d < best.d)) best = { A, d };
    });
    return best;
  }

  G.Npcs = {
    create,
    update,
    snapAll,
    nearest,
    get: (M, id) => M.byId[id] || null,
    attachSim(M, sim) {
      M.sim = sim;
    },
    invalidate(M) {
      M.dirty = true;
    },
    startTalk(A) {
      A.talking = true;
    },
    endTalk(A) {
      A.talking = false;
    },
    /** Raise a hand for a few seconds (a greeting); only shows while the agent is standing still. */
    wave(A, seconds) {
      A.greetT = seconds;
    },
  };
})((window.KQ = window.KQ || {}));
