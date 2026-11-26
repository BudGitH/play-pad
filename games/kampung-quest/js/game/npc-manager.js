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

  function create(scene, world, sim) {
    const pathP = G.Path.build(world);
    const M = {
      scene,
      world,
      sim,
      pathP,
      seats: G.Seats.build(world),
      slots: G.NpcGoals.buildSlots(world),
      agents: [],
      byId: {},
      lastMinute: -1,
      dirty: true,
    };
    KQ.Sim.NPC_IDS.forEach(function (id) {
      const A = G.NpcAgent.create(scene, id, KQ.Sim.NPC_PROFILE[id].name);
      A.group.visible = false;
      M.agents.push(A);
      M.byId[id] = A;
    });
    return M;
  }

  function nearColliders(M, A) {
    return M.world.colliders.filter(
      (c) => A.x > c.minX - 3 && A.x < c.maxX + 3 && A.z > c.minZ - 3 && A.z < c.maxZ + 3,
    );
  }

  function placeAt(A, x, z, heading, world) {
    A.x = x;
    A.z = z;
    A.y = world.heightAt(x, z);
    A.heading = heading;
    A.path = [];
    A.wp = 0;
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

  function snapToGoal(M, A, goal) {
    A.hidden = false;
    A.show = 1;
    placeAt(A, goal.x, goal.z, goal.heading, M.world);
    if (goal.kind === "sit") A.y = goal.y - KQ.Figures.seatDrop(A.rig);
    if (goal.cookSpot) placeAt(A, goal.cookSpot.x, goal.cookSpot.z, 0, M.world);
    if (goal.cookSpot) A.cook = true;
  }

  function comeOutside(M, A, poiId) {
    const poi = M.world.pois[poiId] || M.world.pois.home;
    A.hidden = false;
    A.show = 0;
    placeAt(A, poi.pos.x, poi.pos.z, poi.facing, M.world);
  }

  function hideOrWalkHome(M, A, goal, instant) {
    if (instant || A.hidden) {
      A.hidden = true;
      placeAt(A, goal.x, goal.z, goal.heading, M.world);
      return;
    }
    const pts = G.Path.toPoi(M.pathP, A.x, A.z, goal.home);
    if (pts) G.NpcAgent.setPath(A, [{ x: A.x, z: A.z }].concat(pts), null);
    else A.hidden = true;
  }

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

  function reveal(M, A, hero) {
    const g = A.goal;
    if (!g || g.kind !== "hide" || A.path.length) return;
    const near = U.dist(hero.x, hero.z, g.x, g.z) < REVEAL_RANGE;
    if (near && A.hidden) {
      A.hidden = false;
      A.show = 0;
      placeAt(A, g.x + 0.8, g.z + 0.6, g.heading, M.world);
    } else if (!near && !A.hidden) {
      A.hidden = true;
    }
  }

  function separate(M, hero) {
    const live = M.agents.filter((A) => !A.hidden);
    live.forEach(function (A, i) {
      const mobile = !(A.goal && (A.goal.kind === "sit" || A.goal.kind === "pray" || A.cook));
      if (!mobile) return;
      push(A, hero.x, hero.z, HERO_SPACE, 1);
      for (let j = i + 1; j < live.length; j += 1) {
        const B = live[j];
        const bMobile = !(B.goal && (B.goal.kind === "sit" || B.goal.kind === "pray" || B.cook));
        push(A, B.x, B.z, PERSONAL_SPACE, bMobile ? 0.5 : 1);
        if (bMobile) push(B, A.x, A.z, PERSONAL_SPACE, 0.5);
      }
    });
  }

  /** Nudge A away from (x, z) when closer than `space`. */
  function push(A, x, z, space, share) {
    const dx = A.x - x;
    const dz = A.z - z;
    const d = Math.hypot(dx, dz);
    if (d >= space || d < 1e-4) return;
    const amt = (space - d) * share * 0.35;
    A.x += (dx / d) * amt;
    A.z += (dz / d) * amt;
  }

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
  };
})((window.KQ = window.KQ || {}));
