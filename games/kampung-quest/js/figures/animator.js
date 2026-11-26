// Kampung Quest — apply poses to a figure rig and crossfade between them.
// KQ.Figures.pose(rig, name, phase01, weight) blends the rig toward a pose (weight 1 = snap).
// KQ.Figures.Animator(rig) -> { play(name, fadeSec, rate), update(dt), setRate(r), current() }.
(function (KQ) {
  "use strict";
  const F = (KQ.Figures = KQ.Figures || {});

  /** Every pose name in the contract, in a sensible showcase order. */
  F.POSE_NAMES = [
    "idle",
    "walk",
    "run",
    "sit",
    "eat",
    "wave",
    "talk",
    "carry",
    "wudu_hands",
    "wudu_face",
    "wudu_feet",
    "takbir",
    "qiyam",
    "ruku",
    "itidal",
    "sujud",
    "julus",
    "salam_r",
    "salam_l",
    "doa",
  ];

  /** Loop speed (phase cycles per second) per pose. */
  const RATES = {
    idle: 0.22,
    walk: 1.7,
    run: 2.6,
    wave: 0.9,
    talk: 0.55,
    eat: 0.4,
    wudu_hands: 0.7,
    wudu_face: 0.5,
    wudu_feet: 0.6,
  };

  /**
   * Move a joint's rotation a fraction w of the way toward a target [x, y, z] (w = 1 sets it
   * outright).
   */
  function blendJoint(node, t, w) {
    const r = node.rotation;
    r.x += (t[0] - r.x) * w;
    r.y += (t[1] - r.y) * w;
    r.z += (t[2] - r.z) * w;
  }

  /**
   * Pose a rig.
   * @param {object} rig figure rig (group.userData.rig)
   * @param {string} name a name from POSE_NAMES (unknown names fall back to idle)
   * @param {number} phase01 loop phase 0..1
   * @param {number} [weight=1] 0..1 blend from the rig's current state toward the pose
   */
  F.pose = function (rig, name, phase01, weight) {
    const fn = F.POSES[name] || F.POSES.idle;
    const P = fn(phase01 || 0, rig.dims);
    const w = weight === undefined ? 1 : Math.max(0, Math.min(1, weight));
    const parts = F.POSE_PARTS;
    parts.JOINTS.forEach(function (k) {
      blendJoint(rig[k], P[k] || parts.NEUTRAL[k] || parts.ZERO, w);
    });
    const s = rig.dims.scale;
    rig.root.position.y += ((P.rootY || 0) * s - rig.root.position.y) * w;
    rig.root.position.z += ((P.rootZ || 0) * s - rig.root.position.z) * w;
  };

  /** Drop from the figure origin up to where the seat touches its thighs in the sit / eat poses. */
  F.seatDrop = function (rig) {
    return (rig.dims.hipH - rig.dims.legD / 2) * rig.dims.scale;
  };

  /**
   * Record the rig's current joint rotations and root offsets so a new pose can fade in from them.
   */
  function snapshot(rig) {
    const snap = { rootY: rig.root.position.y, rootZ: rig.root.position.z };
    F.POSE_PARTS.JOINTS.forEach(function (k) {
      const r = rig[k].rotation;
      snap[k] = [r.x, r.y, r.z];
    });
    return snap;
  }

  /** Put a recorded snapshot back on the rig (the start of a cross-fade). */
  function applySnapshot(rig, snap) {
    F.POSE_PARTS.JOINTS.forEach(function (k) {
      rig[k].rotation.set(snap[k][0], snap[k][1], snap[k][2]);
    });
    rig.root.position.y = snap.rootY;
    rig.root.position.z = snap.rootZ;
  }

  /** Smoothstep easing for 0..1, so pose fades start and end gently. */
  function smooth(x) {
    return x * x * (3 - 2 * x);
  }

  /**
   * Crossfading pose player for one rig.
   * @param {object} rig
   */
  F.Animator = function (rig) {
    let cur = { name: "idle", phase: 0, rate: RATES.idle };
    let from = null;
    let fade = 0;
    let fadeDur = 0;
    let rateScale = 1;
    return {
      /**
       * Switch to a named pose or cycle, cross-fading from the current look over fadeSec (default
       * 0.25 s); a repeat call is ignored.
       */
      play: function (name, fadeSec, rate) {
        if (name === cur.name && rate === undefined) return;
        from = snapshot(rig);
        fadeDur = fadeSec === undefined ? 0.25 : fadeSec;
        fade = 0;
        cur = {
          name: name,
          phase: name === cur.name ? cur.phase : 0,
          rate: rate || RATES[name] || 0.3,
        };
      },
      /** Scale the playback speed of the current cycle (e.g. to match walking speed). */
      setRate: function (r) {
        rateScale = r;
      },
      /**
       * Advance the cycle by dt seconds and pose the rig, blending from the snapshot while a fade
       * is running.
       */
      update: function (dt) {
        cur.phase = (cur.phase + dt * cur.rate * rateScale) % 1;
        fade += dt;
        if (from && fade < fadeDur) {
          applySnapshot(rig, from);
          F.pose(rig, cur.name, cur.phase, smooth(fade / fadeDur));
          return;
        }
        from = null;
        F.pose(rig, cur.name, cur.phase, 1);
      },
      /** Name of the pose or cycle being played. */
      current: function () {
        return cur.name;
      },
    };
  };
})((window.KQ = window.KQ || {}));
