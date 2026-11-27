/* ============================================================================
 * FILE: shots.js
 * PURPOSE: The camera shots for wudu and prayer: a close-up that shows the action clearly (the hands at
 *          the tap, the face for qiyam), a side view for ruku and sujud, a front view for qiyam and
 *          tashahhud, and an over-the-shoulder view from behind. The child cycles through three of
 *          them with "Change view".
 * BUSINESS CONTEXT: AC-H8. Pure maths (no DOM, no THREE): given where the hero stands and faces, it
 *   returns the frame the scripted-shot API (KQ.Game.Camera.shot) eases to.
 * DEPENDENCIES: none at load; used by prayer-flow.js.
 * ========================================================================== */
(function (KQ) {
  "use strict";
  const G = (KQ.Game = KQ.Game || {});

  /** The view each kind of step opens with: a side view for the bowing and low postures, a front view for standing ones. */
  const DEFAULT_VIEW = {
    takbir: "front",
    qiyam: "front",
    itidal: "front",
    qunut: "front",
    ruku: "side",
    sujud: "side",
    julus: "side",
    tasyahud_awal: "front",
    tasyahud_akhir: "front",
    salam_r: "front",
    salam_l: "front",
  };
  /** Low postures look at the hero's middle, not their head. */
  const LOW = { sujud: 0.32, julus: 0.42, tasyahud_awal: 0.45, tasyahud_akhir: 0.45, ruku: 0.55 };
  const NAMES = { close: "Close-up", front: "Front", side: "Side", behind: "Behind" };

  /** Is this a wudu pose name (the wudu cards pass the pose, the prayer cards the posture type)? */
  const isWudu = (kind) => String(kind).indexOf("wudu_") === 0;

  /** The three views to cycle through for a kind of step, the opening one first. */
  function views(kind) {
    const first = isWudu(kind) ? "close" : DEFAULT_VIEW[kind] || "front";
    const pool = isWudu(kind) ? ["close", "side", "behind"] : ["front", "side", "behind"];
    return [first].concat(pool.filter((v) => v !== first));
  }

  /**
   * The frame for a view. `spot` = { x, y, z, heading } of the hero; `kind` the step (for the look-at
   * height). yaw is where the camera looks: behind the hero = their heading, in front = heading + PI.
   */
  function frame(view, spot, kind) {
    const lift = LOW[kind] || (isWudu(kind) ? 0.62 : 0.68);
    const base = { target: { x: spot.x, y: spot.y, z: spot.z }, lift, rate: 2.8 };
    const h = spot.heading;
    if (view === "close")
      return Object.assign(base, { yaw: h + Math.PI - 0.4, pitch: 0.1, dist: 1.35 });
    if (view === "side")
      return Object.assign(base, { yaw: h + Math.PI / 2, pitch: 0.07, dist: 2.5 });
    if (view === "behind") return Object.assign(base, { yaw: h + 0.5, pitch: 0.2, dist: 2.6 });
    return Object.assign(base, { yaw: h + Math.PI - 0.15, pitch: 0.08, dist: 2.2 });
  }

  G.Shots = { views, frame, NAMES, DEFAULT_VIEW };
})((window.KQ = window.KQ || {}));
