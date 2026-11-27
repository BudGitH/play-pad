/* ============================================================================
 * FILE: camera.js
 * PURPOSE: Third-person follow camera: orbit (mouse / touch drag / pinch), gentle auto-follow
 *          behind the hero, a spring arm that pulls in so it never clips walls, and a fixed
 *          "frame" mode (respectful side angle) used during wudu and prayer.
 * BUSINESS CONTEXT: AC-2 (orbit, never clips buildings), AC-8 (the child watches the hero
 *   take each posture), AC-15 (no shake or bob; reduced motion has nothing to switch off).
 * DEPENDENCIES: THREE, util.js, input.js, collide.js.
 * ========================================================================== */
(function (KQ) {
  "use strict";
  const G = (KQ.Game = KQ.Game || {});
  const U = G.U;
  const PIVOT_H = 0.7;
  const MIN_DIST = 1.6;
  const MAX_DIST = 6.5;
  /** The camera's body for wall tests, the shortest arm, and how much it rises as the arm shortens. */
  const ARM_R = 0.28;
  const MIN_ARM = 0.35;
  const ARM_LIFT = 1.1;

  const C = {
    cam: null,
    yaw: 0,
    pitch: 0.26,
    dist: 2.7,
    armDist: 2.7,
    pivot: null,
    frame: null,
    shift: 0,
    shiftTarget: 0,
    shiftX: 0,
    shiftXTarget: 0,
    idle: 0,
    size: { w: 1, h: 1 },
  };

  /** Attach the camera and its pivot and position vectors; returns the shared camera state. */
  function init(camera) {
    C.cam = camera;
    C.pivot = new THREE.Vector3();
    C.pos = new THREE.Vector3();
    return C;
  }

  /**
   * Apply look and zoom input to yaw, pitch and distance (only in free mode), tracking how long the
   * player has been idle.
   */
  function applyLook(dt, look, free) {
    if (!free) return;
    if (look.x || look.y) C.idle = 0;
    else C.idle += dt;
    C.yaw -= look.x * 0.0058;
    C.pitch = U.clamp(C.pitch + look.y * 0.004, 0.08, 1.05);
    C.dist = U.clamp(C.dist + look.zoom, MIN_DIST, MAX_DIST);
  }

  /** After a short idle, swing the camera behind the hero's heading while they walk. */
  function autoFollow(dt, o, free) {
    if (!free || C.idle < 0.8 || !o.move) return;
    const follow = U.clamp(o.move.y + 0.8 * Math.abs(o.move.x), 0, 1);
    C.yaw = U.dampAngle(C.yaw, o.heading, 1.5 * follow, dt);
  }

  /** Ease yaw, pitch and distance toward the fixed prayer / wudu frame. */
  function easeFrame(dt) {
    const f = C.frame;
    const k = f.rate || 2.6;
    C.yaw = U.dampAngle(C.yaw, f.yaw, k, dt);
    C.pitch = U.damp(C.pitch, f.pitch, k, dt);
    C.dist = U.damp(C.dist, f.dist, k, dt);
  }

  /**
   * Put the camera behind the pivot at the current yaw, pitch and distance. When a wall is in the
   * way the arm pulls in at once (never so far that the camera is inside the wall) and the camera
   * rises a little, so it looks down over the hero instead of through the wall.
   */
  function place(dt, o) {
    const cp = Math.cos(C.pitch);
    const fx = Math.sin(C.yaw);
    const fz = Math.cos(C.yaw);
    const horiz = C.dist * cp;
    const safe = G.Collide.armLength(
      o.colliders,
      C.pivot.x,
      C.pivot.z,
      -fx,
      -fz,
      horiz,
      ARM_R,
      MIN_ARM,
    );
    const k = safe < C.armDist ? 20 : 3;
    C.armDist = U.damp(C.armDist, Math.min(horiz, safe), k, dt);
    const ratio = C.armDist / Math.max(0.01, horiz);
    const lift = (1 - ratio) * ARM_LIFT;
    C.pos.set(
      C.pivot.x - fx * C.armDist,
      Math.max(o.groundY + 0.35, C.pivot.y + Math.sin(C.pitch) * C.dist * ratio + lift),
      C.pivot.z - fz * C.armDist,
    );
    C.cam.position.copy(C.pos);
    C.cam.lookAt(C.pivot);
  }

  /**
   * Slide the picture sideways or down (a view offset) so the hero stays centred beside an open
   * panel.
   */
  function applyShift(dt, snap) {
    C.shift = snap ? C.shiftTarget : U.damp(C.shift, C.shiftTarget, 5, dt);
    C.shiftX = snap ? C.shiftXTarget : U.damp(C.shiftX, C.shiftXTarget, 5, dt);
    const idle = C.shiftTarget === 0 && C.shiftXTarget === 0;
    if (Math.abs(C.shift) < 0.5 && Math.abs(C.shiftX) < 0.5 && idle) {
      if (C.cam.view && C.cam.view.enabled) C.cam.clearViewOffset();
      return;
    }
    C.cam.setViewOffset(C.size.w, C.size.h, C.shiftX, C.shift, C.size.w, C.size.h);
  }

  /**
   * Advance the camera one frame.
   * @param {number} dt seconds
   * @param {{pos:object, heading:number, move:object, groundY:number, colliders:object[]}} o
   */
  function update(dt, o, snap) {
    const free = !C.frame;
    applyLook(dt, G.Input.takeLook(), free);
    if (!free) easeFrame(dt);
    autoFollow(dt, o, free);
    const jump = snap || C.snapNext;
    const k = jump ? 999 : 10;
    const f = C.frame ? C.frame.target : o.pos;
    C.pivot.x = U.damp(C.pivot.x, f.x, k, dt);
    const lift = C.frame && C.frame.lift !== undefined ? C.frame.lift : PIVOT_H;
    C.pivot.y = U.damp(C.pivot.y, f.y + lift, k, dt);
    C.pivot.z = U.damp(C.pivot.z, f.z, k, dt);
    place(jump ? 1 : dt, o);
    applyShift(dt, jump);
    C.snapNext = false;
  }

  G.Camera = {
    init,
    update,
    state: C,
    /** Fixed framing: {target:{x,y,z}, yaw, pitch, dist} or null to return to the free orbit. */
    setFrame(frame) {
      C.frame = frame || null;
      if (!frame) C.idle = 0;
    },
    /**
     * A scripted shot (a cut to a framed view that eases in smoothly): { target:{x,y,z}, yaw, pitch,
     * dist, lift, rate } where `yaw` is the direction the camera looks along (the camera sits
     * behind the target), `lift` the height of the look-at point above the target and `rate` how
     * fast it eases (default 2.6 per second). The follow camera is untouched: clearShot() hands the
     * view back to it.
     */
    shot(frame) {
      C.frame = frame || null;
      if (!frame) C.idle = 0;
    },
    /** End the scripted shot: the free follow camera takes over again. */
    clearShot() {
      C.frame = null;
      C.idle = 0;
    },
    /** Shift the subject up by `px` (so a bottom sheet does not cover the hero). */
    setShift(px, sideways) {
      C.shiftTarget = px || 0;
      C.shiftXTarget = sideways || 0;
    },
    resize(w, h, aspect) {
      C.size.w = w;
      C.size.h = h;
      C.cam.aspect = aspect;
      C.cam.updateProjectionMatrix();
      if (C.cam.view && C.cam.view.enabled) C.cam.clearViewOffset();
    },
    /** Put the camera straight behind the hero (new game, teleport). */
    snapBehind(heading) {
      C.yaw = heading;
      C.armDist = C.dist;
      C.idle = 0;
      C.snapNext = true;
    },
  };
})((window.KQ = window.KQ || {}));
