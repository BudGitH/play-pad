/* ============================================================================
 * FILE: player.js
 * PURPOSE: The hero: toy figure, walk / run controller with collision sliding, ground height,
 *          animator blending by speed, footstep timing, outfit (barber) and a "lock" so the
 *          prayer and service flows can place the hero and force a pose.
 * BUSINESS CONTEXT: AC-2 (movement + colliders), AC-4 (hero meets business rule 4), AC-8 (the
 *   hero takes each posture), AC-10 (barber changes the hair piece; tired / hungry only slows).
 * DEPENDENCIES: THREE, KQ.Figures, util.js, collide.js, audio.js (footsteps, optional).
 * ========================================================================== */
(function (KQ) {
  "use strict";
  const G = (KQ.Game = KQ.Game || {});
  const U = G.U;
  const WALK = 2.3;
  const RUN = 4.4;
  /** Body radius for wall tests: the toy is ~0.24 m from its centre to its elbows, plus a visible gap. */
  const RADIUS = 0.33;
  /** The longest move tested against walls at once (a run step on a slow frame is split). */
  const MAX_MOVE = 0.2;
  const STEP_LEN = 0.62;
  /** How fast the velocity follows the stick (per second): on the ground, and in the air where letting go
   *  of the stick carries the hero on a little (a running jump keeps its momentum, it does not stall). */
  const GROUND_FOLLOW = 14;
  const GROUND_STOP = 18;
  const AIR_FOLLOW = 10;
  const AIR_STOP = 2.5;

  /** Head-piece specs for the barber's outfit options (default = the hero's own blue cap). */
  const HEAD_STYLES = {
    songkok: { type: "songkok", colour: "#1c1c22", hair: "#3a2416" },
    cap: { type: "cap", colour: "#f2b134", peak: "#d99a1f", badge: "#1d4fc6", hair: "#3a2416" },
    crew: { type: "hair_short", colour: "#2a1c14" },
    curly: { type: "hair_quiff", colour: "#3a2416" },
    side_part: { type: "hair_short", colour: "#6b4423" },
    buzz: { type: "hair_short", colour: "#7a6048" },
  };

  /** The head spec for an outfit {hair, hat}. classic + no hat is the hero's own cap. */
  function headSpecFor(outfit) {
    if (outfit.hat !== "none") return HEAD_STYLES[outfit.hat];
    if (outfit.hair === "classic") return KQ.Figures.CAST.hero.head;
    return HEAD_STYLES[outfit.hair] || KQ.Figures.CAST.hero.head;
  }

  /** The ritual look now: in ihram or not, and the haircut after tahallul ("none", "trim", "shave"). */
  function ritualLook() {
    const u = G.S && G.S.sim && G.S.sim.umrah;
    return u ? { ihram: u.ihram, cut: u.cut } : { ihram: false, cut: "none" };
  }

  /**
   * Build the hero: the toy figure added to the scene, its animator and the movement state.
   * @param scene the THREE scene.
   * @returns the player object P that the other functions here take.
   */
  function create(scene) {
    const group = KQ.Figures.build("hero");
    group.name = "hero";
    scene.add(group);
    const rig = group.userData.rig;
    const P = {
      group,
      rig,
      anim: KQ.Figures.Animator(rig),
      pos: new THREE.Vector3(),
      heading: 0,
      speed: 0,
      vx: 0,
      vz: 0,
      locked: false,
      forcedPose: null,
      stepAcc: 0,
      moving: false,
      jump: KQ.Sim.Jump.create(),
      base: 0,
    };
    return P;
  }

  /**
   * Put the hair / hat choice from the barber (or a save) on the hero's head. In ihram the hero wears
   * the two white cloths and sandals and no cap; after tahallul the haircut shows (shorter hair).
   * `look` is { ihram, cut }; by default it is read from the ritual tracker.
   */
  function applyOutfit(P, outfit, look) {
    const l = look || ritualLook();
    KQ.Figures.setIhram(P.rig, l.ihram);
    const spec = l.ihram
      ? KQ.Figures.IHRAM_HEAD[l.cut === "none" ? "none" : l.cut]
      : KQ.Figures.cutHead(headSpecFor(outfit), l.cut);
    KQ.Figures.setHeadPiece(P.rig, spec);
  }

  /** Put the hero on the ground at x,z, stop all motion and optionally set the heading. */
  function place(P, x, z, heading, heightAt) {
    P.pos.set(x, heightAt(x, z), z);
    P.base = P.pos.y;
    KQ.Sim.Jump.reset(P.jump);
    P.vx = P.vz = P.speed = 0;
    if (heading !== undefined) P.heading = heading;
    sync(P);
  }

  /** Copy the hero's position and heading onto the 3D group. */
  function sync(P) {
    P.group.position.copy(P.pos);
    P.group.rotation.y = P.heading;
  }

  /** World-space desired velocity from the camera-relative stick (x right, y forward). */
  function desiredVelocity(move, yaw, speed) {
    const fx = Math.sin(yaw);
    const fz = Math.cos(yaw);
    return {
      x: (fx * move.y - fz * move.x) * speed,
      z: (fz * move.y + fx * move.x) * speed,
    };
  }

  /**
   * Choose and blend the animation from the forced pose or speed (idle, walk, run), scaling the
   * rate to the speed.
   */
  function animate(P, dt, move) {
    if (P.forcedPose) {
      P.anim.play(P.forcedPose, 0.35);
      P.anim.setRate(1);
    } else if (!P.jump.grounded) {
      P.anim.play("jump", 0.08);
      P.anim.setRate(1);
    } else if (P.speed < 0.15) {
      P.anim.play("idle", 0.2);
      P.anim.setRate(1);
    } else if (move.run && P.speed > 3.2) {
      P.anim.play("run", 0.15);
      P.anim.setRate(U.clamp(P.speed / RUN, 0.6, 1.3));
    } else {
      P.anim.play("walk", 0.15);
      P.anim.setRate(U.clamp(P.speed / WALK, 0.5, 1.4));
    }
    P.anim.update(dt);
  }

  /**
   * Play a footstep each time the hero has walked another step length (a faster sound when
   * running).
   */
  function footsteps(P, dist, audio) {
    P.stepAcc += dist;
    if (P.stepAcc < STEP_LEN) return;
    P.stepAcc -= STEP_LEN;
    if (audio) audio.footstep(P.speed > 3.2);
  }

  /**
   * Walk the hero by (dx, dz), split into short legs so a fast step cannot jump over a thin wall,
   * sliding along whatever is in the way.
   */
  function moveSliding(P, dx, dz, colliders) {
    const legs = Math.max(1, Math.ceil(Math.hypot(dx, dz) / MAX_MOVE));
    for (let i = 0; i < legs; i += 1) {
      P.pos.x += dx / legs;
      P.pos.z += dz / legs;
      G.Collide.settle(colliders, P.pos, RADIUS);
    }
  }

  /** The damping rate for the horizontal velocity: grounded or airborne, steering or letting go. */
  function followRate(P, steering) {
    if (P.jump.grounded) return steering ? GROUND_FOLLOW : GROUND_STOP;
    return steering ? AIR_FOLLOW : AIR_STOP;
  }

  /** Height: follow the terrain, add the jump arc, and thud on landing. */
  function vertical(P, dt, env) {
    P.base = U.damp(P.base, env.heightAt(P.pos.x, P.pos.z), 18, dt);
    const landed = KQ.Sim.Jump.step(P.jump, dt);
    if (landed && env.audio) env.audio.play("land");
    P.pos.y = P.base + P.jump.h;
  }

  /**
   * Jump if standing on the ground (never in the air: no double jump, never while a flow holds
   * the hero). Returns true when the hero left the ground.
   */
  function jump(P, audio) {
    if (P.locked || !KQ.Sim.Jump.press(P.jump)) return false;
    if (audio) audio.play("jump");
    return true;
  }

  /**
   * Move the hero one frame.
   * @param {object} P player
   * @param {number} dt seconds
   * @param {{x:number,y:number,run:boolean,mag:number}} move camera-relative stick
   * @param {{yaw:number, speedFactor:number, colliders:object[], heightAt:Function, audio:object}} env
   */
  function update(P, dt, move, env) {
    if (P.locked) {
      P.speed = 0;
      KQ.Sim.Jump.reset(P.jump);
      animate(P, dt, move);
      sync(P);
      return;
    }
    const top = (move.run ? RUN : WALK) * env.speedFactor;
    const want = desiredVelocity(move, env.yaw, top * move.mag);
    const k = followRate(P, move.mag > 0);
    P.vx = U.damp(P.vx, want.x, k, dt);
    P.vz = U.damp(P.vz, want.z, k, dt);
    const before = { x: P.pos.x, z: P.pos.z };
    moveSliding(P, P.vx * dt, P.vz * dt, env.colliders);
    const moved = U.dist(before.x, before.z, P.pos.x, P.pos.z);
    P.speed = dt > 0 ? moved / dt : 0;
    if (P.speed > 0.3) {
      const face = Math.atan2(P.pos.x - before.x, P.pos.z - before.z);
      P.heading = U.dampAngle(P.heading, face, 12, dt);
    }
    vertical(P, dt, env);
    P.moving = P.speed > 0.3;
    if (P.jump.grounded) footsteps(P, moved, env.audio);
    animate(P, dt, move);
    sync(P);
  }

  /** Hold the hero at a spot with a forced pose (null pose = idle). */
  function lock(P, spot, pose) {
    P.locked = true;
    P.forcedPose = pose || null;
    if (spot) {
      P.pos.set(spot.x, spot.y, spot.z);
      P.base = spot.y;
      P.heading = spot.heading;
    }
    KQ.Sim.Jump.reset(P.jump);
    P.vx = P.vz = 0;
    sync(P);
  }

  /** Give control back to the player after a lock (clears the forced pose). */
  function release(P) {
    P.locked = false;
    P.forcedPose = null;
  }

  G.Player = {
    create,
    update,
    jump,
    place,
    lock,
    release,
    applyOutfit,
    headSpecFor,
    sync,
    RADIUS,
    WALK,
    RUN,
    HEAD_STYLES,
  };
})((window.KQ = window.KQ || {}));
