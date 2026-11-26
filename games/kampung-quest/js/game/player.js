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
  const RADIUS = 0.3;
  const STEP_LEN = 0.62;

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
    };
    return P;
  }

  /** Put the hair / hat choice from the barber (or a save) on the hero's head. */
  function applyOutfit(P, outfit) {
    KQ.Figures.setHeadPiece(P.rig, headSpecFor(outfit));
  }

  /** Put the hero on the ground at x,z, stop all motion and optionally set the heading. */
  function place(P, x, z, heading, heightAt) {
    P.pos.set(x, heightAt(x, z), z);
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
   * Move the hero one frame.
   * @param {object} P player
   * @param {number} dt seconds
   * @param {{x:number,y:number,run:boolean,mag:number}} move camera-relative stick
   * @param {{yaw:number, speedFactor:number, colliders:object[], heightAt:Function, audio:object}} env
   */
  function update(P, dt, move, env) {
    if (P.locked) {
      P.speed = 0;
      animate(P, dt, move);
      sync(P);
      return;
    }
    const top = (move.run ? RUN : WALK) * env.speedFactor;
    const want = desiredVelocity(move, env.yaw, top * move.mag);
    const k = move.mag > 0 ? 14 : 18;
    P.vx = U.damp(P.vx, want.x, k, dt);
    P.vz = U.damp(P.vz, want.z, k, dt);
    const before = { x: P.pos.x, z: P.pos.z };
    P.pos.x += P.vx * dt;
    P.pos.z += P.vz * dt;
    G.Collide.resolve(env.colliders, P.pos, RADIUS);
    const moved = U.dist(before.x, before.z, P.pos.x, P.pos.z);
    P.speed = dt > 0 ? moved / dt : 0;
    if (P.speed > 0.3) P.heading = U.dampAngle(P.heading, Math.atan2(P.vx, P.vz), 12, dt);
    P.pos.y = U.damp(P.pos.y, env.heightAt(P.pos.x, P.pos.z), 18, dt);
    P.moving = P.speed > 0.3;
    footsteps(P, moved, env.audio);
    animate(P, dt, move);
    sync(P);
  }

  /** Hold the hero at a spot with a forced pose (null pose = idle). */
  function lock(P, spot, pose) {
    P.locked = true;
    P.forcedPose = pose || null;
    if (spot) {
      P.pos.set(spot.x, spot.y, spot.z);
      P.heading = spot.heading;
    }
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
