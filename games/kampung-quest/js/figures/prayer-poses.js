// Kampung Quest — wudu and solat postures for the toy figures (Shafi'i practice, as usual in Singapore).
// qiyam: right hand over left, below the chest · takbir: hands raised beside the ears, palms forward ·
// ruku: back level (torso ~90 deg at the hips), hands on the knees · i'tidal: upright, arms at the sides ·
// sujud: kneeling, forehead + palms on the floor · julus: sitting on folded legs, hands on the thighs ·
// salam: julus with the head turned right / left · doa: palms up. Wudu: rubbing hands, hands to face,
// one foot lifted forward.
(function (KQ) {
  "use strict";
  const F = (KQ.Figures = KQ.Figures || {});
  const S = F.PoseSolve;
  const PI = Math.PI;
  const TAU = PI * 2;

  /** A tiny rise and fall of the torso, so a held posture still looks alive. */
  function breathe(p) {
    return 0.008 * Math.sin(p * TAU);
  }

  /** Qiyam (standing): hands folded on the chest, gaze down at the place of sujud. */
  function qiyam(p) {
    return {
      torso: [breathe(p), 0, 0],
      head: [0.16, 0, 0], // gaze at the place of sujud
      armL: [-0.22, 0, 0.03],
      armR: [-0.32, 0, -0.03],
      foreL: [-1.42, -1.12, 0],
      foreR: [-1.52, 1.08, 0],
      handL: [0, 0, 0.5],
      handR: [0, 0, -0.5],
    };
  }

  /** Takbir: both hands raised beside the ears at the opening of the prayer. */
  function takbir(p) {
    const lift = 1.45;
    const fold = PI + 0.34 - lift;
    return {
      torso: [breathe(p), 0, 0],
      head: [0.1, 0, 0],
      armL: [-0.2, 0, lift],
      armR: [-0.2, 0, -lift],
      foreL: [0, 0, fold],
      foreR: [0, 0, -fold],
      handL: [-0.25, 0, 0],
      handR: [-0.25, 0, 0],
    };
  }

  /** I'tidal: standing upright with arms at the sides after rising from ruku. */
  function itidal(p) {
    return {
      torso: [breathe(p), 0, 0],
      head: [0.1, 0, 0],
      armL: [0, 0, 0.05],
      armR: [0, 0, -0.05],
      foreL: [-0.12, 0, 0],
      foreR: [-0.12, 0, 0],
    };
  }

  /** Ruku: level back at 90 deg, legs straight, hands on the knees (solved from the real part sizes). */
  function ruku(p, d) {
    const t = PI / 2;
    const hz = -0.035;
    const sh = S.shoulderAt(d, d.hipH, hz, t);
    const knee = [d.hipH - d.thigh + 0.012, hz + d.legD / 2 + 0.03];
    const a = S.reach(d, sh, knee, t);
    return {
      rootZ: hz,
      torso: [t + breathe(p), 0, 0],
      head: [-0.08, 0, 0],
      armL: [a[0], 0, 0.04],
      armR: [a[0], 0, -0.04],
      foreL: [a[1], 0, 0],
      foreR: [a[1], 0, 0],
      handL: [0.3, 0, 0],
      handR: [0.3, 0, 0],
    };
  }

  /**
   * Legs kneeling: thighs tilted forward by a, the knee bent by `knee` (PI/2 + a = shins flat behind;
   * default: tipped up just enough that the knee and the toe of the foot block both rest on the floor).
   */
  function kneelingLegs(P, a, knee) {
    P.legL = [-a, 0, 0];
    P.legR = [-a, 0, 0];
    P.kneeL = [knee, 0, 0];
    P.kneeR = [knee, 0, 0];
    return P;
  }

  /** The knee bend that rests both the knee and the toe of the foot block on the floor. */
  function flatKnee(d, a) {
    return PI / 2 + a + Math.atan2(0.03, d.shin - d.footH / 2);
  }

  /**
   * Hip height for a kneel (thighs at a, knee bend `knee`) so that no corner of the thigh, shin or foot
   * block goes below the floor (the toy's feet used to sink into the floor in sujud and julus).
   */
  function kneelHip(d, a, knee) {
    const kn = S.rot(-d.thigh, 0, -a);
    const half = d.kneelHalf || d.legD / 2; // a long skirt's hem is deeper than a trouser leg
    const shin = [
      [0, -half],
      [0, half],
      [-d.shin, -half],
      [-d.shin, half + 0.04],
      [-d.shin + d.footH, half + 0.04], // + 1 cm: the ihram sandal sole is longer than the shoe
    ];
    let low = Math.min(kn[0] + S.rot(0, -half, -a)[0], kn[0] + S.rot(0, half, -a)[0]);
    shin.forEach((c) => (low = Math.min(low, kn[0] + S.rot(c[0], c[1], knee - a)[0])));
    return Math.max(S.kneelHipY(d, a), 0.002 - low);
  }

  /** Sujud: kneeling, torso folded down until the forehead touches the floor, palms flat by the head. */
  function sujud(p, d) {
    const a = 0.5;
    const knee = flatKnee(d, a);
    const hy = kneelHip(d, a, knee);
    const hz = -d.thigh * Math.sin(a) - 0.02;
    const headX = -0.3;
    const t = S.sujudBend(d, hy, headX);
    const sh = S.shoulderAt(d, hy, hz, t);
    const neck = S.rot(d.torsoH + d.neckH, 0, t);
    const palm = [0.068, hz + neck[1] - 0.02];
    const r = S.reach(d, sh, palm, t);
    return kneelingLegs(
      {
        rootY: hy - d.hipH + breathe(p) * 0.3,
        rootZ: hz,
        torso: [t, 0, 0],
        head: [headX, 0, 0],
        armL: [r[0], 0, 0.3],
        armR: [r[0], 0, -0.3],
        foreL: [r[1], 0.25, 0],
        foreR: [r[1], -0.25, 0],
        handL: [0.9, 0, 0],
        handR: [0.9, 0, 0],
      },
      a,
      knee,
    );
  }

  /**
   * Julus: sitting back on folded legs. Thighs forward, shins folded back with the feet tucked up
   * a little behind the hips (so the toy visibly sits on its heels, owner note PLAY-013), hands on
   * the thighs. Salam and doa build on this pose.
   */
  function julus(p, d) {
    const a = PI / 2 - 0.15;
    const knee = PI / 2 + a - 0.4;
    const hy = kneelHip(d, a, knee); // the shins slope down to the floor: the toy sits on its heels
    const sh = S.shoulderAt(d, hy, 0, 0);
    const r = S.reach(d, sh, [hy + d.legD / 2 + 0.022, d.thigh * 0.78], 0);
    return kneelingLegs(
      {
        rootY: hy - d.hipH,
        torso: [breathe(p) - 0.05, 0, 0],
        head: [0.17, 0, 0],
        armL: [r[0], 0, 0.04],
        armR: [r[0], 0, -0.04],
        foreL: [r[1], -0.12, 0],
        foreR: [r[1], 0.12, 0],
        handL: [0.4, 0, 0],
        handR: [0.4, 0, 0],
      },
      a,
      knee,
    );
  }

  /**
   * Build the salam pose for a direction: the seated pose with the head turned to the right (-1) or
   * left (1).
   */
  function salam(dir) {
    return function (p, d) {
      const P = julus(p, d);
      P.head = [0.06, dir * 1.12, 0];
      return P;
    };
  }

  /** Doa: seated, both palms open and turned up in front of the chest. */
  function doa(p, d) {
    const P = julus(p, d);
    P.armL = [-0.5, 0, 0.1];
    P.armR = [-0.5, 0, -0.1];
    P.foreL = [-1.05 + breathe(p) * 3, -0.32, 0];
    P.foreR = [-1.05 + breathe(p) * 3, 0.32, 0];
    P.handL = [-1.1, 0, 0.35];
    P.handR = [-1.1, 0, -0.35];
    P.head = [0.22, 0, 0];
    return P;
  }

  // ---------- wudu ----------
  /** Wudu, washing the hands: both forearms crossed in front and rubbing together. */
  function wuduHands(p) {
    const s = Math.sin(p * TAU * 2);
    return {
      torso: [0.18, 0, 0],
      head: [0.32, 0, 0],
      armL: [-0.32, 0, 0.05],
      armR: [-0.32, 0, -0.05],
      foreL: [-1.05 + 0.08 * s, -0.95 + 0.14 * s, 0],
      foreR: [-1.05 - 0.08 * s, 0.95 + 0.14 * s, 0],
      handL: [0, 0, 0.6],
      handR: [0, 0, -0.6],
    };
  }

  /** Wudu, washing the face: leaning forward with both hands to the face. */
  function wuduFace(p) {
    const s = Math.sin(p * TAU * 1.5);
    return {
      torso: [0.12, 0, 0],
      head: [0.14 + 0.05 * s, 0, 0],
      armL: [-1.35, 0, 0.16],
      armR: [-1.35, 0, -0.16],
      foreL: [-1.6 + 0.16 * s, -0.5, 0],
      foreR: [-1.6 + 0.16 * s, 0.5, 0],
      handL: [-0.4, 0, 0.5],
      handR: [-0.4, 0, -0.5],
    };
  }

  /** Wudu, washing the feet: one foot lifted and the body bent toward it. */
  function wuduFeet(p) {
    const s = Math.sin(p * TAU * 2);
    return {
      rootZ: -0.02,
      legR: [-0.78, 0, 0],
      kneeR: [0.62, 0, 0],
      legL: [0.05, 0, 0],
      torso: [0.42, 0, 0],
      head: [0.3, 0, 0],
      armR: [-0.62 + 0.06 * s, 0, -0.06],
      foreR: [-0.25, 0.2, 0],
      armL: [-0.1, 0, 0.42],
      foreL: [-0.4, 0, 0],
    };
  }

  /** Wudu, rinsing the mouth: the right hand cupped at the mouth, head tipping a little. */
  function wuduMouth(p) {
    const s = Math.sin(p * TAU * 2);
    return {
      torso: [0.16, 0, 0],
      head: [0.2 + 0.06 * s, 0, 0],
      armR: [-1.3, 0, -0.14],
      foreR: [-1.7 + 0.08 * s, 0.42, 0],
      handR: [-0.4, 0, -0.5],
      armL: [-0.12, 0, 0.1],
      foreL: [-0.3, 0, 0],
    };
  }

  /** Wudu, sniffing water into the nose: the right hand under the nose, head tipped up a little. */
  function wuduNose(p) {
    const s = Math.sin(p * TAU * 2);
    return {
      torso: [0.1, 0, 0],
      head: [-0.06 + 0.05 * s, 0, 0],
      armR: [-1.42, 0, -0.1],
      foreR: [-1.85 + 0.06 * s, 0.32, 0],
      handR: [-0.55, 0, -0.45],
      armL: [-0.12, 0, 0.1],
      foreL: [-0.3, 0, 0],
    };
  }

  /** Wudu, wiping the head: both hands up on top of the head, sliding back. */
  function wuduHead(p) {
    const s = Math.sin(p * TAU);
    return {
      torso: [0.04, 0, 0],
      head: [0.1, 0, 0],
      armL: [-0.2 + 0.18 * s, 0, 2.15],
      armR: [-0.2 + 0.18 * s, 0, -2.15],
      foreL: [0, 0, 1.05],
      foreR: [0, 0, -1.05],
      handL: [0, 0, 0.3],
      handR: [0, 0, -0.3],
    };
  }

  /** Wudu, wiping the ears: both hands beside the ears, fingers running behind them. */
  function wuduEars(p) {
    const s = Math.sin(p * TAU * 1.5);
    const lift = 1.5 + 0.05 * s;
    return {
      torso: [0.04, 0, 0],
      head: [0.08, 0, 0],
      armL: [-0.15, 0, lift],
      armR: [-0.15, 0, -lift],
      foreL: [0, 0, PI + 0.3 - lift],
      foreR: [0, 0, -(PI + 0.3 - lift)],
      handL: [-0.15 + 0.1 * s, 0, 0],
      handR: [-0.15 + 0.1 * s, 0, 0],
    };
  }

  const P = F.POSES;
  P.qiyam = qiyam;
  P.takbir = takbir;
  P.ruku = ruku;
  P.itidal = itidal;
  P.sujud = sujud;
  P.julus = julus;
  P.salam_r = salam(-1);
  P.salam_l = salam(1);
  P.doa = doa;
  // The prayer postures: a peaked cap is worn peak-back for these (see Animator turnCap), so the
  // forehead, not the peak, meets the floor in sujud.
  ["qiyam", "takbir", "ruku", "itidal", "sujud", "julus", "salam_r", "salam_l", "doa"].forEach(
    (n) => (P[n].capBack = true),
  );
  P.wudu_hands = wuduHands;
  P.wudu_face = wuduFace;
  P.wudu_feet = wuduFeet;
  P.wudu_mouth = wuduMouth;
  P.wudu_nose = wuduNose;
  P.wudu_head = wuduHead;
  P.wudu_ears = wuduEars;
})((window.KQ = window.KQ || {}));
