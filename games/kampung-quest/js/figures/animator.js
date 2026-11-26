// Kampung Quest — apply poses to a figure rig and crossfade between them.
// KQ.Figures.pose(rig, name, phase01, weight) blends the rig toward a pose (weight 1 = snap).
// KQ.Figures.Animator(rig) -> { play(name, fadeSec, rate), update(dt), setRate(r), current() }.
(function (KQ) {
  "use strict";
  var F = (KQ.Figures = KQ.Figures || {});

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
  var RATES = {
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

  function blendJoint(node, t, w) {
    var r = node.rotation;
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
    var fn = F.POSES[name] || F.POSES.idle;
    var P = fn(phase01 || 0, rig.dims);
    var w = weight === undefined ? 1 : Math.max(0, Math.min(1, weight));
    var parts = F.POSE_PARTS;
    parts.JOINTS.forEach(function (k) {
      blendJoint(rig[k], P[k] || parts.NEUTRAL[k] || parts.ZERO, w);
    });
    var s = rig.dims.scale;
    rig.root.position.y += ((P.rootY || 0) * s - rig.root.position.y) * w;
    rig.root.position.z += ((P.rootZ || 0) * s - rig.root.position.z) * w;
  };

  /** Drop from the figure origin up to where the seat touches its thighs in the sit / eat poses. */
  F.seatDrop = function (rig) {
    return (rig.dims.hipH - rig.dims.legD / 2) * rig.dims.scale;
  };

  function snapshot(rig) {
    var snap = { rootY: rig.root.position.y, rootZ: rig.root.position.z };
    F.POSE_PARTS.JOINTS.forEach(function (k) {
      var r = rig[k].rotation;
      snap[k] = [r.x, r.y, r.z];
    });
    return snap;
  }

  function applySnapshot(rig, snap) {
    F.POSE_PARTS.JOINTS.forEach(function (k) {
      rig[k].rotation.set(snap[k][0], snap[k][1], snap[k][2]);
    });
    rig.root.position.y = snap.rootY;
    rig.root.position.z = snap.rootZ;
  }

  function smooth(x) {
    return x * x * (3 - 2 * x);
  }

  /**
   * Crossfading pose player for one rig.
   * @param {object} rig
   */
  F.Animator = function (rig) {
    var cur = { name: "idle", phase: 0, rate: RATES.idle };
    var from = null;
    var fade = 0;
    var fadeDur = 0;
    var rateScale = 1;
    return {
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
      setRate: function (r) {
        rateScale = r;
      },
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
      current: function () {
        return cur.name;
      },
    };
  };
})((window.KQ = window.KQ || {}));
