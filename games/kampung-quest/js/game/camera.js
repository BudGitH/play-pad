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

  function init(camera) {
    C.cam = camera;
    C.pivot = new THREE.Vector3();
    C.pos = new THREE.Vector3();
    return C;
  }

  function applyLook(dt, look, free) {
    if (!free) return;
    if (look.x || look.y) C.idle = 0;
    else C.idle += dt;
    C.yaw -= look.x * 0.0058;
    C.pitch = U.clamp(C.pitch + look.y * 0.004, 0.08, 1.05);
    C.dist = U.clamp(C.dist + look.zoom, MIN_DIST, MAX_DIST);
  }

  function autoFollow(dt, o, free) {
    if (!free || C.idle < 0.8 || !o.move) return;
    const follow = U.clamp(o.move.y + 0.8 * Math.abs(o.move.x), 0, 1);
    C.yaw = U.dampAngle(C.yaw, o.heading, 1.5 * follow, dt);
  }

  function easeFrame(dt) {
    const f = C.frame;
    C.yaw = U.dampAngle(C.yaw, f.yaw, 2.6, dt);
    C.pitch = U.damp(C.pitch, f.pitch, 2.6, dt);
    C.dist = U.damp(C.dist, f.dist, 2.6, dt);
  }

  /** Where the spring arm ends: walk from the pivot toward `want` and stop before a wall. */
  function armLength(o, want, len) {
    const dx = want.x - C.pivot.x;
    const dz = want.z - C.pivot.z;
    const steps = Math.ceil(len / 0.2);
    for (let i = 1; i <= steps; i += 1) {
      const t = i / steps;
      if (G.Collide.camBlocked(o.colliders, C.pivot.x + dx * t, C.pivot.z + dz * t, 0.45)) {
        return Math.max(0.9, ((i - 1) / steps) * len - 0.2);
      }
    }
    return len;
  }

  function place(dt, o) {
    const cp = Math.cos(C.pitch);
    const fx = Math.sin(C.yaw);
    const fz = Math.cos(C.yaw);
    const want = {
      x: C.pivot.x - fx * C.dist * cp,
      y: C.pivot.y + Math.sin(C.pitch) * C.dist,
      z: C.pivot.z - fz * C.dist * cp,
    };
    const safe = armLength(o, want, C.dist * cp);
    const target = Math.min(C.dist * cp, safe);
    const k = target < C.armDist ? 20 : 3;
    C.armDist = U.damp(C.armDist, target, k, dt);
    const ratio = C.armDist / Math.max(0.01, C.dist * cp);
    C.pos.set(
      C.pivot.x + (want.x - C.pivot.x) * ratio,
      Math.max(o.groundY + 0.35, C.pivot.y + (want.y - C.pivot.y) * ratio),
      C.pivot.z + (want.z - C.pivot.z) * ratio,
    );
    C.cam.position.copy(C.pos);
    C.cam.lookAt(C.pivot);
  }

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
