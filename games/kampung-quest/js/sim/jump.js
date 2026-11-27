/* ============================================================================
 * FILE: jump.js
 * PURPOSE: The hero's jump as pure physics: a simple gravity arc above the ground, a grounded
 *          check and no double jump. Height only; walking and collision stay horizontal, so a
 *          jump never lifts the hero onto a roof or over a wall.
 * BUSINESS CONTEXT: Owner request (jump on Space / the touch Jump button). Gentle and low (a
 *   small hop, about 0.8 m high and 0.7 s in the air) so it suits a children's game.
 * DEPENDENCIES: none (no THREE, no DOM).
 * HOW TO TEST: npm run test:kq (tests/kampung-quest/jump.test.mjs)
 * ========================================================================== */
(function (KQ) {
  "use strict";
  KQ.Sim = KQ.Sim || {};
  /** Metres per second squared, and the take-off speed: peak = v^2 / 2g = 0.8 m. */
  const GRAVITY = 14;
  const TAKEOFF = 4.73;
  /** The longest step integrated at once, so one slow frame cannot skip the landing. */
  const MAX_STEP = 1 / 30;

  /** A new jump state: standing on the ground. h = metres above the ground, vy = vertical speed. */
  function create() {
    return { h: 0, vy: 0, grounded: true };
  }

  /** Leave the ground if standing on it. Returns true when a jump started (false in the air). */
  function press(J) {
    if (!J.grounded) return false;
    J.grounded = false;
    J.vy = TAKEOFF;
    return true;
  }

  /**
   * Advance the arc by dt seconds. Returns "land" on the step the hero touches down again,
   * otherwise null. The height never goes below the ground.
   */
  function step(J, dt) {
    if (J.grounded) return null;
    let left = dt;
    while (left > 1e-9 && !J.grounded) {
      const d = Math.min(left, MAX_STEP);
      left -= d;
      J.h += J.vy * d - 0.5 * GRAVITY * d * d;
      J.vy -= GRAVITY * d;
      if (J.h <= 0) {
        J.h = 0;
        J.vy = 0;
        J.grounded = true;
        return "land";
      }
    }
    return null;
  }

  /** Back on the ground at once (teleport, a prayer or service lock). */
  function reset(J) {
    J.h = 0;
    J.vy = 0;
    J.grounded = true;
  }

  KQ.Sim.Jump = {
    create,
    press,
    step,
    reset,
    GRAVITY,
    TAKEOFF,
    PEAK: (TAKEOFF * TAKEOFF) / (2 * GRAVITY),
    AIR_TIME: (2 * TAKEOFF) / GRAVITY,
  };
})(
  ((typeof window !== "undefined" ? window : globalThis).KQ =
    (typeof window !== "undefined" ? window : globalThis).KQ || {}),
);
