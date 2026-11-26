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
  const RADIUS = 0.28;
  const WALK_SPEED = 1.55;
  const STUCK_SECONDS = 1.2;
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

  function create(scene, id, name) {
    const group = KQ.Figures.build(id);
    group.name = "npc-" + id;
    scene.add(group);
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
      idleT: 0,
      talking: false,
      seat: null,
      slot: null,
      cook: false,
      speed: 0,
      rng: U.rng(U.hash(id)),
      pose: "idle",
      star: null,
    };
  }

  /** Pose name the agent should hold while it is standing at its goal. */
  function restPose(A) {
    if (A.talking) return "talk";
    const g = A.goal;
    if (!g) return "idle";
    if (g.kind === "sit") return g.activity === "eat" ? "eat" : "sit";
    if (g.kind === "pray") return prayPose();
    return "idle";
  }

  function prayPose() {
    let t = G.prayClock % PRAY_TOTAL;
    for (let i = 0; i < PRAY_CYCLE.length; i += 1) {
      if (t < PRAY_CYCLE[i][1]) return PRAY_CYCLE[i][0];
      t -= PRAY_CYCLE[i][1];
    }
    return "qiyam";
  }

  /** Move toward a point; returns true on arrival. */
  function stepToward(A, tx, tz, speed, dt) {
    const dx = tx - A.x;
    const dz = tz - A.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.12) return true;
    const s = Math.min(d, speed * dt);
    A.x += (dx / d) * s;
    A.z += (dz / d) * s;
    A.heading = U.dampAngle(A.heading, Math.atan2(dx, dz), 9, dt);
    A.speed = speed;
    return d - s < 0.12;
  }

  function followPath(A, dt, env) {
    const target = A.path[A.wp];
    const bx = A.x;
    const bz = A.z;
    const done = stepToward(A, target.x, target.z, A.goal && A.goal.hurry ? 2.1 : WALK_SPEED, dt);
    if (!A.ghost) G.Collide.resolve(env.nearColliders, A, RADIUS);
    const moved = U.dist(bx, bz, A.x, A.z);
    A.stuckT = moved < 0.15 * dt ? A.stuckT + dt : 0;
    if (done || A.stuckT > STUCK_SECONDS) {
      A.stuckT = 0;
      A.wp += 1;
      if (A.wp >= A.path.length) A.path = [];
    }
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
    A.ghost = false;
    if (goal && goal.ghostLeg) A.path.push({ x: goal.x, z: goal.z, last: true });
  }

  function update(A, dt, env) {
    if (A.hidden) return;
    A.speed = 0;
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

  function settlePray(A, dt) {
    const g = A.goal;
    A.x = U.damp(A.x, g.x, 6, dt);
    A.z = U.damp(A.z, g.z, 6, dt);
    A.heading = U.dampAngle(A.heading, -Math.PI / 2, 6, dt);
  }

  function cookSnap(A) {
    A.x = A.goal.cookSpot.x;
    A.z = A.goal.cookSpot.z;
    A.heading = 0;
    A.cook = true;
  }

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
    A.ghost = false;
  }

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
