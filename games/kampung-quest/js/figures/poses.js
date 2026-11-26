// Kampung Quest — figure poses. Each pose is a function (phase01, dims) -> joint targets (Euler x/y/z in
// radians, figure units for the root). Convention: the figure faces +z, its left is +x.
//   leg x < 0 swings forward · knee x > 0 folds the shin back · torso/head x > 0 bends/nods forward
//   arm x < 0 swings forward/up · armL z > 0 / armR z < 0 lifts the arm outward · fore x < 0 bends up.
// Prayer poses are solved from the real part sizes (kneeling height, 2-bone arm reach) so hands land on
// the knees in ruku and on the floor in sujud for both adult and kid leg lengths.
(function (KQ) {
  "use strict";
  var F = (KQ.Figures = KQ.Figures || {});
  var PI = Math.PI;
  var TAU = PI * 2;

  var JOINTS = [
    "hips",
    "torso",
    "head",
    "armL",
    "armR",
    "foreL",
    "foreR",
    "handL",
    "handR",
    "legL",
    "legR",
    "kneeL",
    "kneeR",
  ];
  // Toy stance: arms angled out and a little forward at the shoulder, elbows bent so the C-hands sit
  // forward of the hips (like the reference minifig standing on the table).
  var NEUTRAL = {
    armL: [-0.16, 0, 0.2],
    armR: [-0.16, 0, -0.2],
    foreL: [-0.62, -0.12, 0],
    foreR: [-0.62, 0.12, 0],
    handL: [0, 0, 0.25],
    handR: [0, 0, -0.25],
  };
  var ZERO = [0, 0, 0];

  // ---------- sagittal-plane solvers ----------
  /** Rotate an (up, forward) offset by angle a about x: returns [y, z]. */
  function rot(up, fwd, a) {
    return [up * Math.cos(a) - fwd * Math.sin(a), up * Math.sin(a) + fwd * Math.cos(a)];
  }

  /** Hip height above the floor when kneeling with the shins flat behind and the thighs tilted forward by a. */
  function kneelHipY(d, a) {
    return d.legD / 2 + d.thigh * Math.cos(a);
  }

  /** Shoulder [y, z] for a hip at [hy, hz] and a torso bent forward by t. */
  function shoulderAt(d, hy, hz, t) {
    var s = rot(d.shoulderY, 0, t);
    return [hy + d.hipBlockH + s[0], hz + s[1]];
  }

  /**
   * Two-bone arm reach in the sagittal plane: from shoulder S to target T, torso angle t.
   * Returns [armX, foreX] relative rotations (elbow folds forward).
   */
  function reach(d, S, T, t) {
    var a = d.upperArm;
    var b = d.forearm + 0.056;
    var vy = T[0] - S[0];
    var vz = T[1] - S[1];
    var L = Math.min(Math.hypot(vy, vz), a + b - 1e-4);
    var phi = Math.atan2(-vz, -vy); // absolute angle that points the arm straight at T
    var alpha = Math.acos(Math.max(-1, Math.min(1, (a * a + L * L - b * b) / (2 * a * L))));
    var gamma = Math.acos(Math.max(-1, Math.min(1, (a * a + b * b - L * L) / (2 * a * b))));
    return [phi + alpha - t, -(PI - gamma)];
  }

  /** Torso bend (radians) that brings the forehead down to the floor from a hip at height hy. */
  function sujudBend(d, hy, headX) {
    var lo = 1.2;
    var hi = 2.4;
    for (var i = 0; i < 24; i++) {
      var t = (lo + hi) / 2;
      var neck = rot(d.torsoH + d.neckH, 0, t);
      var brow = rot(0.17 * d.headScale, (d.headR + 0.012) * d.headScale, t + headX);
      var y = hy + d.hipBlockH + neck[0] + brow[0];
      if (y > 0.012) lo = t;
      else hi = t;
    }
    return (lo + hi) / 2;
  }

  // ---------- locomotion & daily life ----------
  function idle(p) {
    var b = Math.sin(p * TAU);
    return {
      torso: [0.012 * b, 0, 0],
      head: [0.02 * b, 0.14 * Math.sin(p * TAU + 1), 0],
      armL: [-0.16 + 0.02 * b, 0, 0.2],
      armR: [-0.16 - 0.02 * b, 0, -0.2],
    };
  }

  function stride(p, amp, knee, arm, fore, lean, bob) {
    var s = Math.sin(p * TAU);
    var c = Math.cos(p * TAU);
    return {
      rootY: bob * Math.abs(c),
      legL: [amp * s, 0, 0],
      legR: [-amp * s, 0, 0],
      kneeL: [knee * Math.max(0, -c), 0, 0],
      kneeR: [knee * Math.max(0, c), 0, 0],
      armL: [-arm * s, 0, 0.08],
      armR: [arm * s, 0, -0.08],
      foreL: [fore, 0, 0],
      foreR: [fore, 0, 0],
      torso: [lean, 0.06 * s, 0],
      head: [-lean * 0.6, -0.05 * s, 0],
    };
  }
  function walk(p) {
    return stride(p, 0.5, 0.35, 0.45, -0.38, 0.02, 0.008);
  }
  function run(p) {
    return stride(p, 0.85, 0.75, 0.9, -1.35, 0.18, 0.022);
  }

  function seated() {
    return {
      legL: [-PI / 2, 0, 0],
      legR: [-PI / 2, 0, 0],
      kneeL: [PI / 2, 0, 0],
      kneeR: [PI / 2, 0, 0],
    };
  }
  function sit(p) {
    var P = seated();
    var b = Math.sin(p * TAU);
    P.armL = [-0.35, 0, 0.12];
    P.armR = [-0.35, 0, -0.12];
    P.foreL = [-0.9, -0.2, 0];
    P.foreR = [-0.9, 0.2, 0];
    P.head = [0.02 * b, 0.1 * Math.sin(p * TAU + 2), 0];
    return P;
  }
  function eat(p) {
    var P = seated();
    var k = 0.5 - 0.5 * Math.cos(p * TAU);
    P.armL = [-0.55, 0, 0.12];
    P.foreL = [-0.8, -0.25, 0];
    P.armR = [-0.45 - 0.55 * k, 0, -0.18];
    P.foreR = [-1.0 - 1.25 * k, 0.5 * k, 0];
    P.head = [0.18 - 0.12 * k, 0, 0];
    P.torso = [0.08 * (1 - k), 0, 0];
    return P;
  }
  function wave(p) {
    var s = Math.sin(p * TAU * 2);
    return {
      armR: [-0.15, 0, -2.45],
      foreR: [0, 0, -0.35 + 0.42 * s],
      handR: [0, 0, 0.2 * s],
      head: [-0.06, -0.15, 0.08],
      torso: [0, -0.06, 0.03],
    };
  }
  function talk(p) {
    var s = Math.sin(p * TAU);
    var s2 = Math.sin(p * TAU * 2);
    return {
      armR: [-0.42 + 0.14 * s, 0, -0.2],
      foreR: [-1.0 + 0.3 * s2, 0.35, 0],
      handR: [0, 0, 0.3 * s2],
      armL: [-0.1 - 0.06 * s, 0, 0.16],
      head: [0.06 * s2, 0.1 * s, 0],
      torso: [0, 0.05 * s, 0],
    };
  }
  function carry(p) {
    var b = Math.sin(p * TAU);
    return {
      armL: [-0.55, 0, 0.05],
      armR: [-0.55, 0, -0.05],
      foreL: [-1.0, -0.3, 0],
      foreR: [-1.0, 0.3, 0],
      torso: [-0.05 + 0.01 * b, 0, 0],
      head: [0.05, 0, 0],
    };
  }

  F.POSE_PARTS = { JOINTS: JOINTS, NEUTRAL: NEUTRAL, ZERO: ZERO };
  F.PoseSolve = {
    rot: rot,
    kneelHipY: kneelHipY,
    shoulderAt: shoulderAt,
    reach: reach,
    sujudBend: sujudBend,
  };
  F.POSES = {
    idle: idle,
    walk: walk,
    run: run,
    sit: sit,
    eat: eat,
    wave: wave,
    talk: talk,
    carry: carry,
  };
})((window.KQ = window.KQ || {}));
