/* ============================================================================
 * FILE: npc-agent.js
 * PURPOSE: One NPC "agent": its figure, where it is headed (a goal), how it walks along a
 *          waypoint path with collision sliding and stuck recovery, and which pose it holds on
 *          arrival (stand, sit, eat, pray in a row facing the qibla, wander, hide indoors).
 * BUSINESS CONTEXT: AC-5 (routines, sit and eat, mosque at prayer time, never block a doorway
 *   for more than 3 s: a stuck agent skips ahead after ~1.2 s and the player pushes agents aside).
 * DEPENDENCIES: THREE, KQ.Figures, util.js, collide.js, seats.js (through the manager).
 * ========================================================================== */
(function (KQ) {
  "use strict";
  const G = (KQ.Game = KQ.Game || {});
  const U = G.U;
  /** Body radius for wall tests: the toy is ~0.26 m from its centre to its shoulders, plus a gap. */
  const RADIUS = 0.31;
  const WALK_SPEED = 1.55;
  const STUCK_SECONDS = 1.2;
  /** Waypoints skipped for being stuck before the agent asks the manager for a fresh route. */
  const REPLAN_AFTER = 2;
  /** Metres of real progress toward a waypoint that count as moving. */
  const PROGRESS = 0.02;
  /** One congregation: every praying NPC follows the same posture clock (so they move together). */
  const PRAY_CYCLE = [
    ["qiyam", 4],
    ["ruku", 2.4],
    ["itidal", 1.6],
    ["sujud", 2.6],
    ["julus", 1.8],
    ["sujud", 2.6],
  ];
  const PRAY_TOTAL = PRAY_CYCLE.reduce((sum, p) => sum + p[1], 0);
  G.prayClock = 0;

  /**
   * Build one NPC agent: its toy figure (added to the scene), animator and the walking / goal state
   * used by the manager.
   * @param scene the THREE scene; id the cast id; name the display name.
   */
  function create(scene, id, name) {
    const group = KQ.Figures.build(id);
    group.name = "npc-" + id;
    scene.add(group);
    KQ.Figures.mergeRig(group); // one draw call per figure (AC-14 budget)
    const rig = group.userData.rig;
    return {
      id,
      name,
      group,
      rig,
      anim: KQ.Figures.Animator(rig),
      x: 0,
      y: 0,
      z: 0,
      heading: 0,
      path: [],
      wp: 0,
      ghost: false,
      goal: null,
      routineKey: "",
      hidden: true,
      show: 0,
      stuckT: 0,
      bestD: Infinity,
      stuckHits: 0,
      replan: false,
      idleT: 0,
      talking: false,
      seat: null,
      slot: null,
      cook: false,
      speed: 0,
      rng: U.rng(U.hash(id)),
      pose: "idle",
      star: null,
      greetT: 0,
      holdT: 0,
    };
  }

  /** Pose name the agent should hold while it is standing at its goal. */
  function restPose(A) {
    if (A.talking) return "talk";
    const g = A.goal;
    if (A.greetT > 0 && (!g || (g.kind !== "sit" && g.kind !== "pray"))) return "wave";
    if (!g) return "idle";
    if (g.kind === "sit") return g.activity === "eat" ? "eat" : "sit";
    if (g.kind === "pray") return prayPose();
    return "idle";
  }

  /**
   * The posture the praying row is in right now, from the shared prayer clock, so every prayer row
   * moves in step.
   */
  function prayPose() {
    let t = G.prayClock % PRAY_TOTAL;
    for (let i = 0; i < PRAY_CYCLE.length; i += 1) {
      if (t < PRAY_CYCLE[i][1]) return PRAY_CYCLE[i][0];
      t -= PRAY_CYCLE[i][1];
    }
    return "qiyam";
  }

  /**
   * Move toward a point; returns true on arrival. The heading is set by the caller from where the
   * agent actually went, not from where it wanted to go.
   */
  function stepToward(A, tx, tz, speed, dt) {
    const dx = tx - A.x;
    const dz = tz - A.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.12) return true;
    const s = Math.min(d, speed * dt);
    A.x += (dx / d) * s;
    A.z += (dz / d) * s;
    A.speed = speed;
    return d - s < 0.12;
  }

  /**
   * Turn toward the way the agent really moved this frame; when a wall stopped it (it barely
   * moved) keep the old heading instead of staring into the wall.
   */
  function faceMotion(A, bx, bz, speed, dt) {
    const mx = A.x - bx;
    const mz = A.z - bz;
    if (Math.hypot(mx, mz) < speed * dt * 0.35) return;
    A.heading = U.dampAngle(A.heading, Math.atan2(mx, mz), 9, dt);
  }

  /**
   * Track progress toward the current waypoint: true once the agent has made none for
   * STUCK_SECONDS (sliding along a wall is movement, but not progress).
   */
  function noProgress(A, target, dt) {
    const d = U.dist(A.x, A.z, target.x, target.z);
    if (d < A.bestD - PROGRESS) {
      A.bestD = d;
      A.stuckT = 0;
      return false;
    }
    A.stuckT += dt;
    return A.stuckT > STUCK_SECONDS;
  }

  /** Move on to the next waypoint (or finish the path). */
  function nextWaypoint(A) {
    A.stuckT = 0;
    A.bestD = Infinity;
    A.wp += 1;
    if (A.wp >= A.path.length) A.path = [];
  }

  /**
   * Walk toward the current waypoint with collision, and skip ahead when reached or stuck too long
   * (never block a doorway). After REPLAN_AFTER stuck skips in a row it flags a fresh route.
   */
  function followPath(A, dt, env) {
    const target = A.path[A.wp];
    const bx = A.x;
    const bz = A.z;
    const speed = A.goal && A.goal.hurry ? 2.1 : WALK_SPEED;
    const done = stepToward(A, target.x, target.z, speed, dt);
    if (!A.ghost) G.Collide.settle(env.nearColliders, A, RADIUS);
    faceMotion(A, bx, bz, speed, dt);
    const stuck = !done && noProgress(A, target, dt);
    if (!done && !stuck) return;
    A.stuckHits = stuck ? A.stuckHits + 1 : 0;
    if (A.stuckHits >= REPLAN_AFTER) A.replan = true;
    nextWaypoint(A);
  }

  /** Settle into the goal once the path is walked: snap to seat / slot / cook spot. */
  function arrive(A, env) {
    const g = A.goal;
    A.speed = 0;
    if (!g) return;
    if (g.kind === "sit") {
      A.x = g.x;
      A.z = g.z;
      A.heading = g.heading;
      A.y = g.y - KQ.Figures.seatDrop(A.rig);
      return;
    }
    if (g.kind === "wander") {
      A.idleT = 0.8 + A.rng() * 2.4;
      return;
    }
    A.heading = U.dampAngle(A.heading, g.heading, 6, 1 / 30);
    if (g.kind === "hide" && !env.revealed) A.hidden = true;
  }

  /** Walk legs, then ghost (no collision) final leg to the exact spot. */
  function setPath(A, pts, goal) {
    A.path = pts.slice(1);
    A.wp = 0;
    A.bestD = Infinity;
    A.ghost = false;
    if (goal && goal.ghostLeg) A.path.push({ x: goal.x, z: goal.z, last: true });
  }

  /**
   * Per-frame agent step: face the hero while talking, else follow a path, wander or settle at the
   * goal; then pose it.
   */
  function update(A, dt, env) {
    if (A.hidden) return;
    A.speed = 0;
    if (A.greetT > 0) A.greetT -= dt;
    if (A.holdT > 0 && !A.talking) return holdStill(A, dt, env);
    if (A.talking) {
      faceToward(A, env.hero, dt);
    } else if (A.path.length) {
      const next = A.path[A.wp];
      A.ghost = Boolean(next && next.last);
      followPath(A, dt, env);
    } else if (A.goal && A.goal.kind === "wander") {
      wander(A, dt, env);
    } else {
      arrive(A, env);
    }
    if (A.path.length === 0 && A.goal && A.goal.kind === "pray") settlePray(A, dt);
    if (A.goal && A.goal.cookSpot && A.path.length === 0) cookSnap(A);
    pose(A, dt, env);
  }

  /** A greeted neighbour stands still, faces the hero and waves until `holdT` runs out (Say hi). */
  function holdStill(A, dt, env) {
    A.holdT -= dt;
    A.greetT = Math.max(A.greetT, 0.2); // the wave pose lasts as long as the hold
    faceToward(A, env.hero, dt);
    pose(A, dt, env);
  }

  /** Ease a praying agent onto its row spot, facing the qibla. */
  function settlePray(A, dt) {
    const g = A.goal;
    A.x = U.damp(A.x, g.x, 6, dt);
    A.z = U.damp(A.z, g.z, 6, dt);
    A.heading = U.dampAngle(A.heading, -Math.PI / 2, 6, dt);
  }

  /** Snap a stall cook exactly onto its cook spot (heading 0) and mark it cooking. */
  function cookSnap(A) {
    A.x = A.goal.cookSpot.x;
    A.z = A.goal.cookSpot.z;
    A.heading = 0;
    A.cook = true;
  }

  /** Turn an agent smoothly to face the hero. */
  function faceToward(A, hero, dt) {
    const want = Math.atan2(hero.x - A.x, hero.z - A.z);
    A.heading = U.dampAngle(A.heading, want, 8, dt);
  }

  /** Strolling / playing: wait a moment, then pick the next nearby spot. */
  function wander(A, dt, env) {
    A.idleT -= dt;
    if (A.idleT > 0) return;
    const spot = env.pickWander(A);
    if (!spot) {
      A.idleT = 2;
      return;
    }
    A.path = [{ x: spot.x, z: spot.z }];
    A.wp = 0;
    A.bestD = Infinity;
    A.ghost = false;
  }

  /**
   * Pick walk or the resting pose, play it (walk speed scales the animation rate) and update the
   * group's position, heading and pop-in scale.
   */
  function pose(A, dt, env) {
    const moving = A.speed > 0.1 && A.path.length > 0;
    A.pose = moving ? "walk" : restPose(A);
    A.anim.play(A.pose, 0.3);
    if (moving) A.anim.setRate(U.clamp(A.speed / 2.2, 0.5, 1.2));
    else A.anim.setRate(1);
    A.anim.update(dt);
    A.y = U.damp(A.y, groundFor(A, env), 14, dt);
    A.show = U.damp(A.show, 1, 7, dt);
    A.group.position.set(A.x, A.y, A.z);
    A.group.rotation.y = A.heading;
    A.group.scale.setScalar(Math.max(0.01, A.show));
  }

  /**
   * Ground height the agent stands at: the seat height (less the figure's seat drop) when seated,
   * else the terrain.
   */
  function groundFor(A, env) {
    if (A.goal && A.goal.kind === "sit" && A.path.length === 0) {
      return A.goal.y - KQ.Figures.seatDrop(A.rig);
    }
    return env.heightAt(A.x, A.z);
  }

  G.NpcAgent = {
    create,
    update,
    setPath,
    restPose,
    RADIUS,
    PRAY_TOTAL,
    WALK_SPEED,
  };
})((window.KQ = window.KQ || {}));
